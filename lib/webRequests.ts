'use client'
// Richieste arrivate dal sito e ancora da confermare (Ania chiama sempre il
// cliente prima di confermare). Usate da: pallino sulla barra, avviso sul
// calendario e finestra all'apertura del gestionale.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export type WebRequest = {
  id: string
  check_in: string
  check_out: string
  num_guests: number
  total_amount: number
  room_name: string
  guest_name: string
  guest_phone: string
}

export async function fetchWebRequests(): Promise<WebRequest[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, check_in, check_out, num_guests, total_amount, rooms(name), guests(full_name, phone)')
    .eq('status', 'in_attesa')
    .eq('source', 'sito_web')
    .order('check_in', { ascending: true })
  // Se la query fallisce (es. colonna non ancora migrata) niente avvisi: il
  // gestionale deve continuare a funzionare come prima.
  if (error || !data) return []
  return data.map((b: any) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    num_guests: b.num_guests,
    total_amount: Number(b.total_amount) || 0,
    room_name: b.rooms?.name?.split(' ').slice(-1)[0] || 'Camera',
    guest_name: b.guests?.full_name || b.guests?.phone || 'Ospite',
    guest_phone: b.guests?.phone || '',
  }))
}

// Conteggio con aggiornamento quando la pagina torna in primo piano: sul
// telefono il gestionale resta aperto per giorni, il numero non deve invecchiare.
export function useWebRequestCount(refreshKey?: string): number {
  const [count, setCount] = useState(0)
  useEffect(() => {
    let alive = true
    const load = () => fetchWebRequests().then(r => { if (alive) setCount(r.length) })
    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => {
      alive = false
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [refreshKey])
  return count
}
