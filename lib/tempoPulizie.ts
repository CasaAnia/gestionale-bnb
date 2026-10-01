export type Cronometro = { trascorsi: number; avviato: number | null }
export const secondiTrascorsi = (t: Cronometro, ora: number) => t.trascorsi + (t.avviato === null ? 0 : Math.max(0, Math.floor((ora - t.avviato) / 1000)))
export const fermaCronometro = (t: Cronometro, ora: number): Cronometro => ({ trascorsi: secondiTrascorsi(t, ora), avviato: null })
export const minutiCronometro = (t: Cronometro, ora: number) => Math.ceil(secondiTrascorsi(t, ora) / 60)

// ── Timer centrali (proposta 0059) ──────────────────────────────────────────
// La verità è la riga del server: secondi già accumulati + istante di avvio
// del SERVER. Il setInterval serve solo a ridisegnare le cifre; lo scarto fra
// orologio del telefono e del server si corregge con l'«adesso» della risposta.
export type TimerSql = { chiave: string; trascorsi: number; avviato_at: string | null; versione: number; cleaning_id?: string | null }
export type AttivitaFuori = 'area_comune' | 'corridoio' | 'piegatura' | 'altro'
// Spazi comuni, nomi scelti da Ania il 01/10/2026, in quest'ordine:
// «Corridoio e angolo caffè», «Piegatura asciugamani», «Altro» (quest'ultima
// solo con la proposta 0064, che la fa accettare dal database).
// `area_comune` (la vecchia «Area comune») NON si propone più per i tempi
// nuovi: i minuti già salvati restano com'erano nel database e nei totali,
// nel Registro e nelle Statistiche si leggono sotto «Corridoio e angolo
// caffè», sommati una volta sola (voceSpazi / minutiPerVoce).
export type VoceSpazi = 'corridoio' | 'piegatura' | 'altro'
export const VOCI_SPAZI: [VoceSpazi, string][] = [['corridoio', 'Corridoio e angolo caffè'], ['piegatura', 'Piegatura asciugamani'], ['altro', 'Altro']]
export const ATTIVITA_FUORI: [AttivitaFuori, string][] = [['corridoio', 'Corridoio e angolo caffè'], ['piegatura', 'Piegatura asciugamani'], ['altro', 'Altro']]
export const voceSpazi = (a: string): VoceSpazi | null => (a === 'area_comune' || a === 'corridoio' ? 'corridoio' : a === 'piegatura' ? 'piegatura' : a === 'altro' ? 'altro' : null)
export const nomeAttivita = (a: string) => { const v = voceSpazi(a); return v ? VOCI_SPAZI.find(([k]) => k === v)![1] : a }
/** Le voci da proporre: «Altro» solo se il database lo accetta (0064). */
export const vociSpaziAttive = (conAltro: boolean) => VOCI_SPAZI.filter(([k]) => conAltro || k !== 'altro')
/** Minuti per voce, area_comune dentro il corridoio; l'ultimo salvataggio per voce. */
export function minutiPerVoce<T extends { attivita: string; minuti: number; aggiornato_at?: string | null }>(righe: T[]): Record<VoceSpazi, { minuti: number; righe: T[]; ultimo: string | null }> {
  const out = { corridoio: { minuti: 0, righe: [] as T[], ultimo: null as string | null }, piegatura: { minuti: 0, righe: [] as T[], ultimo: null as string | null }, altro: { minuti: 0, righe: [] as T[], ultimo: null as string | null } }
  for (const r of righe) {
    const v = voceSpazi(r.attivita)
    if (!v) continue
    out[v].minuti += Number(r.minuti) || 0
    out[v].righe.push(r)
    if (r.aggiornato_at && (!out[v].ultimo || r.aggiornato_at > out[v].ultimo!)) out[v].ultimo = r.aggiornato_at
  }
  return out
}

export const chiaveTimerPulizia = (bookingId: string, tipo: string, dataPrevista: string) => `pulizia:${bookingId}:${tipo}:${dataPrevista}`
export const chiaveTimerFuori = (data: string, attivita: AttivitaFuori) => `fuori:${data}:${attivita}`

export function cronometroDaSql(t: TimerSql | null | undefined): Cronometro {
  if (!t) return { trascorsi: 0, avviato: null }
  const avviato = t.avviato_at ? Date.parse(t.avviato_at) : null
  return { trascorsi: Math.max(0, Math.floor(Number(t.trascorsi) || 0)), avviato: Number.isFinite(avviato) ? avviato : null }
}
// Secondi del timer all'istante del telefono `ora`, corretto dello scarto col server.
export const secondiTimer = (t: TimerSql | null | undefined, ora: number, scarto: number) => secondiTrascorsi(cronometroDaSql(t), ora + scarto)
// Arrotondamento per eccesso solo sul totale finale: le pause non si arrotondano.
export const minutiTimer = (secondi: number) => Math.ceil(Math.max(0, secondi) / 60)
export const testoCronometro = (secondi: number) => `${Math.floor(secondi / 60)}:${String(secondi % 60).padStart(2, '0')}`

// Fuori camera: il timer fermato si AGGIUNGE al totale già salvato della
// giornata; il totale proposto dice da dove viene ogni parte.
export function totaleProposto(salvati: number | null, secondiTimer: number, scritti: string): { minuti: number; testo: string } {
  const timer = minutiTimer(secondiTimer), base = salvati ?? 0
  const scrittoNonSalvato = scritti.trim() !== '' && Number(scritti) !== base ? ` (avevi scritto ${scritti}, non salvati)` : ''
  return { minuti: base + timer, testo: `${base} min salvati + ${timer} dal timer = ${base + timer} min${scrittoNonSalvato}. Controlla e salva.` }
}

// Quale attività ha il timer in corso, per mostrarla e poterla raggiungere.
export function descriviChiave(chiave: string, nomeCamera: (bookingId: string) => string | null): { tipo: 'pulizia' | 'fuori'; nome: string; data: string } {
  const p = chiave.split(':')
  if (p[0] === 'fuori') return { tipo: 'fuori', nome: nomeAttivita(p[2]), data: p[1] }
  return { tipo: 'pulizia', nome: nomeCamera(p[1]) ?? 'una camera', data: p[3] }
}
