// Il «Da fare» del riquadro del dito premuto (versione D, Ania 02/10/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daFarePrenotazione, quandoLetto, LETTO_IN_PIU, CHIEDERE_ARRIVO, CHIEDERE_PARTENZA, CONTROLLARE_BONIFICO, FARE_RICEVUTA,
  type DatiDaFare,
} from './daFarePrenotazione.ts'

// Il caso del riferimento: Ambra dal 28 set al 1 ott, oggi è il 27 set
const NOTTI = ['2026-09-28', '2026-09-29', '2026-09-30']
const vuoto = (x: Partial<DatiDaFare> = {}): DatiDaFare => ({
  oggi: '2026-09-27',
  notti: NOTTI,
  nottiLetto: [],
  cambi: [],
  arrivo: { checkIn: '2026-09-28', orarioIgnoto: false },
  partenza: { checkOut: '2026-10-01', ora: '10:30' },
  accordo: { accordo_pagamento: 'contanti', bonifico: false },
  pagamenti: [],
  saldato: false,
  vuoleRicevuta: false,
  ...x,
})
const testi = (d: DatiDaFare) => daFarePrenotazione(d).map(v => v.testo)

test('nessuna voce: l’elenco è vuoto, quindi nessun blocco «Da fare»', () => {
  assert.deepEqual(daFarePrenotazione(vuoto()), [])
})

test('1. il letto in più, per tutte le notti: per primo e segnato come letto (rosso)', () => {
  const v = daFarePrenotazione(vuoto({ nottiLetto: NOTTI }))
  assert.deepEqual(v, [{ testo: LETTO_IN_PIU, letto: true }])
})

test('1. il letto in più solo per alcune notti: «dal 29 set», «il 29 set», e l’elisione solo per 1, 8, 11', () => {
  assert.deepEqual(testi(vuoto({ nottiLetto: ['2026-09-29', '2026-09-30'] })), [`${LETTO_IN_PIU} dal 29 set`])
  assert.deepEqual(testi(vuoto({ nottiLetto: ['2026-09-29'] })), [`${LETTO_IN_PIU} il 29 set`])
  assert.equal(quandoLetto(['2026-10-08', '2026-10-09'], ['2026-10-07', '2026-10-08', '2026-10-09']), 'dall\'8 ott')
  assert.equal(quandoLetto(['2026-10-01'], ['2026-10-01', '2026-10-02']), 'l\'1 ott')
  assert.equal(quandoLetto(['2026-10-02', '2026-10-03'], ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']), 'dal 2 al 3 ott')
})

test('1. il letto in più sparisce quando la partenza è passata o è oggi', () => {
  assert.deepEqual(testi(vuoto({ nottiLetto: NOTTI, oggi: '2026-10-01' })).filter(t => t.startsWith(LETTO_IN_PIU)), [])
  assert.deepEqual(testi(vuoto({ nottiLetto: NOTTI, oggi: '2026-10-05' })).filter(t => t.startsWith(LETTO_IN_PIU)), [])
})

test('2. il cambio camera non ancora passato: «cambio camera: mer 30 passa in Allegra»', () => {
  assert.deepEqual(testi(vuoto({ cambi: [{ giorno: '2026-09-30', camera: 'Allegra' }] })), ['cambio camera: mer 30 passa in Allegra'])
  assert.deepEqual(testi(vuoto({ oggi: '2026-09-30', cambi: [{ giorno: '2026-09-30', camera: 'Allegra' }] })), ['cambio camera: mer 30 passa in Allegra'])
  assert.deepEqual(testi(vuoto({ oggi: '2026-10-01', partenza: { checkOut: '2026-10-01', ora: '10:00' }, cambi: [{ giorno: '2026-09-30', camera: 'Allegra' }] })), [])
})

test('3. l’ora d’arrivo manca e il check-in non è passato', () => {
  assert.deepEqual(testi(vuoto({ arrivo: { checkIn: '2026-09-28', orarioIgnoto: true } })), [CHIEDERE_ARRIVO])
  assert.deepEqual(testi(vuoto({ oggi: '2026-09-29', arrivo: { checkIn: '2026-09-28', orarioIgnoto: true } })), [])
})

test('4. l’ora di partenza manca e il check-out non è passato', () => {
  assert.deepEqual(testi(vuoto({ partenza: { checkOut: '2026-10-01', ora: null } })), [CHIEDERE_PARTENZA])
  assert.deepEqual(testi(vuoto({ partenza: { checkOut: '2026-10-01', ora: '  ' } })), [CHIEDERE_PARTENZA])
  assert.deepEqual(testi(vuoto({ oggi: '2026-10-02', partenza: { checkOut: '2026-10-01', ora: null } })), [])
})

test('5. l’accordo prevede un bonifico e nessun bonifico è registrato', () => {
  for (const accordo_pagamento of ['bonifico_arrivo', 'bonifico_intero', 'caparra_meta', 'caparra_libera']) {
    assert.deepEqual(testi(vuoto({ accordo: { accordo_pagamento } })), [CONTROLLARE_BONIFICO], accordo_pagamento)
  }
  // la vecchia spunta «bonifico» senza accordo scritto
  assert.deepEqual(testi(vuoto({ accordo: { accordo_pagamento: null, bonifico: true } })), [CONTROLLARE_BONIFICO])
})

test('5. con l’accordo in contanti (o da vedere) nessuna voce sul bonifico', () => {
  assert.deepEqual(testi(vuoto({ accordo: { accordo_pagamento: 'contanti', bonifico: false } })), [])
  assert.deepEqual(testi(vuoto({ accordo: null })), [])
  assert.deepEqual(testi(vuoto({ accordo: { accordo_pagamento: null, bonifico: false } })), [])
})

test('5. il bonifico registrato fa sparire la voce (un acconto in contanti no)', () => {
  const accordo = { accordo_pagamento: 'caparra_meta' }
  assert.deepEqual(testi(vuoto({ accordo, pagamenti: [{ method: 'contanti' }] })), [CONTROLLARE_BONIFICO])
  assert.deepEqual(testi(vuoto({ accordo, pagamenti: [{ method: 'contanti' }, { method: 'bonifico' }] })), [])
  // conto già saldato: non c'è più nessun bonifico da aspettare
  assert.deepEqual(testi(vuoto({ accordo, saldato: true })), [])
})

test('6. la ricevuta: finché la prenotazione non è passata (nel database non si segna «fatta»)', () => {
  assert.deepEqual(testi(vuoto({ vuoleRicevuta: true })), [FARE_RICEVUTA])
  assert.deepEqual(testi(vuoto({ vuoleRicevuta: true, oggi: '2026-10-01' })), [FARE_RICEVUTA])
  assert.deepEqual(testi(vuoto({ vuoleRicevuta: true, oggi: '2026-10-02' })), [])
})

test('l’ordine delle voci è sempre quello del riferimento, col letto per primo', () => {
  const tutte = daFarePrenotazione(vuoto({
    vuoleRicevuta: true,
    accordo: { accordo_pagamento: 'bonifico_intero' },
    partenza: { checkOut: '2026-10-01', ora: null },
    arrivo: { checkIn: '2026-09-28', orarioIgnoto: true },
    cambi: [{ giorno: '2026-09-30', camera: 'Allegra' }],
    nottiLetto: NOTTI,
  }))
  assert.deepEqual(tutte.map(v => v.testo), [
    LETTO_IN_PIU,
    'cambio camera: mer 30 passa in Allegra',
    CHIEDERE_ARRIVO,
    CHIEDERE_PARTENZA,
    CONTROLLARE_BONIFICO,
    FARE_RICEVUTA,
  ])
  assert.deepEqual(tutte.map(v => !!v.letto), [true, false, false, false, false, false])
})

test('nessuna voce «incassare»: lo dice già il conto', () => {
  const v = testi(vuoto({ accordo: { accordo_pagamento: 'bonifico_arrivo' }, vuoleRicevuta: true, partenza: { checkOut: '2026-10-01', ora: null } }))
  assert.ok(v.every(t => !/incass/i.test(t)))
})
