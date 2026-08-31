// ============================================================================
// CAMPI IMPORTO della revisione (Fase 4, blocco 3 — correzioni) — regole
// DISTINTE per i tre tipi di campo, coi VERI gestori usati dal componente:
//  · 'totale'         obbligatorio, > 0; campo SVUOTATO → il totale diventa
//                     null nello stato e la quadratura BLOCCA («totale del
//                     documento mancante»): mai confermare un valore
//                     invisibile rimasto da prima;
//  · 'riga'           obbligatorio, > 0; svuotato o illeggibile → INVALIDO
//                     (blocca Salva e Conferma, il vecchio valore non passa);
//  · 'arrotondamento' facoltativo e CON SEGNO: '' e '0' valgono zero (e
//                     azzerano davvero il precedente), '-0,01' vale −1 cent;
//  · 'facoltativo'    positivo o assente: campo svuotato → null (per prezzo
//                     unitario e sconto delle voci).
// ============================================================================
import { importoDaTesto, testoDaImporto } from './scrittura.ts'

export type RegolaImporto = 'totale' | 'riga' | 'arrotondamento' | 'facoltativo'

export type EsitoCampo =
  | { tipo: 'valido'; cent: number | null }   // da applicare allo stato
  | { tipo: 'invalido'; perche: string }      // NON si applica: blocca

export function interpretaImporto(regola: RegolaImporto, testo: string): EsitoCampo {
  const s = testo.trim()
  if (regola === 'arrotondamento') {
    if (s === '' || /^[-+]?0(,0{1,2}|\.0{1,2})?$/.test(s)) return { tipo: 'valido', cent: 0 }
    const segno = s.startsWith('-') ? -1 : 1
    const n = importoDaTesto(s.replace(/^[-+]/, ''))
    if (n === null) return { tipo: 'invalido', perche: 'arrotondamento non leggibile (es. -0,01)' }
    return { tipo: 'valido', cent: segno * Math.round(n * 100) }
  }
  if (s === '') {
    if (regola === 'riga') return { tipo: 'invalido', perche: "l'importo della voce non può restare vuoto" }
    return { tipo: 'valido', cent: null }     // totale → «mancante» (blocca); facoltativo → assente
  }
  const n = importoDaTesto(s)
  if (n === null) return { tipo: 'invalido', perche: 'serve un numero sopra lo zero (massimo due decimali)' }
  return { tipo: 'valido', cent: Math.round(n * 100) }
}

// il testo mostrato quando l'utente non sta scrivendo: il segno si VEDE
// (−1 cent → "-0,01"), lo zero dell'arrotondamento resta campo vuoto
export function testoCampo(regola: RegolaImporto, cent: number | null): string {
  if (cent == null) return ''
  if (regola === 'arrotondamento')
    return cent === 0 ? '' : (cent < 0 ? '-' : '') + testoDaImporto(Math.abs(cent) / 100)
  return testoDaImporto(cent / 100)
}

// il VERO gestore del campo: interpreta e, SOLO se valido, applica allo
// stato. L'esito torna al componente per mostrare/bloccare.
export function gestoreImporto(regola: RegolaImporto, applica: (cent: number | null) => void) {
  return (testo: string): EsitoCampo => {
    const esito = interpretaImporto(regola, testo)
    if (esito.tipo === 'valido') applica(esito.cent)
    return esito
  }
}
