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
import { METODI_VALIDI } from './fatture.ts'
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

// l'EFFETTO che la nota di Ania ha avuto sulla lettura, in forma
// verificabile: il costruttore lo confronta con le sorelle/voci prodotte
export type EffettoNota =
  | { tipo: 'ambito_unico'; ambito: 'personale' | 'azienda' }   // la nota assegna TUTTO a un ambito
  | { tipo: 'gruppo_unico'; group_id: string }                  // la nota assegna TUTTO a un gruppo
  | { tipo: 'divisione'; ambiti: ('personale' | 'azienda')[] }  // la nota chiede la divisione fra ambiti

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
  // L'applicazione non è una frase libera: l'EFFETTO è strutturato e il
  // costruttore lo CONFRONTA col pacchetto prodotto (revisione R5) — una
  // dichiarazione contraddetta dalle sorelle/voci rifiuta il pacchetto.
  notaApplicata?: { nota: string; effetto: EffettoNota; come: string } | null
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

// CONFINE JSON (revisione R4): la lettura arriva da JSON.parse, i tipi
// TypeScript non la proteggono — ogni campo va convalidato a runtime,
// senza mai lanciare. Numeri FINITI (JSON.stringify muterebbe Infinity/
// NaN in null, alterando i valori in silenzio), testi veri, enum chiusi.
const numeroFinito = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)
const testoPieno = (x: unknown): x is string => typeof x === 'string' && x.trim().length > 0
const testoONull = (x: unknown): x is string | null => x == null || typeof x === 'string'
const NATURE_VALIDE = ['ordinaria', 'ricorrente', 'straordinaria'] as const

// la data deve ESISTERE davvero, non solo avere il formato giusto
const dataReale = (x: unknown): boolean => {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false
  const [a, m, g] = x.split('-').map(Number)
  const d = new Date(Date.UTC(a, m - 1, g))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === g
}

// «campo pertinente» = whitelist DISTINTA per livello (revisione R5):
// un dubbio su un campo inventato non è un dubbio, è rumore
const CAMPI_DUBBIO_DOCUMENTO = new Set(['doc_total'])
const CAMPI_DUBBIO_SORELLA = new Set(['store', 'expense_date', 'payment_method', 'group_id', 'room_id', 'expense_nature', 'arrotondamento_cent'])
const CAMPI_DUBBIO_VOCE = new Set(['raw_name', 'name', 'qty', 'unit_price', 'discount', 'amount', 'subcategory', 'group_id', 'canonical_category_id', 'canonical_subcategory_id'])

// un dubbio deve essere VISIBILE in revisione: campo pertinente al suo
// livello, confidence finita sotto la soglia che la schermata mostra,
// motivo non vuoto — un «dubbio invisibile» non autorizza mai nulla
const dubbioNonValido = (d: unknown, campiAmmessi: Set<string>): string | null => {
  if (!d || typeof d !== 'object') return 'dubbio non è un oggetto'
  const { campo, confidence, motivo } = d as Record<string, unknown>
  if (!testoPieno(campo)) return 'campo mancante'
  if (!campiAmmessi.has(campo.trim()))
    return `campo «${campo}» non pertinente a questo livello (ammessi: ${[...campiAmmessi].join(', ')})`
  if (!numeroFinito(confidence) || confidence < 0 || confidence >= SOGLIA_CONFIDENCE)
    return `confidence ${confidence} non finita o non sotto la soglia ${SOGLIA_CONFIDENCE}: la revisione non lo mostrerebbe`
  if (!testoPieno(motivo)) return 'motivo vuoto'
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
  const notaDoc = typeof contesto.nota === 'string' && contesto.nota.trim() ? contesto.nota.trim() : null
  const applicata = lettura.notaApplicata ?? null
  const nonAttribuita = typeof lettura.notaNonAttribuita === 'string' && lettura.notaNonAttribuita.trim()
    ? lettura.notaNonAttribuita.trim() : null
  if (applicata && typeof applicata !== 'object') return no('notaApplicata non è un oggetto')
  if (notaDoc) {
    if (applicata && nonAttribuita)
      return no('nota di Ania dichiarata sia applicata sia non attribuibile: la lettura deve scegliere una delle due')
    if (!applicata && !nonAttribuita)
      return no(`nota di Ania presente sul documento («${notaDoc}») ma la lettura non dichiara né come l'ha applicata né perché non è attribuibile: la nota non si ignora`)
    if (applicata && (!testoPieno(applicata.nota) || applicata.nota.trim() !== notaDoc))
      return no(`la lettura dichiara applicata una nota diversa da quella del documento («${String(applicata.nota)}» ≠ «${notaDoc}»)`)
    if (applicata && !testoPieno(applicata.come))
      return no('nota dichiarata applicata senza dire COME: la dichiarazione deve essere verificabile da Ania')
    if (nonAttribuita && nonAttribuita !== notaDoc)
      return no(`la lettura dichiara non attribuibile una nota diversa da quella del documento («${nonAttribuita}» ≠ «${notaDoc}»)`)
  } else if (applicata || nonAttribuita) {
    return no('la lettura dichiara una nota che il documento non ha')
  }

  if (lettura.dubbioTotale) {
    if (lettura.dubbioTotale.campo !== 'doc_total')
      return no(`dubbio sul totale con campo «${lettura.dubbioTotale.campo}»: deve essere doc_total`)
    const ragione = dubbioNonValido(lettura.dubbioTotale, CAMPI_DUBBIO_DOCUMENTO)
    if (ragione) return no(`dubbio sul totale non valido (${ragione}): un dubbio invisibile non autorizza una quadratura errata`)
  }
  if (lettura.totale != null && (!numeroFinito(lettura.totale) || lettura.totale < 0))
    return no(`totale non è un numero finito ≥ 0 (letto: ${String(lettura.totale)})`)

  const ambitoDi = new Map(contesto.gruppi.map(g => [g.id, g.ambito]))

  const bozze: BozzaDaInserire[] = []
  const righe: RigaDaInserire[] = []
  let sommaCent = 0
  for (const [i, s] of lettura.sorelle.entries()) {
    const rif = `sorella-${i + 1}`
    if (!s || typeof s !== 'object') return no(`parte ${i + 1}: non è un oggetto`)
    if (s.ambito !== 'personale' && s.ambito !== 'azienda')
      return no(`parte ${i + 1}: ambito sconosciuto (${String(s.ambito)})`)
    if (!testoPieno(s.destinatario) || ambitoDi.get(s.destinatario) !== s.ambito)
      return no(`parte ${i + 1}: destinatario mancante o di un altro ambito (${String(s.destinatario ?? 'nessuno')})`)
    if (!dataReale(s.data)) return no(`parte ${i + 1}: data non valida o inesistente (${String(s.data)})`)
    if (s.ambito === 'azienda' && !testoPieno(s.metodo))
      return no(`parte ${i + 1}: il metodo di pagamento è OBBLIGATORIO per l'ambito azienda`)
    if (s.metodo != null && !(METODI_VALIDI as readonly string[]).includes(s.metodo))
      return no(`parte ${i + 1}: metodo di pagamento sconosciuto (${String(s.metodo)})`)
    if (s.natura != null && !(NATURE_VALIDE as readonly string[]).includes(s.natura))
      return no(`parte ${i + 1}: natura sconosciuta (${String(s.natura)})`)
    if (!testoONull(s.negozio)) return no(`parte ${i + 1}: negozio non testuale`)
    if (s.camera != null && !testoPieno(s.camera)) return no(`parte ${i + 1}: camera non testuale`)
    if (s.arrotondamento_cent != null && (!numeroFinito(s.arrotondamento_cent) || !Number.isInteger(s.arrotondamento_cent)))
      return no(`parte ${i + 1}: arrotondamento_cent deve essere un intero finito (letto: ${String(s.arrotondamento_cent)})`)
    if (!Array.isArray(s.voci) || s.voci.length === 0)
      return no(`parte ${i + 1}: nessuna voce letta`)
    if (s.dubbi != null && !Array.isArray(s.dubbi)) return no(`parte ${i + 1}: dubbi non è un elenco`)
    for (const d of s.dubbi ?? []) {
      const ragione = dubbioNonValido(d, CAMPI_DUBBIO_SORELLA)
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
      // FEDELTÀ (revisione R4): il metodo non letto resta NON indicato —
      // per Casa Mia è facoltativo, e inventare «contanti» altererebbe
      // l'analisi «Come stai pagando»
      payment_method: s.metodo ?? null,
      room_id: s.camera ?? null, expense_nature: s.natura ?? null,
      arrotondamento_cent: s.arrotondamento_cent ?? 0,
      confidence: confidenzaDa(s.dubbi, dubbiDocumento),
    })
    for (const [j, v] of s.voci.entries()) {
      const dove = `parte ${i + 1}, voce ${j + 1} («${String(v?.name ?? v?.raw_name ?? '?')}»)`
      if (!v || typeof v !== 'object') return no(`${dove}: non è un oggetto`)
      if (!testoPieno(v.name)) return no(`${dove}: nome mancante o non testuale`)
      if (!testoONull(v.raw_name)) return no(`${dove}: raw_name non testuale`)
      const qty = v.qty ?? 1
      const discount = v.discount ?? 0
      if (!numeroFinito(qty) || !(qty > 0)) return no(`${dove}: qty deve essere un numero finito > 0 (letto: ${String(qty)})`)
      if (!numeroFinito(discount) || !(discount >= 0)) return no(`${dove}: discount deve essere un numero finito ≥ 0 (letto: ${String(discount)})`)
      if (!numeroFinito(v.amount) || !(v.amount >= 0)) return no(`${dove}: amount deve essere un numero finito ≥ 0 (letto: ${String(v.amount)})`)
      if (v.unit_price != null && (!numeroFinito(v.unit_price) || !(v.unit_price >= 0)))
        return no(`${dove}: unit_price deve essere null o un numero finito ≥ 0 (letto: ${String(v.unit_price)})`)
      // regola della casa: la sottocategoria non è MAI vuota
      if (!testoPieno(v.sottocategoria))
        return no(`${dove}: sottocategoria vuota — ogni voce deve averla (regola della casa)`)
      if (!testoONull(v.canonical_category_id) || !testoONull(v.canonical_subcategory_id))
        return no(`${dove}: canoniche non testuali`)
      if (!canonicaCoerente(v, contesto.sottoCanoniche))
        return no(`${dove}: sottocategoria canonica incoerente con la categoria`)
      if (v.destinatario != null && (!testoPieno(v.destinatario) || ambitoDi.get(v.destinatario) !== s.ambito))
        return no(`${dove}: destinatario della voce di un altro ambito`)
      if (v.escludi != null && typeof v.escludi !== 'boolean') return no(`${dove}: escludi deve essere vero/falso`)
      if (v.dubbi != null && !Array.isArray(v.dubbi)) return no(`${dove}: dubbi non è un elenco`)
      for (const d of v.dubbi ?? []) {
        const ragione = dubbioNonValido(d, CAMPI_DUBBIO_VOCE)
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

  // EFFETTO DELLA NOTA (revisione R5): la dichiarazione non è una frase
  // libera — l'effetto strutturato viene CONFRONTATO con il pacchetto
  // prodotto, e una contraddizione rifiuta tutto
  if (applicata) {
    const eff = applicata.effetto
    if (!eff || typeof eff !== 'object')
      return no('notaApplicata senza EFFETTO strutturato: la dichiarazione deve essere verificabile, non una frase libera')
    const contraddice = (m: string) => no(`nota dichiarata applicata ma il pacchetto la CONTRADDICE: ${m}`)
    if (eff.tipo === 'ambito_unico') {
      if (eff.ambito !== 'personale' && eff.ambito !== 'azienda')
        return no(`effetto della nota: ambito sconosciuto (${String(eff.ambito)})`)
      const fuori = lettura.sorelle.filter(s => s.ambito !== eff.ambito).length
      if (fuori) return contraddice(`dichiarato tutto nell'ambito «${eff.ambito}», ma ${fuori} parte/i stanno nell'altro ambito`)
    } else if (eff.tipo === 'gruppo_unico') {
      if (!testoPieno(eff.group_id) || !ambitoDi.has(eff.group_id))
        return no(`effetto della nota: gruppo sconosciuto (${String(eff.group_id)})`)
      if (lettura.sorelle.some(s => s.destinatario !== eff.group_id)
        || righe.some(r => r.group_id != null && r.group_id !== eff.group_id))
        return contraddice(`dichiarato tutto al gruppo «${eff.group_id}», ma parti o voci vanno ad altri gruppi`)
    } else if (eff.tipo === 'divisione') {
      const dichiarati = Array.isArray(eff.ambiti) ? [...new Set(eff.ambiti)] : []
      if (!dichiarati.length || dichiarati.some(a => a !== 'personale' && a !== 'azienda'))
        return no('effetto della nota: divisione senza ambiti validi')
      const presenti = new Set(lettura.sorelle.map(s => s.ambito))
      if (dichiarati.length !== presenti.size || dichiarati.some(a => !presenti.has(a)))
        return contraddice(`divisione dichiarata fra ${dichiarati.join('+')}, ma gli ambiti presenti sono ${[...presenti].join('+')}`)
    } else {
      return no(`effetto della nota di tipo sconosciuto (${String((eff as { tipo?: unknown }).tipo)})`)
    }
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
    // il costruttore VALIDA senza lanciare; se un difetto lo facesse
    // comunque lanciare, l'eccezione diventa una marcatura d'errore
    // controllata — mai un documento lasciato «da elaborare» a metà
    let costruito: ReturnType<typeof costruisciPacchettoBozze>
    try { costruito = costruisciPacchettoBozze(esitoLettura.lettura, { ...contesto, documentId }) }
    catch (e) { costruito = { ok: false, errore: `lettura malformata (${e instanceof Error ? e.message : String(e)})` } }
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
