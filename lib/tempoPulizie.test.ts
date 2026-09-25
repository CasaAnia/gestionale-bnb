import { test } from 'node:test'
import assert from 'node:assert/strict'
import { secondiTrascorsi, fermaCronometro, minutiCronometro } from './tempoPulizie.ts'
test('timer: riapertura, pausa e ripresa non perdono o duplicano il tempo', () => {
 const avvio = { trascorsi: 0, avviato: 1000 }
 assert.equal(secondiTrascorsi(JSON.parse(JSON.stringify(avvio)), 91000), 90)
 const pausa = fermaCronometro(avvio, 91000)
 assert.equal(secondiTrascorsi(pausa, 200000), 90)
 const ripreso = { ...pausa, avviato: 200000 }
 assert.equal(secondiTrascorsi(ripreso, 230000), 120)
 assert.equal(minutiCronometro(ripreso, 230000), 2)
 assert.deepEqual(fermaCronometro(pausa, 500000), pausa)
})
