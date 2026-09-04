import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  prezzoNotti, prezzoPrenotazione, personePerNottePrenotazione, nottiConLetto,
  tariffaMinima, riallineaTariffa, tariffaFormDaSalvato,
  gruppiNotti, testoDettaglioNotti, dettaglioNottiSalvato, giorniSoggiorno,
} from './prezzoNotti.ts'
import { tariffaCamera, totaleLetto } from './tariffe.ts'
import { contoSoggiorno } from './conto.ts'
import { segmento } from './richiesteProposta.ts'
import { righeCostiSegmenti } from './riepilogoCosti.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, active: true }

const G2 = ['2026-09-13', '2026-09-14']
const G3 = ['2026-09-13', '2026-09-14', '2026-09-15']

// Prenotazione come la salva il gestionale: num_guests = massimo, letto nelle notti indicate
const pren = (room: { id: string }, num_guests: number, extra_bed_dates: string[], notti = 2, price_per_night?: number) => ({
  room_id: room.id, check_in: '2026-09-13', check_out: notti === 3 ? '2026-09-16' : '2026-09-15',
  num_guests, extra_bed: extra_bed_dates.length > 0, extra_bed_dates, price_per_night,
})

test('persone costanti: il conto notte per notte è identico a prima (tariffa × notti + letto)', () => {
  for (const [room, n, dates] of [
    [LENA, 2, []], [LENA, 3, G2], [LENA, 4, G2], [AMBRA, 2, []], [AMBRA, 3, G2], [AMELIA, 1, []], [AMELIA, 2, G2],
  ] as const) {
    const b = pren(room, n, [...dates])
    const pn = prezzoPrenotazione(room, b)
    const attesoPrezzo = tariffaCamera(room, n).prezzoNotte
    const attesoLetto = totaleLetto(room, n, dates.length)
    assert.equal(pn.prezzoNotte, attesoPrezzo, `${room.name} ${n}: price_per_night`)
    assert.equal(pn.lettoTotale, attesoLetto, `${room.name} ${n}: extra_bed_total`)
    assert.equal(pn.totale, contoSoggiorno({ ...b, price_per_night: attesoPrezzo, extra_bed_total: attesoLetto }).totale, `${room.name} ${n}: totale`)
    assert.equal(pn.tariffaUniforme, true)
  }
  // Lena a 3: 90 tutto compreso, Lena a 4: 100 a notte, Ambra a 3: 80 + 10
  assert.deepEqual(prezzoPrenotazione(LENA, pren(LENA, 3, G2)).notti.map(x => x.prezzo), [90, 90])
  assert.deepEqual(prezzoPrenotazione(LENA, pren(LENA, 4, G2)).notti.map(x => x.prezzo), [100, 100])
  assert.deepEqual(prezzoPrenotazione(AMBRA, pren(AMBRA, 3, G2)).notti.map(x => [x.tariffa, x.letto]), [[80, 10], [80, 10]])
})

test('Lena, prima notte in 2 e seconda in 3: 80 + 90 = 170, non 180', () => {
  const b = pren(LENA, 3, ['2026-09-14'])
  assert.deepEqual(personePerNottePrenotazione(LENA, b), [2, 3])
  const pn = prezzoPrenotazione(LENA, b)
  assert.deepEqual(pn.notti.map(x => x.prezzo), [80, 90])
  assert.equal(pn.totale, 170)
  assert.equal(pn.tariffaUniforme, false)
  // salvataggio: notte più economica + resto, e contoSoggiorno torna esatto
  assert.equal(pn.prezzoNotte, 80)
  assert.equal(pn.lettoTotale, 10)
  assert.equal(contoSoggiorno({ ...b, price_per_night: pn.prezzoNotte, extra_bed_total: pn.lettoTotale }).totale, 170)
})

test('Lena, 3 poi 2: 90 + 80 = 170', () => {
  const pn = prezzoPrenotazione(LENA, pren(LENA, 3, ['2026-09-13']))
  assert.deepEqual(pn.notti.map(x => [x.persone, x.prezzo]), [[3, 90], [2, 80]])
  assert.equal(pn.totale, 170)
  assert.equal(pn.prezzoNotte, 80)
  assert.equal(pn.lettoTotale, 10)
})

test('Lena, 2-3-2 su tre notti: 80 + 90 + 80 = 250', () => {
  const pn = prezzoPrenotazione(LENA, pren(LENA, 3, ['2026-09-14'], 3))
  assert.deepEqual(pn.notti.map(x => [x.persone, x.prezzo]), [[2, 80], [3, 90], [2, 80]])
  assert.equal(pn.totale, 250)
  assert.equal(pn.prezzoNotte, 80)
  assert.equal(pn.lettoTotale, 10)
  assert.equal(testoDettaglioNotti(pn.notti), '2 notti in 2 a 80 €, 1 notte in 3 a 90 €')
})

test('Lena con 4 persone: 100 € a notte (90 + letto 10); in 2 poi in 4: 80 + 100', () => {
  const quattro = prezzoPrenotazione(LENA, pren(LENA, 4, G2))
  assert.deepEqual(quattro.notti.map(x => x.prezzo), [100, 100])
  assert.equal(quattro.totale, 200)
  assert.equal(quattro.prezzoNotte, 90)
  assert.equal(quattro.lettoTotale, 20)
  const misto = prezzoPrenotazione(LENA, pren(LENA, 4, ['2026-09-14']))
  assert.deepEqual(misto.notti.map(x => [x.persone, x.tariffa, x.letto, x.prezzo]), [[2, 80, 0, 80], [4, 90, 10, 100]])
  assert.equal(misto.totale, 180)
  assert.equal(misto.prezzoNotte, 80)
  assert.equal(misto.lettoTotale, 20)
})

test('Ambra con letto solo in una notte: tariffa uniforme 80, letto 10 solo quella notte (come prima)', () => {
  const pn = prezzoPrenotazione(AMBRA, pren(AMBRA, 3, ['2026-09-14']))
  assert.deepEqual(pn.notti.map(x => [x.persone, x.tariffa, x.letto]), [[2, 80, 0], [3, 80, 10]])
  assert.equal(pn.tariffaUniforme, true)
  assert.equal(pn.prezzoUniforme, false)
  assert.equal(pn.prezzoNotte, 80)
  assert.equal(pn.lettoTotale, 10)
  assert.equal(pn.totale, 170)
})

test('tariffa scritta a mano: sposta tutte le notti della stessa differenza', () => {
  const pn = prezzoPrenotazione(LENA, pren(LENA, 3, ['2026-09-14'], 2, 75))
  assert.deepEqual(pn.notti.map(x => x.prezzo), [75, 85])
  assert.equal(pn.prezzoNotte, 75)
  assert.equal(pn.lettoTotale, 10)
  assert.equal(pn.totale, 160)
})

test('le proposte delle Richieste danno gli stessi numeri della prenotazione', () => {
  const s = segmento(LENA, '2026-09-13', '2026-09-15', [2, 3])
  const b = prezzoPrenotazione(LENA, pren(LENA, 3, ['2026-09-14']))
  assert.equal(s.totale, b.totale)
  assert.equal(s.prezzoNotte, b.prezzoNotte)
  assert.equal(s.lettoTotale, b.lettoTotale)
  assert.equal(s.totale, 170)
  const tre = segmento(LENA, '2026-09-13', '2026-09-16', [2, 3, 2])
  assert.equal(tre.totale, 250)
  assert.equal(segmento(LENA, '2026-09-13', '2026-09-15', [4, 4]).totale, 200)
  assert.equal(segmento(LENA, '2026-09-13', '2026-09-15', [3, 2]).totale, 170)
  // uniforme, come prima
  assert.deepEqual([segmento(LENA, '2026-09-13', '2026-09-15', 3).prezzoNotte, segmento(LENA, '2026-09-13', '2026-09-15', 3).lettoTotale], [90, 0])
  assert.deepEqual([segmento(AMBRA, '2026-09-13', '2026-09-15', 3).prezzoNotte, segmento(AMBRA, '2026-09-13', '2026-09-15', 3).lettoTotale], [80, 20])
})

test('righe del riepilogo costi: dettaglio per notte solo se la tariffa cambia, altrimenti come prima', () => {
  const rooms = { name: 'Lena', extra_bed_price: 10, base_price: 80, double_price: 90, has_extra_bed: true }
  // salvata nel modo nuovo: 80 + resto 10, totale 170
  const mista = { ...pren(LENA, 3, ['2026-09-14']), price_per_night: 80, extra_bed_total: 10, total_amount: 170, rooms }
  const r = righeCostiSegmenti([mista], false)
  assert.deepEqual(r.righe, [{ label: 'Camera Lena – Tripla (1 notte in 2 a 80,00 €, 1 notte in 3 a 90,00 €)', amount: 170 }])
  assert.equal(r.totale, 170)
  // stesso segmento nella proposta (persone esplicite, formato «80 €»)
  const proposta = { check_in: '2026-09-13', check_out: '2026-09-15', price_per_night: 80, extra_bed: true, extra_bed_total: 10, num_guests: 3, persone_notti: [2, 3], extra_bed_dates: [], rooms }
  assert.deepEqual(righeCostiSegmenti([proposta], false, n => `${n} €`).righe, [{ label: 'Camera Lena – Tripla (1 notte in 2 a 80 €, 1 notte in 3 a 90 €)', amount: 170 }])
  // uniforme: invariato (Lena a 3 una riga tutto compreso, Ambra a 3 letto a parte)
  const lena3 = { ...pren(LENA, 3, G2), price_per_night: 90, extra_bed_total: 0, total_amount: 180, rooms }
  assert.deepEqual(righeCostiSegmenti([lena3], false).righe, [{ label: 'Camera Lena – Tripla (2 notti × 90,00 €)', amount: 180 }])
  const ambra3 = { ...pren(AMBRA, 3, ['2026-09-14']), price_per_night: 80, extra_bed_total: 10, total_amount: 170, rooms: { ...AMBRA } }
  assert.deepEqual(righeCostiSegmenti([ambra3], false).righe, [
    { label: 'Camera Ambra – Matrimoniale (2 notti × 80,00 €)', amount: 160 },
    { label: 'Letto supplementare', amount: 10 },
  ])
  // dato storico col bug (90 × 2 = 180 salvato): il totale salvato comanda, riga unica
  const vecchia = { ...pren(LENA, 3, ['2026-09-14']), price_per_night: 90, extra_bed_total: 0, total_amount: 180, rooms }
  assert.deepEqual(righeCostiSegmenti([vecchia], false).righe, [{ label: 'Camera Lena – Tripla (2 notti)', amount: 180 }])
  assert.equal(dettaglioNottiSalvato(rooms, vecchia), null)
  assert.equal(dettaglioNottiSalvato(rooms, mista)?.length, 2)
  assert.equal(dettaglioNottiSalvato(rooms, lena3), null)
})

test('campo Tariffa/notte del form: segue il listino della notte più economica, a mano resta', () => {
  const tutte = pren(LENA, 3, G2, 2, 90)
  const unaSola = { ...tutte, extra_bed_dates: ['2026-09-14'] }
  assert.equal(tariffaMinima(LENA, tutte), 90)
  assert.equal(tariffaMinima(LENA, unaSola), 80)
  assert.equal(riallineaTariffa(LENA, tutte, unaSola), 80)
  assert.equal(riallineaTariffa(LENA, { ...unaSola, price_per_night: 80 }, { ...unaSola, extra_bed_dates: G2 }), 90)
  assert.equal(riallineaTariffa(LENA, { ...tutte, price_per_night: 85 }, unaSola), 85)
  // apertura della modifica: riga vecchia col bug → 80; riga nuova o uniforme → invariata; a mano → invariata
  assert.equal(tariffaFormDaSalvato(LENA, { ...unaSola, price_per_night: 90 }), 80)
  assert.equal(tariffaFormDaSalvato(LENA, { ...unaSola, price_per_night: 80 }), 80)
  assert.equal(tariffaFormDaSalvato(LENA, tutte), 90)
  assert.equal(tariffaFormDaSalvato(LENA, { ...unaSola, price_per_night: 85 }), 85)
  assert.equal(tariffaFormDaSalvato(AMBRA, { ...pren(AMBRA, 3, ['2026-09-14']), price_per_night: 80 }), 80)
})

test('persone per notte dai letti: senza letto tutte num_guests, con letto solo in quelle notti', () => {
  assert.deepEqual(personePerNottePrenotazione(LENA, pren(LENA, 3, [])), [3, 3])
  assert.deepEqual(personePerNottePrenotazione(LENA, { ...pren(LENA, 3, []), extra_bed: true, extra_bed_dates: null }), [3, 3])
  assert.deepEqual(nottiConLetto({ check_in: '2026-09-13', check_out: '2026-09-15', extra_bed: true, extra_bed_dates: null }), G2)
  assert.deepEqual(nottiConLetto({ check_in: '2026-09-13', check_out: '2026-09-15', extra_bed: true, extra_bed_dates: [] }), [])
  assert.deepEqual(personePerNottePrenotazione(AMELIA, pren(AMELIA, 2, ['2026-09-13'])), [2, 1])
  assert.deepEqual(giorniSoggiorno('2026-09-30', '2026-10-02'), ['2026-09-30', '2026-10-01'])
  assert.throws(() => prezzoNotti(LENA, G2, [2], []))
})

test('gruppi e testo del dettaglio', () => {
  const pn = prezzoNotti(LENA, G3, [3, 2, 3], [])
  assert.deepEqual(gruppiNotti(pn.notti), [{ notti: 2, persone: 3, prezzo: 90 }, { notti: 1, persone: 2, prezzo: 80 }])
  assert.equal(testoDettaglioNotti(pn.notti), '2 notti in 3 a 90 €, 1 notte in 2 a 80 €')
  // persone uguali ma prezzi diversi (prezzo a mano nelle proposte): senza «in N»
  const manuale = [{ giorno: G2[0], persone: 2, tariffa: 60, letto: 0, prezzo: 60 }, { giorno: G2[1], persone: 2, tariffa: 75, letto: 0, prezzo: 75 }]
  assert.equal(testoDettaglioNotti(manuale), '1 notte a 60 €, 1 notte a 75 €')
  assert.equal(testoDettaglioNotti(pn.notti, n => `€${n}`), '2 notti in 3 a €90, 1 notte in 2 a €80')
})
