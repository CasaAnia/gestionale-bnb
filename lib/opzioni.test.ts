// Opzione di 3 ore (06/09/2026): notti e camere in opzione, note, scadenze
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { opzioniAttive, opzioniScadute, occupantiDaOpzioni, notaOpzioni, nottiInOpzione, scadenzaOpzione, oraRoma, ORE_OPZIONE } from './opzioni.ts'
import { proponiSoluzioni } from './richiesteProposta.ts'
import { camereAmmesseNotte } from './richiesteComposizione.ts'

const ADESSO = new Date('2026-09-17T12:00:00Z')   // 14:00 a Roma
const AMBRA = { id: 'ambra', name: 'Ambra' }, ALLEGRA = { id: 'allegra', name: 'Allegra' }, LENA = { id: 'lena', name: 'Lena' }
const CAMERE = [AMBRA, ALLEGRA, LENA]
const seg = (camera: { id: string; name: string }, arrivo: string, partenza: string) => ({ camera, arrivo, partenza })
const r = (id: string, nome: string, cognome: string, stato: string, inviata: string | null, extra: Record<string, unknown> = {}) => ({ id, nome, cognome, stato, proposta_inviata_at: inviata, ...extra })

test('opzione attiva entro le 3 ore, scaduta dopo; le richieste in attesa non bloccano', () => {
  const mario = r('m', 'Mario', 'Rossi', 'proposta_inviata', '2026-09-17T11:40:00Z', { proposta_soluzione: { segmenti: [seg(AMBRA, '2026-09-17', '2026-09-20')] } })
  const vecchia = r('v', 'Vera', 'Verdi', 'proposta_inviata', '2026-09-17T08:00:00Z', { proposta_soluzione: { segmenti: [seg(LENA, '2026-09-18', '2026-09-19')] } })
  const attesa = r('a', 'Anna', 'Bianchi', 'in_attesa', null, { proposta_soluzione: { segmenti: [seg(ALLEGRA, '2026-09-17', '2026-09-18')] } })
  const attive = opzioniAttive([mario, vecchia, attesa], ADESSO)
  assert.deepEqual(attive.map(o => [o.richiestaId, o.cameraId, o.notti]), [['m', 'ambra', ['2026-09-17', '2026-09-18', '2026-09-19']]])
  assert.equal(oraRoma(attive[0].scadenza), '16:40')
  assert.equal(ORE_OPZIONE, 3)
  assert.deepEqual(opzioniScadute([mario, vecchia, attesa], ADESSO).map(o => o.richiestaId), ['v'])
  assert.equal(scadenzaOpzione(attesa), null)
  // la richiesta stessa non si blocca da sola
  assert.equal(opzioniAttive([mario], ADESSO, 'm').length, 0)
})

test('tutte le camere della soluzione e delle alternative sono in opzione, senza doppioni', () => {
  const mario = r('m', 'Mario', 'Rossi', 'proposta_inviata', '2026-09-17T11:40:00Z', {
    proposta_soluzione: { segmenti: [seg(AMBRA, '2026-09-17', '2026-09-18'), seg(LENA, '2026-09-18', '2026-09-20')] },   // caso B: cambio camera
    proposta_alternative: [{ segmenti: [seg(AMBRA, '2026-09-17', '2026-09-18'), seg(LENA, '2026-09-18', '2026-09-20')] }, { segmenti: [seg(ALLEGRA, '2026-09-17', '2026-09-20')] }],
  })
  const attive = opzioniAttive([mario], ADESSO)
  assert.deepEqual(attive.map(o => `${o.cameraId} ${o.arrivo}→${o.partenza}`), ['ambra 2026-09-17→2026-09-18', 'lena 2026-09-18→2026-09-20', 'allegra 2026-09-17→2026-09-20'])
  assert.deepEqual(occupantiDaOpzioni(attive)[0], { room_id: 'ambra', check_in: '2026-09-17', check_out: '2026-09-18', status: 'confermata' })
  assert.deepEqual(nottiInOpzione(attive, 'lena', '2026-09-17', '2026-09-20'), ['2026-09-18', '2026-09-19'])
  assert.deepEqual(nottiInOpzione(attive, 'lena', '2026-09-20', '2026-09-22'), [])
})

test('nota ottone: blocco con le camere libere, «nessuna proponibile», scaduta, oppure niente', () => {
  const mario = r('m', 'Mario', 'Rossi', 'proposta_inviata', '2026-09-17T11:40:00Z', { proposta_soluzione: { segmenti: [seg(AMBRA, '2026-09-17', '2026-09-20')] } })
  const attive = opzioniAttive([mario], ADESSO)
  const nessuna: ReturnType<typeof opzioniAttive> = []
  assert.deepEqual(notaOpzioni({ arrivo: '2026-09-18', partenza: '2026-09-19' }, CAMERE, [], attive, nessuna),
    { tipo: 'blocco', testo: 'Ambra è in opzione fino alle 16:40 per Mario Rossi. Libere per tutto il periodo: Allegra e Lena.' })
  // Lena occupata da una prenotazione confermata: resta solo Allegra
  const conf = [{ room_id: 'lena', check_in: '2026-09-18', check_out: '2026-09-19', status: 'confermata' }]
  assert.equal(notaOpzioni({ arrivo: '2026-09-18', partenza: '2026-09-19' }, CAMERE, conf, attive, nessuna)!.testo, 'Ambra è in opzione fino alle 16:40 per Mario Rossi. Libere per tutto il periodo: Allegra.')
  // niente libero
  const tutte = [...conf, { room_id: 'allegra', check_in: '2026-09-18', check_out: '2026-09-19', status: 'confermata' }]
  assert.equal(notaOpzioni({ arrivo: '2026-09-18', partenza: '2026-09-19' }, CAMERE, tutte, attive, nessuna)!.testo, 'Nessuna camera è proponibile: Ambra è in opzione fino alle 16:40 per Mario Rossi.')
  // notti non sovrapposte: nessuna nota
  assert.equal(notaOpzioni({ arrivo: '2026-09-20', partenza: '2026-09-22' }, CAMERE, [], attive, nessuna), null)
  // scaduta: nota diversa, nessun blocco
  const scadute = opzioniScadute([mario], new Date('2026-09-17T15:00:00Z'))
  assert.deepEqual(notaOpzioni({ arrivo: '2026-09-18', partenza: '2026-09-19' }, CAMERE, [], [], scadute),
    { tipo: 'scadute', testo: 'Ambra era in opzione per Mario Rossi, scaduta alle 16:40. Puoi proporla.' })
  // due richieste diverse con opzioni: frasi separate da «;»
  const luca = r('l', 'Luca', 'Neri', 'proposta_inviata', '2026-09-17T11:00:00Z', { proposta_soluzione: { segmenti: [seg(LENA, '2026-09-18', '2026-09-19')] } })
  assert.equal(notaOpzioni({ arrivo: '2026-09-18', partenza: '2026-09-19' }, CAMERE, [], opzioniAttive([mario, luca], ADESSO), nessuna)!.testo,
    'Ambra è in opzione fino alle 16:40 per Mario Rossi; Lena è in opzione fino alle 16:00 per Luca Neri. Libere per tutto il periodo: Allegra.')
})

// Pezzo B: la ricerca delle soluzioni e «Scelgo io» vedono le opzioni attive come camere occupate
test('bozza di proposta e «Scelgo io» calcolate su confermate + opzioni attive; passate le 3 ore la camera torna proponibile', () => {
  const LISTINO = [
    { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true },
    { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, active: true },
  ]
  const mario = r('m', 'Mario', 'Rossi', 'proposta_inviata', '2026-09-17T11:40:00Z', { proposta_soluzione: { segmenti: [seg(AMBRA, '2026-09-17', '2026-09-20')] } })
  const nuova = { arrivo: '2026-09-18', partenza: '2026-09-19', persone: 2, camera_id: null }
  const conOpzioni = [...occupantiDaOpzioni(opzioniAttive([mario], ADESSO))]
  const sol = proponiSoluzioni(nuova, LISTINO, conOpzioni)
  assert.ok(sol.length > 0)
  assert.ok(sol.every(s => s.segmenti.every(x => x.camera.id !== 'ambra')), 'Ambra in opzione: mai proposta')
  assert.deepEqual(camereAmmesseNotte(0, nuova, LISTINO, conOpzioni).map(c => c.id), ['allegra'])
  // dopo le 3 ore: nessuna opzione attiva, Ambra torna fra le proponibili
  const dopo = occupantiDaOpzioni(opzioniAttive([mario], new Date('2026-09-17T15:00:00Z')))
  assert.deepEqual(camereAmmesseNotte(0, nuova, LISTINO, dopo).map(c => c.id).sort(), ['allegra', 'ambra'])
})
