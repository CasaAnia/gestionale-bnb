// ============================================================================
// «SETT.» COMPLETATA (30/09/2026, «Sì, completa così» di Ania):
//   · telefono in ORIZZONTALE a «Sett.»: corsie 56, schede 44 su due righe
//     (riferimento S7 di docs/design/settimana-checklist.md), tocco ≥ 44;
//   · Arrivi a «Sett.» col telefono dritto: la riga dell'arrivo va a capo e si
//     legge anche su una notte, con la scheda più alta solo lì;
//   · i buchi liberi senza «+» sono una scelta confermata, non più una prova;
//   · Mac e telefono dritto nelle altre viste: misure di sempre.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { misureNastro, MISURE_NASTRO, CORSIA_H, SCHEDA_H, SCHEDA_TOP, ARIA_SCHEDA, FILO_SINISTRO } from './calendarioSchede.ts'
import { TOCCO_MIN, areaTocco, BUCHI_LIBERI_VISIBILI, GIORNO_SETT_PX } from './calendarioMobile.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')

test('quali misure: compatte SOLO col telefono in orizzontale a «Sett.»; Arrivi dritti a «Sett.» più alti; il resto come sempre', () => {
  for (const modo of ['mese', 'quindici']) for (const orizzontale of [false, true]) for (const arrivi of [false, true])
    assert.deepEqual(misureNastro({ modo, orizzontale, arrivi }), MISURE_NASTRO.normale, `${modo} ${orizzontale} ${arrivi}`)
  assert.deepEqual(misureNastro({ modo: 'settimana', orizzontale: true }), MISURE_NASTRO.compatta)
  assert.deepEqual(misureNastro({ modo: 'settimana', orizzontale: true, arrivi: true }), MISURE_NASTRO.compatta)
  assert.deepEqual(misureNastro({ modo: 'settimana', orizzontale: false }), MISURE_NASTRO.normale)
  assert.deepEqual(misureNastro({ modo: 'settimana', orizzontale: false, arrivi: true }), MISURE_NASTRO.arriviSett)
  // le misure di sempre non cambiano
  assert.deepEqual(MISURE_NASTRO.normale, { corsia: CORSIA_H, scheda: SCHEDA_H, sopra: SCHEDA_TOP, compatta: false })
  assert.deepEqual([CORSIA_H, SCHEDA_H, SCHEDA_TOP], [92, 72, 9])
  assert.deepEqual([MISURE_NASTRO.compatta.corsia, MISURE_NASTRO.compatta.scheda], [56, 44])
})

test('geometria: ogni scheda sta nella sua corsia, è alta almeno 44 e il tocco non sporge sulle corsie vicine', () => {
  for (const [nome, m] of Object.entries(MISURE_NASTRO)) {
    assert.ok(m.scheda >= TOCCO_MIN, `${nome}: scheda ${m.scheda} < ${TOCCO_MIN}`)
    assert.ok(m.sopra + m.scheda <= m.corsia, `${nome}: la scheda esce dalla corsia`)
    const t = areaTocco(m.sopra, m.scheda)
    assert.equal(t.height, m.scheda, `${nome}: area di tocco diversa dalla scheda`)
    assert.ok(t.top >= 0 && t.top + t.height <= m.corsia, `${nome}: il tocco sporge`)
  }
})

// Le altezze delle righe come le scrive app/maison.css (line-height 1,25)
const riga = (px: number) => px * 1.25
test('le righe stanno nella scheda: compatta su due righe, Arrivi dritti con la riga dell\'arrivo su tre', () => {
  const css = leggi('app/maison.css')
  // i valori usati qui sotto sono quelli del CSS
  assert.match(css, /\.cal-scheda-in \{ position: relative; height: 100%; overflow: clip; padding: 6px 0;[^}]*line-height: 1\.25; \}/)
  assert.match(css, /\.cal-scheda-in \.tx > em \{[^}]*font-size: 9px;[^}]*margin-bottom: 2px;/)
  assert.match(css, /\.cal-scheda-in \.tx > b \{[^}]*font-size: 14px;/)
  assert.match(css, /\.cal-scheda-in \.tx > small \{[^}]*font-size: 9\.5px;[^}]*margin-top: 2px;/)
  assert.match(css, /\.cal-scheda-in \.tx > b \.hr \{[^}]*font-size: 19px;/)
  assert.match(css, /\.cal-nastro\.compatta \.cal-scheda-in \{ padding: 3px 0; \}/)
  assert.match(css, /\.cal-nastro\.compatta \.cal-scheda-in \.tx > small \{ display: none; \}/)
  assert.match(css, /\.cal-nastro\.arrivi\.compatta \.cal-scheda-in \.tx > em \{ display: none; \}/)
  assert.match(css, /\.cal-nastro\.arrivi\.compatta \.cal-scheda-in \.tx > small \{ display: block; margin-top: 1px; \}/)
  assert.match(css, /\.cal-nastro\.arrivi\.compatta \.cal-scheda-in \.tx > b \.hr \{ font-size: 16px;/)
  assert.match(css, /\.cal-nastro\.arrivi\.sett \.cal-scheda-in \.tx > small \{ white-space: normal;[^}]*-webkit-line-clamp: 3;/)
  // compatta, Calendario e Richieste: date + nome
  assert.ok(3 * 2 + riga(9) + 2 + riga(14) <= MISURE_NASTRO.compatta.scheda)
  // compatta, Arrivi: orario (16) e nome + riga dell'arrivo
  assert.ok(3 * 2 + riga(16) + 1 + riga(9.5) <= MISURE_NASTRO.compatta.scheda)
  // Arrivi dritti a «Sett.»: date + orario (19) e nome + riga dell'arrivo su TRE righe
  assert.ok(6 * 2 + riga(9) + 2 + riga(19) + 2 + 3 * riga(9.5) <= MISURE_NASTRO.arriviSett.scheda)
})

test('la riga dell\'arrivo più lunga misurata (155 px) sta in tre righe su UNA notte a «Sett.»', () => {
  // larghezza del testo di una notte negli Arrivi: giorno − aria ai lati − 16 − filo (app/arrivi/page.tsx)
  const testo = GIORNO_SETT_PX - ARIA_SCHEDA * 2 - 16 - FILO_SINISTRO
  assert.ok(testo >= 119, `testo di una notte ${testo}`)
  // «Malpensa 14:15 · Aldo, prelievo 14:30»: 155 px misurati il 30/09 (settimana-checklist S6)
  assert.ok(155 <= testo * 2, 'ci vogliono due righe, ne abbiamo tre')
  assert.match(leggi('app/arrivi/page.tsx'), /const larghezzaTesto = \(da: number, a: number\) => Math\.max\(0, parteInVista\(da, a\) - 16 - FILO_SINISTRO\)/)
})

test('le tre pagine usano le stesse misure e le passano a schede, tenute e buchi', () => {
  const cal = leggi('app/calendario/page.tsx')
  const arr = leggi('app/arrivi/page.tsx')
  const ric = leggi('components/richieste/NastroRichieste.tsx')
  assert.match(cal, /const misure = misureNastro\(\{ modo, orizzontale \}\)/)
  assert.match(arr, /const misure = misureNastro\(\{ modo, orizzontale, arrivi: true \}\)/)
  assert.match(ric, /const misure = misureNastro\(\{ modo, orizzontale \}\)/)
  for (const [nome, src] of [['calendario', cal], ['arrivi', arr], ['richieste', ric]] as const) {
    assert.equal(/\b(CORSIA_H|SCHEDA_H|SCHEDA_TOP)\b/.test(src), false, `${nome}: misura fissa rimasta`)
    assert.match(src, /cal-nastro .*misure\.compatta \? 'compatta'/, nome)
  }
  for (const src of [cal, ric]) {
    // dal 02/10/2026 il Calendario passa anche lo speso del cliente
    assert.match(src, /onTocca=\{tocca\} misure=\{misure\}( speso=\{spesoPerBooking\[booking\.id\]\})? \/>/)
    assert.match(src, /onTocca=\{(setBarraAperta|toccaTenuta)\} misure=\{misure\} \/>/)
  }
  assert.match(arr, /areaTocco\(rowTop \+ misure\.sopra, misure\.scheda\)/)
  assert.match(arr, /altezzaScheda=\{misure\.scheda\}/)
  // l'orizzontale è quello del TELEFONO: dal Mac le misure restano quelle di sempre
  for (const src of [cal, arr]) assert.match(src, /const orizzontale = useOrizzontaleTelefono\(\)/)
  assert.match(leggi('lib/richiesteVista.ts'), /MEDIA_ORIZZONTALE_TELEFONO = '\(orientation: landscape\) and \(max-height: 520px\)'/)
  // i componenti condivisi: misure facoltative, predefinite quelle di sempre
  const scheda = leggi('components/calendario/SchedaPrenotazione.tsx')
  assert.equal((scheda.match(/misure = MISURE_NASTRO\.normale/g) || []).length, 2)
  assert.match(leggi('components/calendario/Nastro.tsx'), /altezzaScheda = SCHEDA_H/)
})

test('buchi liberi senza «+»: scelta confermata, non più prova', () => {
  assert.equal(BUCHI_LIBERI_VISIBILI, false)
  assert.match(leggi('lib/calendarioMobile.ts'), /SCELTA CONFERMATA da Ania il 30\/09\/2026/)
  for (const f of ['app/calendario/page.tsx', 'app/arrivi/page.tsx']) {
    const src = leggi(f)
    assert.match(src, /SCELTA CONFERMATA da Ania il 30\/09\/2026/, f)
    assert.equal(/PROVA del 29\/09\/2026 \(A3\)/.test(src), false, f)
  }
})
