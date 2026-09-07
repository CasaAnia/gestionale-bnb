// Nome dell'ospite di UNA prenotazione.
//
// Il numero di telefono identifica la scheda cliente (guests.phone è UNIQUE),
// ma il nominativo può cambiare da prenotazione a prenotazione: figlio che
// prenota per un genitore, coniugi con lo stesso numero, accompagnatore che
// prenota per il paziente. Per questo bookings.guest_name (colonna facoltativa,
// migrata a mano su Supabase) porta il nome scritto nella singola richiesta:
// se c'è vince lui, altrimenti vale il nome della scheda, poi il telefono.
// Le prenotazioni vecchie non hanno guest_name e continuano a mostrare la
// scheda, esattamente come prima.
export function nomeOspite(b: any): string {
  return b?.guest_name || b?.guests?.full_name || b?.guests?.phone || 'Ospite'
}

// Nome pronto per i messaggi al cliente: via i caratteri invisibili residui
// (es. U+FE0F di una vecchia emoji) e gli spazi doppi/iniziali. Oltre a sporcare
// il saluto ("Gentile ️Monda,"), quei caratteri rompono la sintassi *grassetto*
// di WhatsApp facendo comparire asterischi letterali. Pulisce il valore all'uso:
// i nomi salvati nel database non vengono toccati.
export function nomePerMessaggio(n: string | null | undefined): string {
  return (n || '').replace(/[\u200B-\u200D\uFE0F]/g, '').replace(/\s+/g, ' ').trim()
}

// Confronto insensibile a maiuscole, spazi doppi e codifiche Unicode diverse:
// "ROBERTO GRANATA" e "Roberto  Granata" sono la stessa persona.
export function normalizzaNome(n: string | null | undefined): string {
  return (n || '').normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ')
}

// true quando la prenotazione porta un nominativo diverso da quello della
// scheda cliente agganciata al telefono: fa scattare l'avviso rosso.
// Mai true sulle prenotazioni senza guest_name (quelle vecchie).
export function nomeDiverso(b: any): boolean {
  const questa = normalizzaNome(b?.guest_name)
  const scheda = normalizzaNome(b?.guests?.full_name)
  return questa !== '' && scheda !== '' && questa !== scheda
}

// Nominativi già associati allo stesso numero, diversi da quello di questa
// prenotazione: il nome della scheda più gli eventuali guest_name delle altre
// prenotazioni dello stesso cliente, deduplicati con la stessa normalizzazione.
export function nomiPrecedenti(b: any, altrePrenotazioni: any[] = []): string[] {
  const attuale = normalizzaNome(b?.guest_name)
  const visti = new Set<string>()
  const nomi: string[] = []
  const candidati = [b?.guests?.full_name, ...altrePrenotazioni.map(x => x?.guest_name)]
  for (const n of candidati) {
    const norm = normalizzaNome(n)
    if (norm === '' || norm === attuale || visti.has(norm)) continue
    visti.add(norm)
    nomi.push(String(n).trim())
  }
  return nomi
}

// ── Nome e cognome: UNICA funzione che li mette insieme ─────────────────────
// Ovunque il gestionale mostra un cliente lo scrive «Nome Cognome», mai
// «Cognome Nome»: lista e calendario delle Richieste, dettaglio, proposta,
// pannello, tooltip, push e Pushover, cambio cliente, confronto «già stato».
// Nome o cognome vuoti non lasciano spazi doppi. I dati salvati non cambiano:
// cambia solo l'ordine con cui entrano nei testi. La scheda cliente (guests)
// ha un campo unico, full_name, già scritto «Nome Cognome»: se non ci sono
// nome e cognome separati vale quello, ripulito dagli spazi.
// Regola fissa (Ania, 04 e 07/09/2026): nessun altro punto del codice deve
// concatenare nome e cognome da sé — lo controlla lib/ordineNomi.test.ts.
export function nomeCompleto(c: { nome?: string | null; cognome?: string | null; full_name?: string | null }): string {
  const pezzi = [c.nome, c.cognome].map(x => (x || '').trim()).filter(Boolean)
  const testo = pezzi.length ? pezzi.join(' ') : (c.full_name || '')
  return testo.replace(/\s+/g, ' ').trim()
}

// Versione corta per gli spazi stretti (barre del calendario): «Anna R.»,
// mai «Rossi A.». Senza cognome resta il nome, senza nome resta il cognome.
export function nomeBreve(c: { nome?: string | null; cognome?: string | null }): string {
  const nome = (c.nome || '').trim(), cognome = (c.cognome || '').trim()
  if (!cognome) return nome
  if (!nome) return cognome
  return `${nome} ${cognome[0]}.`
}
