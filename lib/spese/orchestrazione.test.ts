// ============================================================================
// Test LOCALI del CABLAGGIO del contratto: deposito operazioni DUREVOLE,
// PONTE fra le custodie, orchestrazione e RICONCILIAZIONE sul server
// finto rigoroso. Le sequenze sono COMPLETE e con custodie reali:
// risposta persa → riapertura → traccia ACQUISITA (voci «salvata» con
// l'id, vincoli sciolti) → stato ricostruito DALLA TRACCIA (mai vuoto)
// → conferma; guasto della traccia dopo il successo → il ponte conserva
// l'esito e la riapertura completa; conferma mai arrivata → la
// riconciliazione di PAGINA chiude la traccia senza montare la
// schermata; scarto vietato con pendenze; versione mancante = errore
// esplicito. Il percorso legacy resta coperto dalla sua suite.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { creaServerContratto, type MondoFinto } from './contrattoServerFinto.ts'
import type { ClienteContratto } from './contrattoRevisione.ts'
import { improntaSha256 } from './improntaTesto.ts'
import { depositoOperazioniDurevole, type MagazzinoTesto } from './depositoOperazioniDurevole.ts'
import { ponteContrattoDurevole, type RiferimentoOperazione } from './ponteContratto.ts'
import { orchestrazioneContratto, orchestrazioneLegacy, riconciliaContratto } from './orchestrazioneRevisione.ts'
import {
  aggiungiRiga, apriRevisione, modificaBozza, modificaTotale,
  type BozzaGrezza, type RigaGrezza, type TracciaRevisione,
} from './revisione.ts'
import { pendenzaNonDimostrata } from './revisioneScrittura.ts'
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

// custodia della revisione FINTA ma reale nei comportamenti: onora la
// generazione in rimozione e sa GUASTARSI (sempre, o alla N-esima
// scrittura: serve al caso «traccia finale non scrivibile»)
function depositoRevisioneFinto(guasti: { rotta?: boolean; fallisciAllaScrittura?: number } = {}) {
  const tracce = new Map<string, TracciaRevisione>()
  let scritture = 0
  const dep: DepositoRevisione = {
    salva: t => {
      if (guasti.rotta) return { errore: 'disco pieno (finto)' }
      scritture++
      if (guasti.fallisciAllaScrittura === scritture) return { errore: `scrittura ${scritture} negata (finto)` }
      tracce.set(t.documentId, JSON.parse(JSON.stringify(t))); return {}
    },
    leggi: id => guasti.rotta ? { errore: 'disco pieno (finto)' } : { traccia: tracce.get(id) },
    rimuovi: (id, gen) => {
      if (guasti.rotta) return { errore: 'disco pieno (finto)' }
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

function scenario(opz: {
  rivesti?: (base: ClienteContratto) => ClienteContratto
  revisioneIniziale?: number | null
  guastiRev?: { rotta?: boolean; fallisciAllaScrittura?: number }
} = {}) {
  const mondo: MondoFinto = {
    documenti: new Map([['d1', { status: 'in_revisione', revisione_rev: 0, doc_total: 5 }]]),
    bozze: new Map([['b1', { document_id: 'd1', status: 'da_controllare', group_id: 'g1', arrotondamento_cent: 0 }]]),
    righe: new Map([['r1', { draft_id: 'b1', amount: 5, excluded: false }]]),
  }
  const server = creaServerContratto(mondo, improntaSha256)
  const { magazzino, mappa } = magazzinoFinto()
  const depOp = depositoOperazioniDurevole(magazzino, 'prova')
  const ponte = ponteContrattoDurevole(magazzino, 'ponte')
  const rev = depositoRevisioneFinto(opz.guastiRev)
  let chiavi = 0
  const servizi = {
    cliente: opz.rivesti ? opz.rivesti(server.cliente) : server.cliente,
    depositoRevisione: rev.dep,
    depositoOperazioni: depOp,
    ponte,
  }
  const orch = orchestrazioneContratto({
    ...servizi,
    revisioneIniziale: opz.revisioneIniziale === undefined ? 0 : opz.revisioneIniziale,
    nuovaChiave: () => `00000000-0000-0000-0000-0000000000${String(++chiavi).padStart(2, '0')}`,
  })
  const stato = () => apriRevisione('d1', 5, [BOZZA], [RIGA], null)
  return { mondo, server, magazzino, mappa, depOp, ponte, rev, orch, servizi, stato }
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
  assert.equal(riletta?.richiesta.kind, 'salva')
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
  assert.equal(d.elenca().ops?.length, 1)
})

test('deposito durevole: contenuto corrotto o indicizzato-senza-valore → errore, mai «assente»', () => {
  const finto = magazzinoFinto()
  const d = depositoOperazioniDurevole(finto.magazzino, 'p')
  d.salva(OP)
  finto.mappa.set('p:op:k1', '{corrotto')
  assert.ok(d.leggi('k1').errore)
  finto.mappa.delete('p:op:k1')
  assert.match(d.leggi('k1').errore ?? '', /indicizzata ma senza contenuto/)
  assert.match(d.elenca().errore ?? '', /indicizzata ma senza contenuto/)
})

// ---- PONTE fra le custodie -------------------------------------------------
const RIF: RiferimentoOperazione = {
  opKey: 'k1', kind: 'salva', documentId: 'd1', baseRev: 0,
  impronta: 'aaa', clientRefs: ['loc-1'], inInvio: ['loc-1'], generazione: 1,
}

test('ponte: giro completo, durabilità e UNA operazione per documento', () => {
  const { magazzino } = magazzinoFinto()
  const p1 = ponteContrattoDurevole(magazzino, 'p')
  assert.deepEqual(p1.salva(RIF), {})
  assert.equal(p1.leggi('d1').rif?.opKey, 'k1')
  // stessa chiave: l'aggiornamento (es. con l'esito) passa
  assert.deepEqual(p1.salva({ ...RIF, esito: { revDopo: 1, mappaNuove: { 'loc-1': 'id-1' } } }), {})
  assert.equal(p1.leggi('d1').rif?.esito?.revDopo, 1)
  // un'ALTRA operazione sullo stesso documento è rifiutata
  assert.match(p1.salva({ ...RIF, opKey: 'k2' }).errore ?? '', /già un'operazione in ponte/)
  // durabilità: un altro ponte sullo stesso magazzino vede tutto
  const p2 = ponteContrattoDurevole(magazzino, 'p')
  assert.equal(p2.elenca().rifs?.length, 1)
  assert.deepEqual(p2.rimuovi('d1'), {})
  assert.equal(p2.leggi('d1').rif, undefined)
})

test('ponte: guasti dichiarati e corruzione mai scambiata per assenza', () => {
  const finto = magazzinoFinto()
  const p = ponteContrattoDurevole(finto.magazzino, 'p')
  p.salva(RIF)
  finto.guasti.letturaRotta = true
  assert.match(p.leggi('d1').errore ?? '', /lettura negata/)
  assert.match(p.elenca().errore ?? '', /lettura negata/)
  finto.guasti.letturaRotta = false
  finto.mappa.delete('p:doc:d1')
  assert.match(p.leggi('d1').errore ?? '', /indicizzato ma senza riferimento/)
})

// ---- orchestrazione a CONTRATTO -------------------------------------------
test('versione del documento MANCANTE: le scritture si rifiutano con l\'errore esplicito, nessuna richiesta parte', async () => {
  const sc = scenario({ revisioneIniziale: null })
  const s = modificaBozza(sc.stato(), 'b1', { store: 'X' })
  const r1 = await sc.orch.salva(s)
  assert.match(!r1.ok ? r1.errore : '', /revisione_rev.*non caricata/)
  const r2 = await sc.orch.scarta(sc.stato(), 'motivo')
  assert.match(r2.errore ?? '', /revisione_rev.*non caricata/)
  const r3 = await sc.orch.conferma(sc.stato())
  assert.match(!r3.ok ? r3.errore : '', /revisione_rev.*non caricata/)
  assert.equal(sc.server.giornale.size, 0)
})

test('giro completo: salva atomico con mappa, poi conferma versionata; ponte e custodie puliti', async () => {
  const sc = scenario()
  let s = sc.stato()
  s = modificaBozza(s, 'b1', { store: 'Esselunga' })
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sacchetto', amount: 1 }, 'loc-1')
  s = modificaTotale(s, 600)
  const salvato = await sc.orch.salva(s)
  assert.equal(salvato.ok, true, JSON.stringify(salvato))
  assert.equal(salvato.stato.righeNuove[0].stato, 'salvata')
  assert.ok(salvato.stato.righeNuove[0].id)
  assert.equal(sc.rev.tracce.get('d1')?.inCorso, undefined)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)               // ponte chiuso
  const confermato = await sc.orch.conferma(salvato.stato)
  assert.equal(confermato.ok, true, JSON.stringify(confermato))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'confermato')
  assert.equal(sc.rev.tracce.size, 0)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
})

test('SUPERATA: errore che impone la ricarica, voci «nuova», ponte chiuso', async () => {
  const sc = scenario()
  await sc.server.cliente.salvaRevisione({ op_key: 'altro-1', document_id: 'd1', base_rev: 0, modifiche: { kind: 'salva', document_id: 'd1', base_rev: 0, bozze: { b1: { store: 'Altro' } }, righe: {}, nuove: [] } })
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Tardiva', amount: 1 }, 'loc-t')
  const r = await sc.orch.salva(s)
  assert.equal(r.ok, false)
  assert.match(!r.ok ? r.errore : '', /ricarica/)
  assert.equal(r.stato.righeNuove[0].stato, 'nuova')
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
})

test('SEQUENZA COMPLETA della risposta persa: riapertura → traccia ACQUISITA (voce «salvata» con id, vincoli sciolti) → stato DALLA traccia → conferma', async () => {
  let perdi = true
  const sc = scenario({
    rivesti: base => ({
      ...base,
      salvaRevisione: async p => {
        const r = await base.salvaRevisione(p)
        if (perdi) throw new Error('Failed to fetch (finto: risposta persa)')
        return r
      },
    }),
  })
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Persa', amount: 1 }, 'loc-p')
  s = modificaTotale(s, 600)
  const r = await sc.orch.salva(s)
  assert.equal(!r.ok && r.incerto, true)
  assert.equal(r.stato.righeNuove[0].stato, 'incerta')
  assert.equal(sc.rev.tracce.get('d1')?.inCorso?.tipo, 'salva')
  assert.equal(sc.depOp.elenca().ops?.length, 1)
  assert.equal(sc.ponte.leggi('d1').rif?.opKey, r.stato ? sc.ponte.leggi('d1').rif?.opKey : '')
  // scritture NUOVE vietate finché non si riconcilia — Scarta compreso
  const salvaVietato = await sc.orch.salva(sc.stato())
  assert.match(!salvaVietato.ok ? salvaVietato.errore : '', /da riconciliare/)
  const scartoVietato = await sc.orch.scarta(sc.stato(), 'motivo')
  assert.match(scartoVietato.errore ?? '', /da riconciliare/)
  // riapertura: la riconciliazione ACQUISISCE nella traccia
  perdi = false
  const apertura = await sc.orch.apertura('d1')
  assert.equal(apertura.bloccante, undefined, JSON.stringify(apertura))
  assert.equal(apertura.risolte, 1)
  assert.match(apertura.avvisi[0], /ARRIVATA/)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
  const traccia = sc.rev.tracce.get('d1')
  assert.ok(traccia, 'la traccia della revisione esiste ancora')
  assert.equal(traccia!.righeNuove[0].stato, 'salvata')          // NON più «incerta»
  assert.ok(traccia!.righeNuove[0].id, 'la voce ha l\'id dal giornale')
  assert.equal(traccia!.inCorso, undefined)
  assert.equal(traccia!.vincoli, undefined)
  // lo stato RIPARTE dalla traccia persistita (mai vuoto): la conferma passa
  const s2 = apriRevisione('d1', 6, [BOZZA], [RIGA], traccia!)
  assert.equal(pendenzaNonDimostrata(s2), undefined)
  const confermato = await sc.orch.conferma(s2)
  assert.equal(confermato.ok, true, JSON.stringify(confermato))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'confermato')
})

test('successo ma TRACCIA FINALE non scrivibile: il ponte conserva l\'esito e la riapertura completa l\'acquisizione', async () => {
  // scritture della traccia in un Salva: 1) annota, 2) presa in_invio,
  // 3) chiusura con le voci «salvata» — si fa fallire la TERZA
  const sc = scenario({ guastiRev: { fallisciAllaScrittura: 3 } })
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Sospesa', amount: 1 }, 'loc-s')
  s = modificaTotale(s, 600)
  const r = await sc.orch.salva(s)
  assert.equal(r.ok, true, JSON.stringify(r))                    // il salvataggio È applicato
  assert.match(r.ok ? r.avviso ?? '' : '', /traccia non aggiornata/)
  assert.equal(sc.depOp.elenca().ops?.length, 0)                 // l'operazione si è risolta…
  const rif = sc.ponte.leggi('d1').rif
  assert.ok(rif?.esito, '…ma il PONTE conserva l\'esito con la mappa')
  assert.ok(rif!.esito!.mappaNuove['loc-s'])
  // la traccia è rimasta indietro: voce ancora «in_invio»
  assert.equal(sc.rev.tracce.get('d1')?.righeNuove[0].stato, 'in_invio')
  // riapertura: l'acquisizione si completa dal ponte (il deposito è vuoto)
  const apertura = await sc.orch.apertura('d1')
  assert.equal(apertura.bloccante, undefined, JSON.stringify(apertura))
  assert.equal(apertura.risolte, 1)
  assert.match(apertura.avvisi[0], /già custodito nel ponte/)
  const traccia = sc.rev.tracce.get('d1')
  assert.equal(traccia?.righeNuove[0].stato, 'salvata')
  assert.ok(traccia?.righeNuove[0].id)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
})

test('conferma MAI ARRIVATA al client: la riconciliazione di PAGINA chiude la traccia SENZA montare la schermata', async () => {
  let perdi = true
  const sc = scenario({
    rivesti: base => ({
      ...base,
      confermaRevisione: async p => {
        const r = await base.confermaRevisione(p)
        if (perdi) throw new Error('Failed to fetch (finto: risposta persa)')
        return r
      },
    }),
  })
  const r = await sc.orch.conferma(sc.stato())                   // doc quadra già (5 = 5)
  assert.equal(!r.ok && r.incerto, true, JSON.stringify(r))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'confermato')   // effetto REALE
  assert.equal(sc.rev.tracce.get('d1')?.inCorso?.tipo, 'conferma')
  perdi = false
  // il documento è CHIUSO: la schermata non monterebbe più — la
  // riconciliazione della pagina non ne ha bisogno
  const esito = await riconciliaContratto(sc.servizi)
  assert.equal(esito.bloccante, undefined, JSON.stringify(esito))
  assert.equal(esito.risolte, 1)
  assert.equal(sc.rev.tracce.size, 0)                            // traccia RIMOSSA
  assert.equal(sc.depOp.elenca().ops?.length, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
  assert.equal(esito.revPerDocumento.d1, 1)
})

test('riferimento in ponte SENZA esito e giornale che non lo conosce: nulla applicato, voci di nuovo modificabili', async () => {
  const sc = scenario()
  // custodia manuale: un riferimento pre-invio la cui richiesta non è
  // mai partita (nessuna registrazione, nessuna riga a giornale)
  sc.ponte.salva({ opKey: 'mai-partita', kind: 'salva', documentId: 'd1', baseRev: 0, impronta: 'x', clientRefs: ['loc-m'], inInvio: ['loc-m'], generazione: 1 })
  const traccia = { ...JSON.parse(JSON.stringify(tracciaBase())), righeNuove: [{ idLocale: 'loc-m', draft_id: 'b1', name: 'Mai', qty: 1, unit_price: null, discount: 0, amount: 1, stato: 'in_invio' }] }
  sc.rev.tracce.set('d1', traccia as TracciaRevisione)
  const esito = await sc.orch.apertura('d1')
  assert.equal(esito.bloccante, undefined, JSON.stringify(esito))
  assert.equal(esito.risolte, 1)
  assert.match(esito.avvisi.join(' '), /non risulta a giornale/)
  assert.equal(sc.rev.tracce.get('d1')?.righeNuove[0].stato, 'nuova')
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
})

test('recupero NON conclusivo: BLOCCANTE, pendenza conservata', async () => {
  let giu = true
  const sc = scenario({
    rivesti: base => ({
      ...base,
      salvaRevisione: async () => { throw new Error('Failed to fetch (finto)') },
      esitoRevisione: async k => { if (giu) throw new Error('Failed to fetch (finto)'); return base.esitoRevisione(k) },
    }),
  })
  const r = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'X' }))
  assert.equal(!r.ok && r.incerto, true)
  const bloccata = await sc.orch.apertura('d1')
  assert.ok(bloccata.bloccante)
  assert.equal(sc.depOp.elenca().ops?.length, 1)
  giu = false
  const ancora = await sc.orch.apertura('d1')
  assert.ok(ancora.bloccante)                                    // il reinvio fallisce ancora
  assert.equal(sc.depOp.elenca().ops?.length, 1)
})

test('richiesta MAI partita ma registrata: la riapertura la REINVIA dalla custodia e la acquisisce', async () => {
  let giu = true
  const sc = scenario({
    rivesti: base => ({
      ...base,
      salvaRevisione: async p => {
        if (giu) throw new Error('Failed to fetch (finto: rete giù prima dell\'invio)')
        return base.salvaRevisione(p)
      },
    }),
  })
  const r = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'Mai partita' }))
  assert.equal(!r.ok && r.incerto, true)
  giu = false
  const apertura = await sc.orch.apertura('d1')
  assert.equal(apertura.risolte, 1)
  assert.match(apertura.avvisi[0], /reinviata/)
  assert.equal(sc.mondo.bozze.get('b1')?.store, 'Mai partita')
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
  assert.equal(sc.rev.tracce.get('d1')?.inCorso, undefined)
})

test('quadratura della conferma: rifiuto DIMOSTRATO (P0001), annotazione tolta, ponte e deposito puliti', async () => {
  const sc = scenario()
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Squadra', amount: 1 }, 'loc-q')
  const r = await sc.orch.conferma(s)
  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.incerto, undefined)
  assert.match(!r.ok ? r.errore : '', /[Qq]uadratura/)
  assert.equal(sc.rev.tracce.get('d1')?.inCorso, undefined)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
})

test('custodia della revisione ROTTA: non parte nessuna richiesta', async () => {
  const sc = scenario({ guastiRev: { rotta: true } })
  const r = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'X' }))
  assert.match(!r.ok ? r.errore : '', /mettere al sicuro/)
  assert.equal(sc.server.giornale.size, 0)
})

test('scarto versionato: applicato, traccia e ponte puliti', async () => {
  const sc = scenario()
  const r = await sc.orch.scarta(sc.stato(), 'foto doppia')
  assert.equal(r.ok, true, JSON.stringify(r))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'scartato')
  assert.equal(sc.rev.tracce.size, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
})

// una traccia di base per i casi costruiti a mano
function tracciaBase(): TracciaRevisione {
  return {
    documentId: 'd1', generazione: 1, docTotaleCent: 500, docTotaleOriginaleCent: 500,
    originaliBozze: {}, originaliRighe: {}, modificheBozze: {}, modificheRighe: {}, righeNuove: [],
  }
}

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
  assert.deepEqual(await orch.apertura('d1'), { risolte: 0, avvisi: [], revPerDocumento: {} })
})

// ---- l'hasher della piattaforma -------------------------------------------
test('improntaSha256: WebCrypto con il vettore noto', async () => {
  assert.equal(await improntaSha256(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
})
