// Riassunto delle statistiche Pulizie (04/09/2026): il dato principale è il
// TOTALE DEGLI INTERVENTI in un periodo = pulizie di fine soggiorno (segnate
// a mano o automatiche dei cambi ospite) + cambi biancheria delle 4 notti.
// Ogni cambio biancheria vale un intervento. La media al giorno si calcola su
// questo totale, sui giorni del periodo già trascorsi. Stessa regola per il
// passato ricostruito e per i dati veri. Funzioni pure: `npm test`.
import { diffDays } from './pulizie.ts'

export type EventoStatistica = { roomId: string; date: string }

export type RiassuntoInterventi = {
  interventi: number      // pulizie + cambi
  pulizie: number
  cambi: number
  giorni: number          // giorni del periodo già trascorsi (almeno 1)
  alGiorno: number | null // interventi / giorni, 1 decimale; null senza interventi
  ogniGiorni: number | null // giorni / interventi, 1 decimale; null senza interventi
}

export const nelPeriodo = (e: EventoStatistica, inizio: string, fine: string) => e.date >= inizio && e.date <= fine

const unDecimale = (n: number) => Math.round(n * 10) / 10

export function riassuntoInterventi(pulizie: EventoStatistica[], cambi: EventoStatistica[], inizio: string, fine: string, oggi: string): RiassuntoInterventi {
  const p = pulizie.filter(e => nelPeriodo(e, inizio, fine)).length
  const c = cambi.filter(e => nelPeriodo(e, inizio, fine)).length
  const interventi = p + c
  const ultimo = fine < oggi ? fine : oggi
  const giorni = Math.max(1, diffDays(ultimo, inizio) + 1)
  return {
    interventi, pulizie: p, cambi: c, giorni,
    alGiorno: interventi > 0 ? unDecimale(interventi / giorni) : null,
    ogniGiorni: interventi > 0 ? unDecimale(giorni / interventi) : null,
  }
}

const it = (n: number) => n.toLocaleString('it-IT')

// Riga principale: "In media 1,5 interventi al giorno" · "In media un intervento al giorno"
export function testoMediaGiorno(r: RiassuntoInterventi): string {
  if (r.alGiorno === null) return 'Nessun intervento in questo periodo'
  if (r.alGiorno === 1) return 'In media un intervento al giorno'
  return `In media ${it(r.alGiorno)} interventi al giorno`
}

// Riga secondaria: "un intervento ogni 2,5 giorni" (vuota se ≥ 1 al giorno o senza interventi)
export function testoOgniGiorni(r: RiassuntoInterventi): string {
  if (r.ogniGiorni === null || r.ogniGiorni <= 1) return ''
  return `un intervento ogni ${it(r.ogniGiorni)} giorni`
}

// "di cui 3 pulizie, 2 cambi biancheria" (singolari corretti)
export function testoDettaglio(r: RiassuntoInterventi): string {
  const p = r.pulizie === 1 ? '1 pulizia' : `${r.pulizie} pulizie`
  const c = r.cambi === 1 ? '1 cambio biancheria' : `${r.cambi} cambi biancheria`
  return `di cui ${p}, ${c}`
}
