'use client'
import Link from 'next/link'
import type { ReactNode } from 'react'

// ============================================================================
// I COMANDI DELLA PAGINA DELLE RICHIESTE, TUTTI DELLA STESSA FAMIGLIA
// (Ania, su bozza, 12/09/2026).
//
// Sopra il calendario e sotto sembravano due pagine diverse: bottoni tondi
// verdi, pastiglie di misure diverse, un tasto col contorno. Adesso tutti i
// comandi — Reale/Presunta, «+ Nuova richiesta», gli avvisi e l'ordinamento —
// hanno la misura e il carattere delle etichettine della Home (CHECK-IN,
// ⇄ CAMBIO): piccole, squadrate, in grassetto.
//
// L'unica cosa PIENA della pagina resta la pastiglia verde tonda dell'azione,
// dentro la riga della richiesta (vedi AzioniRichiesta).
// ============================================================================

const CREMA = '#EFEADF'

export const ALTEZZA_VOCE = 22        // le parole dell'interruttore
export const ALTEZZA_TASTO = 24       // «+ Nuova richiesta»
export const ANGOLI_INTERRUTTORE = 6
export const ANGOLI_VOCE = 4

// ── L'interruttore squadrato ────────────────────────────────────────────────
// Fondo crema, 2 px di bordo interno, angoli 6. Le parole alte 22 px, 11,5
// bold, color stone; quella scelta su fondo bianco con angoli 4 e verde scuro.
// Lo usano sia «Reale / Presunta» sia «Ordina»: sono la stessa cosa.
export function InterruttoreSquadrato<T extends string>({ etichetta, voci, scelta, onScegli, nome, dati }: {
  etichetta?: string
  voci: readonly (readonly [T, string])[]
  scelta: T
  onScegli: (v: T) => void
  nome: string
  dati?: string
}) {
  return (
    <span className="inline-flex items-center gap-2 shrink-0">
      {etichetta && <span style={{ fontSize: 11, color: 'var(--color-stone)' }}>{etichetta}</span>}
      <span role="group" aria-label={nome} data-interruttore={dati}
        className="inline-flex shrink-0" style={{ background: CREMA, padding: 2, borderRadius: ANGOLI_INTERRUTTORE }}>
        {voci.map(([v, label]) => {
          const presa = scelta === v
          return (
            <button key={v} type="button" onClick={() => onScegli(v)} aria-pressed={presa}
              className="inline-flex items-center justify-center transition-colors"
              style={{
                height: ALTEZZA_VOCE,
                padding: '0 10px',
                borderRadius: ANGOLI_VOCE,
                fontSize: 11.5,
                fontWeight: 700,
                color: presa ? 'var(--color-green-dark)' : 'var(--color-stone)',
                background: presa ? '#fff' : 'transparent',
              }}>
              {label}
            </button>
          )
        })}
      </span>
    </span>
  )
}

// ── «+ Nuova richiesta» ─────────────────────────────────────────────────────
// Alto 24 px, fondo sage, testo green-mid 11,5 bold, angoli 4, 9 px ai lati.
// Niente contorno e niente verde pieno: il verde pieno è dell'azione.
export function TastoNuovaRichiesta({ testo = '+ Nuova richiesta', className = '' }: { testo?: string; className?: string }) {
  return (
    <Link href="/richieste/nuova" data-nuova-richiesta
      className={`inline-flex items-center justify-center shrink-0 bg-sage text-green-mid ${className}`}
      style={{ height: ALTEZZA_TASTO, padding: '0 9px', borderRadius: ANGOLI_VOCE, fontSize: 11.5, fontWeight: 700 }}>
      {testo}
    </Link>
  )
}

// ── Gli avvisi ──────────────────────────────────────────────────────────────
// Etichettine alte come le altre: angoli 4, 11 bold, 2 px sopra e sotto e 7
// ai lati. «N nuove dal sito» sage su green-mid; «N da guardare» nei colori
// del ⇄ CAMBIO della Home.
export const AVVISO_SITO = { background: 'var(--color-sage)', color: 'var(--color-green-mid)' } as const
export const AVVISO_GUARDARE = { background: '#EFE2C7', color: '#7A5C1E' } as const
const MISURA_AVVISO = { borderRadius: ANGOLI_VOCE, fontSize: 11, fontWeight: 700, padding: '2px 7px', lineHeight: '18px' } as const

export function EtichettaAvviso({ colori, dati, children }: { colori: typeof AVVISO_SITO | typeof AVVISO_GUARDARE; dati: string; children: ReactNode }) {
  return (
    <span data-avviso={dati} className="inline-flex items-center gap-1 shrink-0" style={{ ...MISURA_AVVISO, ...colori }}>{children}</span>
  )
}

// Lo stesso avviso, ma si tocca: «N da guardare» accende e spegne il filtro.
// L'area utile resta di 44 px senza alzare la riga (margini negativi).
export function TastoAvviso({ colori, dati, premuto, onClick, children }: {
  colori: typeof AVVISO_SITO | typeof AVVISO_GUARDARE
  dati: string
  premuto: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button type="button" data-avviso={dati} aria-pressed={premuto} onClick={onClick}
      className="inline-flex items-center shrink-0 py-[12px] -my-[12px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid">
      <span className="inline-flex items-center gap-1" style={{ ...MISURA_AVVISO, ...colori }}>{children}</span>
    </button>
  )
}
