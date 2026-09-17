// ============================================================================
// «CON LEI» DALLA SCHEDA (17/09/2026): chi altro dorme qui si cambia anche
// dopo, con lo stesso pezzo dell'inserimento (components/nuova/ConLei) dentro
// un foglio. Le persone si leggono dalle colonne di bookings che ci sono già
// (extra_phone_1/2, extra_phone_1/2_name, chi_e, chi_e_2 della 0056) e si
// riscrivono TUTTE: chi viene tolta lascia la colonna vuota (null), cosa che
// `campiConLei` dell'inserimento non fa perché parte da colonne vuote.
// Si scrive su tutte le camere della prenotazione. Funzioni pure.
// ============================================================================
import { campiConLei, PERSONE_CON_LEI_MAX, type PersonaConLei } from './nuovaPrenotazione.ts'

export const TITOLO_CON_LEI = 'Con lei'
export const COMANDO_CON_LEI = 'Con lei'
export const SALVA_CON_LEI = 'Salva'
export const CON_LEI_SALVATO = 'Salvato chi dorme con lei.'
export const AVVISO_CHI_E_2_SENZA_0056 = 'Salvato; «chi è» della seconda persona però no: serve la proposta 0056 applicata su Supabase.'

export type RigaConLei = {
  id: string
  status?: string | null
  extra_phone_1?: string | null; extra_phone_1_name?: string | null; chi_e?: string | null
  extra_phone_2?: string | null; extra_phone_2_name?: string | null; chi_e_2?: string | null
}

/** Le persone salvate sulla riga, nella forma del pezzo dell'inserimento */
export function personeDaPrenotazione(b: RigaConLei | null | undefined): PersonaConLei[] {
  const coppie = [
    { id: 'uno', nome: b?.extra_phone_1_name, telefono: b?.extra_phone_1, chiE: b?.chi_e },
    { id: 'due', nome: b?.extra_phone_2_name, telefono: b?.extra_phone_2, chiE: b?.chi_e_2 },
  ]
  return coppie
    .map(c => ({ id: c.id, nome: (c.nome ?? '').trim(), telefono: (c.telefono ?? '').trim(), chiE: (c.chiE ?? '').trim() }))
    .filter(c => c.nome || c.telefono)
}

/** Tutte e sei le colonne: quelle delle persone presenti piene, le altre a null */
export function campiConLeiCompleti(persone: PersonaConLei[]): Record<string, unknown> {
  const vuoti: Record<string, unknown> = {
    extra_phone_1_name: null, extra_phone_1: null, chi_e: null,
    extra_phone_2_name: null, extra_phone_2: null, chi_e_2: null,
  }
  return { ...vuoti, ...campiConLei(persone.slice(0, PERSONE_CON_LEI_MAX)) }
}

/** Gli stessi campi senza chi_e_2: per chi non ha ancora la 0056 */
export function senzaChiE2(campi: Record<string, unknown>): Record<string, unknown> {
  const { chi_e_2: _via, ...resto } = campi
  void _via
  return resto
}

/** Vero se non è cambiato niente rispetto alla riga */
export function stessePersone(persone: PersonaConLei[], b: RigaConLei | null | undefined): boolean {
  const prima = campiConLeiCompleti(personeDaPrenotazione(b))
  const dopo = campiConLeiCompleti(persone)
  return Object.keys(prima).every(k => prima[k] === dopo[k])
}
