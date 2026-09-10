'use client'
import { useRouter } from 'next/navigation'
import { smartBack } from '@/lib/navHistory'
import { useRegistraIndietro } from './BackContext'

// Unico stile ufficiale del pulsante indietro: grassetto, verde scuro,
// hover verso il verde medio. py-2/-my-2 allarga l'area di tocco su
// mobile senza spostare nulla visivamente.
const CLASSES = 'inline-block text-green-dark font-bold hover:text-green-mid transition-colors whitespace-nowrap rounded-sm py-2 -my-2 pr-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid'

// "Indietro" torna alla pagina precedente vera (come la freccia del
// browser): dal calendario si torna al calendario, dagli arrivi agli
// arrivi. `href` è solo la riserva per quando una pagina precedente
// dentro l'app non esiste, ad es. aprendo un link diretto.
//
// Sul telefono questo pulsante non si vede (lo nasconde il contenitore
// `.indietro-barra`): al suo posto c'è la freccia ‹ nella barra in alto,
// che chiama la stessa identica azione registrata qui sotto.
export default function BackLink({ href, onClick, label = 'Indietro' }: { href?: string; onClick?: () => void; label?: string }) {
  const router = useRouter()
  const content = <><span aria-hidden="true">←</span> {label}</>
  const handleClick = onClick ?? (() => smartBack(router, href))
  useRegistraIndietro(handleClick, label)
  return <button type="button" onClick={handleClick} className={CLASSES}>{content}</button>
}
