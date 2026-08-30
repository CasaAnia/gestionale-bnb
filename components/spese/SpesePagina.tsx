'use client'
// ============================================================================
// PAGINA UFFICIALE del nuovo modulo spese (3.2B) — /spese (Casa Ania) e
// /spese-famiglia (Casa Mia). Una sola lettura (fonte) alimenta il guscio
// (via adattatore) e le analisi operative trasferite. Le scritture passano
// da lib/spese/scrittura* e sono SEPARATE dalla preview in sola lettura.
// Dietro il login vero (proxy) e la modalità dimostrazione (DemoGate).
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from 'react'
import DemoGate from '@/components/DemoGate'
import { isDemoMode } from '@/lib/demoMode'
import { SpeseShell } from './SpeseShell'
import { AnalisiOperativa } from './AnalisiOperativa'
import { ModuloSpesa } from './ModuloSpesa'
import { BudgetSheet } from './BudgetSheet'
import { FotoSheet, type PaginaFoto } from './FotoSheet'
import { costruisciDatiSpese, oggiARoma } from '@/lib/spese/adattatore'
import { leggiTutto, urlFirmato, type FonteCompleta } from '@/lib/spese/fonte'
import { clienteSupabase } from '@/lib/spese/scritturaSupabase'
import { caricaDocumentoConFoto, salvaSpesaManuale, sha256DiFile, type SpesaManualeInput } from '@/lib/spese/scrittura'
import * as vecchi from '@/lib/spese/dati'
import { filtraPerAmbito } from '@/lib/spese/ambito'
import type { Ambito, Fx, Item } from '@/lib/spese/types'
import type { Contesto, DatiSpese, StatoDati } from '@/lib/spese/vista'
import type { VoceAggiungi } from './AggiungiSheet'

export default function SpesePagina({ ambito }: { ambito: Ambito }) {
  return <DemoGate><Pagina ambito={ambito} /></DemoGate>
}

function Pagina({ ambito }: { ambito: Ambito }) {
  const [fonte, setFonte] = useState<FonteCompleta | null>(null)
  const [dati, setDati] = useState<StatoDati<DatiSpese>>({ stato: 'caricamento' })
  const [tentativo, setTentativo] = useState(0)

  // fogli aperti
  const [moduloAperto, setModuloAperto] = useState(false)
  const [budgetAperto, setBudgetAperto] = useState<Contesto | null>(null)
  const [foto, setFoto] = useState<{ titolo: string; pagine: PaginaFoto[] } | null>(null)
  const [caricamentoFoto, setCaricamentoFoto] = useState<string | null>(null) // messaggio di stato upload
  const [avviso, setAvviso] = useState<string | null>(null)

  useEffect(() => {
    if (isDemoMode()) return
    let vivo = true
    leggiTutto()
      .then(f => {
        if (!vivo) return
        setFonte(f)
        setDati({ stato: 'pronto', dati: costruisciDatiSpese(f, oggiARoma()) })
      })
      .catch(e => { if (vivo) setDati({ stato: 'errore', messaggio: String(e.message ?? e) }) })
    return () => { vivo = false }
  }, [tentativo])
  const ricarica = useCallback(() => {
    setDati({ stato: 'caricamento' })
    setTentativo(n => n + 1)
  }, [])

  // ---- dati del vecchio mondo per analisi operative e modulo manuale ----
  const mio = useMemo(() => {
    if (!fonte) return null
    const spese = fonte.spese.map(s => ({
      ...s,
      recurring: !!s.recurring || s.expense_nature === 'ricorrente',
      source: s.source ?? '',
    })) as Fx[]
    return filtraPerAmbito(ambito, fonte.gruppi as never, fonte.categorie as never, fonte.regole, spese)
  }, [fonte, ambito])
  const items = (fonte?.righe ?? []) as unknown as Item[]
  const negozi = useMemo(
    () => [...new Set((mio?.expenses ?? []).map(r => r.store).filter(Boolean))] as string[],
    [mio])
  const camereAttive = useMemo(
    () => (fonte?.camere ?? []).filter(c => c.active !== false),
    [fonte])

  // ---- foto: apertura di un documento esistente ----
  const apriFoto = useCallback((documentId: string) => {
    if (!fonte) return
    const pagine = fonte.ricevute
      .filter(r => r.document_id === documentId && r.storage_path)
      .map(r => ({ id: r.id, storage_path: r.storage_path!, page_order: r.page_order ?? 1 }))
    if (pagine.length === 0) { setAvviso('Questo documento non ha fotografie.'); return }
    const doc = fonte.documenti.find(d => d.id === documentId)
    setFoto({ titolo: doc?.supplier || 'Documento', pagine })
  }, [fonte])

  // ---- caricamento foto/documenti (fotocamera, libreria, file) ----
  const scegliFile = useCallback((accetta: string, fotocamera: boolean) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accetta
    if (fotocamera) input.setAttribute('capture', 'environment')
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      setCaricamentoFoto('Carico la foto…')
      const esito = await caricaDocumentoConFoto(clienteSupabase, {
        nomeFile: file.name, tipo: file.type, contenuto: file, sha256: await sha256DiFile(file),
      }, ambito, null, accetta.includes('pdf') ? 'altro' : 'scontrino')
      setCaricamentoFoto(null)
      if (!esito.ok) { setAvviso(esito.errore); return }
      setAvviso('Foto caricata: la trovi in Documenti, in coda per la lettura.')
      ricarica()
    }
    input.click()
  }, [ambito, ricarica])

  const aggiungi = useCallback((voce: VoceAggiungi) => {
    if (voce === 'manuale') setModuloAperto(true)
    else if (voce === 'scatta') scegliFile('image/*', true)
    else if (voce === 'libreria') scegliFile('image/*', false)
    else scegliFile('image/*,application/pdf', false)
  }, [scegliFile])

  // ---- scritture ----
  const salvaManuale = useCallback(async (input: SpesaManualeInput) => {
    const esito = await salvaSpesaManuale(clienteSupabase, input, ambito)
    if (esito.ok) ricarica()
    return esito
  }, [ambito, ricarica])

  const eliminaSpesa = useCallback(async (expenseId: string) => {
    if (!confirm('Eliminare questa spesa manuale?')) return
    await vecchi.eliminaSpesa(expenseId)
    ricarica()
  }, [ricarica])

  const contestoIniziale: Contesto = ambito === 'azienda' ? 'ania' : 'mia'
  const budgets = (fonte?.budget ?? []).filter((b): b is typeof b & { id: string } => !!b.id
    && (b.ambito || 'personale') === (budgetAperto === 'ania' ? 'azienda' : 'personale')) as import('@/lib/spese/types').Budget[]
  const categorieBudget = useMemo(() => {
    if (!fonte) return []
    const ambitoBudget = budgetAperto === 'ania' ? 'azienda' : 'personale'
    const gruppi = new Set(fonte.gruppi.filter(g => (g.ambito || 'personale') === ambitoBudget).map(g => g.id))
    return [...new Set(fonte.categorie.filter(c => c.group_id && gruppi.has(c.group_id)).map(c => c.name))].sort()
  }, [fonte, budgetAperto])

  return (
    <>
      <SpeseShell dati={dati} contestoIniziale={contestoIniziale} riprova={ricarica}
        aggiungi={aggiungi}
        apriFoto={apriFoto}
        eliminaSpesa={eliminaSpesa}
        gestisciBudget={c => setBudgetAperto(c)}
        analisiOperativa={c => (mio && (c === 'mia') === (ambito === 'personale') ? (
          <AnalisiOperativa ambito={ambito} spese={mio.expenses} items={items}
            groups={mio.groups} cats={mio.cats} subcats={fonte?.sottocategorieLegacy ?? []}
            apriFoto={async id => {
              // dal vecchio mondo arriva il receipt_id: risalgo al documento
              const ric = fonte?.ricevute.find(r => r.id === id)
              if (ric?.document_id) apriFoto(ric.document_id)
              else if (ric?.storage_path) setFoto({ titolo: 'Scontrino', pagine: [{ id: ric.id, storage_path: ric.storage_path, page_order: 1 }] })
            }} />
        ) : null)} />

      {moduloAperto && fonte && mio && (
        <ModuloSpesa ambito={ambito} oggi={oggiARoma()}
          groups={mio.groups} cats={mio.cats} subcats={fonte.sottocategorieLegacy}
          camere={camereAttive} negozi={negozi} regole={mio.rules}
          salva={salvaManuale} chiudi={() => setModuloAperto(false)} />
      )}
      {budgetAperto && fonte && (
        <BudgetSheet ambito={budgetAperto === 'ania' ? 'azienda' : 'personale'}
          budgets={budgets} categorie={categorieBudget}
          salva={async (categoria, importo) => {
            try { await vecchi.salvaBudget(budgetAperto === 'ania' ? 'azienda' : 'personale', categoria, importo); ricarica(); return {} }
            catch (e) { return { errore: String((e as Error).message ?? e) } }
          }}
          aggiorna={async (id, importo) => {
            try { await vecchi.aggiornaBudget(id, importo); ricarica(); return {} }
            catch (e) { return { errore: String((e as Error).message ?? e) } }
          }}
          elimina={async id => {
            try { await vecchi.eliminaBudget(id); ricarica(); return {} }
            catch (e) { return { errore: String((e as Error).message ?? e) } }
          }}
          chiudi={() => setBudgetAperto(null)} />
      )}
      {foto && (
        <FotoSheet titolo={foto.titolo} pagine={foto.pagine} firmaUrl={urlFirmato}
          chiudi={() => setFoto(null)} />
      )}

      {(caricamentoFoto || avviso) && (
        <div className="fixed inset-x-4 z-[70] bottom-[calc(env(safe-area-inset-bottom)+16px)] max-w-md mx-auto px-4 py-3 text-[13px] font-semibold text-center"
          style={{ background: '#141E19', color: '#F6F6F3', borderRadius: '0.75rem' }}
          onClick={() => setAvviso(null)} role="status">
          {caricamentoFoto ?? avviso}
        </div>
      )}
    </>
  )
}
