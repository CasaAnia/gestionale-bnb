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
import { MESI_BREVI } from './dateItaliane.ts'
import { AUTISTI, nomeLuogo, orarioIgnoto, periodoInStruttura, periodoOre, type Arrivo } from './arrivo.ts'
import { TINTE_SCHEDA, TESTO_NOTA, schiarisci, type TintaScheda } from './calendarioMobile.ts'

// ── Le misure ──────────────────────────────────────────────────────────────
/** Corsia di una camera e scheda (riferimento: .rb2 .row 92, .card 72, top 9) */
export const CORSIA_H = 92
export const SCHEDA_H = 72
export const SCHEDA_TOP = 9
/** Le misure del nastro in un punto solo (30/09/2026, «Sì, completa così» di Ania):
 *  · normale — corsia 92, scheda 72 (Mac, telefono dritto, tutte le viste);
 *  · compatta — telefono in ORIZZONTALE a «Sett.»: corsie 56, schede 44 su due
 *    righe (riferimento S7 di docs/design/settimana-checklist.md). La scheda da
 *    44 è già l'area di tocco minima; il resto dei dettagli sta nel foglietto;
 *  · arriviSett — gli Arrivi a «Sett.» col telefono dritto: la riga dell'arrivo
 *    va a capo (fino a tre righe) e si legge anche su UNA notte (145 px), quindi
 *    scheda e corsia più alte solo lì. */
export type MisureNastro = { corsia: number; scheda: number; sopra: number; compatta: boolean }
export const MISURE_NASTRO = {
  normale: { corsia: CORSIA_H, scheda: SCHEDA_H, sopra: SCHEDA_TOP, compatta: false },
  compatta: { corsia: 56, scheda: 44, sopra: 6, compatta: true },
  arriviSett: { corsia: 108, scheda: 90, sopra: 9, compatta: false },
} as const satisfies Record<string, MisureNastro>
export function misureNastro(p: { modo: string; orizzontale: boolean; arrivi?: boolean }): MisureNastro {
  if (p.modo !== 'settimana') return MISURE_NASTRO.normale
  if (p.orizzontale) return MISURE_NASTRO.compatta
  return p.arrivi ? MISURE_NASTRO.arriviSett : MISURE_NASTRO.normale
}
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

/**
 * Il filo rosso del letto extra (29/09/2026): solo sotto le notti col letto,
 * un tratto per ogni gruppo di notti di fila. `notti` = le date iso delle notti
 * col letto (nottiLettoExtra: extra_bed_dates, o tutte se c'è il vecchio
 * extra_bed senza date); `indice` = la colonna di una data nel nastro; la scheda
 * va dalla colonna `da` (inclusa) ad `a` (esclusa). Tratti in px dal bordo
 * sinistro della scheda, tagliati alla scheda.
 */
export function trattiLetto(notti: Iterable<string>, indice: (iso: string) => number, da: number, a: number, giorno: number): { left: number; width: number }[] {
  const colonne = [...new Set([...notti].map(indice))].filter(i => i >= da && i < a).sort((x, y) => x - y)
  const scheda = geometriaScheda(da, a, giorno)
  const tratti: { left: number; width: number }[] = []
  for (let k = 0; k < colonne.length; k++) {
    let fine = k
    while (fine + 1 < colonne.length && colonne[fine + 1] === colonne[fine] + 1) fine++
    const sx = Math.max(0, colonne[k] * giorno - scheda.left)
    const dx = Math.min(scheda.width, (colonne[fine] + 1) * giorno - scheda.left)
    if (dx > sx) tratti.push({ left: sx, width: dx - sx })
    k = fine
  }
  return tratti
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

/**
 * Il fondo di una scheda pagata in parte (come prima delle schede): verde
 * fin dove arrivano gli acconti (`px` dal bordo sinistro), poi il suo colore.
 */
export function fondoConAcconti(verde: string, resto: string, px: number): string {
  if (px <= 0) return resto
  return `linear-gradient(to right, ${verde} 0 ${Math.round(px)}px, ${resto} ${Math.round(px)}px)`
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
 * I buchi liberi di una camera che cadono fra `inizio` e `fine` (fine
 * esclusa): fra una scheda e l'altra, prima della prima e dopo l'ultima.
 * `occupati` sono TUTTE le prenotazioni della camera, anche fuori vista: così
 * il buco dice le sue date vere («3 → 4 ott»), anche quando comincia prima di
 * `inizio`. Solo prima della prima prenotazione di sempre e dopo l'ultima il
 * buco si ferma a `inizio` / `fine`. Le schede che si sovrappongono (un
 * errore) contano come una sola.
 */
export function buchiLiberi(occupati: Intervallo[], inizio: string, fine: string): Intervallo[] {
  const uniti: Intervallo[] = []
  for (const o of occupati.filter(o => o.da < o.a).sort((x, y) => x.da.localeCompare(y.da))) {
    const ultimo = uniti[uniti.length - 1]
    if (ultimo && o.da <= ultimo.a) { if (o.a > ultimo.a) ultimo.a = o.a } else uniti.push({ ...o })
  }
  const buchi: Intervallo[] = []
  if (uniti.length === 0) return inizio < fine ? [{ da: inizio, a: fine }] : []
  if (uniti[0].da > inizio) buchi.push({ da: inizio, a: uniti[0].da })
  for (let i = 0; i + 1 < uniti.length; i++) buchi.push({ da: uniti[i].a, a: uniti[i + 1].da })
  if (uniti[uniti.length - 1].a < fine) buchi.push({ da: uniti[uniti.length - 1].a, a: fine })
  return buchi.filter(h => h.da < h.a && h.a > inizio && h.da < fine)
}

/** La riga del buco: «3 → 4 ott»; con l'anno quando il buco è lungo (più di sei mesi) */
export function rigaBuco(b: Intervallo): string {
  if (notti(b.da, b.a) <= 180) return periodoConMese(b.da, b.a)
  const [a1, m1, g1] = b.da.split('-').map(Number), [a2, m2, g2] = b.a.split('-').map(Number)
  return `${g1} ${MESI_BREVI[m1 - 1]} ${a1} → ${g2} ${MESI_BREVI[m2 - 1]} ${a2}`
}

/**
 * L'arrivo della nuova prenotazione dal tocco su un buco (Ania, 29/09/2026):
 * il GIORNO TOCCATO, non l'inizio del buco. `x` è la distanza del tocco dal
 * primo giorno disegnato (in px, dalle coordinate del tocco: niente
 * scrollLeft), `giorno` la larghezza di una colonna, `inizio` il primo giorno
 * disegnato. Se il giorno cade fuori dal buco vale il più vicino dentro.
 */
export function arrivoToccatoNelBuco(x: number, giorno: number, inizio: string, buco: Intervallo): string {
  const passo = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
  const toccato = passo(inizio, Math.floor(Math.max(0, x) / giorno))
  const ultimo = passo(buco.a, -1)
  return toccato < buco.da ? buco.da : toccato > ultimo ? ultimo : toccato
}

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
