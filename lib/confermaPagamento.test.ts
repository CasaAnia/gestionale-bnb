import { test } from 'node:test'
import assert from 'node:assert/strict'
import { confermaPagamento, importoItaliano } from './confermaPagamento.ts'

test('conferma pagamento: due righe — quanto e come, poi quanto resta', () => {
  assert.deepEqual(confermaPagamento(10, 'contanti', 4000), { prima: 'Registrati 10 € in contanti', seconda: 'restano da avere 40 €' })
  assert.deepEqual(confermaPagamento(110, 'bonifico', 0), { prima: 'Registrati 110 € con bonifico', seconda: 'soggiorno saldato' })
  // Importi con i centesimi, all'italiana; un saldo negativo (movimenti oltre
  // il totale) non scrive un resto in meno: il soggiorno è comunque coperto
  assert.deepEqual(confermaPagamento(62.5, 'contanti', 9750), { prima: 'Registrati 62,50 € in contanti', seconda: 'restano da avere 97,50 €' })
  assert.equal(confermaPagamento(200, 'contanti', -500).seconda, 'soggiorno saldato')
})

test('importi scritti all\'italiana', () => {
  assert.equal(importoItaliano(400), '400')
  // Come il resto del gestionale (lo stesso `toLocaleString('it-IT')`): le
  // migliaia a quattro cifre restano attaccate, dalle cinque si separano
  assert.equal(importoItaliano(1460), '1460')
  assert.equal(importoItaliano(12460), '12.460')
  assert.equal(importoItaliano(62.5), '62,50')
})
