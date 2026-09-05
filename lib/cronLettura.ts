// Letture delle route cron (/api/push/*) con esito controllato — errori di
// salvataggio visibili, parte 3 (05/09/2026). Prima `const { data } = await
// supabase…` ignorava `error`: una tabella non leggibile diventava «nessun
// arrivo domani» con risposta 200. Ora una lettura fallita lancia
// ErroreLetturaCron e la route risponde 500 con il motivo, mai 200.
// Nessun import di Supabase: le route passano la risposta già ricevuta.

export class ErroreLetturaCron extends Error {
  readonly cosa: string
  constructor(cosa: string, dettaglio: string) {
    super(`Non riesco a ${cosa}: ${dettaglio}`)
    this.name = 'ErroreLetturaCron'
    this.cosa = cosa
  }
}

// Riga generica di una select (le route leggono i campi con i loro callback)
export type Riga = Record<string, unknown>

type RispostaLettura<T> = { data: T | null; error: { message?: string } | null }

// Torna i dati o lancia ErroreLetturaCron. `data` null senza errore non
// succede per una select di lista; se succede è comunque una lettura fallita.
export function pretendi<T>(risposta: RispostaLettura<T>, cosa: string): T {
  if (risposta.error) throw new ErroreLetturaCron(cosa, risposta.error.message ?? 'errore sconosciuto')
  if (risposta.data == null) throw new ErroreLetturaCron(cosa, 'nessun dato')
  return risposta.data
}

export type RispostaHttp = { status: number; body: Record<string, unknown> }

// Da un'eccezione alla risposta HTTP della route: 500 con il motivo per le
// letture fallite; null per tutto il resto (la route lo rilancia).
export function rispostaErroreCron(e: unknown): RispostaHttp | null {
  if (e instanceof ErroreLetturaCron) return { status: 500, body: { ok: false, error: e.message } }
  return null
}

// Stato HTTP per l'esito di un invio: 500 se non è partito NIENTE e ci sono
// errori (sottoscrizioni non lette, servizio push giù); 200 altrimenti,
// anche con errori parziali (che restano elencati nel corpo).
export function statoPerEsitoInvio(esito: { inviate: number; errori: string[] }): number {
  return esito.inviate === 0 && esito.errori.length > 0 ? 500 : 200
}
