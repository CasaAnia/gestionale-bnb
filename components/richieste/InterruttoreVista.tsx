'use client'
import type { Vista } from '@/lib/richiesteVista'
import InterruttorePillola from '@/components/InterruttorePillola'

// Interruttore a due voci. Reale = solo prenotazioni confermate; Presunta =
// confermate più richieste in attesa / con proposta inviata.
//
// Veste del 12/09/2026 (Ania, dal telefono): esattamente il selettore
// «Mese | 2 settimane» del Calendario — components/InterruttorePillola, usato
// da tutt'e due le pagine. Prima era un interruttore squadrato color crema e
// sotto il calendario non sembrava parente di quello della pagina accanto.
const VOCI = [['reale', 'Reale'], ['presunta', 'Presunta']] as const

export default function InterruttoreVista({ vista, onChange }: { vista: Vista; onChange: (v: Vista) => void }) {
  return (
    <InterruttorePillola voci={VOCI} scelta={vista} onScegli={onChange} nome="Vista del calendario" dati="vista" />
  )
}
