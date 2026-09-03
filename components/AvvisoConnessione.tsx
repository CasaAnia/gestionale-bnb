'use client'
// Avviso in alto, in tutta l'app, quando manca la linea o il server non
// risponde. Prima (3 set 2026) senza rete la home mostrava tutti gli importi
// a zero senza dire nulla: qui invece si dice chiaramente che il problema è
// la connessione. «Riprova» fa una richiesta leggera: se il server risponde
// ricarica la pagina con i dati veri, altrimenti lo dice.
import { useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { ascoltaConnessione, statoConnessione } from '@/lib/connessione'

function ascoltaLinea(cb: () => void) {
  window.addEventListener('online', cb)
  window.addEventListener('offline', cb)
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) }
}

export default function AvvisoConnessione() {
  const pathname = usePathname()
  const serverGiu = useSyncExternalStore(ascoltaConnessione, () => statoConnessione().serverIrraggiungibile, () => false)
  const senzaLinea = useSyncExternalStore(ascoltaLinea, () => navigator.onLine === false, () => false)
  const [provo, setProvo] = useState(false)
  const [esito, setEsito] = useState<string | null>(null)

  if (pathname === '/login') return null
  if (!serverGiu && !senzaLinea) return null

  const titolo = senzaLinea ? 'Nessuna connessione a internet' : 'Il server non risponde'
  const testo = senzaLinea
    ? 'Il telefono è senza linea (Wi‑Fi o dati). Quello che vedi può essere vecchio o incompleto.'
    : 'Non riesco a raggiungere il server: controlla la linea. Quello che vedi può essere vecchio o incompleto.'

  async function riprova() {
    setProvo(true)
    setEsito(null)
    const { error } = await supabase.from('rooms').select('id').limit(1)
    if (!error) { window.location.reload(); return }
    setProvo(false)
    setEsito('Ancora niente: il server non risponde.')
  }

  return (
    // Nel flusso della pagina (sposta il contenuto, non lo copre) e «sticky»:
    // resta in vista anche scorrendo, sotto la barra del titolo su telefono.
    <div role="alert" className="scheda-in sticky top-12 lg:top-0 z-30 px-3 pt-2 pb-1">
      <div className="mx-auto max-w-[520px] rounded-xl px-4 py-3 shadow-md" style={{ background: '#F4E6DF', color: '#7A3B22' }}>
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-bold">⚠️ {titolo}</p>
            <p className="text-[12.5px] mt-0.5" style={{ color: '#8a5049' }}>{esito ?? testo}</p>
          </div>
          <button onClick={riprova} disabled={provo}
            className="shrink-0 rounded-lg bg-white px-3 py-2 text-[13px] font-semibold shadow-sm transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
            style={{ color: '#7A3B22' }}>
            {provo ? 'Provo…' : 'Riprova'}
          </button>
        </div>
      </div>
    </div>
  )
}
