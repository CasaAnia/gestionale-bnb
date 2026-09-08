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
// Telefono diverso per ogni prenotazione (dal 06/09/2026 la regola del cambio camera
// riconosce la stessa persona anche dal telefono: un numero unico li farebbe tutti «cambi»)
const telefonoDi = (id: string) => `+39 3${String(Math.abs([...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)) % 1e8).padStart(8, '0')}`
const b = (id: string, camera: string, check_in: string, check_out: string, total: number, extra: Partial<PrenotazioneDC> = {}): PrenotazioneDC =>
  ({ id, room_id: camera, rooms: { name: `Camera ${camera}` }, guest_name: `Ospite ${id}`, guests: { full_name: null, phone: telefonoDi(id) }, check_in, check_out, total_amount: total, status: 'confermata', ...extra })
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

// Nota del cliente in Home (Ania, 07/09/2026): la nota della richiesta va sotto il motivo,
// in tutti i casi (in attesa, proposta inviata, scaduta); senza nota (o solo spazi) niente
test('richieste: la nota del cliente arriva nella voce di Home, senza nota il campo manca', () => {
  const ore1 = new Date(ADESSO.getTime() - 3600000).toISOString()
  const conNota = { ...r('n1', 'in_attesa', '2026-09-20', ore1), note: '  Arriviamo dopo le 21, partenza il 14 mattina ' }
  const inviata = { ...r('n2', 'proposta_inviata', '2026-09-21', ore1), proposta_inviata_at: ore1, note: 'Chiede il letto aggiuntivo' }
  const vuota = { ...r('n3', 'in_attesa', '2026-09-22', ore1), note: '   ' }
  const senza = r('n4', 'in_attesa', '2026-09-23', ore1)
  const out = eccezioniRichieste([conNota, inviata, vuota, senza], OGGI, ADESSO)
  const per = Object.fromEntries(out.map(e => [e.chiave, e.nota]))
  assert.equal(per['richiesta:n1'], 'Arriviamo dopo le 21, partenza il 14 mattina')
  assert.equal(per['richiesta:n2'], 'Chiede il letto aggiuntivo')
  assert.equal(per['richiesta:n3'], undefined)
  assert.equal(per['richiesta:n4'], undefined)
  assert.ok(!('nota' in out.find(e => e.chiave === 'richiesta:n4')!), 'senza nota il campo non c\'è')
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
// Dal 06/09/2026 anche l'arrivo di OGGI senza orario compare (prima solo domani)
test('arrivi: arrivo di oggi o domani senza orario → alta; con orario o cambio camera no', () => {
  const out = eccezioniArrivi([
    b('senza', 'amelia', '2026-09-16', '2026-09-18', 100),
    b('con', 'ambra', '2026-09-16', '2026-09-18', 100, { check_in_time: '15:00' }),
    b('vuoto', 'lena', '2026-09-16', '2026-09-18', 100, { check_in_time: '  ' }),
    b('oggi', 'allegra', '2026-09-15', '2026-09-18', 100),
    b('c1', 'allegra', '2026-09-14', '2026-09-16', 100, { group_id: 'g', check_in_time: '14:00' }),
    b('c2', 'amelia', '2026-09-16', '2026-09-18', 100, { group_id: 'g' }),   // cambio camera: già in casa
    b('att', 'ambra', '2026-09-16', '2026-09-18', 100, { status: 'in_attesa' }),
  ], OGGI)
  assert.deepEqual(out.map(e => e.chiave), ['arrivo:oggi', 'arrivo:senza', 'arrivo:vuoto'])   // oggi prima di domani
  assert.equal(out[0].titolo, 'Ospite oggi · allegra · oggi'); assert.equal(out[0].motivo, 'Arrivo di oggi senza orario')
  assert.equal(out[1].urgenza, 'alta')
  assert.equal(out[1].titolo, 'Ospite senza · amelia · domani')
  assert.equal(out[1].motivo, 'Arrivo di domani senza orario')
  assert.deepEqual(out[1].destinazione, { tipo: 'arrivo', prenotazioneId: 'senza' })
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
  // Dal 08/09/2026 (sera) c'è anche il tipo «pulizia»
  assert.equal(rigaAPosto(lista), 'Arrivi di oggi e domani, pulizie e fatture: tutto a posto')
  assert.equal(rigaAPosto([ecc('a', 'arrivo', 'alta', OGGI)]), 'Richieste, pulizie, pagamenti, fatture e calendario: tutto a posto')
  assert.equal(rigaAPosto([...lista, ecc('a', 'arrivo', 'alta', OGGI), ecc('f', 'fattura', 'normale', OGGI)]), 'Pulizie: tutto a posto')
  assert.equal(rigaAPosto([...lista, ecc('a', 'arrivo', 'alta', OGGI), ecc('f', 'fattura', 'normale', OGGI), ecc('pu', 'pulizia', 'alta', OGGI)]), null)
  assert.equal(rigaAPosto([]), 'Richieste, arrivi di oggi e domani, pulizie, pagamenti, fatture e calendario: tutto a posto')
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
    'arrivo:a',                   // alta, arriva OGGI senza orario (dal 06/09/2026)
    'arrivo:dom',
    'pagamento:vecchio',
    'fattura:f1',
    'sovrapposizione:a:d',
  ])
  assert.equal(titoloStriscia(out), '7 cose da controllare')
  assert.equal(rigaConteggi(out), '2 richieste aperte · 2 arrivi senza orario · 1 pagamento · 1 fattura scaduta · 1 sovrapposizione')
  assert.equal(rigaAPosto(out), 'Pulizie: tutto a posto')   // nessuna pulizia non registrata nello scenario
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

// ── Pulizia non registrata prima di un arrivo (08/09/2026, sera) ───────────
test('pulizia prima di un arrivo: compare solo se la camera ha una pulizia prevista non segnata; oggi alta, domani normale; bottone «Apri pulizie» sul giorno', async () => {
  const { eccezioniPulizie, MOTIVO_PULIZIA_NON_REGISTRATA } = await import('./daControllare.ts')
  type Dec = import('./pulizie.ts').Decisione
  const fatta = (id: string, room_id: string, booking_id: string, giorno: string): Dec => ({ id, room_id, booking_id, tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: giorno, data_effettiva: giorno, created_at: `${giorno}T12:00:00Z` })
  const pren = [
    // Amelia: partenza il 12 (tre giorni fa, quindi NON automatica) mai segnata, arrivo OGGI → alta
    b('am-out', 'amelia', '2026-09-10', '2026-09-12', 100, { guest_id: 'g1' }),
    b('am-in', 'amelia', '2026-09-15', '2026-09-18', 100, { guest_id: 'g2', check_in_time: '15:30' }),
    // Ambra: partenza il 14 SEGNATA fatta, arrivo oggi → non compare
    b('ab-out', 'ambra', '2026-09-10', '2026-09-14', 100, { guest_id: 'g3' }),
    b('ab-in', 'ambra', '2026-09-15', '2026-09-17', 100, { guest_id: 'g4' }),
    // Allegra: partenza DOMANI non segnata e arrivo domani → dal 06/09/2026 (regola di Ania:
    // «non con un giorno di anticipo») NON compare più; prima era «normale»
    b('al-out', 'allegra', '2026-09-12', '2026-09-16', 100, { guest_id: 'g5' }),
    b('al-in', 'allegra', '2026-09-16', '2026-09-19', 100, { guest_id: 'g6' }),
    // Lena: partenza oggi con arrivo oggi = pulizia AUTOMATICA alla partenza → non compare
    b('le-out', 'lena', '2026-09-12', '2026-09-15', 100, { guest_id: 'g7' }),
    b('le-in', 'lena', '2026-09-15', '2026-09-17', 100, { guest_id: 'g8' }),
    // Ambra bis: partenza IERI con arrivo oggi = automatica anche questa (entro il giorno dopo) → non compare
    b('ab2-out', 'ambra2', '2026-09-10', '2026-09-14', 100, { guest_id: 'g10' }),
    b('ab2-in', 'ambra2', '2026-09-15', '2026-09-17', 100, { guest_id: 'g11' }),
    // Prolungamento (stesso ospite, stessa camera, date contigue): non è un arrivo
    b('pro-1', 'ambra', '2026-09-17', '2026-09-19', 100, { guest_id: 'g4' }),
    // Arrivo in attesa: mai
    b('att', 'allegra', '2026-09-15', '2026-09-16', 100, { guest_id: 'g9', status: 'in_attesa' }),
  ]
  const out = eccezioniPulizie(pren, [fatta('f1', 'ambra', 'ab-out', '2026-09-14')], OGGI)
  assert.deepEqual(out.map(e => [e.chiave, e.urgenza, e.titolo, e.motivo, e.bottone, hrefDestinazione(e.destinazione)]), [
    // 08/09: anche arrivo oggi/domani richiede conferma manuale.
    ['pulizia:ab2-in', 'alta', 'ambra2 · arrivo oggi di Ospite ab2-in', MOTIVO_PULIZIA_NON_REGISTRATA, 'Apri pulizie', '/pulizie?giorno=2026-09-15'],
    ['pulizia:am-in', 'alta', 'amelia · arrivo oggi di Ospite am-in, ore 15:30', MOTIVO_PULIZIA_NON_REGISTRATA, 'Apri pulizie', '/pulizie?giorno=2026-09-15'],
    ['pulizia:le-in', 'alta', 'lena · arrivo oggi di Ospite le-in', MOTIVO_PULIZIA_NON_REGISTRATA, 'Apri pulizie', '/pulizie?giorno=2026-09-15'],
  ])   // attesa aggiornata il 06/09/2026: la voce di Allegra (arrivo DOMANI) non c'è più
  // Segnata fatta anche quella di Amelia → sparisce da sola
  const dopo = eccezioniPulizie(pren, [fatta('f1', 'ambra', 'ab-out', '2026-09-14'), fatta('f2', 'amelia', 'am-out', '2026-09-14')], OGGI)
  assert.deepEqual(dopo.map(e => e.chiave), ['pulizia:ab2-in', 'pulizia:le-in'])
  // Senza decisioni: Ambra (partenza del 14 mai segnata, ma arrivo il 15 = automatica) resta fuori, Amelia dentro; Allegra (domani) mai
  assert.deepEqual(eccezioniPulizie(pren, [], OGGI).map(e => e.chiave), ['pulizia:ab-in', 'pulizia:ab2-in', 'pulizia:am-in', 'pulizia:le-in'])
})

test('pulizia prima di un arrivo: cambio biancheria saltato non conta; cambio biancheria della partenza non fatto e partenza non segnata → compare; ordine e conteggi', async () => {
  const { eccezioniPulizie } = await import('./daControllare.ts')
  type Dec = import('./pulizie.ts').Decisione
  // Lena: soggiorno lungo 3 → 15 (oggi) con cambio biancheria del 7 SALTATO (proposta 11) e partenza oggi
  // segnata fatta; arrivo oggi → non compare
  const lungo = [
    b('l-out', 'lena', '2026-09-03', '2026-09-15', 100, { guest_id: 'h1' }),
    b('l-in', 'lena', '2026-09-15', '2026-09-18', 100, { guest_id: 'h2' }),
  ]
  const saltata: Dec = { id: 's1', room_id: 'lena', booking_id: 'l-out', tipo: 'soggiorno', stato: 'saltata', data_prevista: '2026-09-07', prossima_data: '2026-09-11', created_at: '2026-09-07T08:00:00Z' }
  const partenzaFatta: Dec = { id: 'p1', room_id: 'lena', booking_id: 'l-out', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-09-15', data_effettiva: '2026-09-15', created_at: '2026-09-15T09:00:00Z' }
  assert.deepEqual(eccezioniPulizie(lungo, [saltata, partenzaFatta], OGGI), [])
  // Stessa camera, partenza del 14 (ieri) mai segnata, arrivo domani: dal 06/09/2026 compare come
  // «partenza di ieri» (regola di Ania: «la giornata dopo, se non è stata registrata»), non più per l'arrivo di domani
  const ieri = [
    b('i-out', 'lena', '2026-09-03', '2026-09-14', 100, { guest_id: 'h3' }),
    b('i-in', 'lena', '2026-09-16', '2026-09-18', 100, { guest_id: 'h4' }),
  ]
  const conBiancheria = eccezioniPulizie(ieri, [], OGGI)
  assert.deepEqual(conBiancheria.map(e => [e.chiave, e.urgenza]), [['pulizia:partenza:i-out', 'alta']])   // attesa aggiornata il 06/09/2026
  // Ordine delle sezioni e conteggi: dopo gli arrivi senza orario, prima dei pagamenti
  const ordinate = ordinaEccezioni([ecc('p', 'pagamento', 'normale', OGGI), ecc('pu', 'pulizia', 'alta', OGGI), ecc('a', 'arrivo', 'alta', OGGI)])
  assert.deepEqual(ordinate.map(e => e.chiave), ['a', 'pu', 'p'])
  assert.equal(rigaConteggi([ecc('pu', 'pulizia', 'alta', OGGI), ecc('pu2', 'pulizia', 'normale', OGGI)]), '2 pulizie non registrate')
  assert.equal(rigaAPosto([ecc('pu', 'pulizia', 'alta', OGGI)]), 'Richieste, arrivi di oggi e domani, pagamenti, fatture e calendario: tutto a posto')
})

// Ania, 06/09/2026: Arturo arrivava «domani» e la voce c'era; il giorno dopo arrivava «oggi» ed era sparita
test('arrivi senza orario: anche quelli di OGGI, prima di quelli di domani (caso Arturo)', () => {
  const out = eccezioniArrivi([
    b('domani', 'ambra', '2026-09-16', '2026-09-18', 100),
    b('arturo', 'allegra', '2026-09-15', '2026-09-18', 100),     // arriva oggi, senza orario
    b('conOra', 'lena', '2026-09-15', '2026-09-17', 100, { check_in_time: '10:45' }),
    b('dopodomani', 'amelia', '2026-09-17', '2026-09-19', 100),
  ], OGGI)
  assert.deepEqual(out.map(e => [e.chiave, e.titolo, e.motivo, e.urgenza]), [
    ['arrivo:arturo', 'Ospite arturo · allegra · oggi', 'Arrivo di oggi senza orario', 'alta'],
    ['arrivo:domani', 'Ospite domani · ambra · domani', 'Arrivo di domani senza orario', 'alta'],
  ])
})

// Ania, 06/09/2026: «vuole la navetta ma non ho ancora il suo orario» → la voce lo dice col colore
test('arrivi senza orario: navetta confermata segnalata, «no» e «da definire» no', () => {
  const out = eccezioniArrivi([
    b('conNavetta', 'allegra', '2026-09-15', '2026-09-16', 80, { shuttle: 'si' }),
    b('senzaNavetta', 'ambra', '2026-09-15', '2026-09-17', 100, { shuttle: 'no' }),
    b('daDefinire', 'lena', '2026-09-16', '2026-09-18', 100, { shuttle: null }),
    b('conOraENavetta', 'amelia', '2026-09-15', '2026-09-17', 100, { shuttle: 'si', check_in_time: '15:00' }),
  ], OGGI)
  assert.deepEqual(out.map(e => [e.chiave, e.navetta, e.motivo]), [
    ['arrivo:conNavetta', true, 'Arrivo di oggi senza orario'],
    ['arrivo:senzaNavetta', undefined, 'Arrivo di oggi senza orario'],
    ['arrivo:daDefinire', undefined, 'Arrivo di domani senza orario'],
  ])
})

// Ania, 06/09/2026: «i cambi stanza non sono urgenti» — anche con due prenotazioni
// NON collegate (caso Rosa: Ambra 1–7, poi Amelia 7–11, stesso cliente)
test('arrivi senza orario: il cambio camera della stessa persona non compare, anche senza group_id', () => {
  const out = eccezioniArrivi([
    b('rosaPrima', 'ambra', '2026-09-10', '2026-09-16', 300, { guest_id: 'g-rosa', guest_name: 'Rosa Macauda' }),
    b('rosaDopo', 'amelia', '2026-09-16', '2026-09-20', 200, { guest_id: 'g-rosa', guest_name: 'Rosa Macauda' }),     // domani, stesso cliente → cambio
    b('nidaPrima', 'amelia', '2026-09-14', '2026-09-15', 100, { guest_name: 'Nida', guests: { full_name: null, phone: '+39 333 111 2222' } }),
    b('nidaDopo', 'allegra', '2026-09-15', '2026-09-16', 100, { guest_name: 'Nida', guests: { full_name: null, phone: '+39 333 111 2222' } }),  // oggi, stesso telefono → cambio
    b('omonimo', 'lena', '2026-09-16', '2026-09-18', 100, { guest_name: 'Rosa Macauda', guests: { full_name: null, phone: '+39 333 999 0000' } }),   // stesso nome di chi parte il 16 → cambio (anche senza cliente né telefono)
    b('vero', 'ambra', '2026-09-16', '2026-09-18', 100, { guest_name: 'Marco Bianchi', guests: { full_name: null, phone: '+39 333 000 1111' } }),   // arrivo vero: nessuna sua prenotazione finisce il 16
    b('ieriParte', 'ambra', '2026-09-13', '2026-09-15', 100, { guest_name: 'Luca Neri', guests: { full_name: null, phone: '+39 333 000 2222' } }),
    b('lucaDomani', 'lena', '2026-09-16', '2026-09-17', 100, { guest_name: 'Luca Neri', guests: { full_name: null, phone: '+39 333 000 2222' } }),  // Luca è partito ieri, torna domani: arrivo vero
  ], OGGI)
  assert.deepEqual(out.map(e => e.chiave), ['arrivo:vero', 'arrivo:lucaDomani'])
})

// Ania, 06/09/2026: «non con un giorno di anticipo: nella stessa giornata, oppure la giornata
// dopo se non è stata registrata» → partenza di IERI non segnata, senza arrivo oggi
test('pulizie: partenza di ieri non registrata compare oggi; segnata o rimandata no; anche arrivo oggi richiede conferma; domani mai', async () => {
  const { eccezioniPulizie, MOTIVO_PULIZIA_PARTENZA_IERI } = await import('./daControllare.ts')
  type Dec = import('./pulizie.ts').Decisione
  const pren = [
    b('a-out', 'amelia', '2026-09-11', '2026-09-14', 100, { guest_id: 'k1' }),                       // ieri, mai segnata, camera vuota oggi → compare
    b('b-out', 'ambra', '2026-09-11', '2026-09-14', 100, { guest_id: 'k2' }),                        // ieri, segnata fatta → no
    b('c-out', 'allegra', '2026-09-11', '2026-09-14', 100, { guest_id: 'k3' }),                      // ieri, rimandata a dopodomani → no (scelta di Ania)
    b('d-out', 'lena', '2026-09-11', '2026-09-14', 100, { guest_id: 'k4' }),                         // ieri, arrivo oggi → automatica → no
    b('d-in', 'lena', '2026-09-15', '2026-09-17', 100, { guest_id: 'k5' }),
    b('e-out', 'ambra2', '2026-09-11', '2026-09-13', 100, { guest_id: 'k6' }),                       // l'altro ieri: fuori dalla regola
    b('f-out', 'lena2', '2026-09-11', '2026-09-15', 100, { guest_id: 'k7' }),                        // parte OGGI senza arrivo: non ancora
    b('g-out', 'lena3', '2026-09-11', '2026-09-14', 100, { guest_id: 'k8', group_id: 'gg' }),        // cambio camera ieri verso lena4: la camera lasciata va pulita → compare come «cambio camera»
    b('g-in', 'lena4', '2026-09-14', '2026-09-18', 100, { guest_id: 'k8', group_id: 'gg' }),
  ]
  const dec = (id: string, room_id: string, booking_id: string, stato: 'fatta' | 'rimandata', prossima_data: string | null = null): Dec =>
    ({ id, room_id, booking_id, tipo: 'fine_soggiorno', stato, data_prevista: '2026-09-14', data_effettiva: stato === 'fatta' ? '2026-09-14' : null, prossima_data, created_at: '2026-09-14T12:00:00Z' })
  const out = eccezioniPulizie(pren, [dec('x1', 'ambra', 'b-out', 'fatta'), dec('x2', 'allegra', 'c-out', 'rimandata', '2026-09-17')], OGGI)
  assert.deepEqual(out.map(e => [e.chiave, e.urgenza, e.titolo, e.motivo, hrefDestinazione(e.destinazione)]), [
    // 08/09: la vecchia automatica richiede ora conferma.
    ['pulizia:d-in', 'alta', 'lena · arrivo oggi di Ospite d-in', 'La pulizia dopo la partenza precedente non risulta registrata', '/pulizie?giorno=2026-09-15'],
    ['pulizia:partenza:a-out', 'alta', 'amelia · partenza di ieri di Ospite a-out', MOTIVO_PULIZIA_PARTENZA_IERI, '/pulizie?giorno=2026-09-15'],
    ['pulizia:partenza:g-out', 'alta', 'lena3 · cambio camera di ieri di Ospite g-out', MOTIVO_PULIZIA_PARTENZA_IERI, '/pulizie?giorno=2026-09-15'],
  ])
  // Segnata fatta → sparisce da sola
  assert.deepEqual(eccezioniPulizie(pren, [dec('x1', 'ambra', 'b-out', 'fatta'), dec('x2', 'allegra', 'c-out', 'rimandata', '2026-09-17'), dec('x3', 'amelia', 'a-out', 'fatta'), { ...dec('x4', 'lena3', 'g-out', 'fatta'), tipo: 'cambio_camera' }], OGGI).map(e => e.chiave), ['pulizia:d-in'])
})

// Recupero biancheria (06/09/2026): la voce porta con sé la pulizia da segnare con «Pulita»
test('pulizie: la voce indica la pulizia da segnare (partenza aperta o di ieri); solo cambio biancheria → nessuna', async () => {
  const { eccezioniPulizie } = await import('./daControllare.ts')
  const pren = [
    b('am-out', 'amelia', '2026-09-10', '2026-09-12', 100, { guest_id: 'g1' }),                      // partenza del 12 mai segnata
    b('am-in', 'amelia', '2026-09-15', '2026-09-18', 100, { guest_id: 'g2' }),                       // arrivo oggi → pulizia = quella partenza
    b('ie-out', 'ambra', '2026-09-11', '2026-09-14', 100, { guest_id: 'g3' }),                       // partenza di ieri, camera vuota
    b('cb', 'lena', '2026-09-03', '2026-09-20', 100, { guest_id: 'g4' }),                            // soggiorno lungo: cambio biancheria scaduto
    b('cb-in', 'lena2', '2026-09-15', '2026-09-17', 100, { guest_id: 'g5' }),
  ]
  const out = eccezioniPulizie(pren, [], OGGI)
  const perChiave = Object.fromEntries(out.map(e => [e.chiave, e.pulizia]))
  assert.deepEqual(perChiave['pulizia:am-in'], { room_id: 'amelia', booking_id: 'am-out', tipo: 'fine_soggiorno', data_prevista: '2026-09-12', camera: 'amelia' })
  assert.deepEqual(perChiave['pulizia:partenza:ie-out'], { room_id: 'ambra', booking_id: 'ie-out', tipo: 'fine_soggiorno', data_prevista: '2026-09-14', camera: 'ambra' })
  assert.equal(out.some(e => e.chiave === 'pulizia:cb-in'), false)   // lena2 non ha partenze: niente voce
})
