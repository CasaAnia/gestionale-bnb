// La striscia delle notti (13/09/2026): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  nottiDaSegmenti, riassuntoStriscia, cambiCamera, avvisiStriscia, camereDellaNotte, avvisoCapienza,
  lettoDisponibileNotte, prezzoLettoNotte, cambiaCamera, cambiaLetto, cambiaOspitiNotte, nonDormeQui, blocchiDaNotti,
  pianoNotti, stessaStriscia, titoloNotte, giornoDellaNotte, compatta, NESSUNA_NOTTE, CAMERA_MANCANTE,
  SCONTO_DECADUTO, LETTO_COMPRESO, segniDiCambio, personeColLetto,
  type SegmentoNotti, type CameraStriscia, type ContestoNotti, type NotteStriscia,
} from './strisciaNotti.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

// Lena si riconosce dal suo id vero: è la regola dei letti di casa (lib/lettiAggiuntivi)
const LENA: CameraStriscia = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const AMBRA: CameraStriscia = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const ALLEGRA: CameraStriscia = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: CameraStriscia = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]

const contesto = (extra: Partial<ContestoNotti> = {}): ContestoNotti => ({ camere: CAMERE, altre: [], ospiti: 2, ...extra })

const seg = (id: string, camera: CameraStriscia, dal: string, al: string, extra: Partial<SegmentoNotti> = {}): SegmentoNotti => ({
  id, room_id: camera.id, check_in: dal, check_out: al, status: 'confermata', num_guests: 2,
  extra_bed: false, extra_bed_dates: [], rooms: camera, ...extra,
})

// Carmela Sabia, 10 → 17 set: Lena → Amelia → Lena (due cambi camera)
const CARMELA: SegmentoNotti[] = [
  seg('c1', LENA, '2026-09-10', '2026-09-13', { group_id: 'g' } as Partial<SegmentoNotti>),
  seg('c2', AMELIA, '2026-09-13', '2026-09-15', { num_guests: 1 }),
  seg('c3', LENA, '2026-09-15', '2026-09-17', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-09-15', '2026-09-16'] }),
]

// ── Come si legge la data ──────────────────────────────────────────────────
test('sopra la colonnina: «gio» e il numero del mese', () => {
  assert.deepEqual(giornoDellaNotte('2026-09-10'), { giorno: 'gio', numero: 10 })
  assert.equal(titoloNotte('2026-09-12'), 'Sabato 12')
  // con più di sette notti i due pezzi vanno incolonnati (Ania, 13/09/2026)
  assert.equal(compatta(7), false)
  assert.equal(compatta(8), true)
})

// ── La striscia: nessun cambio, uno, due ───────────────────────────────────
test('senza cambi camera: una camera sola in tutte le notti', () => {
  const notti = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-13')])
  assert.equal(notti.length, 3)
  assert.deepEqual(notti.map(n => n.camera), ['Lena', 'Lena', 'Lena'])
  assert.equal(notti.every(n => n.dentro && !n.letto), true)
  assert.equal(cambiCamera(notti), 0)
  // zero cambi: il riassunto non li nomina proprio (Ania, 15/09/2026)
  assert.equal(riassuntoStriscia(notti), '')
})

test('un cambio camera: il segno ⇄ sta sulla prima notte nuova', () => {
  const notti = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-12'), seg('b', AMBRA, '2026-09-12', '2026-09-14')])
  assert.deepEqual(notti.map(n => n.camera), ['Lena', 'Lena', 'Ambra', 'Ambra'])
  assert.equal(cambiCamera(notti), 1)
  assert.equal(riassuntoStriscia(notti), '1 cambio camera')
})

test('due cambi camera e il letto in più: la riga di riassunto', () => {
  const notti = nottiDaSegmenti(CARMELA)
  assert.equal(notti.length, 7)
  assert.deepEqual(notti.map(n => n.camera), ['Lena', 'Lena', 'Lena', 'Amelia', 'Amelia', 'Lena', 'Lena'])
  assert.deepEqual(notti.map(n => n.letto), [false, false, false, false, false, true, true])
  assert.equal(riassuntoStriscia(notti), '2 cambi camera · letto in più 2 notti')
  // le persone: due in Lena, una in Amelia, tre nelle notti col letto
  assert.deepEqual(notti.map(n => n.persone), [2, 2, 2, 1, 1, 3, 3])
})

// ── La notte senza camera e il suo avviso ──────────────────────────────────
test('la notte senza camera: «?» nella striscia e l’avviso in rosso sotto', () => {
  const notti = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-13')])
  const rotta: NotteStriscia[] = notti.map((n, i) => (i === 2 ? { ...n, cameraId: null, camera: null, motivo: 'Lena è occupata' } : n))
  assert.deepEqual(avvisiStriscia(rotta), ['sab 12 senza camera: Lena è occupata'])
  // senza camera non si salva niente: prima si sistema
  assert.equal(pianoNotti(rotta, [seg('a', LENA, '2026-09-10', '2026-09-13')], contesto()).errore, CAMERA_MANCANTE)
  // le notti a posto non hanno avvisi
  assert.deepEqual(avvisiStriscia(notti), [])
})

// ── «Non dorme qui» ────────────────────────────────────────────────────────
test('la notte «non dorme qui» non entra nel conto e spezza il soggiorno', () => {
  const notti = nonDormeQui(nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-14')]), '2026-09-12')
  const fuori = notti.find(n => n.iso === '2026-09-12')!
  assert.equal(fuori.dentro, false)
  assert.equal(fuori.letto, false)
  // il conto dei cambi salta la notte libera: resta una camera sola
  assert.equal(cambiCamera(notti), 0)
  const blocchi = blocchiDaNotti(notti)
  assert.deepEqual(blocchi.map(b => [b.check_in, b.check_out]), [['2026-09-10', '2026-09-12'], ['2026-09-13', '2026-09-14']])
  // e il conto scende: tre notti pagate invece di quattro
  const piano = pianoNotti(notti, [seg('a', LENA, '2026-09-10', '2026-09-14')], contesto())
  assert.equal(piano.errore, null)
  assert.equal(piano.aggiorna.length + piano.crea.length, 2)
  assert.equal(piano.aggiorna[0].campi.total_amount + piano.crea[0].total_amount, 240)
})

test('un soggiorno già spezzato si rilegge con la notte «libera» in mezzo', () => {
  const notti = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-12'), seg('b', LENA, '2026-09-13', '2026-09-15')])
  assert.deepEqual(notti.map(n => n.dentro), [true, true, false, true, true])
  assert.equal(notti[2].camera, null)
})

test('non si può togliere l’ultima notte', () => {
  let notti = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-11')])
  notti = nonDormeQui(notti, '2026-09-10')
  assert.equal(pianoNotti(notti, [seg('a', LENA, '2026-09-10', '2026-09-11')], contesto()).errore, NESSUNA_NOTTE)
})

// ── Le camere del foglietto ────────────────────────────────────────────────
test('nel foglietto ci sono le camere libere; le occupate non compaiono', () => {
  const altre = [{ room_id: 'ambra', check_in: '2026-09-11', check_out: '2026-09-14', status: 'confermata' }]
  const libere = camereDellaNotte('2026-09-12', contesto({ altre }))
  assert.deepEqual(libere.map(c => c.name), ['Amelia', 'Allegra', 'Lena'])
  assert.equal(libere.some(c => c.name === 'Ambra'), false)
  // la notte prima Ambra è ancora libera: l'occupazione vale notte per notte
  assert.deepEqual(camereDellaNotte('2026-09-10', contesto({ altre })).map(c => c.name), ['Amelia', 'Allegra', 'Ambra', 'Lena'])
  // una prenotazione annullata o in attesa non occupa niente
  const inAttesa = [{ room_id: 'ambra', check_in: '2026-09-11', check_out: '2026-09-14', status: 'in_attesa' }]
  assert.equal(camereDellaNotte('2026-09-12', contesto({ altre: inAttesa })).some(c => c.name === 'Ambra'), true)
})

test('la camera che non basta si può scegliere lo stesso, con l’avviso', () => {
  assert.equal(avvisoCapienza(AMBRA, 2), null)
  assert.equal(avvisoCapienza(AMBRA, 4), 'Ambra non basta per 4 persone')
  assert.equal(avvisoCapienza(AMELIA, 2), null)      // Amelia arriva a 2 col letto
  assert.equal(avvisoCapienza(AMELIA, 3), 'Amelia non basta per 3 persone')
  assert.equal(avvisoCapienza(LENA, 4), null)        // Lena arriva a 4
})

// ── Il letto in più ────────────────────────────────────────────────────────
test('coi due letti di casa già impegnati, «Sì» resta spento', () => {
  const impegnati = [
    { room_id: 'ambra', check_in: '2026-09-12', check_out: '2026-09-13', status: 'confermata', num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-09-12'] },
    { room_id: 'allegra', check_in: '2026-09-12', check_out: '2026-09-13', status: 'confermata', num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-09-12'] },
  ]
  assert.equal(lettoDisponibileNotte('2026-09-12', LENA_ID, contesto({ altre: impegnati })), false)
  assert.equal(lettoDisponibileNotte('2026-09-13', LENA_ID, contesto({ altre: impegnati })), true)
  // con un letto solo preso ne resta uno
  assert.equal(lettoDisponibileNotte('2026-09-12', 'ambra', contesto({ altre: [impegnati[0]] })), true)
  // Lena a quattro ospiti ne vuole due: con uno solo libero non basta
  assert.equal(lettoDisponibileNotte('2026-09-12', LENA_ID, contesto({ altre: [impegnati[0]], ospiti: 4 })), false)
})

test('il prezzo accanto a «Sì»: «10 €» oppure «compreso»', () => {
  assert.equal(prezzoLettoNotte(AMBRA, 3), '10 €')
  assert.equal(prezzoLettoNotte(AMELIA, 2), '5 €')
  assert.equal(prezzoLettoNotte(LENA, 3), LETTO_COMPRESO)   // la tripla è già venduta con tre posti
  assert.equal(prezzoLettoNotte(LENA, 4), '10 €')
  // due persone che vogliono dormire separate: il letto non cambia il conto
  assert.equal(prezzoLettoNotte(ALLEGRA, 2), LETTO_COMPRESO)
  assert.equal(prezzoLettoNotte(LENA, 2), LETTO_COMPRESO)
  // e se Ania ha scritto un importo suo, si legge quello
  assert.equal(prezzoLettoNotte(AMBRA, 3, { importo: 15, criterio: 'notte' }), '15 €')
  assert.equal(prezzoLettoNotte(AMBRA, 3, { importo: 40, criterio: 'ogni4' }), '40 € ogni 4 notti')
  assert.equal(prezzoLettoNotte(AMBRA, 3, { importo: 50, criterio: 'totale' }), '50 € in tutto')
  assert.equal(prezzoLettoNotte(LENA, 3, { importo: 0, criterio: 'notte' }), LETTO_COMPRESO)
})

// ── Le modifiche del foglietto ─────────────────────────────────────────────
test('cambiare camera cambia solo quella notte', () => {
  const prima = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-13')])
  const dopo = cambiaCamera(prima, '2026-09-11', AMBRA, contesto())
  assert.deepEqual(dopo.map(n => n.camera), ['Lena', 'Ambra', 'Lena'])
  assert.deepEqual(dopo.map(n => n.persone), [2, 2, 2])   // due persone stanno in Ambra senza letto
  assert.equal(dopo[1].letto, false)
  assert.equal(cambiCamera(dopo), 2)
  // Annulla non cambia niente: le funzioni non toccano la striscia di prima
  assert.deepEqual(prima.map(n => n.camera), ['Lena', 'Lena', 'Lena'])
  assert.equal(stessaStriscia(prima, dopo), false)
  assert.equal(stessaStriscia(prima, nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-13')])), true)
})

test('accendere il letto porta le persone della notte agli ospiti della prenotazione', () => {
  const prima = nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-12', { num_guests: 3 })])
  assert.deepEqual(prima.map(n => n.persone), [2, 2])
  const acceso = cambiaLetto(prima, '2026-09-10', true, contesto({ ospiti: 3 }))
  assert.deepEqual(acceso.map(n => n.persone), [3, 2])
  assert.equal(acceso[0].letto, true)
  const spento = cambiaLetto(acceso, '2026-09-10', false, contesto({ ospiti: 3 }))
  assert.deepEqual(spento.map(n => n.persone), [2, 2])
  assert.equal(stessaStriscia(prima, spento), true)
})

// ── Il conto si aggiorna ───────────────────────────────────────────────────
test('spostando una notte in un’altra camera il conto segue il listino nuovo', () => {
  // tre notti in Lena a 80 = 240; la notte di mezzo passa in Amelia (70)
  const segmenti = [seg('a', LENA, '2026-09-10', '2026-09-13')]
  const notti = cambiaCamera(nottiDaSegmenti(segmenti), '2026-09-11', AMELIA, contesto({ ospiti: 2 }))
  const piano = pianoNotti(notti, segmenti, contesto({ ospiti: 2 }))
  assert.equal(piano.errore, null)
  // tre tratti: Lena, Amelia, Lena — uno aggiornato, due nuovi
  assert.equal(piano.aggiorna.length, 1)
  assert.equal(piano.crea.length, 2)
  const totale = piano.aggiorna.reduce((s, a) => s + a.campi.total_amount, 0) + piano.crea.reduce((s, c) => s + c.total_amount, 0)
  assert.equal(totale, 80 + 75 + 80)   // Amelia in due: 70 + 5, il letto si accende da solo
  assert.deepEqual(piano.annulla, [])
})

test('accendere il letto in più aggiorna la riga senza crearne altre', () => {
  const segmenti = [seg('a', LENA, '2026-09-10', '2026-09-12', { num_guests: 3 })]
  const notti = cambiaLetto(nottiDaSegmenti(segmenti), '2026-09-10', true, contesto({ ospiti: 3 }))
  const piano = pianoNotti(notti, segmenti, contesto({ ospiti: 3 }))
  assert.equal(piano.crea.length, 0)
  assert.equal(piano.annulla.length, 0)
  const campi = piano.aggiorna[0].campi
  assert.deepEqual(campi.extra_bed_dates, ['2026-09-10'])
  assert.equal(campi.extra_bed, true)
  assert.equal(campi.num_guests, 3)
  assert.equal(campi.total_amount, 170)   // 90 in tre + 80 in due
})

test('i tratti che restano senza notti si annullano, non si cancellano', () => {
  const segmenti = [seg('a', LENA, '2026-09-10', '2026-09-12'), seg('b', AMBRA, '2026-09-12', '2026-09-14')]
  // tutte le notti tornano in Lena: il tratto di Ambra non serve più
  let notti = nottiDaSegmenti(segmenti)
  notti = cambiaCamera(notti, '2026-09-12', LENA, contesto())
  notti = cambiaCamera(notti, '2026-09-13', LENA, contesto())
  const piano = pianoNotti(notti, segmenti, contesto())
  assert.equal(piano.aggiorna.length, 1)
  assert.equal(piano.aggiorna[0].id, 'a')
  assert.deepEqual([piano.aggiorna[0].campi.check_in, piano.aggiorna[0].campi.check_out], ['2026-09-10', '2026-09-14'])
  assert.deepEqual(piano.annulla, ['b'])
  assert.equal(piano.aggiorna[0].campi.total_amount, 320)
})

test('lo sconto in percentuale segue le notti; il totale concordato che decade ferma tutto', () => {
  const conSconto = [seg('a', LENA, '2026-09-10', '2026-09-13', { discount_type: 'percentage', discount_value: 10 })]
  // si toglie una notte: il tratto cambia, quindi si rifà — con lo sconto
  const dueNotti = nonDormeQui(nottiDaSegmenti(conSconto), '2026-09-12')
  const piano = pianoNotti(dueNotti, conSconto, contesto())
  assert.equal(piano.aggiorna[0].campi.total_amount, 144)   // 160 meno il 10%
  assert.equal(piano.aggiorna[0].campi.discount_type, 'percentage')

  // totale concordato 200 su tre notti da 80: togliendone due il pieno scende a 80
  const concordato = [seg('b', LENA, '2026-09-10', '2026-09-13', { discount_type: 'target_total', discount_value: 200 })]
  let notti = nonDormeQui(nottiDaSegmenti(concordato), '2026-09-11')
  notti = nonDormeQui(notti, '2026-09-12')
  assert.equal(pianoNotti(notti, concordato, contesto()).errore, SCONTO_DECADUTO)
})

// ── Il segno ⇄ ─────────────────────────────────────────────────────────────
test('il segno del cambio sta sulla prima notte della camera nuova', () => {
  const notti = nottiDaSegmenti(CARMELA)
  assert.deepEqual(segniDiCambio(notti), [false, false, false, true, false, true, false])
  // la notte «libera» non conta come cambio, e non ne inventa uno dopo
  const conPausa = nonDormeQui(nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-14')]), '2026-09-12')
  assert.deepEqual(segniDiCambio(conPausa), [false, false, false, false])
})

// ── IL DISEGNO, letto dai sorgenti ─────────────────────────────────────────
// Le misure e i colori decisi da Ania sulla bozza approvata (13/09/2026).
const striscia = readFileSync(new URL('../components/StrisciaNottiCamere.tsx', import.meta.url), 'utf8')

test('le colonnine: stessa larghezza, 4 px di spazio, e restano toccabili', () => {
  assert.match(striscia, /export const LARGHEZZA_COLONNINA = 44/)
  assert.match(striscia, /export const SPAZIO_COLONNINE = 4/)
  assert.match(striscia, /className="flex items-end" style=\{\{ gap: SPAZIO_COLONNINE/)
  assert.match(striscia, /flex: `1 1 \$\{LARGHEZZA_COLONNINA\}px`, maxWidth: LARGHEZZA_MASSIMA/, 'le colonnine non hanno tutte la stessa larghezza')
  assert.match(striscia, /export const LARGHEZZA_MASSIMA = 72/, 'con poche notti le colonnine diventano lenzuola')
  // con molte notti la striscia scorre di lato invece di uscire dai margini
  assert.match(striscia, /className="overflow-x-auto no-scrollbar"/)
  assert.match(striscia, /minWidth: notti\.length \* LARGHEZZA_COLONNINA/)
})

test('le tinte delle camere e i due casi speciali', () => {
  assert.match(striscia, /Lena: \{ fondo: '#E7EFE9', testo: 'var\(--color-green-dark\)' \}/)
  assert.match(striscia, /Ambra: \{ fondo: '#EAE7F2', testo: '#463C6B' \}/)
  assert.match(striscia, /Allegra: \{ fondo: '#F3E9DA', testo: '#7A5C1E' \}/)
  assert.match(striscia, /Amelia: \{ fondo: '#F3E9DA', testo: '#7A5C1E' \}/)
  // la notte senza camera: riquadro bianco tratteggiato rosso con il «?»
  assert.match(striscia, /const ROSSO = '#D40000'/)
  assert.match(striscia, /senzaCamera \? `1px dashed \$\{ROSSO\}`/)
  assert.match(striscia, /senzaCamera \? '\?'/)
  // la notte «non dorme qui»: tratteggio grigio e la parola «libera»
  assert.match(striscia, /fuori \? '1px dashed var\(--color-border-soft\)'/)
  assert.match(striscia, /fuori \? TESTO_LIBERA/)
})

test('camera sopra e letto sotto, attaccati: 8 px in alto e 8 px in basso', () => {
  assert.match(striscia, /borderRadius: '8px 8px 0 0'[^}]*fontSize: 11, lineHeight: '14px', fontWeight: 600/)
  assert.match(striscia, /borderRadius: '0 0 8px 8px', height: 18/)
  assert.match(striscia, /background: n\.letto \? 'var\(--color-sage\)' : '#fff'/)
  assert.match(striscia, /color: n\.letto \? 'var\(--color-green-mid\)' : '#C4C0B6'/)
  // il segno del cambio sta FRA le due colonnine
  assert.match(striscia, /data-segno-cambio[\s\S]*left: -SPAZIO_COLONNINE \/ 2/)
  assert.match(striscia, /color: OTTONE[^}]*\}}>⇄</)
})

test('sotto la striscia: la spiegazione e la riga di riassunto in ottone', () => {
  assert.match(striscia, /export const SPIEGAZIONE = 'sopra la camera · sotto il letto in più'/)
  assert.match(striscia, /\{SPIEGAZIONE\}/)
  assert.match(striscia, /marginTop: 8, fontSize: 12, color: 'var\(--color-stone\)'/)
  assert.match(striscia, /data-riassunto-striscia[^>]*fontSize: 12, color: OTTONE/)
  // che cosa manca, in mattone e non in rosso acceso (Ania, 15/09/2026)
  assert.match(striscia, /data-avviso-notte[^>]*fontSize: 12, color: MATTONE/)
})

test('la striscia non parla col database e non si rifà le regole', () => {
  assert.equal(/supabase/i.test(striscia), false, 'la striscia chiama il database')
  assert.equal(/useEffect|useState/.test(striscia), false, 'la striscia tiene uno stato suo')
  assert.match(striscia, /from '@\/lib\/strisciaNotti'/)
})

// ── IL FOGLIETTO DELLA NOTTE, letto dai sorgenti ───────────────────────────
const foglietto = readFileSync(new URL('../components/FoglioNotte.tsx', import.meta.url), 'utf8')

test('il foglietto: il giorno per esteso in Georgia 18', () => {
  assert.match(foglietto, /titolo=\{titoloNotte\(iso\)\} grande/)
  const foglio = readFileSync(new URL('../components/scheda/Foglio.tsx', import.meta.url), 'utf8')
  assert.match(foglio, /fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18/)
})

test('nel foglietto ci sono solo le camere libere, con quella attuale accesa', () => {
  assert.match(foglietto, /export const TITOLO_CAMERE = 'Camere libere questa notte'/)
  assert.match(foglietto, /const libere = camereDellaNotte\(iso, contesto\)/)
  // l'elenco viene dalle regole di sempre: qui non si filtra niente a mano
  const codice = foglietto.split('\n').filter(r => !r.trim().startsWith('//')).join('\n')
  assert.equal(/status|siSovrappone|camereLibere\(/.test(codice), false, 'il foglietto si è riscritto chi è libero')
  assert.match(foglietto, /aria-pressed=\{acceso\}/)
  assert.match(foglietto, /border: acceso \? `1\.5px solid \$\{OTTONE\}`/)
})

test('la camera che non basta avvisa in mattone senza bloccare', () => {
  assert.match(foglietto, /const avviso = notte\.dentro \? avvisoCapienza\(scelta, notte\.persone\) : null/)
  assert.match(foglietto, /data-avviso-capienza[\s\S]{0,200}color: MATTONE/)
  assert.match(foglietto, /export const MATTONE = '#8C3B2E'/)
  // l'avviso non spegne nessuna pastiglia: le camere restano tutte scegliibili
  assert.equal(/disabled=\{[^}]*avviso/.test(foglietto), false)
})

test('il letto: due pastiglie col prezzo, e «non disponibile» quando i letti sono presi', () => {
  assert.match(foglietto, /export const TITOLO_LETTO = 'Letto in più questa notte'/)
  assert.match(foglietto, /Sì · \{prezzoLettoNotte\(scelta, notte\.dentro \? notte\.persone : contesto\.ospiti, lettoScelto\)\}/)
  assert.match(foglietto, /spenta=\{!notte\.dentro \|\| \(!lettoLibero && !notte\.letto\)\}/)
  assert.match(foglietto, /data-letto-non-disponibile[\s\S]{0,120}\{LETTO_NON_DISPONIBILE\}/)
  assert.match(foglietto, /const lettoLibero = lettoDisponibileNotte\(iso, notte\.cameraId, contesto\)/)
})

test('«Non dorme qui», «Fatto» e «Annulla»', () => {
  assert.match(foglietto, /export const NON_DORME_QUI = 'Non dorme qui'/)
  assert.match(foglietto, /onClick=\{\(\) => setBozza\(b => nonDormeQui\(b, iso\)\)\}/)
  // Annulla chiude e basta: solo «Fatto» consegna la striscia nuova
  assert.match(foglietto, /data-annulla onClick=\{onChiudi\}/)
  assert.match(foglietto, /data-fatto onClick=\{\(\) => onFatto\(bozza, daQui\)\}/)
  assert.equal(/data-annulla[^>]*onFatto/.test(foglietto), false, 'Annulla salva qualcosa')
})

test('il foglietto non parla col database e usa le regole della libreria', () => {
  assert.equal(/supabase/i.test(foglietto), false, 'il foglietto chiama il database')
  assert.match(foglietto, /from '@\/lib\/strisciaNotti'/)
  for (const regola of ['camereDellaNotte', 'avvisoCapienza', 'lettoDisponibileNotte', 'cambiaCamera', 'cambiaLetto', 'nonDormeQui']) {
    assert.ok(foglietto.includes(regola), `il foglietto non usa ${regola}`)
  }
})

test('col letto in più le persone non superano quello che la camera tiene', () => {
  // soggiorno di tre persone: in Amelia col letto se ne possono mettere due
  const notti = nottiDaSegmenti([seg('a', AMELIA, '2026-09-10', '2026-09-12', { num_guests: 1 })])
  const acceso = cambiaLetto(notti, '2026-09-10', true, contesto({ ospiti: 3 }))
  assert.equal(acceso[0].persone, 2)
  assert.equal(prezzoLettoNotte(AMELIA, 3), '5 €')       // il letto di Amelia, non quello di tre persone
  // in Lena invece le tre persone ci stanno tutte
  const lena = cambiaLetto(nottiDaSegmenti([seg('b', LENA, '2026-09-10', '2026-09-12')]), '2026-09-10', true, contesto({ ospiti: 3 }))
  assert.equal(lena[0].persone, 3)
  assert.equal(personeColLetto(LENA, 4), 4)
  assert.equal(personeColLetto(AMBRA, 4), 3)
})

test('un tratto rimasto identico non viene riscritto: la tariffa concordata resta', () => {
  // Amelia a 65 € a notte (tariffa concordata, non il listino da 70)
  const segmenti = [
    seg('a', LENA, '2026-09-10', '2026-09-12'),
    seg('b', AMELIA, '2026-09-12', '2026-09-14', { num_guests: 1 }),
  ]
  // si cambia solo la prima notte
  const notti = cambiaCamera(nottiDaSegmenti(segmenti), '2026-09-10', AMBRA, contesto())
  const piano = pianoNotti(notti, segmenti, contesto())
  assert.equal(piano.errore, null)
  assert.equal(piano.aggiorna.some(a => a.id === 'b'), false, 'il tratto di Amelia è stato riscritto')
  assert.deepEqual(piano.annulla, [])
  // e senza nessuna modifica non si scrive proprio niente
  const fermo = pianoNotti(nottiDaSegmenti(segmenti), segmenti, contesto())
  assert.deepEqual([fermo.aggiorna, fermo.crea, fermo.annulla, fermo.errore], [[], [], [], null])
})

test('la notte tolta dal soggiorno: il letto si spegne e si dice come rimetterla', () => {
  assert.match(foglietto, /export const COME_RIMETTERLA = 'per rimetterla nel soggiorno scegli una camera'/)
  assert.match(foglietto, /spenta=\{!notte\.dentro \|\| \(!lettoLibero && !notte\.letto\)\}/)
  assert.match(foglietto, /<Pastiglia acceso=\{!notte\.letto\} spenta=\{!notte\.dentro \|\| serveIlLetto\}/)
  // e toccare una camera la rimette dentro
  const dentro = cambiaCamera(nonDormeQui(nottiDaSegmenti([seg('a', LENA, '2026-09-10', '2026-09-12')]), '2026-09-10'), '2026-09-10', AMBRA, contesto())
  assert.equal(dentro[0].dentro, true)
  assert.equal(dentro[0].camera, 'Ambra')
})

test('le pastiglie del foglietto si toccano su 44 px', () => {
  assert.match(foglietto, /export const ALTEZZA_PASTIGLIA = 44/)
  assert.equal((foglietto.match(/minHeight: ALTEZZA_PASTIGLIA/g) || []).length >= 5, true)
  assert.equal(/minHeight: 38|minHeight: 40/.test(foglietto), false, 'una pastiglia è rimasta più bassa di 44')
})

// ── I cambi camera si contano solo fra due notti che hanno una camera ───────
// (Ania, 15/09/2026: con una camera sola in una notte sola si leggeva
// «1 cambio camera», e con Allegra da sola «2 cambi camera».)
const notteFinta = (iso: string, camera: string | null, extra: Partial<NotteStriscia> = {}): NotteStriscia => ({
  iso, cameraId: camera, camera, letto: false, dentro: true, persone: 2, motivo: null, parallela: false, ...extra,
})

test('una camera sola in una notte sola: zero cambi', () => {
  const notti = [
    notteFinta('2026-09-14', null), notteFinta('2026-09-15', null),
    notteFinta('2026-09-16', null), notteFinta('2026-09-17', 'Lena'),
  ]
  assert.equal(cambiCamera(notti), 0)
  assert.deepEqual(segniDiCambio(notti), [false, false, false, false])
  assert.equal(riassuntoStriscia(notti), '')
})

test('una camera in mezzo, le altre notti vuote: zero cambi', () => {
  const notti = [
    notteFinta('2026-09-14', null), notteFinta('2026-09-15', null),
    notteFinta('2026-09-16', 'Allegra'), notteFinta('2026-09-17', null),
  ]
  assert.equal(cambiCamera(notti), 0)
  assert.deepEqual(segniDiCambio(notti), [false, false, false, false])
})

test('Allegra il 16 e Lena il 17: un cambio solo', () => {
  const notti = [
    notteFinta('2026-09-14', null), notteFinta('2026-09-15', null),
    notteFinta('2026-09-16', 'Allegra'), notteFinta('2026-09-17', 'Lena'),
  ]
  assert.equal(cambiCamera(notti), 1)
  assert.deepEqual(segniDiCambio(notti), [false, false, false, true])
  assert.equal(riassuntoStriscia(notti), '1 cambio camera')
})

test('due cambi veri: tre camere di fila', () => {
  const notti = [
    notteFinta('2026-09-14', 'Lena'), notteFinta('2026-09-15', 'Amelia'),
    notteFinta('2026-09-16', 'Ambra'), notteFinta('2026-09-17', 'Ambra'),
  ]
  assert.equal(cambiCamera(notti), 2)
  assert.deepEqual(segniDiCambio(notti), [false, true, true, false])
  assert.equal(riassuntoStriscia(notti), '2 cambi camera')
})

test('una notte senza camera in mezzo non fa un cambio', () => {
  const notti = [
    notteFinta('2026-09-14', 'Lena'), notteFinta('2026-09-15', null), notteFinta('2026-09-16', 'Lena'),
  ]
  assert.equal(cambiCamera(notti), 0)
  // e nemmeno fra due camere diverse: prima si sistema la notte di mezzo
  const diverse = [notteFinta('2026-09-14', 'Lena'), notteFinta('2026-09-15', null), notteFinta('2026-09-16', 'Ambra')]
  assert.equal(cambiCamera(diverse), 0)
})

test('la pausa «non dorme qui» non interrompe il conto dei cambi', () => {
  const conPausa = [
    notteFinta('2026-09-14', 'Lena'),
    notteFinta('2026-09-15', null, { dentro: false, persone: 0 }),
    notteFinta('2026-09-16', 'Ambra'),
  ]
  assert.equal(cambiCamera(conPausa), 1)
  assert.deepEqual(segniDiCambio(conPausa), [false, false, true])
  // stessa camera dopo la pausa: nessun cambio
  const stessa = [conPausa[0], conPausa[1], notteFinta('2026-09-16', 'Lena')]
  assert.equal(cambiCamera(stessa), 0)
})

test('il letto resta nel riassunto anche senza cambi', () => {
  const notti = [notteFinta('2026-09-14', 'Lena', { letto: true }), notteFinta('2026-09-15', 'Lena', { letto: true })]
  assert.equal(riassuntoStriscia(notti), 'letto in più 2 notti')
})

// ── La notte scelta si vede (15/09/2026) ───────────────────────────────────
test('la colonnina della notte scelta porta il contorno d’ottone', () => {
  assert.match(striscia, /const segnata = n\.iso === scelta/)
  assert.match(striscia, /data-scelta=\{segnata \|\| undefined\}/)
  // ottone attorno alla casella della camera, su tre lati più il quadratino sotto
  assert.match(striscia, /borderTop: segnata \? `1\.5px solid \$\{OTTONE\}`/)
  assert.match(striscia, /borderLeft: segnata \? `1\.5px solid \$\{OTTONE\}`/)
  assert.match(striscia, /borderRight: segnata \? `1\.5px solid \$\{OTTONE\}`/)
  assert.match(striscia, /borderBottom: segnata \? `1\.5px solid \$\{OTTONE\}`/)
  // senza `scelta` niente cambia: la scheda continua come prima
  assert.match(striscia, /scelta\?: string \| null/)
})

// ── Revisione del 15/09/2026: sconto, tariffa e letto nel piano ────────────
const segLungo = (extra: Record<string, unknown> = {}) => ({
  id: 'a', room_id: LENA_ID, check_in: '2026-10-01', check_out: '2026-10-05',
  num_guests: 2, extra_bed: false, extra_bed_dates: [], status: 'confermata',
  price_per_night: 80, extra_bed_total: 0, total_amount: 320,
  discount_type: null, discount_value: null, rooms: LENA, ...extra,
}) as never

test('lo sconto della prenotazione non si perde sul tratto nuovo', () => {
  // quattro notti a 80 con il 10% = 288; l'ultima passa in Ambra, anch'essa a 80
  const segmenti = [segLungo({ discount_type: 'percentage', discount_value: 10, total_amount: 288 })]
  const notti = cambiaCamera(nottiDaSegmenti([segmenti[0]]), '2026-10-04', AMBRA, contesto())
  const p = pianoNotti(notti, segmenti, contesto())
  const totale = p.aggiorna.reduce((s, a) => s + a.campi.total_amount, 0) + p.crea.reduce((s, c) => s + c.total_amount, 0)
  assert.equal(totale, 288, 'prima faceva 216 + 80 = 296')
  assert.equal(p.crea[0].discount_type, 'percentage')
  assert.equal(p.crea[0].discount_value, 10)
})

test('il totale concordato diventa la percentuale che dà quel totale', () => {
  // 320 pieno, concordati 288: spezzando in due il totale resta 288
  const segmenti = [segLungo({ discount_type: 'target_total', discount_value: 288, total_amount: 288 })]
  const notti = cambiaCamera(nottiDaSegmenti([segmenti[0]]), '2026-10-04', AMBRA, contesto())
  const p = pianoNotti(notti, segmenti, contesto())
  const totale = p.aggiorna.reduce((s, a) => s + a.campi.total_amount, 0) + p.crea.reduce((s, c) => s + c.total_amount, 0)
  assert.equal(totale, 288)
  assert.equal(p.aggiorna[0].campi.discount_type, 'percentage')
  // con un blocco solo resta «porta il totale a»
  const uguale = pianoNotti(nottiDaSegmenti([segmenti[0]]), segmenti, contesto())
  assert.deepEqual(uguale.aggiorna, [])
})

test('la tariffa concordata non torna al listino', () => {
  // 60 € concordati, listino 80: separando l'ultima notte le altre restano a 60
  const segmenti = [segLungo({ price_per_night: 60, total_amount: 240 })]
  const notti = cambiaCamera(nottiDaSegmenti([segmenti[0]]), '2026-10-04', AMBRA, contesto())
  const p = pianoNotti(notti, segmenti, contesto())
  assert.equal(p.aggiorna[0].campi.price_per_night, 60, 'prima tornava 80')
  assert.equal(p.aggiorna[0].campi.total_amount, 180)
  assert.equal(p.crea[0].price_per_night, 80)   // la camera nuova prende il suo listino
})

test('cambiando le persone la tariffa la rifà il listino', () => {
  // in Lena da due a tre persone (col letto la prima notte) il prezzo torna
  // al listino: la tariffa vecchia non si conserva se cambia la gente
  const segmenti = [segLungo({ price_per_night: 60, total_amount: 240 })]
  const notti = cambiaOspitiNotte(nottiDaSegmenti([segmenti[0]]), '2026-10-01', 3, contesto({ ospiti: 3 }))
  const p = pianoNotti(notti, segmenti, contesto({ ospiti: 3 }))
  // resta UNA riga: «tre persone solo la prima notte» si scrive con num_guests 3
  // e il letto acceso quel giorno, non spezzando il tratto
  assert.equal(p.crea.length, 0)
  const campi = p.aggiorna[0].campi
  assert.equal(campi.num_guests, 3)
  assert.deepEqual(campi.extra_bed_dates, ['2026-10-01'])
  assert.equal(campi.total_amount, 330)   // 90 in tre + 80 × 3 in due
})

test('due notti col letto e persone diverse vanno in tratti diversi', () => {
  // tre persone una notte e quattro l'altra non stanno in una riga sola
  const notti = nottiDaSegmenti([segLungo({ num_guests: 4, extra_bed: true, extra_bed_dates: ['2026-10-01', '2026-10-02'] })])
    .map(n => (n.iso === '2026-10-01' ? { ...n, persone: 3 } : n))
  const blocchi = blocchiDaNotti(notti)
  assert.equal(blocchi.length, 2)
  assert.deepEqual(blocchi.map(b => b.ospiti), [3, 4])
})

test('l’accordo del letto si porta dietro e non si moltiplica', () => {
  // 30 € IN TUTTO su quattro notti: spezzando restano 30, non 60
  const segmenti = [segLungo({
    num_guests: 3, price_per_night: 90, extra_bed: true,
    extra_bed_dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    extra_bed_total: 30, extra_bed_importo: 30, extra_bed_criterio: 'totale', total_amount: 390,
  })]
  const notti = cambiaCamera(nottiDaSegmenti([segmenti[0]]), '2026-10-04', AMBRA, contesto({ ospiti: 3 }))
  const p = pianoNotti(notti, segmenti, contesto({ ospiti: 3 }))
  const righe = [...p.aggiorna.map(a => a.campi), ...p.crea]
  assert.equal(righe.reduce((s, c) => s + c.extra_bed_total, 0), 30, 'prima faceva 0 + 10')
  // importo e criterio viaggiano insieme su ogni riga col letto
  for (const r of righe.filter(c => c.extra_bed)) {
    assert.equal(r.extra_bed_importo, 30)
    assert.equal(r.extra_bed_criterio, 'totale')
  }
})

test('«ogni 4 notti» non ricomincia a ogni tratto', () => {
  const segmenti = [segLungo({
    num_guests: 3, price_per_night: 90, extra_bed: true,
    extra_bed_dates: ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'],
    extra_bed_total: 20, extra_bed_importo: 20, extra_bed_criterio: 'ogni4', total_amount: 380,
  })]
  const notti = cambiaCamera(nottiDaSegmenti([segmenti[0]]), '2026-10-04', AMBRA, contesto({ ospiti: 3 }))
  const p = pianoNotti(notti, segmenti, contesto({ ospiti: 3 }))
  const righe = [...p.aggiorna.map(a => a.campi), ...p.crea]
  assert.equal(righe.reduce((s, c) => s + c.extra_bed_total, 0), 20, 'prima faceva 20 + 20')
})

test('senza accordo salvato il letto resta quello del listino', () => {
  const segmenti = [segLungo({
    num_guests: 3, price_per_night: 90, extra_bed: true,
    extra_bed_dates: ['2026-10-01', '2026-10-02'], extra_bed_total: 0, total_amount: 340,
  })]
  const notti = cambiaCamera(nottiDaSegmenti([segmenti[0]]), '2026-10-04', AMBRA, contesto({ ospiti: 3 }))
  const p = pianoNotti(notti, segmenti, contesto({ ospiti: 3 }))
  const righe = [...p.aggiorna.map(a => a.campi), ...p.crea]
  // niente accordo: importo e criterio restano vuoti tutti e due, come vuole il database
  for (const r of righe) {
    assert.equal(r.extra_bed_importo ?? null, null)
    assert.equal(r.extra_bed_criterio ?? null, null)
  }
})
