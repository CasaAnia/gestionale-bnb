// ============================================================================
// DEPOSITO DUREVOLE delle OPERAZIONI del contratto (browser): la stessa
// interfaccia CONTROLLATA di contrattoScrittura, sopra un magazzino
// chiave→testo (localStorage nelle pagine, un finto nei test). Regole:
//  · ogni lettura e scrittura è dentro try/catch: un guasto diventa
//    { errore } dichiarato, MAI zero pendenze;
//  · una chiave già pendente non cambia identità né contenuto: a parità
//    di identità si aggiorna SOLO il contatore dei tentativi (la
//    richiesta custodita resta l'ORIGINALE);
//  · l'INDICE è l'autorità per l'elenco. Ordine di scrittura pensato
//    per i crash: in salvataggio prima il VALORE poi l'indice (un
//    valore orfano non indicizzato è innocuo: la registrazione conta
//    solo quando salva() è tornata, e l'invio parte dopo); in rimozione
//    prima l'INDICE poi il valore (un orfano resta invisibile). Una
//    chiave indicizzata SENZA valore leggibile è corruzione: errore
//    dichiarato, mai «assente».
//  · serializzazione JSON identica al deposito in memoria (già provata
//    nel collaudo, passo 6: custodia serializzata e ricreata).
// ============================================================================
import type { OperazioneContratto } from './contrattoRevisione.ts'
import type { DepositoOperazioni } from './contrattoScrittura.ts'

export type DepositoOperazioniElencabile = DepositoOperazioni & {
  elenca(): { ops?: OperazioneContratto[]; errore?: string }
}

export type MagazzinoTesto = {
  getItem(chiave: string): string | null
  setItem(chiave: string, valore: string): void
  removeItem(chiave: string): void
}

// il magazzino di default si risolve a OGNI accesso (l'accessor di
// localStorage può lanciare in contesti particolari: anche quello è un
// guasto dichiarato, non un'eccezione che sfugge)
const magazzinoDefault = (): MagazzinoTesto => {
  const w = globalThis as unknown as { localStorage?: MagazzinoTesto }
  if (!w.localStorage) throw new Error('localStorage non disponibile')
  return w.localStorage
}

const operazioneValida = (op: unknown): op is OperazioneContratto => {
  const o = op as OperazioneContratto
  return typeof o === 'object' && o !== null
    && typeof o.opKey === 'string' && !!o.opKey
    && (o.kind === 'salva' || o.kind === 'conferma' || o.kind === 'scarto')
    && typeof o.documentId === 'string' && Number.isInteger(o.baseRev)
    && typeof o.impronta === 'string' && Array.isArray(o.clientRefs)
    && typeof o.richiesta === 'object' && o.richiesta !== null
}

export function depositoOperazioniDurevole(
  magazzino?: MagazzinoTesto, prefisso = 'gestionale-op-contratto',
): DepositoOperazioniElencabile {
  const chiaveIndice = `${prefisso}:indice`
  const chiaveOp = (opKey: string) => `${prefisso}:op:${opKey}`
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
      throw new Error('indice della custodia corrotto')
    return indice
  }
  const leggiOp = (m: MagazzinoTesto, opKey: string): OperazioneContratto | undefined => {
    const testo = m.getItem(chiaveOp(opKey))
    if (testo === null) {
      // indicizzata senza valore = corruzione, MAI «assente»
      if (leggiIndice(m).includes(opKey))
        throw new Error(`custodia corrotta: la pendenza ${opKey} è indicizzata ma senza contenuto`)
      return undefined
    }
    const op = JSON.parse(testo)
    if (!operazioneValida(op)) throw new Error(`custodia corrotta: contenuto non valido per ${opKey}`)
    return op
  }
  return {
    salva(op) {
      const esito = dentro(m => {
        const esistente = leggiOp(m, op.opKey)
        if (esistente && leggiIndice(m).includes(op.opKey)) {
          if (esistente.impronta === op.impronta && esistente.kind === op.kind
            && esistente.documentId === op.documentId && esistente.baseRev === op.baseRev) {
            // stessa identità: SOLO il contatore, la richiesta resta l'originale
            m.setItem(chiaveOp(op.opKey), JSON.stringify({ ...esistente, tentativiIncerti: op.tentativiIncerti ?? esistente.tentativiIncerti }))
            return {}
          }
          return { errore: `la chiave ${op.opKey} è già pendente con UN'ALTRA richiesta: una pendenza non cambia identità né contenuto` }
        }
        m.setItem(chiaveOp(op.opKey), JSON.stringify(op))          // prima il valore…
        const indice = leggiIndice(m)
        if (!indice.includes(op.opKey)) m.setItem(chiaveIndice, JSON.stringify([...indice, op.opKey]))  // …poi l'indice
        return {}
      })
      return 'errore' in esito ? esito : {}
    },
    leggi(opKey) {
      const esito = dentro(m => ({ op: leggiOp(m, opKey) }))
      return 'errore' in esito ? esito : esito
    },
    rimuovi(opKey) {
      const esito = dentro(m => {
        const indice = leggiIndice(m)
        if (indice.includes(opKey)) m.setItem(chiaveIndice, JSON.stringify(indice.filter(k => k !== opKey)))  // prima l'indice…
        m.removeItem(chiaveOp(opKey))                                                                        // …poi il valore
        return {}
      })
      return 'errore' in esito ? esito : {}
    },
    elenca() {
      const esito = dentro(m => {
        const ops: OperazioneContratto[] = []
        for (const k of leggiIndice(m)) {
          const op = leggiOp(m, k)
          if (!op) throw new Error(`custodia corrotta: la pendenza ${k} è indicizzata ma senza contenuto`)
          ops.push(op)
        }
        return { ops }
      })
      return 'errore' in esito ? esito : esito
    },
  }
}
