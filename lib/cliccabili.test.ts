// Tutto ciò che si clicca nel gestionale: la manina e il filo sotto i comandi
// scritti come testo (Ania, 20/09/2026). Regole globali in app/globals.css,
// lette qui dal sorgente: se qualcuno le toglie, la suite lo dice.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8')

test('la manina su bottoni attivi, link, riepiloghi e campi di scelta; la freccia sui bottoni spenti', () => {
  assert.match(css, /button:not\(:disabled\), a\[href\], \[role="button"\], summary, label\[for\], select, input\[type="checkbox"\], input\[type="radio"\] \{ cursor: pointer; \}/)
  assert.match(css, /button:disabled \{ cursor: default; \}/)
})

test('i comandi scritti come testo hanno il filo sotto SEMPRE, non solo al passaggio (Ania, 20/09/2026 sera)', () => {
  const regola = css.slice(css.indexOf('a[href]:not(.block)'), css.indexOf('@media (hover: hover)'))
  assert.match(regola, /text-decoration: underline;/)
  assert.match(regola, /text-decoration-color: color-mix\(in srgb, currentColor 45%, transparent\);/)
  assert.match(regola, /text-underline-offset: 4px;/)
  // al passaggio il filo diventa pieno, mai «solo al passaggio»
  assert.match(css, /@media \(hover: hover\) \{\s*a\[href\]:hover, button:not\(:disabled\):hover \{ text-decoration-color: currentColor; \}/)
  assert.doesNotMatch(css, /button:not\(:disabled\):hover \{ text-decoration: underline/, 'la sottolineatura non deve dipendere dal mouse')
})

test('niente filo su pillole, righe intere, icone, striscia, barra di navigazione, fascia delle sezioni e barra in alto', () => {
  // rounded-sm (il contorno del fuoco dei comandi di testo) NON esclude: «Modifica» e «Rifiuta» delle Richieste hanno il filo
  assert.doesNotMatch(css, /:not\(\[class\*="rounded"\]\)/, 'l’esclusione degli angoli tondi deve nominare rounded-full/xl/lg, non tutti i rounded')
  const regola = css.slice(css.indexOf('a[href]:not(.block)'), css.indexOf('@media (hover: hover)'))
  assert.doesNotMatch(regola, /:where\(/, 'niente :where(): il compilatore del CSS lo scarta (visto il 20/09/2026)')
  for (const esclusione of [':not(.block)', ':not(.flex)', ':not(.ed-pillola)', ':not(.ed-pillola-contorno)', ':not(.ed-pillola-tenue)', ':not(.ed-badge)', ':not([data-pastiglia])', ':not([aria-label])', ':not([style*="border-radius: 999px"])', ':not([class*="bg-"])', ':not([class*="rounded-full"])', ':not([class*="rounded-xl"])', ':not([class*="rounded-lg"])']) {
    assert.ok(regola.includes(esclusione), `manca l'esclusione ${esclusione}`)
  }
  assert.match(css, /\[data-striscia-notti\] button, nav a, \.barra-bassa a, \[data-fascia-sezioni\] button, \.barra-alta button,\s*\[data-senza-sottolinea\], \[data-senza-sottolinea\] a, \[data-senza-sottolinea\] button \{ text-decoration: none !important; \}/)
})
