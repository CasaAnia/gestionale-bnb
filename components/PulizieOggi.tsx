'use client'
import Link from 'next/link'
import SalvataggiPulizie from './SalvataggiPulizie'
import ControlliPulizia from './ControlliPulizia'
import { type StatoNumeriOggi } from '@/lib/numeriOggiDati'
import { testoRitardo } from '@/lib/pulizieOggi'

export const TITOLO_PULIZIE_OGGI = 'Pulizie di oggi'
export default function PulizieOggi({ dati }: { dati: StatoNumeriOggi }) {
  // La Home contiene solo il lavoro aperto; conferme e recuperi restano nel registro.
  // Conservare il recupero dei salvataggi incerti anche quando la lista è vuota.
  const voci = dati.stato === 'pronto' ? dati.pulizieOggi.filter(v => v.stato === 'da_fare') : []
  if (dati.stato !== 'pronto' || voci.length === 0) return <SalvataggiPulizie />
  const { oggi } = dati
  return <section id="pulizie-oggi" className="mb-6 scroll-mt-20" data-pulizie-oggi>
    <SalvataggiPulizie /><h2 className="home-sezione"><span>{TITOLO_PULIZIE_OGGI}</span><small>{voci.length} da fare</small></h2>
    {voci.map(v => <div key={v.chiave} data-stato={v.stato} data-camera={v.camera} className="home-pulizia">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="home-nome">{v.camera}</p>
        {v.persone && <span className="home-camera">· {v.persone} {v.persone === 1 ? 'ospite' : 'ospiti'}</span>}

      </div>
      {v.prossimo && <div className="home-prossimo"><p className="home-secondario">Prossimo arrivo</p><p className="home-info">{v.prossimo}</p></div>}
      <p className="home-secondario home-partenza">{v.descrizione ?? v.riga}</p>
      {v.ritardo > 0 && <p className="home-ritardo" data-ritardo>{testoRitardo(v.ritardo)}</p>}
      <ControlliPulizia home
        camera={v.camera} oggi={oggi} ultimaId={v.ultimaId ?? null} persone={v.persone} partenza={v.partenza}
        pulizia={v.decisione ?? { ...v.daSegnare!, stato: 'fatta' }} />
    </div>)}
    <p className="home-fuori">Area comune, corridoio e biancheria: <Link href="/pulizie#fuori-camera">Tempi fuori dalle camere ↗</Link></p>
  </section>
}
