'use client'
// Mattoni condivisi del nuovo guscio spese (Fase 3.1) — direzione B.
import type { ReactNode } from 'react'
import {
  ShoppingBasket, UtensilsCrossed, Home, Shirt, Car, GraduationCap, Coffee,
  Sparkles, BedDouble, Receipt, Dumbbell,
} from 'lucide-react'
import { TEMA as t } from './tema'

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

export const Chip = ({ attivo, children, tono = 'verde', onClick, aria }: {
  attivo?: boolean; children: ReactNode; tono?: 'verde' | 'neutro'; onClick?: () => void; aria?: string
}) => (
  <button type="button" onClick={onClick} aria-label={aria} aria-pressed={attivo}
    className="inline-flex items-center gap-1 min-h-9 px-3 text-[13px] font-semibold"
    style={attivo
      ? { background: tono === 'verde' ? t.verde : t.inchiostro, color: '#fff', borderRadius: t.rPill }
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
