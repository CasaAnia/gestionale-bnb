// ============================================================================
// Test Fase 4 blocco 1 — registrazione IDEMPOTENTE con un archivio simulato
// che CONSERVA LO STATO tra i tentativi e riproduce fedelmente la semantica
// della RPC proposta nella 0022: token unico, transazione atomica (documento
// + pagine o niente), stesso token → stesso risultato, stesso token con
// contenuto diverso → respinto, chiamate concorrenti serializzate.
// Ciò che qui è dimostrato vale per la LOGICA; la RPC vera andrà provata
// con l'SQL della 0022 dopo l'applicazione (verifica manuale proposta in
// coda al file di migrazione).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  caricaConToken, codiceDaMessaggio, nuovaRipresaToken,
  type ClienteIdempotente,
} from './registrazioneIdempotente.ts'

type Guasti = Partial<Record<
  'caricaFile' | 'ricevutaConSha' | 'registra',
  string[]  // coda di guasti, consumati uno per chiamata
>>

function archivioIdempotente(guasti: Guasti = {}) {
  const stato = {
    bucket: new Set<string>(),
    documenti: [] as { id: string; upload_token: string; note: string | null; status: string }[],
    ricevute: [] as { storage_path: string; document_id: string; sha: string | null; page_order: number }[],
  }
  const guasto = (nome: keyof Guasti) => guasti[nome]?.shift()
  // il lock advisory della RPC: le chiamate si mettono in fila
  let fila: Promise<unknown> = Promise.resolve()
  const inFila = <T>(f: () => Promise<T>): Promise<T> => {
    const p = fila.then(f)
    fila = p.catch(() => {})
    return p
  }
  const cliente: ClienteIdempotente = {
    async caricaFile(percorso) {
      const g = guasto('caricaFile')
      if (g === 'rete') throw new Error('Failed to fetch')
      stato.bucket.add(percorso)
      return {}
    },
    async rimuoviFile(percorso) { stato.bucket.delete(percorso); return {} },
    async ricevutaConSha(sha) {
      const g = guasto('ricevutaConSha')
      if (g === 'rete') throw new Error('Failed to fetch')
      return { esiste: stato.ricevute.some(r => r.sha === sha) }
    },
    registraDocumento: (token, _kind, _ambito, nota, pagine) => inFila(async () => {
      const g = guasto('registra')
      if (g === 'rete-prima') throw new Error('Failed to fetch')   // MAI arrivata
      // idempotenza: token già registrato → risultato di prima
      const doc = stato.documenti.find(d => d.upload_token === token)
      if (doc) {
        const sue = stato.ricevute.filter(r => r.document_id === doc.id)
          .map(r => `${r.storage_path}|${r.page_order}|${r.sha}`).sort().join(';')
        const chieste = pagine
          .map(p => `${p.storage_path}|${p.page_order}|${p.file_sha256}`).sort().join(';')
        if (sue !== chieste) return { errore: 'TOKEN_RIUSATO', codice: 'token_riusato' as const }
        return { documentId: doc.id, ripetuta: true }
      }
      // ATOMICITÀ: si valida TUTTO prima di scrivere qualsiasi cosa
      // (equivale al rollback della transazione: o tutto o niente)
      for (const p of pagine) {
        if (!p.storage_path) return { errore: 'PAGINA_SENZA_PERCORSO', codice: 'altro' as const }
        if (p.file_sha256 != null && stato.ricevute.some(r => r.sha === p.file_sha256))
          return { errore: 'GIA_IN_ARCHIVIO', codice: 'gia_in_archivio' as const }
      }
      if (g === 'errore-interno') return { errore: 'PAGINA_SENZA_PERCORSO', codice: 'altro' as const }
      const id = `doc-${stato.documenti.length + 1}`
      stato.documenti.push({ id, upload_token: token, note: nota, status: 'da_elaborare' })
      for (const p of pagine)
        stato.ricevute.push({ storage_path: p.storage_path, document_id: id, sha: p.file_sha256, page_order: p.page_order })
      // registrazione RIUSCITA ma risposta persa per strada
      if (g === 'risposta-persa') throw new Error('Failed to fetch')
      return { documentId: id, ripetuta: false }
    }),
  }
  return { cliente, stato }
}

const FOTO = { nomeFile: 'scontrino.jpg', tipo: 'image/jpeg', contenuto: new Blob(['x']), sha256: 'sha-A' }
const orologio = () => '2026-08-30T10:00:00.000Z'
let n = 0
const id = () => `uuid-${++n}`
const carica = (a: ReturnType<typeof archivioIdempotente>, ripresa = nuovaRipresaToken(id), foto = FOTO) =>
  caricaConToken(a.cliente, foto, 'personale', 'nota', ripresa, orologio, id)

test('risposta persa DOPO la registrazione riuscita: il ritentativo con lo stesso token RECUPERA il risultato', async () => {
  const a = archivioIdempotente({ registra: ['risposta-persa'] })
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.riprovabile)
  assert.ok(!t1.ok && t1.errore.includes('esito sconosciuto'))
  assert.ok(!t1.ok && t1.ripresa.token && t1.ripresa.percorso)   // il riferimento non si perde
  const t2 = await carica(a, !t1.ok ? t1.ripresa : nuovaRipresaToken(id))
  assert.ok(t2.ok && t2.ripetuta)                                 // recuperato, non rifatto
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  assert.ok(a.stato.bucket.has(a.stato.ricevute[0].storage_path))
})

test('RICARICAMENTO della pagina (ripresa persa): nessun doppione in ogni caso', async () => {
  // caso A: il primo tentativo era PASSATO (risposta persa) → dopo il reload
  // si riseleziona lo stesso file con un token NUOVO: il controllo sha lo
  // ferma prima di caricare qualsiasi cosa
  const a = archivioIdempotente({ registra: ['risposta-persa'] })
  await carica(a)
  const dopoReloadA = await carica(a)         // token e percorso nuovi
  assert.ok(!dopoReloadA.ok && dopoReloadA.duplicato)
  assert.equal(a.stato.documenti.length, 1)   // il documento è UNO, registrato e con la sua foto
  assert.equal(a.stato.ricevute.length, 1)
  // caso A2: anche col controllo sha GIÙ, la RPC atomica respinge il
  // doppione SENZA lasciare documenti vuoti
  const a2 = archivioIdempotente({ registra: ['risposta-persa'], ricevutaConSha: ['ok', 'rete'] })
  await carica(a2)
  const dopoReloadA2 = await carica(a2)
  assert.ok(!dopoReloadA2.ok && dopoReloadA2.duplicato)
  assert.equal(a2.stato.documenti.length, 1)  // NESSUN documento vuoto in più
  assert.equal(a2.stato.ricevute.length, 1)
  assert.equal(a2.stato.bucket.size, 1)       // la seconda copia è stata tolta (accertata slegata)
  // caso B: il primo tentativo NON era mai arrivato → dopo il reload la
  // registrazione riparte pulita
  const b = archivioIdempotente({ registra: ['rete-prima'] })
  const t1 = await carica(b)
  assert.ok(!t1.ok && t1.riprovabile)
  assert.equal(b.stato.documenti.length, 0)
  const dopoReloadB = await carica(b)
  assert.ok(dopoReloadB.ok && !dopoReloadB.ripetuta)
  assert.equal(b.stato.documenti.length, 1)
})

test('controllo doppioni INDISPONIBILE + doppione vero di un ALTRO documento: rifiuto atomico, NESSUN documento vuoto, allegato altrui intatto', async () => {
  const a = archivioIdempotente({ ricevutaConSha: ['rete'] })
  a.stato.documenti.push({ id: 'doc-x', upload_token: 'tok-x', note: null, status: 'da_elaborare' })
  a.stato.ricevute.push({ storage_path: 'altro/percorso.jpg', document_id: 'doc-x', sha: 'sha-A', page_order: 1 })
  a.stato.bucket.add('altro/percorso.jpg')
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.duplicato && !t1.riprovabile)
  assert.equal(a.stato.documenti.length, 1)              // col flusso attuale qui restava un documento VUOTO
  assert.ok(a.stato.bucket.has('altro/percorso.jpg'))    // l'allegato COLLEGATO non si tocca
  assert.equal(a.stato.bucket.size, 1)                   // la nostra copia (accertata slegata) è stata tolta
})

test('due caricamenti CONCORRENTI con lo stesso token: un solo documento, entrambi con lo stesso id', async () => {
  const a = archivioIdempotente()
  // la STESSA operazione partita due volte: stesso token e stesso percorso
  // (nel foglio il percorso vive nella ripresa insieme al token)
  const ripresa = { ...nuovaRipresaToken(id), percorso: '2026-08-30/condiviso.jpg' }
  const [t1, t2] = await Promise.all([carica(a, ripresa), carica(a, { ...ripresa })])
  assert.ok(t1.ok && t2.ok)
  assert.equal(t1.ok && t1.documentId, t2.ok && t2.documentId)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal([t1, t2].filter(t => t.ok && t.ripetuta).length, 1)  // uno registra, l'altro recupera
})

test('due caricamenti concorrenti dello STESSO file con token diversi: uno vince, l\'altro è doppione senza orfani', async () => {
  const a = archivioIdempotente({ ricevutaConSha: ['rete', 'rete'] })  // niente scorciatoia: decide la RPC
  const [t1, t2] = await Promise.all([carica(a), carica(a)])
  const esiti = [t1, t2]
  assert.equal(esiti.filter(t => t.ok).length, 1)
  const perso = esiti.find(t => !t.ok)!
  assert.ok(!perso.ok && perso.duplicato)
  assert.equal(a.stato.documenti.length, 1)              // nessun documento vuoto
  assert.equal(a.stato.ricevute.length, 1)
  assert.equal(a.stato.bucket.size, 1)                   // resta solo il file del vincitore
})

test('stesso token con contenuto DIVERSO: respinto, nulla viene toccato né cancellato', async () => {
  const a = archivioIdempotente()
  const ripresa = nuovaRipresaToken(id)
  const t1 = await carica(a, ripresa)
  assert.ok(t1.ok)
  // stesso token, foto diversa (sha diverso): la RPC respinge
  const t2 = await caricaConToken(a.cliente, { ...FOTO, sha256: 'sha-B', nomeFile: 'altra.jpg' },
    'personale', 'nota', { token: ripresa.token }, orologio, id)
  assert.ok(!t2.ok && !t2.riprovabile && t2.errore.includes('contenuto diverso'))
  assert.equal(a.stato.documenti.length, 1)              // l'originale è intatto
  assert.equal(a.stato.ricevute.length, 1)
  assert.ok(a.stato.bucket.has(a.stato.ricevute[0].storage_path))  // e il SUO file non è stato cancellato
})

test('errore INTERMEDIO nella registrazione: rollback completo, né documento né ricevute', async () => {
  const a = archivioIdempotente({ registra: ['errore-interno'] })
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.riprovabile)
  assert.equal(a.stato.documenti.length, 0)
  assert.equal(a.stato.ricevute.length, 0)
  // e il ritentativo (guasto esaurito) va a buon fine con lo stesso token
  const t2 = await carica(a, !t1.ok ? t1.ripresa : nuovaRipresaToken(id))
  assert.ok(t2.ok)
  assert.equal(a.stato.documenti.length, 1)
})

test('mai cancellare allegati su esito INCERTO: file e token restano per il ritentativo', async () => {
  const a = archivioIdempotente({ registra: ['risposta-persa'] })
  const t1 = await carica(a)
  assert.ok(!t1.ok && t1.riprovabile)
  assert.equal(a.stato.bucket.size, 1)                   // il file c'è ancora
  assert.ok(a.stato.bucket.has(a.stato.ricevute[0].storage_path))  // ed è quello COLLEGATO
})

test('codiceDaMessaggio: sentinelle della RPC e errori di rete', () => {
  assert.equal(codiceDaMessaggio('P0001: GIA_IN_ARCHIVIO'), 'gia_in_archivio')
  assert.equal(codiceDaMessaggio('TOKEN_RIUSATO'), 'token_riusato')
  assert.equal(codiceDaMessaggio('NON_MEMBRO'), 'non_membro')
  assert.equal(codiceDaMessaggio('TypeError: Failed to fetch'), 'rete')
  assert.equal(codiceDaMessaggio('permission denied'), 'altro')
})
