// ============================================================================
// LA RIGA DEL PERIODO DAL MAC (Ania, 29/09/2026): un componente solo
// (components/RigaPeriodo) per tutte le pagine con le frecce su un periodo.
// Periodo a sinistra in Cormorant 30 px col mese per esteso; a destra
// ‹ · pillola · › a 10 px. Dal telefono ogni pagina tiene la sua riga.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { periodoEsteso, meseEsteso, giornoEsteso } from './periodoEsteso.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('il periodo per esteso: stesso mese, due mesi, due anni, un mese, un giorno', () => {
  assert.equal(periodoEsteso('2026-11-15', '2026-11-28'), '15 – 28 novembre 2026')
  assert.equal(periodoEsteso('2026-09-27', '2026-10-10'), '27 settembre – 10 ottobre 2026')
  assert.equal(periodoEsteso('2026-12-28', '2027-01-10'), '28 dicembre 2026 – 10 gennaio 2027')
  assert.equal(meseEsteso('2026-11'), 'Novembre 2026')
  assert.equal(meseEsteso('2026-09-01'), 'Settembre 2026')
  assert.equal(giornoEsteso('2026-09-29'), 'martedì 29 settembre 2026')
  assert.equal(periodoEsteso('2026-09-29', '2026-09-29'), 'martedì 29 settembre 2026')
})

test('RigaPeriodo: periodo a sinistra, ‹ · pillola · › a destra, solo dal Mac', () => {
  const riga = leggi('components/RigaPeriodo.tsx')
  assert.match(riga, /className=\{`riga-periodo hidden lg:flex \$\{className\}`\}/)
  assert.match(riga, /<span className="dx">\s*<button type="button" className="ar" onClick=\{onPrec\}[^>]*>‹<\/button>\s*\{pillola\}\s*<button type="button" className="ar" onClick=\{onSucc\}[^>]*>›<\/button>/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.riga-periodo \{ align-items: center; justify-content: space-between;/)
  assert.match(css, /\.riga-periodo \.per \{[^}]*font-family: var\(--font-cormorant\)[^}]*font-size: calc\(30px \/ var\(--zoom-pagina, 1\)\); font-weight: 400; line-height: 1; color: #241F1A;/)
  assert.match(css, /\.riga-periodo \.dx \{ display: flex; align-items: center; gap: calc\(10px \/ var\(--zoom-pagina, 1\)\); flex: none; \}/)
  // la riga del telefono ha display nel CSS: dal Mac va spenta lì
  assert.match(css, /@media \(min-width: 1024px\) \{ \.riga-periodo-tel \{ display: none; \} \}/)
  // frecce senza cerchi
  assert.match(css, /\.riga-periodo \.ar \{[^}]*background: none; border: 0;/)
})

test('le pagine con le frecce su un periodo usano tutte RigaPeriodo; Statistiche e Spese dal telefono la loro riga di sempre', () => {
  const pagine: [string, RegExp][] = [
    ['app/statistiche/page.tsx', /className="flex items-center justify-between bg-white rounded-xl border border-\[#C9BFA8\] shadow-sm mb-4 lg:hidden"/],
    ['components/spese/AnalisiOperativa.tsx', /<div className="flex items-center gap-1 lg:hidden">/],
  ]
  for (const [file, telefono] of pagine) {
    const src = leggi(file)
    assert.match(src, /<RigaPeriodo /, `${file}: manca RigaPeriodo`)
    assert.match(src, telefono, `${file}: la riga del telefono deve restare, nascosta dal Mac`)
  }
})

// ── Novità 14a delle Richieste «Maison» (29/09/2026): la riga del periodo dal
// telefono, UNA per Calendario, Arrivi e Richieste ─────────────────────────
test('RigaPeriodo dal telefono: periodo a sinistra in Cormorant 20 su una riga, ‹ · pillola · › attaccati a 8 px', () => {
  const riga = leggi('components/RigaPeriodo.tsx')
  assert.match(riga, /className=\{`riga-periodo-tel lg:hidden \$\{className\}`\}/)
  assert.match(riga, /<span className="per">\{telefono\.etichetta\}<\/span>\s*<span className="dx">\s*<button type="button" className="ar" onClick=\{onPrec\}[^>]*>‹<\/button>\s*\{telefono\.pillola\}\s*<button type="button" className="ar" onClick=\{onSucc\}[^>]*>›<\/button>/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.riga-periodo-tel \{ display: flex; align-items: center; justify-content: space-between;/)
  assert.match(css, /\.riga-periodo-tel \.per \{[^}]*font-size: 20px;[^}]*white-space: nowrap;/)
  assert.match(css, /\.riga-periodo-tel \.dx \{ display: flex; align-items: center; gap: 8px; flex: none; \}/)
  // frecce come oggi: senza cerchi
  assert.match(css, /\.riga-periodo-tel \.ar \{[^}]*background: none; border: 0;/)
  // la vecchia riga ‹ · periodo · pillola · › del telefono non c'è più
  assert.doesNotMatch(css, /\.cal-nav \{/)
})

test('Calendario, Arrivi e Richieste passano la riga del telefono a RigaPeriodo, con la pillola fra le frecce', () => {
  for (const file of ['app/calendario/page.tsx', 'app/arrivi/page.tsx', 'components/richieste/NastroRichieste.tsx']) {
    const src = leggi(file)
    assert.match(src, /<RigaPeriodo /, file)
    assert.match(src, /telefono=\{\{/, `${file}: manca la riga del telefono`)
    assert.match(src, /pillola=\{[^}]*<InterruttorePillola /, file)
    assert.doesNotMatch(src, /className="cal-nav /, `${file}: la riga vecchia del telefono è tornata`)
  }
})
