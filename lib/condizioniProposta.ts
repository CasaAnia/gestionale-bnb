// ============================================================================
// QUANDO SI PUÒ SCEGLIERE «COME PAGA» (11/09/2026, difetto trovato da Ania
// dal telefono). Funzione pura, così la regola si prova e non torna indietro.
//
// Il difetto: i quattro bottoni (All'arrivo, Caparra, Pagamento completo,
// Personalizzata) erano disegnati solo quando la pagina era «modificabile»,
// cioè NÉ in attesa della risposta a «L'hai inviata?» NÉ a proposta inviata.
// Tornando da WhatsApp l'attesa resta (vive nel browser anche dopo che l'app
// si ricarica): «Come paga» si riduceva a una riga sola e non si poteva più
// cambiare nulla.
//
// Regola di Ania: i quattro bottoni ci sono SEMPRE.
//  · 'scegliere'    si toccano e il messaggio si rifà subito. Vale anche
//                   mentre si aspetta la risposta a «L'hai inviata?»: toccare
//                   una condizione lì vuol dire che la proposta va cambiata,
//                   quindi si torna a comporre, come con «No».
//  · 'solo_lettura' proposta già inviata: si vede cosa è partito, ma quel
//                   messaggio non si riscrive. Per cambiarlo si ricompone con
//                   «Invia di nuovo».
//  · 'nascoste'     messaggio «non c'è posto»: non parla di pagamento.
// ============================================================================

export type StatoCondizioni = 'scegliere' | 'solo_lettura' | 'nascoste'

export function statoCondizioni({ completo, inviata }: { completo: boolean; inviata: boolean }): StatoCondizioni {
  if (completo) return 'nascoste'
  if (inviata) return 'solo_lettura'
  return 'scegliere'
}
