import { riepilogoPeriodi } from './periodiPrenotazione.ts'
// Causale unica del bonifico, condivisa da locandina e messaggi WhatsApp:
// "camera · date · cognome" (es. "Allegra · 15–16 set · Schiavone").
// Con cambio camera i nomi si uniscono con "+". Una formula sola: la
// locandina e i messaggi non possono più mostrare due causali diverse.

type SegmentoCausale = { check_in: string; check_out: string; rooms?: { name?: string | null } | null }

function meseBreve(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { month: 'short' })
}

// I segmenti devono arrivare già ordinati per check_in (come nei chiamanti)
export function causaleBonifico(segmenti: SegmentoCausale[], nomeOspite: string): string {
  const cin = segmenti[0].check_in
  const cout = segmenti.reduce((fine, s) => s.check_out > fine ? s.check_out : fine, segmenti[0].check_out)
  const cognome = nomeOspite.trim().split(' ').slice(-1)[0]
  const camere = [...new Set(segmenti.map(s => s.rooms?.name?.split(' ').slice(-1)[0]).filter(Boolean))].join(' + ')
  const dateContinue = cin.slice(0, 7) === cout.slice(0, 7)
    ? `${Number(cin.slice(8))}–${Number(cout.slice(8))} ${meseBreve(cout)}`
    : `${Number(cin.slice(8))} ${meseBreve(cin)} – ${Number(cout.slice(8))} ${meseBreve(cout)}`
  const periodi = riepilogoPeriodi(segmenti)
  const date = periodi.separati ? periodi.periodi.map(p => p.arrivo.slice(0, 7) === p.partenza.slice(0, 7)
    ? `${Number(p.arrivo.slice(8))}–${Number(p.partenza.slice(8))} ${meseBreve(p.partenza)}`
    : `${Number(p.arrivo.slice(8))} ${meseBreve(p.arrivo)} – ${Number(p.partenza.slice(8))} ${meseBreve(p.partenza)}`).join(' / ') : dateContinue
  return `${camere} · ${date} · ${cognome}`
}
