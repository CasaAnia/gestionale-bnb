// ============================================================================
// Test LOCALI del CABLAGGIO del contratto (blocco B1–B5): deposito
// operazioni DUREVOLE (magazzino finto, guasti compresi) e
// orchestrazione a contratto sopra il server finto RIGOROSO — giro
// completo, replay, SUPERATA, risposta persa dopo l'effetto reale con
// recupero all'apertura, richiesta mai partita con reinvio, quadratura
// come rifiuto dimostrato, custodia che blocca. Il percorso legacy resta
// coperto dalla sua suite: qui solo la delega.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaServerContratto, type MondoFinto } from './contrattoServerFinto.ts'
import type { ClienteContratto } from './contrattoRevisione.ts'
import { improntaSha256 } from './improntaTesto.ts'
import { depositoOperazioniDurevole, type MagazzinoTesto } from './depositoOperazioniDurevole.ts'
import { orchestrazioneContratto, orchestrazioneLegacy } from './orchestrazioneRevisione.ts'
import {
  aggiungiRiga, apriRevisione, modificaBozza, modificaTotale,
  type BozzaGrezza, type RigaGrezza, type TracciaRevisione,
} from './revisione.ts'
import type { DepositoRevisione } from './revisioneDurevole.ts'
import type { ClienteRevisione } from './revisioneScrittura.ts'

// ---- attrezzi -------------------------------------------------------------
function magazzinoFinto(guasti: { scritturaRotta?: boolean; letturaRotta?: boolean } = {}) {
  const mappa = new Map<string, string>()
  const magazzino: MagazzinoTesto = {
    getItem: k => { if (guasti.letturaRotta) throw new Error('lettura negata (finto)'); return mappa.get(k) ?? null },
    setItem: (k, v) => { if (guasti.scritturaRotta) throw new Error('quota piena (finto)'); mappa.set(k, v) },
    removeItem: k => { if (guasti.scritturaRotta) throw new Error('quota piena (finto)'); mappa.delete(k) },
  }
  return { magazzino, mappa, guasti }
}

function depositoRevisioneFinto(guasti: { rotta?: boolean } = {}) {
  const tracce = new Map<string, TracciaRevisione>()
  const dep: DepositoRevisione = {
    salva: t => {
      if (guasti.rotta) return { errore: 'disco pieno (finto)' }
      tracce.set(t.documentId, JSON.parse(JSON.stringify(t))); return {}
    },
    leggi: id => guasti.rotta ? { errore: 'disco pieno (finto)' } : { traccia: tracce.get(id) },
    rimuovi: (id, gen) => {
      const t = tracce.get(id)
      if (t && (t.generazione ?? 0) <= gen) tracce.delete(id)
      return {}
    },
  }
  return { dep, tracce, guasti }
}

const BOZZA: BozzaGrezza = {
  id: 'b1', document_id: 'd1', status: 'da_controllare', expense_date: '2026-08-31',
  group_id: 'g1', category_id: null, subcategory: null, canonical_category_id: null,
  canonical_subcategory_id: null, store: 'Iper', description: null, payment_method: 'contanti',
  room_id: null, expense_nature: null, arrotondamento_cent: 0, confidence: null,
} as unknown as BozzaGrezza
const RIGA: RigaGrezza = {
  id: 'r1', draft_id: 'b1', raw_name: null, name: 'Pane', qty: 1, unit_price: null,
  discount: 0, amount: 5, group_id: null, category_id: null, subcategory: null,
  canonical_category_id: null, canonical_subcategory_id: null, necessity: null,
  planning: null, excluded: false, user_added: false, confidence: null,
} as unknown as RigaGrezza

// uno SCENARIO completo: mondo del server finto + deposito durevole +
// custodia della revisione + orchestrazione; il cliente può essere
// rivestito (guasti di trasporto, come nel collaudo)
function scenario(rivesti?: (base: ClienteContratto) => ClienteContratto) {
  const mondo: MondoFinto = {
    documenti: new Map([['d1', { status: 'in_revisione', revisione_rev: 0, doc_total: 5 }]]),
    bozze: new Map([['b1', { document_id: 'd1', status: 'da_controllare', group_id: 'g1', arrotondamento_cent: 0 }]]),
    righe: new Map([['r1', { draft_id: 'b1', amount: 5, excluded: false }]]),
  }
  const server = creaServerContratto(mondo, improntaSha256)
  const { magazzino, mappa } = magazzinoFinto()
  const depOp = depositoOperazioniDurevole(magazzino, 'prova')
  const rev = depositoRevisioneFinto()
  let chiavi = 0
  const orch = orchestrazioneContratto({
    cliente: rivesti ? rivesti(server.cliente) : server.cliente,
    depositoRevisione: rev.dep,
    depositoOperazioni: depOp,
    revisioneIniziale: 0,
    nuovaChiave: () => `00000000-0000-0000-0000-0000000000${String(++chiavi).padStart(2, '0')}`,
  })
  const stato = () => apriRevisione('d1', 5, [BOZZA], [RIGA], null)
  return { mondo, server, magazzino, mappa, depOp, rev, orch, stato }
}

// ---- deposito operazioni DUREVOLE -----------------------------------------
const OP = {
  opKey: 'k1', kind: 'salva' as const, documentId: 'd1', baseRev: 0,
  impronta: 'aaa', clientRefs: ['x'],
  richiesta: { kind: 'salva' as const, modifiche: { kind: 'salva' as const, document_id: 'd1', base_rev: 0, bozze: {}, righe: {}, nuove: [] } },
  tentativiIncerti: 1,
}

test('deposito durevole: giro completo e DURABILITÀ sullo stesso magazzino', () => {
  const { magazzino } = magazzinoFinto()
  const d1 = depositoOperazioniDurevole(magazzino, 'p')
  assert.deepEqual(d1.salva(OP), {})
  assert.equal(d1.leggi('k1').op?.impronta, 'aaa')
  assert.equal(d1.elenca().ops?.length, 1)
  // un ALTRO deposito sullo stesso magazzino (riapertura): tutto ancora lì
  const d2 = depositoOperazioniDurevole(magazzino, 'p')
  assert.equal(d2.elenca().ops?.[0]?.opKey, 'k1')
  assert.deepEqual(d2.rimuovi('k1'), {})
  assert.equal(d2.leggi('k1').op, undefined)
  assert.equal(d2.elenca().ops?.length, 0)
})

test('deposito durevole: una pendenza non cambia identità, il contatore sì (richiesta ORIGINALE intatta)', () => {
  const { magazzino } = magazzinoFinto()
  const d = depositoOperazioniDurevole(magazzino, 'p')
  d.salva(OP)
  const diversa = d.salva({ ...OP, impronta: 'bbb' })
  assert.match(diversa.errore ?? '', /UN'ALTRA richiesta/)
  assert.deepEqual(d.salva({ ...OP, tentativiIncerti: 3, richiesta: { kind: 'scarto', motivo: 'mai' } as never }), {})
  const riletta = d.leggi('k1').op
  assert.equal(riletta?.tentativiIncerti, 3)
  assert.equal(riletta?.richiesta.kind, 'salva')       // l'originale, non la sostituta
})

test('deposito durevole: i GUASTI diventano errori dichiarati, mai zero pendenze', () => {
  const finto = magazzinoFinto()
  const d = depositoOperazioniDurevole(finto.magazzino, 'p')
  d.salva(OP)
  finto.guasti.letturaRotta = true
  assert.match(d.leggi('k1').errore ?? '', /lettura negata/)
  assert.match(d.elenca().errore ?? '', /lettura negata/)
  finto.guasti.letturaRotta = false
  finto.guasti.scritturaRotta = true
  assert.match(d.salva({ ...OP, opKey: 'k2' }).errore ?? '', /quota piena/)
  assert.match(d.rimuovi('k1').errore ?? '', /quota piena/)
  finto.guasti.scritturaRotta = false
  assert.equal(d.elenca().ops?.length, 1)              // la pendenza è ancora lì
})

test('deposito durevole: contenuto corrotto o indicizzato-senza-valore → errore, mai «assente»', () => {
  const finto = magazzinoFinto()
  const d = depositoOperazioniDurevole(finto.magazzino, 'p')
  d.salva(OP)
  finto.mappa.set('p:op:k1', '{corrotto')
  assert.ok(d.leggi('k1').errore)
  finto.mappa.delete('p:op:k1')                        // indicizzata ma senza contenuto
  assert.match(d.leggi('k1').errore ?? '', /indicizzata ma senza contenuto/)
  assert.match(d.elenca().errore ?? '', /indicizzata ma senza contenuto/)
})

// ---- orchestrazione a CONTRATTO -------------------------------------------
test('giro completo: salva atomico con mappa delle voci nuove, poi conferma versionata', async () => {
  const sc = scenario()
  let s = sc.stato()
  s = modificaBozza(s, 'b1', { store: 'Esselunga' })
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 1 }, 'loc-1')
  s = modificaTotale(s, 600)
  const salvato = await sc.orch.salva(s)
  assert.equal(salvato.ok, true)
  const riga = salvato.stato.righeNuove[0]
  assert.equal(riga.stato, 'salvata')
  assert.ok(riga.id, 'la voce nuova ha l\'id dal server')
  assert.equal(sc.mondo.documenti.get('d1')?.revisione_rev, 1)
  assert.equal(sc.rev.tracce.get('d1')?.inCorso, undefined)   // annotazione tolta
  const confermato = await sc.orch.conferma(salvato.stato)
  assert.equal(confermato.ok, true, JSON.stringify(confermato))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'confermato')
  assert.equal(sc.rev.tracce.size, 0)                         // traccia rimossa
  assert.equal(sc.depOp.elenca().ops?.length, 0)              // nessuna pendenza
})

test('SUPERATA: un altro salvataggio è passato prima → errore che impone la ricarica, voci tornate «nuova»', async () => {
  const sc = scenario()
  // un ALTRO attore avanza la revisione sul server
  await sc.server.cliente.salvaRevisione({ op_key: 'altro-1', document_id: 'd1', base_rev: 0, modifiche: { kind: 'salva', document_id: 'd1', base_rev: 0, bozze: { b1: { store: 'Altro' } }, righe: {}, nuove: [] } })
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Tardiva', amount: 1 }, 'loc-t')
  const r = await sc.orch.salva(s)
  assert.equal(r.ok, false)
  assert.match(!r.ok ? r.errore : '', /ricarica/)
  assert.equal(r.stato.righeNuove[0].stato, 'nuova')
  assert.equal(sc.rev.tracce.get('d1')?.inCorso, undefined)
  assert.equal(sc.depOp.elenca().ops?.length, 0)              // SUPERATA chiude la pendenza
})

test('risposta PERSA dopo l\'effetto reale: pendenza custodita, poi l\'APERTURA la ritrova a giornale e la chiude', async () => {
  let perdi = true
  const sc = scenario(base => ({
    ...base,
    salvaRevisione: async p => {
      const r = await base.salvaRevisione(p)
      if (perdi) throw new Error('Failed to fetch (finto: risposta persa)')
      return r
    },
  }))
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Persa', amount: 1 }, 'loc-p')
  s = modificaTotale(s, 600)
  const r = await sc.orch.salva(s)
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.incerto, true)
  assert.equal(r.stato.righeNuove[0].stato, 'incerta')
  assert.equal(sc.rev.tracce.get('d1')?.inCorso?.tipo, 'salva')     // annotazione conservata
  assert.equal(sc.depOp.elenca().ops?.length, 1)                    // pendenza custodita
  // una NUOVA scrittura è vietata finché la pendenza non è riconciliata
  const vietata = await sc.orch.salva(sc.stato())
  assert.match(!vietata.ok ? vietata.errore : '', /da riconciliare/)
  // apertura: l'operazione era ARRIVATA (effetto reale) → chiusa dal giornale
  perdi = false
  const apertura = await sc.orch.apertura('d1')
  assert.equal(apertura.bloccante, undefined)
  assert.equal(apertura.risolte, 1)
  assert.match(apertura.avvisi[0], /ARRIVATA/)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
  assert.equal(sc.mondo.bozze.get('b1')?.document_id, 'd1')
  // e la revisione interna è aggiornata: il prossimo salva passa
  const dopo = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'Dopo' }))
  assert.equal(dopo.ok, true, JSON.stringify(dopo))
})

test('richiesta MAI partita: l\'apertura la REINVIA dalla custodia e la applica', async () => {
  let giu = true
  const sc = scenario(base => ({
    ...base,
    salvaRevisione: async p => {
      if (giu) throw new Error('Failed to fetch (finto: rete giù prima dell\'invio)')
      return base.salvaRevisione(p)
    },
  }))
  let s = sc.stato()
  s = modificaBozza(s, 'b1', { store: 'Mai partita' })
  const r = await sc.orch.salva(s)
  assert.equal(!r.ok && r.incerto, true)
  assert.equal(sc.depOp.elenca().ops?.length, 1)
  giu = false
  const apertura = await sc.orch.apertura('d1')
  assert.equal(apertura.risolte, 1)
  assert.match(apertura.avvisi[0], /reinviata/)
  assert.equal(sc.mondo.bozze.get('b1')?.store, 'Mai partita')      // applicata DAVVERO
  assert.equal(sc.depOp.elenca().ops?.length, 0)
})

test('recupero NON conclusivo: l\'apertura resta BLOCCANTE e la pendenza non si tocca', async () => {
  let giu = true
  const sc = scenario(base => ({
    ...base,
    salvaRevisione: async () => { throw new Error('Failed to fetch (finto)') },
    esitoRevisione: async k => { if (giu) throw new Error('Failed to fetch (finto)'); return base.esitoRevisione(k) },
  }))
  const r = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'X' }))
  assert.equal(!r.ok && r.incerto, true)
  const bloccata = await sc.orch.apertura('d1')
  assert.ok(bloccata.bloccante)
  assert.equal(sc.depOp.elenca().ops?.length, 1)                    // conservata
  giu = false                                                        // il giornale torna leggibile: assente → reinvio (che qui fallisce ancora)
  const ancora = await sc.orch.apertura('d1')
  assert.ok(ancora.bloccante)
  assert.equal(sc.depOp.elenca().ops?.length, 1)
})

test('quadratura della conferma: rifiuto DIMOSTRATO (P0001), annotazione tolta e nessuna pendenza', async () => {
  const sc = scenario()
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Squadra', amount: 1 }, 'loc-q')   // totale resta 5: 5+1 ≠ 5
  const r = await sc.orch.conferma(s)
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.incerto, undefined)
  assert.match(!r.ok ? r.errore : '', /[Qq]uadratura/)
  assert.equal(sc.rev.tracce.get('d1')?.inCorso, undefined)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
})

test('custodia della revisione ROTTA: non parte nessuna richiesta', async () => {
  const mondo: MondoFinto = {
    documenti: new Map([['d1', { status: 'in_revisione', revisione_rev: 0, doc_total: 5 }]]),
    bozze: new Map([['b1', { document_id: 'd1', status: 'da_controllare', group_id: 'g1', arrotondamento_cent: 0 }]]),
    righe: new Map([['r1', { draft_id: 'b1', amount: 5, excluded: false }]]),
  }
  const server = creaServerContratto(mondo, improntaSha256)
  const rotta = depositoRevisioneFinto({ rotta: true })
  const orch = orchestrazioneContratto({
    cliente: server.cliente, depositoRevisione: rotta.dep,
    depositoOperazioni: depositoOperazioniDurevole(magazzinoFinto().magazzino, 'p'),
    revisioneIniziale: 0,
  })
  const r = await orch.salva(modificaBozza(apriRevisione('d1', 5, [BOZZA], [RIGA], null), 'b1', { store: 'X' }))
  assert.match(!r.ok ? r.errore : '', /mettere al sicuro/)
  assert.equal(server.giornale.size, 0)                             // NESSUNA richiesta
})

test('scarto versionato: applicato e traccia rimossa', async () => {
  const sc = scenario()
  const r = await sc.orch.scarta(sc.stato(), 'foto doppia')
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'scartato')
  assert.equal(sc.rev.tracce.size, 0)
})

// ---- delega del percorso LEGACY -------------------------------------------
test('orchestrazioneLegacy: pura delega a revisioneScrittura (stessa firma, stessi servizi)', async () => {
  const chiamate: string[] = []
  const cliente = {
    aggiornaDocTotale: async () => ({ righe: 1 }),
    aggiornaBozza: async (id: string) => { chiamate.push(`bozza:${id}`); return { righe: 1 } },
    aggiornaRiga: async () => ({ righe: 1 }),
    aggiungiRiga: async () => ({ id: 'nuova-1' }),
    confermaDocumento: async () => ({ ids: ['spesa-1'] }),
    scartaDocumento: async () => ({}),
  } as unknown as ClienteRevisione
  const dep = depositoRevisioneFinto()
  const orch = orchestrazioneLegacy(cliente, dep.dep)
  const r = await orch.salva(modificaBozza(apriRevisione('d1', 5, [BOZZA], [RIGA], null), 'b1', { store: 'X' }))
  assert.equal(r.ok, true)
  assert.deepEqual(chiamate, ['bozza:b1'])
  assert.deepEqual(await orch.apertura('d1'), { risolte: 0, avvisi: [] })
})

// ---- l'hasher della piattaforma -------------------------------------------
test('improntaSha256: WebCrypto con il vettore noto', async () => {
  assert.equal(await improntaSha256(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
})
