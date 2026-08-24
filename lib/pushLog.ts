// Registro delle notifiche inviate (tabella push_log, migrazione 0018).
//
// Nato dall'audit del 24/08/2026: i due pop-up anomali del 23 agosto hanno
// richiesto un'indagine perché non restava traccia di cosa fosse partito e
// perché. Da ora ogni invio salva titolo, corpo e i dati usati nel calcolo.
//
// Tollerante: se la tabella non esiste ancora (migrazione da incollare a
// mano nell'editor SQL di Supabase) l'invio funziona comunque e il registro
// resta semplicemente vuoto.
export async function registraPush(
  supabase: any,
  tipo: string,
  titolo: string,
  corpo: string,
  dettaglio: unknown,
  inviate: number
) {
  try {
    await supabase.from('push_log').insert({ tipo, titolo, corpo, dettaglio, inviate })
  } catch {
    // tabella assente o errore di rete: non deve mai bloccare la notifica
  }
}
