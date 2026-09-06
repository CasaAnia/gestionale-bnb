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
