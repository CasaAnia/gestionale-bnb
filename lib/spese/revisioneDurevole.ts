// ============================================================================
// TRACCE DUREVOLI DELLA REVISIONE (Fase 4, blocco 3 — correzioni) — gli
// ORIGINALI estratti e le modifiche pendenti si custodiscono nel browser
// PRIMA che un Salva riscriva le bozze: senza, alla riapertura il database
// restituirebbe il valore corretto come nuovo "originale" e le correzioni
// per la RPC sparirebbero in silenzio.
// Stessa disciplina di ripresaDurevole:
//  · se la custodia non riesce, il salvataggio remoto NON parte;
//  · lettura a TRE esiti: chiave assente = vuoto vero; lettura fallita,
//    JSON corrotto o struttura non valida si SEGNALANO e non si sovrascrive;
//  · la traccia si toglie SOLO a documento confermato o scartato.
// LIMITE DICHIARATO: la custodia vive nel browser del dispositivo — su un
// altro dispositivo gli originali di correzioni già salvate non sono
// ricostruibili (servirebbe un contratto database da proporre a parte).
// ============================================================================
import type { TracciaRevisione } from './revisione.ts'

export type DepositoRevisione = {
  salva(t: TracciaRevisione): { errore?: string }
  leggi(documentId: string): { traccia?: TracciaRevisione; errore?: string }
  rimuovi(documentId: string): { errore?: string }
}

function tracciaValida(x: unknown): x is TracciaRevisione {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Record<string, unknown>
  return typeof t.documentId === 'string'
    && (t.docTotaleCent === null || typeof t.docTotaleCent === 'number')
    && (t.docTotaleOriginaleCent === null || typeof t.docTotaleOriginaleCent === 'number')
    && typeof t.originaliBozze === 'object' && t.originaliBozze !== null
    && typeof t.originaliRighe === 'object' && t.originaliRighe !== null
    && typeof t.modificheBozze === 'object' && t.modificheBozze !== null
    && typeof t.modificheRighe === 'object' && t.modificheRighe !== null
    && Array.isArray(t.righeNuove)
}

type Memoria = Pick<Storage, 'getItem' | 'setItem'>

// lettura dell'intero archivio: errore ≠ vuoto, MAI scambiati
function leggiArchivio(memoria: Memoria, chiave: string):
  { tracce: Record<string, TracciaRevisione>; errore?: string } {
  let testo: string | null
  try { testo = memoria.getItem(chiave) } catch (e) {
    return { tracce: {}, errore: `lettura della custodia fallita (${String((e as Error).message ?? e)})` }
  }
  if (testo === null) return { tracce: {} }             // chiave ASSENTE = vuoto vero
  let dati: unknown
  try { dati = JSON.parse(testo) } catch {
    return { tracce: {}, errore: 'la custodia contiene dati corrotti (JSON non valido)' }
  }
  if (typeof dati !== 'object' || dati === null || Array.isArray(dati)
    || !Object.values(dati).every(tracciaValida))
    return { tracce: {}, errore: 'la custodia contiene una struttura non valida' }
  return { tracce: dati as Record<string, TracciaRevisione> }
}

export function depositoRevisioneLocale(
  chiave = 'gestionale-revisione-tracce',
  memoria: () => Memoria = () => localStorage,
): DepositoRevisione {
  const con = <T>(f: (mem: Memoria) => T, fallito: (msg: string) => T): T => {
    try { return f(memoria()) } catch (e) { return fallito(String((e as Error).message ?? e)) }
  }
  return {
    salva(t) {
      return con(mem => {
        const lettura = leggiArchivio(mem, chiave)
        if (lettura.errore)
          return { errore: `custodia illeggibile, non sovrascrivo (${lettura.errore})` }
        try {
          mem.setItem(chiave, JSON.stringify({ ...lettura.tracce, [t.documentId]: t }))
          return {}
        } catch (e) { return { errore: String((e as Error).message ?? e) } }
      }, msg => ({ errore: msg }))
    },
    leggi(documentId) {
      return con(mem => {
        const lettura = leggiArchivio(mem, chiave)
        if (lettura.errore) return { errore: lettura.errore }
        return { traccia: lettura.tracce[documentId] }
      }, msg => ({ errore: msg }))
    },
    rimuovi(documentId) {
      return con(mem => {
        const lettura = leggiArchivio(mem, chiave)
        if (lettura.errore) return { errore: `custodia illeggibile, non tocco nulla (${lettura.errore})` }
        const { [documentId]: via, ...resto } = lettura.tracce
        void via
        try { mem.setItem(chiave, JSON.stringify(resto)); return {} }
        catch (e) { return { errore: String((e as Error).message ?? e) } }
      }, msg => ({ errore: msg }))
    },
  }
}

export function depositoRevisioneInMemoria(): DepositoRevisione & { contenuto: () => Record<string, TracciaRevisione> } {
  let tracce: Record<string, TracciaRevisione> = {}
  return {
    salva(t) { tracce = { ...tracce, [t.documentId]: t }; return {} },
    leggi(documentId) { return { traccia: tracce[documentId] } },
    rimuovi(documentId) { const { [documentId]: via, ...resto } = tracce; void via; tracce = resto; return {} },
    contenuto: () => ({ ...tracce }),
  }
}
