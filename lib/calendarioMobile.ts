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
import { COLORE_LETTO_PARZIALE, COLORE_LETTI_ESAURITI } from './calendarioLetti.ts'

// Colori delle barre (gli stessi di sempre: blu prenotazione, viola bonifico in attesa, verde pagato)
export const COLOR_PRENOTAZIONE = '#7D9DB0'
export const COLOR_BONIFICO = '#9B8EC4'
export const COLOR_PAGATO = '#6C9A7C'

export type VoceLegenda = { testo: string; colore: string; tratteggiata?: boolean }
export const VOCI_LEGENDA: VoceLegenda[] = [
  { testo: 'Prenotazione', colore: COLOR_PRENOTAZIONE },
  { testo: 'Bonifico attesa', colore: COLOR_BONIFICO },
  { testo: 'Pagato', colore: COLOR_PAGATO },
  { testo: '1 letto extra occupato', colore: COLORE_LETTO_PARZIALE },
  { testo: '2 letti extra occupati', colore: COLORE_LETTI_ESAURITI },
  { testo: 'Dal sito (da confermare)', colore: 'white', tratteggiata: true },
]

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
