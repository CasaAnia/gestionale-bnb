import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daControllareHome, eccezioniRichieste, eccezioniPagamenti, eccezioniCalendario, eccezioniArrivi, eccezioniFatture,
  applicaRinvii, ordinaEccezioni, rigaConteggi, titoloStriscia, rigaAPosto, hrefDestinazione, finoADomani, conteggiPerTipo, euroTesto,
  type PrenotazioneDC, type RichiestaDC, type Eccezione,
} from './daControllare.ts'

const OGGI = '2026-09-15'
const ADESSO = new Date('2026-09-15T12:00:00+02:00')

// Ogni prenotazione di prova ha il telefono della scheda cliente (come in
// produzione): dal 07/09/2026 un arrivo SENZA numero ha un motivo diverso
const b = (id: string, camera: string, check_in: string, check_out: string, total: number, extra: Partial<PrenotazioneDC> = {}): PrenotazioneDC =>
  ({ id, room_id: camera, rooms: { name: `Camera ${camera}` }, guest_name: `Ospite ${id}`, guests: { full_name: null, phone: '+39 333 000 0000' }, check_in, check_out, total_amount: total, status: 'confermata', ...extra })
const r = (id: string, stato: string, arrivo: string, created_at: string, proposta_inviata_at: string | null = null): RichiestaDC =>
  ({ id, stato, arrivo, partenza: '2026-09-25', created_at, proposta_inviata_at, nome: 'Anna', cognome: 'Rossi' })

// ── Richieste ──────────────────────────────────────────────────────────────
// Requisito del 07/09/2026: in «Da controllare» compaiono TUTTE le richieste
// aperte (prima solo quelle ferme da più di 48 ore); a parità di durata le in
// attesa vanno dalla più vecchia.
test('richieste: tutte le aperte compaiono; in attesa dalla più vecchia a parità di durata', () => {
  const ore49 = new Date(ADESSO.getTime() - 49 * 3600000).toISOString()
  const ore47 = new Date(ADESSO.getTime() - 47 * 3600000).toISOString()
  const min20 = new Date(ADESSO.getTime() - 20 * 60000).toISOString()
  const out = eccezioniRichieste([r('fresca', 'in_attesa', '2026-09-20', ore47), r('lenta', 'in_attesa', '2026-09-20', ore49), r('nuova', 'in_attesa', '2026-09-20', min20)], OGGI, ADESSO)
  assert.deepEqual(out.map(e => [e.chiave, e.urgenza, e.motivo]), [
    ['richiesta:lenta', 'normale', 'In attesa da 2 giorni senza proposta'],
    ['richiesta:fresca', 'normale', 'In attesa da 1 giorno senza proposta'],
    ['richiesta:nuova', 'normale', 'In attesa da 20 min senza proposta'],
  ])
  assert.equal(out[0].titolo, 'Anna Rossi · 20–25 set')
  assert.equal(out[0].bottone, 'Apri richiesta')
  assert.equal(out[0].rimandabile, true)
})

// Requisito del 07/09/2026: anche la proposta inviata non ancora scaduta
// compare (normale, col tempo che resta); la scaduta è alta e viene prima.
test('richieste: proposta scaduta (oltre le 3 ore) è urgenza alta e precede quella in scadenza, che compare normale', () => {
  const ore4 = new Date(ADESSO.getTime() - 4 * 3600000).toISOString()
  const ore2 = new Date(ADESSO.getTime() - 2 * 3600000).toISOString()
  const vecchia = '2026-09-10T08:00:00+02:00'
  const out = eccezioniRichieste([r('viva', 'proposta_inviata', '2026-09-20', vecchia, ore2), r('scad', 'proposta_inviata', '2026-09-20', vecchia, ore4)], OGGI, ADESSO)
  assert.deepEqual(out.map(e => [e.chiave, e.urgenza]), [['richiesta:scad', 'alta'], ['richiesta:viva', 'normale']])
  assert.equal(out[0].motivo, 'Proposta scaduta 1 h fa senza conferma né rifiuto')
  assert.equal(out[1].motivo, 'Proposta inviata · scade tra 1 h')
})

// Requisito del 07/09/2026: compare comunque (è aperta), ma senza ora di
// invio non può essere «scaduta»: resta normale, senza linea ottone.
test('richieste: proposta inviata senza ora di invio compare normale, mai come scaduta', () => {
  const out = eccezioniRichieste([r('x', 'proposta_inviata', '2026-09-20', '2026-09-01T08:00:00+02:00', null)], OGGI, ADESSO)
  assert.deepEqual(out.map(e => [e.chiave, e.urgenza, e.motivo, e.whatsapp]), [['richiesta:x', 'normale', 'Proposta inviata, in attesa di risposta', undefined]])
})

test('richieste: arrivo passato e ancora aperta compare (anche con proposta scaduta, una voce sola); chiusa mai', () => {
  const out = eccezioniRichieste([
    r('passata', 'proposta_inviata', '2026-09-10', '2026-09-01T08:00:00+02:00', '2026-09-02T08:00:00+02:00'),
    r('conf', 'confermata', '2026-09-01', '2026-08-01T08:00:00+02:00'),
    r('rif', 'rifiutata', '2026-09-01', '2026-08-01T08:00:00+02:00'),
  ], OGGI, ADESSO)
  assert.equal(out.length, 1)
  assert.equal(out[0].chiave, 'richiesta:passata')
  assert.equal(out[0].urgenza, 'alta')   // linea ottone anche sugli arrivi passati (07/09/2026)
  assert.equal(out[0].motivo, 'Arrivo del 10 set già passato e richiesta ancora aperta')
})

// ── Pagamenti ──────────────────────────────────────────────────────────────
test('pagamenti: concluso, pagato ma movimenti che non coprono il totale → Registra saldo; coperto non compare', () => {
  const pren = [b('a', 'amelia', '2026-09-10', '2026-09-12', 340, { pagato: true }), b('b', 'ambra', '2026-09-10', '2026-09-12', 200, { pagato: true })]
  const pag = [{ booking_id: 'a', amount: 200, paid_on: '2026-09-10' }, { booking_id: 'b', amount: 200, paid_on: '2026-09-10' }]
  const out = eccezioniPagamenti(pren, pag, OGGI)
  assert.deepEqual(out.map(e => [e.chiave, e.bottone, e.motivo]), [['pagamento:a', 'Registra saldo', 'Segnato pagato ma i movimenti coprono 200 € su 340 €']])
  assert.deepEqual(out[0].destinazione, { tipo: 'saldo', prenotazioneId: 'a' })
  assert.equal(out[0].titolo, 'Ospite a · amelia · 10–12 set')
})

test('pagamenti: pagato ma incompleto con soggiorno ANCORA in corso non compare', () => {
  const pren = [b('a', 'amelia', '2026-09-14', '2026-09-18', 340, { pagato: true })]
  const out = eccezioniPagamenti(pren, [{ booking_id: 'a', amount: 100, paid_on: '2026-09-14' }], OGGI)
  assert.deepEqual(out, [])
})

test('pagamenti: movimenti oltre il totale compaiono sempre, con «Apri prenotazione»', () => {
  const pren = [b('a', 'amelia', '2026-09-20', '2026-09-22', 100, { pagato: false })]
  const out = eccezioniPagamenti(pren, [{ booking_id: 'a', amount: 150, paid_on: '2026-09-01' }], OGGI)
  assert.deepEqual(out.map(e => [e.bottone, e.motivo]), [['Apri prenotazione', 'Movimenti per 150 € oltre il totale di 100 €']])
  assert.deepEqual(out[0].destinazione, { tipo: 'prenotazione', prenotazioneId: 'a' })
})

test('pagamenti: concluso da più di un giorno e non pagato compare; concluso oggi, futuro, in attesa o a zero no', () => {
  const pren = [
    b('vecchio', 'amelia', '2026-09-10', '2026-09-13', 160),
    b('ieri', 'ambra', '2026-09-12', '2026-09-14', 160),          // partito ieri: concluso da 1 giorno → compare
    b('oggi', 'lena', '2026-09-13', '2026-09-15', 160),           // parte oggi: non ancora
    b('futuro', 'allegra', '2026-09-20', '2026-09-22', 160),
    b('attesa', 'amelia', '2026-09-01', '2026-09-03', 160, { status: 'in_attesa' }),
    b('annullata', 'amelia', '2026-09-01', '2026-09-03', 160, { status: 'annullata' }),
    b('zero', 'amelia', '2026-09-01', '2026-09-03', 0),
  ]
  const out = eccezioniPagamenti(pren, [], OGGI)
  assert.deepEqual(out.map(e => e.chiave), ['pagamento:vecchio', 'pagamento:ieri'])
  assert.equal(out[0].motivo, 'Soggiorno concluso il 13 set e non segnato pagato')
  assert.equal(out[0].bottone, 'Registra saldo')
})

test('pagamenti: il soggiorno con cambio camera è uno solo (totale dei segmenti) e porta al primo segmento', () => {
  const pren = [
    b('s2', 'ambra', '2026-09-12', '2026-09-13', 100, { group_id: 'g', pagato: true }),
    b('s1', 'amelia', '2026-09-10', '2026-09-12', 200, { group_id: 'g', pagato: true }),
  ]
  const out = eccezioniPagamenti(pren, [{ booking_id: 's1', amount: 250, paid_on: '2026-09-10' }], OGGI)
  assert.equal(out.length, 1)
  assert.equal(out[0].chiave, 'pagamento:g')
  assert.equal(out[0].motivo, 'Segnato pagato ma i movimenti coprono 250 € su 300 €')
  assert.deepEqual(out[0].destinazione, { tipo: 'saldo', prenotazioneId: 's1' })
  assert.equal(out[0].titolo, 'Ospite s1 · amelia · 10–13 set')
})

test('pagamenti: pagato senza alcun movimento (storico da ricostruire) NON compare qui', () => {
  const out = eccezioniPagamenti([b('a', 'amelia', '2026-09-10', '2026-09-12', 340, { pagato: true })], [], OGGI)
  assert.deepEqual(out, [])
})

// ── Calendario ─────────────────────────────────────────────────────────────
// Dal 07/09/2026 la sovrapposizione è un controllo nascosto: niente linea
// ottone (urgenza normale), compare in fondo solo se si verifica.
test('calendario: due confermate sulla stessa camera nella stessa notte → voce (normale) sul primo giorno in comune', () => {
  const out = eccezioniCalendario([b('a', 'amelia', '2026-09-15', '2026-09-17', 140), b('d', 'amelia', '2026-09-16', '2026-09-18', 140)])
  assert.equal(out.length, 1)
  assert.equal(out[0].urgenza, 'normale')
  assert.equal(out[0].titolo, 'amelia · Ospite a e Ospite d · notte del 16 set')
  assert.deepEqual(out[0].destinazione, { tipo: 'calendario', giorno: '2026-09-16' })
  assert.equal(out[0].chiave, 'sovrapposizione:a:d')
})

test('calendario: un cambio camera NON è una sovrapposizione; partenza = arrivo nella stessa camera nemmeno; annullata o in attesa mai', () => {
  const out = eccezioniCalendario([
    b('s1', 'amelia', '2026-09-15', '2026-09-17', 140, { group_id: 'g' }),
    b('s2', 'ambra', '2026-09-17', '2026-09-19', 140, { group_id: 'g' }),
    b('x', 'ambra', '2026-09-15', '2026-09-17', 140),                  // parte quando s2 arriva
    b('att', 'amelia', '2026-09-15', '2026-09-17', 140, { status: 'in_attesa' }),
    b('ann', 'amelia', '2026-09-15', '2026-09-17', 140, { status: 'annullata' }),
  ])
  assert.deepEqual(out, [])
})

test('calendario: più notti in comune → «notti 16–17 set»', () => {
  const out = eccezioniCalendario([b('a', 'amelia', '2026-09-15', '2026-09-18', 140), b('d', 'amelia', '2026-09-16', '2026-09-20', 140)])
  assert.equal(out[0].titolo, 'amelia · Ospite a e Ospite d · notti 16–17 set')
})

test('calendario: letti aggiuntivi oltre i 2 del pool nella stessa notte; 2 su 2 va bene; notti consecutive in una voce', () => {
  const ok = eccezioniCalendario([
    b('a', 'amelia', '2026-09-20', '2026-09-22', 100, { extra_bed: true, num_guests: 3 }),
    b('c', 'ambra', '2026-09-20', '2026-09-22', 100, { extra_bed: true, num_guests: 3 }),
  ])
  assert.deepEqual(ok, [])
  const troppi = eccezioniCalendario([
    b('a', 'amelia', '2026-09-20', '2026-09-22', 100, { extra_bed: true, num_guests: 3 }),
    b('c', 'ambra', '2026-09-20', '2026-09-22', 100, { extra_bed: true, num_guests: 3 }),
    b('l', 'allegra', '2026-09-20', '2026-09-22', 100, { extra_bed_dates: ['2026-09-20', '2026-09-21'], num_guests: 3 }),
  ])
  assert.equal(troppi.length, 1)
  assert.equal(troppi[0].urgenza, 'normale')   // controllo nascosto (07/09/2026)
  assert.equal(troppi[0].titolo, 'Letti aggiuntivi · 3 su 2 · notti 20–21 set')
  assert.deepEqual(troppi[0].destinazione, { tipo: 'calendario', giorno: '2026-09-20' })
})

// ── Arrivi ─────────────────────────────────────────────────────────────────
test('arrivi: arrivo di domani senza orario → alta; con orario, oggi o cambio camera no', () => {
  const out = eccezioniArrivi([
    b('senza', 'amelia', '2026-09-16', '2026-09-18', 100),
    b('con', 'ambra', '2026-09-16', '2026-09-18', 100, { check_in_time: '15:00' }),
    b('vuoto', 'lena', '2026-09-16', '2026-09-18', 100, { check_in_time: '  ' }),
    b('oggi', 'allegra', '2026-09-15', '2026-09-18', 100),
    b('c1', 'allegra', '2026-09-14', '2026-09-16', 100, { group_id: 'g', check_in_time: '14:00' }),
    b('c2', 'amelia', '2026-09-16', '2026-09-18', 100, { group_id: 'g' }),   // cambio camera: già in casa
    b('att', 'ambra', '2026-09-16', '2026-09-18', 100, { status: 'in_attesa' }),
  ], OGGI)
  assert.deepEqual(out.map(e => e.chiave), ['arrivo:senza', 'arrivo:vuoto'])
  assert.equal(out[0].urgenza, 'alta')
  assert.equal(out[0].titolo, 'Ospite senza · amelia · domani')
  assert.equal(out[0].motivo, 'Arrivo di domani senza orario')
  assert.deepEqual(out[0].destinazione, { tipo: 'arrivo', prenotazioneId: 'senza' })
})

// ── Fatture ────────────────────────────────────────────────────────────────
test('fatture: scaduta e da pagare compare; in scadenza oggi, pagata o scontrino no', () => {
  const out = eccezioniFatture([
    { id: 'f1', kind: 'fattura', status: 'approvata_da_pagare', due_date: '2026-09-10', doc_total: 95.5, supplier: 'Enel' },
    { id: 'f2', kind: 'fattura', status: 'approvata_da_pagare', due_date: '2026-09-15', doc_total: 300 },
    { id: 'f3', kind: 'fattura', status: 'confermato', due_date: '2026-09-01', doc_total: 220 },
    { id: 'f4', kind: 'scontrino', status: 'approvata_da_pagare', due_date: '2026-09-01', doc_total: 12 },
    { id: 'f5', kind: 'fattura', status: 'approvata_da_pagare', due_date: null, doc_total: 50 },
  ], OGGI)
  assert.deepEqual(out.map(e => e.chiave), ['fattura:f1'])
  assert.equal(out[0].titolo, 'Enel · 95,50 € · scaduta il 10 set')
  assert.equal(out[0].motivo, 'Scadenza passata e fattura non pagata')
  assert.deepEqual(out[0].destinazione, { tipo: 'fattura', documentoId: 'f1' })
  assert.equal(out[0].urgenza, 'normale')
})

// ── Rinvii, ordine, testi ──────────────────────────────────────────────────
const ecc = (chiave: string, tipo: Eccezione['tipo'], urgenza: Eccezione['urgenza'], data: string, rimandabile = false): Eccezione =>
  ({ chiave, tipo, urgenza, data, titolo: chiave, motivo: '', bottone: '', destinazione: { tipo: 'calendario', giorno: data }, rimandabile })

test('rinvii: una richiesta rimandata sparisce finché oggi < fino_a e riappare dopo; le voci non rimandabili ignorano i rinvii', () => {
  const lista = [ecc('richiesta:1', 'richiesta', 'normale', '2026-09-20', true), ecc('arrivo:2', 'arrivo', 'alta', '2026-09-16')]
  const rinvii = [{ chiave: 'richiesta:1', fino_a: finoADomani(OGGI) }, { chiave: 'arrivo:2', fino_a: '2026-12-31' }]
  assert.equal(finoADomani(OGGI), '2026-09-16')
  assert.deepEqual(applicaRinvii(lista, rinvii, OGGI).map(e => e.chiave), ['arrivo:2'])
  assert.deepEqual(applicaRinvii(lista, rinvii, '2026-09-16').map(e => e.chiave), ['richiesta:1', 'arrivo:2'])
  assert.deepEqual(applicaRinvii(lista, undefined, OGGI).map(e => e.chiave), ['richiesta:1', 'arrivo:2'])
})

// Requisito del 07/09/2026: sezioni nell'ordine richieste → arrivi →
// pagamenti → fatture → calendario in fondo; dentro la sezione l'ordine resta
// quello della sua regola (ordinamento stabile).
test('ordine: richieste, arrivi, pagamenti, fatture, calendario in fondo; dentro la sezione l\'ordine di arrivo resta', () => {
  const out = ordinaEccezioni([
    ecc('f', 'fattura', 'normale', '2026-08-01'),
    ecc('c', 'calendario', 'normale', '2026-10-01'),
    ecc('p1', 'pagamento', 'normale', '2026-09-14'),
    ecc('a', 'arrivo', 'alta', '2026-09-16'),
    ecc('r2', 'richiesta', 'normale', '2026-09-17'),
    ecc('p2', 'pagamento', 'normale', '2026-09-01'),
    ecc('r1', 'richiesta', 'alta', '2026-09-30'),
  ])
  assert.deepEqual(out.map(e => e.chiave), ['r2', 'r1', 'a', 'p1', 'p2', 'f', 'c'])
})

test('ordine delle richieste: durata decrescente; a parità arrivo passato, poi scaduta, poi in scadenza più vicina, poi in attesa più vecchia', () => {
  const inviata = (oreFa: number) => new Date(ADESSO.getTime() - oreFa * 3600000).toISOString()
  const creata = (oreFa: number) => new Date(ADESSO.getTime() - oreFa * 3600000).toISOString()
  const lista: RichiestaDC[] = [
    { ...r('corta-scaduta', 'proposta_inviata', '2026-09-20', creata(30), inviata(5)), partenza: '2026-09-21' },          // 1 notte, scaduta
    { ...r('lunga-attesa', 'in_attesa', '2026-09-20', creata(1)), partenza: '2026-09-27' },                              // 7 notti, in attesa
    { ...r('media-attesa-vecchia', 'in_attesa', '2026-09-20', creata(50)), partenza: '2026-09-23' },                    // 3 notti
    { ...r('media-attesa-nuova', 'in_attesa', '2026-09-20', creata(2)), partenza: '2026-09-23' },                       // 3 notti
    { ...r('media-in-scadenza-vicina', 'proposta_inviata', '2026-09-20', creata(10), inviata(2.5)), partenza: '2026-09-23' },   // scade tra 30 min
    { ...r('media-in-scadenza-lontana', 'proposta_inviata', '2026-09-20', creata(10), inviata(0.5)), partenza: '2026-09-23' },  // scade tra 2 h 30
    { ...r('media-scaduta-recente', 'proposta_inviata', '2026-09-20', creata(10), inviata(4)), partenza: '2026-09-23' },        // scaduta 1 h fa
    { ...r('media-scaduta-vecchia', 'proposta_inviata', '2026-09-20', creata(30), inviata(20)), partenza: '2026-09-23' },       // scaduta 17 h fa
    { ...r('media-arrivo-passato', 'in_attesa', '2026-09-10', creata(200)), partenza: '2026-09-13' },                   // 3 notti, arrivo passato
  ]
  const out = eccezioniRichieste(lista, OGGI, ADESSO)
  assert.deepEqual(out.map(e => e.chiave.replace('richiesta:', '')), [
    'lunga-attesa',
    'media-arrivo-passato', 'media-scaduta-vecchia', 'media-scaduta-recente', 'media-in-scadenza-vicina', 'media-in-scadenza-lontana', 'media-attesa-vecchia', 'media-attesa-nuova',
    'corta-scaduta',
  ])
  assert.deepEqual(out.map(e => e.urgenza), ['normale', 'alta', 'alta', 'alta', 'normale', 'normale', 'normale', 'normale', 'alta'])
})

test('testi: striscia, conteggi per tipo con singolare/plurale, riga «tutto a posto»', () => {
  const lista = [
    ecc('s', 'calendario', 'alta', OGGI), ecc('r1', 'richiesta', 'normale', OGGI), ecc('r2', 'richiesta', 'normale', OGGI), ecc('p', 'pagamento', 'normale', OGGI),
  ]
  assert.equal(titoloStriscia(lista), '4 cose da controllare')
  assert.equal(titoloStriscia(lista.slice(0, 1)), '1 cosa da controllare')
  // Conteggi nello stesso ordine delle sezioni (07/09/2026)
  assert.equal(rigaConteggi(lista), '2 richieste aperte · 1 pagamento · 1 sovrapposizione')
  assert.equal(rigaConteggi([...lista, ecc('a', 'arrivo', 'alta', OGGI), ecc('p2', 'pagamento', 'normale', OGGI)]), '2 richieste aperte · 1 arrivo senza orario · 2 pagamenti · 1 sovrapposizione')
  assert.deepEqual(conteggiPerTipo(lista), [{ tipo: 'richiesta', n: 2 }, { tipo: 'pagamento', n: 1 }, { tipo: 'calendario', n: 1 }])
  assert.equal(rigaAPosto(lista), 'Arrivi di domani e fatture: tutto a posto')
  assert.equal(rigaAPosto([ecc('a', 'arrivo', 'alta', OGGI)]), 'Richieste, pagamenti, fatture e calendario: tutto a posto')
  assert.equal(rigaAPosto([...lista, ecc('a', 'arrivo', 'alta', OGGI), ecc('f', 'fattura', 'normale', OGGI)]), null)
  assert.equal(rigaAPosto([]), 'Richieste, arrivi di domani, pagamenti, fatture e calendario: tutto a posto')
})

test('destinazioni: ogni bottone porta al punto esatto', () => {
  assert.equal(hrefDestinazione({ tipo: 'richiesta', id: 'r' }), '/richieste/r')
  assert.equal(hrefDestinazione({ tipo: 'saldo', prenotazioneId: 'p' }), '/prenotazioni/p?azione=pagato')
  assert.equal(hrefDestinazione({ tipo: 'prenotazione', prenotazioneId: 'p' }), '/prenotazioni/p')
  assert.equal(hrefDestinazione({ tipo: 'calendario', giorno: '2026-09-16' }), '/calendario?giorno=2026-09-16')
  assert.equal(hrefDestinazione({ tipo: 'arrivo', prenotazioneId: 'p' }), '/arrivi?apri=p')
  assert.equal(hrefDestinazione({ tipo: 'fattura', documentoId: 'd' }), '/spese?documento=d')
})

test('insieme: tutte le regole, rinvii applicati, ordine delle sezioni; stato vuoto → nessuna eccezione', () => {
  const stato = {
    oggi: OGGI, adesso: ADESSO,
    richieste: [
      r('ferma', 'in_attesa', '2026-09-20', '2026-09-12T08:00:00+02:00'),
      r('scaduta', 'proposta_inviata', '2026-09-22', '2026-09-10T08:00:00+02:00', '2026-09-14T08:00:00+02:00'),
      r('rimandata', 'in_attesa', '2026-09-21', '2026-09-01T08:00:00+02:00'),
    ],
    prenotazioni: [
      b('a', 'amelia', '2026-09-15', '2026-09-17', 140),
      b('d', 'amelia', '2026-09-16', '2026-09-18', 140, { check_in_time: '16:00' }),   // sovrapposta con a (ha l'orario)
      b('dom', 'lena', '2026-09-16', '2026-09-18', 100),                 // arrivo domani senza orario
      b('vecchio', 'ambra', '2026-09-10', '2026-09-12', 160),            // concluso, non pagato
    ],
    pagamenti: [],
    documenti: [{ id: 'f1', kind: 'fattura', status: 'approvata_da_pagare', due_date: '2026-09-10', doc_total: 95.5, supplier: 'Enel' }],
    rinvii: [{ chiave: 'richiesta:rimandata', fino_a: '2026-09-16' }],
  }
  const out = daControllareHome(stato)
  // Ordine del 07/09/2026: richieste (durata: «ferma» 20–25 = 5 notti, «scaduta» 22–25 = 3), arrivi, pagamenti, fatture, calendario in fondo
  assert.deepEqual(out.map(e => e.chiave), [
    'richiesta:ferma',
    'richiesta:scaduta',
    'arrivo:dom',
    'pagamento:vecchio',
    'fattura:f1',
    'sovrapposizione:a:d',
  ])
  assert.equal(titoloStriscia(out), '6 cose da controllare')
  assert.equal(rigaConteggi(out), '2 richieste aperte · 1 arrivo senza orario · 1 pagamento · 1 fattura scaduta · 1 sovrapposizione')
  assert.equal(rigaAPosto(out), null)
  assert.deepEqual(daControllareHome({ oggi: OGGI, adesso: ADESSO, richieste: [], prenotazioni: [], pagamenti: [], documenti: [] }), [])
})

test('periodo di lettura e tabella dei rinvii assente', async () => {
  const { periodoDaControllare, tabellaRinviiAssente } = await import('./daControllare.ts')
  assert.deepEqual(periodoDaControllare(OGGI), { da: '2026-08-15', a: '2026-11-16' })
  assert.equal(tabellaRinviiAssente({ code: 'PGRST205', message: 'Could not find the table' }), true)
  assert.equal(tabellaRinviiAssente({ code: '42P01' }), true)
  assert.equal(tabellaRinviiAssente({ code: '42501', message: 'permission denied' }), false)
  assert.equal(tabellaRinviiAssente(null), false)
})

test('parametri di arrivo dalla Home: solo valori ben formati', async () => {
  const { giornoDaParametro, idDaParametro } = await import('./daControllare.ts')
  assert.equal(giornoDaParametro('?giorno=2026-09-16'), '2026-09-16')
  assert.equal(giornoDaParametro('?giorno=domani'), null)
  assert.equal(giornoDaParametro(''), null)
  assert.equal(idDaParametro('?apri=aaaaaaaa-0001-4000-8000-000000000001', 'apri'), 'aaaaaaaa-0001-4000-8000-000000000001')
  assert.equal(idDaParametro('?apri=%3Cscript%3E', 'apri'), null)
  assert.equal(idDaParametro('?altro=x', 'apri'), null)
})

test('statistiche: «N pagamenti da controllare» conta solo i pagamenti, null senza incongruenze', async () => {
  const { testoPagamentiDaControllare } = await import('./daControllare.ts')
  assert.equal(testoPagamentiDaControllare([ecc('p1', 'pagamento', 'normale', OGGI), ecc('s', 'calendario', 'alta', OGGI)]), '1 pagamento da controllare')
  assert.equal(testoPagamentiDaControllare([ecc('p1', 'pagamento', 'normale', OGGI), ecc('p2', 'pagamento', 'normale', OGGI)]), '2 pagamenti da controllare')
  assert.equal(testoPagamentiDaControllare([ecc('s', 'calendario', 'alta', OGGI)]), null)
  assert.equal(testoPagamentiDaControllare([]), null)
})

test('posizione (07/09/2026): in Home la sezione «Da controllare» sta SOPRA i numeri del giorno', async () => {
  const { readFileSync } = await import('node:fs')
  const home = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8')
  const sezione = home.indexOf('<DaControllare />')
  assert.ok(sezione > 0, 'la Home monta DaControllare')
  assert.ok(sezione < home.indexOf("renderEventi('oggi'"), 'prima di Oggi/Domani')
  assert.ok(sezione < home.indexOf('Ricavi per soggiorno'), 'prima dei numeri del mese')
  assert.ok(sezione < home.indexOf('{loading ?'), 'fuori dal ramo di caricamento dei numeri')
  const componente = readFileSync(new URL('../components/DaControllare.tsx', import.meta.url), 'utf8')
  assert.ok(componente.includes("if (dc.stato === 'caricamento') return null"), 'durante il controllo nessuno spazio in cima')
})

test('arrivi (07/09/2026): con numero → WhatsApp pieno col testo «Richiesta orario» della scheda; senza numero → niente WhatsApp e motivo esplicito', async () => {
  const { whatsappRichiestaOrario } = await import('./messaggiWhatsApp.ts')
  const conNumero = b('n', 'amelia', '2026-09-16', '2026-09-18', 100, { guests: { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }, guest_name: null })
  const senzaNumero = b('s', 'ambra', '2026-09-16', '2026-09-18', 100, { guests: { full_name: 'Bruno Bianchi', phone: '' }, guest_name: null })
  const out = eccezioniArrivi([conNumero, senzaNumero], OGGI)
  assert.equal(out.length, 2)
  const n = out.find(e => e.chiave === 'arrivo:n')!, s = out.find(e => e.chiave === 'arrivo:s')!
  assert.equal(n.motivo, 'Arrivo di domani senza orario')
  assert.equal(n.bottone, 'Apri arrivo')
  assert.deepEqual(n.whatsapp, { ...whatsappRichiestaOrario(conNumero)!, principale: true })
  assert.ok(n.whatsapp!.testo.startsWith('Gentile Anna Rossi,'))
  assert.equal(n.whatsapp!.href, `https://wa.me/393331234567?text=${encodeURIComponent(n.whatsapp!.testo)}`)
  assert.equal(s.whatsapp, undefined)
  assert.equal(s.motivo, 'Arrivo di domani senza orario e senza numero di telefono')
})

test('richieste (07/09/2026): proposta scaduta con telefono → WhatsApp ghost senza testo; senza telefono niente; le altre richieste mai', () => {
  const ore4 = new Date(ADESSO.getTime() - 4 * 3600000).toISOString()
  const vecchia = '2026-09-10T08:00:00+02:00'
  const out = eccezioniRichieste([
    { ...r('con', 'proposta_inviata', '2026-09-20', vecchia, ore4), telefono: '+39 333 123 4567' },
    { ...r('senza', 'proposta_inviata', '2026-09-21', vecchia, ore4), telefono: null },
    { ...r('ferma', 'in_attesa', '2026-09-22', '2026-09-10T08:00:00+02:00'), telefono: '+39 333 123 4567' },
  ], OGGI, ADESSO)
  assert.deepEqual(out.map(e => e.chiave), ['richiesta:con', 'richiesta:senza', 'richiesta:ferma'])
  assert.deepEqual(out[0].whatsapp, { href: 'https://wa.me/393331234567', numero: '393331234567', testo: '', principale: false })
  assert.equal(out[0].rimandabile, true)
  assert.equal(out[1].whatsapp, undefined)
  assert.equal(out[2].whatsapp, undefined)
})

// Falso positivo trovato in produzione il 07/09/2026: Anna (3 segmenti, 90 +
// 170 + 1120 = 1380 €, movimenti 500 + 500 + 380 = 1380 €) e Rosa (1700 €,
// movimenti 500 + 600 + 600) hanno i movimenti che coprono il totale ma la
// colonna `pagato` è false: comparivano come «non segnato pagato» e «Registra
// saldo» non aveva nulla da registrare. Un soggiorno saldato dai movimenti è
// pagato, qualunque sia il flag.
test('pagamenti (07/09/2026): soggiorno concluso con movimenti che coprono il totale NON compare anche se pagato=false; parziale sì, con gli importi', () => {
  const OGGI_PROD = '2026-09-05'
  const anna = [
    b('6b01e39d', 'allegra', '2026-07-27', '2026-07-28', 90, { group_id: '53f4cc1d', pagato: false }),
    b('d946cd26', 'lena', '2026-07-28', '2026-07-30', 170, { group_id: '53f4cc1d', pagato: false }),
    b('6f030c8c', 'allegra', '2026-07-30', '2026-08-13', 1120, { group_id: '53f4cc1d', pagato: false }),
  ]
  const rosa = [b('4804b0d6', 'ambra', '2026-08-06', '2026-09-01', 1700, { pagato: false })]
  const movimenti = [
    { booking_id: '6f030c8c', amount: 500, paid_on: '2026-07-30' }, { booking_id: '6f030c8c', amount: 500, paid_on: '2026-08-05' }, { booking_id: '6f030c8c', amount: 380, paid_on: '2026-08-12' },
    { booking_id: '4804b0d6', amount: 500, paid_on: '2026-08-16' }, { booking_id: '4804b0d6', amount: 600, paid_on: '2026-08-23' }, { booking_id: '4804b0d6', amount: 600, paid_on: '2026-09-01' },
  ]
  assert.deepEqual(eccezioniPagamenti([...anna, ...rosa], movimenti, OGGI_PROD), [])
  // Con un movimento in meno Rosa compare, e il motivo dice quanto manca
  const parziale = eccezioniPagamenti([...anna, ...rosa], movimenti.slice(0, 5), OGGI_PROD)
  // (importi con euroTesto: il separatore delle migliaia dipende dall'ICU di Node)
  assert.deepEqual(parziale.map(e => [e.chiave, e.motivo, e.bottone]), [['pagamento:4804b0d6', `Soggiorno concluso il 1 set: registrati ${euroTesto(110000)} su ${euroTesto(170000)}`, 'Registra saldo']])
  // Movimenti «ricostruiti» (origine della 0033) contano come gli altri
  const ricostruito = [{ booking_id: '4804b0d6', amount: 1700, paid_on: '2026-08-06', origine: 'ricostruito' } as { booking_id: string; amount: number; paid_on: string }]
  assert.deepEqual(eccezioniPagamenti(rosa, ricostruito, OGGI_PROD), [])
})

test('arrivo senza orario (08/09/2026): tre link — «Chiedi orario» col testo della scheda, «Apri chat» senza testo, «Apri arrivo»; senza numero solo il terzo', async () => {
  const { whatsappRichiestaOrario } = await import('./messaggiWhatsApp.ts')
  const conNumero = b('n', 'amelia', '2026-09-16', '2026-09-18', 100, { guests: { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }, guest_name: null })
  const senzaNumero = b('s', 'ambra', '2026-09-16', '2026-09-18', 100, { guests: { full_name: 'Bruno Bianchi', phone: '' }, guest_name: null })
  const [n, s] = [eccezioniArrivi([conNumero], OGGI)[0], eccezioniArrivi([senzaNumero], OGGI)[0]]
  const wa = whatsappRichiestaOrario(conNumero)!
  assert.equal(n.whatsapp!.href, wa.href)                                   // Chiedi orario: testo «Richiesta orario» già scritto
  assert.equal(n.whatsapp!.principale, true)
  assert.equal(n.whatsappChat!.href, 'https://wa.me/393331234567')          // Apri chat: senza testo
  assert.equal(n.whatsappChat!.testo, '')
  assert.equal(hrefDestinazione(n.destinazione), '/arrivi?apri=n')          // Apri arrivo
  assert.equal(s.whatsapp, undefined); assert.equal(s.whatsappChat, undefined)
  assert.equal(hrefDestinazione(s.destinazione), '/arrivi?apri=s')
})
