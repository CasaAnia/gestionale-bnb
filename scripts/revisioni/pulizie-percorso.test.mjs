import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { databasePulizieFinto } from './pulizie-db-finto.mjs'
import { eseguiOperazionePulizia } from '../../lib/pulizieOperazioni.ts'
import { vuoto } from '../../lib/biancheria.ts'
import { cicloCambio } from '../../lib/pulizie.ts'
import { resocontoPulizie } from '../../lib/pulizieResoconto.ts'

test('percorso integrato: custodia reale → SQL vera → rilettura → due correzioni → cadenza e report', async () => {
  const rooms = [{ id: randomUUID(), name: 'Camera prova' }]
  const b = { id: randomUUID(), room_id: rooms[0].id, guest_id: 'prova', check_in: '2026-01-01', check_out: '2026-02-01', num_guests: 3, status: 'confermata' }
  const db = await databasePulizieFinto(rooms, [b], [])
  const memoria = new Map()
  const dispositivo = () => ({ getItem: k => memoria.get(k) ?? null, setItem: (k, v) => memoria.set(k, v), removeItem: k => memoria.delete(k) })
  const trasporto = async (id, r) => {
    try { return { data: (await db.query('select gestisci_pulizia($1,$2::jsonb) as r', [id, JSON.stringify(r)])).rows[0].r, error: null } }
    catch (e) { return { data: null, error: { code: e.code, message: e.message } } }
  }
  const righe = async tabella => (await db.query(`select row_to_json(r) as r from ${tabella} r order by created_at,id`)).rows.map(x => x.r)
  const invia = r => eseguiOperazionePulizia(b.room_id, r, dispositivo(), trasporto, randomUUID)
  const pulizia = { room_id: b.room_id, booking_id: b.id, tipo: 'soggiorno', stato: 'rimandata', data_prevista: '2026-01-05', prossima_data: '2026-01-06', persone_servite: 3 }
  try {
    const rinvio = await invia({ azione: 'registra', ultima_id: null, pulizia, recupero: null })
    assert.equal(rinvio.errore, null)
    const r2 = await invia({ azione: 'registra', ultima_id: rinvio.risposta.pulizia.id, pulizia: { ...pulizia, data_prevista: '2026-01-06', prossima_data: '2026-01-08' }, recupero: null })
    assert.equal(r2.errore, null)
    const richiesta = { azione: 'registra', ultima_id: r2.risposta.pulizia.id, pulizia: { ...pulizia, stato: 'fatta', data_prevista: '2026-01-08', prossima_data: null, data_effettiva: '2026-01-09' }, recupero: { ...vuoto(), telo_doccia: 3, asciugamano_viso: 3, asciugamano_mani: 3 } }
    const perso = await eseguiOperazionePulizia(b.room_id, richiesta, dispositivo(), async (id, r) => { const esito = await trasporto(id, r); assert.equal(esito.error, null); throw new Error('risposta persa dopo commit') }, randomUUID)
    assert.ok(perso.errore)
    // Ricrea l'accesso al dispositivo senza cancellare memoria né database.
    const ripreso = await eseguiOperazionePulizia(b.room_id, null, dispositivo(), trasporto, randomUUID)
    assert.equal(ripreso.errore, null)
    assert.equal((await righe('cleanings')).filter(e => e.stato === 'fatta').length, 1)
    assert.equal(cicloCambio([b], b, await righe('cleanings')).due, '2026-01-13')
    for (const federe of [1, 2]) {
      const attuale = (await righe('biancheria_recuperata'))[0]
      const r = await invia({ azione: 'recupero', cleaning_id: attuale.cleaning_id, versione: attuale.updated_at, recupero: { ...richiesta.recupero, federe } })
      assert.equal(r.errore, null)
      assert.equal((await righe('biancheria_recuperata'))[0].federe, federe)
    }
    const report = resocontoPulizie(rooms, [b], await righe('cleanings'), await righe('biancheria_recuperata'), '2026-01-01', '2026-02-01', '2026-02-02')
    assert.equal(report.pezzi, 11); assert.equal(report.fatte.length, 1)
    assert.equal(report.spostate.length, 1); assert.equal(report.numeroRinvii, 2); assert.equal(report.rinvioMedio, 3)
    assert.equal(report.recuperati[0].data, '2026-01-09')
    assert.equal((await invia(null)).risposta, null)
  } finally { await db.close() }
})
