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
    const { error } = await supabase.from('push_log').insert({ tipo, titolo, corpo, dettaglio, inviate })
    // Parte 3 (05/09/2026): l'esito si legge e si scrive nel log del server
    // (Vercel), ma non ferma nulla: il registro è un aiuto per capire a
    // posteriori, la notifica è già partita.
    if (error) console.warn(`[push_log] registrazione non riuscita (${tipo}): ${error.message ?? 'errore sconosciuto'}`)
  } catch (e) {
    // Catch VOLUTAMENTE senza rilancio: qui può arrivare solo un'eccezione di
    // rete o un client malformato. La notifica è già stata inviata e questa
    // funzione gira in un cron senza nessuno davanti allo schermo: fallire
    // qui farebbe rispondere «errore» a un invio riuscito. L'esito resta
    // visibile nei log del server.
    console.warn(`[push_log] registrazione non riuscita (${tipo}): ${(e as Error)?.message ?? String(e)}`)
  }
}
