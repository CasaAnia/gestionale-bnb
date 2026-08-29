'use client'
// Movimenti del nuovo guscio (Fase 3.1): UNA voce per documento. Lo scontrino
// misto è un movimento unico; toccandolo si apre il dettaglio con le righe e
// le spese sorelle Casa Mia / Casa Ania. Ricerca, pastiglie dei filtri attivi
// e pannello filtri separato.
import { useState } from 'react'
import { Search, SlidersHorizontal, X, BedDouble, Camera, TriangleAlert, CalendarClock } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Chip, IconaCategoria, Pastiglia } from './mattoni'
import { Vuoto } from './StatiDati'
import {
  eurVista as eur, applicaFiltri, filtriAttivi, FILTRI_INIZIALI,
  type FiltriSpese, type MovimentoVista,
} from '@/lib/spese/vista'

const NOMI_FILTRO: Record<keyof FiltriSpese, string> = {
  periodo: 'Periodo', persona: 'Di chi', categoria: 'Categoria',
  ambito: 'Ambito', metodo: 'Pagamento', stato: 'Stato',
}

function PastiglieStato({ m }: { m: MovimentoVista }) {
  return (
    <span className="flex gap-1 mt-1 flex-wrap">
      {m.stato === 'da_controllare' && <Pastiglia testo="da controllare" tono="giallo" />}
      {m.stato === 'da_pagare' && <Pastiglia icona={CalendarClock} testo="da pagare" tono="terra" />}
      {m.dubbio && <Pastiglia icona={TriangleAlert} testo={m.dubbio} tono="giallo" />}
      {m.senzaFoto && <Pastiglia icona={Camera} testo="senza foto" />}
      {m.sorelle?.map(s => (
        <Pastiglia key={s.contesto} tono={s.contesto === 'ania' ? 'terra' : 'verde'}
          testo={`${s.contesto === 'ania' ? 'Casa Ania' : 'Casa Mia'} ${eur(s.importo)}`} />
      ))}
      {m.camera && <Pastiglia icona={BedDouble} testo={m.camera} tono="verde" />}
    </span>
  )
}

export function RigaMovimento({ m, ultimo, apri, aperto }: {
  m: MovimentoVista; ultimo?: boolean; apri?: () => void; aperto?: boolean
}) {
  return (
    <div style={ultimo && !aperto ? undefined : { borderBottom: `1px solid ${t.bordo}` }}>
      <button onClick={apri} disabled={!apri} aria-expanded={apri ? aperto : undefined}
        className="w-full flex items-center gap-3 min-h-12 py-2 text-left">
        <IconaCategoria nome={m.categoria} tenue />
        <span className="flex-1 min-w-0">
          <span className="block text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>{m.titolo}</span>
          <span className="block text-[12px] truncate" style={{ color: t.sub }}>
            {[m.negozio, m.giorno, m.metodo].filter(Boolean).join(' · ')}
          </span>
          <PastiglieStato m={m} />
        </span>
        <span className={`${DISPLAY} text-[15px] shrink-0`}
          style={{ color: m.stato === 'da_pagare' ? t.terracotta : t.inchiostro }}>{eur(m.importo)}</span>
      </button>
      {aperto && m.righe && (
        <div className="pb-3 pl-12">
          {m.righe.map(r => (
            <div key={r.nome} className="flex items-center gap-2 min-h-8 text-[13px]">
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: r.contesto === 'ania' ? t.terracotta : t.salvia }} />
              <span className="flex-1 truncate" style={{ color: t.inchiostro }}>
                {r.nome}
                {r.dubbio && <span className="ml-1.5 align-middle"><Pastiglia icona={TriangleAlert} testo={r.dubbio} tono="giallo" /></span>}
              </span>
              <span className="tabular-nums" style={{ color: t.sub }}>{eur(r.importo)}</span>
            </div>
          ))}
          <p className="text-[11.5px] mt-1" style={{ color: t.sub }}>
            {m.sorelle
              ? 'documento unico: le righe sono divise tra Casa Mia e Casa Ania'
              : 'righe del documento'}
          </p>
        </div>
      )}
    </div>
  )
}

export function MovimentiTab({ movimenti, filtri, setFiltri, apriFiltri }: {
  movimenti: MovimentoVista[]
  filtri: FiltriSpese
  setFiltri: (f: FiltriSpese) => void
  apriFiltri: () => void
}) {
  const [cerca, setCerca] = useState('')
  const [aperto, setAperto] = useState<string | null>(null)
  const visibili = applicaFiltri(movimenti, filtri, cerca)
  const attivi = filtriAttivi(filtri)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <label className="flex-1 flex items-center gap-2 min-h-11 px-3.5"
          style={{ background: t.carta, borderRadius: t.rPill, border: t.bordoCarta, boxShadow: t.ombra }}>
          <Search size={16} style={{ color: t.sub }} />
          <input value={cerca} onChange={e => setCerca(e.target.value)}
            placeholder="Cerca un movimento, un negozio…"
            className="flex-1 min-w-0 bg-transparent text-[14px] outline-none"
            style={{ color: t.inchiostro }} />
          {cerca && (
            <button onClick={() => setCerca('')} aria-label="Pulisci la ricerca"
              className="grid place-items-center w-8 h-8 -mr-1.5" style={{ color: t.sub }}>
              <X size={15} />
            </button>
          )}
        </label>
        <button onClick={apriFiltri} aria-label="Apri i filtri"
          className="grid place-items-center w-11 h-11 shrink-0 relative"
          style={{ background: t.verde, color: '#fff', borderRadius: t.rPill }}>
          <SlidersHorizontal size={17} />
          {attivi.length > 0 && (
            <span className="absolute -top-1 -right-1 grid place-items-center w-4.5 h-4.5 min-w-[18px] min-h-[18px] text-[10px] font-bold"
              style={{ background: t.terracotta, color: '#fff', borderRadius: 99 }}>{attivi.length}</span>
          )}
        </button>
      </div>

      {/* solo i filtri ATTIVI, come pastiglie rimovibili */}
      {(attivi.length > 0 || filtri.periodo !== 'Anno') && (
        <div className="flex gap-1.5 flex-wrap">
          <Chip attivo aria={`Periodo: ${filtri.periodo}`}
            onClick={apriFiltri}>{filtri.periodo}</Chip>
          {attivi.filter(([k]) => k !== 'periodo').map(([k, v]) => (
            <Chip key={k} attivo tono="neutro" aria={`Togli il filtro ${NOMI_FILTRO[k]}: ${v}`}
              onClick={() => setFiltri({ ...filtri, [k]: FILTRI_INIZIALI[k] })}>
              {v} <X size={12} className="opacity-70" />
            </Chip>
          ))}
        </div>
      )}

      {visibili.length === 0 ? (
        <Card>
          <Vuoto titolo={cerca ? 'Nessun movimento trovato' : 'Nessun movimento con questi filtri'}
            dettaglio={cerca ? 'Prova con un altro nome o togli qualche filtro.' : 'Allarga il periodo o azzera i filtri dal pannello.'} />
        </Card>
      ) : (
        <>
          <Card className="px-4 py-1.5">
            {visibili.map((m, i) => (
              <RigaMovimento key={m.id} m={m} ultimo={i === visibili.length - 1}
                apri={m.righe ? () => setAperto(aperto === m.id ? null : m.id) : undefined}
                aperto={aperto === m.id} />
            ))}
          </Card>
          <p className="text-center text-[12px]" style={{ color: t.sub }}>
            {visibili.length} {visibili.length === 1 ? 'movimento' : 'movimenti'} · un documento = una voce · tocca per il dettaglio
          </p>
        </>
      )}
    </div>
  )
}
