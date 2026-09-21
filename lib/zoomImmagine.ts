// Ingrandimento del documento aperto a schermo intero (21/09/2026, richiesta
// di Ania: «i documenti caricati non li posso più ingrandire per leggere da
// dove arriva la gente»). Il gestionale blocca lo zoom del telefono
// (maximumScale: 1 in app/layout.tsx) e nella PWA le due dita non fanno
// nulla: l'ingrandimento se lo fa il visore, con questi conti puri.

export const ZOOM_MIN = 1
export const ZOOM_MAX = 6
export const ZOOM_PASSO = 1.6          // un tocco su + o −
export const ZOOM_DOPPIO_TOCCO = 2.5   // doppio tocco sull'immagine

export function limitaScala(scala: number): number {
  if (!Number.isFinite(scala)) return ZOOM_MIN
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, scala))
}

export function distanzaDita(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Quanto si può spostare l'immagine: metà di quello che esce dai bordi.
export function limitiSpostamento(scala: number, larghezza: number, altezza: number): { maxX: number; maxY: number } {
  const s = limitaScala(scala)
  return {
    maxX: Math.max(0, (larghezza * s - larghezza) / 2),
    maxY: Math.max(0, (altezza * s - altezza) / 2),
  }
}

export function limitaSpostamento(
  x: number, y: number, scala: number, larghezza: number, altezza: number,
): { x: number; y: number } {
  const { maxX, maxY } = limitiSpostamento(scala, larghezza, altezza)
  return {
    x: Math.min(maxX, Math.max(-maxX, Number.isFinite(x) ? x : 0)),
    y: Math.min(maxY, Math.max(-maxY, Number.isFinite(y) ? y : 0)),
  }
}

// Doppio tocco: se è già ingrandita torna intera, altrimenti ingrandisce.
export function scalaDopoDoppioTocco(scala: number): number {
  return scala > ZOOM_MIN + 0.01 ? ZOOM_MIN : ZOOM_DOPPIO_TOCCO
}

export function scalaDopoPasso(scala: number, verso: 1 | -1): number {
  return limitaScala(verso === 1 ? scala * ZOOM_PASSO : scala / ZOOM_PASSO)
}
