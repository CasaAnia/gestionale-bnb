// ============================================================================
// Test Fase 4 blocco 2 — l'INTEGRAZIONE usata dalle pagine (codaPagina) col
// controller REALE di ripresaDurevole, un archivio simulato che conserva
// byte e stato, e il VERO depositoLocale su una memoria finta. Casi
// richiesti: risposta persa e pagina ricreata, doppio clic, doppione, file
// diverso, deposito illeggibile, pulizia incerta.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  conFileRiselezionato, inviabilePagina, nuoveVociPagina,
  rimovibilePagina, salvaCodaPagina, vociDaPendenti, type VocePagina,
} from './codaPagina.ts'
import { creaControllore, depositoLocale } from './ripresaDurevole.ts'
import { creaGuardiaInvio, sha256DiFile } from './scrittura.ts'
import type { ClienteIdempotente } from './registrazioneIdempotente.ts'

// ---- archivio simulato (byte + stato, semantica RPC come nei collaudi) ----
type Guasti = Partial<Record<'registra' | 'ricevutaEsiste', string[]>>
function archivio(guasti: Guasti = {}) {
  const stato = {
    bucket: new Map<string, string>(),
    documenti: [] as { id: string; token: string; manifesto: string }[],
    ricevute: [] as { storage_path: string; document_id: string; sha: string }[],
  }
  const guasto = (n: keyof Guasti) => guasti[n]?.shift()
  const sha = async (c: string) => (await sha256DiFile(new Blob([c])))!
  const cliente: ClienteIdempotente = {
    async caricaFile(percorso, file) {
      if (stato.bucket.has(percorso)) return { esisteGia: true }
      stato.bucket.set(percorso, await (file as Blob).text())
      return {}
    },
    async rimuoviFile(percorso) { stato.bucket.delete(percorso); return {} },
    async improntaFile(percorso) {
      const dentro = stato.bucket.get(percorso)
      if (dentro === undefined) return { esiste: false }
      return { esiste: true, sha: await sha(dentro) }
    },
    async ricevutaConSha(s) { return { esiste: stato.ricevute.some(r => r.sha === s) } },
    async ricevutaEsiste(percorso) {
      if (guasto('ricevutaEsiste') === 'rete') return { errore: 'Failed to fetch' }
      return { esiste: stato.ricevute.some(r => r.storage_path === percorso) }
    },
    async documentoConToken(token) {
      const d = stato.documenti.find(x => x.token === token)
      return d ? { documentId: d.id } : {}
    },
    async registraDocumento(token, kind, ambito, nota, pagine) {
      const g = guasto('registra')
      if (g === 'rete-prima') throw new Error('Failed to fetch')
      const manifesto = JSON.stringify({ kind, ambito, nota, pagine })
      const doc = stato.documenti.find(d => d.token === token)
      if (doc) return doc.manifesto === manifesto
        ? { documentId: doc.id, ripetuta: true }
        : { errore: 'TOKEN_RIUSATO', codice: 'token_riusato' as const }
      for (const p of pagine)
        if (stato.ricevute.some(r => r.sha === p.file_sha256))
          return { errore: 'GIA_IN_ARCHIVIO', codice: 'gia_in_archivio' as const }
      const id = `doc-${stato.documenti.length + 1}`
      stato.documenti.push({ id, token, manifesto })
      for (const p of pagine) stato.ricevute.push({ storage_path: p.storage_path, document_id: id, sha: p.file_sha256 })
      if (g === 'risposta-persa') throw new Error('Failed to fetch')
      return { documentId: id, ripetuta: false }
    },
  }
  return { cliente, stato }
}
function memoriaFinta(iniziale?: Record<string, string>) {
  const dati = new Map(Object.entries(iniziale ?? {}))
  return { getItem: (k: string) => dati.get(k) ?? null, setItem: (k: string, v: string) => { dati.set(k, v) }, dati }
}
// lo stato vivo, come lo state React della pagina
function statoVivo(iniziali: VocePagina[]) {
  let coda = iniziali
  return { leggi: () => coda, scrivi: (f: (c: VocePagina[]) => VocePagina[]) => { coda = f(coda) } }
}
let n = 0
const genId = () => `locale-${++n}`
const file = (c: string, nome = 'foto.jpg') => ({ file: new Blob([c]) as Blob, nome, tipo: 'image/jpeg' })
const orologio = () => '2026-09-10T10:00:00.000Z'
const controller = (a: ReturnType<typeof archivio>, memoria: ReturnType<typeof memoriaFinta>) =>
  creaControllore(a.cliente, depositoLocale(undefined, () => memoria), undefined, orologio)

test('percorso felice: selezione multipla salvata; il deposito resta vuoto', async () => {
  const a = archivio(); const memoria = memoriaFinta()
  const s = statoVivo(nuoveVociPagina([file('a'), file('b')], 'personale', genId))
  const { salvate } = await salvaCodaPagina(s.leggi, s.scrivi, controller(a, memoria), 'nota x')
  assert.equal(salvate, 2)
  assert.deepEqual(s.leggi().map(v => v.stato), ['salvata', 'salvata'])
  assert.equal(a.stato.documenti.length, 2)
  assert.equal((await controller(a, memoria).pendenti()).riprese.length, 0)
})

test('RISPOSTA PERSA e PAGINA RICREATA: la voce pendente riappare con ambito/token originali e si recupera SENZA file', async () => {
  const a = archivio({ registra: ['risposta-persa'] }); const memoria = memoriaFinta()
  const s1 = statoVivo(nuoveVociPagina([file('x')], 'azienda', genId))
  await salvaCodaPagina(s1.leggi, s1.scrivi, controller(a, memoria), 'nota della prima volta')
  const dopo1 = s1.leggi()[0]
  assert.equal(dopo1.stato, 'da_verificare')
  assert.ok(dopo1.op)
  // «pagina ricreata»: coda NUOVA costruita SOLO dalle pendenti del deposito
  const c2 = controller(a, memoria)
  const lettura = await c2.pendenti()
  const s2 = statoVivo(vociDaPendenti(lettura.riprese))
  const voce = s2.leggi()[0]
  assert.equal(voce.ambito, 'azienda')                          // ambito ORIGINALE
  assert.equal(voce.op!.nota, 'nota della prima volta')         // manifesto originale
  assert.equal(voce.file, null)
  const { salvate } = await salvaCodaPagina(s2.leggi, s2.scrivi, c2, null)
  assert.equal(salvate, 1)                                      // recuperata senza riselezionare
  assert.equal(s2.leggi()[0].stato, 'salvata')
  assert.equal(a.stato.documenti.length, 1)                     // MAI un doppione
  assert.equal((await c2.pendenti()).riprese.length, 0)
})

test('DOPPIO CLIC su Salva: la guardia fa partire UN solo ciclo', async () => {
  const a = archivio(); const memoria = memoriaFinta()
  const s = statoVivo(nuoveVociPagina([file('solo-una')], 'personale', genId))
  const guardia = creaGuardiaInvio()
  const c = controller(a, memoria)
  const invia = () => guardia(() => salvaCodaPagina(s.leggi, s.scrivi, c, null))
  const [r1, r2] = await Promise.all([invia(), invia()])
  assert.equal([r1, r2].filter(Boolean).length, 1)              // il secondo clic non parte
  assert.equal(a.stato.documenti.length, 1)
})

test('DOPPIONE: stato duplicato, chiuso nel deposito, non rientra nei ritentativi ed è rimovibile', async () => {
  const a = archivio(); const memoria = memoriaFinta()
  const s0 = statoVivo(nuoveVociPagina([file('gemella')], 'personale', genId))
  await salvaCodaPagina(s0.leggi, s0.scrivi, controller(a, memoria), null)
  const s = statoVivo(nuoveVociPagina([file('gemella')], 'personale', genId))
  await salvaCodaPagina(s.leggi, s.scrivi, controller(a, memoria), null)
  const v = s.leggi()[0]
  assert.equal(v.stato, 'duplicato')
  assert.equal(inviabilePagina(v), false)
  assert.equal(rimovibilePagina(v), true)
  assert.equal((await controller(a, memoria).pendenti()).riprese.length, 0)
  assert.equal(a.stato.documenti.length, 1)
})

test('FILE DIVERSO alla riselezione: respinto e ancora in attesa del file giusto; con quello giusto si chiude', async () => {
  const a = archivio(); const memoria = memoriaFinta()
  // upload mai partito: pendente che chiede il file
  const rotto = { ...a.cliente, caricaFile: async () => { throw new Error('Failed to fetch') } }
  const c1 = creaControllore(rotto, depositoLocale(undefined, () => memoria), undefined, orologio)
  const s1 = statoVivo(nuoveVociPagina([file('originale')], 'personale', genId))
  await salvaCodaPagina(s1.leggi, s1.scrivi, c1, null)
  // pagina ricreata: il recupero senza file chiede la riselezione
  const c2 = controller(a, memoria)
  const s2 = statoVivo(vociDaPendenti((await c2.pendenti()).riprese))
  await salvaCodaPagina(s2.leggi, s2.scrivi, c2, null)
  assert.equal(s2.leggi()[0].stato, 'da_riselezionare')
  // file SBAGLIATO → resta in attesa del file, traccia conservata
  s2.scrivi(c => c.map(v => conFileRiselezionato(v, new Blob(['SBAGLIATO']), 'x.jpg', 'image/jpeg')))
  await salvaCodaPagina(s2.leggi, s2.scrivi, c2, null)
  assert.equal(s2.leggi()[0].stato, 'da_riselezionare')
  assert.ok(s2.leggi()[0].errore?.includes('NON corrisponde'))
  assert.equal((await c2.pendenti()).riprese.length, 1)
  // file GIUSTO → salvata e deposito chiuso
  s2.scrivi(c => c.map(v => conFileRiselezionato(v, new Blob(['originale']), 'x.jpg', 'image/jpeg')))
  await salvaCodaPagina(s2.leggi, s2.scrivi, c2, null)
  assert.equal(s2.leggi()[0].stato, 'salvata')
  assert.equal((await c2.pendenti()).riprese.length, 0)
  assert.equal(a.stato.documenti.length, 1)
})

test('DEPOSITO ILLEGGIBILE: il caricamento nuovo è bloccato PRIMA di ogni effetto e l\'errore di lettura arriva esplicito', async () => {
  const a = archivio(); const memoria = memoriaFinta({ 'gestionale-riprese-caricamento': '{{{corrotto' })
  const c = controller(a, memoria)
  const s = statoVivo(nuoveVociPagina([file('x')], 'personale', genId))
  await salvaCodaPagina(s.leggi, s.scrivi, c, null)
  const v = s.leggi()[0]
  assert.equal(v.stato, 'da_ritentare')
  assert.ok(v.errore?.includes('NON carico'))
  assert.equal(a.stato.bucket.size, 0)                          // nessun effetto remoto
  const lettura = await c.pendenti()
  assert.ok(lettura.errore)                                     // esplicito, non "vuoto"
})

test('PULIZIA INCERTA: pulizia_pendente resta visibile e ritentabile; al recupero si chiude e la copia sparisce', async () => {
  const a = archivio({ ricevutaEsiste: ['rete'] }); const memoria = memoriaFinta()
  const s0 = statoVivo(nuoveVociPagina([file('doppia')], 'personale', genId))
  await salvaCodaPagina(s0.leggi, s0.scrivi, controller(a, memoria), null)
  // scorciatoia sha spenta per il secondo giro: la copia viene caricata
  // DAVVERO e il doppione emerge solo dalla RPC (come nel collaudo reale)
  const senzaScorciatoia = { ...a.cliente, ricevutaConSha: async () => ({}) }
  const c1 = creaControllore(senzaScorciatoia, depositoLocale(undefined, () => memoria), undefined, orologio)
  const s = statoVivo(nuoveVociPagina([file('doppia')], 'personale', genId))
  await salvaCodaPagina(s.leggi, s.scrivi, c1, null)
  assert.equal(a.stato.bucket.size, 2)                          // la copia È nel bucket
  const v = s.leggi()[0]
  assert.equal(v.stato, 'pulizia_pendente')
  assert.equal(inviabilePagina(v), true)
  assert.equal(rimovibilePagina(v), false)                      // la traccia NON si nasconde
  // pagina ricreata: la pendente riappare e il ritentativo completa la pulizia
  const c2 = controller(a, memoria)
  const s2 = statoVivo(vociDaPendenti((await c2.pendenti()).riprese))
  assert.equal(s2.leggi()[0].stato, 'pulizia_pendente')
  await salvaCodaPagina(s2.leggi, s2.scrivi, c2, null)
  assert.equal(s2.leggi()[0].stato, 'duplicato')
  assert.equal((await c2.pendenti()).riprese.length, 0)
  assert.equal(a.stato.bucket.size, 1)                          // resta solo l'originale
})
