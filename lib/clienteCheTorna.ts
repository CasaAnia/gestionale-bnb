// ============================================================================
// CLIENTE CHE TORNA (08/09/2026): non è una provenienza. Se esiste già un
// cliente con lo stesso telefono (o stesso nome e cognome) con almeno un
// soggiorno concluso, accanto al nome compare «Già stato da noi · N soggiorni»
// e nelle Statistiche conta come categoria a parte «Già stati da noi».
// Funzioni pure: telefoni confrontati come cifre (lib/whatsapp), nomi senza
// maiuscole, accenti e ordine delle parole («Rossi Anna» = «Anna Rossi»).
// ============================================================================
import { normalizzaTelefono } from './whatsapp.ts'
import { nomeCompleto } from './guestName.ts'

export type PersonaRicerca = { telefono?: string | null; nome?: string | null; cognome?: string | null; full_name?: string | null; guest_id?: string | null }
export type SoggiornoStorico = {
  id: string
  group_id?: string | null
  prenotazione_id?: string | null
  guest_id?: string | null
  check_in: string
  check_out: string
  status: string
  guest_name?: string | null
  guests?: { full_name?: string | null; phone?: string | null } | null
  total_amount?: number | string | null
  num_guests?: number | string | null
  rooms?: { name?: string | null } | null
}

const piano = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean).sort().join(' ')
const cifre = (t: string | null | undefined) => normalizzaTelefono(t).numero

export function chiaveNome(p: PersonaRicerca): string {
  return piano(nomeCompleto(p))
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

// Un soggiorno solo, anche con più camere (10/09/2026): `prenotazione_id` tiene
// insieme le camere parallele, `group_id` il cambio camera. Non si uniscono mai
// righe per somiglianza di cliente o di date: conta solo quello che è scritto.
const identita = (b: SoggiornoStorico) => b.prenotazione_id || b.group_id || b.id

// I segmenti che contano: tutti quelli NON annullati. Un segmento ancora
// «in attesa» non si può ignorare: fa parte della prenotazione.
const attivi = (segmenti: SoggiornoStorico[]) =>
  segmenti.filter(s => s.status !== 'annullata')

const sistemato = (s: SoggiornoStorico) => s.status === 'confermata' || s.status === 'completata'

// Concluso quando OGNI segmento non annullato è confermato/completato ED è
// finito. Basta una camera parallela più lunga non ancora partita, o una
// camera rimasta «in attesa», perché il soggiorno non conti.
// Tutta annullata: non conta.
function conclusa(segmenti: SoggiornoStorico[], oggi: string): boolean {
  const vivi = attivi(segmenti)
  return vivi.length > 0 && vivi.every(s => sistemato(s) && s.check_out <= oggi)
}

// La prenotazione aperta si esclude INTERA, comunque la si nomini: per la sua
// identità, per il gruppo o per l'id di uno qualsiasi dei suoi segmenti.
function esclusa(chiave: string, segmenti: SoggiornoStorico[], escludi?: string | null): boolean {
  if (!escludi) return false
  if (chiave === escludi) return true
  return segmenti.some(s => s.id === escludi || s.group_id === escludi || s.prenotazione_id === escludi)
}

function raggruppa(prenotazioni: SoggiornoStorico[]): Map<string, SoggiornoStorico[]> {
  const gruppi = new Map<string, SoggiornoStorico[]>()
  for (const b of prenotazioni) {
    const k = identita(b)
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  return gruppi
}

// Soggiorni CONCLUSI della stessa persona, ogni soggiorno una volta; si
// esclude il soggiorno in esame. Il riconoscimento della persona è quello di
// sempre, ma il raggruppamento viene PRIMA di tutto: una sola riga che
// corrisponde sceglie la prenotazione, e poi si guardano TUTTI i suoi
// segmenti. Così una camera intestata in modo diverso non sparisce dal conto.
export function soggiorniPrecedenti(persona: PersonaRicerca, prenotazioni: SoggiornoStorico[], oggi: string, escludi?: string | null): number {
  let n = 0
  for (const [chiave, segmenti] of raggruppa(prenotazioni)) {
    if (!segmenti.some(b => stessaPersona(persona, b))) continue
    if (esclusa(chiave, segmenti, escludi)) continue
    if (conclusa(segmenti, oggi)) n += 1
  }
  return n
}

export function etichettaGiaStato(n: number): string | null {
  if (n <= 0) return null
  return `Già stato da noi · ${n} ${n === 1 ? 'soggiorno' : 'soggiorni'}`
}

// Per le Statistiche: la prenotazione è di un cliente che era GIÀ stato da
// noi prima di questo arrivo (un soggiorno concluso entro il suo check-in)?
export function eraGiaStato(b: SoggiornoStorico, storico: SoggiornoStorico[]): boolean {
  const persona: PersonaRicerca = { guest_id: b.guest_id, telefono: b.guests?.phone, full_name: b.guest_name || b.guests?.full_name }
  return soggiorniPrecedenti(persona, storico, b.check_in, identita(b)) > 0
}

// Scheda cliente (08/09/2026): soggiorni CONCLUSI (uno per prenotazione) e
// ricavi totali (somma dei segmenti non annullati di quei soggiorni)
export function soggiorniConclusi(prenotazioni: (SoggiornoStorico & { total_amount?: number | string | null })[], oggi: string): { n: number; ricaviCent: number } {
  let n = 0
  let ricaviCent = 0
  for (const segmenti of raggruppa(prenotazioni).values()) {
    if (!conclusa(segmenti, oggi)) continue
    n += 1
    for (const s of attivi(segmenti)) {
      const v = Number((s as { total_amount?: number | string | null }).total_amount)
      ricaviCent += Number.isFinite(v) ? Math.round(v * 100) : 0
    }
  }
  return { n, ricaviCent }
}

// ── L'ultimo soggiorno e quanto ha speso in tutto (11/09/2026) ───────────────
// Serve alla testa del cliente («1.360 €  ›») e alla voce «Cliente che torna»
// di «Da controllare» («l'ultima: Ambra, 26 apr → 4 mag 2026 · 2 ospiti»).
// Stesse regole di soggiorniPrecedenti e soggiorniConclusi: un soggiorno per
// prenotazione, solo i conclusi, soldi dai segmenti non annullati.
export type UltimoSoggiorno = {
  prenotazioneId: string
  check_in: string
  check_out: string
  camere: string[]     // nomi in ordine di arrivo, senza doppioni di fila
  ospiti: number
}
export type SoggiorniDellaPersona = { volte: number; ricaviCent: number; ultimo: UltimoSoggiorno | null }

const importo = (n: number | string | null | undefined) => { const v = Number(n); return Number.isFinite(v) ? Math.round(v * 100) : 0 }

export function soggiorniDellaPersona(
  persona: PersonaRicerca, prenotazioni: SoggiornoStorico[], oggi: string, escludi?: string | null,
): SoggiorniDellaPersona {
  let volte = 0, ricaviCent = 0
  let ultimo: UltimoSoggiorno | null = null
  for (const [chiave, segmenti] of raggruppa(prenotazioni)) {
    if (!segmenti.some(b => stessaPersona(persona, b))) continue
    if (esclusa(chiave, segmenti, escludi)) continue
    if (!conclusa(segmenti, oggi)) continue
    volte += 1
    const vivi = [...attivi(segmenti)].sort((a, b) => a.check_in.localeCompare(b.check_in) || a.check_out.localeCompare(b.check_out) || a.id.localeCompare(b.id))
    ricaviCent += vivi.reduce((t, s) => t + importo(s.total_amount), 0)
    const check_in = vivi.reduce((m, s) => (s.check_in < m ? s.check_in : m), vivi[0].check_in)
    if (ultimo && ultimo.check_in >= check_in) continue
    const camere: string[] = []
    for (const s of vivi) { const n = (s.rooms?.name || '').trim(); if (n && camere[camere.length - 1] !== n) camere.push(n) }
    ultimo = {
      prenotazioneId: vivi[0].id,
      check_in,
      check_out: vivi.reduce((m, s) => (s.check_out > m ? s.check_out : m), vivi[0].check_out),
      camere,
      ospiti: vivi.reduce((m, s) => Math.max(m, Number(s.num_guests) || 1), 1),
    }
  }
  return { volte, ricaviCent, ultimo }
}
