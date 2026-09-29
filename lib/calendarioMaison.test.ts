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
// i pezzi del nastro condivisi con gli Arrivi (29/09/2026): righello, fili, corsie, buchi, schede
const nastro = leggi('components/calendario/Nastro.tsx')

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
  assert.match(pagina, /letto=\{hasExtraBed \? lettiPoolPrenotazione\(booking\) : undefined\}/)
  assert.match(nastro, /data-letto=\{letto \|\| undefined\}/)
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
  // le date VERE anche quando il buco comincia fuori vista (la prenotazione prima finisce il 20 set)
  assert.deepEqual(buchiLiberi([{ da: '2026-09-15', a: '2026-09-20' }, { da: '2026-10-05', a: '2026-10-07' }], '2026-10-01', '2026-10-31'), [
    { da: '2026-09-20', a: '2026-10-05' }, { da: '2026-10-07', a: '2026-10-31' },
  ])
  // un buco lungo più di sei mesi porta l'anno
  assert.equal(rigaBuco({ da: '2025-08-02', a: '2026-08-01' }), '2 ago 2025 → 1 ago 2026')
  assert.equal(rigaBuco({ da: '2026-12-28', a: '2027-01-03' }), '28 dic → 3 gen')
  // il tocco apre la nuova prenotazione con camera e arrivo: lo stesso indirizzo di oggi
  assert.equal(indirizzoNuova('abc', '2026-10-03'), '/nuova-prenotazione?room_id=abc&check_in=2026-10-03')
  assert.match(pagina, /<BucoNastro /)
  assert.match(nastro, /data-buco=/)
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
  assert.match(pagina, /cuneoDestra=\{cutRight \? tintaBase\.filo : undefined\} cuneoSinistra=\{cutLeft \? tinta\.filo : undefined\}/)
  assert.match(pagina, /width=\{g\.width\}/)
  assert.match(nastro, /style=\{\{ background: cuneoDestra, clipPath: filoObliquo\('destra', width, SCHEDA_H\) \}\}/)
  assert.match(nastro, /style=\{\{ background: cuneoSinistra, clipPath: filoObliquo\('sinistra', width, SCHEDA_H\) \}\}/)
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

test('i fili di oggi e del mese stanno SOTTO buchi e schede: solo dove la corsia è vuota (Ania, 29/09/2026)', () => {
  const css = leggi('app/maison.css')
  const z = (sel: string) => Number(css.match(new RegExp(`\\.${sel} \\{[^}]*z-index: (\\d+)`))?.[1])
  assert.ok(z('cal-filo-oggi') < z('cal-buco'), 'filo di oggi sopra i buchi')
  assert.ok(z('cal-filo-mese') < z('cal-buco'), 'filo del mese sopra i buchi')
  // le schede partono da z 5 (pagina): i fili restano sotto
  assert.ok(z('cal-filo-oggi') < 5 && z('cal-filo-mese') < 5)
  assert.match(pagina, /zIndex=\{isCurrent \? 16 : isSelected \? 15 : 5\}/)
  // il buco è pieno del colore del fondo, così il filo non gli passa sopra il «+»
  assert.match(css, /\.cal-buco \{ position: absolute; background: var\(--m-bg\);/)
})

test('il nastro: filo verde di oggi, fili ottone dei mesi, righello «lun 28» con domeniche e oggi', () => {
  const css = leggi('app/maison.css')
  assert.match(pagina, /<FiliNastro /)
  assert.match(nastro, /data-filo-oggi/)
  assert.match(css, /\.cal-filo-oggi \{ position: absolute; width: 1px; background: #2D6A4F;/)
  assert.match(css, /\.cal-filo-mese \{ position: absolute; width: 2px; background: #A8894F; opacity: \.7;/)
  assert.match(css, /\.cal-righello > span\.dom \{ color: #B08968; \}/)
  assert.match(css, /\.cal-righello > span\.oggi \{ color: #2D6A4F; font-weight: 600; \}/)
  assert.match(css, /\.cal-righello \{ position: sticky; top: 0;/)
  // la riga «🛏 extra» in rosso acceso a 2/2
  assert.match(pagina, /background: isFull \? COLORE_LETTI_ESAURITI : undefined/)
  assert.match(css, /\.cal-extra \.xl \{[^}]*color: #8A1E15; background: #F8D9D6;/)
})

// ── Il foglietto di dettaglio (pezzo 5) ─────────────────────────────────────
import {
  righeFoglietto, righeInArrivo, testaFoglietto, statoFoglietto, iconeFoglietto, dormeFoglietto, camereFoglietto, ospitiFoglietto,
  pagamentoFoglietto, prezzoFoglietto, clienteFoglietto, arrivoFoglietto, arrivoDaMostrare, noteFoglietto, cameraCorta,
  ALTEZZA_FOGLIETTO, LARGHEZZA_FOGLIETTO_MAC, ETICHETTE_FOGLIETTO, IN_ARRIVO,
} from './calendarioFoglietto.ts'
import { caselleSoggiorno, type SegmentoScheda } from './schedaPrenotazione.ts'

const seg = (s: Partial<SegmentoScheda> & { camera: string }): SegmentoScheda => ({
  id: s.id ?? s.camera + s.check_in, status: 'confermata', check_in: '2026-10-01', check_out: '2026-10-03', num_guests: 2,
  price_per_night: 100, total_amount: 200, rooms: { name: s.camera, base_price: 100 } as SegmentoScheda['rooms'], ...s,
})

test('foglietto: le righe nell’ordine dato, altezza fissa, «…» finché la lettura non arriva', () => {
  assert.equal(ALTEZZA_FOGLIETTO, 430)
  assert.equal(LARGHEZZA_FOGLIETTO_MAC, 620)
  assert.deepEqual([...ETICHETTE_FOGLIETTO], ['Camere', 'Ospiti', 'Prezzo', 'Pagamento', 'Arrivo', 'Note', 'Cliente'])
  assert.deepEqual(righeInArrivo().map(r => r.etichetta), [...ETICHETTE_FOGLIETTO])
  assert.ok(righeInArrivo().every(r => r.valore[0].testo === IN_ARRIVO))
  const righe = righeFoglietto({
    segmenti: [seg({ camera: 'Ambra' })], oggi: '2026-09-29', conto: { totaleCent: 20000, ricevutiCent: 0 }, pagato: false,
    accordo: null, arrivo: null, notaCliente: null, notaPrenotazione: null, volte: 0, provenienza: null, ricevuta: false, spesoPrimaCent: 0,
  })
  assert.deepEqual(righe.map(r => r.etichetta), [...ETICHETTE_FOGLIETTO])
  // le NOTE restano come riga vuota, così il foglietto non si accorcia
  assert.deepEqual(righe.find(r => r.etichetta === 'Note')?.valore, [])
  // la pagina: altezza fissa, larghezza dal Mac, velo, tocco → foglietto, secondo tocco → scheda
  const comp = leggi('components/calendario/FogliettoPrenotazione.tsx')
  assert.match(comp, /altezza=\{ALTEZZA_FOGLIETTO\} larghezzaDesktop=\{LARGHEZZA_FOGLIETTO_MAC\}/)
  assert.match(comp, /veloChiaro onVelo=\{onVelo\}/)
  assert.doesNotMatch(comp, /documenti_cliente/)   // niente documenti
  assert.match(pagina, /if \(aperta\?\.id === booking\.id\) \{ apriScheda\(booking\); return \}/)
  assert.match(pagina, /setAperta\(booking\)\n    setSelectedGroupId\(chainKey \?\? null\)/)
  assert.match(pagina, /if \(aperta && scheda\?\.dataset\.scheda === aperta\.id\) \{ apriScheda\(aperta\); return \}/)
  assert.match(pagina, /onClick=\{e => \{ e\.stopPropagation\(\); tocca\(booking, chainKey\) \}\}/)
  // una sola lettura al tocco, la stessa della scheda
  assert.equal((comp.match(/supabase\.from\(/g) || []).length, 1)
  assert.match(comp, /leggiPrenotazioneUnica\(prenotazione, f => supabase\.from\('bookings'\)\.select\('\*, rooms\(\*\)'\)/)
})

test('foglietto: testa, nome con 🧾 ⭐, «dorme» solo se è un’altra persona', () => {
  assert.equal(testaFoglietto('Ambra', '2026-10-01', '2026-10-05'), 'Ambra · 1 → 5 ott · 4 notti')
  assert.equal(statoFoglietto('confermata', '2026-10-05', '2026-09-29', false), 'Confermata')
  assert.equal(statoFoglietto('in_attesa', '2026-10-05', '2026-09-29', false), 'In attesa')
  assert.equal(statoFoglietto('confermata', '2026-09-20', '2026-09-29', false), 'Conclusa')
  assert.equal(statoFoglietto('annullata', '2026-09-20', '2026-09-29', true), 'Mancato arrivo')
  assert.equal(iconeFoglietto(true, true), '🧾 ⭐')
  assert.equal(iconeFoglietto(false, true), '⭐')
  assert.equal(cameraCorta('01 Ambra'), 'Ambra')
  // chi dorme: solo con la spunta «Non è lei a dormire qui» e un nome
  assert.equal(dormeFoglietto({ intestataria_non_dorme: true, extra_phone_1_name: 'Teresa Bianchi', chi_e: 'Mamma' }), 'dorme Teresa Bianchi · mamma')
  assert.equal(dormeFoglietto({ intestataria_non_dorme: false, extra_phone_1_name: 'Teresa Bianchi' }), null)
  assert.equal(dormeFoglietto({ extra_phone_1_name: 'Teresa Bianchi' }), null)
})

test('foglietto: camere, ospiti col letto, prezzo barrato solo con lo sconto', () => {
  const catena = [seg({ camera: 'Ambra', check_in: '2026-10-01', check_out: '2026-10-03' }), seg({ camera: 'Lena', check_in: '2026-10-03', check_out: '2026-10-05', extra_bed_dates: ['2026-10-03', '2026-10-04'], num_guests: 3 })]
  const caselle = caselleSoggiorno(catena, '2026-09-29')
  assert.equal(camereFoglietto(caselle), 'Ambra 2 notti, poi Lena 2')
  assert.equal(camereFoglietto(caselleSoggiorno([seg({ camera: 'Ambra' })], '2026-09-29')), 'Ambra')
  assert.equal(ospitiFoglietto(caselle, new Set(['2026-10-03', '2026-10-04'])), '3 · letto in più dal 3 ott')
  assert.equal(ospitiFoglietto(caselle, new Set()), '3')
  assert.equal(ospitiFoglietto(caselle, new Set(caselle.map(c => c.iso))), '3 · letto in più')
  assert.equal(ospitiFoglietto(caselle, new Set(['2026-10-01'])), "3 · letto in più dall'1 ott")   // regola fissa n. 3
  // prezzo: niente barrato senza sconto; col prezzo concordato più basso, il pieno barrato e lo sconto
  assert.deepEqual(prezzoFoglietto([seg({ camera: 'Ambra' })], { totaleCent: 20000, ricevutiCent: 0 }), [{ testo: '200 €' }])
  const scontato = prezzoFoglietto([seg({ camera: 'Ambra', total_amount: 160, discount_type: 'target_total', discount_value: 160 })], { totaleCent: 16000, ricevutiCent: 0 })
  assert.equal(scontato[0].tipo, 'barrato')
  assert.equal(scontato[0].testo, '200 €')
  assert.equal(scontato[1].testo, ' 160 € · sconto 40 €')
  assert.equal(prezzoFoglietto([seg({ camera: 'Ambra' })], null)[0].tipo, 'mat')
})

test('foglietto: «restano» in mattone, «saldato» in verde, come paga e la caparra', () => {
  const resta = pagamentoFoglietto({ totaleCent: 38000, ricevutiCent: 19000 }, false, { accordo_pagamento: 'bonifico_arrivo' })
  assert.deepEqual(resta, [{ testo: 'ricevuti 190 € · ' }, { testo: 'restano 190 €', tipo: 'mat' }, { testo: ' · bonifico' }])
  assert.deepEqual(pagamentoFoglietto({ totaleCent: 38000, ricevutiCent: 38000 }, false, null), [{ testo: 'ricevuti 380 € · ' }, { testo: 'saldato', tipo: 'verde' }])
  assert.deepEqual(pagamentoFoglietto({ totaleCent: 38000, ricevutiCent: 0 }, true, null), [{ testo: 'saldato', tipo: 'verde' }])
  const caparra = pagamentoFoglietto({ totaleCent: 38000, ricevutiCent: 0 }, false, { accordo_pagamento: 'caparra_meta', caparra_entro: '2026-09-30' })
  assert.deepEqual(caparra.map(p => p.testo), ['restano 380 €', ' · caparra del 50% entro mer 30'])
})

test('foglietto: arrivo coi testi della scheda, «orario da chiedere», il primo arrivo futuro; note; cliente con lo speso', () => {
  assert.equal(arrivoFoglietto({ ...ARRIVO_VUOTO, tipo: 'struttura', strutturaDa: '16:00', navetta: 'non_richiesta' }, '2026-10-01', '2026-09-29'), 'gio 1 ott alle 16:00 · arrivo autonomo')
  assert.equal(arrivoFoglietto(ARRIVO_VUOTO, '2026-10-01', '2026-09-29'), 'gio 1 ott, orario da chiedere · navetta da definire')
  assert.equal(
    arrivoFoglietto({ ...ARRIVO_VUOTO, tipo: 'luogo', luogo: 'malpensa', luogoDa: '14:15', stimaDa: '16:00', stimaA: '17:00', navetta: 'aldo', prelievo: '14:30' }, '2026-10-01', '2026-09-29'),
    'gio 1 ott, in struttura 16:00–17:00 circa · atterra a Malpensa alle 14:15 · navetta Aldo · prelievo a Malpensa 14:30',
  )
  assert.equal(arrivoDaMostrare([{ check_in: '2026-09-20' }, { check_in: '2026-10-10' }], '2026-09-29')?.check_in, '2026-10-10')
  assert.equal(arrivoDaMostrare([{ check_in: '2026-09-20' }, { check_in: '2026-09-25' }], '2026-09-29')?.check_in, '2026-09-25')
  assert.equal(noteFoglietto('Preferisce la camera silenziosa', 'portare la culla'), 'Preferisce la camera silenziosa · Questa volta: portare la culla')
  assert.equal(noteFoglietto(null, ' '), '')
  assert.deepEqual(clienteFoglietto(4, 'da Nida', true, 64000, 38000), [{ testo: 'già ospite 4 volte · da Nida · vuole ricevuta · ' }, { testo: '1.020 €', tipo: 'mat' }, { testo: ' con questa' }])
  assert.deepEqual(clienteFoglietto(0, null, false, 0, 20000)[0], { testo: 'prima volta · ' })
})

// ── Sotto il nastro, legenda, camera tenuta (pezzo 6) ───────────────────────
test('«Oggi» e «Legenda» sotto la colonna delle camere; la camera tenuta e la conferma nel foglio Maison, senza bottoni pieni', () => {
  const riga = leggi('components/RigaMesi.tsx')
  assert.match(pagina, /<RigaMesi maison colonna=\{NAME_W\}/)
  assert.match(riga, /<div className="og" style=\{\{ width: colonna, minWidth: colonna \}\}>/)
  assert.match(pagina, /<div className="cal-lg" style=\{\{ width: NAME_W, minWidth: NAME_W \}\}>/)
  assert.doesNotMatch(pagina, />\?<\/button>/)                                  // niente più «?»
  assert.match(pagina, /dati="tenuta-calendario"/)
  assert.match(pagina, /· camera tenuta<\/div>/)
  for (const t of ['Libera e fai una prenotazione nuova', 'Libera la camera', 'Apri la richiesta di {barraAperta.ospite}']) assert.ok(pagina.includes(t), t)
  assert.match(pagina, /dati="conferma-tenuta"/)
  // le sole pastiglie piene sono quelle del riferimento: nessun mz-cta, nessun ed-pillola nel calendario
  assert.doesNotMatch(pagina, /mz-cta|ed-pillola/)
  const css = leggi('app/maison.css')
  assert.match(css, /\.cal-rm \.ms button\.on \{ background: var\(--m-ink\); color: #F6F2EA; \}/)
  assert.match(css, /\.cal-rm \.og button \{[^}]*border: 1px solid var\(--m-ink\); border-radius: 999px;[^}]*text-transform: uppercase;/)
})

test('svuotando la ricerca il calendario torna sempre a oggi (Ania, 29/09/2026)', () => {
  assert.match(pagina, /setDaysTotal\(DAYS_TOTAL\)\n      \}\n      vaiAOggi\(\)/)
})

test('acconti come prima: le notti coperte in verde da sinistra, il resto del suo colore (Ania, 29/09/2026)', async () => {
  const { fondoConAcconti } = await import('./calendarioSchede.ts')
  assert.equal(fondoConAcconti('#BFDCC8', '#C5D6E2', 117), 'linear-gradient(to right, #BFDCC8 0 117px, #C5D6E2 117px)')
  assert.equal(fondoConAcconti('#BFDCC8', '#C5D6E2', 0), '#C5D6E2')
  assert.match(pagina, /const coperte = paidNightsByBooking\[booking\.id\] \?\? 0/)
})

// ── Il tocco su un buco apre la nuova prenotazione dal GIORNO TOCCATO (Ania, 29/09/2026) ──
import { arrivoToccatoNelBuco } from './calendarioSchede.ts'

test('buco 2 → 6 ott, tocco sulla colonna del 5 → check_in=2026-10-05; fuori dal buco il giorno più vicino dentro', () => {
  // primo giorno disegnato lun 28 set, colonne da 60 px: il 5 ott è la colonna 7 (420–479 px)
  const buco = { da: '2026-10-02', a: '2026-10-06' }
  assert.equal(arrivoToccatoNelBuco(7 * 60 + 30, 60, '2026-09-28', buco), '2026-10-05')
  assert.equal(indirizzoNuova('abc', arrivoToccatoNelBuco(7 * 60 + 30, 60, '2026-09-28', buco)), '/nuova-prenotazione?room_id=abc&check_in=2026-10-05')
  assert.equal(arrivoToccatoNelBuco(4 * 60, 60, '2026-09-28', buco), '2026-10-02')      // bordo sinistro del 2
  assert.equal(arrivoToccatoNelBuco(4 * 60 - 1, 60, '2026-09-28', buco), '2026-10-02')  // appena prima: il più vicino dentro
  assert.equal(arrivoToccatoNelBuco(8 * 60 + 5, 60, '2026-09-28', buco), '2026-10-05')  // sul 6 (giorno di partenza): l'ultimo dentro
  assert.equal(arrivoToccatoNelBuco(-10, 60, '2026-09-28', buco), '2026-10-02')          // tocco senza coordinate (tastiera)
  assert.equal(arrivoToccatoNelBuco(3 * 40 + 1, 40, '2026-10-01', buco), '2026-10-04')   // a «Mese», colonne da 40
  // le due pagine calcolano dal tocco rispetto al nastro, non dallo scrollLeft
  for (const f of ['app/calendario/page.tsx', 'app/arrivi/page.tsx']) {
    const src = leggi(f)
    assert.match(src, /const dateStr = arrivoToccatoNelBuco\(e\.clientX - nastro - NAME_W, CELL_W, toStr\(days\[0\]\), h\)/, f)
    assert.match(src, /e\.currentTarget\.closest\('\.cal-nastro'\)\?\.getBoundingClientRect\(\)\.left/, f)
    assert.doesNotMatch(src, /L'arrivo è l'inizio del buco/, f)
  }
})
