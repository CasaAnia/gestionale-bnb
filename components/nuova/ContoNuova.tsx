'use client'
// ============================================================================
// IL CONTO della pagina di inserimento (14/09/2026): una riga per ogni camera,
// il letto in più, il totale, lo sconto e quanto c'è da pagare. Le cifre
// arrivano già fatte da lib/nuovaPrenotazione (che a sua volta usa le regole
// di lib/prezzoNotti).
//
// Dal 15/09/2026 sta SUBITO SOTTO IL SOGGIORNO, non più in fondo: mentre Ania
// sceglie camere, notti, letto e sconto i numeri sono lì, senza scorrere. Il
// tasto «Salva la prenotazione» invece resta in fondo alla pagina, ed è un
// pezzo a parte (TastoSalva) — il conto resta uno solo.
// ============================================================================
import { TastoAvanti, OTTONE, MATTONE, GEORGIA } from './PezziNuova'
import type { ContoNuova as Conto } from '@/lib/nuovaPrenotazione'

export const FILO_OTTONE = 'rgba(169,136,78,0.55)'
export const TITOLO_CONTO = 'Il conto'
export const SALVA = 'Salva la prenotazione'
export const DA_COMPLETARE = 'da completare'

/** Il tasto che chiude la pagina, con l'avviso di cosa manca */
export function TastoSalva({ onSalva, spento, avviso, className = '' }: {
  onSalva: () => void
  spento?: boolean
  /** l'avviso in mattone sotto il tasto: il campo che ferma il salvataggio */
  avviso?: string | null
  className?: string
}) {
  return (
    <div data-salva-prenotazione className={className}>
      <TastoAvanti testo={SALVA} onClick={onSalva} disabilitato={spento} dati="salva" />
      {avviso && (
        <p data-avviso-salva className="text-center" style={{ fontSize: 12.5, fontWeight: 600, color: MATTONE, marginTop: 10 }}>{avviso}</p>
      )}
    </div>
  )
}

export default function ContoNuova({ conto, manca, className = '' }: {
  conto: Conto
  /** cosa manca davvero perché il conto sia intero: si scrive in ottone */
  manca?: string | null
  className?: string
}) {
  const euroGrande = (testo: string | null) => testo ?? DA_COMPLETARE
  return (
    <section data-conto-nuova className={className}>
      <p className="ed-sezione">{TITOLO_CONTO}</p>

      {conto.righe.map(r => (
        <div key={r.chiave} data-riga-conto className="flex items-baseline justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-card-border)' }}>
          <span className="min-w-0">
            <span className="block truncate" style={{ fontSize: 14.5, color: 'var(--color-green-dark)' }}>{r.titolo}</span>
            <span className="block" style={{ fontSize: 12, color: 'var(--color-stone)', marginTop: 1 }}>{r.dettaglio}</span>
          </span>
          <span className="shrink-0" style={{ fontFamily: GEORGIA, fontSize: 17, color: 'var(--color-green-dark)' }}>{r.importo}</span>
        </div>
      ))}

      <div data-totale className="flex items-baseline justify-between gap-3" style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 10, marginTop: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>Totale</span>
        <span style={{ fontFamily: GEORGIA, fontSize: 22, color: 'var(--color-green-dark)' }}>{euroGrande(conto.totale)}</span>
      </div>

      {conto.sconto && (
        <div data-sconto-riga className="flex items-baseline justify-between gap-3" style={{ paddingTop: 8 }}>
          <span style={{ fontSize: 14, color: OTTONE }}>Sconto</span>
          <span style={{ fontFamily: GEORGIA, fontSize: 17, color: OTTONE }}>− {conto.sconto}</span>
        </div>
      )}

      <div data-da-pagare className="flex items-baseline justify-between gap-3" style={{ paddingTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>Da pagare</span>
        <span style={{ fontFamily: GEORGIA, fontSize: 28, lineHeight: '32px', color: 'var(--color-green-dark)' }}>{euroGrande(conto.daPagare)}</span>
      </div>
      {conto.aNotte && <p data-a-notte className="text-right" style={{ fontSize: 12, color: 'var(--color-stone)', marginTop: 2 }}>{conto.aNotte}</p>}
      {manca && <p data-manca-conto className="text-right" style={{ fontSize: 12, color: OTTONE, marginTop: 2 }}>{manca}</p>}
    </section>
  )
}
