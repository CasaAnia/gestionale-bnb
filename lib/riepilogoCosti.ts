// Righe del riepilogo costi dell'immagine WhatsApp (conferma e proposta):
// logica spostata QUI da components/ConfermaWhatsApp.tsx, invariata.
// Dettaglio a prezzo pieno e riga sconto solo se esiste uno sconto SALVATO
// (mai dedotto dal listino). Se per un dato storico il dettaglio non torna col
// totale autorevole, riga unica: l'immagine deve dire lo stesso totale della scheda.
import { roomWithType, lettoInclusoNellaCamera } from './roomTypes.ts'
import { contoSoggiorno } from './conto.ts'

export type RigaCosto = { label: string; amount: number; sconto?: boolean }

export type SegmentoCosto = {
  check_in: string
  check_out: string
  price_per_night?: number | string | null
  extra_bed?: boolean | null
  extra_bed_total?: number | string | null
  extra_bed_dates?: string[] | null
  discount_type?: string | null
  discount_value?: number | string | null
  total_amount?: number | string | null
  num_guests?: number | string | null
  rooms?: { name?: string | null; extra_bed_price?: number | string | null } | null
}

export function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

export function righeCostiSegmenti(segmenti: SegmentoCosto[], isGruppo: boolean): { righe: RigaCosto[]; totale: number } {
  const righeCosti: RigaCosto[] = []
  let totale = 0
  for (const s of segmenti) {
    const conto = contoSoggiorno(s)
    const n = conto.notti
    const prezzo = Number(s.price_per_night)
    const nomeCamera = `Camera ${roomWithType(s.rooms?.name)}`
    totale += conto.totale
    const righeSegmento: RigaCosto[] = []
    let sommaDettaglio = 0
    // Lena con 3 ospiti: il terzo letto è parte della tripla, una riga sola tutto compreso
    if (lettoInclusoNellaCamera(s, n)) {
      const totCamera = prezzo * n + Number(s.extra_bed_total || 0)
      sommaDettaglio += totCamera
      righeSegmento.push({
        label: n > 1 ? `${nomeCamera} (${n} notti × ${fmtEuro(totCamera / n)})` : nomeCamera,
        amount: totCamera,
      })
    } else {
      sommaDettaglio += prezzo * n
      righeSegmento.push({
        label: n > 1 ? `${nomeCamera} (${n} notti × ${fmtEuro(prezzo)})` : nomeCamera,
        amount: prezzo * n,
      })
      const ebTot = Number(s.extra_bed_total || 0)
      if (s.extra_bed && ebTot > 0) {
        const ebNotti = s.extra_bed_dates && s.extra_bed_dates.length > 0 ? s.extra_bed_dates.length : n
        const ebPrezzo = Number(s.rooms?.extra_bed_price || 0)
        const showMolt = ebNotti > 1 && Math.abs(ebNotti * ebPrezzo - ebTot) < 0.005
        const base = isGruppo ? `Letto supplementare – ${s.rooms?.name || ''}`.trim() : 'Letto supplementare'
        righeSegmento.push({ label: showMolt ? `${base} (${ebNotti} notti × ${fmtEuro(ebPrezzo)})` : base, amount: ebTot })
        sommaDettaglio += ebTot
      }
    }
    if (Math.abs(sommaDettaglio - conto.prezzoPieno) > 0.005) {
      righeCosti.push({ label: `${nomeCamera} (${n} ${n === 1 ? 'notte' : 'notti'})`, amount: conto.totale })
    } else {
      righeCosti.push(...righeSegmento)
      if (conto.sconto > 0.005) {
        righeCosti.push({ label: 'Sconto a lei riservato', amount: -conto.sconto, sconto: true })
      }
    }
  }
  return { righe: righeCosti, totale }
}
