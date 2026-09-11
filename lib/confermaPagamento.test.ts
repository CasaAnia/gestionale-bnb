import { test } from 'node:test'
import assert from 'node:assert/strict'
import { testoConfermaPagamento, importoItaliano } from './confermaPagamento.ts'

test('conferma pagamento: quanto, come e quanto resta', () => {
  assert.equal(testoConfermaPagamento(50, 'contanti', 11000), 'Registrati 50 € in contanti · restano 110 €')
  assert.equal(testoConfermaPagamento(110, 'bonifico', 0), 'Registrati 110 € con bonifico · soggiorno saldato')
  // Importi con i centesimi, all'italiana; un saldo negativo (movimenti oltre
  // il totale) non scrive un resto in meno: il soggiorno è comunque coperto
  assert.equal(testoConfermaPagamento(62.5, 'contanti', 9750), 'Registrati 62,50 € in contanti · restano 97,50 €')
  assert.equal(testoConfermaPagamento(200, 'contanti', -500), 'Registrati 200 € in contanti · soggiorno saldato')
})

test('importi scritti all\'italiana', () => {
  assert.equal(importoItaliano(400), '400')
  // Come il resto del gestionale (lo stesso `toLocaleString('it-IT')`): le
  // migliaia a quattro cifre restano attaccate, dalle cinque si separano
  assert.equal(importoItaliano(1460), '1460')
  assert.equal(importoItaliano(12460), '12.460')
  assert.equal(importoItaliano(62.5), '62,50')
})
