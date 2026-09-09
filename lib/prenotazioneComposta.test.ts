import test from 'node:test'
import assert from 'node:assert/strict'
import { conLettoAutomatico, contoPeriodo, dividiPerCambio, notti, ospitiIniziali, problemi, rigaDaSalvare, righeConto, tariffaProposta, totalePieno, type CameraComposta, type PeriodoComposto } from './prenotazioneComposta.ts'

const AMBRA: CameraComposta = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: CameraComposta = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 }
const LENA: CameraComposta = { id: '19ae4611-c0a4-42ae-8530-210f9a948e9e', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const CAMERE = [AMBRA, AMELIA, LENA]
const dove = (id: string | null) => CAMERE.find(c => c.id === id) ?? null

function periodo(p: Partial<PeriodoComposto> = {}): PeriodoComposto {
  return { id: 'p1', gruppo: 'g1', roomId: 'ambra', checkIn: '2026-09-14', checkOut: '2026-09-17', ospiti: 2, nottiLetto: [], tariffa: null, ...p }
}

test('la partenza chiude il periodo: 14→17 sono tre notti', () => {
  assert.equal(notti(periodo()), 3)
  assert.equal(notti(periodo({ checkOut: '2026-09-14' })), 0)
})

test('il conto segue il listino delle camere, non un prezzo inventato', () => {
  assert.deepEqual(contoPeriodo(periodo(), AMBRA), { totale: 240, prezzoNotte: 80, lettoTotale: 0 })
  // terzo ospite: la tariffa resta 80 e il letto si addebita 10 a notte
  const conto = contoPeriodo(periodo({ ospiti: 3, nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16'] }), AMBRA)
  assert.equal(conto?.totale, 270)
  assert.equal(conto?.lettoTotale, 30)
})

test('Lena a tre ospiti: il letto occupa il pool ma non si addebita', () => {
  const p = periodo({ roomId: LENA.id, ospiti: 3, nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16'] })
  const conto = contoPeriodo(p, LENA)
  assert.equal(conto?.lettoTotale, 0)
  assert.equal(conto?.totale, 270)   // 3 notti × 90, tripla
})

test('senza camera o con date impossibili il conto è da completare, non zero', () => {
  assert.equal(contoPeriodo(periodo({ roomId: null }), null), null)
  assert.equal(totalePieno([periodo({ roomId: null })], dove), null)
})

test('due camere in parallelo: il totale le somma una volta sola', () => {
  const a = periodo()
  const b = periodo({ id: 'p2', gruppo: 'g2', roomId: 'amelia', ospiti: 1, checkOut: '2026-09-20' })
  assert.equal(totalePieno([a, b], dove), 240 + 6 * 70)
  assert.deepEqual(righeConto([a, b], dove).map(r => r.etichetta), ['Ambra · 3 notti', 'Amelia · 6 notti'])
})

test('il cambio camera divide solo quel periodo e si porta dietro le sue notti col letto', () => {
  const p = periodo({ ospiti: 3, checkOut: '2026-09-20', nottiLetto: ['2026-09-14', '2026-09-17', '2026-09-18'] })
  const [primo, secondo] = dividiPerCambio(p, '2026-09-17', 'amelia', 70, 'p9')
  assert.equal(primo.checkOut, '2026-09-17')
  assert.deepEqual(primo.nottiLetto, ['2026-09-14'])
  assert.equal(secondo.roomId, 'amelia')
  assert.equal(secondo.gruppo, primo.gruppo)          // resta un solo soggiorno
  assert.deepEqual(secondo.nottiLetto, ['2026-09-17', '2026-09-18'])
})

test('la riga salvata usa la convenzione di sempre di bookings', () => {
  const riga = rigaDaSalvare(periodo({ ospiti: 3, nottiLetto: ['2026-09-14'] }), AMBRA, 'gruppo-1')
  assert.equal(riga.price_per_night, 80)
  assert.equal(riga.extra_bed_total, 10)
  assert.equal(riga.total_amount, 250)
  assert.equal(riga.group_id, 'gruppo-1')
  assert.equal(riga.extra_bed, true)
})

test('i controlli vedono capienza, date, doppioni e i due letti della casa', () => {
  assert.deepEqual(problemi([periodo()], dove), [])
  assert.match(problemi([periodo({ ospiti: 4 })], dove)[0], /al massimo 3/)
  assert.match(problemi([periodo({ checkOut: '2026-09-14' })], dove)[0], /dopo l'arrivo/)
  const doppia = [periodo(), periodo({ id: 'p2', gruppo: 'g2' })]
  assert.match(problemi(doppia, dove)[0], /due volte/)
  const treLetti = [
    periodo({ ospiti: 3, nottiLetto: ['2026-09-14'] }),
    periodo({ id: 'p2', gruppo: 'g2', roomId: 'amelia', ospiti: 2, nottiLetto: ['2026-09-14'] }),
  ]
  assert.deepEqual(problemi(treLetti, dove), [])
  assert.match(problemi(treLetti, dove, new Map([['2026-09-14', 1]]))[0], /letti aggiuntivi sono 2/)
})

test('la tariffa proposta è quella di listino della notte più economica', () => {
  assert.equal(tariffaProposta(periodo(), AMBRA), 80)
  assert.equal(tariffaProposta(periodo({ ospiti: 1 }), AMELIA), 70)
})

test('appena si sceglie la camera le persone sono la sua capienza: Amelia una, le altre due', () => {
  assert.equal(ospitiIniziali(AMELIA), 1)
  assert.equal(ospitiIniziali(AMBRA), 2)
  assert.equal(ospitiIniziali(LENA), 2)
  assert.equal(ospitiIniziali(null), 2)
})

test('il letto aggiuntivo si accende da solo quando le persone superano la camera', () => {
  // Amelia in due: serve il letto, su tutte le notti, e si paga
  const due = conLettoAutomatico(periodo({ roomId: 'amelia', ospiti: 2 }), AMELIA)
  assert.deepEqual(due.nottiLetto, ['2026-09-14', '2026-09-15', '2026-09-16'])
  assert.equal(contoPeriodo(due, AMELIA)?.lettoTotale, 15)   // 3 notti × 5
  assert.equal(contoPeriodo(due, AMELIA)?.totale, 225)       // 3 × 70 + 15
  // tornando a una persona il letto si spegne
  assert.deepEqual(conLettoAutomatico({ ...due, ospiti: 1 }, AMELIA).nottiLetto, [])
  // Ambra in due sta nella capienza: niente letto
  assert.deepEqual(conLettoAutomatico(periodo({ ospiti: 2 }), AMBRA).nottiLetto, [])
  // notti scelte a mano: si rispettano
  const scelte = conLettoAutomatico(periodo({ roomId: 'amelia', ospiti: 2, nottiLetto: ['2026-09-15'] }), AMELIA)
  assert.deepEqual(scelte.nottiLetto, ['2026-09-15'])
})
