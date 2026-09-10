'use client'
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

// Il comando "Indietro" vive nella pagina (ogni pagina sa dove tornare), ma sul
// telefono va mostrato nella barra in alto, che sta nel layout. Questo contesto
// fa da ponte: la pagina registra la sua azione di ritorno, la barra la mostra
// come freccia a sinistra del titolo.
//
// Registriamo un oggetto stabile con dentro una funzione che legge sempre
// l'ultima versione del gestore: così un onClick ricreato a ogni render non
// fa ripartire la registrazione all'infinito.

export type AzioneIndietro = { chiama: () => void; label: string }

type Ponte = {
  azione: AzioneIndietro | null
  registra: (id: number, azione: AzioneIndietro | null) => void
}

const BackCtx = createContext<Ponte | null>(null)

export function BackProvider({ children }: { children: React.ReactNode }) {
  const [azione, setAzione] = useState<AzioneIndietro | null>(null)
  // Chi comanda adesso: alla chiusura una pagina cancella solo la propria
  // registrazione, mai quella già presa da un'altra.
  const attivo = useRef(0)
  const registra = useCallback((id: number, nuova: AzioneIndietro | null) => {
    if (nuova) {
      attivo.current = id
      setAzione(nuova)
    } else if (attivo.current === id) {
      attivo.current = 0
      setAzione(null)
    }
  }, [])
  return <BackCtx.Provider value={{ azione, registra }}>{children}</BackCtx.Provider>
}

export function useAzioneIndietro(): AzioneIndietro | null {
  return useContext(BackCtx)?.azione ?? null
}

let contatore = 0

// Usato dal pulsante Indietro della pagina: mentre è montato, la freccia
// compare nella barra in alto e fa esattamente quello che fa il pulsante.
export function useRegistraIndietro(chiama: () => void, label: string) {
  const ponte = useContext(BackCtx)
  const ultimo = useRef(chiama)
  // Aggiornato dopo ogni render (mai durante): la freccia chiama sempre
  // l'ultima versione del gestore, senza rifare la registrazione.
  useEffect(() => { ultimo.current = chiama })
  const registra = ponte?.registra
  useEffect(() => {
    if (!registra) return
    const id = ++contatore
    registra(id, { chiama: () => ultimo.current(), label })
    return () => registra(id, null)
  }, [registra, label])
}
