import SpeseTracker from '@/components/SpeseTracker'

// Spese del B&B (azienda). Usa lo stesso tracker ricco di Spese Famiglia,
// ma sull'ambito 'azienda': queste spese contano nel profitto della struttura.
export default function SpeseBnBPage() {
  return <SpeseTracker ambito="azienda" title="Spese B&B" />
}
