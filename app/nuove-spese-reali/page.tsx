// NUOVE SPESE — PROVA SUI DATI REALI (Fase 3.2A), in SOLA LETTURA.
//
// SOLO SVILUPPO: fuori dal dev locale risponde notFound(). A differenza di
// /nuove-spese (dati finti), QUESTA route NON ha il bypass nel proxy: serve
// il login vero, e si legge col client anon + sessione dell'utente (RLS).
// Nessuna service role nel browser, nessuna scrittura, nessuna RPC economica.
// Le pagine ufficiali restano /spese e /spese-famiglia.
import { notFound } from 'next/navigation'
import RealiClient from './RealiClient'

export const metadata = { title: 'Nuove spese · dati reali (solo sviluppo)' }

export default function PaginaNuoveSpeseReali() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <RealiClient />
}
