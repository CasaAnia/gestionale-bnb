// ============================================================================
// TEMA del nuovo modulo spese (Fase 3.1) — direzione B "Contemporanea
// essenziale", scelta da Ania il 28/08/2026 sull'anteprima della Fase 3A.
// Un solo tema, fisso: pulito e finanziario, fondo neutro, righe sottili,
// tutto sans, pochi colori. (Le varianti A e C restano solo in
// app/anteprima-spese come archivio.)
// ============================================================================

export const TEMA = {
  fondo: '#F6F6F3',
  carta: '#FFFFFF',
  velo: '#EEEFEA',        // superfici secondarie: chip, sfondi tenui
  inchiostro: '#141E19',
  sub: '#6C7570',         // testo secondario
  verde: '#0E5940',       // primario (Casa Mia)
  verdeTenue: '#E5EFEA',
  salvia: '#7E9187',
  terracotta: '#B24E31',  // Casa Ania / uscite importanti
  terraTenue: '#F5E7E1',
  oro: '#977B2E',
  oroTenue: '#F0EAD6',
  rosso: '#A32A1D',
  giallo: '#7E5D0E',      // avvisi "da controllare"
  gialloTenue: '#F5EDD3',
  bordo: '#E4E6E0',
  r: '0.75rem',           // raggio card
  rIcona: '0.6rem',
  rPill: '0.5rem',
  ombra: '0 1px 1px rgba(20,30,25,.04)',
  bordoCarta: '1px solid #E4E6E0',
} as const

// classe per numeri e titoli importanti (la B è tutta sans)
export const DISPLAY = 'font-sans font-extrabold tracking-tight tabular-nums'
