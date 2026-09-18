// ============================================================================
// «INDIETRO» TORNA DA DOVE SI È VENUTI (18/09/2026): la fila delle pagine
// visitate che fa da riserva quando la cronologia del browser non si può
// usare (l'app si ricarica al ritorno da WhatsApp e il conteggio riparte da
// zero: dal calendario alla scheda, e «Indietro» finiva su Prenotazioni).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leggiPagine, ricordaPagina, paginaPrecedente, type MemoriaPagine } from './navHistory.ts'

const memoria = (): MemoriaPagine & { dati: Map<string, string> } => {
  const dati = new Map<string, string>()
  return { dati, getItem: k => dati.get(k) ?? null, setItem: (k, v) => { dati.set(k, v) } }
}
const T = 1_000_000

test('dal calendario alla scheda: la pagina precedente è il calendario, anche senza cronologia', () => {
  const m = memoria()
  ricordaPagina('/', false, T, m)
  ricordaPagina('/calendario', false, T, m)
  ricordaPagina('/scheda/abc', false, T, m)
  assert.deepEqual(leggiPagine(T, m), ['/', '/calendario', '/scheda/abc'])
  assert.equal(paginaPrecedente('/scheda/abc', T, m), '/calendario')
  // la ricarica della stessa pagina (ritorno da WhatsApp) non aggiunge niente
  ricordaPagina('/scheda/abc', false, T + 1000, m)
  assert.equal(paginaPrecedente('/scheda/abc', T + 1000, m), '/calendario')
  // dalle prenotazioni invece si torna alle prenotazioni
  const p = memoria()
  ricordaPagina('/prenotazioni', false, T, p)
  ricordaPagina('/scheda/abc', false, T, p)
  assert.equal(paginaPrecedente('/scheda/abc', T, p), '/prenotazioni')
})

test('tornando indietro la pagina lasciata esce dalla fila, sia col browser sia con un salto sulla pagina di prima', () => {
  const m = memoria()
  ricordaPagina('/calendario', false, T, m)
  ricordaPagina('/scheda/abc', false, T, m)
  ricordaPagina('/calendario', true, T, m)           // freccia del browser
  assert.deepEqual(leggiPagine(T, m), ['/calendario'])
  ricordaPagina('/scheda/abc', false, T, m)
  ricordaPagina('/calendario', false, T, m)          // «Indietro» che va alla riserva con un salto in avanti
  assert.deepEqual(leggiPagine(T, m), ['/calendario'])
  // e non si resta mai fermi sulla stessa pagina
  assert.equal(paginaPrecedente('/calendario', T, m), null)
})

test('la fila scade dopo dodici ore, non cresce oltre trenta pagine e ignora dati rotti', () => {
  const m = memoria()
  ricordaPagina('/calendario', false, T, m)
  ricordaPagina('/scheda/abc', false, T, m)
  assert.equal(paginaPrecedente('/scheda/abc', T + 12 * 60 * 60 * 1000 + 1, m), null)
  for (let i = 0; i < 40; i++) ricordaPagina(`/scheda/${i}`, false, T, m)
  assert.equal(leggiPagine(T, m).length, 30)
  m.dati.set('ca-nav-pagine', '{non json')
  assert.deepEqual(leggiPagine(T, m), [])
  m.dati.set('ca-nav-pagine', JSON.stringify({ quando: T, pagine: ['https://altrove', '/calendario', 5] }))
  assert.deepEqual(leggiPagine(T, m), ['/calendario'])
  // senza memoria non si rompe niente
  assert.deepEqual(ricordaPagina('/calendario', false, T, null), ['/calendario'])
  assert.equal(paginaPrecedente('/calendario', T, null), null)
})

test('«Indietro» usa la pagina ricordata come riserva, e il tracciatore segna ogni pagina', () => {
  const nav = readFileSync(new URL('../lib/navHistory.ts', import.meta.url), 'utf8')
  assert.match(nav, /const riserva = paginaPrecedente\(window\.location\.pathname\) \?\? fallback/)
  const tracker = readFileSync(new URL('../components/NavTracker.tsx', import.meta.url), 'utf8')
  assert.match(tracker, /ricordaPagina\(pathname, false\)\n\s+return/)
  assert.match(tracker, /setDepth\(getDepth\(\) - 1\)\n\s+ricordaPagina\(pathname, true\)/)
  assert.match(tracker, /setDepth\(getDepth\(\) \+ 1\)\n\s+ricordaPagina\(pathname, false\)/)
})
