'use client'
// Prova del guscio sui DATI REALI in SOLA LETTURA (3.2A): stessa fonte e
// stesso adattatore delle pagine ufficiali, ma QUI niente scritture — la
// pagina non importa i moduli di scrittura (guardia nei test).
import { useCallback, useEffect, useState } from 'react'
import { SpeseShell } from '@/components/spese/SpeseShell'
import { costruisciDatiSpese, oggiARoma } from '@/lib/spese/adattatore'
import { leggiTutto } from '@/lib/spese/fonte'
import type { DatiSpese, StatoDati } from '@/lib/spese/vista'

declare global {
  // solo per le verifiche in sviluppo: mai in produzione (route dev-only)
  interface Window { __datiSpese?: DatiSpese }
}

export default function RealiClient() {
  const [dati, setDati] = useState<StatoDati<DatiSpese>>({ stato: 'caricamento' })
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let vivo = true
    leggiTutto()
      .then(t => {
        if (!vivo) return
        const costruiti = costruisciDatiSpese(t, oggiARoma())
        window.__datiSpese = costruiti
        setDati({ stato: 'pronto', dati: costruiti })
      })
      .catch(e => { if (vivo) setDati({ stato: 'errore', messaggio: String(e.message ?? e) }) })
    return () => { vivo = false }
  }, [tentativo])
  const carica = useCallback(() => {
    setDati({ stato: 'caricamento' })
    setTentativo(n => n + 1)
  }, [])

  return (
    <SpeseShell dati={dati} riprova={carica}
      notaAggiungi="in questa prova non si registra nulla: usa le pagine ufficiali per inserire"
      sopra={
        <div className="flex items-center justify-center gap-2 py-1.5 px-3 text-[11px] font-bold tracking-wide text-center"
          style={{ background: '#141E19', color: '#F6F6F3' }}>
          PROVA · DATI REALI in sola lettura (3.2A) · le pagine ufficiali sono Spese e Spese Famiglia
        </div>
      } />
  )
}
