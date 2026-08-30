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
import { ModuloSpesa } from '@/components/spese/ModuloSpesa'
import type { ClienteScrittura } from '@/lib/spese/scrittura'
import { salvaSpesaManuale, type SpesaManualeInput } from '@/lib/spese/scrittura'
import type { Contesto, DatiSpese, StatoDati } from '@/lib/spese/vista'
import { DATI_FINTI, DATI_QUASI_VUOTI, OGGI_FINTO, TABELLE_FINTE } from './dati-finti'

// cliente FINTO in memoria: per provare salvataggi, errori e doppio clic
// senza toccare nulla di vero (?scrittura=errore simula il fallimento)
function clienteFinto(fallisci: boolean): ClienteScrittura {
  const nega = async () => fallisci ? { errore: 'connessione assente (simulata)' } : {}
  return {
    inserisciSpesa: nega,
    caricaFile: nega,
    rimuoviFile: async () => {},
    creaDocumento: async () => fallisci ? { errore: 'connessione assente (simulata)' } : { id: 'doc-finto' },
    creaRicevuta: nega,
  }
}

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
  const [moduloAperto, setModuloAperto] = useState(false)
  const scritturaFallisce = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('scrittura') === 'errore'
  return (
    <>
      <SpeseShell dati={dati} contestoIniziale={c} sezioneIniziale={t} filtriApertiIniziale={filtri}
        riprova={() => window.location.reload()}
        aggiungi={v => { if (v === 'manuale') setModuloAperto(true); else setScelta(v) }}
        notaAggiungi="in questa prova non si registra nulla: l'inserimento vero arriva con le fasi 4-5"
        sopra={
          <div className="flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold tracking-wide"
            style={{ background: '#141E19', color: '#F6F6F3' }}>
            PROVA · guscio reale · dati finti · direzione B
          </div>
        } />
      {moduloAperto && (
        <ModuloSpesa ambito={c === 'ania' ? 'azienda' : 'personale'} oggi={OGGI_FINTO}
          groups={TABELLE_FINTE.gruppi.filter(g => (g.ambito === 'azienda') === (c === 'ania'))
            .map(g => ({ ...g, emoji: null, sort: 0, ambito: g.ambito ?? 'personale' }))}
          cats={TABELLE_FINTE.categorie.map(x => ({ id: x.id, name: x.name, group_id: x.group_id ?? '', sort: 0 }))}
          subcats={[]} camere={TABELLE_FINTE.camere} negozi={['Esselunga', 'Iper']}
          regole={[]}
          salva={async (input: SpesaManualeInput) =>
            salvaSpesaManuale(clienteFinto(scritturaFallisce), input, c === 'ania' ? 'azienda' : 'personale')}
          chiudi={() => setModuloAperto(false)} />
      )}
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
