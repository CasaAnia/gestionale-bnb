// ============================================================================
// SALVARE L'ARRIVO — un solo protocollo per tutti i punti di ingresso
// (21/09/2026; terzo giro, dopo il secondo ricontrollo di Codex su 07dc6e7).
//
// Il principio, in una riga: **non si dice mai una cosa che non si sa**, e
// non si scrive mai qualcosa che lasci la prenotazione mezza vecchia e mezza
// nuova. Quattro regole, tutte nate da un caso riprodotto.
//
// 1. RIPIEGO SOLO QUANDO È SICURO. Si riscrive con le due colonne di sempre
//    soltanto se (a) il server dice davvero che manca una colonna della 0058
//    (lib/colonnaMancante: 42703 o PGRST204), (b) quello che Ania ha scritto
//    ci sta tutto in quelle due colonne (`perditeSenza0058` vuoto), e (c)
//    andando a guardare, la riga NON ha già dei dettagli scritti — luogo,
//    fascia, autista — che resterebbero lì a contraddire i due campi nuovi.
//    Senza tutte e tre, non si scrive NIENTE: la bozza resta a schermo.
//    (Caso 3 di Codex: con la cache dello schema vecchia, il ripiego
//    scriveva 18:00/no sopra una riga che diceva ancora Linate/Massimo.)
//
// 2. ERRORE CERTO E ERRORE INCERTO NON SONO LA STESSA COSA. Se il SERVER ha
//    risposto un errore suo (un codice PostgreSQL come 42501, o un PGRST…),
//    la sua transazione è annullata: non è stato scritto niente, e lo si può
//    dire. Se invece la chiamata è morta per strada la scrittura può essere
//    passata lo stesso: allora si va a RILEGGERE e si riconcilia.
//    Attenzione: la libreria di Supabase NON lancia un'eccezione quando la
//    rete cade — mette l'errore nella risposta, con un codice vuoto. Per
//    questo si guarda la FORMA del codice, non se è arrivata un'eccezione
//    (provato nell'anteprima: senza questo, «rete caduta» tornava certa).
//    (Caso 1 di Codex: «Non salvato, riprova» mentre Massimo era salvato.)
//
// 3. LA RILETTURA DEVE ESSERE COMPLETA. Non basta che i campi presenti
//    combacino: devono esserci TUTTI quelli che ci aspettiamo di aver
//    scritto. Una riletta con le sole due colonne di sempre non conferma
//    un salvataggio con luogo e autista — anzi, ricomponendo l'arrivo da lì
//    tornerebbe «da definire».
//    (Caso 2 di Codex: esito «ok» e l'arrivo tornato da_definire.)
//
// 4. QUELLO CHE VA A SCHERMO È LA RIGA DEL SERVER, mai quello che avevamo
//    spedito.
//
// Non importa `supabase`: riceve scrittura e rilettura da chi lo chiama, e
// quindi si può far girare nei test con un finto server che rifiuta le
// colonne nuove, nega i permessi, muore a metà, non tocca nessuna riga o
// ne restituisce una incompleta. Non tocca `lib/scritturaSicura`, che è
// condivisa con altri blocchi.
// ============================================================================
import {
  campiArrivo, campiArrivoVecchi, controllaArrivo, perditeSenza0058, leggiArrivo,
  COLONNE_0058, type Arrivo,
} from './arrivo.ts'
import { colonnaMancante } from './colonnaMancante.ts'
import { messaggioNonSalvato, MESSAGGIO_NON_SALVATO } from './scritturaSicura.ts'

export const MESSAGGIO_INCERTO = 'Non sono sicuro che sia stato salvato: chiudi e riapri la prenotazione per controllare.'
export const MESSAGGIO_DETTAGLI_ESISTENTI = 'Non ho salvato niente: su questa prenotazione ci sono già i dettagli dell’arrivo, e adesso il gestionale non riesce a cambiarli. Quello che hai scritto è rimasto qui, non si è perso.'

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
/** Rilegge la riga appena scritta: UNA riga, con TUTTE le sue colonne */
export type RilettturaArrivo = () => PromiseLike<RispostaArrivo>

export type EsitoArrivo = 'ok' | 'errore' | 'incerto' | 'senza_posto'

export type EsitoSalvataggioArrivo = {
  esito: EsitoArrivo
  messaggio: string | null
  /** la riga DAVVERO sul server, da rimettere nella pagina; null se non si è salvato */
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

/** La riga porta già dei dettagli dell'arrivo? Se sì, riscrivere solo le due
 *  colonne di sempre la lascerebbe mezza vecchia e mezza nuova. */
export function dettagliEsistenti(riga: Record<string, unknown> | null): boolean {
  if (!riga) return false
  return COLONNE_0058.some(c => c in riga && riga[c] != null && riga[c] !== '')
}

type Tentativo = { risposta: RispostaArrivo; errore: unknown; certo: boolean }

/** Un codice di PostgreSQL (cinque caratteri, tipo 42501 o 23514) oppure di
 *  PostgREST (PGRST204): vuol dire che la richiesta è ARRIVATA al server ed
 *  è stata rifiutata da lui, quindi non è stato scritto niente. Un errore di
 *  rete non ha nessuno di questi codici — la libreria di Supabase lo mette
 *  nella risposta con `code` vuoto — e allora non si sa com'è finita. */
export function erroreDelServer(errore: unknown): boolean {
  const codice = String((errore as { code?: unknown } | null)?.code ?? '')
  return /^[0-9A-Z]{5}$/.test(codice) || /^PGRST\d+$/.test(codice)
}

/** Una scrittura, distinguendo l'errore del SERVER (transazione annullata:
 *  non è stato scritto niente) da tutto il resto, dove non si sa. */
async function prova(scrivi: () => PromiseLike<RispostaArrivo>): Promise<Tentativo> {
  try {
    const risposta = await scrivi()
    const errore = risposta?.error ?? null
    return { risposta, errore, certo: !!errore && erroreDelServer(errore) }
  } catch (err) {
    const errore = err ?? new Error('errore sconosciuto')
    return { risposta: null, errore, certo: erroreDelServer(errore) }
  }
}

type Confronto = 'uguale' | 'incompleta' | 'diversa'

/** La riga riletta conferma quello che volevamo scrivere?
 *  `attese` sono i campi che ci aspettiamo di trovare: TUTTI, non solo
 *  quelli che la riga per caso contiene (caso 2 di Codex). */
export function confrontaRiga(riga: Record<string, unknown>, attese: Record<string, string | null>): Confronto {
  const mancanti = Object.keys(attese).filter(k => !(k in riga))
  if (mancanti.length > 0) return 'incompleta'
  const diverse = Object.keys(attese).filter(k => (riga[k] ?? null) !== attese[k])
  return diverse.length > 0 ? 'diversa' : 'uguale'
}

const esitoIncerto = (): EsitoSalvataggioArrivo => ({ esito: 'incerto', messaggio: MESSAGGIO_INCERTO, campi: null, arrivo: null })
const esitoSenzaPosto = (messaggio: string): EsitoSalvataggioArrivo => ({ esito: 'senza_posto', messaggio, campi: null, arrivo: null })

/** Salva l'arrivo e dice cosa è finito sul server — o, quando non si può
 *  sapere, che non si sa. Controlla prima: un orario a metà o un luogo non
 *  scelto tornano indietro come errore, senza scrivere niente. */
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
    // il server ha risposto un errore suo: la sua transazione è annullata
    if (primo.certo) {
      if (!mancaUnaColonna0058(primo.errore)) {
        return { esito: 'errore', messaggio: messaggioNonSalvato(primo.errore), campi: null, arrivo: null }
      }
      return ripiega(arrivo, scrivi, rileggi)
    }
    // non si sa se è arrivata: si va a vedere com'è finita
    return riconcilia(primo.errore, arrivo, tutto, rileggi)
  }

  return conferma(primo.risposta, tutto, rileggi)
}

/** Il ripiego sulle due colonne di sempre: solo se non si perde niente E
 *  solo se la riga non ha già dettagli che resterebbero a contraddirle. */
async function ripiega(arrivo: Arrivo, scrivi: ScritturaArrivo, rileggi?: RilettturaArrivo): Promise<EsitoSalvataggioArrivo> {
  const perse = perditeSenza0058(arrivo)
  if (perse.length > 0) return esitoSenzaPosto(messaggioSenzaPosto(perse))

  // Senza poter guardare la riga non si sa cosa si lascerebbe dietro: non si scrive.
  if (!rileggi) return esitoSenzaPosto(MESSAGGIO_DETTAGLI_ESISTENTI)

  const prima = await prova(() => rileggi())
  if (prima.errore || righeTornate(prima.risposta) === 0) return esitoIncerto()
  if (dettagliEsistenti(primaRiga(prima.risposta))) return esitoSenzaPosto(MESSAGGIO_DETTAGLI_ESISTENTI)

  const vecchie = { ...campiArrivoVecchi(arrivo) }
  const secondo = await prova(() => scrivi(vecchie))
  if (secondo.errore) {
    return secondo.certo
      ? { esito: 'errore', messaggio: messaggioNonSalvato(secondo.errore), campi: null, arrivo: null }
      : riconcilia(secondo.errore, arrivo, vecchie, rileggi)
  }
  return conferma(secondo.risposta, vecchie, rileggi)
}

/** Una riga è cambiata davvero? E la rilettura lo conferma per intero? */
async function conferma(risposta: RispostaArrivo, attese: Record<string, string | null>, rileggi?: RilettturaArrivo): Promise<EsitoSalvataggioArrivo> {
  if (righeTornate(risposta) === 0) return esitoIncerto()
  if (!rileggi) {
    const riga = primaRiga(risposta)
    // senza rilettura ci si fida solo di una riga che conferma tutto
    if (!riga || confrontaRiga(riga, attese) !== 'uguale') return esitoIncerto()
    return { esito: 'ok', messaggio: null, campi: riga, arrivo: leggiArrivo(riga) }
  }

  const riletto = await prova(() => rileggi())
  if (riletto.errore || righeTornate(riletto.risposta) === 0) return esitoIncerto()
  const riga = primaRiga(riletto.risposta)!
  // «incompleta» e «diversa» finiscono tutte e due nell'incerto: in un caso
  // non sappiamo, nell'altro sappiamo che non combacia ma la scrittura era
  // partita — in nessuno dei due si può aggiornare la pagina.
  if (confrontaRiga(riga, attese) !== 'uguale') return esitoIncerto()
  return { esito: 'ok', messaggio: null, campi: riga, arrivo: leggiArrivo(riga) }
}

/** Dopo una chiamata morta senza risposta: si va a vedere com'è finita.
 *  Se la riga conferma tutto, era passata. Se la riga è completa e dice
 *  un'altra cosa, non era passata e lo si può dire. Altrimenti: non si sa. */
async function riconcilia(errore: unknown, arrivo: Arrivo, attese: Record<string, string | null>, rileggi?: RilettturaArrivo): Promise<EsitoSalvataggioArrivo> {
  if (!rileggi) return esitoIncerto()
  const riletto = await prova(() => rileggi())
  if (riletto.errore || righeTornate(riletto.risposta) === 0) return esitoIncerto()
  const riga = primaRiga(riletto.risposta)!
  const confronto = confrontaRiga(riga, attese)
  if (confronto === 'uguale') return { esito: 'ok', messaggio: null, campi: riga, arrivo: leggiArrivo(riga) }
  if (confronto === 'incompleta') return esitoIncerto()
  // la riga è completa e dice un'altra cosa: la scrittura non ha avuto effetto
  return { esito: 'errore', messaggio: messaggioNonSalvato(errore), campi: null, arrivo: null }
}

export { MESSAGGIO_NON_SALVATO }
