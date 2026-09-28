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
//
// Dal 28/09/2026 ha la veste «Maison» (riferimento approvato da Ania): foglio
// dal basso con UNA altezza fissa, quella del caso più lungo («Arrivo a…»),
// che non cambia cambiando tipo; titolo = nome, sotto «Camera · Arrivo e
// navetta»; dopo il salvataggio la conferma B (spunta e «Salvato»), poi il
// foglio si chiude da solo. Salvataggio e regole identici.
// ============================================================================
import { useRef, useState } from 'react'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import AvvisoAzione from '@/components/AvvisoAzione'
import ArrivoNavettaMaison from '@/components/maison/ArrivoNavettaMaison'
import { supabase } from '@/lib/supabase'
import { salvaArrivoPrenotazione } from '@/lib/arrivoDati'
import { leggiArrivo, TITOLO_ARRIVO, SOTTOTITOLO_ARRIVO, type Arrivo } from '@/lib/arrivo'
import { nomeConAltri } from '@/lib/guestName'
import { COSA_SALVATA } from '@/lib/salvatoMaison'

export { TITOLO_ARRIVO }
/** L'altezza del foglio: quella del caso più lungo, «Arrivo a…» con la fascia
 *  oraria, la stima e il prelievo (misurata a 390 px: 752). Nel riferimento il
 *  caso disegnato, con l'ora precisa, stava in 660. Solo «Altro luogo…» con la
 *  fascia supera di poco: lì il foglio scorre dentro, senza cambiare misura. */
export const ALTEZZA_FOGLIO_ARRIVO = 752

export default function FoglioArrivo({ bookingId, prenotazione, etichetta, onChiudi, onSalvato }: {
  /** prima era il sottotitolo; dalla veste «Maison» il sottotitolo è «Camera · Arrivo e navetta» */
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
  const [salvato, setSalvato] = useState<(Salvataggio & { campi: Record<string, unknown> }) | null>(null)
  // Freno SINCRONO al doppio tocco: `salvando` arriva al prossimo giro di
  // React, e sul telefono di Ania due tocchi vicini passano prima (rilievo
  // di Codex, 21/09/2026 sera).
  const inCorso = useRef(false)
  const nome = nomeConAltri(prenotazione ?? {}) || etichetta || ''
  const camera = (prenotazione?.rooms as { name?: string | null } | null | undefined)?.name ?? ''

  async function salva() {
    if (inCorso.current || salvato) return
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
      setSalvato({ cosa: COSA_SALVATA.arrivo(nome), quando: new Date(), campi: esito.campi })
    } finally {
      inCorso.current = false
      setSalvando(false)
    }
  }

  return (
    <FoglioMaison titolo={nome || TITOLO_ARRIVO} sottotitolo={camera ? `${camera} · ${TITOLO_ARRIVO}` : TITOLO_ARRIVO} altezza={ALTEZZA_FOGLIO_ARRIVO}
      onChiudi={onChiudi} dati="arrivo" salvato={salvato} onFineSalvato={() => salvato && onSalvato(salvato.campi)}
      piede={<PiedeMaison azione="Salva" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="arrivo" />}>
      <p className="mz-hint">{SOTTOTITOLO_ARRIVO}</p>
      <ArrivoNavettaMaison arrivo={arrivo} onArrivo={setArrivo} />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
    </FoglioMaison>
  )
}
