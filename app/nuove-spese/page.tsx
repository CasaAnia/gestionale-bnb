// NUOVE SPESE — prova del guscio reale (Fase 3.1).
//
// SOLO SVILUPPO: fuori dal dev locale questa pagina risponde notFound(),
// anche in caso di deploy accidentale (e il proxy, in produzione, chiede
// comunque il login prima di arrivarci: doppia serratura).
// Dati esclusivamente sintetici: nessuna query a Supabase.
// Non tocca /spese, /spese-famiglia né SpeseTracker.
import { notFound } from 'next/navigation'
import NuoveSpeseClient from './NuoveSpeseClient'

export const metadata = { title: 'Nuove spese (solo sviluppo)' }

export default function PaginaNuoveSpese() {
  if (process.env.NODE_ENV !== 'development') notFound()
  return <NuoveSpeseClient />
}
