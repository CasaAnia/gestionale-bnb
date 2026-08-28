'use client'
// Guscio dell'anteprima (Fase 3A): selettore Casa Mia/Casa Ania, navigazione
// compatta in alto (Panoramica · Movimenti · Documenti · Analisi), pulsante ＋
// flottante sopra la barra globale, due varianti grafiche sugli stessi dati.
// SOLO dati sintetici, nessuna chiamata di rete.
import { useState } from 'react'
import { Plus, Camera, Images, FolderOpen, PencilLine, X } from 'lucide-react'
import { CALDA, ESSENZIALE, MISTA, type Tema } from './tema'
import { PanoramicaMia, PanoramicaAnia, Movimenti, Documenti, Revisione, Analisi } from './viste'

type TabId = 'panoramica' | 'movimenti' | 'documenti' | 'analisi'
const TABS: [TabId, string][] = [
  ['panoramica', 'Panoramica'], ['movimenti', 'Movimenti'],
  ['documenti', 'Documenti'], ['analisi', 'Analisi'],
]

// stato iniziale pilotabile dall'URL (?v=essenziale&c=ania&t=movimenti&filtri=1&rev=1)
function statoIniziale() {
  if (typeof window === 'undefined') return { v: 'calda', c: 'mia', t: 'panoramica' as TabId, filtri: false, rev: false }
  const q = new URLSearchParams(window.location.search)
  return {
    v: ['essenziale', 'mista'].includes(q.get('v') || '') ? q.get('v') : 'calda',
    c: q.get('c') === 'ania' ? 'ania' : 'mia',
    t: (['panoramica', 'movimenti', 'documenti', 'analisi'].includes(q.get('t') || '') ? q.get('t') : 'panoramica') as TabId,
    filtri: q.get('filtri') === '1',
    rev: q.get('rev') === '1',
  }
}

export default function Anteprima() {
  const [iniziale] = useState(statoIniziale)
  const [variante, setVariante] = useState<'calda' | 'essenziale' | 'mista'>(iniziale.v as 'calda' | 'essenziale' | 'mista')
  const [contesto, setContesto] = useState<'mia' | 'ania'>(iniziale.c as 'mia' | 'ania')
  const [tab, setTab] = useState<TabId>(iniziale.t)
  const [filtriAperti, setFiltriAperti] = useState(iniziale.filtri)
  const [revisione, setRevisione] = useState(iniziale.rev)
  const [aggiungi, setAggiungi] = useState(false)
  const t: Tema = variante === 'calda' ? CALDA : variante === 'mista' ? MISTA : ESSENZIALE

  return (
    <div className="min-h-dvh pb-40" style={{ background: t.fondo, color: t.inchiostro }}>
      {/* barretta del PROTOTIPO (non fa parte del prodotto) */}
      <div className="flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold tracking-wide"
        style={{ background: t.inchiostro, color: t.fondo }}>
        ANTEPRIMA · dati finti ·
        {(['calda', 'essenziale', 'mista'] as const).map(v => (
          <button key={v} onClick={() => setVariante(v)}
            className="px-2 py-0.5 rounded-full min-h-6"
            style={variante === v ? { background: t.fondo, color: t.inchiostro } : { opacity: 0.6 }}>
            {v === 'calda' ? 'A · calda' : v === 'essenziale' ? 'B · essenziale' : 'C · mista'}
          </button>
        ))}
      </div>

      <div className="max-w-md mx-auto px-4">
        {/* selettore di contesto */}
        <div className="flex items-center justify-between pt-4 pb-3">
          <h1 className={`${t.display} text-[22px] leading-none`} style={{ color: t.inchiostro }}>Spese</h1>
          <div className="flex p-0.5" style={{ background: t.velo, borderRadius: t.rPill }}>
            {([['mia', 'Casa Mia'], ['ania', 'Casa Ania']] as const).map(([id, nome]) => (
              <button key={id} onClick={() => { setContesto(id); setTab('panoramica') }}
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
        <nav className="flex gap-4 mb-3" style={{ borderBottom: `1px solid ${t.bordo}` }} aria-label="Sezioni">
          {TABS.map(([id, nome]) => (
            <button key={id} onClick={() => setTab(id)}
              className="min-h-11 text-[14px] relative"
              style={{ color: tab === id ? t.inchiostro : t.sub, fontWeight: tab === id ? 700 : 500 }}>
              {nome}
              {tab === id && (
                <span className="absolute left-0 right-0 -bottom-px h-[2.5px]"
                  style={{ background: contesto === 'ania' ? t.terracotta : t.verde, borderRadius: 99 }} />
              )}
            </button>
          ))}
        </nav>

        {tab === 'panoramica' && (contesto === 'mia'
          ? <PanoramicaMia t={t} apriRevisione={() => setRevisione(true)} />
          : <PanoramicaAnia t={t} />)}
        {tab === 'movimenti' && <Movimenti t={t} filtriAperti={filtriAperti} setFiltriAperti={setFiltriAperti} />}
        {tab === 'documenti' && <Documenti t={t} apriRevisione={() => setRevisione(true)} />}
        {tab === 'analisi' && <Analisi t={t} />}
      </div>

      {/* ＋ flottante, sopra la barra globale del gestionale */}
      <button onClick={() => setAggiungi(true)} aria-label="Aggiungi spesa o documento"
        className="fixed right-4 z-40 grid place-items-center w-14 h-14 bottom-[calc(5.5rem+env(safe-area-inset-bottom)+0.75rem)] lg:bottom-6"
        style={{ background: contesto === 'ania' ? t.terracotta : t.verde, color: '#fff', borderRadius: t.id === 'calda' ? 999 : '1rem', boxShadow: '0 8px 22px rgba(20,40,30,.28)' }}>
        <Plus size={26} strokeWidth={2.4} />
      </button>

      {/* foglio Aggiungi */}
      {aggiungi && (
        <div className="fixed inset-0 z-[60] flex flex-col justify-end" role="dialog" aria-label="Aggiungi">
          <button className="absolute inset-0" style={{ background: 'rgba(20,25,20,.45)' }} onClick={() => setAggiungi(false)} aria-label="Chiudi" />
          <div className="relative px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+20px)]"
            style={{ background: t.fondo, borderRadius: `${t.r} ${t.r} 0 0` }}>
            <div className="mx-auto w-10 h-1 rounded-full mb-4" style={{ background: t.bordo }} />
            <div className="flex items-center justify-between mb-3">
              <p className={`${t.display} text-[19px]`} style={{ color: t.inchiostro }}>Aggiungi</p>
              <button onClick={() => setAggiungi(false)} aria-label="Chiudi" className="grid place-items-center w-11 h-11" style={{ color: t.sub }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                [Camera, 'Scatta scontrino', 'si apre la fotocamera'],
                [Images, 'Dalla libreria', 'foto già fatte'],
                [FolderOpen, 'Carica documento', 'fattura o PDF'],
                [PencilLine, 'Spesa manuale', 'senza documento'],
              ].map(([I, nome, sotto]) => {
                const Icona = I as typeof Camera
                return (
                  <button key={nome as string} className="flex flex-col items-start gap-2 p-3.5 min-h-24 text-left"
                    style={{ background: t.carta, borderRadius: t.r, border: t.bordoCarta, boxShadow: t.ombra }}>
                    <span className="grid place-items-center w-9 h-9" style={{ background: t.verdeTenue, color: t.verde, borderRadius: 99 }}>
                      <Icona size={17} />
                    </span>
                    <span className="text-[14px] font-bold leading-tight" style={{ color: t.inchiostro }}>{nome as string}
                      <span className="block text-[11.5px] font-normal" style={{ color: t.sub }}>{sotto as string}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {revisione && <Revisione t={t} chiudi={() => setRevisione(false)} />}
    </div>
  )
}
