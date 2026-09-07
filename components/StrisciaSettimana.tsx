'use client'
// Striscia della settimana (07/09/2026), sotto i tre numeri e sopra «Da
// controllare»: didascalia piccola in grigio, poi 28 caselle da oggi che
// scorrono di lato col dito (7 visibili sul telefono, 14 sul Mac), giorno in
// alto («sab 6») e sotto le camere con pulizie ancora da fare quel giorno;
// «✓» attenuato se sono tutte fatte, «—» attenuato se non c'è nulla; la casella
// di oggi (variante «F» scelta da Ania il 07/09/2026) ha SOLO «Oggi» in
// grassetto verde #2D6A4F al posto del giorno: nessuno sfondo, nessun bordo,
// nessun altro colore (numero, «—», «✓» e ⇄ come le altre); divisorio ottone
// sottile fra una settimana e l'altra. Un tocco apre Pulizie su quel giorno; un tocco
// sulla didascalia riporta a oggi. Cifre come le altre della Home
// (font-serif text-2xl text-green-dark), nessun colore nuovo.
import { useRef } from 'react'
import Link from 'next/link'
import { etichettaGiornoBreve, testoCasella, simboliCambi, type GiornoStriscia } from '@/lib/numeriOggi'

// Segnale ⇄ dei cambi camera (06/09/2026): ottone, grassetto, 13 px; lo spazio sopra e
// sotto il numero è sempre riservato, così le caselle restano uguali e i numeri allineati
const CAMBIO = { color: '#A9884E', fontWeight: 700, fontSize: 13, lineHeight: '14px', height: 14 } as const

// Casella di oggi (variante «F», 07/09/2026): solo la scritta «Oggi» in grassetto verde
const OGGI = { testo: '#2D6A4F' } as const

export const DIDASCALIA_STRISCIA = 'Camere da preparare nei prossimi 7 giorni'

export default function StrisciaSettimana({ giorni }: { giorni: GiornoStriscia[] }) {
  const scorrevole = useRef<HTMLDivElement>(null)
  // Salto diretto (non «smooth»): sicuro anche con animazioni ridotte o pannello nascosto
  const tornaAOggi = () => scorrevole.current?.scrollTo({ left: 0, behavior: 'auto' })
  return (
    <section className="mb-4" data-striscia-settimana>
      <button type="button" onClick={tornaAOggi} className="text-[12px] mb-1 text-left" style={{ color: 'var(--color-stone)' }}>{DIDASCALIA_STRISCIA}</button>
      <div ref={scorrevole} className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory border-b border-card-border">
        {giorni.map(g => { const c = testoCasella(g); const s = simboliCambi(g.cambi); return (
          <Link key={g.giorno} href={`/pulizie?giorno=${g.giorno}`} data-giorno={g.giorno} data-camere={g.daFare} data-fatte={g.fatte} data-tono={c.tono}
            className="snap-start shrink-0 basis-[14.2857%] lg:basis-[7.1428%] flex flex-col items-center justify-center py-1.5"
            style={g.inizioSettimana ? { borderLeft: '1px solid rgba(169,136,78,0.55)' } : undefined}>
            <span className="text-[11px] leading-none" style={g.oggi ? { color: OGGI.testo, fontWeight: 700 } : { color: 'var(--color-stone)' }}>{g.oggi ? 'Oggi' : etichettaGiornoBreve(g.giorno)}</span>
            <span aria-hidden data-cambi-sopra={s.sopra ? 1 : 0} style={CAMBIO}>{s.sopra ? '⇄' : ''}</span>
            <span className={`numero-classico relative ${c.tono === 'numero' ? 'text-green-dark' : 'text-gray-400'}`} data-cambi={g.cambi}>
              {c.testo}
              {s.centro && <span aria-hidden className="absolute inset-0 flex items-center justify-center" style={{ ...CAMBIO, height: undefined, lineHeight: 1 }}>⇄</span>}
            </span>
            <span aria-hidden data-cambi-sotto={s.sotto ? 1 : 0} style={CAMBIO}>{s.sotto ? '⇄' : ''}</span>
          </Link>
        ) })}
      </div>
    </section>
  )
}
