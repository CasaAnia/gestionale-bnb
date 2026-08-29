'use client'
// Prova del guscio sui DATI REALI (3.2A): legge le tabelle con il client del
// browser (chiave anon + sessione vera, RLS) e costruisce DatiSpese con lo
// stesso adattatore puro dei test. SOLO SELECT: qui non esiste alcuna
// scrittura. In sviluppo espone window.__datiSpese per le verifiche.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SpeseShell } from '@/components/spese/SpeseShell'
import { costruisciDatiSpese, type TabelleGrezze } from '@/lib/spese/adattatore'
import type { DatiSpese, StatoDati } from '@/lib/spese/vista'

async function tutta<T>(tabella: string, colonne: string, filtro?: Record<string, unknown>): Promise<T[]> {
  const righe: T[] = []
  for (let da = 0; ; da += 1000) {
    let q = supabase.from(tabella).select(colonne)
    for (const [k, v] of Object.entries(filtro ?? {})) q = q.eq(k, v)
    const { data, error } = await q.range(da, da + 999)
    if (error) throw new Error(`${tabella}: ${error.message}`)
    righe.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return righe
}

async function leggiTabelle(): Promise<TabelleGrezze> {
  const [documenti, ponte, spese, righe, ricevute, bozze, gruppi, categorie, camere, budget] = await Promise.all([
    tutta<TabelleGrezze['documenti'][0]>('family_documents', 'id, kind, status, doc_total, supplier, document_date, due_date, upload_ambito, error_message, note, created_at'),
    tutta<TabelleGrezze['ponte'][0]>('family_expense_documents', 'expense_id, document_id'),
    tutta<TabelleGrezze['spese'][0]>('family_expenses', 'id, amount, expense_date, group_id, category_id, subcategory, description, store, product, receipt_id, payment_method, paid_at, room_id'),
    tutta<TabelleGrezze['righe'][0]>('family_expense_items', 'id, expense_id, name, amount, category_id, subcategory'),
    tutta<TabelleGrezze['ricevute'][0]>('family_receipts', 'id, document_id'),
    tutta<TabelleGrezze['bozze'][0]>('family_draft_expenses', 'id, document_id, status'),
    tutta<TabelleGrezze['gruppi'][0]>('family_groups', 'id, name, ambito'),
    tutta<TabelleGrezze['categorie'][0]>('family_categories', 'id, name'),
    tutta<TabelleGrezze['camere'][0]>('rooms', 'id, name', { active: true }),
    tutta<NonNullable<TabelleGrezze['budget']>[0]>('family_budgets', 'ambito, category_name, monthly_amount'),
  ])
  return { documenti, ponte, spese, righe, ricevute, bozze, gruppi, categorie, camere, budget }
}

declare global {
  // solo per le verifiche in sviluppo: mai in produzione (route dev-only)
  interface Window { __datiSpese?: DatiSpese }
}

export default function RealiClient() {
  const [dati, setDati] = useState<StatoDati<DatiSpese>>({ stato: 'caricamento' })
  const [tentativo, setTentativo] = useState(0)

  useEffect(() => {
    let vivo = true
    leggiTabelle()
      .then(t => {
        if (!vivo) return
        const oggi = new Date().toISOString().slice(0, 10)
        const costruiti = costruisciDatiSpese(t, oggi)
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
    <>
      {/* barretta della PROVA (non fa parte del prodotto finale) */}
      <div className="flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold tracking-wide"
        style={{ background: '#141E19', color: '#F6F6F3' }}>
        PROVA · DATI REALI in sola lettura (Fase 3.2A) · le pagine ufficiali restano Spese e Spese Famiglia
      </div>
      <SpeseShell dati={dati} riprova={carica}
        notaAggiungi="in questa prova non si registra nulla: usa le pagine ufficiali per inserire" />
    </>
  )
}
