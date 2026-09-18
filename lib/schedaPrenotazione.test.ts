// La nuova scheda prenotazione (13/09/2026): le prove della logica pura.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  statoScheda, primaRigaScheda, etichettaArrivoScheda, rigaGrandeScheda, misuraCamere, statoConto, noteScheda,
  caselleSoggiorno, arrivoScheda, trattiCamera, periodoTratto, daControllareScheda, euroScheda,
  SEZIONI_SCHEDA, type SegmentoScheda,
} from './schedaPrenotazione.ts'

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
  assert.equal(due[1].titolo, 'Nessun documento caricato')
  assert.deepEqual(due[1].link, { testo: 'Aggiungi documento', href: '/clienti/g1#documenti' })
  assert.equal(due[1].dettaglio, 'la cliente è in casa: manca la foto del documento')
  // pagata, con il documento e senza cambi vicini: niente
  const niente = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-20', '2026-09-22')], altre: [], pagamenti: [], oggi: OGGI, documenti: 2, hrefDocumenti: null })
  assert.deepEqual(niente, [])
  // senza documento anche PRIMA dell'arrivo (Ania, 17/09/2026): si vede, con «da chiedere all'arrivo»
  const futura = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-20', '2026-09-22')], altre: [], pagamenti: [], oggi: OGGI, documenti: 0, hrefDocumenti: '/clienti/g1#documenti' })
  assert.deepEqual(futura.map(v => v.etichetta), ['Documento'])
  assert.equal(futura[0].dettaglio, 'manca la foto del documento: da chiedere all’arrivo')
  // soggiorno finito: niente, anche senza documento
  const finita = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-01', '2026-09-03')], altre: [], pagamenti: [{ booking_id: 'a', amount: 160, paid_on: '2026-09-01' }], oggi: OGGI, documenti: 0, hrefDocumenti: null })
  assert.equal(finita.some(v => v.etichetta === 'Documento'), false)
})

test('da controllare: le regole della Home filtrate su questa prenotazione', () => {
  // arrivata il 10, pagato niente: la voce dei pagamenti, come in Home
  const nonPagata = daControllareScheda({ segmenti: [seg('a', LENA, '2026-09-10', '2026-09-20', { total_amount: 800, guest_name: 'Rosa' })], altre: [], pagamenti: [], oggi: OGGI, documenti: 1, hrefDocumenti: null })
  assert.deepEqual(nonPagata.map(v => v.etichetta), ['Pagamento'])
  assert.equal(nonPagata[0].titolo, 'Arrivato il 10 set e non segnato pagato')
  assert.equal(nonPagata[0].link?.href, '/scheda/a?azione=pagato')
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
