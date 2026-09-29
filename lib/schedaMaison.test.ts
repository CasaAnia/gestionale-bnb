// La scheda «Maison» (riferimento del 28/09/2026): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  linguettaDaHash, linguettaDellaVoce, puntiniLinguette, periodoLinguetta, contoLinguetta, statoBarra,
  chiDormeAlPosto, testoDorme, etichettaDormeLei,
  arrivoInBreve, camereInBreve, ospitiInBreve, nottiConLetto, contoInBreve, caparraDaRicevere, documentoInBreve, noteInBreve,
  azioneDaFare, prossimiGiorni, arrivoGrande, luogoInSoggiorno, navettaInSoggiorno, camereSoggiorno, cambiCamere,
  fraseComePagaEstesa, nessunPagamento, tipoPagamenti, destinatariMessaggi, GRIGLIA_MESSAGGI, utiliScheda,
  giaOspite, documentiCliente, LINGUETTE,
} from './schedaMaison.ts'
import { caselleSoggiorno, type SegmentoScheda } from './schedaPrenotazione.ts'
import { ARRIVO_VUOTO, type Arrivo } from './arrivo.ts'

type Camera = NonNullable<SegmentoScheda['rooms']>
const AMBRA: Camera = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const LENA: Camera = { id: 'lena', name: 'Lena', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const ALLEGRA: Camera = { id: 'allegra', name: 'Allegra', base_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const seg = (id: string, camera: Camera, check_in: string, check_out: string, extra: Partial<SegmentoScheda> = {}): SegmentoScheda => ({
  id, room_id: camera.id, check_in, check_out, status: 'confermata', num_guests: 2, price_per_night: 80,
  extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 240, rooms: camera, group_id: 'g', ...extra,
})
const OGGI = '2026-09-28'
// Il riferimento: Maria Rossi, Ambra 28 set → 1 ott (letto il 30), poi Lena 1 → 4 ott
const MARIA = [
  seg('a', AMBRA, '2026-09-28', '2026-10-01', { extra_bed: true, extra_bed_dates: ['2026-09-30'], extra_bed_total: 10, total_amount: 250 }),
  seg('b', LENA, '2026-10-01', '2026-10-04'),
]
// Il telefono 2b: Ambra 2, Lena 2, Allegra 2, in tre dal 30 col letto
const DUE_CAMBI = [
  seg('a', AMBRA, '2026-09-28', '2026-09-30', { total_amount: 160 }),
  seg('b', LENA, '2026-09-30', '2026-10-02', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-09-30', '2026-10-01'], total_amount: 200 }),
  seg('c', ALLEGRA, '2026-10-02', '2026-10-04', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-10-02', '2026-10-03'], total_amount: 180 }),
]
const arr = (a: Partial<Arrivo>): Arrivo => ({ ...ARRIVO_VUOTO, ...a })

test('linguetta dall\'indirizzo: le cinque, i link di prima, e Oggi all\'apertura', () => {
  assert.deepEqual(LINGUETTE.map(l => l.label), ['Oggi', 'Soggiorno', 'Conto', 'Messaggi', 'Cliente'])
  assert.equal(linguettaDaHash(''), 'oggi')
  assert.equal(linguettaDaHash(null), 'oggi')
  assert.equal(linguettaDaHash('#oggi'), 'oggi')
  assert.equal(linguettaDaHash('#soggiorno'), 'soggiorno')
  assert.equal(linguettaDaHash('#conto'), 'conto')
  assert.equal(linguettaDaHash('#messaggi'), 'messaggi')
  assert.equal(linguettaDaHash('#cliente'), 'cliente')
  assert.equal(linguettaDaHash('#arrivo'), 'soggiorno')
  assert.equal(linguettaDaHash('#documenti'), 'cliente')
  assert.equal(linguettaDaHash('#qualcosa'), 'oggi')
})

test('puntini per tipo di eccezione: pagamento → Conto, documento → Cliente, arrivo e cambio → Soggiorno, il resto → Oggi', () => {
  assert.equal(linguettaDellaVoce('pagamento'), 'conto')
  assert.equal(linguettaDellaVoce('documento'), 'cliente')
  assert.equal(linguettaDellaVoce('arrivo:x'), 'soggiorno')
  assert.equal(linguettaDellaVoce('cambio:2026-09-30'), 'soggiorno')
  assert.equal(linguettaDellaVoce('richiesta:x'), 'oggi')
  assert.equal(linguettaDellaVoce('sovrapposizione:a:b'), 'oggi')
  assert.deepEqual(puntiniLinguette([{ chiave: 'documento' }, { chiave: 'pagamento' }]), ['conto', 'cliente'])
  assert.deepEqual(puntiniLinguette([{ chiave: 'arrivo:x' }, { chiave: 'cambio:y' }]), ['soggiorno'])
  assert.deepEqual(puntiniLinguette([]), [])
})

test('sotto le linguette: le date del soggiorno e quanto resta', () => {
  assert.equal(periodoLinguetta('2026-09-28', '2026-10-04'), '28 set → 4 ott')
  assert.equal(periodoLinguetta('2026-09-10', '2026-09-14'), '10 → 14 set')
  assert.deepEqual(contoLinguetta(47000, false), { testo: 'resta 470 €', resta: true })
  assert.deepEqual(contoLinguetta(0, true), { testo: 'saldato', resta: false })
  assert.equal(contoLinguetta(null, false), null)
  assert.equal(statoBarra(''), 'Confermata')
  assert.equal(statoBarra('Mancato arrivo'), 'Mancato arrivo')
})

test('riga «dorme …» presente SOLO con la spunta «Non è lei a dormire qui»', () => {
  const riga = { extra_phone_1_name: 'Teresa Bianchi', extra_phone_1: '3405551122', chi_e: 'Mamma' }
  // senza la colonna (0061 non applicata) o con la spunta spenta: niente
  assert.equal(chiDormeAlPosto(riga), null)
  assert.equal(chiDormeAlPosto({ ...riga, intestataria_non_dorme: false }), null)
  const p = chiDormeAlPosto({ ...riga, intestataria_non_dorme: true })
  assert.deepEqual(p, { nome: 'Teresa Bianchi', chiE: 'Mamma', telefono: '3405551122' })
  assert.equal(testoDorme(p!), 'dorme Teresa Bianchi · mamma')
  assert.equal(etichettaDormeLei('Mamma'), 'Mamma · dorme lei, non chi ha prenotato')
  // spunta accesa ma nessun nome salvato: la riga non compare
  assert.equal(chiDormeAlPosto({ intestataria_non_dorme: true }), null)
})

test('destinatario dei messaggi: chi ha prenotato sempre, chi dorme solo quando è un\'altra persona', () => {
  const maria = { nome: 'Maria Rossi', telefono: '393331234567' }
  assert.deepEqual(destinatariMessaggi(maria, null).map(d => d.etichetta), ['Maria · ha prenotato'])
  const due = destinatariMessaggi(maria, { nome: 'Teresa Bianchi', chiE: 'Mamma', telefono: '3405551122' })
  assert.deepEqual(due.map(d => [d.chiave, d.etichetta, d.telefono]), [
    ['intestataria', 'Maria · ha prenotato', '393331234567'],
    ['dorme', 'Teresa · dorme', '3405551122'],
  ])
})

test('griglia dei messaggi nell\'ordine dato, senza «Messaggio libero»', () => {
  assert.deepEqual(GRIGLIA_MESSAGGI.map(m => m.label), [
    'Conferma · solo testo', 'Dati bonifico',
    'Modifica soggiorno', 'Promemoria bonifico',
    'Richiesta orario', 'Pagamento ricevuto',
    'Ringraziamento', 'Messaggio di annullamento',
  ])
  for (const fase of ['prima', 'durante', 'dopo', 'annullata', 'incerta'] as const) {
    assert.ok(!utiliScheda(fase).some(m => m.tipo === 'libero'), fase)
  }
})

test('In breve · arrivo: una riga in struttura, tre righe con un luogo esterno', () => {
  const massimo = arr({ tipo: 'struttura', strutturaDa: '15:10', navetta: 'massimo' })
  assert.deepEqual(arrivoInBreve(massimo, OGGI, OGGI), ['oggi alle 15:10 · navetta Massimo'])
  assert.deepEqual(arrivoInBreve(arr({ tipo: 'da_definire', navetta: 'non_richiesta' }), '2026-10-01', OGGI), ['gio 1 ott, orario da definire · arrivo autonomo'])
  const malpensa = arr({ tipo: 'luogo', luogo: 'malpensa', modoLuogo: 'fascia', luogoDa: '13:00', luogoA: '14:00', stimaDa: '15:30', stimaA: '16:30', navetta: 'aldo', prelievo: '14:15' })
  assert.deepEqual(arrivoInBreve(malpensa, OGGI, OGGI), [
    'oggi, in struttura 15:30–16:30 circa',
    'atterra a Malpensa fra le 13:00 e le 14:00',
    'navetta Aldo · prelievo a Malpensa 14:15',
  ])
})

test('Soggiorno · arrivo e navetta per esteso', () => {
  const malpensa = arr({ tipo: 'luogo', luogo: 'malpensa', modoLuogo: 'fascia', luogoDa: '13:00', luogoA: '14:00', stimaDa: '15:30', stimaA: '16:30', navetta: 'aldo', prelievo: '14:15' })
  assert.deepEqual(arrivoGrande(malpensa, OGGI, OGGI), { testo: 'Oggi, 15:30–16:30', circa: true })
  assert.deepEqual(luogoInSoggiorno(malpensa), { etichetta: 'Arrivo a Malpensa', testo: 'fra le 13:00 e le 14:00 · in aereo' })
  assert.deepEqual(navettaInSoggiorno(malpensa), { forte: 'Aldo', resto: ' · prelievo a Malpensa alle 14:15' })
  const centrale = arr({ tipo: 'luogo', luogo: 'centrale', luogoDa: '14:30', navetta: 'massimo', prelievo: '14:30' })
  assert.deepEqual(luogoInSoggiorno(centrale), { etichetta: 'Arrivo a Milano Centrale', testo: 'alle 14:30 · in treno' })
  assert.deepEqual(arrivoGrande(arr({ tipo: 'struttura', strutturaDa: '15:10' }), OGGI, OGGI), { testo: 'Oggi alle 15:10', circa: false })
  assert.deepEqual(arrivoGrande(ARRIVO_VUOTO, OGGI, OGGI), { testo: 'Arrivo da definire', circa: false })
  assert.deepEqual(navettaInSoggiorno(arr({ navetta: 'da_assegnare' })), { forte: 'Da assegnare', resto: ' · autista ancora da scegliere' })
  assert.deepEqual(navettaInSoggiorno(arr({ navetta: 'da_definire' })), { forte: 'Da definire', resto: ' · da chiedere all’ospite' })
  assert.deepEqual(navettaInSoggiorno(arr({ navetta: 'non_richiesta' })), { forte: 'Non richiesta', resto: '' })
})

test('In breve · camera, ospiti, conto, documento, note', () => {
  assert.equal(camereInBreve(caselleSoggiorno(MARIA, OGGI)), 'Ambra, poi Lena da gio 1')
  assert.equal(camereInBreve(caselleSoggiorno(DUE_CAMBI, OGGI)), 'Ambra 2 notti · Lena 2 · Allegra 2')
  assert.equal(camereInBreve(caselleSoggiorno([MARIA[0]], OGGI)), 'Ambra')
  assert.equal(ospitiInBreve(caselleSoggiorno(DUE_CAMBI, OGGI), nottiConLetto(DUE_CAMBI)), '2, poi 3 dal 30 (letto in più)')
  assert.equal(ospitiInBreve(caselleSoggiorno(MARIA, OGGI), nottiConLetto(MARIA)), null)
  const caparra = caparraDaRicevere({ accordo_pagamento: 'caparra_meta', bonifico: true, caparra_centesimi: 23500, caparra_entro: '2026-09-30' }, 47000, 0)
  assert.deepEqual(caparra, { importoCent: 23500, entro: '2026-09-30' })
  assert.deepEqual(contoInBreve(47000, false, caparra), { testo: '470 € · caparra entro mer 30', saldato: false })
  assert.deepEqual(contoInBreve(0, true, null), { testo: 'saldato', saldato: true })
  assert.equal(caparraDaRicevere({ accordo_pagamento: 'caparra_meta', caparra_centesimi: 23500, caparra_entro: '2026-09-30' }, 47000, 23500), null)
  assert.deepEqual(documentoInBreve(0), { testo: 'da chiedere all’arrivo', manca: true })
  assert.deepEqual(documentoInBreve(2), { testo: 'caricato', manca: false })
  assert.equal(documentoInBreve(null), null)
  assert.equal(noteInBreve([{ testo: 'Camera silenziosa' }, { testo: ' Marito in Humanitas ' }]), 'Camera silenziosa · Marito in Humanitas')
  assert.equal(noteInBreve([]), null)
})

test('Da fare oggi: UN\'azione per voce, e i prossimi giorni', () => {
  assert.equal(azioneDaFare('pagamento'), 'Pagamento')
  assert.equal(azioneDaFare('documento'), 'Documento')
  assert.equal(azioneDaFare('arrivo:x'), 'Arrivo')
  assert.equal(azioneDaFare('sovrapposizione:a:b'), 'Calendario')
  assert.deepEqual(prossimiGiorni(caselleSoggiorno(DUE_CAMBI, OGGI), OGGI, '2026-10-04', 23500).map(g => [g.giorno, g.cosa, g.nota]), [
    ['mer 30', '⇄ da Ambra a Lena', 'Lena va pronta prima'],
    ['ven 2', '⇄ da Lena ad Allegra', 'Allegra va pronta prima'],
    ['dom 4', 'parte', 'saldo 235 €'],
  ])
  assert.deepEqual(prossimiGiorni(caselleSoggiorno(MARIA, OGGI), OGGI, '2026-10-04', 0).at(-1), { chiave: 'partenza', giorno: 'dom 4', cosa: 'parte', nota: '' })
})

test('Soggiorno · camere: una riga per tratto, ⇄ e «va pronta prima del cambio»', () => {
  const r = camereSoggiorno(MARIA)
  assert.deepEqual(r.map(x => [x.nome, x.cambio, x.dettaglio, x.nota]), [
    ['Ambra', false, '28 set → 1 ott · 3 notti · 2 ospiti · letto in più mer 30', null],
    ['Lena', true, '1 → 4 ott · 3 notti · 2 ospiti', 'Lena va pronta prima del cambio'],
  ])
  assert.equal(cambiCamere(r), '1 cambio')
  assert.equal(cambiCamere(camereSoggiorno(DUE_CAMBI)), '2 cambi')
  assert.equal(camereSoggiorno(DUE_CAMBI)[1].dettaglio, '30 set → 2 ott · 2 notti · 3 ospiti · letto in più')
})

test('Conto: frase di come paga con la caparra, nessun pagamento, acconto e saldo', () => {
  assert.equal(fraseComePagaEstesa({ accordo_pagamento: 'caparra_meta', bonifico: true, caparra_centesimi: 23500, caparra_entro: '2026-09-30' }, 47000),
    'Caparra del 50%, il resto all’arrivo · 235 € entro mer 30 set')
  assert.equal(fraseComePagaEstesa({ accordo_pagamento: 'contanti', bonifico: false }, 47000), 'Paga tutto in contanti quando arriva')
  assert.equal(nessunPagamento({ accordo_pagamento: null, bonifico: false }), 'Nessun pagamento registrato · si incassa all’arrivo.')
  assert.equal(nessunPagamento({ accordo_pagamento: 'caparra_meta', bonifico: true }), 'Nessun pagamento registrato · i pagamenti non coprono ancora la prima notte.')
  const t = tipoPagamenti([{ id: 'x', amount: 235, paid_on: '2026-09-20' }, { id: 'y', amount: 235, paid_on: '2026-09-28' }], 47000)
  assert.equal(t.get('x'), 'acconto')
  assert.equal(t.get('y'), 'saldo completo')
})

test('Cliente: già ospite e documenti', () => {
  assert.equal(giaOspite(4, 64000), '4 volte · 640 €')
  assert.equal(giaOspite(0, 0), 'prima volta')
  assert.deepEqual(documentiCliente(0), { testo: 'nessuno', nessuno: true })
  assert.deepEqual(documentiCliente(3), { testo: '3 caricati ›', nessuno: false })
  assert.equal(documentiCliente(null), null)
})
