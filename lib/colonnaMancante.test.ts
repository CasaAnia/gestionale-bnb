import test from 'node:test'
import assert from 'node:assert/strict'
import { colonnaMancante } from './colonnaMancante.ts'

test('riconosce i messaggi reali PostgREST e Postgres senza confondere la parola of con una colonna', () => {
  assert.equal(colonnaMancante({ code: 'PGRST204', message: "Could not find the 'prenotazione_id' column of 'bookings' in the schema cache" }), 'prenotazione_id')
  assert.equal(colonnaMancante({ code: '42703', message: 'column "extra_bed_importo" of relation "bookings" does not exist' }), 'extra_bed_importo')
  assert.equal(colonnaMancante({ code: '42703', message: 'column bookings.extra_bed_criterio does not exist' }), 'extra_bed_criterio')
  assert.equal(colonnaMancante({ code: '42703', message: 'column "bookings"."extra_bed_criterio" does not exist' }), 'extra_bed_criterio')
})

test('non elimina campi per vincoli, errori di rete o messaggi sconosciuti', () => {
  assert.equal(colonnaMancante({ code: '23514', message: 'column "caparra_centesimi" does not exist' }), null)
  assert.equal(colonnaMancante({ code: 'PGRST204', message: 'Unknown schema error' }), null)
  assert.equal(colonnaMancante({ message: 'Failed to fetch' }), null)
  assert.equal(colonnaMancante(null), null)
})
