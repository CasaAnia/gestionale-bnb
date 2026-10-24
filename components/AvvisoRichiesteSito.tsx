'use client'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { nomeCompleto, nottiRichiesta, formatDateRichiesta, tempoTrascorso } from '@/lib/richieste'
import { CHIAVE_VISTE, EVENTO_VISTE, idsViste, nuoveRichieste } from '@/lib/richiesteSitoViste'

type Richiesta = { id: string; nome: string; cognome: string; telefono: string | null; arrivo: string; partenza: string; notti_richieste?: string[] | null; created_at: string; rooms: { name: string } | null }
// Le richieste attuali sono nella tabella richieste; il vecchio avviso per
// bookings/source=sito_web rimane invariato. Nessun invio o cambio di stato.
export default function AvvisoRichiesteSito() {
  const pathname = usePathname()
  const [richieste, setRichieste] = useState<Richiesta[]>([])
  const [viste, setViste] = useState<string[]>([])
  const [errore, setErrore] = useState(false)
  const [tentativo, setTentativo] = useState(0)
  const [rimandate, setRimandate] = useState<string[]>([])
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
          const { data, error } = await supabase.from('richieste').select('id,nome,cognome,telefono,arrivo,partenza,notti_richieste,created_at,rooms(name)')
            .eq('canale', 'web').eq('stato', 'in_attesa').order('created_at').order('id').range(da, da + 499)
          if (error || !data) throw new Error('lettura richieste')
          tutte.push(...data as unknown as Richiesta[])
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
    const riapertura = () => {
      if (document.visibilityState === 'visible') setRimandate([])
      aggiorna()
    }
    document.addEventListener('visibilitychange', riapertura)
    window.addEventListener(EVENTO_VISTE, memoria)
    window.addEventListener('storage', memoria)
    return () => {
      attivo = false
      window.clearInterval(timer)
      window.removeEventListener('focus', aggiorna)
      document.removeEventListener('visibilitychange', riapertura)
      window.removeEventListener(EVENTO_VISTE, memoria)
      window.removeEventListener('storage', memoria)
    }
  }, [pathname, tentativo])
  if (pathname === '/login') return null
  const nuove = nuoveRichieste(richieste, viste)
  const daMostrare = nuoveRichieste(nuove, rimandate)
  const prima = daMostrare[0]
  if (!prima) return errore ? <aside role="status" className="mx-4 my-3 rounded-lg px-4 py-3" style={{ background: '#F3EBDD', border: '1px solid #A9884E' }}>
    Non riesco ad aggiornare le richieste dal sito. <button className="underline" onClick={() => setTentativo(n => n + 1)}>Riprova</button>
  </aside> : null
  return <PopupRichiesta key={prima.id} prima={prima} errore={errore} onRiprova={() => setTentativo(n => n + 1)} onDopo={() => setRimandate(nuove.map(r => r.id))} />
}

function PopupRichiesta({ prima, errore, onRiprova, onDopo }: { prima: Richiesta; errore: boolean; onRiprova: () => void; onDopo: () => void }) {
  const riquadro = useRef<HTMLDivElement>(null)
  const chiudi = useRef(onDopo)
  useEffect(() => { chiudi.current = onDopo }, [onDopo])
  useEffect(() => {
    const primaDelPopup = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    riquadro.current?.focus()
    const tastiera = (event: KeyboardEvent) => {
      if (event.key === 'Escape') chiudi.current()
      if (event.key !== 'Tab') return
      const elementi = riquadro.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])')
      if (!elementi?.length) return
      const primo = elementi[0], ultimo = elementi[elementi.length - 1]
      if (event.shiftKey && (document.activeElement === primo || document.activeElement === riquadro.current)) { event.preventDefault(); ultimo.focus() }
      else if (!event.shiftKey && (document.activeElement === ultimo || document.activeElement === riquadro.current)) { event.preventDefault(); primo.focus() }
    }
    window.addEventListener('keydown', tastiera)
    return () => { document.body.style.overflow = overflow; window.removeEventListener('keydown', tastiera); primaDelPopup?.focus?.() }
  }, [])
  return <div role="dialog" aria-modal="true" aria-labelledby="titolo-avviso-sito" data-popup-richiesta-sito
    style={{ position: 'fixed', inset: 0, zIndex: 95, background: 'rgba(24, 32, 27, .62)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, overflowY: 'auto' }}>
    <div ref={riquadro} tabIndex={-1} style={{ outline: 'none', maxHeight: 'calc(100dvh - 40px)', overflowY: 'auto', width: '100%', maxWidth: 380, background: '#FBF9F4', border: '2px solid #A9884E', borderRadius: 20, padding: '22px 24px 18px', boxShadow: '0 24px 90px #0005', textAlign: 'center', fontFamily: 'var(--font-jost), sans-serif' }}>
      <p style={{ color: '#8B6C39', fontSize: 12, letterSpacing: '2px', fontWeight: 600 }}>CASA ANIA · RICHIESTE</p>
      <div aria-hidden style={{ width: 52, height: 52, background: '#EEE4D2', borderRadius: '50%', margin: '12px auto 10px', display: 'grid', placeItems: 'center', fontSize: 30 }}>🔔</div>
      <h2 id="titolo-avviso-sito" style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1, color: '#1F3D2F', marginBottom: 12 }}>Nuova richiesta<br />dal sito</h2>
      <div style={{ margin: '0 0 16px', lineHeight: 1.25 }}>
        <p style={{ color: '#6E6558', fontSize: 14, fontWeight: 400, marginBottom: 2 }}>{nomeCompleto(prima)}{prima.telefono && <span style={{ marginLeft: 6, whiteSpace: 'nowrap' }}>· {prima.telefono}</span>}</p>
        <p style={{ color: '#6E6558', fontSize: 14 }}>{formatDateRichiesta(prima)} · {nottiRichiesta(prima)} {nottiRichiesta(prima) === 1 ? 'notte' : 'notti'}</p>
        <p style={{ color: '#6E6558', fontSize: 14, fontWeight: 400, marginTop: 2 }}>Camera richiesta: {prima.rooms?.name ?? 'nessuna preferenza'}</p>
        <p style={{ display: 'inline-block', color: '#8E4D36', background: '#F2E5DC', borderRadius: 6, padding: '6px 12px', fontSize: 14, fontWeight: 600, marginTop: 12 }}>Ricevuta {tempoTrascorso(prima.created_at)} · ancora da leggere</p>
      </div>
      {errore && <p role="status" style={{ color: '#8E4D36', fontSize: 13, marginBottom: 12 }}>Non riesco ad aggiornare le richieste. <button className="underline" onClick={onRiprova}>Riprova</button></p>}
      <Link href={`/richieste/${prima.id}`} style={{ display: 'block', background: '#1F3D2F', color: 'white', borderRadius: 10, padding: '16px 10px', fontSize: 18, fontWeight: 700, textDecoration: 'none' }}>Apri richiesta</Link>
      <button type="button" onClick={onDopo} style={{ display: 'block', width: '100%', border: '1px solid #C9BDA7', background: 'transparent', color: '#1F3D2F', borderRadius: 10, padding: '12px 10px', fontSize: 17, fontWeight: 500, marginTop: 10 }}>Dopo</button>
      <p style={{ color: '#847B6E', fontSize: 12, lineHeight: 1.4, marginTop: 12 }}>Con “Dopo” resta da vedere.</p>
    </div>
  </div>
}
