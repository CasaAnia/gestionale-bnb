'use client'
// ============================================================================
// LA SCHEDA DI UNA PRENOTAZIONE (e quella di una camera tenuta) sul nastro
// «Maison», UNA per Calendario e Richieste (29/09/2026, Richieste «Maison»:
// lo stesso nastro, «riusato con le opzioni, mai copiato»).
//
// Quattro righe scritte sopra (date · icone e nome · ospiti e stato · arrivo),
// il colore del pagamento (verde fin dove arrivano gli acconti), il filo rosso
// del letto, il taglio obliquo del cambio camera. La pagina dice solo dove sta
// (riga, colonne), se è attenuata o trovata dalla ricerca e cosa fa il tocco.
// ============================================================================
import { useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { percorsoBarraArrotondata } from '@/lib/roomChanges'
import { nomeConAltri } from '@/lib/guestName'
import { lettiPoolPrenotazione, nottiLettoExtra } from '@/lib/lettiAggiuntivi'
import { leggiArrivo } from '@/lib/arrivo'
import { oraRoma } from '@/lib/opzioni'
import { vuoleRicevuta } from '@/lib/valutazione'
import {
  MISURE_NASTRO, ARIA_SCHEDA, TAGLIO_CAMBIO, FILO_SINISTRO, CAMBIO_CAMERA,
  geometriaScheda, statoScheda, tintaScheda, testoStato, rigaDate, iconeScheda, rigaSotto, rigaArrivo, fondoConAcconti, trattiLetto,
  type MisureNastro,
} from '@/lib/calendarioSchede'
import { TINTE_SCHEDA, areaTocco } from '@/lib/calendarioMobile'
import type { LegamiCatene } from '@/lib/calendarioNastro'
import type { BarraTenuta } from '@/lib/calendarioOpzioni'
import { SchedaNastro, FiloLetto } from './Nastro'
import { formeCifra } from '@/lib/spesoCliente'

type Prenotazione = {
  id: string; check_in: string; check_out: string; status?: string | null; source?: string | null
  ospitiPeriodo?: string
  num_guests?: number | string | null; color?: string | null; pagato?: boolean | null; bonifico?: boolean | null
  extra_bed?: boolean | null; extra_bed_dates?: string[] | null
  guests?: { rating?: string | null; vuole_ricevuta?: boolean | null } | null
}

export function SchedaPrenotazione<T extends Prenotazione>({ booking, rigaTop, colonnaCamere, giorno, giorni, indice, legami, coperte, attenuata, cerca, trovata, selezionata, larghezzaTesto, onTocca, misure = MISURE_NASTRO.normale, speso }: {
  booking: T
  /** il bordo alto della corsia */
  rigaTop: number
  colonnaCamere: number
  /** larghezza di un giorno */
  giorno: number
  /** quanti giorni disegna il nastro */
  giorni: number
  /** la colonna di una data */
  indice: (iso: string) => number
  legami: LegamiCatene
  /** notti coperte dagli acconti (lib/calendarioNastro.nottiPagate): −1 = tutte */
  coperte: number | undefined
  attenuata: boolean
  /** attenuata dalla ricerca (0,35 invece di 0,3) */
  cerca: boolean
  trovata: boolean
  /** della catena toccata: piena, con l'ombra */
  selezionata: boolean
  larghezzaTesto: (da: number, a: number) => number
  onTocca: (booking: T, chainKey: string | undefined, e: MouseEvent<HTMLDivElement>) => void
  /** corsia/scheda: normali, o compatte col telefono in orizzontale a «Sett.» (lib/calendarioSchede) */
  misure?: MisureNastro
  /** Calendario (02/10/2026): quanto ha speso il cliente, questa compresa, in centesimi; null/assente = niente cifra */
  speso?: number | null
}) {
  const startIdx = Math.max(0, indice(booking.check_in))
  const endIdx = Math.min(giorni, indice(booking.check_out))
  if (endIdx - startIdx <= 0) return null
  const isOttimo = booking.guests?.rating === 'ottimo'
  const isEsclusiva = booking.color === '#f97316'
  const ricevuta = vuoleRicevuta(booking.guests)
  const hasExtraBed = booking.extra_bed || (booking.extra_bed_dates && booking.extra_bed_dates.length > 0)
  const chainKey = legami.changeGroups.chainKeyOf[booking.id]
  const isMultiRoom = !!chainKey
  const hasIncoming = legami.incomingIds.has(booking.id)
  const hasOutgoing = legami.outgoingIds.has(booking.id)
  // Richiesta dal sito da confermare: scheda tratteggiata verde
  const isWebPending = booking.status === 'in_attesa' && booking.source === 'sito_web'
  const stato = statoScheda(booking, coperte === -1)
  const tintaBase = tintaScheda(stato, booking.color)
  // Acconti (come prima, Ania 29/09/2026): le notti già coperte dai soldi
  // ricevuti si colorano di verde da sinistra, il resto tiene il suo colore
  const pagate = coperte ?? 0
  const tinta = stato !== 'pagato' && stato !== 'dalSito' && pagate > 0
    ? { ...tintaBase, fondo: fondoConAcconti(TINTE_SCHEDA.pagato.fondo, tintaBase.fondo, (pagate - (startIdx - indice(booking.check_in))) * giorno - ARIA_SCHEDA), filo: TINTE_SCHEDA.pagato.filo }
    : tintaBase
  const g = geometriaScheda(startIdx, endIdx, giorno)
  // Cambio camera: il tratto che parte tagliato in basso a destra, quello che arriva in basso a sinistra
  const cutLeft = hasIncoming && startIdx === indice(booking.check_in)
  const cutRight = hasOutgoing && endIdx === indice(booking.check_out)
  const clipPath = cutLeft || cutRight ? percorsoBarraArrotondata(g.width, misure.scheda, cutLeft, cutRight, 6, TAGLIO_CAMBIO) : undefined
  const tocco = areaTocco(rigaTop + misure.sopra, misure.scheda)
  const righe = {
    date: rigaDate(booking.check_in, booking.check_out, isWebPending ? 'dalSito' : null),
    icone: iconeScheda({ esclusiva: isEsclusiva, ottimo: isOttimo, ricevuta, letto: !!hasExtraBed, cambio: isMultiRoom, dalSito: booking.source === 'sito_web' && !isWebPending }),
    nome: nomeConAltri(booking),
    sotto: booking.ospitiPeriodo ? `${booking.ospitiPeriodo} · ${testoStato(stato)}` : rigaSotto({ ospiti: Number(booking.num_guests) || 1, stato: testoStato(stato), letti: lettiPoolPrenotazione(booking), poi: legami.poiCamera[booking.id], da: legami.daCamera[booking.id] }),
    arrivo: isWebPending ? null : hasIncoming ? CAMBIO_CAMERA : rigaArrivo(leggiArrivo(booking as unknown as Record<string, unknown>)),
  }
  return (
    <SchedaNastro id={booking.id} dati={{ stato }}
      onClick={e => { e.stopPropagation(); onTocca(booking, chainKey, e) }}
      classi={`${attenuata ? (cerca ? 'dim cerca' : 'dim') : ''} ${selezionata ? 'catena' : ''} ${trovata ? 'trovata' : ''}`}
      top={tocco.top} height={tocco.height} altezzaScheda={misure.scheda} left={colonnaCamere + g.left} width={g.width} zIndex={trovata ? 16 : selezionata ? 15 : 5}
      sito={isWebPending} cutLeft={cutLeft} letto={hasExtraBed ? lettiPoolPrenotazione(booking) : undefined}
      lettoTratti={trattiLetto(nottiLettoExtra(booking), indice, startIdx, endIdx, giorno)}
      fondo={tinta.fondo} testo={tinta.testo} filo={tinta.filo} clipPath={clipPath}
      cuneoDestra={cutRight ? tintaBase.filo : undefined} cuneoSinistra={cutLeft ? tinta.filo : undefined}
      testoLeft={colonnaCamere + ARIA_SCHEDA + 8} testoWidth={larghezzaTesto(startIdx, endIdx)}>
      <em>{righe.date}</em>
      {speso == null
        ? <b>{righe.icone && <span className="ic">{righe.icone} </span>}{righe.nome}</b>
        : <b className="con-speso"><span data-nome>{righe.icone && <span className="ic">{righe.icone} </span>}{righe.nome}</span><CifraSpeso cent={speso} /></b>}
      <small>{righe.sotto}</small>
      {righe.arrivo && <small className="ar2">{righe.arrivo}</small>}
    </SchedaNastro>
  )
}

// La cifra sulla riga del nome, allineata a destra, senza parole davanti
// (Ania, 02/10/2026). Il nome non si taglia mai per lei: si misura lo spazio
// che il nome lascia libero e si sceglie la forma più lunga che ci sta
// («1.380 €», poi «1.380»); se non ci sta nessuna, la cifra non si vede.
let tela: CanvasRenderingContext2D | null = null
function CifraSpeso({ cent }: { cent: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const forme = formeCifra(cent)
  const chiave = forme.join('|')
  const [quale, setQuale] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current, riga = el?.parentElement
    if (!el || !riga) return
    const elenco = chiave.split('|')
    const misura = () => {
      tela ??= document.createElement('canvas').getContext('2d')
      if (!tela) return
      tela.font = getComputedStyle(el).font
      const nome = riga.querySelector<HTMLElement>('[data-nome]')
      const libero = riga.clientWidth - (nome?.offsetWidth ?? 0) - 8
      const i = elenco.findIndex(t => tela!.measureText(t).width <= libero)
      setQuale(i === -1 ? elenco.length : i)
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(riga)
    void document.fonts?.ready.then(misura)
    return () => ro.disconnect()
  }, [chiave])
  const nascosta = quale >= forme.length
  return <span ref={ref} className="spe" data-speso={forme[0]} aria-hidden={nascosta || undefined} style={nascosta ? { visibility: 'hidden' } : undefined}>{forme[Math.min(quale, forme.length - 1)]}</span>
}

/** La camera tenuta da una proposta (15/09/2026): scheda in ottone, «in opzione», fino a quando; smorzata quando è scaduta */
export function SchedaTenuta({ barra, rigaTop, colonnaCamere, giorno, giorni, indice, attenuata, cerca, larghezzaTesto, titolo, onTocca, misure = MISURE_NASTRO.normale }: {
  barra: BarraTenuta
  rigaTop: number
  colonnaCamere: number
  giorno: number
  giorni: number
  indice: (iso: string) => number
  attenuata: boolean
  cerca: boolean
  larghezzaTesto: (da: number, a: number) => number
  titolo: string
  onTocca: (barra: BarraTenuta) => void
  misure?: MisureNastro
}) {
  const startIdx = Math.max(0, indice(barra.arrivo))
  const endIdx = Math.min(giorni, indice(barra.partenza))
  if (endIdx - startIdx <= 0) return null
  const g = geometriaScheda(startIdx, endIdx, giorno)
  const tinta = TINTE_SCHEDA.tenuta
  return (
    <div data-tenuta={barra.anticipato ? 'anticipato' : 'arrivo'} data-tocco
      onClick={(e) => { e.stopPropagation(); onTocca(barra) }}
      title={titolo}
      className={`cal-scheda ${attenuata ? (cerca ? 'dim cerca' : 'dim') : barra.scaduta ? 'scaduta' : ''}`}
      style={{ top: rigaTop + misure.sopra, height: misure.scheda, left: colonnaCamere + g.left, width: g.width, zIndex: 5 }}>
      <div className="cal-scheda-in" data-letto={barra.lettoNotti.length > 0 ? 1 : undefined}
        style={{ background: tinta.fondo, color: tinta.testo, borderLeftColor: tinta.filo, borderRadius: 6 }}>
        <FiloLetto tratti={trattiLetto(barra.lettoNotti, indice, startIdx, endIdx, giorno)} bordoSinistro={FILO_SINISTRO} />
        <span className="tx" style={{ left: colonnaCamere + ARIA_SCHEDA + 8, width: larghezzaTesto(startIdx, endIdx) }}>
          <em>{rigaDate(barra.arrivo, barra.partenza, 'opzione')}</em>
          <b>{barra.lettoNotti.length > 0 && <span className="ic">🛏 </span>}{barra.ospite}</b>
          <small>{rigaSotto({ ospiti: barra.persone, stato: barra.scaduta ? 'scaduta' : `scade alle ${oraRoma(barra.scadenza)}`, letti: barra.lettoNotti.length > 0 ? 1 : 0 })}</small>
        </span>
      </div>
    </div>
  )
}
