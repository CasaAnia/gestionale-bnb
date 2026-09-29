// ============================================================================
// CALENDARIO SUL TELEFONO (07/09/2026, pezzo 4) — parte pura, senza React.
//  · Legenda: le voci (colore + testo) usate sia in fondo alla pagina dal Mac
//    sia nel pannello «?» sul telefono; niente voce «Cambio camera» (Ania,
//    04/09/2026).
//  · Area di tocco: le barre sono alte 32 px (riga 44 − 6·2); sul telefono
//    ogni barra ha sopra un'area invisibile alta ALMENO 44 px.
//  · Posizione da riprendere: tornando dalla scheda prenotazione la griglia
//    riapre lo stesso giorno (e quindi lo stesso mese) di prima; si salva
//    quando si apre una scheda, si legge una volta sola al rientro
//    (sessionStorage: dura quanto la scheda del browser).
// ============================================================================
// Colori delle barre (gli stessi di sempre: blu prenotazione, viola bonifico in attesa, verde pagato).
// Dal 29/09/2026 sono il FILO a sinistra delle schede «Maison».
export const COLOR_PRENOTAZIONE = '#7D9DB0'
export const COLOR_BONIFICO = '#9B8EC4'
export const COLOR_PAGATO = '#6C9A7C'

// ── I COLORI DELLE SCHEDE, IN UN PUNTO SOLO (riferimento del 29/09/2026) ──
// Fondo di colore medio, filo pieno 4 px a sinistra (e sul taglio obliquo del
// cambio camera), testo nel tono scuro della tinta. Ania potrebbe volerli più
// intensi: basta cambiare questi valori, la pagina e la legenda li leggono da qui.
export type TintaScheda = { fondo: string; filo: string; testo: string }
export const TINTE_SCHEDA = {
  prenotazione: { fondo: '#C5D6E2', filo: COLOR_PRENOTAZIONE, testo: '#2B4A5E' },
  bonifico: { fondo: '#D3CCE8', filo: COLOR_BONIFICO, testo: '#4A3F78' },
  pagato: { fondo: '#BFDCC8', filo: COLOR_PAGATO, testo: '#1F3D2F' },
  dalSito: { fondo: '#EAF3EE', filo: '#2D6A4F', testo: '#2D6A4F' },
  tenuta: { fondo: '#E8D6AE', filo: '#A8894F', testo: '#6E5116' },
  esclusiva: { fondo: '#F9CFA6', filo: '#f97316', testo: '#7A3E10' },
} as const satisfies Record<string, TintaScheda>
/** Gli altri colori di «Nota e colore»: il filo è il colore scelto, il fondo
 *  lo stesso schiarito verso il bianco di questa parte (come le tinte sopra) */
export const SCHIARITURA_NOTA = 0.62
export const TESTO_NOTA = '#241F1A'
/** Il letto extra: filo 3 px in fondo alla scheda e celle piene della riga «🛏 extra» */
export const ROSSO_LETTO = '#D0261B'
export const ROSSO_LETTO_TESTO = '#8A1E15'
export const ROSA_LETTO = '#F8D9D6'
/** La riga di oggi (filo verticale e giorno nel righello) */
export const VERDE_OGGI = '#2D6A4F'
/** I buchi liberi */
export const BUCO = { bordo: '#D5CCBB', testo: '#A89E8C', piu: '#C9BFA8' } as const
/** PROVA del 29/09/2026 (ritocchi «Maison», punto A3): i riquadri tratteggiati
 *  dei buchi liberi («2 → 5 ott · +») nel Calendario e negli Arrivi. Con
 *  `false` la corsia vuota resta vuota e il tocco su un giorno libero apre lo
 *  stesso la nuova prenotazione con camera e giorno; per tornare ai riquadri
 *  basta rimettere `true`. */
export const BUCHI_LIBERI_VISIBILI: boolean = false
/** La pillola della riga del periodo sul telefono (punto A2): «2 sett.» al
 *  posto di «2 settimane», perché il periodo a sinistra stia più grande. Dal
 *  Mac resta «2 settimane». */
export const VOCI_GRIGLIA_TELEFONO = [['mese', 'Mese'], ['quindici', '2 sett.']] as const
/** L'ottone scuro della riga dell'arrivo */
export const OTTONE_SCURO = '#7a5f2c'

/** «#f97316» → lo stesso colore schiarito verso il bianco di `quanto` (0–1) */
export function schiarisci(hex: string, quanto = SCHIARITURA_NOTA): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return hex
  const n = parseInt(m[1], 16)
  const canali = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(c + (255 - c) * quanto))
  return `#${canali.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`
}

export type VoceLegenda = { testo: string; colore: string; tratteggiata?: boolean; attenuata?: boolean }
export const VOCI_LEGENDA: VoceLegenda[] = [
  { testo: 'Prenotazione', colore: COLOR_PRENOTAZIONE },
  { testo: 'Bonifico in attesa', colore: COLOR_BONIFICO },
  { testo: 'Pagato', colore: COLOR_PAGATO },
  { testo: 'Dal sito, da confermare', colore: 'white', tratteggiata: true },
  { testo: 'Camera tenuta in opzione (3 ore)', colore: TINTE_SCHEDA.tenuta.filo },
  { testo: 'Letto extra in questa prenotazione (filo rosso sotto la scheda)', colore: ROSSO_LETTO },
  { testo: 'Letti extra finiti quella notte (riga «🛏 extra» rossa, 2/2)', colore: ROSSO_LETTO },
  { testo: '🔒 Esclusiva e altri colori scelti in «Nota e colore»', colore: TINTE_SCHEDA.esclusiva.filo },
]
/** La riga delle icone sotto la legenda */
export const ICONE_LEGENDA = 'Icone, prima del nome: ⭐ ottimo · 🧾 ricevuta · 🛏 letto in più · ⇄ cambio camera · 🌐 dal sito · 🔒 esclusiva'

// ── GLI ARRIVI (riferimento approvato da Ania il 29/09/2026: docs/design/arrivi-riferimento.html) ──
// Stesso nastro del Calendario; il colore della scheda dice lo STATO DELL'ARRIVO
// e non il pagamento. Fondi e fili sono quelli delle tinte qui sopra (verde del
// pagato, ottone della tenuta, blu della prenotazione): cambiandoli lì cambiano
// anche qui. Il testo è l'inchiostro; la riga dell'arrivo va in blu scuro sulle
// schede blu e in mattone, col «?», quando manca l'orario.
export const INCHIOSTRO = '#241F1A'
export const MATTONE = '#8C3B2E'
export const TINTE_ARRIVO = {
  ok: { fondo: TINTE_SCHEDA.pagato.fondo, filo: TINTE_SCHEDA.pagato.filo, testo: INCHIOSTRO },
  autonomo: { fondo: TINTE_SCHEDA.tenuta.fondo, filo: TINTE_SCHEDA.tenuta.filo, testo: INCHIOSTRO },
  manca: { fondo: TINTE_SCHEDA.prenotazione.fondo, filo: TINTE_SCHEDA.prenotazione.filo, testo: INCHIOSTRO },
  dalSito: TINTE_SCHEDA.dalSito,
} as const satisfies Record<string, TintaScheda>
/** La riga dell'arrivo sulle schede blu che hanno l'orario (manca la navetta) */
export const RIGA_NAVETTA_MANCA = TINTE_SCHEDA.prenotazione.testo
/** L'arrivo già avvenuto: la scheda attenuata */
export const OPACITA_ARRIVATA = 0.5

export const VOCI_LEGENDA_ARRIVI: VoceLegenda[] = [
  { testo: 'Verde · tutto a posto: orario in struttura e navetta con autista', colore: TINTE_ARRIVO.ok.filo },
  { testo: 'Ottone · arrivo autonomo con orario: nessuna navetta da organizzare', colore: TINTE_ARRIVO.autonomo.filo },
  { testo: 'Blu · manca qualcosa: l’autista da assegnare o da definire, oppure l’orario da chiedere («?» in mattone), o tutt’e due', colore: TINTE_ARRIVO.manca.filo },
  { testo: 'Dal sito, da confermare', colore: 'white', tratteggiata: true },
  { testo: 'Arrivo già avvenuto (giorni prima di oggi): scheda attenuata, con «· arrivata» nella prima riga', colore: TINTE_ARRIVO.ok.filo, attenuata: true },
]
export const ICONE_LEGENDA_ARRIVI = 'Sulla scheda: orario grande (o «?»), icone e nome, poi luogo · mezzo · navetta con autista e prelievo. Icone: 🔒 esclusiva · ⭐ ottimo · 🧾 ricevuta · 🛏 letto in più · ⇄ cambio camera · 🌐 dal sito'

// Larghezza del giorno sul telefono dritto (come oggi): 60 px a «2 settimane», 40 a «Mese»
export const GIORNO_TELEFONO = { quindici: 60, mese: 40 } as const
export const colonnaMinTelefono = (modo: 'quindici' | 'mese') => GIORNO_TELEFONO[modo]
// Frecce ‹ ›: a «2 settimane» UNA settimana (novità del 29/09/2026), a «Mese» il 1° del mese
export const PASSO_FRECCE_QUINDICI = 7
export const etichettaFreccia = (modo: 'quindici' | 'mese', verso: -1 | 1) =>
  modo === 'quindici' ? (verso === -1 ? 'Una settimana prima' : 'Una settimana dopo') : (verso === -1 ? 'Mese precedente' : 'Mese successivo')

// Altezza minima dell'area di tocco (Apple: 44 pt). La barra resta com'è;
// l'area la include e sporge sopra e sotto in parti uguali.
export const TOCCO_MIN = 44
export function areaTocco(barraTop: number, barraAltezza: number, minimo = TOCCO_MIN): { top: number; height: number } {
  const altezza = Math.max(minimo, barraAltezza)
  return { top: barraTop - (altezza - barraAltezza) / 2, height: altezza }
}

// Posizione salvata: solo il giorno ISO della prima colonna in vista
export const CHIAVE_POSIZIONE = 'ca_calendario_posizione'
export function codificaPosizione(giornoIso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(giornoIso) ? giornoIso : ''
}
// Dal testo salvato all'indice di colonna dentro `giorni` (null se il testo
// non è una data o il giorno non è disegnato)
export function indicePosizione(testo: string | null | undefined, giorni: string[]): number | null {
  const g = codificaPosizione((testo ?? '').trim())
  if (!g) return null
  const i = giorni.indexOf(g)
  return i >= 0 ? i : null
}
