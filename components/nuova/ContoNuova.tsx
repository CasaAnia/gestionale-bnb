'use client'
// ============================================================================
// IL CONTO della pagina di inserimento (14/09/2026): una riga per ogni camera,
// il letto in più, il totale, lo sconto e quanto c'è da pagare. Le cifre
// arrivano già fatte da lib/nuovaPrenotazione (che a sua volta usa le regole
// di lib/prezzoNotti e le parole di lib/contoInRighe).
//
// Dal 15/09/2026 sta SUBITO SOTTO IL SOGGIORNO, non più in fondo: mentre Ania
// sceglie camere, notti, letto e sconto i numeri sono lì, senza scorrere. Il
// tasto «Salva la prenotazione» invece resta in fondo alla pagina, ed è un
// pezzo a parte (TastoSalva) — il conto resta uno solo.
// ============================================================================
import { TastoAvanti, OTTONE, MATTONE } from './PezziNuova'
import { RigaConto, TotaleConto, ScontoConto, DaPagareConto, FILO_OTTONE } from '@/components/ContoRighe'
import type { ContoNuova as Conto } from '@/lib/nuovaPrenotazione'

export { FILO_OTTONE }
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

// Dal 18/09/2026 le righe sono quelle di components/ContoRighe, le stesse
// della scheda e del foglio «Il soggiorno si allunga».
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
      {conto.righe.map(r => <RigaConto key={r.chiave} riga={r} />)}
      <TotaleConto importo={euroGrande(conto.totale)} />
      {conto.sconto && <ScontoConto sconto={conto.sconto} />}
      <DaPagareConto importo={euroGrande(conto.daPagare)} sotto={conto.aNotte || null}>
        {manca && <p data-manca-conto className="text-right" style={{ fontSize: 12, color: OTTONE, marginTop: 2 }}>{manca}</p>}
      </DaPagareConto>
    </section>
  )
}
