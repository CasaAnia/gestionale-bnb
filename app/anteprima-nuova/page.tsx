// ANTEPRIMA NUOVA PRENOTAZIONE — prototipo visivo locale (09/09/2026).
//
// SOLO SVILUPPO: fuori dal dev locale risponde notFound(), come
// /anteprima-spese. Dati esclusivamente sintetici: nessuna query a Supabase,
// nessuna scrittura. Non tocca /nuova né /prenotazioni.
import { notFound } from 'next/navigation'
import AnteprimaNuova from './AnteprimaNuova'

export const metadata = { title: 'Anteprima nuova prenotazione (solo sviluppo)' }

export default function PaginaAnteprimaNuova() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <AnteprimaNuova />
}
