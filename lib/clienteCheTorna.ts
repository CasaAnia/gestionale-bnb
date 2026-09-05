// ============================================================================
// CLIENTE CHE TORNA (08/09/2026): non è una provenienza. Se esiste già un
// cliente con lo stesso telefono (o stesso nome e cognome) con almeno un
// soggiorno concluso, accanto al nome compare «Già stato da noi · N soggiorni»
// e nelle Statistiche conta come categoria a parte «Già stati da noi».
// Funzioni pure: telefoni confrontati come cifre (lib/whatsapp), nomi senza
// maiuscole, accenti e ordine delle parole («Rossi Anna» = «Anna Rossi»).
// ============================================================================
import { normalizzaTelefono } from './whatsapp.ts'

export type PersonaRicerca = { telefono?: string | null; nome?: string | null; cognome?: string | null; full_name?: string | null; guest_id?: string | null }
export type SoggiornoStorico = {
  id: string
  group_id?: string | null
  guest_id?: string | null
  check_in: string
  check_out: string
  status: string
  guest_name?: string | null
  guests?: { full_name?: string | null; phone?: string | null } | null
}

const piano = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ')
const cifre = (t: string | null | undefined) => normalizzaTelefono(t).numero

export function chiaveNome(p: PersonaRicerca): string {
  return piano(p.full_name || `${p.nome ?? ''} ${p.cognome ?? ''}`)
}

// Stessa persona? telefono uguale (cifre), oppure nome e cognome uguali
export function stessaPersona(a: PersonaRicerca, b: { guest_id?: string | null; guest_name?: string | null; guests?: { full_name?: string | null; phone?: string | null } | null }): boolean {
  if (a.guest_id && b.guest_id && a.guest_id === b.guest_id) return true
  const ta = cifre(a.telefono), tb = cifre(b.guests?.phone)
  if (ta && tb && ta === tb) return true
  const na = chiaveNome(a)
  if (!na) return false
  return na === piano(b.guest_name) || na === piano(b.guests?.full_name)
}

// Soggiorni CONCLUSI (partenza ≤ oggi, confermati/completati) della stessa
// persona, ogni soggiorno una volta (group_id o id); si esclude il soggiorno
// in esame (escludi = group_id o id della prenotazione aperta).
export function soggiorniPrecedenti(persona: PersonaRicerca, prenotazioni: SoggiornoStorico[], oggi: string, escludi?: string | null): number {
  const gruppi = new Set<string>()
  for (const b of prenotazioni) {
    if (b.status !== 'confermata' && b.status !== 'completata') continue
    if (b.check_out > oggi) continue
    const chiave = b.group_id || b.id
    if (escludi && (chiave === escludi || b.id === escludi)) continue
    if (stessaPersona(persona, b)) gruppi.add(chiave)
  }
  return gruppi.size
}

export function etichettaGiaStato(n: number): string | null {
  if (n <= 0) return null
  return `Già stato da noi · ${n} ${n === 1 ? 'soggiorno' : 'soggiorni'}`
}

// Per le Statistiche: la prenotazione è di un cliente che era GIÀ stato da
// noi prima di questo arrivo (un soggiorno concluso entro il suo check-in)?
export function eraGiaStato(b: SoggiornoStorico, storico: SoggiornoStorico[]): boolean {
  const persona: PersonaRicerca = { guest_id: b.guest_id, telefono: b.guests?.phone, full_name: b.guest_name || b.guests?.full_name }
  return soggiorniPrecedenti(persona, storico, b.check_in, b.group_id || b.id) > 0
}

// Scheda cliente (08/09/2026): soggiorni CONCLUSI (uno per gruppo) e ricavi
// totali (somma dei totali delle prenotazioni di quei soggiorni)
export function soggiorniConclusi(prenotazioni: (SoggiornoStorico & { total_amount?: number | string | null })[], oggi: string): { n: number; ricaviCent: number } {
  const gruppi = new Map<string, number>()
  for (const b of prenotazioni) {
    if (b.status !== 'confermata' && b.status !== 'completata') continue
    if (b.check_out > oggi) continue
    const k = b.group_id || b.id
    const v = Number(b.total_amount)
    gruppi.set(k, (gruppi.get(k) ?? 0) + (Number.isFinite(v) ? Math.round(v * 100) : 0))
  }
  return { n: gruppi.size, ricaviCent: [...gruppi.values()].reduce((s, x) => s + x, 0) }
}
