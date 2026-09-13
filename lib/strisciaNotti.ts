// ============================================================================
// LA STRISCIA DELLE NOTTI (13/09/2026) — la logica pura, un pezzo solo per
// tutto il gestionale: la scheda prenotazione e, poi, la nuova prenotazione.
//
// Qui si decide COSA dice la striscia (una colonnina per notte: camera e letto
// in più) e COSA cambia quando Ania tocca una notte. Il disegno sta in
// components/StrisciaNotti.tsx; il salvataggio lo fa la pagina.
//
// Le regole di chi è libero, della capienza e dei letti della casa NON si
// riscrivono: vengono da lib/disponibilita (camereLibere), lib/lettiAggiuntivi
// (il pool dei due letti) e lib/tariffe (capienze e prezzi). I prezzi delle
// notti vengono da lib/prezzoNotti, gli sconti da lib/conto: qui non si
// inventa nessun listino.
//
// Niente Supabase, niente orologio: `oggi`, le camere e le altre prenotazioni
// arrivano dal chiamante.
// ============================================================================
import { camereLibere, giorniTra, STATI_CHE_OCCUPANO, type CameraMinima, type PrenotazioneMinima } from './disponibilita.ts'
import { lettiOccupatiPerNotte, lettiLiberi, lettiPoolPrenotazione, type PrenotazioneLetti } from './lettiAggiuntivi.ts'
import { capienzaBase, capienzaCamera, totaleLetto } from './tariffe.ts'
import { giorniSoggiorno, nottiConLetto, prezzoPrenotazione, fmtEuroBreve, type CameraTariffa } from './prezzoNotti.ts'
import { contoSoggiorno } from './conto.ts'
import { GIORNI_BREVI, GIORNI_LUNGHI } from './dateItaliane.ts'

// ── I pezzi che arrivano da fuori ───────────────────────────────────────────
export type CameraStriscia = CameraMinima & CameraTariffa & { id: string; name: string }

/** Un tratto di camera già salvato (una riga di bookings) */
export type SegmentoNotti = {
  id: string
  room_id?: string | null
  check_in: string
  check_out: string
  status: string
  num_guests?: number | string | null
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
  discount_type?: string | null
  discount_value?: number | string | null
  rooms?: (CameraTariffa & { id?: string; name?: string | null }) | null
}

/** Una notte della striscia: cosa si vede e cosa si può cambiare */
export type NotteStriscia = {
  iso: string
  cameraId: string | null   // null = camera ancora da scegliere
  camera: string | null     // il nome («Lena»), «Lena + Amelia» con due camere insieme
  letto: boolean            // il letto in più è acceso questa notte
  dentro: boolean           // false = «non dorme qui», la notte non entra nel conto
  persone: number
  motivo: string | null     // perché la camera manca: «Lena è occupata»
  parallela: boolean        // due camere nelle stesse notti: non si cambia dalla striscia
}

/** Quello che serve per sapere chi è libero e quanti letti restano */
export type ContestoNotti = {
  camere: CameraStriscia[]
  /** le ALTRE prenotazioni (non questa) che toccano queste notti */
  altre: (PrenotazioneMinima & PrenotazioneLetti)[]
  /** gli ospiti della prenotazione: le persone delle notti col letto in più */
  ospiti: number
}

export const NESSUNA_NOTTE = 'Il soggiorno resterebbe senza nessuna notte'
export const SCONTO_DECADUTO = 'Con questa modifica il totale concordato non è più uno sconto: rivedilo da «Vedi tutto» prima di spostare le notti'
export const CAMERA_MANCANTE = 'C’è una notte senza camera: scegli la camera prima di salvare'
export const TESTO_LIBERA = 'libera'

const giornoDopo = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
const nomeDi = (s: SegmentoNotti) => (s.rooms?.name ?? '').trim()
const attivi = (segmenti: SegmentoNotti[]) => segmenti.filter(s => s.status !== 'annullata').sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))

// ── Come si legge una data ──────────────────────────────────────────────────
// Sopra la colonnina: «gio» e il numero del mese. Con più di sette notti lo
// spazio è poco e i due pezzi vanno incolonnati (Ania, 13/09/2026).
export const NOTTI_PER_RIGA_UNICA = 7
export const compatta = (quante: number) => quante > NOTTI_PER_RIGA_UNICA
export function giornoDellaNotte(iso: string): { giorno: string; numero: number } {
  const [a, m, g] = iso.split('-').map(Number)
  return { giorno: GIORNI_BREVI[new Date(Date.UTC(a, m - 1, g)).getUTCDay()], numero: g }
}
/** Il titolo del foglietto: «Sabato 12» */
export function titoloNotte(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  return `${GIORNI_LUNGHI[new Date(Date.UTC(a, m - 1, g)).getUTCDay()]} ${g}`
}

// ── Le notti, dai tratti già salvati ────────────────────────────────────────
// Una notte per ogni giorno fra il primo arrivo e l'ultima partenza. Le notti
// che nessun tratto copre sono la pausa di un soggiorno spezzato: «libera».
export function nottiDaSegmenti(segmenti: SegmentoNotti[]): NotteStriscia[] {
  const righe = attivi(segmenti)
  if (righe.length === 0) return []
  const primo = righe[0].check_in
  const ultimo = righe.reduce((m, s) => (s.check_out > m ? s.check_out : m), righe[0].check_out)
  const conLetto = new Map(righe.map(s => [s.id, new Set(nottiConLetto(s))]))
  return giorniTra(primo, ultimo).map(iso => {
    const dentro = righe.filter(s => s.check_in <= iso && iso < s.check_out)
    if (dentro.length === 0) {
      return { iso, cameraId: null, camera: null, letto: false, dentro: false, persone: 0, motivo: null, parallela: false }
    }
    const letto = dentro.some(s => conLetto.get(s.id)!.has(iso))
    const nomi = [...new Set(dentro.map(nomeDi).filter(Boolean))]
    const ospiti = Math.max(...dentro.map(s => Number(s.num_guests) || 1))
    return {
      iso,
      cameraId: dentro.length === 1 ? (dentro[0].room_id ?? dentro[0].rooms?.id ?? null) : null,
      camera: nomi.join(' + ') || null,
      letto,
      dentro: true,
      persone: letto ? ospiti : Math.min(ospiti, dentro.reduce((s, r) => s + capienzaBase(r.rooms), 0)),
      motivo: dentro.length === 1 && !nomi.length ? 'camera non più in elenco' : null,
      parallela: dentro.length > 1,
    }
  })
}

// ── Il riassunto in ottone sotto la striscia ────────────────────────────────
// «2 cambi camera · letto in più 4 notti». Le notti «libere» non contano: non
// interrompono il conto dei cambi e non entrano in quello del letto.
export function cambiCamera(notti: NotteStriscia[]): number {
  const dentro = notti.filter(n => n.dentro)
  let cambi = 0
  for (let i = 1; i < dentro.length; i++) if (dentro[i].camera !== dentro[i - 1].camera) cambi += 1
  return cambi
}
// Dove disegnare il segno ⇄: la notte ha una camera diversa da quella della
// notte prima (le notti «libere» non interrompono il confronto).
export function segniDiCambio(notti: NotteStriscia[]): boolean[] {
  let ultima: string | null = null
  return notti.map(n => {
    if (!n.dentro) return false
    const cambia = ultima !== null && n.camera !== ultima
    ultima = n.camera
    return cambia
  })
}
export function riassuntoStriscia(notti: NotteStriscia[]): string {
  const cambi = cambiCamera(notti)
  const conLetto = notti.filter(n => n.dentro && n.letto).length
  const pezzi = [cambi === 0 ? 'nessun cambio camera' : `${cambi} ${cambi === 1 ? 'cambio camera' : 'cambi camera'}`]
  if (conLetto > 0) pezzi.push(`letto in più ${conLetto === 1 ? '1 notte' : `${conLetto} notti`}`)
  return pezzi.join(' · ')
}

// ── Gli avvisi in rosso ─────────────────────────────────────────────────────
// «Sabato 12 da sistemare · Lena è occupata»: una riga per ogni notte rimasta
// senza camera.
export function avvisiStriscia(notti: NotteStriscia[]): string[] {
  return notti.filter(n => n.dentro && !n.camera).map(n => {
    const testa = `${titoloNotte(n.iso)} da sistemare`
    return n.motivo ? `${testa} · ${n.motivo}` : testa
  })
}

// ── Chi è libero questa notte ───────────────────────────────────────────────
// Le regole sono quelle di lib/disponibilita: le camere occupate da un'altra
// prenotazione non compaiono affatto. La capienza NON toglie camere
// dall'elenco: se la camera scelta non basta lo dice un avviso, senza bloccare.
export function camereDellaNotte(iso: string, contesto: ContestoNotti): CameraStriscia[] {
  return camereLibere(contesto.camere, contesto.altre, iso, giornoDopo(iso), 1).libere
}

/** «Ambra non basta per 3 persone» — avviso, mai un blocco */
export function avvisoCapienza(camera: CameraStriscia | null | undefined, persone: number): string | null {
  if (!camera || persone <= capienzaCamera(camera)) return null
  return `${camera.name} non basta per ${persone} ${persone === 1 ? 'persona' : 'persone'}`
}

// ── Il letto in più di questa notte ─────────────────────────────────────────
// I letti di casa sono due in tutto (lib/lettiAggiuntivi): se in quella notte
// sono già impegnati altrove, «Sì» resta spento.
export const LETTO_NON_DISPONIBILE = 'non disponibile'
export function lettoDisponibileNotte(iso: string, cameraId: string | null, contesto: ContestoNotti): boolean {
  const occupate = contesto.altre.filter(a => STATI_CHE_OCCUPANO.has(a.status))
  const presi = lettiOccupatiPerNotte(occupate)
  const servono = Math.max(1, lettiPoolPrenotazione({ room_id: cameraId, num_guests: contesto.ospiti, extra_bed: true }))
  return lettiLiberi(presi, iso) >= servono
}

/** Il prezzo accanto a «Sì»: «+ 10 €», oppure «compreso» (Lena venduta tripla) */
export const LETTO_COMPRESO = 'compreso'
export function prezzoLettoNotte(camera: CameraStriscia | null | undefined, ospiti: number): string {
  const importo = totaleLetto(camera, ospiti, 1)
  return importo > 0 ? `+ ${fmtEuroBreve(importo)}` : LETTO_COMPRESO
}

// ── Le tre modifiche del foglietto ──────────────────────────────────────────
// Pure: tornano una striscia nuova, non toccano quella di prima.
// Le persone della notte NON si scelgono a mano: sono quelle del soggiorno
// (regola di sempre, lib/prezzoNotti). Nelle notti col letto in più ci sono
// tutti gli ospiti, nelle altre quelli che la camera tiene senza letto.
export function cambiaCamera(notti: NotteStriscia[], iso: string, camera: CameraStriscia, contesto: ContestoNotti): NotteStriscia[] {
  return notti.map(n => {
    if (n.iso !== iso) return n
    const persone = n.dentro ? n.persone : contesto.ospiti
    // Se le persone di questa notte non ci stanno senza letto, il letto si
    // accende da solo — come fa la nuova prenotazione — purché ce ne sia uno.
    const letto = n.letto || (persone > capienzaBase(camera) && lettoDisponibileNotte(iso, camera.id, contesto))
    return {
      ...n, cameraId: camera.id, camera: camera.name, dentro: true, motivo: null, parallela: false,
      letto, persone: letto ? persone : Math.min(persone, capienzaBase(camera)),
    }
  })
}

export function cambiaLetto(notti: NotteStriscia[], iso: string, acceso: boolean, contesto: ContestoNotti): NotteStriscia[] {
  return notti.map(n => {
    if (n.iso !== iso) return n
    const camera = contesto.camere.find(c => c.id === n.cameraId) ?? null
    return { ...n, letto: acceso, persone: acceso ? contesto.ospiti : Math.min(contesto.ospiti, capienzaBase(camera)) }
  })
}

export function nonDormeQui(notti: NotteStriscia[], iso: string): NotteStriscia[] {
  return notti.map(n => (n.iso === iso
    ? { ...n, dentro: false, letto: false, cameraId: null, camera: null, persone: 0, motivo: null, parallela: false }
    : n))
}

// ── Dalle notti ai tratti da salvare ────────────────────────────────────────
// Notti attaccate con la stessa camera = un tratto solo (una riga di bookings).
export type BloccoNotti = { cameraId: string; camera: string; check_in: string; check_out: string; nottiLetto: string[]; ospiti: number }
export function blocchiDaNotti(notti: NotteStriscia[]): BloccoNotti[] {
  const out: BloccoNotti[] = []
  for (const n of notti) {
    if (!n.dentro || !n.cameraId) continue
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.cameraId === n.cameraId && ultimo.check_out === n.iso) {
      ultimo.check_out = giornoDopo(n.iso)
      ultimo.ospiti = Math.max(ultimo.ospiti, n.persone)
      if (n.letto) ultimo.nottiLetto.push(n.iso)
      continue
    }
    out.push({ cameraId: n.cameraId, camera: n.camera ?? '', check_in: n.iso, check_out: giornoDopo(n.iso), nottiLetto: n.letto ? [n.iso] : [], ospiti: n.persone })
  }
  return out
}

export type CampiTratto = {
  room_id: string
  check_in: string
  check_out: string
  num_guests: number
  extra_bed: boolean
  extra_bed_dates: string[]
  price_per_night: number
  extra_bed_total: number
  total_amount: number
  discount_type?: string | null
  discount_value?: number | string | null
}

export type PianoNotti = {
  aggiorna: { id: string; campi: CampiTratto }[]
  crea: CampiTratto[]
  annulla: string[]
  errore: string | null
}

// Il tratto già salvato che assomiglia di più a un blocco: quello con più
// notti in comune, a parità di notti quello della stessa camera. Così una
// modifica piccola resta un aggiornamento e non cancella e ricrea righe.
function abbina(blocco: BloccoNotti, liberi: SegmentoNotti[]): SegmentoNotti | null {
  let scelto: SegmentoNotti | null = null
  let punti = 0
  for (const s of liberi) {
    const comuni = giorniSoggiorno(s.check_in, s.check_out).filter(g => g >= blocco.check_in && g < blocco.check_out).length
    if (comuni === 0) continue
    const punteggio = comuni * 2 + ((s.room_id ?? s.rooms?.id) === blocco.cameraId ? 1 : 0)
    if (punteggio > punti) { punti = punteggio; scelto = s }
  }
  return scelto
}

/**
 * Il piano di salvataggio: cosa aggiornare, cosa creare, cosa annullare.
 * I prezzi vengono da lib/prezzoNotti (listino della camera di quella notte,
 * scelta di Ania del 13/09/2026) e lo sconto della riga da lib/conto.
 */
export function pianoNotti(notti: NotteStriscia[], segmenti: SegmentoNotti[], contesto: ContestoNotti): PianoNotti {
  const vuoto: PianoNotti = { aggiorna: [], crea: [], annulla: [], errore: null }
  if (notti.some(n => n.dentro && !n.cameraId)) return { ...vuoto, errore: CAMERA_MANCANTE }
  const blocchi = blocchiDaNotti(notti)
  if (blocchi.length === 0) return { ...vuoto, errore: NESSUNA_NOTTE }

  const righe = attivi(segmenti)
  const liberi = [...righe]
  const piano: PianoNotti = { aggiorna: [], crea: [], annulla: [], errore: null }
  for (const b of blocchi) {
    const camera = contesto.camere.find(c => c.id === b.cameraId)
    if (!camera) return { ...vuoto, errore: CAMERA_MANCANTE }
    const origine = abbina(b, liberi)
    if (origine) liberi.splice(liberi.indexOf(origine), 1)
    const prezzo = prezzoPrenotazione(camera, {
      check_in: b.check_in, check_out: b.check_out, num_guests: b.ospiti, extra_bed_dates: b.nottiLetto,
    })
    // Lo sconto resta quello della riga: la percentuale segue le notti, il
    // totale concordato no (non si può spezzare fra due righe).
    const percentuale = origine?.discount_type === 'percentage' ? origine : null
    const concordato = origine?.discount_type === 'target_total' ? origine : null
    const conto = contoSoggiorno({
      check_in: b.check_in, check_out: b.check_out,
      price_per_night: prezzo.prezzoNotte, extra_bed_total: prezzo.lettoTotale,
      discount_type: origine?.discount_type ?? null, discount_value: origine?.discount_value ?? null,
    })
    if (concordato && conto.sconto <= 0) return { ...vuoto, errore: SCONTO_DECADUTO }
    const campi: CampiTratto = {
      room_id: camera.id,
      check_in: b.check_in,
      check_out: b.check_out,
      num_guests: b.ospiti,
      extra_bed: b.nottiLetto.length > 0,
      extra_bed_dates: b.nottiLetto,
      price_per_night: prezzo.prezzoNotte,
      extra_bed_total: prezzo.lettoTotale,
      total_amount: conto.totale,
      ...(percentuale ? { discount_type: 'percentage', discount_value: percentuale.discount_value ?? null } : {}),
      ...(concordato ? { discount_type: 'target_total', discount_value: concordato.discount_value ?? null } : {}),
    }
    if (origine) piano.aggiorna.push({ id: origine.id, campi })
    else piano.crea.push(campi)
  }
  piano.annulla = liberi.map(s => s.id)
  return piano
}

/** Qualcosa è davvero cambiato rispetto a com'era salvato? */
export function stessaStriscia(a: NotteStriscia[], b: NotteStriscia[]): boolean {
  if (a.length !== b.length) return false
  return a.every((n, i) => n.iso === b[i].iso && n.cameraId === b[i].cameraId && n.letto === b[i].letto && n.dentro === b[i].dentro)
}
