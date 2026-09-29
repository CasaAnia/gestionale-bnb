// ============================================================================
// LA TESTA DELLE PAGINE DAL MAC (Ania, 29/09/2026): Calendario, Arrivi,
// Richieste. Niente «← Indietro»; titolo Cormorant 30 px col bordo alto a
// 64 px come il marchio della colonna; sottotitolo maiuscoletto d'ottone a
// 6 px; ricerca a destra, 340 px. Dal telefono nulla cambia.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { sottotitoloArrivi, sottotitoloRichieste, sottotitoloPrenotazioni, sottotitoloClienti, sottotitoloOggi, sottotitoloSpese } from './testaMac.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('la nota degli arrivi e le richieste da gestire', () => {
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
  assert.match(css, /\.testa-mac-titolo \{[^}]*font-size: calc\(30px \/ var\(--zoom-pagina, 1\)\); font-weight: 400; line-height: 1; color: #241F1A;/)
  assert.match(css, /\.testa-mac-sotto \{ margin: calc\(6px \/ var\(--zoom-pagina, 1\)\) 0 0;[^}]*font-size: calc\(9\.5px \/ var\(--zoom-pagina, 1\)\); letter-spacing: \.24em; text-transform: uppercase; color: #A8894F;/)
  // la colonna del Mac scende a 64 px: marchio e titolo alla stessa altezza
  assert.match(css, /padding: 64px 0 0; font-family: var\(--m-ui\)/)
})

test('Calendario e Arrivi (Maison) dal Mac: la sola scrittina; Richieste col titolo e «N da gestire»', () => {
  const cal = leggi('app/calendario/page.tsx'), arr = leggi('app/arrivi/page.tsx'), ric = leggi('app/richieste/page.tsx')
  for (const t of [cal, arr]) {
    assert.match(t, /scrittaMac=\{isDesktop && !orizzontale\}/)
    assert.equal(/sottotitolo=/.test(t), false, 'niente sottotitolo nelle pagine Maison')
    assert.match(t, /'w-\[340px\]'/)
  }
  // senza sottotitolo la nota degli Arrivi torna nella riga dei mesi anche dal Mac
  assert.match(arr, /nota=\{sottotitoloArrivi\(DAYS_TOTAL - DAYS_BEFORE\)\}/)
  assert.match(ric, /sottotitolo=\{desktop && !orizzontale \? sottotitoloRichieste\(loading \|\| richiesteNonLette \? null : bolliniRichieste\(tutte, adesso\)\.nuove\) : undefined\}/)
  assert.match(ric, /<CampoRicerca value=\{query\} onChange=\{cambiaRicerca\} className="w-\[340px\]" \/>/)
})

// ── PAGINE MAISON DAL MAC UGUALI AL TELEFONO (Ania, 29/09/2026) ────────────
test('la scrittina in cima: maiuscoletto 10,5 px, .22em, #6E6558, e la ricerca a destra', () => {
  const testa = leggi('components/TestaPagina.tsx')
  const scritta = testa.slice(testa.indexOf('if (scrittaMac)'), testa.indexOf('if (sottotitolo !== undefined)'))
  assert.match(scritta, /<h1 className="testa-mac-scritta mr-auto">\{titolo\}<\/h1>\s*\{comandi\}/)
  assert.equal(/indietro|sottotitolo|testa-mac-titolo/.test(scritta), false)
  const css = leggi('app/maison.css')
  assert.match(css, /\[data-testa-scritta\] \.testa-mac-riga-scritta \{ margin-top: 34\.5px; \}/)
  assert.match(css, /\[data-testa-scritta\] \.testa-mac-scritta \{[^}]*font-size: 10\.5px; letter-spacing: \.22em; text-transform: uppercase; color: #6E6558;/)
})

test('fondo bianco e fili #E8E3DA anche dal Mac: via l’eccezione crema', () => {
  const css = leggi('app/maison.css')
  for (const pagina of ['mz-home', 'cal', 'sch', 'np']) {
    assert.match(css, new RegExp(`:root:has\\(\\.${pagina}\\) \\{ --home-bg: #FFFFFF; --home-line: #E8E3DA; \\}`), pagina)
    assert.equal(new RegExp(`:root:has\\(\\.${pagina}\\) \\{ --home-bg: #F6F2EA`).test(css), false, `${pagina}: ancora crema`)
  }
  // la colonna del menu resta crema
  assert.match(css, /width: 200px; background: #F6F2EA;/)
})

// ── TUTTE LE PAGINE (Ania, 29/09/2026) ─────────────────────────────────────
test('i sottotitoli delle altre pagine: archivio, clienti, oggi, periodo delle spese', () => {
  assert.equal(sottotitoloPrenotazioni(312), '312 in archivio')
  assert.equal(sottotitoloClienti(1), '1 cliente')
  assert.equal(sottotitoloClienti(87), '87 clienti')
  assert.equal(sottotitoloOggi('2026-09-29'), 'martedì 29 settembre 2026')
  const periodi = [{ id: '2026-09', etichetta: 'Settembre 2026', tipo: 'mese' }, { id: 'intervallo', etichetta: 'Dal–al…', tipo: 'intervallo' }]
  assert.equal(sottotitoloSpese(periodi, { periodo: '2026-09', dal: '', al: '' }), 'Settembre 2026')
  assert.equal(sottotitoloSpese(periodi, { periodo: 'intervallo', dal: '2026-09-01', al: '2026-09-15' }), '1 set → 15 set')
})

test('dal Mac niente «← Indietro» su nessuna pagina', () => {
  const barra = leggi('components/BackBar.tsx')
  assert.match(barra, /className="indietro-barra hidden sticky/)
  assert.equal(/lg:block/.test(barra), false)
})

test('ogni pagina ha la testa del Mac: titolo, e il sottotitolo solo dove c’è un dato', () => {
  const testa = leggi('components/TestaMac.tsx')
  assert.match(testa, /className="hidden lg:block mb-4"/)
  assert.match(testa, /<h1 className="testa-mac-titolo">\{titolo\}<\/h1>/)
  assert.match(testa, /\{sottotitolo !== undefined && <p className="testa-mac-sotto">\{sottotitolo\}<\/p>\}/)
  const pagine: [string, RegExp][] = [
    ['app/prenotazioni/page.tsx', /<TestaMac titolo="Prenotazioni" sottotitolo=\{loading \|\| errore \? '' : sottotitoloPrenotazioni\(bookings\.length\)\}\s*comandi=\{<>\{ricerca\('w-\[calc\(340px\/var\(--zoom-pagina,1\)\)\]'\)\}\{nuova\}<\/>\}/],
    ['app/clienti/page.tsx', /<TestaMac titolo="Clienti" sottotitolo=\{loading \? '' : sottotitoloClienti\(guests\.length\)\}\s*comandi=\{<>\{ricerca\('w-\[calc\(340px\/var\(--zoom-pagina,1\)\)\]'\)\}\{nuovo\}<\/>\}/],
    ['app/pulizie/page.tsx', /<TestaMac titolo="Pulizie" sottotitolo=\{sottotitoloOggi\(td\)\} contenitore=\{24\} \/>/],
    ['app/statistiche/page.tsx', /<TestaMac titolo="Statistiche" sottotitolo=\{label\} \/>/],
    ['app/impostazioni/page.tsx', /<TestaMac titolo="Impostazioni" \/>/],
    ['components/spese/SpeseShell.tsx', /<div className="hidden lg:block px-4 pt-4"><TestaMac titolo="Spese" sottotitolo=\{sottotitoloSpese\(opzioniAttuali\.periodi, filtri\)\} \/><\/div>/],
  ]
  for (const [file, re] of pagine) assert.match(leggi(file), re, file)
  // dal telefono la ricerca e «+ Nuova» restano dov'erano
  assert.match(leggi('app/prenotazioni/page.tsx'), /\{ricerca\('mb-3 lg:hidden'\)\}/)
  assert.match(leggi('app/clienti/page.tsx'), /\{ricerca\('w-full mb-4 lg:hidden'\)\}/)
  // le pagine interne: stessa veste del titolo, bordo alto a 64 px
  for (const file of ['app/clienti/[id]/page.tsx', 'app/clienti/nuovo/page.tsx', 'app/richieste/nuova/page.tsx', 'app/richieste/[id]/modifica/page.tsx']) {
    const t = leggi(file)
    assert.match(t, /titolo-mac/, file)
    assert.match(t, /titolo-mac testa-mac-sopra/, file)
  }
  const css = leggi('app/maison.css')
  assert.match(css, /\.titolo-mac\.titolo-mac \{ font-family: var\(--font-cormorant\)[^}]*font-size: calc\(30px \/ var\(--zoom-pagina, 1\)\); font-weight: 400; line-height: 1; color: #241F1A;/)
  assert.match(css, /\.testa-mac-sopra \{ margin-top: calc\(64px \/ var\(--zoom-pagina, 1\) - 16px\); \}/)
  // le pagine vecchie dal Mac sono ingrandite del 20%: la testa lo sa e divide
  assert.match(leggi('components/MainContainer.tsx'), /lg:\[zoom:1\.2\] lg:\[--zoom-pagina:1\.2\]/)
  assert.match(leggi('components/TestaMac.tsx'), /marginTop: `calc\(64px \/ var\(--zoom-pagina, 1\) - \$\{contenitore\}px\)`/)
})
