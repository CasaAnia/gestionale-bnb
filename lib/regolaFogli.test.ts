// La regola dei fogli (Ania, 01/10/2026): eyebrow a 14 px, due tasti a tutta
// larghezza 1fr 1.6fr alti 44 a 96 px dal fondo, altezza unica per sezione,
// dal Mac 480 px alto quanto serve.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('la veste comune: eyebrow a 14 px, tasti 1fr 1.6fr alti 44, 96 px dal fondo, Mac 480 alto quanto serve', () => {
  const css = leggi('app/fogli.css')
  assert.match(css, /\.mz \.mz-foglio h2 small \{ margin-top: 16px; \}/)
  assert.match(css, /\.mz \.mz-foglio:not\(\.desktop\) \{ padding-bottom: 96px; \}/)
  assert.match(css, /\.mz \.mz-foglio\.desktop \{ width: 480px; height: auto;/)
  assert.match(css, /\.mz \.mz-foot \{ display: grid; grid-template-columns: 1fr 1\.6fr;/)
  assert.match(css, /height: 44px; min-height: 44px; width: 100%;/)
  assert.match(leggi('app/layout.tsx'), /import '\.\/maison\.css'\nimport '\.\/fogli\.css'/)
})

test('altezza unica per sezione, data dalla pagina; i fogli delle Pulizie tengono la loro', () => {
  const f = leggi('components/maison/FoglioMaison.tsx')
  assert.match(f, /const alto = sezione && !altezzaPropria \? ALTEZZE_SEZIONI\[sezione\] : altezza/)
  for (const [file, sez] of [['app/scheda/layout.tsx', 'scheda'], ['app/calendario/layout.tsx', 'calendario'], ['app/arrivi/layout.tsx', 'arrivi'], ['app/richieste/layout.tsx', 'richieste'], ['app/clienti/layout.tsx', 'clienti'], ['app/nuova-prenotazione/layout.tsx', 'nuova']])
    assert.match(leggi(file), new RegExp(`<SezioneFogli sezione="${sez}">`))
  assert.match(leggi('app/page.tsx'), /<SezioneFogli sezione="home">/)
  assert.match(leggi('components/SchedaPulizia.tsx'), /altezzaPropria/)
})

test('nessun tasto fatto a mano nei fogli della scheda: il piede comune', () => {
  assert.ok(!/cli-cta/.test(leggi('components/scheda/FoglioCliente.tsx')))
  assert.ok(!/style=\{\{ minHeight: 44, padding: '0 14px', fontSize: 13/.test(leggi('components/scheda/FoglioCambiaCliente.tsx')))
})
