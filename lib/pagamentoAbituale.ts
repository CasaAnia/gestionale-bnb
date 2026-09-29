// ============================================================================
// COME PAGA DI SOLITO LA CLIENTE (ritocchi «Maison» del 29/09/2026, punto D1)
//
// Colonna nuova `guests.pagamento_abituale`: «contanti», «bonifico» o niente
// (proposta 0062, da applicare a mano). Ania la sceglie alla PRIMA
// prenotazione della cliente, in «Come paga» della Nuova prenotazione: se la
// cliente non ha ancora un valore, il modo scelto lì si salva su di lei, e da
// lì resta. NON si aggiorna da solo alle prenotazioni dopo: si cambia solo dal
// foglio «Dati della cliente».
//
// Dove serve un modo di pagamento (Aggiungi pagamento, «Come paga» della Nuova
// prenotazione e della scheda) la pastiglia già accesa è quella della
// cliente, e si può cambiare ogni volta. Cliente nuova o senza valore: come
// prima. Qui solo regole pure; la scrittura sta in lib/pagamentoAbitualeDati.
// ============================================================================
import { bonificoDelModo, type ComePaga } from './comePaga.ts'

export type PagamentoAbituale = 'contanti' | 'bonifico'
export const COLONNA_PAGAMENTO_ABITUALE = 'pagamento_abituale'
export const ETICHETTA_PAGA_DI_SOLITO = 'Paga di solito con'
export const VOCI_PAGAMENTO_ABITUALE: { chiave: PagamentoAbituale; testo: string }[] = [
  { chiave: 'contanti', testo: 'Contanti' },
  { chiave: 'bonifico', testo: 'Bonifico' },
]

/** Il valore salvato sulla cliente, se è uno dei due; altrimenti null */
export function pagamentoAbitualeDi(c: { pagamento_abituale?: string | null } | null | undefined): PagamentoAbituale | null {
  const v = (c?.pagamento_abituale ?? '').trim()
  return v === 'contanti' || v === 'bonifico' ? v : null
}

/** La colonna esiste sulla riga letta (select *): senza la 0062 non c'è */
export const colonnaPagamentoPresente = (c: object | null | undefined) => !!c && COLONNA_PAGAMENTO_ABITUALE in c

/** Da «Come paga» al mezzo: contanti → contanti; bonifico, tutto e le caparre → bonifico; «Da vedere» → niente */
export function pagamentoDaComePaga(modo: ComePaga): PagamentoAbituale | null {
  if (modo === 'contanti') return 'contanti'
  if (modo === 'da_vedere') return null
  return bonificoDelModo(modo) ? 'bonifico' : null
}

/** «Come paga» con la pastiglia della cliente già accesa; senza valore resta quello di prima */
export function comePagaIniziale(abituale: PagamentoAbituale | null, diPrima: ComePaga): ComePaga {
  return abituale ?? diPrima
}

/**
 * Alla prima prenotazione: il valore da scrivere sulla cliente, o null se non
 * c'è niente da scrivere (la cliente ha già un valore, o il modo scelto non
 * dice il mezzo). Non si aggiorna mai da solo: con un valore già salvato,
 * niente. Se la colonna non c'è ancora la scrittura non riesce e non blocca
 * (lib/pagamentoAbitualeDi): la cliente appena creata la colonna non la
 * legge, ma è proprio la sua prima prenotazione.
 */
export function daSalvareAllaPrima(cliente: { pagamento_abituale?: string | null } | null | undefined, modo: ComePaga): PagamentoAbituale | null {
  if (pagamentoAbitualeDi(cliente)) return null
  return pagamentoDaComePaga(modo)
}

/** «Come paga» della scheda: se la prenotazione non dice niente («Da vedere»:
 *  niente accordo salvato), la pastiglia accesa è quella della cliente; un
 *  come paga già scelto per questa prenotazione resta quello */
export function comePagaSchedaConAbituale(salvato: ComePaga, abituale: PagamentoAbituale | null): ComePaga {
  return salvato === 'da_vedere' ? comePagaIniziale(abituale, salvato) : salvato
}

/** Il mezzo già acceso in «Aggiungi pagamento»: quello della cliente, se c'è */
export function metodoIniziale(abituale: PagamentoAbituale | null, diPrima: PagamentoAbituale): PagamentoAbituale {
  return abituale ?? diPrima
}

/** Nella testata della scheda cliente: «paga in contanti» / «paga con bonifico» */
export function testoPagamentoAbituale(abituale: PagamentoAbituale | null): string | null {
  if (abituale === 'contanti') return 'paga in contanti'
  if (abituale === 'bonifico') return 'paga con bonifico'
  return null
}
