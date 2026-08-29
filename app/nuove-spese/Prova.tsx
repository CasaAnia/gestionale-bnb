'use client'
// Prova del guscio reale (Fase 3.1) con dati sintetici.
// Stato pilotabile dall'URL per le verifiche:
//   ?c=ania            → parte su Casa Ania
//   ?t=movimenti       → parte su una sezione
//   ?filtri=1          → apre il pannello dei filtri
//   ?stato=caricamento → mostra lo scheletro di caricamento
//   ?stato=errore      → mostra lo stato di errore
//   ?stato=vuoto       → dati quasi vuoti (mese senza spese)
import { useState } from 'react'
import { SpeseShell, type SezioneSpese } from '@/components/spese/SpeseShell'
import type { Contesto, DatiSpese, StatoDati } from '@/lib/spese/vista'
import { DATI_FINTI, DATI_QUASI_VUOTI } from './dati-finti'

function statoIniziale(): { c: Contesto; t: SezioneSpese; filtri: boolean; dati: StatoDati<DatiSpese> } {
  const q = new URLSearchParams(window.location.search)
  const c: Contesto = q.get('c') === 'ania' ? 'ania' : 'mia'
  const t = (['panoramica', 'movimenti', 'documenti', 'analisi'].includes(q.get('t') || '')
    ? q.get('t') : 'panoramica') as SezioneSpese
  const dati: StatoDati<DatiSpese> =
    q.get('stato') === 'caricamento' ? { stato: 'caricamento' }
      : q.get('stato') === 'errore' ? { stato: 'errore', messaggio: 'Il telefono era senza rete mentre chiedevo i movimenti.' }
        : { stato: 'pronto', dati: q.get('stato') === 'vuoto' ? DATI_QUASI_VUOTI : DATI_FINTI }
  return { c, t, filtri: q.get('filtri') === '1', dati }
}

export default function Prova() {
  const [{ c, t, filtri, dati }] = useState(statoIniziale)
  const [scelta, setScelta] = useState<string | null>(null)
  return (
    <>
      {/* barretta della PROVA (non fa parte del prodotto) */}
      <div className="flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold tracking-wide"
        style={{ background: '#141E19', color: '#F6F6F3' }}>
        PROVA · guscio reale (Fase 3.1) · dati finti · direzione B
      </div>
      <SpeseShell dati={dati} contestoIniziale={c} sezioneIniziale={t} filtriApertiIniziale={filtri}
        riprova={() => window.location.reload()}
        aggiungi={v => setScelta(v)}
        notaAggiungi="in questa prova non si registra nulla: l'inserimento vero arriva con le fasi 4-5" />
      {scelta && (
        <div className="fixed inset-x-4 z-[70] bottom-[calc(env(safe-area-inset-bottom)+16px)] max-w-md mx-auto px-4 py-3 text-[13px] font-semibold text-center"
          style={{ background: '#141E19', color: '#F6F6F3', borderRadius: '0.75rem' }}
          onClick={() => setScelta(null)} role="status">
          «{scelta}» qui non fa ancora nulla: nella versione vera richiamerà l&apos;inserimento esistente
        </div>
      )}
    </>
  )
}
