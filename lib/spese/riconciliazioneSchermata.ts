// ============================================================================
// Il CICLO di riconciliazione della schermata (guscio di RevisioneSheet):
// logica estratta e testabile in node. Ogni avvio — il primo o un
// «Riprova» — fa PARTIRE DAVVERO una nuova chiamata e pubblica prima lo
// stato di attesa (null); le risposte OBSOLETE (di un avvio precedente
// rimasto in volo) vengono scartate: pubblica solo l'ultimo avvio.
// ============================================================================
import type { AperturaRevisione } from './orchestrazioneRevisione.ts'

export type CicloRiconciliazione = {
  avvia(): void
  avvii(): number                    // per le prove: quante chiamate REALI sono partite
}

export function cicloRiconciliazione(
  apertura: (documentId: string) => Promise<AperturaRevisione>,
  documentId: string,
  pubblica: (esito: AperturaRevisione | null) => void,
): CicloRiconciliazione {
  let sequenza = 0
  return {
    avvia() {
      const mia = ++sequenza
      pubblica(null)                                     // «un attimo…»
      apertura(documentId).then(esito => {
        if (sequenza === mia) pubblica(esito)            // le risposte vecchie non parlano
      })
    },
    avvii: () => sequenza,
  }
}
