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

// Numero in alto ed etichetta in basso, riquadri di altezza uguale: i tre
// numeri stanno sulla stessa linea di base e le etichette su UNA riga sola
// anche a 320 px (carattere 9 px, spaziatura ridotta, «oggi» che sparisce
// sotto i 360 px). Richiesta di Ania dell'08/09/2026.
function Riquadro({ href, etichetta, codaEtichetta, valore, coda }: { href: string; etichetta: string; codaEtichetta?: string; valore: string; coda?: string }) {
  return (
    <Link href={href} className="bg-white rounded-[10px] border border-[#C9BFA8] shadow-sm px-2.5 py-2.5 min-w-0 min-h-[68px] flex flex-col justify-between transition-transform duration-100 active:scale-[0.98]">
      <p className="font-serif text-2xl text-green-dark leading-none whitespace-nowrap" data-numero={valore}>
        {valore}{coda && <span className="text-base text-gray-400"> {coda}</span>}
      </p>
      <p className="text-[9px] uppercase tracking-[0.5px] text-brass leading-none whitespace-nowrap overflow-hidden mt-2" data-etichetta>
        {etichetta}{codaEtichetta && <span className="max-[359px]:hidden"> {codaEtichetta}</span>}
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
          <Riquadro href="/arrivi" etichetta="Arrivi" codaEtichetta="oggi" valore={pronto ? String(n.numeri.arriviOggi) : trattino} />
          <Riquadro href="/arrivi" etichetta="Partenze" codaEtichetta="oggi" valore={pronto ? String(n.numeri.partenzeOggi) : trattino} />
          <Riquadro href={`/calendario?giorno=${n.oggi}`} etichetta="Occupate" valore={pronto ? String(n.numeri.camereOccupate) : trattino} coda={pronto ? testoOccupate(n.numeri).replace(/^\d+ /, '') : undefined} />
        </div>
        {n.stato === 'errore' && <AvvisoAzione testo={n.errore} onRiprova={n.ricarica} className="mt-2" />}
      </section>
      {/* Striscia della settimana: stessa lettura dei tre numeri (28 giorni); con errore o in caricamento non compare */}
      {pronto && <StrisciaSettimana giorni={n.settimana} />}
    </>
  )
}
