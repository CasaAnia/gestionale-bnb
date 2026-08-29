'use client'
// Analisi del nuovo guscio (Fase 3.1): la casa futura di Calendario, Racconto
// e Domanda (trasloco in fase 6) più le analisi nuove. Per ora spiega cosa
// arriverà e mostra un assaggio con dati veri di vista.
import { CalendarDays, BookOpenText, MessageCircleQuestion } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Etichetta } from './mattoni'
import { eurVista as eur, type PanoramicaMiaVista } from '@/lib/spese/vista'

export function AnalisiTab({ mia }: { mia: PanoramicaMiaVista }) {
  return (
    <div className="flex flex-col gap-3">
      <Card className="px-4 py-4">
        <Etichetta>In arrivo qui</Etichetta>
        <div className="flex flex-col gap-2.5">
          {[
            [CalendarDays, 'Calendario', 'le spese giorno per giorno, come ora'],
            [BookOpenText, 'Racconto', 'il mese spiegato a parole semplici'],
            [MessageCircleQuestion, 'Domanda', 'chiedi qualsiasi cosa sulle tue spese'],
          ].map(([I, nome, sotto]) => {
            const Icona = I as typeof CalendarDays
            return (
              <div key={nome as string} className="flex items-center gap-3 min-h-10">
                <span className="grid place-items-center w-9 h-9 shrink-0"
                  style={{ background: t.velo, color: t.verde, borderRadius: t.rIcona }}>
                  <Icona size={17} />
                </span>
                <span className="text-[14px] font-semibold" style={{ color: t.inchiostro }}>{nome as string}
                  <span className="block text-[12px] font-normal" style={{ color: t.sub }}>{sotto as string}</span>
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-[12px] mt-3 pt-3" style={{ color: t.sub, borderTop: `1px solid ${t.bordo}` }}>
          Le sezioni di oggi non spariscono: traslocano qui, insieme alle analisi
          nuove (abitudini, l&apos;anno scolastico di Teo, i costi per camera).
        </p>
      </Card>

      {mia.ripetute && (
        <Card className="px-4 py-4">
          <Etichetta>Assaggio · piccole spese ripetute</Etichetta>
          <p className="text-[13.5px]" style={{ color: t.inchiostro }}>
            <b>{mia.ripetute.frase}</b> — {eur(mia.ripetute.tot)} in un mese
          </p>
          <div className="flex items-end gap-1 h-12 mt-2" aria-hidden>
            {[3, 5, 2, 6, 4, 7, 3, 5, 6, 4, 2, 5].map((v, i) => (
              <div key={i} className="flex-1" style={{ height: `${v * 12}%`, background: i === 5 ? t.terracotta : t.salvia, borderRadius: 3 }} />
            ))}
          </div>
          <p className="text-[11.5px] mt-1.5" style={{ color: t.sub }}>{mia.ripetute.esempio}</p>
        </Card>
      )}

      <Card className="px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <Etichetta extra="mb-0">Totale {mia.mese.toLowerCase()}</Etichetta>
          <span className={`${DISPLAY} text-[17px]`} style={{ color: t.inchiostro }}>{eur(mia.speso)}</span>
        </div>
      </Card>
    </div>
  )
}
