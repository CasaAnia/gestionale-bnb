// ============================================================================
// LA NUOVA PAGINA DI INSERIMENTO (14/09/2026, /nuova-prenotazione) — la logica
// pura. Qui si decide COSA scrivere; la pagina decide come. Niente Supabase,
// niente orologio: `oggi` arriva dal chiamante.
//
// Le regole NON si riscrivono: camere libere e capienza da lib/disponibilita e
// lib/tariffe, prezzi da lib/prezzoNotti, periodi e conto da
// lib/prenotazioneComposta, le notti da lib/strisciaNotti, «come paga» da
// lib/comePaga.
// ============================================================================
import { capienzaBase, capienzaCamera } from './tariffe.ts'
import { giorniSoggiorno } from './prezzoNotti.ts'
const giornoDopo = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)
import { camereLibere, STATI_CHE_OCCUPANO, type CameraMinima, type PrenotazioneMinima } from './disponibilita.ts'
import { contoPeriodo, lettoProposto, rigaDaSalvare, notti as nottiPeriodo, round2, type CameraComposta, type PeriodoComposto } from './prenotazioneComposta.ts'
import { costoLettoIntero, lettoRipartito, type AccordoLetto } from './lettiAggiuntivi.ts'
import type { NotteStriscia } from './strisciaNotti.ts'
import { blocchiDaNotti } from './strisciaNotti.ts'
import { GIORNI_LUNGHI, MESI_LUNGHI } from './dateItaliane.ts'
import { euroScheda } from './schedaPrenotazione.ts'
import { rigaSconto, nottiANotte, dettaglioLetto, RIGA_LETTO, type ScontoVista } from './contoInRighe.ts'

// ── I testi della pagina ────────────────────────────────────────────────────
// Stanno qui e non nella pagina: una pagina di Next può esportare solo il
// componente e pochi campi noti, e la build col controllo dei tipi rifiuta il
// resto («TITOLO_PAGINA is not a valid Page export field», 16/09/2026).
export const TITOLO_PAGINA = 'Nuova prenotazione'
export const AGGIUNGI_CAMERA = '+ Aggiungi camera'
export const SENZA_TELEFONO = 'Il numero di telefono è obbligatorio: senza non si può né chiamare né scrivere.'
export const SENZA_NOME = 'Del cliente nuovo serve il nome.'

// ── Chi ci manda: i parametri dell'indirizzo (16/09/2026) ───────────────────
// Il calendario passa camera e giorno (room_id, check_in), «Scelgo io» delle
// richieste le due date (check_in, check_out), la scheda del cliente la
// persona (guest_id). returnTo non serve più: dopo il salvataggio si apre la
// scheda. Le date si prendono solo se sono giorni veri e in ordine.
export type ParametriInserimento = { guestId: string | null; roomId: string | null; checkIn: string | null; checkOut: string | null; prenotazione: string | null }
const GIORNO = /^\d{4}-\d{2}-\d{2}$/
export function parametriInserimento(search: string): ParametriInserimento {
  const p = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const giorno = (k: string) => { const v = (p.get(k) ?? '').trim(); return GIORNO.test(v) ? v : null }
  const checkIn = giorno('check_in')
  const partenza = giorno('check_out')
  return {
    guestId: (p.get('guest_id') ?? '').trim() || null,
    roomId: (p.get('room_id') ?? '').trim() || null,
    checkIn,
    checkOut: checkIn && partenza && partenza > checkIn ? partenza : null,
    // la camera in più di una prenotazione che c'è già (17/09/2026): il legame
    prenotazione: (p.get('prenotazione') ?? '').trim() || null,
  }
}

// ── La testa: «Domenica 14 settembre 2026», in maiuscolo lo fa il disegno ──
export function dataDiOggi(oggi: string): string {
  const [a, m, g] = oggi.split('-').map(Number)
  const giorno = GIORNI_LUNGHI[new Date(Date.UTC(a, m - 1, g)).getUTCDay()]
  return `${giorno} ${g} ${MESI_LUNGHI[m - 1]} ${a}`
}

// ── Le righe dei clienti trovati ────────────────────────────────────────────
// Come le righe «Da controllare» della Home: nome in grande, sotto il telefono
// e quante volte è stata qui.
export function volteInParole(soggiorni: number): string {
  if (soggiorni <= 0) return 'nessun soggiorno'
  if (soggiorni === 1) return '1 soggiorno'
  return `già stata qui ${soggiorni} volte`
}
export function rigaClienteTrovato(telefono: string | null | undefined, soggiorni: number): string {
  return [(telefono ?? '').trim(), volteInParole(soggiorni)].filter(Boolean).join(' · ')
}

// ── Le camere della fila «CAMERA» ───────────────────────────────────────────
// Occupata in una qualsiasi notte del periodo = pastiglia spenta. La riga in
// ottone sotto dice chi è libero; senza date non si dice niente.
// La disponibilità si guarda NOTTE PER NOTTE (Ania, 14/09/2026): con 14→18
// settembre il 14 e il 15 non c'è niente ma il 16 e il 17 sì, e prima l'intero
// soggiorno risultava impossibile. La regola resta quella di sempre,
// lib/disponibilita.camereLibere, chiesta una notte alla volta: `notti` sono
// le notti in cui quella camera è libera, `tutte` dice se le copre tutte.
export type CameraScelta<T extends CameraMinima> = { camera: T; libera: boolean; notti: string[]; tutte: boolean }
export function camereDelPeriodo<T extends CameraMinima>(
  camere: T[], altre: PrenotazioneMinima[], arrivo: string, partenza: string,
): CameraScelta<T>[] {
  if (!arrivo || !partenza || arrivo >= partenza) return camere.map(camera => ({ camera, libera: true, notti: [], tutte: true }))
  const notti = giorniSoggiorno(arrivo, partenza)
  const liberePerNotte = new Map<string, Set<string>>()
  for (const g of notti) {
    const { libere } = camereLibere(camere, altre, g, giornoDopo(g), 1)
    liberePerNotte.set(g, new Set(libere.map(c => c.id)))
  }
  return camere.map(camera => {
    const sue = notti.filter(g => liberePerNotte.get(g)!.has(camera.id))
    return { camera, libera: sue.length > 0, notti: sue, tutte: sue.length === notti.length }
  })
}
// La riga sotto le pastiglie dice solo chi copre TUTTO il soggiorno. «Libere
// solo per qualche notte: Allegra · Lena» è stata tolta (Ania, 15/09/2026):
// diceva che qualcosa era libero senza dire quando, e costringeva a provare
// le camere una per una. Dove ognuna è libera lo dicono già le pastiglie
// (spente solo per chi non è libero in nessuna notte) e il foglietto di ogni
// notte; che cosa manca lo dice la striscia.
export function rigaCamereLibere<T extends CameraMinima>(scelte: CameraScelta<T>[], arrivo: string, partenza: string): string {
  if (!arrivo || !partenza || arrivo >= partenza) return ''
  const tutte = scelte.filter(s => s.tutte).map(s => s.camera.name)
  if (tutte.length === scelte.length) return 'tutte le camere libere'
  if (tutte.length > 0) return `libere: ${tutte.join(' · ')}`
  if (scelte.every(s => !s.libera)) return 'nessuna camera libera in queste date'
  return ''
}

// ── I periodi di una linea, notte per notte ────────────────────────────────
// Scegliendo una camera non si prende tutto il soggiorno alla cieca: la camera
// va nelle notti in cui è libera, le altre restano senza camera (roomId null)
// e la striscia le segna. Niente notti perse: il soggiorno resta lungo com'è.
export type CambioLinea = {
  /** la camera toccata sulle pastiglie in alto; assente = non si tocca */
  cameraScelta?: string | null
  /** se quella camera è libera in quella notte */
  libera?: (iso: string, roomId: string) => boolean
  /** gli ospiti scritti in alto: valgono per tutte le notti */
  ospiti?: number
  /** la tariffa scritta in alto: vale per le notti della camera della linea */
  tariffa?: number | null
  /** la camera a cui si riferisce la tariffa scritta in alto */
  cameraDellaTariffa?: string | null
}

/** Com'era una notte prima della modifica */
type NottePrima = { roomId: string | null; ospiti: number; letto: boolean; tariffa: number | null; accordo: PeriodoComposto['letto']; id: string; inizio: boolean }

export function periodiDellaLinea(
  base: { gruppo: string; arrivo: string; partenza: string },
  vecchi: PeriodoComposto[],
  cambio: CambioLinea,
  nuovoId: () => string,
): PeriodoComposto[] {
  const ordinati = [...vecchi].sort((a, z) => a.checkIn.localeCompare(z.checkIn))
  // com'era ogni notte: camera, ospiti e letto si portano dietro, non si perdono
  const prima = new Map<string, NottePrima>()
  for (const p of ordinati) {
    for (const g of giorniSoggiorno(p.checkIn, p.checkOut)) {
      prima.set(g, { roomId: p.roomId, ospiti: p.ospiti, letto: p.nottiLetto.includes(g), tariffa: p.tariffa, accordo: p.letto, id: p.id, inizio: g === p.checkIn })
    }
  }
  const notti = giorniSoggiorno(base.arrivo, base.partenza)
  if (notti.length === 0) {
    const uno = ordinati[0]
    return [{
      id: uno?.id ?? nuovoId(), gruppo: base.gruppo,
      roomId: cambio.cameraScelta !== undefined ? cambio.cameraScelta : (uno?.roomId ?? null),
      checkIn: base.arrivo, checkOut: base.partenza,
      ospiti: cambio.ospiti ?? uno?.ospiti ?? 1, nottiLetto: [], letto: uno?.letto ?? null,
      tariffa: cambio.tariffa !== undefined ? cambio.tariffa : (uno?.tariffa ?? null),
    }]
  }

  const perNotte = notti.map(iso => {
    const era = prima.get(iso)
    // La camera scelta in alto va nelle notti in cui è libera; dove non lo è,
    // la notte resta com'era — quello che Ania ha messo a mano non si cancella
    // (15/09/2026: toccando il «+» degli ospiti spariva la camera di una notte).
    let roomId = era?.roomId ?? null
    if (cambio.cameraScelta !== undefined) {
      const scelta = cambio.cameraScelta
      if (scelta === null) roomId = null
      else if (!cambio.libera || cambio.libera(iso, scelta)) roomId = scelta
    }
    return { iso, roomId, ospiti: cambio.ospiti ?? era?.ospiti ?? 1, letto: era?.letto ?? false }
  })

  const blocchi: { roomId: string | null; ospiti: number; notti: { iso: string; letto: boolean }[] }[] = []
  for (const n of perNotte) {
    const ultimo = blocchi[blocchi.length - 1]
    if (ultimo && ultimo.roomId === n.roomId && ultimo.ospiti === n.ospiti) ultimo.notti.push({ iso: n.iso, letto: n.letto })
    else blocchi.push({ roomId: n.roomId, ospiti: n.ospiti, notti: [{ iso: n.iso, letto: n.letto }] })
  }
  return blocchi.map(b => {
    const checkIn = b.notti[0].iso
    const era = prima.get(checkIn)
    const stessaCamera = era?.roomId === b.roomId
    const tariffaScritta = cambio.tariffa !== undefined && b.roomId != null && b.roomId === cambio.cameraDellaTariffa
    return {
      id: era && stessaCamera && era.inizio ? era.id : nuovoId(),
      gruppo: base.gruppo,
      roomId: b.roomId,
      checkIn,
      checkOut: giornoDopo(b.notti[b.notti.length - 1].iso),
      ospiti: b.ospiti,
      nottiLetto: b.notti.filter(n => n.letto).map(n => n.iso),
      letto: era?.accordo ?? null,
      tariffa: tariffaScritta ? (cambio.tariffa ?? null) : (stessaCamera ? (era?.tariffa ?? null) : null),
    }
  })
}

/** Come periodiDaNotti, ma le notti senza camera NON spariscono dal soggiorno.
 *
 *  Un periodo salvato porta UN numero di ospiti: notti con persone diverse
 *  devono quindi stare in periodi diversi, o il numero più alto si mangia gli
 *  altri (rilievo del 15/09/2026: 2,2,3,2 diventava un periodo solo con 3, e
 *  riletto tornava 2,2,2,2). Si spezza perciò anche quando cambia il numero
 *  delle persone, non solo la camera. */
export function periodiDaNottiTenendoVuote(notti: NotteStriscia[], linea: LineaCamera, nuovoId: () => string): PeriodoComposto[] {
  const dentro = notti.filter(n => n.dentro)
  if (dentro.length === 0) return []
  const vecchi = [...linea.periodi].sort((a, z) => a.checkIn.localeCompare(z.checkIn))
  // A imporre il numero di ospiti sono solo le notti COL letto: le altre
  // valgono quelle che la camera tiene da sola. Due notti col letto e persone
  // diverse vanno quindi in periodi diversi (rilievo del 15/09/2026).
  const impone = (n: NotteStriscia) => (n.letto ? n.persone : null)
  const blocchi: { cameraId: string | null; impone: number | null; notti: NotteStriscia[] }[] = []
  for (const n of dentro) {
    const ultimo = blocchi[blocchi.length - 1]
    const attaccata = ultimo
      && ultimo.cameraId === n.cameraId
      && (ultimo.impone === null || impone(n) === null || ultimo.impone === impone(n))
      && giornoDopo(ultimo.notti[ultimo.notti.length - 1].iso) === n.iso
    if (attaccata) { ultimo.notti.push(n); ultimo.impone = ultimo.impone ?? impone(n) }
    else blocchi.push({ cameraId: n.cameraId, impone: impone(n), notti: [n] })
  }
  return blocchi.map(b => {
    const checkIn = b.notti[0].iso
    const origine = vecchi.find(p => p.checkIn <= checkIn && checkIn < p.checkOut) ?? vecchi[0]
    const stessaCamera = origine?.roomId === b.cameraId
    return {
      id: origine && stessaCamera && origine.checkIn === checkIn ? origine.id : nuovoId(),
      gruppo: linea.gruppo,
      roomId: b.cameraId,
      checkIn,
      checkOut: giornoDopo(b.notti[b.notti.length - 1].iso),
      ospiti: Math.max(1, ...b.notti.map(n => n.persone)),
      nottiLetto: b.notti.filter(n => n.letto).map(n => n.iso),
      letto: origine?.letto ?? null,
      tariffa: stessaCamera ? (origine?.tariffa ?? null) : null,
    }
  })
}

// Una notte con più persone di quante la camera ne tenga senza letto non si
// può salvare com'è: il salvataggio la rileggerebbe con meno gente. Non si
// aggiusta di nascosto — si dice quali notti sono, e chi chiama decide.
export const NOTTE_NON_SALVABILE = (giorno: string, camera: string, persone: number) =>
  `${giorno}: ${persone} persone in ${camera} senza il letto in più non si possono salvare`
export function nottiNonSalvabili(
  notti: NotteStriscia[], camera: (id: string | null) => CameraComposta | null,
): string[] {
  return notti
    .filter(n => n.dentro && n.cameraId && !n.letto && n.persone > capienzaBase(camera(n.cameraId)))
    .map(n => n.iso)
}

// ── Colonne che possono non esserci ancora ──────────────────────────────────
// Alcune colonne sono arrivate con le proposte 0041/0044/0048: se non sono
// state applicate, il database le rifiuta. Si può salvare lo stesso togliendo
// SOLO quelle che servono a ricordare un accordo — ma dicendolo. Le due che
// tengono insieme la prenotazione invece non si possono perdere: senza
// prenotazione_id le camere diventano prenotazioni separate, e col conto
// unico i totali sballano (rilievo del 15/09/2026).
export const RINUNCIABILI = new Set(['prenotazione_id', 'extra_bed_importo', 'extra_bed_criterio', 'accordo_pagamento', 'caparra_centesimi', 'caparra_entro', 'chi_e_2'])
export const SENZA_NON_SI_SALVA = new Set(['prenotazione_id'])

export const NOMI_COLONNA: Record<string, string> = {
  prenotazione_id: 'il legame fra le camere della stessa prenotazione',
  extra_bed_importo: 'l’accordo sul prezzo del letto',
  extra_bed_criterio: 'l’accordo sul prezzo del letto',
  accordo_pagamento: 'come paga',
  caparra_centesimi: 'la caparra',
  caparra_entro: 'la scadenza della caparra',
  chi_e_2: 'chi è la seconda persona che dorme con lei',
}
export function mancaColonnaNecessaria(colonna: string): string {
  return `Non salvo: manca ancora nel database ${NOMI_COLONNA[colonna] ?? colonna}, e senza quello la prenotazione verrebbe spezzata. Serve la proposta SQL corrispondente applicata su Supabase.`
}
export function avvisoDegradazione(colonne: string[]): string {
  const cose = [...new Set(colonne.map(c => NOMI_COLONNA[c] ?? c))]
  return `Prenotazione salvata, ma questi dati NON sono stati registrati: ${cose.join(', ')}. Servono le proposte SQL corrispondenti applicate su Supabase.`
}

// ── Le camere già prese da qualcun altro ────────────────────────────────────
// Le pastiglie spengono le camere occupate, ma al salvataggio serve un
// controllo vero: fra il momento in cui la pagina si è aperta e il tocco su
// «Salva» può essere arrivata un'altra prenotazione (rilievo del 15/09/2026).
export function conflittiConAltre(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => CameraComposta | null,
  altre: PrenotazioneMinima[],
): string[] {
  const occupanti = altre.filter(a => STATI_CHE_OCCUPANO.has(a.status))
  const fuori: string[] = []
  for (const p of periodi) {
    const c = camera(p.roomId)
    if (!c || !p.roomId) continue
    for (const a of occupanti) {
      if (a.room_id !== p.roomId) continue
      if (a.check_in < p.checkOut && a.check_out > p.checkIn) {
        fuori.push(`${c.name} è già occupata dal ${a.check_in.slice(8)}/${a.check_in.slice(5, 7)} al ${a.check_out.slice(8)}/${a.check_out.slice(5, 7)}: scegli un'altra camera o altre date.`)
        break
      }
    }
  }
  return [...new Set(fuori)]
}

// ── Quante volte è già stata qui ────────────────────────────────────────────
// Si contano i SOGGIORNI, non le righe: una visita con due cambi camera è una
// visita sola (rilievo del 15/09/2026, prima ne contava tre). L'identità è
// quella di lib/storicoCliente: prenotazione_id, se manca group_id, se manca
// la riga da sola.
export type RigaSoggiorno = { guest_id: string; check_out: string; prenotazione_id?: string | null; group_id?: string | null; id?: string | null }
export function soggiorniConclusi(righe: RigaSoggiorno[], oggi: string): Record<string, number> {
  const visti = new Map<string, Set<string>>()
  for (const b of righe) {
    if (!b.guest_id || b.check_out > oggi) continue
    const chiave = b.prenotazione_id || b.group_id || b.id || `${b.guest_id}|${b.check_out}`
    if (!visti.has(b.guest_id)) visti.set(b.guest_id, new Set())
    visti.get(b.guest_id)!.add(chiave)
  }
  return Object.fromEntries([...visti.entries()].map(([id, s]) => [id, s.size]))
}

// ── Quanti ospiti può tenere il soggiorno ───────────────────────────────────
// Il massimo del «+» è la capienza VERA della camera scelta, letto in più
// compreso dove è previsto (Ania, 14/09/2026): Lena arriva a 4, Allegra e
// Ambra a 3, Amelia a 2. Finché la camera non è scelta vale la CASA: la
// camera più capiente che abbiamo, cioè 4. Non si guarda chi è libero in
// quelle date — se non è libero nessuno il numero restava fermo a 2 proprio
// mentre Ania cercava le date giuste per tre persone (15/09/2026).
export type CameraCapienza = { name?: string | null; has_extra_bed?: boolean | null }
export function ospitiMassimi<T extends CameraMinima>(
  camera: CameraCapienza | null | undefined,
  scelte: CameraScelta<T>[] = [],
): number {
  if (camera) return capienzaCamera(camera)
  const tutte = scelte.map(s => capienzaCamera(s.camera))
  return tutte.length > 0 ? Math.max(...tutte) : capienzaBase(null)
}
/** Scegliendo la camera: il numero scritto a mano resta (al più la capienza
 *  della camera nuova); quello lasciato com'era prende le persone solite. */
export function ospitiScegliendoCamera(
  ospiti: number, prima: CameraCapienza | null | undefined, dopo: CameraCapienza | null | undefined,
): number {
  const solito = prima ? capienzaBase(prima) : 1
  if (ospiti <= solito) return capienzaBase(dopo)
  return Math.min(ospiti, capienzaCamera(dopo))
}

/** Con più camere il massimo della prenotazione è la somma delle loro capienze */
export function ospitiMassimiPrenotazione(camere: (CameraCapienza | null | undefined)[]): number {
  return camere.reduce((t, c) => t + capienzaCamera(c), 0)
}

// ── Il letto in più della prenotazione ──────────────────────────────────────
// Uno solo per tutta la prenotazione: prezzo e criterio si scelgono una volta
// e le notti si spuntano dalla striscia. Il blocco si vede appena c'è una
// camera che il letto lo prevede — prima non compariva mai, perché aspettava
// che il letto fosse GIÀ acceso (Ania, 14/09/2026). I letti di casa sono due:
// se in tutte le notti sono già impegnati altrove resta spento, con scritto
// «non disponibile».
export const LETTO_NON_DISPONIBILE_TESTO = 'non disponibile: i due letti di casa sono già impegnati in queste notti'
export type StatoLettoNuova = { possibile: boolean; acceso: boolean; nonDisponibile: boolean; testo: string | null }
export function statoLettoNuova(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => (CameraCapienza & { id?: string }) | null,
  lettoLibero: (iso: string, roomId: string | null) => boolean,
): StatoLettoNuova {
  const conCamera = periodi.filter(p => p.roomId && camera(p.roomId)?.has_extra_bed)
  const acceso = periodi.some(p => p.nottiLetto.length > 0)
  if (conCamera.length === 0) return { possibile: false, acceso, nonDisponibile: false, testo: null }
  const daAccendere = conCamera.flatMap(p => giorniSoggiorno(p.checkIn, p.checkOut).filter(g => !p.nottiLetto.includes(g)).map(g => ({ g, roomId: p.roomId })))
  const nonDisponibile = !acceso && daAccendere.length > 0 && daAccendere.every(({ g, roomId }) => !lettoLibero(g, roomId))
  return { possibile: true, acceso, nonDisponibile, testo: nonDisponibile ? LETTO_NON_DISPONIBILE_TESTO : null }
}

// ── Gli ospiti di una notte ─────────────────────────────────────────────────
// Il modello di sempre (lib/prezzoNotti): in una notte ci sono gli ospiti del
// soggiorno se c'è il letto in più, altrimenti quelli che la camera tiene da
// sola. Quindi i valori possibili di una notte sono DUE, e il − e il + del
// foglietto si muovono fra quelli: nessun numero che poi non si può salvare.
export function ospitiPossibiliNotte(camera: { name?: string | null; has_extra_bed?: boolean | null } | null | undefined, ospitiSoggiorno: number): number[] {
  const base = capienzaBase(camera)
  const max = Math.min(Math.max(ospitiSoggiorno, base), capienzaCamera(camera))
  const out: number[] = []
  for (let n = base; n <= max; n++) out.push(n)
  return out
}
/** Quanti ospiti ha quella notte: col letto tutti, senza letto quelli della camera */
export function ospitiDellaNotte(camera: { name?: string | null } | null | undefined, ospitiSoggiorno: number, conLetto: boolean): number {
  return conLetto ? ospitiSoggiorno : Math.min(ospitiSoggiorno, capienzaBase(camera))
}

// ── Il conto, riga per riga ─────────────────────────────────────────────────
export type RigaContoNuova = {
  chiave: string
  titolo: string        // «Lena» oppure «Letto in più»
  dettaglio: string     // «4 notti × 80 €»
  importo: string       // «320 €»
  cent: number
}
export type ContoNuova = {
  righe: RigaContoNuova[]
  totaleCent: number | null      // prima dello sconto
  scontoCent: number
  daPagareCent: number | null
  notti: number
  aNotte: string                 // «5 notti · 77,40 € a notte»
  // già scritti, così il disegno non rifà nessun conto
  totale: string | null
  sconto: ScontoVista | null     // «Sconto 10 %» −32 €, intero senza centesimi (18/09/2026)
  daPagare: string | null
}

export type ScontoNuova = { tipo: 'nessuno' | 'percentuale' | 'finale'; valore: number | null }

const fmt = (cent: number) => euroScheda(cent)

/** Quante notti del soggiorno hanno il letto in più */
export function nottiColLetto(periodi: PeriodoComposto[]): number {
  return new Set(periodi.flatMap(p => p.nottiLetto)).size
}
/** L'accordo del letto della prenotazione: uno solo, preso dal primo tratto
 *  che ce l'ha. Senza importo scritto a mano vale il listino della camera. */
export function accordoLetto(
  periodi: PeriodoComposto[], camera: (id: string | null) => CameraComposta | null,
): AccordoLetto | null {
  for (const p of periodi) {
    if (p.nottiLetto.length === 0) continue
    if (p.letto) return { importo: p.letto.importo, criterio: p.letto.criterio }
    return { importo: lettoProposto(camera(p.roomId), p.ospiti), criterio: 'notte' }
  }
  return null
}

export function contoNuovaPrenotazione(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => CameraComposta | null,
  sconto: ScontoNuova,
): ContoNuova {
  const righe: RigaContoNuova[] = []
  let totale = 0
  let mancante = periodi.length === 0
  const giorni = new Set<string>()
  // Il letto è UNO per tutta la prenotazione: si conta sul soggiorno intero e
  // si riparte fra i tratti, invece di addebitarlo per intero a ognuno
  // (rilievo del 15/09/2026: «30 € in tutto» su due tratti facevano 60).
  const lettoCent = Math.round(costoLettoIntero(accordoLetto(periodi, camera), nottiColLetto(periodi)) * 100)
  for (const p of periodi) {
    const c = camera(p.roomId)
    const conto = contoPeriodo(p, c)
    if (!c || !conto) { mancante = true; continue }
    for (const g of giorniSoggiorno(p.checkIn, p.checkOut)) giorni.add(g)
    const n = nottiPeriodo(p)
    const camereCent = Math.round((conto.totale - conto.lettoTotale) * 100)
    righe.push({
      chiave: p.id,
      titolo: c.name,
      dettaglio: `${n} ${n === 1 ? 'notte' : 'notti'} × ${fmt(Math.round(conto.prezzoNotte * 100))}`,
      importo: fmt(camereCent),
      cent: camereCent,
    })
    totale += camereCent
  }
  if (lettoCent > 0 && !mancante) {
    const quante = nottiColLetto(periodi)
    righe.push({
      chiave: 'letto',
      titolo: RIGA_LETTO,
      // «3 notti × 10 €» quando l'importo a notte torna (18/09/2026)
      dettaglio: dettaglioLetto(quante, lettoCent, [Number.isInteger(lettoCent / quante) ? lettoCent / quante : -1]),
      importo: fmt(lettoCent),
      cent: lettoCent,
    })
    totale += lettoCent
  }
  const totaleCent = mancante ? null : totale
  const scontoCent = totaleCent === null ? 0 : scontoInCentesimi(totaleCent, sconto)
  const daPagareCent = totaleCent === null ? null : Math.max(0, totaleCent - scontoCent)
  const n = giorni.size
  return {
    righe,
    totaleCent,
    scontoCent,
    daPagareCent,
    notti: n,
    aNotte: daPagareCent !== null ? nottiANotte(n, daPagareCent) : '',
    totale: totaleCent === null ? null : fmt(totaleCent),
    sconto: rigaSconto(scontoCent, sconto.tipo === 'percentuale' ? sconto.valore : null),
    daPagare: daPagareCent === null ? null : fmt(daPagareCent),
  }
}

// ── Cosa manca al conto ─────────────────────────────────────────────────────
// Il conto diceva «da completare» senza dire cosa: si scrive in ottone sotto
// il totale (Ania, 14/09/2026). Gli unici campi che lo tengono fermo sono la
// camera e le date: la tariffa a notte NON serve (senza di lei vale il
// listino) e nemmeno «come paga», che riguarda l'incasso e non il conto.
export const MANCA_CAMERA = 'manca la camera'
export const MANCA_DATE = 'la partenza deve venire dopo l’arrivo'
export function mancaAlConto(periodi: PeriodoComposto[], camera: (id: string | null) => CameraComposta | null): string | null {
  if (periodi.length === 0) return MANCA_CAMERA
  if (periodi.some(p => !p.roomId || !camera(p.roomId))) return MANCA_CAMERA
  if (periodi.some(p => nottiPeriodo(p) <= 0)) return MANCA_DATE
  return null
}

// ── Dove sta il campo che ferma il salvataggio ──────────────────────────────
// «Salva la prenotazione» non deve restare muto (Ania, 14/09/2026): o salva,
// o dice cosa manca e porta la pagina su quel campo. L'avviso è il primo
// problema — quello da cui dipendono gli altri — e `dove` è il pezzo di
// pagina da mostrare.
export const DOVE_CONTO = '[data-conto-nuova]'
export function doveManca(guai: string[]): { avviso: string; dove: string } | null {
  const primo = guai[0]
  if (!primo) return null
  const dove =
    /camera non è stata scelta|Manca la camera|due volte la notte/i.test(primo) ? '[data-camera-soggiorno]'
    : /orario/i.test(primo) ? '[data-arrivo]'
    : /caparra/i.test(primo) ? '[data-come-paga-parte]'
    : /partenza|arrivo/i.test(primo) ? '[data-campo="arrivo"]'
    : /ospiti|persona|persone|tiene al massimo/i.test(primo) ? '[data-ospiti]'
    : /letto/i.test(primo) ? '[data-prezzo-letto]'
    : DOVE_CONTO
  return { avviso: primo, dove }
}

export function scontoInCentesimi(totaleCent: number, sconto: ScontoNuova): number {
  if (sconto.tipo === 'nessuno' || !sconto.valore || sconto.valore <= 0) return 0
  if (sconto.tipo === 'percentuale') {
    if (sconto.valore >= 100) return totaleCent
    return Math.round(totaleCent * sconto.valore) / 100
  }
  const finale = Math.round(sconto.valore * 100)
  return finale >= totaleCent ? 0 : totaleCent - finale
}

/** «430 € → 387 €» accanto al campo dello sconto; vuoto se non cambia niente */
export function scontoInParole(totaleCent: number | null, sconto: ScontoNuova): string {
  if (totaleCent === null) return ''
  const tolto = scontoInCentesimi(totaleCent, sconto)
  if (tolto <= 0) return ''
  return `${fmt(totaleCent)} → ${fmt(totaleCent - tolto)}`
}

/** Come si salva lo sconto su bookings: le stesse due forme di sempre */
export function campiSconto(totaleCent: number | null, sconto: ScontoNuova, unaRigaSola: boolean): Record<string, unknown> {
  if (sconto.tipo === 'nessuno' || !sconto.valore || sconto.valore <= 0 || totaleCent === null) return {}
  if (sconto.tipo === 'percentuale') return { discount_type: 'percentage', discount_value: sconto.valore }
  if (unaRigaSola) return { discount_type: 'target_total', discount_value: sconto.valore }
  // più camere: il totale concordato si spalma come percentuale, come fa oggi l'inserimento
  const pieno = totaleCent / 100
  return { discount_type: 'percentage', discount_value: round2((1 - sconto.valore / pieno) * 100) }
}

/**
 * Lo sconto RIGA PER RIGA (16/09/2026). Col prezzo finale su più tratti la
 * percentuale spalmata (66,67 %) faceva rileggere 999,90 al posto di 1.000:
 * la scheda ricalcola ogni riga dal prezzo a notte e arrotonda tre volte.
 * Adesso ogni riga porta il SUO totale concordato (`target_total`), cioè la
 * quota che le tocca (totaliScontati): la somma torna al centesimo e la
 * lettura riga per riga (lib/conto) dà esattamente quel numero. La percentuale
 * resta una percentuale, uguale su tutte le righe.
 */
export function scontoPerRiga(totaliBase: number[], sconto: ScontoNuova): Record<string, unknown>[] {
  const pienoCent = totaliBase.reduce((s, t) => s + Math.round(t * 100), 0)
  if (sconto.tipo === 'nessuno' || !sconto.valore || sconto.valore <= 0 || pienoCent <= 0) return totaliBase.map(() => ({}))
  if (sconto.tipo === 'percentuale') return totaliBase.map(() => ({ discount_type: 'percentage', discount_value: sconto.valore }))
  if (scontoInCentesimi(pienoCent, sconto) <= 0) return totaliBase.map(() => ({}))
  const scontati = totaliScontati(totaliBase, sconto)
  return totaliBase.map((_, i) => ({ discount_type: 'target_total', discount_value: scontati[i] }))
}

// ── «Con lei»: chi altro dorme qui ──────────────────────────────────────────
export const CHI_E_VOCI = ['Sorella', 'Mamma', 'Figlia', 'Marito', 'Amica']
export type PersonaConLei = { id: string; nome: string; chiE: string; telefono: string }
/** Le due colonne di bookings reggono due persone: la terza si dice, non si perde in silenzio */
export const PERSONE_CON_LEI_MAX = 2
export const TROPPE_PERSONE = 'Di persone in più se ne possono salvare due: la terza scrivila nella nota.'

// Chi è ognuna delle due: `chi_e` per la prima (colonna di sempre) e `chi_e_2`
// per la seconda (proposta 0056): prima la relazione della seconda persona si
// perdeva in silenzio (rilievo del 16/09/2026). Senza la 0056 la colonna è
// fra le rinunciabili: si salva il resto e lo si dice.
export function campiConLei(persone: PersonaConLei[]): Record<string, unknown> {
  const campi: Record<string, unknown> = {}
  persone.slice(0, PERSONE_CON_LEI_MAX).forEach((p, i) => {
    const n = i + 1
    if (p.nome.trim()) campi[`extra_phone_${n}_name`] = p.nome.trim()
    if (p.telefono.trim()) campi[`extra_phone_${n}`] = p.telefono.replace(/\s/g, '')
    if (p.chiE.trim()) campi[i === 0 ? 'chi_e' : 'chi_e_2'] = p.chiE.trim()
  })
  return campi
}

// ── Le camere della prenotazione («CAMERA 1», «CAMERA 2») ───────────────────
// Una camera è una linea: di solito un periodo solo, ma dalla striscia può
// spezzarsi in più periodi (il cambio camera). Le linee stanno insieme con lo
// stesso `gruppo`, come già fa l'inserimento di adesso.
export type LineaCamera = {
  gruppo: string
  periodi: PeriodoComposto[]
}
export function raggruppaPerCamera(periodi: PeriodoComposto[]): LineaCamera[] {
  const linee = new Map<string, PeriodoComposto[]>()
  for (const p of periodi) {
    if (!linee.has(p.gruppo)) linee.set(p.gruppo, [])
    linee.get(p.gruppo)!.push(p)
  }
  return [...linee.entries()].map(([gruppo, ps]) => ({ gruppo, periodi: [...ps].sort((a, z) => a.checkIn.localeCompare(z.checkIn)) }))
}

/** I dati della linea come si vedono nei campi: date, camera, ospiti, tariffa */
export type DatiLinea = { arrivo: string; partenza: string; roomId: string | null; ospiti: number; tariffa: number | null; spezzata: boolean }
export function datiLinea(linea: LineaCamera): DatiLinea {
  const ps = linea.periodi
  if (ps.length === 0) return { arrivo: '', partenza: '', roomId: null, ospiti: 1, tariffa: null, spezzata: false }
  return {
    arrivo: ps[0].checkIn,
    partenza: ps.reduce((m, p) => (p.checkOut > m ? p.checkOut : m), ps[0].checkOut),
    // la camera della linea: la prima davvero scelta, anche se le prime notti
    // sono rimaste senza (nessuna camera libera in quelle notti)
    roomId: ps.find(p => p.roomId)?.roomId ?? null,
    ospiti: Math.max(...ps.map(p => p.ospiti)),
    tariffa: ps.filter(p => p.roomId).length === 1 ? (ps.find(p => p.roomId)?.tariffa ?? null) : null,
    spezzata: ps.length > 1,
  }
}

/** «5 notti» sotto le date */
export function nottiDellaLinea(linea: LineaCamera): number {
  const giorni = new Set<string>()
  for (const p of linea.periodi) for (const g of giorniSoggiorno(p.checkIn, p.checkOut)) giorni.add(g)
  return giorni.size
}

// ── Il letto in più: prezzo unico per tutta la prenotazione ────────────────
export const CRITERI_LETTO: { chiave: 'notte' | 'ogni4' | 'totale'; etichetta: string }[] = [
  { chiave: 'notte', etichetta: 'a notte' },
  { chiave: 'ogni4', etichetta: 'ogni 4 notti' },
  { chiave: 'totale', etichetta: 'totale' },
]
/** «di listino · Lena compreso · Amelia 5 €» — il promemoria accanto al campo.
 *  Il prezzo è quello che le regole applicano DAVVERO per gli ospiti scelti:
 *  in Lena a tre il posto è già dentro il prezzo, e si scrive «compreso». */
export const LETTO_COMPRESO_LISTINO = 'compreso'
export function listinoLetto(righe: { nome: string; importo: number }[]): string {
  if (righe.length === 0) return ''
  const pezzi = righe.map(r => `${r.nome} ${r.importo > 0 ? `${r.importo} €` : LETTO_COMPRESO_LISTINO}`)
  return `di listino · ${pezzi.join(' · ')}`
}

// ── Dalla striscia ai periodi ───────────────────────────────────────────────
// Le notti attaccate con la stessa camera tornano a essere un periodo solo;
// tariffa e accordo del letto restano quelli del periodo da cui vengono.
export function periodiDaNotti(notti: NotteStriscia[], linea: LineaCamera, nuovoId: () => string): PeriodoComposto[] {
  const blocchi = blocchiDaNotti(notti)
  const vecchi = [...linea.periodi].sort((a, z) => a.checkIn.localeCompare(z.checkIn))
  return blocchi.map(b => {
    // il periodo che copriva quelle notti: da lì vengono tariffa e letto
    const origine = vecchi.find(p => p.checkIn <= b.check_in && b.check_in < p.checkOut) ?? vecchi[0]
    const stessaCamera = origine && origine.roomId === b.cameraId
    return {
      id: origine && stessaCamera && origine.checkIn === b.check_in ? origine.id : nuovoId(),
      gruppo: linea.gruppo,
      roomId: b.cameraId,
      checkIn: b.check_in,
      checkOut: b.check_out,
      ospiti: Math.max(b.ospiti, 1),
      nottiLetto: b.nottiLetto,
      letto: origine?.letto ?? null,
      tariffa: stessaCamera ? (origine?.tariffa ?? null) : null,
    }
  })
}

// ── Le righe da salvare, col letto ripartito ────────────────────────────────
// Il letto è UNO per tutta la prenotazione: il conto lo mostra una volta
// (costoLettoIntero) e lo riparte fra i tratti. Le righe salvate devono dire
// la stessa cosa: prima ogni tratto salvava il letto per intero — «30 € in
// tutto» su due tratti facevano 60 salvati contro 30 mostrati (rilievo del
// 16/09/2026). La ripartizione è lettoRipartito, la stessa della striscia
// della scheda; la convenzione delle colonne resta quella di sempre
// (price_per_night = notte più economica, extra_bed_total = tutto il resto).
export function righeDaSalvare(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => CameraComposta | null,
  groupIdDi: (p: PeriodoComposto) => string,
): ReturnType<typeof rigaDaSalvare>[] {
  const fette = lettoRipartito(accordoLetto(periodi, camera), periodi.map(p => p.nottiLetto.length))
  return periodi.map((p, i) => {
    const c = camera(p.roomId) as CameraComposta
    const riga = rigaDaSalvare(p, c, groupIdDi(p))
    const conto = contoPeriodo(p, c)
    if (!conto) return riga
    const cameraTotale = round2(conto.totale - conto.lettoTotale)
    const soloCamera = round2(cameraTotale - conto.prezzoNotte * nottiPeriodo(p))   // le differenze fra notti
    return { ...riga, extra_bed_total: round2(soloCamera + fette[i]), total_amount: round2(cameraTotale + fette[i]) }
  })
}

// ── Quanto vale davvero ogni riga, sconto compreso ──────────────────────────
// `total_amount` è il totale di QUELLA camera: con uno sconto sulla
// prenotazione va scritto già scontato, altrimenti il conto della scheda
// (che somma i total_amount) mostrerebbe il prezzo pieno. La lettura riga per
// riga (lib/conto) non cambia: con uno sconto valido ricalcola dal prezzo a
// notte e il totale salvato non viene nemmeno guardato.
export function totaliScontati(totali: number[], sconto: ScontoNuova): number[] {
  const pienoCent = totali.reduce((s, t) => s + Math.round(t * 100), 0)
  const toltoCent = scontoInCentesimi(pienoCent, sconto)
  if (toltoCent <= 0 || pienoCent <= 0) return totali.map(t => round2(t))
  // l'ultimo prende il resto, così la somma torna al centesimo
  let restaDaTogliere = toltoCent
  return totali.map((t, i) => {
    const cent = Math.round(t * 100)
    const quota = i === totali.length - 1 ? restaDaTogliere : Math.round(toltoCent * cent / pienoCent)
    restaDaTogliere -= quota
    return round2(Math.max(0, cent - quota) / 100)
  })
}
