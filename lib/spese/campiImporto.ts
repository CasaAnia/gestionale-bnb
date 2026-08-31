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

// ---------------------------------------------------------------------------
// CAMPI NUMERICI delle voci, fedeli allo schema 0020 (mai NULL vietati):
//  · 'quantita'        numeric(10,3) NOT NULL > 0, default 1: fino a TRE
//                      decimali; campo svuotato → torna al default 1;
//  · 'prezzo_unitario' numeric(10,3) NULL o ≥ 0: tre decimali, vuoto = assente;
//  · 'sconto'          numeric(10,2) NOT NULL ≥ 0, default 0: due decimali,
//                      vuoto e «0» valgono zero.
// ---------------------------------------------------------------------------
export type RegolaNumero = 'quantita' | 'prezzo_unitario' | 'sconto'
export type RegolaCampo = RegolaImporto | RegolaNumero

export type EsitoNumero =
  | { tipo: 'valido'; valore: number | null }
  | { tipo: 'invalido'; perche: string }

const DECIMALI: Record<RegolaNumero, number> = { quantita: 3, prezzo_unitario: 3, sconto: 2 }

function numeroPositivo(testo: string, maxDec: number): number | null {
  const s = testo.trim().replace(',', '.')
  if (!new RegExp(`^\\d+(\\.\\d{1,${maxDec}})?$`).test(s)) return null
  const scala = 10 ** maxDec
  return Math.round(Number(s) * scala) / scala
}

export function interpretaNumero(regola: RegolaNumero, testo: string): EsitoNumero {
  const dec = DECIMALI[regola]
  if (testo.trim() === '') {
    // MAI un NULL vietato: quantità e sconto tornano ai default della 0020
    if (regola === 'quantita') return { tipo: 'valido', valore: 1 }
    if (regola === 'sconto') return { tipo: 'valido', valore: 0 }
    return { tipo: 'valido', valore: null }             // prezzo unitario assente
  }
  const n = numeroPositivo(testo, dec)
  if (n === null) return { tipo: 'invalido', perche: regola === 'quantita' ? `quantità non leggibile (numero, fino a ${dec} decimali)` : `numero non leggibile (fino a ${dec} decimali)` }
  if (regola === 'quantita' && n <= 0) return { tipo: 'invalido', perche: 'la quantità deve essere sopra lo zero' }
  return { tipo: 'valido', valore: n }
}

// 0.472 → "0,472" · 1 → "1" · null → ""
export function testoNumero(valore: number | null): string {
  if (valore == null) return ''
  return String(valore).replace('.', ',')
}

export function gestoreNumero(regola: RegolaNumero, applica: (valore: number | null) => void) {
  return (testo: string): EsitoNumero => {
    const esito = interpretaNumero(regola, testo)
    if (esito.tipo === 'valido') applica(esito.valore)
    return esito
  }
}

// per l'elenco dei campi invalidi: smista sul giusto interprete
export function interpretaCampo(regola: RegolaCampo, testo: string): { tipo: 'valido' | 'invalido'; perche?: string } {
  return regola === 'quantita' || regola === 'prezzo_unitario' || regola === 'sconto'
    ? interpretaNumero(regola, testo)
    : interpretaImporto(regola, testo)
}
