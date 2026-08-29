'use client'
// Movimenti del nuovo guscio (3.1, corretto in 3.1.1): UNA voce per
// documento, dentro il CONTESTO scelto in alto (Casa Mia = personali +
// misti, Casa Ania = aziendali + misti). Per il misto l'importo principale
// è la QUOTA dell'ambito corrente (così l'elenco si somma senza falsare i
// totali) e il totale del documento resta visibile; il dettaglio mostra
// tutte le righe separate per ambito.
import { useState } from 'react'
import { Search, SlidersHorizontal, X, BedDouble, Camera, TriangleAlert, CalendarClock, Layers } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Chip, IconaCategoria, Pastiglia } from './mattoni'
import { Vuoto } from './StatiDati'
import {
  eurVista as eur, applicaFiltri, filtriAttivi, importoNelContesto,
  type Contesto, type FiltriSpese, type MovimentoVista,
} from '@/lib/spese/vista'

function PastiglieStato({ m, contesto }: { m: MovimentoVista; contesto: Contesto }) {
  return (
    <span className="flex gap-1 mt-1 flex-wrap">
      {m.stato === 'da_controllare' && <Pastiglia testo="da controllare" tono="giallo" />}
      {m.stato === 'da_pagare' && <Pastiglia icona={CalendarClock} testo="da pagare" tono="terra" />}
      {m.dubbio && <Pastiglia icona={TriangleAlert} testo={m.dubbio} tono="giallo" />}
      {m.senzaFoto && <Pastiglia icona={Camera} testo="senza foto" />}
      {m.contesto === 'misto' && (
        <>
          <Pastiglia tono={contesto === 'ania' ? 'verde' : 'terra'}
            testo={`${contesto === 'ania' ? 'Casa Mia' : 'Casa Ania'} ${eur(importoNelContesto(m, contesto === 'ania' ? 'mia' : 'ania'))}`} />
          <Pastiglia icona={Layers} testo={`totale documento ${eur(m.importo)}`} />
        </>
      )}
      {contesto === 'ania' && m.camera && <Pastiglia icona={BedDouble} testo={m.camera} tono="verde" />}
    </span>
  )
}

function DettaglioRighe({ m }: { m: MovimentoVista }) {
  if (!m.righe) return null
  const gruppi = m.contesto === 'misto'
    ? ([['mia', 'Casa Mia'], ['ania', 'Casa Ania']] as const).map(([c, nome]) =>
        ({ nome, righe: m.righe!.filter(r => r.contesto === c) })).filter(g => g.righe.length > 0)
    : [{ nome: null, righe: m.righe }]
  return (
    <div className="pb-3 pl-12">
      {gruppi.map(g => (
        <div key={g.nome ?? 'tutte'} className="mb-1">
          {g.nome && (
            <p className="text-[11px] uppercase tracking-[0.1em] font-semibold mt-1.5 mb-0.5"
              style={{ color: g.nome === 'Casa Ania' ? t.terracotta : t.verde }}>
              {g.nome} · {eur(g.righe.reduce((s, r) => s + r.importo, 0))}
            </p>
          )}
          {g.righe.map(r => (
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
        </div>
      ))}
      <p className="text-[11.5px] mt-1" style={{ color: t.sub }}>
        {m.contesto === 'misto'
          ? 'documento unico: le righe sono divise tra Casa Mia e Casa Ania'
          : 'righe del documento'}
      </p>
    </div>
  )
}

export function RigaMovimento({ m, contesto, ultimo, apri, aperto }: {
  m: MovimentoVista; contesto: Contesto; ultimo?: boolean; apri?: () => void; aperto?: boolean
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
          <PastiglieStato m={m} contesto={contesto} />
        </span>
        <span className="shrink-0 text-right">
          <span className={`${DISPLAY} block text-[15px]`}
            style={{ color: m.stato === 'da_pagare' ? t.terracotta : t.inchiostro }}>
            {eur(importoNelContesto(m, contesto))}
          </span>
          {m.contesto === 'misto' && (
            <span className="block text-[10.5px] font-semibold" style={{ color: t.sub }}>
              quota {contesto === 'ania' ? 'Casa Ania' : 'Casa Mia'}
            </span>
          )}
        </span>
      </button>
      {aperto && <DettaglioRighe m={m} />}
    </div>
  )
}

const NOMI_FILTRO: Record<keyof FiltriSpese, string> = {
  periodo: 'Periodo', persona: 'Di chi', camera: 'Camera', categoria: 'Categoria',
  metodo: 'Pagamento', stato: 'Stato', soloMisti: 'Documenti misti',
}

export function MovimentiTab({ movimenti, contesto, filtri, iniziali, setFiltri, apriFiltri }: {
  movimenti: MovimentoVista[]
  contesto: Contesto
  filtri: FiltriSpese
  iniziali: FiltriSpese
  setFiltri: (f: FiltriSpese) => void
  apriFiltri: () => void
}) {
  const [cerca, setCerca] = useState('')
  const [aperto, setAperto] = useState<string | null>(null)
  const visibili = applicaFiltri(movimenti, filtri, contesto, cerca)
  const attivi = filtriAttivi(filtri, iniziali)

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
              className="grid place-items-center w-11 h-11 -mr-2.5" style={{ color: t.sub }}>
              <X size={15} />
            </button>
          )}
        </label>
        <button onClick={apriFiltri} aria-label="Apri i filtri"
          className="grid place-items-center w-11 h-11 shrink-0 relative"
          style={{ background: t.verde, color: '#fff', borderRadius: t.rPill }}>
          <SlidersHorizontal size={17} />
          {attivi.length > 0 && (
            <span className="absolute -top-1 -right-1 grid place-items-center min-w-[18px] min-h-[18px] text-[10px] font-bold"
              style={{ background: t.terracotta, color: '#fff', borderRadius: 99 }}>{attivi.length}</span>
          )}
        </button>
      </div>

      {/* solo i filtri ATTIVI, come pastiglie rimovibili */}
      <div className="flex gap-1.5 flex-wrap">
        <Chip attivo aria={`Periodo: ${filtri.periodo}. Apri i filtri per cambiarlo`}
          onClick={apriFiltri}>{filtri.periodo}</Chip>
        {attivi.filter(([k]) => k !== 'periodo').map(([k, v]) => (
          <Chip key={k} attivo tono="neutro" aria={`Togli il filtro ${NOMI_FILTRO[k]}: ${v}`}
            onClick={() => setFiltri({ ...filtri, [k]: iniziali[k] })}>
            {v} <X size={12} className="opacity-70" />
          </Chip>
        ))}
      </div>

      {visibili.length === 0 ? (
        <Card>
          <Vuoto titolo={cerca ? 'Nessun movimento trovato' : 'Nessun movimento con questi filtri'}
            dettaglio={cerca ? 'Prova con un altro nome o togli qualche filtro.' : 'Allarga il periodo o azzera i filtri dal pannello.'} />
        </Card>
      ) : (
        <>
          <Card className="px-4 py-1.5">
            {visibili.map((m, i) => (
              <RigaMovimento key={m.id} m={m} contesto={contesto} ultimo={i === visibili.length - 1}
                apri={m.righe ? () => setAperto(aperto === m.id ? null : m.id) : undefined}
                aperto={aperto === m.id} />
            ))}
          </Card>
          <p className="text-center text-[12px]" style={{ color: t.sub }}>
            {visibili.length} {visibili.length === 1 ? 'movimento' : 'movimenti'} in {contesto === 'ania' ? 'Casa Ania' : 'Casa Mia'} · un documento = una voce
          </p>
        </>
      )}
    </div>
  )
}
