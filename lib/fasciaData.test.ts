// ============================================================================
// LA FASCIA DELLA DATA E LA BARRA IN BASSO (Ania, 30/09/2026; riferimento
// docs/design/fascia-data-riferimento.html, versione E; checklist
// docs/design/fascia-data-checklist.md).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('F1: a destra «MESE» sopra «‹ 2 SETT. | SETT. ›», a sinistra il periodo; una fascia sola per telefono e Mac', () => {
  const riga = leggi('components/RigaPeriodo.tsx')
  assert.match(riga, /if \(fascia\) \{/)
  assert.match(riga, /<div data-riga-periodo-fascia data-riga-navigazione data-senza-sottolinea className=\{`riga-fascia \$\{className\}`\}>\s*<span className=\{`per [^`]*`\}>\{etichetta\}<\/span>\s*<div className="col">\s*<InterruttorePillola voci=\{VOCE_MESE\}[^>]*\/>\s*<span className="riga2">\s*<button type="button" className="ar" onClick=\{onPrec\}[^>]*>‹<\/button>\s*<InterruttorePillola voci=\{VOCI_SETTIMANE\}[^>]*\/>\s*<button type="button" className="ar" onClick=\{onSucc\}[^>]*>›<\/button>/)
  // niente lg:hidden / hidden lg:flex: la stessa fascia dal telefono e dal Mac
  const blocco = riga.slice(riga.indexOf('if (fascia)'), riga.indexOf('return (\n    <>'))
  assert.doesNotMatch(blocco, /lg:hidden|hidden lg:flex/)
})

test('F1: misure — colonna centrata, 8 px fra le righe, frecce a 6 px, pillola 9,5 px 5 × 9, fascia 10 sopra e 12 sotto', () => {
  const css = leggi('app/maison.css')
  assert.match(css, /\.riga-fascia \{ display: flex; align-items: center; gap: 8px; padding: 10px 12px 12px;/)
  assert.match(css, /\.riga-fascia \.col \{ display: flex; flex-direction: column; align-items: center; gap: 8px; flex: none; \}/)
  assert.match(css, /\.riga-fascia \.riga2 \{ display: flex; align-items: center; gap: 6px; \}/)
  assert.match(css, /\.riga-fascia \.cal-pill button span \{ font-size: 9\.5px; padding: 5px 9px; \}/)
  // il periodo centrato nello spazio che resta, su una riga, in Cormorant
  assert.match(css, /\.riga-fascia \.per \{ flex: 1; min-width: 0; text-align: center; font-family: var\(--font-cormorant\)[^}]*white-space: nowrap;/)
  // la voce accesa piena d'inchiostro col testo avorio (la pillola di sempre)
  assert.match(css, /\.cal-pill button\.on span \{ background: var\(--m-ink\); color: #F6F2EA; \}/)
})

test('F1 e F2: il periodo 25 px sul telefono (20 a cavallo d\'anno), 40 dal Mac — misurati col Cormorant vero', () => {
  const css = leggi('app/maison.css')
  assert.match(css, /:root \{ --fascia-per: 25px; --fascia-per-due-anni: 20px; \}/)
  assert.match(css, /@media \(min-width: 1024px\) \{ :root \{ --fascia-per: calc\(40px \/ var\(--zoom-pagina, 1\)\); --fascia-per-due-anni: calc\(40px \/ var\(--zoom-pagina, 1\)\); \} \}/)
})

test('F1: il periodo ha sempre l\'anno, anche a «Sett.» e a «2 sett.»', async () => {
  const { etichettaPeriodo } = await import('./richiesteCalendario.ts')
  assert.equal(etichettaPeriodo(['2026-09-27', '2026-10-10']), '27 set – 10 ott 2026')
  assert.equal(etichettaPeriodo(['2026-09-28', '2026-10-04']), '28 set – 4 ott 2026')
})

test('F4: «Legenda» 28 px sotto «Oggi» dal telefono (26 + i 2 px sotto il cerchio)', () => {
  assert.match(leggi('app/maison.css'), /\.cal-lg, \.cal-lg\.cal-lg-staccata \{ margin-top: 26px; \}/)
})

test('F5: barra in basso «Oggi · Calendario · Richieste · Arrivi · Pulizie», senza «Menu»', async () => {
  const src = leggi('components/BottomNav.tsx')
  const m = /export const VOCI_BARRA = \[([\s\S]*?)\] as const/.exec(src)
  assert.ok(m)
  assert.deepEqual([...m[1].matchAll(/label: '([^']+)'/g)].map(x => x[1]), ['Oggi', 'Calendario', 'Richieste', 'Arrivi', 'Pulizie'])
  assert.match(m[1], /\{ href: '\/pulizie', label: 'Pulizie', icona: 'pulizie' \}/)
  assert.match(src, /pulizie: <svg viewBox="0 0 24 24" aria-hidden>/)
  assert.doesNotMatch(src, /\}Menu|data-menu-barra|titolo="Menu"/)
})
