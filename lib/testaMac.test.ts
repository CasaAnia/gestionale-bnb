// ============================================================================
// LA TESTA DELLE PAGINE DAL MAC (Ania, 29/09/2026): Calendario, Arrivi,
// Richieste. Niente «← Indietro»; titolo Cormorant 30 px col bordo alto a
// 64 px come il marchio della colonna; sottotitolo maiuscoletto d'ottone a
// 6 px; ricerca a destra, 340 px. Dal telefono nulla cambia.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { meseIntero, sottotitoloArrivi, sottotitoloCalendario, sottotitoloRichieste } from './testaMac.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('i sottotitoli dicono periodo e camere, i giorni degli arrivi, le richieste da gestire', () => {
  assert.equal(sottotitoloCalendario('2026-09-26', '2026-10-09', 4), '26 set → 9 ott · 4 camere')
  assert.equal(sottotitoloCalendario('2026-09-26', '2026-10-09', 1), '26 set → 9 ott · 1 camera')
  assert.equal(sottotitoloCalendario(undefined, '2026-10-09', 4), '')
  assert.deepEqual(meseIntero('2026-02-01'), { dal: '2026-02-01', al: '2026-02-28' })
  assert.deepEqual(meseIntero('2026-09-14'), { dal: '2026-09-01', al: '2026-09-30' })
  assert.equal(sottotitoloArrivi(83), 'arrivi dei prossimi 83 giorni')
  assert.equal(sottotitoloRichieste(3), '3 da gestire')
  assert.equal(sottotitoloRichieste(0), 'nessuna da gestire')
  // mentre carica o se la lettura è fallita: vuota, mai «nessuna»
  assert.equal(sottotitoloRichieste(null), '')
})

test('la testa del Mac: niente Indietro, titolo e sottotitolo, ricerca a destra', () => {
  const testa = leggi('components/TestaPagina.tsx')
  const mac = testa.slice(testa.indexOf('if (sottotitolo !== undefined)'), testa.indexOf('  return (\n    <div data-testa-pagina className'))
  assert.equal(/indietro/.test(mac), false, 'dal Mac la riga «← Indietro» non c’è più')
  assert.match(mac, /<h1 className="testa-mac-titolo">\{titolo\}<\/h1>\s*<p className="testa-mac-sotto">\{sottotitolo\}<\/p>/)
  assert.match(mac, /flex items-end gap-4/)
  const css = leggi('app/maison.css')
  assert.match(css, /\[data-testa-mac\] \.testa-mac-riga \{ margin-top: 48px; \}/)
  assert.match(css, /\.testa-mac-titolo \{[^}]*font-size: 30px; font-weight: 400; line-height: 1; color: #241F1A;/)
  assert.match(css, /\.testa-mac-sotto \{ margin: 6px 0 0;[^}]*font-size: 9\.5px; letter-spacing: \.24em; text-transform: uppercase; color: #A8894F;/)
  // la colonna del Mac scende a 64 px: marchio e titolo alla stessa altezza
  assert.match(css, /padding: 64px 0 0; font-family: var\(--m-ui\)/)
})

test('le tre pagine passano il sottotitolo solo dal Mac; la nota degli Arrivi sta in un posto solo', () => {
  const cal = leggi('app/calendario/page.tsx'), arr = leggi('app/arrivi/page.tsx'), ric = leggi('app/richieste/page.tsx')
  assert.match(cal, /sottotitolo=\{isDesktop && !orizzontale \? sottotitoloVista : undefined\}/)
  assert.match(arr, /sottotitolo=\{isDesktop && !orizzontale \? sottotitoloArrivi\(DAYS_TOTAL - DAYS_BEFORE\) : undefined\}/)
  assert.match(arr, /nota=\{isDesktop && !orizzontale \? undefined : sottotitoloArrivi\(DAYS_TOTAL - DAYS_BEFORE\)\}/)
  assert.match(ric, /sottotitolo=\{desktop && !orizzontale \? sottotitoloRichieste\(loading \|\| richiesteNonLette \? null : bolliniRichieste\(tutte, adesso\)\.nuove\) : undefined\}/)
  for (const t of [cal, arr]) assert.match(t, /'w-\[340px\]'/)
  assert.match(ric, /<CampoRicerca value=\{query\} onChange=\{cambiaRicerca\} className="w-\[340px\]" \/>/)
})
