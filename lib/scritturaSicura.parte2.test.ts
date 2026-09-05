// Errori di salvataggio visibili, parte 2 (05/09/2026): scenari delle pagine
// che passano da scriviPoiAggiorna — pezzo 1 (cliente), pezzo 2 (group_id,
// completata, motivo, annullamento), pezzo 3 (tariffe), pezzo 4 (cliente in /nuova).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriviPoiAggiorna, MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const rifiuta = () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied' } })
const riesce = () => Promise.resolve({ data: null, error: null })

test('pezzo 1 — elimina cliente: con errore non si naviga via e compare l\'avviso', async () => {
  let navigato = false
  const errore = await scriviPoiAggiorna(rifiuta, () => { navigato = true })
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.equal(navigato, false)
})

test('pezzo 1 — modifica cliente: con errore la scheda resta com\'era e il modulo resta aperto', async () => {
  let guest = { full_name: 'Anna Rossi', phone: '39333' }
  let editing = true
  const errore = await scriviPoiAggiorna(rifiuta, () => { guest = { ...guest, full_name: 'Anna Bianchi' }; editing = false })
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.equal(guest.full_name, 'Anna Rossi')
  assert.equal(editing, true)
  assert.equal(await scriviPoiAggiorna(riesce, () => { guest = { ...guest, full_name: 'Anna Bianchi' }; editing = false }), null)
  assert.equal(guest.full_name, 'Anna Bianchi')
  assert.equal(editing, false)
})

test('pezzo 2 — cambio camera (group_id): con errore la scheda non prende il gruppo e non si va a /nuova', async () => {
  let booking: { group_id: string | null } = { group_id: null }
  let rotta: string | null = null
  const errore = await scriviPoiAggiorna(rifiuta, () => { booking = { group_id: 'g1' }; rotta = '/nuova' })
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.equal(booking.group_id, null)
  assert.equal(rotta, null)
})

test('pezzo 2 — annullamento: con errore la prenotazione resta confermata, la finestra resta aperta, il log non viene scritto', async () => {
  let booking = { status: 'confermata' }
  let finestraAperta = true
  let logScritto = false
  const errore = await scriviPoiAggiorna(rifiuta, () => { booking = { status: 'annullata' }; finestraAperta = false; logScritto = true })
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.deepEqual([booking.status, finestraAperta, logScritto], ['confermata', true, false])
})

test('pezzo 2 — motivo annullamento e «completata»: con errore restano i valori di prima', async () => {
  let booking = { status: 'confermata', cancelled_reason: 'vecchio motivo' }
  assert.equal(await scriviPoiAggiorna(rifiuta, () => { booking = { ...booking, cancelled_reason: 'nuovo' } }), MESSAGGIO_NON_SALVATO)
  assert.equal(await scriviPoiAggiorna(rifiuta, () => { booking = { ...booking, status: 'completata' } }), MESSAGGIO_NON_SALVATO)
  assert.deepEqual(booking, { status: 'confermata', cancelled_reason: 'vecchio motivo' })
})

test('pezzo 3 — tariffe camere: con errore la tariffa a schermo resta quella salvata e le modifiche restano in bozza', async () => {
  let rooms = [{ id: 'r1', base_price: 70 }]
  let edits: Record<string, { base_price: number }> = { r1: { base_price: 75 } }
  const errore = await scriviPoiAggiorna(rifiuta, () => {
    rooms = rooms.map(r => r.id === 'r1' ? { ...r, ...edits.r1 } : r)
    edits = {}
  })
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.equal(rooms[0].base_price, 70)
  assert.deepEqual(edits, { r1: { base_price: 75 } })
})

test('pezzo 4 — /nuova, cliente esistente: con errore sull\'update del cliente la prenotazione NON viene inserita', async () => {
  let inserita = false
  const errore = await scriviPoiAggiorna(rifiuta, () => { /* aggiornamento locale del cliente */ })
  if (!errore) inserita = true
  assert.equal(errore, MESSAGGIO_NON_SALVATO)
  assert.equal(inserita, false)
})
