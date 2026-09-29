'use client'
// Le richieste dentro il riepilogo che si apre in cima alla Home (veste
// «Maison», 28/09/2026): per ognuna «Dal sito · da confermare», il nome in
// Cormorant, le date, camera e ospiti, la nota del cliente in mattone e
// «Apri richiesta». Sotto, le eccezioni di tipo richiesta di «Da
// controllare», con «Rimanda» come prima.
import Link from 'next/link'
import DaControllare from './DaControllare'
import AvvisoAzione from './AvvisoAzione'
import NotaCliente from './richieste/NotaCliente'
import type { useRichiesteWeb } from '@/lib/webRequests'
import type { useDaControllare } from '@/lib/daControllareDati'
import { hrefScheda } from '@/lib/provenienzaScheda'

const data = (giorno: string) => new Date(giorno + 'T12:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
export default function RichiesteHome({ web, controlli }: { web: ReturnType<typeof useRichiesteWeb>; controlli: ReturnType<typeof useDaControllare> }) {
  const aperte = controlli.stato === 'pronto' && controlli.eccezioni.some(e => e.tipo === 'richiesta')
  if (!web.richieste.length && !aperte && web.stato !== 'errore' && controlli.stato !== 'errore') return null
  return <section id="richieste-home" className="scroll-mt-4" aria-label="Richieste di prenotazione">
    {web.stato === 'errore' && <AvvisoAzione testo={web.errore} onRiprova={web.ricarica} className="my-2" />}
    {web.richieste.map(r => <article key={r.id} className="it" data-richiesta-web={r.id}>
      <p className="mz-eyebrow">Dal sito · da confermare</p>
      <p className="nm">{r.guest_name}</p>
      <p className="sm">{data(r.check_in)} – {data(r.check_out)}<br />{r.room_name} · {r.num_guests} {r.num_guests === 1 ? 'ospite' : 'ospiti'}</p>
      <NotaCliente note={r.notes} maison className="sm nota" />
      {r.nome_diverso && <p className="sm nota">Il numero risulta in archivio come {r.nome_archivio}: verifica il nominativo.</p>}
      <Link className="mz-lnk" href={hrefScheda(r.id, 'home')}>Apri richiesta</Link>
    </article>)}
    <DaControllare dati={controlli} richieste />
  </section>
}
