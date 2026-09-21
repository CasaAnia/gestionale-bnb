// ============================================================================
// SALVARE L'ARRIVO — un solo salvataggio per tutti i punti di ingresso
// (21/09/2026; rifatto la sera dopo la verifica indipendente di Codex).
//
// Tre regole, tutte nate da un rilievo:
//
// 1. NIENTE RIPIEGO ALLA CIECA. Prima, dopo un errore QUALSIASI (permessi
//    negati, rete caduta, risposta persa) si riprovava a scrivere con le sole
//    due colonne di sempre, e Ania leggeva un messaggio sulla migrazione che
//    non c'entrava niente. Adesso si ripiega SOLO quando il server dice
//    davvero che una colonna non esiste (lib/colonnaMancante: 42703 o
//    PGRST204), e SOLO se scrivere con le due colonne di sempre non fa
//    perdere niente (`perditeSenza0058` vuoto). Se qualcosa si perderebbe —
//    il luogo, la fascia, l'autista, il prelievo — non si scrive NULLA: la
//    bozza resta a schermo e Ania legge cosa manca, in parole sue, senza
//    nessuna istruzione tecnica.
//
// 2. SUCCESSO SOLO SE UNA RIGA È DAVVERO CAMBIATA. Prima bastava `error:
//    null`, e una risposta `data: []` (nessuna riga toccata: id sbagliato,
//    riga sparita, permesso che filtra) passava per «salvato». Adesso la
//    scrittura chiede indietro le righe e, se non ne torna nessuna, l'esito
//    è «incerto»: lo stato a schermo NON cambia.
//
// 3. SI RILEGGE. Quello che finisce nella pagina è quello che il server
//    rimanda indietro, non quello che avevamo spedito: `rileggi` recupera la
//    riga e l'arrivo si ricompone da lì. Se la rilettura non torna, o non
//    combacia, l'esito è «incerto» e Ania lo legge.
//
// Non importa `supabase`: riceve scrittura e rilettura da chi lo chiama, e
// quindi si può far girare nei test con un finto server che rifiuta le
// colonne nuove, nega i permessi, perde la risposta o non tocca nessuna riga.
// ============================================================================
import {
  campiArrivo, campiArrivoVecchi, controllaArrivo, perditeSenza0058, leggiArrivo,
  COLONNE_0058, type Arrivo,
} from './arrivo.ts'
import { colonnaMancante } from './colonnaMancante.ts'
import { messaggioNonSalvato, MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

export const MESSAGGIO_INCERTO = 'Non sono sicuro che sia stato salvato: chiudi e riapri la prenotazione per controllare.'

/** Il messaggio quando il gestionale non sa ancora tenere questi dettagli.
 *  Parole di tutti i giorni: niente nomi di colonne, niente SQL, niente
 *  numeri di migrazione (Ania, 16/09/2026: «parlare semplice»). */
export function messaggioSenzaPosto(perse: string[]): string {
  const elenco = perse.length === 1 ? perse[0]
    : `${perse.slice(0, -1).join(', ')} e ${perse[perse.length - 1]}`
  return `Non ho salvato niente: questo gestionale non sa ancora tenere da conto ${elenco}. Quello che hai scritto è rimasto qui, non si è perso.`
}

export type RispostaArrivo = { data?: unknown; error?: unknown } | null | undefined
export type ScritturaArrivo = (campi: Record<string, string | null>) => PromiseLike<RispostaArrivo>
/** Rilegge la riga appena scritta (una sola riga, con tutte le colonne) */
export type RilettturaArrivo = () => PromiseLike<RispostaArrivo>

export type EsitoSalvataggioArrivo = {
  esito: 'ok' | 'errore' | 'incerto' | 'senza_posto'
  messaggio: string | null
  /** i campi DAVVERO in pagina, presi dalla rilettura; null se non si è salvato */
  campi: Record<string, unknown> | null
  /** l'arrivo come lo rilegge il gestionale dopo il salvataggio */
  arrivo: Arrivo | null
}

const righeTornate = (r: RispostaArrivo): number => {
  const d = r?.data
  if (Array.isArray(d)) return d.length
  return d ? 1 : 0
}
const primaRiga = (r: RispostaArrivo): Record<string, unknown> | null => {
  const d = r?.data
  if (Array.isArray(d)) return (d[0] as Record<string, unknown>) ?? null
  return (d as Record<string, unknown>) ?? null
}

/** L'errore dice che manca una colonna DELLA 0058? (e non un'altra cosa) */
function mancaUnaColonna0058(errore: unknown): boolean {
  const colonna = colonnaMancante(errore as { code?: string; message?: string } | null)
  return !!colonna && (COLONNE_0058 as readonly string[]).includes(colonna)
}

async function prova(scrivi: () => PromiseLike<RispostaArrivo>): Promise<{ risposta: RispostaArrivo; errore: unknown }> {
  try {
    const risposta = await scrivi()
    return { risposta, errore: risposta?.error ?? null }
  } catch (err) {
    return { risposta: null, errore: err ?? new Error('errore sconosciuto') }
  }
}

/** Salva l'arrivo e dice cosa è finito sul server. Controlla prima: un
 *  orario a metà o un luogo non scelto tornano indietro come errore, senza
 *  scrivere niente. */
export async function salvaArrivoPrenotazione(
  scrivi: ScritturaArrivo,
  arrivo: Arrivo,
  rileggi?: RilettturaArrivo,
): Promise<EsitoSalvataggioArrivo> {
  const problema = controllaArrivo(arrivo)
  if (problema) return { esito: 'errore', messaggio: problema, campi: null, arrivo: null }

  const tutto = campiArrivo(arrivo)
  const primo = await prova(() => scrivi(tutto))

  if (primo.errore) {
    // Solo una colonna che non esiste autorizza a cambiare strada. Qualsiasi
    // altro errore (permessi, rete, vincolo) si ferma qui: niente scritture
    // in più, niente messaggi sulla migrazione che non c'entrano.
    if (!mancaUnaColonna0058(primo.errore)) {
      return { esito: 'errore', messaggio: messaggioNonSalvato(primo.errore), campi: null, arrivo: null }
    }
    const perse = perditeSenza0058(arrivo)
    if (perse.length > 0) {
      // Non si scrive niente: meglio nessun salvataggio che un salvataggio
      // che perde il luogo o l'autista senza che nessuno se ne accorga.
      return { esito: 'senza_posto', messaggio: messaggioSenzaPosto(perse), campi: null, arrivo: null }
    }
    // Le due colonne di sempre bastano a dire tutto: si salva, e non si
    // perde niente. Nessun avviso, perché non c'è niente da avvisare.
    const secondo = await prova(() => scrivi({ ...campiArrivoVecchi(arrivo) }))
    if (secondo.errore) return { esito: 'errore', messaggio: messaggioNonSalvato(secondo.errore), campi: null, arrivo: null }
    return conferma(secondo.risposta, arrivo, rileggi)
  }

  return conferma(primo.risposta, arrivo, rileggi)
}

/** Una riga è cambiata davvero? E cosa c'è adesso sul server? */
async function conferma(risposta: RispostaArrivo, atteso: Arrivo, rileggi?: RilettturaArrivo): Promise<EsitoSalvataggioArrivo> {
  const scritte = righeTornate(risposta)
  if (!rileggi) {
    if (scritte === 0) return { esito: 'incerto', messaggio: MESSAGGIO_INCERTO, campi: null, arrivo: null }
    const riga = primaRiga(risposta)
    return { esito: 'ok', messaggio: null, campi: riga, arrivo: riga ? leggiArrivo(riga) : atteso }
  }

  const riletto = await prova(() => rileggi())
  if (riletto.errore || righeTornate(riletto.risposta) === 0) {
    // Non si sa: la scrittura può essere passata o no. Lo stato a schermo
    // non cambia e Ania sa che deve ricontrollare.
    return { esito: 'incerto', messaggio: MESSAGGIO_INCERTO, campi: null, arrivo: null }
  }
  const riga = primaRiga(riletto.risposta)!
  const adesso = leggiArrivo(riga)
  // Si confrontano TUTTI i campi che la riga riletta conosce, non solo le due
  // colonne di sempre: cambiare l'autista da Massimo ad Alberto non sposta
  // né check_in_time né shuttle, e con quel confronto un salvataggio che non
  // era passato sembrava riuscito (secondo giro di correzione, 21/09/2026).
  // Le colonne che la riga NON ha (0058 non applicata) non si controllano.
  const atteseTutte = campiArrivo(atteso)
  const diverse = Object.keys(atteseTutte).filter(k => k in riga && (riga[k] ?? null) !== atteseTutte[k])
  if (diverse.length > 0) return { esito: 'incerto', messaggio: MESSAGGIO_INCERTO, campi: null, arrivo: null }
  return { esito: 'ok', messaggio: null, campi: riga, arrivo: adesso }
}

export { MESSAGGIO_NON_SALVATO }
