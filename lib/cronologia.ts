// ============================================================================
// CRONOLOGIA DELLE MODIFICHE di una prenotazione (07/09/2026, pezzo 2). Le
// righe le scrive il database (trigger della proposta 0042 in booking_events);
// qui si trasformano in italiano semplice per la sezione «Cronologia» in
// fondo alla scheda: «5 set 14:20 · camera Ambra → Lena». Solo lettura,
// nessun ripristino. Funzioni pure, nessun Supabase.
// ============================================================================
import { formatIntervallo } from './richieste.ts'

export type TipoEvento = 'camera' | 'date' | 'totale' | 'sconto' | 'pagamento_aggiunto' | 'pagamento_eliminato' | 'annullamento' | 'cliente'

export type EventoCronologia = {
  id: string
  n?: number | null              // progressivo del database: ordine stabile a parità di istante
  booking_id: string
  soggiorno?: string | null
  created_at: string
  tipo: TipoEvento | string
  prima?: Record<string, unknown> | null
  dopo?: Record<string, unknown> | null
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const due = (n: number) => String(n).padStart(2, '0')

// «5 set 14:20», con l'anno se diverso da quello di `adesso` («5 set 2025 14:20»)
export function quandoEvento(iso: string, adesso: Date = new Date()): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const anno = d.getFullYear() === adesso.getFullYear() ? '' : ` ${d.getFullYear()}`
  return `${d.getDate()} ${MESI[d.getMonth()]}${anno} ${due(d.getHours())}:${due(d.getMinutes())}`
}

const testo = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const euro = (v: unknown): string => {
  const n = Number(v)
  return Number.isFinite(n) ? `€${n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}` : '—'
}
const date = (v: Record<string, unknown> | null | undefined): string => {
  const a = testo(v?.check_in), p = testo(v?.check_out)
  return a && p ? formatIntervallo(a, p) : '—'
}
const sconto = (v: Record<string, unknown> | null | undefined): string => {
  const tipo = testo(v?.tipo), valore = v?.valore
  if (!tipo || valore === null || valore === undefined) return 'nessuno'
  const n = Number(valore)
  if (tipo === 'percentage') return `${Number.isFinite(n) ? n : valore} %`
  if (tipo === 'target_total') return `totale a ${euro(valore)}`
  return `${tipo} ${valore}`
}
const pagamento = (v: Record<string, unknown> | null | undefined): string => {
  const importo = euro(v?.importo)
  const metodo = testo(v?.metodo)
  const giorno = testo(v?.data)
  const quando = giorno ? ` (${formatGiorno(giorno)})` : ''
  return `${importo}${metodo ? ` ${metodo}` : ''}${quando}`
}
function formatGiorno(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  return Number.isFinite(g) && Number.isFinite(m) && Number.isFinite(a) ? `${g} ${MESI[m - 1]}` : iso
}

// Cosa è cambiato, in parole: «camera Ambra → Lena», «date 5–7 set → 5–8 set»,
// «totale €160 → €200», «sconto nessuno → 10 %», «pagamento aggiunto €100
// contanti (5 set)», «pagamento eliminato €100 …», «annullata: motivo»,
// «cliente Anna Rossi → Marco Bianchi». Un tipo sconosciuto resta leggibile.
export function descriviEvento(e: Pick<EventoCronologia, 'tipo' | 'prima' | 'dopo'>): string {
  const p = e.prima ?? null, d = e.dopo ?? null
  switch (e.tipo) {
    case 'camera': return `camera ${testo(p?.camera) ?? '—'} → ${testo(d?.camera) ?? '—'}`
    case 'date': return `date ${date(p)} → ${date(d)}`
    case 'totale': return `totale ${euro(p?.totale)} → ${euro(d?.totale)}`
    case 'sconto': return `sconto ${sconto(p)} → ${sconto(d)}`
    case 'pagamento_aggiunto': return `pagamento aggiunto ${pagamento(d)}`
    case 'pagamento_eliminato': return `pagamento eliminato ${pagamento(p)}`
    case 'annullamento': { const m = testo(d?.motivo); return `annullata${m ? `: ${m}` : ''}` }
    case 'cliente': return `cliente ${testo(p?.cliente) ?? '—'} → ${testo(d?.cliente) ?? '—'}`
    default: return `${e.tipo}`
  }
}

export type RigaCronologia = { id: string; quando: string; cosa: string; segmento: string | null }

// Righe pronte per lo schermo, dalla più recente; con più segmenti (cambio
// camera) la riga dice di quale camera parla, se il nome è noto.
export function righeCronologia(eventi: EventoCronologia[], adesso: Date = new Date(), nomeSegmento: (bookingId: string) => string | null = () => null): RigaCronologia[] {
  return [...eventi]
    .sort((a, b) => b.created_at.localeCompare(a.created_at) || Number(b.n ?? 0) - Number(a.n ?? 0))
    .map(e => ({ id: e.id, quando: quandoEvento(e.created_at, adesso), cosa: descriviEvento(e), segmento: nomeSegmento(e.booking_id) }))
}

export const AVVISO_0042 = 'La cronologia si accende con la proposta 0042 (supabase/proposte): da allora ogni modifica importante resta registrata qui'
