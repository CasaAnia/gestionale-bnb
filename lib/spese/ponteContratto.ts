// ============================================================================
// Il PONTE fra le due custodie del percorso a contratto: il riferimento
// DUREVOLE a un'operazione, per documento, che vive da PRIMA dell'invio
// fino a quando esito, id delle voci e stato della revisione sono stati
// ACQUISITI nella traccia della revisione. Serve nei due buchi che le
// custodie da sole non coprono:
//  · il deposito delle operazioni si svuota quando la RISPOSTA è
//    convalidata — ma se l'aggiornamento della traccia fallisce subito
//    dopo, senza il ponte la schermata resterebbe con voci «in_invio»
//    e nessuna operazione da recuperare;
//  · il riferimento porta l'IDENTITÀ COMPLETA (impronta, clientRefs):
//    anche senza la richiesta custodita si può convalidare l'esito del
//    giornale (validaEsitoGiornale) e completare l'acquisizione.
// Stesse regole del deposito durevole: accessi CONTROLLATI (guasto
// dichiarato, mai «assente»), una sola operazione per documento (i
// cancelli dell'orchestrazione lo garantiscono e il ponte lo pretende).
// ============================================================================
import type { MagazzinoTesto } from './depositoOperazioniDurevole.ts'

export type RiferimentoOperazione = {
  opKey: string
  kind: 'salva' | 'conferma' | 'scarto'
  documentId: string
  baseRev: number
  impronta: string
  clientRefs: string[]
  inInvio: string[]                 // idLocale delle voci nuove (== client_ref)
  generazione: number               // della schermata che ha inviato
  esito?: { revDopo: number; mappaNuove: Record<string, string>; spese?: string[] }
}

export type PonteContratto = {
  salva(rif: RiferimentoOperazione): { errore?: string }
  leggi(documentId: string): { rif?: RiferimentoOperazione; errore?: string }
  rimuovi(documentId: string): { errore?: string }
  elenca(): { rifs?: RiferimentoOperazione[]; errore?: string }
}

const magazzinoDefault = (): MagazzinoTesto => {
  const w = globalThis as unknown as { localStorage?: MagazzinoTesto }
  if (!w.localStorage) throw new Error('localStorage non disponibile')
  return w.localStorage
}

const rifValido = (r: unknown): r is RiferimentoOperazione => {
  const x = r as RiferimentoOperazione
  return typeof x === 'object' && x !== null
    && typeof x.opKey === 'string' && !!x.opKey
    && (x.kind === 'salva' || x.kind === 'conferma' || x.kind === 'scarto')
    && typeof x.documentId === 'string' && Number.isInteger(x.baseRev)
    && typeof x.impronta === 'string' && Array.isArray(x.clientRefs)
    && Array.isArray(x.inInvio) && Number.isInteger(x.generazione)
}

export function ponteContrattoDurevole(
  magazzino?: MagazzinoTesto, prefisso = 'gestionale-ponte-contratto',
): PonteContratto {
  const chiaveIndice = `${prefisso}:indice`
  const chiaveDoc = (documentId: string) => `${prefisso}:doc:${documentId}`
  const dentro = <T>(corpo: (m: MagazzinoTesto) => T): T | { errore: string } => {
    try { return corpo(magazzino ?? magazzinoDefault()) } catch (e) {
      return { errore: String((e as Error).message ?? e) }
    }
  }
  const leggiIndice = (m: MagazzinoTesto): string[] => {
    const testo = m.getItem(chiaveIndice)
    if (testo === null) return []
    const indice = JSON.parse(testo)
    if (!Array.isArray(indice) || !indice.every(k => typeof k === 'string'))
      throw new Error('indice del ponte corrotto')
    return indice
  }
  const leggiRif = (m: MagazzinoTesto, documentId: string): RiferimentoOperazione | undefined => {
    const testo = m.getItem(chiaveDoc(documentId))
    if (testo === null) {
      if (leggiIndice(m).includes(documentId))
        throw new Error(`ponte corrotto: il documento ${documentId} è indicizzato ma senza riferimento`)
      return undefined
    }
    const rif = JSON.parse(testo)
    if (!rifValido(rif)) throw new Error(`ponte corrotto: riferimento non valido per ${documentId}`)
    return rif
  }
  return {
    salva(rif) {
      const esito = dentro(m => {
        const esistente = leggiRif(m, rif.documentId)
        if (esistente && esistente.opKey !== rif.opKey)
          return { errore: `il documento ${rif.documentId} ha già un'operazione in ponte (${esistente.opKey}): va acquisita prima di un'altra` }
        m.setItem(chiaveDoc(rif.documentId), JSON.stringify(rif))    // prima il valore…
        const indice = leggiIndice(m)
        if (!indice.includes(rif.documentId)) m.setItem(chiaveIndice, JSON.stringify([...indice, rif.documentId]))  // …poi l'indice
        return {}
      })
      return 'errore' in esito ? esito : {}
    },
    leggi(documentId) {
      const esito = dentro(m => ({ rif: leggiRif(m, documentId) }))
      return 'errore' in esito ? esito : esito
    },
    rimuovi(documentId) {
      const esito = dentro(m => {
        const indice = leggiIndice(m)
        if (indice.includes(documentId)) m.setItem(chiaveIndice, JSON.stringify(indice.filter(k => k !== documentId)))  // prima l'indice…
        m.removeItem(chiaveDoc(documentId))                                                                            // …poi il valore
        return {}
      })
      return 'errore' in esito ? esito : {}
    },
    elenca() {
      const esito = dentro(m => {
        const rifs: RiferimentoOperazione[] = []
        for (const k of leggiIndice(m)) {
          const rif = leggiRif(m, k)
          if (!rif) throw new Error(`ponte corrotto: il documento ${k} è indicizzato ma senza riferimento`)
          rifs.push(rif)
        }
        return { rifs }
      })
      return 'errore' in esito ? esito : esito
    },
  }
}
