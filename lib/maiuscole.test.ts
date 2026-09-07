// Iniziali maiuscole nei dati del cliente (06/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { conIniziali, conInizialiONull } from './maiuscole.ts'

test('nome e cognome scritti in minuscolo partono con la maiuscola', () => {
  assert.equal(conIniziali('liliana micali'), 'Liliana Micali')
  assert.equal(conIniziali('anna'), 'Anna')
  assert.equal(conIniziali('  rosa   macauda '), 'Rosa Macauda')
})

test('il resto resta come scritto: D\'Iorio, Rosa-Maria, McDonald, lettere accentate e polacche', () => {
  assert.equal(conIniziali("arturo d'iorio"), "Arturo D'Iorio")
  assert.equal(conIniziali('rosa-maria'), 'Rosa-Maria')
  assert.equal(conIniziali('McDonald'), 'McDonald')
  assert.equal(conIniziali('LILIANA'), 'LILIANA')
  assert.equal(conIniziali('élodie'), 'Élodie')
  assert.equal(conIniziali('łukasz nowak'), 'Łukasz Nowak')
})

test('vuoto e null: stringa vuota, oppure null per le colonne facoltative', () => {
  assert.equal(conIniziali(''), '')
  assert.equal(conIniziali(null), '')
  assert.equal(conIniziali('   '), '')
  assert.equal(conInizialiONull('  '), null)
  assert.equal(conInizialiONull('mamma'), 'Mamma')
})

// ── Nel campo, mentre si scrive (07/09/2026) ────────────────────────────────
import { conInizialiDigitando, maiuscoleNelCampo } from './maiuscole.ts'

test('mentre si scrive: prima lettera di ogni parola, il resto invariato, spazi conservati', () => {
  assert.equal(conInizialiDigitando('m'), 'M')
  assert.equal(conInizialiDigitando('mario '), 'Mario ')          // lo spazio finale resta: si sta per scrivere il cognome
  assert.equal(conInizialiDigitando('mario rossi'), 'Mario Rossi')
  assert.equal(conInizialiDigitando('maria  luisa'), 'Maria  Luisa')
  assert.equal(conInizialiDigitando('de luca'), 'De Luca')
  assert.equal(conInizialiDigitando('McDonald'), 'McDonald')
  assert.equal(conInizialiDigitando('LILIANA'), 'LILIANA')
  assert.equal(conInizialiDigitando(''), '')
})

test('apostrofi e trattini: D\'Angelo e Rossi-Bianchi restano così, in minuscolo diventano così', () => {
  assert.equal(conInizialiDigitando("D'Angelo"), "D'Angelo")
  assert.equal(conInizialiDigitando('Rossi-Bianchi'), 'Rossi-Bianchi')
  assert.equal(conInizialiDigitando("d'angelo"), "D'Angelo")
  assert.equal(conInizialiDigitando('rossi-bianchi'), 'Rossi-Bianchi')
  assert.equal(conInizialiDigitando("anna d’angelo"), "Anna D’Angelo")   // apostrofo tipografico dell'iPhone
  assert.equal(conIniziali("d'angelo"), "D'Angelo")
  assert.equal(conIniziali('rossi-bianchi'), 'Rossi-Bianchi')
  assert.equal(conIniziali("D'Angelo"), "D'Angelo")
  assert.equal(conIniziali('Rossi-Bianchi'), 'Rossi-Bianchi')
})

test('campo e valore salvato coincidono: conIniziali di ciò che si vede nel campo non cambia più nulla (a parte gli spazi)', () => {
  for (const scritto of ['mario rossi', "arturo d'iorio", 'rosa-maria de luca', 'łukasz nowak']) {
    const nelCampo = conInizialiDigitando(scritto)
    assert.equal(conIniziali(nelCampo), nelCampo)
  }
  assert.equal(conIniziali(conInizialiDigitando('mario ')), 'Mario')
})

test('maiuscoleNelCampo: corregge il campo e tiene il cursore dov\'era', () => {
  const chiamate: Array<[number, number]> = []
  const campo = { value: 'mario ro', selectionStart: 3, selectionEnd: 3, setSelectionRange: (a: number, b: number) => chiamate.push([a, b]) }
  assert.equal(maiuscoleNelCampo(campo), 'Mario Ro')
  assert.equal(campo.value, 'Mario Ro')
  assert.deepEqual(chiamate, [[3, 3]])
  // già a posto: il campo non viene toccato e il cursore non viene mosso
  const fermo = { value: 'Mario Rossi', selectionStart: 11, selectionEnd: 11, setSelectionRange: (a: number, b: number) => chiamate.push([a, b]) }
  assert.equal(maiuscoleNelCampo(fermo), 'Mario Rossi')
  assert.equal(chiamate.length, 1)
})
