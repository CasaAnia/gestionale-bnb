// ============================================================================
// DA DOVE SI È APERTA LA SCHEDA (ritocchi «Maison» del 29/09/2026, punto C4)
//
// La freccia «‹» in cima alla scheda dice il nome della pagina da cui si è
// venuti e ci riporta: «‹ Oggi» dalla Home, «‹ Calendario», «‹ Arrivi»,
// «‹ Richieste», «‹ Cliente», «‹ Prenotazioni» dall'elenco. Senza
// provenienza (una notifica, un link diretto) «‹ Prenotazioni», come prima.
//
// È il meccanismo `?da=cliente&cliente=<id>` di prima (08/09/2026) esteso:
// il parametro `da` ha un valore per ogni pagina, lo mettono tutti i link che
// aprono la scheda (hrefScheda) e resta nell'indirizzo anche dopo un
// salvataggio (le linguette e i salvataggi non lo tolgono; quando la scheda
// passa a un'altra camera lo riporta, conDaDellaScheda). `?da=richiesta` (la
// prenotazione appena creata da una richiesta) torna alle Richieste.
// ============================================================================

export type DaScheda = 'home' | 'calendario' | 'arrivi' | 'richieste' | 'cliente' | 'prenotazioni'

export const PAGINE_DA: Record<DaScheda, { etichetta: string; href: string }> = {
  home: { etichetta: 'Oggi', href: '/' },
  calendario: { etichetta: 'Calendario', href: '/calendario' },
  arrivi: { etichetta: 'Arrivi', href: '/arrivi' },
  richieste: { etichetta: 'Richieste', href: '/richieste' },
  cliente: { etichetta: 'Cliente', href: '/clienti' },
  prenotazioni: { etichetta: 'Prenotazioni', href: '/prenotazioni' },
}
export const SENZA_PROVENIENZA = PAGINE_DA.prenotazioni

type Parametri = { get: (nome: string) => string | null }

/** L'indirizzo della scheda aperta da `da` (con `cliente` per la scheda cliente) */
export function hrefScheda(id: string, da: DaScheda, altro: { cliente?: string | null; query?: string } = {}): string {
  const q = new URLSearchParams(altro.query ?? '')
  q.set('da', da)
  if (da === 'cliente' && altro.cliente) q.set('cliente', altro.cliente)
  return `/scheda/${id}?${q.toString()}`
}

/** Dall'indirizzo della scheda: il nome da scrivere dopo «‹» e dove tornare se la cronologia non c'è */
export function provenienzaScheda(p: Parametri): { etichetta: string; riserva: string; da: DaScheda | null } {
  const da = p.get('da')
  if (da === 'cliente') {
    const cliente = p.get('cliente')
    return { etichetta: PAGINE_DA.cliente.etichetta, riserva: cliente ? `/clienti/${cliente}` : PAGINE_DA.cliente.href, da: 'cliente' }
  }
  // la prenotazione appena creata da una richiesta (onCreata) viene dalle Richieste
  if (da === 'richiesta') return { etichetta: PAGINE_DA.richieste.etichetta, riserva: PAGINE_DA.richieste.href, da: 'richieste' }
  if (da && da in PAGINE_DA) {
    const k = da as DaScheda
    return { etichetta: PAGINE_DA[k].etichetta, riserva: PAGINE_DA[k].href, da: k }
  }
  return { etichetta: SENZA_PROVENIENZA.etichetta, riserva: SENZA_PROVENIENZA.href, da: null }
}

/** La scheda passa a un'altra camera della stessa prenotazione: la provenienza resta */
export function conDaDellaScheda(id: string, p: Parametri): string {
  const da = p.get('da')
  if (!da) return `/scheda/${id}`
  const q = new URLSearchParams({ da })
  const cliente = p.get('cliente')
  if (da === 'cliente' && cliente) q.set('cliente', cliente)
  return `/scheda/${id}?${q.toString()}`
}
