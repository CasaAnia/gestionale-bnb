'use client'
import { useRef, type KeyboardEvent } from 'react'
import { giorniTra } from '@/lib/richiesteCalendario'

// Striscia delle notti, una casella per notte: è la stessa fila di caselle
// «Seleziona i giorni con letto extra» della scheda prenotazione
// (app/prenotazioni/[id], date cliccabili notte per notte), resa componente
// e estesa a un VALORE per notte (pezzo 9: persone per notte nella richiesta).
// Un tocco cicla il valore (min → max → min); su desktop le frecce ↑/→ e ↓/←
// fanno lo stesso, ←/→ con Tab passano fra le caselle. Va a capo da sola
// quando le notti sono più di quante ne stanno in una riga (nessuno
// scorrimento laterale a 390 px).

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export function etichettaNotte(iso: string): string {
  const [, m, g] = iso.split('-').map(Number)
  return `${g} ${MESI[m - 1]}`
}

type Props = {
  arrivo: string
  partenza: string
  valori: number[]                 // uno per notte, lungo quanto giorniTra(arrivo, partenza)
  min?: number
  max: number
  onChange: (valori: number[]) => void
  unita?: (n: number) => string    // etichetta sotto il numero (default: «pers.»)
  disabilitata?: boolean
}

export default function StrisciaNotti({ arrivo, partenza, valori, min = 1, max, onChange, unita = () => 'pers.', disabilitata = false }: Props) {
  const notti = giorniTra(arrivo, partenza)
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const cicla = (v: number, verso: 1 | -1) => {
    const n = v + verso
    if (n > max) return min
    if (n < min) return max
    return n
  }
  const imposta = (i: number, v: number) => onChange(notti.map((_, k) => (k === i ? v : (valori[k] ?? valori[0] ?? min))))

  function tasti(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); imposta(i, cicla(valori[i] ?? min, 1)) }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); imposta(i, cicla(valori[i] ?? min, -1)) }
    else if (e.key === 'Home') { e.preventDefault(); refs.current[0]?.focus() }
    else if (e.key === 'End') { e.preventDefault(); refs.current[notti.length - 1]?.focus() }
  }

  return (
    <div className="flex flex-wrap gap-1" role="group" aria-label="Notte per notte">
      {notti.map((g, i) => {
        const v = valori[i] ?? min
        const diverso = v !== (valori[0] ?? min)
        return (
          <button key={g} ref={el => { refs.current[i] = el }} type="button" disabled={disabilitata}
            onClick={() => imposta(i, cicla(v, 1))} onKeyDown={e => tasti(e, i)}
            aria-label={`Notte del ${etichettaNotte(g)}: ${v} ${unita(v)}. Tocca per cambiare`}
            className="min-w-[52px] px-2 py-1.5 rounded-lg text-xs font-semibold border transition-colors text-center leading-tight disabled:opacity-50"
            style={{ background: diverso ? '#2D6A4F' : 'white', color: diverso ? '#F5EFE4' : '#1F3D2F', borderColor: diverso ? '#2D6A4F' : '#E8E3D8' }}>
            <span className="block text-[10px] font-normal opacity-80">{etichettaNotte(g)}</span>
            <span className="block text-base tabular-nums">{v}</span>
            <span className="block text-[10px] font-normal opacity-80">{unita(v)}</span>
          </button>
        )
      })}
    </div>
  )
}
