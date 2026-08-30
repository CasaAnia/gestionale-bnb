// Test delle SCRITTURE (3.2B) con cliente FINTO: nessuna connessione,
// nessuna scrittura vera. Copre validazione, errori che non diventano mai
// falsi successi, e la pulizia del caricamento foto quando qualcosa fallisce.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  caricaDocumentoConFoto, importoDaTesto, salvaSpesaManuale, validaSpesaManuale,
  SPESA_MANUALE_VUOTA, type ClienteScrittura, type SpesaManualeInput,
} from './scrittura.ts'

const input = (extra: Partial<SpesaManualeInput> = {}): SpesaManualeInput => ({
  ...SPESA_MANUALE_VUOTA('2026-08-30'),
  importo: '12,50', group_id: 'g-casa', ...extra,
})

function clienteRegistratore(risposte: Partial<Record<keyof ClienteScrittura, { errore?: string }>> = {}) {
  const chiamate: { azione: string; payload?: unknown }[] = []
  const cliente: ClienteScrittura = {
    async inserisciSpesa(payload) { chiamate.push({ azione: 'inserisciSpesa', payload }); return risposte.inserisciSpesa ?? {} },
    async caricaFile(percorso) { chiamate.push({ azione: 'caricaFile', payload: percorso }); return risposte.caricaFile ?? {} },
    async rimuoviFile(percorso) { chiamate.push({ azione: 'rimuoviFile', payload: percorso }) },
    async creaDocumento(payload) { chiamate.push({ azione: 'creaDocumento', payload }); return risposte.creaDocumento ?? { id: 'doc-1' } },
    async creaRicevuta(payload) { chiamate.push({ azione: 'creaRicevuta', payload }); return risposte.creaRicevuta ?? {} },
  }
  return { cliente, chiamate }
}

test('importoDaTesto: virgola italiana, positivi soltanto', () => {
  assert.equal(importoDaTesto('12,50'), 12.5)
  assert.equal(importoDaTesto('1.250,00'), 1250)
  assert.equal(importoDaTesto('0'), null)
  assert.equal(importoDaTesto('-5'), null)
  assert.equal(importoDaTesto('ciao'), null)
})

test('validazione: metodo di pagamento OBBLIGATORIO per Casa Ania, non per Casa Mia', () => {
  assert.deepEqual(validaSpesaManuale(input({ group_id: 'g-bnb' }), 'azienda'),
    ['per Casa Ania il metodo di pagamento è obbligatorio'])
  assert.deepEqual(validaSpesaManuale(input({ group_id: 'g-bnb', payment_method: 'bonifico' }), 'azienda'), [])
  assert.deepEqual(validaSpesaManuale(input(), 'personale'), [])
  assert.ok(validaSpesaManuale(input({ importo: '' }), 'personale').length > 0)
  assert.ok(validaSpesaManuale(input({ group_id: '' }), 'personale').length > 0)
})

test('salvataggio manuale: successo → payload giusto (expense_nature, camera, metodo, source manuale)', async () => {
  const { cliente, chiamate } = clienteRegistratore()
  const esito = await salvaSpesaManuale(cliente, input({
    group_id: 'g-bnb', payment_method: 'carta_attivita', room_id: 'r-ambra',
    expense_nature: 'ricorrente', store: ' Esselunga ',
  }), 'azienda')
  assert.deepEqual(esito, { ok: true })
  const payload = chiamate[0].payload as Record<string, unknown>
  assert.equal(payload.amount, 12.5)
  assert.equal(payload.payment_method, 'carta_attivita')
  assert.equal(payload.room_id, 'r-ambra')
  assert.equal(payload.expense_nature, 'ricorrente')
  assert.equal(payload.store, 'Esselunga')
  assert.equal(payload.source, 'manuale')
  assert.ok(!('recurring' in payload))   // mai una seconda fonte di verità
})

test('salvataggio manuale: un errore NON diventa un falso successo', async () => {
  const { cliente } = clienteRegistratore({ inserisciSpesa: { errore: 'connessione assente' } })
  const esito = await salvaSpesaManuale(cliente, input(), 'personale')
  assert.deepEqual(esito, { ok: false, errore: 'connessione assente' })
  // e un'eccezione inattesa viene catturata, non lanciata al modulo
  const cheEsplode: ClienteScrittura = {
    ...cliente, inserisciSpesa: async () => { throw new Error('rete caduta') },
  }
  const esito2 = await salvaSpesaManuale(cheEsplode, input(), 'personale')
  assert.equal(esito2.ok, false)
})

const FOTO = { nomeFile: 'scontrino.jpg', tipo: 'image/jpeg', contenuto: new Blob(['x']), sha256: 'abc' }
const orologio = () => '2026-08-30T10:00:00.000Z'
const id = () => 'uuid-fisso'

test('caricamento foto: successo → file, documento da_elaborare, ricevuta collegata (con campi legacy)', async () => {
  const { cliente, chiamate } = clienteRegistratore()
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'personale', 'nota di prova', 'scontrino', orologio, id)
  assert.deepEqual(esito, { ok: true, documentId: 'doc-1' })
  assert.deepEqual(chiamate.map(c => c.azione), ['caricaFile', 'creaDocumento', 'creaRicevuta'])
  const doc = chiamate[1].payload as Record<string, unknown>
  assert.equal(doc.kind, 'scontrino')
  assert.equal(doc.upload_ambito, 'personale')
  assert.ok(!('status' in doc))          // lo status lo decide il database (da_elaborare)
  const ric = chiamate[2].payload as Record<string, unknown>
  assert.equal(ric.document_id, 'doc-1')
  assert.equal(ric.storage_path, '2026-08-30/uuid-fisso.jpg')
  assert.equal(ric.file_sha256, 'abc')
  assert.equal(ric.status, 'da_leggere') // compatibilità col vecchio /scontrini fino alla Fase 4
  assert.equal(ric.ambito, 'personale')
})

test('caricamento foto: upload fallito → niente documento, niente ricevuta', async () => {
  const { cliente, chiamate } = clienteRegistratore({ caricaFile: { errore: 'bucket non raggiungibile' } })
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'personale', null, 'scontrino', orologio, id)
  assert.equal(esito.ok, false)
  assert.deepEqual(chiamate.map(c => c.azione), ['caricaFile'])
})

test('caricamento foto: documento fallito → il file viene rimosso (niente orfani)', async () => {
  const { cliente, chiamate } = clienteRegistratore({ creaDocumento: { errore: 'permesso negato' } })
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'azienda', null, 'scontrino', orologio, id)
  assert.equal(esito.ok, false)
  assert.deepEqual(chiamate.map(c => c.azione), ['caricaFile', 'creaDocumento', 'rimuoviFile'])
})

test('caricamento foto: ricevuta fallita → file rimosso, errore SINCERO sul documento rimasto in coda', async () => {
  const { cliente, chiamate } = clienteRegistratore({ creaRicevuta: { errore: 'colonna mancante' } })
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'personale', null, 'scontrino', orologio, id)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && esito.errore.includes('SENZA foto'))
  assert.deepEqual(chiamate.map(c => c.azione), ['caricaFile', 'creaDocumento', 'creaRicevuta', 'rimuoviFile'])
})
