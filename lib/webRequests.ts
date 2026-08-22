'use client'
// Richieste arrivate dal sito e ancora da confermare (Ania chiama sempre il
// cliente prima di confermare). Usate da: pallino sulla barra, avviso sul
// calendario e finestra all'apertura del gestionale.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { nomeOspite, nomeDiverso } from './guestName'

export type WebRequest = {
  id: string
  check_in: string
  check_out: string
  num_guests: number
  total_amount: number
  room_name: string
  guest_name: string
  guest_phone: string
  // Il numero è già in archivio con un nominativo diverso da quello della
  // richiesta: nome_archivio è quello della scheda, per l'avviso rosso
  nome_diverso: boolean
  nome_archivio: string
}

export async function fetchWebRequests(): Promise<WebRequest[]> {
  // Prima con bookings.guest_name (nome della singola richiesta); se la
  // colonna non è ancora migrata si ripiega sulla query di prima.
  const query = (cols: string) => supabase
    .from('bookings')
    .select(cols)
    .eq('status', 'in_attesa')
    .eq('source', 'sito_web')
    .order('check_in', { ascending: true })
  let { data, error }: { data: any[] | null; error: any } =
    await query('id, check_in, check_out, num_guests, total_amount, guest_name, rooms(name), guests(full_name, phone)')
  if (error) {
    ;({ data, error } = await query('id, check_in, check_out, num_guests, total_amount, rooms(name), guests(full_name, phone)'))
  }
  // Se la query fallisce niente avvisi: il gestionale deve continuare a
  // funzionare come prima.
  if (error || !data) return []
  return data.map((b: any) => ({
    id: b.id,
    check_in: b.check_in,
    check_out: b.check_out,
    num_guests: b.num_guests,
    total_amount: Number(b.total_amount) || 0,
    room_name: b.rooms?.name?.split(' ').slice(-1)[0] || 'Camera',
    guest_name: nomeOspite(b),
    guest_phone: b.guests?.phone || '',
    nome_diverso: nomeDiverso(b),
    nome_archivio: b.guests?.full_name || '',
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
