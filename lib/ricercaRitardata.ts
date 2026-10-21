// ============================================================================
// LA RICERCA MENTRE SI SCRIVE (21/10/2026, rilievo R4 di Codex).
// Si cerca un quarto di secondo dopo l'ultimo tasto, come sempre. Il punto è
// cosa succede alle risposte: ogni volta che il testo cambia, la ricerca
// precedente è SUBITO superata — anche quella già partita e non ancora
// tornata — e i suoi risultati spariscono dallo schermo. Prima il controllo
// scattava solo quando partiva la ricerca nuova, 250 ms dopo: in quell'attesa
// una risposta del testo vecchio poteva ancora comparire ed essere toccata.
// Niente React qui: la pagina passa `cerca` (la lettura) e `mostra` (lo
// stato), e i test la fanno girare con l'orologio finto.
// ============================================================================

export type RicercaRitardata = {
  /** da chiamare a ogni cambiamento del campo */
  scrivi: (valore: string) => void
  /** da chiamare quando la pagina se ne va */
  ferma: () => void
}

export function creaRicercaRitardata<T>(o: {
  cerca: (testo: string) => Promise<T>
  /** risultati del testo ATTUALE; null = elenco da svuotare (testo cambiato o troppo corto) */
  mostra: (esito: { testo: string; risultato: T } | null) => void
  ritardo?: number
  minimo?: number
}): RicercaRitardata {
  const ritardo = o.ritardo ?? 250
  const minimo = o.minimo ?? 2
  let giro = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  return {
    scrivi(valore: string) {
      // il testo è cambiato: tutto ciò che è partito prima non vale più
      const mio = ++giro
      if (timer) clearTimeout(timer)
      timer = null
      o.mostra(null)
      const testo = valore.trim()
      if (testo.length < minimo) return
      timer = setTimeout(() => {
        timer = null
        void o.cerca(testo).then(risultato => { if (mio === giro) o.mostra({ testo, risultato }) }, () => {})
      }, ritardo)
    },
    ferma() {
      giro++
      if (timer) clearTimeout(timer)
      timer = null
    },
  }
}
