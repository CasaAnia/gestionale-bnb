'use client'
import type { Vista } from '@/lib/richiesteVista'
import { InterruttoreSquadrato } from './ComandiPagina'

// Interruttore a due voci. Reale = solo prenotazioni confermate; Presunta =
// confermate più richieste in attesa / con proposta inviata.
//
// Veste del 12/09/2026 (Ania, su bozza): la stessa di TUTTI i comandi della
// pagina — l'interruttore squadrato di ComandiPagina, con la misura delle
// etichettine della Home. Prima era una pillola tonda più grande e sotto il
// calendario non sembrava parente di quello che le stava intorno.
const VOCI = [['reale', 'Reale'], ['presunta', 'Presunta']] as const

export default function InterruttoreVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <InterruttoreSquadrato voci={VOCI} scelta={vista} onScegli={onChange} nome="Vista del calendario" dati="vista" />
  )
}
