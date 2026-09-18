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

// Destinazioni interne a cui la pagina Nuova prenotazione può tornare dopo
// il salvataggio (parametro ?returnTo=). Solo percorsi dell'app: qualunque
// altro valore viene scartato, così un link esterno non può dirottare il
// ritorno (niente open redirect).
const RETURN_PATHS = new Set(['/', '/calendario', '/prenotazioni', '/arrivi', '/pulizie', '/clienti'])

export function returnToSicuro(raw: string | null): string | null {
  if (!raw) return null
  if (RETURN_PATHS.has(raw)) return raw
  // Dettaglio prenotazione: /prenotazioni/<id> (cambio camera)
  if (/^\/prenotazioni\/[A-Za-z0-9-]+$/.test(raw)) return raw
  return null
}

// ── Le pagine da cui si è passati ───────────────────────────────────────────
// La cronologia del browser non basta: sul telefono l'app si ricarica al
// ritorno da WhatsApp e il conteggio riparte da zero, così «Indietro» dalla
// scheda finiva su Prenotazioni anche entrando dal calendario (Ania,
// 18/09/2026). Qui si tengono, in localStorage, le ultime pagine dell'app
// visitate in fila: quando la cronologia non si può usare, la riserva è la
// pagina da cui si è arrivati davvero. Dopo dodici ore l'elenco si butta:
// un'apertura nuova non deve tornare a ieri.
const KEY_PAGINE = 'ca-nav-pagine'
const SCADENZA_PAGINE_MS = 12 * 60 * 60 * 1000
const MASSIMO_PAGINE = 30

export type MemoriaPagine = { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void }

function memoria(): MemoriaPagine | null {
  try { return typeof localStorage === 'undefined' ? null : localStorage } catch { return null }
}

export function leggiPagine(adesso = Date.now(), store: MemoriaPagine | null = memoria()): string[] {
  try {
    const grezzo = store?.getItem(KEY_PAGINE)
    if (!grezzo) return []
    const dati = JSON.parse(grezzo) as { quando?: number; pagine?: unknown }
    if (!Array.isArray(dati.pagine) || typeof dati.quando !== 'number' || adesso - dati.quando > SCADENZA_PAGINE_MS) return []
    return dati.pagine.filter((p): p is string => typeof p === 'string' && p.startsWith('/'))
  } catch {
    return []
  }
}

/** Segna la pagina corrente in fila. `tornato` = ci si è arrivati con un
 *  «indietro» del browser: la pagina lasciata esce dalla fila. Tornare con un
 *  salto in avanti sulla pagina di prima conta lo stesso come un indietro. */
export function ricordaPagina(pathname: string, tornato: boolean, adesso = Date.now(), store: MemoriaPagine | null = memoria()): string[] {
  const pagine = leggiPagine(adesso, store)
  const ultima = pagine[pagine.length - 1]
  const penultima = pagine[pagine.length - 2]
  if (ultima === pathname) {
    // stessa pagina (ricarica, o cambio di soli parametri): niente da segnare
  } else if (penultima === pathname) {
    pagine.pop()
  } else if (tornato && pagine.length > 0) {
    pagine.pop()
    if (pagine[pagine.length - 1] !== pathname) pagine.push(pathname)
  } else {
    pagine.push(pathname)
  }
  const tenute = pagine.slice(-MASSIMO_PAGINE)
  try { store?.setItem(KEY_PAGINE, JSON.stringify({ quando: adesso, pagine: tenute })) } catch { /* senza memoria: si userà la riserva */ }
  return tenute
}

/** La pagina da cui si è arrivati a `pathname`, se la fila la conosce */
export function paginaPrecedente(pathname: string, adesso = Date.now(), store: MemoriaPagine | null = memoria()): string | null {
  const pagine = leggiPagine(adesso, store)
  if (pagine.length < 2 || pagine[pagine.length - 1] !== pathname) return null
  const prima = pagine[pagine.length - 2]
  return prima && prima !== pathname ? prima : null
}

type RouterLike = { back: () => void; push: (href: string) => void }

// Torna alla pagina precedente vera; se non esiste (o se il conteggio si
// rivela sbagliato e dopo mezzo secondo siamo ancora fermi) va alla riserva:
// la pagina da cui si è arrivati, se la fila la ricorda, altrimenti `fallback`.
export function smartBack(router: RouterLike, fallback?: string) {
  const riserva = paginaPrecedente(window.location.pathname) ?? fallback
  if (getDepth() > 0 && window.history.length > 1) {
    const prima = window.location.href
    router.back()
    if (riserva) {
      setTimeout(() => {
        if (window.location.href === prima) router.push(riserva)
      }, 600)
    }
  } else if (riserva) {
    router.push(riserva)
  }
}
