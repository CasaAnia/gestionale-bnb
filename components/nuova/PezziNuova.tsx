'use client'
// ============================================================================
// I PEZZI della pagina «Nuova prenotazione» (14/09/2026): titoletti, campi a
// riga, pastiglie e tastini. Stanno insieme perché sono la stessa veste,
// ripetuta in tutte le parti della pagina — e sono la veste della scheda:
// titoletto in ottone maiuscolo col filo (ed-sezione), righe col filo sotto,
// niente riquadri.
// ============================================================================
import type { ReactNode } from 'react'

export const OTTONE = '#A9884E'
export const MATTONE = '#8C3B2E'
export const GEORGIA = "Georgia, 'Times New Roman', serif"
export const ALTEZZA_PASTIGLIA = 30
export const BORDO_SPENTA = '#C9BFA8'
export const SOPRA_ETICHETTA = 22
export const SOTTO_ETICHETTA = 10

/** L'etichettina piccola sopra un gruppo: «CAMERA», «OSPITI», «SCONTO»… */
export function Etichetta({ testo, centrata = false, primo = false, className = '' }: { testo: string; centrata?: boolean; primo?: boolean; className?: string }) {
  return (
    <p data-etichetta className={`uppercase ${centrata ? 'text-center' : ''} ${className}`}
      style={{ fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)', marginTop: primo ? 0 : SOPRA_ETICHETTA, marginBottom: SOTTO_ETICHETTA }}>{testo}</p>
  )
}

/** Una riga di campo col filo sotto, senza riquadro */
export function RigaCampo({ etichetta, children, className = '' }: { etichetta: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-card-border)' }}>
      <span className="block uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)' }}>{etichetta}</span>
      {children}
    </label>
  )
}

export const stileCampo = {
  width: '100%', minWidth: 0, marginTop: 3, background: 'transparent', border: 'none', outline: 'none',
  fontSize: 15, color: 'var(--color-green-dark)',
} as const

/** La pastiglia scelta/non scelta, la stessa della Home e di «Come paga» */
export function Pastiglia({ acceso, onClick, spenta = false, colore, children, dati }: {
  acceso: boolean
  onClick?: () => void
  spenta?: boolean
  /** per «!» problematico: mattone quando è acceso */
  colore?: string
  children: ReactNode
  dati?: string
}) {
  return (
    <button type="button" data-pastiglia={dati} aria-pressed={acceso} disabled={spenta} onClick={onClick} className="py-[7px] -my-[7px]"
      style={{
        height: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 12px', fontSize: 12.5, fontWeight: 600,
        background: acceso ? (colore ?? 'var(--color-green-mid)') : 'transparent',
        color: spenta ? '#B9B6AD' : acceso ? 'var(--color-cream)' : 'var(--color-green-dark)',
        border: `1px solid ${acceso ? (colore ?? 'var(--color-green-mid)') : BORDO_SPENTA}`,
      }}>{children}</button>
  )
}

export function FilaPastiglie({ children, centrata = false, className = '' }: { children: ReactNode; centrata?: boolean; className?: string }) {
  return <div className={`flex flex-wrap ${centrata ? 'justify-center' : ''} ${className}`} style={{ gap: 6 }}>{children}</div>
}

/** Il tasto verde piccolo, centrato: «Avanti · date e camera», «Salva la prenotazione» */
export function TastoAvanti({ testo, onClick, disabilitato = false, dati }: { testo: string; onClick: () => void; disabilitato?: boolean; dati?: string }) {
  return (
    <p className="text-center">
      <button type="button" data-avanti={dati} onClick={onClick} disabled={disabilitato} className="py-[7px] -my-[7px]"
        style={{
          height: ALTEZZA_PASTIGLIA, borderRadius: 999, padding: '0 18px', fontSize: 12, fontWeight: 600,
          background: 'var(--color-green-mid)', color: 'var(--color-cream)', opacity: disabilitato ? 0.5 : 1,
        }}>{testo}</button>
    </p>
  )
}

/** Il tastino tenue centrato: «+ Aggiungi camera», «+ Aggiungi una persona» */
export function TastinoTenue({ testo, onClick, centrato = true }: { testo: string; onClick: () => void; centrato?: boolean }) {
  return (
    <p className={centrato ? 'text-center' : ''}>
      <button type="button" onClick={onClick} className="py-2 -my-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-green-mid)' }}>{testo}</button>
    </p>
  )
}
