'use client'
// ============================================================================
// «ARRIVI DI OGGI» IN HOME (21/09/2026) — la terza superficie del riferimento
// approvato da Ania.
//
// Prima gli arrivi erano una riga sola fra le altre: «CHECK-IN · Nome —
// Camera · 🕐 15:00», e quel 15:00 non diceva di dove fosse. Adesso ogni
// arrivo ha il suo riquadro: in grande l'ora IN STRUTTURA (con «circa» se è
// una stima o una fascia), e sotto, riga per riga, da dove arriva e chi la va
// a prendere. Niente riquadro bianco: filo d'ottone a sinistra e fondo della
// Home, come il resto delle sezioni editoriali.
//
// Questo riquadro si AGGIUNGE: la riga «CHECK-IN» del blocco «Oggi /
// Domani» resta dov'era, con la nota del cliente in rosso e il letto in più
// (rilievo di Codex, 21/09/2026 sera: toglierla non l'aveva deciso Ania).
// Per non far leggere due volte la stessa nota rossa a mezzo schermo di
// distanza, qui la nota non si ripete: il letto in più sì, perché serve a
// preparare la camera. Il confronto per la decisione sta nel riscontro.
//
// Riepilogo da lib/arrivo e modifica tramite il foglio condiviso della scheda.
// ============================================================================
import { useState } from 'react'
import Link from 'next/link'
import FoglioArrivo from '@/components/scheda/FoglioArrivo'
import { etichettaArrivoPeriodo } from '@/lib/arriviPeriodi'
import { whatsappRichiestaOrario, waHrefTesto } from '@/lib/messaggiWhatsApp'
import { Plane, TrainFront, MapPin, Car } from 'lucide-react'
import { nomeConAltri } from '@/lib/guestName'
import { arrivoInHome, leggiArrivo, type IconaArrivo } from '@/lib/arrivo'

const OTTONE = '#A9884E'
export const TITOLO_ARRIVI_OGGI = 'Arrivi di oggi'
export const TITOLO_ARRIVI_DOMANI = 'Arrivi di domani'

const ICONE: Record<IconaArrivo, typeof Plane> = { aereo: Plane, treno: TrainFront, luogo: MapPin, auto: Car }

export function contaArrivi(n: number): string {
  return n === 1 ? '1 arrivo' : `${n} arrivi`
}

type Riga = Record<string, unknown> & {
  id: string
  check_in: string
  check_out: string
  guest_name?: string | null
  rooms?: { name?: string | null } | null
  guests?: { full_name?: string | null; phone?: string | null } | null
}

function Riquadro({ b, onApri }: { b: Riga; onApri: (b: Riga) => void }) {
  const arrivo = leggiArrivo(b)
  const a = arrivoInHome(arrivo)
  const richiesta = whatsappRichiestaOrario(b)
  const camera = b.rooms?.name
  return (
    <article data-arrivo-home={String(b.id)} className="home-arrivo">
      <div className="home-identita">
        <Link href={`/scheda/${b.id}`} aria-label={`Apri prenotazione di ${nomeConAltri(b)}`} className="home-nome">{nomeConAltri(b)}</Link>
        {camera && <span className="home-camera" data-camera>{camera}</span>}
      </div>
      {!!b.extra_bed && <p data-letto-agg className="home-letto">+ Letto aggiuntivo</p>}
      <div className="home-orario-riga" data-comandi-arrivo>
        <span data-ora-struttura className="home-orario">{a.numerico ? a.grande : 'Orario da chiedere'}{a.circa && <span data-circa> circa</span>}</span>
        <button type="button" className="home-matita" onClick={() => onApri(b)} aria-label={`Modifica arrivo di ${nomeConAltri(b)} · ${etichettaArrivoPeriodo(b)}`}>✎</button>
        {richiesta && <details className="home-whatsapp">
          <summary><svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.4-4.6a9 9 0 1 1 16.6-4.9Z" /></svg>WhatsApp</summary>
          <div>
            <a href={waHrefTesto(richiesta.numero, '')} target="_blank" rel="noopener noreferrer" aria-label={`Apri chat con ${nomeConAltri(b)}`}>Apri chat</a>
            <a href={richiesta.href} target="_blank" rel="noopener noreferrer" aria-label={`Chiedi orario a ${nomeConAltri(b)}`}>Chiedi orario</a>
          </div>
        </details>}
      </div>
      <p data-sotto-ora className="home-secondario">{a.sotto}</p>
      {a.righe.map((r, i) => {
        const Icona = ICONE[r.icona]
        return <div key={r.icona + i} data-riga-arrivo={r.icona} className="home-trasporto">
          <Icona size={17} color={OTTONE} aria-hidden className="shrink-0" />
          <div><p className="home-info">{r.forte}</p>{r.sotto && <p className="home-secondario">{r.sotto}</p>}</div>
        </div>
      })}
      {arrivo.navetta === 'non_richiesta' && <div className="home-trasporto"><div><p className="home-info">Arrivo autonomo</p><p className="home-secondario">Navetta non richiesta</p></div></div>}
      {!richiesta && <p className="home-secondario">Telefono mancante: aggiungilo dalla prenotazione per usare WhatsApp.</p>}
    </article>
  )
}

export default function ArriviOggi({ oggi, domani, onSalvato }: {
  oggi: Riga[]
  domani: Riga[]
  onSalvato: (id: string, campi: Record<string, unknown>) => void
}) {
  const [selezionato, setSelezionato] = useState<Riga | null>(null)
  if (oggi.length === 0 && domani.length === 0) return null
  return (
    <section data-arrivi-home className="home-arrivi">
      {oggi.length > 0 && (
        <>
          <h2 className="home-sezione"><span>{TITOLO_ARRIVI_OGGI}</span><small>{contaArrivi(oggi.length)}</small></h2>
          {oggi.map(b => <Riquadro key={b.id} b={b} onApri={setSelezionato} />)}
        </>
      )}
      {domani.length > 0 && (
        <>
          <h2 className={`home-sezione ${oggi.length ? 'home-domani' : ''}`}><span>{TITOLO_ARRIVI_DOMANI}</span><small>{contaArrivi(domani.length)}</small></h2>
          {domani.map(b => <Riquadro key={b.id} b={b} onApri={setSelezionato} />)}
        </>
      )}
      {selezionato && <FoglioArrivo key={selezionato.id} bookingId={selezionato.id} prenotazione={selezionato}
        etichetta={`${nomeConAltri(selezionato)} · ${etichettaArrivoPeriodo(selezionato)}`}
        onChiudi={() => setSelezionato(null)}
        onSalvato={campi => {
          onSalvato(selezionato.id, campi)
          setSelezionato(null)
        }} />}
    </section>
  )
}
