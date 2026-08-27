'use client'
import type { Fx, Group, Budget, Subcat, Voce, Dettaglio } from '@/lib/spese/types'
import { ACCENT, eur, eur2, icona } from '@/lib/spese/costanti'
import { monthLabel } from '@/lib/spese/periodo'
import type { tessereCategorie, contoCaffe } from '@/lib/spese/voci'
import ListaVoci from './ListaVoci'
import BudgetCard from './BudgetCard'
import SpeseFisseCard from './SpeseFisseCard'
import UltimeSpese from './UltimeSpese'

// Scheda 🏠 Home: speso del periodo con ritmo/previsione e linea del mese,
// conto del caffè, tessere-categoria, dettaglio, budget, spese fisse e
// ultime spese. (Estratta da SpeseTracker.tsx in Fase 1: identica.)
export default function HomeTab({
  speseMese, vociMese, totMese, periodLabel, isMese, isCurrentMonth,
  mediaGiorno, previsione, sparkline, daysInMonth, month,
  caffeMese, tessere, dettaglio, apriDettaglio, chiudiDettaglio,
  budgetsOk, budgetRows, catNames, showBudgetForm, setShowBudgetForm,
  budgetForm, setBudgetForm, onSaveBudget, onEditBudget,
  fisse, fisseTot, showAll, setShowAll,
  groups, subcats, groupName, catName, colorOf, onOpenReceipt, onDelete,
}: {
  speseMese: Fx[]
  vociMese: Voce[]
  totMese: number
  periodLabel: string
  isMese: boolean
  isCurrentMonth: boolean
  mediaGiorno: number
  previsione: number
  sparkline: string
  daysInMonth: number
  month: string
  caffeMese: ReturnType<typeof contoCaffe>
  tessere: ReturnType<typeof tessereCategorie>
  dettaglio: Dettaglio
  apriDettaglio: (titolo: string, voci: Voce[]) => void
  chiudiDettaglio: () => void
  budgetsOk: boolean
  budgetRows: { b: Budget; spent: number }[]
  catNames: string[]
  showBudgetForm: boolean
  setShowBudgetForm: (v: boolean) => void
  budgetForm: { category_name: string; amount: string }
  setBudgetForm: (v: { category_name: string; amount: string }) => void
  onSaveBudget: () => void
  onEditBudget: (b: Budget) => void
  fisse: { name: string; tot: number; day: number; paid: boolean }[]
  fisseTot: number
  showAll: boolean
  setShowAll: (v: boolean) => void
  groups: Group[]
  subcats: Subcat[]
  groupName: (id: string | null) => string
  catName: (id: string | null | undefined) => string
  colorOf: (id: string | null) => string
  onOpenReceipt: (receiptId: string) => void
  onDelete: (id: string) => void
}) {
  if (speseMese.length === 0) return (
    <div className="text-center py-10 text-gray-400">Nessuna spesa in questo periodo</div>
  )
  return (
    <>
      {/* Speso del periodo + ritmo + linea (ritmo e linea solo per mese) */}
      <div className="bg-white rounded-xl p-4 border border-card-border mb-3 text-center">
        <p className="text-xs text-gray-400">Speso {periodLabel}</p>
        <p className="font-serif text-4xl text-[#8C3B2E]">{eur(totMese)}</p>
        {isMese && isCurrentMonth && (
          <p className="text-xs text-gray-400 mt-0.5">
            {eur(mediaGiorno)} al giorno · di questo passo ~ <b className="text-[#8C3B2E]">{eur(previsione)}</b> a fine mese
          </p>
        )}
        {isMese && (
          <>
            <svg viewBox="0 0 340 56" className="w-full h-[48px] mt-2">
              <path d={sparkline} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" />
            </svg>
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>1</span><span className="capitalize">{monthLabel(month)}</span><span>{daysInMonth}</span>
            </div>
          </>
        )}
      </div>

      {/* IL CONTO DEL CAFFÈ */}
      {caffeMese.tot > 0 && (
        <button onClick={() => apriDettaglio(`☕ I caffè di ${monthLabel(month)} · ${eur2(caffeMese.tot)}`, caffeMese.voci)}
          className="w-full bg-sand rounded-xl px-4 py-3 border border-card-border mb-3 text-left transition active:scale-[0.99]">
          <p className="text-sm text-green-dark">
            ☕ <b>{caffeMese.nC} caffè{caffeMese.nK > 0 ? ` e ${caffeMese.nK} cappuccini` : ''}</b> fuori casa questo mese
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            Ti sono costati <b className="text-[#8C3B2E]">{eur2(caffeMese.tot)}</b>{caffeMese.pasti > 0 ? ` (di cui ${eur2(caffeMese.pasti)} a pranzo/cena)` : ''} · tocca per l&apos;elenco
          </p>
        </button>
      )}

      {/* Tessere categoria */}
      <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Le tue voci · tocca per il dettaglio</p>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {tessere.map(t => (
          <button key={t.cat}
            onClick={() => apriDettaglio(`${icona(t.cat)} ${t.cat} · ${eur(t.tot)}`, vociMese.filter(v => v.cat === t.cat))}
            className="bg-white rounded-xl p-3 border border-card-border text-left transition active:scale-[0.98]">
            <p className="text-xl">{icona(t.cat)}</p>
            <p className="text-xs text-green-dark mt-0.5">{t.cat}</p>
            <p className="font-serif text-lg text-[#8C3B2E]">
              {eur(t.tot)}{' '}
              <span className="text-xs">
                {t.prev > 0 && (t.tot > t.prev * 1.1 ? <span className="text-[#8C3B2E]">▲</span>
                  : t.tot < t.prev * 0.9 ? <span className="text-green-mid">▼</span> : <span className="text-gray-400">≈</span>)}
              </span>
            </p>
            <p className="text-[11px] text-gray-400">{t.n} {t.n === 1 ? 'voce' : 'voci'}</p>
          </button>
        ))}
      </div>

      {/* Dettaglio tessera aperta */}
      {dettaglio && (
        <>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass">{dettaglio.titolo}</p>
            <button onClick={chiudiDettaglio} className="text-xs text-[#8C3B2E] font-semibold">✕ chiudi</button>
          </div>
          <ListaVoci voci={dettaglio.voci} subcats={subcats} onOpenReceipt={onOpenReceipt} />
        </>
      )}

      {/* BUDGET MENSILI PER CATEGORIA (solo vista Mese) */}
      {isMese && budgetsOk && (
        <BudgetCard month={month} budgetRows={budgetRows} catNames={catNames}
          showBudgetForm={showBudgetForm} setShowBudgetForm={setShowBudgetForm}
          budgetForm={budgetForm} setBudgetForm={setBudgetForm}
          onSaveBudget={onSaveBudget} onEditBudget={onEditBudget} />
      )}

      {/* SPESE FISSE DEL MESE (solo vista Mese) */}
      {isMese && fisse.length > 0 && (
        <SpeseFisseCard month={month} fisse={fisse} fisseTot={fisseTot} />
      )}

      {/* ULTIME SPESE + elenco completo */}
      <UltimeSpese speseMese={speseMese} showAll={showAll} setShowAll={setShowAll}
        isMese={isMese} month={month} periodLabel={periodLabel}
        groups={groups} groupName={groupName} catName={catName} colorOf={colorOf}
        onOpenReceipt={onOpenReceipt} onDelete={onDelete} />
    </>
  )
}
