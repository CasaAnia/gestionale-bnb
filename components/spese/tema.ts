// ============================================================================
// TEMA del nuovo modulo spese (Fase 3.1) — direzione B "Contemporanea
// essenziale", scelta da Ania il 28/08/2026 sull'anteprima della Fase 3A.
// Un solo tema, fisso: pulito e finanziario, fondo neutro, righe sottili,
// tutto sans, pochi colori. (Le varianti A e C restano solo in
// app/anteprima-spese come archivio.)
// ============================================================================

export const TEMA = {
  fondo: '#FBF9F4',       // crema del gestionale (stile editoriale, 06/09/2026)
  carta: '#FFFFFF',
  velo: '#F1EEE6',        // superfici secondarie: chip, sfondi tenui
  inchiostro: '#1F3D2F',  // verde scuro del gestionale
  sub: '#7C857A',         // testo secondario (pietra)
  verde: '#0E5940',       // primario (Casa Mia)
  verdeTenue: '#E5EFEA',
  salvia: '#7E9187',
  terracotta: '#B24E31',  // Casa Ania / uscite importanti
  terraTenue: '#F5E7E1',
  oro: '#A9884E',         // ottone: etichette di sezione
  oroTenue: '#F0EAD6',
  rosso: '#A32A1D',
  giallo: '#7E5D0E',      // avvisi "da controllare"
  gialloTenue: '#F5EDD3',
  bordo: '#E8E3D8',       // filo crema
  r: '0.75rem',           // raggio card
  rIcona: '0.6rem',
  rPill: '999px',         // pillole
  ombra: 'none',
  bordoCarta: '1px solid #E8E3D8',
} as const

// classe per numeri e titoli importanti (la B è tutta sans)
export const DISPLAY = 'font-sans font-extrabold tracking-tight tabular-nums'
