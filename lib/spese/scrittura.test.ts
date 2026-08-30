// Test delle SCRITTURE (3.2B → 3.2B.1) con cliente FINTO: nessuna
// connessione, nessuna scrittura vera. Copre importi rigorosi, errori
// RESTITUITI oltre alle eccezioni, righe toccate, doppio invio e il
// caricamento foto RECUPERABILE (riuso di file e documento, esiti incerti
// verificati, duplicati, pulizia che fallisce).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  aggiornaBudgetEsistente, caricaDocumentoConFoto, creaGuardiaInvio,
  eliminaBudgetEsistente, eliminaSpesaManuale, importoDaTesto, salvaBudgetNuovo,
  salvaSpesaManuale, testoDaImporto, tipoDocumentoDaFile, validaSpesaManuale,
  SPESA_MANUALE_VUOTA, type ClienteScrittura, type SpesaManualeInput,
} from './scrittura.ts'

const input = (extra: Partial<SpesaManualeInput> = {}): SpesaManualeInput => ({
  ...SPESA_MANUALE_VUOTA('2026-08-30'),
  importo: '12,50', group_id: 'g-casa', ...extra,
})

type Risposte = {
  [K in keyof ClienteScrittura]?: Awaited<ReturnType<ClienteScrittura[K]>> | (() => never)
}
function clienteRegistratore(risposte: Risposte = {}) {
  const chiamate: { azione: string; payload?: unknown }[] = []
  const esegui = <K extends keyof ClienteScrittura>(k: K, fallback: unknown) => {
    const r = risposte[k]
    if (typeof r === 'function') (r as () => never)()
    return (r ?? fallback) as never
  }
  const cliente: ClienteScrittura = {
    async inserisciSpesa(payload) { chiamate.push({ azione: 'inserisciSpesa', payload }); return esegui('inserisciSpesa', {}) },
    async eliminaSpesa(id) { chiamate.push({ azione: 'eliminaSpesa', payload: id }); return esegui('eliminaSpesa', { righe: 1 }) },
    async caricaFile(percorso) { chiamate.push({ azione: 'caricaFile', payload: percorso }); return esegui('caricaFile', {}) },
    async rimuoviFile(percorso) { chiamate.push({ azione: 'rimuoviFile', payload: percorso }); return esegui('rimuoviFile', {}) },
    async creaDocumento(payload) { chiamate.push({ azione: 'creaDocumento', payload }); return esegui('creaDocumento', { id: 'doc-1' }) },
    async creaRicevuta(payload) { chiamate.push({ azione: 'creaRicevuta', payload }); return esegui('creaRicevuta', {}) },
    async ricevutaEsiste(percorso) { chiamate.push({ azione: 'ricevutaEsiste', payload: percorso }); return esegui('ricevutaEsiste', { esiste: false }) },
    async ricevutaConSha(sha) { chiamate.push({ azione: 'ricevutaConSha', payload: sha }); return esegui('ricevutaConSha', { esiste: false }) },
    async salvaBudget(...a) { chiamate.push({ azione: 'salvaBudget', payload: a }); return esegui('salvaBudget', {}) },
    async aggiornaBudget(...a) { chiamate.push({ azione: 'aggiornaBudget', payload: a }); return esegui('aggiornaBudget', { righe: 1 }) },
    async eliminaBudget(id) { chiamate.push({ azione: 'eliminaBudget', payload: id }); return esegui('eliminaBudget', { righe: 1 }) },
  }
  return { cliente, chiamate }
}
const esplode = () => { throw new Error('rete caduta') }

// ---- importi: grammatica rigorosa ----------------------------------------
test('importoDaTesto: virgola, punto decimale e punti delle migliaia', () => {
  assert.equal(importoDaTesto('12,50'), 12.5)
  assert.equal(importoDaTesto('12.50'), 12.5)        // PRIMA diventava 1250!
  assert.equal(importoDaTesto('12.5'), 12.5)
  assert.equal(importoDaTesto('1.250,00'), 1250)
  assert.equal(importoDaTesto('1.250'), 1250)        // punto + 3 cifre = migliaia
  assert.equal(importoDaTesto('12'), 12)
  assert.equal(importoDaTesto(' 8,9 '), 8.9)
})
test('importoDaTesto: rifiuta testo spurio, zero e precisione non ammessa', () => {
  assert.equal(importoDaTesto('12abc'), null)        // PRIMA passava!
  assert.equal(importoDaTesto('0'), null)
  assert.equal(importoDaTesto('0,00'), null)
  assert.equal(importoDaTesto('0,001'), null)        // PRIMA diventava zero
  assert.equal(importoDaTesto('12,345'), null)
  assert.equal(importoDaTesto('-5'), null)
  assert.equal(importoDaTesto('1.25.0'), null)
  assert.equal(importoDaTesto(''), null)
})
test('budget decimale: letto, mostrato e risalvato INVARIATO', () => {
  // il database dice 12.5 → il campo mostra "12,50" → risalvato vale 12,50
  assert.equal(testoDaImporto(12.5), '12,50')        // PRIMA String() dava "12.5" → 1250
  assert.equal(importoDaTesto(testoDaImporto(12.5)), 12.5)
  assert.equal(testoDaImporto(220), '220')
  assert.equal(importoDaTesto(testoDaImporto(220)), 220)
  assert.equal(testoDaImporto(1250.05), '1250,05')
  assert.equal(importoDaTesto(testoDaImporto(1250.05)), 1250.05)
})

// ---- doppio invio ---------------------------------------------------------
test('guardia invio: mentre una richiesta è in corso, la seconda NON parte', async () => {
  const guardia = creaGuardiaInvio()
  let inCorso = 0, massimo = 0, eseguite = 0
  const lenta = () => guardia(async () => {
    inCorso++; massimo = Math.max(massimo, inCorso); eseguite++
    await new Promise(r => setTimeout(r, 30))
    inCorso--
    return 'fatto'
  })
  const [a, b] = await Promise.all([lenta(), lenta()])
  assert.equal(massimo, 1)
  assert.equal(eseguite, 1)
  assert.deepEqual([a, b].sort(), ['fatto', null].sort())
  // e dopo, si può inviare di nuovo
  assert.equal(await lenta(), 'fatto')
})

// ---- validazione e salvataggio manuale ------------------------------------
test('validazione: metodo di pagamento OBBLIGATORIO per Casa Ania', () => {
  assert.deepEqual(validaSpesaManuale(input({ group_id: 'g-bnb' }), 'azienda'),
    ['per Casa Ania il metodo di pagamento è obbligatorio'])
  assert.deepEqual(validaSpesaManuale(input(), 'personale'), [])
})
test('salvataggio manuale: successo con payload giusto; errore mai mascherato', async () => {
  const { cliente, chiamate } = clienteRegistratore()
  const ok = await salvaSpesaManuale(cliente, input({ expense_nature: 'ricorrente' }), 'personale')
  assert.deepEqual(ok, { ok: true })
  const payload = chiamate[0].payload as Record<string, unknown>
  assert.equal(payload.amount, 12.5)
  assert.equal(payload.expense_nature, 'ricorrente')
  assert.ok(!('recurring' in payload))
  const { cliente: rotto } = clienteRegistratore({ inserisciSpesa: { errore: 'rifiutato' } })
  assert.deepEqual(await salvaSpesaManuale(rotto, input(), 'personale'), { ok: false, errore: 'rifiutato' })
  const { cliente: cade } = clienteRegistratore({ inserisciSpesa: esplode })
  assert.equal((await salvaSpesaManuale(cade, input(), 'personale')).ok, false)
})

// ---- eliminazione: errori restituiti E righe toccate ----------------------
test('elimina spesa manuale: error restituito, eccezione e ZERO righe non sono successi', async () => {
  const { cliente } = clienteRegistratore()
  assert.deepEqual(await eliminaSpesaManuale(cliente, 's1'), { ok: true })
  const { cliente: rifiuta } = clienteRegistratore({ eliminaSpesa: { errore: 'vietato dal database' } })
  assert.deepEqual(await eliminaSpesaManuale(rifiuta, 's1'), { ok: false, errore: 'vietato dal database' })
  const { cliente: zero } = clienteRegistratore({ eliminaSpesa: { righe: 0 } })
  const esito = await eliminaSpesaManuale(zero, 's1')
  assert.equal(esito.ok, false)               // PRIMA: successo simulato
  const { cliente: cade } = clienteRegistratore({ eliminaSpesa: esplode })
  assert.equal((await eliminaSpesaManuale(cade, 's1')).ok, false)
})

// ---- budget: creazione, modifica, eliminazione ----------------------------
test('budget: errori restituiti, eccezioni e righe toccate su tutte e tre le operazioni', async () => {
  const { cliente } = clienteRegistratore()
  assert.deepEqual(await salvaBudgetNuovo(cliente, 'personale', 'Spesa alimentare', 450), { ok: true })
  assert.deepEqual(await aggiornaBudgetEsistente(cliente, 'b1', 300), { ok: true })
  assert.deepEqual(await eliminaBudgetEsistente(cliente, 'b1'), { ok: true })
  const { cliente: rifiuta } = clienteRegistratore({
    salvaBudget: { errore: 'no' }, aggiornaBudget: { errore: 'no' }, eliminaBudget: { errore: 'no' },
  })
  assert.equal((await salvaBudgetNuovo(rifiuta, 'personale', 'X', 1)).ok, false)   // PRIMA: legacy ignorava error
  assert.equal((await aggiornaBudgetEsistente(rifiuta, 'b1', 1)).ok, false)
  assert.equal((await eliminaBudgetEsistente(rifiuta, 'b1')).ok, false)
  const { cliente: zero } = clienteRegistratore({ aggiornaBudget: { righe: 0 }, eliminaBudget: { righe: 0 } })
  assert.equal((await aggiornaBudgetEsistente(zero, 'b1', 1)).ok, false)
  assert.equal((await eliminaBudgetEsistente(zero, 'b1')).ok, false)
  const { cliente: cade } = clienteRegistratore({ salvaBudget: esplode })
  assert.equal((await salvaBudgetNuovo(cade, 'personale', 'X', 1)).ok, false)
})

// ---- caricamento foto RECUPERABILE ----------------------------------------
const FOTO = { nomeFile: 'scontrino.jpg', tipo: 'image/jpeg', contenuto: new Blob(['x']), sha256: 'abc' }
const orologio = () => '2026-08-30T10:00:00.000Z'
const id = () => 'uuid-fisso'

test('tipo documento dal FILE, non dai formati consentiti', () => {
  assert.equal(tipoDocumentoDaFile('image/jpeg'), 'scontrino')
  assert.equal(tipoDocumentoDaFile('application/pdf'), 'altro')
})

test('caricamento: successo → file, documento, ricevuta collegata coi campi legacy', async () => {
  const { cliente, chiamate } = clienteRegistratore()
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'personale', 'nota', {}, orologio, id)
  assert.deepEqual(esito, { ok: true, documentId: 'doc-1' })
  // al primo tentativo si controlla il DOPPIONE prima di creare qualsiasi cosa
  assert.deepEqual(chiamate.map(c => c.azione), ['ricevutaConSha', 'caricaFile', 'creaDocumento', 'creaRicevuta'])
  const ric = chiamate[3].payload as Record<string, unknown>
  assert.equal(ric.storage_path, '2026-08-30/uuid-fisso.jpg')
  assert.equal(ric.status, 'da_leggere')
})

test('ricevuta rifiutata (non doppione) → si RIPROVA con lo stesso file e documento: MAI un secondo documento', async () => {
  const { cliente, chiamate } = clienteRegistratore({ creaRicevuta: { errore: 'vietato dalla policy' } })
  const primo = await caricaDocumentoConFoto(cliente, FOTO, 'personale', null, {}, orologio, id)
  assert.equal(primo.ok, false)
  assert.ok(!primo.ok && primo.riprovabile)
  assert.deepEqual(!primo.ok && primo.ripresa, { percorso: '2026-08-30/uuid-fisso.jpg', documentId: 'doc-1' })
  // il file NON è stato cancellato (si riusa)
  assert.ok(!chiamate.some(c => c.azione === 'rimuoviFile'))
  // secondo tentativo con la ripresa: prima si VERIFICA il tentativo
  // precedente, poi si prosegue senza un nuovo documento
  const { cliente: buono, chiamate: chiamate2 } = clienteRegistratore()
  const secondo = await caricaDocumentoConFoto(buono, FOTO, 'personale', null, !primo.ok ? primo.ripresa : {}, orologio, id)
  assert.deepEqual(secondo, { ok: true, documentId: 'doc-1' })
  assert.deepEqual(chiamate2.map(c => c.azione), ['ricevutaEsiste', 'caricaFile', 'creaRicevuta'])  // niente creaDocumento
})

test('foto GIÀ in archivio (doppione sha): rifiuto definitivo, copia rimossa, non riprovabile', async () => {
  const { cliente, chiamate } = clienteRegistratore({ creaRicevuta: { errore: 'duplicate key family_receipts_sha_uq' } })
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'personale', null, {}, orologio, id)
  assert.equal(esito.ok, false)
  assert.ok(!esito.ok && !esito.riprovabile && esito.errore.includes('già in archivio'))
  assert.ok(chiamate.some(c => c.azione === 'rimuoviFile'))
})

test('doppione + pulizia che fallisce: lo dice, senza fingere', async () => {
  const { cliente } = clienteRegistratore({
    creaRicevuta: { errore: 'duplicate sha' }, rimuoviFile: { errore: 'permesso negato' },
  })
  const esito = await caricaDocumentoConFoto(cliente, FOTO, 'personale', null, {}, orologio, id)
  assert.ok(!esito.ok && esito.errore.includes('non è stata rimossa'))
})

test('esito INCERTO (eccezione sulla ricevuta): si VERIFICA prima di cancellare o ripetere', async () => {
  // caso 1: la verifica dice che la ricevuta ESISTE → è un successo
  const { cliente: passata, chiamate } = clienteRegistratore({ creaRicevuta: esplode, ricevutaEsiste: { esiste: true } })
  const ok = await caricaDocumentoConFoto(passata, FOTO, 'personale', null, {}, orologio, id)
  assert.deepEqual(ok, { ok: true, documentId: 'doc-1' })
  assert.ok(!chiamate.some(c => c.azione === 'rimuoviFile'))  // MAI cancellare un allegato forse collegato
  // caso 2: la verifica dice che NON esiste → riprovabile, tutto conservato
  const { cliente: caduta } = clienteRegistratore({ creaRicevuta: esplode, ricevutaEsiste: { esiste: false } })
  const gi = await caricaDocumentoConFoto(caduta, FOTO, 'personale', null, {}, orologio, id)
  assert.ok(!gi.ok && gi.riprovabile && gi.ripresa.documentId === 'doc-1' && gi.ripresa.percorso)
})

test('upload o documento falliti/interrotti: riprovabile, con lo stato conservato', async () => {
  const { cliente: su } = clienteRegistratore({ caricaFile: { errore: 'bucket giù' } })
  const e1 = await caricaDocumentoConFoto(su, FOTO, 'personale', null, {}, orologio, id)
  assert.ok(!e1.ok && e1.riprovabile && e1.ripresa.percorso)
  // documento dall'esito incerto: NON c'è un identificativo recuperabile →
  // l'operazione resta SOSPESA (niente ritentativi alla cieca = doppioni)
  const { cliente: doc } = clienteRegistratore({ creaDocumento: esplode })
  const e2 = await caricaDocumentoConFoto(doc, FOTO, 'personale', null, {}, orologio, id)
  assert.ok(!e2.ok && e2.sospeso && !e2.riprovabile && e2.ripresa.percorso && !e2.ripresa.documentId)
  // rifiuto NETTO (non di rete) del documento: quello sì è riprovabile
  const { cliente: no } = clienteRegistratore({ creaDocumento: { errore: 'vietato dalla policy' } })
  const e3 = await caricaDocumentoConFoto(no, FOTO, 'personale', null, {}, orologio, id)
  assert.ok(!e3.ok && !e3.sospeso && e3.riprovabile && e3.ripresa.percorso)
})
