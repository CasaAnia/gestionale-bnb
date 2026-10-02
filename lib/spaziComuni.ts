// Spazi comuni sulla pagina Pulizie (riferimento approvato da Ania il
// 02/10/2026, pulizie-timer-riferimento.html, schermata 5): «Ferma e riporta i
// minuti» e «Salva» dei minuti a mano AGGIUNGONO i minuti a quelli già
// segnati oggi per quella voce (12 + 23 = 35). Il massimo resta quello del
// database: 1440 minuti in un giorno per voce.
export function aggiuntaSpazi(salvati: number | null, aggiunti: number): { totale: number; errore: string | null } {
  const totale = (salvati ?? 0) + aggiunti
  if (!Number.isInteger(aggiunti) || aggiunti < 0) return { totale: salvati ?? 0, errore: 'Scrivi i minuti, da 1 a 1440.' }
  if (totale > 1440) return { totale, errore: `Con questi minuti si superano i 1440 di un giorno (già segnati ${salvati ?? 0}): tocca «oggi … segnati» per correggere il totale.` }
  return { totale, errore: null }
}
