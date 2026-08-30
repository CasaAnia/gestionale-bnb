'use client'
// Analisi del nuovo guscio (3.1, resa CONTESTUALE in 3.1.1):
//  · Casa Mia   → abitudini e piccole spese, Teo e anno scolastico,
//                 più la casa futura di Calendario/Racconto/Domanda (fase 6);
//  · Casa Ania  → metodi di pagamento, fatture, costi per camera e
//                 andamento aziendale. Mai dati personali qui.
import { CalendarDays, BookOpenText, MessageCircleQuestion, GraduationCap, Landmark } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Etichetta, Barra } from './mattoni'
import {
  eurVista as eur, nelMese,
  type Contesto, type PanoramicaMiaVista, type PanoramicaAniaVista,
} from '@/lib/spese/vista'

function Grafico({ valori, evidenzia }: { valori: number[]; evidenzia?: number }) {
  const massimo = Math.max(...valori, 1)
  return (
    <div className="flex items-end gap-1 h-12 mt-2" aria-hidden>
      {valori.map((v, i) => (
        <div key={i} className="flex-1"
          style={{ height: `${v / massimo * 100}%`, background: i === evidenzia ? t.terracotta : t.salvia, borderRadius: 3 }} />
      ))}
    </div>
  )
}

function AnalisiMia({ mia, inArrivo }: { mia: PanoramicaMiaVista; inArrivo?: boolean }) {
  return (
    <>
      {inArrivo && <Card className="px-4 py-4">
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
      </Card>}

      {mia.ripetute && (
        <Card className="px-4 py-4">
          <Etichetta>Righe sotto i 5 €</Etichetta>
          <p className="text-[13.5px]" style={{ color: t.inchiostro }}>
            <b>{mia.ripetute.frase}</b> — {eur(mia.ripetute.tot)} complessivi
          </p>
          <p className="text-[11.5px] mt-1.5" style={{ color: t.sub }}>
            per esempio: {mia.ripetute.esempio} · abitudini e ripetizioni arrivano con la fase 6
          </p>
        </Card>
      )}

      {mia.teo && (
        <Card className="px-4 py-4">
          <div className="flex items-center gap-2.5 mb-2">
            <span className="grid place-items-center w-9 h-9 shrink-0"
              style={{ background: t.velo, color: t.verde, borderRadius: t.rIcona }}>
              <GraduationCap size={17} />
            </span>
            <p className="text-[14px] font-semibold" style={{ color: t.inchiostro }}>
              Teo e l&apos;anno scolastico
              <span className="block text-[12px] font-normal" style={{ color: t.sub }}>
                {eur(mia.teo.tot)} {nelMese(mia.mese)} · il conto per anno scolastico arriva con la fase 6
              </span>
            </p>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {mia.teo.voci.map(([n, v]) => (
              <span key={n} className="text-[12px] px-2.5 py-1 font-medium"
                style={{ background: t.velo, color: t.inchiostro, borderRadius: t.rPill }}>{n} · {eur(v)}</span>
            ))}
          </div>
        </Card>
      )}

      <Card className="px-4 py-3.5">
        <div className="flex items-baseline justify-between">
          <Etichetta extra="mb-0">Totale {nelMese(mia.mese)}</Etichetta>
          <span className={`${DISPLAY} text-[17px]`} style={{ color: t.inchiostro }}>{eur(mia.speso)}</span>
        </div>
      </Card>
    </>
  )
}

function AnalisiAnia({ ania }: { ania: PanoramicaAniaVista }) {
  const totCamere = ania.costiCamere.reduce((s, c) => s + c.tot, 0)
  return (
    <>
      <Card className="px-4 py-4">
        <Etichetta>Andamento della spesa</Etichetta>
        <p className="text-[13.5px]" style={{ color: t.inchiostro }}>
          <b>{eur(ania.speso)}</b> {nelMese(ania.mese)} · denaro uscito davvero
        </p>
        <Grafico valori={ania.andamento} evidenzia={ania.andamento.length - 1} />
        <p className="text-[11.5px] mt-1.5" style={{ color: t.sub }}>gli ultimi {ania.andamento.length} mesi, {nelMese(ania.mese)} in terracotta</p>
      </Card>

      <Card className="px-4 py-4">
        <Etichetta>Costi per camera</Etichetta>
        {ania.costiCamere.length === 0 ? (
          <p className="text-[13px] min-h-8 flex items-center" style={{ color: t.sub }}>Nessun costo attribuito alle camere {nelMese(ania.mese)}.</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {ania.costiCamere.map(c => (
              <div key={c.nome} className="flex items-center gap-3 min-h-9">
                <span className="w-24 text-[13.5px] font-medium shrink-0" style={{ color: t.inchiostro }}>{c.nome}</span>
                <span className="flex-1"><Barra quota={totCamere ? c.tot / totCamere * 100 : 0} colore={t.terracotta} /></span>
                <span className={`${DISPLAY} text-[14px]`} style={{ color: t.inchiostro }}>{eur(c.tot)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="px-4 py-4">
        <Etichetta>Come stai pagando</Etichetta>
        <div className="flex h-2 overflow-hidden mb-2" style={{ borderRadius: 99 }}>
          {ania.metodi.map((m, i) => (
            <div key={m.nome} style={{ width: `${m.quota}%`, background: [t.verde, t.salvia, t.oro][i % 3] }} />
          ))}
        </div>
        <div className="flex gap-3 flex-wrap">
          {ania.metodi.map((m, i) => (
            <span key={m.nome} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: t.sub }}>
              <span className="w-2 h-2 rounded-full" style={{ background: [t.verde, t.salvia, t.oro][i % 3] }} />
              {m.nome} <b style={{ color: t.inchiostro }}>{m.quota}%</b>
            </span>
          ))}
        </div>
      </Card>

      <Card className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 shrink-0"
            style={{ background: t.terraTenue, color: t.terracotta, borderRadius: t.rIcona }}>
            <Landmark size={17} />
          </span>
          <p className="text-[13.5px] leading-snug" style={{ color: t.inchiostro }}>
            <b>{eur(ania.impegnato.tot)} impegnati</b> in {ania.impegnato.n} {ania.impegnato.n === 1 ? 'fattura approvata' : 'fatture approvate'}
            <span className="block text-[12px]" style={{ color: t.sub }}>
              entreranno nello speso alla data del pagamento
            </span>
          </p>
        </div>
      </Card>
    </>
  )
}

export function AnalisiTab({ contesto, mia, ania, operativa }: {
  contesto: Contesto
  mia: PanoramicaMiaVista
  ania: PanoramicaAniaVista
  // 3.2B: Calendario/Racconto/Domanda VERI (pagine ufficiali). Quando c'è,
  // sostituisce la card "In arrivo qui" della preview.
  operativa?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-3">
      {operativa}
      {contesto === 'mia' ? <AnalisiMia mia={mia} inArrivo={!operativa} /> : <AnalisiAnia ania={ania} />}
    </div>
  )
}
