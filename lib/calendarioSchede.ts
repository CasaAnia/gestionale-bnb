// ============================================================================
// LE SCHEDE DEL CALENDARIO «MAISON» (riferimento approvato da Ania il
// 29/09/2026: docs/design/calendario-riferimento.html) — la parte pura.
//
// Al posto delle barre sottili col solo nome, ogni prenotazione è una SCHEDA
// con quattro righe scritte sopra:
//   (a) «26 set → 1 ott · 3 notti»            (maiuscoletto)
//   (b) «⭐ 🧾 Marta Bellini»                  (icone PRIMA del nome)
//   (c) «2 ospiti · da incassare · 1 letto extra»
//   (d) «arriva 15:10 · autonomo»              (ottone scuro; manca sulle
//                                               richieste e sulle tenute)
// Il colore dice SOLO lo stato del pagamento (o il colore scelto in «Nota e
// colore»); il letto extra è un filo rosso in fondo alla scheda.
// Fra una scheda e l'altra i BUCHI LIBERI: riquadri tratteggiati col «+».
//
// Niente React, niente Supabase: qui si decide cosa scrivere e di che colore.
// I testi che il gestionale ha già (date, notti, arrivo, tenuta) si leggono
// dalle loro funzioni, non si riscrivono.
// ============================================================================
import { periodoConMese, testoNotti } from './schedaPrenotazione.ts'
import { AUTISTI, nomeLuogo, orarioIgnoto, periodoInStruttura, periodoOre, type Arrivo } from './arrivo.ts'
import { TINTE_SCHEDA, TESTO_NOTA, schiarisci, type TintaScheda } from './calendarioMobile.ts'

// ── Le misure ──────────────────────────────────────────────────────────────
/** Corsia di una camera e scheda (riferimento: .rb2 .row 92, .card 72, top 9) */
export const CORSIA_H = 92
export const SCHEDA_H = 72
export const SCHEDA_TOP = 9
/** L'aria ai lati di una scheda: 3 px per lato (larghezza = notti × giorno − 6) */
export const ARIA_SCHEDA = 3
/** Il taglio obliquo del cambio camera, come oggi */
export const TAGLIO_CAMBIO = 14
export const FILO_SINISTRO = 4
export const FILO_LETTO = 3

/** Dove sta una scheda nella corsia: dal giorno `da` (incluso) al giorno `a` (escluso) */
export function geometriaScheda(da: number, a: number, giorno: number): { left: number; width: number } {
  return { left: da * giorno + ARIA_SCHEDA, width: Math.max(0, (a - da) * giorno - ARIA_SCHEDA * 2) }
}

// ── Lo stato e il colore ───────────────────────────────────────────────────
export type StatoScheda = 'prenotazione' | 'bonifico' | 'pagato' | 'dalSito' | 'esclusiva' | 'colore'
export const COLORE_ESCLUSIVA = '#f97316'

export type DatiStato = {
  status?: string | null
  source?: string | null
  pagato?: boolean | null
  bonifico?: boolean | null
  color?: string | null
}
/** Richiesta arrivata dal sito, ancora da confermare (come oggi) */
export const daConfermareDalSito = (b: DatiStato) => b.status === 'in_attesa' && b.source === 'sito_web'

/**
 * Lo stato della scheda. `coperta` = gli acconti coprono tutte le sue notti
 * (la stessa lettura di oggi, lungo la catena del cambio camera). L'ordine è
 * quello di sempre: pagato, poi bonifico, poi il colore scelto, poi il blu.
 */
export function statoScheda(b: DatiStato, coperta = false): StatoScheda {
  if (daConfermareDalSito(b)) return 'dalSito'
  if (b.pagato || coperta) return 'pagato'
  if (b.bonifico) return 'bonifico'
  const c = (b.color ?? '').trim()
  if (c.toLowerCase() === COLORE_ESCLUSIVA) return 'esclusiva'
  if (c) return 'colore'
  return 'prenotazione'
}

/** Fondo, filo e testo della scheda */
export function tintaScheda(stato: StatoScheda, colore?: string | null): TintaScheda {
  if (stato === 'colore' && colore) return { fondo: schiarisci(colore), filo: colore, testo: TESTO_NOTA }
  if (stato === 'colore') return TINTE_SCHEDA.prenotazione
  return TINTE_SCHEDA[stato]
}

/** Lo stato in parole, riga (c) */
export function testoStato(stato: StatoScheda): string {
  if (stato === 'dalSito') return 'da confermare'
  if (stato === 'pagato') return 'pagato'
  if (stato === 'bonifico') return 'bonifico in attesa'
  return 'da incassare'
}

// ── Le quattro righe ───────────────────────────────────────────────────────
const notti = (a: string, z: string) => Math.max(0, Math.round((Date.parse(`${z}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000))

/** (a) «26 set → 1 ott · 3 notti», con «· dal sito 🌐» o «· in opzione» */
export function rigaDate(checkIn: string, checkOut: string, extra: 'dalSito' | 'opzione' | null = null): string {
  const base = `${periodoConMese(checkIn, checkOut)} · ${testoNotti(notti(checkIn, checkOut))}`
  return extra === 'dalSito' ? `${base} · dal sito 🌐` : extra === 'opzione' ? `${base} · in opzione` : base
}

/** (b) Le icone di oggi, nell'ordine 🔒 ⭐ 🧾 🛏 ⇄ (poi 🌐 del cliente arrivato dal sito) */
export function iconeScheda(s: { esclusiva?: boolean; ottimo?: boolean; ricevuta?: boolean; letto?: boolean; cambio?: boolean; dalSito?: boolean }): string {
  return [s.esclusiva && '🔒', s.ottimo && '⭐', s.ricevuta && '🧾', s.letto && '🛏', s.cambio && '⇄', s.dalSito && '🌐'].filter(Boolean).join(' ')
}

export const testoOspiti = (n: number) => (n === 1 ? '1 ospite' : `${n} ospiti`)
export const testoLetti = (n: number) => (n <= 0 ? '' : n === 1 ? '1 letto extra' : `${n} letti extra`)

/** (c) «2 ospiti · poi Lena · da incassare · 1 letto extra» */
export function rigaSotto(s: { ospiti: number; stato: string; letti?: number; poi?: string | null; da?: string | null }): string {
  return [
    testoOspiti(Math.max(1, s.ospiti || 1)),
    s.poi ? `poi ${s.poi}` : '',
    s.da ? `da ${s.da}` : '',
    s.stato,
    testoLetti(s.letti ?? 0),
  ].filter(Boolean).join(' · ')
}

export const ORARIO_DA_CHIEDERE = 'orario da chiedere'
export const CAMBIO_CAMERA = 'cambio camera'
export const AUTONOMO = 'autonomo'

/**
 * (d) L'arrivo in forma breve, dai dati di lib/arrivo (gli stessi della Home):
 * «arriva 15:10 · autonomo», «arriva 14:30 · Linate, Massimo»,
 * «orario da chiedere». L'ora è quella in struttura; con un luogo esterno e
 * senza la stima di Ania, quella al luogo.
 */
export function rigaArrivo(a: Arrivo): string {
  if (orarioIgnoto(a)) return ORARIO_DA_CHIEDERE
  const ora = periodoInStruttura(a) || (a.tipo === 'luogo' ? periodoOre(a.luogoDa, a.modoLuogo === 'fascia' ? a.luogoA : '') : '')
  const autista = AUTISTI.find(x => x.chiave === a.navetta)?.nome ?? null
  const navetta = autista ?? (a.navetta === 'da_assegnare' ? 'navetta' : a.navetta === 'non_richiesta' ? AUTONOMO : '')
  const dopo = [nomeLuogo(a), navetta].filter(Boolean).join(', ')
  return `arriva ${ora}${dopo ? ` · ${dopo}` : ''}`
}

export type RigheScheda = { date: string; icone: string; nome: string; sotto: string; arrivo: string | null }

// ── I buchi liberi ─────────────────────────────────────────────────────────
export type Intervallo = { da: string; a: string }   // da incluso, a escluso (date ISO)

/**
 * I giorni liberi di una camera fra `inizio` e `fine` (fine esclusa): i buchi
 * fra una scheda e l'altra, prima della prima e dopo l'ultima. Le schede che
 * si sovrappongono (un errore) contano come una sola.
 */
export function buchiLiberi(occupati: Intervallo[], inizio: string, fine: string): Intervallo[] {
  const ordinati = occupati
    .map(o => ({ da: o.da < inizio ? inizio : o.da, a: o.a > fine ? fine : o.a }))
    .filter(o => o.da < o.a)
    .sort((x, y) => x.da.localeCompare(y.da))
  const out: Intervallo[] = []
  let libero = inizio
  for (const o of ordinati) {
    if (o.da > libero) out.push({ da: libero, a: o.da })
    if (o.a > libero) libero = o.a
  }
  if (libero < fine) out.push({ da: libero, a: fine })
  return out
}

/** La riga del buco: «3 → 4 ott» */
export const rigaBuco = (b: Intervallo) => periodoConMese(b.da, b.a)

/** L'indirizzo della nuova prenotazione, lo stesso di oggi */
export const indirizzoNuova = (cameraId: string, arrivo: string) => `/nuova-prenotazione?room_id=${cameraId}&check_in=${arrivo}`

// ── Il cambio camera ───────────────────────────────────────────────────────
/**
 * Il filo obliquo lungo il taglio: stesso colore e stessa intensità del filo
 * sinistro, PROPRIO sul bordo tagliato. È un parallelogramma largo quanto il
 * filo sinistro, dall'angolo in alto all'angolo in basso del taglio.
 * `lato` = 'destra' per il tratto che parte, 'sinistra' per quello che arriva.
 */
export function filoObliquo(lato: 'destra' | 'sinistra', larghezza: number, altezza: number, taglio = TAGLIO_CAMBIO, filo = FILO_SINISTRO): string {
  // i quattro punti in pixel, dentro la scheda
  const pt = lato === 'destra'
    ? [[larghezza - filo, 0], [larghezza, 0], [larghezza - taglio, altezza], [larghezza - taglio - filo, altezza]]
    : [[0, 0], [filo, 0], [taglio + filo, altezza], [taglio, altezza]]
  return `polygon(${pt.map(([x, y]) => `${Math.round(x * 10) / 10}px ${y}px`).join(', ')})`
}
