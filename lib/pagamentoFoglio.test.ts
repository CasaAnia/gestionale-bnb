import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importoProposto, importoInCent, restaDopo, oltreIlDovuto, modoProposto, CONTO_SALDATO_DOPO, MODI_PAGAMENTO,
  descrizionePagamento, restaSenzaCent, restaSenza, bollinoDaTogliere, TITOLO_TOGLI_PAGAMENTO, TOGLI_PAGAMENTO, COMANDO_TOGLI,
} from './pagamentoFoglio.ts'

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

// ── «Togli pagamento» (17/09/2026) ──────────────────────────────────────────
test('il foglio «Togli pagamento» dice cosa si toglie: importo, giorno e modo, nota', () => {
  assert.equal(TITOLO_TOGLI_PAGAMENTO, 'Togli pagamento')
  assert.equal(TOGLI_PAGAMENTO, 'Togli il pagamento')
  assert.equal(COMANDO_TOGLI, 'togli')
  assert.deepEqual(descrizionePagamento({ id: 'p', amount: 470, method: 'contanti', paid_on: '2026-09-12', note: ' all’arrivo ' }),
    { importo: '470 €', quando: '12 set 2026 · contanti', nota: 'all’arrivo' })
  assert.deepEqual(descrizionePagamento({ id: 'p', amount: '62.5', method: 'bonifico', paid_on: null }),
    { importo: '62,50 €', quando: 'bonifico', nota: '' })
})

test('quanto resta da incassare senza quel pagamento, e se il bollino «pagato» va tolto', () => {
  // totale 470, ricevuti 470, tolgo 470 → restano 470
  assert.equal(restaSenzaCent(47000, 47000, 47000), 47000)
  assert.equal(restaSenza(47000, 47000, 47000), 'Senza questo pagamento restano da incassare 470 €.')
  // totale 300, ricevuti 500 (oltre il dovuto), tolgo 150 → ancora saldato
  assert.equal(restaSenzaCent(30000, 50000, 15000), 0)
  assert.equal(restaSenza(30000, 50000, 15000), 'Senza questo pagamento il conto resta saldato.')
  // il bollino va tolto solo se era pagata e senza resta qualcosa
  assert.equal(bollinoDaTogliere(true, 47000, 47000, 47000), true)
  assert.equal(bollinoDaTogliere(false, 47000, 47000, 47000), false)
  assert.equal(bollinoDaTogliere(true, 30000, 50000, 15000), false)
})
