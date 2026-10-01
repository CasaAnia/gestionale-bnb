// Calendario sul telefono (07/09/2026, pezzo 4): legenda, area di tocco,
// posizione da riprendere; più le prove di layout sul sorgente della pagina
// (come lib/prenotazioniLayout.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VOCI_LEGENDA, ICONE_LEGENDA, ROSSO_LETTO, areaTocco, TOCCO_MIN, codificaPosizione, indicePosizione, CHIAVE_POSIZIONE } from './calendarioMobile.ts'

const pagina = readFileSync(new URL('../app/calendario/page.tsx', import.meta.url), 'utf8') + readFileSync(new URL('../components/calendario/SchedaPrenotazione.tsx', import.meta.url), 'utf8')
const legenda = readFileSync(new URL('../components/LegendaCalendario.tsx', import.meta.url), 'utf8')
const occorrenze = (testo: string, frammento: string) => testo.split(frammento).length - 1

test('legenda (29/09/2026): otto voci nell’ordine del riferimento, «Dal sito» tratteggiata, le due voci dei letti in rosso, nessuna voce «Cambio camera»', () => {
  assert.equal(VOCI_LEGENDA.length, 8)
  assert.deepEqual(VOCI_LEGENDA.map(v => v.testo), [
    'Prenotazione', 'Bonifico in attesa', 'Pagato', 'Dal sito, da confermare', 'Camera tenuta in opzione (3 ore)',
    'Letto extra in questa prenotazione (filo rosso sotto la scheda)', 'Letti extra finiti quella notte (riga «🛏 extra» rossa, 2/2)',
    '🔒 Esclusiva e altri colori scelti in «Nota e colore»',
  ])
  assert.equal(VOCI_LEGENDA.filter(v => v.tratteggiata).length, 1)
  assert.equal(VOCI_LEGENDA.filter(v => v.colore === ROSSO_LETTO).length, 2)
  assert.equal(ROSSO_LETTO, '#D0261B')
  assert.ok(!VOCI_LEGENDA.some(v => /cambio camera/i.test(v.testo)))
  assert.ok(!VOCI_LEGENDA.some(v => /letti? extra occupat/i.test(v.testo)))
  assert.equal(ICONE_LEGENDA, 'Icone, prima del nome: ⭐ ottimo · 🧾 ricevuta · 🛏 letto in più · ⇄ cambio camera · 🌐 dal sito · 🔒 esclusiva')
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

test('layout della pagina: «Legenda» sotto «Oggi» con etichetta, anche dal Mac (niente più legenda in riga), area di tocco sulle schede, posizione salvata prima di aprire una scheda', () => {
  assert.ok(occorrenze(pagina, 'aria-label="Legenda"') >= 1)
  assert.ok(occorrenze(pagina, '>Legenda</button>') >= 1)                   // la parola, non più il «?» (29/09/2026)
  assert.ok(occorrenze(pagina, '<PannelloLegenda') >= 1)
  // dal Mac niente più legenda in riga sotto i mesi (29/09/2026): la stessa «LEGENDA» del telefono
  assert.equal(occorrenze(pagina, 'VociLegenda'), 0)
  assert.equal(occorrenze(pagina, 'legendaInRiga'), 0)
  assert.equal(occorrenze(legenda, 'VociLegenda'), 0)
  assert.ok(occorrenze(pagina, '{!loading && (\n        <div className={`shrink-0 flex ${orizzontale ? \'px-2\' : isDesktop ? \'px-4\' : \'\'}`}>\n          <div className="cal-lg cal-lg-staccata"') === 1)
  assert.ok(occorrenze(legenda, 'larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC}') === 1)   // dal Mac centrato a 620 px
  // la scheda (con data-tocco) è il pezzo condiviso con gli Arrivi (29/09/2026)
  assert.ok(occorrenze(pagina, '<SchedaNastro') >= 1)
  assert.ok(occorrenze(readFileSync(new URL('../components/calendario/Nastro.tsx', import.meta.url), 'utf8'), 'data-tocco') >= 1)
  assert.ok(occorrenze(pagina, 'areaTocco(') >= 1)
  assert.ok(occorrenze(pagina, 'ricordaPosizione()') >= 2)                  // prima di ogni router.push verso la scheda
  assert.ok(occorrenze(pagina, 'indicePosizione(') >= 1)
  // la legenda dal telefono è un foglio Maison ad altezza fissa, con «Chiudi» e la riga delle icone
  assert.ok(occorrenze(legenda, '<FoglioMaison') >= 1)
  assert.ok(occorrenze(legenda, 'altezza = ALTEZZA_LEGENDA') >= 1)      // la stessa legenda, con le voci degli Arrivi quando le passano
  assert.ok(occorrenze(legenda, 'altezza={altezza}') >= 1)
  assert.ok(occorrenze(legenda, '<PiedeMaison testoAnnulla="Chiudi" onAnnulla={onChiudi} />') >= 1)   // regola dei fogli (01/10/2026)
  assert.ok(occorrenze(legenda, 'icone = ICONE_LEGENDA') >= 1)
  assert.ok(occorrenze(legenda, '{icone}') >= 1)
})
