// Richieste di prenotazione (pezzo 1 di 8): tipi, ordinamento e testi.
// Funzioni pure, senza Supabase: si provano con `node --test`.
// La parte che parla col database sta in lib/richiesteDati.ts.

export type StatoRichiesta = 'in_attesa' | 'proposta_inviata' | 'confermata' | 'rifiutata'
export type CanaleRichiesta = 'web' | 'telefono' | 'whatsapp'
export type OrdineRichieste = 'durata' | 'arrivo' | 'persone'

export interface Richiesta {
  id: string
  created_at: string
  nome: string
  cognome: string
  arrivo: string
  partenza: string
  persone: number
  camera_id: string | null
  canale: CanaleRichiesta
  telefono: string | null
  note: string | null
  stato: StatoRichiesta
  proposta_inviata_at: string | null
  chiusa_at: string | null
  prenotazione_id: string | null
  origine?: string | null        // dal sito: "google", "diretto"… (migrazione 0028)
  rooms?: { name: string } | null
}

export const STATI_APERTI: StatoRichiesta[] = ['in_attesa', 'proposta_inviata']
export const STATI_CHIUSI: StatoRichiesta[] = ['confermata', 'rifiutata']
export const GIORNI_ARCHIVIO = 90

export const CANALE_LABEL: Record<CanaleRichiesta, string> = {
  web: 'dal sito',
  telefono: 'telefono',
  whatsapp: 'WhatsApp',
}

export const STATO_LABEL: Record<StatoRichiesta, string> = {
  in_attesa: 'in attesa',
  proposta_inviata: 'proposta inviata',
  confermata: 'confermata',
  rifiutata: 'rifiutata',
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

// Data ISO (YYYY-MM-DD) → parti numeriche, senza passare dal fuso orario.
function parti(iso: string): { anno: number; mese: number; giorno: number } {
  const [a, m, g] = iso.split('-').map(Number)
  return { anno: a, mese: m, giorno: g }
}

export function nottiRichiesta(r: { arrivo: string; partenza: string }): number {
  const n = Math.round((Date.parse(r.partenza + 'T00:00:00Z') - Date.parse(r.arrivo + 'T00:00:00Z')) / 86400000)
  return Number.isFinite(n) && n > 0 ? n : 0
}

// "13–15 set" · "30 set – 2 ott" · "30 dic 2026 – 2 gen 2027"
export function formatIntervallo(arrivo: string, partenza: string): string {
  const a = parti(arrivo), p = parti(partenza)
  if (a.anno === p.anno && a.mese === p.mese) return `${a.giorno}–${p.giorno} ${MESI[a.mese - 1]}`
  if (a.anno === p.anno) return `${a.giorno} ${MESI[a.mese - 1]} – ${p.giorno} ${MESI[p.mese - 1]}`
  return `${a.giorno} ${MESI[a.mese - 1]} ${a.anno} – ${p.giorno} ${MESI[p.mese - 1]} ${p.anno}`
}

export function nomeCompleto(r: { nome: string; cognome: string }): string {
  return `${r.cognome.trim()} ${r.nome.trim()}`.trim()
}

const due = (n: number) => String(n).padStart(2, '0')
const stessoGiorno = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

// Ora di arrivo relativa: "oggi 08:41", "ieri 22:30", "30 ago 08:41",
// "30 ago 2025 08:41" se di un altro anno. Ore nel fuso del telefono.
export function oraArrivo(createdAt: string, adesso: Date = new Date()): string {
  const d = new Date(createdAt)
  if (Number.isNaN(d.getTime())) return ''
  const ora = `${due(d.getHours())}:${due(d.getMinutes())}`
  const ieri = new Date(adesso); ieri.setDate(ieri.getDate() - 1)
  if (stessoGiorno(d, adesso)) return `oggi ${ora}`
  if (stessoGiorno(d, ieri)) return `ieri ${ora}`
  const anno = d.getFullYear() === adesso.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${MESI[d.getMonth()]}${anno} ${ora}`
}

// "adesso", "5 minuti fa", "1 ora fa", "3 ore fa", "2 giorni fa"
export function tempoTrascorso(da: string, adesso: Date = new Date()): string {
  const ms = adesso.getTime() - new Date(da).getTime()
  if (Number.isNaN(ms)) return ''
  const minuti = Math.floor(ms / 60000)
  if (minuti < 1) return 'adesso'
  if (minuti < 60) return minuti === 1 ? '1 minuto fa' : `${minuti} minuti fa`
  const ore = Math.floor(minuti / 60)
  if (ore < 24) return ore === 1 ? '1 ora fa' : `${ore} ore fa`
  const giorni = Math.floor(ore / 24)
  return giorni === 1 ? '1 giorno fa' : `${giorni} giorni fa`
}

// Ordine della lista. "durata": notti decrescenti; "persone": decrescenti;
// "arrivo": ordine di arrivo della richiesta. A parità sempre la più vecchia prima.
export function ordinaRichieste<T extends Richiesta>(lista: T[], ordine: OrdineRichieste): T[] {
  const perArrivo = (a: T, b: T) => a.created_at.localeCompare(b.created_at)
  return [...lista].sort((a, b) => {
    if (ordine === 'durata') return (nottiRichiesta(b) - nottiRichiesta(a)) || perArrivo(a, b)
    if (ordine === 'persone') return (b.persone - a.persone) || perArrivo(a, b)
    return perArrivo(a, b)
  })
}

export const eAperta = (r: { stato: StatoRichiesta }) => STATI_APERTI.includes(r.stato)

// In archivio: chiuse (confermate o rifiutate) negli ultimi 90 giorni.
// Se manca chiusa_at (dato vecchio) si guarda l'arrivo della richiesta.
export function inArchivio(r: Pick<Richiesta, 'stato' | 'chiusa_at' | 'created_at'>, adesso: Date = new Date()): boolean {
  if (!STATI_CHIUSI.includes(r.stato)) return false
  const riferimento = new Date(r.chiusa_at ?? r.created_at).getTime()
  return adesso.getTime() - riferimento <= GIORNI_ARCHIVIO * 86400000
}

export function contaAperte(lista: { stato: StatoRichiesta }[]): number {
  return lista.filter(eAperta).length
}

// Messaggio chiaro quando la tabella non esiste ancora (migrazione 0024 non
// applicata): un salvataggio che fallisse in silenzio sarebbe il difetto peggiore.
export function spiegaErrore(e: { code?: string; message?: string } | null | undefined): string {
  if (!e) return ''
  if (e.code === 'PGRST205' || /richieste.*(schema cache|does not exist|not find)/i.test(e.message || ''))
    return 'La tabella «richieste» non esiste ancora su Supabase: va applicata la migrazione 0024.'
  return e.message || 'errore sconosciuto'
}

// ── Richieste ferme (avvisi, mai chiusure automatiche) ─────────────────────
export const ORE_ATTESA_FERMA = 24        // in attesa da più di 24 ore
export const ORE_PROPOSTA_FERMA = 48      // proposta inviata da più di 48 ore

// "ferma da 3 ore" · "ferma da 2 giorni" · "arrivo passato" · null se tutto ok
export function avvisoFerma(r: Pick<Richiesta, 'stato' | 'arrivo' | 'created_at' | 'proposta_inviata_at'>, adesso: Date = new Date()): string | null {
  if (!eAperta(r)) return null
  const oggi = `${adesso.getFullYear()}-${due(adesso.getMonth() + 1)}-${due(adesso.getDate())}`
  if (r.arrivo < oggi) return 'arrivo passato'
  const da = r.stato === 'proposta_inviata' ? (r.proposta_inviata_at ?? r.created_at) : r.created_at
  const soglia = r.stato === 'proposta_inviata' ? ORE_PROPOSTA_FERMA : ORE_ATTESA_FERMA
  const ore = (adesso.getTime() - new Date(da).getTime()) / 3600000
  if (!(ore > soglia)) return null
  return `ferma da ${tempoTrascorso(da, adesso).replace(/ fa$/, '')}`
}

export function daGuardare<T extends Pick<Richiesta, 'stato' | 'arrivo' | 'created_at' | 'proposta_inviata_at'>>(lista: T[], adesso: Date = new Date()): T[] {
  return lista.filter(r => avvisoFerma(r, adesso) !== null)
}

// Richieste dal sito arrivate dopo l'ultima apertura della pagina
export function nuoveDalSito<T extends Pick<Richiesta, 'canale' | 'created_at'>>(lista: T[], ultimaVisita: string | null): T[] {
  return lista.filter(r => r.canale === 'web' && (!ultimaVisita || r.created_at > ultimaVisita))
}
