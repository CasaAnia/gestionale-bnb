// Navetta (colonna bookings.shuttle, migrazione 0019).
//
// Tre stati, decisi con Ania il 24/08/2026:
//   null / ''  = Da definire (valore iniziale: manca un'informazione da
//                chiedere all'ospite — va resa riconoscibile)
//   'si'       = arriva con la navetta (badge ben visibile)
//   'no'       = arriva per conto suo (discreto)
//
// Un solo dato sulla prenotazione: modulo prenotazione, pagina Arrivi e
// notifiche leggono e scrivono tutti la stessa colonna.
export type Navetta = 'si' | 'no' | null | undefined

// Testo per pannelli e popup: "15:30 · 🚌 Navetta" / "No navetta" / "Navetta da definire"
export function testoNavetta(s: Navetta): string {
  return s === 'si' ? '🚌 Navetta' : s === 'no' ? 'No navetta' : 'Navetta da definire'
}

// Suffisso della riga arrivi nella notifica delle 16: ben visibile per il
// "sì", esplicito per il "da definire", niente per il "no" (discreto).
// Se la colonna non esiste ancora (migrazione 0019 non applicata) il campo
// è undefined e non si aggiunge nulla: niente rumore prima della migrazione.
export function suffissoNavettaNotifica(b: any): string {
  if (!('shuttle' in (b || {}))) return ''
  return b.shuttle === 'si' ? ' · 🚌 navetta' : b.shuttle === 'no' ? '' : ' · navetta da definire'
}

// Cosa manca a un arrivo di domani, per il promemoria delle 17.
// Parte se manca almeno una delle due informazioni operative (regola di
// Ania): orario di arrivo e/o stato navetta. null = non manca nulla.
export function cosaManca(b: any): string | null {
  const mancaOrario = !b?.check_in_time
  // Colonna assente = migrazione non applicata: la navetta non conta ancora
  const mancaNavetta = 'shuttle' in (b || {}) && (b.shuttle === null || b.shuttle === undefined || b.shuttle === '')
  if (mancaOrario && mancaNavetta) return 'mancano orario e navetta'
  if (mancaOrario) return 'manca orario'
  if (mancaNavetta) return 'navetta da definire'
  return null
}
