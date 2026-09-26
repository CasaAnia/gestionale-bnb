import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arriviDeiPeriodi, etichettaArrivoPeriodo } from './arriviPeriodi.ts'
import { leggiArrivo, ARRIVO_VUOTO } from './arrivo.ts'
import { salvaArrivoPrenotazione } from './arrivoDati.ts'

const primo = { id: 'a', check_in: '2026-10-01', check_out: '2026-10-02', status: 'confermata', rooms: { name: 'Allegra' }, check_in_time: '15:00', shuttle: 'no' }
const secondo = { id: 'b', check_in: '2026-10-05', check_out: '2026-10-07', status: 'confermata', rooms: { name: 'Amelia' }, check_in_time: null, shuttle: null }

test('i due arrivi restano ordinati e identificati dalla propria riga', () => {
  assert.deepEqual(arriviDeiPeriodi([secondo, primo]).map(r => r.id), ['a', 'b'])
  assert.equal(etichettaArrivoPeriodo(secondo), 'Arrivo 5 ottobre 2026 · Amelia')
})
test('il cambio contiguo non aggiunge un arrivo; il rientro nella stessa camera sì', () => {
  assert.equal(arriviDeiPeriodi([primo, { ...secondo, check_in: primo.check_out }]).length, 1)
  assert.equal(arriviDeiPeriodi([primo, { ...secondo, rooms: primo.rooms }]).length, 2)
})
test('l’annullamento non crea un arrivo né riempie una pausa', () => {
  assert.deepEqual(arriviDeiPeriodi([primo, { ...secondo, status: 'annullata' }]).map(r => r.id), ['a'])
  assert.equal(arriviDeiPeriodi([primo, secondo, { ...secondo, id: 'ponte', check_in: primo.check_out, check_out: secondo.check_in, status: 'annullata' }]).length, 2)
})
test('salva e rilegge il secondo arrivo due volte senza modificare il primo', async () => {
  const archivio: Record<string, Record<string, unknown>> = { a: { ...primo }, b: { ...secondo } }
  const originale = structuredClone(archivio.a)
  for (const ora of ['18:00', '19:00']) {
    const destinazione = arriviDeiPeriodi([primo, secondo])[1].id
    const esito = await salvaArrivoPrenotazione(
      async campi => { Object.assign(archivio[destinazione], campi); return { data: [{ id: destinazione }], error: null } },
      { ...ARRIVO_VUOTO, tipo: 'struttura', strutturaDa: ora, navetta: 'massimo', prelievo: '17:30' },
      async () => ({ data: [structuredClone(archivio[destinazione])], error: null }),
    )
    assert.equal(esito.esito, 'ok')
    assert.equal(leggiArrivo(structuredClone(archivio.b)).strutturaDa, ora)
    assert.deepEqual(archivio.a, originale)
  }
})
