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
  // anche la RIMOZIONE rispetta la generazione: la conferma di una
  // schermata superata non può cancellare la traccia di una più recente
  rimuovi(documentId: string, generazione: number): { errore?: string }
}

const STATI_RIGA = ['nuova', 'in_invio', 'salvata', 'incerta', 'riconosciuta']
const archivioDiOggetti = (x: unknown): boolean =>
  typeof x === 'object' && x !== null && !Array.isArray(x)
  && Object.values(x).every(v => typeof v === 'object' && v !== null && !Array.isArray(v))

// la validazione copre anche la STRUTTURA INTERNA: un JSON valido con
// dentro righeNuove:[null] o modifiche non-oggetto NON è una traccia —
// va segnalato come errore (mai fatto passare, mai sovrascritto)
function tracciaValida(x: unknown): x is TracciaRevisione {
  if (typeof x !== 'object' || x === null) return false
  const t = x as Record<string, unknown>
  const inCorso = t.inCorso as Record<string, unknown> | null | undefined
  return typeof t.documentId === 'string'
    && (t.generazione === undefined || typeof t.generazione === 'number')
    && (inCorso == null || (typeof inCorso === 'object' && !Array.isArray(inCorso)
      && ['salva', 'conferma', 'scarto'].includes(inCorso.tipo as string)
      && typeof inCorso.generazione === 'number'))
    && (t.docTotaleCent === null || typeof t.docTotaleCent === 'number')
    && (t.docTotaleOriginaleCent === null || typeof t.docTotaleOriginaleCent === 'number')
    && archivioDiOggetti(t.originaliBozze) && archivioDiOggetti(t.originaliRighe)
    && archivioDiOggetti(t.modificheBozze) && archivioDiOggetti(t.modificheRighe)
    && Array.isArray(t.righeNuove)
    && t.righeNuove.every(n => typeof n === 'object' && n !== null
      && typeof (n as Record<string, unknown>).idLocale === 'string'
      && STATI_RIGA.includes((n as Record<string, unknown>).stato as string)
      && typeof (n as Record<string, unknown>).draft_id === 'string'
      && typeof (n as Record<string, unknown>).name === 'string'
      && typeof (n as Record<string, unknown>).amount === 'number')
}

// il coordinamento fra schermate e operazioni: una scrittura di una
// GENERAZIONE superata viene rifiutata — la risposta di un Salva rimasto
// per aria non può calpestare lo stato di una schermata più recente
function superata(esistente: TracciaRevisione | undefined, nuova: TracciaRevisione): string | null {
  if (!esistente) return null
  if ((esistente.generazione ?? 0) > (nuova.generazione ?? 0))
    return `custodia superata: c'è uno stato più recente del documento (generazione ${esistente.generazione ?? 0} > ${nuova.generazione ?? 0}) — questa scrittura vecchia non lo tocca`
  return null
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
        const vecchia = superata(lettura.tracce[t.documentId], t)
        if (vecchia) return { errore: vecchia }
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
    rimuovi(documentId, generazione) {
      return con(mem => {
        const lettura = leggiArchivio(mem, chiave)
        if (lettura.errore) return { errore: `custodia illeggibile, non tocco nulla (${lettura.errore})` }
        const esistente = lettura.tracce[documentId]
        if (esistente && (esistente.generazione ?? 0) > generazione)
          return { errore: `custodia superata: c'è uno stato più recente (generazione ${esistente.generazione ?? 0} > ${generazione}) — non rimossa` }
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
    salva(t) {
      const vecchia = superata(tracce[t.documentId], t)
      if (vecchia) return { errore: vecchia }
      tracce = { ...tracce, [t.documentId]: t }; return {}
    },
    leggi(documentId) { return { traccia: tracce[documentId] } },
    rimuovi(documentId, generazione) {
      const esistente = tracce[documentId]
      if (esistente && (esistente.generazione ?? 0) > generazione)
        return { errore: `custodia superata: c'è uno stato più recente (generazione ${esistente.generazione ?? 0} > ${generazione}) — non rimossa` }
      const { [documentId]: via, ...resto } = tracce; void via; tracce = resto; return {}
    },
    contenuto: () => ({ ...tracce }),
  }
}
