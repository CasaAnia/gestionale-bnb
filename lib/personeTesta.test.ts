// La riga «persone e camera» della testa (12/09/2026, bozza approvata da Ania)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { personeTesta, caselleNotti, personeCambiano, trattiPersone } from './personeTesta.ts'

const testo = (persone: number[]) => personeTesta(persone).map(p => p.testo).join(' ')

test('persone uguali tutte le notti: solo il numero', () => {
  assert.deepEqual(personeTesta([3, 3]), [{ testo: '3', grande: true }])
  assert.deepEqual(personeTesta([1]), [{ testo: '1', grande: true }])
  assert.equal(personeCambiano([3, 3, 3]), false)
  assert.deepEqual(personeTesta([]), [])
})

test('persone che cambiano: la sequenza dei soli cambi', () => {
  // gli esempi di Ania
  assert.equal(testo([3, 1, 1, 1, 1]), '3 → 1')
  assert.equal(testo([2, 1, 2]), '2 → 1 → 2')
  assert.equal(personeCambiano([3, 1, 1, 1, 1]), true)
  // le frecce sono piccole, i numeri grandi
  assert.deepEqual(personeTesta([3, 1]), [
    { testo: '3', grande: true },
    { testo: '→', grande: false },
    { testo: '1', grande: true },
  ])
  // le notti uguali di fila non fanno una voce a testa
  assert.deepEqual(trattiPersone([2, 2, 2, 3, 3, 2]), [2, 3, 2])
})

test('più di tre tratti: il più piccolo e il più grande', () => {
  assert.equal(testo([1, 2, 3, 2]), 'da 1 a 3')
  assert.equal(testo([2, 1, 2, 1, 2]), 'da 1 a 2')
  // tre tratti esatti restano una sequenza
  assert.equal(testo([2, 1, 2]), '2 → 1 → 2')
  assert.deepEqual(personeTesta([1, 2, 3, 2]), [
    { testo: 'da', grande: false },
    { testo: '1', grande: true },
    { testo: 'a', grande: false },
    { testo: '3', grande: true },
  ])
})

// ── La strisciolina delle notti ─────────────────────────────────────────────
const giorni = (da: string, quante: number) => Array.from({ length: quante }, (_, i) =>
  new Date(Date.parse(da + 'T00:00:00Z') + i * 86400000).toISOString().slice(0, 10))

test('due notti: una casellina per notte, il cambio in evidenza', () => {
  const c = caselleNotti(['2026-10-29', '2026-10-30'], [2, 1])
  assert.deepEqual(c, [
    { etichetta: 'gio 29', persone: 2, cambia: false },
    { etichetta: 'ven 30', persone: 1, cambia: true },
  ])
})

test('cinque notti: cinque caselline, segnate solo quelle che cambiano', () => {
  const c = caselleNotti(giorni('2026-10-29', 5), [3, 1, 1, 1, 1])
  assert.equal(c.length, 5)
  assert.deepEqual(c.map(x => x.persone), [3, 1, 1, 1, 1])
  assert.deepEqual(c.map(x => x.cambia), [false, true, false, false, false])
  // a cavallo di due mesi il mese si scrive
  assert.deepEqual(c.map(x => x.etichetta), ['gio 29 ott', 'ven 30 ott', 'sab 31 ott', 'dom 1 nov', 'lun 2 nov'])
})

test('più di sette notti: le notti uguali si uniscono in una casellina', () => {
  // 10 notti: 2 le prime tre, 3 le successive tre, 2 le ultime quattro
  const notti = giorni('2026-11-09', 10)
  const persone = [2, 2, 2, 3, 3, 3, 2, 2, 2, 2]
  const c = caselleNotti(notti, persone)
  assert.equal(c.length, 3, 'una casellina per tratto')
  assert.deepEqual(c.map(x => x.persone), [2, 3, 2])
  assert.deepEqual(c.map(x => x.cambia), [false, true, true])
  assert.deepEqual(c.map(x => x.etichetta), ['lun 9 → mer 11', 'gio 12 → sab 14', 'dom 15 → mer 18'])
})

test('più di sette notti con un tratto di una notte sola: quella resta da sola', () => {
  const notti = giorni('2026-11-09', 8)
  const c = caselleNotti(notti, [2, 3, 3, 3, 3, 3, 3, 3])
  assert.deepEqual(c.map(x => x.etichetta), ['lun 9', 'mar 10 → lun 16'])
})

test('notti separate: le caselline sono solo quelle richieste, nel loro ordine', () => {
  // soggiorno con una pausa: 29 e 31 ottobre, salta il 30
  const c = caselleNotti(['2026-10-29', '2026-10-31'], [2, 1])
  assert.deepEqual(c.map(x => x.etichetta), ['gio 29', 'sab 31'])
  assert.deepEqual(c.map(x => x.persone), [2, 1])
})

test('la strisciolina non compare quando le persone sono uguali', () => {
  assert.equal(personeCambiano([2, 2]), false)
  // dati incoerenti: nessuna casellina inventata
  assert.deepEqual(caselleNotti(['2026-10-29'], [2, 1]), [])
  assert.deepEqual(caselleNotti([], []), [])
})
