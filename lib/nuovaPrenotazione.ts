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

// ── Gli ospiti di una notte ─────────────────────────────────────────────────
// Il modello di sempre (lib/prezzoNotti): in una notte ci sono gli ospiti del
// soggiorno se c'è il letto in più, altrimenti quelli che la camera tiene da
// sola. Quindi i valori possibili di una notte sono DUE, e il − e il + del
// foglietto si muovono fra quelli: nessun numero che poi non si può salvare.
export function ospitiPossibiliNotte(camera: { name?: string | null; has_extra_bed?: boolean | null } | null | undefined, ospitiSoggiorno: number): number[] {
  const base = capienzaBase(camera)
  const max = Math.min(Math.max(ospitiSoggiorno, base), capienzaCamera(camera))
  return base === max ? [base] : [base, max]
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
