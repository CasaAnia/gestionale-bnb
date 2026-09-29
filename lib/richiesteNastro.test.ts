// Le richieste sul nastro (Richieste «Maison», 29/09/2026): dove stanno le
// schede tratteggiate e cosa dicono le loro righe.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { schedeRichieste, righeSchedaRichieste, postiRichiesta, statoBreve, TINTA_RICHIESTA, type RichiestaNastro } from './richiesteNastro.ts'
import { RIGA_QUALSIASI } from './richiesteCalendario.ts'

const camere = [
  { id: 'amelia', name: 'Amelia' }, { id: 'allegra', name: 'Allegra' }, { id: 'ambra', name: 'Ambra' }, { id: 'lena', name: 'Lena' },
]
const ric = (id: string, extra: Partial<RichiestaNastro> = {}): RichiestaNastro => ({
  id, created_at: '2026-09-29T06:41:00Z', nome: 'Anna', cognome: 'Rinaldi', arrivo: '2026-09-30', partenza: '2026-10-03', persone: 2,
  camera_id: null, canale: 'web', telefono: '+39 347 812 6690', note: null, stato: 'in_attesa', proposta_inviata_at: null,
  chiusa_at: null, prenotazione_id: null, ...extra,
})

test('scheda tratteggiata in attesa: date · canale, nome, «in attesa · 2 persone»; persone che cambiano «3 → 2 persone»', () => {
  const s = schedeRichieste([ric('a', { camera_id: 'amelia' })], camere, [])
  assert.equal(s.length, 1)
  assert.equal(s[0].riga, 'amelia')
  assert.deepEqual(righeSchedaRichieste(s[0]), { date: '30 set → 3 ott · dal sito', nome: 'Anna Rinaldi', sotto: 'in attesa · 2 persone', inviata: false, sovrapposte: false })
  const w = righeSchedaRichieste({ arrivo: '2026-09-30', partenza: '2026-10-03', richieste: [ric('b', { canale: 'whatsapp', nome: 'Marco', cognome: 'Colombo', persone: 3, persone_per_notte: [3, 2, 2] })] })
  assert.equal(w.date, '30 set → 3 ott · WhatsApp')
  assert.equal(w.sotto, 'in attesa · 3 → 2 persone')
  assert.equal(righeSchedaRichieste({ arrivo: '2026-09-30', partenza: '2026-10-01', richieste: [ric('c', { canale: 'telefono', persone: 1 })] }).sotto, 'in attesa · 1 persona')
})

test('scheda della proposta inviata: «proposta inviata · scade 18:00» (3 ore all’arrivo, 24 con caparra), poi «scaduta»', () => {
  // inviata alle 15:00 di Roma (13:00 UTC)
  const arrivo = ric('a', { stato: 'proposta_inviata', proposta_inviata_at: '2026-09-29T13:00:00Z', condizione_pagamento: 'arrivo' })
  assert.equal(statoBreve(arrivo, new Date('2026-09-29T14:00:00Z')), 'proposta inviata · scade 18:00')
  const caparra = ric('b', { stato: 'proposta_inviata', proposta_inviata_at: '2026-09-29T13:00:00Z', condizione_pagamento: 'caparra' })
  assert.equal(statoBreve(caparra, new Date('2026-09-29T20:00:00Z')), 'proposta inviata · scade 15:00')
  assert.equal(statoBreve(arrivo, new Date('2026-09-29T20:00:00Z')), 'proposta inviata · scaduta')
  const r = righeSchedaRichieste({ arrivo: '2026-10-02', partenza: '2026-10-05', richieste: [arrivo] }, new Date('2026-09-29T14:00:00Z'))
  assert.equal(r.sotto, 'proposta inviata · scade 18:00')
  assert.equal(r.inviata, true)
  // il fondo delle inviate e il tratteggio d'ottone
  assert.equal(TINTA_RICHIESTA.fondoInviata, '#FBF6EA')
  assert.equal(TINTA_RICHIESTA.bordo, '#A8894F')
  assert.equal(TINTA_RICHIESTA.testo, '#6E5116')
})

test('la proposta inviata sta sulle camere proposte, con le date di ogni tratto', () => {
  const r = ric('a', {
    stato: 'proposta_inviata', proposta_inviata_at: '2026-09-29T13:00:00Z',
    proposta_soluzione: { segmenti: [{ camera: { id: 'ambra', name: 'Ambra' }, arrivo: '2026-10-02', partenza: '2026-10-05' }] },
    proposta_alternative: [{ segmenti: [{ camera: { id: 'ambra', name: 'Ambra' }, arrivo: '2026-10-02', partenza: '2026-10-05' }] }, { segmenti: [{ camera: { id: 'lena', name: 'Lena' }, arrivo: '2026-10-02', partenza: '2026-10-05' }] }],
  })
  const s = schedeRichieste([r], camere, [])
  assert.deepEqual(s.map(x => x.riga).sort(), ['ambra', 'lena'])
})

test('«qualsiasi camera»: sulla riga «Qualsiasi camera» e su ogni camera libera per tutte le notti', () => {
  const prenotazioni = [
    { room_id: 'ambra', check_in: '2026-10-01', check_out: '2026-10-05', status: 'confermata' },      // occupa una notte
    { room_id: 'allegra', check_in: '2026-10-01', check_out: '2026-10-02', status: 'annullata' },    // non conta
  ]
  const tenute = [{ richiestaId: 'altra', cameraId: 'lena', notti: ['2026-10-02'], scaduta: false }]
  const s = schedeRichieste([ric('a')], camere, prenotazioni, tenute)
  assert.deepEqual(s.map(x => x.riga).sort(), ['allegra', 'amelia', RIGA_QUALSIASI].sort())
  // una tenuta scaduta non occupa più
  const s2 = schedeRichieste([ric('a')], camere, prenotazioni, [{ ...tenute[0], scaduta: true }])
  assert.ok(s2.some(x => x.riga === 'lena'))
})

test('due richieste sovrapposte nella stessa camera: UNA scheda, «2 richieste», i cognomi nella riga (c)', () => {
  const a = ric('a', { camera_id: 'lena', arrivo: '2026-10-03', partenza: '2026-10-06' })
  const b = ric('b', { camera_id: 'lena', nome: 'Marco', cognome: 'Colombo', canale: 'whatsapp', arrivo: '2026-10-04', partenza: '2026-10-06', created_at: '2026-09-28T10:00:00Z' })
  const s = schedeRichieste([a, b], camere, [])
  assert.equal(s.length, 1)
  assert.equal(s[0].arrivo, '2026-10-03')
  assert.equal(s[0].partenza, '2026-10-06')
  assert.deepEqual(righeSchedaRichieste(s[0]), { date: '3 → 6 ott', nome: '2 richieste', sotto: 'Rinaldi · Colombo', inviata: false, sovrapposte: true })
  // chi parte il 3 e chi arriva il 3 non si toccano: due schede
  const c = ric('c', { camera_id: 'lena', arrivo: '2026-09-30', partenza: '2026-10-03' })
  assert.equal(schedeRichieste([a, c], camere, []).length, 2)
})

test('chiuse e confermate non stanno sul nastro; notti scelte a mano = una scheda per gruppo di notti', () => {
  assert.equal(schedeRichieste([ric('a', { stato: 'chiusa', camera_id: 'amelia' }), ric('b', { stato: 'confermata', camera_id: 'amelia' })], camere, []).length, 0)
  const scelte = ric('a', { camera_id: 'amelia', arrivo: '2026-10-01', partenza: '2026-10-06', notti_richieste: ['2026-10-01', '2026-10-02', '2026-10-04'] })
  const s = schedeRichieste([scelte], camere, [])
  assert.deepEqual(s.map(x => `${x.arrivo}→${x.partenza}`), ['2026-10-01→2026-10-03', '2026-10-04→2026-10-05'])
  assert.deepEqual(postiRichiesta(ric('z', { camera_id: 'amelia' }), camere, () => false), [{ riga: 'amelia', notti: ['2026-09-30', '2026-10-01', '2026-10-02'] }])
})
