export const LENA_ID = '19ae4611-c0a4-42ae-8530-210f9a948e9e'

type PrenotazioneConLetto = {
  room_id?: string | null
  num_guests?: number | string | null
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
}

// Quanti letti del pool comune occupa una prenotazione. Questa è la stessa
// regola usata quando si crea una prenotazione e quando il calendario colora
// la disponibilità: Lena con 4 ospiti esaurisce da sola entrambi i letti.
export function lettiPoolPrenotazione(booking: PrenotazioneConLetto): 0 | 1 | 2 {
  const usaLetto = !!booking.extra_bed || (booking.extra_bed_dates?.length ?? 0) > 0
  if (!usaLetto) return 0
  return booking.room_id === LENA_ID && Number(booking.num_guests) >= 4 ? 2 : 1
}
