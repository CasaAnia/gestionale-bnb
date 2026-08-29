'use client'
// Mattoni condivisi del nuovo guscio spese (Fase 3.1) — direzione B.
import { useEffect, useRef, type ReactNode } from 'react'
import {
  ShoppingBasket, UtensilsCrossed, Home, Shirt, Car, GraduationCap, Coffee,
  Sparkles, BedDouble, Receipt, Dumbbell,
} from 'lucide-react'
import { TEMA as t } from './tema'

// Foglio dal basso accessibile: Escape chiude, il focus parte dal foglio,
// la pagina sotto non scorre finché è aperto. Con `piede` l'azione finale
// resta FISSA in fondo al foglio anche quando il contenuto scorre.
export function Foglio({ aria, chiudi, children, scorrevole, piede }: {
  aria: string; chiudi: () => void; children: ReactNode; scorrevole?: boolean; piede?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const prima = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    ref.current?.focus()
    const suTasto = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudi() }
    document.addEventListener('keydown', suTasto)
    return () => {
      document.body.style.overflow = prima
      document.removeEventListener('keydown', suTasto)
    }
  }, [chiudi])
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={aria}>
      <button className="absolute inset-0" style={{ background: 'rgba(20,25,20,.45)' }} onClick={chiudi} aria-label="Chiudi" />
      <div ref={ref} tabIndex={-1}
        className={`relative flex flex-col outline-none ${scorrevole ? 'max-h-[85dvh]' : ''}`}
        style={{ background: t.fondo, borderRadius: `${t.r} ${t.r} 0 0` }}>
        <div className="mx-auto w-10 h-1 rounded-full mt-3 mb-4 shrink-0" style={{ background: t.bordo }} />
        <div className={`px-5 ${scorrevole ? 'overflow-y-auto min-h-0' : ''} ${piede ? '' : 'pb-[calc(env(safe-area-inset-bottom)+20px)]'}`}>
          {children}
        </div>
        {piede && (
          <div className="shrink-0 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+16px)]"
            style={{ borderTop: `1px solid ${t.bordo}`, background: t.fondo }}>
            {piede}
          </div>
        )}
      </div>
    </div>
  )
}

export const Card = ({ children, className = '', tinta }: { children: ReactNode; className?: string; tinta?: string }) => (
  <div className={className}
    style={{ background: tinta || t.carta, borderRadius: t.r, boxShadow: t.ombra, border: t.bordoCarta }}>
    {children}
  </div>
)

export const Etichetta = ({ children, extra }: { children: ReactNode; extra?: string }) => (
  <p className={`text-[11px] uppercase tracking-[0.12em] font-semibold mb-2 ${extra ?? ''}`}
    style={{ color: t.sub }}>{children}</p>
)

export const Barra = ({ quota, colore }: { quota: number; colore: string }) => (
  <div className="h-1.5 w-full overflow-hidden" style={{ background: t.velo, borderRadius: 99 }}>
    <div className="h-full" style={{ width: `${Math.min(100, quota)}%`, background: colore, borderRadius: 99 }} />
  </div>
)

// `colore` = accento del contesto (verde Casa Mia, terracotta Casa Ania)
export const Chip = ({ attivo, children, tono = 'accento', colore = t.verde, onClick, aria }: {
  attivo?: boolean; children: ReactNode; tono?: 'accento' | 'neutro'; colore?: string; onClick?: () => void; aria?: string
}) => (
  <button type="button" onClick={onClick} aria-label={aria} aria-pressed={attivo}
    className="inline-flex items-center gap-1 min-h-11 px-3.5 text-[13px] font-semibold"
    style={attivo
      ? { background: tono === 'accento' ? colore : t.inchiostro, color: '#fff', borderRadius: t.rPill }
      : { background: t.carta, color: t.inchiostro, border: `1px solid ${t.bordo}`, borderRadius: t.rPill }}>
    {children}
  </button>
)

const ICONE: Record<string, typeof Coffee> = {
  'Spesa alimentare': ShoppingBasket, 'Mangiare fuori': UtensilsCrossed,
  'Casa e consumabili': Home, 'Abbigliamento': Shirt, 'Auto e trasporti': Car,
  'Scuola e formazione': GraduationCap, 'Colazioni e bevande': Coffee,
  'Pulizia e detergenti': Sparkles, 'Biancheria': BedDouble,
  'Sport e hobby': Dumbbell,
}
export const IconaCategoria = ({ nome, tenue }: { nome: string; tenue?: boolean }) => {
  const I = ICONE[nome] || Receipt
  return (
    <span className="grid place-items-center w-9 h-9 shrink-0"
      style={{ background: tenue ? t.velo : t.verdeTenue, color: t.verde, borderRadius: t.rIcona }}>
      <I size={17} strokeWidth={2.2} />
    </span>
  )
}

// pastiglia piccola di stato/indicazione (foto, dubbi, scadenze…)
export const Pastiglia = ({ icona: I, testo, tono }: {
  icona?: typeof Coffee; testo: string; tono?: 'giallo' | 'rosso' | 'verde' | 'terra'
}) => (
  <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-px"
    style={{
      background: tono === 'rosso' || tono === 'terra' ? t.terraTenue : tono === 'giallo' ? t.gialloTenue : tono === 'verde' ? t.verdeTenue : t.velo,
      color: tono === 'rosso' ? t.rosso : tono === 'terra' ? t.terracotta : tono === 'giallo' ? t.giallo : tono === 'verde' ? t.verde : t.sub,
      borderRadius: t.rPill,
    }}>
    {I && <I size={11} />} {testo}
  </span>
)
