// Calendario sul telefono (07/09/2026, pezzo 4): legenda, area di tocco,
// posizione da riprendere; più le prove di layout sul sorgente della pagina
// (come lib/prenotazioniLayout.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VOCI_LEGENDA, areaTocco, TOCCO_MIN, codificaPosizione, indicePosizione, CHIAVE_POSIZIONE } from './calendarioMobile.ts'

const pagina = readFileSync(new URL('../app/calendario/page.tsx', import.meta.url), 'utf8')
const legenda = readFileSync(new URL('../components/LegendaCalendario.tsx', import.meta.url), 'utf8')
const occorrenze = (testo: string, frammento: string) => testo.split(frammento).length - 1

test('legenda: sei voci, «Dal sito» tratteggiata, nessuna voce «Cambio camera»', () => {
  assert.equal(VOCI_LEGENDA.length, 6)
  assert.deepEqual(VOCI_LEGENDA.map(v => v.testo), ['Prenotazione', 'Bonifico attesa', 'Pagato', '1 letto extra occupato', '2 letti extra occupati', 'Dal sito (da confermare)'])
  assert.equal(VOCI_LEGENDA.filter(v => v.tratteggiata).length, 1)
  assert.ok(!VOCI_LEGENDA.some(v => /cambio camera/i.test(v.testo)))
})

test('area di tocco: almeno 44 px, centrata sulla barra; una barra già alta resta com’è', () => {
  assert.equal(TOCCO_MIN, 44)
  assert.deepEqual(areaTocco(50, 32), { top: 44, height: 44 })     // barra 32 px a top 50 → 6 px sopra e sotto
  assert.deepEqual(areaTocco(10, 60), { top: 10, height: 60 })
})

test('posizione: solo una data ISO, e solo se il giorno è disegnato', () => {
  const giorni = ['2026-09-05', '2026-09-06', '2026-09-07']
  assert.equal(codificaPosizione('2026-09-06'), '2026-09-06')
  assert.equal(codificaPosizione('boh'), '')
  assert.equal(indicePosizione('2026-09-06', giorni), 1)
  assert.equal(indicePosizione(' 2026-09-07 ', giorni), 2)
  assert.equal(indicePosizione('2026-10-01', giorni), null)
  assert.equal(indicePosizione(null, giorni), null)
  assert.equal(indicePosizione('', giorni), null)
  assert.equal(CHIAVE_POSIZIONE, 'ca_calendario_posizione')
})

test('layout della pagina: bottone «?» con etichetta, legenda in riga solo dal Mac, area di tocco sulle barre, posizione salvata prima di aprire una scheda', () => {
  assert.ok(occorrenze(pagina, 'aria-label="Legenda"') >= 1)
  assert.ok(occorrenze(pagina, '<PannelloLegenda') >= 1)
  assert.ok(occorrenze(pagina, 'isDesktop && !orizzontale') >= 1)          // legenda in riga solo dal Mac
  assert.ok(occorrenze(pagina, 'data-tocco') >= 1)
  assert.ok(occorrenze(pagina, 'areaTocco(') >= 1)
  assert.ok(occorrenze(pagina, 'ricordaPosizione()') >= 2)                  // prima di ogni router.push verso la scheda
  assert.ok(occorrenze(pagina, 'indicePosizione(') >= 1)
  assert.ok(occorrenze(legenda, 'min-h-[44px]') >= 1)                       // «Chiudi» toccabile
  assert.ok(occorrenze(legenda, 'role="dialog"') >= 1)
})
