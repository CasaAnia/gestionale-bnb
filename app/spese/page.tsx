import SpeseTracker from '@/components/SpeseTracker'
import SpesePagina from '@/components/spese/SpesePagina'

// Spese del B&B (Casa Ania). Dalla Fase 3.2B apre il NUOVO guscio
// (direzione B) sull'ambito azienda. Il vecchio tracker resta raggiungibile
// con ?vecchia=1 come ripristino temporaneo, fino alla pulizia finale.
export default async function SpeseBnBPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  if (sp.vecchia !== undefined) return <SpeseTracker ambito="azienda" title="Spese B&B" />
  return <SpesePagina ambito="azienda" />
}
