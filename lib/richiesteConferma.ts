// Conferma di una richiesta (pezzo 4): logica pura per la finestra
// «Creare la prenotazione?». La scrittura vera è la RPC conferma_richiesta.
import { condividonoGiorni } from './richiesteCalendario.ts'
import { eAperta, type Richiesta } from './richieste.ts'
import type { Soluzione } from './richiesteProposta.ts'

export type RichiestaConProposta = Richiesta & { proposta_soluzione?: Soluzione | null; proposta_testo?: string | null; motivo_rifiuto?: string | null }

// Altre richieste APERTE che toccano i segmenti della soluzione inviata:
// stessa camera del segmento, oppure «qualsiasi camera», con notti in comune.
export function richiesteInConflitto<T extends Pick<Richiesta, 'id' | 'arrivo' | 'partenza' | 'camera_id' | 'stato'>>(
  soluzione: Soluzione, aperte: T[], esclusoId: string,
): T[] {
  return aperte.filter(r => r.id !== esclusoId && eAperta(r) && soluzione.segmenti.some(s =>
    (r.camera_id == null || r.camera_id === s.camera.id) && condividonoGiorni({ arrivo: s.arrivo, partenza: s.partenza }, r)))
}

// L'errore della RPC riguarda la disponibilità (camera occupata o letti finiti)?
export function erroreDiDisponibilita(messaggio: string): boolean {
  return /non più disponibile|letti aggiuntivi esauriti/i.test(messaggio)
}

// Letto aggiuntivo presente in almeno un segmento della soluzione
export function conLettoExtra(soluzione: Soluzione): boolean {
  return soluzione.segmenti.some(s => s.lettoTotale > 0)
}
