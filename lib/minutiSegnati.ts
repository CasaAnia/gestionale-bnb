// I minuti «segnati» sulla scheda di una camera (riferimento approvato da Ania
// il 02/10/2026, docs/design/pulizie-timer-riferimento.html): dopo «Ferma e
// riporta i minuti» o «Salva» dei minuti a mano la scheda dice «✓ 35 minuti
// segnati · correggi» e «Pulita» li salva con la pulizia, senza aprire il
// foglio. Insieme ai minuti si tiene la fotografia del timer che si vedeva in
// quel momento (la stessa regola del foglio «Pulita e recuperato»): il
// database rifiuta la conferma se nel frattempo il timer è cambiato.
// Si conservano sul telefono, perché l'app si ricarica tornando da WhatsApp.
import type { TimerVisto } from './pulizieOperazioni'
import type { TimerSql } from './tempoPulizie'

export type MinutiSegnati = { minuti: number; timer: TimerVisto | null }

export const fotoTimer = (t: TimerSql | null | undefined): TimerVisto | null => t ? { versione: Number(t.versione), trascorsi: Number(t.trascorsi) } : null
export const stessoTimer = (a: TimerVisto | null, b: TimerVisto | null) => (a?.versione ?? null) === (b?.versione ?? null) && (a?.trascorsi ?? 0) === (b?.trascorsi ?? 0)

/** I minuti segnati valgono finché il timer è quello di quando si sono segnati, e non corre. */
export function segnatiValidi(s: MinutiSegnati | null, t: TimerSql | null | undefined): MinutiSegnati | null {
  if (!s || t?.avviato_at) return null
  return stessoTimer(s.timer, fotoTimer(t)) ? s : null
}

/** «✓ 35 minuti segnati», «✓ 1 minuto segnato» */
export const testoSegnati = (n: number) => `✓ ${n} ${n === 1 ? 'minuto segnato' : 'minuti segnati'}`
/** Spazi comuni, sotto il nome: «oggi 12 minuti segnati» / «oggi niente segnato» */
export const testoOggiSpazi = (n: number) => n > 0 ? `oggi ${n} ${n === 1 ? 'minuto segnato' : 'minuti segnati'}` : 'oggi niente segnato'

/** Il campo «minuti a mano»: un numero intero da `min` a 1440, altrimenti null. */
export function minutiDalCampo(testo: string, min = 1): number | null {
  const n = Number(testo.trim())
  return testo.trim() !== '' && Number.isInteger(n) && n >= min && n <= 1440 ? n : null
}

const CHIAVE = (timer: string) => `pulizie-minuti-segnati:${timer}`
export function leggiSegnati(memoria: Pick<Storage, 'getItem'>, timer: string): MinutiSegnati | null {
  try {
    const v = JSON.parse(memoria.getItem(CHIAVE(timer)) ?? 'null') as MinutiSegnati | null
    if (!v || !Number.isInteger(v.minuti) || v.minuti < 1 || v.minuti > 1440) return null
    const t = v.timer
    if (t !== null && (typeof t !== 'object' || !Number.isFinite(t.versione) || !Number.isFinite(t.trascorsi))) return null
    return { minuti: v.minuti, timer: t ? { versione: t.versione, trascorsi: t.trascorsi } : null }
  } catch { return null }
}
export function scriviSegnati(memoria: Pick<Storage, 'setItem' | 'removeItem'>, timer: string, s: MinutiSegnati | null) {
  try { if (s) memoria.setItem(CHIAVE(timer), JSON.stringify(s)); else memoria.removeItem(CHIAVE(timer)) } catch { /* senza memoria restano solo a schermo */ }
}
