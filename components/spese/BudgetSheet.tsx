'use client'
// Gestione dei budget mensili (3.2B): trasferita dal vecchio Home, stesse
// scritture (lib/spese/dati.ts: upsert/aggiorna/elimina su family_budgets).
// Un errore non chiude il foglio e non cancella l'importo scritto.
import { useRef, useState } from 'react'
import { TEMA as t, DISPLAY } from './tema'
import { Chip, Etichetta, Foglio } from './mattoni'
import { eur2 } from '@/lib/spese/costanti'
import { creaGuardiaInvio, importoDaTesto, testoDaImporto } from '@/lib/spese/scrittura'
import type { Ambito, Budget } from '@/lib/spese/types'

export function BudgetSheet({ ambito, budgets, categorie, salva, aggiorna, elimina, chiudi }: {
  ambito: Ambito
  budgets: Budget[]
  categorie: string[]           // nomi categoria dell'ambito
  salva: (categoria: string, importo: number) => Promise<{ errore?: string }>
  aggiorna: (id: string, importo: number) => Promise<{ errore?: string }>
  elimina: (id: string) => Promise<{ errore?: string }>
  chiudi: () => void
}) {
  const accento = ambito === 'azienda' ? t.terracotta : t.verde
  const [categoria, setCategoria] = useState('')
  const [importo, setImporto] = useState('')
  const [modifiche, setModifiche] = useState<Record<string, string>>({})
  const [lavoro, setLavoro] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const guardia = useRef(creaGuardiaInvio())

  // la stessa guardia condivisa contro il doppio invio (lib/spese/scrittura)
  const esegui = (azione: () => Promise<{ errore?: string }>) => guardia.current(async () => {
    setErrore(null); setLavoro(true)
    try {
      const r = await azione()
      if (r.errore) { setErrore(r.errore); return false }
      return true
    } finally { setLavoro(false) }
  })

  return (
    <Foglio aria="Budget mensili" chiudi={chiudi} scorrevole>
      <p className={`${DISPLAY} text-[19px] mb-3`} style={{ color: t.inchiostro }}>Budget mensili</p>
      {errore && (
        <div className="mb-3 px-3 py-2 text-[13px] font-semibold" role="alert"
          style={{ background: t.terraTenue, color: t.rosso, borderRadius: t.r }}>{errore}</div>
      )}

      {budgets.length > 0 && (
        <div className="mb-4">
          <Etichetta>Quelli attivi</Etichetta>
          {budgets.map(b => (
            <div key={b.id} className="flex items-center gap-2 min-h-11">
              <span className="flex-1 text-[13.5px] truncate" style={{ color: t.inchiostro }}>{b.category_name}</span>
              <input inputMode="decimal" value={modifiche[b.id] ?? testoDaImporto(b.monthly_amount)}
                onChange={e => setModifiche(m => ({ ...m, [b.id]: e.target.value }))}
                className="w-24 min-h-10 px-2 text-[14px] text-right tabular-nums outline-none"
                style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
              <button disabled={lavoro} onClick={async () => {
                const n = importoDaTesto(modifiche[b.id] ?? testoDaImporto(b.monthly_amount))
                if (n === null) { setErrore('l\'importo deve essere un numero sopra lo zero'); return }
                await esegui(() => aggiorna(b.id, n))
              }} className="min-h-10 px-2 text-[12.5px] font-bold" style={{ color: accento }}>Salva</button>
              <button disabled={lavoro} onClick={() => esegui(() => elimina(b.id))}
                className="min-h-10 px-2 text-[12.5px] font-bold" style={{ color: t.rosso }}>Togli</button>
            </div>
          ))}
        </div>
      )}

      <Etichetta>Nuovo budget</Etichetta>
      <div className="flex gap-1.5 flex-wrap mb-2">
        {categorie.map(c => (
          <Chip key={c} attivo={categoria === c} colore={accento} onClick={() => setCategoria(c)}>{c}</Chip>
        ))}
      </div>
      <div className="flex gap-2 items-center mb-4">
        <input inputMode="decimal" placeholder="importo mensile (€)" value={importo}
          onChange={e => setImporto(e.target.value)}
          className="flex-1 min-h-11 px-3 text-[14px] outline-none tabular-nums"
          style={{ background: t.carta, border: t.bordoCarta, borderRadius: t.rPill, color: t.inchiostro }} />
        <button disabled={lavoro} onClick={async () => {
          const n = importoDaTesto(importo)
          if (!categoria) { setErrore('scegli la categoria'); return }
          if (n === null) { setErrore('l\'importo deve essere un numero sopra lo zero'); return }
          if (await esegui(() => salva(categoria, n))) { setCategoria(''); setImporto('') }
        }} className="min-h-11 px-4 text-[14px] font-bold text-white disabled:opacity-60"
          style={{ background: accento, borderRadius: t.rPill }}>
          {lavoro ? '…' : 'Aggiungi'}
        </button>
      </div>
      {budgets.length > 0 && (
        <p className="text-[11.5px] mb-2" style={{ color: t.sub }}>
          totale dei budget: {eur2(budgets.reduce((s, b) => s + Number(b.monthly_amount), 0))} al mese
        </p>
      )}
    </Foglio>
  )
}
