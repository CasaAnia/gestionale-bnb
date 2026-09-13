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

// `top`: dove si ferma. La proposta usa `top-0`; la scheda prenotazione
// (13/09/2026) `top-12 lg:top-0`, sotto la barra alta del telefono, come la
// testa di Calendario/Arrivi/Richieste (TestaPagina). `spaziatura`: le
// lettere spaziate (px); la scheda usa 0,6 come la fascia delle Richieste.
export default function FasciaSezioni({ voci, className = '', top = 'top-0', spaziatura = 1 }: { voci: VoceSezione[]; className?: string; top?: string; spaziatura?: number }) {
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

  // Quale parte si sta guardando: l'ultima che ha già passato la fascia.
  // In fondo alla pagina vince sempre l'ultima parte: se è corta non arriva
  // mai sotto la fascia e senza questa regola non si accenderebbe mai.
  useEffect(() => {
    const guarda = () => {
      // 12 e non 8: la parte raggiunta con «vaiA» si ferma 8 px sotto la fascia
      // e con gli arrotondamenti dello scorrimento poteva restare fuori di un pelo
      const soglia = (barraRef.current?.getBoundingClientRect().bottom ?? 0) + 12
      const inFondo = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2
      const presenti = voci.filter(v => document.getElementById(v.id))
      if (inFondo && presenti.length > 0) { setAttiva(presenti[presenti.length - 1].id); return }
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
    // Dove si ferma la fascia (top-12 sul telefono = 48 px sotto la barra
    // alta): la parte deve arrivare SOTTO la fascia, non sotto la barra
    const fermaA = barraRef.current ? parseFloat(getComputedStyle(barraRef.current).top) || 0 : 0
    const y = el.getBoundingClientRect().top + window.scrollY - fermaA - alto - 8
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
    setAttiva(id)
  }

  if (voci.length === 0) return null

  return (
    <div ref={barraRef} data-fascia-sezioni className={`sticky ${top} z-40 ${className}`}
      style={{ background: 'var(--color-cream)', borderTop: `1px solid ${FILO}`, borderBottom: `1px solid ${FILO}` }}>
      <div ref={rigaRef} className="flex items-center justify-between gap-2 py-2.5 overflow-hidden whitespace-nowrap" style={{ fontSize: misura }}>
        {voci.map(v => {
          const accesa = v.id === attiva
          return (
            <button key={v.id} type="button" onClick={() => vaiA(v.id)} aria-current={accesa ? 'true' : undefined}
              className="shrink-0 uppercase transition-colors"
              style={{ letterSpacing: `${spaziatura}px`, fontWeight: accesa ? 700 : 500, color: accesa ? OTTONE : 'var(--color-stone)' }}>
              {v.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
