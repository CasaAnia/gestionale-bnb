// ============================================================================
// SPESA A MANO CON ESITO INCERTO RICONCILIATO (revisione del 07/09/2026, R1).
// Il difetto: nel tracker vecchio «Riprova» ripeteva un INSERT nudo; se il
// server aveva salvato ma la risposta si era persa, 12 € diventavano 24 €.
// Qui, come per gli acconti (lib/statistiche/pagato.eseguiRegistraAcconto):
//   1. identità stabile del tentativo = l'ID della riga, generato dal client
//      e CUSTODITO (localStorage) PRIMA dell'invio, insieme al contenuto;
//   2. prima di ogni invio si RILEGGE quell'ID: se la riga c'è, il tentativo
//      precedente era andato a buon fine → nessun secondo INSERT;
//   3. l'INSERT porta l'ID: ripetuto, il database risponde «chiave duplicata»
//      (23505) = già salvata, non un errore;
//   4. rete persa = esito INCERTO, mai «Non salvato»: la custodia resta e la
//      prossima riapertura o «Riprova» riconcilia;
//   5. doppio tocco: un tentativo in corso blocca il secondo.
// Funzioni pure con dipendenze iniettate: si provano senza Supabase.
// Nessuna migrazione: family_expenses.id è già «uuid primary key».
// ============================================================================
import { isErroreDiRete } from '../connessione.ts'

export type SpesaPendente = { id: string; payload: Record<string, unknown>; creato: string; ambito: string }

export const chiaveMemoriaSpesa = (ambito: string) => `ca_spesa_pendente_${ambito}`

export const MESSAGGIO_INCERTO = 'Non so se la spesa è stata salvata (risposta persa): «Riprova» controlla e non la raddoppia'
export const MESSAGGIO_NON_SALVATA = 'Non salvato, riprova'
export const MESSAGGIO_RILETTURA = 'Non riesco a controllare se la spesa era già salvata: riprova'
export const MESSAGGIO_CUSTODIA = 'Non riesco a custodire il tentativo nel browser: spesa non inviata'

export function leggiPendente(testo: string | null, ambito: string): SpesaPendente | null {
  if (!testo) return null
  try {
    const p = JSON.parse(testo) as Partial<SpesaPendente>
    if (typeof p?.id !== 'string' || !p.id || typeof p.payload !== 'object' || !p.payload || p.ambito !== ambito) return null
    return { id: p.id, payload: p.payload as Record<string, unknown>, creato: String(p.creato ?? ''), ambito }
  } catch {
    return null
  }
}

// «Chiave duplicata»: l'ID esiste già → la riga era stata salvata
export const eChiaveDuplicata = (err: unknown) => String((err as { code?: unknown })?.code ?? '') === '23505'
// Rifiuto CERTO del server: un codice SQL di dati/vincoli/permessi (classi 22,
// 23, 42) o un errore di PostgREST (PGRST…): il database non ha scritto. Tutto
// il resto (rete, 5xx, timeout, risposta senza codice) è INCERTO: il server
// potrebbe aver salvato.
export function eRifiutoCerto(err: unknown): boolean {
  const codice = String((err as { code?: unknown })?.code ?? '')
  return /^(22|23|42)\d{3}$/.test(codice) || /^PGRST\d+$/.test(codice)
}

export type DepsInserimento = {
  nuovoId: () => string
  adesso: () => string
  leggiPendente: () => SpesaPendente | null
  custodisci: (p: SpesaPendente) => boolean
  dimentica: () => void
  // Torna { data: [riga] } se l'ID esiste, { data: [] } se no, { error } se la lettura non riesce
  esiste: (id: string) => PromiseLike<{ data: unknown[] | null; error: unknown }>
  inserisci: (id: string, payload: Record<string, unknown>) => PromiseLike<{ error: unknown }>
}

export type EsitoInserimento =
  | { esito: 'salvata'; id: string; giaPresente: boolean }
  | { esito: 'incerto'; id: string; messaggio: string }
  | { esito: 'non_salvata'; id: string; messaggio: string }
  | { esito: 'in_corso' }

let inCorso = new Set<string>()
export const _azzeraInCorso = () => { inCorso = new Set() }

// `payload` nuovo (dal modulo) oppure null = riprendi il pendente custodito
export async function eseguiInserimentoSpesa(ambito: string, payload: Record<string, unknown> | null, deps: DepsInserimento): Promise<EsitoInserimento> {
  const precedente = deps.leggiPendente()
  const pendente: SpesaPendente | null = payload
    ? (precedente && JSON.stringify(precedente.payload) === JSON.stringify(payload) ? precedente : { id: deps.nuovoId(), payload, creato: deps.adesso(), ambito })
    : precedente
  if (!pendente) return { esito: 'non_salvata', id: '', messaggio: MESSAGGIO_NON_SALVATA }
  if (inCorso.has(pendente.id)) return { esito: 'in_corso' }
  inCorso.add(pendente.id)
  try {
    // custodia PRIMA dell'invio
    if (!deps.custodisci(pendente)) return { esito: 'non_salvata', id: pendente.id, messaggio: MESSAGGIO_CUSTODIA }
    // rilettura: la riga con questo ID c'è già? (tentativo precedente riuscito, risposta persa)
    let letta: { data: unknown[] | null; error: unknown }
    try { letta = await deps.esiste(pendente.id) } catch (e) { letta = { data: null, error: e ?? new Error('errore sconosciuto') } }
    if (letta.error || !letta.data) return { esito: 'incerto', id: pendente.id, messaggio: MESSAGGIO_RILETTURA }
    if (letta.data.length > 0) { deps.dimentica(); return { esito: 'salvata', id: pendente.id, giaPresente: true } }
    // scrittura con l'ID stabile
    let r: { error: unknown }
    try { r = await deps.inserisci(pendente.id, pendente.payload) } catch (e) { r = { error: e ?? new Error('errore sconosciuto') } }
    if (!r.error) { deps.dimentica(); return { esito: 'salvata', id: pendente.id, giaPresente: false } }
    if (eChiaveDuplicata(r.error)) { deps.dimentica(); return { esito: 'salvata', id: pendente.id, giaPresente: true } }
    if (isErroreDiRete(r.error) || !eRifiutoCerto(r.error)) return { esito: 'incerto', id: pendente.id, messaggio: MESSAGGIO_INCERTO }
    // rifiuto certo (permessi, vincolo): la custodia si toglie, si può correggere e rimandare
    deps.dimentica()
    return { esito: 'non_salvata', id: pendente.id, messaggio: MESSAGGIO_NON_SALVATA }
  } finally {
    inCorso.delete(pendente.id)
  }
}
