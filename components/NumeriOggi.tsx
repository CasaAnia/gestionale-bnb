'use client'
// Quattro numeri in cima alla Home (veste «Maison», 28/09/2026; prima tre,
// dal 07/09/2026): «Arrivi oggi», «Partenze oggi», «Occupate» «4 su 4» e
// «Da incassare €» (la somma dei residui della sezione Da incassare). Cifre
// in Cormorant sottile, etichetta maiuscoletta grigia, fra due fili d'ottone
// e con un filo sottile fra un numero e l'altro. Toccabili: arrivi e
// partenze aprono Arrivi, le camere il Calendario su oggi, «Da incassare»
// scorre alla sua sezione. Lettura fallita = trattino al posto del numero +
// avviso con Riprova, mai uno zero finto.
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import type { useNumeriOggi } from '@/lib/numeriOggiDati'
import { testoOccupate } from '@/lib/numeriOggi'
import StrisciaSettimana from './StrisciaSettimana'

export const ID_DA_INCASSARE = 'da-incassare'

function Numero({ href, etichetta, valore, coda, onClick }: { href: string; etichetta: string; valore: string; coda?: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <Link href={href} onClick={onClick}>
      <b data-numero={valore}>{valore}{coda && <small data-coda> {coda}</small>}</b>
      <span data-etichetta>{etichetta}</span>
    </Link>
  )
}

// La lettura la fa la Home (useNumeriOggi) e la passa qui e a «Pulizie di
// oggi»: una sola lettura per i numeri, la striscia e la lista. Il quarto
// numero arriva dai dati del mese (null = non ancora letto: trattino).
export default function NumeriOggi({ dati: n, daIncassareEuro = null }: { dati: ReturnType<typeof useNumeriOggi>; daIncassareEuro?: number | null }) {
  const pronto = n.stato === 'pronto'
  const trattino = '–'
  return (
    <>
      <section data-stato={n.stato} data-numeri-oggi>
        <div className="mz-nums">
          <Numero href="/arrivi" etichetta="Arrivi oggi" valore={pronto ? String(n.numeri.arriviOggi) : trattino} />
          <Numero href="/arrivi" etichetta="Partenze oggi" valore={pronto ? String(n.numeri.partenzeOggi) : trattino} />
          <Numero href={`/calendario?giorno=${n.oggi}`} etichetta="Occupate" valore={pronto ? String(n.numeri.camereOccupate) : trattino} coda={pronto ? testoOccupate(n.numeri).replace(/^\d+ /, '') : undefined} />
          <Numero href={`#${ID_DA_INCASSARE}`} etichetta="Da incassare €" valore={daIncassareEuro == null ? trattino : daIncassareEuro.toLocaleString('it-IT', { maximumFractionDigits: 0 })}
            onClick={e => { e.preventDefault(); document.getElementById(ID_DA_INCASSARE)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }} />
        </div>
        {n.stato === 'errore' && <AvvisoAzione testo={n.errore} onRiprova={n.ricarica} className="mt-2 mx-[22px]" />}
      </section>
      {/* Striscia della settimana: stessa lettura dei numeri (28 giorni); con errore o in caricamento non compare */}
      {pronto && <StrisciaSettimana giorni={n.settimana} />}
    </>
  )
}
