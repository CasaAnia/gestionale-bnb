import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { normalizzaTelefono, telefonoLeggibile, telefonoAGruppi, numeroUsabile, CIFRE_MINIME_TELEFONO } from './whatsapp.ts'

test('prefisso internazionale con + o 00 resta quello indicato', () => {
  assert.deepEqual(normalizzaTelefono('+44 7700 900123'), { numero: '447700900123', avviso: null })
  assert.deepEqual(normalizzaTelefono('0044 7700 900123'), { numero: '447700900123', avviso: null })
  assert.deepEqual(normalizzaTelefono('+39 333 123-4567'), { numero: '393331234567', avviso: null })
  assert.equal(telefonoLeggibile(normalizzaTelefono('+44 (0) 7700.900123')), '+4407700900123')
})

test('cellulare italiano senza prefisso: si aggiunge 39', () => {
  assert.deepEqual(normalizzaTelefono('333 123 4567'), { numero: '393331234567', avviso: null })
  assert.deepEqual(normalizzaTelefono('333123456'), { numero: '39333123456', avviso: null })
  assert.equal(telefonoLeggibile(normalizzaTelefono('333 123 4567')), '+393331234567')
})

test('fisso o numero strano: resta com\'è con l\'avviso', () => {
  assert.deepEqual(normalizzaTelefono('02 1234567'), { numero: '021234567', avviso: 'Controlla il prefisso' })
  assert.deepEqual(normalizzaTelefono('12345'), { numero: '12345', avviso: 'Controlla il prefisso' })
  assert.deepEqual(normalizzaTelefono(''), { numero: '', avviso: null })
  assert.deepEqual(normalizzaTelefono(null), { numero: '', avviso: null })
})

test('il numero si legge a gruppi, senza il 39', () => {
  assert.equal(telefonoAGruppi('+39 342 700 4354'), '342 700 4354')
  assert.equal(telefonoAGruppi('3427004354'), '342 700 4354')
  assert.equal(telefonoAGruppi('+393392101241'), '339 210 1241')
  // numeri stranieri: il prefisso resta, altrimenti non si possono chiamare
  assert.equal(telefonoAGruppi('+48 600 000 000'), '+48600000000')
  assert.equal(telefonoAGruppi('+44 7700 900123'), '+447700900123')
  assert.equal(telefonoAGruppi(null), '')
  assert.equal(telefonoAGruppi(''), '')
})

// ── Il numero è obbligatorio in ogni richiesta (Ania, 12/09/2026) ──────────
// Stessa regola per il modulo a mano e per le richieste dal sito: senza numero
// non si può né chiamare né scrivere, e le due icone della riga resterebbero
// vuote. Vedi `numeroUsabile` in lib/whatsapp.
test('numeroUsabile: il numero c’è davvero, oppure null', () => {
  assert.equal(numeroUsabile('+39 333 123 4567'), '393331234567')
  assert.equal(numeroUsabile('333 123 4567'), '393331234567')     // cellulare senza prefisso
  assert.equal(numeroUsabile('0039 333 1234567'), '393331234567')
  assert.equal(numeroUsabile('+48 600 000 000'), '48600000000')   // numero straniero
  // manca del tutto
  assert.equal(numeroUsabile(''), null)
  assert.equal(numeroUsabile('   '), null)
  assert.equal(numeroUsabile(null), null)
  assert.equal(numeroUsabile(undefined), null)
  // troppo corto per essere un numero: meno di 8 cifre
  assert.equal(numeroUsabile('12345'), null)
  assert.equal(numeroUsabile('+39 333'), null)
  assert.equal(numeroUsabile('non un numero'), null)
  assert.equal(CIFRE_MINIME_TELEFONO, 8)
})

test('il modulo a mano non salva una richiesta senza numero', () => {
  const modulo = readFileSync(new URL('../components/richieste/ModuloRichiesta.tsx', import.meta.url), 'utf8')
  assert.match(modulo, /if \(!numeroUsabile\(v\.telefono\)\) \{ setErrore\('Il numero di telefono è obbligatorio/)
  // il controllo sta PRIMA del salvataggio, non dopo
  assert.ok(modulo.indexOf('!numeroUsabile(v.telefono)') < modulo.indexOf('await onSalva('))
  // e dal sito vale la stessa regola, scritta in un posto solo
  const web = readFileSync(new URL('./richiesteWeb.ts', import.meta.url), 'utf8')
  assert.match(web, /if \(!numeroUsabile\(/)
})
