'use client'
// ============================================================================
// FASCIA DELLE SEZIONI (11/09/2026, veste approvata da Ania): la barretta che
// resta ferma in cima mentre la pagina scorre e dice a che punto si è.
// Toccando una voce la pagina scivola a quella parte; scorrendo si accende da
// sola la voce della parte che si sta guardando.
//
// Le voci stanno SEMPRE su una riga sola: se non ci entrano, il testo si
// rimpicciolisce un poco invece di andare a capo.
// ============================================================================
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export type VoceSezione = { id: string; label: string }

const OTTONE = '#A9884E'
const FILO = 'rgba(169,136,78,0.55)'
const MISURA_PIENA = 10      // px
const MISURA_MINIMA = 7.5    // px: sotto non si scende, meglio stretto che illeggibile

export default function FasciaSezioni({ voci, className = '' }: { voci: VoceSezione[]; className?: string }) {
  const [attiva, setAttiva] = useState<string>(voci[0]?.id ?? '')
  const [misura, setMisura] = useState(MISURA_PIENA)
  const barraRef = useRef<HTMLDivElement>(null)
  const rigaRef = useRef<HTMLDivElement>(null)

  // Il testo si restringe finché le voci stanno su una riga sola
  const adatta = useCallback(() => {
    const riga = rigaRef.current
    if (!riga) return
    let m = MISURA_PIENA
    riga.style.fontSize = `${m}px`
    while (riga.scrollWidth > riga.clientWidth + 1 && m > MISURA_MINIMA) {
      m = Math.round((m - 0.5) * 10) / 10
      riga.style.fontSize = `${m}px`
    }
    setMisura(m)
  }, [])

  useLayoutEffect(() => {
    adatta()
    const riga = rigaRef.current
    if (!riga || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => adatta())
    ro.observe(riga)
    return () => ro.disconnect()
  }, [adatta, voci])

  // Quale parte si sta guardando: l'ultima che ha già passato la fascia
  useEffect(() => {
    const guarda = () => {
      const soglia = (barraRef.current?.getBoundingClientRect().bottom ?? 0) + 8
      let corrente = voci[0]?.id ?? ''
      for (const v of voci) {
        const el = document.getElementById(v.id)
        if (el && el.getBoundingClientRect().top <= soglia) corrente = v.id
      }
      setAttiva(corrente)
    }
    guarda()
    window.addEventListener('scroll', guarda, { passive: true })
    window.addEventListener('resize', guarda)
    return () => { window.removeEventListener('scroll', guarda); window.removeEventListener('resize', guarda) }
  }, [voci])

  function vaiA(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const alto = barraRef.current?.getBoundingClientRect().height ?? 0
    const y = el.getBoundingClientRect().top + window.scrollY - alto - 8
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    setAttiva(id)
  }

  if (voci.length === 0) return null

  return (
    <div ref={barraRef} data-fascia-sezioni className={`sticky top-0 z-40 ${className}`}
      style={{ background: 'var(--color-cream)', borderTop: `1px solid ${FILO}`, borderBottom: `1px solid ${FILO}` }}>
      <div ref={rigaRef} className="flex items-center justify-between gap-2 py-2.5 overflow-hidden whitespace-nowrap" style={{ fontSize: misura }}>
        {voci.map(v => {
          const accesa = v.id === attiva
          return (
            <button key={v.id} type="button" onClick={() => vaiA(v.id)} aria-current={accesa ? 'true' : undefined}
              className="shrink-0 uppercase transition-colors"
              style={{ letterSpacing: '1px', fontWeight: accesa ? 700 : 500, color: accesa ? OTTONE : 'var(--color-stone)' }}>
              {v.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
