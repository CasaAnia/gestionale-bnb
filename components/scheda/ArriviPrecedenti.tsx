'use client'
// ============================================================================
// «ARRIVI PRECEDENTI» (13/09/2026): come erano andati gli arrivi degli altri
// soggiorni CONCLUSI di questa cliente — periodo, camere, orario e navetta —
// le stesse righe della scheda attuale, calcolate con lib/storicoCliente.
// Solo lettura: non scrive niente. Le righe le fa lib/arriviPrecedenti
// (dal 22/10/2026 anche il luogo e il prelievo).
// ============================================================================
import type { SegmentoStorico } from '@/lib/storicoCliente'
import { arriviPrecedenti } from '@/lib/arriviPrecedenti'

export { arriviPrecedenti }

export default function ArriviPrecedenti({ altre, oggi, className = '' }: { altre: SegmentoStorico[]; oggi: string; className?: string }) {
  const righe = arriviPrecedenti(altre, oggi)
  // veste «Maison» (28/09/2026): righe a filo, il periodo in Cormorant
  if (righe.length === 0) return <p data-arrivi-precedenti className={`np-hint ${className}`}>Nessun arrivo precedente registrato per questa cliente.</p>
  return (
    <div data-arrivi-precedenti className={className}>
      {righe.map(r => (
        <div key={r.chiave} className="sch-prec-arrivo">
          <span className="sch-big">{r.periodo}</span>
          <span>{r.camere}</span>
          {r.luogo && <span data-luogo-precedente className="ml-auto">{r.luogo}</span>}
          {r.orario && <span data-orario-precedente className={r.luogo ? undefined : 'ml-auto'}>{r.orario}</span>}
          <span>{r.navetta}</span>
          {r.prelievo && <span data-prelievo-precedente>{r.prelievo}</span>}
        </div>
      ))}
    </div>
  )
}
