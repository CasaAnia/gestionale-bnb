'use client'
// ============================================================================
// «ARRIVI PRECEDENTI» (13/09/2026): come erano andati gli arrivi degli altri
// soggiorni CONCLUSI di questa cliente — periodo, camere, orario e navetta —
// le stesse righe della scheda attuale, calcolate con lib/storicoCliente.
// Solo lettura: non scrive niente.
// ============================================================================
import { righeStorico, type SegmentoStorico } from '@/lib/storicoCliente'
import { periodoCompatto } from '@/lib/dateItaliane'

export function arriviPrecedenti(altre: SegmentoStorico[], oggi: string) {
  return righeStorico(altre)
    .filter(r => r.status !== 'annullata')
    .filter(r => r.segmenti.filter(s => s.status !== 'annullata').every(s => ['confermata', 'completata'].includes(s.status) && s.check_out <= oggi))
    .sort((a, z) => z.check_in.localeCompare(a.check_in))
    .map(r => {
      const primo = [...r.segmenti].sort((a, z) => a.check_in.localeCompare(z.check_in))[0]
      return {
        chiave: r.chiave,
        periodo: periodoCompatto(r.check_in, r.check_out, { anno: true }),
        camere: r.camere.join(' → '),
        orario: primo?.check_in_time ? `arrivo ${primo.check_in_time}` : 'orario non registrato',
        navetta: primo?.shuttle === 'si' ? 'navetta sì' : primo?.shuttle === 'no' ? 'navetta no' : 'navetta non registrata',
      }
    })
}

export default function ArriviPrecedenti({ altre, oggi, className = '' }: { altre: SegmentoStorico[]; oggi: string; className?: string }) {
  const righe = arriviPrecedenti(altre, oggi)
  if (righe.length === 0) return <p data-arrivi-precedenti className={className} style={{ fontSize: 13, color: 'var(--color-stone)' }}>Nessun arrivo precedente registrato per questa cliente.</p>
  return (
    <div data-arrivi-precedenti className={`ed-lista ${className}`}>
      {righe.map(r => (
        <div key={r.chiave} className="flex flex-wrap items-baseline" style={{ gap: '2px 8px', padding: '8px 0', fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: 'var(--color-green-dark)' }}>{r.periodo}</span>
          <span style={{ color: 'var(--color-stone)' }}>{r.camere}</span>
          <span className="ml-auto" style={{ color: 'var(--color-stone)' }}>{r.orario}</span>
          <span style={{ color: 'var(--color-stone)' }}>{r.navetta}</span>
        </div>
      ))}
    </div>
  )
}
