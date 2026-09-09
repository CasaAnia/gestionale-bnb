import test from 'node:test'
import assert from 'node:assert/strict'
import { conLettoAutomatico, contoPeriodo, costoLetto, lettoDaRegole, lettoDaRivedere, lettoProposto, dividiPerCambio, notti, ospitiIniziali, problemi, rigaDaSalvare, righeConto, tariffaProposta, totalePieno, type CameraComposta, type PeriodoComposto } from './prenotazioneComposta.ts'

const AMBRA: CameraComposta = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10 }
const AMELIA: CameraComposta = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5 }
const LENA: CameraComposta = { id: '19ae4611-c0a4-42ae-8530-210f9a948e9e', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10 }
const CAMERE = [AMBRA, AMELIA, LENA]
const dove = (id: string | null) => CAMERE.find(c => c.id === id) ?? null

function periodo(p: Partial<PeriodoComposto> = {}): PeriodoComposto {
  return { id: 'p1', gruppo: 'g1', roomId: 'ambra', checkIn: '2026-09-14', checkOut: '2026-09-17', ospiti: 2, nottiLetto: [], letto: null, tariffa: null, ...p }
}

test('la partenza chiude il periodo: 14→17 sono tre notti', () => {
  assert.equal(notti(periodo()), 3)
  assert.equal(notti(periodo({ checkOut: '2026-09-14' })), 0)
})

test('il conto segue il listino delle camere, non un prezzo inventato', () => {
  assert.deepEqual(contoPeriodo(periodo(), AMBRA), { totale: 240, prezzoNotte: 80, lettoTotale: 0 })
  // terzo ospite: la tariffa resta 80 e il letto si addebita 10 a notte
  const conto = contoPeriodo(periodo({ ospiti: 3, nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16'] }), AMBRA)
  assert.equal(conto?.lettoTotale, 30)
  assert.equal(conto?.totale, 270)
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

test('il prezzo del letto lo propongono le regole della camera', () => {
  assert.equal(lettoDaRegole(AMELIA, 2), 5)
  assert.equal(lettoDaRegole(AMBRA, 3), 10)
  assert.equal(lettoDaRegole(LENA, 3), 0)     // il terzo posto della tripla è compreso
  assert.equal(lettoDaRegole(LENA, 4), 10)
  // accendendo il letto la proposta finisce nel periodo
  const acceso = conLettoAutomatico(periodo({ roomId: 'amelia', ospiti: 2 }), AMELIA)
  assert.deepEqual(acceso.letto, { importo: 5, criterio: 'notte', auto: true })
})

test('il campo propone il letto della camera: 5 la singola, 10 le altre', () => {
  assert.equal(lettoProposto(AMELIA, 2), 5)
  assert.equal(lettoProposto(AMBRA, 3), 10)
  assert.equal(lettoProposto(AMBRA, 2), 10)     // acceso a mano, due persone
  assert.equal(lettoProposto(AMELIA, 1), 5)
  assert.equal(lettoProposto(LENA, 3), 0)       // terzo posto gia' dentro la tripla
  assert.equal(lettoProposto(LENA, 4), 10)
  const ambraInTre = conLettoAutomatico(periodo({ ospiti: 3 }), AMBRA)
  assert.equal(contoPeriodo(ambraInTre, AMBRA)?.lettoTotale, 30)   // 3 notti x 10
  assert.equal(contoPeriodo(ambraInTre, AMBRA)?.totale, 270)       // 3 x 80 + 30
})

test('Ania può addebitare il letto anche dove le regole non lo prevedono', () => {
  // Lena in due che vogliono dormire separate: le regole non lo addebiterebbero,
  // ma il campo propone i cinque euro e il letto si paga
  const compreso = periodo({ roomId: LENA.id, ospiti: 2, nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16'] })
  assert.equal(lettoDaRegole(LENA, 2), 0)
  assert.equal(costoLetto(compreso, LENA), 30)    // proposta: il letto di Lena, 10 a notte
  assert.equal(contoPeriodo(compreso, LENA)?.totale, 270)
  // …e con un importo scelto vale quello, coi tre criteri
  const aNotte = { ...compreso, letto: { importo: 10, criterio: 'notte' as const } }
  assert.equal(costoLetto(aNotte, LENA), 30)
  assert.equal(contoPeriodo(aNotte, LENA)?.totale, 270)
  assert.equal(costoLetto({ ...compreso, letto: { importo: 20, criterio: 'ogni4' as const } }, LENA), 20)
  assert.equal(costoLetto({ ...compreso, letto: { importo: 25, criterio: 'totale' as const } }, LENA), 25)
})

test('col letto scelto la riga salvata resta nella convenzione di bookings', () => {
  const p = periodo({ roomId: LENA.id, ospiti: 2, nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16'], letto: { importo: 10, criterio: 'notte' } })
  const riga = rigaDaSalvare(p, LENA, 'g')
  assert.equal(riga.price_per_night, 80)
  assert.equal(riga.extra_bed_total, 30)
  assert.equal(riga.total_amount, 270)
  assert.equal(riga.price_per_night * 3 + riga.extra_bed_total, riga.total_amount)
})

test('il letto chiesto a mano non sparisce cambiando le date (rilievo 5)', () => {
  // due persone in matrimoniale che dormono separate, importo concordato
  const aMano = periodo({ ospiti: 2, nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16'], letto: { importo: 15, criterio: 'notte' } })
  const dopo = conLettoAutomatico({ ...aMano, checkOut: '2026-09-18' }, AMBRA)
  assert.deepEqual(dopo.nottiLetto, ['2026-09-14', '2026-09-15', '2026-09-16'])
  assert.deepEqual(dopo.letto, { importo: 15, criterio: 'notte' })
  // quello acceso dalla pagina invece si spegne quando le persone rientrano
  const automatico = conLettoAutomatico(periodo({ ospiti: 3 }), AMBRA)
  assert.equal(automatico.letto?.auto, true)
  assert.deepEqual(conLettoAutomatico({ ...automatico, ospiti: 2 }, AMBRA).nottiLetto, [])
})

test('il cambio camera non raddoppia il totale concordato del letto (rilievo 6)', () => {
  const sei = periodo({ ospiti: 3, checkOut: '2026-09-20', nottiLetto: ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19'], letto: { importo: 20, criterio: 'totale' } })
  const [primo, secondo] = dividiPerCambio(sei, '2026-09-17', 'amelia', 70, 'p9')
  assert.equal(costoLetto(primo, AMBRA), 20)
  assert.equal(costoLetto(secondo, AMELIA), 0)      // niente secondo addebito
  assert.equal(lettoDaRivedere([primo, secondo]), true)
  // «a notte» invece si divide da solo, senza niente da rivedere
  const aNotte = { ...sei, letto: { importo: 10, criterio: 'notte' as const } }
  const [a, b] = dividiPerCambio(aNotte, '2026-09-17', 'amelia', 70, 'p9')
  assert.equal(costoLetto(a, AMBRA), 30)
  assert.equal(costoLetto(b, AMELIA), 30)
  assert.equal(lettoDaRivedere([a, b]), false)
})

test('spostare tutto il soggiorno non fa sparire il letto in silenzio', () => {
  const p = periodo({ ospiti: 2, nottiLetto: ['2026-09-14', '2026-09-15'], letto: { importo: 20, criterio: 'totale' } })
  const spostato = conLettoAutomatico({ ...p, checkIn: '2026-10-10', checkOut: '2026-10-14' }, AMBRA)
  assert.deepEqual(spostato.nottiLetto, [])          // le vecchie notti non esistono più
  assert.deepEqual(spostato.letto, { importo: 20, criterio: 'totale' })  // ma l'accordo resta
  assert.equal(lettoDaRivedere([spostato]), true)    // e la pagina lo dice
})

test('letto solo dopo il cambio camera: l\'importo non si perde', () => {
  const p = periodo({ ospiti: 2, checkOut: '2026-09-19', nottiLetto: ['2026-09-16', '2026-09-17'], letto: { importo: 20, criterio: 'totale' } })
  const [primo, secondo] = dividiPerCambio(p, '2026-09-16', 'amelia', 70, 'p9')
  assert.equal(costoLetto(primo, AMBRA), 0)
  assert.equal(costoLetto(secondo, AMELIA), 20)      // prima diventava 0
  assert.equal(lettoDaRivedere([primo, secondo]), false)
})
