'use client'
// ============================================================================
// «REGISTRA PAGAMENTO» e «SEGNA PAGATO» DALLA HOME (28/09/2026): lo stesso
// foglio della scheda (FoglioPagamento), senza aprire la scheda. Prima si
// rilegge la prenotazione intera come fa la scheda (tutte le camere, i
// pagamenti, il conto autorevole di contoPrenotazione), poi si apre il
// foglio. Il salvataggio resta quello di lib/pagamentiDati: qui non si
// scrive niente.
// ============================================================================
import { useEffect, useState } from 'react'
import FoglioMaison from './FoglioMaison'
import AvvisoAzione from '@/components/AvvisoAzione'
import FoglioPagamento, { type PagamentoSalvato } from '@/components/scheda/FoglioPagamento'
import { supabase } from '@/lib/supabase'
import { leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, ERRORE_CONTO_INCOMPLETO } from '@/lib/prenotazioneUnica'
import type { RigaPagabile } from '@/lib/pagamentiDati'
import { oggiARoma } from '@/lib/spese/adattatore'
import { conLimite, LIMITE_SALVATAGGIO_MS, ERRORE_LETTURA_SCADUTA } from '@/lib/pagamentoFoglio'

type Pronto = { booking: RigaPagabile; righe: RigaPagabile[]; conto: { totaleCent: number; ricevutiCent: number }; bonifico: boolean | null }

export default function PagamentoDaHome({ bookingId, onChiudi, onSalvato }: { bookingId: string; onChiudi: () => void; onSalvato: (esito: PagamentoSalvato) => void }) {
  const [pronto, setPronto] = useState<Pronto | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [giro, setGiro] = useState(0)
  useEffect(() => {
    let vivo = true
    // anche la lettura ha il suo limite di tempo (29/09/2026): mai «Lettura del conto…» per sempre
    conLimite((async () => {
      const letta = await supabase.from('bookings').select('*, rooms(*), guests(full_name, phone)').eq('id', bookingId).maybeSingle()
      if (!vivo) return
      if (letta.error || !letta.data) { setErrore(ERRORE_CONTO_INCOMPLETO); return }
      const scheda = letta.data as RigaPagabile & { guests?: unknown; guest_name?: string | null }
      const unica = await leggiPrenotazioneUnica(scheda, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
      if (!vivo) return
      if (unica.errore) { setErrore(unica.errore); return }
      const righe = (unica.righe as (RigaPagabile & { guests?: unknown; guest_name?: string | null })[]).map(r => ({ ...r, guests: r.guests ?? scheda.guests, guest_name: r.guest_name ?? scheda.guest_name }))
      const pag = await supabase.from('payments').select('*').in('booking_id', righe.map(r => r.id))
      if (!vivo) return
      if (pag.error) { setErrore(ERRORE_CONTO_INCOMPLETO); return }
      let conto: Pronto['conto']
      try { conto = contoPrenotazione(righe, (pag.data ?? []).map(p => ({ booking_id: p.booking_id, amount: p.amount }))) } catch { setErrore(ERRORE_CONTO_INCOMPLETO); return }
      const accordo = accordoPrenotazione(righe) as (RigaPagabile & { bonifico?: boolean | null }) | undefined
      setPronto({ booking: righe.find(r => r.id === bookingId) ?? righe[0], righe, conto, bonifico: accordo?.bonifico ?? null })
    })(), LIMITE_SALVATAGGIO_MS)
      .then(r => { if (vivo && r.scaduto) { vivo = false; setErrore(ERRORE_LETTURA_SCADUTA) } })
      .catch(() => { if (vivo) setErrore(ERRORE_CONTO_INCOMPLETO) })
    return () => { vivo = false }
  }, [bookingId, giro])

  if (pronto) return <FoglioPagamento booking={pronto.booking} righe={pronto.righe} conto={pronto.conto} oggi={oggiARoma()} bonifico={pronto.bonifico}
    onChiudi={onChiudi} onSalvato={onSalvato}
    onContoCambiato={riletto => setPronto(p => (p ? { ...p, righe: riletto.righe, conto: riletto.conto } : p))} />
  return (
    <FoglioMaison titolo="Aggiungi pagamento" altezza={260} onChiudi={onChiudi} dati="pagamento-lettura">
      {errore
        ? <AvvisoAzione testo={errore} onRiprova={() => { setErrore(null); setGiro(g => g + 1) }} className="mt-4" />
        : <p className="mz-hint">Lettura del conto…</p>}
    </FoglioMaison>
  )
}
