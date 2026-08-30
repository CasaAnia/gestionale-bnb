// ============================================================================
// Test 3.2B.2 del caricamento con un cliente simulato che CONSERVA LO STATO
// tra un tentativo e l'altro: si controllano documenti, ricevute e file
// FINALI, non solo l'elenco delle chiamate. Copre la sequenza riprodotta
// dalla revisione (ricevuta inserita ma risposta persa → verifica giù →
// ritentativo) e gli altri casi: documento senza risposta, doppione senza
// documenti vuoti, identificativi mai persi, errori di rete RESTITUITI.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { caricaDocumentoConFoto, type ClienteScrittura } from './scrittura.ts'

type Guasti = Partial<Record<
  'caricaFile' | 'creaDocumento' | 'creaRicevuta' | 'ricevutaEsiste' | 'ricevutaConSha',
  string[]  // coda di guasti, consumati uno per chiamata
>>

// Un archivio finto CON MEMORIA: bucket, documenti e ricevute persistono tra
// i tentativi; i vincoli unici (sha e percorso) sono quelli veri dello schema.
function archivioConMemoria(guasti: Guasti = {}) {
  const stato = {
    bucket: new Set<string>(),
    documenti: [] as { id: string; note: unknown }[],
    ricevute: [] as { storage_path: string; document_id: string; sha: unknown; note: unknown }[],
  }
  const guasto = (nome: keyof Guasti) => guasti[nome]?.shift()
  const cliente: ClienteScrittura = {
    inserisciSpesa: async () => ({}),
    eliminaSpesa: async () => ({ righe: 1 }),
    salvaBudget: async () => ({}),
    aggiornaBudget: async () => ({ righe: 1 }),
    eliminaBudget: async () => ({ righe: 1 }),
    async caricaFile(percorso) {
      const g = guasto('caricaFile')
      if (g === 'rete') throw new Error('Failed to fetch')
      if (g === 'rifiuto') return { errore: 'bucket giù' }
      stato.bucket.add(percorso)
      return {}
    },
    async rimuoviFile(percorso) { stato.bucket.delete(percorso); return {} },
    async creaDocumento(p) {
      const g = guasto('creaDocumento')
      if (g === 'rete-prima') throw new Error('Failed to fetch')
      if (g === 'rifiuto') return { errore: 'vietato dalla policy' }
      const id = `doc-${stato.documenti.length + 1}`
      stato.documenti.push({ id, note: p.note })
      // il caso maledetto: l'INSERT è PASSATO ma la risposta si è persa
      if (g === 'risposta-persa') throw new Error('Failed to fetch')
      if (g === 'rete-restituita') return { errore: 'TypeError: Failed to fetch' }
      return { id }
    },
    async creaRicevuta(p) {
      const g = guasto('creaRicevuta')
      if (g === 'rete-prima') throw new Error('Failed to fetch')
      // vincoli unici VERI: stessa impronta o stesso percorso
      if (p.file_sha256 != null && stato.ricevute.some(r => r.sha === p.file_sha256))
        return { errore: 'duplicate key value violates unique constraint "family_receipts_file_sha256_key"' }
      if (stato.ricevute.some(r => r.storage_path === p.storage_path))
        return { errore: 'duplicate key value violates unique constraint "family_receipts_storage_path_key"' }
      stato.ricevute.push({
        storage_path: p.storage_path as string, document_id: p.document_id as string,
        sha: p.file_sha256, note: p.note,
      })
      if (g === 'risposta-persa') throw new Error('Failed to fetch')
      if (g === 'rete-restituita') return { errore: 'network error while fetching' }
      return {}
    },
    async ricevutaEsiste(percorso) {
      const g = guasto('ricevutaEsiste')
      if (g === 'rete') throw new Error('Failed to fetch')
      if (g === 'rete-restituita') return { errore: 'Failed to fetch' }
      return { esiste: stato.ricevute.some(r => r.storage_path === percorso) }
    },
    async ricevutaConSha(sha) {
      const g = guasto('ricevutaConSha')
      if (g === 'rete') throw new Error('Failed to fetch')
      return { esiste: stato.ricevute.some(r => r.sha === sha) }
    },
  }
  return { cliente, stato }
}

const FOTO = { nomeFile: 'scontrino.jpg', tipo: 'image/jpeg', contenuto: new Blob(['x']), sha256: 'sha-A' }
const orologio = () => '2026-08-30T10:00:00.000Z'
let n = 0
const id = () => `uuid-${++n}`
const carica = (a: ReturnType<typeof archivioConMemoria>, ripresa = {}, foto = FOTO) =>
  caricaDocumentoConFoto(a.cliente, foto, 'personale', 'nota', ripresa, orologio, id)

test('LA SEQUENZA DELLA REVISIONE: ricevuta inserita ma risposta persa, verifica giù, ritentativo — la ricevuta NON perde mai il suo file', async () => {
  const a = archivioConMemoria({ creaRicevuta: ['risposta-persa'], ricevutaEsiste: ['rete', 'rete'] })
  // tentativo 1: l'INSERT passa, la risposta si perde, la verifica è giù
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.riprovabile && t1.ripresa.percorso && t1.ripresa.documentId)
  assert.equal(a.stato.ricevute.length, 1)             // la ricevuta ESISTE (a nostra insaputa)
  assert.ok(a.stato.bucket.has(t1.ok ? '' : t1.ripresa.percorso!))
  // tentativo 2: la verifica è ANCORA giù → non si tocca NULLA
  const t2 = await carica(a, !t1.ok ? t1.ripresa : {})
  assert.ok(!t2.ok && t2.riprovabile)
  assert.ok(!t2.ok && t2.errore.includes('non ho toccato nulla'))
  assert.equal(a.stato.documenti.length, 1)            // nessun secondo documento
  assert.equal(a.stato.ricevute.length, 1)             // nessun secondo INSERT tentato
  assert.ok(a.stato.bucket.has(a.stato.ricevute[0].storage_path))  // file MAI cancellato
  // tentativo 3: la rete torna → la verifica trova la ricevuta → successo
  const t3 = await carica(a, !t2.ok ? t2.ripresa : {})
  assert.ok(t3.ok)
  // stato FINALE: un file, un documento, una ricevuta, collegati tra loro
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  assert.equal(a.stato.ricevute[0].document_id, a.stato.documenti[0].id)
  assert.ok(a.stato.bucket.has(a.stato.ricevute[0].storage_path))
})

test('errore di rete RESTITUITO (non lanciato) sulla ricevuta: si verifica, si scopre che era passata, nessun doppione', async () => {
  const a = archivioConMemoria({ creaRicevuta: ['rete-restituita'] })
  const t1 = await carica(a)
  assert.ok(t1.ok)                                     // la verifica ha trovato la ricevuta
  assert.equal(a.stato.ricevute.length, 1)
  assert.ok(a.stato.bucket.has(a.stato.ricevute[0].storage_path))
})

test('documento creato ma risposta persa: SOSPESO, niente ritentativi alla cieca (sarebbe un secondo documento)', async () => {
  const a = archivioConMemoria({ creaDocumento: ['risposta-persa'] })
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.sospeso && !t1.riprovabile)
  assert.equal(a.stato.documenti.length, 1)            // l'orfano c'è, e lo si DICE
  assert.equal(a.stato.ricevute.length, 0)
  // stesso comportamento con l'errore di rete RESTITUITO dalla libreria
  const b = archivioConMemoria({ creaDocumento: ['rete-restituita'] })
  const t2 = await carica(b)
  assert.ok(!t2.ok && t2.sospeso && !t2.riprovabile)
  assert.equal(b.stato.documenti.length, 1)
})

test('foto già in archivio: rifiuto PRIMA di creare qualsiasi cosa (niente documenti vuoti, niente file)', async () => {
  const a = archivioConMemoria()
  a.stato.ricevute.push({ storage_path: 'altro/percorso.jpg', document_id: 'doc-x', sha: 'sha-A', note: null })
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.duplicato && !t1.riprovabile)
  assert.equal(a.stato.documenti.length, 0)            // PRIMA veniva creato un documento vuoto
  assert.equal(a.stato.bucket.size, 0)                 // e caricato un file inutile
})

test('doppione scoperto solo dal vincolo (controllo sha giù al primo giro): si cancella SOLO dopo aver accertato che il percorso non è collegato', async () => {
  const a = archivioConMemoria({ ricevutaConSha: ['rete'] })
  a.stato.ricevute.push({ storage_path: 'altro/percorso.jpg', document_id: 'doc-x', sha: 'sha-A', note: null })
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.duplicato && !t1.riprovabile)
  assert.ok(!t1.ok && t1.errore.includes('resta in coda vuoto'))  // onestà sul documento creato
  assert.equal(a.stato.ricevute.length, 1)             // la ricevuta dell'ALTRO resta intatta
  assert.equal(a.stato.bucket.size, 0)                 // la NOSTRA copia (accertata slegata) è stata tolta
})

test('vincolo unico ma la verifica è giù: NON si cancella e NON si decide (regex da sola non basta)', async () => {
  const a = archivioConMemoria({ ricevutaConSha: ['rete'], ricevutaEsiste: ['rete'] })
  a.stato.ricevute.push({ storage_path: 'altro/percorso.jpg', document_id: 'doc-x', sha: 'sha-A', note: null })
  const t1 = await carica(a)
  assert.ok(!t1.ok && !t1.duplicato && t1.riprovabile) // esito incerto, non "doppione"
  assert.equal(a.stato.bucket.size, 1)                 // il file NON è stato cancellato
  assert.ok(!t1.ok && t1.ripresa.percorso && t1.ripresa.documentId)  // identificativi conservati
})

test('ripresa con documentId noto + upload fallito: il documentId NON si perde', async () => {
  const a = archivioConMemoria({ ricevutaEsiste: [], caricaFile: ['rifiuto'] })
  const t1 = await carica(a, { percorso: '2026-08-30/gia-mio.jpg', documentId: 'doc-gia-creato' })
  assert.ok(!t1.ok && t1.riprovabile)
  assert.deepEqual(!t1.ok && t1.ripresa, { percorso: '2026-08-30/gia-mio.jpg', documentId: 'doc-gia-creato' })
})

test('la nota resta coerente tra documento e ricevuta anche nel ritentativo', async () => {
  const a = archivioConMemoria({ creaRicevuta: ['rete-prima'] })
  const t1 = await caricaDocumentoConFoto(a.cliente, FOTO, 'personale', 'metà è di Casa Ania', {}, orologio, id)
  assert.ok(!t1.ok && t1.riprovabile)
  const t2 = await caricaDocumentoConFoto(a.cliente, FOTO, 'personale', 'metà è di Casa Ania', !t1.ok ? t1.ripresa : {}, orologio, id)
  assert.ok(t2.ok)
  assert.equal(a.stato.documenti[0].note, 'metà è di Casa Ania')
  assert.equal(a.stato.ricevute[0].note, 'metà è di Casa Ania')
  assert.equal(a.stato.documenti.length, 1)
})
