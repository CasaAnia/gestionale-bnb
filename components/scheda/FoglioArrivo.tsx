'use client'
// ============================================================================
// IL FOGLIO «ARRIVO E NAVETTA» della scheda (13/09/2026; rifatto il
// 21/09/2026 sulla proposta approvata da Ania).
//
// Prima chiedeva due cose sole — un orario e «No · Sì · ?» — e l'orario non
// diceva di dove fosse: «15:00» poteva essere Linate o il campanello di
// casa. Adesso il modulo è quello condiviso (components/ArrivoNavetta), lo
// stesso dell'inserimento, e il salvataggio è quello condiviso
// (lib/arrivoDati): prima le colonne nuove della proposta 0058, e se il
// server non le conosce ancora solo le due di sempre, dicendolo.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import ArrivoNavetta from '@/components/ArrivoNavetta'
import { supabase } from '@/lib/supabase'
import { salvaArrivoPrenotazione } from '@/lib/arrivoDati'
import { leggiArrivo, TITOLO_ARRIVO, SOTTOTITOLO_ARRIVO, type Arrivo } from '@/lib/arrivo'

export { TITOLO_ARRIVO }

export default function FoglioArrivo({ bookingId, prenotazione, onChiudi, onSalvato }: {
  bookingId: string
  /** la riga della prenotazione: l'arrivo si rilegge da lì, con o senza 0058 */
  prenotazione: Record<string, unknown> | null | undefined
  onChiudi: () => void
  onSalvato: (campi: Record<string, string | null>, avviso: string | null) => void
}) {
  const [arrivo, setArrivo] = useState<Arrivo>(() => leggiArrivo(prenotazione))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function salva() {
    if (salvando) return
    setSalvando(true)
    setErrore(null)
    const esito = await salvaArrivoPrenotazione(
      campi => supabase.from('bookings').update(campi).eq('id', bookingId),
      arrivo,
    )
    setSalvando(false)
    if (esito.esito === 'errore' || !esito.campi) { setErrore(esito.messaggio); return }
    onSalvato(esito.campi, esito.messaggio)
  }

  return (
    <Foglio titolo={TITOLO_ARRIVO} onChiudi={onChiudi}>
      <p className="uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)', marginTop: -4, marginBottom: 14 }}>{SOTTOTITOLO_ARRIVO}</p>
      <ArrivoNavetta arrivo={arrivo} onArrivo={setArrivo} />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione="Salva" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="arrivo" />
    </Foglio>
  )
}
