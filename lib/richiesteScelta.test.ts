// Bug del 07/09/2026 (produzione): richiesta dal sito per Allegra, 12–14
// ottobre, tutte le camere libere; Ania sceglie Allegra per tutto il periodo
// ma il messaggio elencava le tre camere. L'elenco va usato SOLO quando Ania
// non ha scelto e il cliente non ha chiesto una camera che è libera.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { alternativeDaElencare } from './richiesteScelta.ts'
import { generaProposta } from './richiesteTesti.ts'
import { proponiSoluzioni } from './richiesteProposta.ts'
import { soluzioneDaComposizione } from './richiesteComposizione.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA]
const NESSUNA_SCELTA = { cameraRichiesta: null, sceltaDiAnia: false }
const nomi = (alt: ReturnType<typeof alternativeDaElencare>) => alt?.map(s => s.segmenti[0].camera.name) ?? null

// 12–14 ottobre, in due, nessuna prenotazione: tutte e tre libere
const OTTOBRE = { nome: 'Marco', arrivo: '2026-10-12', partenza: '2026-10-14', persone: 2, camera_id: null as string | null }
const SOLO_ALLEGRA = `Gentile Marco,
grazie per aver pensato a Casa Ania per il suo soggiorno.

Ho verificato le date che mi ha indicato. Dal 12 al 14 ottobre è disponibile soltanto Allegra, una camera matrimoniale con il balconcino e il bagno in camera.

Il prezzo per le 2 notti è di 160 €, a 80 € a notte.

Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/allegra`

test('caso di Ania: il cliente ha chiesto Allegra e Allegra è libera → la proposta predefinita è solo Allegra', () => {
  const r = { ...OTTOBRE, camera_id: 'allegra' }
  const soluzioni = proponiSoluzioni(r, CAMERE, [])
  assert.equal(soluzioni.length, 3)
  assert.equal(soluzioni[0].segmenti[0].camera.name, 'Allegra', 'la camera chiesta viene per prima')
  const alternative = alternativeDaElencare(soluzioni[0], soluzioni, { cameraRichiesta: 'allegra', sceltaDiAnia: false })
  assert.equal(alternative, null)
  assert.equal(generaProposta({ richiesta: r, soluzione: soluzioni[0], condizione: null, alternative }), SOLO_ALLEGRA)
})

test('camera qualsiasi, Ania tocca Allegra nel pannello «Cambia» → solo Allegra', () => {
  const soluzioni = proponiSoluzioni(OTTOBRE, CAMERE, [])
  const allegra = soluzioni.find(s => s.segmenti[0].camera.id === 'allegra')!
  const alternative = alternativeDaElencare(allegra, soluzioni, { cameraRichiesta: null, sceltaDiAnia: true })
  assert.equal(alternative, null)
  assert.equal(generaProposta({ richiesta: OTTOBRE, soluzione: allegra, condizione: null, alternative }), SOLO_ALLEGRA)
})

test('«Scelgo io» con Allegra tutte le notti → solo Allegra (soluzione manuale, mai l\'elenco)', () => {
  const soluzioni = proponiSoluzioni(OTTOBRE, CAMERE, [])
  const manuale = soluzioneDaComposizione(OTTOBRE, CAMERE, ['allegra', 'allegra'])
  assert.equal(manuale.caso, 'completa')
  const alternative = alternativeDaElencare(manuale, soluzioni, NESSUNA_SCELTA)
  assert.equal(alternative, null)
  assert.equal(generaProposta({ richiesta: OTTOBRE, soluzione: manuale, condizione: null, alternative }), SOLO_ALLEGRA)
})

test('nessuna scelta e camera qualsiasi → l\'elenco delle tre camere resta', () => {
  const soluzioni = proponiSoluzioni(OTTOBRE, CAMERE, [])
  const alternative = alternativeDaElencare(soluzioni[0], soluzioni, NESSUNA_SCELTA)
  assert.deepEqual(nomi(alternative), ['Amelia', 'Allegra', 'Ambra'])
  assert.match(generaProposta({ richiesta: OTTOBRE, soluzione: soluzioni[0], condizione: null, alternative }), /ho tre camere libere che posso proporle:/)
})

test('il cliente ha chiesto Allegra ma è occupata: nessuna scelta → elenco delle altre due', () => {
  const r = { ...OTTOBRE, camera_id: 'allegra' }
  const occupata = [{ room_id: 'allegra', check_in: '2026-10-11', check_out: '2026-10-15', status: 'confermata' }]
  const soluzioni = proponiSoluzioni(r, CAMERE, occupata)
  const alternative = alternativeDaElencare(soluzioni[0], soluzioni, { cameraRichiesta: 'allegra', sceltaDiAnia: false })
  assert.deepEqual(nomi(alternative), ['Amelia', 'Ambra'])
})

test('caso B da «Scelgo io» (cambio camera) non è toccato: niente elenco, testo del cambio', () => {
  const soluzioni = proponiSoluzioni(OTTOBRE, CAMERE, [])
  const cambio = soluzioneDaComposizione(OTTOBRE, CAMERE, ['amelia', 'allegra'])
  assert.equal(cambio.caso, 'cambio')
  assert.equal(alternativeDaElencare(cambio, soluzioni, { cameraRichiesta: 'allegra', sceltaDiAnia: true }), null)
  assert.match(generaProposta({ richiesta: OTTOBRE, soluzione: cambio, condizione: null, alternative: null }), /con un cambio di camera durante il soggiorno:\n\n– dal 12 al 13 in Amelia/)
})
