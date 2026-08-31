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
      // come il deposito VERO: una scrittura di generazione superata
      // non tocca lo stato più recente
      const esistente = tracce.get(t.documentId)
      if (esistente && (esistente.generazione ?? 0) > (t.generazione ?? 0))
        return { errore: `custodia superata: c'è uno stato più recente del documento (generazione ${esistente.generazione ?? 0} > ${t.generazione ?? 0}) — questa scrittura vecchia non lo tocca` }
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
  const nuovaChiave = () => `00000000-0000-0000-0000-0000000000${String(++chiavi).padStart(2, '0')}`
  const servizi = {
    cliente: opz.rivesti ? opz.rivesti(server.cliente) : server.cliente,
    depositoRevisione: rev.dep,
    depositoOperazioni: depOp,
    ponte,
  }
  const orch = orchestrazioneContratto({
    ...servizi,
    revisioneIniziale: opz.revisioneIniziale === undefined ? 0 : opz.revisioneIniziale,
    nuovaChiave,
  })
  // la PAGINA RICREATA: istanze NUOVE dei depositi sullo stesso
  // magazzino (come una ricarica sul medesimo localStorage) e
  // orchestrazione nuova con la versione riletta dalla «fonte» (mondo)
  const ricrea = (revIniz?: number | null) => {
    const servizi2 = {
      cliente: servizi.cliente,
      depositoRevisione: rev.dep,
      depositoOperazioni: depositoOperazioniDurevole(magazzino, 'prova'),
      ponte: ponteContrattoDurevole(magazzino, 'ponte'),
    }
    return {
      servizi: servizi2,
      orch: orchestrazioneContratto({
        ...servizi2,
        revisioneIniziale: revIniz === undefined ? mondo.documenti.get('d1')!.revisione_rev : revIniz,
        nuovaChiave,
      }),
    }
  }
  const stato = () => apriRevisione('d1', 5, [BOZZA], [RIGA], null)
  // la RIAPERTURA della schermata: stato ricostruito dalla traccia
  const riapri = (docTotale = 5) => apriRevisione('d1', docTotale, [BOZZA], [RIGA], rev.tracce.get('d1') ?? null)
  return { mondo, server, magazzino, mappa, depOp, ponte, rev, orch, servizi, stato, ricrea, riapri }
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
  // PAGINA RICREATA (istanze nuove sullo stesso magazzino, versione
  // riletta dalla fonte): la riconciliazione ACQUISISCE nella traccia
  perdi = false
  const pagina2 = sc.ricrea()
  const apertura = await pagina2.orch.apertura('d1')
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
  // UNA SOLA voce sul server, con l'ID REALE della traccia; originali conservati
  const persaSulServer = [...sc.mondo.righe.entries()].filter(([, r2]) => (r2 as { name?: string }).name === 'Persa')
  assert.equal(persaSulServer.length, 1, 'nessun doppione della voce')
  assert.equal(persaSulServer[0][0], traccia!.righeNuove[0].id)
  assert.ok(Object.keys(traccia!.originaliBozze).length > 0, 'gli originali restano custoditi')
  // SECONDA riapertura (di nuovo pagina ricreata): nulla da risolvere,
  // lo stato riparte dalla traccia persistita (mai vuoto)
  const pagina3 = sc.ricrea()
  const seconda = await pagina3.orch.apertura('d1')
  assert.equal(seconda.risolte, 0)
  assert.equal(seconda.bloccante, undefined)
  const s2 = sc.riapri(6)
  assert.equal(s2.righeNuove[0].stato, 'salvata')
  assert.equal(pendenzaNonDimostrata(s2), undefined)
  const confermato = await pagina3.orch.conferma(s2)
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
  // la traccia è rimasta indietro: voce ancora «in_invio» — e NESSUN
  // falso «zero pendenze»: il ponte elenca il riferimento con la chiave
  assert.equal(sc.rev.tracce.get('d1')?.righeNuove[0].stato, 'in_invio')
  assert.equal(sc.ponte.elenca().rifs?.[0]?.opKey, rif!.opKey)
  // ripristino con PAGINA RICREATA: l'acquisizione si completa dal
  // ponte PER IDENTITÀ (il deposito operazioni è vuoto)
  const apertura = await sc.ricrea().orch.apertura('d1')
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

test('recupero NON conclusivo: BLOCCANTE e niente scritture; ripristino → ripresa guidata', async () => {
  let giu = true
  let rotto = true
  const aggiusta = () => { rotto = false }
  const sc = scenario({
    rivesti: base => ({
      ...base,
      salvaRevisione: async p => { if (rotto) throw new Error('Failed to fetch (finto)'); return base.salvaRevisione(p) },
      esitoRevisione: async k => { if (giu) throw new Error('Failed to fetch (finto)'); return base.esitoRevisione(k) },
    }),
  })
  void aggiusta
  const r = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'X' }))
  assert.equal(!r.ok && r.incerto, true)
  const bloccata = await sc.orch.apertura('d1')
  assert.ok(bloccata.bloccante)
  assert.equal(sc.depOp.elenca().ops?.length, 1)
  // durante la sospensione anche lo SCARTO è vietato
  const scartoVietato = await sc.orch.scarta(sc.stato(), 'motivo')
  assert.match(scartoVietato.errore ?? '', /da riconciliare/)
  giu = false
  const ancora = await sc.orch.apertura('d1')
  assert.ok(ancora.bloccante)                                    // il reinvio fallisce ancora
  assert.equal(sc.depOp.elenca().ops?.length, 1)
  // RIPRISTINATA anche la scrittura: la ripresa risolve e le scritture
  // nuove tornano possibili, senza responsabilità perse
  aggiusta()
  const ripresa = await sc.orch.apertura('d1')
  assert.equal(ripresa.bloccante, undefined, JSON.stringify(ripresa))
  assert.equal(ripresa.risolte, 1)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
  const dopo = await sc.orch.salva(modificaBozza(sc.riapri(), 'b1', { store: 'Ripresa' }))
  assert.equal(dopo.ok, true, JSON.stringify(dopo))
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


// ---- C01/C02: il giro della VERSIONE lungo la sessione ----------------------
test('C01 · due Salva consecutivi con rilettura, poi riapertura e conferma: versione aggiornata, mai SUPERATA spuria', async () => {
  const sc = scenario()
  const primo = await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'Primo' }))
  assert.equal(primo.ok, true, JSON.stringify(primo))
  assert.equal(sc.mondo.documenti.get('d1')?.revisione_rev, 1)
  // rilettura della fonte + controller ricreato (come fa la pagina dopo
  // «Modifiche salvate» → ricarica): la versione arriva dalla fonte
  const pagina2 = sc.ricrea()
  const secondo = await pagina2.orch.salva(modificaBozza(sc.riapri(), 'b1', { store: 'Secondo' }))
  assert.equal(secondo.ok, true, JSON.stringify(secondo))        // NESSUNA SUPERATA spuria
  assert.equal(sc.mondo.documenti.get('d1')?.revisione_rev, 2)
  assert.equal(sc.mondo.bozze.get('b1')?.store, 'Secondo')
  // chiusura/riapertura e CONFERMA sull'ultima versione
  const pagina3 = sc.ricrea()
  const confermato = await pagina3.orch.conferma(sc.riapri())
  assert.equal(confermato.ok, true, JSON.stringify(confermato))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'confermato')
})

test('C02 · controller ricreato coerente con la sessione; conflitto AUTENTICO → stop esplicito, nessun inseguimento', async () => {
  const sc = scenario()
  await sc.orch.salva(modificaBozza(sc.stato(), 'b1', { store: 'Mio' }))
  // il controller si ricrea (rerender/ricarica) e resta coerente
  const pagina2 = sc.ricrea()
  const ok2 = await pagina2.orch.salva(modificaBozza(sc.riapri(), 'b1', { expense_date: '2026-09-01' }))
  assert.equal(ok2.ok, true, JSON.stringify(ok2))
  // conflitto AUTENTICO: un altro attore avanza la revisione a 3
  await sc.server.cliente.salvaRevisione({ op_key: 'altro-c02', document_id: 'd1', base_rev: 2, modifiche: { kind: 'salva', document_id: 'd1', base_rev: 2, bozze: { b1: { store: 'Altrui' } }, righe: {}, nuove: [] } })
  const tardivo = await pagina2.orch.salva(modificaBozza(sc.riapri(), 'b1', { store: 'Tardivo' }))
  assert.equal(tardivo.ok, false)
  assert.match(!tardivo.ok ? tardivo.errore : '', /ricarica/)
  // NESSUN inseguimento silenzioso: senza ricaricare resta il conflitto,
  // e il valore altrui NON è stato sovrascritto
  const ancora = await pagina2.orch.salva(modificaBozza(sc.riapri(), 'b1', { store: 'Tardivo' }))
  assert.equal(ancora.ok, false)
  assert.equal(sc.mondo.bozze.get('b1')?.store, 'Altrui')
})

// ---- C05: chiusure perse nei DUE versi --------------------------------------
test('C05 · scarto APPLICATO con risposta persa: la riconciliazione di pagina chiude traccia e pendenze', async () => {
  let perdi = true
  const sc = scenario({
    rivesti: base => ({
      ...base,
      scartaRevisione: async p => {
        const r = await base.scartaRevisione(p)
        if (perdi) throw new Error('Failed to fetch (finto: risposta persa)')
        return r
      },
    }),
  })
  const r = await sc.orch.scarta(sc.stato(), 'doppione')
  assert.equal(r.ok, false)
  assert.equal(r.incerto, true)
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'scartato')     // effetto REALE
  perdi = false
  const esito = await riconciliaContratto(sc.ricrea().servizi)       // pagina, senza schermata
  assert.equal(esito.bloccante, undefined, JSON.stringify(esito))
  assert.equal(esito.risolte, 1)
  assert.equal(sc.rev.tracce.size, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
  assert.equal(sc.depOp.elenca().ops?.length, 0)
})

test('C05 · conferma MAI PARTITA: la riapertura la reinvia dalla custodia e chiude il documento', async () => {
  let giu = true
  const sc = scenario({
    rivesti: base => ({
      ...base,
      confermaRevisione: async p => {
        if (giu) throw new Error('Failed to fetch (finto: rete giù prima dell\'invio)')
        return base.confermaRevisione(p)
      },
    }),
  })
  const r = await sc.orch.conferma(sc.stato())
  assert.equal(!r.ok && r.incerto, true, JSON.stringify(r))
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'in_revisione') // NON applicata
  giu = false
  const esito = await riconciliaContratto(sc.ricrea().servizi)
  assert.equal(esito.bloccante, undefined, JSON.stringify(esito))
  assert.equal(esito.risolte, 1)
  assert.match(esito.avvisi.join(' '), /reinviata/)
  assert.equal(sc.mondo.documenti.get('d1')?.status, 'confermato')   // l'intento dell'utente si completa
  assert.equal(sc.rev.tracce.size, 0)
  assert.equal(sc.ponte.elenca().rifs?.length, 0)
})

// ---- C07: schermata SUPERATA e doppio invio ---------------------------------
test('C07 · schermata superata (generazione più vecchia): nessuna scrittura nuova, custodia recente intatta', async () => {
  const sc = scenario()
  const vecchia = sc.stato()                                         // generazione 1
  // una SECONDA apertura prende in carico il documento (generazione 2)
  const nuova = apriRevisione('d1', 5, [BOZZA], [RIGA], (() => {
    const t = JSON.parse(JSON.stringify(tracciaBase())); t.generazione = 1; return t
  })())
  assert.equal(nuova.generazione, 2)
  const presa = sc.rev.dep.salva({ ...tracciaBase(), generazione: 2 })
  assert.deepEqual(presa, {})
  // il Salva della schermata VECCHIA si ferma senza toccare nulla
  const r = await sc.orch.salva(modificaBozza(vecchia, 'b1', { store: 'Vecchio' }))
  assert.equal(r.ok, false)
  assert.match(!r.ok ? r.errore : '', /custodia superata|generazione/)
  assert.equal(sc.server.giornale.size, 0)                           // nessuna richiesta
  assert.equal(sc.rev.tracce.get('d1')?.generazione, 2)              // la custodia recente resta
  // anche lo SCARTO della schermata vecchia si ferma
  const scarto = await sc.orch.scarta(modificaBozza(vecchia, 'b1', {}), 'motivo')
  assert.equal(scarto.ok, false)
  assert.match(scarto.errore ?? '', /custodia superata|generazione/)
})

test('C07 · doppio tocco: la schermata riparte dallo stato AGGIORNATO dall\'esito — nessun doppione, una sola operazione logica', async () => {
  const sc = scenario()
  let s = sc.stato()
  s = aggiungiRiga(s, { draft_id: 'b1', name: 'Doppia', amount: 1 }, 'loc-d')
  const primo = await sc.orch.salva(s)
  assert.equal(primo.ok, true)
  // la schermata fa setStato(esito.stato): il secondo tocco parte dallo
  // stato in cui la voce è già «salvata» → batch VUOTO, nessun reinvio
  const secondo = await sc.orch.salva(primo.stato)
  assert.equal(secondo.ok, true, JSON.stringify(secondo))
  const doppie = [...sc.mondo.righe.values()].filter(r2 => (r2 as { name?: string }).name === 'Doppia')
  assert.equal(doppie.length, 1)
  assert.equal(sc.server.giornale.size, 1)                          // UNA operazione logica
  // (il doppio tocco RAVVICINATO è già fermato dalla guardia d'invio
  // della schermata, e il replay per chiave dal contratto collaudato)
})

// ---- C10: l'interruttore operativo resta su LEGACY --------------------------
test('C10 · PERCORSO_REVISIONE è \'legacy\': la pagina operativa non costruisce il percorso contratto', async () => {
  const { PERCORSO_REVISIONE } = await import('./percorso.ts')
  assert.equal(PERCORSO_REVISIONE, 'legacy')
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
