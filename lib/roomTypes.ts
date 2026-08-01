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

// Numero-monogramma della camera (ordine fisso Amelia→Lena), mostrato in ottone accanto al nome
export const ROOM_NUMBER_BY_NAME: Record<string, string> = {
  Amelia: '01',
  Allegra: '02',
  Ambra: '03',
  Lena: '04',
}

// Descrizione breve sotto il nome camera (tipologia · bagno)
export const ROOM_DESC_BY_NAME: Record<string, string> = {
  Amelia: 'singola · bagno in camera',
  Allegra: 'matrimoniale · bagno in camera',
  Ambra: 'matrimoniale · bagno in camera',
  Lena: 'tripla · bagno privato esterno',
}

// Lena è una TRIPLA: quando è prenotata per 3 ospiti il terzo letto fa parte della
// camera, non è un extra. Nelle comunicazioni al cliente le due voci vanno perciò unite
// in una riga sola col prezzo tutto compreso (es. "Lena – Tripla, 90 €/notte"), mai
// "80 € + letto supplementare 10 €".
// L'unione avviene solo se il letto copre TUTTE le notti del soggiorno: se ne copre solo
// alcune resta una voce separata, altrimenti il prezzo a notte risulterebbe sbagliato.
export function lettoInclusoNellaCamera(seg: any, nottiTot: number): boolean {
  if (seg?.rooms?.name !== 'Lena') return false
  if (Number(seg?.num_guests) !== 3) return false
  if (!seg?.extra_bed || Number(seg?.extra_bed_total || 0) <= 0) return false
  const ebNotti = seg?.extra_bed_dates?.length > 0 ? seg.extra_bed_dates.length : nottiTot
  return ebNotti === nottiTot
}

// Slug della pagina della camera su casaaniarozzano.it (/camere/<slug>)
export const ROOM_SLUG_BY_NAME: Record<string, string> = {
  Amelia: 'singola',
  Allegra: 'allegra',
  Ambra: 'ambra',
  Lena: 'lena',
}
