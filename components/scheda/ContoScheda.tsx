'use client'
// ============================================================================
// LA PARTE «CONTO» della nuova scheda prenotazione (13/09/2026): quanto manca
// (o «Saldato») in grande a sinistra, il dettaglio a destra, una barretta che
// dice a occhio quanto è stato pagato, poi il conto riga per riga, il totale,
// l'accordo e i pagamenti già registrati.
//
// Sola presentazione: i testi e le cifre arrivano da lib/schedaConto, che a
// sua volta NON ricalcola il totale (viene da lib/prenotazioneUnica).
// ============================================================================
import Link from 'next/link'
import type { RigaConto, RigaPagamento, TestaConto } from '@/lib/schedaConto'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
const FILO_OTTONE = 'rgba(169,136,78,0.55)'
export const ROSSO_CONTO = '#D40000'
export const FONDO_BARRA = '#EFE9DC'
export const ALTEZZA_BARRA = 4

export default function ContoScheda({ testa, righe, totale, accordo, pagamenti, hrefPagamento, hrefAccordo, className = '' }: {
  testa: TestaConto
  righe: RigaConto[]
  totale: string
  accordo: string
  pagamenti: RigaPagamento[]
  hrefPagamento: string
  hrefAccordo: string
  className?: string
}) {
  return (
    <div data-conto className={className}>
      {/* Quanto manca, in grande; a destra il dettaglio su due righe */}
      <div className="flex items-start justify-between gap-3">
        <p data-conto-titolo={testa.saldato ? 'saldato' : 'manca'} className="leading-none"
          style={{ fontFamily: GEORGIA, fontSize: 32, color: testa.saldato ? 'var(--color-green-dark)' : ROSSO_CONTO }}>
          {testa.titolo}
        </p>
        <p className="text-right shrink-0 leading-snug" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>
          {testa.dettaglio}
          {testa.sotto && <><br />{testa.sotto}</>}
        </p>
      </div>

      {/* La barretta: quanto è già stato pagato */}
      <div data-barra-conto aria-hidden className="mt-3 overflow-hidden"
        style={{ height: ALTEZZA_BARRA, borderRadius: ALTEZZA_BARRA, background: FONDO_BARRA }}>
        <div style={{ width: `${Math.round(testa.quotaPagata * 100)}%`, height: '100%', background: 'var(--color-green-mid)', opacity: 0.55 }} />
      </div>

      {/* Il conto riga per riga */}
      <div className="mt-3">
        {righe.map((r, i) => (
          <div key={r.chiave} data-riga-conto className="flex items-baseline justify-between gap-3"
            style={{ padding: '9px 0', borderTop: i > 0 ? '1px solid var(--color-card-border)' : undefined }}>
            <span className="min-w-0" style={{ fontSize: 14, color: r.sconto ? OTTONE : 'var(--color-green-dark)' }}>{r.testo}</span>
            <span className="shrink-0" style={{ fontSize: 14, fontWeight: 600, color: r.sconto ? OTTONE : 'var(--color-green-dark)' }}>{r.importo}</span>
          </div>
        ))}
      </div>

      {/* Il totale, staccato da un filo d'ottone */}
      <div data-totale-conto className="flex items-baseline justify-between gap-3" style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>Totale</span>
        <span style={{ fontFamily: GEORGIA, fontSize: 24, color: 'var(--color-green-dark)' }}>{totale}</span>
      </div>

      {/* Come è stato concordato */}
      <div data-accordo className="flex items-baseline justify-between gap-3" style={{ padding: '10px 0 0' }}>
        <span style={{ fontSize: 14, color: 'var(--color-stone)' }}>Accordo</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{accordo}</span>
      </div>

      {/* I pagamenti già registrati */}
      {pagamenti.map(p => (
        <div key={p.id} data-pagamento className="flex items-baseline justify-between gap-3" style={{ padding: '8px 0 0' }}>
          <span style={{ fontSize: 14, color: 'var(--color-stone)' }}>{p.quando}</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{p.importo}</span>
        </div>
      ))}

      <p className="flex flex-wrap items-center mt-2" style={{ gap: '0 12px', fontSize: 14 }}>
        <Link href={hrefPagamento} className="py-2 -my-2" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }}>Aggiungi pagamento</Link>
        <Link href={hrefAccordo} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>Cambia accordo</Link>
      </p>
    </div>
  )
}
