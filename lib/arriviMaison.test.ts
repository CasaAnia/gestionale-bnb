// Gli Arrivi «Maison» (riferimento approvato da Ania il 29/09/2026:
// docs/design/arrivi-riferimento.html). Le regole pure delle schede (colore,
// orario, riga dell'arrivo, arrivi passati) e le prove sul sorgente della
// pagina, come lib/calendarioMaison.test.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ARRIVO_VUOTO, leggiArrivo, type Arrivo } from './arrivo.ts'
import {
  statoArrivo, orarioScheda, tintaArrivo, coloreRigaArrivo, rigaArrivoArrivi, rigaDateArrivi, arrivoPassato, primoTratto,
  ORARIO_MANCANTE, ARRIVO_AUTONOMO,
} from './arriviSchede.ts'
import { TINTE_ARRIVO, MATTONE, RIGA_NAVETTA_MANCA, VOCI_LEGENDA_ARRIVI, ICONE_LEGENDA_ARRIVI, OPACITA_ARRIVATA } from './calendarioMobile.ts'

const arrivo = (a: Partial<Arrivo>): Arrivo => ({ ...ARRIVO_VUOTO, ...a })
const struttura = (ora: string, navetta: Arrivo['navetta'], extra: Partial<Arrivo> = {}) => arrivo({ tipo: 'struttura', strutturaDa: ora, navetta, ...extra })

test('il colore per ogni combinazione: verde, ottone, blu', () => {
  // autonomo con l'orario → ottone; senza orario → blu
  assert.equal(statoArrivo(struttura('15:30', 'non_richiesta')), 'autonomo')
  assert.equal(statoArrivo(struttura('', 'non_richiesta')), 'manca')
  // navetta con autista e orario → verde; senza orario → blu
  assert.equal(statoArrivo(struttura('16:00', 'aldo')), 'ok')
  assert.equal(statoArrivo(struttura('', 'aldo')), 'manca')
  // da assegnare / da definire → blu anche con l'orario
  assert.equal(statoArrivo(struttura('11:00', 'da_assegnare')), 'manca')
  assert.equal(statoArrivo(struttura('12:00', 'da_definire')), 'manca')
  // tipo «Da definire» (nessun orario) → blu, qualunque navetta
  assert.equal(statoArrivo(arrivo({ tipo: 'da_definire', navetta: 'massimo' })), 'manca')
  // con un luogo esterno conta l'orario IN STRUTTURA (la stima di Ania), come il numero grande
  const malpensa = { tipo: 'luogo' as const, luogo: 'malpensa' as const, luogoDa: '14:15', navetta: 'aldo' as const, prelievo: '14:30' }
  assert.equal(statoArrivo(arrivo({ ...malpensa, stimaDa: '16:00' })), 'ok')
  assert.equal(statoArrivo(arrivo(malpensa)), 'manca')
  // una fascia oraria vale come l'ora precisa
  assert.equal(statoArrivo(struttura('18:30', 'alberto', { modoStruttura: 'fascia', strutturaA: '19:30' })), 'ok')
  // le tinte sono quelle del riferimento, definite una volta accanto al Calendario
  assert.deepEqual([TINTE_ARRIVO.ok.fondo, TINTE_ARRIVO.ok.filo], ['#BFDCC8', '#6C9A7C'])
  assert.deepEqual([TINTE_ARRIVO.autonomo.fondo, TINTE_ARRIVO.autonomo.filo], ['#E8D6AE', '#A8894F'])
  assert.deepEqual([TINTE_ARRIVO.manca.fondo, TINTE_ARRIVO.manca.filo], ['#C5D6E2', '#7D9DB0'])
  assert.equal(tintaArrivo('ok', true), TINTE_ARRIVO.dalSito)
  assert.equal(tintaArrivo('autonomo'), TINTE_ARRIVO.autonomo)
})

test('l’orario grande: «HH:MM» in struttura, altrimenti «?» in mattone (anche la riga sotto)', () => {
  assert.equal(orarioScheda(struttura('15:30', 'non_richiesta')), '15:30')
  assert.equal(orarioScheda(struttura('18:30', 'aldo', { modoStruttura: 'fascia', strutturaA: '19:30' })), '18:30')
  assert.equal(orarioScheda(arrivo({ tipo: 'luogo', luogo: 'linate', luogoDa: '13:00', stimaDa: '14:30', navetta: 'massimo' })), '14:30')
  assert.equal(orarioScheda(arrivo({ tipo: 'da_definire' })), ORARIO_MANCANTE)
  assert.equal(ORARIO_MANCANTE, '?')
  // le righe vecchie (solo check_in_time) si leggono come oggi
  assert.equal(orarioScheda(leggiArrivo({ check_in_time: '17:00', shuttle: 'no' })), '17:00')
  assert.equal(coloreRigaArrivo(arrivo({ tipo: 'da_definire' }), 'manca'), MATTONE)
  assert.equal(MATTONE, '#8C3B2E')
  assert.equal(coloreRigaArrivo(struttura('11:00', 'da_assegnare'), 'manca'), RIGA_NAVETTA_MANCA)
  assert.equal(coloreRigaArrivo(struttura('11:00', 'aldo'), 'ok'), undefined)
})

test('la riga dell’arrivo per ogni tipo, in forma breve su una riga', () => {
  assert.equal(rigaArrivoArrivi(struttura('15:30', 'non_richiesta')), ARRIVO_AUTONOMO)
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'malpensa', luogoDa: '14:15', stimaDa: '16:00', navetta: 'aldo', prelievo: '14:30' })),
    'atterra a Malpensa 14:15 · navetta Aldo, prelievo 14:30')
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'rogoredo', luogoDa: '10:40', stimaDa: '11:00', navetta: 'da_assegnare' })),
    'in treno a Rogoredo 10:40 · navetta da assegnare')
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'centrale', luogoDa: '11:30', stimaDa: '12:00', navetta: 'da_definire' })),
    'in treno a Centrale 11:30 · navetta da definire')
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'san_donato', stimaDa: '18:30', stimaA: '19:30', navetta: 'alberto', prelievo: '18:00' })),
    'in struttura 18:30–19:30 circa · navetta Alberto, prelievo 18:00 a San Donato')
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'da_definire' })), 'orario da chiedere')
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'da_definire', navetta: 'massimo' })), 'orario da chiedere · navetta Massimo')
  assert.equal(rigaArrivoArrivi(struttura('', 'da_definire')), 'orario da chiedere')
  // struttura con la fascia detta dalla cliente: la fascia intera, senza «circa»
  assert.equal(rigaArrivoArrivi(struttura('18:30', 'aldo', { modoStruttura: 'fascia', strutturaA: '19:30', prelievo: '18:00' })),
    'in struttura 18:30–19:30 · navetta Aldo, prelievo 18:00')
  // «Altro luogo…»: il testo scritto da Ania
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'altro', luogoAltro: 'Villa Rosa', luogoDa: '15:00', navetta: 'non_richiesta' })),
    'a Villa Rosa 15:00 · arrivo autonomo')
  // un luogo senza nessuna ora
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'linate', navetta: 'da_assegnare' })),
    'atterra a Linate · orario da chiedere · navetta da assegnare')
})

test('cambio camera: «· poi Lena» sul tratto che parte, «cambio camera · da Ambra» su quello che arriva, stesso colore', () => {
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'luogo', luogo: 'linate', luogoDa: '14:30', stimaDa: '15:10', navetta: 'da_assegnare' }), { poi: 'Lena' }),
    'atterra a Linate 14:30 · navetta da assegnare · poi Lena')
  assert.equal(rigaArrivoArrivi(arrivo({ tipo: 'da_definire' }), { da: 'Ambra' }), 'cambio camera · da Ambra')
  // il tratto che arriva prende il colore del primo tratto, anche con due cambi
  const archi = [{ fromId: 'a', toId: 'b' }, { fromId: 'b', toId: 'c' }]
  assert.equal(primoTratto('c', archi), 'a')
  assert.equal(primoTratto('b', archi), 'a')
  assert.equal(primoTratto('a', archi), 'a')
  assert.equal(primoTratto('x', [{ fromId: 'x', toId: 'y' }, { fromId: 'y', toId: 'x' }]), 'y')   // catena storta: si ferma
})

test('arrivi già avvenuti: attenuati a 0,5, «· arrivata» in coda alla prima riga', () => {
  assert.equal(arrivoPassato('2026-09-26', '2026-09-29'), true)
  assert.equal(arrivoPassato('2026-09-29', '2026-09-29'), false)   // chi arriva oggi non è ancora «arrivata»
  assert.equal(rigaDateArrivi('2026-09-26', '2026-10-01', { passato: true }), '26 set → 1 ott · 5 notti · arrivata')
  assert.equal(rigaDateArrivi('2026-10-04', '2026-10-06', { dalSito: true }), '4 → 6 ott · 2 notti · dal sito 🌐')
  assert.equal(rigaDateArrivi('2026-10-01', '2026-10-03'), '1 → 3 ott · 2 notti')
  assert.equal(OPACITA_ARRIVATA, 0.5)
})

test('la legenda degli Arrivi: le cinque voci del riferimento e la riga delle icone', () => {
  assert.deepEqual(VOCI_LEGENDA_ARRIVI.map(v => v.testo.split(' · ')[0].split(' (')[0]), ['Verde', 'Ottone', 'Blu', 'Dal sito, da confermare', 'Arrivo già avvenuto'])
  assert.deepEqual(VOCI_LEGENDA_ARRIVI.slice(0, 3).map(v => v.colore), ['#6C9A7C', '#A8894F', '#7D9DB0'])
  assert.equal(VOCI_LEGENDA_ARRIVI[3].tratteggiata, true)
  assert.equal(VOCI_LEGENDA_ARRIVI[4].attenuata, true)
  assert.match(ICONE_LEGENDA_ARRIVI, /^Sulla scheda: orario grande \(o «\?»\), icone e nome, poi luogo · mezzo · navetta con autista e prelievo\. Icone: 🔒 esclusiva/)
})

// ── Le prove sul sorgente della pagina ──────────────────────────────────────
import { readFileSync } from 'node:fs'
const leggi = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
const pagina = leggi('app/arrivi/page.tsx')

test('frecce a una settimana a «2 settimane», al 1° del mese a «Mese»; 90 giorni (7 prima, 83 dopo)', () => {
  assert.match(pagina, /scrollBy\(\{ left: direzione \* PASSO_FRECCE_QUINDICI \* CELL_W/)
  assert.match(pagina, /etichettaPrec=\{etichettaFreccia\(modo, -1\)\}/)
  assert.match(pagina, /const DAYS_TOTAL = 90\nconst DAYS_BEFORE = 7/)
  assert.match(pagina, /const CHIAVE_MODO = 'ca_calendario_modo'/)
})

test('il foglio si apre da ?apri=<id>, col nastro sul giorno prima, ed è il FoglioArrivo Maison', () => {
  assert.match(pagina, /const apri = idDaParametro\(window\.location\.search, 'apri'\)/)
  assert.match(pagina, /setPopup\(\{ id: daAprire\.id \}\)/)
  assert.match(pagina, /days\.findIndex\(d => toStr\(d\) === apriUrlRef\.current\) - 1\) \* CELL_W/)
  assert.match(pagina, /<FoglioArrivo key=\{cur\.id\} bookingId=\{cur\.id\}/)
  assert.match(pagina, /salvaPieno=\{\{ salvando: 'Salvo\.\.\.' \}\}/)
  assert.match(pagina, /\{arrivoInScheda\(a\)\.titolo\} · Navetta: \{navettaInScheda\(a\)\.titolo\}/)
  for (const t of ['Usa come l&apos;ultima volta', "'nascondi storico'", 'Vedi storico arrivi (', 'Apri prenotazione']) assert.ok(pagina.includes(t), t)
  assert.match(leggi('components/scheda/FoglioArrivo.tsx'), /export const ALTEZZA_FOGLIO_ARRIVO = 752/)
})

test('le schede della pagina: colore per stato, arrivi passati attenuati, stessi pezzi del Calendario, niente riga «🛏 extra»', () => {
  assert.match(pagina, /const tinta = tintaArrivo\(stato, isWebPending\)/)
  assert.match(pagina, /stileInterno=\{passato \? \{ opacity: OPACITA_ARRIVATA \} : undefined\}/)
  assert.match(pagina, /<SchedaNastro /)
  assert.match(pagina, /<RighelloNastro /)
  assert.doesNotMatch(pagina, /cal-extra|ombraNavetta/)
  assert.match(leggi('app/maison.css'), /\.cal-scheda-in \.tx > b \.hr \{ font-family: var\(--m-disp\); font-size: 19px; font-weight: 700;[^}]*color: #000; \}/)
})

test('dal Mac niente legenda in riga: «LEGENDA» sotto «Oggi» apre lo stesso foglio del telefono', () => {
  assert.doesNotMatch(pagina, /VociLegenda/)
  assert.match(pagina, /\{!loading && \(\n        <div className=\{`shrink-0 flex \$\{orizzontale \? 'px-2' : isDesktop \? 'px-4' : ''\}`\}>\n          <div className="cal-lg"/)
  assert.match(pagina, /<PannelloLegenda voci=\{VOCI_LEGENDA_ARRIVI\} icone=\{ICONE_LEGENDA_ARRIVI\}/)
  assert.doesNotMatch(pagina, /NEXT_PUBLIC_BUILD_TAG/)
})
