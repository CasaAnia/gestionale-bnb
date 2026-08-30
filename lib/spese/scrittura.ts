// ============================================================================
// SCRITTURE del nuovo modulo spese (3.2B) — logica PURA e testabile.
// Il client è INIETTATO: nei test è finto (nessuna scrittura vera), nelle
// pagine ufficiali è scritturaSupabase.ts. La preview /nuove-spese-reali
// NON importa questo modulo: resta in sola lettura.
//
// Regole rispettate (decisioni approvate):
//  · metodo di pagamento OBBLIGATORIO per le spese di Casa Ania;
//  · camera facoltativa (solo azienda; vuota = Generale);
//  · expense_nature è l'unica fonte di verità per la natura della spesa
//    (il vecchio flag recurring resta in sola lettura storica);
//  · caricare un documento NON crea mai una spesa: nasce `da_elaborare`
//    e aspetta la revisione (Fase 4);
//  · un errore non deve mai sembrare un successo.
// ============================================================================

export type EsitoScrittura = { ok: true } | { ok: false; errore: string }

// ---- inserimento manuale ----
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

export function importoDaTesto(testo: string): number | null {
  const n = parseFloat(testo.replace(/\./g, '').replace(',', '.'))
  if (!isFinite(n) || n <= 0) return null
  return Math.round(n * 100) / 100
}

export function validaSpesaManuale(input: SpesaManualeInput, ambito: 'personale' | 'azienda'): string[] {
  const errori: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expense_date)) errori.push('manca la data')
  if (importoDaTesto(input.importo) === null) errori.push('l\'importo deve essere un numero sopra lo zero')
  if (!input.group_id) errori.push(ambito === 'azienda' ? 'manca il gruppo' : 'scegli di chi è la spesa')
  if (ambito === 'azienda' && !input.payment_method)
    errori.push('per Casa Ania il metodo di pagamento è obbligatorio')
  return errori
}

export type ClienteScrittura = {
  inserisciSpesa(payload: Record<string, unknown>): Promise<{ errore?: string }>
  caricaFile(percorso: string, file: Blob, tipo: string): Promise<{ errore?: string }>
  rimuoviFile(percorso: string): Promise<void>
  creaDocumento(payload: Record<string, unknown>): Promise<{ id?: string; errore?: string }>
  creaRicevuta(payload: Record<string, unknown>): Promise<{ errore?: string }>
}

// Inserisce una spesa manuale (senza documento). Ritorna l'esito senza mai
// lanciare: chi chiama tiene il modulo aperto e i valori intatti sull'errore.
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

// ---- caricamento di un documento con fotografia ----
// Ordine: file nel bucket → documento (da_elaborare) → ricevuta collegata.
// Se il documento fallisce: il file viene rimosso (niente orfani).
// Se la ricevuta fallisce: il file viene rimosso e l'errore dice che il
// documento è rimasto "in coda senza foto" (il membro non può eliminare i
// documenti: è una protezione del database, non un difetto).
export type FotoDaCaricare = {
  nomeFile: string
  tipo: string                 // mime
  contenuto: Blob
  sha256: string | null       // calcolato fuori (crypto.subtle); null se non disponibile
}

export async function caricaDocumentoConFoto(
  cliente: ClienteScrittura,
  foto: FotoDaCaricare,
  ambito: 'personale' | 'azienda',
  nota: string | null,
  kind: 'scontrino' | 'fattura' | 'altro' = 'scontrino',
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
): Promise<EsitoScrittura & { documentId?: string }> {
  const ext = (foto.nomeFile.split('.').pop() || 'jpg').toLowerCase()
  const percorso = `${adesso().slice(0, 10)}/${idCasuale()}.${ext}`
  try {
    const su = await cliente.caricaFile(percorso, foto.contenuto, foto.tipo || 'image/jpeg')
    if (su.errore) return { ok: false, errore: `caricamento della foto fallito: ${su.errore}` }

    const doc = await cliente.creaDocumento({ kind, upload_ambito: ambito, note: nota })
    if (doc.errore || !doc.id) {
      await cliente.rimuoviFile(percorso)
      return { ok: false, errore: `creazione del documento fallita: ${doc.errore ?? 'senza id'}` }
    }

    const ric = await cliente.creaRicevuta({
      storage_path: percorso,
      document_id: doc.id,
      page_order: 1,
      mime_type: foto.tipo || null,
      file_sha256: foto.sha256,
      // campi legacy: il vecchio /scontrini continua a vederli finché la
      // Fase 4 non lo riscrive a sole bozze
      note: nota,
      ambito,
      status: 'da_leggere',
    })
    if (ric.errore) {
      await cliente.rimuoviFile(percorso)
      return {
        ok: false, documentId: doc.id,
        errore: `foto non collegata (${ric.errore}): il documento è rimasto in coda SENZA foto — riprova a caricare`,
      }
    }
    return { ok: true, documentId: doc.id }
  } catch (e) {
    return { ok: false, errore: String((e as Error).message ?? e) }
  }
}

export async function sha256DiFile(file: Blob): Promise<string | null> {
  try {
    const buf = await file.arrayBuffer()
    const hash = await crypto.subtle.digest('SHA-256', buf)
    return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')
  } catch { return null }
}
