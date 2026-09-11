// Il testo archiviato si aggiorna SOLO quando cambiano i soli segni del
// grassetto: le parole lette dal cliente non si riscrivono mai.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testoDaRigenerare } from './testoArchiviato.ts'

const VECCHIO = 'Dal 29 al 31 ottobre, per tre persone, posso proporle tre camere:\n\n– Lena, una camera tripla. Il prezzo per le due notti è di 180 €.'
const NUOVO = '*Dal 29 al 31 ottobre, per tre persone*, posso proporle tre camere:\n\n– *Lena*, una camera tripla. Il prezzo per le due notti è di *180 €*.'

test('stesse parole, cambia solo il grassetto: si aggiorna', () => {
  assert.equal(testoDaRigenerare(VECCHIO, NUOVO), true)
})

test('parole diverse: il testo archiviato non si tocca', () => {
  // Ania l'ha riscritto a mano
  assert.equal(testoDaRigenerare(VECCHIO + '\n\nLa aspetto!', NUOVO), false)
  // è cambiato un prezzo
  assert.equal(testoDaRigenerare(VECCHIO, NUOVO.replace('180 €', '190 €')), false)
  // è cambiata una camera
  assert.equal(testoDaRigenerare(VECCHIO, NUOVO.replace('Lena', 'Ambra')), false)
})

test('niente da fare quando i due testi sono già uguali o mancano', () => {
  assert.equal(testoDaRigenerare(NUOVO, NUOVO), false)
  assert.equal(testoDaRigenerare(null, NUOVO), false)
  assert.equal(testoDaRigenerare(VECCHIO, null), false)
  assert.equal(testoDaRigenerare('', ''), false)
})

test('vale anche per il corsivo', () => {
  assert.equal(testoDaRigenerare('parola', '_parola_'), true)
})
