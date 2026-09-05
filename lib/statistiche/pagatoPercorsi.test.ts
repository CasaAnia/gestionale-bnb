// R2 e R3 (revisione Codex di f4d5474) — controprove sul codice delle pagine:
//  - nessuna azione della UI porta pagato = true senza passare da
//    eseguiSegnaPagato (che registra il movimento): l'unico update con
//    pagato: true sta nel segnaFlag della scheda prenotazione, il modulo
//    Modifica non ha più editForm.pagato e non invia pagato a bookings;
//  - la data di oggi nelle scritture non viene mai da toISOString (Roma dopo
//    mezzanotte darebbe il giorno prima): si usa oggiARoma.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { oggiARoma } from '../spese/adattatore.ts'
import { movimentoSaldo } from './pagato.ts'

const scheda = readFileSync(new URL('../../app/prenotazioni/[id]/page.tsx', import.meta.url), 'utf8')
const nuova = readFileSync(new URL('../../app/nuova/page.tsx', import.meta.url), 'utf8')

test('R2: nessun percorso diretto a pagato = true fuori da Segna come pagato', () => {
  assert.equal((scheda.match(/pagato: true/g) ?? []).length, 3, 'attesi solo il flag del ripiego (update su tutti i segmenti) e i due aggiornamenti locali dopo l\'esito')
  assert.ok(scheda.includes("supabase.from('bookings').update({ pagato: true }).in('id', ids).select('id')"))
  assert.ok(scheda.includes("setGroupBookings(gs => gs.map((g: { pagato?: boolean }) => ({ ...g, pagato: true })))"))
  assert.equal(scheda.includes('editForm.pagato'), false)
  assert.equal(scheda.includes('pagato: editForm'), false)
  assert.equal(nuova.includes('pagato: true'), false)
  assert.ok(nuova.includes('pagato: false'))
})

test('R3: niente toISOString().split nelle pagine di prenotazione; alle 00:30 di Roma il movimento porta la data di Roma', () => {
  assert.equal(scheda.includes("toISOString().split('T')[0]"), false)
  assert.equal(nuova.includes("toISOString().split('T')[0]"), false)
  // 5 settembre 2026, 22:30 UTC = 6 settembre 00:30 a Roma (ora legale)
  const oggi = oggiARoma(new Date('2026-09-05T22:30:00Z'))
  assert.equal(oggi, '2026-09-06')
  const m = movimentoSaldo([{ id: 'a', room_id: 'r1', check_in: '2026-09-01', check_out: '2026-09-03', total_amount: 160, status: 'confermata' }], [], oggi, 'contanti', 'a')
  assert.equal(m?.paid_on, '2026-09-06')
  // in inverno (ora solare): 23:30 UTC del 5 gennaio = 00:30 del 6 a Roma
  assert.equal(oggiARoma(new Date('2027-01-05T23:30:00Z')), '2027-01-06')
})
