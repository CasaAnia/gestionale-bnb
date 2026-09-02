// ============================================================================
// Fase 5 — CARICAMENTO A PIÙ PAGINE e tipo «fattura» sul flusso idempotente
// collaudato (0022): un token, N pagine con percorso -pN e impronta propria,
// manifesto con kind esplicito; ripresa senza file da tutte le pagine nel
// bucket; riselezione per impronta in qualsiasi ordine; una pagina mancante
// = attesa del file; coda di pagina che unisce/separa le voci nuove.
// Archivio simulato che conserva byte e stato (come negli altri test).
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  caricaConToken, pagineDi, percorsoValido, preparaRipresa,
  type ClienteIdempotente, type RipresaToken,
} from './registrazioneIdempotente.ts'
import { creaControllore, depositoLocale } from './ripresaDurevole.ts'
import {
  nuoveVociPagina, salvaCodaPagina, segnaTipoInAttesa, separaInAttesa,
  unibiliPagina, unisciInAttesa, vociDaPendenti, type VocePagina,
} from './codaPagina.ts'
import { sha256DiFile } from './scrittura.ts'

const blob = (c: string) => new Blob([c])
const sha = async (c: string) => (await sha256DiFile(blob(c)))!
const foto = (c: string, nome = 'pagina.jpg') => ({ nomeFile: nome, tipo: 'image/jpeg', contenuto: blob(c), sha256: null })
const orologio = () => '2026-09-02T10:00:00.000Z'

type Guasti = Partial<Record<'registra', string[]>>
function archivio(guasti: Guasti = {}) {
  const stato = {
    bucket: new Map<string, string>(),
    documenti: [] as { id: string; token: string; kind: string; manifesto: string }[],
    ricevute: [] as { storage_path: string; document_id: string; sha: string; page_order: number }[],
  }
  const guasto = (n: keyof Guasti) => guasti[n]?.shift()
  const cliente: ClienteIdempotente = {
    async caricaFile(percorso, file) {
      if (stato.bucket.has(percorso)) return { esisteGia: true }
      stato.bucket.set(percorso, await (file as Blob).text()); return {}
    },
    async rimuoviFile(percorso) { stato.bucket.delete(percorso); return {} },
    async improntaFile(percorso) {
      const dentro = stato.bucket.get(percorso)
      if (dentro === undefined) return { esiste: false }
      return { esiste: true, sha: await sha(dentro) }
    },
    async ricevutaConSha(s) { return { esiste: stato.ricevute.some(r => r.sha === s) } },
    async ricevutaEsiste(percorso) { return { esiste: stato.ricevute.some(r => r.storage_path === percorso) } },
    async documentoConToken(token) {
      const d = stato.documenti.find(x => x.token === token)
      return d ? { documentId: d.id } : {}
    },
    async registraDocumento(token, kind, ambito, nota, pagine) {
      const g = guasto('registra')
      for (const p of pagine) {
        if (!new RegExp(`^\\d{4}-\\d{2}-\\d{2}/${token}-p${p.page_order}\\.[a-z0-9]{1,8}$`).test(p.storage_path))
          return { errore: 'PERCORSO_NON_COERENTE', codice: 'richiesta_non_valida' as const }
        if (!/^[0-9a-f]{64}$/.test(p.file_sha256)) return { errore: 'IMPRONTA_NON_VALIDA', codice: 'richiesta_non_valida' as const }
      }
      const ordini = pagine.map(p => p.page_order)
      if (new Set(ordini).size !== ordini.length) return { errore: 'PAGINE_MALFORMATE', codice: 'richiesta_non_valida' as const }
      const manifesto = JSON.stringify({ kind, ambito, nota, pagine: [...pagine].sort((a, b) => a.page_order - b.page_order).map(p => [p.storage_path, p.page_order, p.mime_type, p.file_sha256]) })
      const doc = stato.documenti.find(d => d.token === token)
      if (doc) return doc.manifesto === manifesto ? { documentId: doc.id, ripetuta: true } : { errore: 'TOKEN_RIUSATO', codice: 'token_riusato' as const }
      for (const p of pagine)
        if (stato.ricevute.some(r => r.sha === p.file_sha256)) return { errore: 'GIA_IN_ARCHIVIO', codice: 'gia_in_archivio' as const }
      const id = `doc-${stato.documenti.length + 1}`
      stato.documenti.push({ id, token, kind, manifesto })
      for (const p of pagine) stato.ricevute.push({ storage_path: p.storage_path, document_id: id, sha: p.file_sha256, page_order: p.page_order })
      if (g === 'risposta-persa') throw new Error('Failed to fetch')
      return { documentId: id, ripetuta: false }
    },
  }
  return { cliente, stato }
}
function memoriaFinta() {
  const dati = new Map<string, string>()
  return { getItem: (k: string) => dati.get(k) ?? null, setItem: (k: string, v: string) => { dati.set(k, v) } }
}
const controller = (a: ReturnType<typeof archivio>, memoria = memoriaFinta()) =>
  creaControllore(a.cliente, depositoLocale(undefined, () => memoria), undefined, orologio)

test('preparaRipresa con più foto: UN token, percorsi -p1/-p2/-p3 validi, impronte proprie, kind esplicito «fattura»', async () => {
  const p = await preparaRipresa([foto('pag-1', 'a.jpg'), foto('pag-2', 'b.jpg'), foto('pag-3', 'c.pdf')], orologio, undefined, undefined, 'fattura')
  assert.ok(p.ok)
  const r = (p as { ok: true; ripresa: RipresaToken }).ripresa
  assert.equal(r.kind, 'fattura')
  assert.equal(pagineDi(r).length, 3)
  for (const pag of pagineDi(r)) {
    assert.ok(percorsoValido(pag.percorso, r.token, pag.page_order))
    assert.match(pag.sha256, /^[0-9a-f]{64}$/)
  }
  assert.ok(pagineDi(r)[2].percorso.endsWith('-p3.pdf'))
  assert.equal(r.percorso, pagineDi(r)[0].percorso)       // i campi di testa = pagina 1
  assert.equal(r.sha256, await sha('pag-1'))
  // una sola foto: NESSUN campo pagine, identico a prima (le riprese
  // custodite prima della Fase 5 restano valide)
  const uno = await preparaRipresa(foto('solo'), orologio)
  assert.ok(uno.ok && !('pagine' in uno.ripresa && uno.ripresa.pagine))
  assert.equal((uno as { ok: true; ripresa: RipresaToken }).ripresa.kind, 'scontrino')
  // la stessa foto due volte: fermata prima di ogni effetto
  const doppia = await preparaRipresa([foto('x'), foto('x')], orologio)
  assert.ok(!doppia.ok && doppia.errore.includes('stessa foto'))
})

test('caricamento di una fattura a due pagine: due file nel bucket, UN documento con due ricevute ordinate, kind fattura nel manifesto', async () => {
  const a = archivio()
  const c = controller(a)
  const e = await c.avvia([foto('p1', 'f1.jpg'), foto('p2', 'f2.jpg')], 'azienda', 'fattura caldaia', 'fattura')
  assert.ok(e.ok)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.documenti[0].kind, 'fattura')
  assert.deepEqual(a.stato.ricevute.map(r => r.page_order), [1, 2])
  assert.deepEqual([...a.stato.bucket.values()], ['p1', 'p2'])
  assert.equal((await c.pendenti()).riprese.length, 0)
})

test('risposta persa dopo la registrazione: la ripresa SENZA file trova tutte le pagine nel bucket e completa come ripetuta', async () => {
  const a = archivio({ registra: ['risposta-persa'] })
  const memoria = memoriaFinta()
  const c = controller(a, memoria)
  const e = await c.avvia([foto('p1'), foto('p2')], 'azienda', null, 'fattura')
  assert.ok(!e.ok && e.chiusura === 'da_verificare')
  // pagina ricreata: deposito riletto, operazione a due pagine intatta
  const c2 = controller(a, memoria)
  const { riprese } = await c2.pendenti()
  assert.equal(riprese.length, 1)
  assert.equal(riprese[0].pagine?.length, 2)
  assert.equal(riprese[0].kind, 'fattura')
  const r = await c2.riprendi(riprese[0])
  assert.ok(r.ok && r.ripetuta)
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.ricevute.length, 2)
  assert.equal((await c2.pendenti()).riprese.length, 0)
})

test('interruzione PRIMA della registrazione: ripresa senza file → serve la riselezione; file in ordine INVERSO accettati (abbinamento per impronta); una pagina mancante fermata', async () => {
  const a = archivio()
  const memoria = memoriaFinta()
  const c = controller(a, memoria)
  // si fissa la ripresa e si caricano i byte, poi la pagina muore prima della RPC
  const prep = await preparaRipresa([foto('p1'), foto('p2')], orologio, undefined, undefined, 'fattura')
  assert.ok(prep.ok)
  const ripresa = (prep as { ok: true; ripresa: RipresaToken }).ripresa
  const op = { ...ripresa, ambito: 'azienda' as const, nota: null, nomeFile: 'p1.jpg (+1)' }
  a.stato.bucket.set(pagineDi(ripresa)[0].percorso, 'p1')     // solo la prima pagina era arrivata
  const senzaFile = await c.riprendi(op)
  assert.ok(!senzaFile.ok && senzaFile.serveFile && senzaFile.errore.includes('pagina 2'))
  // riselezione con i file in ordine inverso: va bene lo stesso
  const inversi = await c.riprendi(op, [foto('p2'), foto('p1')])
  assert.ok(inversi.ok)
  assert.equal(a.stato.ricevute.length, 2)
  assert.deepEqual(a.stato.bucket.get(pagineDi(ripresa)[1].percorso), 'p2')
  // una pagina mancante nella riselezione: fermata PRIMA di ogni effetto
  const b = archivio()
  const prep2 = await preparaRipresa([foto('q1'), foto('q2')], orologio)
  const r2 = (prep2 as { ok: true; ripresa: RipresaToken }).ripresa
  const meta = await caricaConToken(b.cliente, [foto('q1')], 'azienda', null, r2)
  assert.ok(!meta.ok && meta.serveFile && meta.chiusura === 'in_attesa_del_file')
  assert.equal(b.stato.bucket.size, 0)
  // un file DIVERSO al posto di una pagina: stessa fermata
  const diverso = await caricaConToken(b.cliente, [foto('q1'), foto('altro')], 'azienda', null, r2)
  assert.ok(!diverso.ok && diverso.serveFile)
  assert.equal(b.stato.bucket.size, 0)
})

test('doppione a più pagine: rifiuto atomico della RPC e pulizia di TUTTE le copie', async () => {
  const a = archivio()
  const c = controller(a)
  assert.ok((await c.avvia([foto('p1'), foto('p2')], 'azienda', null, 'fattura')).ok)
  const dopo = await c.avvia([foto('p1'), foto('p2')], 'azienda', null, 'fattura')
  assert.ok(!dopo.ok && dopo.duplicato && dopo.chiusura === 'conclusa')
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.bucket.size, 2)                         // solo le copie del primo documento
})

test('coda di pagina: unire le voci nuove in un documento, separarle, segnare «fattura»; salvataggio = UN documento con N pagine', async () => {
  let n = 0
  const genId = () => `loc-${++n}`
  const file = (c: string, nome: string) => ({ file: blob(c), nome, tipo: 'image/jpeg' })
  let coda: VocePagina[] = nuoveVociPagina([file('a', 'a.jpg'), file('b', 'b.jpg'), file('c', 'c.jpg')], 'azienda', genId)
  assert.equal(unibiliPagina(coda), 3)
  coda = segnaTipoInAttesa(coda, 'fattura')
  assert.ok(coda.every(v => v.kind === 'fattura'))
  coda = unisciInAttesa(coda, genId)
  assert.equal(coda.length, 1)
  assert.equal(coda[0].pagine, 3)
  assert.equal(coda[0].altreFile?.length, 2)
  assert.equal(coda[0].kind, 'fattura')
  assert.equal(coda[0].nome, 'a.jpg')
  // si separano di nuovo, nell'ordine originale e col tipo conservato
  const separate = separaInAttesa(coda, genId)
  assert.deepEqual(separate.map(v => v.nome), ['a.jpg', 'b.jpg', 'c.jpg'])
  assert.ok(separate.every(v => v.kind === 'fattura' && !v.altreFile))
  // una voce già avviata (con op) non si unisce: il manifesto è fissato
  const a = archivio()
  const c = controller(a)
  const conPendente: VocePagina[] = [...vociDaPendenti([{ token: 't', sha256: 'x', percorso: '2026-09-02/t-p1.jpg', mime: 'image/jpeg', kind: 'scontrino', ambito: 'azienda', nota: null, nomeFile: 'vecchia.jpg' }]), ...coda]
  assert.equal(unisciInAttesa(conPendente, genId).length, 2)
  // salvataggio della voce unita: UN documento a tre pagine, kind fattura
  let viva = coda
  const { salvate } = await salvaCodaPagina(() => viva, f => { viva = f(viva) }, c, 'nota')
  assert.equal(salvate, 1)
  assert.equal(viva[0].stato, 'salvata')
  assert.equal(a.stato.documenti.length, 1)
  assert.equal(a.stato.documenti[0].kind, 'fattura')
  assert.deepEqual(a.stato.ricevute.map(r => r.page_order), [1, 2, 3])
})

test('regressione: una voce singola si carica come prima (una pagina, kind dal file, nessun campo pagine)', async () => {
  const a = archivio()
  const c = controller(a)
  const e = await c.avvia(foto('solo', 'x.pdf'), 'personale', null)
  assert.ok(e.ok)
  assert.equal(a.stato.ricevute.length, 1)
  assert.equal(a.stato.documenti[0].kind, 'scontrino')   // il mime del test è image/jpeg
  const manifesto = JSON.parse(a.stato.documenti[0].manifesto) as { pagine: unknown[] }
  assert.equal(manifesto.pagine.length, 1)
})
