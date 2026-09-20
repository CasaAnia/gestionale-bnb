import { test } from 'node:test'
import assert from 'node:assert/strict'
import { importoProposto, importoInCent, oltreIlDovuto, modoProposto, MODI_PAGAMENTO,
  modoIniziale, residuoPrevisto, ricevutiCentDi, CONTO_CAMBIATO, OLTRE_IL_TOTALE_FOGLIO,
  RESTA_DA_INCASSARE, MODO_SALDO, MODO_ALTRO, SPIEGA_SALDO, SPIEGA_ALTRO, DOPO_IL_PAGAMENTO_RESTA, RESIDUO_SCONOSCIUTO,
  ESITO_SALDATO, ESITO_PARTE, ESITO_MANCA_IMPORTO,
  descrizionePagamento, restaSenzaCent, restaSenza, bollinoDaTogliere, TITOLO_TOGLI_PAGAMENTO, TOGLI_PAGAMENTO, COMANDO_TOGLI,
} from './pagamentoFoglio.ts'

test('nel campo «Quanto» c’è già quello che manca, col punto se non è tondo', () => {
  assert.equal(importoProposto(25000), '250')
  assert.equal(importoProposto(6250), '62.50')
  assert.equal(importoProposto(0), '')
  assert.equal(importoProposto(-500), '')
  assert.equal(importoProposto(NaN), '')
})

test('l’importo scritto si legge con la virgola e col punto, mai zero, negativo, con tre decimali o strano', () => {
  assert.equal(importoInCent('62,50'), 6250)
  assert.equal(importoInCent('62.50'), 6250)
  assert.equal(importoInCent(' 250 '), 25000)
  assert.equal(importoInCent('400,5'), 40050)
  assert.equal(importoInCent('0'), null)
  assert.equal(importoInCent('0,00'), null)
  assert.equal(importoInCent('-3'), null)
  assert.equal(importoInCent(''), null)
  assert.equal(importoInCent('   '), null)
  assert.equal(importoInCent('abc'), null)
  // mai arrotondare di nascosto: tre decimali non si accettano
  assert.equal(importoInCent('400,555'), null)
  assert.equal(importoInCent('400.555'), null)
  // niente notazioni da calcolatrice, segni, spazi in mezzo, due virgole
  assert.equal(importoInCent('1e3'), null)
  assert.equal(importoInCent('+400'), null)
  assert.equal(importoInCent('4 00'), null)
  assert.equal(importoInCent('1.080,00'), null)
  assert.equal(importoInCent('400,'), null)
})

// ── Il foglio approvato da Ania (punto 5, 20/09/2026 sera) ──────────────────
test('le parole del foglio approvato', () => {
  assert.equal(RESTA_DA_INCASSARE, 'Resta da incassare')
  assert.equal(MODO_SALDO, 'Saldo completo')
  assert.equal(MODO_ALTRO, 'Altro importo')
  assert.equal(SPIEGA_SALDO, 'Saldo dell’intero importo residuo.')
  assert.equal(SPIEGA_ALTRO, 'Scrivi quanto hai effettivamente ricevuto.')
  assert.equal(DOPO_IL_PAGAMENTO_RESTA, 'Dopo il pagamento resta')
  assert.equal(RESIDUO_SCONOSCIUTO, '—')
  assert.equal(ESITO_SALDATO, 'Il conto sarà saldato.')
  assert.equal(ESITO_PARTE, 'Il pagamento coprirà una parte del saldo.')
  assert.equal(ESITO_MANCA_IMPORTO, 'Inserisci l’importo ricevuto.')
})

test('all’apertura con un residuo positivo è «Saldo completo», altrimenti «Altro importo»', () => {
  assert.equal(modoIniziale(108000), 'saldo')
  assert.equal(modoIniziale(1), 'saldo')
  assert.equal(modoIniziale(0), 'altro')
  assert.equal(modoIniziale(-2000), 'altro')
})

test('«Dopo il pagamento resta»: il caso approvato 1.080 − 400 = 680, i centesimi, il saldo, l’oltre', () => {
  // senza importo: «—» e si chiede l'importo
  assert.deepEqual(residuoPrevisto(108000, null), { cifra: '—', esito: ESITO_MANCA_IMPORTO, oltre: null })
  // saldo completo: 1.080 → 0 €, «Il conto sarà saldato.»
  assert.deepEqual(residuoPrevisto(108000, 108000), { cifra: '0 €', esito: ESITO_SALDATO, oltre: null })
  // altro importo, l'esempio approvato: 400 → 680 €
  assert.deepEqual(residuoPrevisto(108000, 40000), { cifra: '680 €', esito: ESITO_PARTE, oltre: null })
  // i centesimi non si perdono: 400,50 → 679,50 €
  assert.deepEqual(residuoPrevisto(108000, importoInCent('400,50')), { cifra: '679,50 €', esito: ESITO_PARTE, oltre: null })
  // oltre il residuo: 0 € ma con l'avviso, mai lo zero da solo
  assert.deepEqual(residuoPrevisto(108000, 110000), { cifra: '0 €', esito: '', oltre: 'Sono 20 € più di quello che manca. Si può salvare lo stesso.' })
  // conto già saldato (residuo zero) e si registra lo stesso un importo
  assert.deepEqual(residuoPrevisto(0, 3000), { cifra: '0 €', esito: '', oltre: 'Il conto è già saldato: questo pagamento va oltre il dovuto. Si può salvare lo stesso.' })
  // pagamenti già oltre il totale (residuo negativo): l'oltre parte da zero
  assert.equal(residuoPrevisto(-500, 1000).oltre, 'Il conto è già saldato: questo pagamento va oltre il dovuto. Si può salvare lo stesso.')
  assert.equal(OLTRE_IL_TOTALE_FOGLIO(500), '5 € ricevuti oltre il totale: controlla i pagamenti.')
})

test('il conto cambiato mentre il foglio era aperto: i ricevuti dai pagamenti riletti, e l’avviso', () => {
  const riletti = [{ booking_id: 'a', amount: 400 }, { booking_id: 'a', amount: '400' }, { booking_id: 'z', amount: 999 }]
  assert.equal(ricevutiCentDi(['a', 'b'], riletti), 80000)
  assert.equal(ricevutiCentDi(['b'], riletti), 0)
  assert.equal(CONTO_CAMBIATO(68000), 'Il conto è cambiato mentre il foglio era aperto: ora resta da incassare 680 €. Controlla l’importo e salva di nuovo.')
  assert.equal(CONTO_CAMBIATO(-1000), 'Il conto è cambiato mentre il foglio era aperto: ora resta da incassare 0 €. Controlla l’importo e salva di nuovo.')
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
