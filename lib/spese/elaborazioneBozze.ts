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
import { canonicaCoerente, SOGLIA_CONFIDENCE } from './controlli.ts'
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
  // CONTRATTO DELLA NOTA: se il documento ha una nota di Ania, la lettura
  // DEVE dichiarare UNA delle due voci qui sotto — come l'ha applicata,
  // oppure perché non è attribuibile. Nessuna delle due, entrambe, o una
  // nota diversa da quella del documento = pacchetto RIFIUTATO.
  notaApplicata?: { nota: string; come: string } | null
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

// un dubbio deve essere VISIBILE in revisione: campo pertinente,
// confidence finita sotto la soglia che la schermata mostra, motivo non
// vuoto — un «dubbio invisibile» non autorizza mai nulla
const dubbioNonValido = (d: DubbioLetto): string | null => {
  if (!d.campo?.trim()) return 'campo mancante'
  if (!Number.isFinite(d.confidence) || d.confidence < 0 || d.confidence >= SOGLIA_CONFIDENCE)
    return `confidence ${d.confidence} non finita o non sotto la soglia ${SOGLIA_CONFIDENCE}: la revisione non lo mostrerebbe`
  if (!d.motivo?.trim()) return 'motivo vuoto'
  return null
}

// ---- il COSTRUTTORE puro ---------------------------------------------------
export function costruisciPacchettoBozze(
  lettura: LetturaDocumento, contesto: ContestoElaborazione,
): { ok: true; pacchetto: PacchettoBozze } | { ok: false; errore: string } {
  const no = (errore: string) => ({ ok: false as const, errore })
  if (!Array.isArray(lettura.sorelle) || lettura.sorelle.length === 0)
    return no('lettura senza alcuna parte: niente da proporre')

  // CONTRATTO DELLA NOTA: la nota di Ania sul documento non si ignora MAI
  const notaDoc = contesto.nota?.trim() || null
  const applicata = lettura.notaApplicata ?? null
  const nonAttribuita = lettura.notaNonAttribuita?.trim() || null
  if (notaDoc) {
    if (applicata && nonAttribuita)
      return no('nota di Ania dichiarata sia applicata sia non attribuibile: la lettura deve scegliere una delle due')
    if (!applicata && !nonAttribuita)
      return no(`nota di Ania presente sul documento («${notaDoc}») ma la lettura non dichiara né come l'ha applicata né perché non è attribuibile: la nota non si ignora`)
    if (applicata && applicata.nota.trim() !== notaDoc)
      return no(`la lettura dichiara applicata una nota diversa da quella del documento («${applicata.nota}» ≠ «${notaDoc}»)`)
    if (applicata && !applicata.come.trim())
      return no('nota dichiarata applicata senza dire COME: la dichiarazione deve essere verificabile da Ania')
    if (nonAttribuita && nonAttribuita !== notaDoc)
      return no(`la lettura dichiara non attribuibile una nota diversa da quella del documento («${nonAttribuita}» ≠ «${notaDoc}»)`)
  } else if (applicata || nonAttribuita) {
    return no('la lettura dichiara una nota che il documento non ha')
  }

  if (lettura.dubbioTotale) {
    if (lettura.dubbioTotale.campo !== 'doc_total')
      return no(`dubbio sul totale con campo «${lettura.dubbioTotale.campo}»: deve essere doc_total`)
    const ragione = dubbioNonValido(lettura.dubbioTotale)
    if (ragione) return no(`dubbio sul totale non valido (${ragione}): un dubbio invisibile non autorizza una quadratura errata`)
  }

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
    for (const d of s.dubbi ?? []) {
      const ragione = dubbioNonValido(d)
      if (ragione) return no(`parte ${i + 1}: dubbio dichiarato non valido (${ragione})`)
    }
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
      for (const d of v.dubbi ?? []) {
        const ragione = dubbioNonValido(d)
        if (ragione) return no(`${dove}: dubbio dichiarato non valido (${ragione})`)
      }
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
//
// Due forme di scrittore (revisione R1):
//  · ATOMICO — UN solo primitivo «sostituisciBozze»: verifica dello stato,
//    sostituzione di bozze+righe e aggiornamento del documento in UNA
//    transazione, tutto o niente, con l'arbitraggio concorrente DENTRO il
//    primitivo. È l'unica forma ammessa per un archivio vero (la RPC della
//    migrazione 0023, DA AUTORIZZARE, lo realizza con lock sul documento).
//  · GRANULARE — i cinque metodi elementari: resta per gli archivi FINTI
//    dei test. L'orchestratore lo serializza per documento nello stesso
//    processo e compensa dichiarando ogni errore, ma NON può garantire
//    atomicità fra processi: per quella esiste solo il primitivo atomico.
export type RichiestaSostituzione = {
  // stati in cui il documento deve trovarsi NEL MOMENTO della sostituzione
  statiAmmessi: readonly string[]
} & (
  | { pacchetto: PacchettoBozze; errore?: undefined }   // → bozze+righe+doc_total, stato in_revisione
  | { pacchetto?: undefined; errore: string }           // → pulizia totale, stato errore col motivo
)
export type EsitoSostituzione =
  | { ok: true; bozze: number; righe: number }
  | { ok: false; statoAttuale?: string; errore: string }

export type ScrittoreBozzeAtomico = {
  leggiDocumento(id: string): Promise<{ documento?: { status: string }; errore?: string }>
  sostituisciBozze(documentId: string, richiesta: RichiestaSostituzione): Promise<EsitoSostituzione>
}
export type ScrittoreBozzeGranulare = {
  leggiDocumento(id: string): Promise<{ documento?: { status: string }; errore?: string }>
  rimuoviBozzeDi(documentId: string): Promise<{ errore?: string }>
  inserisciBozza(b: Omit<BozzaDaInserire, 'rif'>): Promise<{ id?: string; errore?: string }>
  inserisciRiga(r: Omit<RigaDaInserire, 'bozzaRif'> & { draft_id: string }): Promise<{ errore?: string }>
  aggiornaDocumento(id: string, campi: { status?: string; doc_total?: number | null; error_message?: string | null }): Promise<{ errore?: string }>
}
export type ScrittoreBozze = ScrittoreBozzeAtomico | ScrittoreBozzeGranulare

export type EsitoElaborazione =
  | { ok: true; bozze: number; righe: number }
  | { ok: false; stato: 'rifiutata' | 'errore_scrittura' | 'documento_errore'; errore: string }

const STATI_ELABORABILI = ['da_elaborare', 'errore'] as const

// ogni chiamata allo scrittore passa da qui: un errore LANCIATO (es. da
// fetch) diventa un esito dichiarato, mai un salto della compensazione
const sicuro = async <T extends object>(p: Promise<T>): Promise<T | { errore: string }> => {
  try { return await p } catch (e) { return { errore: e instanceof Error ? e.message : String(e) } }
}

// coda PER DOCUMENTO nello stesso processo: due elaborazioni simultanee
// non si intrecciano mai — la seconda rilegge lo stato e viene rifiutata.
// Fra processi separati questo non basta: lì arbitra il primitivo atomico.
const codePerDocumento = new Map<string, Promise<unknown>>()
function inCodaDocumento<T>(id: string, lavoro: () => Promise<T>): Promise<T> {
  const coda = codePerDocumento.get(id) ?? Promise.resolve()
  const mio = coda.then(lavoro, lavoro)
  const scia = mio.then(() => undefined, () => undefined)
  codePerDocumento.set(id, scia)
  void scia.then(() => { if (codePerDocumento.get(id) === scia) codePerDocumento.delete(id) })
  return mio
}

const rifiutataPerStato = (stato: string): EsitoElaborazione =>
  ({ ok: false, stato: 'rifiutata', errore: `documento in stato «${stato}»: non rielaborabile (mai bozze doppie)` })

// l'ORCHESTRATORE: stati giusti, mai bozze doppie, mai parziali taciuti
export async function elaboraDocumento(
  scrittore: ScrittoreBozze,
  documentId: string,
  esitoLettura: { lettura: LetturaDocumento } | { errore: string },
  contesto: Omit<ContestoElaborazione, 'documentId'>,
): Promise<EsitoElaborazione> {
  const doc = await sicuro(scrittore.leggiDocumento(documentId))
  if (doc.errore || !('documento' in doc) || !doc.documento)
    return { ok: false, stato: 'rifiutata', errore: `documento non leggibile (${doc.errore ?? 'assente'}): non elaboro` }
  // IDEMPOTENZA: si elabora SOLO da 'da_elaborare' o 'errore' — un
  // documento già in revisione/confermato non produce mai bozze doppie
  if (!(STATI_ELABORABILI as readonly string[]).includes(doc.documento.status))
    return rifiutataPerStato(doc.documento.status)

  // cosa va scritto: il pacchetto buono, oppure la marcatura d'errore
  // (lettura fallita o pacchetto rifiutato) — sempre senza parziali
  let richiesta: RichiestaSostituzione
  let motivoErrore: string | null = null
  if ('errore' in esitoLettura) {
    motivoErrore = esitoLettura.errore
    richiesta = { statiAmmessi: STATI_ELABORABILI, errore: esitoLettura.errore }
  } else {
    const costruito = costruisciPacchettoBozze(esitoLettura.lettura, { ...contesto, documentId })
    if (!costruito.ok) {
      motivoErrore = costruito.errore
      richiesta = { statiAmmessi: STATI_ELABORABILI, errore: costruito.errore }
    } else {
      richiesta = { statiAmmessi: STATI_ELABORABILI, pacchetto: costruito.pacchetto }
    }
  }

  // scrittore ATOMICO: un solo primitivo, l'arbitraggio è dentro di lui
  if ('sostituisciBozze' in scrittore) {
    const r = await sicuro(scrittore.sostituisciBozze(documentId, richiesta))
    if ('errore' in r && !('ok' in r)) return { ok: false, stato: 'errore_scrittura', errore: r.errore as string }
    const esito = r as EsitoSostituzione
    if (!esito.ok) {
      if (esito.statoAttuale !== undefined && !(STATI_ELABORABILI as readonly string[]).includes(esito.statoAttuale))
        return rifiutataPerStato(esito.statoAttuale)
      return { ok: false, stato: 'errore_scrittura', errore: esito.errore }
    }
    return motivoErrore
      ? { ok: false, stato: 'documento_errore', errore: motivoErrore }
      : { ok: true, bozze: esito.bozze, righe: esito.righe }
  }

  // scrittore GRANULARE (archivi finti dei test): serializzato per
  // documento, con RICONTROLLO dello stato dentro la coda
  return inCodaDocumento(documentId, async (): Promise<EsitoElaborazione> => {
    const doc2 = await sicuro(scrittore.leggiDocumento(documentId))
    if (doc2.errore || !('documento' in doc2) || !doc2.documento)
      return { ok: false, stato: 'rifiutata', errore: `documento non leggibile (${doc2.errore ?? 'assente'}): non elaboro` }
    if (!(STATI_ELABORABILI as readonly string[]).includes(doc2.documento.status))
      return rifiutataPerStato(doc2.documento.status)

    // la pulizia si RITENTA e ogni suo fallimento viene DICHIARATO:
    // «niente parziali» non può essere una promessa a occhi chiusi
    const pulisci = async (): Promise<{ riuscita: boolean; falliti: string[] }> => {
      const falliti: string[] = []
      for (let tentativo = 0; tentativo < 3; tentativo++) {
        const r = await sicuro(scrittore.rimuoviBozzeDi(documentId))
        if (!r.errore) return { riuscita: true, falliti }
        falliti.push(r.errore)
      }
      return { riuscita: false, falliti }
    }

    if (richiesta.errore !== undefined) {
      const pulizia = await pulisci()
      const marca = await sicuro(scrittore.aggiornaDocumento(documentId, { status: 'errore', error_message: richiesta.errore }))
      if (!pulizia.riuscita || marca.errore)
        return { ok: false, stato: 'errore_scrittura', errore: `lettura/pacchetto in errore E archivio non sistemato (${pulizia.falliti.join('; ') || marca.errore}): da rifare` }
      return { ok: false, stato: 'documento_errore', errore: richiesta.errore }
    }

    // RIELABORAZIONE: le bozze del giro precedente (stato errore) si
    // sostituiscono per intero — mai accumulate
    const pulizia = await pulisci()
    if (!pulizia.riuscita)
      return { ok: false, stato: 'errore_scrittura', errore: `bozze precedenti non rimosse (${pulizia.falliti.join('; ')}): non scrivo — una doppia elaborazione creerebbe doppioni` }

    const { pacchetto } = richiesta
    const idPerRif = new Map<string, string>()
    const fallisci = async (errore: string): Promise<EsitoElaborazione> => {
      // NIENTE parziali taciuti: si pulisce (ritentando), il documento
      // va in errore, e OGNI fallimento della compensazione finisce
      // nell'esito — mai nascosto dal primo errore
      const rimedio = await pulisci()
      const marca = await sicuro(scrittore.aggiornaDocumento(documentId, { status: 'errore', error_message: `elaborazione interrotta: ${errore}` }))
      const code: string[] = []
      if (rimedio.falliti.length)
        code.push(rimedio.riuscita
          ? `pulizia riuscita solo al tentativo ${rimedio.falliti.length + 1} (prima: ${rimedio.falliti.join('; ')})`
          : `ATTENZIONE: pulizia MAI riuscita, possibili bozze parziali rimaste (${rimedio.falliti.join('; ')})`)
      if (marca.errore) code.push(`stato del documento non aggiornato (${marca.errore})`)
      return { ok: false, stato: 'errore_scrittura', errore: code.length ? `${errore}; ${code.join('; ')}` : errore }
    }
    for (const b of pacchetto.bozze) {
      const campi = { ...b, rif: undefined }
      delete campi.rif
      const r = await sicuro(scrittore.inserisciBozza(campi))
      if (r.errore || !('id' in r) || !r.id) return fallisci(`bozza non inserita (${r.errore ?? 'senza id'})`)
      idPerRif.set(b.rif, r.id)
    }
    for (const riga of pacchetto.righe) {
      const { bozzaRif, ...campi } = riga
      const draftId = idPerRif.get(bozzaRif)
      if (!draftId) return fallisci(`riferimento di bozza sconosciuto (${bozzaRif})`)
      const r = await sicuro(scrittore.inserisciRiga({ ...campi, draft_id: draftId }))
      if (r.errore) return fallisci(`riga non inserita (${r.errore})`)
    }
    const finale = await sicuro(scrittore.aggiornaDocumento(documentId, {
      status: 'in_revisione', doc_total: pacchetto.documento.doc_total, error_message: null,
    }))
    if (finale.errore) return fallisci(`stato finale non scritto (${finale.errore})`)
    return { ok: true, bozze: pacchetto.bozze.length, righe: pacchetto.righe.length }
  })
}
