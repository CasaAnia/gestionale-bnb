// ============================================================================
// SCRITTURE del nuovo modulo spese (3.2B → 3.2B.1) — logica PURA e testabile.
// Il client è INIETTATO: nei test è finto (nessuna scrittura vera), nelle
// pagine ufficiali è scritturaSupabase.ts. La preview /nuove-spese-reali
// NON importa questo modulo: resta in sola lettura.
//
// Regole (decisioni approvate + revisione 3.2B.1):
//  · importi con grammatica RIGOROSA, niente ambiguità silenziose;
//  · gli errori RESTITUITI contano quanto le eccezioni: mai un successo
//    simulato, mai perdere quello che l'utente ha scritto;
//  · un'operazione che può toccare zero righe verifica il numero di righe;
//  · caricamento foto RECUPERABILE: un nuovo tentativo riusa file e
//    documento già creati, mai duplicati; esito incerto → si VERIFICA
//    prima di cancellare o ripetere.
// ============================================================================

export type EsitoScrittura = { ok: true } | { ok: false; errore: string }

// ---- importi -------------------------------------------------------------
// Grammatica ammessa (mai più di 2 decimali):
//   "12"  "12,5"  "12,50"        virgola decimale
//   "12.5"  "12.50"              punto decimale (1-2 cifre dopo il punto)
//   "1.250"  "1.250,00"          punti delle MIGLIAIA (gruppi di 3) + virgola
// Tutto il resto (testo spurio, zero, negativi, "0,001") → null.
export function importoDaTesto(testo: string): number | null {
  const s = testo.trim()
  let cent: number | null = null
  if (/^\d+(,\d{1,2})?$/.test(s)) {
    const [interi, dec = ''] = s.split(',')
    cent = Number(interi) * 100 + Number((dec + '00').slice(0, 2))
  } else if (/^\d+\.\d{1,2}$/.test(s) && !/^\d{1,3}\.\d{3}$/.test(s)) {
    const [interi, dec] = s.split('.')
    cent = Number(interi) * 100 + Number((dec + '00').slice(0, 2))
  } else if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(s)) {
    const [corpo, dec = ''] = s.split(',')
    cent = Number(corpo.replace(/\./g, '')) * 100 + Number((dec + '00').slice(0, 2))
  }
  if (cent === null || !Number.isFinite(cent) || cent <= 0) return null
  return cent / 100
}

// il testo per i campi di modifica: 12.5 → "12,50", 12 → "12"
export function testoDaImporto(n: number): string {
  const cent = Math.round(n * 100)
  const interi = Math.floor(cent / 100)
  const dec = cent % 100
  return dec ? `${interi},${String(dec).padStart(2, '0')}` : String(interi)
}

// ---- guardia contro il doppio invio --------------------------------------
// Avvolge un'azione asincrona: mentre una è in corso, le altre chiamate
// NON partono (tornano null). Usata da moduli, budget e caricamenti.
export function creaGuardiaInvio() {
  let inCorso = false
  return async function <T>(azione: () => Promise<T>): Promise<T | null> {
    if (inCorso) return null
    inCorso = true
    try { return await azione() } finally { inCorso = false }
  }
}

// ---- inserimento manuale -------------------------------------------------
export type SpesaManualeInput = {
  expense_date: string
  importo: string              // testo dell'utente ("12,50")
  group_id: string
  category_id: string
  subcategory: string
  store: string
  product: string
  description: string
  payment_method: string       // valore schema ('contanti' | … | '')
  room_id: string              // '' = Generale
  expense_nature: string       // '' | 'ordinaria' | 'ricorrente' | 'straordinaria'
}

export const SPESA_MANUALE_VUOTA = (oggi: string): SpesaManualeInput => ({
  expense_date: oggi, importo: '', group_id: '', category_id: '', subcategory: '',
  store: '', product: '', description: '', payment_method: '', room_id: '', expense_nature: '',
})

export function validaSpesaManuale(input: SpesaManualeInput, ambito: 'personale' | 'azienda'): string[] {
  const errori: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expense_date)) errori.push('manca la data')
  if (importoDaTesto(input.importo) === null) errori.push('l\'importo deve essere un numero sopra lo zero (massimo due decimali)')
  if (!input.group_id) errori.push(ambito === 'azienda' ? 'manca il gruppo' : 'scegli di chi è la spesa')
  if (ambito === 'azienda' && !input.payment_method)
    errori.push('per Casa Ania il metodo di pagamento è obbligatorio')
  return errori
}

export type ClienteScrittura = {
  inserisciSpesa(payload: Record<string, unknown>): Promise<{ errore?: string }>
  // elimina e ritorna QUANTE righe ha toccato (0 = niente eliminato)
  eliminaSpesa(id: string): Promise<{ errore?: string; righe?: number }>
  caricaFile(percorso: string, file: Blob, tipo: string): Promise<{ errore?: string }>
  rimuoviFile(percorso: string): Promise<{ errore?: string }>
  creaDocumento(payload: Record<string, unknown>): Promise<{ id?: string; errore?: string }>
  creaRicevuta(payload: Record<string, unknown>): Promise<{ errore?: string }>
  // per gli esiti INCERTI: la ricevuta con questo percorso esiste già?
  ricevutaEsiste(storagePath: string): Promise<{ esiste?: boolean; errore?: string }>
  // per i DOPPIONI: una ricevuta con questa impronta esiste già?
  ricevutaConSha(sha: string): Promise<{ esiste?: boolean; errore?: string }>
  salvaBudget(ambito: string, categoria: string, importo: number): Promise<{ errore?: string }>
  aggiornaBudget(id: string, importo: number): Promise<{ errore?: string; righe?: number }>
  eliminaBudget(id: string): Promise<{ errore?: string; righe?: number }>
}

// Inserisce una spesa manuale (senza documento). Non lancia mai: chi chiama
// tiene il modulo aperto e i valori intatti sull'errore.
export async function salvaSpesaManuale(
  cliente: ClienteScrittura, input: SpesaManualeInput, ambito: 'personale' | 'azienda',
): Promise<EsitoScrittura> {
  const errori = validaSpesaManuale(input, ambito)
  if (errori.length) return { ok: false, errore: errori.join(' · ') }
  try {
    const r = await cliente.inserisciSpesa({
      expense_date: input.expense_date,
      amount: importoDaTesto(input.importo),
      group_id: input.group_id,
      category_id: input.category_id || null,
      ...(input.subcategory ? { subcategory: input.subcategory } : {}),
      store: input.store.trim() || null,
      product: input.product.trim() || null,
      description: input.description.trim() || null,
      payment_method: input.payment_method || null,
      room_id: input.room_id || null,
      expense_nature: input.expense_nature || null,
      source: 'manuale',
    })
    if (r.errore) return { ok: false, errore: r.errore }
    return { ok: true }
  } catch (e) {
    return { ok: false, errore: String((e as Error).message ?? e) }
  }
}

// Elimina una spesa MANUALE: l'errore restituito conta, e zero righe
// eliminate NON è un successo (spesa protetta dal database o già sparita).
export async function eliminaSpesaManuale(cliente: ClienteScrittura, id: string): Promise<EsitoScrittura> {
  try {
    const r = await cliente.eliminaSpesa(id)
    if (r.errore) return { ok: false, errore: r.errore }
    if ((r.righe ?? 0) < 1) return { ok: false, errore: 'la spesa non è stata eliminata (protetta dal database o già rimossa)' }
    return { ok: true }
  } catch (e) {
    return { ok: false, errore: String((e as Error).message ?? e) }
  }
}

// ---- budget: errori restituiti + verifica delle righe toccate -----------
export async function salvaBudgetNuovo(cliente: ClienteScrittura, ambito: string, categoria: string, importo: number): Promise<EsitoScrittura> {
  try {
    const r = await cliente.salvaBudget(ambito, categoria, importo)
    return r.errore ? { ok: false, errore: r.errore } : { ok: true }
  } catch (e) { return { ok: false, errore: String((e as Error).message ?? e) } }
}
export async function aggiornaBudgetEsistente(cliente: ClienteScrittura, id: string, importo: number): Promise<EsitoScrittura> {
  try {
    const r = await cliente.aggiornaBudget(id, importo)
    if (r.errore) return { ok: false, errore: r.errore }
    if ((r.righe ?? 0) < 1) return { ok: false, errore: 'budget non trovato: ricarica la pagina' }
    return { ok: true }
  } catch (e) { return { ok: false, errore: String((e as Error).message ?? e) } }
}
export async function eliminaBudgetEsistente(cliente: ClienteScrittura, id: string): Promise<EsitoScrittura> {
  try {
    const r = await cliente.eliminaBudget(id)
    if (r.errore) return { ok: false, errore: r.errore }
    if ((r.righe ?? 0) < 1) return { ok: false, errore: 'budget non trovato: ricarica la pagina' }
    return { ok: true }
  } catch (e) { return { ok: false, errore: String((e as Error).message ?? e) } }
}

// ---- caricamento di un documento con fotografia (RECUPERABILE) ----------
export type FotoDaCaricare = {
  nomeFile: string
  tipo: string                 // mime; da QUI deriva il tipo documento
  contenuto: Blob
  sha256: string | null
}

// Stato che il chiamante conserva tra un tentativo e l'altro: al nuovo
// tentativo file e documento GIÀ creati vengono riusati, mai duplicati.
export type RipresaCaricamento = { percorso?: string; documentId?: string }

export type EsitoCaricamento =
  | { ok: true; documentId?: string }
  | { ok: false; errore: string; riprovabile: boolean; sospeso?: boolean; duplicato?: boolean; ripresa: RipresaCaricamento }

export const tipoDocumentoDaFile = (mime: string): 'scontrino' | 'altro' =>
  mime === 'application/pdf' ? 'altro' : 'scontrino'

// La libreria Supabase può RESTITUIRE gli errori di rete invece di lanciarli:
// un messaggio così è un esito INCERTO (la richiesta può essere passata).
const sembraErroreDiRete = (msg: string) =>
  /fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)
// Possibile vincolo unico: NON basta a decidere il doppione — prima si
// verifica se il NOSTRO percorso è collegato.
const sembraVincoloUnico = (msg: string) => /duplicate key|unique|23505|sha/i.test(msg)

export async function caricaDocumentoConFoto(
  cliente: ClienteScrittura,
  foto: FotoDaCaricare,
  ambito: 'personale' | 'azienda',
  nota: string | null,
  ripresa: RipresaCaricamento = {},
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
): Promise<EsitoCaricamento> {
  const ext = (foto.nomeFile.split('.').pop() || 'jpg').toLowerCase()
  const percorso = ripresa.percorso ?? `${adesso().slice(0, 10)}/${idCasuale()}.${ext}`
  // gli identificativi già noti si CONSERVANO in ogni ramo
  let documentId = ripresa.documentId
  const fallito = (
    errore: string, riprovabile: boolean,
    extra: { sospeso?: boolean; duplicato?: boolean; senzaPercorso?: boolean } = {},
  ): EsitoCaricamento => ({
    ok: false, errore, riprovabile,
    ...(extra.sospeso ? { sospeso: true } : {}), ...(extra.duplicato ? { duplicato: true } : {}),
    ripresa: {
      ...(extra.senzaPercorso ? {} : { percorso }),
      ...(documentId ? { documentId } : {}),
    },
  })

  // 0) RIPRESA: un tentativo precedente può essere andato a buon fine senza
  //    che lo si sappia. La verifica viene PRIMA di qualsiasi passo che
  //    potrebbe ripetere o cancellare; se la verifica non riesce, non si
  //    tocca nulla (verifica fallita ≠ ricevuta assente).
  if (ripresa.percorso) {
    const c = await verificaRicevuta(cliente, ripresa.percorso)
    if (c === 'esiste') return { ok: true, ...(documentId ? { documentId } : {}) }
    if (c === 'ignoto')
      return fallito('non riesco a verificare il tentativo precedente: non ho toccato nulla, riprova quando torna la rete', true)
  } else if (foto.sha256) {
    // 0b) primo tentativo: la stessa foto è già in archivio? Controllo PRIMA
    //     di creare qualsiasi cosa (niente documenti vuoti per un doppione).
    try {
      const c = await cliente.ricevutaConSha(foto.sha256)
      if (!c.errore && c.esiste)
        return fallito('questa foto è già in archivio: non la carico di nuovo', false, { duplicato: true, senzaPercorso: true })
      // controllo non riuscito: si procede, il vincolo unico farà da rete di sicurezza
    } catch { /* idem */ }
  }

  // 1) file nel bucket (idempotente: al secondo tentativo sovrascrive il suo
  //    stesso percorso; il percorso è nostro e casuale)
  try {
    const su = await cliente.caricaFile(percorso, foto.contenuto, foto.tipo || 'image/jpeg')
    if (su.errore) return fallito(`caricamento della foto fallito: ${su.errore}`, true)
  } catch (e) {
    // esito incerto (rete): il percorso resta valido per il prossimo tentativo
    return fallito(`caricamento interrotto (${String((e as Error).message ?? e)}): riprova`, true)
  }

  // 2) documento (riusato se già creato in un tentativo precedente).
  //    Se l'INSERT può essere passato senza risposta non c'è un identificativo
  //    recuperabile: l'operazione resta SOSPESA, niente ritentativi alla cieca
  //    che creerebbero un secondo documento.
  if (!documentId) {
    const sospendi = (msg: string) => fallito(
      `non riesco a sapere se il documento è stato creato (${msg}): per non creare doppioni questo file resta sospeso — ricarica la pagina e riprova più tardi`,
      false, { sospeso: true })
    try {
      const doc = await cliente.creaDocumento({ kind: tipoDocumentoDaFile(foto.tipo), upload_ambito: ambito, note: nota })
      if (doc.errore || !doc.id) {
        if (doc.errore && sembraErroreDiRete(doc.errore)) return sospendi(doc.errore)
        return fallito(`creazione del documento fallita: ${doc.errore ?? 'senza id'}`, true)
      }
      documentId = doc.id
    } catch (e) {
      return sospendi(String((e as Error).message ?? e))
    }
  }

  // 3) ricevuta collegata (campi legacy per il vecchio /scontrini fino alla Fase 4)
  const payloadRicevuta = {
    storage_path: percorso, document_id: documentId, page_order: 1,
    mime_type: foto.tipo || null, file_sha256: foto.sha256,
    note: nota, ambito, status: 'da_leggere',
  }
  let errore: string
  try {
    const ric = await cliente.creaRicevuta(payloadRicevuta)
    if (!ric.errore) return { ok: true, documentId }
    if (!sembraVincoloUnico(ric.errore) && !sembraErroreDiRete(ric.errore))
      // rifiuto netto e definito: si riprova con lo STESSO file e documento
      return fallito(`foto non collegata (${ric.errore}): riprova — il documento non verrà duplicato`, true)
    errore = ric.errore
  } catch (e) {
    errore = String((e as Error).message ?? e)
  }

  // ESITO INCERTO (eccezione, errore di rete restituito o possibile vincolo
  // unico): la ricevuta può esistere. Si VERIFICA il nostro percorso prima di
  // decidere qualsiasi cosa.
  const c = await verificaRicevuta(cliente, percorso)
  if (c === 'esiste') return { ok: true, documentId }
  if (c === 'ignoto')
    // nemmeno la verifica risponde: non si cancella e non si decide niente
    return fallito(`collegamento dall'esito incerto (${errore}) e verifica non riuscita: non ho toccato nulla, riprova quando torna la rete`, true)
  if (sembraVincoloUnico(errore)) {
    // ACCERTATO che il nostro percorso NON è collegato: il vincolo riguarda
    // un'altra ricevuta con la stessa foto. Solo ora è sicuro togliere la copia.
    const via = await pulisci(cliente, percorso)
    return fallito(`questa foto è già in archivio (${errore})${via} · il documento creato resta in coda vuoto`, false, { duplicato: true, senzaPercorso: true })
  }
  return fallito(`collegamento fallito (${errore}): riprova — file e documento verranno riusati`, true)
}

// tre risposte oneste: c'è / non c'è / NON SI SA (mai scambiare l'ultima con la seconda)
async function verificaRicevuta(cliente: ClienteScrittura, percorso: string): Promise<'esiste' | 'assente' | 'ignoto'> {
  try {
    const c = await cliente.ricevutaEsiste(percorso)
    if (c.errore) return 'ignoto'
    return c.esiste ? 'esiste' : 'assente'
  } catch { return 'ignoto' }
}

// pulizia del file: se fallisce lo dice, senza fingere
async function pulisci(cliente: ClienteScrittura, percorso: string): Promise<string> {
  try {
    const r = await cliente.rimuoviFile(percorso)
    return r.errore ? ` · la copia doppia non è stata rimossa dal bucket (${r.errore})` : ''
  } catch { return ' · la copia doppia non è stata rimossa dal bucket' }
}

export async function sha256DiFile(file: Blob): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', buf)
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}
