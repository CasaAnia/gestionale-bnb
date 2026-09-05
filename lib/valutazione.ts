// ============================================================================
// VALUTAZIONE DEL CLIENTE E «VUOLE RICEVUTA» (08/09/2026, sera): prima erano
// quattro voci dello stesso campo (Ottimo / Normale / Problematico / Vuole
// ricevuta) e si escludevano a vicenda. Ora la valutazione resta a tre voci e
// «Vuole ricevuta» è un interruttore a sé (guests.vuole_ricevuta, proposta
// 0038). Prima della 0038 il gestionale legge e scrive la forma vecchia
// (rating = 'vuole_ricevuta'), così la scheda funziona come oggi.
// ============================================================================

export type Valutazione = 'ottimo' | 'normale' | 'problematico'
export const VALUTAZIONI: { chiave: Valutazione; label: string }[] = [
  { chiave: 'ottimo', label: '⭐ Ottimo' },
  { chiave: 'normale', label: '👤 Normale' },
  { chiave: 'problematico', label: '⚠️ Problematico' },
]
export const ETICHETTA_VALUTAZIONE: Record<Valutazione, string> = { ottimo: '⭐ Ottimo', normale: '👤 Normale', problematico: '⚠️ Problematico' }
export const COLORE_VALUTAZIONE: Record<Valutazione, string> = { ottimo: 'bg-sage text-green-dark', problematico: 'bg-[#F6E4DE] text-[#8C3B2E]', normale: 'bg-gray-100 text-gray-600' }
export const ETICHETTA_RICEVUTA = '🧾 Vuole ricevuta'
export const ETICHETTA_RICEVUTA_BREVE = 'Ricevuta'   // chip accanto al nome (come «Già stato da noi»)
export const BADGE_RICEVUTA = 'R'                    // sulle barre del calendario e degli Arrivi, come ⇄
export const VALORE_VECCHIO_RICEVUTA = 'vuole_ricevuta'

export type ClienteValutato = { rating?: string | null; vuole_ricevuta?: boolean | null } | null | undefined

// La colonna nuova esiste sulla riga letta? (dopo la 0038)
export const colonnaRicevutaPresente = (g: ClienteValutato): boolean => !!g && 'vuole_ricevuta' in g

// Valutazione a tre voci: la vecchia «vuole_ricevuta» vale «normale»
export function valutazioneDi(g: ClienteValutato): Valutazione {
  const r = g?.rating
  return r === 'ottimo' || r === 'problematico' ? r : 'normale'
}

// Vuole la ricevuta? Vale sia la colonna nuova sia la vecchia voce della valutazione
export function vuoleRicevuta(g: ClienteValutato): boolean {
  return !!g && (g.vuole_ricevuta === true || g.rating === VALORE_VECCHIO_RICEVUTA)
}

// Migrazione (stessa regola della bozza 0038): chi aveva «Vuole ricevuta»
// passa a ricevuta = sì e valutazione «normale»; gli altri restano com'erano
export function migraValutazione(g: { rating?: string | null; vuole_ricevuta?: boolean | null }): { rating: Valutazione; vuole_ricevuta: boolean } {
  if (g.rating === VALORE_VECCHIO_RICEVUTA) return { rating: 'normale', vuole_ricevuta: true }
  return { rating: valutazioneDi(g), vuole_ricevuta: g.vuole_ricevuta === true }
}

// Cosa scrivere sul cliente. Dopo la 0038: le due colonne. Prima: la forma
// vecchia (rating = 'vuole_ricevuta' quando la ricevuta è sì, altrimenti la
// valutazione), così nulla si blocca e nulla si perde.
export function payloadValutazione(valutazione: Valutazione, ricevuta: boolean, colonnaNuova: boolean): { rating: string; vuole_ricevuta?: boolean } {
  if (colonnaNuova) return { rating: valutazione, vuole_ricevuta: ricevuta }
  return { rating: ricevuta ? VALORE_VECCHIO_RICEVUTA : valutazione }
}
