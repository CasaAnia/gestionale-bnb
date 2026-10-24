'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { CHIAVE_VISTE, EVENTO_VISTE, idsViste, nuoveRichieste } from '@/lib/richiesteSitoViste'

type Richiesta = { id: string }
// Le richieste attuali sono nella tabella richieste; il vecchio avviso per
// bookings/source=sito_web rimane invariato. Nessun invio o cambio di stato.
export default function AvvisoRichiesteSito() {
  const pathname = usePathname()
  const [richieste, setRichieste] = useState<Richiesta[]>([])
  const [viste, setViste] = useState<string[]>([])
  const [errore, setErrore] = useState(false)
  const [tentativo, setTentativo] = useState(0)
  useEffect(() => {
    let attivo = true
    let inCorso = false
    function memoria() {
      try { setViste(idsViste(localStorage.getItem(CHIAVE_VISTE))) }
      catch { setViste([]) }
    }
    async function carica() {
      if (inCorso || document.visibilityState === 'hidden' || pathname === '/login') return
      inCorso = true
      try {
        const tutte: Richiesta[] = []
        for (let da = 0; ; da += 500) {
          const { data, error } = await supabase.from('richieste').select('id')
            .eq('canale', 'web').eq('stato', 'in_attesa').order('created_at').order('id').range(da, da + 499)
          if (error || !data) throw new Error('lettura richieste')
          tutte.push(...data)
          if (data.length < 500) break
        }
        if (attivo) { setRichieste(tutte); setErrore(false); memoria() }
      } catch { if (attivo) setErrore(true) }
      finally { inCorso = false }
    }
    memoria()
    void carica()
    const timer = window.setInterval(() => { void carica() }, 30000)
    const aggiorna = () => { void carica() }
    window.addEventListener('focus', aggiorna)
    document.addEventListener('visibilitychange', aggiorna)
    window.addEventListener(EVENTO_VISTE, memoria)
    window.addEventListener('storage', memoria)
    return () => {
      attivo = false
      window.clearInterval(timer)
      window.removeEventListener('focus', aggiorna)
      document.removeEventListener('visibilitychange', aggiorna)
      window.removeEventListener(EVENTO_VISTE, memoria)
      window.removeEventListener('storage', memoria)
    }
  }, [pathname, tentativo])
  if (pathname === '/login') return null
  const nuove = nuoveRichieste(richieste, viste)
  if (!nuove.length && !errore) return null
  return <aside aria-label="Nuove richieste dal sito" aria-live="polite" data-avviso-richieste-sito
    className={`mx-4 mt-3 rounded-lg px-4 py-3 lg:mx-8 lg:mb-3 ${pathname === "/" || pathname.startsWith("/richieste/") ? "mb-[60px]" : "mb-3"}`} style={{ background: '#F3EBDD', border: '1px solid #A9884E' }}>
    {nuove.length > 0 && <><strong className="block text-sm">{nuove.length === 1 ? 'Hai una nuova richiesta dal sito' : `Hai ${nuove.length} nuove richieste dal sito`}</strong>
      <Link className="underline text-sm" href={`/richieste/${nuove[0].id}`}>Apri {nuove.length === 1 ? 'la richiesta' : 'la prima richiesta'}</Link></>}
    {errore && <p className="text-sm">Non riesco ad aggiornare le richieste dal sito. <button className="underline" onClick={() => setTentativo(n => n + 1)}>Riprova</button></p>}
  </aside>
}
