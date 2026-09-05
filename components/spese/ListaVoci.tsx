'use client'
import { useState } from 'react'
import type { Voce, Subcat } from '@/lib/spese/types'
import { GROUP_COLORS, FALLBACK_COLOR, eur, eur2, strip, corto } from '@/lib/spese/costanti'
import { monthLabel } from '@/lib/spese/periodo'

// Lista di voci (usata da tessere, racconto, calendario).
// Le voci con lo stesso nome vengono SOMMATE (tutti i "kiwi" del mese in
// una riga: ×7 e totale); in testa la divisione per negozio; se ci sono
// sottocategorie diverse, sezioni con totalino.
// (Estratta da SpeseTracker.tsx in Fase 1: stesse classi, testi e logica.)
export default function ListaVoci({ voci, max, subcats, onOpenReceipt }: {
  voci: Voce[]; max?: number; subcats: Subcat[]; onOpenReceipt: (receiptId: string) => void
}) {
  // q = pezzi/confezioni comprati (somma delle qty), righe = da quanti
  // acquisti viene la somma: la data si mostra solo se l'acquisto è uno.
  type Agg = { n: string; tot: number; q: number; righe: number; stores: string[]; sott: string; last: string; rids: string[] }
  // Pastiglie-filtro (scelto da Ania il 16/08/2026): tocchi una persona o un
  // negozio e la lista mostra solo quello; ritocchi e torna tutto. Le due
  // scelte si combinano (es. Matteo + Coin). Niente bordi neri: la pastiglia
  // attiva resta piena con ombra leggera, le altre si attenuano.
  const [gSel, setGSel] = useState('')
  const [sSel, setSSel] = useState('')
  // Totali delle pastiglie: incrociati con l'altro filtro (es. con Coin
  // attivo, "Matteo" mostra quanto ha speso Matteo da Coin), ma la
  // pastiglia resta visibile anche a €0 così si può sempre cambiare scelta.
  const perStore: Record<string, number> = {}
  const perGruppo: Record<string, number> = {}
  voci.forEach(v => {
    const s = corto(v.store)
    if (s) perStore[s] = (perStore[s] || 0) + ((!gSel || v.g === gSel) ? v.a : 0)
    if (v.g && v.g !== '—') perGruppo[v.g] = (perGruppo[v.g] || 0) + ((!sSel || corto(v.store) === sSel) ? v.a : 0)
  })
  const negozi = Object.entries(perStore).sort((a, b) => b[1] - a[1])
  const persone = Object.entries(perGruppo).sort((a, b) => b[1] - a[1])
  const vociVis = voci.filter(v => (!gSel || v.g === gSel) && (!sSel || corto(v.store) === sSel))
  const m: Record<string, Agg> = {}
  vociVis.forEach(v => {
    const k = (v.sott || '') + '|' + strip(v.n)
    const e = m[k] || (m[k] = { n: v.n, tot: 0, q: 0, righe: 0, stores: [], sott: v.sott || '', last: v.d, rids: [] })
    e.tot += v.a; e.q += v.q; e.righe++; if (v.d > e.last) e.last = v.d
    const s = corto(v.store); if (s && !e.stores.includes(s)) e.stores.push(s)
    if (v.rid && !e.rids.includes(v.rid)) e.rids.push(v.rid)
  })
  const righe = Object.values(m).sort((a, b) => b.tot - a.tot).slice(0, max || 999)
  const sotts = Array.from(new Set(righe.map(r => r.sott)))
  // Ordine fisso delle sezioni: il campo `sort` di family_subcategories
  // (es. Abbigliamento: Vestiti, Scarpe, Intimo, Accessori); "Altro" in fondo.
  const sortDi = (s: string) => {
    if (!s) return 9e9 // "Altro" sempre in fondo
    const sc = subcats.filter(x => x.name === s)
    return sc.length ? Math.min(...sc.map(x => x.sort)) : 8e9
  }
  // Le sezioni si mostrano appena c'è ALMENO una sottocategoria vera,
  // anche unica (es. luglio tutto "Pranzo"); lista piatta solo se
  // nessuna voce ha la sottocategoria.
  const mostraSezioni = sotts.some(s => s)
  const sezioni = mostraSezioni
    ? sotts.map(s => ({ s, list: righe.filter(r => r.sott === s) }))
        .sort((a, b) => sortDi(a.s) - sortDi(b.s))
    : [{ s: '', list: righe }]
  return (
    <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm mb-3">
      {persone.length > 1 && (
        <div className="flex gap-1.5 flex-wrap pb-2 mb-1">
          {persone.map(([g, tot]) => {
            const on = gSel === g
            return (
              <button key={g} onClick={() => setGSel(on ? '' : g)}
                className={`text-xs px-2 py-1 rounded-full text-white transition ${on ? 'shadow-md' : gSel ? 'opacity-40' : ''}`}
                style={{ background: GROUP_COLORS[g] || FALLBACK_COLOR }}>
                {on && '✓ '}{g} <b>{eur(tot)}</b>
              </button>
            )
          })}
        </div>
      )}
      {negozi.length > 1 && (
        <div className="flex gap-1.5 flex-wrap pb-2 mb-1 border-b border-[#F1EEE6]">
          {negozi.map(([s, tot]) => {
            const on = sSel === s
            return (
              <button key={s} onClick={() => setSSel(on ? '' : s)}
                className={`text-xs bg-sand text-[#7A5C1E] px-2 py-1 rounded-full transition ${on ? 'shadow-md' : sSel ? 'opacity-40' : ''}`}>
                {on && '✓ '}{s} <b>{eur(tot)}</b>
              </button>
            )
          })}
        </div>
      )}
      {sezioni.map(({ s, list }) => (
        <div key={s || '·'}>
          {mostraSezioni && (
            <p className="flex justify-between text-[11px] uppercase tracking-wide text-brass pt-2">
              <span>{s || 'Altro'}</span>
              <span>{eur2(list.reduce((x, r) => x + r.tot, 0))}</span>
            </p>
          )}
          {list.map(r => (
            <div key={(r.sott || '') + r.n} className="flex items-start justify-between gap-2 py-2 border-b border-[#F1EEE6] last:border-b-0 text-sm">
              <span className="flex-1 min-w-0">{r.n}{r.q > 1 && <span className="text-xs text-gray-400"> ×{r.q}</span>}
                <br /><span className="text-xs text-gray-400">
                  {[r.stores.slice(0, 2).join(', ') + (r.stores.length > 2 ? ` +${r.stores.length - 2}` : ''),
                    r.righe === 1 ? `${r.last.slice(-2)} ${monthLabel(r.last.slice(0, 7)).slice(0, 3)}` : ''].filter(Boolean).join(' · ')}
                </span>
                {r.rids.length > 0 && (
                  <span className="ml-1 whitespace-nowrap">
                    {r.rids.slice(0, 5).map(id => (
                      <button key={id} onClick={() => onOpenReceipt(id)} title="Apri lo scontrino"
                        className="text-[13px] px-0.5 align-middle">🧾</button>
                    ))}
                    {r.rids.length > 5 && <span className="text-xs text-gray-400">+{r.rids.length - 5}</span>}
                  </span>
                )}
              </span>
              <span className="font-bold text-[#8C3B2E] shrink-0">{eur2(r.tot)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
