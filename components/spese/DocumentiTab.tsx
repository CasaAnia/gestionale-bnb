'use client'
// Documenti del nuovo guscio (Fase 3.1): il ciclo di vita completo dello
// schema nuovo — scontrini in coda e in revisione, fatture da pagare e
// pagate, confermati, scartati, errori. Segnala i documenti senza foto e
// i campi dubbi. In questa fase è una vista: nessuna azione di scrittura.
import type { ReactNode } from 'react'
import {
  Camera, CameraOff, Receipt, Landmark, CalendarClock, Layers,
  TriangleAlert, CircleAlert, CircleCheck, ChevronRight, Ban,
} from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { Card, Etichetta, Pastiglia } from './mattoni'
import { Vuoto } from './StatiDati'
import { eurVista as eur, type DocumentoVista, type StatoDocumento } from '@/lib/spese/vista'

function Blocco({ titolo, docs, vuoto, children }: {
  titolo: string; docs: DocumentoVista[]; vuoto?: string
  children: (d: DocumentoVista, i: number) => ReactNode
}) {
  return (
    <Card className="px-4 py-3.5">
      <div className="flex items-center justify-between mb-1">
        <Etichetta extra="mb-0">{titolo}</Etichetta>
        <span className="text-[12px] font-bold" style={{ color: t.sub }}>{docs.length}</span>
      </div>
      {docs.length === 0
        ? <p className="text-[13px] min-h-8 flex items-center" style={{ color: t.sub }}>{vuoto ?? 'Niente qui al momento.'}</p>
        : docs.map((d, i) => children(d, i))}
    </Card>
  )
}

const bordoSopra = (i: number) => (i > 0 ? { borderTop: `1px solid ${t.bordo}` } : undefined)

export function DocumentiTab({ documenti, apriRevisione }: {
  documenti: DocumentoVista[]
  apriRevisione?: (d: DocumentoVista) => void
}) {
  const per = (s: StatoDocumento) => documenti.filter(d => d.stato === s)

  return (
    <div className="flex flex-col gap-3">
      <Blocco titolo="In coda" docs={per('da_elaborare')} vuoto="Nessuna foto in attesa di lettura.">
        {(d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-11" style={bordoSopra(i)}>
            <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.velo, color: t.sub, borderRadius: t.rIcona }}>
              <Camera size={16} />
            </span>
            <span className="flex-1 text-[14px]" style={{ color: t.inchiostro }}>{d.titolo}</span>
            <span className="text-[12px]" style={{ color: t.sub }}>in coda</span>
          </div>
        )}
      </Blocco>

      <Blocco titolo="Da controllare" docs={per('da_controllare')} vuoto="Niente in revisione: sei in pari.">
        {(d, i) => (
          <button key={d.id} onClick={apriRevisione ? () => apriRevisione(d) : undefined}
            className="w-full flex items-center gap-3 min-h-12 text-left" style={bordoSopra(i)}>
            <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.gialloTenue, color: t.giallo, borderRadius: t.rIcona }}>
              <Receipt size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>
                {d.titolo}{d.importo != null && <> · {eur(d.importo)}</>}
              </span>
              <span className="flex gap-1 mt-0.5 flex-wrap">
                {d.senzaFoto
                  ? <Pastiglia icona={CameraOff} testo="senza foto" tono="terra" />
                  : <Pastiglia icona={Camera} testo={`${d.pagine ?? 1} foto`} />}
                {!!d.dubbi && <Pastiglia icona={TriangleAlert} testo={d.dubbi === 1 ? '1 campo dubbio' : `${d.dubbi} campi dubbi`} tono="giallo" />}
              </span>
            </span>
            <ChevronRight size={18} style={{ color: t.sub }} />
          </button>
        )}
      </Blocco>

      <Blocco titolo="Fatture da pagare" docs={per('da_pagare')} vuoto="Nessuna fattura in attesa: tutto pagato.">
        {(d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-12" style={bordoSopra(i)}>
            <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.terraTenue, color: t.terracotta, borderRadius: t.rIcona }}>
              <Landmark size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-semibold truncate" style={{ color: t.inchiostro }}>{d.titolo}</span>
              <span className="flex gap-1 mt-0.5 flex-wrap">
                {d.scade && <Pastiglia icona={CalendarClock} testo={`scade ${d.scade}`} tono="rosso" />}
                {!!d.pagine && d.pagine > 1 && <Pastiglia icona={Layers} testo={`${d.pagine} pagine`} />}
              </span>
            </span>
            {d.importo != null && <span className={`${DISPLAY} text-[15px]`} style={{ color: t.terracotta }}>{eur(d.importo)}</span>}
          </div>
        )}
      </Blocco>

      <Blocco titolo="Fatture pagate" docs={per('pagata')} vuoto="Le fatture pagate compariranno qui.">
        {(d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-11" style={bordoSopra(i)}>
            <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.verdeTenue, color: t.verde, borderRadius: t.rIcona }}>
              <CircleCheck size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium truncate" style={{ color: t.inchiostro }}>{d.titolo}</span>
              {d.giorno && <span className="block text-[12px]" style={{ color: t.sub }}>pagata {d.giorno}</span>}
            </span>
            {d.importo != null && <span className={`${DISPLAY} text-[15px]`} style={{ color: t.inchiostro }}>{eur(d.importo)}</span>}
          </div>
        )}
      </Blocco>

      <Blocco titolo="Confermati" docs={per('confermato')} vuoto="L'archivio del mese comparirà qui.">
        {(d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-11" style={bordoSopra(i)}>
            <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.velo, color: t.verde, borderRadius: t.rIcona }}>
              <Receipt size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[14px] font-medium truncate" style={{ color: t.inchiostro }}>{d.titolo}</span>
              {d.giorno && <span className="block text-[12px]" style={{ color: t.sub }}>{d.giorno}</span>}
            </span>
            {d.importo != null && <span className={`${DISPLAY} text-[15px]`} style={{ color: t.inchiostro }}>{eur(d.importo)}</span>}
          </div>
        )}
      </Blocco>

      <Blocco titolo="Scartati" docs={per('scartato')} vuoto="Niente scartato: qui restano i doppioni e le foto sbagliate.">
        {(d, i) => (
          <div key={d.id} className="flex items-center gap-3 min-h-11" style={bordoSopra(i)}>
            <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.velo, color: t.sub, borderRadius: t.rIcona }}>
              <Ban size={16} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] truncate" style={{ color: t.sub }}>{d.titolo}</span>
              {d.motivo && <span className="block text-[12px]" style={{ color: t.sub }}>{d.motivo}</span>}
            </span>
          </div>
        )}
      </Blocco>

      {per('errore').length > 0 && (
        <Blocco titolo="Errori" docs={per('errore')}>
          {(d, i) => (
            <div key={d.id} className="flex items-center gap-3 min-h-11" style={bordoSopra(i)}>
              <span className="grid place-items-center w-9 h-9 shrink-0" style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.rIcona }}>
                <CircleAlert size={16} />
              </span>
              <span className="flex-1 text-[13.5px]" style={{ color: t.inchiostro }}>{d.titolo}
                {d.motivo && <span className="block text-[12px]" style={{ color: t.sub }}>{d.motivo}</span>}
              </span>
            </div>
          )}
        </Blocco>
      )}

      {documenti.length === 0 && (
        <Card><Vuoto titolo="Nessun documento" dettaglio="Scatta uno scontrino o carica una fattura dal pulsante +." /></Card>
      )}
    </div>
  )
}
