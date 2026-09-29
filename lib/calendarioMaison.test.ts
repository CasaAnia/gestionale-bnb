// Il calendario «Maison» (riferimento approvato da Ania il 29/09/2026:
// docs/design/calendario-riferimento.html). Le regole pure delle schede, dei
// buchi e del foglietto, più le prove sul sorgente della pagina (come
// lib/calendarioMobile.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PASSO_FRECCE_QUINDICI, etichettaFreccia, colonnaMinTelefono, GIORNO_TELEFONO } from './calendarioMobile.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const pagina = leggi('app/calendario/page.tsx')

test('frecce: a «2 settimane» una settimana (7 giorni), a «Mese» il 1° del mese; le etichette lo dicono', () => {
  assert.equal(PASSO_FRECCE_QUINDICI, 7)
  assert.equal(etichettaFreccia('quindici', -1), 'Una settimana prima')
  assert.equal(etichettaFreccia('quindici', 1), 'Una settimana dopo')
  assert.equal(etichettaFreccia('mese', -1), 'Mese precedente')
  assert.equal(etichettaFreccia('mese', 1), 'Mese successivo')
  // la pagina sposta di PASSO_FRECCE_QUINDICI, non più di GIORNI_QUINDICINA
  assert.match(pagina, /scorriDiGiorni\(direzione \* PASSO_FRECCE_QUINDICI\)/)
  assert.doesNotMatch(pagina, /scorriDiGiorni\(direzione \* GIORNI_QUINDICINA\)/)
  assert.match(pagina, /aria-label=\{etichettaFreccia\(modo, -1\)\}/)
  assert.match(pagina, /aria-label=\{etichettaFreccia\(modo, 1\)\}/)
})

test('larghezza del giorno sul telefono: 60 px a «2 settimane», 40 a «Mese»', () => {
  assert.deepEqual(GIORNO_TELEFONO, { quindici: 60, mese: 40 })
  assert.equal(colonnaMinTelefono('quindici'), 60)
  assert.equal(colonnaMinTelefono('mese'), 40)
  assert.match(pagina, /colonnaMinTelefono\(modo\)/)
})

test('la riga di navigazione: l’interruttore di sempre nella veste Maison, periodo in Cormorant', () => {
  assert.match(pagina, /<InterruttorePillola voci=\{VOCI_GRIGLIA\}[^>]*maison \/>/)
  const pillola = leggi('components/InterruttorePillola.tsx')
  assert.match(pillola, /className=\{`cal-pill \$\{className\}`\}/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-pill button\.on span \{ background: var\(--m-ink\); color: #F6F2EA; \}/)
  assert.match(css, /\.cal-nav \.per \{ font-family: var\(--m-disp\); font-size: 16px;/)
})
