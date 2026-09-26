'use client'
// ============================================================================
// IL FOGLIO «ARRIVO E NAVETTA» della scheda (13/09/2026; rifatto il
// 21/09/2026 sulla proposta approvata da Ania, e corretto la sera stessa
// dopo la verifica indipendente di Codex).
//
// Prima chiedeva due cose sole — un orario e «No · Sì · ?» — e l'orario non
// diceva di dove fosse: «15:00» poteva essere Linate o il campanello di
// casa. Adesso il modulo è quello condiviso (components/ArrivoNavetta), lo
// stesso dell'inserimento, e il salvataggio è quello condiviso
// (lib/arrivoDati): scrive, si fa ridare la riga e la rilegge.
//
// Cosa succede quando qualcosa va storto (rilievi di Codex):
//  - errore o esito incerto → il foglio RESTA APERTO con la bozza intatta e
//    l'avviso sotto; non si chiude fingendo di aver salvato;
//  - il gestionale non sa ancora tenere il luogo o l'autista → non si scrive
//    niente, e l'avviso lo dice in parole di tutti i giorni;
//  - doppio tocco su «Salva» → il secondo non parte, e il freno è sincrono
//    (un riferimento, non lo stato di React che arriva dopo).
// ============================================================================
import { useRef, useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import ArrivoNavetta from '@/components/ArrivoNavetta'
import { supabase } from '@/lib/supabase'
import { salvaArrivoPrenotazione } from '@/lib/arrivoDati'
import { leggiArrivo, TITOLO_ARRIVO, SOTTOTITOLO_ARRIVO, type Arrivo } from '@/lib/arrivo'

export { TITOLO_ARRIVO }

export default function FoglioArrivo({ bookingId, prenotazione, etichetta, onChiudi, onSalvato }: {
  etichetta?: string
  bookingId: string
  /** la riga della prenotazione: l'arrivo si rilegge da lì, con o senza 0058 */
  prenotazione: Record<string, unknown> | null | undefined
  onChiudi: () => void
  onSalvato: (campi: Record<string, unknown>) => void
}) {
  const [arrivo, setArrivo] = useState<Arrivo>(() => leggiArrivo(prenotazione))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  // Freno SINCRONO al doppio tocco: `salvando` arriva al prossimo giro di
  // React, e sul telefono di Ania due tocchi vicini passano prima (rilievo
  // di Codex, 21/09/2026 sera).
  const inCorso = useRef(false)

  async function salva() {
    if (inCorso.current) return
    inCorso.current = true
    setSalvando(true)
    setErrore(null)
    try {
      const esito = await salvaArrivoPrenotazione(
        campi => supabase.from('bookings').update(campi).eq('id', bookingId).select('id'),
        arrivo,
        () => supabase.from('bookings').select('*').eq('id', bookingId).limit(1),
      )
      // Solo «ok» chiude il foglio: negli altri casi la bozza resta qui.
      if (esito.esito !== 'ok' || !esito.campi) { setErrore(esito.messaggio); return }
      onSalvato(esito.campi)
    } finally {
      inCorso.current = false
      setSalvando(false)
    }
  }

  return (
    <Foglio titolo={TITOLO_ARRIVO} onChiudi={onChiudi}>
      <p className="uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: 'var(--color-stone)', marginTop: -4, marginBottom: 14 }}>{etichetta ?? SOTTOTITOLO_ARRIVO}</p>
      <ArrivoNavetta arrivo={arrivo} onArrivo={setArrivo} />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione="Salva" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="arrivo" />
    </Foglio>
  )
}
