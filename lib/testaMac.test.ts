// ============================================================================
// LA TESTA DELLE PAGINE DAL MAC (Ania, 29/09/2026): TUTTE le pagine come la
// barra del telefono. Fondo bianco #FFFFFF e fili #E8E3DA; niente titolo
// grande, niente sottotitolo, niente «← Indietro»; in cima la sola scrittina
// maiuscoletta 10,5 px, .22em, #6E6558 col nome della pagina, col bordo alto
// a 64 px come il marchio; la ricerca a destra dove c'è. La Home resta
// identica al telefono (striscia con la foto, nessuna scrittina). Dal
// telefono le pagine non cambiano.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sottotitoloArrivi } from './testaMac.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const css = leggi('app/maison.css')
const SCRITTA = /font-size: (?:10\.5px|calc\(10\.5px \/ var\(--zoom-pagina, 1\)\)); letter-spacing: \.22em; text-transform: uppercase; color: #6E6558; font-weight: 500; line-height: 1;/

test('la nota degli Arrivi resta nella riga dei mesi', () => {
  assert.equal(sottotitoloArrivi(83), 'arrivi dei prossimi 83 giorni')
  assert.match(leggi('app/arrivi/page.tsx'), /nota=\{sottotitoloArrivi\(DAYS_TOTAL - DAYS_BEFORE\)\}/)
})

test('dal Mac niente «← Indietro» su nessuna pagina', () => {
  const barra = leggi('components/BackBar.tsx')
  assert.match(barra, /className="indietro-barra hidden sticky/)
  assert.equal(/lg:block/.test(barra), false)
  // Nuova prenotazione e Scheda: il loro «‹» sparisce dal Mac
  assert.match(css, /\.np-hd h1, \.np-hd \.np-back \{ display: none; \}/)
  assert.match(css, /\.sch-top \.np-back \{ display: none; \}/)
})

test('TestaPagina (Calendario, Arrivi, Richieste): la scrittina a 64 px, i comandi a destra', () => {
  const testa = leggi('components/TestaPagina.tsx')
  const scritta = testa.slice(testa.indexOf('if (scrittaMac)'), testa.indexOf('  return (\n    <div data-testa-pagina className'))
  assert.match(scritta, /<h1 className="testa-mac-scritta">\{titolo\}<\/h1>/)
  assert.match(scritta, /absolute right-0 top-1\/2 -translate-y-1\/2/)
  assert.equal(/indietro|sottotitolo|testa-mac-titolo/.test(scritta), false)
  assert.match(css, /\[data-testa-scritta\] \.testa-mac-riga-scritta \{ margin-top: 48px; margin-bottom: 24px; \}/)
  assert.match(css.slice(css.indexOf('[data-testa-scritta] .testa-mac-scritta')), SCRITTA)
  for (const [f, t] of [['app/calendario/page.tsx', 'isDesktop'], ['app/arrivi/page.tsx', 'isDesktop'], ['app/richieste/page.tsx', 'desktop']]) {
    const src = leggi(f)
    assert.match(src, new RegExp(`scrittaMac=\\{${t} && !orizzontale\\}`), f)
    assert.equal(/sottotitolo=/.test(src), false, `${f}: ancora un sottotitolo`)
  }
})

test('le pagine non ancora Maison: TestaMac con la sola scrittina, zoom compensato', () => {
  const testa = leggi('components/TestaMac.tsx')
  assert.match(testa, /<h1 className="testa-mac-scritta">\{titolo\}<\/h1>/)
  assert.equal(/sottotitolo|testa-mac-titolo/.test(testa.slice(testa.indexOf('export default'))), false)
  assert.match(testa, /marginTop: `calc\(64px \/ var\(--zoom-pagina, 1\) - \$\{contenitore\}px\)`/)
  assert.match(css.slice(css.indexOf('[data-testa-mac] .testa-mac-scritta')), SCRITTA)
  assert.match(leggi('components/MainContainer.tsx'), /lg:\[zoom:1\.2\] lg:\[--zoom-pagina:1\.2\]/)
  const pagine: [string, RegExp][] = [
    ['app/prenotazioni/page.tsx', /<TestaMac titolo="Prenotazioni"\s*comandi=\{<>\{ricerca\('w-\[calc\(340px\/var\(--zoom-pagina,1\)\)\]'\)\}\{nuova\}<\/>\}/],
    // Clienti è «Maison» dal 29/09/2026 (ritocchi D2): senza zoom, ricerca a filo e «+ Nuovo cliente»
    ['app/clienti/page.tsx', /<TestaMac titolo="Clienti" contenitore=\{16\}\s*comandi=\{<><CampoRicerca maison value=\{search\} onChange=\{setSearch\} className="w-\[300px\]" \/>\{nuovo\('\+ Nuovo cliente'\)\}<\/>\}/],
    ['app/pulizie/page.tsx', /<TestaMac titolo="Pulizie" contenitore=\{24\} \/>/],
    ['app/statistiche/page.tsx', /<TestaMac titolo="Statistiche" \/>/],
    ['app/impostazioni/page.tsx', /<TestaMac titolo="Impostazioni" \/>/],
    ['components/spese/SpeseShell.tsx', /<TestaMac titolo=\{pathname\.startsWith\('\/spese-famiglia'\) \? 'Spese Famiglia' : 'Spese B&B'\} \/>/],
  ]
  for (const [file, re] of pagine) assert.match(leggi(file), re, file)
  // dal telefono la ricerca e «+ Nuova» restano dov'erano
  assert.match(leggi('app/prenotazioni/page.tsx'), /\{ricerca\('mb-3 lg:hidden'\)\}/)
  // le pagine interne (scheda cliente, nuovo cliente, nuova e modifica richiesta): scrittina anche lì
  for (const file of ['app/clienti/[id]/page.tsx', 'app/clienti/nuovo/page.tsx']) {
    assert.match(leggi(file), /titolo-mac testa-mac-sopra/, file)
  }
  // nuova e modifica richiesta sono «Maison» dal 29/09/2026: la scrittina della scheda (.sch-scritta)
  for (const file of ['app/richieste/nuova/page.tsx', 'app/richieste/[id]/modifica/page.tsx']) {
    assert.match(leggi(file), /<p className="sch-scritta">/, file)
  }
  assert.match(css.slice(css.indexOf('.titolo-mac.titolo-mac')), SCRITTA)
  assert.match(css, /\.testa-mac-sopra \{ margin-top: calc\(64px \/ var\(--zoom-pagina, 1\) - 16px\); \}/)
})

test('Nuova prenotazione e Scheda dal Mac: la scrittina a 64 px; la scheda tiene lo stato a destra', () => {
  assert.match(leggi('components/nuova/TestaNuova.tsx'), /<p className="np-scritta" data-scritta-mac>\{TITOLO_PAGINA\}<\/p>/)
  assert.match(leggi('app/scheda/[id]/page.tsx'), /<span className="sch-scritta" data-scritta-mac>Prenotazione<\/span>/)
  assert.match(css, /\.np-scritta, \.sch-scritta \{ display: none; \}/)
  assert.match(css.slice(css.indexOf('.np-scritta, .sch-scritta { display: block;')), SCRITTA)
  assert.match(css, /\.np-hd \{ padding-top: 64px; align-items: flex-start; \}/)
  assert.match(css, /\.sch-top \{ padding-top: calc\(64px \/ var\(--zoom-pagina, 1\)\); align-items: flex-start; min-height: 0; \}/)
})

test('dal Mac tutte le pagine su fondo bianco con i fili #E8E3DA; la colonna del menu resta crema', () => {
  for (const pagina of ['mz-home', 'cal', 'sch', 'np']) {
    assert.match(css, new RegExp(`:root:has\\(\\.${pagina}\\) \\{ --home-bg: #FFFFFF; --home-line: #E8E3DA; \\}`), pagina)
  }
  assert.match(css, /@media \(min-width: 1024px\) \{\s*:root \{ --color-cream: #FFFFFF; --color-card-border: #E8E3DA; --color-border-soft: #E8E3DA; --color-grid-line: #E8E3DA; \}\s*body \{ background: #FFFFFF; \}/)
  assert.match(leggi('components/spese/SpeseShell.tsx'), /lg:!bg-white/)
  assert.match(css, /width: 200px; background: #F6F2EA;/)
  // la Home dal Mac è identica al telefono: nessuna scrittina
  assert.equal(/TestaMac|scrittaMac|scritta-mac/.test(leggi('app/page.tsx')), false)
})

// Una graffa di troppo in app/maison.css ferma tutte le pagine (successo il
// 29/09/2026 in prova, mai pubblicato): il file deve leggersi senza errori.
test('app/maison.css si legge senza errori di sintassi', async () => {
  const { createRequire } = await import('node:module')
  const postcss = createRequire(import.meta.url)('postcss') as { parse: (css: string) => unknown }
  assert.doesNotThrow(() => postcss.parse(css))
})
