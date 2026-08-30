'use client'
// ============================================================================
// ANALISI OPERATIVE (3.2B → 3.2B.1) — Calendario, Racconto e Domanda vivi
// dentro il nuovo guscio. Dalla 3.2B.1:
//  · proiezione PER RIGA coerente con l'adattatore (item.group_id vince
//    sulla madre; categorie canoniche con ripiego storico): il filtro
//    "Di chi" agisce sulle RIGHE, così la riga di Teo dentro una spesa di
//    Casa non si perde;
//  · totali e calendario derivati dalle stesse voci (viste equivalenti,
//    stessi numeri);
//  · la Domanda rispetta periodo e persona selezionati (i periodi o le
//    persone nominati NELLA domanda vincono e vengono indicati);
//  · date nel fuso italiano (oggiARoma).
// ============================================================================
import { useMemo, useState } from 'react'
import { TEMA as t } from './tema'
import { Card, Chip, Etichetta } from './mattoni'
import type { Ambito, Category, Dettaglio, Fx, Group, Msg, Subcat, Voce } from '@/lib/spese/types'
import { monthKey, periodoRange, periodoLabel as periodoLabelDi, ritmoEPrevisione } from '@/lib/spese/periodo'
import { eur2 } from '@/lib/spese/costanti'
import { itemsPerSpesa, costruisciRacconto, fisseMese, vociEstese, type ItemEsteso, type RisolutoriVoce } from '@/lib/spese/voci'
import { rispondiNelContesto } from '@/lib/spese/domandaContesto'
import { oggiARoma } from '@/lib/spese/adattatore'
import CalendarioTab from './CalendarioTab'
import RaccontoTab from './RaccontoTab'
import DomandaTab from './DomandaTab'

type Sotto = 'calendario' | 'racconto' | 'domanda'

export function AnalisiOperativa({ ambito, spese, items, groups, cats, subcats, risolutori, apriFoto }: {
  ambito: Ambito
  spese: Fx[]           // già filtrate per ambito; recurring già armonizzato con expense_nature
  items: ItemEsteso[]
  groups: Group[]
  cats: Category[]
  subcats: Subcat[]
  risolutori: RisolutoriVoce   // stessi nomi e ripieghi dell'adattatore
  apriFoto: (receiptId: string) => void
}) {
  const oggi = oggiARoma()
  const [sotto, setSotto] = useState<Sotto>('calendario')
  const [gFilter, setGFilter] = useState('')
  const [month, setMonth] = useState(oggi.slice(0, 7))
  const [periodMode, setPeriodMode] = useState<'mese' | 'settimana' | 'anno' | 'intervallo'>('mese')
  const [year, setYear] = useState(oggi.slice(0, 4))
  const [weekAnchor, setWeekAnchor] = useState(oggi)
  const [fromDate, setFromDate] = useState(oggi)
  const [toDate, setToDate] = useState(oggi)
  const [giornoSel, setGiornoSel] = useState('')
  const [dettaglio, setDettaglio] = useState<Dettaglio>(null)
  const [chat, setChat] = useState<Msg[]>([])
  const [domanda, setDomanda] = useState('')

  const accento = ambito === 'azienda' ? t.terracotta : t.verde
  const itemsByExp = useMemo(() => itemsPerSpesa(items) as Record<string, ItemEsteso[]>, [items])
  const personaNome = gFilter ? (groups.find(g => g.id === gFilter)?.name ?? null) : null
  // proiezione per RIGA (item prima, madre come ripiego), poi filtro persona
  // sulle voci: la riga di Teo dentro una spesa di Casa resta di Teo
  const vociDi = useMemo(() =>
    (righe: Fx[]): Voce[] => {
      const voci = vociEstese(righe, itemsByExp, risolutori)
      return personaNome ? voci.filter(v => v.g === personaNome) : voci
    }, [itemsByExp, risolutori, personaNome])

  // il Calendario resta per mese (è una griglia mensile); Racconto e Domanda
  // seguono il periodo scelto, come nel vecchio tracker
  const isMese = periodMode === 'mese' || sotto === 'calendario'
  const [periodStart, periodEnd] = periodoRange(isMese, periodMode, { month, year, weekAnchor, fromDate, toDate })
  const periodLabel = periodoLabelDi(isMese, periodMode, { month, year, fromDate, toDate }, periodStart, periodEnd)

  const spesePeriodo = useMemo(
    () => spese.filter(r => r.expense_date >= periodStart && r.expense_date <= periodEnd),
    [spese, periodStart, periodEnd])
  const vociMese = useMemo(() => vociDi(spesePeriodo), [vociDi, spesePeriodo])
  const vociPrec = useMemo(
    () => isMese ? vociDi(spese.filter(r => r.expense_date.slice(0, 7) === monthKey(month, -1))) : [],
    [vociDi, spese, month, isMese])
  // il totale viene dalle STESSE voci (righe): coerente col filtro persona
  const totMese = vociMese.reduce((s, v) => s + v.a, 0)
  const { daysInMonth } = ritmoEPrevisione(totMese, month, new Date(`${oggi}T12:00:00`))
  const perGiorno = useMemo(() => {
    const m: Record<number, number> = {}
    vociMese.forEach(v => { const g = Number(v.d.slice(-2)); m[g] = (m[g] || 0) + v.a })
    return m
  }, [vociMese])
  const racconto = useMemo(() => costruisciRacconto(vociMese, vociPrec, totMese), [vociMese, vociPrec, totMese])

  // spese fisse del mese (expense_nature prevale, armonizzato a monte)
  const fisse = useMemo(() => fisseMese(spese, month), [spese, month])
  const fisseTot = fisse.reduce((s, x) => s + x.tot, 0)

  const DOMANDE_VELOCI = ambito === 'personale'
    ? ['Dove abbiamo speso di più?']
    : ['Dove abbiamo speso di più?', 'Quanto in detersivi questo mese?', 'Quanto in sacchetti da sempre?']
  const chiedi = (q: string) => {
    if (!q.trim()) return
    const risposta = rispondiNelContesto(q,
      { rows: spese, month, groups, cats, subcats, vociDi: righe => vociEstese(righe, itemsByExp, risolutori) },
      { isMese, periodStart, periodEnd, periodLabel, personaNome })
    setChat(prev => [...prev, { io: true, t: q.trim() }, { io: false, t: risposta }])
    setDomanda('')
  }

  const mesi = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
  const etichettaMese = `${mesi[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`

  return (
    <div className="flex flex-col gap-3">
      {/* le tre sezioni operative */}
      <div className="flex gap-1.5 flex-wrap">
        {([['calendario', 'Calendario'], ['racconto', 'Racconto'], ['domanda', 'Domanda']] as const).map(([id, nome]) => (
          <Chip key={id} attivo={sotto === id} colore={accento}
            onClick={() => { setSotto(id); setDettaglio(null); setGiornoSel('') }}>{nome}</Chip>
        ))}
      </div>

      {/* periodo (il Calendario è sempre mensile) + Di chi */}
      <Card className="px-4 py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {sotto !== 'calendario' && (
            <div className="flex gap-1.5 flex-wrap">
              {([['mese', 'Mese'], ['settimana', 'Settimana'], ['anno', 'Anno'], ['intervallo', 'Dal–al']] as const).map(([id, nome]) => (
                <Chip key={id} attivo={periodMode === id} colore={accento} onClick={() => setPeriodMode(id)}>{nome}</Chip>
              ))}
            </div>
          )}
          {isMese && (
            <div className="flex items-center gap-1">
              <button onClick={() => { setMonth(monthKey(month, -1)); setGiornoSel(''); setDettaglio(null) }}
                aria-label="Mese precedente" className="grid place-items-center w-11 h-11 text-[18px]" style={{ color: t.inchiostro }}>‹</button>
              <span className="text-[13.5px] font-bold min-w-[74px] text-center" style={{ color: t.inchiostro }}>{etichettaMese}</span>
              <button onClick={() => { setMonth(monthKey(month, 1)); setGiornoSel(''); setDettaglio(null) }}
                aria-label="Mese successivo" className="grid place-items-center w-11 h-11 text-[18px]" style={{ color: t.inchiostro }}>›</button>
            </div>
          )}
        </div>
        {!isMese && periodMode === 'anno' && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[0, 1, 2].map(off => {
              const a = String(Number(oggi.slice(0, 4)) - off)
              return <Chip key={a} attivo={year === a} colore={accento} onClick={() => setYear(a)}>{a}</Chip>
            })}
          </div>
        )}
        {!isMese && periodMode === 'settimana' && (
          <label className="flex items-center gap-2 mt-2 text-[13px]" style={{ color: t.sub }}>
            Settimana del
            <input type="date" value={weekAnchor} onChange={e => setWeekAnchor(e.target.value)}
              className="bg-transparent text-[14px] outline-none" style={{ color: t.inchiostro }} />
          </label>
        )}
        {!isMese && periodMode === 'intervallo' && (
          <div className="flex gap-2 mt-2">
            {([['dal', fromDate, setFromDate], ['al', toDate, setToDate]] as const).map(([nome, valore, setta]) => (
              <label key={nome} className="flex-1 flex items-center gap-2 min-h-11 px-3 text-[13px]"
                style={{ background: t.velo, borderRadius: t.rPill, color: t.sub }}>
                {nome}
                <input type="date" value={valore} onChange={e => setta(e.target.value)}
                  className="flex-1 min-w-0 bg-transparent text-[14px] outline-none" style={{ color: t.inchiostro }} />
              </label>
            ))}
          </div>
        )}
        {groups.length > 1 && (
          <div className="flex gap-1.5 mt-2 flex-wrap">
            <Chip attivo={!gFilter} colore={accento} onClick={() => setGFilter('')}>Tutti</Chip>
            {groups.map(g => (
              <Chip key={g.id} attivo={gFilter === g.id} colore={accento} onClick={() => setGFilter(gFilter === g.id ? '' : g.id)}>
                {g.name === 'Matteo' ? 'Teo' : g.name === 'Matteo e Ania' ? 'M e A' : g.name}
              </Chip>
            ))}
          </div>
        )}
      </Card>

      {/* i componenti TRASFERITI (gli stessi della Fase 1) */}
      {sotto === 'calendario' && (
        <CalendarioTab month={month} daysInMonth={daysInMonth} perGiorno={perGiorno}
          totMese={totMese} giornoSel={giornoSel}
          onGiorno={gs => { setGiornoSel(giornoSel === gs ? '' : gs); setDettaglio(null) }}
          vociGiorno={giornoSel ? vociMese.filter(v => v.d === giornoSel) : []}
          subcats={subcats} onOpenReceipt={apriFoto} />
      )}
      {sotto === 'racconto' && (
        !racconto ? (
          <Card><p className="text-center py-8 text-[13.5px]" style={{ color: t.sub }}>Nessuna spesa da raccontare in questo periodo.</p></Card>
        ) : (
          <RaccontoTab racconto={racconto} vociMese={vociMese} totMese={totMese} isMese={isMese}
            month={month} mesePrecedente={monthKey(month, -1)} periodLabel={periodLabel} groups={groups}
            dettaglio={dettaglio} apriDettaglio={(titolo, voci) => setDettaglio({ titolo, voci })}
            chiudiDettaglio={() => setDettaglio(null)}
            subcats={subcats} onOpenReceipt={apriFoto} />
        )
      )}
      {sotto === 'domanda' && (
        <DomandaTab chat={chat} domanda={domanda} setDomanda={setDomanda}
          domandeVeloci={DOMANDE_VELOCI} onChiedi={chiedi} />
      )}

      {/* spese fisse del mese (dal vecchio Home) */}
      {sotto !== 'domanda' && fisse.length > 0 && (
        <Card className="px-4 py-3.5">
          <div className="flex items-center justify-between">
            <Etichetta extra="mb-0">Spese fisse di {etichettaMese}</Etichetta>
            <span className="text-[13px] font-bold" style={{ color: t.inchiostro }}>{eur2(fisseTot)}</span>
          </div>
          <div className="flex flex-col gap-1 mt-2">
            {fisse.map(f => (
              <div key={f.name} className="flex items-center gap-2 text-[13px]">
                <span style={{ color: f.paid ? t.verde : t.oro }}>{f.paid ? '✓' : '~'}</span>
                <span className="flex-1 truncate" style={{ color: t.inchiostro }}>{f.name}</span>
                <span className="tabular-nums" style={{ color: t.sub }}>{eur2(f.tot)}{!f.paid && ' attesa'}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
