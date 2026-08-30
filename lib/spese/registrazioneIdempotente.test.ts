// ============================================================================
// Test Fase 4 blocco 1 (seconda revisione) — registrazione idempotente con
// un archivio simulato che CONSERVA I BYTE e lo stato tra i tentativi.
// UUID e SHA-256 VERI (crypto.randomUUID + crypto.subtle); si verificano
// byte, impronte, documenti, ricevute e file ORFANI finali, non solo i
// conteggi. La semantica della RPC è riprodotta fedelmente (manifesto,
// formato preciso dei percorsi, impronte 64-hex, serializzazione).
// Ciò che qui è dimostrato vale per la LOGICA; la RPC vera va provata con
// la checklist della 0022, dopo autorizzazione, in ambiente isolato.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  caricaConToken, codiceDaMessaggio, percorsoOperazione, percorsoValido,
  preparaRipresa, type ClienteIdempotente, type RipresaToken,
} from './registrazioneIdempotente.ts'
import { creaControllore, depositoInMemoria } from './ripresaDurevole.ts'
import { sha256DiFile } from './scrittura.ts'

type Guasti = Partial<Record<
  'caricaFile' | 'improntaFile' | 'ricevutaConSha' | 'ricevutaEsiste' | 'documentoConToken' | 'registra',
  string[]  // coda di guasti, consumati uno per chiamata
>>

const blob = (contenuto: string) => new Blob([contenuto])
const sha = async (contenuto: string) => (await sha256DiFile(blob(contenuto)))!

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
    async improntaFile(percorso) {
      if (guasto('improntaFile') === 'rete') return { errore: 'Failed to fetch' }
      const dentro = stato.bucket.get(percorso)
      if (dentro === undefined) return { esiste: false }
      return { esiste: true, sha: await sha(dentro) }   // l'impronta dei BYTE veri
    },
    async ricevutaConSha(s) {
      if (guasto('ricevutaConSha') === 'rete') throw new Error('Failed to fetch')
      return { esiste: stato.ricevute.some(r => r.sha === s) }
    },
    async ricevutaEsiste(percorso) {
      if (guasto('ricevutaEsiste') === 'rete') return { errore: 'Failed to fetch' }
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
        // formato PRECISO: <AAAA-MM-GG>/<token>-p<pagina>.<ext>
        if (!new RegExp(`^\\d{4}-\\d{2}-\\d{2}/${token}-p${p.page_order}\\.[a-z0-9]{1,8}$`).test(p.storage_path))
          return { errore: 'PERCORSO_NON_COERENTE', codice: 'richiesta_non_valida' as const }
        if (!p.file_sha256) return { errore: 'IMPRONTA_MANCANTE', codice: 'richiesta_non_valida' as const }
        if (!/^[0-9a-f]{64}$/.test(p.file_sha256))
          return { errore: 'IMPRONTA_NON_VALIDA', codice: 'richiesta_non_valida' as const }
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

const hashRotto = async () => null
const foto = (contenuto: string, nome = 'scontrino.jpg') =>
  ({ nomeFile: nome, tipo: 'image/jpeg', contenuto: blob(contenuto), sha256: null })
const orologio = () => '2026-08-30T10:00:00.000Z'
const attimo = () => new Promise(r => setTimeout(r, 0))
// l'inizializzazione NORMALE della ripresa (uuid e sha VERI)
const prepara = async (contenuto: string) => {
  const p = await preparaRipresa(foto(contenuto), orologio)
  assert.ok(p.ok)
  return (p as { ok: true; ripresa: RipresaToken }).ripresa
}
const carica = (a: ReturnType<typeof archivio>, contenuto: string, ripresa: RipresaToken) =>
  caricaConToken(a.cliente, foto(contenuto), 'personale', 'nota', ripresa)
// una ricevuta "di un altro documento" già in archivio, con sha e formato veri
const seminaAltro = async (a: ReturnType<typeof archivio>, contenuto: string) => {
  const tok = crypto.randomUUID()
  const percorso = percorsoOperazione('2026-08-29', tok, 1, 'jpg')
  a.stato.documenti.push({ id: 'doc-altrui', token: tok, manifesto: 'm', status: 'da_elaborare' })
  a.stato.ricevute.push({ storage_path: percorso, document_id: 'doc-altrui', sha: await sha(contenuto), page_order: 1 })
  a.stato.bucket.set(percorso, contenuto)
  return percorso
}

test('percorso: formato PRECISO legato a token e pagina, non un semplice "contiene il token"', async () => {
  const r = await prepara('x')
  assert.equal(r.percorso, `2026-08-30/${r.token}-p1.jpg`)
  assert.equal(r.sha256, await sha('x'))               // impronta VERA dei byte
  assert.ok(percorsoValido(r.percorso, r.token, 1))
  assert.ok(!percorsoValido(`qualcosa-${r.token}.jpg`, r.token, 1))       // token contenuto ma formato no
  assert.ok(!percorsoValido(`2026-08-30/${r.token}-p2.jpg`, r.token, 1))  // pagina non combaciante
  // e la RPC (finta come la vera) rifiuta la pagina che non combacia
  const a = archivio()
  const diretta = await a.cliente.registraDocumento(r.token, 'scontrino', 'personale', null,
    [{ storage_path: `2026-08-30/${r.token}-p2.jpg`, page_order: 1, mime_type: null, file_sha256: r.sha256 }])
  assert.equal(diretta.codice, 'richiesta_non_valida')
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
  assert.deepEqual([...a.stato.bucket], [[r.percorso, 'x']])   // un solo file, byte originali
})

test('CONTENUTO CAMBIATO nel ritentativo: fermato PRIMA di ogni effetto, i byte collegati restano intatti', async () => {
  const a = archivio({ registra: ['risposta-persa'] })
  const r = await prepara('x')
  await carica(a, 'x', r)
  const t2 = await carica(a, 'CONTENUTO DIVERSO', r)
  assert.ok(!t2.ok && !t2.riprovabile && t2.errore.includes('NON corrisponde'))
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // PRIMA: upsert li sovrascriveva
  assert.equal(a.stato.documenti.length, 1)
})

test('"OGGETTO GIÀ PRESENTE" non dimostra "stessa foto": i byte archiviati si VERIFICANO', async () => {
  // al nostro percorso c'è un contenuto DIVERSO: la registrazione si ferma,
  // senza sovrascrivere né cancellare (il caso riprodotto dalla revisione)
  const a = archivio()
  const r = await prepara('x')
  a.stato.bucket.set(r.percorso, 'BYTE ESTRANEI')
  const t = await carica(a, 'x', r)
  assert.ok(!t.ok && !t.riprovabile && t.errore.includes('DIVERSO'))
  assert.equal(a.stato.bucket.get(r.percorso), 'BYTE ESTRANEI')   // intatti
  assert.equal(a.stato.documenti.length, 0)            // e NIENTE registrato con l'impronta attesa
  // verifica del contenuto INDISPONIBILE: ci si ferma senza toccare nulla
  const b = archivio({ improntaFile: ['rete'] })
  const r2 = await prepara('x')
  b.stato.bucket.set(r2.percorso, 'x')
  const t2 = await carica(b, 'x', r2)
  assert.ok(!t2.ok && t2.riprovabile && t2.errore.includes('verificarne il contenuto'))
  assert.equal(b.stato.documenti.length, 0)
  assert.equal(b.stato.bucket.get(r2.percorso), 'x')
})

test('CONCORRENZA stesso token con pausa fra lettura del token e controllo sha: ENTRAMBE ottengono lo stesso documento', async () => {
  // B legge "token non registrato" e si ferma; A completa la registrazione;
  // B riparte, trova lo SHA: NON deve dire "doppione" — decide il manifesto
  const a = archivio()
  const r = await prepara('x')
  let sblocca!: () => void
  const cancello = new Promise<void>(res => { sblocca = res })
  const clienteB: ClienteIdempotente = {
    ...a.cliente,
    ricevutaConSha: async s => { await cancello; return a.cliente.ricevutaConSha(s) },
  }
  const pb = caricaConToken(clienteB, foto('x'), 'personale', 'nota', { ...r })
  await attimo()                                       // B ha già letto "non registrato"
  const ta = await carica(a, 'x', r)                   // A completa
  assert.ok(ta.ok && !ta.ripetuta)
  sblocca()                                            // B riparte dal controllo sha
  const tb = await pb
  assert.ok(tb.ok && tb.ripetuta)                      // PRIMA: duplicato=true sbagliato
  assert.equal(ta.ok && ta.documentId, tb.ok && tb.documentId)
  assert.equal(a.stato.documenti.length, 1)
  assert.deepEqual([...a.stato.bucket], [[r.percorso, 'x']])   // nessuna cancellazione
})

test('ricevuta che punta al NOSTRO percorso ma token mai registrato: il doppione NON cancella il collegato', async () => {
  const a = archivio()
  const r = await prepara('x')
  // stato anomalo costruito ad arte: il nostro percorso è già collegato
  a.stato.documenti.push({ id: 'doc-x', token: crypto.randomUUID(), manifesto: 'm', status: 'da_elaborare' })
  a.stato.ricevute.push({ storage_path: r.percorso, document_id: 'doc-x', sha: r.sha256, page_order: 1 })
  a.stato.bucket.set(r.percorso, 'x')
  const t = await carica(a, 'x', r)
  assert.ok(!t.ok)                                     // sha trovato → decide la RPC → GIA_IN_ARCHIVIO
  assert.ok(!t.ok && t.duplicato)
  assert.ok(t.errore.includes('COLLEGATO'))            // pulizia FERMATA dalla verifica
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // l'allegato non è stato cancellato
})

test('verifica di pulizia INCERTA dopo GIA_IN_ARCHIVIO: la copia si conserva e lo si dice', async () => {
  const a = archivio({ ricevutaConSha: ['rete'], ricevutaEsiste: ['rete'] })
  await seminaAltro(a, 'x')
  const r = await prepara('x')
  const t = await carica(a, 'x', r)
  assert.ok(!t.ok && t.duplicato && t.errore.includes('resta nel bucket'))
  assert.equal(a.stato.bucket.get(r.percorso), 'x')    // conservata, non cancellata alla cieca
  assert.equal(a.stato.documenti.length, 1)            // e nessun documento vuoto
})

test('IMPRONTA NON DISPONIBILE: errore recuperabile PRIMA di caricare, mai un giro senza hash', async () => {
  const p = await preparaRipresa(foto('x'), orologio, undefined, hashRotto)
  assert.ok(!p.ok && p.riprovabile && p.errore.includes('impronta'))
  const a = archivio()
  const r = await prepara('x')
  const t = await caricaConToken(a.cliente, foto('x'), 'personale', 'nota', r, hashRotto)
  assert.ok(!t.ok && t.riprovabile)
  assert.equal(a.stato.bucket.size, 0)                 // nessun effetto esterno
})

test('RECUPERO DUREVOLE: upload riuscito, registrazione mai arrivata, pagina CHIUSA → nessun file orfano', async () => {
  // la riproduzione della revisione, ora col deposito: 1 documento,
  // 1 ricevuta e UN SOLO file (prima: 2 file, 1 orfano)
  const a = archivio({ registra: ['rete-prima'] })
  const deposito = depositoInMemoria()
  const c1 = creaControllore(a.cliente, deposito, undefined, orologio)
  const t1 = await c1.avvia(foto('x'), 'personale', 'nota mia')
  assert.ok(!t1.ok && t1.riprovabile)
  assert.equal(a.stato.bucket.size, 1)                 // il file è su
  assert.equal(a.stato.documenti.length, 0)            // la registrazione no
  // "chiusura della pagina": il controllore e ogni stato in memoria spariscono
  const c2 = creaControllore(a.cliente, deposito, undefined, orologio)
  const pendenti = await c2.pendenti()
  assert.equal(pendenti.length, 1)
  assert.equal(pendenti[0].nota, 'nota mia')           // il manifesto è COMPLETO
  const t2 = await c2.riprendi(pendenti[0])            // SENZA riselezionare il file
  assert.ok(t2.ok && !t2.ripetuta)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  assert.deepEqual([...a.stato.bucket.keys()], [pendenti[0].percorso])  // UN file, NESSUN orfano
  assert.equal(a.stato.ricevute[0].storage_path, pendenti[0].percorso)  // ed è quello collegato
  assert.equal(a.stato.bucket.get(pendenti[0].percorso), 'x')
  assert.equal((await c2.pendenti()).length, 0)        // operazione chiusa nel deposito
})

test('recupero durevole quando la registrazione ERA passata: si completa come ripetuta', async () => {
  const a = archivio({ registra: ['risposta-persa'] })
  const deposito = depositoInMemoria()
  await creaControllore(a.cliente, deposito, undefined, orologio).avvia(foto('x'), 'personale', null)
  const c2 = creaControllore(a.cliente, deposito, undefined, orologio)
  const [op] = await c2.pendenti()
  const t = await c2.riprendi(op)
  assert.ok(t.ok && t.ripetuta)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal((await c2.pendenti()).length, 0)
})

test('recupero durevole senza file nel bucket: chiede la RISELEZIONE e riconfronta l\'impronta', async () => {
  const a = archivio({ caricaFile: ['rete'] })         // l'upload non è mai partito
  const deposito = depositoInMemoria()
  const t1 = await creaControllore(a.cliente, deposito, undefined, orologio).avvia(foto('x'), 'personale', null)
  assert.ok(!t1.ok && t1.riprovabile)
  assert.equal(a.stato.bucket.size, 0)
  const c2 = creaControllore(a.cliente, deposito, undefined, orologio)
  const [op] = await c2.pendenti()
  const senzaFile = await c2.riprendi(op)
  assert.ok(!senzaFile.ok && senzaFile.serveFile)      // serve il file, l'operazione resta
  assert.equal((await c2.pendenti()).length, 1)
  const sbagliato = await c2.riprendi(op, foto('ALTRO FILE'))
  assert.ok(!sbagliato.ok && sbagliato.errore.includes('NON corrisponde'))
  const giusto = await c2.riprendi(op, foto('x'))      // riselezione corretta
  assert.ok(giusto.ok)
  assert.deepEqual([...a.stato.bucket], [[op.percorso, 'x']])
  assert.equal((await c2.pendenti()).length, 0)
})

test('se il salvataggio della ripresa fallisce, l\'upload NON parte', async () => {
  const a = archivio()
  const depositoRotto = { ...depositoInMemoria(), salva: async () => ({ errore: 'spazio esaurito' }) }
  const t = await creaControllore(a.cliente, depositoRotto, undefined, orologio).avvia(foto('x'), 'personale', null)
  assert.ok(!t.ok && t.riprovabile && t.errore.includes('NON carico'))
  assert.equal(a.stato.bucket.size, 0)                 // nessun effetto esterno
  assert.equal(a.stato.documenti.length, 0)
})

test('RICARICAMENTO senza deposito (ripresa persa davvero): comunque nessun doppione', async () => {
  // caso A: la registrazione era PASSATA → riselezione con ripresa NUOVA
  const a = archivio({ registra: ['risposta-persa'] })
  await carica(a, 'x', await prepara('x'))
  const dopoA = await carica(a, 'x', await prepara('x'))
  assert.ok(!dopoA.ok && dopoA.duplicato)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 1)
  // caso B: mai arrivata → si riparte puliti, ma il PRIMO file resta orfano
  // nel bucket: è ESATTAMENTE il buco che il deposito durevole chiude
  const b = archivio({ registra: ['rete-prima'] })
  const r1 = await prepara('x')
  await carica(b, 'x', r1)
  const dopoB = await carica(b, 'x', await prepara('x'))
  assert.ok(dopoB.ok)
  assert.equal(b.stato.documenti.length, 1)
  assert.equal(b.stato.bucket.size, 2)                 // orfano DICHIARATO senza deposito
  assert.ok(b.stato.bucket.has(r1.percorso))
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
  await carica(a, 'x', r)
  const t2 = await caricaConToken(a.cliente, foto('x'), 'personale', 'NOTA DIVERSA', r)
  assert.ok(!t2.ok && !t2.riprovabile && t2.errore.includes('contenuto diverso'))
  const t3 = await caricaConToken(a.cliente, foto('x'), 'azienda', 'nota', r)
  assert.ok(!t3.ok && !t3.riprovabile)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.bucket.get(r.percorso), 'x')
})

test('PAGINE MALFORMATE ≠ doppione: respinte come non valide, senza effetti', async () => {
  const a = archivio()
  const r = await prepara('x')
  const diretta = await a.cliente.registraDocumento(r.token, 'scontrino', 'personale', null, [
    { storage_path: percorsoOperazione('2026-08-30', r.token, 1, 'jpg'), page_order: 1, mime_type: null, file_sha256: await sha('a') },
    { storage_path: percorsoOperazione('2026-08-30', r.token, 1, 'png'), page_order: 1, mime_type: null, file_sha256: await sha('b') },
  ])
  assert.equal(diretta.codice, 'richiesta_non_valida')
  assert.equal(a.stato.documenti.length, 0)
  // e una ripresa corrotta (percorso fuori formato) si ferma nel CLIENT,
  // prima di ogni effetto — mai spacciata per doppione
  const b = archivio()
  const corrotta: RipresaToken = { ...(await prepara('x')), percorso: 'p/senza-formato.jpg' }
  const t = await carica(b, 'x', corrotta)
  assert.ok(!t.ok && !t.duplicato && !t.riprovabile && t.errore.includes('non appartiene'))
  assert.equal(b.stato.bucket.size, 0)                 // NIENTE caricato
})

test('verifica del token GIÙ al ritentativo: non si tocca nulla', async () => {
  const a = archivio({ documentoConToken: ['rete'] })
  const t = await carica(a, 'x', await prepara('x'))
  assert.ok(!t.ok && t.riprovabile && t.errore.includes('non tocco nulla'))
  assert.equal(a.stato.bucket.size, 0)
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
  assert.equal(codiceDaMessaggio('IMPRONTA_NON_VALIDA'), 'richiesta_non_valida')
  assert.equal(codiceDaMessaggio('TypeError: Failed to fetch'), 'rete')
  assert.equal(codiceDaMessaggio('permission denied'), 'altro')
})
