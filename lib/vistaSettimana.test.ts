// La vista «Sett.» del nastro sul telefono (Ania, 30/09/2026; riferimento
// docs/design/calendario-settimana-riferimento.html): lo stesso nastro di
// «2 settimane» coi giorni da 145 px, solo sotto la larghezza del Mac.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GIORNO_SETT_PX, GIORNO_TELEFONO, colonnaMinTelefono, VOCI_GRIGLIA_TELEFONO, leggiModoNastro, vistaNastro,
  COLONNE_VISIBILI_NASTRO, GIORNI_SETTIMANA, etichettaFreccia,
} from './calendarioMobile.ts'

test('S8: la larghezza del giorno in «Sett.» sta in UNA costante, accanto a quella dei 60 px', () => {
  assert.equal(GIORNO_SETT_PX, 145)
  assert.equal(GIORNO_TELEFONO.settimana, GIORNO_SETT_PX)
  assert.equal(GIORNO_TELEFONO.quindici, 60)
  assert.equal(colonnaMinTelefono('settimana'), GIORNO_SETT_PX)
})

test('S1: la pillola del telefono ha tre parti, «Mese | 2 sett. | Sett.»', () => {
  assert.deepEqual(VOCI_GRIGLIA_TELEFONO.map(v => v[0]), ['mese', 'quindici', 'settimana'])
  assert.deepEqual(VOCI_GRIGLIA_TELEFONO.map(v => v[1]), ['Mese', '2 sett.', 'Sett.'])
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

test('S6: «Sett.» solo sotto il Mac, alla stessa larghezza della riga del periodo (lg, 1024 px)', () => {
  const vista = readFileSync(new URL('./richiesteVista.ts', import.meta.url), 'utf8')
  assert.match(vista, /export const MEDIA_MAC = '\(min-width: 1024px\)'/)
  const css = readFileSync(new URL('../app/maison.css', import.meta.url), 'utf8')
  assert.match(css, /@media \(min-width: 1024px\) \{ \.riga-periodo-tel \{ display: none; \} \}/)
  for (const f of ['app/calendario/page.tsx', 'app/arrivi/page.tsx', 'components/richieste/NastroRichieste.tsx']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /vistaNastro\(modoScelto, !mac\)/, f)
    assert.match(src, /const mac = useMac\(\)/, f)
    assert.match(src, /leggiModoNastro\(v\)/, f)
    assert.match(src, /<InterruttorePillola voci=\{VOCI_GRIGLIA_TELEFONO\}/, f)
    assert.match(src, /\['quindici', '2 settimane'\]/, `${f}: dal Mac resta la pillola a due parti`)
  }
})
