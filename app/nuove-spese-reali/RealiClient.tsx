'use client'
// Prova del guscio sui DATI REALI (3.2A → 3.2A.1): legge le tabelle con il
// client del browser (chiave anon + sessione vera, RLS) e costruisce
// DatiSpese con lo stesso adattatore puro dei test. SOLO SELECT, con
// paginazione DETERMINISTICA (ordinamento esplicito per id). In sviluppo
// espone window.__datiSpese per le verifiche.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { SpeseShell } from '@/components/spese/SpeseShell'
import { costruisciDatiSpese, oggiARoma, type TabelleGrezze } from '@/lib/spese/adattatore'
import type { DatiSpese, StatoDati } from '@/lib/spese/vista'

async function tutta<T>(tabella: string, colonne: string, filtro?: Record<string, unknown>): Promise<T[]> {
  const righe: T[] = []
  for (let da = 0; ; da += 1000) {
    let q = supabase.from(tabella).select(colonne)
    for (const [k, v] of Object.entries(filtro ?? {})) q = q.eq(k, v)
    // ordinamento ESPLICITO: la paginazione oltre le 1.000 righe non deve
    // dipendere dall'ordine implicito di Postgres
    const { data, error } = await q.order('id', { ascending: true }).range(da, da + 999)
    if (error) throw new Error(`${tabella}: ${error.message}`)
    righe.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return righe
}

async function leggiTabelle(): Promise<TabelleGrezze> {
  const [documenti, ponte, spese, righe, ricevute, bozze, righeBozza,
    gruppi, categorie, categorieCanoniche, sottocategorieCanoniche, camere, budget] = await Promise.all([
    tutta<TabelleGrezze['documenti'][0]>('family_documents',
      'id, kind, status, doc_total, supplier, invoice_number, document_date, due_date, upload_ambito, error_message, note, doc_total_derivato, created_at'),
    tutta<TabelleGrezze['ponte'][0]>('family_expense_documents', 'id, expense_id, document_id'),
    tutta<TabelleGrezze['spese'][0]>('family_expenses',
      'id, amount, expense_date, group_id, category_id, subcategory, description, store, product, receipt_id, payment_method, paid_at, room_id, canonical_category_id, canonical_subcategory_id, expense_nature'),
    tutta<TabelleGrezze['righe'][0]>('family_expense_items',
      'id, expense_id, name, amount, category_id, subcategory, qty, unit_price, discount, group_id, canonical_category_id, canonical_subcategory_id, necessity, planning, is_adjustment'),
    tutta<TabelleGrezze['ricevute'][0]>('family_receipts', 'id, document_id'),
    tutta<TabelleGrezze['bozze'][0]>('family_draft_expenses',
      'id, document_id, status, expense_date, group_id, category_id, subcategory, canonical_category_id, canonical_subcategory_id, store, description, payment_method, room_id, expense_nature, confidence, arrotondamento_cent, expense_id'),
    tutta<TabelleGrezze['righeBozza'][0]>('family_draft_items',
      'id, draft_id, raw_name, name, qty, unit_price, discount, amount, group_id, category_id, subcategory, canonical_category_id, canonical_subcategory_id, necessity, planning, confidence, excluded, user_added'),
    tutta<TabelleGrezze['gruppi'][0]>('family_groups', 'id, name, ambito'),
    tutta<TabelleGrezze['categorie'][0]>('family_categories', 'id, name'),
    tutta<TabelleGrezze['categorieCanoniche'][0]>('family_canonical_categories', 'id, name'),
    tutta<TabelleGrezze['sottocategorieCanoniche'][0]>('family_canonical_subcategories', 'id, name'),
    tutta<TabelleGrezze['camere'][0]>('rooms', 'id, name, active'),  // TUTTE: le archiviate risolvono lo storico
    tutta<NonNullable<TabelleGrezze['budget']>[0]>('family_budgets', 'id, ambito, category_name, monthly_amount'),
  ])
  return {
    documenti, ponte, spese, righe, ricevute, bozze, righeBozza,
    gruppi, categorie, categorieCanoniche, sottocategorieCanoniche, camere, budget,
  }
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
          PROVA · DATI REALI in sola lettura (3.2A) · le pagine ufficiali restano Spese e Spese Famiglia
        </div>
      } />
  )
}
