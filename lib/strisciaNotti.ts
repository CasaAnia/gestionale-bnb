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
import { camereLibere, elencoNomi, giorniTra, STATI_CHE_OCCUPANO, type CameraMinima, type PrenotazioneMinima } from './disponibilita.ts'
import { lettiOccupatiPerNotte, lettiLiberi, lettiPoolPrenotazione, lettoRipartito, type AccordoLetto, type PrenotazioneLetti } from './lettiAggiuntivi.ts'
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
  /** l'accordo del letto: quanto e con che criterio (proposta 0048) */
  extra_bed_importo?: number | string | null
  extra_bed_criterio?: string | null
  price_per_night?: number | string | null
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
const round2 = (n: number) => Math.round(n * 100) / 100
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

// ── Le notti di una prenotazione che si sta ancora scrivendo ────────────────
// Stesse notti, stessi colori, stesso foglietto: la differenza è che qui i
// periodi non sono ancora righe di bookings (lib/prenotazioneComposta).
export type PeriodoNotti = {
  id: string
  roomId: string | null
  checkIn: string
  checkOut: string
  ospiti: number
  nottiLetto: string[]
}
export function nottiDaPeriodi(periodi: PeriodoNotti[], camere: CameraStriscia[]): NotteStriscia[] {
  const ordinati = [...periodi].sort((a, z) => a.checkIn.localeCompare(z.checkIn))
  const out: NotteStriscia[] = []
  const visti = new Set<string>()
  for (const p of ordinati) {
    const camera = camere.find(c => c.id === p.roomId) ?? null
    for (const iso of giorniSoggiorno(p.checkIn, p.checkOut)) {
      if (visti.has(iso)) continue
      visti.add(iso)
      // Senza camera non c'è né letto né numero di ospiti: quelle due caselle
      // restano vuote, perché non vorrebbero dire niente (Ania, 15/09/2026).
      const letto = Boolean(camera) && p.nottiLetto.includes(iso)
      out.push({
        iso,
        cameraId: p.roomId,
        camera: camera?.name ?? null,
        letto,
        dentro: true,
        persone: camera ? (letto ? p.ospiti : Math.min(p.ospiti, capienzaBase(camera))) : 0,
        motivo: p.roomId && !camera ? 'camera non più in elenco' : null,
        parallela: false,
      })
    }
  }
  // le notti tolte («non dorme qui») lasciano un buco: si rimettono libere
  const tutti = out.map(n => n.iso).sort()
  if (tutti.length === 0) return out
  const completo: NotteStriscia[] = []
  for (const iso of giorniTra(tutti[0], giornoDopo(tutti[tutti.length - 1]))) {
    const c = out.find(n => n.iso === iso)
    completo.push(c ?? { iso, cameraId: null, camera: null, letto: false, dentro: false, persone: 0, motivo: null, parallela: false })
  }
  return completo
}

// ── Il riassunto in ottone sotto la striscia ────────────────────────────────
// «2 cambi camera · letto in più 4 notti». Le notti «libere» non contano: non
// interrompono il conto dei cambi e non entrano in quello del letto.
// Un cambio camera è il passaggio da una camera A a una camera B fra due
// notti CONSECUTIVE in cui la cliente dorme qui, e tutte e due le notti hanno
// una camera (Ania, 15/09/2026). Le notti ancora senza camera non contano —
// prima una camera sola in una notte sola faceva leggere «1 cambio camera» —
// e nemmeno le notti «non dorme qui», che non interrompono il confronto.
export function cambiCamera(notti: NotteStriscia[]): number {
  const dentro = notti.filter(n => n.dentro)
  let cambi = 0
  for (let i = 1; i < dentro.length; i++) {
    const prima = dentro[i - 1], ora = dentro[i]
    if (prima.camera && ora.camera && prima.camera !== ora.camera) cambi += 1
  }
  return cambi
}
// Dove disegnare il segno ⇄: fra le stesse due notti che contano un cambio.
export function segniDiCambio(notti: NotteStriscia[]): boolean[] {
  let prima: NotteStriscia | null = null
  return notti.map(n => {
    if (!n.dentro) return false
    const cambia = Boolean(prima?.camera && n.camera && n.camera !== prima.camera)
    prima = n
    return cambia
  })
}
// Se i cambi sono zero il riassunto non li nomina proprio: «nessun cambio
// camera» era una riga scritta per non dire niente (Ania, 15/09/2026).
export function riassuntoStriscia(notti: NotteStriscia[]): string {
  const cambi = cambiCamera(notti)
  const conLetto = notti.filter(n => n.dentro && n.letto).length
  const pezzi: string[] = []
  if (cambi > 0) pezzi.push(`${cambi} ${cambi === 1 ? 'cambio camera' : 'cambi camera'}`)
  if (conLetto > 0) pezzi.push(`letto in più ${conLetto === 1 ? '1 notte' : `${conLetto} notti`}`)
  return pezzi.join(' · ')
}

// ── Gli avvisi in rosso ─────────────────────────────────────────────────────
// UNA riga sola per tutte le notti rimaste senza camera, con scritto quali
// sono: «lun 14 e mar 15 senza camera: nessuna libera» (Ania, 14/09/2026 —
// quattro righe uguali per quattro notti non si leggevano). Il motivo si
// scrive quando è lo stesso per tutte.
export const SENZA_CAMERA = 'senza camera'
/** «lun 14», come sopra la colonnina */
export function etichettaNotteBreve(iso: string): string {
  const { giorno, numero } = giornoDellaNotte(iso)
  return `${giorno} ${numero}`
}
export function avvisiStriscia(notti: NotteStriscia[]): string[] {
  const senza = notti.filter(n => n.dentro && !n.camera)
  if (senza.length === 0) return []
  const quali = elencoNomi(senza.map(n => etichettaNotteBreve(n.iso)))
  // il motivo si scrive solo se è lo stesso per TUTTE: una notte senza motivo
  // (semplicemente non ancora scelta) non deve prendersi quello delle altre
  const motivi = new Set(senza.map(n => n.motivo ?? ''))
  const unico = motivi.size === 1 ? [...motivi][0] : ''
  return [`${quali} ${SENZA_CAMERA}${unico ? `: ${unico}` : ''}`]
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

// Quante persone dormono in quella camera col letto in più: gli ospiti del
// soggiorno, ma mai oltre quello che la camera tiene (Amelia due, Lena
// quattro). È questo numero a decidere tariffa e prezzo del letto.
export function personeColLetto(camera: CameraStriscia | null | undefined, ospiti: number): number {
  return Math.min(ospiti, capienzaCamera(camera))
}

// Il prezzo accanto a «Sì», sempre quello che il conto applicherà davvero:
//  · «10 €»          il letto si paga (regole di lib/tariffe, o l'importo
//                    scelto da Ania sul blocco del letto);
//  · «compreso»      il posto è già nel prezzo (Lena venduta come tripla);
//  · «compreso» anche quando il letto è in più ma le persone ci stanno lo
//    stesso (due che vogliono dormire separate): il conto non cambia, e se va
//    fatto pagare si fa da «Vedi tutto».
export const LETTO_COMPRESO = 'compreso'
/** Il costo accanto a «Sì»: «10 €» oppure «compreso» quando non si paga.
 *  `scelto` è quello che Ania ha deciso sopra, sul blocco del letto: è quello
 *  che il conto applica davvero, quindi è quello che si scrive (15/09/2026;
 *  prima diceva «senza aggiunta», che non si capiva). */
export function prezzoLettoNotte(
  camera: CameraStriscia | null | undefined, ospiti: number,
  scelto?: { importo: number | null; criterio: 'notte' | 'ogni4' | 'totale' } | null,
): string {
  const persone = personeColLetto(camera, ospiti)
  const daRegole = totaleLetto(camera, persone, 1)
  const importo = scelto?.importo ?? daRegole
  if (!importo || importo <= 0) return LETTO_COMPRESO
  const criterio = scelto?.criterio ?? 'notte'
  if (criterio === 'ogni4') return `${fmtEuroBreve(importo)} ogni 4 notti`
  if (criterio === 'totale') return `${fmtEuroBreve(importo)} in tutto`
  return fmtEuroBreve(importo)
}

// ── Quando il letto non si può spegnere ────────────────────────────────────
// Con più persone di quante la camera ne tenga senza, il letto serve per
// forza: «No» resta spento e accanto c'è scritto perché. Gli ospiti NON si
// abbassano da soli (Ania, 15/09/2026: letto e ospiti si annullavano a vicenda).
export function lettoObbligatorio(camera: CameraStriscia | null | undefined, persone: number): boolean {
  return Boolean(camera) && persone > capienzaBase(camera)
}
export function motivoLettoObbligatorio(camera: CameraStriscia | null | undefined, persone: number): string | null {
  if (!lettoObbligatorio(camera, persone)) return null
  return `servono ${persone} posti in ${camera!.name}`
}

// ── Le tre modifiche del foglietto ──────────────────────────────────────────
// Pure: tornano una striscia nuova, non toccano quella di prima.
// Le persone della notte NON si scelgono a mano: sono quelle del soggiorno
// (regola di sempre, lib/prezzoNotti). Nelle notti col letto in più ci sono
// tutti gli ospiti, nelle altre quelli che la camera tiene senza letto.
export function cambiaCamera(notti: NotteStriscia[], iso: string, camera: CameraStriscia, contesto: ContestoNotti): NotteStriscia[] {
  return notti.map(n => {
    if (n.iso !== iso) return n
    // una notte che non aveva camera non aveva nemmeno un numero: appena la
    // riceve, prende quello che vale per tutto il soggiorno
    const persone = n.dentro && n.persone > 0 ? n.persone : contesto.ospiti
    // Se le persone di questa notte non ci stanno senza letto, il letto si
    // accende da solo — come fa la nuova prenotazione — purché ce ne sia uno.
    const letto = n.letto || (persone > capienzaBase(camera) && lettoDisponibileNotte(iso, camera.id, contesto))
    return {
      ...n, cameraId: camera.id, camera: camera.name, dentro: true, motivo: null, parallela: false,
      letto, persone: letto ? persone : Math.min(persone, capienzaBase(camera)),
    }
  })
}

// Il letto di UNA notte.
//
// Nella SCHEDA il letto è anche il modo di dire «questa notte dormono in
// tre»: lì accendendolo le persone salgono a quelle della prenotazione.
// Nella pagina di inserimento, invece, le persone della notte hanno il loro
// − e il loro +: allora il letto non le tocca MAI, o i due comandi si
// annullano a vicenda (Ania, 15/09/2026). Lo dice `ospitiAParte`.
// Se il letto serve per forza, spegnerlo non fa niente: è la pastiglia «No»
// a restare spenta, con scritto perché.
export function cambiaLetto(
  notti: NotteStriscia[], iso: string, acceso: boolean, contesto: ContestoNotti,
  opzioni: { ospitiAParte?: boolean } = {},
): NotteStriscia[] {
  return notti.map(n => {
    if (n.iso !== iso) return n
    const camera = contesto.camere.find(c => c.id === n.cameraId) ?? null
    if (opzioni.ospitiAParte) {
      // il letto serve per forza: «No» non fa niente, e gli ospiti non calano
      if (!acceso && lettoObbligatorio(camera, n.persone)) return n
      return { ...n, letto: acceso }
    }
    return {
      ...n, letto: acceso,
      persone: acceso ? personeColLetto(camera, contesto.ospiti) : Math.min(contesto.ospiti, capienzaBase(camera)),
    }
  })
}

// Gli ospiti di UNA notte: il letto si accende da sé quando superano quello
// che la camera tiene senza. Usata dal foglietto nella pagina di inserimento,
// dove le persone di una notte si scelgono col − e col +.
export function cambiaOspitiNotte(notti: NotteStriscia[], iso: string, quanti: number, contesto: ContestoNotti): NotteStriscia[] {
  return notti.map(n => {
    if (n.iso !== iso) return n
    const camera = contesto.camere.find(c => c.id === n.cameraId) ?? null
    const persone = Math.max(1, Math.min(quanti, capienzaCamera(camera)))
    // il letto si accende da solo quando serve, e poi RESTA: tornando a due
    // persone non si spegne da sé, perché può essere stato voluto
    return { ...n, persone, letto: n.letto || persone > capienzaBase(camera) }
  })
}

// «Solo questa notte» oppure «da qui in poi»: sono una SCELTA, non due tasti
// che fanno qualcosa una volta sola (Ania, 15/09/2026). Perciò si parte sempre
// da com'erano le notti PRIMA del cambio: tornando su «solo questa notte» le
// notti dopo tornano esattamente com'erano, eccezioni messe a mano comprese.
export function ospitiDaNotte(
  prima: NotteStriscia[], iso: string, quanti: number, daQui: boolean, contesto: ContestoNotti,
): NotteStriscia[] {
  let fatte = cambiaOspitiNotte(prima, iso, quanti, contesto)
  if (!daQui) return fatte
  for (const dopo of fatte.filter(n => n.iso > iso && n.dentro).map(n => n.iso)) {
    fatte = cambiaOspitiNotte(fatte, dopo, quanti, contesto)
  }
  return fatte
}

export function nonDormeQui(notti: NotteStriscia[], iso: string): NotteStriscia[] {
  return notti.map(n => (n.iso === iso
    ? { ...n, dentro: false, letto: false, cameraId: null, camera: null, persone: 0, motivo: null, parallela: false }
    : n))
}

// ── Dalle notti ai tratti da salvare ────────────────────────────────────────
// Notti attaccate con la stessa camera = un tratto solo (una riga di bookings).
export type BloccoNotti = { cameraId: string; camera: string; check_in: string; check_out: string; nottiLetto: string[]; ospiti: number }
// Un tratto salvato porta UN numero di ospiti, e le notti senza letto valgono
// da sole quelle che la camera tiene: «tre persone solo martedì» si scrive
// benissimo con num_guests 3 e il letto acceso quel giorno.
// A imporre il numero sono quindi soltanto le notti COL letto: due notti col
// letto e persone diverse (tre e quattro in Lena) devono stare in tratti
// diversi, o il numero più alto si mangia l'altro (rilievo del 15/09/2026).
const impegnativo = (n: NotteStriscia) => (n.letto ? n.persone : null)
const compatibili = (a: number | null, b: number | null) => a === null || b === null || a === b

export function blocchiDaNotti(notti: NotteStriscia[]): BloccoNotti[] {
  const out: { blocco: BloccoNotti; impone: number | null }[] = []
  for (const n of notti) {
    if (!n.dentro || !n.cameraId) continue
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.blocco.cameraId === n.cameraId && ultimo.blocco.check_out === n.iso
      && compatibili(ultimo.impone, impegnativo(n))) {
      ultimo.blocco.check_out = giornoDopo(n.iso)
      ultimo.blocco.ospiti = Math.max(ultimo.blocco.ospiti, n.persone)
      ultimo.impone = ultimo.impone ?? impegnativo(n)
      if (n.letto) ultimo.blocco.nottiLetto.push(n.iso)
      continue
    }
    out.push({
      blocco: { cameraId: n.cameraId, camera: n.camera ?? '', check_in: n.iso, check_out: giornoDopo(n.iso), nottiLetto: n.letto ? [n.iso] : [], ospiti: n.persone },
      impone: impegnativo(n),
    })
  }
  return out.map(x => x.blocco)
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
  /** l'accordo del letto si porta dietro: importo e criterio vanno insieme */
  extra_bed_importo?: number | null
  extra_bed_criterio?: string | null
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

// Il blocco è esattamente il tratto già salvato? Stessa camera, stesse date,
// stesse notti col letto e stesse persone.
function uguale(b: BloccoNotti, s: SegmentoNotti): boolean {
  const letto = nottiConLetto(s)
  return (s.room_id ?? s.rooms?.id) === b.cameraId
    && s.check_in === b.check_in && s.check_out === b.check_out
    && (Number(s.num_guests) || 1) === b.ospiti
    && letto.length === b.nottiLetto.length
    && [...letto].sort().every((g, i) => g === [...b.nottiLetto].sort()[i])
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

  // ── L'accordo del letto è della PRENOTAZIONE, non del tratto ─────────────
  // Si legge dalle righe salvate (proposta 0048) e si riparte fra i blocchi in
  // proporzione alle notti col letto: «30 € in tutto» restano 30, «ogni 4
  // notti» non ricomincia a ogni tratto (rilievo del 15/09/2026).
  const conAccordo = righe.find(s => s.extra_bed_criterio && s.extra_bed_importo != null)
  const accordoLetto: AccordoLetto | null = conAccordo
    ? { importo: Number(conAccordo.extra_bed_importo) || 0, criterio: conAccordo.extra_bed_criterio as AccordoLetto['criterio'] }
    : null
  const lettoPerBlocco = accordoLetto ? lettoRipartito(accordoLetto, blocchi.map(b => b.nottiLetto.length)) : null

  // ── Lo sconto è della PRENOTAZIONE ───────────────────────────────────────
  // Prima lo prendeva solo il blocco che aveva una riga di origine abbinata, e
  // i tratti nuovi restavano a prezzo pieno (rilievo del 15/09/2026). Adesso
  // vale per tutti: la percentuale segue le notti; il totale concordato, che
  // non si può spezzare, diventa la percentuale che dà quel totale.
  const conSconto = righe.find(s => s.discount_type && s.discount_value != null)
  const scontoPercentuale = conSconto?.discount_type === 'percentage' ? Number(conSconto.discount_value) || 0 : null
  const scontoConcordato = conSconto?.discount_type === 'target_total' ? Number(conSconto.discount_value) || 0 : null

  // il prezzo pieno di ogni blocco, prima di sapere lo sconto
  const pieni = blocchi.map((b, i) => {
    const camera = contesto.camere.find(c => c.id === b.cameraId)
    if (!camera) return null
    const origine = abbina(b, righe)
    const prezzo = prezzoPrenotazione(camera, {
      check_in: b.check_in, check_out: b.check_out, num_guests: b.ospiti, extra_bed_dates: b.nottiLetto,
    })
    // La tariffa concordata NON si riscrive col listino: se il blocco resta
    // nella stessa camera con le stesse persone, resta quella salvata
    // (rilievo del 15/09/2026: 60 € concordati tornavano 80 di listino).
    const stessaCameraStessaGente = origine
      && origine.room_id === b.cameraId
      && (Number(origine.num_guests) || 1) === b.ospiti
      && origine.price_per_night != null
    const aNotte = stessaCameraStessaGente ? Number(origine!.price_per_night) || 0 : prezzo.prezzoNotte
    const letto = lettoPerBlocco ? lettoPerBlocco[i] : prezzo.lettoTotale
    const camere = round2(aNotte * giorniTra(b.check_in, b.check_out).length)
    return { camera, aNotte, letto, pieno: round2(camere + letto) }
  })
  if (pieni.some(x => x === null)) return { ...vuoto, errore: CAMERA_MANCANTE }
  const pienoTotale = pieni.reduce((s, x) => s + x!.pieno, 0)

  // il totale concordato si trasforma in percentuale, così ogni riga torna
  let percentuale = scontoPercentuale
  if (scontoConcordato !== null) {
    if (pienoTotale <= 0 || scontoConcordato >= pienoTotale) return { ...vuoto, errore: SCONTO_DECADUTO }
    if (blocchi.length === 1) percentuale = null            // una riga sola: resta «porta il totale a»
    else percentuale = Math.round((1 - scontoConcordato / pienoTotale) * 10000) / 100
  }

  const piano: PianoNotti = { aggiorna: [], crea: [], annulla: [], errore: null }
  blocchi.forEach((b, i) => {
    const dati = pieni[i]!
    const origine = abbina(b, liberi)
    if (origine) liberi.splice(liberi.indexOf(origine), 1)
    // Un tratto rimasto identico NON si tocca: la sua tariffa è quella che
    // Ania ha concordato, e il listino non deve riscrivergliela sopra.
    if (origine && uguale(b, origine) && !scontoDaRiscrivere(origine, percentuale, scontoConcordato, blocchi.length)) return
    const scontoCampi = percentuale !== null
      ? { discount_type: 'percentage', discount_value: percentuale }
      : scontoConcordato !== null
        ? { discount_type: 'target_total', discount_value: scontoConcordato }
        : {}
    const conto = contoSoggiorno({
      check_in: b.check_in, check_out: b.check_out,
      price_per_night: dati.aNotte, extra_bed_total: dati.letto,
      discount_type: (scontoCampi as { discount_type?: string }).discount_type ?? null,
      discount_value: (scontoCampi as { discount_value?: number }).discount_value ?? null,
    })
    const campi: CampiTratto = {
      room_id: dati.camera.id,
      check_in: b.check_in,
      check_out: b.check_out,
      num_guests: b.ospiti,
      extra_bed: b.nottiLetto.length > 0,
      extra_bed_dates: b.nottiLetto,
      price_per_night: dati.aNotte,
      extra_bed_total: dati.letto,
      total_amount: conto.totale,
      ...scontoCampi,
      // importo e criterio vanno insieme, o il database rifiuta la riga
      ...(accordoLetto && b.nottiLetto.length > 0
        ? { extra_bed_importo: accordoLetto.importo, extra_bed_criterio: accordoLetto.criterio }
        : { extra_bed_importo: null, extra_bed_criterio: null }),
    }
    if (origine) piano.aggiorna.push({ id: origine.id, campi })
    else piano.crea.push(campi)
  })
  piano.annulla = liberi.map(s => s.id)
  return piano
}

/** Un tratto identico va comunque riscritto se il suo sconto è cambiato */
function scontoDaRiscrivere(
  origine: SegmentoNotti, percentuale: number | null, concordato: number | null, quantiBlocchi: number,
): boolean {
  if (percentuale !== null) return origine.discount_type !== 'percentage' || Number(origine.discount_value) !== percentuale
  if (concordato !== null && quantiBlocchi === 1) return origine.discount_type !== 'target_total'
  return Boolean(origine.discount_type)
}

/** Qualcosa è davvero cambiato rispetto a com'era salvato? */
export function stessaStriscia(a: NotteStriscia[], b: NotteStriscia[]): boolean {
  if (a.length !== b.length) return false
  return a.every((n, i) => n.iso === b[i].iso && n.cameraId === b[i].cameraId && n.letto === b[i].letto && n.dentro === b[i].dentro)
}
