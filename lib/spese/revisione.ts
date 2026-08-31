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
import { canonicaCoerente, quadraturaDocumento, rigaCoerente, SOGLIA_CONFIDENCE } from './controlli.ts'

// gli UNICI campi che la 0021 consente dal browser (fonte unica per tipi,
// payload, snapshot degli originali e test):
export const CAMPI_BOZZA_REVISIONE = [
  'expense_date', 'group_id', 'category_id', 'subcategory',
  'canonical_category_id', 'canonical_subcategory_id', 'store',
  'description', 'payment_method', 'room_id', 'expense_nature',
  'arrotondamento_cent',
] as const
export const CAMPI_RIGA_REVISIONE = [
  'name', 'qty', 'unit_price', 'discount', 'amount', 'group_id',
  'category_id', 'subcategory', 'canonical_category_id',
  'canonical_subcategory_id', 'necessity', 'planning', 'excluded',
] as const
// le colonne concesse in INSERT sulle righe (0021: niente id, niente excluded)
export const CAMPI_RIGA_NUOVA = [
  'draft_id', 'name', 'qty', 'unit_price', 'discount', 'amount', 'group_id',
  'category_id', 'subcategory', 'canonical_category_id',
  'canonical_subcategory_id', 'necessity', 'planning',
] as const

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
  // fedeli alla 0020: qty numeric(10,3) NOT NULL > 0 (default 1),
  // unit_price numeric(10,3) NULL o ≥ 0, discount numeric(10,2) NOT NULL ≥ 0
  qty: number; unit_price: number | null; discount: number
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
  qty?: number; unit_price?: number | null; discount?: number
  group_id?: string | null; category_id?: string | null; subcategory?: string | null
  canonical_category_id?: string | null; canonical_subcategory_id?: string | null
  necessity?: string | null; planning?: string | null
}
// una riga nuova nello stato: con la sua RESPONSABILITÀ tracciata.
//  'nuova'    = mai inviata;
//  'in_invio' = custodita PRIMA della richiesta: se la pagina muore qui,
//               alla riapertura diventa 'incerta' (mai un secondo INSERT);
//  'salvata'  = inserita, id noto (MAI reinviata);
//  'incerta'  = esito ignoto: si risolve SOLO con una scelta esplicita
//               dell'utente (nessun reinvio automatico, nessuna
//               riconciliazione arbitraria).
export type RigaNuovaPendente = RigaNuova & {
  idLocale: string
  stato: 'nuova' | 'in_invio' | 'salvata' | 'incerta'
  id?: string                             // l'id vero, dopo l'inserimento
  gemella?: string                        // riapertura: id di una voce del
                                          // database IDENTICA in ogni campo
                                          // (proposta all'utente, mai applicata da sola)
}

// il payload ESPLICITO dell'INSERT: solo le colonne concesse dalla 0021,
// con i DEFAULT della 0020 dove NULL è vietato (qty=1, discount=0) — un
// NULL esplicito non applicherebbe il default e verrebbe rifiutato
export function payloadRigaNuova(r: RigaNuova): RigaNuova {
  return {
    draft_id: r.draft_id, name: r.name, amount: r.amount,
    qty: r.qty ?? 1, unit_price: r.unit_price ?? null, discount: r.discount ?? 0,
    group_id: r.group_id ?? null, category_id: r.category_id ?? null,
    subcategory: r.subcategory ?? null,
    canonical_category_id: r.canonical_category_id ?? null,
    canonical_subcategory_id: r.canonical_subcategory_id ?? null,
    necessity: r.necessity ?? null, planning: r.planning ?? null,
  }
}

// due righe sono «la stessa operazione» SOLO se identiche in TUTTI i campi
// del payload (nome e importo non bastano: quantità o destinatario diversi
// smentiscono l'identità). Anche così resta una FORTE somiglianza, non una
// prova: per questo la gemella viene PROPOSTA, mai collegata da sola.
export function stessaRigaNuova(db: RigaGrezza, pendente: RigaNuova): boolean {
  const p = payloadRigaNuova(pendente)
  return db.draft_id === p.draft_id && db.name === p.name
    && Math.round(db.amount * 100) === Math.round(p.amount * 100)
    && db.qty === p.qty && (db.unit_price ?? null) === (p.unit_price ?? null)
    && db.discount === p.discount
    && (db.group_id ?? null) === (p.group_id ?? null)
    && (db.category_id ?? null) === (p.category_id ?? null)
    && (db.subcategory ?? null) === (p.subcategory ?? null)
    && (db.canonical_category_id ?? null) === (p.canonical_category_id ?? null)
    && (db.canonical_subcategory_id ?? null) === (p.canonical_subcategory_id ?? null)
    && (db.necessity ?? null) === (p.necessity ?? null)
    && (db.planning ?? null) === (p.planning ?? null)
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
  righeNuove: RigaNuovaPendente[]
}

// ---- TRACCIA DUREVOLE: gli originali sopravvivono a Salva e riaperture ----
// Il database, dopo un Salva, contiene già i valori corretti: senza questa
// traccia l'originale sparirebbe e le correzioni per la RPC verrebbero
// azzerate in silenzio. La traccia si scrive PRIMA di ogni salvataggio e
// si toglie solo a documento confermato o scartato.
export type TracciaRevisione = {
  documentId: string
  docTotaleCent: number | null
  docTotaleOriginaleCent: number | null
  originaliBozze: Record<string, Partial<BozzaGrezza>>
  originaliRighe: Record<string, Partial<RigaGrezza>>
  modificheBozze: Record<string, ModificaBozza>
  modificheRighe: Record<string, ModificaRiga>
  righeNuove: RigaNuovaPendente[]
}

const foto = <T extends object>(riga: T, campi: readonly string[]): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const c of campi) out[c] = (riga as Record<string, unknown>)[c] ?? null
  return out as Partial<T>
}

export function tracciaDa(s: StatoRevisione): TracciaRevisione {
  return {
    documentId: s.documentId,
    docTotaleCent: s.docTotaleCent, docTotaleOriginaleCent: s.docTotaleOriginaleCent,
    originaliBozze: Object.fromEntries(s.bozze.map(b => [b.id, foto(b, CAMPI_BOZZA_REVISIONE)])),
    originaliRighe: Object.fromEntries(s.righe.map(r => [r.id, foto(r, CAMPI_RIGA_REVISIONE)])),
    modificheBozze: s.modificheBozze, modificheRighe: s.modificheRighe,
    righeNuove: s.righeNuove,
  }
}

// le differenze tra ciò che il database restituisce ORA e l'originale
// custodito: sono le correzioni già salvate, che tornano pendenti
const diffCampi = <T extends object>(
  adesso: T, originale: Partial<T>, campi: readonly string[],
): Partial<T> => {
  const out: Record<string, unknown> = {}
  for (const c of campi) {
    const dopo = (adesso as Record<string, unknown>)[c] ?? null
    const prima = (originale as Record<string, unknown>)[c] ?? null
    if (JSON.stringify(dopo) !== JSON.stringify(prima)) out[c] = dopo
  }
  return out as Partial<T>
}

export function apriRevisione(
  documentId: string, docTotale: number | null,
  bozze: BozzaGrezza[], righe: RigaGrezza[],
  traccia?: TracciaRevisione | null,
): StatoRevisione {
  const attive = bozze.filter(b => b.status === 'da_controllare' || b.status === 'pronta')
  const idAttivi = new Set(attive.map(b => b.id))
  const righeAttive = righe.filter(r => idAttivi.has(r.draft_id))
  const cent = docTotale == null ? null : Math.round(docTotale * 100)
  if (!traccia || traccia.documentId !== documentId) {
    return {
      documentId, docTotaleCent: cent, docTotaleOriginaleCent: cent,
      bozze: attive, righe: righeAttive,
      modificheBozze: {}, modificheRighe: {}, righeNuove: [],
    }
  }
  // RIAPERTURA con traccia: originali dalla custodia, correzioni ricostruite
  // (differenze database↔originale) + modifiche non ancora salvate
  const modificheBozze: Record<string, ModificaBozza> = {}
  const bozzeOriginali = attive.map(b => {
    const orig = traccia.originaliBozze[b.id]
    if (!orig) return b
    const originale = { ...b, ...orig } as BozzaGrezza
    const diff = { ...diffCampi(b, orig, CAMPI_BOZZA_REVISIONE), ...traccia.modificheBozze[b.id] }
    if (Object.keys(diff).length) modificheBozze[b.id] = diff
    return originale
  })
  const modificheRighe: Record<string, ModificaRiga> = {}
  const righeOriginali = righeAttive.map(r => {
    const orig = traccia.originaliRighe[r.id]
    if (!orig) return r
    const originale = { ...r, ...orig } as RigaGrezza
    const diff = { ...diffCampi(r, orig, CAMPI_RIGA_REVISIONE), ...traccia.modificheRighe[r.id] }
    if (Object.keys(diff).length) modificheRighe[r.id] = diff
    return originale
  })
  // righe nuove: le 'salvata' arrivate dal database si tolgono (l'id è la
  // prova). 'in_invio' significa che la pagina è morta con una richiesta
  // per aria: diventa 'incerta'. Le 'incerta' NON si riconciliano da sole
  // (una somiglianza non è un'identità): se tra le righe user_added
  // comparse dopo lo snapshot ce n'è una IDENTICA in tutti i campi, viene
  // PROPOSTA come gemella — decide l'utente, mai il codice.
  const noteAlloSnapshot = new Set(Object.keys(traccia.originaliRighe))
  const comparse = righeAttive.filter(r => r.user_added && !noteAlloSnapshot.has(r.id))
  const reclamate = new Set(traccia.righeNuove.filter(n => n.id).map(n => n.id as string))
  const righeNuove = traccia.righeNuove
    .filter(n => n.stato !== 'salvata' || !n.id || !righeAttive.some(r => r.id === n.id))
    .map(n => {
      if (n.stato !== 'incerta' && n.stato !== 'in_invio') return n
      const gemella = comparse.find(r => !reclamate.has(r.id) && stessaRigaNuova(r, n))
      if (gemella) reclamate.add(gemella.id)
      return { ...n, stato: 'incerta' as const, gemella: gemella?.id }
    })
  return {
    documentId,
    docTotaleCent: traccia.docTotaleCent,
    docTotaleOriginaleCent: traccia.docTotaleOriginaleCent,
    bozze: bozzeOriginali, righe: righeOriginali,
    modificheBozze, modificheRighe, righeNuove,
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
  ({ ...s, righeNuove: [...s.righeNuove, { ...riga, idLocale, stato: 'nuova' }] })
// si toglie SOLO una riga mai inviata: 'salvata' è nel database (la 0021
// non concede DELETE), 'incerta' è una responsabilità da riconciliare
export const togliRigaNuova = (s: StatoRevisione, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: s.righeNuove.filter(r => r.idLocale !== idLocale || r.stato !== 'nuova') })
// una riga incerta si RISOLVE solo per scelta esplicita dell'utente: o
// riconosce la gemella proposta («è questa»), o la toglie sapendo che, se
// l'invio perso arrivasse più tardi, la voce comparsa andrà esclusa a
// mano. In nessun caso il codice reinvia da solo.
export const risolviRigaIncerta = (s: StatoRevisione, idLocale: string): StatoRevisione =>
  ({ ...s, righeNuove: s.righeNuove.filter(r => r.idLocale !== idLocale || r.stato !== 'incerta') })
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
  // le 'incerta' (e le 'in_invio') NON contano nei totali: non si sa se
  // esistono — vanno risolte (e intanto bloccano la conferma)
  const nuove = s.righeNuove.filter(r => r.draft_id === bozzaId && r.stato !== 'incerta' && r.stato !== 'in_invio')
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
  sottoCanoniche?: { id: string; canonical_category_id?: string | null }[],
): string[] {
  const blocchi: string[] = []
  const q = quadratura(s)
  if (!q.ok) {
    blocchi.push(q.diffCent == null
      ? 'totale del documento mancante'
      : q.diffCent > 0
        ? `non quadra: mancano ${(q.diffCent / 100).toFixed(2).replace('.', ',')} € (${q.sommaCent} vs ${s.docTotaleCent} cent)`
        : `non quadra: ci sono ${(-q.diffCent / 100).toFixed(2).replace('.', ',')} € di troppo (${q.sommaCent} vs ${s.docTotaleCent} cent)`)
  }
  for (const b of s.bozze) {
    const c = bozzaCorrente(s, b.id)
    if (!c.group_id) { blocchi.push('una parte non ha il destinatario (gruppo): assegnalo'); continue }
    const ambitoParte = ambitoDelGruppo(c.group_id)
    if (ambitoParte === 'azienda' && !c.payment_method)
      blocchi.push('per Casa Ania il metodo di pagamento è obbligatorio')
    // COERENZA: nessuna voce può avere un destinatario dell'altro ambito
    // rispetto alla sua parte (il salvataggio incoerente romperebbe la vista)
    for (const r of s.righe.filter(x => x.draft_id === b.id)) {
      const rc = rigaCorrente(s, r.id)
      if (!rc.excluded && rc.group_id && ambitoDelGruppo(rc.group_id) !== ambitoParte)
        blocchi.push('una voce ha un destinatario dell\'altro ambito rispetto alla sua parte: correggila')
    }
    for (const n of s.righeNuove.filter(x => x.draft_id === b.id))
      if (n.group_id && ambitoDelGruppo(n.group_id) !== ambitoParte)
        blocchi.push('una voce ha un destinatario dell\'altro ambito rispetto alla sua parte: correggila')
  }
  if (s.righeNuove.some(r => r.stato === 'incerta' || r.stato === 'in_invio'))
    blocchi.push('una voce aggiunta ha l\'esito incerto: va risolta prima di confermare')
  // coerenza canonica (la stessa FK composita della 0020): la
  // sottocategoria deve appartenere alla categoria scelta
  if (sottoCanoniche) {
    const canoniche = sottoCanoniche.map(x => ({ id: x.id, canonical_category_id: x.canonical_category_id ?? '' }))
    const controlla = (scelta: { canonical_category_id: string | null; canonical_subcategory_id: string | null }) => {
      if (!canonicaCoerente(scelta, canoniche))
        blocchi.push('la sottocategoria non appartiene alla categoria scelta: sistemala')
    }
    for (const b of s.bozze) controlla(bozzaCorrente(s, b.id))
    for (const r of s.righe) controlla(rigaCorrente(s, r.id))
    for (const n of s.righeNuove) controlla({ canonical_category_id: n.canonical_category_id ?? null, canonical_subcategory_id: n.canonical_subcategory_id ?? null })
  }
  return [...new Set(blocchi)]
}

// coerenza quantità × prezzo unitario (avviso NON bloccante, come da
// controlli.rigaCoerente: tolleranza di 1 cent solo sul prezzo stampato)
export function avvisoCoerenzaRiga(r: Pick<RigaGrezza, 'qty' | 'unit_price' | 'discount' | 'amount' | 'excluded'>): string | null {
  if (r.excluded || r.qty == null || r.qty <= 0 || r.unit_price == null) return null
  if (rigaCoerente(r.unit_price, r.qty, Math.round(r.amount * 100), Math.round((r.discount ?? 0) * 100))) return null
  return `quantità × prezzo non torna con l'importo (${r.qty} × ${r.unit_price.toFixed(2).replace('.', ',')} ${r.discount ? `− sconto ${r.discount.toFixed(2).replace('.', ',')} ` : ''}≠ ${r.amount.toFixed(2).replace('.', ',')})`
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
