'use client'
// ============================================================================
// LA VESTE DEL CONTO IN RIGHE (18/09/2026): i pezzi che disegnano un conto,
// uguali nell'inserimento, nella scheda e nel foglio «Il soggiorno si
// allunga». Le parole e i numeri arrivano da lib/contoInRighe e da chi chiama.
//   - la riga: titolo 14,5, dettaglio 12 stone, importo in Georgia 17;
//   - «Totale» col filo d'ottone sopra, in Georgia 22;
//   - lo sconto in ottone, in Georgia 17;
//   - «Da pagare» in Georgia 28 e sotto, a destra, in 12 stone, le notti e
//     quanto viene a notte.
// ============================================================================
import type { ReactNode } from 'react'
import { GEORGIA, OTTONE } from '@/components/nuova/PezziNuova'
import { RIGA_TOTALE, RIGA_DA_PAGARE, type RigaContoVista, type ScontoVista } from '@/lib/contoInRighe'

export const FILO_OTTONE = 'rgba(169,136,78,0.55)'

/** Una riga del conto: la camera col dettaglio sotto, o il letto in più */
export function RigaConto({ riga }: { riga: RigaContoVista }) {
  return (
    <div data-riga-conto={riga.chiave} className="flex items-baseline justify-between gap-3" style={{ padding: '10px 0', borderBottom: '1px solid var(--color-card-border)' }}>
      <span className="min-w-0">
        <span className="block truncate" style={{ fontSize: 14.5, color: 'var(--color-green-dark)' }}>{riga.titolo}</span>
        <span className="block" style={{ fontSize: 12, color: 'var(--color-stone)', marginTop: 1 }}>{riga.dettaglio}</span>
      </span>
      <span className="shrink-0" style={{ fontFamily: GEORGIA, fontSize: 17, color: 'var(--color-green-dark)' }}>{riga.importo}</span>
    </div>
  )
}

/** «Totale»: quanto costa senza sconto */
export function TotaleConto({ importo }: { importo: string }) {
  return (
    <div data-totale className="flex items-baseline justify-between gap-3" style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 10, marginTop: 4 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{RIGA_TOTALE}</span>
      <span style={{ fontFamily: GEORGIA, fontSize: 22, color: 'var(--color-green-dark)' }}>{importo}</span>
    </div>
  )
}

/** Lo sconto, una riga sola in ottone: «Sconto 10 %» −32 € */
export function ScontoConto({ sconto }: { sconto: ScontoVista }) {
  return (
    <div data-sconto-riga className="flex items-baseline justify-between gap-3" style={{ paddingTop: 8 }}>
      <span style={{ fontSize: 14, color: OTTONE }}>{sconto.testo}</span>
      <span style={{ fontFamily: GEORGIA, fontSize: 17, color: OTTONE }}>{sconto.importo}</span>
    </div>
  )
}

/** «Da pagare» in grande e, sotto a destra, «3 notti · 85 € a notte» */
export function DaPagareConto({ importo, sotto, children }: { importo: string; sotto?: string | null; children?: ReactNode }) {
  return (
    <>
      <div data-da-pagare className="flex items-baseline justify-between gap-3" style={{ paddingTop: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{RIGA_DA_PAGARE}</span>
        <span style={{ fontFamily: GEORGIA, fontSize: 28, lineHeight: '32px', color: 'var(--color-green-dark)' }}>{importo}</span>
      </div>
      {sotto && <p data-a-notte className="text-right" style={{ fontSize: 12, color: 'var(--color-stone)', marginTop: 2 }}>{sotto}</p>}
      {children}
    </>
  )
}
