'use client'
// ============================================================================
// LA STRISCIA IN ALTO della Home «Maison» (28/09/2026): la foto di Lena
// (public/home/striscia.jpg, scelta B del riferimento), alta 118 px, velata
// in basso; sopra la data in maiuscoletto avorio e «Buongiorno, Ania» con
// «Ania» in corsivo. In alto a destra due cerchi sottili: la ricerca (la
// Home non ne ha una sua: apre Prenotazioni, dove si cerca per nome) e «+»,
// la nuova prenotazione.
// La data (12/11/2026): si calcola nel BROWSER dopo il caricamento, col fuso
// di Roma, e si ricontrolla quando la pagina torna visibile e ogni mezzo
// minuto, così cambia da sola a mezzanotte e riaprendo l'app il giorno dopo.
// Prima nasceva alla costruzione della pagina sul server e restava ferma al
// giorno dell'ultima pubblicazione. Finché non è calcolata la riga è vuota
// ma alta uguale: «Buongiorno, Ania» non salta.
// ============================================================================
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { dataStriscia, RICONTROLLO_DATA_MS } from '@/lib/dataStriscia'

export { dataStriscia } from '@/lib/dataStriscia'

export const FOTO_STRISCIA = '/home/striscia.jpg'
export const HREF_CERCA = '/prenotazioni'
export const HREF_NUOVA = '/nuova-prenotazione'

export default function StrisciaFoto() {
  const [data, setData] = useState<string | null>(null)
  useEffect(() => {
    const aggiorna = () => setData(dataStriscia(new Date()))
    aggiorna()
    const alRitorno = () => { if (document.visibilityState === 'visible') aggiorna() }
    document.addEventListener('visibilitychange', alRitorno)
    window.addEventListener('pageshow', aggiorna)
    const t = window.setInterval(aggiorna, RICONTROLLO_DATA_MS)
    return () => { document.removeEventListener('visibilitychange', alRitorno); window.removeEventListener('pageshow', aggiorna); window.clearInterval(t) }
  }, [])
  return (
    <header className="mz-strip" style={{ backgroundImage: `url(${FOTO_STRISCIA})` }} data-striscia-foto>
      {/* Fascia reale: iOS usa gli elementi fissi per lo sfondo della barra di stato. */}
      <div aria-hidden="true" className="mz-home-status-background" />
      <div className="ic">
        <Link href={HREF_CERCA} aria-label="Cerca">⌕</Link>
        <Link href={HREF_NUOVA} aria-label="Nuova prenotazione">+</Link>
      </div>
      <div className="tx">
        <p className="mz-eyebrow" data-data-striscia={data ?? ''}>{data ?? '\u00a0'}</p>
        <h1>Buongiorno, <em>Ania</em></h1>
      </div>
    </header>
  )
}
