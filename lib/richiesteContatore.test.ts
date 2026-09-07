// Parte 3, pezzo 1 (05/09/2026): il contatore delle richieste aperte non
// torna mai 0 su errore; lo stato distingue caricamento / pronto / errore.
// Dal 07/09/2026 (Ania) il contatore porta le righe aperte e i bollini si
// calcolano da lì: rosso = nuove da gestire, blu = proposta inviata in
// attesa di risposta, niente per le proposte scadute.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contaConEsito, statoDopoConteggio, bolliniRichieste, CONTATORE_IN_CARICAMENTO, MESSAGGIO_CONTATORE_NON_LETTO, type RigaAperta } from './richiesteContatore.ts'
import { ORE_SCADENZA_PROPOSTA } from './richieste.ts'

test('errore di Supabase → righe null e messaggio, mai «nessuna richiesta»', async () => {
  const esito = await contaConEsito(async () => ({ data: null, error: { code: 'PGRST205', message: "Could not find the table 'public.richieste'" } }))
  assert.deepEqual(esito, { righe: null, errore: `${MESSAGGIO_CONTATORE_NON_LETTO}, riprova` })
  const stato = statoDopoConteggio(CONTATORE_IN_CARICAMENTO, esito)
  assert.equal(stato.stato, 'errore')
  assert.notEqual(stato.stato, 'pronto')
})

test('senza rete (eccezione) → «nessuna connessione», nessun catch silenzioso', async () => {
  const esito = await contaConEsito(() => Promise.reject(new TypeError('Failed to fetch')))
  assert.equal(esito.errore, `${MESSAGGIO_CONTATORE_NON_LETTO}: nessuna connessione`)
  assert.equal(esito.righe, null)
})

test('zero righe è «pronto» con nessuna richiesta (questo sì è nessuna richiesta); le righe vere restano', async () => {
  assert.deepEqual(statoDopoConteggio(CONTATORE_IN_CARICAMENTO, await contaConEsito(async () => ({ data: [], error: null }))), { stato: 'pronto', righe: [], errore: null })
  const tre: RigaAperta[] = [{ stato: 'in_attesa', proposta_inviata_at: null }, { stato: 'in_attesa', proposta_inviata_at: null }, { stato: 'proposta_inviata', proposta_inviata_at: '2026-09-07T10:00:00Z' }]
  assert.deepEqual(statoDopoConteggio(CONTATORE_IN_CARICAMENTO, await contaConEsito(async () => ({ data: tre, error: null }))), { stato: 'pronto', righe: tre, errore: null })
  // data null senza errore (non dovrebbe succedere) = nessuna riga, non un errore
  assert.deepEqual((await contaConEsito(async () => ({ data: null, error: null }))).righe, [])
})

test('errore dopo una lettura riuscita: le righe già mostrate restano (i bollini non tornano a zero) e lo stato è errore', async () => {
  const due: RigaAperta[] = [{ stato: 'in_attesa', proposta_inviata_at: null }, { stato: 'in_attesa', proposta_inviata_at: null }]
  const pronto = statoDopoConteggio(CONTATORE_IN_CARICAMENTO, { righe: due, errore: null })
  const dopo = statoDopoConteggio(pronto, await contaConEsito(async () => ({ data: null, error: { message: 'permission denied' } })))
  assert.equal(dopo.stato, 'errore')
  assert.deepEqual(dopo.righe, due)
  assert.deepEqual(bolliniRichieste(dopo.righe), { nuove: 2, inAttesaRisposta: 0 })
})

// ── Bollini (Ania, 07/09/2026) ─────────────────────────────────────────────
const ADESSO = new Date('2026-09-07T15:00:00Z')
const ore = (n: number) => new Date(ADESSO.getTime() - n * 3600000).toISOString()

test('bollini: rosso solo per le nuove in attesa; blu per le proposte inviate non ancora scadute; scadute senza bollino', () => {
  const righe: RigaAperta[] = [
    { stato: 'in_attesa', proposta_inviata_at: null },                       // nuova → rosso
    { stato: 'in_attesa', proposta_inviata_at: null },                       // nuova → rosso
    { stato: 'proposta_inviata', proposta_inviata_at: ore(1) },              // manca tempo → blu
    { stato: 'proposta_inviata', proposta_inviata_at: ore(ORE_SCADENZA_PROPOSTA - 0.25) },  // scade tra 15 min → blu
    { stato: 'proposta_inviata', proposta_inviata_at: ore(ORE_SCADENZA_PROPOSTA + 0.5) },   // scaduta mezz'ora fa → niente
    { stato: 'proposta_inviata', proposta_inviata_at: ore(30) },             // scaduta ieri (non ancora chiusa da sola) → niente
  ]
  assert.deepEqual(bolliniRichieste(righe, ADESSO), { nuove: 2, inAttesaRisposta: 2 })
})

test('bollini: il caso di Ania — una sola richiesta già lavorata (proposta inviata) e scaduta: nessun bollino, né rosso né blu', () => {
  const righe: RigaAperta[] = [{ stato: 'proposta_inviata', proposta_inviata_at: ore(ORE_SCADENZA_PROPOSTA + 2) }]
  assert.deepEqual(bolliniRichieste(righe, ADESSO), { nuove: 0, inAttesaRisposta: 0 })
  // Stessa richiesta un'ora prima della scadenza: blu, non rosso
  assert.deepEqual(bolliniRichieste([{ stato: 'proposta_inviata', proposta_inviata_at: ore(ORE_SCADENZA_PROPOSTA - 1) }], ADESSO), { nuove: 0, inAttesaRisposta: 1 })
})

test('bollini: proposta inviata senza ora (righe vecchie) conta come in attesa di risposta; stati chiusi mai; nessuna riga = nessun bollino', () => {
  assert.deepEqual(bolliniRichieste([{ stato: 'proposta_inviata', proposta_inviata_at: null }], ADESSO), { nuove: 0, inAttesaRisposta: 1 })
  assert.deepEqual(bolliniRichieste([{ stato: 'confermata', proposta_inviata_at: ore(1) }, { stato: 'rifiutata', proposta_inviata_at: null }, { stato: 'chiusa', proposta_inviata_at: ore(1) }], ADESSO), { nuove: 0, inAttesaRisposta: 0 })
  assert.deepEqual(bolliniRichieste([], ADESSO), { nuove: 0, inAttesaRisposta: 0 })
})

test('bollini: il blu sparisce da solo col passare del tempo (stesse righe, adesso diverso)', () => {
  const righe: RigaAperta[] = [{ stato: 'proposta_inviata', proposta_inviata_at: ADESSO.toISOString() }]
  assert.equal(bolliniRichieste(righe, ADESSO).inAttesaRisposta, 1)
  assert.equal(bolliniRichieste(righe, new Date(ADESSO.getTime() + ORE_SCADENZA_PROPOSTA * 3600000 - 60000)).inAttesaRisposta, 1)
  assert.equal(bolliniRichieste(righe, new Date(ADESSO.getTime() + ORE_SCADENZA_PROPOSTA * 3600000 + 1000)).inAttesaRisposta, 0)
})
