// ============================================================================
// IL SALVATAGGIO DEL PAGAMENTO NON RESTA APPESO (Ania, 29/09/2026: il
// pagamento di Ledi, Lena 27 → 29 set, 170 € contanti, rimasto su «Salvo…»).
// Limite di 10 secondi, poi l'avviso e «Salva» di nuovo attivo; prima di
// scrivere, niente doppione se un pagamento identico è nato da 2 minuti.
// Le prove sul salvataggio vero (Supabase finto) stanno in
// scripts/revisioni/pagamento-gemello.test.mjs.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { conLimite, pagamentoGemello, LIMITE_SALVATAGGIO_MS, FINESTRA_GEMELLO_MS, ERRORE_SALVATAGGIO_SCADUTO } from './pagamentoFoglio.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('il limite è di 10 secondi, la finestra del gemello di 2 minuti, il testo è quello di Ania', () => {
  assert.equal(LIMITE_SALVATAGGIO_MS, 10_000)
  assert.equal(FINESTRA_GEMELLO_MS, 120_000)
  assert.equal(ERRORE_SALVATAGGIO_SCADUTO, 'Non sono riuscita a salvare: controlla la connessione e riprova')
})

test('conLimite: la risposta in tempo passa, quella che non arriva scade, un errore passa com’è', async () => {
  assert.deepEqual(await conLimite(Promise.resolve(7), 50), { scaduto: false, valore: 7 })
  assert.deepEqual(await conLimite(new Promise(() => {}), 20), { scaduto: true })
  await assert.rejects(conLimite(Promise.reject(new Error('rete')), 50), /rete/)
})

test('pagamentoGemello: stesso importo, giorno e modo, nato da meno di 2 minuti', () => {
  const adesso = Date.parse('2026-09-29T12:55:00Z')
  const ledi = { id: 'm1', amount: 170, method: 'contanti', paid_on: '2026-09-29', created_at: '2026-09-29T12:54:27Z' }
  const dati = { importo: 170, metodo: 'contanti', giorno: '2026-09-29' }
  assert.equal(pagamentoGemello([ledi], dati, adesso)?.id, 'm1')
  // importo scritto come testo dal database, e al centesimo
  assert.equal(pagamentoGemello([{ ...ledi, amount: '170.00' }], dati, adesso)?.id, 'm1')
  // non è gemello: altro importo, altro modo, altro giorno, troppo vecchio, senza ora
  assert.equal(pagamentoGemello([{ ...ledi, amount: 169.99 }], dati, adesso), null)
  assert.equal(pagamentoGemello([{ ...ledi, method: 'bonifico' }], dati, adesso), null)
  assert.equal(pagamentoGemello([{ ...ledi, paid_on: '2026-09-28' }], dati, adesso), null)
  assert.equal(pagamentoGemello([{ ...ledi, created_at: '2026-09-29T12:52:59Z' }], dati, adesso), null)
  assert.equal(pagamentoGemello([{ ...ledi, created_at: null }], dati, adesso), null)
  // un telefono con l'orologio un po' indietro: il movimento sembra «nel futuro»
  assert.equal(pagamentoGemello([{ ...ledi, created_at: '2026-09-29T12:56:30Z' }], dati, adesso)?.id, 'm1')
})

test('il foglio mette il limite al salvataggio e dice l’errore invece di restare su «Salvo…»', () => {
  const foglio = leggi('components/scheda/FoglioPagamento.tsx')
  assert.match(foglio, /risposta = await conLimite\(richiesta, LIMITE_SALVATAGGIO_MS\)/)
  // anche un errore lanciato: niente «Salvo…», l'avviso
  assert.match(foglio, /\} catch \{\s*risposta = null/)
  assert.match(foglio, /if \(!risposta \|\| risposta\.scaduto\) \{\s*setErrore\(ERRORE_SALVATAGGIO_SCADUTO\)/)
  // il tasto torna attivo: il freno si riapre sempre
  assert.match(foglio, /\} finally \{\s*inCorso\.current = false\s*setSalvando\(false\)/)
  // una risposta tardiva vale solo se non è partito un altro salvataggio
  assert.match(foglio, /tardi\.esito === 'ok' && giro === giroSalva\.current && !inCorso\.current/)
  // l'avviso è AvvisoAzione
  assert.match(foglio, /\{errore && errore !== MESSAGGIO_ESITO_INCERTO && <AvvisoAzione testo=\{errore\}/)
})

test('prima di scrivere si cerca il gemello; dalla Home anche la lettura ha il limite', () => {
  const dati = leggi('lib/pagamentiDati.ts')
  const gemello = dati.indexOf('pagamentoGemello(pagamentiPrima, dati, Date.now())')
  assert.ok(gemello > 0)
  assert.ok(gemello < dati.indexOf('await eseguiRegistraAcconto('), 'il gemello si cerca PRIMA della scrittura')
  const home = leggi('components/maison/PagamentoDaHome.tsx')
  assert.match(home, /LIMITE_SALVATAGGIO_MS\)\s*\.then\(r => \{ if \(vivo && r\.scaduto\) \{ vivo = false; setErrore\(ERRORE_LETTURA_SCADUTA\) \} \}\)/)
})
