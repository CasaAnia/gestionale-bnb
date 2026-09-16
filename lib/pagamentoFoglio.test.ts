import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importoProposto, importoInCent, restaDopo, oltreIlDovuto, modoProposto, CONTO_SALDATO_DOPO, MODI_PAGAMENTO } from './pagamentoFoglio.ts'

test('nel campo «Quanto» c’è già quello che manca, col punto se non è tondo', () => {
  assert.equal(importoProposto(25000), '250')
  assert.equal(importoProposto(6250), '62.50')
  assert.equal(importoProposto(0), '')
  assert.equal(importoProposto(-500), '')
  assert.equal(importoProposto(NaN), '')
})

test('l’importo scritto si legge con la virgola e col punto, mai zero o negativo', () => {
  assert.equal(importoInCent('62,50'), 6250)
  assert.equal(importoInCent('62.50'), 6250)
  assert.equal(importoInCent(' 250 '), 25000)
  assert.equal(importoInCent('0'), null)
  assert.equal(importoInCent('-3'), null)
  assert.equal(importoInCent(''), null)
  assert.equal(importoInCent('abc'), null)
})

test('sotto i campi si legge quanto resterà da incassare, in ottone', () => {
  assert.equal(restaDopo(25000, 10000), 'Dopo questo pagamento restano da incassare 150 €.')
  assert.equal(restaDopo(25000, 25000), CONTO_SALDATO_DOPO)
  assert.equal(restaDopo(25000, 30000), CONTO_SALDATO_DOPO)
  assert.equal(restaDopo(6250, 1000), 'Dopo questo pagamento restano da incassare 52,50 €.')
  assert.equal(restaDopo(25000, null), '')
})

test('oltre il dovuto si avvisa in mattone, ma non si blocca', () => {
  assert.equal(oltreIlDovuto(25000, 10000), null)
  assert.equal(oltreIlDovuto(25000, 25000), null)
  assert.equal(oltreIlDovuto(25000, 30000), 'Sono 50 € più di quello che manca. Si può salvare lo stesso.')
  assert.equal(oltreIlDovuto(0, 3000), 'Il conto è già saldato: questo pagamento va oltre il dovuto. Si può salvare lo stesso.')
  assert.equal(oltreIlDovuto(25000, null), null)
})

test('due modi soltanto, e il bonifico proposto quando l’accordo lo aspetta', () => {
  assert.deepEqual(MODI_PAGAMENTO.map(m => m.testo), ['Contanti', 'Bonifico'])
  assert.equal(modoProposto(true), 'bonifico')
  assert.equal(modoProposto(false), 'contanti')
  assert.equal(modoProposto(null), 'contanti')
})
