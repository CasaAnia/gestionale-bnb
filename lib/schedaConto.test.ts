// La parte 2 della scheda (13/09/2026): conto, cliente, cronologia.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  testaConto, righeConto, accordoInParole, righePagamenti, vociCliente, personeConLei, righeStoria,
  NOME_MESSAGGIO, NOTA_CRONOLOGIA, type PagamentoScheda,
} from './schedaConto.ts'
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

// ── Le righe del conto ──────────────────────────────────────────────────────
test('una riga per tratto, col periodo e le notti per il prezzo', () => {
  const r = righeConto([seg('a', LENA, '2026-09-10', '2026-09-12')])
  assert.deepEqual(r.map(x => x.testo), ['Lena, 10 → 12 · 2 notti × 80 €'])
  assert.deepEqual(r.map(x => x.importo), ['160 €'])
})

test('il letto in più ha la sua riga', () => {
  const r = righeConto([seg('a', AMELIA, '2026-09-10', '2026-09-13', {
    num_guests: 2, price_per_night: 50, extra_bed: true, extra_bed_dates: ['2026-09-10', '2026-09-11', '2026-09-12'], extra_bed_total: 30, total_amount: 180,
  })])
  assert.deepEqual(r.map(x => x.testo), ['Amelia, 10 → 13 · 3 notti × 50 €', 'Letto in più · 3 notti × 10 €'])
  assert.deepEqual(r.map(x => x.importo), ['150 €', '30 €'])
})

test('lo sconto ha la sua riga, in negativo', () => {
  const r = righeConto([seg('a', LENA, '2026-09-10', '2026-09-12', { discount_type: 'percentage', discount_value: 10, total_amount: 144 })])
  assert.deepEqual(r.map(x => x.testo), ['Lena, 10 → 12 · 2 notti × 80 €', 'Sconto'])
  assert.equal(r[1].importo, '−16 €')
  assert.equal(r[1].sconto, true)
})

test('Lena in tre: il letto è compreso nel prezzo, una riga sola', () => {
  const r = righeConto([seg('a', LENA, '2026-09-10', '2026-09-12', {
    num_guests: 3, price_per_night: 90, extra_bed: true, extra_bed_dates: ['2026-09-10', '2026-09-11'], extra_bed_total: 0, total_amount: 180,
  })])
  assert.equal(r.length, 1)
  assert.equal(r[0].testo, 'Lena, 10 → 12 · 2 notti × 90 €')
  assert.equal(r[0].importo, '180 €')
})

test('un totale salvato che non torna col dettaglio: una riga sola, col totale vero', () => {
  const r = righeConto([seg('a', LENA, '2026-09-10', '2026-09-12', { price_per_night: 80, total_amount: 200 })])
  assert.deepEqual(r.map(x => x.testo), ['Lena, 10 → 12 · 2 notti'])
  assert.deepEqual(r.map(x => x.importo), ['200 €'])
})

test('coi cambi camera c’è una riga per tratto, in ordine', () => {
  const r = righeConto([
    seg('a', LENA, '2026-09-10', '2026-09-12', { group_id: 'g' }),
    seg('b', AMELIA, '2026-09-12', '2026-09-14', { group_id: 'g', num_guests: 1, price_per_night: 65, total_amount: 130 }),
  ])
  assert.deepEqual(r.map(x => x.testo), ['Lena, 10 → 12 · 2 notti × 80 €', 'Amelia, 12 → 14 · 2 notti × 65 €'])
  // un tratto annullato non entra nel conto
  const conAnnullata = righeConto([seg('a', LENA, '2026-09-10', '2026-09-12'), seg('x', AMELIA, '2026-09-12', '2026-09-14', { status: 'annullata' })])
  assert.equal(conAnnullata.length, 1)
})

// ── Accordo e pagamenti ─────────────────────────────────────────────────────
test('l’accordo si legge in parole', () => {
  assert.equal(accordoInParole('contanti'), "contanti all'arrivo")
  assert.equal(accordoInParole('bonifico_arrivo'), "bonifico all'arrivo")
  assert.equal(accordoInParole('bonifico_intero'), 'tutto anticipato')
  assert.equal(accordoInParole('caparra_meta'), 'caparra')
  assert.equal(accordoInParole('caparra_libera'), 'caparra')
  // senza accordo salvato vale la vecchia spunta «bonifico»
  assert.equal(accordoInParole(null, true), 'bonifico')
  assert.equal(accordoInParole(null, false), "contanti all'arrivo")
})

test('i pagamenti: dal più vecchio, con giorno e metodo', () => {
  const r = righePagamenti([pag('p2', 250, 'contanti', '2026-09-12'), pag('p1', 300, 'bonifico', '2026-09-01')])
  assert.deepEqual(r.map(x => x.quando), ['1 set · bonifico', '12 set · contanti'])
  assert.deepEqual(r.map(x => x.importo), ['300 €', '250 €'])
  assert.deepEqual(righePagamenti([]), [])
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
  assert.deepEqual(personeConLei({ extra_phone_1_name: 'Marco Riva', extra_phone_1: '3334567890' }), [
    { chiave: 'uno', nome: 'Marco Riva', telefono: '333 456 7890', senzaNome: false, senzaNumero: false },
  ])
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
