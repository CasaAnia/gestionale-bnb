// Le due direzioni grafiche dell'anteprima (Fase 3A). Stessa struttura e
// stessi dati: cambia SOLO il linguaggio visivo.
//
//  A) "Calda editoriale"    — vicina all'identità Casa Ania: crema, verde
//     profondo, terracotta, oro misurato, numeri in serif, angoli morbidi.
//  B) "Contemporanea essenziale" — pulita e finanziaria: fondo neutro,
//     righe sottili al posto delle scatole, tutto sans, angoli più asciutti.

export type Tema = {
  id: 'calda' | 'essenziale' | 'mista'
  nome: string
  fondo: string
  carta: string          // superfici principali
  velo: string           // superfici secondarie (chip, sfondi tenui)
  inchiostro: string
  sub: string            // testo secondario
  verde: string          // primario
  verdeTenue: string     // sfondo del primario
  salvia: string
  terracotta: string     // importi in uscita / avvisi caldi
  terraTenue: string
  oro: string            // accento raro
  oroTenue: string
  rosso: string
  giallo: string
  gialloTenue: string
  bordo: string
  r: string              // raggio card
  rPill: string
  display: string        // classe per i numeri/titoli importanti
  ombra: string
  bordoCarta: string     // '1px solid …' oppure 'none'
}

export const CALDA: Tema = {
  id: 'calda',
  nome: 'Calda editoriale',
  fondo: '#F7F2E9',
  carta: '#FFFDF8',
  velo: '#EFE6D6',
  inchiostro: '#26332B',
  sub: '#7C776B',
  verde: '#1F4B38',
  verdeTenue: '#E3EAE2',
  salvia: '#8FA68E',
  terracotta: '#B4552D',
  terraTenue: '#F4E3D8',
  oro: '#A97F2F',
  oroTenue: '#F1E7CE',
  rosso: '#9C2F22',
  giallo: '#8A6410',
  gialloTenue: '#F6ECD2',
  bordo: '#E7DECB',
  r: '1.25rem',
  rPill: '999px',
  display: '[font-family:var(--font-fraunces)] font-medium',
  ombra: '0 1px 2px rgba(64,52,28,.06), 0 6px 18px rgba(64,52,28,.05)',
  bordoCarta: 'none',
}

export const ESSENZIALE: Tema = {
  id: 'essenziale',
  nome: 'Contemporanea essenziale',
  fondo: '#F6F6F3',
  carta: '#FFFFFF',
  velo: '#EEEFEA',
  inchiostro: '#141E19',
  sub: '#6C7570',
  verde: '#0E5940',
  verdeTenue: '#E5EFEA',
  salvia: '#7E9187',
  terracotta: '#B24E31',
  terraTenue: '#F5E7E1',
  oro: '#977B2E',
  oroTenue: '#F0EAD6',
  rosso: '#A32A1D',
  giallo: '#7E5D0E',
  gialloTenue: '#F5EDD3',
  bordo: '#E4E6E0',
  r: '0.75rem',
  rPill: '0.5rem',
  display: 'font-sans font-extrabold tracking-tight tabular-nums',
  ombra: '0 1px 1px rgba(20,30,25,.04)',
  bordoCarta: '1px solid #E4E6E0',
}

// C) "Mista" — l'impianto pulito della B (bordi sottili, poca ombra, ordine)
//    con il calore della A (crema, verde profondo, terracotta, oro e i
//    numeri importanti in Fraunces).
export const MISTA: Tema = {
  id: 'mista',
  nome: 'Mista',
  fondo: '#FAF6EE',
  carta: '#FFFFFF',
  velo: '#F0EADC',
  inchiostro: '#22302A',
  sub: '#75766B',
  verde: '#1F4B38',
  verdeTenue: '#E4EBE3',
  salvia: '#8FA68E',
  terracotta: '#B4552D',
  terraTenue: '#F4E4D9',
  oro: '#A97F2F',
  oroTenue: '#F2E8D0',
  rosso: '#9C2F22',
  giallo: '#856012',
  gialloTenue: '#F6EDD4',
  bordo: '#E8E1D0',
  r: '0.9rem',
  rPill: '999px',
  display: '[font-family:var(--font-fraunces)] font-medium',
  ombra: '0 1px 2px rgba(50,45,25,.05)',
  bordoCarta: '1px solid #E8E1D0',
}
