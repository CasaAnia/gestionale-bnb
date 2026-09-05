'use client'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'
import { giorniTra } from '@/lib/richiesteCalendario'

// Striscia delle notti, una casella per notte: è la stessa fila di caselle
// «Seleziona i giorni con letto extra» della scheda prenotazione
// (app/prenotazioni/[id], date cliccabili notte per notte), resa componente
// e estesa a un VALORE per notte (pezzo 9: persone per notte nella richiesta;
// pezzo 10: camera per notte in «Scelgo io», con prezzo e tocco lungo).
// Un tocco cicla il valore; su desktop le frecce ↑/→ e ↓/← fanno lo stesso,
// Tab passa fra le caselle; con `opzioni` compare anche un menu a tendina per
// casella. Va a capo da sola oltre le caselle che stanno in una riga (nessuno
// scorrimento laterale a 390 px).

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export function etichettaNotte(iso: string): string {
  const [, m, g] = iso.split('-').map(Number)
  return `${g} ${MESI[m - 1]}`
}

export type Opzione<T> = { valore: T; etichetta: string }

type Props<T extends number | string | null> = {
  arrivo: string
  partenza: string
  valori: T[]                      // uno per notte, lungo quanto giorniTra(arrivo, partenza)
  onChange: (valori: T[]) => void
  // valore successivo/precedente per la notte i (default: numeri da min a max)
  cicla?: (valore: T, verso: 1 | -1, i: number) => T
  min?: number
  max?: number
  // come si mostra una casella: centro (grande) e riga sotto; default: numero + unità
  mostra?: (valore: T, i: number) => { centro: ReactNode; sotto?: ReactNode; sopra?: ReactNode; evidenziata?: boolean; contorno?: string }
  unita?: (n: number) => string
  // desktop: opzioni del menu a tendina per la notte i (se assenti, niente menu)
  opzioni?: (i: number) => Opzione<T>[]
  menuDesktop?: boolean
  // tocco lungo (o matita su desktop) su una casella
  onLungo?: (i: number) => void
  disabilitata?: boolean
  aria?: string
}

export default function StrisciaNotti<T extends number | string | null>({
  arrivo, partenza, valori, onChange, cicla, min = 1, max = 4, mostra, unita = () => 'pers.', opzioni, menuDesktop = false, onLungo, disabilitata = false, aria = 'Notte per notte',
}: Props<T>) {
  const notti = giorniTra(arrivo, partenza)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lungoScattato = useRef(false)
  const ciclaNumero = (v: number, verso: 1 | -1) => {
    const n = v + verso
    if (n > max) return min
    if (n < min) return max
    return n
  }
  const successivo = (v: T, verso: 1 | -1, i: number): T => (cicla ? cicla(v, verso, i) : (ciclaNumero(Number(v ?? min), verso) as T))
  const imposta = (i: number, v: T) => onChange(notti.map((_, k) => (k === i ? v : valori[k])))

  function tasti(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); imposta(i, successivo(valori[i], 1, i)) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); imposta(i, successivo(valori[i], -1, i)) }
    else if (e.key === 'Home') { e.preventDefault(); refs.current[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); refs.current[notti.length - 1]?.focus() }
  }
  // tocco lungo: 500 ms fermi sulla casella → onLungo; un tocco breve cicla
  function giu(i: number) {
    if (!onLungo) return
    lungoScattato.current = false
    timer.current = setTimeout(() => { lungoScattato.current = true; onLungo(i) }, 500)
  }
  function su() { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label={aria}>
      {notti.map((g, i) => {
        const v = valori[i]
        const resa = mostra ? mostra(v, i) : { centro: String(v ?? min), sotto: unita(Number(v ?? min)), evidenziata: v !== valori[0] }
        const fondo = resa.evidenziata ? '#2D6A4F' : 'white'
        const colore = resa.evidenziata ? '#F5EFE4' : '#1F3D2F'
        const bordo = resa.contorno ?? (resa.evidenziata ? '#2D6A4F' : '#E8E3D8')
        const menu = menuDesktop && opzioni ? opzioni(i) : null
        return (
          <div key={g} className="relative min-w-[52px]" style={{ flex: '0 1 auto' }}>
            <button ref={el => { refs.current[i] = el }} type="button" disabled={disabilitata}
              onClick={() => { if (lungoScattato.current) { lungoScattato.current = false; return } imposta(i, successivo(v, 1, i)) }}
              onKeyDown={e => tasti(e, i)}
              onPointerDown={() => giu(i)} onPointerUp={su} onPointerLeave={su} onPointerCancel={su}
              onContextMenu={e => { if (onLungo) e.preventDefault() }}
              aria-label={`Notte del ${etichettaNotte(g)}: ${typeof resa.centro === 'string' ? resa.centro : v ?? ''}${resa.sotto && typeof resa.sotto === 'string' ? ` ${resa.sotto}` : ''}. Tocca per cambiare${onLungo ? ', tieni premuto per il prezzo' : ''}`}
              className="w-full px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors text-center leading-tight disabled:opacity-50 select-none"
              style={{ background: fondo, color: colore, borderColor: bordo, borderWidth: resa.contorno ? 2 : 1, WebkitTouchCallout: 'none' }}>
              <span className="block text-[10px] font-normal opacity-80">{resa.sopra ?? etichettaNotte(g)}</span>
              <span className="block text-base tabular-nums truncate">{resa.centro}</span>
              {resa.sotto !== undefined && <span className="block text-[10px] font-normal opacity-80 truncate">{resa.sotto}</span>}
            </button>
            {menu && (
              <select aria-label={`Camera della notte del ${etichettaNotte(g)}`} value={String(v ?? '')} disabled={disabilitata}
                onChange={e => { const o = menu.find(x => String(x.valore ?? '') === e.target.value); if (o) imposta(i, o.valore) }}
                className="mt-1 w-full text-[11px] bg-white border border-[#C9BFA8] shadow-sm rounded-md px-1 py-0.5 text-green-dark">
                {menu.map(o => <option key={String(o.valore ?? 'null')} value={String(o.valore ?? '')}>{o.etichetta}</option>)}
              </select>
            )}
            {onLungo && menuDesktop && (
              <button type="button" aria-label={`Prezzo della notte del ${etichettaNotte(g)}`} onClick={() => onLungo(i)}
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-white border border-[#C9BFA8] flex items-center justify-center text-stone">
                <Pencil size={11} aria-hidden />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
