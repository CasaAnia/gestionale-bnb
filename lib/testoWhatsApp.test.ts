import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pezziWhatsApp } from './testoWhatsApp.ts'

const G = (testo: string) => ({ testo, grassetto: true, corsivo: false })
const N = (testo: string) => ({ testo, grassetto: false, corsivo: false })
const C = (testo: string) => ({ testo, grassetto: false, corsivo: true })

test('il grassetto: *…* diventa un pezzo in grassetto, gli asterischi spariscono', () => {
  assert.deepEqual(pezziWhatsApp('– *Lena*, una camera tripla'), [N('– '), G('Lena'), N(', una camera tripla')])
  assert.deepEqual(pezziWhatsApp('è di *180 €*, a 90 € a notte'), [N('è di '), G('180 €'), N(', a 90 € a notte')])
  assert.deepEqual(pezziWhatsApp('*Dal 29 al 31 ottobre, per tre persone*'), [G('Dal 29 al 31 ottobre, per tre persone')])
})

test('il corsivo con _…_, e i due si possono annidare', () => {
  assert.deepEqual(pezziWhatsApp('_piano_'), [C('piano')])
  assert.deepEqual(pezziWhatsApp('*_forte e piano_*'), [{ testo: 'forte e piano', grassetto: true, corsivo: true }])
})

test('un asterisco che non si chiude resta un asterisco', () => {
  assert.deepEqual(pezziWhatsApp('3 * 4 = 12'), [N('3 * 4 = 12')])
  assert.deepEqual(pezziWhatsApp('*mai chiuso'), [N('*mai chiuso')])
  // spazio attaccato al delimitatore: WhatsApp non fa il grassetto, noi neppure
  assert.deepEqual(pezziWhatsApp('* Lena*'), [N('* Lena*')])
  assert.deepEqual(pezziWhatsApp('*Lena *'), [N('*Lena *')])
  // la coppia non scavalca l'a capo
  assert.deepEqual(pezziWhatsApp('*prima\nseconda*'), [N('*prima\nseconda*')])
})

test('gli a capo e tutto il resto restano identici', () => {
  const testo = 'Gentile Anna,\ngrazie.\n\n– *Lena*, tripla.\ncasaaniarozzano.it/camere/lena'
  const pezzi = pezziWhatsApp(testo)
  assert.equal(pezzi.map(p => p.testo).join(''), testo.replace(/\*/g, ''))
  assert.deepEqual(pezzi, [N('Gentile Anna,\ngrazie.\n\n– '), G('Lena'), N(', tripla.\ncasaaniarozzano.it/camere/lena')])
})

test('testo vuoto o mancante: nessun pezzo', () => {
  assert.deepEqual(pezziWhatsApp(''), [])
  assert.deepEqual(pezziWhatsApp(null), [])
  assert.deepEqual(pezziWhatsApp(undefined), [])
})

test('più grassetti nella stessa riga', () => {
  assert.deepEqual(pezziWhatsApp('Mi faccia sapere *entro 3 ore* e le confermo *subito*.'),
    [N('Mi faccia sapere '), G('entro 3 ore'), N(' e le confermo '), G('subito'), N('.')])
})
