// ============================================================================
// LE SCHEDE DELLE CAMERE nella linguetta «Oggi» (riferimento approvato da Ania
// il 01/10/2026, pulizie-riferimento.html, telefoni 1 e 2): le parole e i dati
// di ogni scheda, dalle regole di sempre (pulizieAperte, prossimoArrivo,
// prioritaDi, proponiAssettoDaSoggiorno). Funzioni pure, provate in node.
// ============================================================================
import { type Pulizia, type ProssimoArrivo, type Priorita, type PrenotazionePulizie } from './pulizie.ts'
import { proponiAssettoDaSoggiorno, dotazioneDaAssetto } from './dotazionePulizie.ts'
import { lettiTesto, completiTesto } from './pulizieVista.ts'
import { oraBreve } from './schema0064.ts'
import { nomeOspite } from './guestName.ts'
import { cognome } from './giornataPulizie.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export const PAROLA_PRIORITA: Record<Priorita, string> = { urgente: 'Urgente', alta: 'Priorità alta', flessibile: 'Flessibile', nessuna_fretta: 'Nessuna fretta' }
const giornoMese = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESI_BREVI[m - 1]}` }

/** «URGENTE · CAMBIO OSPITE», «PRIORITÀ ALTA · 4 NOTTI», «NESSUNA FRETTA · ARRIVA IL 3 OTT» */
export function etichettaScheda(p: Pulizia, arrivo: ProssimoArrivo | null, priorita: Priorita): string {
  const tipo = p.tipo === 'soggiorno' ? '4 notti'
    : p.tipo === 'cambio_camera' ? 'cambio camera'
    : arrivo?.giorni === 0 ? 'cambio ospite'
    : arrivo ? `arriva il ${giornoMese(arrivo.booking.check_in)}`
    : 'fine soggiorno'
  return `${PAROLA_PRIORITA[priorita]} · ${tipo}`
}

/** Le colonne degli orari: ognuna c'è solo se il dato c'è. */
export type ColonnaOra = { chiave: 'parte' | 'bagagli' | 'arriva'; etichetta: string; ora: string | null }
export function orariScheda(p: Pulizia, arrivo: ProssimoArrivo | null, oggi: string, conOrari: boolean): ColonnaOra[] {
  if (p.tipo === 'soggiorno') return []
  const out: ColonnaOra[] = []
  // Chi parte oggi da Casa Ania: l'ora, o «da chiedere». Nel cambio camera
  // l'ospite non lascia Casa Ania: la colonna c'è solo se l'ora è scritta.
  if (conOrari && p.booking.check_out === oggi) {
    const ora = oraBreve(p.booking.check_out_time)
    if (p.tipo === 'fine_soggiorno' || ora) out.push({ chiave: 'parte', etichetta: `Parte ${cognome(p.booking)}`, ora })
  }
  const arriva = arrivo?.giorni === 0 ? arrivo.booking : null
  if (arriva && conOrari && oraBreve(arriva.bagagli_alle)) out.push({ chiave: 'bagagli', etichetta: `Bagagli ${cognome(arriva)}`, ora: oraBreve(arriva.bagagli_alle) })
  if (arriva && oraBreve(arriva.check_in_time)) out.push({ chiave: 'arriva', etichetta: `Arriva ${cognome(arriva)}`, ora: oraBreve(arriva.check_in_time) })
  return out
}

/** Per chi resta: «Lucia Ferri resta · 2 ospiti · cambio biancheria della 4ª notte» (Ania, 02/10/2026; prima «quando esce») */
export function rigaResta(b: PrenotazionePulizie): string {
  const n = Number(b.num_guests)
  return `${nomeOspite(b)} resta${Number.isInteger(n) && n > 0 ? ` · ${n} ${n === 1 ? 'ospite' : 'ospiti'}` : ''} · cambio biancheria della 4ª notte`
}

/** Le pillole di cosa preparare: «🛏 1 matrimoniale + 1 singolo», «6 federe», «3 completi asciugamani». */
export function pilloleLetti(camera: string, b: PrenotazionePulizie, giorno: string): string[] {
  const a = proponiAssettoDaSoggiorno(camera, b as Parameters<typeof proponiAssettoDaSoggiorno>[1], giorno)
  if (!a) return ['letti da confermare']
  return [`🛏 ${lettiTesto(a)}${a.matrimoniali && !a.singoli && a.ospiti === 1 ? ' uso singolo' : ''}`, `${dotazioneDaAssetto(a).federe} federe`, completiTesto(a.ospiti)]
}

/** «✓ Pulita 9:02 · 38 min» */
export const testoFatta = (ora: string | null, minuti: number | null | undefined) => `✓ Pulita${ora ? ` ${ora}` : ''}${minuti ? ` · ${minuti} min` : ''}`
