'use client'
// ============================================================================
// SPESE SHELL (3.1 → 3.2A.1) — il guscio reale del nuovo modulo spese,
// direzione B "Contemporanea essenziale".
//
// Il selettore Casa Mia / Casa Ania è un CONFINE REALE in tutte e quattro le
// sezioni. Ogni ambito ha il SUO stato dei filtri e le opzioni arrivano dai
// dati. Su telefono il contenuto scorre in un'AREA DELIMITATA che termina
// sopra la fascia del ＋: nessun testo, importo o riga può passare sotto il
// pulsante, in nessuna sezione. Nessuna seconda barra in basso.
// ============================================================================
import { useMemo, useState, type ReactNode } from 'react'
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
  type Contesto, type DatiSpese, type FiltriSpese, type OpzioniFiltri, type StatoDati,
} from '@/lib/spese/vista'

export type SezioneSpese = 'panoramica' | 'movimenti' | 'documenti' | 'analisi'
const SEZIONI: [SezioneSpese, string][] = [
  ['panoramica', 'Panoramica'], ['movimenti', 'Movimenti'],
  ['documenti', 'Documenti'], ['analisi', 'Analisi'],
]
const OPZIONI_VUOTE: OpzioniFiltri = { periodi: [], categorie: [], metodi: [] }

export function SpeseShell({ dati, contestoIniziale = 'mia', sezioneIniziale = 'panoramica', filtriApertiIniziale = false, riprova, aggiungi, notaAggiungi, sopra, apriFoto, eliminaSpesa, gestisciBudget, analisiOperativa, cambiaContesto, inSospeso, riprendiCaricamenti }: {
  dati: StatoDati<DatiSpese>
  contestoIniziale?: Contesto
  sezioneIniziale?: SezioneSpese
  filtriApertiIniziale?: boolean
  riprova?: () => void
  aggiungi?: (voce: VoceAggiungi) => void   // richiamo sicuro del vecchio inserimento (opzionale)
  inSospeso?: number                        // caricamenti pendenti nel deposito durevole
  riprendiCaricamenti?: () => void          // apre la coda dei caricamenti senza selettore
  notaAggiungi?: string
  sopra?: ReactNode                         // es. la barretta PROVA (mai nel prodotto finale)
  // 3.2B — funzioni operative delle pagine ufficiali (assenti nella preview)
  apriFoto?: (documentId: string) => void
  eliminaSpesa?: (expenseId: string) => void
  gestisciBudget?: (contesto: Contesto) => void
  analisiOperativa?: (contesto: Contesto) => ReactNode
  // 3.2B.1: sulle pagine ufficiali il selettore NAVIGA alla route dell'altro
  // ambito (l'ambito operativo resta UNICO per pagina); nelle preview resta
  // il cambio interno.
  cambiaContesto?: (contesto: Contesto) => void
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
  const opzioniAttuali = contesto === 'mia' ? opzioni.mia : opzioni.ania
  const accento = contesto === 'ania' ? t.terracotta : t.verde

  const vaiAiDaControllare = () => {
    setFiltri({ ...iniziali, stato: 'Da controllare' })
    setSezione('movimenti')
  }

  const fab = (classi: string) => (
    <button onClick={() => setAggiungiAperto(true)} aria-label="Aggiungi spesa o documento"
      className={`grid place-items-center w-14 h-14 ${classi}`}
      style={{ background: accento, color: '#fff', borderRadius: '1rem', boxShadow: '0 8px 22px rgba(20,40,30,.28)' }}>
      <Plus size={26} strokeWidth={2.4} />
    </button>
  )

  return (
    // su telefono il guscio occupa lo schermo e lo scorrimento è INTERNO:
    // l'area dei contenuti termina sopra la fascia del ＋ (niente ci passa
    // sotto); su schermo grande resta il flusso normale col ＋ fisso.
    <div className="flex flex-col max-lg:fixed max-lg:inset-0 max-lg:top-12 max-lg:z-30 lg:min-h-dvh"
      style={{ background: t.fondo, color: t.inchiostro }}>
      {sopra}
      <div className="shrink-0 w-full max-w-md mx-auto px-4">
        {/* selettore di contesto: un confine reale per tutte le sezioni */}
        <div className="flex items-center justify-between pt-4 pb-3">
          <h1 className={`${DISPLAY} text-[22px] leading-none`} style={{ color: t.inchiostro }}>Spese</h1>
          <div className="flex p-0.5" style={{ background: t.velo, borderRadius: t.rPill }}>
            {([['mia', 'Casa Mia'], ['ania', 'Casa Ania']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => cambiaContesto ? cambiaContesto(id) : setContesto(id)}
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
        <nav className="flex gap-4" style={{ borderBottom: `1px solid ${t.bordo}` }} aria-label="Sezioni delle spese">
          {SEZIONI.map(([id, nome]) => (
            <button key={id} onClick={() => setSezione(id)} aria-current={sezione === id ? 'page' : undefined}
              className="min-h-11 text-[14px] relative"
              style={{ color: sezione === id ? t.inchiostro : t.sub, fontWeight: sezione === id ? 700 : 500 }}>
              {nome}
              {sezione === id && (
                <span className="absolute left-0 right-0 -bottom-px h-[2.5px]"
                  style={{ background: accento, borderRadius: 99 }} />
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* area dei contenuti: su telefono scorre QUI dentro e finisce sopra
          la fascia del ＋ — su desktop scorre la pagina */}
      <div className="flex-1 min-h-0 max-lg:overflow-y-auto">
        <div className="w-full max-w-md mx-auto px-4 pt-3 pb-6 lg:pb-44">
          {dati.stato === 'caricamento' && <Caricamento />}
          {dati.stato === 'errore' && <Errore messaggio={dati.messaggio} riprova={riprova} />}
          {dati.stato === 'pronto' && (
            <>
              {sezione === 'panoramica' && (contesto === 'mia'
                ? <PanoramicaMia dati={dati.dati.mia} movimenti={dati.dati.movimenti} apriDaControllare={vaiAiDaControllare}
                    gestisciBudget={gestisciBudget ? () => gestisciBudget('mia') : undefined} />
                : <PanoramicaAnia dati={dati.dati.ania} movimenti={dati.dati.movimenti}
                    gestisciBudget={gestisciBudget ? () => gestisciBudget('ania') : undefined} />)}
              {sezione === 'movimenti' && (
                <MovimentiTab movimenti={dati.dati.movimenti} contesto={contesto}
                  opzioni={opzioniAttuali}
                  filtri={filtri} iniziali={iniziali} setFiltri={setFiltri}
                  apriFiltri={() => setFiltriAperti(true)}
                  apriFoto={apriFoto} eliminaSpesa={eliminaSpesa} />
              )}
              {sezione === 'documenti' && (
                <DocumentiTab documenti={perContestoDocumenti(dati.dati.documenti, contesto)} apriFoto={apriFoto ? d => apriFoto(d.id) : undefined} />
              )}
              {sezione === 'analisi' && (
                <AnalisiTab contesto={contesto} mia={dati.dati.mia} ania={dati.dati.ania} operativa={analisiOperativa?.(contesto)} />
              )}
            </>
          )}
        </div>
      </div>

      {/* fascia del ＋ (solo telefono): area riservata FUORI dallo scorrimento,
          sopra la barra globale del gestionale */}
      <div className="shrink-0 relative h-[4.25rem] mb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:hidden">
        <div className="w-full max-w-md mx-auto relative h-full">
          {fab('absolute right-4 top-1')}
        </div>
      </div>
      {/* ＋ su schermo grande: fisso in basso a destra */}
      <div className="hidden lg:block">{fab('fixed bottom-6 right-6 z-40')}</div>

      {filtriAperti && dati.stato === 'pronto' && (
        <FiltriPanel contesto={contesto} opzioni={opzioniAttuali}
          filtri={filtri} iniziali={iniziali} setFiltri={setFiltri}
          risultati={applicaFiltri(dati.dati.movimenti, filtri, contesto, opzioniAttuali.periodi).length}
          chiudi={() => setFiltriAperti(false)} />
      )}
      {aggiungiAperto && (
        <AggiungiSheet chiudi={() => setAggiungiAperto(false)}
          scegli={aggiungi ? v => { setAggiungiAperto(false); aggiungi(v) } : undefined}
          nota={notaAggiungi}
          inSospeso={inSospeso}
          riprendi={riprendiCaricamenti ? () => { setAggiungiAperto(false); riprendiCaricamenti() } : undefined} />
      )}
    </div>
  )
}
