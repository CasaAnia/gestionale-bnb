// ============================================================================
// «AGGIUNGI PAGAMENTO» nella scheda nuova (16/09/2026) — la logica pura del
// foglio: quanto proporre nel campo, come leggere l'importo scritto, cosa
// resterà da incassare dopo, e l'avviso quando si va oltre il dovuto.
// Niente Supabase: il salvataggio sta in lib/pagamentiDati, col contratto di
// sempre (lib/statistiche/pagato).
// ============================================================================
import { euroScheda } from './schedaPrenotazione.ts'
import { MESI_BREVI } from './dateItaliane.ts'

export const TITOLO_PAGAMENTO = 'Aggiungi pagamento'
export const SALVA_PAGAMENTO = 'Salva il pagamento'
export const ETICHETTA_QUANTO = 'Quanto · €'
export const ETICHETTA_QUANDO = 'Quando'
export const ETICHETTA_COME = 'Come'
export const ETICHETTA_NOTA = 'Nota · può restare vuota'
export const ERRORE_IMPORTO = 'Scrivi quanto ha pagato: un importo sopra lo zero.'
export const ERRORE_GIORNO = 'Scegli il giorno del pagamento.'

// ── Il foglio approvato da Ania il 20/09/2026 (punto 5, colonna DOPO) ──────
// In cima «Resta da incassare» con la cifra del conto autorevole; poi due
// tasti, «Saldo completo» (il campo è già scritto con tutto il residuo e non
// si tocca) e «Altro importo» (si scrive quanto si è davvero ricevuto); in
// fondo «Dopo il pagamento resta» con la cifra prevista e la frase sull'esito.
export const RESTA_DA_INCASSARE = 'Resta da incassare'
export const MODO_SALDO = 'Saldo completo'
export const MODO_ALTRO = 'Altro importo'
export const GRUPPO_MODI = 'Tipo di pagamento'
export const SPIEGA_SALDO = 'Saldo dell’intero importo residuo.'
export const SPIEGA_ALTRO = 'Scrivi quanto hai effettivamente ricevuto.'
export const DOPO_IL_PAGAMENTO_RESTA = 'Dopo il pagamento resta'
export const RESIDUO_SCONOSCIUTO = '—'
export const ESITO_SALDATO = 'Il conto sarà saldato.'
export const ESITO_PARTE = 'Il pagamento coprirà una parte del saldo.'
export const ESITO_MANCA_IMPORTO = 'Inserisci l’importo ricevuto.'
export const NIENTE_DA_SALDARE = 'Non resta niente da incassare: si può registrare solo un altro importo.'
export const OLTRE_IL_TOTALE_FOGLIO = (cent: number) => `${euroScheda(cent)} ricevuti oltre il totale: controlla i pagamenti.`
export const CONTO_CAMBIATO = (residuoCent: number) =>
  `Il conto è cambiato mentre il foglio era aperto: ora resta da incassare ${euroScheda(Math.max(0, residuoCent))}. Controlla l’importo e salva di nuovo.`

export type ModoImporto = 'saldo' | 'altro'

/** All'apertura: «Saldo completo» se resta qualcosa da incassare, altrimenti
 *  «Altro importo» (con niente da saldare il tasto del saldo è spento). */
export const modoIniziale = (residuoCent: number): ModoImporto => (Math.round(residuoCent) > 0 ? 'saldo' : 'altro')

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
 *  un importo sopra lo zero, o se ha più di due decimali (mai arrotondare
 *  di nascosto quello che si è scritto), o se non è un numero semplice. */
export function importoInCent(testo: string): number | null {
  const t = String(testo ?? '').trim()
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(t)) return null
  const n = Number(t.replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.round(n * 100)
}

/** La riga «Dopo il pagamento resta» e la frase sull'esito. Senza un importo
 *  leggibile la cifra è «—» e si chiede l'importo; con l'importo si fa il
 *  conto in centesimi: 1.080 − 400 = 680 → «una parte del saldo»; uguale al
 *  residuo → 0 € e «Il conto sarà saldato.»; oltre il residuo → 0 € ma con
 *  l'avviso in mattone di `oltreIlDovuto` al posto della frase, così
 *  l'eccedenza non si nasconde dietro lo zero. */
export function residuoPrevisto(residuoCent: number, importoCent: number | null): { cifra: string; esito: string; oltre: string | null } {
  if (importoCent == null) return { cifra: RESIDUO_SCONOSCIUTO, esito: ESITO_MANCA_IMPORTO, oltre: null }
  const resta = Math.round(residuoCent) - importoCent
  const oltre = oltreIlDovuto(residuoCent, importoCent)
  if (resta <= 0) return { cifra: euroScheda(0), esito: oltre ? '' : ESITO_SALDATO, oltre }
  return { cifra: euroScheda(resta), esito: ESITO_PARTE, oltre: null }
}

/** Quanto è stato ricevuto sulle righe di QUESTA prenotazione, in centesimi,
 *  dai pagamenti riletti: serve a capire se il conto è cambiato mentre il
 *  foglio era aperto (un incasso da un altro telefono). */
export function ricevutiCentDi(ids: string[], pagamenti: { booking_id: string; amount: number | string }[]): number {
  const mie = new Set(ids)
  return pagamenti.filter(p => mie.has(p.booking_id)).reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0)
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

// ── «TOGLI PAGAMENTO» (17/09/2026) ──────────────────────────────────────────
// Il comando «togli» accanto a ogni pagamento apre un foglio di conferma che
// dice cosa si sta togliendo (importo, giorno, modo, nota) e quanto resterà
// da incassare senza. La cancellazione la fa lib/pagamentiDati.togliPagamento,
// con la stessa chiamata di «rimuovi» della scheda attuale.
export const TITOLO_TOGLI_PAGAMENTO = 'Togli pagamento'
export const TOGLI_PAGAMENTO = 'Togli il pagamento'
export const COMANDO_TOGLI = 'togli'
export const DOMANDA_TOGLI = 'Vuoi togliere questo pagamento?'
export const PAGAMENTO_TOLTO = 'Pagamento tolto.'
export const AVVISO_BOLLINO_NON_TOLTO = 'Pagamento tolto, ma il bollino «pagato» non si è aggiornato: ricarica la scheda.'

export type PagamentoDaTogliere = { id: string; amount: number | string; method?: string | null; paid_on?: string | null; note?: string | null }

const giornoEsteso = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const [a, m, g] = String(iso).slice(0, 10).split('-').map(Number)
  return Number.isFinite(g) && Number.isFinite(m) ? `${g} ${MESI_BREVI[m - 1]} ${a}` : ''
}
const modoInParole = (m: string | null | undefined): string => {
  const v = (m ?? '').trim()
  return v === 'bonifico' ? 'bonifico' : v === 'carta' ? 'carta' : v === 'altro' ? 'altro' : 'contanti'
}

/** Cosa si sta togliendo, in parole: «470 €», «12 set 2026 · contanti», la nota */
export function descrizionePagamento(p: PagamentoDaTogliere): { importo: string; quando: string; nota: string } {
  return {
    importo: euroScheda(Math.round(Number(p.amount || 0) * 100)),
    quando: [giornoEsteso(p.paid_on), modoInParole(p.method)].filter(Boolean).join(' · '),
    nota: (p.note ?? '').trim(),
  }
}

/** Quanto resterà da incassare senza questo pagamento (mai sotto zero) */
export function restaSenzaCent(totaleCent: number, ricevutiCent: number, importoCent: number): number {
  return Math.max(0, Math.round(totaleCent) - (Math.round(ricevutiCent) - Math.round(importoCent)))
}

/** La riga in ottone del foglio: «Senza questo pagamento restano da incassare 470 €.» */
export function restaSenza(totaleCent: number, ricevutiCent: number, importoCent: number): string {
  const resta = restaSenzaCent(totaleCent, ricevutiCent, importoCent)
  if (resta <= 0) return 'Senza questo pagamento il conto resta saldato.'
  return `Senza questo pagamento restano da incassare ${euroScheda(resta)}.`
}

/** Il bollino «pagato» va tolto: la prenotazione è segnata pagata ma senza
 *  questo pagamento resterebbe qualcosa da incassare. */
export function bollinoDaTogliere(pagato: boolean, totaleCent: number, ricevutiCent: number, importoCent: number): boolean {
  return pagato && restaSenzaCent(totaleCent, ricevutiCent, importoCent) > 0
}
