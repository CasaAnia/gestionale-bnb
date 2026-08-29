'use client'
// ============================================================================
// SPESE SHELL (Fase 3.1, corretta in 3.1.1) — il guscio reale del nuovo
// modulo spese, direzione B "Contemporanea essenziale".
//
// Il selettore Casa Mia / Casa Ania è un CONFINE REALE in tutte e quattro le
// sezioni: Casa Mia mostra personale + misti, Casa Ania azienda + misti.
// Ogni ambito ha il SUO stato dei filtri (niente contaminazioni) e le opzioni
// dei filtri arrivano dai dati della vista. Nessuna seconda barra in basso,
// nessun flusso di scrittura in questa fase.
// ============================================================================
import { useMemo, useState } from 'react'
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
  applicaFiltri, filtriIniziali, perContestoDocumenti,
  type Contesto, type DatiSpese, type FiltriSpese, type StatoDati,
} from '@/lib/spese/vista'

export type SezioneSpese = 'panoramica' | 'movimenti' | 'documenti' | 'analisi'
const SEZIONI: [SezioneSpese, string][] = [
  ['panoramica', 'Panoramica'], ['movimenti', 'Movimenti'],
  ['documenti', 'Documenti'], ['analisi', 'Analisi'],
]
const OPZIONI_VUOTE = { periodi: [], categorie: [], metodi: [] }

export function SpeseShell({ dati, contestoIniziale = 'mia', sezioneIniziale = 'panoramica', filtriApertiIniziale = false, riprova, aggiungi, notaAggiungi }: {
  dati: StatoDati<DatiSpese>
  contestoIniziale?: Contesto
  sezioneIniziale?: SezioneSpese
  filtriApertiIniziale?: boolean
  riprova?: () => void
  aggiungi?: (voce: VoceAggiungi) => void   // richiamo sicuro del vecchio inserimento (opzionale)
  notaAggiungi?: string
}) {
  const [contesto, setContesto] = useState<Contesto>(contestoIniziale)
  const [sezione, setSezione] = useState<SezioneSpese>(sezioneIniziale)
  const [filtriAperti, setFiltriAperti] = useState(filtriApertiIniziale)
  const [aggiungiAperto, setAggiungiAperto] = useState(false)

  // opzioni per ambito (dai dati) e UNO stato filtri per ciascun ambito
  const opzioni = dati.stato === 'pronto' ? dati.dati.opzioni : { mia: OPZIONI_VUOTE, ania: OPZIONI_VUOTE }
  const inizialiMia = useMemo(() => filtriIniziali(opzioni.mia), [opzioni.mia])
  const inizialiAnia = useMemo(() => filtriIniziali(opzioni.ania), [opzioni.ania])
  const [filtriMia, setFiltriMia] = useState<FiltriSpese | null>(null)
  const [filtriAnia, setFiltriAnia] = useState<FiltriSpese | null>(null)
  const filtri = contesto === 'mia' ? (filtriMia ?? inizialiMia) : (filtriAnia ?? inizialiAnia)
  const iniziali = contesto === 'mia' ? inizialiMia : inizialiAnia
  const setFiltri = contesto === 'mia' ? setFiltriMia : setFiltriAnia

  const vaiAiDaControllare = () => {
    setFiltri({ ...iniziali, stato: 'Da controllare' })
    setSezione('movimenti')
  }

  return (
    <div className="min-h-dvh pb-40" style={{ background: t.fondo, color: t.inchiostro }}>
      <div className="max-w-md mx-auto px-4">
        {/* selettore di contesto: un confine reale per tutte le sezioni */}
        <div className="flex items-center justify-between pt-4 pb-3">
          <h1 className={`${DISPLAY} text-[22px] leading-none`} style={{ color: t.inchiostro }}>Spese</h1>
          <div className="flex p-0.5" style={{ background: t.velo, borderRadius: t.rPill }}>
            {([['mia', 'Casa Mia'], ['ania', 'Casa Ania']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => setContesto(id)}
                aria-pressed={contesto === id}
                className="min-h-11 px-3.5 text-[13px] font-bold"
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
              <MovimentiTab movimenti={dati.dati.movimenti} contesto={contesto}
                filtri={filtri} iniziali={iniziali} setFiltri={setFiltri}
                apriFiltri={() => setFiltriAperti(true)} />
            )}
            {sezione === 'documenti' && (
              <DocumentiTab documenti={perContestoDocumenti(dati.dati.documenti, contesto)} />
            )}
            {sezione === 'analisi' && (
              <AnalisiTab contesto={contesto} mia={dati.dati.mia} ania={dati.dati.ania} />
            )}
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
        <FiltriPanel contesto={contesto} opzioni={contesto === 'mia' ? opzioni.mia : opzioni.ania}
          filtri={filtri} iniziali={iniziali} setFiltri={setFiltri}
          risultati={applicaFiltri(dati.dati.movimenti, filtri, contesto).length}
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
