'use client'
// L'anteprima è SOLO client (niente resa dal server): così lo stato letto
// dall'URL (?v=&c=&t=&filtri=&rev=) è deterministico, senza gare di
// idratazione — viste negli screenshot automatici della Fase 3A.
import dynamic from 'next/dynamic'

const Anteprima = dynamic(() => import('./Anteprima'), { ssr: false })

export default function AnteprimaClient() {
  return <Anteprima />
}
