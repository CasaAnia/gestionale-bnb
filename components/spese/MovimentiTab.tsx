'use client'
// Movimenti del nuovo guscio (3.1 → 3.2A): UNA voce per documento, dentro il
// CONTESTO scelto in alto. Per il misto l'importo principale è la QUOTA
// dell'ambito corrente (l'elenco si somma senza falsare i totali) e il totale
// del documento resta visibile; il dettaglio mostra tutte le righe separate
// per ambito. I filtri lavorano sugli INSIEMI (categorie, persone, camere,
// metodi) e sui periodi con id stabile. Accento: verde Casa Mia, terracotta
// Casa Ania.
import { useState } from 'react'
import { Search, SlidersHorizontal, X, BedDouble, Camera, TriangleAlert, CalendarClock, Layers, Landmark } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Chip, IconaCategoria, Pastiglia } from './mattoni'
import { Vuoto } from './StatiDati'
import {
  eurVista as eur, applicaFiltri, filtriAttivi, gruppiDettaglio, importoNelContesto,
  type Contesto, type FiltriSpese, type MovimentoVista, type OpzioniFiltri,
} from '@/lib/spese/vista'

function PastiglieStato({ m, contesto }: { m: MovimentoVista; contesto: Contesto }) {
  return (
    <span className="flex gap-1 mt-1 flex-wrap">
      {m.stato === 'da_controllare' && <Pastiglia testo="da controllare" tono="giallo" />}
      {m.avviso && <Pastiglia icona={TriangleAlert} testo={`non quadra: ${m.avviso}`} tono="rosso" />}
      {m.stato === 'da_pagare' && (
        m.scadenza
          ? <Pastiglia icona={m.scadenza.stato === 'scaduta' ? TriangleAlert : CalendarClock}
              testo={`da pagare · ${m.scadenza.etichetta}`}
              tono={m.scadenza.stato === 'scaduta' ? 'rosso' : m.scadenza.stato === 'in_scadenza' ? 'terra' : undefined} />
          : <Pastiglia icona={CalendarClock} testo="da pagare" tono="terra" />
      )}
      {m.stato === 'pagata' && <Pastiglia icona={Landmark} testo="fattura pagata" tono="verde" />}
      {m.dubbio && <Pastiglia icona={TriangleAlert} testo={m.dubbio} tono="giallo" />}
      {m.senzaFoto && m.stato !== 'senza_documento' && <Pastiglia icona={Camera} testo="senza foto" />}
      {m.contesto === 'misto' && (
        <>
          <Pastiglia tono={contesto === 'ania' ? 'verde' : 'terra'}
            testo={`${contesto === 'ania' ? 'Casa Mia' : 'Casa Ania'} ${eur(importoNelContesto(m, contesto === 'ania' ? 'mia' : 'ania'))}`} />
          <Pastiglia icona={Layers} testo={`totale documento ${eur(m.importo)}`} />
        </>
      )}
      {contesto === 'ania' && m.camere.filter(c => c !== 'Generale').map(c => (
        <Pastiglia key={c} icona={BedDouble} testo={c} tono="verde" />
      ))}
    </span>
  )
}

function DettaglioRighe({ m }: { m: MovimentoVista }) {
  // la divisione in gruppi e i subtotali (righe attive + arrotondamento
  // della sorella) vengono dalla logica pura gruppiDettaglio: i subtotali
  // coincidono SEMPRE con le quote
  const gruppi = gruppiDettaglio(m)
  if (gruppi.length === 0) return null
  return (
    <div className="pb-3 pl-12">
      {gruppi.map(g => (
        <div key={g.nome ?? 'tutte'} className="mb-1">
          {g.nome && (
            <p className="text-[11px] uppercase tracking-[0.1em] font-semibold mt-1.5 mb-0.5"
              style={{ color: g.nome === 'Casa Ania' ? t.terracotta : t.verde }}>
              {g.nome} · {eur(g.subtotale)}
            </p>
          )}
          {g.righe.map((r, i) => (
            <div key={`${r.nome}-${i}`} className="flex items-center gap-2 min-h-8 text-[13px]"
              style={r.esclusa ? { opacity: 0.55 } : undefined}>
              <span className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: r.contesto === 'ania' ? t.terracotta : t.salvia }} />
              <span className={`flex-1 truncate ${r.esclusa ? 'line-through' : ''}`} style={{ color: t.inchiostro }}>
                {r.nome}
                {r.persona && r.persona !== 'Casa' && <span className="ml-1" style={{ color: t.sub }}>· {r.persona}</span>}
                {r.camera && r.camera !== 'Generale' && <span className="ml-1" style={{ color: t.sub }}>· {r.camera}</span>}
                {r.esclusa && <span className="ml-1.5 align-middle no-underline"><Pastiglia testo="esclusa: fuori dai conti" /></span>}
                {r.aggiuntaUtente && <span className="ml-1.5 align-middle"><Pastiglia testo="aggiunta a mano" tono="verde" /></span>}
                {r.dubbio && <span className="ml-1.5 align-middle"><Pastiglia icona={TriangleAlert} testo={r.dubbio} tono="giallo" /></span>}
              </span>
              <span className={`tabular-nums ${r.esclusa ? 'line-through' : ''}`} style={{ color: t.sub }}>{eur(r.importo)}</span>
            </div>
          ))}
          {g.arrotondamento !== 0 && (
            <div className="flex items-center gap-2 min-h-8 text-[13px] italic">
              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: t.oro }} />
              <span className="flex-1" style={{ color: t.sub }}>Arrotondamento di cassa</span>
              <span className="tabular-nums" style={{ color: t.sub }}>{eur(g.arrotondamento)}</span>
            </div>
          )}
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

export function RigaMovimento({ m, contesto, ultimo, apri, aperto, apriFoto, elimina, apriFattura }: {
  m: MovimentoVista; contesto: Contesto; ultimo?: boolean; apri?: () => void; aperto?: boolean
  apriFoto?: () => void            // 3.2B: foto del documento
  elimina?: () => void             // 3.2B: solo spese manuali
  apriFattura?: () => void         // Fase 5: dettaglio o pagamento della fattura
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
      {aperto && (
        <>
          <DettaglioRighe m={m} />
          {(apriFoto || elimina || apriFattura) && (
            <div className="flex gap-2 pb-3 pl-12 -mt-1 flex-wrap">
              {apriFattura && (
                <button onClick={apriFattura} className="min-h-11 px-3 text-[12.5px] font-bold inline-flex items-center gap-1.5 text-white"
                  style={{ background: t.terracotta, borderRadius: t.rPill }}>
                  <Landmark size={14} /> {m.stato === 'da_pagare' ? 'Fattura: paga…' : 'Dettaglio fattura'}
                </button>
              )}
              {apriFoto && (
                <button onClick={apriFoto} className="min-h-11 px-3 text-[12.5px] font-bold inline-flex items-center gap-1.5"
                  style={{ color: t.verde, border: `1px solid ${t.bordo}`, borderRadius: t.rPill, background: t.carta }}>
                  <Camera size={14} /> Vedi le foto
                </button>
              )}
              {elimina && (
                <button onClick={elimina} className="min-h-11 px-3 text-[12.5px] font-bold"
                  style={{ color: t.rosso, border: `1px solid ${t.bordo}`, borderRadius: t.rPill, background: t.carta }}>
                  Elimina questa spesa
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

const NOMI_FILTRO: Record<keyof FiltriSpese, string> = {
  periodo: 'Periodo', dal: 'Dal', al: 'Al', persona: 'Di chi', camera: 'Camera',
  categoria: 'Categoria', metodo: 'Pagamento', stato: 'Stato', soloMisti: 'Documenti misti',
}

export function MovimentiTab({ movimenti, contesto, opzioni, filtri, iniziali, setFiltri, apriFiltri, apriFoto, eliminaSpesa, apriFattura }: {
  movimenti: MovimentoVista[]
  contesto: Contesto
  opzioni: OpzioniFiltri
  filtri: FiltriSpese
  iniziali: FiltriSpese
  setFiltri: (f: FiltriSpese) => void
  apriFiltri: () => void
  apriFoto?: (documentId: string) => void
  eliminaSpesa?: (expenseId: string) => void
  apriFattura?: (documentId: string) => void
}) {
  const [cerca, setCerca] = useState('')
  const [aperto, setAperto] = useState<string | null>(null)
  const accento = contesto === 'ania' ? t.terracotta : t.verde
  const visibili = applicaFiltri(movimenti, filtri, contesto, opzioni.periodi, cerca)
  const attivi = filtriAttivi(filtri, iniziali, opzioni.periodi)
  const etichettaPeriodo = attivi.find(([k]) => k === 'periodo')?.[1]
    ?? opzioni.periodi.find(p => p.id === filtri.periodo)?.etichetta ?? filtri.periodo

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
          style={{ background: accento, color: '#fff', borderRadius: t.rPill }}>
          <SlidersHorizontal size={17} />
          {attivi.length > 0 && (
            <span className="absolute -top-1 -right-1 grid place-items-center min-w-[18px] min-h-[18px] text-[10px] font-bold"
              style={{ background: t.inchiostro, color: '#fff', borderRadius: 99 }}>{attivi.length}</span>
          )}
        </button>
      </div>

      {/* solo i filtri ATTIVI, come pastiglie rimovibili */}
      <div className="flex gap-1.5 flex-wrap">
        <Chip attivo colore={accento} aria={`Periodo: ${etichettaPeriodo}. Apri i filtri per cambiarlo`}
          onClick={apriFiltri}>{etichettaPeriodo}</Chip>
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
            {visibili.map((m, i) => {
              const conFoto = apriFoto && m.id.startsWith('doc-') && !m.senzaFoto
              const eliminabile = eliminaSpesa && m.stato === 'senza_documento'
              const fattura = apriFattura && m.id.startsWith('doc-') && (m.stato === 'da_pagare' || m.stato === 'pagata')
              const apribile = !!m.righe || conFoto || eliminabile || fattura
              return (
                <RigaMovimento key={m.id} m={m} contesto={contesto} ultimo={i === visibili.length - 1}
                  apri={apribile ? () => setAperto(aperto === m.id ? null : m.id) : undefined}
                  aperto={aperto === m.id}
                  apriFoto={conFoto ? () => apriFoto!(m.id.slice(4)) : undefined}
                  apriFattura={fattura ? () => apriFattura!(m.id.slice(4)) : undefined}
                  elimina={eliminabile ? () => eliminaSpesa!(m.id.slice(6)) : undefined} />
              )
            })}
          </Card>
          <p className="text-center text-[12px]" style={{ color: t.sub }}>
            {visibili.length} {visibili.length === 1 ? 'movimento' : 'movimenti'} in {contesto === 'ania' ? 'Casa Ania' : 'Casa Mia'} · un documento = una voce
          </p>
        </>
      )}
    </div>
  )
}
