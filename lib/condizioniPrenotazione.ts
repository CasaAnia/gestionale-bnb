// Costanti delle condizioni di prenotazione (pezzo 6 delle Richieste).
// UNICA fonte per: ore di risposta alla proposta, ore di riserva della camera
// in attesa del bonifico, preavviso di cancellazione, caparra di default.
// La regola di cancellazione NON va nel primo messaggio: servirà nel
// riepilogo che precede il bonifico (pezzo futuro).

export type CondizionePagamento = 'arrivo' | 'caparra' | 'completo' | 'personalizzata'

export const CONDIZIONI_PAGAMENTO: CondizionePagamento[] = ['arrivo', 'caparra', 'completo', 'personalizzata']

export const ETICHETTA_CONDIZIONE: Record<CondizionePagamento, string> = {
  arrivo: "All'arrivo",
  caparra: 'Caparra',
  completo: 'Pagamento completo',
  personalizzata: 'Personalizzata',
}

// Il cliente ha 3 ore per rispondere alla proposta (casi A–C; nel caso E nessun limite)
export const ORE_RISPOSTA_PROPOSTA = 3
// Dopo la risposta la camera resta riservata 24 ore in attesa del bonifico (caparra o completo)
export const ORE_RISERVA_BONIFICO = 24
// Caparra confirmatoria di default: 50% dell'importo complessivo
export const CAPARRA_PERCENTO_DEFAULT = 50
// Preavviso minimo per cancellare o spostare le date, contato dall'orario previsto di arrivo
export const GIORNI_PREAVVISO_CANCELLAZIONE = 7

export const REGOLA_CANCELLAZIONE = {
  preavvisoSufficiente: `Con almeno ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni di preavviso rispetto all'orario previsto di arrivo: restituzione integrale.`,
  caparraTrattenuta: `Con meno di ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni di preavviso, oppure in caso di mancato arrivo: la caparra confirmatoria viene trattenuta e non può essere trasferita a un soggiorno successivo.`,
  completoNessunaPromessa: `Per il pagamento completo anticipato, con meno di ${GIORNI_PREAVVISO_CANCELLAZIONE} giorni di preavviso non c'è alcuna restituzione promessa in automatico: decide Ania caso per caso.`,
}

export type EsitoCancellazione =
  | 'nulla_da_restituire'      // pagamento all'arrivo: non è stato versato nulla
  | 'restituzione_integrale'   // preavviso sufficiente
  | 'caparra_trattenuta'       // caparra con preavviso insufficiente o mancato arrivo
  | 'nessuna_promessa'         // pagamento completo tardivo o condizione personalizzata

// Caparra di default in centesimi (50% del totale, arrotondata al centesimo)
export function caparraDefault(totaleCentesimi: number): number {
  return Math.round(totaleCentesimi * CAPARRA_PERCENTO_DEFAULT / 100)
}

// Il preavviso è sufficiente se fra l'istante della richiesta di cancellazione e
// l'orario previsto di arrivo passano ALMENO 7 giorni interi (7 giorni esatti = sufficiente).
export function preavvisoSufficiente(arrivoPrevisto: Date, adesso: Date): boolean {
  return arrivoPrevisto.getTime() - adesso.getTime() >= GIORNI_PREAVVISO_CANCELLAZIONE * 86400000
}

export function esitoCancellazione(condizione: CondizionePagamento, arrivoPrevisto: Date, adesso: Date): EsitoCancellazione {
  if (condizione === 'arrivo') return 'nulla_da_restituire'
  if (condizione === 'personalizzata') return 'nessuna_promessa'
  if (preavvisoSufficiente(arrivoPrevisto, adesso)) return 'restituzione_integrale'
  return condizione === 'caparra' ? 'caparra_trattenuta' : 'nessuna_promessa'
}
