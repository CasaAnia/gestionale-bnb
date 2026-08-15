// Conta quante pagine dell'app sono state visitate in questa scheda.
//
// Serve al pulsante "Indietro": se c'è davvero una pagina precedente dentro
// l'app usiamo la cronologia del browser (così dal calendario si torna al
// calendario, dalle prenotazioni alle prenotazioni), altrimenti — pagina
// aperta direttamente da un link o dall'icona sulla Home del telefono —
// andiamo alla pagina di riserva indicata dal pulsante, senza mai rischiare
// di uscire dall'app o di restare fermi.
//
// Il conteggio vive in sessionStorage: è separato per ogni scheda e
// sopravvive alla ricarica della pagina (dove la cronologia resta valida),
// ma non a una nuova apertura dell'app (dove riparte da zero, vedi
// NavTracker).

const KEY = 'ca-nav-depth'

export function getDepth(): number {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}

export function setDepth(n: number) {
  try {
    sessionStorage.setItem(KEY, String(Math.max(0, n)))
  } catch {
    // sessionStorage non disponibile: pazienza, si userà sempre la riserva
  }
}

type RouterLike = { back: () => void; push: (href: string) => void }

// Torna alla pagina precedente vera; se non esiste (o se il conteggio si
// rivela sbagliato e dopo mezzo secondo siamo ancora fermi) va alla riserva.
export function smartBack(router: RouterLike, fallback?: string) {
  if (getDepth() > 0 && window.history.length > 1) {
    const prima = window.location.href
    router.back()
    if (fallback) {
      setTimeout(() => {
        if (window.location.href === prima) router.push(fallback)
      }, 600)
    }
  } else if (fallback) {
    router.push(fallback)
  }
}
