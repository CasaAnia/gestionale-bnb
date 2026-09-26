'use client'
import Link from 'next/link'
import DaControllare from './DaControllare'
import AvvisoAzione from './AvvisoAzione'
import NotaCliente from './richieste/NotaCliente'
import { BOTTONE_PIENO } from './BottoniWhatsApp'
import type { useRichiesteWeb } from '@/lib/webRequests'
import type { useDaControllare } from '@/lib/daControllareDati'

const data = (giorno: string) => new Date(giorno + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
export default function RichiesteHome({ web, controlli }: { web: ReturnType<typeof useRichiesteWeb>; controlli: ReturnType<typeof useDaControllare> }) {
  const aperte = controlli.stato === 'pronto' && controlli.eccezioni.some(e => e.tipo === 'richiesta')
  if (!web.richieste.length && !aperte && web.stato !== 'errore' && controlli.stato !== 'errore') return null
  return <section id="richieste-home" className="mb-5 scroll-mt-20" aria-label="Richieste di prenotazione">
    <h2 className="ed-sezione mb-1">Richieste di prenotazione</h2>
    {web.stato === 'errore' && <AvvisoAzione testo={web.errore} onRiprova={web.ricarica} className="my-2" />}
    {web.richieste.map(r => <article key={r.id} className="py-3 border-b border-card-border" data-richiesta-web={r.id}>
      <p className="text-[10px] uppercase tracking-[1.5px] text-brass">Dal sito · da confermare</p>
      <p className="text-[15px] font-semibold text-green-dark mt-0.5">{r.guest_name}</p>
      <p className="text-[13px] text-stone mt-1">{data(r.check_in)} – {data(r.check_out)}</p>
      <p className="text-[13px] text-stone">{r.room_name} · {r.num_guests} {r.num_guests === 1 ? 'ospite' : 'ospiti'}</p>
      <NotaCliente note={r.notes} piccola className="mt-1" />
      {r.nome_diverso && <p className="text-[13px] text-red-700 mt-1">Il numero risulta in archivio come {r.nome_archivio}: verifica il nominativo.</p>}
      <Link className={`${BOTTONE_PIENO} inline-block mt-2.5`} href={`/scheda/${r.id}`}>Apri richiesta</Link>
    </article>)}
    <DaControllare dati={controlli} richieste />
  </section>
}
