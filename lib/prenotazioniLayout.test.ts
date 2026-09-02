import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const nuova = readFileSync(new URL('../app/nuova/page.tsx', import.meta.url), 'utf8')
const dettaglio = readFileSync(new URL('../app/prenotazioni/[id]/page.tsx', import.meta.url), 'utf8')

function occorrenze(testo: string, frammento: string) {
  return testo.split(frammento).length - 1
}

test('nuova prenotazione protegge entrambe le caselle data dalla larghezza minima di iPhone', () => {
  assert.ok(occorrenze(nuova, '<div className="min-w-0">') >= 2)
  assert.ok(occorrenze(nuova, 'w-full min-w-0 appearance-none bg-white') >= 2)
})

test('modifica e prolungamento mantengono la stessa protezione delle caselle data', () => {
  assert.ok(occorrenze(dettaglio, '<div className="min-w-0">') >= 4)
  assert.ok(occorrenze(dettaglio, 'w-full min-w-0 appearance-none') >= 4)
})
