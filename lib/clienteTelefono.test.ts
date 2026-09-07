// Cliente riconosciuto dal numero nella Nuova prenotazione (07/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cifreTelefono, stessoNumero, schemaRicercaTelefono, schedaConNumero, nomeSuPrenotazione, testoClienteRiconosciuto } from './clienteTelefono.ts'

test('stesso numero in forme diverse: +39 con spazi, solo cifre, senza prefisso', () => {
  assert.equal(cifreTelefono('+39 333 000 0001'), '393330000001')
  assert.equal(cifreTelefono('333 000 0001'), '393330000001')
  assert.ok(stessoNumero('+39 333 000 0001', '393330000001'))
  assert.ok(stessoNumero('3330000001', '393330000001'))
  assert.ok(stessoNumero('+48 600 000 000', '48600000000'))
  assert.ok(!stessoNumero('393330000001', '393330000002'))
  assert.ok(!stessoNumero('', '393330000001'))
  assert.ok(!stessoNumero(null, undefined))
})

test('schema ilike sulle ultime 9 cifre, null se il numero è troppo corto', () => {
  assert.equal(schemaRicercaTelefono('+39 333 000 0001'), '%3%3%0%0%0%0%0%0%1%')   // ultime 9 cifre di 393330000001
  assert.equal(schemaRicercaTelefono('12345'), null)
  assert.equal(schemaRicercaTelefono(''), null)
})

test('fra le righe lette vince solo la scheda col numero davvero uguale', () => {
  const righe = [
    { id: 'a', phone: '+39 333 000 0001' },
    { id: 'b', phone: '393330000012' },   // contiene le cifre di …0001 interposte? no: è un altro numero
    { id: 'c', phone: '3330000001' },
  ]
  assert.equal(schedaConNumero(righe, '393330000001')?.id, 'a')
  assert.equal(schedaConNumero(righe.slice(1), '393330000001')?.id, 'c')
  assert.equal(schedaConNumero(righe, '393330000099'), null)
  assert.equal(schedaConNumero([], '393330000001'), null)
})

test('il nome scritto resta sulla prenotazione solo se diverso dalla scheda', () => {
  assert.equal(nomeSuPrenotazione('mario rossi', 'Mario Rossi'), null)
  assert.equal(nomeSuPrenotazione('MARIO  ROSSI', 'Mario Rossi'), null)
  assert.equal(nomeSuPrenotazione('giulia rossi', 'Mario Rossi'), 'Giulia Rossi')
  assert.equal(nomeSuPrenotazione('', 'Mario Rossi'), null)
  assert.equal(nomeSuPrenotazione('Giulia Rossi', null), 'Giulia Rossi')
})

test('testo sotto «Cliente trovato»', () => {
  assert.equal(testoClienteRiconosciuto({ full_name: 'Mario Rossi' }, null), 'Numero già in archivio: uso la scheda di Mario Rossi.')
  assert.equal(testoClienteRiconosciuto({ full_name: 'Mario Rossi' }, 'Giulia Rossi'),
    'Numero già in archivio: uso la scheda di Mario Rossi. «Giulia Rossi» resta come nome di questa prenotazione, la scheda non cambia.')
  assert.equal(testoClienteRiconosciuto({ full_name: '' }, null), 'Numero già in archivio: uso la scheda di una scheda senza nome.')
})
