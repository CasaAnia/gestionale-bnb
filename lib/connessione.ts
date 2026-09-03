// Stato della connessione al server (Supabase), condiviso da tutta l'app.
//
// Perché esiste: il 3 settembre 2026 il telefono ha perso la linea mentre
// Ania inseriva un cliente. Le pagine chiedevano i dati a Supabase, l'errore
// di rete veniva ignorato e la home mostrava tutti gli importi a ZERO come se
// fossero veri; la ricerca cliente, non trovando nulla, proponeva «nuovo
// cliente». Da qui:
//  - ogni richiesta a Supabase passa da creaFetchSorvegliato: ha un tempo
//    massimo (niente rotelline infinite) e segnala qui se il server non è
//    raggiungibile;
//  - components/AvvisoConnessione mostra l'avviso in alto in tutta l'app;
//  - le pagine possono distinguere «errore di rete» da «dati vuoti» con
//    isErroreDiRete.

export type StatoConnessione = {
  serverIrraggiungibile: boolean
  ultimoErrore: string | null
  cambiatoAlle: number
}

let stato: StatoConnessione = { serverIrraggiungibile: false, ultimoErrore: null, cambiatoAlle: 0 }
const ascoltatori = new Set<(s: StatoConnessione) => void>()

export function statoConnessione(): StatoConnessione { return stato }

export function ascoltaConnessione(fn: (s: StatoConnessione) => void): () => void {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}

function aggiorna(next: Omit<StatoConnessione, 'cambiatoAlle'>) {
  if (next.serverIrraggiungibile === stato.serverIrraggiungibile) return
  stato = { ...next, cambiatoAlle: Date.now() }
  for (const fn of ascoltatori) fn(stato)
}

export function segnalaServerIrraggiungibile(motivo: string) {
  aggiorna({ serverIrraggiungibile: true, ultimoErrore: motivo })
}

export function segnalaServerRaggiunto() {
  aggiorna({ serverIrraggiungibile: false, ultimoErrore: null })
}

// Solo per i test: riporta lo stato iniziale.
export function azzeraConnessionePerTest() {
  stato = { serverIrraggiungibile: false, ultimoErrore: null, cambiatoAlle: 0 }
}

// Tempo massimo di attesa di una risposta. Le letture e scritture normali
// rispondono in pochi secondi; i FILE (foto degli scontrini su rete mobile)
// possono legittimamente metterci molto di più.
export const TEMPO_MASSIMO_MS = 30_000
export const TEMPO_MASSIMO_FILE_MS = 120_000

function descriviErrore(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

// Vero se l'errore (eccezione o oggetto error di Supabase) è dovuto alla
// rete o al tempo scaduto, e non a una risposta del server.
export function isErroreDiRete(err: unknown): boolean {
  if (!err) return false
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const nome = String((err as { name?: unknown })?.name ?? '').toLowerCase()
  if (nome === 'aborterror' || nome === 'timeouterror') return true
  const testo = String((err as { message?: unknown })?.message ?? (typeof err === 'string' ? err : '')).toLowerCase()
  return testo.includes('failed to fetch')     // Chrome
    || testo.includes('load failed')            // Safari / iPhone
    || testo.includes('networkerror')           // Firefox
    || testo.includes('network request failed')
    || testo.includes('fetch failed')           // Node / undici
    || testo.includes('tempo scaduto')          // il nostro timeout
    || testo.includes('aborterror')
    || testo.includes('timeouterror')
}

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export type OpzioniSorveglianza = {
  tempoMassimoMs?: number
  tempoMassimoFileMs?: number
}

function urlDi(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return (input as Request).url ?? ''
}

// Avvolge fetch: tempo massimo per richiesta e aggiornamento dello stato.
// Un annullamento voluto dall'app (init.signal già abortito) non è un errore
// di rete e non accende l'avviso.
export function creaFetchSorvegliato(fetchReale?: Fetch, opzioni: OpzioniSorveglianza = {}): Fetch {
  const chiama: Fetch = fetchReale ?? ((input, init) => fetch(input, init))
  const normale = opzioni.tempoMassimoMs ?? TEMPO_MASSIMO_MS
  const file = opzioni.tempoMassimoFileMs ?? TEMPO_MASSIMO_FILE_MS
  return async (input, init) => {
    const limite = urlDi(input).includes('/storage/v1/') ? file : normale
    const controller = new AbortController()
    const esterno = init?.signal ?? null
    if (esterno) {
      if (esterno.aborted) controller.abort(esterno.reason)
      else esterno.addEventListener('abort', () => controller.abort(esterno.reason), { once: true })
    }
    const scaduto = new Error(`Tempo scaduto: il server non ha risposto entro ${Math.round(limite / 1000)} secondi`)
    scaduto.name = 'TimeoutError'
    const timer = setTimeout(() => controller.abort(scaduto), limite)
    try {
      const risposta = await chiama(input, { ...init, signal: controller.signal })
      segnalaServerRaggiunto()
      return risposta
    } catch (err) {
      if (esterno?.aborted) throw err
      segnalaServerIrraggiungibile(descriviErrore(err))
      throw err
    } finally {
      clearTimeout(timer)
    }
  }
}

// Testo per l'utente a partire da un errore di lettura/ricerca.
export function messaggioErroreDati(err: unknown, cosa = 'caricare i dati'): string {
  if (isErroreDiRete(err)) return `Non riesco a ${cosa}: nessuna connessione al server. Controlla la linea e riprova.`
  const m = String((err as { message?: unknown })?.message ?? err ?? 'errore sconosciuto')
  return `Non riesco a ${cosa}: ${m}`
}
