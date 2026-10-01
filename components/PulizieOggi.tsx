'use client'
// «Pulizie di oggi» in Home (Ania, 07/09/2026; veste «Maison» del
// 28/09/2026): «Pulizie di oggi · N da fare · in ordine di arrivo», poi per
// ogni camera il nome in Cormorant con «· N ospiti»; per la fine soggiorno e
// il cambio camera «Prossimo arrivo» con nome, giorno e orario (l'orario solo
// se c'è); per il cambio biancheria «Cambio biancheria» con «Nome, Nª notte ·
// resta fino al …» e nessun prossimo arrivo; la descrizione in grigio, il
// ritardo in mattone, il timer compatto e i comandi rapidi. In fondo il timer
// dell'area comune e il link ai tempi fuori dalle camere.
// Dal 28/09/2026 anche la pulizia con l'arrivo lo stesso giorno è una voce
// da fare come le altre (non più segnata in automatico).
import Link from 'next/link'
import SalvataggiPulizie from './SalvataggiPulizie'
import ControlliPulizia from './ControlliPulizia'
import TimerPulizia from './TimerPulizia'
import { type StatoNumeriOggi } from '@/lib/numeriOggiDati'
import { testoRitardo, ETICHETTA_PROSSIMO_ARRIVO, ETICHETTA_CAMBIO_BIANCHERIA } from '@/lib/pulizieOggi'
import { chiaveTimerFuori } from '@/lib/tempoPulizie'

export const TITOLO_PULIZIE_OGGI = 'Pulizie di oggi'
// Dal 01/10/2026 (Ania) il timer della Home è la voce «Corridoio e angolo
// caffè» degli spazi comuni: area_comune non si propone più per i tempi nuovi.
export const RIGA_AREA_COMUNE = 'Corridoio e angolo caffè'
export const LINK_TEMPI_FUORI = 'Tempi fuori dalle camere ↗'

export default function PulizieOggi({ dati }: { dati: StatoNumeriOggi }) {
  // La Home contiene solo il lavoro aperto; conferme e recuperi restano nel registro.
  // Conservare il recupero dei salvataggi incerti anche quando la lista è vuota.
  const voci = dati.stato === 'pronto' ? dati.pulizieOggi.filter(v => v.stato === 'da_fare') : []
  if (dati.stato !== 'pronto' || voci.length === 0) return <SalvataggiPulizie />
  const { oggi } = dati
  const camere = new Map(dati.pulizieOggi.map(v => [v.daSegnare?.booking_id ?? v.decisione?.booking_id ?? '', v.camera]))
  const nomeCamera = (id: string) => camere.get(id) ?? null
  return <section id="pulizie-oggi" className="mz-sec scroll-mt-4" data-pulizie-oggi>
    <SalvataggiPulizie />
    <p className="mz-eyebrow">{TITOLO_PULIZIE_OGGI} <small>· {voci.length} da fare · in ordine di arrivo</small></p>
    {voci.map(v => <div key={v.chiave} data-stato={v.stato} data-camera={v.camera} className="mz-pul">
      <div className="id">
        <span className="nm">{v.camera}</span>
        {v.persone && <span className="os">· {v.persone} {v.persone === 1 ? 'ospite' : 'ospiti'}</span>}
        {v.ritardo > 0 && <span className="rit" data-ritardo>{testoRitardo(v.ritardo)}</span>}
      </div>
      {v.tipo === 'soggiorno'
        ? v.biancheria && <p className="pr" data-biancheria><small>{ETICHETTA_CAMBIO_BIANCHERIA}</small>{v.biancheria}</p>
        : v.prossimo && <p className="pr" data-prossimo-arrivo><small>{ETICHETTA_PROSSIMO_ARRIVO}</small>{v.prossimo}</p>}
      {v.tipo !== 'soggiorno' && <p className="de">{v.descrizione ?? v.riga}</p>}
      <ControlliPulizia home
        camera={v.camera} oggi={oggi} ultimaId={v.ultimaId ?? null} persone={v.persone} partenza={v.partenza}
        pulizia={v.decisione ?? { ...v.daSegnare!, stato: 'fatta' }} />
    </div>)}
    <div className="mz-fuori">
      <TimerPulizia compatto etichetta={RIGA_AREA_COMUNE} chiave={chiaveTimerFuori(oggi, 'corridoio')} nome={RIGA_AREA_COMUNE} onMinuti={() => {}} nomeCamera={nomeCamera} />
      <Link href="/pulizie#fuori-camera" className="mz-lnk q">{LINK_TEMPI_FUORI}</Link>
    </div>
  </section>
}
