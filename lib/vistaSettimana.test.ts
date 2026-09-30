// La vista «Sett.» del nastro sul telefono (Ania, 30/09/2026; riferimento
// docs/design/calendario-settimana-riferimento.html): lo stesso nastro di
// «2 settimane» coi giorni da 145 px, solo sotto la larghezza del Mac.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  GIORNO_SETT_PX, GIORNO_TELEFONO, colonnaMinTelefono, leggiModoNastro, vistaNastro,
  COLONNE_VISIBILI_NASTRO, GIORNI_SETTIMANA, etichettaFreccia, LARGHEZZA_MAC,
} from './calendarioMobile.ts'

test('S8: la larghezza del giorno in «Sett.» sta in UNA costante, accanto a quella dei 60 px', () => {
  assert.equal(GIORNO_SETT_PX, 145)
  assert.equal(GIORNO_TELEFONO.settimana, GIORNO_SETT_PX)
  assert.equal(GIORNO_TELEFONO.quindici, 60)
  assert.equal(colonnaMinTelefono('settimana'), GIORNO_SETT_PX)
})

test('S5 e S6: la scelta ricordata si rilegge; dal Mac «Sett.» vale «2 settimane»', () => {
  assert.equal(leggiModoNastro('settimana'), 'settimana')
  assert.equal(leggiModoNastro('quindici'), 'quindici')
  assert.equal(leggiModoNastro('mese'), 'mese')
  assert.equal(leggiModoNastro('altro'), null)
  assert.equal(leggiModoNastro(null), null)
  assert.equal(vistaNastro('settimana', true), 'settimana')
  assert.equal(vistaNastro('settimana', false), 'quindici')
  assert.equal(vistaNastro('mese', false), 'mese')
  assert.equal(LARGHEZZA_MAC, 1024)
})

test('S2 e S3: sette colonne, periodo di una settimana, frecce di una settimana', () => {
  assert.equal(COLONNE_VISIBILI_NASTRO.settimana, 7)
  assert.equal(GIORNI_SETTIMANA, 7)
  assert.equal(etichettaFreccia('settimana', -1), 'Una settimana prima')
  assert.equal(etichettaFreccia('settimana', 1), 'Una settimana dopo')
  // sul telefono dritto (358 − 66 di colonna camere) il minimo vince: 145 px, due giorni in vista
  const cella = Math.max(colonnaMinTelefono('settimana'), Math.floor((358 - 66) / COLONNE_VISIBILI_NASTRO.settimana))
  assert.equal(cella, 145)
  assert.equal(Math.floor((358 - 66) / cella), 2)
})
