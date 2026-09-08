// Regressione del 07/09/2026 (sera): Cambia → WhatsApp → ricaricamento → «Sì, inviata»
// deve archiviare la soluzione e le alternative del messaggio partito, non quelle
// ricalcolate; l'opzione di 3 ore deve bloccare solo quella camera. Lo stesso per
// «Scelgo io» con prezzi a mano. (La parte React è provata sull'anteprima finta.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { serializzaPendente, leggiPendente, datiPerConferma, chiavePendente, custodisciPendente, eliminaPendente } from './richiestePendente.ts'
import { alternativeDaElencare, chiaveSoluzione, soluzioneScelta } from './richiesteScelta.ts'
import { generaProposta } from './richiesteTesti.ts'
import { proponiSoluzioni } from './richiesteProposta.ts'
import { soluzioneDaComposizione } from './richiesteComposizione.ts'
import { opzioniAttive, occupantiDaOpzioni } from './opzioni.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA]
const LUCIA = { nome: 'Lucia', arrivo: '2026-10-12', partenza: '2026-10-14', persone: 2, camera_id: null as string | null }
const ARRIVO = { condizione_pagamento: 'arrivo' as const, caparra_centesimi: null, condizione_testo: null, amelia_alternativa: false }
const camere = (s: { segmenti: { camera: { name: string } }[] } | null) => s?.segmenti.map(x => x.camera.name).join('+')

test('Cambia → Ambra → WhatsApp → ricaricamento → Sì: testo, soluzione, alternative e opzione coincidono', () => {
  const soluzioni = proponiSoluzioni(LUCIA, CAMERE, [])
  // Ania tocca Ambra in «Cambia»
  const ambra = soluzioni.find(s => s.segmenti[0].camera.id === 'ambra')!
  const alternative = alternativeDaElencare(ambra, soluzioni, { cameraRichiesta: null, sceltaDiAnia: true })
  const testo = generaProposta({ richiesta: LUCIA, soluzione: ambra, condizione: { tipo: 'arrivo' }, alternative })
  assert.match(testo, /soltanto Ambra/)
  // invia(): nel browser resta il pendente completo
  const grezzo = serializzaPendente({ testo, condizioni: ARRIVO, soluzione: ambra, alternative })
  // ricaricamento: la pagina ricalcola Amelia con tutte le camere (nessuna scelta in memoria)
  const ricalcolati = { soluzione: soluzioni[0], alternative: alternativeDaElencare(soluzioni[0], soluzioni, { cameraRichiesta: null, sceltaDiAnia: false }) }
  assert.equal(camere(ricalcolati.soluzione), 'Amelia'); assert.equal(ricalcolati.alternative?.length, 3)
  // «Sì, inviata»: vince il pendente
  const pendente = leggiPendente(grezzo)!
  assert.equal(pendente.testo, testo); assert.deepEqual(pendente.condizioni, ARRIVO)
  const conferma = datiPerConferma(pendente)!
  assert.ok(conferma)
  assert.equal(camere(conferma.soluzione), 'Ambra'); assert.equal(conferma.alternative, null)
  // l'opzione di 3 ore blocca SOLO Ambra
  const riga = { id: 'r1', nome: 'Lucia', cognome: 'Q', stato: 'proposta_inviata', proposta_inviata_at: '2026-09-07T18:00:00Z', proposta_soluzione: conferma.soluzione, proposta_alternative: conferma.alternative }
  const opz = opzioniAttive([riga], new Date('2026-09-07T19:00:00Z'))
  assert.deepEqual(opz.map(o => o.cameraNome), ['Ambra'])
  assert.deepEqual(occupantiDaOpzioni(opz).map(o => o.room_id), ['ambra'])
  // Nessuna conferma senza la copia del messaggio aperto in WhatsApp.
  assert.equal(datiPerConferma(null), null)
  assert.equal(chiavePendente('r1'), 'ca_proposta_pendente_r1')
})

test('Scelgo io con cambio camera e prezzo a mano: il pendente conserva composizione e prezzi', () => {
  const manuale = soluzioneDaComposizione(LUCIA, CAMERE, ['amelia', 'ambra'], [null, 9900])
  assert.equal(manuale.caso, 'cambio'); assert.equal(manuale.manuale, true)
  const testo = generaProposta({ richiesta: LUCIA, soluzione: manuale, condizione: { tipo: 'arrivo' }, alternative: null })
  assert.match(testo, /in Ambra, una matrimoniale: 99 € a notte/)
  const pendente = leggiPendente(serializzaPendente({ testo, condizioni: ARRIVO, soluzione: manuale, alternative: null }))!
  const conferma = datiPerConferma(pendente)!
  assert.equal(camere(conferma.soluzione), 'Amelia+Ambra')
  assert.equal(conferma.soluzione?.manuale, true)
  assert.equal(conferma.soluzione?.segmenti[1].prezzo_manuale, true)
  assert.deepEqual(conferma.soluzione?.segmenti[1].prezziNottiCentesimi, [9900])
  assert.equal(conferma.soluzione?.prezzoTotale, 174)   // Amelia in due 75 + Ambra a mano 99
  assert.equal(conferma.alternative, null)
})

test('pendente vecchio o rotto: conserva il testo ma impedisce la conferma con camere inventate', () => {
  const vecchio = leggiPendente(JSON.stringify({ testo: 'ciao', condizioni: ARRIVO }))!
  assert.equal(vecchio.testo, 'ciao'); assert.equal(vecchio.soluzione, null); assert.equal(vecchio.alternative, null)
  assert.equal(datiPerConferma(vecchio), null)
  assert.equal(leggiPendente('{non json'), null); assert.equal(leggiPendente(null), null); assert.equal(leggiPendente('42'), null)
  const malformata = leggiPendente(JSON.stringify({ testo: 't', condizioni: ARRIVO, soluzione: { caso: 'completa' }, alternative: [{ caso: 'completa', segmenti: [] }] }))!
  assert.equal(malformata.soluzione, null); assert.equal(malformata.alternative, null)
})

test('la scelta è una chiave: se le soluzioni si riordinano (opzione scaduta, camera liberata) resta Ambra', () => {
  // Con Amelia in opzione per un'altra richiesta: Allegra e Ambra libere
  const inOpzione = [{ room_id: 'amelia', check_in: '2026-10-12', check_out: '2026-10-14', status: 'confermata' }]
  const prima = proponiSoluzioni(LUCIA, CAMERE, inOpzione)
  assert.deepEqual(prima.map(camere), ['Allegra', 'Ambra'])
  const chiave = chiaveSoluzione(prima[1])   // Ania tocca Ambra (posizione 1)
  // Un minuto dopo l'opzione scade: Amelia torna libera e la lista si riordina
  const dopo = proponiSoluzioni(LUCIA, CAMERE, [])
  assert.deepEqual(dopo.map(camere), ['Amelia', 'Allegra', 'Ambra'])
  assert.equal(camere(dopo[1]), 'Allegra', 'con l\'indice la scelta sarebbe diventata Allegra')
  const s = soluzioneScelta(dopo, chiave)
  assert.equal(s.trovata, true); assert.equal(camere(s.soluzione), 'Ambra')
  // Se la camera si occupa davvero, l'invio si ferma: Ania deve scegliere di nuovo.
  const senzaAmbra = proponiSoluzioni(LUCIA, CAMERE, [{ room_id: 'ambra', check_in: '2026-10-12', check_out: '2026-10-14', status: 'confermata' }])
  const s2 = soluzioneScelta(senzaAmbra, chiave)
  assert.equal(s2.trovata, false); assert.equal(s2.soluzione, null)
  assert.equal(soluzioneScelta([], chiave).soluzione, null)
  assert.equal(soluzioneScelta(dopo, null).trovata, false); assert.equal(camere(soluzioneScelta(dopo, null).soluzione), 'Amelia')
})

function memoriaFinta() {
  const v = new Map<string, string>()
  return { getItem: (k: string) => v.get(k) ?? null, setItem: (k: string, t: string) => { v.set(k, t) }, removeItem: (k: string) => { v.delete(k) } }
}
const offerta = () => ({ testo: 'Offerta Ambra', condizioni: ARRIVO, soluzione: proponiSoluzioni(LUCIA, CAMERE, [])[2], alternative: null })

test('doppio invio o altra scheda: la copia aperta in WhatsApp non viene sovrascritta', () => {
  const m = memoriaFinta(), p = offerta(), k = chiavePendente('r1')
  custodisciPendente(m, k, p)
  assert.throws(() => custodisciPendente(m, k, { ...p, testo: 'Altra offerta' }), /già un invio/)
  assert.deepEqual(leggiPendente(m.getItem(k)), p)
})

test('memoria guasta o scrittura ignorata: niente apertura sicura di WhatsApp', () => {
  const m = memoriaFinta(), p = offerta()
  assert.throws(() => custodisciPendente({ ...m, setItem: () => { throw new Error('QuotaExceeded') } }, 'r1', p), /QuotaExceeded/)
  assert.throws(() => custodisciPendente({ ...m, setItem: () => {} }, 'r1', p), /non è stata conservata/)
  assert.throws(() => custodisciPendente({ ...m, getItem: () => { throw new Error('SecurityError') } }, 'r1', p), /SecurityError/)
})

test('errore e riapertura: il retry mantiene testo, condizioni e ora della prima conferma; pulizia solo al successo', () => {
  const m = memoriaFinta(), p = offerta(), k = chiavePendente('r1')
  custodisciPendente(m, k, p)
  const confermato = { ...p, confermataIl: '2026-09-07T20:01:02.003Z' }
  custodisciPendente(m, k, confermato, p)
  // La risposta di rete si perde: ricreo il controller dalla custodia.
  const ripreso = leggiPendente(m.getItem(k))!
  assert.deepEqual(datiPerConferma(ripreso), confermato)
  custodisciPendente(m, k, ripreso, ripreso)
  assert.deepEqual(leggiPendente(m.getItem(k)), confermato)
  eliminaPendente(m, k)
  assert.equal(leggiPendente(m.getItem(k)), null)
  // Seconda riapertura pulita; si può preparare un nuovo invio.
  assert.equal(m.getItem(k), null)
  custodisciPendente(m, k, p)
  eliminaPendente(m, k) // «No»
  assert.equal(m.getItem(k), null)
})

test('eliminazione fallita: la custodia non viene dichiarata pulita', () => {
  const m = memoriaFinta()
  custodisciPendente(m, 'r1', offerta())
  assert.throws(() => eliminaPendente({ ...m, removeItem: () => {} }, 'r1'), /non è stata conservata/)
  assert.ok(leggiPendente(m.getItem('r1')))
})

test('caparra, testo personale e alternative multiple restano esatti; una alternativa corrotta blocca tutta la conferma', () => {
  const soluzioni = proponiSoluzioni(LUCIA, CAMERE, [])
  const p = { ...offerta(), testo: 'Testo modificato da Ania', condizioni: { ...ARRIVO, condizione_pagamento: 'caparra' as const, caparra_centesimi: 7250 }, alternative: soluzioni }
  const ripreso = leggiPendente(serializzaPendente(p))!
  assert.deepEqual(datiPerConferma(ripreso), p)
  assert.equal(datiPerConferma(leggiPendente(JSON.stringify({ ...p, alternative: [{ caso: 'completa', segmenti: [] }, ...soluzioni] }))), null)
})
