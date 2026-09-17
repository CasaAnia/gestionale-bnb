// ============================================================================
// LE LINEE DI UN SOGGIORNO (17/09/2026): con più camere nella stessa
// prenotazione la striscia delle notti non è una sola.
//
// Due cose diverse che prima si confondevano:
// - il CAMBIO CAMERA durante il soggiorno: tratti in fila nello stesso gruppo
//   (group_id), una striscia sola con «⇄» fra le camere;
// - le CAMERE IN PARALLELO: gruppi diversi nelle stesse notti (la sorella in
//   Ambra mentre lei sta in Lena), una striscia PER OGNI gruppo, ognuna col
//   suo titolo che dice camera e notti.
//
// Ogni linea si modifica dalla sua striscia, col foglietto della notte di
// sempre; le altre linee entrano nel contesto come «altre prenotazioni», così
// la camera che occupa la sorella non compare fra le libere e i due letti di
// casa si contano una volta sola. Il piano di salvataggio (lib/strisciaNotti)
// si fa sui tratti della linea soltanto: le altre non si toccano.
//
// Funzioni pure: niente Supabase, niente orologio.
// ============================================================================
import { nottiDaSegmenti, camereDellaNotte, lettoDisponibileNotte, cambiaCamera, type SegmentoNotti, type NotteStriscia, type ContestoNotti, type PianoNotti, type CameraStriscia } from './strisciaNotti.ts'
import { periodoTratto, euroScheda, testoNotti } from './schedaPrenotazione.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export type SegmentoLinea = SegmentoNotti & { group_id?: string | null; total_amount?: number | string | null }

export type LineaSoggiorno<T extends SegmentoLinea = SegmentoLinea> = {
  /** il gruppo (group_id) o, senza gruppo, l'id della riga sola */
  chiave: string
  segmenti: T[]
  notti: NotteStriscia[]
  /** «Lena → Ambra · 24 → 28 set»: si scrive sopra la striscia quando le linee sono più d'una */
  titolo: string
}

export const SPIEGAZIONE_PARALLELE = 'Più camere nelle stesse notti: ogni camera si cambia dalla sua striscia.'
export const CAMERE_NON_LETTE = 'Le camere non si leggono: ricarica la scheda per spostare le notti.'
export const CONTO_INVARIATO = (cent: number) => `Il conto resta ${euroScheda(cent)}`
export const CONTO_CAMBIA = (prima: number, dopo: number) => `Conto: ${euroScheda(prima)} → ${euroScheda(dopo)}`

const nomeDi = (s: SegmentoNotti) => (s.rooms?.name ?? '').trim() || 'camera'
const attivi = <T extends SegmentoLinea>(segmenti: T[]) =>
  segmenti.filter(s => s.status !== 'annullata').sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))

export const chiaveLinea = (s: { id: string; group_id?: string | null }) => s.group_id || s.id

/** «Lena · 24 → 26 set», «Lena → Ambra · 24 → 28 set» (le camere in fila, senza ripetizioni consecutive) */
export function titoloLinea(segmenti: SegmentoLinea[]): string {
  const vivi = attivi(segmenti)
  if (vivi.length === 0) return ''
  const camere: string[] = []
  for (const s of vivi) { const n = nomeDi(s); if (camere[camere.length - 1] !== n) camere.push(n) }
  const dal = vivi[0].check_in
  const al = vivi.reduce((m, s) => (s.check_out > m ? s.check_out : m), vivi[0].check_out)
  return `${camere.join(' → ')} · ${periodoConMese(dal, al)}`
}

// «3 → 7 nov» anche nello stesso mese: sopra una striscia il mese serve
const periodoConMese = (dal: string, al: string) =>
  (dal.slice(0, 7) === al.slice(0, 7) ? `${periodoTratto(dal, al)} ${MESI_BREVI[Number(al.slice(5, 7)) - 1]}` : periodoTratto(dal, al))

/** Le linee del soggiorno, dalla prima che arriva; i tratti annullati non contano.
 *  Dentro un gruppo i tratti in FILA (uno finisce dove comincia l'altro) sono
 *  una linea; due tratti dello stesso gruppo che si SOVRAPPONGONO (le
 *  prenotazioni vecchie mettevano le camere in parallelo nello stesso gruppo,
 *  visto in produzione il 17/09/2026) sono linee diverse: «A» e «A#2». */
export function lineeDelSoggiorno<T extends SegmentoLinea>(segmenti: T[]): LineaSoggiorno<T>[] {
  const linee: { chiave: string; gruppo: string; segmenti: T[]; fine: string }[] = []
  for (const s of attivi(segmenti)) {
    const gruppo = chiaveLinea(s)
    const libera = linee.find(l => l.gruppo === gruppo && l.fine <= s.check_in)
    if (libera) {
      libera.segmenti.push(s)
      if (s.check_out > libera.fine) libera.fine = s.check_out
      continue
    }
    const quante = linee.filter(l => l.gruppo === gruppo).length
    linee.push({ chiave: quante === 0 ? gruppo : `${gruppo}#${quante + 1}`, gruppo, segmenti: [s], fine: s.check_out })
  }
  return linee
    .map(l => ({ chiave: l.chiave, segmenti: l.segmenti, notti: nottiDaSegmenti(l.segmenti), titolo: titoloLinea(l.segmenti) }))
    .sort((a, z) => a.segmenti[0].check_in.localeCompare(z.segmenti[0].check_in) || a.chiave.localeCompare(z.chiave))
}

/** Il contesto di UNA linea: le altre linee del soggiorno contano come altre
 *  prenotazioni (camera occupata, letti di casa impegnati); gli ospiti sono
 *  quelli della linea. */
export function contestoLinea<T extends SegmentoLinea>(linea: LineaSoggiorno<T>, linee: LineaSoggiorno<T>[], contesto: ContestoNotti): ContestoNotti {
  const altreLinee = linee.filter(l => l.chiave !== linea.chiave).flatMap(l => l.segmenti)
  const comeAltre = altreLinee
    .map(s => ({ ...s, room_id: s.room_id ?? s.rooms?.id ?? null }))
    .filter(s => s.room_id)
    .map(s => ({
      id: s.id, room_id: s.room_id as string, check_in: s.check_in, check_out: s.check_out, status: s.status,
      num_guests: s.num_guests, extra_bed: s.extra_bed, extra_bed_dates: s.extra_bed_dates, rooms: s.rooms,
    }))
  return {
    ...contesto,
    altre: [...contesto.altre, ...(comeAltre as unknown as ContestoNotti['altre'])],
    ospiti: Math.max(1, ...linea.segmenti.map(s => Number(s.num_guests) || 1)),
  }
}

/** Il conto prima e dopo il piano: le altre linee restano come sono, della
 *  linea contano i tratti aggiornati, quelli nuovi, e quelli rimasti; gli
 *  annullati non sono più dovuti. */
export function contoDopoNotti<T extends SegmentoLinea>(piano: PianoNotti, linea: LineaSoggiorno<T>, tutti: T[]): { primaCent: number; dopoCent: number } | null {
  if (piano.errore) return null
  const cent = (v: unknown) => Math.round((Number(v) || 0) * 100)
  const vivi = attivi(tutti)
  const primaCent = vivi.reduce((s, r) => s + cent(r.total_amount), 0)
  const dellaLineaIds = new Set(linea.segmenti.map(s => s.id))
  const altre = vivi.filter(r => !dellaLineaIds.has(r.id)).reduce((s, r) => s + cent(r.total_amount), 0)
  const aggiornati = new Map(piano.aggiorna.map(a => [a.id, a.campi.total_amount]))
  const dellaLinea = linea.segmenti.reduce((s, r) => {
    if (piano.annulla.includes(r.id)) return s
    return s + cent(aggiornati.has(r.id) ? aggiornati.get(r.id) : r.total_amount)
  }, 0)
  const nuovi = piano.crea.reduce((s, c) => s + cent(c.total_amount), 0)
  return { primaCent, dopoCent: altre + dellaLinea + nuovi }
}

/** «Conto: 300 € → 380 €», oppure «Il conto resta 300 €» */
export function testoContoDopo(conto: { primaCent: number; dopoCent: number }): string {
  return conto.primaCent === conto.dopoCent ? CONTO_INVARIATO(conto.primaCent) : CONTO_CAMBIA(conto.primaCent, conto.dopoCent)
}

// ── Le date di una linea (17/09/2026) ───────────────────────────────────────
// «Cambia date» era il campo delle date di «Altre modifiche»: qui le notti
// della linea si accorciano o si allungano ai due capi. Le notti nuove
// prendono camera, persone e letto della notte più vicina; se quella camera
// non è libera la notte resta senza camera (e il foglietto della notte la
// chiede), il letto resta acceso solo se i due letti di casa ci sono.
export const TITOLO_DATE = 'Cambia date'
export const COMANDO_DATE = 'Cambia date'
export const ERRORE_DATE = 'La partenza deve venire dopo l’arrivo.'

const giornoDopo = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
const giorniFra = (dal: string, al: string): string[] => {
  const out: string[] = []
  for (let g = dal; g < al; g = giornoDopo(g)) out.push(g)
  return out
}

/** Arrivo e partenza della linea com'è adesso */
export function dateLinea(notti: NotteStriscia[]): { arrivo: string; partenza: string } | null {
  const dentro = notti.filter(n => n.dentro)
  if (dentro.length === 0) return null
  return { arrivo: dentro[0].iso, partenza: giornoDopo(dentro[dentro.length - 1].iso) }
}

export function nottiConDate(notti: NotteStriscia[], arrivo: string, partenza: string, contesto: ContestoNotti): NotteStriscia[] {
  if (!arrivo || !partenza || partenza <= arrivo) return notti
  const per = new Map(notti.map(n => [n.iso, n]))
  const dentro = notti.filter(n => n.dentro)
  const prima = dentro[0] ?? null
  const ultima = dentro[dentro.length - 1] ?? null
  return giorniFra(arrivo, partenza).map(iso => {
    const c = per.get(iso)
    if (c) return c
    const modello = (prima && iso < prima.iso ? prima : ultima) ?? prima
    if (!modello) return { iso, cameraId: null, camera: null, letto: false, dentro: true, persone: contesto.ospiti, motivo: null, parallela: false }
    const libera = modello.cameraId ? camereDellaNotte(iso, contesto).find(x => x.id === modello.cameraId) ?? null : null
    const letto = Boolean(modello.letto && libera && lettoDisponibileNotte(iso, libera.id, contesto))
    return {
      iso, dentro: true, parallela: false,
      cameraId: libera ? libera.id : null,
      camera: libera ? libera.name : null,
      letto,
      persone: modello.persone,
      motivo: libera ? null : (modello.camera ? `${modello.camera} è occupata` : null),
    }
  })
}

// ── La conferma dopo aver salvato le notti (Ania, 17/09/2026) ───────────────
// Un pop-up grande, come dopo un pagamento: sopra il conto com'è adesso,
// sotto quante notti. Con un PREZZO FINALE concordato il conto non segue le
// notti (la cifra pattuita resta quella): se le notti sono cambiate lo si
// dice lì e resta anche un avviso nella scheda, finché lo sconto non viene
// rivisto.
// le parole sono di Ania (17/09/2026): «Notti aggiornate · Conto rimasto a
// 170 €! Hai inserito lo sconto del Prezzo Finale»
export const NOTTI_AGGIORNATE = 'Notti aggiornate'
export const RIVEDI_SCONTO = (totaleCent: number) => `Conto rimasto a ${euroScheda(totaleCent)}! Hai inserito lo sconto del Prezzo Finale`
export const AVVISO_RIVEDI_SCONTO = (totaleCent: number) => `Hai inserito lo sconto del Prezzo Finale: le notti sono cambiate ma il conto è rimasto a ${euroScheda(totaleCent)}. Controlla lo sconto dal conto.`
export const DURATA_CONFERMA_NOTTI = 3500
export const DURATA_CONFERMA_SCONTO = 7000

export function confermaNotti(p: { totaleCent: number; nottiPrima: number; nottiDopo: number; concordato: boolean }): {
  righe: { prima: string; seconda: string }; avviso: string | null; durata: number
} {
  const daRivedere = p.concordato && p.nottiPrima !== p.nottiDopo
  return {
    righe: {
      prima: NOTTI_AGGIORNATE,
      seconda: daRivedere ? RIVEDI_SCONTO(p.totaleCent) : `Conto: ${euroScheda(p.totaleCent)} · ${testoNotti(p.nottiDopo)}`,
    },
    avviso: daRivedere ? AVVISO_RIVEDI_SCONTO(p.totaleCent) : null,
    durata: daRivedere ? DURATA_CONFERMA_SCONTO : DURATA_CONFERMA_NOTTI,
  }
}

/** La linea ha un prezzo finale concordato (target_total) su almeno un tratto */
export function conPrezzoConcordato(segmenti: { discount_type?: string | null }[]): boolean {
  return segmenti.some(s => s.discount_type === 'target_total')
}

// ── «Cambio camera» (Ania, 17/09/2026) ──────────────────────────────────────
// Dalla riga sotto la striscia, accanto a «Cambia date»: si sceglie da quale
// notte e in quale camera, e tutte le notti da lì alla fine passano in quella
// camera (con la regola del foglietto: il letto si accende dove serve). Le
// camere proposte sono quelle libere in TUTTE quelle notti.
export const TITOLO_CAMBIO_CAMERA = 'Cambio camera'
export const COMANDO_CAMBIO_CAMERA = 'Cambio camera'
export const DA_QUALE_NOTTE = 'Da quale notte'
export const IN_QUALE_CAMERA = 'In quale camera'
export const NESSUNA_CAMERA_LIBERA_DA_LI = 'Nessuna camera è libera per tutte le notti da lì alla fine.'

/** Le notti in cui si dorme qui: fra queste si sceglie da dove cambiare */
export function nottiDaCuiCambiare(notti: NotteStriscia[]): NotteStriscia[] {
  return notti.filter(n => n.dentro)
}

/** Le camere libere in tutte le notti da `iso` alla fine (quella di adesso esclusa se è la stessa per tutte) */
export function camereDaLi(notti: NotteStriscia[], iso: string, contesto: ContestoNotti): CameraStriscia[] {
  const daLi = notti.filter(n => n.dentro && n.iso >= iso)
  if (daLi.length === 0) return []
  return contesto.camere.filter(c => daLi.every(n => n.cameraId === c.id || camereDellaNotte(n.iso, contesto).some(x => x.id === c.id)))
    .filter(c => !daLi.every(n => n.cameraId === c.id))
}

/** Tutte le notti da `iso` alla fine passano nella camera scelta */
export function cambiaCameraDaLi(notti: NotteStriscia[], iso: string, camera: CameraStriscia, contesto: ContestoNotti): NotteStriscia[] {
  let fatte = notti
  for (const n of notti.filter(n => n.dentro && n.iso >= iso)) fatte = cambiaCamera(fatte, n.iso, camera, contesto)
  return fatte
}
