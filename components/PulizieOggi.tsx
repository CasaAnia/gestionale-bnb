'use client'
import SalvataggiPulizie from './SalvataggiPulizie'
import ControlliPulizia from './ControlliPulizia'
import { type StatoNumeriOggi } from '@/lib/numeriOggiDati'
import { riassuntoPulizieOggi, testoRitardo } from '@/lib/pulizieOggi'

export const TITOLO_PULIZIE_OGGI = 'Pulizie di oggi'
export default function PulizieOggi({ dati }: { dati: StatoNumeriOggi }) {
  // La Home contiene solo il lavoro aperto; conferme e recuperi restano nel registro.
  // Conservare il recupero dei salvataggi incerti anche quando la lista è vuota.
  const voci = dati.stato === 'pronto' ? dati.pulizieOggi.filter(v => v.stato === 'da_fare') : []
  if (dati.stato !== 'pronto' || voci.length === 0) return <SalvataggiPulizie />
  const { oggi } = dati
  return <section id="pulizie-oggi" className="mb-6 scroll-mt-20" data-pulizie-oggi>
    <SalvataggiPulizie /><p className="ed-sezione mb-1">{TITOLO_PULIZIE_OGGI} <small>{riassuntoPulizieOggi(voci)}</small></p>
    {voci.map(v => <div key={v.chiave} data-stato={v.stato} data-camera={v.camera} className="py-3 border-t border-card-border">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="font-serif text-xl text-green-dark">{v.camera}</p>
        {v.persone && <span className="text-xs text-stone">{v.persone} {v.persone === 1 ? 'ospite' : 'ospiti'}</span>}
        {v.ritardo > 0 && <span className="text-xs text-brass" data-ritardo>{testoRitardo(v.ritardo)}</span>}
      </div>
      <p className="text-[12.5px] text-stone mt-1">{v.riga}</p>
      <ControlliPulizia home
        camera={v.camera} oggi={oggi} ultimaId={v.ultimaId ?? null} persone={v.persone} partenza={v.partenza}
        pulizia={v.decisione ?? { ...v.daSegnare!, stato: 'fatta' }} />
    </div>)}
  </section>
}
