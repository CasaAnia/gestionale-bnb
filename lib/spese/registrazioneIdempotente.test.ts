// ============================================================================
// Test Fase 4 blocco 1 (rivisto) — registrazione idempotente con un archivio
// simulato che CONSERVA I BYTE dei file (non solo i percorsi) e lo stato tra
// i tentativi, riproducendo la semantica della RPC della 0022: manifesto
// completo e immutabile, validazioni delle pagine distinte dai doppioni,
// serializzazione dei token concorrenti, atomicità.
// Ciò che qui è dimostrato vale per la LOGICA (fedele alla 0022 salvo il
// formato esadecimale dell'impronta, che il finto non impone); la RPC vera
// va provata con la checklist in coda alla 0022, in contesto autenticato e
// in ambiente isolato, dopo autorizzazione.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  caricaConToken, codiceDaMessaggio, preparaRipresa,
  type ClienteIdempotente, type RipresaToken,
} from './registrazioneIdempotente.ts'

type Guasti = Partial<Record<
  'caricaFile' | 'ricevutaConSha' | 'ricevutaEsiste' | 'documentoConToken' | 'registra',
  string[]  // coda di guasti, consumati uno per chiamata
>>

function archivio(guasti: Guasti = {}) {
  const stato = {
    bucket: new Map<string, string>(),   // percorso → BYTE (testo del blob)
    documenti: [] as { id: string; token: string; manifesto: string; status: string }[],
    ricevute: [] as { storage_path: string; document_id: string; sha: string; page_order: number }[],
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
    async caricaFile(percorso, file) {
      if (guasto('caricaFile') === 'rete') throw new Error('Failed to fetch')
      // MAI sovrascrivere: i byte presenti sono immutabili
      if (stato.bucket.has(percorso)) return { esisteGia: true }
      stato.bucket.set(percorso, await (file as Blob).text())
      return {}
    },
    async rimuoviFile(percorso) { stato.bucket.delete(percorso); return {} },
    async ricevutaConSha(sha) {
      if (guasto('ricevutaConSha') === 'rete') throw new Error('Failed to fetch')
      return { esiste: stato.ricevute.some(r => r.sha === sha) }
    },
    async ricevutaEsiste(percorso) {
      const g = guasto('ricevutaEsiste')
      if (g === 'rete') return { errore: 'Failed to fetch' }
      return { esiste: stato.ricevute.some(r => r.storage_path === percorso) }
    },
    async documentoConToken(token) {
      if (guasto('documentoConToken') === 'rete') return { errore: 'Failed to fetch' }
      const doc = stato.documenti.find(d => d.token === token)
      return doc ? { documentId: doc.id } : {}
    },
    registraDocumento: (token, kind, ambito, nota, pagine) => inFila(async () => {
      const g = guasto('registra')
      if (g === 'rete-prima') throw new Error('Failed to fetch')   // MAI arrivata
      // validazioni della RICHIESTA (mai spacciate per doppioni)
      for (const p of pagine) {
        if (!p.storage_path) return { errore: 'PAGINE_MALFORMATE', codice: 'richiesta_non_valida' as const }
        if (!p.storage_path.includes(token)) return { errore: 'PERCORSO_NON_COERENTE', codice: 'richiesta_non_valida' as const }
        if (!p.file_sha256) return { errore: 'IMPRONTA_MANCANTE', codice: 'richiesta_non_valida' as const }
      }
      const ordini = pagine.map(p => p.page_order), percorsi = pagine.map(p => p.storage_path)
      if (new Set(ordini).size !== ordini.length || new Set(percorsi).size !== percorsi.length)
        return { errore: 'PAGINE_MALFORMATE', codice: 'richiesta_non_valida' as const }
      // MANIFESTO completo e normalizzato: il metro dell'idempotenza
      const manifesto = JSON.stringify({
        kind, ambito, nota: nota?.trim() || null,
        pagine: [...pagine].sort((a, b) => a.page_order - b.page_order)
          .map(p => [p.storage_path, p.page_order, p.mime_type, p.file_sha256]),
      })
      const doc = stato.documenti.find(d => d.token === token)
      if (doc) {
        if (doc.manifesto !== manifesto) return { errore: 'TOKEN_RIUSATO', codice: 'token_riusato' as const }
        return { documentId: doc.id, ripetuta: true }
      }
      // ATOMICITÀ: tutto validato prima di scrivere, o niente (= rollback)
      for (const p of pagine)
        if (stato.ricevute.some(r => r.sha === p.file_sha256))
          return { errore: 'GIA_IN_ARCHIVIO', codice: 'gia_in_archivio' as const }
      if (g === 'errore-interno')
        return { errore: 'RICHIESTA_NON_VALIDA (vincolo finto)', codice: 'richiesta_non_valida' as const }
      const id = `doc-${stato.documenti.length + 1}`
      stato.documenti.push({ id, token, manifesto, status: 'da_elaborare' })
      for (const p of pagine)
        stato.ricevute.push({ storage_path: p.storage_path, document_id: id, sha: p.file_sha256, page_order: p.page_order })
      // registrazione RIUSCITA ma risposta persa per strada
      if (g === 'risposta-persa') throw new Error('Failed to fetch')
      return { documentId: id, ripetuta: false }
    }),
  }
  return { cliente, stato }
}

// impronta finta ma DERIVATA DAI BYTE: contenuto diverso → impronta diversa
const hash = async (b: Blob) => 'sha-' + await b.text()
const hashRotto = async () => null
const blob = (contenuto: string) => new Blob([contenuto])
const foto = (contenuto: string, nome = 'scontrino.jpg') =>
  ({ nomeFile: nome, tipo: 'image/jpeg', contenuto: blob(contenuto), sha256: null })
const orologio = () => '2026-08-30T10:00:00.000Z'
let n = 0
const id = () => `tok-${++n}`
// l'inizializzazione NORMALE della ripresa, come la farà il foglio
const prepara = async (contenuto: string) => {
  const p = await preparaRipresa(foto(contenuto), orologio, id, hash)
  assert.ok(p.ok)
  return (p as { ok: true; ripresa: RipresaToken }).ripresa
}
const carica = (a: ReturnType<typeof archivio>, contenuto: string, ripresa: RipresaToken) =>
  caricaConToken(a.cliente, foto(contenuto), 'personale', 'nota', ripresa, hash)

test('la ripresa fissa TUTTO prima di ogni effetto: percorso derivato dal token, impronta dai byte', async () => {
  const r = await prepara('x')
  assert.equal(r.sha256, 'sha-x')
  assert.ok(r.percorso.includes(r.token))              // proprietà verificabile
  assert.equal(r.percorso, `2026-08-30/${r.token}.jpg`)
})

test('risposta persa DOPO la registrazione riuscita: il ritentativo recupera SENZA riscaricare né toccare i byte', async () => {
  const a = archivio({ registra: ['risposta-persa'] })
  const r = await prepara('x')
  const t1 = await carica(a, 'x', r)
  assert.ok(!t1.ok && t1.riprovabile && t1.errore.includes('esito sconosciuto'))
  const t2 = await carica(a, 'x', r)
  assert.ok(t2.ok && t2.ripetuta)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // i BYTE sono quelli originali
})

test('CONTENUTO CAMBIATO nel ritentativo: fermato PRIMA di ogni effetto, i byte collegati restano intatti', async () => {
  // registrazione riuscita ma risposta persa; poi si ripresenta lo stesso
  // token/percorso con un blob DIVERSO (il caso riprodotto dalla revisione)
  const a = archivio({ registra: ['risposta-persa'] })
  const r = await prepara('x')
  await carica(a, 'x', r)
  const t2 = await carica(a, 'CONTENUTO DIVERSO', r)
  assert.ok(!t2.ok && !t2.riprovabile && t2.errore.includes('NON corrisponde'))
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // PRIMA: upsert li sovrascriveva
  assert.equal(a.stato.documenti.length, 1)            // e la registrazione resta quella vera
})

test('PERCORSO GIÀ COLLEGATO con token nuovo: la pulizia VERIFICA e non cancella l\'allegato esistente', async () => {
  const a = archivio()
  a.stato.documenti.push({ id: 'doc-x', token: 'tok-x', manifesto: 'm', status: 'da_elaborare' })
  a.stato.ricevute.push({ storage_path: 'p/tok-x.jpg', document_id: 'doc-x', sha: 'sha-x', page_order: 1 })
  a.stato.bucket.set('p/tok-x.jpg', 'x')
  // una ripresa corrotta/ricostruita male: token NUOVO ma percorso ALTRUI
  const corrotta: RipresaToken = { token: id(), sha256: 'sha-x', percorso: 'p/tok-x.jpg', mime: 'image/jpeg', kind: 'scontrino' }
  const t = await carica(a, 'x', corrotta)
  assert.ok(!t.ok && t.duplicato)
  assert.ok(t.errore.includes('COLLEGATO'))            // verificato, non dedotto
  assert.equal(a.stato.bucket.get('p/tok-x.jpg'), 'x') // l'allegato esistente NON è stato cancellato
  // stessa tenuta se la scorciatoia sha è giù e decide la RPC
  const b = archivio({ ricevutaConSha: ['rete'] })
  b.stato.documenti.push({ id: 'doc-x', token: 'tok-x', manifesto: 'm', status: 'da_elaborare' })
  b.stato.ricevute.push({ storage_path: 'p/tok-x.jpg', document_id: 'doc-x', sha: 'sha-x', page_order: 1 })
  b.stato.bucket.set('p/tok-x.jpg', 'x')
  const t2 = await carica(b, 'x', { ...corrotta, token: id(), percorso: 'p/tok-x.jpg' })
  assert.ok(!t2.ok)
  assert.equal(b.stato.bucket.get('p/tok-x.jpg'), 'x') // né sovrascritto (upload senza upsert) né cancellato
})

test('verifica di pulizia INCERTA dopo GIA_IN_ARCHIVIO: la copia si conserva e lo si dice', async () => {
  const a = archivio({ ricevutaConSha: ['rete'], ricevutaEsiste: ['rete'] })
  a.stato.documenti.push({ id: 'doc-x', token: 'tok-x', manifesto: 'm', status: 'da_elaborare' })
  a.stato.ricevute.push({ storage_path: 'p/tok-x.jpg', document_id: 'doc-x', sha: 'sha-x', page_order: 1 })
  const r = await prepara('x')                         // sha-x = doppione vero
  const t = await carica(a, 'x', r)
  assert.ok(!t.ok && t.duplicato && t.errore.includes('resta nel bucket'))
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // conservata, non cancellata alla cieca
  assert.equal(a.stato.documenti.length, 1)            // e nessun documento vuoto (atomicità RPC)
})

test('IMPRONTA NON DISPONIBILE: errore recuperabile PRIMA di caricare, mai un giro senza hash', async () => {
  const p = await preparaRipresa(foto('x'), orologio, id, hashRotto)
  assert.ok(!p.ok && p.riprovabile && p.errore.includes('impronta'))
  // e anche al ritentativo: se l'impronta non si ricalcola non si tocca nulla
  const a = archivio()
  const r = await prepara('x')
  const t = await caricaConToken(a.cliente, foto('x'), 'personale', 'nota', r, hashRotto)
  assert.ok(!t.ok && t.riprovabile)
  assert.equal(a.stato.bucket.size, 0)                 // nessun effetto esterno
})

test('RICARICAMENTO della pagina (ripresa persa): nessun doppione in ogni caso', async () => {
  // caso A: la registrazione era PASSATA → riselezione dello stesso file con
  // ripresa NUOVA: il doppione viene fermato senza secondi documenti
  const a = archivio({ registra: ['risposta-persa'] })
  await carica(a, 'x', await prepara('x'))
  const dopoA = await carica(a, 'x', await prepara('x'))
  assert.ok(!dopoA.ok && dopoA.duplicato)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  // caso A2: anche con la scorciatoia sha GIÙ decide la RPC, atomicamente
  const a2 = archivio({ registra: ['risposta-persa'], ricevutaConSha: ['ok', 'rete'] })
  const r1 = await prepara('x')
  await carica(a2, 'x', r1)
  const r2 = await prepara('x')
  const dopoA2 = await carica(a2, 'x', r2)
  assert.ok(!dopoA2.ok && dopoA2.duplicato)
  assert.equal(a2.stato.documenti.length, 1)           // NESSUN documento vuoto
  assert.equal(a2.stato.bucket.get(r1.percorso), 'x')  // l'allegato collegato è intatto
  assert.ok(!a2.stato.bucket.has(r2.percorso))         // la seconda copia (VERIFICATA slegata) è stata tolta
  // caso B: la registrazione NON era mai arrivata → si riparte pulito
  const b = archivio({ registra: ['rete-prima'] })
  const tb = await carica(b, 'x', await prepara('x'))
  assert.ok(!tb.ok && tb.riprovabile)
  assert.equal(b.stato.documenti.length, 0)
  const dopoB = await carica(b, 'x', await prepara('x'))
  assert.ok(dopoB.ok && !dopoB.ripetuta)
  assert.equal(b.stato.documenti.length, 1)
})

test('CONCORRENZA dall\'inizializzazione REALE della ripresa: stesso token → stesso percorso, un documento solo', async () => {
  const a = archivio()
  const r = await prepara('x')     // la voce in coda prepara la ripresa UNA volta
  const [t1, t2] = await Promise.all([carica(a, 'x', r), carica(a, 'x', { ...r })])
  assert.ok(t1.ok && t2.ok)
  assert.equal(t1.ok && t1.documentId, t2.ok && t2.documentId)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  assert.equal(a.stato.bucket.size, 1)                 // un percorso solo, senza iniezioni manuali
  assert.equal(a.stato.bucket.get(r.percorso), 'x')
})

test('concorrenza sullo STESSO file da due voci diverse (token diversi): uno vince, l\'altro è doppione senza orfani', async () => {
  const a = archivio({ ricevutaConSha: ['rete', 'rete'] })  // niente scorciatoia: decide la RPC
  const [r1, r2] = [await prepara('x'), await prepara('x')]
  const [t1, t2] = await Promise.all([carica(a, 'x', r1), carica(a, 'x', r2)])
  assert.equal([t1, t2].filter(t => t.ok).length, 1)
  const perso = [t1, t2].find(t => !t.ok)!
  assert.ok(!perso.ok && perso.duplicato)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.bucket.size, 1)                 // la copia del perdente, verificata slegata, è stata tolta
})

test('METADATI DIVERSI con lo stesso token: TOKEN_RIUSATO dal manifesto completo, senza effetti', async () => {
  const a = archivio({ registra: ['risposta-persa'] })
  const r = await prepara('x')
  await carica(a, 'x', r)                              // registrata, risposta persa
  // stesso token e stesse pagine, ma NOTA diversa: il replay NON deve
  // tenersi in silenzio i vecchi valori spacciando la chiamata per riuscita
  const t2 = await caricaConToken(a.cliente, foto('x'), 'personale', 'NOTA DIVERSA', r, hash)
  assert.ok(!t2.ok && !t2.riprovabile && t2.errore.includes('contenuto diverso'))
  assert.equal(a.stato.documenti.length, 1)            // nulla è cambiato…
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // …né i byte
  // e AMBITO diverso, idem
  const t3 = await caricaConToken(a.cliente, foto('x'), 'azienda', 'nota', r, hash)
  assert.ok(!t3.ok && !t3.riprovabile)
})

test('PAGINE MALFORMATE ≠ doppione: respinte come non valide, file conservato', async () => {
  // ordine doppio dentro la richiesta, direttamente sulla RPC finta
  const a = archivio()
  const r = await prepara('x')
  const diretta = await a.cliente.registraDocumento(r.token, 'scontrino', 'personale', null, [
    { storage_path: `p/${r.token}-1.jpg`, page_order: 1, mime_type: null, file_sha256: 'sha-1' },
    { storage_path: `p/${r.token}-2.jpg`, page_order: 1, mime_type: null, file_sha256: 'sha-2' },
  ])
  assert.equal(diretta.codice, 'richiesta_non_valida')
  assert.equal(a.stato.documenti.length, 0)
  // e dal client: una ripresa col percorso NON coerente (senza token) viene
  // respinta come NON VALIDA, mai come "già in archivio", e il file resta
  const b = archivio()
  const corrotta: RipresaToken = { token: id(), sha256: 'sha-x', percorso: 'p/senza-token.jpg', mime: 'image/jpeg', kind: 'scontrino' }
  const t = await carica(b, 'x', corrotta)
  assert.ok(!t.ok && !t.duplicato && !t.riprovabile && t.errore.includes('non valida'))
  assert.ok(b.stato.bucket.has('p/senza-token.jpg'))   // conservato e segnalato, non cancellato
})

test('verifica del token GIÙ al ritentativo: non si tocca nulla', async () => {
  const a = archivio({ documentoConToken: ['rete'] })
  const r = await prepara('x')
  const t = await carica(a, 'x', r)
  assert.ok(!t.ok && t.riprovabile && t.errore.includes('non tocco nulla'))
  assert.equal(a.stato.bucket.size, 0)                 // nessun upload prima della verifica
})

test('errore INTERMEDIO nella registrazione: rollback completo, né documento né ricevute, file conservato', async () => {
  const a = archivio({ registra: ['errore-interno'] })
  const r = await prepara('x')
  const t = await carica(a, 'x', r)
  assert.ok(!t.ok && !t.riprovabile)
  assert.equal(a.stato.documenti.length, 0)
  assert.equal(a.stato.ricevute.length, 0)
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // il file resta, segnalato
})

test('codiceDaMessaggio: sentinelle della RPC, richieste non valide e rete', () => {
  assert.equal(codiceDaMessaggio('P0001: GIA_IN_ARCHIVIO'), 'gia_in_archivio')
  assert.equal(codiceDaMessaggio('TOKEN_RIUSATO'), 'token_riusato')
  assert.equal(codiceDaMessaggio('NON_MEMBRO'), 'non_membro')
  assert.equal(codiceDaMessaggio('PERCORSO_NON_COERENTE'), 'richiesta_non_valida')
  assert.equal(codiceDaMessaggio('PAGINE_MALFORMATE'), 'richiesta_non_valida')
  assert.equal(codiceDaMessaggio('IMPRONTA_MANCANTE'), 'richiesta_non_valida')
  assert.equal(codiceDaMessaggio('RICHIESTA_NON_VALIDA (vincolo x)'), 'richiesta_non_valida')
  assert.equal(codiceDaMessaggio('TypeError: Failed to fetch'), 'rete')
  assert.equal(codiceDaMessaggio('permission denied'), 'altro')
})
