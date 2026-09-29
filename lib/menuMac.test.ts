// Menu del Mac «Maison» (riferimento approvato da Ania il 29/09/2026:
// docs/design/menu-mac-riferimento.html, colonna M2).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const nav = leggi('components/BottomNav.tsx')
const mac = nav.slice(nav.indexOf('export const desktopNavGroups'), nav.indexOf('function RequestBadge'))
const colonna = nav.slice(nav.indexOf('<nav className="mz-lato'))

test('le voci del Mac sono nell’ordine dato, con le etichette dei gruppi', () => {
  const voci = [...mac.matchAll(/label: '([^']+)', Icon/g)].map(m => m[1])
  assert.deepEqual(voci, ['Home', 'Calendario', 'Richieste', 'Arrivi', 'Pulizie', 'Prenotazioni', 'Clienti', 'Spese B&B', 'Spese Famiglia', 'Statistiche', 'Impostazioni'])
  const gruppi = [...mac.matchAll(/^    label: (null|'[^']+')/gm)].map(m => m[1])
  assert.deepEqual(gruppi, ['null', "'Ogni giorno'", "'Archivio'"])
  assert.match(mac, /\{ href: '\/impostazioni', label: 'Impostazioni', Icon: Settings \}/)
})

test('«Nuova» non c’è nel menu del Mac ma resta sul telefono e nelle pagine', () => {
  assert.doesNotMatch(mac, /nuova-prenotazione|'Nuova'/)
  assert.doesNotMatch(colonna, /nuova/i)
  assert.match(leggi('components/maison/StrisciaFoto.tsx'), /HREF_NUOVA = '\/nuova-prenotazione'/)
  assert.match(leggi('app/prenotazioni/page.tsx'), /<Link href="\/nuova-prenotazione"/)
  assert.match(leggi('app/calendario/page.tsx'), /router\.push\(`\/nuova-prenotazione\?room_id=/)
})

test('bollini come oggi: calendario dal sito, richieste nuove in ottone e in attesa in blu', () => {
  assert.match(colonna, /item\.href === '\/calendario' && webCount !== 0 && <span className="bds"><RequestBadge count=\{webCount\} \/><\/span>/)
  assert.match(colonna, /<RequestBadge count=\{richiesteCount\} \/><RequestBadge count=\{inAttesaRisposta\} colore="blu" \/>/)
  assert.match(nav, /if \(count === 0\) return null/)
  assert.match(nav, /stato === 'errore' \? '!'/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.mz-lato a \.bd \{ font-size: 10px; color: #F6F2EA; background: #A8894F; border-radius: 999px; padding: 0 6px; line-height: 16px; height: 16px;/)
  assert.match(css, /\.mz-lato a \.bd\.blu \{ background: #7D9DB0; \}/)
  assert.match(css, /\.mz-lato a \.bds \{ margin-left: auto; display: flex; gap: 6px; \}/)
})

test('la versione sta in fondo al menu del Mac e da nessun’altra parte', () => {
  assert.match(colonna, /<p className="ft" data-versione>v\. \{process\.env\.NEXT_PUBLIC_BUILD_TAG\}<\/p>/)
  assert.match(leggi('app/maison.css'), /\.mz-lato \.ft \{ position: absolute; bottom: 18px;[^}]*font-size: 10px; color: #8A8072; letter-spacing: \.08em; \}/)
  for (const f of ['app/calendario/page.tsx', 'app/arrivi/page.tsx', 'components/LegendaCalendario.tsx', 'components/RigaMesi.tsx']) {
    assert.doesNotMatch(leggi(f), /NEXT_PUBLIC_BUILD_TAG/)
  }
  assert.equal(leggi('components/BottomNav.tsx').split('NEXT_PUBLIC_BUILD_TAG').length - 1, 1)
})

test('colonna da 200 px, marchio senza cerchio, voci attive col filo d’ottone', () => {
  const css = leggi('app/maison.css')
  assert.match(css, /width: 200px; background: #F6F2EA; border-right: 1px solid #E1D9CB;\s*padding: 34px 0 0;/)
  assert.match(css, /\.mz-lato a\.on::before \{ content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; background: #A8894F; \}/)
  assert.match(colonna, /<div className="wm"><b>Casa Ania<\/b><small>Rozzano<\/small><\/div>/)
  assert.doesNotMatch(colonna, />CA</)
  assert.match(colonna, /<item\.Icon strokeWidth=\{1\.3\} aria-hidden \/>/)
  assert.match(leggi('app/layout.tsx'), /lg:pl-\[200px\]/)
  assert.match(nav, /group\.items\.filter\(item => visible\(item\.href\)\)/)
})

test('la barra bassa del telefono non cambia', () => {
  assert.match(nav, /export const VOCI_BARRA = \[/)
  assert.match(nav, /<nav className="barra-bassa lg:hidden/)
  assert.match(nav, /data-bollino="ottone" aria-label="Richieste da gestire"/)
})
