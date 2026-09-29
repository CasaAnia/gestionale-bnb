'use client'
// ============================================================================
// LA LINGUETTA «OGGI» della scheda «Maison» (riferimento del 28/09/2026,
// telefoni 1 e 1b):
//   IN BREVE — righe etichetta / valore (valore in Cormorant a destra):
//     Arrivo, Camera, Ospiti (solo se cambiano), Conto, Documento, Note;
//   DA FARE OGGI · N — le voci di «Da controllare» di questa prenotazione
//     (stessi titoli e dettagli di lib/schedaPrenotazione), ognuna con UNA
//     azione a destra; con zero voci «✓ Tutto a posto»;
//   PROSSIMI GIORNI — i cambi camera e la partenza.
// Sola presentazione: parole e cifre arrivano da lib/schedaMaison.
// ============================================================================
import Link from 'next/link'
import { TUTTO_A_POSTO } from '@/lib/schedaPrenotazione'
import { IN_BREVE, DA_FARE_OGGI, PROSSIMI_GIORNI, type GiornoProssimo, type AzioneDaFare } from '@/lib/schedaMaison'

export type RigaInBreve = { chiave: string; etichetta: string; valori: string[]; tono?: 'mat' | 'verde' }
export type VoceDaFare = {
  chiave: string
  titolo: string
  dettaglio: string
  azione: AzioneDaFare
  /** o un tocco (apre un foglio qui), o un link */
  onClick?: () => void
  href?: string | null
}

export default function OggiScheda({ inBreve, daFare, prossimi }: { inBreve: RigaInBreve[]; daFare: VoceDaFare[]; prossimi: GiornoProssimo[] }) {
  return (
    <div data-parte-oggi>
      <div className="sch-brief" data-in-breve>
        <p className="sch-k sch-brief-k">{IN_BREVE}</p>
        {inBreve.map(r => (
          <div key={r.chiave} data-breve={r.chiave} className={`sch-r ${r.valori.length > 1 ? 'col' : ''}`}>
            <span>{r.etichetta}</span>
            <b className={r.tono ?? ''}>
              {r.valori.map((v, i) => (i === 0 ? <span key={i} className="primo">{v}</span> : <span key={i} className="sotto">{v}</span>))}
            </b>
          </div>
        ))}
      </div>

      <section className="np-sec" data-da-fare>
        <p className="mz-eyebrow">{DA_FARE_OGGI} {daFare.length > 0 && <small>· {daFare.length}</small>}</p>
        {daFare.length === 0
          ? <p data-tutto-a-posto className="sch-a-posto">{TUTTO_A_POSTO}</p>
          : daFare.map((v, i) => (
            <div key={v.chiave} data-voce-da-fare={v.chiave} className="sch-fare">
              <span className="min-w-0">
                <span className="sch-big sch-fare-ti">{v.titolo}</span>
                {v.dettaglio && <span className="sch-fare-de">{v.dettaglio}</span>}
              </span>
              {v.onClick
                ? <button type="button" data-azione-da-fare={v.azione} className={`mz-lnk ${i === 0 ? '' : 'q'}`} onClick={v.onClick}>{v.azione}</button>
                : v.href
                  ? <Link href={v.href} data-azione-da-fare={v.azione} className={`mz-lnk ${i === 0 ? '' : 'q'}`}>{v.azione}</Link>
                  : null}
            </div>
          ))}
      </section>

      {prossimi.length > 0 && (
        <section className="np-sec" data-prossimi-giorni>
          <p className="mz-eyebrow">{PROSSIMI_GIORNI}</p>
          {prossimi.map(g => (
            <div key={g.chiave} data-prossimo={g.chiave} className="sch-giorno">
              <span><b>{g.giorno}</b> · {g.cosa}</span>
              {g.nota && <span className="nota">{g.nota}</span>}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
