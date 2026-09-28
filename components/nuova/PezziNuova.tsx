'use client'
// ============================================================================
// I PEZZI della pagina «Nuova prenotazione» (14/09/2026): titoletti, campi a
// riga, pastiglie e tastini. Stanno insieme perché sono la stessa veste,
// ripetuta in tutte le parti della pagina — e sono la veste della scheda:
// titoletto in ottone maiuscolo col filo (ed-sezione), righe col filo sotto,
// niente riquadri.
// ============================================================================
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'

// ── La veste «Maison» (riferimento della Nuova prenotazione, 28/09/2026) ────
// La pagina /nuova-prenotazione si avvolge in <VesteMaison>: gli stessi pezzi
// (etichette, righe, pastiglie, tasti) si disegnano con le classi np-* di
// app/maison.css. I fogli della scheda, che usano gli stessi pezzi fuori da
// VesteMaison, restano come sono.
const Veste = createContext(false)
export function VesteMaison({ children }: { children: ReactNode }) {
  return <Veste.Provider value={true}>{children}</Veste.Provider>
}
/** true dentro la pagina «Nuova prenotazione» Maison */
export const useMaison = () => useContext(Veste)

export const OTTONE = '#A9884E'
export const MATTONE = '#8C3B2E'
export const GEORGIA = "Georgia, 'Times New Roman', serif"
export const ALTEZZA_PASTIGLIA = 30
export const BORDO_SPENTA = '#C9BFA8'
// Una pastiglia spenta (camera occupata quella notte): scritta tenue e filo
// ancora più tenue, così si vede che c'è ma non si tocca (Ania, 15/09/2026)
export const SPENTA_TESTO = '#C9BFA8'
export const SPENTA_BORDO = '#EFEADF'
export const SOPRA_ETICHETTA = 22
export const SOTTO_ETICHETTA = 10

/** L'etichettina piccola sopra un gruppo: «CAMERA», «OSPITI», «SCONTO»…
 *  Nei fogli della scheda (16/09/2026) è in ottone: `ottone`. */
export function Etichetta({ testo, centrata = false, primo = false, ottone = false, stileEtichetta, className = '' }: { testo: string; centrata?: boolean; primo?: boolean; ottone?: boolean; stileEtichetta?: CSSProperties; className?: string }) {
  const maison = useMaison()
  if (maison) return <p data-etichetta className={`np-lab ${centrata ? 'c' : ''} ${primo ? 'primo' : ''} ${className}`}>{testo}</p>
  return (
    <p data-etichetta className={`uppercase ${centrata ? 'text-center' : ''} ${className}`}
      style={{ fontSize: 9.5, letterSpacing: '1.4px', color: ottone ? OTTONE : 'var(--color-stone)', marginTop: primo ? 0 : SOPRA_ETICHETTA, marginBottom: SOTTO_ETICHETTA, ...stileEtichetta }}>{testo}</p>
  )
}

/** Una riga di campo col filo sotto, senza riquadro. Nei fogli della scheda
 *  l'etichettina è in ottone maiuscolo 9,5 px: `ottone` (16/09/2026). Con
 *  `stileEtichetta` un foglio può ritoccare la sua etichettina (il foglio
 *  del pagamento approvato il 20/09/2026: 10 px, 1,3 px): gli altri fogli
 *  non cambiano. */
export function RigaCampo({ etichetta, children, ottone = false, stileEtichetta, className = '' }: { etichetta: string; children: ReactNode; ottone?: boolean; stileEtichetta?: CSSProperties; className?: string }) {
  const maison = useMaison()
  // Maison: l'etichettina sopra, il filo sotto il valore (np-riga, app/maison.css)
  if (maison) return <label className={`np-riga ${className}`}><span className="np-lab">{etichetta}</span>{children}</label>
  return (
    <label className={`block ${className}`} style={{ padding: '8px 0', borderBottom: '1px solid var(--color-card-border)' }}>
      <span className="block uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: ottone ? OTTONE : 'var(--color-stone)', ...stileEtichetta }}>{etichetta}</span>
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
  const maison = useMaison()
  // Maison: pillola a filo, accesa piena d'inchiostro; il mattone resta per «!»
  if (maison) return (
    <button type="button" data-pastiglia={dati} aria-pressed={acceso} disabled={spenta} onClick={onClick}
      className={`np-chip ${acceso ? 'on' : ''} ${spenta ? 'off' : ''} ${colore ? 'm' : ''}`}>{children}</button>
  )
  return (
    <button type="button" data-pastiglia={dati} aria-pressed={acceso} disabled={spenta} onClick={onClick}
      style={{
        minHeight: ALTEZZA_PASTIGLIA, maxWidth: '100%', overflowWrap: 'anywhere', lineHeight: '18px', borderRadius: 999, padding: '5px 12px', fontSize: 12.5, fontWeight: 600,
        background: acceso ? (colore ?? 'var(--color-green-mid)') : 'transparent',
        color: spenta ? SPENTA_TESTO : acceso ? 'var(--color-cream)' : 'var(--color-green-dark)',
        border: `1px solid ${acceso ? (colore ?? 'var(--color-green-mid)') : spenta ? SPENTA_BORDO : BORDO_SPENTA}`,
      }}>{children}</button>
  )
}

// Il layout riserva tutta l'altezza visibile: nessun margine negativo.
// Così anche due gruppi consecutivi e le etichette restano separati.
export const SPAZIO_PASTIGLIE = 6
export const SPAZIO_FRA_RIGHE = 8

export function FilaPastiglie({ children, centrata = false, className = '' }: { children: ReactNode; centrata?: boolean; className?: string }) {
  if (useMaison()) return <div className={`np-chips ${centrata ? 'c' : ''} ${className}`}>{children}</div>
  return <div className={`flex flex-wrap ${centrata ? 'justify-center' : ''} ${className}`}
    style={{ columnGap: SPAZIO_PASTIGLIE, rowGap: SPAZIO_FRA_RIGHE }}>{children}</div>
}

/** Distanza reale fra le scelte e il campo successivo. */
export const SOTTO_PASTIGLIE = 10

/** Il tasto verde piccolo, centrato: «Avanti · date e camera», «Salva la prenotazione» */
export function TastoAvanti({ testo, onClick, disabilitato = false, dati }: { testo: string; onClick: () => void; disabilitato?: boolean; dati?: string }) {
  // Maison: l'azione principale è l'unico elemento pieno, angoli vivi; dove
  // sta (a sinistra o al centro) lo decide chi lo contiene
  if (useMaison()) return <button type="button" data-avanti={dati} onClick={onClick} disabled={disabilitato} className="mz-cta np-cta">{testo}</button>
  return (
    <p className="text-center">
      <button type="button" data-avanti={dati} onClick={onClick} disabled={disabilitato}
        style={{
          minHeight: ALTEZZA_PASTIGLIA, maxWidth: '100%', overflowWrap: 'anywhere', lineHeight: '18px', borderRadius: 999, padding: '6px 18px', fontSize: 12, fontWeight: 600,
          background: 'var(--color-green-mid)', color: 'var(--color-cream)', opacity: disabilitato ? 0.5 : 1,
        }}>{testo}</button>
    </p>
  )
}

/** Il tastino tenue centrato: «+ Aggiungi camera», «+ Aggiungi una persona» */
// Il dito ha bisogno di 44 px: col «py-2» il tastino era alto 29 e sul
// telefono di Ania non si prendeva (14/09/2026). L'area cresce, la scritta no.
export const ALTEZZA_TOCCO = 44
export function TastinoTenue({ testo, onClick, centrato = true, dati }: { testo: string; onClick: () => void; centrato?: boolean; dati?: string }) {
  // Maison: parola maiuscoletta tenue col filo (mz-lnk q), area di tocco 44 px
  if (useMaison()) return <p className={centrato ? 'text-center' : ''}><button type="button" data-tastino={dati} onClick={onClick} className="mz-lnk q np-lnk">{testo}</button></p>
  return (
    <p className={centrato ? 'text-center' : ''}>
      <button type="button" data-tastino={dati} onClick={onClick}
        style={{ minHeight: ALTEZZA_TOCCO, padding: '0 14px', fontSize: 13, fontWeight: 600, color: 'var(--color-green-mid)' }}>{testo}</button>
    </p>
  )
}
