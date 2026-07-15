// Tipologia delle camere, mostrata SOLO nelle comunicazioni al cliente (WhatsApp).
// Nel gestionale (calendario, liste, dettaglio) le camere restano con il solo nome breve.
// Nota: la tabella `rooms` su Supabase non ha una colonna tipologia (i vecchi nomi
// "Amelia Singola" ecc. sono stati accorciati a giugno 2026); per aggiungerla servirebbe
// l'editor SQL del pannello Supabase. Con 4 camere fisse questa mappa è sufficiente.
export const ROOM_TYPE_BY_NAME: Record<string, string> = {
  Amelia: 'Singola',
  Allegra: 'Matrimoniale',
  Ambra: 'Matrimoniale',
  Lena: 'Tripla',
}

// "Amelia" -> "Amelia – Singola"; se la tipologia non è nota restituisce solo il nome.
export function roomWithType(name: string | null | undefined): string {
  if (!name) return ''
  const tip = ROOM_TYPE_BY_NAME[name]
  return tip ? `${name} – ${tip}` : name
}

// Slug della pagina della camera su casaaniarozzano.it (/camere/<slug>)
export const ROOM_SLUG_BY_NAME: Record<string, string> = {
  Amelia: 'singola',
  Allegra: 'allegra',
  Ambra: 'ambra',
  Lena: 'lena',
}
