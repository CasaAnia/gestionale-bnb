// R6 — piano di ricostruzione degli incassi storici: soggiorno senza acconti,
// con acconto parziale, già coperto (nessun movimento), annullato (escluso),
// doppia esecuzione (nessun doppione), chiave stabile.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pianoRicostruzione, chiaveRicostruzione, etichettaIncassi, vociPerRpc, validaEsitoRicostruzione, METODO_RICOSTRUITO } from './ricostruzione.ts'
import type { PagamentoStat, PrenotazioneStat } from './tipi.ts'

const pren = (id: string, room_id: string, check_in: string, check_out: string, total: number, extra: Partial<PrenotazioneStat> = {}): PrenotazioneStat =>
  ({ id, room_id, check_in, check_out, total_amount: total, status: 'confermata', group_id: null, pagato: true, ...extra })

const lista = [
  pren('senza', 'r1', '2026-06-01', '2026-06-03', 160, { guest_name: 'Senza Acconti' }),
  pren('parz', 'r2', '2026-06-10', '2026-06-12', 200, { guest_name: 'Con Acconto' }),
  pren('cop', 'r3', '2026-06-15', '2026-06-16', 80, { guest_name: 'Coperto' }),
  pren('ann', 'r4', '2026-06-20', '2026-06-22', 300, { status: 'annullata', guest_name: 'Annullato' }),
  pren('att', 'r4', '2026-06-25', '2026-06-27', 300, { status: 'in_attesa', guest_name: 'In attesa' }),
  pren('nonpag', 'r1', '2026-06-28', '2026-06-29', 90, { pagato: false, guest_name: 'Non segnato' }),
  // cambio camera: 160 + 180 = 340, pagato sul secondo segmento, acconto 100 sul primo
  pren('c1', 'r1', '2026-07-01', '2026-07-03', 160, { group_id: 'g', pagato: false, guest_name: 'Rossi' }),
  pren('c2', 'r4', '2026-07-03', '2026-07-05', 180, { group_id: 'g', guest_name: 'Rossi' }),
]
const pagamenti: PagamentoStat[] = [
  { booking_id: 'parz', amount: 50, paid_on: '2026-05-01' },
  { booking_id: 'cop', amount: 80, paid_on: '2026-06-15' },
  { booking_id: 'c1', amount: 100, paid_on: '2026-06-20' },
]

const OGGI = '2026-09-05'

test('piano: senza acconti → totale; acconto parziale → differenza; coperto, annullato, in attesa → niente; concluso NON segnato → nel piano con il suo motivo; cambio camera un solo movimento', () => {
  const p = pianoRicostruzione(lista, pagamenti, OGGI)
  assert.deepEqual(p.movimenti.map(m => [m.booking_id, m.amount, m.paid_on, m.method, m.motivo]), [
    ['senza', 160, '2026-06-01', METODO_RICOSTRUITO, 'pagato_senza_movimenti'],
    ['parz', 150, '2026-06-10', METODO_RICOSTRUITO, 'pagato_senza_movimenti'],
    ['nonpag', 90, '2026-06-28', METODO_RICOSTRUITO, 'concluso_non_segnato'],
    ['c1', 240, '2026-07-01', METODO_RICOSTRUITO, 'pagato_senza_movimenti'],
  ])
  assert.equal(p.totaleCent, 64000)
  assert.deepEqual(p.esclusi, [])
  assert.deepEqual(vociPerRpc(p).map(v => v.soggiorno), ['senza', 'parz', 'nonpag', 'g'])
  const cambio = p.movimenti[3]
  assert.deepEqual([cambio.soggiorno, cambio.arrivo, cambio.partenza, cambio.nomi, cambio.totaleCent, cambio.registratiCent], ['g', '2026-07-01', '2026-07-05', 'Rossi', 34000, 10000])
  assert.ok(p.movimenti.every(m => m.origine === 'ricostruito'))
})

test('doppia esecuzione: dopo aver applicato il piano, il piano è vuoto e le chiavi sono le stesse di prima', () => {
  const primo = pianoRicostruzione(lista, pagamenti, OGGI)
  const applicati = [...pagamenti, ...primo.movimenti.map(m => ({ booking_id: m.booking_id, amount: m.amount, paid_on: m.paid_on }))]
  const secondo = pianoRicostruzione(lista, applicati, OGGI)
  assert.deepEqual(secondo.movimenti, [])
  assert.equal(secondo.totaleCent, 0)
  assert.deepEqual(primo.movimenti.map(m => m.chiave_operazione), pianoRicostruzione(lista, pagamenti, OGGI).movimenti.map(m => m.chiave_operazione))
})

test('R9: soggiorni in corso o futuri restano FUORI dal piano ma elencati con il motivo; il giorno della partenza entra', () => {
  const oggi = '2026-06-11'
  const p = pianoRicostruzione(lista, pagamenti, oggi)
  assert.deepEqual(p.movimenti.map(m => m.booking_id), ['senza'])                 // partenza 3/6 ≤ 11/6
  assert.deepEqual(p.esclusi.map(e => [e.soggiorno, e.perche, e.mancanteCent]), [['parz', 'in_corso', 15000], ['nonpag', 'futuro', 9000], ['g', 'futuro', 24000]])
  const partenzaOggi = pianoRicostruzione(lista, pagamenti, '2026-06-12')
  assert.deepEqual(partenzaOggi.movimenti.map(m => m.booking_id), ['senza', 'parz'])
})

test('R9: esito della RPC convalidato dal client (conteggi coerenti con le voci mandate, esiti tipizzati)', () => {
  const buono = { scritti: 1, saltati: 1, nulla: 0, esiti: [{ soggiorno: 'a', chiave: 'k1', esito: 'scritto', importo: 160 }, { soggiorno: 'b', chiave: 'k2', esito: 'gia_presente', importo: '90' }] }
  assert.deepEqual(validaEsitoRicostruzione(buono, 2)?.esiti.map(e => e.importo), [160, 90])
  assert.equal(validaEsitoRicostruzione(buono, 3), null)          // conteggi non coerenti con le voci mandate
  assert.equal(validaEsitoRicostruzione(null, 0), null)
  assert.equal(validaEsitoRicostruzione({ scritti: 1, saltati: 0, nulla: 0, esiti: [{ soggiorno: 'a', chiave: 'k', esito: 'boh', importo: 1 }] }, 1), null)
  assert.equal(validaEsitoRicostruzione({ scritti: 'uno', saltati: 0, nulla: 0, esiti: [] }, 0), null)
  assert.deepEqual(validaEsitoRicostruzione({ scritti: 0, saltati: 0, nulla: 0, esiti: [] }, 0), { scritti: 0, saltati: 0, nulla: 0, esiti: [] })
})

test('chiave stabile: stesso soggiorno → stessa chiave UUID; soggiorni diversi → chiavi diverse; etichetta della voce', () => {
  assert.equal(chiaveRicostruzione('g'), chiaveRicostruzione('g'))
  assert.notEqual(chiaveRicostruzione('g'), chiaveRicostruzione('senza'))
  assert.match(chiaveRicostruzione('g'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  assert.deepEqual(etichettaIncassi(3), { etichetta: 'Incassi registrati', avviso: 'storico da ricostruire' })
  assert.deepEqual(etichettaIncassi(0), { etichetta: 'Incassi', avviso: null })
  assert.deepEqual(pianoRicostruzione([], [], OGGI).movimenti, [])
})
