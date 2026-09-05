// Errori di salvataggio visibili (05/09/2026): con un errore di Supabase lo
// stato locale NON cambia e compare il messaggio; senza errore cambia e il
// messaggio è assente. Il finto imita la risposta PostgREST ({ error }).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scriviPoiAggiorna, messaggioNonSalvato, MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

const supabaseCheRifiuta = () => Promise.resolve({ data: null, error: { code: '42501', message: 'permission denied for table bookings' } })
const supabaseCheRiesce = () => Promise.resolve({ data: null, error: null })
const supabaseSenzaRete = () => Promise.reject(new TypeError('Failed to fetch'))

test('pezzo 1 — conferma: con errore di Supabase la prenotazione resta in_attesa e compare «Non salvato, riprova»', async () => {
  let booking = { id: 'b1', status: 'in_attesa' }
  let groupBookings = [{ id: 'b1', status: 'in_attesa' }, { id: 'b2', status: 'in_attesa' }]
  const messaggio = await scriviPoiAggiorna(supabaseCheRifiuta, () => {
    booking = { ...booking, status: 'confermata' }
    groupBookings = groupBookings.map(g => ({ ...g, status: 'confermata' }))
  })
  assert.equal(messaggio, MESSAGGIO_NON_SALVATO)
  assert.equal(booking.status, 'in_attesa')
  assert.deepEqual(groupBookings.map(g => g.status), ['in_attesa', 'in_attesa'])
})

test('pezzo 1 — conferma: senza errore la prenotazione diventa confermata e non c\'è messaggio', async () => {
  let booking = { id: 'b1', status: 'in_attesa' }
  const messaggio = await scriviPoiAggiorna(supabaseCheRiesce, () => { booking = { ...booking, status: 'confermata' } })
  assert.equal(messaggio, null)
  assert.equal(booking.status, 'confermata')
})

test('pezzo 2 — segna come pagato: con errore resta non pagato e compare il messaggio', async () => {
  let booking = { id: 'b1', bonifico: true, pagato: false }
  const messaggio = await scriviPoiAggiorna(supabaseCheRifiuta, () => { booking = { ...booking, pagato: true } })
  assert.equal(messaggio, MESSAGGIO_NON_SALVATO)
  assert.equal(booking.pagato, false)
})

test('pezzo 2 — segna come pagato: senza errore diventa pagato', async () => {
  let booking = { id: 'b1', bonifico: true, pagato: false }
  assert.equal(await scriviPoiAggiorna(supabaseCheRiesce, () => { booking = { ...booking, pagato: true } }), null)
  assert.equal(booking.pagato, true)
})

test('senza rete (eccezione di fetch) niente catch silenzioso: messaggio con «nessuna connessione», stato invariato', async () => {
  let cambiato = false
  const messaggio = await scriviPoiAggiorna(supabaseSenzaRete, () => { cambiato = true })
  assert.equal(messaggio, `${MESSAGGIO_NON_SALVATO}: nessuna connessione`)
  assert.equal(cambiato, false)
})

test('una risposta senza campo error (undefined) conta come riuscita, una con error valorizzato no', async () => {
  let n = 0
  assert.equal(await scriviPoiAggiorna(() => Promise.resolve(undefined), () => { n++ }), null)
  assert.equal(await scriviPoiAggiorna(() => Promise.resolve({ error: new Error('boom') }), () => { n++ }), MESSAGGIO_NON_SALVATO)
  assert.equal(n, 1)
})

test('messaggioNonSalvato distingue la rete dagli altri errori', () => {
  assert.equal(messaggioNonSalvato({ message: 'Tempo scaduto: il server non ha risposto entro 30 secondi' }), `${MESSAGGIO_NON_SALVATO}: nessuna connessione`)
  assert.equal(messaggioNonSalvato({ message: 'Load failed' }), `${MESSAGGIO_NON_SALVATO}: nessuna connessione`)
  assert.equal(messaggioNonSalvato({ message: 'new row violates row-level security policy' }), MESSAGGIO_NON_SALVATO)
  assert.equal(messaggioNonSalvato(null), MESSAGGIO_NON_SALVATO)
})
