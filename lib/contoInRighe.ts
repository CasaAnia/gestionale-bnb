// ============================================================================
// IL CONTO IN RIGHE (18/09/2026): le stesse parole dappertutto — inserimento,
// scheda e foglio «Il soggiorno si allunga» — così un conto si legge sempre
// allo stesso modo (Ania, 18/09/2026):
//   - una riga per ogni camera, col dettaglio piccolo sotto
//     («Allegra» · «29 → 30 nov · 1 notte × 80 €» · 80 €);
//   - il letto in più in UNA riga sola, con tutte le notti in cui c'è
//     («3 notti × 10 €»), non una per camera;
//   - «Totale», cioè quanto costa senza sconto;
//   - lo sconto in UNA riga sola, con l'importo intero senza centesimi:
//     «Sconto 10 %» in percentuale, «Sconto» se nasce da un prezzo concordato;
//   - «Da pagare» in grande, e sotto «3 notti · 85 € a notte».
// Lo sconto resta ripartito riga per riga dove serve ai conti (lib/conto):
// qui si decide solo come si SCRIVE, una volta sola. Funzioni pure.
// ============================================================================
import { euroScheda, testoNotti } from './schedaPrenotazione.ts'
import { euroTondi } from './euroTondi.ts'

export type RigaContoVista = { chiave: string; titolo: string; dettaglio: string; importo: string }
export type ScontoVista = { testo: string; importo: string }

export const RIGA_LETTO = 'Letto in più'
export const RIGA_TOTALE = 'Totale'
export const RIGA_SCONTO = 'Sconto'
export const RIGA_DA_PAGARE = 'Da pagare'

/** «10 %», «12,5 %» */
export const percentoInParole = (p: number) => `${String(p).replace('.', ',')} %`

/** «Sconto 10 %» quando è in percentuale, «Sconto» quando nasce da un prezzo concordato */
export function etichettaSconto(percento: number | null): string {
  return percento !== null && percento > 0 && percento < 100 ? `${RIGA_SCONTO} ${percentoInParole(percento)}` : RIGA_SCONTO
}

/** L'importo dello sconto, intero senza centesimi: «−185 €» */
export const importoSconto = (cent: number) => `−${euroTondi(cent)}`

/** La riga dello sconto, o niente se non c'è */
export function rigaSconto(cent: number, percento: number | null): ScontoVista | null {
  return cent > 0 ? { testo: etichettaSconto(percento), importo: importoSconto(cent) } : null
}

/** La percentuale se TUTTE le righe attive la portano, uguale; altrimenti null */
export function percentualeComune(righe: { status?: string | null; discount_type?: string | null; discount_value?: number | string | null }[]): number | null {
  const vive = righe.filter(r => r.status !== 'annullata')
  if (vive.length === 0 || vive.some(r => r.discount_type !== 'percentage')) return null
  const valori = new Set(vive.map(r => Number(r.discount_value)))
  const [v] = [...valori]
  return valori.size === 1 && v > 0 && v < 100 ? v : null
}

/** «3 notti · 85 € a notte»; vuoto senza notti */
export function nottiANotte(notti: number, daPagareCent: number): string {
  if (notti <= 0) return ''
  return `${testoNotti(notti)} · ${euroScheda(Math.round(daPagareCent / notti))} a notte`
}

/** «3 notti × 10 €» se l'importo a notte è uno solo e torna col totale,
 *  altrimenti solo «3 notti» */
export function dettaglioLetto(notti: number, lettoCent: number, unitariCent: number[]): string {
  const unitari = new Set(unitariCent.filter(u => u > 0))
  const [u] = [...unitari]
  return unitari.size === 1 && u * notti === lettoCent ? `${testoNotti(notti)} × ${euroScheda(u)}` : testoNotti(notti)
}
