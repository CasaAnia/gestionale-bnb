'use client'
import { useEffect, useRef, useState } from 'react'
import AvvisoAzione from './AvvisoAzione'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'

// Resta disponibile anche quando un rinvio/salto salvato con risposta persa
// ha già tolto la pulizia dalla lista di oggi.
export default function SalvataggiPulizie({ onVerificato }: { onVerificato?: () => void }) {
  const [camere, setCamere] = useState<string[]>([])
  const [errore, setErrore] = useState<string | null>(null)
  const [inCorso, setInCorso] = useState(false)
  const blocco = useRef(false)
  useEffect(() => {
    const leggi = () => {
      try {
        const elenco: string[] = []
        const prefisso = 'casa-ania:pulizia:v1:'
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(prefisso)) elenco.push(k.slice(prefisso.length)) }
        setCamere(elenco)
      } catch { setErrore('Non riesco a leggere i salvataggi delle pulizie conservati sul dispositivo.') }
    }
    const t = window.setTimeout(leggi, 0)
    for (const e of ['storage', 'focus', 'pulizie-salvataggi']) window.addEventListener(e, leggi)
    return () => { window.clearTimeout(t); for (const e of ['storage', 'focus', 'pulizie-salvataggi']) window.removeEventListener(e, leggi) }
  }, [])
  async function verifica() {
    if (blocco.current) return
    blocco.current = true; setInCorso(true); setErrore(null)
    try {
      for (const camera of camere) {
        const r = await inviaOperazionePulizia(camera, null)
        if (r.errore) { setErrore(r.errore); return }
      }
      setCamere([]); ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); onVerificato?.()
    } finally { blocco.current = false; setInCorso(false) }
  }
  if (!camere.length && !errore) return null
  return <div className="mb-4" data-salvataggi-pulizie>
    <AvvisoAzione testo={errore || (inCorso ? 'Verifico il salvataggio della pulizia…' : 'Un salvataggio delle pulizie attende conferma. Puoi verificarlo senza duplicarlo.')} onRiprova={inCorso ? undefined : () => void verifica()} />
  </div>
}
