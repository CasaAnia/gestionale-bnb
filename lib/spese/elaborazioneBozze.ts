// ============================================================================
// ELABORAZIONE «SOLO BOZZE» (scheda: CONSEGNA-ATTIVA.md) — dal risultato
// di LETTURA di un documento (prodotto dall'elaboratore leggendo la
// foto) al pacchetto di BOZZE da revisione: mai una spesa definitiva.
//  · costruisciPacchettoBozze: funzione PURA — valida secondo i
//    controlli §9 e le regole della casa (sottocategoria mai vuota,
//    quadratura esatta O dubbio dichiarato, canoniche coerenti, metodo
//    obbligatorio per l'ambito azienda) e produce documento aggiornato,
//    bozze per ambito e righe con confidence PER CAMPO;
//  · elaboraDocumento: orchestratore con SCRITTORE a perimetro RIGIDO
//    (whitelist: solo documento e tabelle bozze — le spese definitive
//    sono strutturalmente irraggiungibili), stati SOLO
//    da_elaborare/errore → in_revisione | errore, idempotenza (mai
//    bozze doppie), rielaborazione che SOSTITUISCE le bozze precedenti,
//    nessuna bozza parziale lasciata in giro.
// I dubbi (duplicati compresi) diventano confidence con doubt_reason:
// la schermata di revisione li mostra già (dubbiDi) — la decisione
// resta SEMPRE ad Ania, lo scarto è solo manuale.
// ============================================================================
import { canonicaCoerente } from './controlli.ts'
import type { Confidenza } from './revisione.ts'

// ---- la LETTURA: ciò che l'elaboratore dichiara di aver letto -------------
export type DubbioLetto = { campo: string; confidence: number; motivo: string }

export type VoceLetta = {
  raw_name: string | null              // come stampato sullo scontrino
  name: string                         // nome pulito (dettagli coerenti)
  qty?: number                         // pezzi/confezioni (default 1)
  unit_price?: number | null
  discount?: number                    // sconto GIÀ incorporato nel prezzo: qui solo se stampato
  amount: number
  destinatario?: string | null         // group_id della VOCE se diverso dalla sorella
  canonical_category_id?: string | null
  canonical_subcategory_id?: string | null
  sottocategoria: string               // testuale, MAI vuota (regola della casa)
  escludi?: boolean                    // voce presente ma fuori dal conto
  dubbi?: DubbioLetto[]
}

export type SorellaLetta = {
  ambito: 'personale' | 'azienda'
  destinatario: string                 // group_id (obbligatorio)
  data: string                         // YYYY-MM-DD
  negozio: string | null
  metodo?: string | null               // obbligatorio per l'ambito azienda
  camera?: string | null               // room_id (solo azienda, facoltativa)
  natura?: string | null
  arrotondamento_cent?: number
  dubbi?: DubbioLetto[]
  voci: VoceLetta[]
}

export type LetturaDocumento = {
  totale: number | null                // in euro; null = non leggibile (dubbio obbligatorio)
  sorelle: SorellaLetta[]
  // la differenza di quadratura o il totale mancante vanno DICHIARATI:
  // senza questo dubbio una lettura che non quadra viene RIFIUTATA
  dubbioTotale?: DubbioLetto | null
  // la nota di Ania non attribuibile con certezza (es. foto con più
  // scontrini): diventa un dubbio visibile, mai un'ipotesi silenziosa
  notaNonAttribuita?: string | null
}

export type ContestoElaborazione = {
  documentId: string
  gruppi: { id: string; ambito: 'personale' | 'azienda' }[]
  sottoCanoniche: { id: string; canonical_category_id: string }[]
  nota?: string | null                 // la nota di Ania sul documento
  // calcolato dal chiamante (sha256 dei file già presenti):
  duplicato?: { messaggio: string } | null
}

// ---- il PACCHETTO prodotto -------------------------------------------------
export type BozzaDaInserire = {
  rif: string                          // riferimento locale (le righe lo citano)
  document_id: string
  status: 'da_controllare'
  expense_date: string
  group_id: string
  category_id: null
  subcategory: string | null
  canonical_category_id: string | null
  canonical_subcategory_id: string | null
  store: string | null
  description: string | null
  payment_method: string | null
  room_id: string | null
  expense_nature: string | null
  arrotondamento_cent: number
  confidence: Confidenza | null
}
export type RigaDaInserire = {
  bozzaRif: string
  raw_name: string | null
  name: string
  qty: number
  unit_price: number | null
  discount: number
  amount: number
  group_id: string | null
  category_id: null
  subcategory: string | null
  canonical_category_id: string | null
  canonical_subcategory_id: string | null
  necessity: null
  planning: null
  excluded: boolean
  user_added: false
  confidence: Confidenza | null
}
export type PacchettoBozze = {
  documento: { doc_total: number | null }
  bozze: BozzaDaInserire[]
  righe: RigaDaInserire[]
}

const confidenzaDa = (dubbi: DubbioLetto[] | undefined, extra: DubbioLetto[] = []): Confidenza | null => {
  const tutti = [...(dubbi ?? []), ...extra]
  if (!tutti.length) return null
  const c: Confidenza = {}
  for (const d of tutti) c[d.campo] = { confidence: d.confidence, doubt_reason: d.motivo }
  return c
}

const cent = (euro: number) => Math.round(euro * 100)

// ---- il COSTRUTTORE puro ---------------------------------------------------
export function costruisciPacchettoBozze(
  lettura: LetturaDocumento, contesto: ContestoElaborazione,
): { ok: true; pacchetto: PacchettoBozze } | { ok: false; errore: string } {
  const no = (errore: string) => ({ ok: false as const, errore })
  if (!Array.isArray(lettura.sorelle) || lettura.sorelle.length === 0)
    return no('lettura senza alcuna parte: niente da proporre')
  const ambitoDi = new Map(contesto.gruppi.map(g => [g.id, g.ambito]))

  const bozze: BozzaDaInserire[] = []
  const righe: RigaDaInserire[] = []
  let sommaCent = 0
  for (const [i, s] of lettura.sorelle.entries()) {
    const rif = `sorella-${i + 1}`
    if (!s.destinatario || ambitoDi.get(s.destinatario) !== s.ambito)
      return no(`parte ${i + 1}: destinatario mancante o di un altro ambito (${s.destinatario ?? 'nessuno'})`)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.data)) return no(`parte ${i + 1}: data non valida (${s.data})`)
    if (s.ambito === 'azienda' && !s.metodo)
      return no(`parte ${i + 1}: il metodo di pagamento è OBBLIGATORIO per l'ambito azienda`)
    if (!Array.isArray(s.voci) || s.voci.length === 0)
      return no(`parte ${i + 1}: nessuna voce letta`)
    // i dubbi di documento (nota non attribuita, possibile duplicato)
    // vivono sulla PRIMA sorella: la revisione li mostra come dubbi
    const dubbiDocumento: DubbioLetto[] = i === 0
      ? [
        ...(contesto.duplicato ? [{ campo: 'duplicato', confidence: 0.5, motivo: contesto.duplicato.messaggio }] : []),
        ...(lettura.notaNonAttribuita ? [{ campo: 'nota', confidence: 0.5, motivo: `nota di Ania non attribuibile con certezza: «${lettura.notaNonAttribuita}» — da confermare a mano` }] : []),
        ...(lettura.dubbioTotale ? [lettura.dubbioTotale] : []),
      ]
      : []
    bozze.push({
      rif, document_id: contesto.documentId, status: 'da_controllare',
      expense_date: s.data, group_id: s.destinatario,
      category_id: null, subcategory: null,
      canonical_category_id: null, canonical_subcategory_id: null,
      store: s.negozio, description: null,
      payment_method: s.metodo ?? (s.ambito === 'personale' ? 'contanti' : null),
      room_id: s.camera ?? null, expense_nature: s.natura ?? null,
      arrotondamento_cent: s.arrotondamento_cent ?? 0,
      confidence: confidenzaDa(s.dubbi, dubbiDocumento),
    })
    for (const [j, v] of s.voci.entries()) {
      const dove = `parte ${i + 1}, voce ${j + 1} («${v.name || v.raw_name || '?'}»)`
      if (!v.name?.trim()) return no(`${dove}: nome mancante`)
      const qty = v.qty ?? 1
      const discount = v.discount ?? 0
      if (!(qty > 0)) return no(`${dove}: qty deve essere > 0`)
      if (!(discount >= 0)) return no(`${dove}: discount deve essere ≥ 0`)
      if (!(v.amount >= 0)) return no(`${dove}: amount deve essere ≥ 0`)
      if (v.unit_price != null && !(v.unit_price >= 0)) return no(`${dove}: unit_price deve essere null o ≥ 0`)
      // regola della casa: la sottocategoria non è MAI vuota
      if (!v.sottocategoria?.trim())
        return no(`${dove}: sottocategoria vuota — ogni voce deve averla (regola della casa)`)
      if (!canonicaCoerente(v, contesto.sottoCanoniche))
        return no(`${dove}: sottocategoria canonica incoerente con la categoria`)
      if (v.destinatario && ambitoDi.get(v.destinatario) !== s.ambito)
        return no(`${dove}: destinatario della voce di un altro ambito`)
      if (!v.escludi) sommaCent += cent(v.amount)
      righe.push({
        bozzaRif: rif, raw_name: v.raw_name, name: v.name.trim(),
        qty, unit_price: v.unit_price ?? null, discount, amount: v.amount,
        group_id: v.destinatario ?? null,
        category_id: null, subcategory: v.sottocategoria.trim(),
        canonical_category_id: v.canonical_category_id ?? null,
        canonical_subcategory_id: v.canonical_subcategory_id ?? null,
        necessity: null, planning: null,
        excluded: v.escludi ?? false, user_added: false,
        confidence: confidenzaDa(v.dubbi),
      })
    }
    sommaCent += s.arrotondamento_cent ?? 0
  }

  // QUADRATURA: esatta, oppure il dubbio è DICHIARATO (totale compreso)
  const totaleCent = lettura.totale == null ? null : cent(lettura.totale)
  if (totaleCent == null && !lettura.dubbioTotale)
    return no('totale non letto e nessun dubbio dichiarato: la lettura va completata o il dubbio dichiarato')
  if (totaleCent != null && totaleCent !== sommaCent && !lettura.dubbioTotale)
    return no(`quadratura non esatta (righe+arrotondamenti=${sommaCent} cent, totale=${totaleCent} cent) e nessun dubbio dichiarato`)

  return { ok: true, pacchetto: { documento: { doc_total: lettura.totale }, bozze, righe } }
}

// ---- lo SCRITTORE a perimetro RIGIDO --------------------------------------
// SOLO il documento e le tabelle delle bozze: qui non esiste alcun modo
// di toccare family_expenses o family_expense_items — l'elaborazione
// «scrive bozze valide, non conferma mai» (piano §8-②).
export type ScrittoreBozze = {
  leggiDocumento(id: string): Promise<{ documento?: { status: string }; errore?: string }>
  rimuoviBozzeDi(documentId: string): Promise<{ errore?: string }>
  inserisciBozza(b: Omit<BozzaDaInserire, 'rif'>): Promise<{ id?: string; errore?: string }>
  inserisciRiga(r: Omit<RigaDaInserire, 'bozzaRif'> & { draft_id: string }): Promise<{ errore?: string }>
  aggiornaDocumento(id: string, campi: { status?: string; doc_total?: number | null; error_message?: string | null }): Promise<{ errore?: string }>
}

export type EsitoElaborazione =
  | { ok: true; bozze: number; righe: number }
  | { ok: false; stato: 'rifiutata' | 'errore_scrittura' | 'documento_errore'; errore: string }

const STATI_ELABORABILI = ['da_elaborare', 'errore']

// l'ORCHESTRATORE: stati giusti, mai bozze doppie, mai parziali
export async function elaboraDocumento(
  scrittore: ScrittoreBozze,
  documentId: string,
  esitoLettura: { lettura: LetturaDocumento } | { errore: string },
  contesto: Omit<ContestoElaborazione, 'documentId'>,
): Promise<EsitoElaborazione> {
  const doc = await scrittore.leggiDocumento(documentId)
  if (doc.errore || !doc.documento)
    return { ok: false, stato: 'rifiutata', errore: `documento non leggibile (${doc.errore ?? 'assente'}): non elaboro` }
  // IDEMPOTENZA: si elabora SOLO da 'da_elaborare' o 'errore' — un
  // documento già in revisione/confermato non produce mai bozze doppie
  if (!STATI_ELABORABILI.includes(doc.documento.status))
    return { ok: false, stato: 'rifiutata', errore: `documento in stato «${doc.documento.status}»: non rielaborabile (mai bozze doppie)` }

  // la LETTURA è fallita: documento in errore con il motivo, e nessuna
  // bozza parziale lasciata in giro (anche di un giro precedente)
  if ('errore' in esitoLettura) {
    const pulizia = await scrittore.rimuoviBozzeDi(documentId)
    const marca = await scrittore.aggiornaDocumento(documentId, { status: 'errore', error_message: esitoLettura.errore })
    if (pulizia.errore || marca.errore)
      return { ok: false, stato: 'errore_scrittura', errore: `lettura fallita E stato non aggiornato (${pulizia.errore ?? marca.errore}): da rifare` }
    return { ok: false, stato: 'documento_errore', errore: esitoLettura.errore }
  }

  const costruito = costruisciPacchettoBozze(esitoLettura.lettura, { ...contesto, documentId })
  if (!costruito.ok) {
    const pulizia = await scrittore.rimuoviBozzeDi(documentId)
    const marca = await scrittore.aggiornaDocumento(documentId, { status: 'errore', error_message: costruito.errore })
    if (pulizia.errore || marca.errore)
      return { ok: false, stato: 'errore_scrittura', errore: `pacchetto rifiutato E stato non aggiornato (${pulizia.errore ?? marca.errore})` }
    return { ok: false, stato: 'documento_errore', errore: costruito.errore }
  }

  // RIELABORAZIONE: le bozze del giro precedente (stato errore) si
  // sostituiscono per intero — mai accumulate
  const pulizia = await scrittore.rimuoviBozzeDi(documentId)
  if (pulizia.errore)
    return { ok: false, stato: 'errore_scrittura', errore: `bozze precedenti non rimosse (${pulizia.errore}): non scrivo — una doppia elaborazione creerebbe doppioni` }

  const { pacchetto } = costruito
  const idPerRif = new Map<string, string>()
  const fallisci = async (errore: string): Promise<EsitoElaborazione> => {
    // NIENTE parziali visibili: si pulisce e il documento resta/va in errore
    await scrittore.rimuoviBozzeDi(documentId)
    await scrittore.aggiornaDocumento(documentId, { status: 'errore', error_message: `elaborazione interrotta: ${errore}` })
    return { ok: false, stato: 'errore_scrittura', errore }
  }
  for (const b of pacchetto.bozze) {
    const campi = { ...b, rif: undefined }
    delete campi.rif
    const r = await scrittore.inserisciBozza(campi)
    if (r.errore || !r.id) return fallisci(`bozza non inserita (${r.errore ?? 'senza id'})`)
    idPerRif.set(b.rif, r.id)
  }
  for (const riga of pacchetto.righe) {
    const { bozzaRif, ...campi } = riga
    const draftId = idPerRif.get(bozzaRif)
    if (!draftId) return fallisci(`riferimento di bozza sconosciuto (${bozzaRif})`)
    const r = await scrittore.inserisciRiga({ ...campi, draft_id: draftId })
    if (r.errore) return fallisci(`riga non inserita (${r.errore})`)
  }
  const finale = await scrittore.aggiornaDocumento(documentId, {
    status: 'in_revisione', doc_total: pacchetto.documento.doc_total, error_message: null,
  })
  if (finale.errore) return fallisci(`stato finale non scritto (${finale.errore})`)
  return { ok: true, bozze: pacchetto.bozze.length, righe: pacchetto.righe.length }
}
