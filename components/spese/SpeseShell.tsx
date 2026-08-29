'use client'
// ============================================================================
// SPESE SHELL (Fase 3.1) — il guscio reale del nuovo modulo spese,
// direzione B "Contemporanea essenziale".
//
// Mobile-first: selettore Casa Mia / Casa Ania, navigazione compatta in alto
// (Panoramica · Movimenti · Documenti · Analisi), ＋ flottante sopra la barra
// globale. NESSUNA seconda barra in basso. Il guscio non parla con Supabase:
// riceve StatoDati<DatiSpese> e sa disegnare caricamento, errore e contenuti.
// In questa fase non esiste alcun flusso di scrittura.
// ============================================================================
import { useState } from 'react'
import { Plus } from 'lucide-react'
import { TEMA as t, DISPLAY } from './tema'
import { PanoramicaMia, PanoramicaAnia } from './PanoramicaTab'
import { MovimentiTab } from './MovimentiTab'
import { DocumentiTab } from './DocumentiTab'
import { AnalisiTab } from './AnalisiTab'
import { FiltriPanel } from './FiltriPanel'
import { AggiungiSheet, type VoceAggiungi } from './AggiungiSheet'
import { Caricamento, Errore } from './StatiDati'
import {
  applicaFiltri, FILTRI_INIZIALI,
  type Contesto, type DatiSpese, type FiltriSpese, type StatoDati,
} from '@/lib/spese/vista'

export type SezioneSpese = 'panoramica' | 'movimenti' | 'documenti' | 'analisi'
const SEZIONI: [SezioneSpese, string][] = [
  ['panoramica', 'Panoramica'], ['movimenti', 'Movimenti'],
  ['documenti', 'Documenti'], ['analisi', 'Analisi'],
]

export function SpeseShell({ dati, contestoIniziale = 'mia', sezioneIniziale = 'panoramica', riprova, aggiungi, notaAggiungi }: {
  dati: StatoDati<DatiSpese>
  contestoIniziale?: Contesto
  sezioneIniziale?: SezioneSpese
  riprova?: () => void
  aggiungi?: (voce: VoceAggiungi) => void   // richiamo sicuro del vecchio inserimento (opzionale)
  notaAggiungi?: string
}) {
  const [contesto, setContesto] = useState<Contesto>(contestoIniziale)
  const [sezione, setSezione] = useState<SezioneSpese>(sezioneIniziale)
  const [filtri, setFiltri] = useState<FiltriSpese>(FILTRI_INIZIALI)
  const [filtriAperti, setFiltriAperti] = useState(false)
  const [aggiungiAperto, setAggiungiAperto] = useState(false)

  const vaiAiDaControllare = () => {
    setFiltri({ ...FILTRI_INIZIALI, stato: 'Da controllare' })
    setSezione('movimenti')
  }

  return (
    <div className="min-h-dvh pb-40" style={{ background: t.fondo, color: t.inchiostro }}>
      <div className="max-w-md mx-auto px-4">
        {/* selettore di contesto */}
        <div className="flex items-center justify-between pt-4 pb-3">
          <h1 className={`${DISPLAY} text-[22px] leading-none`} style={{ color: t.inchiostro }}>Spese</h1>
          <div className="flex p-0.5" style={{ background: t.velo, borderRadius: t.rPill }}>
            {([['mia', 'Casa Mia'], ['ania', 'Casa Ania']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => { setContesto(id); setSezione('panoramica') }}
                aria-pressed={contesto === id}
                className="min-h-9 px-3.5 text-[13px] font-bold"
                style={contesto === id
                  ? { background: id === 'ania' ? t.terracotta : t.verde, color: '#fff', borderRadius: t.rPill, boxShadow: t.ombra }
                  : { color: t.sub, borderRadius: t.rPill }}>
                {nome}
              </button>
            ))}
          </div>
        </div>

        {/* navigazione compatta in alto — nessuna seconda barra in basso */}
        <nav className="flex gap-4 mb-3" style={{ borderBottom: `1px solid ${t.bordo}` }} aria-label="Sezioni delle spese">
          {SEZIONI.map(([id, nome]) => (
            <button key={id} onClick={() => setSezione(id)} aria-current={sezione === id ? 'page' : undefined}
              className="min-h-11 text-[14px] relative"
              style={{ color: sezione === id ? t.inchiostro : t.sub, fontWeight: sezione === id ? 700 : 500 }}>
              {nome}
              {sezione === id && (
                <span className="absolute left-0 right-0 -bottom-px h-[2.5px]"
                  style={{ background: contesto === 'ania' ? t.terracotta : t.verde, borderRadius: 99 }} />
              )}
            </button>
          ))}
        </nav>

        {dati.stato === 'caricamento' && <Caricamento />}
        {dati.stato === 'errore' && <Errore messaggio={dati.messaggio} riprova={riprova} />}
        {dati.stato === 'pronto' && (
          <>
            {sezione === 'panoramica' && (contesto === 'mia'
              ? <PanoramicaMia dati={dati.dati.mia} movimenti={dati.dati.movimenti} apriDaControllare={vaiAiDaControllare} />
              : <PanoramicaAnia dati={dati.dati.ania} movimenti={dati.dati.movimenti} />)}
            {sezione === 'movimenti' && (
              <MovimentiTab movimenti={dati.dati.movimenti} filtri={filtri} setFiltri={setFiltri}
                apriFiltri={() => setFiltriAperti(true)} />
            )}
            {sezione === 'documenti' && <DocumentiTab documenti={dati.dati.documenti} />}
            {sezione === 'analisi' && <AnalisiTab mia={dati.dati.mia} />}
          </>
        )}
      </div>

      {/* ＋ flottante, sopra la barra globale del gestionale */}
      <button onClick={() => setAggiungiAperto(true)} aria-label="Aggiungi spesa o documento"
        className="fixed right-4 z-40 grid place-items-center w-14 h-14 bottom-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6"
        style={{ background: contesto === 'ania' ? t.terracotta : t.verde, color: '#fff', borderRadius: '1rem', boxShadow: '0 8px 22px rgba(20,40,30,.28)' }}>
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {filtriAperti && dati.stato === 'pronto' && (
        <FiltriPanel filtri={filtri} setFiltri={setFiltri}
          risultati={applicaFiltri(dati.dati.movimenti, filtri).length}
          chiudi={() => setFiltriAperti(false)} />
      )}
      {aggiungiAperto && (
        <AggiungiSheet chiudi={() => setAggiungiAperto(false)}
          scegli={aggiungi ? v => { setAggiungiAperto(false); aggiungi(v) } : undefined}
          nota={notaAggiungi} />
      )}
    </div>
  )
}
