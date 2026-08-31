// ============================================================================
// SERVER FINTO E RIGOROSO del contratto di revisione — riproduce la
// semantica della futura RPC (PROPOSTA-RECUPERO-REVISIONE.md §2) per i
// test locali: giornale per op_key, revisione_rev per documento, lista
// POSITIVA degli stati modificabili (documento E bozze), perimetro del
// batch, whitelist dei campi coi vincoli 0020 sui valori, replay con
// confronto di documento+kind+base_rev+impronta, serializzazione per
// documento (il «lock di riga»), atomicità tutto-o-niente.
// La CONFERMA rifà la quadratura esatta e il destinatario obbligatorio
// (come spese_crea_da_bozze) e i rifiuti del server viaggiano come
// { errore } — la forma con cui la RPC vera rende le sue eccezioni.
// COSA NON MODELLA, dichiarato: RLS e ruoli, il vero isolamento Read
// Committed e i lock di PostgreSQL, i tipi numeric (qui numeri JS), le
// FK (composita canonica compresa), i trigger (user_added), il metodo
// obbligatorio per l'ambito azienda (non conosce i gruppi), la
// creazione reale delle spese. NON è una prova del comportamento
// PostgreSQL: la verità resterà l'implementazione SQL, da collaudare
// in ambiente isolato con autorizzazione separata.
// ============================================================================
import {
  canonico, manifestoConferma, manifestoScarto,
  type ClienteContratto, type EsitoGiornale,
  type HasherTesto, type RispostaContratto,
} from './contrattoRevisione.ts'
import { CAMPI_BOZZA_REVISIONE, CAMPI_RIGA_NUOVA, CAMPI_RIGA_REVISIONE } from './revisione.ts'

export type MondoFinto = {
  documenti: Map<string, { status: string; revisione_rev: number; doc_total: number | null }>
  bozze: Map<string, { document_id: string; status: string } & Record<string, unknown>>
  righe: Map<string, { draft_id: string } & Record<string, unknown>>
}

type Registro = {
  document_id: string; kind: 'salva' | 'conferma' | 'scarto'
  base_rev: number; manifesto_sha256: string
  esito: { rev_dopo: number; righe_nuove?: { client_ref: string; id: string }[]; spese?: string[] }
}

const STATI_DOC_MODIFICABILI = ['in_revisione']
const STATI_BOZZA_MODIFICABILI = ['da_controllare', 'pronta']

export function creaServerContratto(mondo: MondoFinto, hasher: HasherTesto) {
  const giornale = new Map<string, Registro>()
  let contatore = 0
  // il «lock di riga»: le operazioni sullo stesso documento si
  // SERIALIZZANO (catena di promesse per documento)
  const code = new Map<string, Promise<unknown>>()
  const serializzato = <T>(documentId: string, corpo: () => Promise<T>): Promise<T> => {
    const coda = (code.get(documentId) ?? Promise.resolve()).then(corpo, corpo)
    code.set(documentId, coda.catch(() => {}))
    return coda
  }
  // ganci per i test: sospendere l'effetto o perdere la risposta
  const guasti = { sospendi: null as null | (() => Promise<void>), perdiRisposta: false }

  const replay = (opKey: string, documentId: string, kind: Registro['kind'], baseRev: number, impronta: string): RispostaContratto | null => {
    const r = giornale.get(opKey)
    if (!r) return null
    if (r.document_id !== documentId || r.kind !== kind || r.base_rev !== baseRev || r.manifesto_sha256 !== impronta)
      return { esito: 'CHIAVE_RIUSATA', dettaglio: 'stessa chiave con documento, tipo, revisione o contenuto diversi' }
    return { esito: 'RIPETUTA', rev_dopo: r.esito.rev_dopo, righe_nuove: r.esito.righe_nuove ?? [], ...(r.esito.spese ? { spese: r.esito.spese } : {}) }
  }

  const cliente: ClienteContratto = {
    salvaRevisione: p => serializzato(p.document_id, async () => {
      if (guasti.sospendi) await guasti.sospendi()
      // il server RICALCOLA il manifesto canonico dai parametri ricevuti
      const impronta = await hasher(canonico({ ...p.modifiche, kind: 'salva', document_id: p.document_id, base_rev: p.base_rev }))
      const rip = replay(p.op_key, p.document_id, 'salva', p.base_rev, impronta)
      if (rip) return rip
      const doc = mondo.documenti.get(p.document_id)
      if (!doc) return { esito: 'IDENTIFICATIVO_MANCANTE', dettaglio: 'documento inesistente' }
      if (!STATI_DOC_MODIFICABILI.includes(doc.status))
        return { esito: 'DOCUMENTO_NON_MODIFICABILE', dettaglio: `stato «${doc.status}»` }
      if (p.base_rev !== doc.revisione_rev) return { esito: 'SUPERATA' }
      const b = p.modifiche
      if (typeof b !== 'object' || b === null || !b.bozze || !b.righe || !Array.isArray(b.nuove))
        return { esito: 'MODIFICHE_MALFORMATE' }
      // PERIMETRO e stati delle bozze — tutto verificato PRIMA di scrivere
      const refs = new Set<string>()
      for (const n of b.nuove) {
        if (!n.client_ref) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'voce nuova senza client_ref' }
        if (refs.has(n.client_ref)) return { esito: 'CLIENT_REF_DUPLICATO' }
        refs.add(n.client_ref)
      }
      const bozzaValida = (id: string): RispostaContratto | null => {
        const bz = mondo.bozze.get(id)
        if (!bz) return { esito: 'IDENTIFICATIVO_MANCANTE', dettaglio: `bozza ${id}` }
        if (bz.document_id !== p.document_id) return { esito: 'RIFERIMENTO_ESTRANEO', dettaglio: `bozza ${id} di un altro documento` }
        if (!STATI_BOZZA_MODIFICABILI.includes(bz.status)) return { esito: 'BOZZA_NON_MODIFICABILE', dettaglio: `bozza ${id} in «${bz.status}»` }
        return null
      }
      for (const id of Object.keys(b.bozze)) { const e = bozzaValida(id); if (e) return e }
      for (const [id, campi] of Object.entries(b.righe)) {
        const r = mondo.righe.get(id)
        if (!r) return { esito: 'IDENTIFICATIVO_MANCANTE', dettaglio: `riga ${id}` }
        const e = bozzaValida(r.draft_id as string); if (e) return e
        for (const k of Object.keys(campi)) if (!CAMPI_RIGA_REVISIONE.includes(k as never)) return { esito: 'CAMPO_NON_CONSENTITO', dettaglio: k }
        // i CHECK 0020 valgono anche sugli UPDATE delle righe esistenti
        const c = campi as Record<string, unknown>
        for (const k of ['name', 'qty', 'discount', 'amount']) if (k in c && c[k] == null) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: `null vietato su ${k}` }
        if ('qty' in c && (typeof c.qty !== 'number' || c.qty <= 0)) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'vincolo violato: qty > 0' }
        if ('amount' in c && (typeof c.amount !== 'number' || c.amount < 0)) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'vincolo violato: amount >= 0' }
        if ('discount' in c && (typeof c.discount !== 'number' || c.discount < 0)) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'vincolo violato: discount >= 0' }
        if ('unit_price' in c && c.unit_price !== null && (typeof c.unit_price !== 'number' || c.unit_price < 0)) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'vincolo violato: unit_price null o >= 0' }
        if ('name' in c && (typeof c.name !== 'string' || !c.name)) return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'vincolo violato: name non vuoto' }
      }
      for (const [, campi] of Object.entries(b.bozze))
        for (const k of Object.keys(campi)) if (!CAMPI_BOZZA_REVISIONE.includes(k as never)) return { esito: 'CAMPO_NON_CONSENTITO', dettaglio: k }
      for (const n of b.nuove) {
        const e = bozzaValida(n.draft_id); if (e) return e
        for (const k of Object.keys(n)) if (k !== 'client_ref' && !CAMPI_RIGA_NUOVA.includes(k as never)) return { esito: 'CAMPO_NON_CONSENTITO', dettaglio: k }
        if (n.qty == null || n.qty <= 0 || n.discount == null || n.discount < 0 || n.amount == null || n.amount < 0 || !n.name)
          return { esito: 'MODIFICHE_MALFORMATE', dettaglio: 'vincoli 0020 sulla voce nuova' }
      }
      // APPLICAZIONE atomica (a questo punto niente può più fallire)
      if ('doc_total' in b) doc.doc_total = b.doc_total ?? null
      for (const [id, campi] of Object.entries(b.bozze)) Object.assign(mondo.bozze.get(id)!, campi)
      for (const [id, campi] of Object.entries(b.righe)) Object.assign(mondo.righe.get(id)!, campi)
      const mappa: { client_ref: string; id: string }[] = []
      for (const n of b.nuove) {
        const id = `srv-${++contatore}`
        const { client_ref, ...payload } = n
        mondo.righe.set(id, { ...payload, user_added: true, excluded: false } as never)
        mappa.push({ client_ref, id })
      }
      doc.revisione_rev += 1
      giornale.set(p.op_key, { document_id: p.document_id, kind: 'salva', base_rev: p.base_rev, manifesto_sha256: impronta, esito: { rev_dopo: doc.revisione_rev, righe_nuove: mappa } })
      if (guasti.perdiRisposta) throw new Error('Failed to fetch (finto: effetto applicato, risposta persa)')
      return { esito: 'APPLICATA', rev_dopo: doc.revisione_rev, righe_nuove: mappa }
    }),

    confermaRevisione: p => serializzato(p.document_id, async () => {
      const impronta = await hasher(manifestoConferma(p.document_id, p.base_rev, p.correzioni))
      const rip = replay(p.op_key, p.document_id, 'conferma', p.base_rev, impronta)
      if (rip) return rip
      const doc = mondo.documenti.get(p.document_id)
      if (!doc) return { esito: 'IDENTIFICATIVO_MANCANTE' }
      if (!STATI_DOC_MODIFICABILI.includes(doc.status)) return { esito: 'DOCUMENTO_NON_MODIFICABILE', dettaglio: `stato «${doc.status}»` }
      if (p.base_rev !== doc.revisione_rev) return { esito: 'SUPERATA' }
      // i CONTROLLI della conferma vera (spese_crea_da_bozze): destinatario
      // obbligatorio e QUADRATURA ESATTA in centesimi — un rifiuto viaggia
      // come { errore }, la forma delle eccezioni della RPC
      const attive = [...mondo.bozze.entries()].filter(([, bz]) => bz.document_id === p.document_id && STATI_BOZZA_MODIFICABILI.includes(bz.status))
      if (attive.length === 0) return { errore: 'nessuna bozza attiva da confermare', codice: 'P0001' }
      let sommaCent = 0
      for (const [bId, bz] of attive) {
        if (!('group_id' in bz) || bz.group_id == null) return { errore: `destinatario mancante sulla bozza ${bId}`, codice: 'P0001' }
        sommaCent += Number((bz as Record<string, unknown>).arrotondamento_cent ?? 0)
        for (const r of mondo.righe.values())
          if (r.draft_id === bId && !(r as Record<string, unknown>).excluded)
            sommaCent += Math.round(Number((r as Record<string, unknown>).amount) * 100)
      }
      const totCent = doc.doc_total == null ? null : Math.round(doc.doc_total * 100)
      if (totCent == null || totCent !== sommaCent)
        return { errore: `Quadratura non esatta: righe+arrotondamento=${sommaCent} cent, documento=${totCent ?? 'null'} cent`, codice: 'P0001' }
      doc.status = 'confermato'; doc.revisione_rev += 1
      for (const [, bz] of attive) bz.status = 'confermata'
      const spese = [`spesa-${++contatore}`]
      giornale.set(p.op_key, { document_id: p.document_id, kind: 'conferma', base_rev: p.base_rev, manifesto_sha256: impronta, esito: { rev_dopo: doc.revisione_rev, spese } })
      return { esito: 'APPLICATA', rev_dopo: doc.revisione_rev, spese }
    }),

    scartaRevisione: p => serializzato(p.document_id, async () => {
      const impronta = await hasher(manifestoScarto(p.document_id, p.base_rev, p.motivo))
      const rip = replay(p.op_key, p.document_id, 'scarto', p.base_rev, impronta)
      if (rip) return rip
      const doc = mondo.documenti.get(p.document_id)
      if (!doc) return { esito: 'IDENTIFICATIVO_MANCANTE' }
      if (!STATI_DOC_MODIFICABILI.includes(doc.status)) return { esito: 'DOCUMENTO_NON_MODIFICABILE', dettaglio: `stato «${doc.status}»` }
      if (p.base_rev !== doc.revisione_rev) return { esito: 'SUPERATA' }
      doc.status = 'scartato'; doc.revisione_rev += 1
      for (const bz of mondo.bozze.values()) if (bz.document_id === p.document_id && STATI_BOZZA_MODIFICABILI.includes(bz.status)) bz.status = 'scartata'
      giornale.set(p.op_key, { document_id: p.document_id, kind: 'scarto', base_rev: p.base_rev, manifesto_sha256: impronta, esito: { rev_dopo: doc.revisione_rev } })
      return { esito: 'APPLICATA', rev_dopo: doc.revisione_rev }
    }),

    async esitoRevisione(opKey): Promise<EsitoGiornale> {
      if (guasti.sospendi) await guasti.sospendi()
      const r = giornale.get(opKey)
      if (!r) return { stato: 'assente' }
      return { stato: 'applicata', document_id: r.document_id, kind: r.kind, base_rev: r.base_rev, manifesto_sha256: r.manifesto_sha256, esito: r.esito }
    },
  }
  return { cliente, giornale, guasti }
}
