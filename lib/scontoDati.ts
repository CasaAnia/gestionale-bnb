'use client'
// ============================================================================
// SALVARE LO SCONTO dalla scheda nuova (17/09/2026): cosa scrivere lo decide
// lib/scontoScheda (pure); la scrittura riga per riga, con il controllo della
// riga toccata e l'esito «incerto» quando qualcosa può essere stato scritto,
// è quella comune di lib/righeDati.
// ============================================================================
import { aggiornaRigaPerRiga, ERRORE_RIGA_NON_TROVATA, ERRORE_SALVATO_A_META, type EsitoRighe } from './righeDati'
import type { CampiScontoRiga } from './scontoScheda'

export const ERRORE_RIGA_SCONTO = ERRORE_RIGA_NON_TROVATA
export const ERRORE_SCONTO_A_META = ERRORE_SALVATO_A_META

export type EsitoSconto = EsitoRighe

export function salvaSconto(righe: { id: string; campi: CampiScontoRiga }[]): Promise<EsitoSconto> {
  return aggiornaRigaPerRiga(righe.map(r => ({ id: r.id, campi: { ...r.campi } })))
}
