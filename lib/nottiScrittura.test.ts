// Spostare le notti: o tutto, o niente (rilievo 2 del 15/09/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { salvaNottiInUnColpo, righeDaCreare, manca0053, SERVE_LA_0053, MOTIVO_ANNULLA } from './nottiScrittura.ts'
import type { PianoNotti } from './strisciaNotti.ts'

const piano = (): PianoNotti => ({
  aggiorna: [{ id: 'a', campi: { room_id: 'lena', check_in: '2026-10-01', check_out: '2026-10-03', num_guests: 2, extra_bed: false, extra_bed_dates: [], price_per_night: 80, extra_bed_total: 0, total_amount: 160 } }],
  crea: [{ room_id: 'ambra', check_in: '2026-10-03', check_out: '2026-10-05', num_guests: 2, extra_bed: false, extra_bed_dates: [], price_per_night: 80, extra_bed_total: 0, total_amount: 160 }],
  annulla: ['vecchia'],
  errore: null,
})
const comuni = { guest_id: 'anna', status: 'confermata', bonifico: false }
const arrivoDi = (checkIn: string) => (checkIn === '2026-10-01' ? { check_in_time: '15:00' } : {})

test('manda aggiorna, crea e annulla in una sola chiamata', async () => {
  const visti: Record<string, unknown>[] = []
  const esito = await salvaNottiInUnColpo(piano(), 'gruppo-1', comuni, arrivoDi, async dati => {
    visti.push(dati)
    return { data: { aggiornate: 1, create: [{ id: 'nuova', check_in: '2026-10-03' }], annullate: 1 }, error: null }
  })
  assert.equal(visti.length, 1, 'tre richieste separate invece di una')
  assert.equal(esito.esito, 'ok')
  assert.deepEqual(esito.esito === 'ok' && esito.create, [{ id: 'nuova', check_in: '2026-10-03' }])
  const dati = visti[0]
  assert.equal((dati.p_aggiorna as { campi: { group_id: string } }[])[0].campi.group_id, 'gruppo-1')
  assert.deepEqual(dati.p_annulla, ['vecchia'])
  assert.equal(dati.p_motivo, MOTIVO_ANNULLA)
})

test('le righe nuove portano i campi comuni e l’arrivo dove tocca', () => {
  const righe = righeDaCreare(piano(), { ...comuni, group_id: 'g' }, arrivoDi)
  assert.equal(righe.length, 1)
  assert.equal(righe[0].guest_id, 'anna')
  assert.equal(righe[0].group_id, 'g')
  assert.equal(righe[0].room_id, 'ambra')
  assert.equal(righe[0].check_in_time, undefined, 'questa non è la prima notte')
  // la riga che arriva per prima si porta orario e navetta
  const primaNotte = righeDaCreare(
    { ...piano(), crea: [{ ...piano().crea[0], check_in: '2026-10-01' }] }, comuni, arrivoDi,
  )
  assert.equal(primaNotte[0].check_in_time, '15:00')
})

test('se la funzione non c’è, NON si salva a pezzi: si dice che manca', async () => {
  const esito = await salvaNottiInUnColpo(piano(), 'g', comuni, arrivoDi, async () => ({
    data: null, error: { code: 'PGRST202', message: 'Could not find the function public.sposta_notti in the schema cache' },
  }))
  assert.equal(esito.esito, 'errore')
  assert.equal(esito.esito === 'errore' && esito.messaggio, SERVE_LA_0053)
  assert.match(SERVE_LA_0053, /a pezzi/)
})

test('un errore della transazione non lascia niente a metà', async () => {
  const esito = await salvaNottiInUnColpo(piano(), 'g', comuni, arrivoDi, async () => ({
    data: null, error: { message: 'quelle notti sono appena state prese da un\'altra prenotazione' },
  }))
  assert.equal(esito.esito, 'errore')
  // il messaggio del database arriva fino ad Ania
  assert.match(esito.esito === 'errore' ? esito.messaggio : '', /appena state prese|Non salvato/)
})

test('anche un’eccezione è un errore, non un salvataggio riuscito', async () => {
  const esito = await salvaNottiInUnColpo(piano(), 'g', comuni, arrivoDi, async () => { throw new Error('caduta') })
  assert.equal(esito.esito, 'errore')
})

test('riconosce la funzione mancante dai suoi codici', () => {
  assert.equal(manca0053({ code: 'PGRST202' }), true)
  assert.equal(manca0053({ code: '42883' }), true)
  assert.equal(manca0053({ message: 'function public.sposta_notti does not exist' }), true)
  assert.equal(manca0053({ code: '23514' }), false)
})

test('la proposta 0053 è una transazione e ricontrolla la disponibilità', () => {
  const sql = readFileSync(new URL('../supabase/proposte/0053_notti_in_un_colpo.BOZZA.sql', import.meta.url), 'utf8')
  assert.match(sql, /create or replace function public\.sposta_notti/)
  assert.match(sql, /get diagnostics toccate = row_count/)
  assert.match(sql, /raise exception 'il tratto % non c''è più/)
  // il controllo delle sovrapposizioni, dentro la stessa transazione
  assert.match(sql, /daterange\(a\.check_in, a\.check_out, '\[\)'\) && daterange\(b\.check_in, b\.check_out, '\[\)'\)/)
  assert.match(sql, /appena state prese/)
  assert.match(sql, /security invoker/)
  // e le prove di concorrenza sono scritte
  assert.match(sql, /PROVA DI CONCORRENZA/)
  assert.match(sql, /PROVA DEL GUASTO A METÀ/)
})
