// ============================================================================
// LA BARRA IN ALTO DEL TELEFONO NELLE PAGINE MAISON (Ania, 29/09/2026).
// Bianca, 52 px, filo sotto #E8E3DA; freccia ‹ Jost 300 20 px #241F1A con
// area di tocco 44 px; titolo maiuscoletto 10,5 px, .22em, #6E6558. Sotto, la
// testa di pagina (TestaPagina `maison`) non riserva lo spazio del titolo
// nascosto: la ricerca sta 16 px sotto la barra. Dal Mac non cambia nulla.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('la barra Maison vale per TUTTE le pagine (29/09/2026); Home, Nuova e Scheda restano senza', () => {
  const barra = leggi('components/MobileTopBar.tsx')
  // una barra sola: niente più elenco di pagine Maison né la barra crema di prima
  assert.equal(/PAGINE_MAISON|bg-cream\/95|h-12/.test(barra), false)
  assert.equal((barra.match(/<header /g) || []).length, 1)
  assert.match(barra, /barra-alta barra-maison lg:hidden fixed top-0 left-0 right-0 z-40 h-\[52px\]/)
  // area di tocco della freccia: 44 px
  assert.match(barra, /h-11 w-11/)
  assert.match(barra, /pathname === '\/' \|\| pathname === '\/nuova-prenotazione' \|\| pathname\.startsWith\('\/scheda\/'\)( \|\| pathname\.startsWith\('\/richieste\/'\))?( \|\| pathname\.startsWith\('\/clienti\/'\))?\) return null/)
})

test('la barra Maison ha le misure e i colori decisi', () => {
  const css = leggi('app/maison.css')
  assert.match(css, /\.barra-maison \{ background: #FFFFFF; border-bottom: 1px solid #E8E3DA; \}/)
  assert.match(css, /\.barra-maison \.freccia \{[^}]*font-weight: 300; font-size: 20px;[^}]*color: #241F1A;/)
  assert.match(css, /\.barra-maison \.titolo \{[^}]*font-size: 10\.5px; letter-spacing: \.22em; text-transform: uppercase; color: #6E6558;/)
  // il contenuto parte sotto la barra, solo dal telefono, su tutte le pagine
  assert.match(leggi('app/layout.tsx'), /main className="contenuto min-h-screen pt-\[52px\] lg:pt-0/)
  // e tutto ciò che si ferma sotto la barra si ferma a 52 px, mai più a 48
  for (const f of ['components/TestaPagina.tsx', 'components/AvvisoConnessione.tsx', 'components/spese/SpeseShell.tsx']) {
    assert.equal(/\btop-12\b/.test(leggi(f)), false, `${f}: ancora top-12`)
  }
  // girati a schermo intero la fascia torna in cima anche sotto la barra Maison
  assert.match(leggi('app/globals.css'), /body\[data-schermo-intero\] \.top-12, body\[data-schermo-intero\] \.top-\\\[52px\\\] \{ top: 0 !important; \}/)
})

test('TestaPagina maison: dal telefono niente spazio del titolo, ferma a 52 px', () => {
  const testa = leggi('components/TestaPagina.tsx')
  assert.match(testa, /export const FASCIA = 'shrink-0 sticky top-\[52px\] lg:top-0 z-40 px-4 pt-4 pb-2 bg-cream\/95 backdrop-blur-sm'/)
  assert.match(testa, /\$\{maison \? ' max-lg:hidden' : ''\}/)
  // Calendario e Arrivi la usano insieme, così restano allineate
  assert.ok(leggi('app/calendario/page.tsx').includes('<TestaPagina titolo="Calendario" maison desktop'))
  assert.ok(leggi('app/arrivi/page.tsx').includes('<TestaPagina titolo="Arrivi" maison desktop'))
  // e dal 29/09/2026 anche le Richieste: le tre pagine restano allineate
  assert.ok(leggi('app/richieste/page.tsx').includes('<TestaPagina titolo="Richieste" titoloNascosto maison desktop'))
})
