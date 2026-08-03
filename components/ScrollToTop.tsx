'use client'
import { useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

// Riporta in cima a ogni cambio pagina, PRIMA che il browser disegni.
//
// Senza questo, la posizione di scorrimento della pagina precedente resta per
// un istante anche sulla nuova: aprendo Impostazioni dopo aver scorso la home
// si vedeva per mezzo secondo il fondo della pagina (le notifiche) e poi un
// salto secco verso l'alto. Next riporta su da solo, ma lo fa dopo il primo
// disegno, ed è lì che nasce lo sfarfallio.
//
// useLayoutEffect e non useEffect: il primo agisce prima che lo schermo si
// aggiorni, quindi il salto non è mai visibile.
//
// In questa app va bene azzerare sempre: si naviga con la barra in basso e con
// i link "indietro", che sono spostamenti in avanti a tutti gli effetti, non
// un ritorno del browser a una posizione salvata.
export default function ScrollToTop() {
  const pathname = usePathname()

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return null
}
