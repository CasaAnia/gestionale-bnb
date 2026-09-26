'use client'
// Striscia della settimana (07/09/2026), sotto i tre numeri e sopra «Da
// controllare»: 28 caselle da oggi, con descrizione accessibile, che
// scorrono di lato col dito (7 visibili sul telefono, 14 sul Mac), giorno in
// alto («sab 6») e sotto le camere con pulizie ancora da fare quel giorno;
// «✓» attenuato se sono tutte fatte, «—» attenuato se non c'è nulla; la casella
// di oggi (variante «F» scelta da Ania il 07/09/2026) ha SOLO «Oggi» al posto
// del giorno, nello stesso grassetto del nome cliente in «Da controllare»
// (Nunito Sans 600, verde scuro #1F3D2F) ma piccolo come i giorni accanto:
// nessuno sfondo, nessun bordo, nessun altro colore (numero, «—», «✓» e ⇄
// come le altre); divisorio ottone sottile fra una settimana e l'altra. Un tocco apre Pulizie su quel giorno; un tocco
// apre la pagina del giorno. Cifre come le altre della Home
// (font-serif text-2xl text-green-dark), nessun colore nuovo.
import Link from 'next/link'
import { etichettaGiornoBreve, testoCasella, simboliCambi, type GiornoStriscia } from '@/lib/numeriOggi'

// Segnale ⇄ dei cambi camera (06/09/2026): ottone, grassetto, 13 px; lo spazio sopra e
// sotto il numero è sempre riservato, così le caselle restano uguali e i numeri allineati
const CAMBIO = { color: '#A9884E', fontWeight: 700, fontSize: 13, lineHeight: '14px', height: 14 } as const

// Casella di oggi (variante «F», 07/09/2026): solo «Oggi», stesso grassetto e verde scuro del nome cliente
const OGGI = { testo: '#1F3D2F', peso: 600 } as const

export const DIDASCALIA_STRISCIA = 'Camere da preparare nei prossimi 7 giorni'

export default function StrisciaSettimana({ giorni }: { giorni: GiornoStriscia[] }) {
  return (
    <section className="mb-5" aria-label={DIDASCALIA_STRISCIA} data-striscia-settimana>
      <div className="flex overflow-x-auto no-scrollbar snap-x snap-mandatory" style={{ borderBottom: '1px solid rgba(169,136,78,0.55)' }}>
        {giorni.map(g => { const c = testoCasella(g); const s = simboliCambi(g.cambi); return (
          <Link key={g.giorno} href={`/pulizie?giorno=${g.giorno}`} data-giorno={g.giorno} data-camere={g.daFare} data-fatte={g.fatte} data-tono={c.tono}
            className="snap-start shrink-0 basis-[14.2857%] lg:basis-[7.1428%] flex flex-col items-center justify-center py-1.5"
            style={g.inizioSettimana ? { borderLeft: '1px solid rgba(169,136,78,0.55)' } : undefined}>
            <span className="text-[11px] leading-none" style={g.oggi ? { color: OGGI.testo, fontWeight: OGGI.peso } : { color: 'var(--color-stone)' }}>{g.oggi ? 'Oggi' : etichettaGiornoBreve(g.giorno)}</span>
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
