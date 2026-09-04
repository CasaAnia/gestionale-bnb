// Righe del riepilogo costi dell'immagine WhatsApp (conferma e proposta):
// logica spostata QUI da components/ConfermaWhatsApp.tsx, invariata.
// Dettaglio a prezzo pieno e riga sconto solo se esiste uno sconto SALVATO
// (mai dedotto dal listino). Se per un dato storico il dettaglio non torna col
// totale autorevole, riga unica: l'immagine deve dire lo stesso totale della scheda.
import { roomWithType, lettoInclusoNellaCamera } from './roomTypes.ts'
import { contoSoggiorno } from './conto.ts'
import { giorniSoggiorno, nottiConLetto, personePerNottePrenotazione, prezzoNotti, testoDettaglioNotti, type CameraTariffa, type NotteSoggiorno } from './prezzoNotti.ts'

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
  // Proposte (pezzo 9/10): persone di ogni notte e, se scritti a mano, i
  // prezzi effettivi per notte. Le prenotazioni salvate non li hanno: le
  // persone si ricavano da num_guests + extra_bed_dates (lib/prezzoNotti)
  persone_notti?: number[] | null
  prezzi_notti?: number[] | null
  rooms?: (CameraTariffa & { extra_bed_price?: number | string | null }) | null
}

export function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// Dettaglio notte per notte di un segmento, SOLO quando la tariffa della
// camera cambia fra le notti (Lena in 2 poi in 3): altrimenti null e il
// segmento si mostra come sempre (prezzo × notti, letto a parte se addebitato).
// Con prezzi scritti a mano (proposte) contano quelli: dettaglio se non uguali.
export function dettaglioNottiSegmento(s: SegmentoCosto): NotteSoggiorno[] | null {
  const giorni = giorniSoggiorno(s.check_in, s.check_out)
  if (giorni.length === 0) return null
  const persone = s.persone_notti && s.persone_notti.length === giorni.length
    ? s.persone_notti.map(Number)
    : personePerNottePrenotazione(s.rooms, s)
  if (s.prezzi_notti && s.prezzi_notti.length === giorni.length) {
    const notti = giorni.map((giorno, i) => ({ giorno, persone: persone[i], tariffa: Number(s.prezzi_notti![i]), letto: 0, prezzo: Number(s.prezzi_notti![i]) }))
    return notti.every(x => x.prezzo === notti[0].prezzo) ? null : notti
  }
  const pn = prezzoNotti(s.rooms, giorni, persone, nottiConLetto(s), s.price_per_night)
  return pn.tariffaUniforme ? null : pn.notti
}

// `fmt` (pezzo 11): come scrivere gli importi nelle etichette («2 notti × 70,00 €»);
// la proposta passa il formato del testo («70 €»), la conferma tiene fmtEuro
export function righeCostiSegmenti(segmenti: SegmentoCosto[], isGruppo: boolean, fmt: (n: number) => string = fmtEuro): { righe: RigaCosto[]; totale: number } {
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
    const dettaglio = dettaglioNottiSegmento(s)
    // Tariffa diversa fra le notti (persone che cambiano): una riga sola col
    // dettaglio per notte, mai un «prezzo a notte» unico che sarebbe falso
    if (dettaglio) {
      const totCamera = Math.round(dettaglio.reduce((t, x) => t + x.prezzo, 0) * 100) / 100
      sommaDettaglio += totCamera
      righeSegmento.push({ label: `${nomeCamera} (${testoDettaglioNotti(dettaglio, fmt)})`, amount: totCamera })
    // Lena con 3 ospiti: il terzo letto è parte della tripla, una riga sola tutto compreso
    } else if (lettoInclusoNellaCamera(s, n)) {
      const totCamera = prezzo * n + Number(s.extra_bed_total || 0)
      sommaDettaglio += totCamera
      righeSegmento.push({
        label: n > 1 ? `${nomeCamera} (${n} notti × ${fmt(totCamera / n)})` : nomeCamera,
        amount: totCamera,
      })
    } else {
      sommaDettaglio += prezzo * n
      righeSegmento.push({
        label: n > 1 ? `${nomeCamera} (${n} notti × ${fmt(prezzo)})` : nomeCamera,
        amount: prezzo * n,
      })
      const ebTot = Number(s.extra_bed_total || 0)
      if (s.extra_bed && ebTot > 0) {
        const ebNotti = s.extra_bed_dates && s.extra_bed_dates.length > 0 ? s.extra_bed_dates.length : n
        const ebPrezzo = Number(s.rooms?.extra_bed_price || 0)
        const showMolt = ebNotti > 1 && Math.abs(ebNotti * ebPrezzo - ebTot) < 0.005
        const base = isGruppo ? `Letto supplementare – ${s.rooms?.name || ''}`.trim() : 'Letto supplementare'
        righeSegmento.push({ label: showMolt ? `${base} (${ebNotti} notti × ${fmt(ebPrezzo)})` : base, amount: ebTot })
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
