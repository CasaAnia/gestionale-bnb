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
import { camereLibere, type CameraMinima, type PrenotazioneMinima } from './disponibilita.ts'
import { contoPeriodo, notti as nottiPeriodo, round2, type CameraComposta, type PeriodoComposto } from './prenotazioneComposta.ts'
import type { NotteStriscia } from './strisciaNotti.ts'
import { blocchiDaNotti } from './strisciaNotti.ts'
import { GIORNI_LUNGHI, MESI_LUNGHI } from './dateItaliane.ts'
import { euroScheda } from './schedaPrenotazione.ts'

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
export type CameraScelta<T extends CameraMinima> = { camera: T; libera: boolean }
export function camereDelPeriodo<T extends CameraMinima>(
  camere: T[], altre: PrenotazioneMinima[], arrivo: string, partenza: string,
): CameraScelta<T>[] {
  if (!arrivo || !partenza || arrivo >= partenza) return camere.map(camera => ({ camera, libera: true }))
  const { libere } = camereLibere(camere, altre, arrivo, partenza, 1)
  const liberi = new Set(libere.map(c => c.id))
  return camere.map(camera => ({ camera, libera: liberi.has(camera.id) }))
}
export function rigaCamereLibere<T extends CameraMinima>(scelte: CameraScelta<T>[], arrivo: string, partenza: string): string {
  if (!arrivo || !partenza || arrivo >= partenza) return ''
  const libere = scelte.filter(s => s.libera).map(s => s.camera.name)
  if (libere.length === 0) return 'nessuna camera libera in queste date'
  if (libere.length === scelte.length) return 'tutte le camere libere'
  return `libere: ${libere.join(' · ')}`
}

// ── Quanti ospiti può tenere il soggiorno ───────────────────────────────────
// Il massimo del «+» è la capienza VERA della camera scelta, letto in più
// compreso dove è previsto (Ania, 14/09/2026): Lena arriva a 4, Allegra e
// Ambra a 3, Amelia a 2. Finché la camera non è scelta il numero non resta
// fermo a due: vale la più capiente fra quelle libere in quelle date, così
// gli ospiti si possono già scrivere e la camera si sceglie dopo.
export type CameraCapienza = { name?: string | null; has_extra_bed?: boolean | null }
export function ospitiMassimi<T extends CameraMinima>(
  camera: CameraCapienza | null | undefined,
  scelte: CameraScelta<T>[] = [],
): number {
  if (camera) return capienzaCamera(camera)
  const libere = scelte.filter(s => s.libera).map(s => capienzaCamera(s.camera))
  return libere.length > 0 ? Math.max(...libere) : capienzaBase(null)
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
  sconto: string | null
  daPagare: string | null
}

export type ScontoNuova = { tipo: 'nessuno' | 'percentuale' | 'finale'; valore: number | null }

const fmt = (cent: number) => euroScheda(cent)

export function contoNuovaPrenotazione(
  periodi: PeriodoComposto[],
  camera: (id: string | null) => CameraComposta | null,
  sconto: ScontoNuova,
): ContoNuova {
  const righe: RigaContoNuova[] = []
  let totale = 0
  let mancante = periodi.length === 0
  let lettoCent = 0
  const giorni = new Set<string>()
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
    lettoCent += Math.round(conto.lettoTotale * 100)
  }
  if (lettoCent > 0) {
    const quante = periodi.reduce((s, p) => s + p.nottiLetto.length, 0)
    righe.push({
      chiave: 'letto',
      titolo: 'Letto in più',
      dettaglio: `${quante} ${quante === 1 ? 'notte' : 'notti'}`,
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
    aNotte: n > 0 && daPagareCent !== null ? `${n} ${n === 1 ? 'notte' : 'notti'} · ${fmt(Math.round(daPagareCent / n))} a notte` : '',
    totale: totaleCent === null ? null : fmt(totaleCent),
    sconto: scontoCent > 0 ? fmt(scontoCent) : null,
    daPagare: daPagareCent === null ? null : fmt(daPagareCent),
  }
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

// ── «Con lei»: chi altro dorme qui ──────────────────────────────────────────
export const CHI_E_VOCI = ['Sorella', 'Mamma', 'Figlia', 'Marito', 'Amica']
export type PersonaConLei = { id: string; nome: string; chiE: string; telefono: string }
/** Le due colonne di bookings reggono due persone: la terza si dice, non si perde in silenzio */
export const PERSONE_CON_LEI_MAX = 2
export const TROPPE_PERSONE = 'Di persone in più se ne possono salvare due: la terza scrivila nella nota.'

export function campiConLei(persone: PersonaConLei[]): Record<string, unknown> {
  const campi: Record<string, unknown> = {}
  persone.slice(0, PERSONE_CON_LEI_MAX).forEach((p, i) => {
    const n = i + 1
    if (p.nome.trim()) campi[`extra_phone_${n}_name`] = p.nome.trim()
    if (p.telefono.trim()) campi[`extra_phone_${n}`] = p.telefono.replace(/\s/g, '')
    if (i === 0 && p.chiE.trim()) campi.chi_e = p.chiE.trim()
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
    roomId: ps[0].roomId,
    ospiti: Math.max(...ps.map(p => p.ospiti)),
    tariffa: ps.length === 1 ? ps[0].tariffa : null,
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
