// Riquadro «Richieste» in Statistiche (07/09/2026): conteggi del periodo,
// motivi, per camera chiesta, camera diversa accettata, alternative rifiutate.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { riquadroRichieste, giornoLocale, NOME_QUALSIASI, type RichiestaRiquadro } from './richiesteRiquadro.ts'

const AMELIA = { id: 'r1', name: 'Amelia' }, ALLEGRA = { id: 'r2', name: 'Allegra' }, AMBRA = { id: 'r3', name: 'Ambra' }, LENA = { id: 'r4', name: 'Lena' }
const CAMERE = [LENA, AMELIA, AMBRA, ALLEGRA]   // disordinate apposta: il riquadro le ordina per nome
const SET = ['2026-09-01', '2026-10-01'] as const
const seg = (id: string) => ({ camera: { id } })
let n = 0
const ric = (x: Partial<RichiestaRiquadro>): RichiestaRiquadro => ({ id: `q${++n}`, created_at: '2026-09-10T12:00:00', stato: 'in_attesa', camera_id: null, ...x })

// Proposta inviata con la camera chiesta (o un'altra)
const proposta = (...camere: string[]) => ({ proposta_inviata_at: '2026-09-10T13:00:00', proposta_soluzione: { segmenti: camere.map(seg) } })

test('giorno locale di un timestamp', () => {
  assert.equal(giornoLocale('2026-09-10T12:00:00'), '2026-09-10')
  assert.equal(giornoLocale('non è una data'), '')
})

test('arrivate = chiuse nel periodo; le in corso non contano ma si dicono; fuori periodo escluse', () => {
  const lista = [
    ric({ stato: 'confermata', ...proposta('r3'), camera_id: 'r3' }),
    ric({ stato: 'in_attesa' }),
    ric({ stato: 'proposta_inviata', ...proposta('r1') }),
    ric({ stato: 'chiusa', chiusura_motivo: 'scaduta' }),
    ric({ stato: 'confermata', created_at: '2026-08-31T23:00:00' }),   // agosto
  ]
  const r = riquadroRichieste(lista, CAMERE, ...SET)
  assert.equal(r.arrivate, 2)
  assert.equal(r.inCorso, 2)
  assert.equal(r.diventatePrenotazioni, 1)
  assert.equal(r.percentoPrenotazioni, 50)
  assert.equal(r.scaduteSenzaRisposta, 1)
})

test('motivi: scadute + «non ha risposto» insieme; detto no; data a un altro (anche in cascata dalla RPC); altro (compresi i rifiuti vecchi senza codice)', () => {
  const lista = [
    ric({ stato: 'chiusa', chiusura_motivo: 'scaduta' }),
    ric({ stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'non_risposto' }),
    ric({ stato: 'rifiutata', motivo_rifiuto: 'Non ha più risposto' }),
    ric({ stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'detto_no' }),
    ric({ stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'data_ad_altro' }),
    ric({ stato: 'rifiutata', motivo_rifiuto: 'date assegnate a altro cliente' }),
    ric({ stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'altro' }),
    ric({ stato: 'rifiutata', motivo_rifiuto: 'Prezzo' }),
    ric({ stato: 'rifiutata', motivo_rifiuto: null }),
  ]
  const r = riquadroRichieste(lista, CAMERE, ...SET)
  assert.equal(r.arrivate, 9)
  assert.equal(r.diventatePrenotazioni, 0)
  assert.equal(r.percentoPrenotazioni, 0)
  assert.equal(r.scaduteSenzaRisposta, 3)
  assert.equal(r.dettoNo, 1)
  assert.equal(r.dateAdAltro, 2)
  assert.equal(r.altroMotivo, 3)
})

test('per camera chiesta: ordine Allegra, Ambra, Amelia, Lena, Qualsiasi; «non era libera» = proposta inviata senza la camera chiesta', () => {
  const lista = [
    ric({ camera_id: 'r3', stato: 'confermata', ...proposta('r3') }),                          // Ambra chiesta, Ambra data
    ric({ camera_id: 'r3', stato: 'confermata', ...proposta('r4') }),                          // Ambra chiesta, non libera, Lena accettata
    ric({ camera_id: 'r3', stato: 'chiusa', chiusura_motivo: 'scaduta', ...proposta('r1') }),  // Ambra chiesta, non libera, proposta Amelia scaduta
    ric({ camera_id: 'r3', stato: 'rifiutata', motivo_rifiuto: 'detto_no' }),                  // Ambra chiesta, rifiutata senza proposta: non si sa se era libera
    ric({ camera_id: 'r4', stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'detto_no', proposta_inviata_at: '2026-09-10T13:00:00', proposta_soluzione: { segmenti: [seg('r1')] }, proposta_alternative: [{ segmenti: [seg('r4')] }] }), // Lena chiesta: era fra le alternative → libera
    ric({ camera_id: null, stato: 'confermata', ...proposta('r2') }),                          // qualsiasi → Allegra
    ric({ camera_id: null, stato: 'chiusa', chiusura_motivo: 'scaduta' }),
    ric({ camera_id: 'r3', stato: 'in_attesa' }),                                              // in corso: non conta
  ]
  const r = riquadroRichieste(lista, CAMERE, ...SET)
  assert.deepEqual(r.perCamera, [
    { nome: 'Allegra', chiesta: 0, nonEraLibera: 0, diventata: 0 },
    { nome: 'Ambra', chiesta: 4, nonEraLibera: 2, diventata: 2 },
    { nome: 'Amelia', chiesta: 0, nonEraLibera: 0, diventata: 0 },
    { nome: 'Lena', chiesta: 1, nonEraLibera: 0, diventata: 0 },
    { nome: NOME_QUALSIASI, chiesta: 2, nonEraLibera: null, diventata: 1 },
  ])
  // camera diversa accettata: 1 su 2 confermate con camera precisa; alternativa non accettata: la scaduta di Ambra
  assert.deepEqual(r.accettatoDiversa, { si: 1, su: 2 })
  assert.equal(r.alternativaNonAccettata, 1)
})

test('R5 (revisione 07/09/2026): «proposta un’alternativa, non hanno risposto o hanno detto no» esclude «data a un altro» e «altro motivo»', () => {
  const lista = [
    ric({ camera_id: 'r3', stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'data_ad_altro', ...proposta('r1') }),  // alternativa proposta, poi data a un altro
    ric({ camera_id: 'r3', stato: 'rifiutata', motivo_rifiuto: 'Prezzo', ...proposta('r1') }),                                    // altro motivo
    ric({ camera_id: 'r3', stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'detto_no', ...proposta('r1') }),       // ha detto di no → conta
    ric({ camera_id: 'r3', stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'non_risposto', ...proposta('r1') }),   // non ha risposto → conta
    ric({ camera_id: 'r3', stato: 'chiusa', chiusura_motivo: 'scaduta', ...proposta('r1') }),                                     // scaduta → conta
  ]
  const r = riquadroRichieste(lista, CAMERE, ...SET)
  assert.equal(r.dateAdAltro, 1)
  assert.equal(r.altroMotivo, 1)
  assert.equal(r.alternativaNonAccettata, 3)
  assert.equal(r.perCamera.find(c => c.nome === 'Ambra')?.nonEraLibera, 5)   // «non era libera» resta sull'assenza dalle proposte, a prescindere dall'esito
})

test('cambio camera nella soluzione: se una parte del soggiorno è nella camera chiesta conta comunque come «diversa»', () => {
  const lista = [ric({ camera_id: 'r3', stato: 'confermata', proposta_inviata_at: '2026-09-10T13:00:00', proposta_soluzione: { segmenti: [seg('r3'), seg('r4')] } })]
  const r = riquadroRichieste(lista, CAMERE, ...SET)
  assert.deepEqual(r.accettatoDiversa, { si: 1, su: 1 })
  // la camera chiesta compariva nella proposta → non «non era libera»
  assert.equal(r.perCamera.find(c => c.nome === 'Ambra')?.nonEraLibera, 0)
})

test('periodo vuoto: tutti zeri, righe delle camere presenti', () => {
  const r = riquadroRichieste([], CAMERE, ...SET)
  assert.equal(r.arrivate, 0)
  assert.equal(r.percentoPrenotazioni, 0)
  assert.equal(r.perCamera.length, 5)
  assert.deepEqual(r.accettatoDiversa, { si: 0, su: 0 })
})
