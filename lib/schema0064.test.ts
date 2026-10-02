import { test } from 'node:test'
import assert from 'node:assert/strict'
import { esitoSonda, sonda, oraBreve, minutiDa, oraValida, oraPerSql } from './schema0064.ts'

test('colonna o tabella assente = «no»; rete, permessi e server = «errore», mai nascosti', () => {
  assert.equal(esitoSonda(null), 'si')
  for (const code of ['42703', 'PGRST204', '42P01', 'PGRST205']) assert.equal(esitoSonda({ code }), 'no')
  for (const code of ['42501', 'PGRST301', '', undefined, '57014']) assert.equal(esitoSonda({ code, message: 'x' }), 'errore')
})

test('la sonda chiede una riga con le colonne nuove; un\'eccezione di rete è «errore»', async () => {
  const chieste: string[] = []
  const client = (errore: unknown, lancia = false) => ({ from: (t: string) => ({ select: (c: string) => ({ limit: async () => { chieste.push(`${t}:${c}`); if (lancia) throw new Error('rete'); return { error: errore as never } } }) }) })
  assert.equal(await sonda(client(null), 'orari'), 'si')
  assert.equal(await sonda(client({ code: '42703' }), 'altro'), 'no')
  assert.equal(await sonda(client({ code: 'PGRST205' }), 'lavanderia'), 'no')
  assert.equal(await sonda(client(null, true), 'oraPulizia'), 'errore')
  assert.deepEqual(chieste, ['bookings:bagagli_alle,check_out_time', 'pulizie_fuori_camera:cosa', 'prezzi_lavanderia:pezzo,prezzo', 'cleanings:ora_effettiva'])
})

test('ore: dal database «11:00:00» → «11:00», scritte a mano → «09:05»', () => {
  assert.equal(oraBreve('11:00:00'), '11:00')
  assert.equal(oraBreve('09:05:00'), '9:05')
  assert.equal(oraBreve(null), null)
  assert.equal(oraBreve('25:00'), null)
  assert.equal(minutiDa('16:30:00'), 990)
  assert.ok(oraValida('9:05') && oraValida('21:30') && !oraValida('9') && !oraValida('24:00') && !oraValida('9:5'))
  assert.equal(oraPerSql('9:05'), '09:05')
})
