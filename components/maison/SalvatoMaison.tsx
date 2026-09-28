'use client'
// ============================================================================
// LA CONFERMA DI SALVATAGGIO (scelta B del riferimento del 28/09/2026, riga
// «Quando salvi»): dopo un salvataggio riuscito il foglio si sbianca, al
// centro compare il cerchio a filo d'ottone con la spunta, sotto «Salvato» e,
// in piccolo, cosa è stato salvato e l'ora; dopo 1,2 secondi il foglio si
// chiude da solo. Un solo componente per tutti i fogli (Arrivo, Pulizia,
// Pagamento, Rimanda/Salta, Segna pagato). Gli avvisi d'errore restano i loro.
// ============================================================================
import { useEffect, useRef } from 'react'
import { testoSalvato, DURATA_SALVATO_MS, SALVATO, CHIUSURA_DA_SOLA } from '@/lib/salvatoMaison'

export type Salvataggio = { cosa: string; quando: Date }

export default function SalvatoMaison({ salvato, onFine }: { salvato: Salvataggio; onFine: () => void }) {
  const fine = useRef(onFine)
  useEffect(() => { fine.current = onFine }, [onFine])
  useEffect(() => {
    const t = window.setTimeout(() => fine.current(), DURATA_SALVATO_MS)
    return () => window.clearTimeout(t)
  }, [salvato])
  return (
    <div className="mz-salvato conferma-in" role="status" aria-live="polite" data-salvato-maison>
      <div><i aria-hidden>✓</i>{SALVATO}<small>{testoSalvato(salvato.cosa, salvato.quando)}<br />{CHIUSURA_DA_SOLA}</small></div>
    </div>
  )
}
