// La vista «Sett.» del nastro sul telefono (Ania, 30/09/2026; riferimento
// docs/design/calendario-settimana-riferimento.html): lo stesso nastro di
// «2 settimane» coi giorni da 145 px; dal 30/09/2026 sera anche dal Mac.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  GIORNO_SETT_PX, GIORNO_TELEFONO, colonnaMinTelefono, VOCE_MESE, VOCI_SETTIMANE, leggiModoNastro, larghezzaGiorno,
  COLONNE_VISIBILI_NASTRO, GIORNI_SETTIMANA, etichettaFreccia,
} from './calendarioMobile.ts'

test('S8: la larghezza del giorno in «Sett.» sta in UNA costante, accanto a quella dei 60 px', () => {
  assert.equal(GIORNO_SETT_PX, 145)
  assert.equal(GIORNO_TELEFONO.settimana, GIORNO_SETT_PX)
  assert.equal(GIORNO_TELEFONO.quindici, 60)
  assert.equal(colonnaMinTelefono('settimana'), GIORNO_SETT_PX)
})

test('S1: le tre viste, «Mese» da solo e «2 sett. | Sett.» insieme (fascia della data, 30/09/2026)', () => {
  assert.deepEqual([...VOCE_MESE, ...VOCI_SETTIMANE].map(v => v[0]), ['mese', 'quindici', 'settimana'])
  assert.deepEqual([...VOCE_MESE, ...VOCI_SETTIMANE].map(v => v[1]), ['Mese', '2 sett.', 'Sett.'])
})

test('S5: la scelta ricordata si rilegge', () => {
  assert.equal(leggiModoNastro('settimana'), 'settimana')
  assert.equal(leggiModoNastro('quindici'), 'quindici')
  assert.equal(leggiModoNastro('mese'), 'mese')
  assert.equal(leggiModoNastro('altro'), null)
  assert.equal(leggiModoNastro(null), null)
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

test('S6: «Sett.» anche dal Mac (30/09/2026 sera), sempre coi giorni da 145 px', () => {
  // a «Sett.» il giorno è GIORNO_SETT_PX anche con un riquadro largo (Mac)
  assert.equal(larghezzaGiorno('settimana', 1180, 145, 7), 145)
  assert.equal(larghezzaGiorno('settimana', 292, 145, 7), 145)
  // le altre viste come prima
  assert.equal(larghezzaGiorno('quindici', 1180, 60, 14), 84)
  assert.equal(larghezzaGiorno('mese', 310, 0, 31), 10)
  for (const f of ['app/calendario/page.tsx', 'app/arrivi/page.tsx', 'components/richieste/NastroRichieste.tsx']) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.match(src, /const modo = modoScelto\n/, f)
    assert.doesNotMatch(src, /useMac|vistaNastro/, `${f}: «Sett.» non deve più dipendere dal Mac`)
    assert.match(src, /leggiModoNastro\(v\)/, f)
    assert.match(src, /larghezzaGiorno\(modo, larghezzaGriglia - NAME_W, colonnaMin, COLONNE_VISIBILI\[modo\]\)/, f)
  }
})
