// Comportamenti di prima da conservare nella veste nuova delle Pulizie
// (rilievo di Codex e richiesta di Ania del 01/10/2026): recuperi «non
// annotati» ≠ zero esplicito, comandi e logica del timer, «perché questa data?».
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('recuperi: un foglio nuovo parte «non annotato» (null); zero solo con «Niente recuperato»', () => {
  const s = leggi('components/SchedaPulizia.tsx')
  assert.match(s, /federeScelte: !\(assetto\.matrimoniali && assetto\.ospiti === 1\), recuperi: null,/)
  assert.match(s, /onClick=\{\(\) => setBozza\(\{ \.\.\.bozza, recuperi: pezziVuoti\(\) \}\)\} data-niente-recuperato>Niente recuperato</)
  assert.match(s, /Recuperi non ancora annotati: puoi aggiungerli anche dopo\./)
  assert.match(s, /recuperi non ancora annotati/)
})

test('timer nel foglio: «Ferma e riporta i minuti» e «Azzera timer» come prima, niente riporto automatico', () => {
  const s = leggi('components/SchedaPulizia.tsx')
  assert.match(s, /<TimerPulizia foglio chiave=\{chiave\}[^>]*onMinuti=\{riportaMinuti\}/)
  assert.ok(!/riportaMinuti\(minutiTimer\(/.test(s), 'nessun riporto automatico dei minuti')
  assert.match(s, /premi «Ferma e riporta i minuti», scrivi i minuti effettivi oppure azzera il timer/)
  const t = leggi('components/TimerPulizia.tsx')
  const foglio = t.slice(t.indexOf('if (foglio) return'), t.indexOf('if (maison) return'))
  assert.match(foglio, />Ferma e riporta i minuti</)
  assert.match(foglio, />Azzera timer</)
  assert.match(foglio, /esegui\('azzera'\)/)
  const spazi = leggi('components/pulizie/FoglioSpaziComuni.tsx')
  assert.match(spazi, /<TimerPulizia foglio chiave=\{chiave\}[^>]*onMinuti=\{riporta\}/)
  assert.ok(!/useEffect/.test(spazi), 'nessun riporto automatico negli spazi comuni')
})

test('timer grande e spazi comuni: «Avvia» fermo con un altro timer in corso, avviso sempre visibile (come la Home)', () => {
  const t = leggi('components/TimerPulizia.tsx')
  const grande = t.slice(t.indexOf('if (grande)'), t.indexOf('if (foglio) return'))
  assert.match(grande, /disabled=\{!pronto \|\| \(!inCorso && !!altro\)\}/)
  assert.match(grande, /\{altroDescritto && <p className="pul-avviso" data-altro-timer>/)
  assert.match(leggi('components/pulizie/SpaziComuniOggi.tsx'), /disabled=\{occupato \|\| s\.stato !== 'pronto' \|\| !!altro\}/)
  assert.match(leggi('app/pulizie/page.tsx'), /^    <TimerInCorso pagina /m)
})

test('«perché questa data?» c\'è ancora sulle camere di Oggi', () => {
  assert.match(leggi('app/pulizie/page.tsx'), /cronologia: cronologiaCamera\(prenotazioni, room\.id, td, events, rooms\)/)
  assert.match(leggi('components/pulizie/SchedaCameraOggi.tsx'), /'nascondi la cronologia' : 'perché questa data\?'/)
})
