'use client'
// La sonda della 0064 (lib/schema0064) sul database vero, una volta per
// pagina e per parte. Un «errore» non si ricorda: alla prossima apertura si
// riprova, così una rete caduta non spegne le funzioni per sempre.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { sonda, type Disponibilita, type Parte0064 } from './schema0064'

const ricordate = new Map<Parte0064, Disponibilita>()
const inCorso = new Map<Parte0064, Promise<Disponibilita>>()

export function leggiParte0064(parte: Parte0064, ancora = false): Promise<Disponibilita> {
  if (!ancora && ricordate.has(parte)) return Promise.resolve(ricordate.get(parte)!)
  if (!ancora && inCorso.has(parte)) return inCorso.get(parte)!
  const p = sonda(supabase as never, parte).then(esito => {
    if (esito === 'errore') ricordate.delete(parte); else ricordate.set(parte, esito)
    inCorso.delete(parte)
    return esito
  })
  inCorso.set(parte, p)
  return p
}

/** null mentre si controlla; poi 'si' | 'no' | 'errore'. `riprova` rifà la sonda. */
export function useParte0064(parte: Parte0064): { stato: Disponibilita | null; riprova: () => void } {
  const [stato, setStato] = useState<Disponibilita | null>(() => ricordate.get(parte) ?? null)
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    let viva = true
    void leggiParte0064(parte, giro > 0).then(e => { if (viva) setStato(e) })
    return () => { viva = false }
  }, [parte, giro])
  return { stato, riprova: () => setGiro(g => g + 1) }
}
