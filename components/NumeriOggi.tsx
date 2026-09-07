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
import type { useNumeriOggi } from '@/lib/numeriOggiDati'
import { testoOccupate } from '@/lib/numeriOggi'
import StrisciaSettimana from './StrisciaSettimana'

// «2 su 4» tutto nello stesso carattere e colore del numero (Ania, 07/09/2026:
// come «Occupazione» nelle Statistiche, niente «su 4» piccolo e grigio sfalsato).
// Numero in alto ed etichetta in basso, riquadri di altezza uguale: i tre
// numeri stanno sulla stessa linea di base e le etichette su UNA riga sola
// anche a 320 px (carattere 9 px, spaziatura ridotta, «oggi» che sparisce
// sotto i 360 px). Richiesta di Ania dell'08/09/2026.
function Riquadro({ href, etichetta, codaEtichetta, valore, coda }: { href: string; etichetta: string; codaEtichetta?: string; valore: string; coda?: string }) {
  return (
    <Link href={href} className="px-1 py-3 min-w-0 flex flex-col items-center justify-between transition-transform duration-100 active:scale-[0.98] first:border-l-0 border-l border-card-border">
      <p className="numero-classico whitespace-nowrap" data-numero={valore}>
        {valore}{coda && <span data-coda> {coda}</span>}
      </p>
      <p className="text-[9px] uppercase tracking-[1.5px] text-stone leading-none whitespace-nowrap overflow-hidden mt-2.5" data-etichetta>
        {etichetta}{codaEtichetta && <span className="max-[359px]:hidden"> {codaEtichetta}</span>}
      </p>
    </Link>
  )
}

// Dal 07/09/2026 la lettura la fa la Home (useNumeriOggi) e la passa qui e a
// «Pulizie di oggi»: una sola lettura per i numeri, la striscia e la lista
export default function NumeriOggi({ dati: n }: { dati: ReturnType<typeof useNumeriOggi> }) {
  const pronto = n.stato === 'pronto'
  const trattino = '–'
  return (
    <>
      <section className="mb-4" data-stato={n.stato}>
        {/* Stile editoriale (06/09/2026): tre numeri fra due fili ottone, separati da fili crema */}
        <div className="grid grid-cols-3" style={{ borderTop: '1px solid rgba(169,136,78,0.55)', borderBottom: '1px solid rgba(169,136,78,0.55)' }}>
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
