// ============================================================================
// IL «DA FARE» DEL RIQUADRO DEL DITO PREMUTO (versione D, Ania 02/10/2026).
//
// Le cose ancora da fare per una prenotazione, una per riga, SEMPRE in
// quest'ordine e solo quando la loro regola è vera:
//   1. preparare il letto in più   (rosso acceso, sempre per prima)
//   2. cambio camera: mer 30 passa in Allegra
//   3. chiedere l'ora d'arrivo
//   4. chiedere l'ora di partenza
//   5. controllare il bonifico
//   6. fare la ricevuta
// Nessuna voce «incassare»: lo dice già il conto. Se nessuna regola è vera
// l'elenco è vuoto e il blocco «Da fare» non compare.
//
// «Fare la ricevuta»: nel database non c'è nessun modo di segnare che la
// ricevuta è stata fatta (solo guests.vuole_ricevuta). La voce resta quindi
// finché la prenotazione non è passata; nessuna colonna nuova.
//
// Funzione pura, senza React né Supabase: `oggi` arriva dal chiamante.
// Provata con node --test (lib/daFarePrenotazione.test.ts).
// ============================================================================
import { comePagaSalvato, bonificoDelModo } from './comePaga.ts'
import { conPreposizione } from './richiesteTesti.ts'
import { giornoSettimana } from './schedaMaison.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export const LETTO_IN_PIU = 'preparare il letto in più'
export const CHIEDERE_ARRIVO = 'chiedere l’ora d’arrivo'
export const CHIEDERE_PARTENZA = 'chiedere l’ora di partenza'
export const CONTROLLARE_BONIFICO = 'controllare il bonifico'
export const FARE_RICEVUTA = 'fare la ricevuta'

export type VoceDaFare = { testo: string; letto?: true }

export type DatiDaFare = {
  /** oggi, a Roma (aaaa-mm-gg) */
  oggi: string
  /** le notti del soggiorno (aaaa-mm-gg), tutte le camere vive */
  notti: string[]
  /** le notti col letto in più (lib/lettiAggiuntivi.nottiLettoExtra, la stessa logica dell'icona 🛏) */
  nottiLetto: string[]
  /** i cambi camera della catena (legami.poiCamera, la stessa fonte dell'icona ⇄): il giorno e la camera d'arrivo */
  cambi: { giorno: string; camera: string }[]
  /** il primo arrivo da mostrare e se il suo orario manca (la stessa regola del «da chiedere» della scheda) */
  arrivo: { checkIn: string; orarioIgnoto: boolean } | null
  /** l'ultima partenza e il suo check_out_time */
  partenza: { checkOut: string; ora: string | null }
  /** l'accordo di pagamento salvato (accordoPrenotazione) */
  accordo: { accordo_pagamento?: string | null; bonifico?: boolean | null } | null
  /** i pagamenti registrati di tutta la prenotazione (regola fissa n. 9: interi, mai divisi) */
  pagamenti: { method?: string | null }[]
  /** il conto è saldato (o segnato pagato): non c'è più nessun bonifico da aspettare */
  saldato: boolean
  /** il cliente vuole la ricevuta (lib/valutazione.vuoleRicevuta) */
  vuoleRicevuta: boolean
}

// «29 set»
const giornoMese = (iso: string) => {
  const [, m, g] = iso.split('-').map(Number)
  return { g, mese: MESI_BREVI[m - 1] }
}
const piuUno = (iso: string) => new Date(Date.parse(`${iso}T12:00:00Z`) + 86400000).toISOString().slice(0, 10)

/**
 * Quando serve il letto, se non serve per tutte le notti che restano:
 * «il 29 set», «dal 29 set» (fino alla fine), «dal 29 al 30 set»; più
 * tratti separati da virgole. Vuoto quando serve per tutte.
 */
export function quandoLetto(nottiLetto: string[], notti: string[]): string {
  const col = [...new Set(nottiLetto)].filter(n => notti.includes(n)).sort()
  if (col.length === 0 || col.length >= notti.length) return ''
  const ultima = [...notti].sort().at(-1)!
  const tratti: { da: string; a: string }[] = []
  for (const n of col) {
    const t = tratti.at(-1)
    if (t && piuUno(t.a) === n) t.a = n
    else tratti.push({ da: n, a: n })
  }
  return tratti.map(t => {
    const da = giornoMese(t.da), a = giornoMese(t.a)
    if (t.da === t.a) return `${conPreposizione('il', da.g)} ${da.mese}`
    if (t.a === ultima) return `${conPreposizione('dal', da.g)} ${da.mese}`
    return da.mese === a.mese
      ? `${conPreposizione('dal', da.g)} ${conPreposizione('al', a.g)} ${a.mese}`
      : `${conPreposizione('dal', da.g)} ${da.mese} ${conPreposizione('al', a.g)} ${a.mese}`
  }).join(', ')
}

export function daFarePrenotazione(d: DatiDaFare): VoceDaFare[] {
  const out: VoceDaFare[] = []
  const passata = d.partenza.checkOut < d.oggi

  // 1. il letto in più: solo per le notti che devono ancora venire
  const lettoRestano = d.nottiLetto.filter(n => n >= d.oggi && d.notti.includes(n))
  if (d.partenza.checkOut > d.oggi && lettoRestano.length > 0) {
    const quando = quandoLetto(d.nottiLetto, d.notti)
    out.push({ testo: quando ? `${LETTO_IN_PIU} ${quando}` : LETTO_IN_PIU, letto: true })
  }

  // 2. i cambi camera non ancora passati, in ordine di giorno
  for (const c of [...d.cambi].sort((a, z) => a.giorno.localeCompare(z.giorno))) {
    if (c.giorno >= d.oggi) out.push({ testo: `cambio camera: ${giornoSettimana(c.giorno)} passa in ${c.camera}` })
  }

  // 3. l'ora d'arrivo
  if (d.arrivo && d.arrivo.orarioIgnoto && d.arrivo.checkIn >= d.oggi) out.push({ testo: CHIEDERE_ARRIVO })

  // 4. l'ora di partenza
  if (!(d.partenza.ora ?? '').trim() && d.partenza.checkOut >= d.oggi) out.push({ testo: CHIEDERE_PARTENZA })

  // 5. il bonifico atteso e non ancora registrato
  const modo = comePagaSalvato(d.accordo?.accordo_pagamento, d.accordo?.bonifico)
  const bonificoArrivato = d.pagamenti.some(p => (p.method ?? '').trim() === 'bonifico')
  if (bonificoDelModo(modo) && !bonificoArrivato && !d.saldato) out.push({ testo: CONTROLLARE_BONIFICO })

  // 6. la ricevuta: finché la prenotazione non è passata (nessun «fatta» nel database)
  if (d.vuoleRicevuta && !passata) out.push({ testo: FARE_RICEVUTA })

  return out
}
