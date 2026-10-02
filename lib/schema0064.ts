// ============================================================================
// PROPOSTA 0064 (bagagli e partenza, «Altro» negli spazi comuni, ora e
// «togli» delle pulizie, prezzi della lavanderia): COSA C'È NEL DATABASE.
//
// Finché Ania non applica la 0064, tutto quello che la usa resta NASCOSTO,
// senza errori. Si chiede al server una riga sola con le colonne nuove
// (`select colonna limit 1`) e si guarda la risposta:
//   - nessun errore                    → 'si'  (la colonna c'è)
//   - colonna o tabella assente        → 'no'  (42703, PGRST204, 42P01, PGRST205)
//   - qualunque altro errore (rete,
//     permessi, server)                → 'errore': NON si nasconde come
//     «funzione non disponibile», lo si dice (integrazione di Ania, punto 6)
// Una sonda per pezzo: le colonne nascono tutte nella stessa migrazione, ma
// ogni parte dell'app guarda solo quelle che usa davvero.
// Funzioni pure: il client arriva da fuori, così i test usano un finto server.
// ============================================================================
export type Disponibilita = 'si' | 'no' | 'errore'
type ErroreServer = { code?: string; message?: string } | null | undefined

const ASSENTE = ['42703', 'PGRST204', '42P01', 'PGRST205']
export function esitoSonda(error: ErroreServer): Disponibilita {
  if (!error) return 'si'
  return ASSENTE.includes(error.code ?? '') ? 'no' : 'errore'
}

/** Le quattro parti della 0064 e le colonne che le provano. */
export const SONDE_0064 = {
  orari: { tabella: 'bookings', colonne: 'bagagli_alle,check_out_time' },
  altro: { tabella: 'pulizie_fuori_camera', colonne: 'cosa' },
  oraPulizia: { tabella: 'cleanings', colonne: 'ora_effettiva' },
  lavanderia: { tabella: 'prezzi_lavanderia', colonne: 'pezzo,prezzo' },
} as const
export type Parte0064 = keyof typeof SONDE_0064

type Client = { from: (t: string) => { select: (c: string) => { limit: (n: number) => PromiseLike<{ error: ErroreServer }> } } }
export async function sonda(client: Client, parte: Parte0064): Promise<Disponibilita> {
  const s = SONDE_0064[parte]
  try { return esitoSonda((await client.from(s.tabella).select(s.colonne).limit(1)).error) }
  catch { return 'errore' }
}

export const AVVISO_SONDA = 'Non riesco a controllare il database: controlla la connessione e riprova.'

// ── orari ─────────────────────────────────────────────────────────────────
// PostgreSQL restituisce le ore come «11:00:00»: a schermo «11:00».
export function oraBreve(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^(\d{1,2}):(\d{2})/.exec(v.trim())
  if (!m) return null
  const h = Number(m[1]), min = Number(m[2])
  if (h > 23 || min > 59) return null
  return `${h}:${m[2]}`
}
/** «11:00» / «9:05» → minuti dalla mezzanotte; null se non è un'ora. */
export function minutiDa(v: unknown): number | null {
  const o = oraBreve(v)
  if (!o) return null
  const [h, m] = o.split(':').map(Number)
  return h * 60 + m
}
/** Un'ora scritta a mano è valida? «9», «9:5» non bastano: «9:05», «09:05», «21:30». */
export function oraValida(v: string): boolean {
  return /^([01]?\d|2[0-3]):[0-5]\d$/.test(v.trim())
}
/** Quella che si scrive nel database: «09:05». */
export function oraPerSql(v: string): string {
  const [h, m] = v.trim().split(':')
  return `${h.padStart(2, '0')}:${m}`
}
