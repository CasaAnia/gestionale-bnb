// La parte 2 della scheda (13/09/2026): conto, cliente, cronologia.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  testaConto, contoScheda, comePagaScheda, righePagamenti, vociCliente, personeConLei, righeStoria,
  NOME_MESSAGGIO, NOTA_CRONOLOGIA, type PagamentoScheda, notaCopertura, ultimaNotteCoperta, COPERTURA_FINO, COPERTURA_NIENTE } from './schedaConto.ts'
import type { SegmentoScheda } from './schedaPrenotazione.ts'

type Camera = NonNullable<SegmentoScheda['rooms']>
const LENA: Camera = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: Camera = { id: 'amelia', name: 'Amelia', base_price: 50, has_extra_bed: true, extra_bed_price: 10 }

const seg = (id: string, camera: Camera, check_in: string, check_out: string, extra: Partial<SegmentoScheda> = {}): SegmentoScheda => ({
  id, room_id: camera.id, check_in, check_out, status: 'confermata', num_guests: 2, price_per_night: 80,
  extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, total_amount: 160, rooms: camera, group_id: null, ...extra,
})
const pag = (id: string, amount: number, method: string, paid_on: string): PagamentoScheda => ({ id, booking_id: 'b', amount, method, paid_on })

// ── Lo stato del conto ──────────────────────────────────────────────────────
test('conto saldato: «Saldato», quanto e come, barretta piena', () => {
  const t = testaConto({ totaleCent: 55000, ricevutiCent: 55000 }, [pag('p1', 550, 'contanti', '2026-09-10')])
  assert.equal(t.titolo, 'Saldato')
  assert.equal(t.saldato, true)
  assert.equal(t.dettaglio, '550 € su 550 €')
  assert.equal(t.sotto, 'contanti, 10 set')
  assert.equal(t.quotaPagata, 1)
})

test('conto con acconto: manca il resto, e si dice quanto è già arrivato', () => {
  const t = testaConto({ totaleCent: 55000, ricevutiCent: 30000 }, [pag('p1', 300, 'bonifico', '2026-09-10')])
  assert.equal(t.titolo, '250 €')
  assert.equal(t.saldato, false)
  assert.equal(t.dettaglio, 'da incassare')
  assert.equal(t.sotto, '300 € pagati, 10 set')
  assert.ok(Math.abs(t.quotaPagata - 30000 / 55000) < 0.0001)
})

test('con due pagamenti si leggono i due giorni, da tre in su quante volte e l’ultimo (Ania, 20/09/2026)', () => {
  const due = testaConto({ totaleCent: 188000, ricevutiCent: 80000 }, [pag('p2', 400, 'contanti', '2026-09-16'), pag('p1', 400, 'contanti', '2026-09-07')])
  assert.equal(due.titolo, '1.080 €')
  assert.equal(due.sotto, '800 € pagati, 7 e 16 set')
  const mesiDiversi = testaConto({ totaleCent: 188000, ricevutiCent: 80000 }, [pag('p1', 400, 'contanti', '2026-08-30'), pag('p2', 400, 'contanti', '2026-09-16')])
  assert.equal(mesiDiversi.sotto, '800 € pagati, 30 ago e 16 set')
  const tre = testaConto({ totaleCent: 188000, ricevutiCent: 120000 }, [pag('p1', 400, 'contanti', '2026-09-07'), pag('p2', 400, 'contanti', '2026-09-16'), pag('p3', 400, 'contanti', '2026-09-20')])
  assert.equal(tre.sotto, '1.200 € pagati in 3 volte, ultimo 20 set')
  const saldato = testaConto({ totaleCent: 80000, ricevutiCent: 80000 }, [pag('p1', 400, 'contanti', '2026-09-07'), pag('p2', 400, 'bonifico', '2026-09-16')])
  assert.equal(saldato.sotto, 'bonifico, 7 e 16 set')
})

test('bonifico atteso: niente ancora incassato, barretta vuota', () => {
  const t = testaConto({ totaleCent: 30000, ricevutiCent: 0 }, [])
  assert.equal(t.titolo, '300 €')
  assert.equal(t.dettaglio, 'da incassare')
  assert.equal(t.sotto, '')
  assert.equal(t.quotaPagata, 0)
})

test('segnato pagato senza movimenti: resta «Saldato»', () => {
  const t = testaConto({ totaleCent: 16000, ricevutiCent: 0 }, [], true)
  assert.equal(t.titolo, 'Saldato')
  assert.equal(t.sotto, '')
})

// ── Il conto in righe (18/09/2026) ─────────────────────────────────────────
const righeDi = (c: ReturnType<typeof contoScheda>) => c.righe.map(r => [r.titolo, r.dettaglio, r.importo])
const ALLEGRA: Camera = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMBRA: Camera = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }

test('una riga per camera, col periodo (col mese) e le notti per il prezzo; poi «Totale», «Da pagare» e le notti sotto', () => {
  const c = contoScheda([seg('a', LENA, '2026-09-10', '2026-09-12')], 16000)
  assert.deepEqual(righeDi(c), [['Lena', '10 → 12 set · 2 notti × 80 €', '160 €']])
  assert.deepEqual([c.totale, c.totaleCent, c.sconto, c.daPagare, c.sotto], ['160 €', 16000, null, '160 €', '2 notti · 80 € a notte'])
})

test('il letto in più ha la sua riga, UNA sola con tutte le notti in cui c’è', () => {
  const c = contoScheda([seg('a', AMELIA, '2026-09-10', '2026-09-13', {
    num_guests: 2, price_per_night: 50, extra_bed: true, extra_bed_dates: ['2026-09-10', '2026-09-11', '2026-09-12'], extra_bed_total: 30, total_amount: 180,
  })], 18000)
  assert.deepEqual(righeDi(c), [['Amelia', '10 → 13 set · 3 notti × 50 €', '150 €'], ['Letto in più', '3 notti × 10 €', '30 €']])
  assert.deepEqual([c.totale, c.daPagare], ['180 €', '180 €'])
  // il letto su due tratti: sempre una riga, con le notti di tutti e due
  const due = contoScheda([
    seg('a', ALLEGRA, '2026-11-29', '2026-11-30', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-11-29'], extra_bed_total: 10, total_amount: 90, group_id: 'g' }),
    seg('b', AMBRA, '2026-11-30', '2026-12-02', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-11-30', '2026-12-01'], extra_bed_total: 20, total_amount: 180, group_id: 'g' }),
  ], 27000)
  assert.deepEqual(righeDi(due).map(r => r[0]), ['Allegra', 'Ambra', 'Letto in più'])
  assert.deepEqual(righeDi(due)[2], ['Letto in più', '3 notti × 10 €', '30 €'])
  // con importi a notte diversi (Allegra 10, Amelia 5) niente «× …», solo le notti
  const diversi = contoScheda([
    seg('a', ALLEGRA, '2026-11-29', '2026-11-30', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-11-29'], extra_bed_total: 10, total_amount: 90, group_id: 'g' }),
    seg('b', AMELIA, '2026-11-30', '2026-12-01', { num_guests: 2, price_per_night: 50, extra_bed: true, extra_bed_dates: ['2026-11-30'], extra_bed_total: 5, total_amount: 55, group_id: 'g' }),
  ], 14500)
  assert.deepEqual(righeDi(diversi)[2], ['Letto in più', '2 notti', '15 €'])
})

test('il caso di Maurizio Stuppino: le camere a prezzo pieno, il letto in una riga, lo sconto UNA volta sola e senza centesimi, «Da pagare» con le notti', () => {
  // com'era salvata: Allegra 29 → 30 nov (90, concordati 28,33) e Ambra 30 nov → 2 dic (180, concordati 56,67): 85 in tutto
  const righe = [
    seg('a', ALLEGRA, '2026-11-29', '2026-11-30', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-11-29'], extra_bed_total: 10, discount_type: 'target_total', discount_value: 28.33, total_amount: 28.33, group_id: 'g' }),
    seg('b', AMBRA, '2026-11-30', '2026-12-02', { num_guests: 3, extra_bed: true, extra_bed_dates: ['2026-11-30', '2026-12-01'], extra_bed_total: 20, discount_type: 'target_total', discount_value: 56.67, total_amount: 56.67, group_id: 'g' }),
  ]
  const c = contoScheda(righe, 8500)
  assert.deepEqual(righeDi(c), [['Allegra', '29 → 30 nov · 1 notte × 80 €', '80 €'], ['Ambra', '30 nov → 2 dic · 2 notti × 80 €', '160 €'], ['Letto in più', '3 notti × 10 €', '30 €']])
  assert.equal(c.totale, '270 €')
  // −61,67 e −123,33 non si vedono più: una riga sola, «−185 €»
  assert.deepEqual(c.sconto, { testo: 'Sconto', importo: '−185 €' })
  assert.deepEqual([c.daPagare, c.sotto], ['85 €', '3 notti · 28,33 € a notte'])
  // e dopo la correzione dal foglio (5 € a notte, 255 €): «−15 €» e 85 € a notte
  const corretto = contoScheda([{ ...righe[0], discount_value: 85, total_amount: 85 }, { ...righe[1], discount_value: 170, total_amount: 170 }], 25500)
  assert.deepEqual([corretto.sconto, corretto.daPagare, corretto.sotto], [{ testo: 'Sconto', importo: '−15 €' }, '255 €', '3 notti · 85 € a notte'])
})

test('lo sconto in percentuale si chiama «Sconto 10 %», e l’importo è intero anche coi centesimi', () => {
  const c = contoScheda([seg('a', LENA, '2026-09-10', '2026-09-12', { discount_type: 'percentage', discount_value: 10, total_amount: 144 })], 14400)
  assert.deepEqual(c.sconto, { testo: 'Sconto 10 %', importo: '−16 €' })
  assert.deepEqual([c.totale, c.daPagare, c.sotto], ['160 €', '144 €', '2 notti · 72 € a notte'])
  // 12,5 % su 165 € = 20,63: si scrive «−21 €», il da pagare resta al centesimo
  const spicci = contoScheda([seg('a', LENA, '2026-09-10', '2026-09-12', { price_per_night: 82.5, discount_type: 'percentage', discount_value: 12.5, total_amount: 144.37 })], 14437)
  assert.deepEqual(spicci.sconto, { testo: 'Sconto 12,5 %', importo: '−21 €' })
  assert.equal(spicci.daPagare, '144,37 €')
  // percentuali diverse sulle righe: solo «Sconto»
  const miste = contoScheda([
    seg('a', LENA, '2026-09-10', '2026-09-12', { discount_type: 'percentage', discount_value: 10, total_amount: 144, group_id: 'g' }),
    seg('b', AMELIA, '2026-09-12', '2026-09-13', { num_guests: 1, price_per_night: 50, discount_type: 'percentage', discount_value: 20, total_amount: 40, group_id: 'g' }),
  ], 18400)
  assert.equal(miste.sconto?.testo, 'Sconto')
  assert.equal(miste.sconto?.importo, '−26 €')
})

test('Lena in tre: il letto è compreso nel prezzo, una riga sola', () => {
  const c = contoScheda([seg('a', LENA, '2026-09-10', '2026-09-12', {
    num_guests: 3, price_per_night: 90, extra_bed: true, extra_bed_dates: ['2026-09-10', '2026-09-11'], extra_bed_total: 0, total_amount: 180,
  })], 18000)
  assert.deepEqual(righeDi(c), [['Lena', '10 → 12 set · 2 notti × 90 €', '180 €']])
})

test('un totale salvato che non torna col dettaglio: una riga sola, col totale vero, e niente sconto inventato', () => {
  const c = contoScheda([seg('a', LENA, '2026-09-10', '2026-09-12', { price_per_night: 80, total_amount: 200 })], 20000)
  assert.deepEqual(righeDi(c), [['Lena', '10 → 12 set · 2 notti', '200 €']])
  assert.deepEqual([c.totale, c.sconto, c.daPagare], ['200 €', null, '200 €'])
})

test('coi cambi camera c’è una riga per tratto, in ordine; un tratto annullato non entra nel conto', () => {
  const c = contoScheda([
    seg('a', LENA, '2026-09-10', '2026-09-12', { group_id: 'g' }),
    seg('b', AMELIA, '2026-09-12', '2026-09-14', { group_id: 'g', num_guests: 1, price_per_night: 65, total_amount: 130 }),
  ], 29000)
  assert.deepEqual(righeDi(c), [['Lena', '10 → 12 set · 2 notti × 80 €', '160 €'], ['Amelia', '12 → 14 set · 2 notti × 65 €', '130 €']])
  assert.equal(c.sotto, '4 notti · 72,50 € a notte')
  const conAnnullata = contoScheda([seg('a', LENA, '2026-09-10', '2026-09-12'), seg('x', AMELIA, '2026-09-12', '2026-09-14', { status: 'annullata' })], 16000)
  assert.equal(conAnnullata.righe.length, 1)
})

// ── Accordo e pagamenti ─────────────────────────────────────────────────────
test('l’accordo si legge in parole', () => {
  // i nomi e le frasi vengono da lib/comePaga: qui si controlla solo che la
  // scheda legga quello che è salvato
  assert.deepEqual(comePagaScheda('contanti'), { nome: 'Contanti', frase: 'paga tutto in contanti quando arriva' })
  assert.deepEqual(comePagaScheda('bonifico_arrivo'), { nome: 'Bonifico', frase: 'paga tutto con bonifico quando arriva' })
  assert.equal(comePagaScheda('bonifico_intero').nome, 'Tutto')
  assert.equal(comePagaScheda('caparra_meta').nome, 'Caparra del 50%')
  assert.equal(comePagaScheda('caparra_libera').nome, 'Caparra')
  assert.equal(comePagaScheda(null, true).nome, 'Bonifico')
  assert.equal(comePagaScheda(null, false).nome, 'Da vedere')
})

test('i pagamenti: dal più vecchio, con giorno e metodo', () => {
  const r = righePagamenti([pag('p2', 250, 'contanti', '2026-09-12'), pag('p1', 300, 'bonifico', '2026-09-01')])
  assert.deepEqual(r.map(x => x.quando), ['1 set · bonifico', '12 set · contanti'])
  assert.deepEqual(r.map(x => x.importo), ['300 €', '250 €'])
  assert.deepEqual(righePagamenti([]), [])
})

// ── Fin dove arrivano i pagamenti (REGOLA FISSA n. 9, Ania 20/09/2026) ─────
// Il pagamento non si divide fra le camere: si registra intero e la scheda
// dice fino a che notte arrivano i soldi, come il verde del calendario.
const CAMERE_ROSA = [
  { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 },
  { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 },
  { id: 'lena', name: 'Lena', base_price: 80, has_extra_bed: true, extra_bed_price: 10 },
]
const tratto = (id: string, room_id: string, check_in: string, check_out: string, price: number, total: number, extra: Partial<SegmentoScheda> = {}): SegmentoScheda =>
  ({ id, room_id, check_in, check_out, status: 'confermata', num_guests: 1, price_per_night: price, total_amount: total, extra_bed: false, extra_bed_dates: [], extra_bed_total: 0, ...extra })
// Rosa Macauda: Ambra 1→7 (480), Amelia 7→11 (280), Ambra 11→22 (880), Lena 22→25 (240) = 1.880
const ROSA = [
  tratto('c', 'ambra', '2026-09-11', '2026-09-22', 80, 880),
  tratto('a', 'ambra', '2026-09-01', '2026-09-07', 80, 480),
  tratto('d', 'lena', '2026-09-22', '2026-09-25', 80, 240),
  tratto('b', 'amelia', '2026-09-07', '2026-09-11', 70, 280),
  tratto('x', 'ambra', '2026-09-25', '2026-09-28', 80, 240, { status: 'annullata' }),
]

test('il caso di Ania: 800 € su Rosa coprono Ambra e Amelia, fino alla notte del 10 set', () => {
  assert.equal(ultimaNotteCoperta(ROSA, CAMERE_ROSA, 80000), '2026-09-10')
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 80000, false), 'I pagamenti coprono fino alla notte del 10 set')
  // 400 €: cinque notti di Ambra (5 × 80), la sesta no
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 40000, false), COPERTURA_FINO('5 set'))
  // 479 €: la sesta notte non è coperta per intero
  assert.equal(ultimaNotteCoperta(ROSA, CAMERE_ROSA, 47900), '2026-09-05')
  // 480 €: proprio la fine del primo tratto
  assert.equal(ultimaNotteCoperta(ROSA, CAMERE_ROSA, 48000), '2026-09-06')
})

test('la nota tace quando non serve: niente incassato, conto saldato, tutto coperto', () => {
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 0, false), '')
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 80000, true), '')
  assert.equal(ultimaNotteCoperta(ROSA, CAMERE_ROSA, 188000), 'tutte')
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 188000, false), '')
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 200000, false), '')
  // pochi soldi: nemmeno la prima notte
  assert.equal(ultimaNotteCoperta(ROSA, CAMERE_ROSA, 5000), null)
  assert.equal(notaCopertura(ROSA, CAMERE_ROSA, 5000, false), COPERTURA_NIENTE)
})

test('con lo sconto le notti si scalano in proporzione, così la copertura torna col conto', () => {
  // due notti di Ambra a 80 concordate 120: ogni notte vale 60
  const scontato = [tratto('s', 'ambra', '2026-10-01', '2026-10-03', 80, 120, { discount_type: 'target_total', discount_value: 120 })]
  assert.equal(ultimaNotteCoperta(scontato, CAMERE_ROSA, 6000), '2026-10-01')
  assert.equal(ultimaNotteCoperta(scontato, CAMERE_ROSA, 5900), null)
  assert.equal(ultimaNotteCoperta(scontato, CAMERE_ROSA, 12000), 'tutte')
  // camera sconosciuta: si divide il totale in parti uguali
  const senzaCamera = [tratto('z', 'boh', '2026-10-01', '2026-10-05', 0, 200)]
  assert.equal(ultimaNotteCoperta(senzaCamera, CAMERE_ROSA, 10000), '2026-10-02')
})

test('REGOLA FISSA n. 9: il pagamento non si divide fra le camere, e la scheda mostra fin dove arriva', () => {
  const dati = readFileSync(new URL('./pagamentiDati.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(dati, /dividiPagamento|pianoDaUsare|notaParte|for \(const parte of/, 'il pagamento si registra intero, una riga sola')
  assert.match(dati, /eseguiRegistraAcconto\(booking\.id, dati\.importo/, 'un movimento solo, sulla prenotazione')
  const conto = readFileSync(new URL('../components/scheda/ContoScheda.tsx', import.meta.url), 'utf8')
  assert.match(conto, /data-copertura-pagamenti/, 'la riga «coprono fino alla notte del …» sotto i pagamenti')
  const pagina = readFileSync(new URL('../app/scheda/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(pagina, /notaCopertura\(righe, camere, conto\.ricevutiCent, testa\.saldato\)/)
  assert.match(pagina, /copertura=\{copertura\}/)
})

// ── La parte CLIENTE ────────────────────────────────────────────────────────
test('le voci del cliente, con e senza provenienza', () => {
  const v = vociCliente({ telefono: '342 700 4354', provenienza: 'passaparola', valutazione: 'ottimo', ricevuta: true, nota: 'Dorme male con i rumori.' })
  assert.deepEqual(v.map(x => x.etichetta), ['telefono', 'arrivata da', 'valutazione', 'ricevuta', 'nota del cliente'])
  assert.deepEqual(v.map(x => x.valore), ['342 700 4354', 'passaparola', '★ ottima', 'sì', 'Dorme male con i rumori.'])
  assert.equal(v.some(x => x.chiedi), false)
  // senza provenienza si chiede, e senza nota la voce non c'è
  const senza = vociCliente({ telefono: null, provenienza: null, valutazione: null, ricevuta: false, nota: '  ' })
  assert.deepEqual(senza.map(x => x.valore), ['nessun numero', 'da dove? ›', 'normale', 'no'])
  assert.equal(senza.find(x => x.etichetta === 'arrivata da')?.chiedi, true)
  assert.equal(vociCliente({ valutazione: 'problematico' })[2].valore, 'problematica')
})

test('«con lei»: nome e numero, e cosa manca', () => {
  // il numero si legge a gruppi, come nella testa
  assert.deepEqual(personeConLei({ extra_phone_1_name: 'Marco Riva', extra_phone_1: '3334567890', chi_e: 'il figlio' }), [
    { chiave: 'uno', nome: 'Marco Riva', chiE: 'il figlio', telefono: '333 456 7890', senzaNome: false, senzaNumero: false },
  ])
  // chi è la seconda persona: chi_e_2 (proposta 0056)
  assert.deepEqual(personeConLei({ extra_phone_1_name: 'A', extra_phone_2_name: 'B', chi_e_2: 'Amica' }).map(p => p.chiE), ['', 'Amica'])
  const soloNumero = personeConLei({ extra_phone_1: '3334567890', extra_phone_2_name: 'Lucia' })
  assert.deepEqual(soloNumero.map(p => [p.nome, p.telefono]), [['senza nome', '333 456 7890'], ['Lucia', 'senza numero']])
  assert.deepEqual(personeConLei({}), [])
  assert.deepEqual(personeConLei(null), [])
})

// ── La cronologia ───────────────────────────────────────────────────────────
const evento = (id: string, created_at: string, tipo: string, prima: Record<string, unknown>, dopo: Record<string, unknown>) =>
  ({ id, booking_id: 'b', created_at, tipo, prima, dopo })
const ADESSO = new Date(2026, 8, 13, 12, 0)

test('la storia parte dalla creazione e va avanti nel tempo', () => {
  const r = righeStoria(
    [evento('e1', '2026-09-05T14:20:00+02:00', 'camera', { camera: 'Ambra' }, { camera: 'Lena' })],
    [{ id: 'm1', message_type: 'conferma', created_at: '2026-09-04T10:00:00+02:00' }],
    '2026-09-03T09:00:00+02:00',
    ADESSO,
  )
  assert.deepEqual(r.map(x => x.cosa), ['Prenotazione creata', 'Conferma inviata', 'Camera Ambra → Lena'])
  assert.deepEqual(r.map(x => x.messaggio), [false, true, false])
  assert.equal(r[0].quando, '3 set 09:00')
})

test('senza messaggi resta solo quello che è successo', () => {
  const r = righeStoria([evento('e1', '2026-09-05T14:20:00+02:00', 'totale', { totale: 160 }, { totale: 200 })], [], null, ADESSO)
  assert.deepEqual(r.map(x => x.cosa), ['Totale €160 → €200'])
  assert.equal(r.every(x => !x.messaggio), true)
  assert.deepEqual(righeStoria([], [], null, ADESSO), [])
})

test('i nomi dei messaggi e la nota sotto la cronologia', () => {
  assert.equal(NOME_MESSAGGIO.conferma, 'Conferma inviata')
  assert.equal(NOME_MESSAGGIO.annullamento, 'Annullamento inviato')
  assert.match(NOTA_CRONOLOGIA, /Le risposte della cliente restano solo su WhatsApp\./)
})
