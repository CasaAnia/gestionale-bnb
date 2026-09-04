// Richieste di prenotazione (pezzo 1 di 8): tipi, ordinamento e testi.
// Funzioni pure, senza Supabase: si provano con `node --test`.
// La parte che parla col database sta in lib/richiesteDati.ts.
import { ORE_RISPOSTA_PROPOSTA } from './condizioniPrenotazione.ts'

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
  persone_per_notte?: number[] | null   // pezzo 9 (migrazione 0031): un intero per notte, null = tutte uguali a persone
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

// «N da guardare»: le ferme più le proposte scadute (3 ore dall'invio).
export function daGuardare<T extends Pick<Richiesta, 'stato' | 'arrivo' | 'created_at' | 'proposta_inviata_at'>>(lista: T[], adesso: Date = new Date()): T[] {
  return lista.filter(r => avvisoFerma(r, adesso) !== null || scadenzaProposta(r, adesso)?.scaduta === true)
}

// ── Scadenza della proposta (timer delle 3 ore) ────────────────────────────
// La proposta dice «entro 3 ore da questo messaggio» (lib/richiesteTesti):
// qui si conta dallo stesso numero, a partire da proposta_inviata_at, che
// viene scritto SOLO da «Sì, inviata» (mai dall'arrivo della richiesta).
// Alla scadenza la richiesta resta com'è: nessuna chiusura, nessun avviso;
// cambiano solo testo e colore (verde finché manca tempo, ottone dopo).
export const ORE_SCADENZA_PROPOSTA = ORE_RISPOSTA_PROPOSTA

export type ScadenzaProposta = { scaduta: boolean; testo: string }

// "2 h 15 min" · "45 min" · "2 h"
function durataMinuti(minuti: number): string {
  const h = Math.floor(minuti / 60), m = minuti % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// Giorni di calendario fra due date (a mezzanotte, nel fuso del telefono)
function giorniDiCalendario(da: Date, a: Date): number {
  const inizio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((inizio(a) - inizio(da)) / 86400000)
}

// "Proposta inviata · scade tra 2 h 15 min" · "… scade tra 45 min" (verde)
// "Proposta inviata · scaduta 20 min fa" · "… scaduta 3 h fa" · "… scaduta ieri"
// · "… scaduta 2 giorni fa" (ottone). null per le richieste in attesa o
// senza l'ora dell'invio: lì non compare nulla.
export function scadenzaProposta(r: Pick<Richiesta, 'stato' | 'proposta_inviata_at'>, adesso: Date = new Date()): ScadenzaProposta | null {
  if (r.stato !== 'proposta_inviata' || !r.proposta_inviata_at) return null
  const inviata = new Date(r.proposta_inviata_at).getTime()
  if (Number.isNaN(inviata)) return null
  const scadenza = inviata + ORE_SCADENZA_PROPOSTA * 3600000
  const resto = scadenza - adesso.getTime()
  // Per difetto verso l'alto: con 2 h 14 min 30 s si legge ancora «2 h 15 min»
  if (resto > 0) return { scaduta: false, testo: `Proposta inviata · scade tra ${durataMinuti(Math.ceil(resto / 60000))}` }
  const minuti = Math.floor(-resto / 60000)
  const quandoScaduta = new Date(scadenza)
  let quando: string
  if (minuti < 1) quando = 'adesso'
  else if (minuti < 60) quando = `${minuti} min fa`
  else if (stessoGiorno(quandoScaduta, adesso)) quando = `${Math.floor(minuti / 60)} h fa`
  else {
    const giorni = giorniDiCalendario(quandoScaduta, adesso)
    quando = giorni === 1 ? 'ieri' : `${giorni} giorni fa`
  }
  return { scaduta: true, testo: `Proposta inviata · scaduta ${quando}` }
}

// Richieste dal sito arrivate dopo l'ultima apertura della pagina
export function nuoveDalSito<T extends Pick<Richiesta, 'canale' | 'created_at'>>(lista: T[], ultimaVisita: string | null): T[] {
  return lista.filter(r => r.canale === 'web' && (!ultimaVisita || r.created_at > ultimaVisita))
}

// ── Persone notte per notte (pezzo 9) ──────────────────────────────────────
// "17: 2 · 18–20: 1" · attraverso i mesi "30 set: 2 · 1–2 ott: 1"
export function riassuntoPersone(arrivo: string, persone: number[]): string {
  return riassuntoPerNotte(arrivo, persone)
}
// Stessa compressione per QUALSIASI valore per notte (pezzo 10: "17: Amelia · 18–20: Ambra")
export function riassuntoPerNotte(arrivo: string, persone: (number | string)[]): string {
  if (persone.length === 0) return ''
  const giorni: { g: number; m: number }[] = []
  let t = Date.parse(arrivo + 'T00:00:00Z')
  for (let i = 0; i < persone.length; i++, t += 86400000) { const d = new Date(t); giorni.push({ g: d.getUTCDate(), m: d.getUTCMonth() }) }
  const piuMesi = new Set(giorni.map(x => x.m)).size > 1
  const etich = (i: number) => `${giorni[i].g}${piuMesi ? ` ${MESI[giorni[i].m]}` : ''}`
  const gruppi: string[] = []
  let da = 0
  for (let i = 1; i <= persone.length; i++) {
    if (i === persone.length || persone[i] !== persone[da]) {
      const a = i - 1
      const stessoMese = giorni[da].m === giorni[a].m
      const intervallo = da === a ? etich(da) : (stessoMese && piuMesi ? `${giorni[da].g}–${giorni[a].g} ${MESI[giorni[a].m]}` : `${etich(da).split(' ')[0]}${piuMesi && !stessoMese ? ` ${MESI[giorni[da].m]}` : ''}–${etich(a)}`)
      gruppi.push(`${intervallo}: ${persone[da]}`)
      da = i
    }
  }
  return gruppi.join(' · ')
}

// ── Modifica di una richiesta (pezzo 9) ────────────────────────────────────
// Si modificano solo le richieste aperte. Se la richiesta aveva una proposta
// inviata e cambiano date, persone o camera, la proposta non vale più: lo
// stato torna in_attesa e la proposta finisce nello storico. Telefono, note e
// canale non toccano lo stato.
export type ValoriModifica = {
  nome: string; cognome: string; arrivo: string; partenza: string; persone: number
  persone_per_notte: number[] | null; camera_id: string | null; telefono: string | null; note: string | null; canale: CanaleRichiesta
}
export type PropostaPrecedente = { testo: string | null; soluzione: unknown; inviata_at: string | null; superata_at: string }
export const AVVISO_PROPOSTA_SUPERATA = 'La proposta inviata si riferiva ai dati precedenti: rigenera e reinvia la proposta'
export const modificabile = (r: { stato: StatoRichiesta }) => r.stato === 'in_attesa' || r.stato === 'proposta_inviata'

export function pianoModifica(
  originale: Pick<Richiesta, 'stato' | 'arrivo' | 'partenza' | 'persone' | 'camera_id'> & { persone_per_notte?: number[] | null; proposta_testo?: string | null; proposta_soluzione?: unknown; proposta_inviata_at?: string | null; proposte_precedenti?: PropostaPrecedente[] | null },
  nuovi: ValoriModifica,
  adesso: Date = new Date(),
): { campi: Record<string, unknown>; propostaSuperata: boolean; avviso: string | null; errore: string | null } {
  if (!modificabile(originale)) return { campi: {}, propostaSuperata: false, avviso: null, errore: 'Una richiesta confermata o rifiutata non si modifica.' }
  const stesso = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
  const sostanziale = !stesso(originale.arrivo, nuovi.arrivo) || !stesso(originale.partenza, nuovi.partenza)
    || Number(originale.persone) !== Number(nuovi.persone) || !stesso(originale.persone_per_notte ?? null, nuovi.persone_per_notte)
    || !stesso(originale.camera_id ?? null, nuovi.camera_id)
  const campi: Record<string, unknown> = { ...nuovi }
  const propostaSuperata = originale.stato === 'proposta_inviata' && sostanziale
  if (propostaSuperata) {
    campi.stato = 'in_attesa'
    campi.proposta_inviata_at = null
    campi.proposta_testo = null
    campi.proposta_soluzione = null
    campi.proposta_alternative = null
    campi.proposte_precedenti = [
      ...(originale.proposte_precedenti ?? []),
      { testo: originale.proposta_testo ?? null, soluzione: originale.proposta_soluzione ?? null, inviata_at: originale.proposta_inviata_at ?? null, superata_at: adesso.toISOString() },
    ]
  }
  return { campi, propostaSuperata, avviso: propostaSuperata ? AVVISO_PROPOSTA_SUPERATA : null, errore: null }
}
