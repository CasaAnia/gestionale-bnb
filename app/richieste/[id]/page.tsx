import { redirect } from 'next/navigation'
import { propostaDellaRichiesta } from '@/lib/richieste'

// /richieste/<id> (link delle notifiche push e della Home): la schermata utile
// per una richiesta è quella della proposta, che mostra anche le richieste già
// inviate. Il `?da=` del punto di partenza attraversa il rimbalzo, altrimenti
// la freccia «Indietro» della proposta non saprebbe più da dove si veniva.
export default async function RichiestaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ da?: string }> }) {
  const { id } = await params
  const { da } = await searchParams
  redirect(propostaDellaRichiesta(id, da))
}
