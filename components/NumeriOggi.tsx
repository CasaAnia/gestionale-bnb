'use client'
// Tre numeri in cima alla Home (07/09/2026): «Arrivi oggi», «Partenze oggi»,
// «Occupate stanotte» su quelle attive. Tre riquadri affiancati nello stile
// delle schede (bianco, bordo #C9BFA8, ombra leggera); cifre ESATTAMENTE come
// le altre della Home (font-serif text-2xl text-green-dark, niente Fraunces),
// etichetta in Nunito Sans; toccabili: arrivi e partenze aprono
// Arrivi su oggi, le camere aprono il Calendario su oggi. Lettura fallita =
// trattino al posto del numero + avviso con Riprova, mai uno zero finto.
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import { useNumeriOggi } from '@/lib/numeriOggiDati'
import { testoOccupate } from '@/lib/numeriOggi'
import StrisciaSettimana from './StrisciaSettimana'

function Riquadro({ href, etichetta, valore, coda }: { href: string; etichetta: string; valore: string; coda?: string }) {
  return (
    <Link href={href} className="bg-white rounded-[10px] border border-[#C9BFA8] shadow-sm px-3 py-3 min-w-0 transition-transform duration-100 active:scale-[0.98]">
      <p className="text-[10px] uppercase tracking-[1.5px] text-brass leading-tight">{etichetta}</p>
      <p className="font-serif text-2xl text-green-dark leading-none mt-1.5" data-numero={valore}>
        {valore}{coda && <span className="text-base text-gray-400"> {coda}</span>}
      </p>
    </Link>
  )
}

export default function NumeriOggi() {
  const n = useNumeriOggi()
  const pronto = n.stato === 'pronto'
  const trattino = '–'
  return (
    <>
      <section className="mb-4" data-stato={n.stato}>
        <div className="grid grid-cols-3 gap-2">
          <Riquadro href="/arrivi" etichetta="Arrivi oggi" valore={pronto ? String(n.numeri.arriviOggi) : trattino} />
          <Riquadro href="/arrivi" etichetta="Partenze oggi" valore={pronto ? String(n.numeri.partenzeOggi) : trattino} />
          <Riquadro href={`/calendario?giorno=${n.oggi}`} etichetta="Occupate stanotte" valore={pronto ? String(n.numeri.camereOccupate) : trattino} coda={pronto ? testoOccupate(n.numeri).replace(/^\d+ /, '') : undefined} />
        </div>
        {n.stato === 'errore' && <AvvisoAzione testo={n.errore} onRiprova={n.ricarica} className="mt-2" />}
      </section>
      {/* Striscia della settimana: stessa lettura dei tre numeri (28 giorni); con errore o in caricamento non compare */}
      {pronto && <StrisciaSettimana giorni={n.settimana} />}
    </>
  )
}
