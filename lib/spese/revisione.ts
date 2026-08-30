// ============================================================================
// REVISIONE DELLE BOZZE (Fase 4, blocco 3) — logica PURA della schermata.
// Contratto (0020/0021 + piano §9):
//  · si modificano SOLO i campi di revisione consentiti dalla 0021; i campi
//    riservati (confidence, raw_name, status, expense_id, user_added) NON
//    compaiono nemmeno nei tipi delle modifiche: impossibile riscriverli;
//  · il valore ESTRATTO originale si conserva: le differenze diventano
//    CORREZIONI {field, proposed, corrected, draft_id/draft_item_id} e
//    viaggiano nella p_correzioni della RPC atomica alla conferma;
//  · quadratura ESATTA e BLOCCANTE (controlli.quadraturaDocumento): somma
//    righe attive + arrotondamenti = doc_total, differenza zero;
//  · gruppo mancante = bloccante; metodo obbligatorio per Casa Ania;
//  · necessità e pianificazione FACOLTATIVE: mai valori inventati.
// ============================================================================
import { quadraturaDocumento, SOGLIA_CONFIDENCE } from './controlli.ts'

export type Confidenza = Record<string, { proposto?: unknown; confidence?: number; doubt_reason?: string }>

// come arrivano da fonte.leggiTutto (bozze e righe del documento)
export type BozzaGrezza = {
  id: string; document_id: string; status: string
  expense_date: string; group_id: string | null
  category_id: string | null; subcategory: string | null
  canonical_category_id: string | null; canonical_subcategory_id: string | null
  store: string | null; description: string | null
  payment_method: string | null; room_id: string | null
  expense_nature: string | null; arrotondamento_cent: number
  confidence: Confidenza | null
}
export type RigaGrezza = {
  id: string; draft_id: string
  raw_name: string | null; name: string
  qty: number | null; unit_price: number | null; discount: number | null
  amount: number
  group_id: string | null
  category_id: string | null; subcategory: string | null
  canonical_category_id: string | null; canonical_subcategory_id: string | null
  necessity: string | null; planning: string | null
  excluded: boolean; user_added: boolean
  confidence: Confidenza | null
}

// SOLO i campi che la 0021 consente di aggiornare dal browser
export type ModificaBozza = Partial<Pick<BozzaGrezza,
  'expense_date' | 'group_id' | 'category_id' | 'subcategory'
  | 'canonical_category_id' | 'canonical_subcategory_id' | 'store'
  | 'description' | 'payment_method' | 'room_id' | 'expense_nature'
  | 'arrotondamento_cent'>>
export type ModificaRiga = Partial<Pick<RigaGrezza,
  'name' | 'qty' | 'unit_price' | 'discount' | 'amount' | 'group_id'
  | 'category_id' | 'subcategory' | 'canonical_category_id'
  | 'canonical_subcategory_id' | 'necessity' | 'planning' | 'excluded'>>
export type RigaNuova = {
  draft_id: string; name: string; amount: number
  qty?: number | null; unit_price?: number | null; discount?: number | null
  group_id?: string | null; category_id?: string | null; subcategory?: string | null
  canonical_category_id?: string | null; canonical_subcategory_id?: string | null
  necessity?: string | null; planning?: string | null
}

// lo STATO della revisione in corso: originali intatti + modifiche pendenti
export type StatoRevisione = {
  documentId: string
  docTotaleCent: number | null            // valore corrente (modificabile)
  docTotaleOriginaleCent: number | null
  bozze: BozzaGrezza[]                    // ORIGINALI, mai mutati
  righe: RigaGrezza[]                     // ORIGINALI, mai mutati
  modificheBozze: Record<string, ModificaBozza>
  modificheRighe: Record<string, ModificaRiga>
  righeNuove: (RigaNuova & { idLocale: string })[]
}

export function apriRevisione(
  documentId: string, docTotale: number | null,
  bozze: BozzaGrezza[], righe: RigaGrezza[],
): StatoRevisione {
  const attive = bozze.filter(b => b.status === 'da_controllare' || b.status === 'pronta')
  const idAttivi = new Set(attive.map(b => b.id))
  const cent = docTotale == null ? null : Math.round(docTotale * 100)
  return {
    documentId, docTotaleCent: cent, docTotaleOriginaleCent: cent,
    bozze: attive, righe: righe.filter(r => idAttivi.has(r.draft_id)),
    modificheBozze: {}, modificheRighe: {}, righeNuove: [],
  }
}

// i valori CORRENTI (originale + modifica pendente), senza mutare nulla
export const bozzaCorrente = (s: StatoRevisione, id: string): BozzaGrezza => {
  const b = s.bozze.find(x => x.id === id)!
  return { ...b, ...s.modificheBozze[id] }
}
export const rigaCorrente = (s: StatoRevisione, id: string): RigaGrezza => {
  const r = s.righe.find(x => x.id === id)!
  return { ...r, ...s.modificheRighe[id] }
}

export const modificaBozza = (s: StatoRevisione, id: string, campi: ModificaBozza): StatoRevisione =>
  ({ ...s, modificheBozze: { ...s.modificheBozze, [id]: { ...s.modificheBozze[id], ...campi } } })
export const modificaRiga = (s: StatoRevisione, id: string, campi: ModificaRiga): StatoRevisione =>
  ({ ...s, modificheRighe: { ...s.modificheRighe, [id]: { ...s.modificheRighe[id], ...campi } } })
export const aggiungiRiga = (s: StatoRevisione, riga: RigaNuova, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: [...s.righeNuove, { ...riga, idLocale }] })
export const togliRigaNuova = (s: StatoRevisione, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: s.righeNuove.filter(r => r.idLocale !== idLocale) })
export const modificaTotale = (s: StatoRevisione, cent: number | null): StatoRevisione =>
  ({ ...s, docTotaleCent: cent })

// ---- dubbi: campi sotto soglia, col motivo --------------------------------
export function dubbiDi(confidence: Confidenza | null): { campo: string; motivo: string }[] {
  return Object.entries(confidence ?? {})
    .filter(([, v]) => v?.confidence != null && v.confidence < SOGLIA_CONFIDENCE)
    .map(([campo, v]) => ({
      campo,
      motivo: `affidabilità ${Math.round((v.confidence ?? 0) * 100)}%${v.doubt_reason ? `: ${v.doubt_reason}` : ''}`,
    }))
}

// ---- totali e quadratura (centesimi interi) -------------------------------
const centDi = (n: number) => Math.round(n * 100)

export function totaliSorella(s: StatoRevisione, bozzaId: string) {
  const righe = s.righe.filter(r => r.draft_id === bozzaId).map(r => rigaCorrente(s, r.id))
  const nuove = s.righeNuove.filter(r => r.draft_id === bozzaId)
  const attiveCent = [
    ...righe.filter(r => !r.excluded).map(r => centDi(r.amount)),
    ...nuove.map(r => centDi(r.amount)),
  ]
  const arrotondamentoCent = bozzaCorrente(s, bozzaId).arrotondamento_cent ?? 0
  return {
    righeCent: attiveCent,
    sommaCent: attiveCent.reduce((a, b) => a + b, 0),
    arrotondamentoCent,
    totaleCent: attiveCent.reduce((a, b) => a + b, 0) + arrotondamentoCent,
    escluse: righe.filter(r => r.excluded).length,
    aggiunte: nuove.length + righe.filter(r => r.user_added).length,
  }
}

export function quadratura(s: StatoRevisione) {
  return quadraturaDocumento(
    s.docTotaleCent,
    s.bozze.map(b => {
      const t = totaliSorella(s, b.id)
      return { righeCent: t.righeCent, arrotondamentoCent: t.arrotondamentoCent }
    }),
  )
}

// ---- cosa blocca la conferma (il server rifarà gli stessi controlli) ------
export function blocchiConferma(
  s: StatoRevisione,
  ambitoDelGruppo: (groupId: string | null) => 'personale' | 'azienda',
): string[] {
  const blocchi: string[] = []
  const q = quadratura(s)
  if (!q.ok) {
    blocchi.push(q.diffCent == null
      ? 'totale del documento mancante'
      : `non quadra: mancano ${(q.diffCent / 100).toFixed(2).replace('.', ',')} € (${q.sommaCent} vs ${s.docTotaleCent} cent)`)
  }
  for (const b of s.bozze) {
    const c = bozzaCorrente(s, b.id)
    if (!c.group_id) blocchi.push('una parte non ha il destinatario (gruppo): assegnalo')
    else if (ambitoDelGruppo(c.group_id) === 'azienda' && !c.payment_method)
      blocchi.push('per Casa Ania il metodo di pagamento è obbligatorio')
  }
  return [...new Set(blocchi)]
}

// ---- CORREZIONI per la RPC: differenze tra originale e corrente -----------
// { field, proposed, corrected, draft_id | draft_item_id } come da contratto
// di private.registra_correzioni. Le righe AGGIUNTE a mano non sono
// correzioni (nascono già dall'utente e la marca user_added le distingue).
export function correzioniDa(s: StatoRevisione): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  if (s.docTotaleCent !== s.docTotaleOriginaleCent) {
    out.push({
      field: 'doc_total',
      proposed: s.docTotaleOriginaleCent == null ? null : s.docTotaleOriginaleCent / 100,
      corrected: s.docTotaleCent == null ? null : s.docTotaleCent / 100,
    })
  }
  for (const [id, campi] of Object.entries(s.modificheBozze)) {
    const originale = s.bozze.find(b => b.id === id)!
    for (const [campo, valore] of Object.entries(campi)) {
      const prima = originale[campo as keyof BozzaGrezza] ?? null
      if (JSON.stringify(prima) !== JSON.stringify(valore ?? null))
        out.push({ field: campo, proposed: prima, corrected: valore ?? null, draft_id: id })
    }
  }
  for (const [id, campi] of Object.entries(s.modificheRighe)) {
    const originale = s.righe.find(r => r.id === id)!
    for (const [campo, valore] of Object.entries(campi)) {
      const prima = originale[campo as keyof RigaGrezza] ?? null
      if (JSON.stringify(prima) !== JSON.stringify(valore ?? null))
        out.push({ field: campo, proposed: prima, corrected: valore ?? null, draft_id: originale.draft_id, draft_item_id: id })
    }
  }
  return out
}

// c'è qualcosa da salvare?
export const modifichePendenti = (s: StatoRevisione): boolean =>
  s.docTotaleCent !== s.docTotaleOriginaleCent
  || Object.keys(s.modificheBozze).length > 0
  || Object.keys(s.modificheRighe).length > 0
  || s.righeNuove.length > 0
