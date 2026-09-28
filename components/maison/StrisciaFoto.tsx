'use client'
// ============================================================================
// LA STRISCIA IN ALTO della Home «Maison» (28/09/2026): la foto di Lena
// (public/home/striscia.jpg, scelta B del riferimento), alta 118 px, velata
// in basso; sopra la data in maiuscoletto avorio e «Buongiorno, Ania» con
// «Ania» in corsivo. In alto a destra due cerchi sottili: la ricerca (la
// Home non ne ha una sua: apre Prenotazioni, dove si cerca per nome) e «+»,
// la nuova prenotazione.
// ============================================================================
import Link from 'next/link'

export const FOTO_STRISCIA = '/home/striscia.jpg'
export const HREF_CERCA = '/prenotazioni'
export const HREF_NUOVA = '/nuova-prenotazione'

/** «Lunedì 28 settembre 2026» */
export function dataStriscia(d = new Date()): string {
  const t = d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export default function StrisciaFoto() {
  return (
    <header className="mz-strip" style={{ backgroundImage: `url(${FOTO_STRISCIA})` }} data-striscia-foto>
      <div className="ic">
        <Link href={HREF_CERCA} aria-label="Cerca">⌕</Link>
        <Link href={HREF_NUOVA} aria-label="Nuova prenotazione">+</Link>
      </div>
      <div className="tx">
        <p className="mz-eyebrow" suppressHydrationWarning>{dataStriscia()}</p>
        <h1>Buongiorno, <em>Ania</em></h1>
      </div>
    </header>
  )
}
