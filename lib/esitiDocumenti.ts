// Esiti dei documenti arrivati DOPO un cambio di cliente (D1, Ania 21/10/2026).
//
// Un caricamento (o un'eliminazione) parte sulla scheda della persona X e
// resta su X anche se nel frattempo si apre la scheda di Y: il destinatario
// non cambia mai. Quando la risposta arriva, la pagina di Y non deve
// mostrarla come sua (niente documento di X nella griglia di Y), ma l'esito
// va detto: lo si mette qui, con il nome di X scritto per esteso, e lo mostra
// la prossima pagina dei documenti aperta (anche quella di Y, come avviso a
// parte). Funzioni pure più un piccolo archivio in memoria, senza React.

export type EsitoDocumento = {
  id: string
  /** di chi è il documento: il destinatario fissato alla partenza */
  guestId: string
  nome: string
  tipo: 'caricato' | 'caricamento_fallito' | 'eliminato' | 'eliminazione_fallita'
  dettaglio?: string | null
}

/** Il testo dell'avviso, sempre col nome della persona a cui è andato */
export function testoEsito(e: EsitoDocumento): string {
  const chi = e.nome || 'la cliente precedente'
  switch (e.tipo) {
    case 'caricato': return `Il documento caricato per ${chi} è stato salvato nella scheda di ${chi}.`
    case 'caricamento_fallito': return `Il caricamento per ${chi} non è riuscito${e.dettaglio ? `: ${e.dettaglio}` : ''}. Riaprire la scheda di ${chi} e riprovare.`
    case 'eliminato': return `Il documento di ${chi} è stato eliminato.`
    case 'eliminazione_fallita': return `L’eliminazione del documento di ${chi} non è riuscita${e.dettaglio ? `: ${e.dettaglio}` : ''}.`
  }
}

/** La risposta vale per la pagina che c'è adesso? Solo se è ancora montata e
 *  mostra lo stesso cliente della partenza (stesso giro). */
export function rispostaValePerLaPagina(partenza: { giro: number; guestId: string }, ora: { giro: number; guestId: string; montata: boolean }): boolean {
  return ora.montata && ora.giro === partenza.giro && ora.guestId === partenza.guestId
}

// ── archivio in memoria (una scheda del browser) ────────────────────────────
let esiti: EsitoDocumento[] = []
const ascoltatori = new Set<() => void>()

export function aggiungiEsito(e: Omit<EsitoDocumento, 'id'>): void {
  esiti = [...esiti, { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2)}` }]
  ascoltatori.forEach(f => f())
}
export function togliEsito(id: string): void {
  esiti = esiti.filter(e => e.id !== id)
  ascoltatori.forEach(f => f())
}
export function leggiEsiti(): EsitoDocumento[] { return esiti }
export function ascoltaEsiti(f: () => void): () => void {
  ascoltatori.add(f)
  return () => { ascoltatori.delete(f) }
}
