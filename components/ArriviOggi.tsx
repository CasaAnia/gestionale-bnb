'use client'
// ============================================================================
// «LA GIORNATA» E «ARRIVI DI DOMANI» IN HOME (veste «Maison» del 28/09/2026;
// gli arrivi in cima dal 21/09/2026).
//
// La giornata tiene, in quest'ordine:
//  a) gli arrivi di oggi, ognuno col suo riquadro: il nome (link alla
//     scheda, filo d'ottone sotto) e la camera in maiuscoletto ottone, il
//     letto in più in mattone, l'ora IN STRUTTURA grande in Cormorant sottile
//     («circa» solo se è una stima, «Da definire» se manca), la matita a filo che
//     apre «Arrivo e navetta», il menu «WhatsApp ▾» (Apri chat, Chiedi
//     orario), la riga sotto, le righe del trasporto con l'icona a filo e in
//     fondo la nota del cliente in mattone (prima stava nel blocco «Oggi»);
//  b) le partenze di oggi SOLO se resta qualcosa da incassare: «CHECK-OUT ·
//     Nome — Camera», il residuo in mattone, e sotto «Bonifico atteso · Segna
//     pagato» (il foglio del pagamento, con la conferma B);
//  c) i cambi camera di oggi, «⇄ CAMBIO · Nome — da → a».
// Il vecchio blocco «Oggi / Domani» è assorbito qui e non c'è più.
// «Arrivi di domani» ha gli stessi riquadri; partenze e cambi di domani no.
//
// Riepilogo da lib/arrivo e modifica tramite il foglio condiviso della scheda.
// ============================================================================
import { useState } from 'react'
import Link from 'next/link'
import FoglioArrivo from '@/components/scheda/FoglioArrivo'
import PagamentoDaHome from '@/components/maison/PagamentoDaHome'
import { etichettaArrivoPeriodo } from '@/lib/arriviPeriodi'
import { whatsappRichiestaOrario, waHrefTesto } from '@/lib/messaggiWhatsApp'
import { nomeConAltri } from '@/lib/guestName'
import { arrivoInHome, leggiArrivo, type IconaArrivo } from '@/lib/arrivo'
import { BONIFICO_ATTESO, PAGAMENTO_ATTESO, SEGNA_PAGATO, type PartenzaConResiduo } from '@/lib/incassiHome'
import type { PagamentoSalvato } from '@/components/scheda/FoglioPagamento'
import { hrefScheda } from '@/lib/provenienzaScheda'

export const TITOLO_GIORNATA = 'La giornata'
export const TITOLO_ARRIVI_DOMANI = 'Arrivi di domani'
export const TELEFONO_MANCANTE = 'Telefono mancante: aggiungilo dalla prenotazione per usare WhatsApp.'

// Le icone a filo del riferimento, tali e quali
const ICONE: Record<IconaArrivo, React.ReactNode> = {
  aereo: <svg viewBox="0 0 24 24" aria-hidden><path d="M2 14l8-1 4-8 2 1-2 8 7 3-1 2-8-2-4 4-2-1 2-4-4-2z" /></svg>,
  treno: <svg viewBox="0 0 24 24" aria-hidden><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M8 21l2-4M16 21l-2-4" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /></svg>,
  luogo: <svg viewBox="0 0 24 24" aria-hidden><path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z" /><circle cx="12" cy="10" r="2" /></svg>,
  auto: <svg viewBox="0 0 24 24" aria-hidden><path d="M4 16l2-6h12l2 6v4H4z" /><circle cx="8" cy="16" r="1.5" /><circle cx="16" cy="16" r="1.5" /></svg>,
}
// La matita a filo accanto all'orario: inclinata, tratto 1,4 px anche a 18 px
export const ICONA_MATITA = <svg viewBox="0 0 24 24" aria-hidden data-icona-matita><path vectorEffect="non-scaling-stroke" d="M15.5 4.5l4 4L8 20H4v-4z" /><path vectorEffect="non-scaling-stroke" d="M13 7l4 4" /></svg>
export const ICONA_WHATSAPP = <svg viewBox="0 0 24 24" aria-hidden><path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6a9 9 0 1 1 16.6-4.9Z" /></svg>

export function contaArrivi(n: number): string {
  return n === 1 ? '1 arrivo' : `${n} arrivi`
}
export const contaPartenze = (n: number) => (n === 1 ? '1 partenza' : `${n} partenze`)
export const contaCambi = (n: number) => (n === 1 ? '1 cambio camera' : `${n} cambi camera`)
const euro = (c: number) => `${(c / 100).toLocaleString('it-IT', { minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`

type Riga = Record<string, unknown> & {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  rooms?: { name?: string | null } | null
  guests?: { full_name?: string | null; phone?: string | null; notes?: string | null } | null
}
export type CambioOggi = { id: string; guest: string; fromRoom: string; toRoom: string }

function Riquadro({ b, onApri }: { b: Riga; onApri: (b: Riga) => void }) {
  const arrivo = leggiArrivo(b)
  const a = arrivoInHome(arrivo)
  const richiesta = whatsappRichiestaOrario(b)
  const camera = b.rooms?.name
  const nome = nomeConAltri(b)
  return (
    <article data-arrivo-home={String(b.id)} className="mz-arr">
      <div className="id">
        <Link href={hrefScheda(b.id, 'home')} aria-label={`Apri prenotazione di ${nome}`} className="nm mz-nome-link">{nome}</Link>
        {camera && <span className="rm" data-camera>{camera}</span>}
      </div>
      {!!b.extra_bed && <p data-letto-agg className="letto">+ Letto aggiuntivo</p>}
      <div className="ora" data-comandi-arrivo>
        <b data-ora-struttura>{a.grande}{a.circa && <small data-circa>circa</small>}</b>
        <button type="button" className="pen" onClick={() => onApri(b)} aria-label={`Modifica arrivo di ${nome} · ${etichettaArrivoPeriodo(b)}`}>{ICONA_MATITA}</button>
        {richiesta && <details className="mz-wam">
          <summary className="mz-lnk q">{ICONA_WHATSAPP}WhatsApp ▾</summary>
          <div className="menu">
            <a href={waHrefTesto(richiesta.numero, '')} target="_blank" rel="noopener noreferrer" aria-label={`Apri chat con ${nome}`}>Apri chat</a>
            <a href={richiesta.href} target="_blank" rel="noopener noreferrer" aria-label={`Chiedi orario a ${nome}`}>Chiedi orario</a>
          </div>
        </details>}
      </div>
      <p data-sotto-ora className="sotto">{a.sotto}</p>
      {a.righe.map((r, i) => (
        <div key={r.icona + i} data-riga-arrivo={r.icona} className="tr">
          {ICONE[r.icona]}
          <div><p className="f">{r.forte}</p>{r.sotto && <p className="s">{r.sotto}</p>}</div>
        </div>
      ))}
      {arrivo.navetta === 'non_richiesta' && <div className="tr"><span /><div><p className="f">Arrivo autonomo</p><p className="s">Navetta non richiesta</p></div></div>}
      {!richiesta && <p className="sotto">{TELEFONO_MANCANTE}</p>}
      {/* La nota del cliente in mattone (Ania, 10/09/2026: prima che arrivi si legge senza aprire nulla) */}
      {b.guests?.notes && <p data-nota-cliente-home className="nota">{b.guests.notes}</p>}
    </article>
  )
}

export default function ArriviOggi({ oggi, domani, partenze = [], cambi = [], partenzeOggi = 0, onSalvato, onPagato }: {
  oggi: Riga[]
  domani: Riga[]
  /** le partenze di oggi con un residuo da incassare (lib/incassiHome) */
  partenze?: PartenzaConResiduo[]
  cambi?: CambioOggi[]
  /** quante partenze ci sono oggi in tutto, per la riga del titolo */
  partenzeOggi?: number
  onSalvato: (id: string, campi: Record<string, unknown>) => void
  onPagato?: (esito: PagamentoSalvato) => void
}) {
  const [selezionato, setSelezionato] = useState<Riga | null>(null)
  const [pagamento, setPagamento] = useState<string | null>(null)
  const giornata = oggi.length > 0 || partenze.length > 0 || cambi.length > 0
  if (!giornata && domani.length === 0) return null
  const conta = [oggi.length && contaArrivi(oggi.length), partenzeOggi && contaPartenze(partenzeOggi), cambi.length && contaCambi(cambi.length)].filter(Boolean)
  return (
    <div data-arrivi-home>
      {giornata && (
        <section className="mz-sec" data-giornata>
          <p className="mz-eyebrow">{TITOLO_GIORNATA} {conta.length > 0 && <small>· {conta.join(' · ')}</small>}</p>
          {oggi.map(b => <Riquadro key={b.id} b={b} onApri={setSelezionato} />)}
          {partenze.map(p => (
            <div key={`out-${p.id}`} className="mz-ev" data-partenza-home={p.id}>
              <span className="k o">Check-out</span>
              <Link href={hrefScheda(p.id, 'home')} className="gn">{p.nome}</Link>
              <span className="r">— {p.camera}</span>
              <span className="eur" data-residuo>{euro(p.residuoCent)}</span>
              <span className="nota">{p.bonifico ? BONIFICO_ATTESO : PAGAMENTO_ATTESO} · <button type="button" className="mz-lnk" onClick={() => setPagamento(p.id)} data-segna-pagato>{SEGNA_PAGATO}</button></span>
            </div>
          ))}
          {cambi.map(m => (
            <div key={`ch-${m.id}`} className="mz-ev" data-cambio-home>
              <span className="k c">⇄ Cambio</span>
              <span className="gn">{m.guest}</span>
              <span className="r">— {m.fromRoom} → {m.toRoom}</span>
            </div>
          ))}
        </section>
      )}
      {domani.length > 0 && (
        <section className="mz-sec" data-arrivi-domani>
          <p className="mz-eyebrow grigio">{TITOLO_ARRIVI_DOMANI} <small>· {contaArrivi(domani.length)}</small></p>
          {domani.map(b => <Riquadro key={b.id} b={b} onApri={setSelezionato} />)}
        </section>
      )}
      {selezionato && <FoglioArrivo key={selezionato.id} bookingId={selezionato.id} prenotazione={selezionato}
        onChiudi={() => setSelezionato(null)}
        onSalvato={campi => {
          onSalvato(selezionato.id, campi)
          setSelezionato(null)
        }} />}
      {pagamento && <PagamentoDaHome bookingId={pagamento} onChiudi={() => setPagamento(null)}
        onSalvato={esito => { setPagamento(null); onPagato?.(esito) }} />}
    </div>
  )
}
