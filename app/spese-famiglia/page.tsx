import SpeseTracker from '@/components/SpeseTracker'
import SpesePagina from '@/components/spese/SpesePagina'

// Spese Famiglia (Casa Mia). Dalla Fase 3.2B apre il NUOVO guscio
// (direzione B) sull'ambito personale. Il vecchio tracker resta
// raggiungibile con ?vecchia=1 come ripristino temporaneo.
export default async function SpeseFamigliaPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  if (sp.vecchia !== undefined) return <SpeseTracker ambito="personale" title="Spese Famiglia" />
  return <SpesePagina ambito="personale" />
}
