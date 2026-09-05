'use client'
// Striscia della settimana (07/09/2026), sotto i tre numeri e sopra «Da
// controllare»: didascalia piccola in grigio, poi 28 caselle da oggi che
// scorrono di lato col dito (7 visibili sul telefono, 14 sul Mac), giorno in
// alto («sab 6») e sotto le camere da preparare quel giorno; «—» attenuato
// senza lavoro; oggi su #F3ECD8 con bordo ottone; divisorio ottone sottile
// fra una settimana e l'altra. Un tocco apre Pulizie su quel giorno; un tocco
// sulla didascalia riporta a oggi. Cifre come le altre della Home
// (font-serif text-2xl text-green-dark), nessun colore nuovo.
import { useRef } from 'react'
import Link from 'next/link'
import { etichettaGiornoBreve, type GiornoStriscia } from '@/lib/numeriOggi'

export const DIDASCALIA_STRISCIA = 'Camere da preparare nei prossimi 7 giorni'

export default function StrisciaSettimana({ giorni }: { giorni: GiornoStriscia[] }) {
  const scorrevole = useRef<HTMLDivElement>(null)
  // Salto diretto (non «smooth»): sicuro anche con animazioni ridotte o pannello nascosto
  const tornaAOggi = () => scorrevole.current?.scrollTo({ left: 0, behavior: 'auto' })
  return (
    <section className="mb-4" data-striscia-settimana>
      <button type="button" onClick={tornaAOggi} className="text-[12px] text-gray-500 mb-1.5 text-left">{DIDASCALIA_STRISCIA}</button>
      <div ref={scorrevole} className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory rounded-[10px] bg-white border border-[#C9BFA8] shadow-sm">
        {giorni.map(g => (
          <Link key={g.giorno} href={`/pulizie?giorno=${g.giorno}`} data-giorno={g.giorno} data-camere={g.camere}
            className="snap-start shrink-0 basis-[14.2857%] lg:basis-[7.1428%] flex flex-col items-center justify-center py-2 min-h-[58px] rounded-[8px]"
            style={{
              ...(g.oggi ? { background: '#F3ECD8', boxShadow: 'inset 0 0 0 1px #A9884E' } : {}),
              ...(g.inizioSettimana ? { borderLeft: '1px solid #A9884E' } : {}),
            }}>
            <span className="text-[11px] leading-none" style={{ color: g.oggi ? '#1F3D2F' : 'var(--color-stone)' }}>{etichettaGiornoBreve(g.giorno)}</span>
            {g.camere > 0
              ? <span className="font-serif text-2xl text-green-dark leading-tight mt-1">{g.camere}</span>
              : <span className="font-serif text-2xl text-gray-400 leading-tight mt-1">—</span>}
          </Link>
        ))}
      </div>
    </section>
  )
}
