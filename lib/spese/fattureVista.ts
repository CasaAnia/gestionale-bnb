// ============================================================================
// FATTURE — LETTURE PURE (Fase 5): scadenzario e dettaglio di una fattura
// dallo schema reale (0020), in sola lettura. Regole:
//  · «scaduta» è uno stato DERIVATO: fattura approvata_da_pagare con
//    scadenza superata; «in scadenza» = entro GIORNI_PREAVVISO giorni
//    (oggi compreso); una fattura pagata non è mai scaduta;
//  · il dettaglio si legge anche DOPO il pagamento: le righe vengono dalle
//    spese definitive (denaro uscito), prima dalle bozze attive;
//  · niente accesso a Supabase: funzioni pure, testabili in node.
// ============================================================================
import type { TabelleGrezze } from './adattatore.ts'

export type StatoScadenza = 'scaduta' | 'in_scadenza' | 'non_scaduta' | 'senza_scadenza'
export const GIORNI_PREAVVISO = 7

// giorni interi fra due date ISO (a − da), senza fusi: le date sono giorni
export function giorniTra(da: string, a: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86400000)
}

export type Scadenza = { stato: StatoScadenza; giorni: number | null }

export function classificaScadenza(dueDate: string | null | undefined, oggi: string, preavviso = GIORNI_PREAVVISO): Scadenza {
  if (!dueDate) return { stato: 'senza_scadenza', giorni: null }
  const giorni = giorniTra(oggi, dueDate)
  if (giorni < 0) return { stato: 'scaduta', giorni }
  if (giorni <= preavviso) return { stato: 'in_scadenza', giorni }
  return { stato: 'non_scaduta', giorni }
}

// etichetta leggibile: «scaduta da 3 giorni», «scade oggi», «scade tra 5
// giorni», «scade il 12 set» — `giornoDi` formatta la data (l'adattatore
// passa la sua etichettaGiorno)
export function etichettaScadenza(dueDate: string | null | undefined, s: Scadenza, giornoDi: (iso: string) => string): string {
  if (s.stato === 'senza_scadenza' || s.giorni == null || !dueDate) return 'senza scadenza'
  if (s.giorni < 0) return s.giorni === -1 ? 'scaduta ieri' : `scaduta da ${-s.giorni} giorni`
  if (s.giorni === 0) return 'scade oggi'
  if (s.giorni === 1) return 'scade domani'
  if (s.stato === 'in_scadenza') return `scade tra ${s.giorni} giorni`
  return `scade il ${giornoDi(dueDate)}`
}

// ---------------------------------------------------------------------------
// DETTAGLIO di una fattura: prima e dopo il pagamento
// ---------------------------------------------------------------------------
export type StatoFatturaDettaglio = 'in_revisione' | 'da_pagare' | 'pagata' | 'altro'

export type RigaFatturaDettaglio = {
  nome: string
  importo: number
  camera?: string            // nome della camera, 'Generale' se assente
  categoria?: string
  arrotondamento?: boolean
  esclusa?: boolean
}

export type FatturaDettaglio = {
  id: string
  kind: string
  status: string
  stato: StatoFatturaDettaglio
  supplier: string | null
  invoice_number: string | null
  document_date: string | null
  due_date: string | null
  totale: number | null      // doc_total (euro)
  note: string | null
  scadenza: Scadenza          // significativa solo per 'da_pagare'
  pagamento: { data: string; metodo: string | null } | null   // dopo il pagamento
  righe: RigaFatturaDettaglio[]
  camere: string[]
  gruppi: string[]
  pagine: { id: string; storage_path: string; page_order: number; tipo?: string | null }[]
  speseIds: string[]
  // la somma delle righe attive + arrotondamenti (cent), per la quadratura
  sommaCent: number
}

type Tabelle = Pick<TabelleGrezze,
  'documenti' | 'ponte' | 'spese' | 'righe' | 'ricevute' | 'bozze' | 'righeBozza'
  | 'gruppi' | 'camere' | 'categorie' | 'categorieCanoniche'>

const cent = (n: number) => Math.round(Number(n) * 100)

export function dettaglioFattura(t: Tabelle, documentId: string, oggi: string): FatturaDettaglio | null {
  const d = t.documenti.find(x => x.id === documentId)
  if (!d) return null
  const cameraDi = new Map(t.camere.map(c => [c.id, c.active === false ? `${c.name} (archiviata)` : c.name]))
  const gruppoDi = new Map(t.gruppi.map(g => [g.id, g.name]))
  const categoriaDi = new Map(t.categorie.map(c => [c.id, c.name]))
  const canonicaDi = new Map(t.categorieCanoniche.map(c => [c.id, c.name]))
  const nomeCategoria = (x: { canonical_category_id?: string | null; category_id?: string | null }) =>
    (x.canonical_category_id ? canonicaDi.get(x.canonical_category_id) : undefined)
    ?? (x.category_id ? categoriaDi.get(x.category_id) : undefined)
  const speseIds = t.ponte.filter(p => p.document_id === documentId).map(p => p.expense_id)
  const spese = t.spese.filter(s => speseIds.includes(s.id))
  const stato: StatoFatturaDettaglio =
    d.status === 'in_revisione' ? 'in_revisione'
      : d.status === 'approvata_da_pagare' ? 'da_pagare'
        : d.status === 'confermato' && d.kind === 'fattura' ? 'pagata' : 'altro'

  let righe: RigaFatturaDettaglio[]
  let camere: string[]
  let gruppi: string[]
  let sommaCent = 0
  if (spese.length > 0) {
    righe = spese.flatMap(s => {
      const mie = t.righe.filter(r => r.expense_id === s.id)
      const camera = s.room_id ? cameraDi.get(s.room_id) ?? 'Generale' : 'Generale'
      if (mie.length === 0) return [{ nome: s.description || s.store || 'Spesa', importo: Number(s.amount), camera, categoria: nomeCategoria(s) }]
      return mie.map(r => ({
        nome: r.name, importo: Number(r.amount), camera,
        categoria: nomeCategoria(r) ?? nomeCategoria(s),
        arrotondamento: r.is_adjustment || undefined,
      }))
    })
    sommaCent = spese.reduce((x, s) => x + cent(s.amount), 0)
    camere = [...new Set(spese.map(s => (s.room_id ? cameraDi.get(s.room_id) ?? 'Generale' : 'Generale')))]
    gruppi = [...new Set(spese.map(s => (s.group_id ? gruppoDi.get(s.group_id) : undefined)).filter((x): x is string => !!x))]
  } else {
    const attive = t.bozze.filter(b => b.document_id === documentId && (b.status === 'da_controllare' || b.status === 'pronta'))
    righe = attive.flatMap(b => {
      const camera = b.room_id ? cameraDi.get(b.room_id) ?? 'Generale' : 'Generale'
      const mie = t.righeBozza.filter(r => r.draft_id === b.id).map(r => ({
        nome: r.name, importo: Number(r.amount), camera,
        categoria: nomeCategoria(r) ?? nomeCategoria(b),
        esclusa: r.excluded || undefined,
      }))
      const arr = b.arrotondamento_cent ?? 0
      return arr !== 0 ? [...mie, { nome: 'Arrotondamento', importo: arr / 100, camera, arrotondamento: true }] : mie
    })
    sommaCent = righe.filter(r => !r.esclusa).reduce((x, r) => x + cent(r.importo), 0)
    camere = [...new Set(attive.map(b => (b.room_id ? cameraDi.get(b.room_id) ?? 'Generale' : 'Generale')))]
    gruppi = [...new Set(attive.map(b => (b.group_id ? gruppoDi.get(b.group_id) : undefined)).filter((x): x is string => !!x))]
  }
  const pagata = spese.length > 0 ? spese[0] : null
  return {
    id: d.id, kind: d.kind, status: d.status, stato,
    supplier: d.supplier, invoice_number: d.invoice_number ?? null,
    document_date: d.document_date, due_date: d.due_date,
    totale: d.doc_total == null ? null : Number(d.doc_total),
    note: d.note,
    scadenza: stato === 'da_pagare' ? classificaScadenza(d.due_date, oggi) : { stato: 'senza_scadenza', giorni: null },
    pagamento: pagata ? { data: pagata.paid_at ?? pagata.expense_date, metodo: pagata.payment_method ?? null } : null,
    righe, camere, gruppi,
    pagine: t.ricevute.filter(r => r.document_id === documentId && r.storage_path)
      .map(r => ({ id: r.id, storage_path: r.storage_path!, page_order: r.page_order ?? 1, tipo: r.mime_type }))
      .sort((a, b) => a.page_order - b.page_order),
    speseIds,
    sommaCent,
  }
}
