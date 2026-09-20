// La nuova scheda prenotazione (13/09/2026): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  statoScheda, primaRigaScheda, etichettaArrivoScheda, rigaGrandeScheda, misuraCamere, statoConto, noteScheda,
  caselleSoggiorno, arrivoScheda, trattiCamera, periodoTratto, daControllareScheda, euroScheda, vocePagamentoScheda,
  SEZIONI_SCHEDA, type SegmentoScheda,
  TITOLO_PAGAMENTO_PARZIALE, TITOLO_NESSUN_PAGAMENTO, TITOLO_OLTRE_IL_TOTALE, TITOLO_SEGNATA_PAGATA, TITOLO_CONTO_NON_LEGGIBILE,
  DETTAGLIO_CONTO_NON_LEGGIBILE, COMANDO_AGGIUNGI_PAGAMENTO, TITOLO_DOCUMENTO, DETTAGLIO_DOCUMENTO_IN_CASA, DETTAGLIO_DOCUMENTO_PRIMA,
} from './schedaPrenotazione.ts'
import { riepilogoConto } from './schedaConto.ts'

type Camera = NonNullable<SegmentoScheda['rooms']>
const LENA: Camera = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: Camera = { id: 'amelia', name: 'Amelia', base_price: 50, has_extra_bed: true, extra_bed_price: 10 }

const OGGI = '2026-09-13'
const seg = (id: string, camera: Camera, check_in: string, check_out: string, extra: Partial<SegmentoScheda> = {}): SegmentoScheda => ({
  id, room_id: camera.id, check_in, check_out, status: 'confermata', num_guests: 2, price_per_night: 80, extra_bed: false, extra_bed_dates: [],
  extra_bed_total: 0, total_amount: 160, rooms: camera, group_id: null, ...extra,
})

// Carmela Sabia, 10–17 set: Lena → Amelia → Lena, 550 € in contanti
const CARMELA: SegmentoScheda[] = [
  seg('c1', LENA, '2026-09-10', '2026-09-13', { group_id: 'g', total_amount: 240, check_in_time: '15:10', shuttle: 'si' }),
  seg('c2', AMELIA, '2026-09-13', '2026-09-15', { group_id: 'g', num_guests: 1, price_per_night: 65, total_amount: 130 }),
  seg('c3', LENA, '2026-09-15', '2026-09-17', { group_id: 'g', num_guests: 3, price_per_night: 90, extra_bed: true, extra_bed_dates: ['2026-09-15', '2026-09-16'], total_amount: 180 }),
]

test('la fascia ha le cinque voci nell’ordine deciso', () => {
  assert.deepEqual(SEZIONI_SCHEDA.map(v => v.label), ['Controllare', 'Soggiorno', 'Conto', 'Messaggi', 'Cliente'])
  assert.deepEqual(SEZIONI_SCHEDA.map(v => v.id), ['controllare', 'soggiorno', 'conto', 'messaggi', 'cliente'])
})

test('lo stato in alto a destra', () => {
  assert.equal(statoScheda('confermata', '2026-09-17', OGGI), 'Confermata')
  assert.equal(statoScheda('confermata', '2026-09-13', OGGI), 'Conclusa')      // partita oggi
  assert.equal(statoScheda('completata', '2026-09-20', OGGI), 'Conclusa')
  assert.equal(statoScheda('annullata', '2026-09-20', OGGI), 'Annullata')
  assert.equal(statoScheda('in_attesa', '2026-09-20', OGGI), 'In attesa')
})

test('prima riga: prima volta, che torna, senza provenienza', () => {
  assert.deepEqual(primaRigaScheda(0, null), { testo: 'Prima volta', chiediProvenienza: true })
  assert.deepEqual(primaRigaScheda(0, 'Google'), { testo: 'Prima volta · Google', chiediProvenienza: false })
  assert.deepEqual(primaRigaScheda(3, 'passaparola'), { testo: 'Già ospite 3 volte · passaparola', chiediProvenienza: false })
  assert.deepEqual(primaRigaScheda(1, null), { testo: 'Già ospite 1 volta', chiediProvenienza: true })
  assert.deepEqual(primaRigaScheda(2, '  '), { testo: 'Già ospite 2 volte', chiediProvenienza: true })
})

test('etichetta sotto la data di arrivo: con e senza orario e navetta', () => {
  assert.equal(etichettaArrivoScheda('15:10', 'si'), 'arriva 15:10 · navetta')
  assert.equal(etichettaArrivoScheda('15:10', 'no'), 'arriva 15:10')
  assert.equal(etichettaArrivoScheda('15:10', null), 'arriva 15:10')
  assert.equal(etichettaArrivoScheda(null, 'si'), 'arriva · navetta')
  assert.equal(etichettaArrivoScheda('', null), 'arriva')
})

test('riga grande: una camera, con cambi, con due camere insieme', () => {
  assert.deepEqual(rigaGrandeScheda([seg('a', LENA, '2026-09-10', '2026-09-12')]), { ospiti: 2, camere: 'Lena', cambi: 0, insieme: false })
  // Carmela: Lena → Amelia → Lena = 2 cambi, al massimo 3 persone (le ultime due notti).
  // REGOLA FISSA n. 8 (Ania, 18/09/2026): i nomi per esteso col segno di sempre
  assert.deepEqual(rigaGrandeScheda(CARMELA), { ospiti: 3, camere: 'Lena ⇄ Amelia ⇄ Lena', cambi: 2, insieme: false })
  // Dario Barone: due LINEE separate (senza group_id) ma una dopo l'altra → è un cambio camera, non «+»
  const dario = [seg('d1', LENA, '2026-09-10', '2026-09-13', { prenotazione_id: 'P' }), seg('d2', AMELIA, '2026-09-13', '2026-09-15', { prenotazione_id: 'P' })]
  assert.deepEqual(rigaGrandeScheda(dario), { ospiti: 2, camere: 'Lena ⇄ Amelia', cambi: 1, insieme: false })
  // tre cambi: tutti i nomi, e la riga grande scende a 18 px
  const tre = [...dario, seg('d3', LENA, '2026-09-15', '2026-09-16', { prenotazione_id: 'P' }), seg('d4', AMELIA, '2026-09-16', '2026-09-18', { prenotazione_id: 'P' })]
  assert.deepEqual(rigaGrandeScheda(tre), { ospiti: 2, camere: 'Lena ⇄ Amelia ⇄ Lena ⇄ Amelia', cambi: 3, insieme: false })
  assert.equal(misuraCamere('Lena ⇄ Amelia ⇄ Lena ⇄ Amelia'), 18)
  assert.equal(misuraCamere('Lena ⇄ Amelia'), 24)
  assert.equal(misuraCamere('Lena + Amelia'), 24)
  // due camere nelle stesse notti: nomi con «+», ospiti sommati
  const parallele = [
    seg('p1', LENA, '2026-09-10', '2026-09-12', { prenotazione_id: 'P' }),
    seg('p2', AMELIA, '2026-09-10', '2026-09-12', { prenotazione_id: 'P', num_guests: 1 }),
  ]
  assert.deepEqual(rigaGrandeScheda(parallele), { ospiti: 3, camere: 'Lena + Amelia', cambi: 0, insieme: true })
  // un tratto annullato non conta
  assert.deepEqual(rigaGrandeScheda([...CARMELA, seg('x', AMELIA, '2026-09-17', '2026-09-19', { status: 'annullata', group_id: 'g' })]).cambi, 2)
})

test('lo stato del conto nei tre casi', () => {
  assert.deepEqual(statoConto({ totaleCent: 55000, ricevutiCent: 55000 }), { tipo: 'pagato', testo: '✓ 550 € pagato' })
  assert.deepEqual(statoConto({ totaleCent: 55000, ricevutiCent: 0, pagato: true }), { tipo: 'pagato', testo: '✓ 550 € pagato' })
  assert.deepEqual(statoConto({ totaleCent: 55000, ricevutiCent: 30000 }), { tipo: 'da_incassare', testo: '250 € da incassare' })
  assert.deepEqual(statoConto({ totaleCent: 55000, ricevutiCent: 0, bonifico: true }), { tipo: 'bonifico_atteso', testo: '550 € bonifico atteso' })
  // bonifico con un acconto già arrivato: manca il resto
  assert.deepEqual(statoConto({ totaleCent: 55000, ricevutiCent: 20000, bonifico: true }), { tipo: 'da_incassare', testo: '350 € da incassare' })
  // i centesimi non si arrotondano
  assert.equal(euroScheda(7250), '72,50 €')
  assert.equal(euroScheda(136000), '1.360 €')
})

test('le note: presenti e assenti, con «questa volta» solo sulla prenotazione', () => {
  assert.deepEqual(noteScheda(null, null), [])
  assert.deepEqual(noteScheda('  ', ''), [])
  assert.deepEqual(noteScheda('Vuole la camera silenziosa.', null), [{ etichetta: '', testo: 'Vuole la camera silenziosa.' }])
  assert.deepEqual(noteScheda(null, 'Arriva in treno.'), [{ etichetta: 'questa volta', testo: 'Arriva in treno.' }])
  assert.deepEqual(noteScheda('A', 'B').map(n => n.etichetta), ['', 'questa volta'])
})

test('la striscia delle notti: cambio camera, oggi, ospiti diversi per notte', () => {
  const c = caselleSoggiorno(CARMELA, OGGI)
  assert.equal(c.length, 7)
  assert.deepEqual(c.map(x => x.numero), [10, 11, 12, 13, 14, 15, 16])
  assert.deepEqual(c.map(x => x.camera), ['Lena', 'Lena', 'Lena', 'Amelia', 'Amelia', 'Lena', 'Lena'])
  assert.deepEqual(c.map(x => x.cambia), [false, false, false, true, false, true, false])
  assert.deepEqual(c.map(x => x.persone), [2, 2, 2, 1, 1, 3, 3])
  assert.deepEqual(c.map(x => x.giorno), ['gio', 'ven', 'sab', 'Oggi', 'lun', 'mar', 'mer'])
  assert.deepEqual(c.map(x => x.oggi), [false, false, false, true, false, false, false])
  assert.deepEqual(c.map(x => x.segmentoId), ['c1', 'c1', 'c1', 'c2', 'c2', 'c3', 'c3'])
  // due camere insieme: una casella sola con «+» e le persone sommate
  const p = caselleSoggiorno([
    seg('p1', LENA, '2026-09-10', '2026-09-12'),
    seg('p2', AMELIA, '2026-09-10', '2026-09-11', { num_guests: 1 }),
  ], '2026-01-01')
  assert.deepEqual(p.map(x => x.camera), ['Lena + Amelia', 'Lena'])
  assert.deepEqual(p.map(x => x.persone), [3, 2])
  assert.deepEqual(caselleSoggiorno([], OGGI), [])
})

test('la riga «Arrivo»: quando, orario e navetta', () => {
  assert.deepEqual(arrivoScheda('2026-09-13', OGGI, '15:10', 'si'), { quando: 'oggi', orario: '15:10', navetta: 'con navetta' })
  assert.deepEqual(arrivoScheda('2026-09-14', OGGI, null, 'no'), { quando: 'domani', orario: null, navetta: 'senza navetta' })
  assert.deepEqual(arrivoScheda('2026-09-12', OGGI, '', null), { quando: 'ieri', orario: null, navetta: null })
  assert.deepEqual(arrivoScheda('2026-09-10', OGGI, '15:10', null), { quando: 'gio 10 set', orario: '15:10', navetta: null })
})

test('i tratti di camera: prezzo del tratto, notti SEMPRE scritte, «cambio» dopo un cambio', () => {
  const t = trattiCamera(CARMELA)
  assert.deepEqual(t.map(x => x.camera), ['Lena', 'Amelia', 'Lena'])
  assert.deepEqual(t.map(x => x.prezzo), ['240 €', '130 €', '180 €'])
  assert.equal(t[0].dettaglio, '10 → 13 · 3 notti · 2 ospiti · 80 € a notte')
  assert.equal(t[1].dettaglio, '13 → 15 · 2 notti · 1 ospite · 65 € a notte')
  assert.deepEqual(t.map(x => x.cambio), [false, true, true])
  // una notte sola: «1 notte»
  const uno = trattiCamera([seg('u', AMELIA, '2026-09-30', '2026-10-01', { num_guests: 1, price_per_night: 50, total_amount: 50 })])
  assert.equal(uno[0].dettaglio, '30 set → 1 ott · 1 notte · 1 ospite · 50 € a notte')
  assert.equal(uno[0].cambio, false)
  // due camere in parallelo: nessuna etichetta «cambio»
  const p = trattiCamera([
    seg('p1', LENA, '2026-09-10', '2026-09-12', { prenotazione_id: 'P' }),
    seg('p2', AMELIA, '2026-09-10', '2026-09-12', { prenotazione_id: 'P', num_guests: 1 }),
  ])
  assert.deepEqual(p.map(x => x.cambio), [false, false])
  assert.equal(periodoTratto('2026-09-10', '2026-09-12'), '10 → 12')
  assert.equal(periodoTratto('2026-12-30', '2027-01-02'), '30 dic → 2 gen')
})

test('da controllare: due cose (cambio camera oggi, documento mancante) e niente', () => {
  const due = daControllareScheda({ segmenti: CARMELA, altre: [], pagamenti: [{ booking_id: 'c1', amount: 550, paid_on: '2026-09-10' }], oggi: OGGI, documenti: 0, hrefDocumenti: '/clienti/g1#documenti' })
  assert.deepEqual(due.map(v => v.etichetta), ['Cambio camera', 'Documento'])
  assert.equal(due[0].titolo, 'Oggi passa da Lena a Amelia')
  assert.equal(due[1].titolo, TITOLO_DOCUMENTO)
  assert.deepEqual(due[1].link, { testo: 'Aggiungi documento', href: '/clienti/g1#documenti' })
  assert.equal(due[1].dettaglio, DETTAGLIO_DOCUMENTO_IN_CASA)
  // pagata, con il documento e senza cambi vicini: niente
  const niente = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-20', '2026-09-22')], altre: [], pagamenti: [], oggi: OGGI, documenti: 2, hrefDocumenti: null })
  assert.deepEqual(niente, [])
  // senza documento anche PRIMA dell'arrivo (Ania, 17/09/2026): si vede, con «da chiedere all'arrivo»
  const futura = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-20', '2026-09-22')], altre: [], pagamenti: [], oggi: OGGI, documenti: 0, hrefDocumenti: '/clienti/g1#documenti' })
  assert.deepEqual(futura.map(v => v.etichetta), ['Documento'])
  assert.equal(futura[0].dettaglio, DETTAGLIO_DOCUMENTO_PRIMA)
  // soggiorno finito: niente, anche senza documento
  const finita = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-01', '2026-09-03')], altre: [], pagamenti: [{ booking_id: 'a', amount: 160, paid_on: '2026-09-01' }], oggi: OGGI, documenti: 0, hrefDocumenti: null })
  assert.equal(finita.some(v => v.etichetta === 'Documento'), false)
})

test('da controllare: le regole della Home filtrate su questa prenotazione', () => {
  // arrivata il 10, pagato niente: la voce dei pagamenti compare come in Home,
  // ma dice il conto (punto 3, 20/09/2026 sera) e apre il foglio QUI
  const nonPagata = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-10', '2026-09-20', { total_amount: 800, guest_name: 'Rosa' })], altre: [], pagamenti: [], oggi: OGGI, documenti: 1, hrefDocumenti: null, conto: { totaleCent: 80000, ricevutiCent: 0 } })
  assert.deepEqual(nonPagata.map(v => v.etichetta), ['Pagamento'])
  assert.equal(nonPagata[0].titolo, TITOLO_NESSUN_PAGAMENTO)
  assert.equal(nonPagata[0].dettaglio, 'Da incassare 800 €')
  assert.equal(nonPagata[0].link, null)
  assert.deepEqual(nonPagata[0].comando, { tipo: 'pagamento', testo: COMANDO_AGGIUNGI_PAGAMENTO })
  // arriva domani senza orario
  const domani = daControllareScheda({ segmenti: [seg('b', LENA, '2026-09-14', '2026-09-16', { guest_name: 'Anna' })], altre: [], pagamenti: [], oggi: OGGI, documenti: null, hrefDocumenti: null })
  assert.deepEqual(domani.map(v => v.etichetta), ['Arrivo'])
  assert.equal(domani[0].link?.href, '/arrivi?apri=b')
  // un'altra prenotazione sulla stessa camera nelle stesse notti: sovrapposizione
  const altra = { id: 'z', group_id: null, room_id: 'lena', check_in: '2026-09-21', check_out: '2026-09-23', status: 'confermata', total_amount: 160, guest_name: 'Marta' }
  const sovr = daControllareScheda({ segmenti: [seg('c', LENA, '2026-09-20', '2026-09-22', { guest_name: 'Rosa' })], altre: [altra], pagamenti: [], oggi: OGGI, documenti: 1, hrefDocumenti: null })
  assert.deepEqual(sovr.map(v => v.etichetta), ['Calendario'])
  // una sovrapposizione fra ALTRE due prenotazioni non riguarda questa scheda
  const estranea = { ...altra, id: 'y', room_id: 'amelia' }
  const nulla = daControllareScheda({ segmenti: [seg('c', LENA, '2026-09-20', '2026-09-22')], altre: [{ ...altra, id: 'w', room_id: 'amelia' }, estranea], pagamenti: [], oggi: OGGI, documenti: 1, hrefDocumenti: null })
  assert.deepEqual(nulla, [])
})

// ── Punto 3 (20/09/2026 sera): l'avviso del pagamento dice il conto ────────
// Il caso approvato da Ania: Rosa, 1 → 25 set, quattro tratti (Ambra, Amelia,
// Lena, Ambra) per 1.880 €, due pagamenti da 400 € registrati interi sul
// primo tratto (regola fissa n. 9). Oggi 20 set: in casa, senza documento.
const AMBRA: Camera = { id: 'ambra', name: 'Ambra', base_price: 60, has_extra_bed: false }
const G = 'rosa'
const ROSA: SegmentoScheda[] = [
  seg('r1', AMBRA, '2026-09-01', '2026-09-07', { group_id: G, guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 480, check_in_time: '16:00' }),
  seg('r2', AMELIA, '2026-09-07', '2026-09-11', { group_id: G, guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 280 }),
  seg('r3', LENA, '2026-09-11', '2026-09-22', { group_id: G, guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 880 }),
  seg('r4', AMBRA, '2026-09-22', '2026-09-25', { group_id: G, guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 240 }),
]
const DUE_DA_400 = [{ booking_id: 'r1', amount: 400, paid_on: '2026-09-07' }, { booking_id: 'r1', amount: 400, paid_on: '2026-09-16' }]
const OGGI_ROSA = '2026-09-20'
// il conto come lo fa la pagina (contoPrenotazione): totale delle righe, movimenti delle righe
const contoDi = (segmenti: SegmentoScheda[], pagamenti: { booking_id: string; amount: number }[]) => {
  const ids = new Set(segmenti.map(s => s.id))
  return {
    totaleCent: segmenti.filter(s => s.status !== 'annullata').reduce((t, s) => t + Math.round(Number(s.total_amount) * 100), 0),
    ricevutiCent: pagamenti.filter(p => ids.has(p.booking_id)).reduce((t, p) => t + Math.round(p.amount * 100), 0),
  }
}
const dati = (segmenti: SegmentoScheda[], pagamenti: { booking_id: string; amount: number; paid_on: string }[], extra: Partial<Parameters<typeof daControllareScheda>[0]> = {}) => ({
  segmenti, altre: [], pagamenti, oggi: OGGI_ROSA, documenti: 0, hrefDocumenti: '/clienti/g-rosa#documenti', conto: contoDi(segmenti, pagamenti), ...extra,
})

test('il caso approvato: 1.880 € totali, 800 € ricevuti, restano 1.080 €; due avvisi, PAGAMENTO e DOCUMENTO', () => {
  const voci = daControllareScheda(dati(ROSA, DUE_DA_400))
  assert.deepEqual(voci.map(v => v.etichetta), ['Pagamento', 'Documento'])
  const [pag, doc] = voci
  assert.equal(pag.titolo, TITOLO_PAGAMENTO_PARZIALE)
  assert.equal(pag.dettaglio, 'Ricevuti 800 € · restano 1.080 €')
  // gli importi sono i pezzi in grassetto, le parole no
  assert.deepEqual(pag.parti, [{ testo: 'Ricevuti ' }, { testo: '800 €', forte: true }, { testo: ' · restano ' }, { testo: '1.080 €', forte: true }])
  assert.deepEqual(pag.comando, { tipo: 'pagamento', testo: 'Aggiungi pagamento' })
  assert.equal(pag.link, null)
  // niente nome, camere, periodo o «arrivato il 7 set» dentro l'avviso
  for (const parola of ['Rosa', 'Ambra', 'Amelia', 'Lena', '7 set', '1 set', 'arrivat', 'non segnato']) {
    assert.equal((pag.titolo + pag.dettaglio).toLowerCase().includes(parola.toLowerCase()), false, `l'avviso dice ancora «${parola}»`)
  }
  assert.equal(doc.titolo, TITOLO_DOCUMENTO)
  assert.equal(doc.dettaglio, DETTAGLIO_DOCUMENTO_IN_CASA)
  assert.deepEqual(doc.link, { testo: 'Aggiungi documento', href: '/clienti/g-rosa#documenti' })
  // due pagamenti distinti contati UNA volta, e un avviso solo anche con i cambi camera
  assert.equal(voci.filter(v => v.etichetta === 'Pagamento').length, 1)
})

test('le cifre sono quelle del riepilogo del conto, anche coi centesimi dello sconto', () => {
  // 12,5 % di sconto su 210 € = 183,75 €, con 100 € di anticipo
  const conto = { totaleCent: 18375, ricevutiCent: 10000 }
  const r = riepilogoConto(conto)
  const v = vocePagamentoScheda(conto)
  assert.equal(v.dettaglio, `Ricevuti ${r.ricevuto} · restano ${r.residuo}`)
  assert.equal(v.dettaglio, 'Ricevuti 100 € · restano 83,75 €')
  // e nel caso approvato
  const r2 = riepilogoConto(contoDi(ROSA, DUE_DA_400))
  assert.deepEqual([r2.totale, r2.ricevuto, r2.residuo], ['1.880 €', '800 €', '1.080 €'])
})

test('camere contemporanee: un avviso solo, con il conto di tutta la prenotazione', () => {
  // due camere nelle stesse notti, prenotazione unica (prenotazione_id), gruppi diversi
  const parallele = [
    seg('p1', LENA, '2026-09-18', '2026-09-22', { prenotazione_id: 'P', group_id: 'gp1', guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 320 }),
    seg('p2', AMELIA, '2026-09-18', '2026-09-22', { prenotazione_id: 'P', group_id: 'gp2', guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 200 }),
  ]
  const pagamenti = [{ booking_id: 'p1', amount: 300, paid_on: '2026-09-18' }]
  const voci = daControllareScheda(dati(parallele, pagamenti, { documenti: 1 }))
  assert.deepEqual(voci.map(v => v.etichetta), ['Pagamento'])
  assert.equal(voci[0].dettaglio, 'Ricevuti 300 € · restano 220 €')
})

test('camere contemporanee legate SOLO da prenotazione_id: un pagamento intero sulla prima non fa gridare «restano 0 €» (verifica del 20/09/2026)', () => {
  const parallele = [
    seg('q1', LENA, '2026-09-18', '2026-09-22', { prenotazione_id: 'P', group_id: null, guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 80, pagato: false }),
    seg('q2', AMELIA, '2026-09-18', '2026-09-22', { prenotazione_id: 'P', group_id: null, guest_id: 'g-rosa', guest_name: 'Rosa Macauda', total_amount: 80, pagato: false }),
  ]
  // 160 € interi sulla prima riga: conto 160/160, residuo zero → nessun avviso del pagamento
  const saldata = daControllareScheda(dati(parallele, [{ booking_id: 'q1', amount: 160, paid_on: '2026-09-18' }], { documenti: 1 }))
  assert.deepEqual(saldata, [])
  // 100 € sulla prima: un avviso solo, col conto di tutta la prenotazione
  const parziale = daControllareScheda(dati(parallele, [{ booking_id: 'q1', amount: 100, paid_on: '2026-09-18' }], { documenti: 1 }))
  assert.deepEqual(parziale.map(v => v.etichetta), ['Pagamento'])
  assert.equal(parziale[0].titolo, TITOLO_PAGAMENTO_PARZIALE)
  assert.equal(parziale[0].dettaglio, 'Ricevuti 100 € · restano 60 €')
  // 200 € sulla prima: oltre il totale, l'anomalia vera resta un avviso
  const oltre = daControllareScheda(dati(parallele, [{ booking_id: 'q1', amount: 200, paid_on: '2026-09-18' }], { documenti: 1 }))
  assert.equal(oltre.length, 1)
  assert.equal(oltre[0].titolo, TITOLO_OLTRE_IL_TOTALE)
  // niente in comune (né prenotazione_id né group_id) ma stessa scheda: vale lo stesso l'identità unica
  const soleRighe = parallele.map(s => ({ ...s, prenotazione_id: null }))
  assert.deepEqual(daControllareScheda(dati(soleRighe, [{ booking_id: 'q1', amount: 160, paid_on: '2026-09-18' }], { documenti: 1 })), [])
  // mai «restano 0 €»: con residuo zero l'avviso del pagamento non compare, in nessuna forma
  const stringhe = JSON.stringify(daControllareScheda(dati(parallele, [{ booking_id: 'q2', amount: 160, paid_on: '2026-09-18' }], { documenti: 1 })))
  assert.equal(/restano 0 €/.test(stringhe), false)
})

test('nessun pagamento: «Nessun pagamento registrato · Da incassare», senza inventare movimenti', () => {
  const voci = daControllareScheda(dati(ROSA, [], { documenti: 1 }))
  assert.deepEqual(voci.map(v => v.titolo), [TITOLO_NESSUN_PAGAMENTO])
  assert.equal(voci[0].dettaglio, 'Da incassare 1.880 €')
})

test('un pagamento in più: avviso e conto cambiano insieme; col saldo l\'avviso sparisce e il conteggio scende', () => {
  const conAltri500 = [...DUE_DA_400, { booking_id: 'r3', amount: 500, paid_on: '2026-09-20' }]
  const dopo = daControllareScheda(dati(ROSA, conAltri500))
  assert.equal(dopo[0].dettaglio, 'Ricevuti 1.300 € · restano 580 €')
  assert.equal(riepilogoConto(contoDi(ROSA, conAltri500)).residuo, '580 €')
  // saldo completo: niente avviso del pagamento, resta solo il documento
  const saldo = [...conAltri500, { booking_id: 'r4', amount: 580, paid_on: '2026-09-20' }]
  const saldato = daControllareScheda(dati(ROSA, saldo))
  assert.deepEqual(saldato.map(v => v.etichetta), ['Documento'])
  assert.equal(saldato.length, 1)
  // segnata «pagato» a mano: idem, niente avviso
  const segnata = daControllareScheda(dati(ROSA.map(s => ({ ...s, pagato: true })), DUE_DA_400, { pagato: true }))
  assert.deepEqual(segnata.map(v => v.etichetta), ['Documento'])
})

test('scadenza futura: prima dell\'arrivo nessun avviso del pagamento, neanche con un residuo; e mai «scaduto»', () => {
  // arriva il 1° ottobre, oggi è il 20 set: la regola della Home tace
  const futura = ROSA.map((s, i) => ({ ...s, check_in: ['2026-10-01', '2026-10-07', '2026-10-11', '2026-10-22'][i], check_out: ['2026-10-07', '2026-10-11', '2026-10-22', '2026-10-25'][i] }))
  const voci = daControllareScheda(dati(futura, [{ booking_id: 'r1', amount: 400, paid_on: '2026-09-07' }], { documenti: 1 }))
  assert.deepEqual(voci, [])
  // e nei testi degli avvisi non c'è mai «scadut» o «ritardo»
  for (const v of [vocePagamentoScheda({ totaleCent: 188000, ricevutiCent: 80000 }), vocePagamentoScheda({ totaleCent: 188000, ricevutiCent: 0 })]) {
    assert.equal(/scadut|ritardo|urgente/i.test(v.titolo + v.dettaglio), false)
  }
})

test('lettura dei pagamenti fallita: l\'avviso dice che il conto non si legge, mai «Ricevuti 0 €»', () => {
  const voci = daControllareScheda(dati(ROSA, [], { conto: null, documenti: 1 }))
  assert.deepEqual(voci.map(v => v.etichetta), ['Pagamento'])
  assert.equal(voci[0].titolo, TITOLO_CONTO_NON_LEGGIBILE)
  assert.equal(voci[0].dettaglio, DETTAGLIO_CONTO_NON_LEGGIBILE)
  assert.equal(voci[0].comando, undefined)
  assert.equal(voci[0].parti, undefined)
  assert.equal(/0 €/.test(voci[0].dettaglio ?? ''), false)
  // conto assente = come null
  assert.equal(daControllareScheda({ ...dati(ROSA, []), conto: undefined, documenti: 1 })[0].titolo, TITOLO_CONTO_NON_LEGGIBILE)
})

test('incoerenze: pagamenti oltre il totale, e il vecchio segno «pagato» senza i movimenti (a soggiorno concluso)', () => {
  const oltre = vocePagamentoScheda({ totaleCent: 188000, ricevutiCent: 200000 })
  assert.equal(oltre.titolo, TITOLO_OLTRE_IL_TOTALE)
  assert.equal(oltre.dettaglio, 'Ricevuti 2.000 € su 1.880 €')
  const segnata = vocePagamentoScheda({ totaleCent: 188000, ricevutiCent: 80000 }, true)
  assert.equal(segnata.titolo, TITOLO_SEGNATA_PAGATA)
  assert.equal(segnata.dettaglio, 'Registrati 800 € su 1.880 €')
  // dalla regola della Home: concluso, segnato pagato, movimenti che non arrivano → l'avviso c'è e dice l'incoerenza
  const conclusa = daControllareScheda(dati(ROSA.map(s => ({ ...s, pagato: true })), DUE_DA_400, { oggi: '2026-09-30', pagato: true, documenti: 1 }))
  assert.deepEqual(conclusa.map(v => v.titolo), [TITOLO_SEGNATA_PAGATA])
})

test('documento: assente → avviso; presente → niente; lettura fallita o in corso (null) → niente, mai un «manca» finto', () => {
  const base = { segmenti: ROSA, altre: [], pagamenti: DUE_DA_400, oggi: OGGI_ROSA, hrefDocumenti: '/clienti/g-rosa#documenti', conto: contoDi(ROSA, DUE_DA_400) }
  assert.equal(daControllareScheda({ ...base, documenti: 0 }).some(v => v.chiave === 'documento'), true)
  assert.equal(daControllareScheda({ ...base, documenti: 2 }).some(v => v.chiave === 'documento'), false)
  assert.equal(daControllareScheda({ ...base, documenti: null }).some(v => v.chiave === 'documento'), false)
  // il conteggio è quello degli avvisi davvero presenti
  assert.equal(daControllareScheda({ ...base, documenti: 0 }).length, 2)
  assert.equal(daControllareScheda({ ...base, documenti: 2 }).length, 1)
})

test('gli altri avvisi restano: cambio camera domani, arrivo senza orario, sovrapposizione', () => {
  // cambio camera domani (21 → 22? no: il cambio è il 22, quindi oggi = 21)
  const cambio = daControllareScheda(dati(ROSA, DUE_DA_400, { oggi: '2026-09-21', documenti: 1 }))
  assert.deepEqual(cambio.map(v => v.etichetta), ['Cambio camera', 'Pagamento'])
  assert.equal(cambio[0].titolo, 'Domani passa da Lena a Ambra')
  // arrivo domani senza orario
  const domani = daControllareScheda(dati([seg('b', LENA, '2026-09-21', '2026-09-23', { guest_name: 'Anna' })], [], { documenti: 1 }))
  assert.deepEqual(domani.map(v => v.etichetta), ['Arrivo'])
  assert.equal(domani[0].link?.href, '/arrivi?apri=b')
})
