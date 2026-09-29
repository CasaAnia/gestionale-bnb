// Il calendario «Maison» (riferimento approvato da Ania il 29/09/2026:
// docs/design/calendario-riferimento.html). Le regole pure delle schede, dei
// buchi e del foglietto, più le prove sul sorgente della pagina (come
// lib/calendarioMobile.test.ts).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PASSO_FRECCE_QUINDICI, etichettaFreccia, colonnaMinTelefono, GIORNO_TELEFONO } from './calendarioMobile.ts'

const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const pagina = leggi('app/calendario/page.tsx')

test('frecce: a «2 settimane» una settimana (7 giorni), a «Mese» il 1° del mese; le etichette lo dicono', () => {
  assert.equal(PASSO_FRECCE_QUINDICI, 7)
  assert.equal(etichettaFreccia('quindici', -1), 'Una settimana prima')
  assert.equal(etichettaFreccia('quindici', 1), 'Una settimana dopo')
  assert.equal(etichettaFreccia('mese', -1), 'Mese precedente')
  assert.equal(etichettaFreccia('mese', 1), 'Mese successivo')
  // la pagina sposta di PASSO_FRECCE_QUINDICI, non più di GIORNI_QUINDICINA
  assert.match(pagina, /scorriDiGiorni\(direzione \* PASSO_FRECCE_QUINDICI\)/)
  assert.doesNotMatch(pagina, /scorriDiGiorni\(direzione \* GIORNI_QUINDICINA\)/)
  assert.match(pagina, /aria-label=\{etichettaFreccia\(modo, -1\)\}/)
  assert.match(pagina, /aria-label=\{etichettaFreccia\(modo, 1\)\}/)
})

test('larghezza del giorno sul telefono: 60 px a «2 settimane», 40 a «Mese»', () => {
  assert.deepEqual(GIORNO_TELEFONO, { quindici: 60, mese: 40 })
  assert.equal(colonnaMinTelefono('quindici'), 60)
  assert.equal(colonnaMinTelefono('mese'), 40)
  assert.match(pagina, /colonnaMinTelefono\(modo\)/)
})

test('la riga di navigazione: l’interruttore di sempre nella veste Maison, periodo in Cormorant', () => {
  assert.match(pagina, /<InterruttorePillola voci=\{VOCI_GRIGLIA\}[^>]*maison \/>/)
  const pillola = leggi('components/InterruttorePillola.tsx')
  assert.match(pillola, /className=\{`cal-pill \$\{className\}`\}/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-pill button\.on span \{ background: var\(--m-ink\); color: #F6F2EA; \}/)
  assert.match(css, /\.cal-nav \.per \{ font-family: var\(--m-disp\); font-size: 16px;/)
})

// ── Le schede (pezzo 4) ─────────────────────────────────────────────────────
import {
  statoScheda, tintaScheda, testoStato, rigaDate, iconeScheda, rigaSotto, rigaArrivo, buchiLiberi, rigaBuco, geometriaScheda,
  indirizzoNuova, filoObliquo, CORSIA_H, SCHEDA_H, ORARIO_DA_CHIEDERE,
} from './calendarioSchede.ts'
import { TINTE_SCHEDA, ROSSO_LETTO, schiarisci, TOCCO_MIN } from './calendarioMobile.ts'
import { ARRIVO_VUOTO, type Arrivo } from './arrivo.ts'

const arrivo = (a: Partial<Arrivo>): Arrivo => ({ ...ARRIVO_VUOTO, ...a })

test('le quattro righe della scheda, per ogni stato', () => {
  // prenotazione da incassare, con l'arrivo e la navetta
  assert.equal(rigaDate('2026-10-01', '2026-10-03'), '1 → 3 ott · 2 notti')
  assert.equal(rigaDate('2026-09-26', '2026-10-01'), '26 set → 1 ott · 5 notti')
  assert.equal(rigaSotto({ ospiti: 2, stato: testoStato(statoScheda({})) }), '2 ospiti · da incassare')
  assert.equal(rigaArrivo(arrivo({ tipo: 'luogo', luogo: 'linate', luogoDa: '13:40', stimaDa: '14:30', navetta: 'massimo' })), 'arriva 14:30 · Linate, Massimo')
  // pagato con un letto extra
  assert.equal(rigaSotto({ ospiti: 3, stato: testoStato(statoScheda({ pagato: true })), letti: 1 }), '3 ospiti · pagato · 1 letto extra')
  assert.equal(rigaArrivo(arrivo({ tipo: 'struttura', strutturaDa: '15:10', navetta: 'non_richiesta' })), 'arriva 15:10 · autonomo')
  // bonifico in attesa con due letti
  assert.equal(rigaSotto({ ospiti: 4, stato: testoStato(statoScheda({ bonifico: true })), letti: 2 }), '4 ospiti · bonifico in attesa · 2 letti extra')
  // senza nessun orario: «orario da chiedere»
  assert.equal(rigaArrivo(ARRIVO_VUOTO), ORARIO_DA_CHIEDERE)
  assert.equal(rigaArrivo(arrivo({ tipo: 'luogo', luogo: 'malpensa', navetta: 'aldo' })), 'orario da chiedere')
  // la richiesta dal sito da confermare
  const sito = statoScheda({ status: 'in_attesa', source: 'sito_web', bonifico: true })
  assert.equal(sito, 'dalSito')
  assert.equal(rigaDate('2026-10-04', '2026-10-06', 'dalSito'), '4 → 6 ott · 2 notti · dal sito 🌐')
  assert.equal(rigaSotto({ ospiti: 1, stato: testoStato(sito) }), '1 ospite · da confermare')
  // la camera tenuta
  assert.equal(rigaDate('2026-10-03', '2026-10-05', 'opzione'), '3 → 5 ott · 2 notti · in opzione')
  assert.equal(rigaSotto({ ospiti: 2, stato: 'scade alle 18:00' }), '2 ospiti · scade alle 18:00')
  // le icone PRIMA del nome, nell'ordine 🔒 ⭐ 🧾 🛏 ⇄ (e 🌐)
  assert.equal(iconeScheda({ cambio: true, letto: true, ricevuta: true, ottimo: true, esclusiva: true, dalSito: true }), '🔒 ⭐ 🧾 🛏 ⇄ 🌐')
  assert.equal(iconeScheda({ ottimo: true, letto: true }), '⭐ 🛏')
  assert.equal(iconeScheda({}), '')
})

test('il colore dice SOLO il pagamento (o «Nota e colore»): il letto extra non cambia la tinta', () => {
  assert.deepEqual(tintaScheda(statoScheda({})), TINTE_SCHEDA.prenotazione)
  assert.deepEqual(tintaScheda(statoScheda({ bonifico: true })), TINTE_SCHEDA.bonifico)
  assert.deepEqual(tintaScheda(statoScheda({ pagato: true })), TINTE_SCHEDA.pagato)
  assert.deepEqual(tintaScheda(statoScheda({}, true)), TINTE_SCHEDA.pagato)            // acconti che coprono tutte le notti
  assert.deepEqual(tintaScheda(statoScheda({ color: '#f97316' })), TINTE_SCHEDA.esclusiva)
  assert.deepEqual(tintaScheda(statoScheda({ color: '#f97316', pagato: true })), TINTE_SCHEDA.pagato)   // come oggi: il pagamento vince
  assert.equal(TINTE_SCHEDA.prenotazione.fondo, '#C5D6E2'); assert.equal(TINTE_SCHEDA.prenotazione.filo, '#7D9DB0')
  assert.equal(TINTE_SCHEDA.bonifico.fondo, '#D3CCE8'); assert.equal(TINTE_SCHEDA.pagato.fondo, '#BFDCC8')
  assert.equal(TINTE_SCHEDA.tenuta.fondo, '#E8D6AE'); assert.equal(TINTE_SCHEDA.esclusiva.fondo, '#F9CFA6')
  assert.equal(TINTE_SCHEDA.dalSito.fondo, '#EAF3EE'); assert.equal(TINTE_SCHEDA.dalSito.filo, '#2D6A4F')
  // gli altri colori di «Nota e colore»: filo pieno, fondo schiarito
  const viola = tintaScheda(statoScheda({ color: '#a855f7' }), '#a855f7')
  assert.equal(viola.filo, '#a855f7')
  assert.equal(viola.fondo, schiarisci('#a855f7'))
  assert.equal(schiarisci('#000000', 0.5), '#808080')
  // il filo rosso dei letti è uno, con uno o con due letti, e sta DENTRO la scheda
  const css = leggi('app/maison.css')
  assert.equal(ROSSO_LETTO, '#D0261B')
  assert.match(css, /\.cal-scheda-in\[data-letto\] \{ box-shadow: inset 0 -3px 0 #D0261B; \}/)
  assert.match(pagina, /data-letto=\{hasExtraBed \? lettiPoolPrenotazione\(booking\) : undefined\}/)
  // niente più righe diagonali né colore-letto sulla barra
  assert.doesNotMatch(pagina, /repeating-linear-gradient/)
  assert.doesNotMatch(pagina, /getDayColor/)
  assert.doesNotMatch(pagina, /coloreLettiPerGiorno/)
})

test('i buchi liberi: le date giuste fra una scheda e l’altra, prima della prima e dopo l’ultima', () => {
  const buchi = buchiLiberi([
    { da: '2026-10-01', a: '2026-10-03' },
    { da: '2026-10-04', a: '2026-10-06' },
    { da: '2026-10-05', a: '2026-10-08' },   // sovrapposta: conta come una
  ], '2026-09-28', '2026-10-12')
  assert.deepEqual(buchi, [
    { da: '2026-09-28', a: '2026-10-01' },
    { da: '2026-10-03', a: '2026-10-04' },
    { da: '2026-10-08', a: '2026-10-12' },
  ])
  assert.equal(rigaBuco(buchi[1]), '3 → 4 ott')
  assert.equal(rigaBuco(buchi[0]), '28 set → 1 ott')
  assert.deepEqual(buchiLiberi([], '2026-10-01', '2026-10-03'), [{ da: '2026-10-01', a: '2026-10-03' }])
  assert.deepEqual(buchiLiberi([{ da: '2026-09-01', a: '2026-12-01' }], '2026-10-01', '2026-10-03'), [])
  // il tocco apre la nuova prenotazione con camera e arrivo: lo stesso indirizzo di oggi
  assert.equal(indirizzoNuova('abc', '2026-10-03'), '/nuova-prenotazione?room_id=abc&check_in=2026-10-03')
  assert.match(pagina, /data-buco=/)
  assert.equal((pagina.match(/router\.push\(`\/nuova-prenotazione\?room_id=\$\{room\.id\}&check_in=\$\{dateStr\}`\)/g) || []).length, 2)   // buco e giorno libero
})

test('misure: corsie 92, schede 72 (area di tocco ≥ 44), larghezza = notti × giorno − 6', () => {
  assert.equal(CORSIA_H, 92)
  assert.equal(SCHEDA_H, 72)
  assert.ok(SCHEDA_H >= TOCCO_MIN)
  assert.deepEqual(geometriaScheda(2, 5, 60), { left: 123, width: 174 })
  assert.deepEqual(geometriaScheda(0, 1, 40), { left: 3, width: 34 })
})

test('cambio camera: «poi Lena» sul tratto che parte, «da Ambra» su quello che arriva, «⇄» e «cambio camera»', () => {
  assert.equal(rigaSotto({ ospiti: 2, stato: 'da incassare', poi: 'Lena' }), '2 ospiti · poi Lena · da incassare')
  assert.equal(rigaSotto({ ospiti: 2, stato: 'da incassare', da: 'Ambra' }), '2 ospiti · da Ambra · da incassare')
  assert.match(pagina, /poi: poiCamera\[booking\.id\], da: daCamera\[booking\.id\]/)
  assert.match(pagina, /arrivo: isWebPending \? null : hasIncoming \? CAMBIO_CAMERA :/)
  // il filo obliquo sta PROPRIO sul bordo tagliato, largo quanto il filo sinistro, del colore del filo
  assert.equal(filoObliquo('destra', 100, 72), 'polygon(96px 0px, 100px 0px, 86px 72px, 82px 72px)')
  assert.equal(filoObliquo('sinistra', 100, 72), 'polygon(0px 0px, 4px 0px, 18px 72px, 14px 72px)')
  assert.match(pagina, /style=\{\{ background: tinta\.filo, clipPath: filoObliquo\('destra', g\.width, SCHEDA_H\) \}\}/)
  assert.match(pagina, /style=\{\{ background: tinta\.filo, clipPath: filoObliquo\('sinistra', g\.width, SCHEDA_H\) \}\}/)
  // COLORI_CAMBIO non si usa più nel calendario (resta per Arrivi e Richieste)
  assert.doesNotMatch(pagina, /COLORI_CAMBIO|coloriCatene/)
})

test('ricerca attiva: la scheda trovata col contorno verde, le altre attenuate a 0,35, i buchi normali', () => {
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-scheda\.trovata \{ outline: 2px solid #2D6A4F;/)
  assert.match(css, /\.cal-nastro \.cal-scheda\.dim\.cerca \{ opacity: \.35; \}/)
  assert.match(css, /\.cal-scheda\.dim \{ opacity: \.3; \}/)
  assert.match(css, /\.cal-scheda\.catena \{ filter: drop-shadow\(0 2px 4px rgba\(0,0,0,\.25\)\); \}/)
  assert.match(pagina, /isDimmed \? \(searchAttiva \? 'dim cerca' : 'dim'\)/)
  // i buchi non hanno mai la classe «dim»
  assert.doesNotMatch(pagina, /cal-buco[^"]*dim/)
})

test('il nastro: filo verde di oggi, fili ottone dei mesi, righello «lun 28» con domeniche e oggi', () => {
  const css = leggi('app/maison.css')
  assert.match(pagina, /data-filo-oggi/)
  assert.match(css, /\.cal-filo-oggi \{ position: absolute; width: 1px; background: #2D6A4F;/)
  assert.match(css, /\.cal-filo-mese \{ position: absolute; width: 2px; background: #A8894F; opacity: \.7;/)
  assert.match(css, /\.cal-righello > span\.dom \{ color: #B08968; \}/)
  assert.match(css, /\.cal-righello > span\.oggi \{ color: #2D6A4F; font-weight: 600; \}/)
  assert.match(css, /\.cal-righello \{ position: sticky; top: 0;/)
  // la riga «🛏 extra» in rosso acceso a 2/2
  assert.match(pagina, /background: isFull \? COLORE_LETTI_ESAURITI : undefined/)
  assert.match(css, /\.cal-extra \.xl \{[^}]*color: #8A1E15; background: #F8D9D6;/)
})
