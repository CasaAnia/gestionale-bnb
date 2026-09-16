// ============================================================================
// «AGGIUNGI PAGAMENTO» nella scheda nuova (16/09/2026) — la logica pura del
// foglio: quanto proporre nel campo, come leggere l'importo scritto, cosa
// resterà da incassare dopo, e l'avviso quando si va oltre il dovuto.
// Niente Supabase: il salvataggio sta in lib/pagamentiDati, col contratto di
// sempre (lib/statistiche/pagato).
// ============================================================================
import { euroScheda } from './schedaPrenotazione.ts'

export const TITOLO_PAGAMENTO = 'Aggiungi pagamento'
export const SALVA_PAGAMENTO = 'Salva il pagamento'
export const ETICHETTA_QUANTO = 'Quanto · €'
export const ETICHETTA_QUANDO = 'Quando'
export const ETICHETTA_COME = 'Come'
export const ETICHETTA_NOTA = 'Nota · può restare vuota'
export const ERRORE_IMPORTO = 'Scrivi quanto ha pagato: un importo sopra lo zero.'
export const ERRORE_GIORNO = 'Scegli il giorno del pagamento.'
export const CONTO_SALDATO_DOPO = 'Dopo questo pagamento il conto è saldato.'

// Due modi soltanto, come li vuole Ania nel foglio: la colonna `method` di
// payments accetta anche «carta» e «altro», che restano leggibili in lettura.
export const MODI_PAGAMENTO = [
  { chiave: 'contanti', testo: 'Contanti' },
  { chiave: 'bonifico', testo: 'Bonifico' },
] as const
export type ModoPagamento = typeof MODI_PAGAMENTO[number]['chiave']

/** Il modo proposto: bonifico se l'accordo aspetta un bonifico, altrimenti contanti */
export const modoProposto = (bonifico: boolean | null | undefined): ModoPagamento => (bonifico ? 'bonifico' : 'contanti')

/** Nel campo «Quanto» è già scritto quello che manca: «250», oppure «62.50»
 *  (il campo è numerico, col punto). Vuoto se non manca niente. */
export function importoProposto(mancaCent: number): string {
  const c = Math.max(0, Math.round(Number.isFinite(mancaCent) ? mancaCent : 0))
  if (c === 0) return ''
  return c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2)
}

/** Dal testo del campo ai centesimi: «62,50» e «62.50» → 6250. null se non è
 *  un importo sopra lo zero. */
export function importoInCent(testo: string): number | null {
  const n = Number(String(testo ?? '').replace(',', '.').trim())
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

/** La riga in ottone sotto i campi: quanto resterà da incassare dopo questo
 *  pagamento. Vuota finché l'importo non è leggibile. */
export function restaDopo(mancaCent: number, importoCent: number | null): string {
  if (importoCent == null) return ''
  const resta = Math.round(mancaCent) - importoCent
  if (resta <= 0) return CONTO_SALDATO_DOPO
  return `Dopo questo pagamento restano da incassare ${euroScheda(resta)}.`
}

/** L'avviso in mattone: l'importo supera quello che manca. Si può salvare lo
 *  stesso (Ania, 16/09/2026): qui si avvisa e basta. */
export function oltreIlDovuto(mancaCent: number, importoCent: number | null): string | null {
  if (importoCent == null) return null
  const manca = Math.max(0, Math.round(mancaCent))
  if (importoCent <= manca) return null
  if (manca === 0) return 'Il conto è già saldato: questo pagamento va oltre il dovuto. Si può salvare lo stesso.'
  return `Sono ${euroScheda(importoCent - manca)} più di quello che manca. Si può salvare lo stesso.`
}
