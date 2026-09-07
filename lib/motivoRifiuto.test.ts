// «Rifiuta con motivo» (07/09/2026): codici, parole e lettura dei valori vecchi.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MOTIVI_RIFIUTO_SCELTE, normalizzaMotivoRifiuto, motivoRifiutoInParole } from './motivoRifiuto.ts'
import { rigaChiusa } from './richieste.ts'

test('quattro bottoni nell’ordine chiesto da Ania', () => {
  assert.deepEqual(MOTIVI_RIFIUTO_SCELTE.map(s => s.testo), ['Non ha risposto', 'Ha detto di no', 'L’ho data a un altro', 'Altro motivo'])
  assert.deepEqual(MOTIVI_RIFIUTO_SCELTE.map(s => s.codice), ['non_risposto', 'detto_no', 'data_ad_altro', 'altro'])
})

test('i codici passano intatti, i testi vecchi diventano un codice, senza motivo → null', () => {
  assert.equal(normalizzaMotivoRifiuto('detto_no'), 'detto_no')
  assert.equal(normalizzaMotivoRifiuto('Non ha più risposto'), 'non_risposto')
  assert.equal(normalizzaMotivoRifiuto('date assegnate a altro cliente'), 'data_ad_altro')
  assert.equal(normalizzaMotivoRifiuto('Completo'), 'altro')
  assert.equal(normalizzaMotivoRifiuto('Prezzo'), 'altro')
  assert.equal(normalizzaMotivoRifiuto('  '), null)
  assert.equal(normalizzaMotivoRifiuto(null), null)
  assert.equal(normalizzaMotivoRifiuto(undefined), null)
})

test('motivo in parole per la linguetta Chiuse', () => {
  assert.equal(motivoRifiutoInParole('detto_no'), 'ha detto di no')
  assert.equal(motivoRifiutoInParole('data_ad_altro'), 'data a un altro')
  assert.equal(motivoRifiutoInParole('non_risposto'), 'non ha risposto')
  assert.equal(motivoRifiutoInParole('Prezzo'), 'altro motivo')
  assert.equal(motivoRifiutoInParole(null), null)
})

test('riga Chiuse: «Rifiutata da te · ha detto di no · 4 set»; senza motivo come prima; la scaduta non cambia', () => {
  const adesso = new Date(2026, 8, 6, 9, 0)
  const chiusaAt = new Date(2026, 8, 4, 10, 0).toISOString()
  assert.deepEqual(rigaChiusa({ stato: 'chiusa', chiusura_motivo: 'rifiutata', chiusa_at: chiusaAt, motivo_rifiuto: 'detto_no' }, adesso), { testo: 'Rifiutata da te · ha detto di no · 4 set', tono: 'grigio' })
  assert.deepEqual(rigaChiusa({ stato: 'rifiutata', chiusa_at: chiusaAt, motivo_rifiuto: 'Non ha più risposto' }, adesso), { testo: 'Rifiutata da te · non ha risposto · 4 set', tono: 'grigio' })
  assert.deepEqual(rigaChiusa({ stato: 'chiusa', chiusura_motivo: 'rifiutata', chiusa_at: chiusaAt, motivo_rifiuto: null }, adesso), { testo: 'Rifiutata da te · 4 set', tono: 'grigio' })
  assert.equal(rigaChiusa({ stato: 'chiusa', chiusura_motivo: 'scaduta', chiusa_at: chiusaAt, motivo_rifiuto: null }, adesso).tono, 'ottone')
})
