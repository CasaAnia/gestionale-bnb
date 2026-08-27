'use client'
import type { Voce, Group, Subcat, Dettaglio } from '@/lib/spese/types'
import { GROUP_COLORS, FALLBACK_COLOR, eur, eur2, corto, icona } from '@/lib/spese/costanti'
import { monthLabel } from '@/lib/spese/periodo'
import type { costruisciRacconto } from '@/lib/spese/voci'
import ListaVoci from './ListaVoci'

// Scheda 📖 Racconto: il riassunto del mese scritto, coi numeri toccabili
// e le barre "Chi ha speso cosa". (Estratta da SpeseTracker.tsx in Fase 1:
// identica.)
export default function RaccontoTab({
  racconto, vociMese, totMese, isMese, month, mesePrecedente, periodLabel,
  groups, dettaglio, apriDettaglio, chiudiDettaglio, subcats, onOpenReceipt,
}: {
  racconto: NonNullable<ReturnType<typeof costruisciRacconto>>
  vociMese: Voce[]
  totMese: number
  isMese: boolean
  month: string
  mesePrecedente: string
  periodLabel: string
  groups: Group[]
  dettaglio: Dettaglio
  apriDettaglio: (titolo: string, voci: Voce[]) => void
  chiudiDettaglio: () => void
  subcats: Subcat[]
  onOpenReceipt: (receiptId: string) => void
}) {
  return (
    <>
      <div className="bg-white rounded-xl p-4 border border-card-border mb-3 text-[15px] leading-relaxed text-green-dark">
        <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-2">
          {isMese ? `Il racconto di ${monthLabel(month)}` : `Il racconto · ${periodLabel}`}
        </p>
        <p>
          {isMese ? 'Questo mese' : 'In questo periodo'} avete speso{' '}
          <button onClick={() => apriDettaglio(`Tutte le voci · ${eur(totMese)}`, vociMese)}
            className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">{eur(totMese)}</button>
          {racconto.diff !== null && (racconto.diff <= 0
            ? <>, il <span className="text-green-mid font-semibold">{Math.abs(racconto.diff)}% in meno</span> di {monthLabel(mesePrecedente)} 👏</>
            : <>, il <span className="text-[#8C3B2E] font-semibold">{racconto.diff}% in più</span> di {monthLabel(mesePrecedente)}</>)}.{' '}
          La voce più pesante è stata{' '}
          <button onClick={() => apriDettaglio(`${icona(racconto.topCat[0])} ${racconto.topCat[0]} · ${eur(racconto.topCat[1])}`, vociMese.filter(v => v.cat === racconto.topCat[0]))}
            className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">{racconto.topCat[0].toLowerCase()} ({eur(racconto.topCat[1])})</button>
          {racconto.topS && <>, e il negozio dove avete lasciato di più è{' '}
            <button onClick={() => apriDettaglio(`🏪 ${racconto.topS[0]} · ${eur(racconto.topS[1])}`, vociMese.filter(v => corto(v.store) === racconto.topS[0]))}
              className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">{racconto.topS[0]} ({eur(racconto.topS[1])})</button></>}.
        </p>
        <p className="mt-2">
          L&apos;acquisto singolo più caro: <b className="text-[#8C3B2E]">{racconto.topVoce.n} ({eur2(racconto.topVoce.a)})</b>.
          {racconto.caffe.length > 0 && <>{' '}E il rito del bar?{' '}
            <button onClick={() => apriDettaglio(`☕ Caffè e cappuccini · ${eur2(racconto.caffe.reduce((s, v) => s + v.a, 0))}`, racconto.caffe)}
              className="inline font-bold text-[#8C3B2E] border-b-2 border-dotted border-[#D2A98C]">
              {racconto.caffe.length} caffè e cappuccini, {eur2(racconto.caffe.reduce((s, v) => s + v.a, 0))}</button> ☕</>}
        </p>
      </div>

      {groups.length > 1 && (
        <div className="bg-white rounded-xl p-4 border border-card-border mb-3">
          <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-3">Chi ha speso cosa</p>
          <div className="flex flex-col gap-2.5">
            {racconto.gruppi.map(([g, tot]) => (
              <button key={g} onClick={() => apriDettaglio(`${g} · ${eur(tot)}`, vociMese.filter(v => v.g === g))} className="text-left">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-green-dark">{g}</span>
                  <span className="font-semibold" style={{ color: GROUP_COLORS[g] || FALLBACK_COLOR }}>{eur(tot)}</span>
                </div>
                <div className="h-2 rounded-full bg-[#F1EEE6] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${(tot / Math.max(1, racconto.gruppi[0][1])) * 100}%`, background: GROUP_COLORS[g] || FALLBACK_COLOR }} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {dettaglio ? (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass">{dettaglio.titolo}</p>
            <button onClick={chiudiDettaglio} className="text-xs text-[#8C3B2E] font-semibold">✕ chiudi</button>
          </div>
          <ListaVoci voci={dettaglio.voci} max={15} subcats={subcats} onOpenReceipt={onOpenReceipt} />
        </>
      ) : (
        <p className="text-xs text-gray-400 text-center">Tocca i numeri sottolineati per vedere il dettaglio.</p>
      )}
    </>
  )
}
