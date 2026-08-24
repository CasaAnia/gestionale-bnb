// Test della navetta (regole fissate da Ania il 24/08/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testoNavetta, suffissoNavettaNotifica, cosaManca } from './navetta.ts'

test('i tre stati hanno testi distinti e il vuoto è "da definire"', () => {
  assert.equal(testoNavetta('si'), '🚌 Navetta')
  assert.equal(testoNavetta('no'), 'No navetta')
  assert.equal(testoNavetta(null), 'Navetta da definire')
  assert.equal(testoNavetta(undefined), 'Navetta da definire')
})

test('notifica delle 16: sì ben visibile, da definire esplicito, no discreto', () => {
  assert.equal(suffissoNavettaNotifica({ shuttle: 'si' }), ' · 🚌 navetta')
  assert.equal(suffissoNavettaNotifica({ shuttle: null }), ' · navetta da definire')
  assert.equal(suffissoNavettaNotifica({ shuttle: 'no' }), '')
  // colonna non ancora migrata: nessun rumore
  assert.equal(suffissoNavettaNotifica({}), '')
})

test('promemoria delle 17: parte nei tre casi e tace quando è tutto definito', () => {
  assert.equal(cosaManca({ check_in_time: null, shuttle: 'si' }), 'manca orario')
  assert.equal(cosaManca({ check_in_time: '15:30', shuttle: null }), 'navetta da definire')
  assert.equal(cosaManca({ check_in_time: null, shuttle: null }), 'mancano orario e navetta')
  assert.equal(cosaManca({ check_in_time: '15:30', shuttle: 'no' }), null)
  // colonna non ancora migrata: vale solo l'orario, come prima
  assert.equal(cosaManca({ check_in_time: '15:30' }), null)
  assert.equal(cosaManca({ check_in_time: null }), 'manca orario')
})
