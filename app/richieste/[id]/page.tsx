import { redirect } from 'next/navigation'

// /richieste/<id> (link delle notifiche push): la schermata utile per una
// richiesta è quella della proposta, che mostra anche le richieste già inviate.
export default async function RichiestaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  redirect(`/richieste/${id}/proposta`)
}
