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
//
// Dal 29/09/2026 lo usano anche gli Arrivi (riferimento approvato da Ania:
// docs/design/arrivi-riferimento.html), con le opzioni: una testa propria
// («ARRIVO E NAVETTA · AMBRA · GIO 1 OTT», nome e cerchi), il riassunto al
// posto della frase d'aiuto, lo storico sotto il modulo (che può riempire la
// bozza: «Usa come l'ultima volta»), le azioni e il tasto pieno «Salva» a
// tutta larghezza. Salvataggio, rilettura, conferma B: gli stessi.
// ============================================================================
import { useRef, useState, type ReactNode } from 'react'
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
/** L'altezza del foglio: quella del caso più lungo, «Arrivo a…» «Altro
 *  luogo…» (il campo del luogo scritto a mano) con la fascia oraria, la stima
 *  in struttura e la navetta con l'autista e il prelievo, + 24 px + «Annulla ·
 *  Salva». Il 29/09/2026 era 756 ma misurata su Centrale: con «Altro luogo…»
 *  il contenuto era più lungo e scorreva. Dal 30/09/2026 (Ania) solo meno
 *  aria fra le parti (app/maison.css), caratteri, campi e tasti invariati:
 *  misurata a 390 px, 713. Nella scheda e nella Home. */
export const ALTEZZA_FOGLIO_ARRIVO = 713
/** Negli Arrivi il foglio ha in più la testa col nome e i cerchi, il riassunto,
 *  la riga chiusa «Storico ›» (dal 30/09/2026: si apre al tocco), «Chiedi orario
 *  · Apri chat · Apri prenotazione» e «Salva» pieno: lo stesso caso più lungo
 *  misura 758 px (prima 897), sotto il 92% di un telefono da 844 (776). */
export const ALTEZZA_FOGLIO_ARRIVO_ARRIVI = 758

export default function FoglioArrivo({ bookingId, prenotazione, etichetta, onChiudi, onSalvato, testa, sopra, sotto, azioni, salvaPieno, veloChiaro, larghezzaDesktop, dati = 'arrivo', altezza = ALTEZZA_FOGLIO_ARRIVO }: {
  /** prima era il sottotitolo; dalla veste «Maison» il sottotitolo è «Camera · Arrivo e navetta» */
  etichetta?: string
  bookingId: string
  /** la riga della prenotazione: l'arrivo si rilegge da lì, con o senza 0058 */
  prenotazione: Record<string, unknown> | null | undefined
  onChiudi: () => void
  onSalvato: (campi: Record<string, unknown>) => void
  /** Arrivi: la testa disegnata dalla pagina, al posto del titolo */
  testa?: ReactNode
  /** Arrivi: sopra il modulo, al posto della frase d'aiuto (segue la bozza) */
  sopra?: (arrivo: Arrivo) => ReactNode
  /** Arrivi: sotto il modulo (lo storico), può riempire la bozza */
  sotto?: (arrivo: Arrivo, onArrivo: (a: Arrivo) => void) => ReactNode
  /** Arrivi: le azioni in fondo, sopra «Salva» */
  azioni?: ReactNode
  /** Arrivi: il tasto pieno «Salva» a tutta larghezza, con questo testo mentre salva */
  salvaPieno?: { salvando: string }
  /** l'altezza fissa (gli Arrivi hanno la loro: ALTEZZA_FOGLIO_ARRIVO_ARRIVI) */
  altezza?: number
  veloChiaro?: boolean
  larghezzaDesktop?: number
  /** il nome del foglio (data-foglio-maison): gli Arrivi hanno le loro misure */
  dati?: string
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
    <FoglioMaison titolo={nome || TITOLO_ARRIVO} sottotitolo={camera ? `${camera} · ${TITOLO_ARRIVO}` : TITOLO_ARRIVO} altezza={altezza}
      onChiudi={onChiudi} dati={dati} salvato={salvato} onFineSalvato={() => salvato && onSalvato(salvato.campi)}
      testa={testa} veloChiaro={veloChiaro} larghezzaDesktop={larghezzaDesktop}
      piede={salvaPieno ? (
        <div className="cal-fa-piede" data-piede-foglio>
          {azioni && <div className="cal-fa-ac">{azioni}</div>}
          <button type="button" className="cal-fa-cta" data-azione-foglio="arrivo" onClick={salva} disabled={salvando}>{salvando ? salvaPieno.salvando : 'Salva'}</button>
        </div>
      ) : <PiedeMaison azione="Salva" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="arrivo" />}>
      {sopra ? sopra(arrivo) : <p className="mz-hint">{SOTTOTITOLO_ARRIVO}</p>}
      <ArrivoNavettaMaison arrivo={arrivo} onArrivo={setArrivo} />
      {sotto?.(arrivo, setArrivo)}
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
    </FoglioMaison>
  )
}
