'use client'
// ============================================================================
// PAGINA UFFICIALE del nuovo modulo spese (3.2B → 3.2B.1) — /spese (Casa
// Ania) e /spese-famiglia (Casa Mia). L'AMBITO OPERATIVO È UNICO per pagina:
// il selettore in alto NAVIGA all'altra route, così schermata, inserimento,
// caricamento, analisi e budget riguardano sempre l'ambito mostrato.
// Le scritture passano da lib/spese/scrittura* (errori veri, righe contate),
// separate dalla preview in sola lettura. Dietro login e DemoGate.
// ============================================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import DemoGate from '@/components/DemoGate'
import { isDemoMode } from '@/lib/demoMode'
import { SpeseShell } from './SpeseShell'
import { AnalisiOperativa } from './AnalisiOperativa'
import { ModuloSpesa } from './ModuloSpesa'
import { BudgetSheet } from './BudgetSheet'
import { FotoSheet, type PaginaFoto } from './FotoSheet'
import { CaricaFotoSheet, type VoceUI } from './CaricaFotoSheet'
import { RevisioneSheet } from './RevisioneSheet'
import { costruisciDatiSpese, oggiARoma } from '@/lib/spese/adattatore'
import { leggiTutto, urlFirmato, type FonteCompleta } from '@/lib/spese/fonte'
import { clienteSupabase } from '@/lib/spese/scritturaSupabase'
import { clienteRevisioneSupabase } from '@/lib/spese/revisioneSupabase'
import { depositoRevisioneLocale } from '@/lib/spese/revisioneDurevole'
import type { BozzaGrezza, RigaGrezza } from '@/lib/spese/revisione'
import {
  aggiornaBudgetEsistente, creaGuardiaInvio,
  eliminaBudgetEsistente, eliminaSpesaManuale, salvaBudgetNuovo,
  salvaSpesaManuale, type SpesaManualeInput,
} from '@/lib/spese/scrittura'
// il caricamento passa dal flusso IDEMPOTENTE collaudato (0022): nessun
// secondo percorso di registrazione
import { clienteIdempotenteSupabase } from '@/lib/spese/registrazioneSupabase'
import { creaControllore, depositoLocale } from '@/lib/spese/ripresaDurevole'
import {
  conFileRiselezionato, nuoveVociPagina, rimovibilePagina, salvaCodaPagina,
  vociDaPendenti,
} from '@/lib/spese/codaPagina'
import { filtraPerAmbito } from '@/lib/spese/ambito'
import type { RisolutoriVoce, ItemEsteso } from '@/lib/spese/voci'
import type { Ambito, Fx } from '@/lib/spese/types'
import type { Contesto, DatiSpese, StatoDati } from '@/lib/spese/vista'
import type { VoceAggiungi } from './AggiungiSheet'

// il selettore di file, come promessa di File[] (selezione MULTIPLA)
function scegliFiles(accetta: string, fotocamera: boolean): Promise<File[]> {
  return new Promise(risolvi => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accetta
    input.multiple = !fotocamera
    if (fotocamera) input.setAttribute('capture', 'environment')
    input.onchange = () => risolvi(Array.from(input.files ?? []))
    input.oncancel = () => risolvi([])
    input.click()
  })
}

// la custodia locale degli originali della revisione (localStorage,
// valutato solo al momento dell'uso: sicuro anche a livello di modulo)
const depositoRevisione = depositoRevisioneLocale()

export default function SpesePagina({ ambito }: { ambito: Ambito }) {
  return <DemoGate><Pagina ambito={ambito} /></DemoGate>
}

function Pagina({ ambito }: { ambito: Ambito }) {
  const router = useRouter()
  const [fonte, setFonte] = useState<FonteCompleta | null>(null)
  const [dati, setDati] = useState<StatoDati<DatiSpese>>({ stato: 'caricamento' })
  const [tentativo, setTentativo] = useState(0)

  // fogli aperti
  const [moduloAperto, setModuloAperto] = useState(false)
  const [budgetAperto, setBudgetAperto] = useState(false)
  const [foto, setFoto] = useState<{ titolo: string; pagine: PaginaFoto[] } | null>(null)
  const [revisioneId, setRevisioneId] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)

  // ---- coda di caricamento: flusso IDEMPOTENTE (0022) -------------------
  // La coda vive nella PAGINA; le operazioni PENDENTI del deposito durevole
  // (localStorage) riappaiono anche dopo chiusura del foglio, navigazione e
  // ricaricamento, con ambito/token/manifesto originali. Il ciclo lavora
  // sullo stato vivo per identificativi (lib/spese/codaPagina).
  const [coda, setCodaStato] = useState<VoceUI[]>([])
  const codaRef = useRef<VoceUI[]>([])
  const setCoda = useCallback((aggiorna: (c: VoceUI[]) => VoceUI[]) => {
    setCodaStato(prev => { codaRef.current = aggiorna(prev); return codaRef.current })
  }, [])
  const [fogliocaricaAperto, setFoglioCaricaAperto] = useState(false)
  const [notaCoda, setNotaCoda] = useState('')
  const [salvandoCoda, setSalvandoCoda] = useState(false)
  const [depositoErrore, setDepositoErrore] = useState<string | null>(null)
  const guardiaCoda = useRef(creaGuardiaInvio())
  const controllore = useMemo(() => creaControllore(clienteIdempotenteSupabase, depositoLocale()), [])

  // le operazioni rimaste in sospeso: caricate all'apertura della pagina
  // (in demo NON si contatta nulla: il deposito è locale, ma per pulizia
  // si salta tutto)
  useEffect(() => {
    if (isDemoMode()) return
    let vivo = true
    controllore.pendenti().then(lettura => {
      if (!vivo) return
      setDepositoErrore(lettura.errore ?? null)
      if (lettura.riprese.length) {
        setCoda(prev => {
          const gia = new Set(prev.map(v => v.id))
          return [...prev, ...vociDaPendenti(lettura.riprese).filter(v => !gia.has(v.id))]
        })
        setAvviso(`${lettura.riprese.length === 1 ? 'c\'è 1 caricamento in sospeso' : `ci sono ${lettura.riprese.length} caricamenti in sospeso`}: tocca ＋ per riprenderli`)
      }
    })
    return () => { vivo = false }
  }, [controllore, setCoda])

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
      // expense_nature PREVALE; il vecchio flag recurring è solo un ripiego
      // per lo storico che non ha ancora la natura
      recurring: s.expense_nature != null ? s.expense_nature === 'ricorrente' : !!s.recurring,
      source: s.source ?? '',
    })) as Fx[]
    return filtraPerAmbito(ambito, fonte.gruppi as never, fonte.categorie as never, fonte.regole, spese)
  }, [fonte, ambito])
  const items = (fonte?.righe ?? []) as unknown as ItemEsteso[]
  const negozi = useMemo(
    () => [...new Set((mio?.expenses ?? []).map(r => r.store).filter(Boolean))] as string[],
    [mio])
  const camereAttive = useMemo(
    () => (fonte?.camere ?? []).filter(c => c.active !== false),
    [fonte])

  // gli STESSI nomi e ripieghi dell'adattatore, per le voci delle analisi
  const risolutori = useMemo<RisolutoriVoce | null>(() => {
    if (!fonte) return null
    const gruppoDi = new Map(fonte.gruppi.map(g => [g.id, g.name]))
    const categoriaDi = new Map(fonte.categorie.map(c => [c.id, c.name]))
    const canonicaDi = new Map(fonte.categorieCanoniche.map(c => [c.id, c.name]))
    const sottoCanonicaDi = new Map(fonte.sottocategorieCanoniche.map(c => [c.id, c.name]))
    return {
      gruppo: id => (id ? gruppoDi.get(id) : undefined) ?? '—',
      categoria: (riga, madre) =>
        (riga.canonical_category_id ? canonicaDi.get(riga.canonical_category_id) : undefined)
          ?? (riga.category_id ? categoriaDi.get(riga.category_id) : undefined)
          ?? (madre.canonical_category_id ? canonicaDi.get(madre.canonical_category_id) : undefined)
          ?? (madre.category_id ? categoriaDi.get(madre.category_id) : undefined)
          ?? 'Senza categoria',
      sottocategoria: (riga, madre) =>
        (riga.canonical_subcategory_id ? sottoCanonicaDi.get(riga.canonical_subcategory_id) : undefined)
          ?? riga.subcategory
          ?? (madre.canonical_subcategory_id ? sottoCanonicaDi.get(madre.canonical_subcategory_id) : undefined)
          ?? madre.subcategory ?? '',
    }
  }, [fonte])

  // ---- foto: apertura di un documento esistente (mime incluso, per i PDF) ----
  const apriFoto = useCallback((documentId: string) => {
    if (!fonte) return
    const pagine = fonte.ricevute
      .filter(r => r.document_id === documentId && r.storage_path)
      .map(r => ({ id: r.id, storage_path: r.storage_path!, page_order: r.page_order ?? 1, tipo: r.mime_type }))
    if (pagine.length === 0) { setAvviso('Questo documento non ha fotografie.'); return }
    const doc = fonte.documenti.find(d => d.id === documentId)
    setFoto({ titolo: doc?.supplier || 'Documento', pagine })
  }, [fonte])

  // ---- ＋: le quattro strade ----
  const accoda = useCallback((files: File[]) => {
    if (files.length === 0 && codaRef.current.length === 0) return
    setCoda(prev => [...prev, ...nuoveVociPagina(
      files.map(f => ({ file: f, nome: f.name, tipo: f.type })),
      ambito, () => crypto.randomUUID(),
    ).map(v => ({ ...v, url: URL.createObjectURL(v.file as File) }))])
    // si riapre anche a mani vuote se c'è una coda in sospeso da riprendere
    setFoglioCaricaAperto(true)
  }, [ambito, setCoda])
  const aggiungi = useCallback(async (voce: VoceAggiungi) => {
    if (voce === 'manuale') { setModuloAperto(true); return }
    const accetta = voce === 'documento' ? 'image/*,application/pdf' : 'image/*'
    accoda(await scegliFiles(accetta, voce === 'scatta'))
  }, [accoda])

  const salvaTutteLeFoto = useCallback(() => guardiaCoda.current(async () => {
    setSalvandoCoda(true)
    try {
      const { salvate } = await salvaCodaPagina(
        () => codaRef.current, setCoda, controllore, notaCoda.trim() || null)
      if (salvate > 0) ricarica()
      if (codaRef.current.length > 0 && codaRef.current.every(v => v.stato === 'salvata'))
        setTimeout(() => setFoglioCaricaAperto(false), 900)
    } finally { setSalvandoCoda(false) }
  }), [controllore, notaCoda, ricarica, setCoda])

  // riselezione del file per una voce che lo chiede (o per un ritentativo
  // con i byte in mano): il flusso riconfronta l'impronta originale
  const riseleziona = useCallback(async (id: string) => {
    const [f] = await scegliFiles('image/*,application/pdf', false)
    if (!f) return
    setCoda(prev => prev.map(v => {
      if (v.id !== id) return v
      const nuova = conFileRiselezionato(v, f, f.name, f.type) as VoceUI
      if (v.url) URL.revokeObjectURL(v.url)
      return { ...nuova, url: URL.createObjectURL(f) }
    }))
  }, [setCoda])

  const chiudiFoglioCarica = useCallback(() => {
    // salvate e doppioni chiusi escono di scena; TUTTO il resto resta in
    // coda (le operazioni con traccia nel deposito sopravvivono comunque
    // anche al ricaricamento della pagina)
    setCoda(prev => {
      const resta = prev.filter(v => v.stato !== 'salvata' && v.stato !== 'duplicato')
      prev.filter(v => !resta.includes(v)).forEach(v => { if (v.url) URL.revokeObjectURL(v.url) })
      return resta
    })
    setFoglioCaricaAperto(false)
    const rimaste = codaRef.current.length
    if (rimaste > 0) setAvviso(`${rimaste === 1 ? '1 caricamento è ancora in sospeso: lo ritrovi' : `${rimaste} caricamenti sono ancora in sospeso: li ritrovi`} toccando ＋`)
  }, [setCoda])

  // ---- scritture (errori veri: mai successi simulati) ----
  const salvaManuale = useCallback(async (input: SpesaManualeInput) => {
    const esito = await salvaSpesaManuale(clienteSupabase, input, ambito)
    if (esito.ok) ricarica()
    return esito
  }, [ambito, ricarica])

  const eliminaSpesa = useCallback(async (expenseId: string) => {
    if (!confirm('Eliminare questa spesa manuale?')) return
    const esito = await eliminaSpesaManuale(clienteSupabase, expenseId)
    if (!esito.ok) { setAvviso(esito.errore); return }
    ricarica()
  }, [ricarica])

  const contesto: Contesto = ambito === 'azienda' ? 'ania' : 'mia'
  const budgets = useMemo(() => (fonte?.budget ?? [])
    .filter((b): b is typeof b & { id: string } => !!b.id && (b.ambito || 'personale') === ambito)
    .map(b => ({ id: b.id, ambito: b.ambito, category_name: b.category_name, monthly_amount: Number(b.monthly_amount) })),
  [fonte, ambito])
  const categorieBudget = useMemo(() => {
    if (!mio) return []
    return [...new Set(mio.cats.map(c => c.name))].sort()
  }, [mio])

  return (
    <>
      <SpeseShell dati={dati} contestoIniziale={contesto} riprova={ricarica}
        aggiungi={aggiungi}
        inSospeso={coda.filter(v => v.op).length}
        riprendiCaricamenti={() => setFoglioCaricaAperto(true)}
        apriRevisione={id => {
          const attive = fonte?.bozze.some(b => b.document_id === id && (b.status === 'da_controllare' || b.status === 'pronta'))
          if (attive) setRevisioneId(id)
          else setAvviso('Questo documento non ha ancora bozze da rivedere: prima va letto.')
        }}
        apriFoto={apriFoto}
        eliminaSpesa={eliminaSpesa}
        gestisciBudget={() => setBudgetAperto(true)}
        // il selettore NAVIGA: una pagina = un ambito, sempre coerente
        cambiaContesto={c => {
          if (c !== contesto) router.push(c === 'ania' ? '/spese' : '/spese-famiglia')
        }}
        analisiOperativa={() => (mio && risolutori ? (
          <AnalisiOperativa ambito={ambito} spese={mio.expenses} items={items}
            groups={mio.groups} cats={mio.cats} subcats={fonte?.sottocategorieLegacy ?? []}
            risolutori={risolutori}
            apriFoto={id => {
              const ric = fonte?.ricevute.find(r => r.id === id)
              if (ric?.document_id) apriFoto(ric.document_id)
              else if (ric?.storage_path) setFoto({ titolo: 'Scontrino', pagine: [{ id: ric.id, storage_path: ric.storage_path, page_order: 1, tipo: ric.mime_type }] })
              else setAvviso('Foto non trovata.')
            }} />
        ) : null)} />

      {moduloAperto && fonte && mio && (
        <ModuloSpesa ambito={ambito} oggi={oggiARoma()}
          groups={mio.groups} cats={mio.cats} subcats={fonte.sottocategorieLegacy}
          camere={camereAttive} negozi={negozi} regole={mio.rules}
          salva={salvaManuale} chiudi={() => setModuloAperto(false)} />
      )}
      {budgetAperto && fonte && (
        <BudgetSheet ambito={ambito}
          budgets={budgets} categorie={categorieBudget}
          salva={async (categoria, importo) => {
            const e = await salvaBudgetNuovo(clienteSupabase, ambito, categoria, importo)
            if (e.ok) ricarica()
            return e.ok ? {} : { errore: e.errore }
          }}
          aggiorna={async (id, importo) => {
            const e = await aggiornaBudgetEsistente(clienteSupabase, id, importo)
            if (e.ok) ricarica()
            return e.ok ? {} : { errore: e.errore }
          }}
          elimina={async id => {
            const e = await eliminaBudgetEsistente(clienteSupabase, id)
            if (e.ok) ricarica()
            return e.ok ? {} : { errore: e.errore }
          }}
          chiudi={() => setBudgetAperto(false)} />
      )}
      {foto && (
        <FotoSheet titolo={foto.titolo} pagine={foto.pagine} firmaUrl={urlFirmato}
          chiudi={() => setFoto(null)} />
      )}
      {revisioneId && fonte && (() => {
        const doc = fonte.documenti.find(d => d.id === revisioneId)
        const bozzeDoc = fonte.bozze.filter(b => b.document_id === revisioneId) as unknown as BozzaGrezza[]
        if (!doc || bozzeDoc.every(b => b.status !== 'da_controllare' && b.status !== 'pronta')) return null
        const idBozze = new Set(bozzeDoc.map(b => b.id))
        return (
          <RevisioneSheet
            documento={{ id: doc.id, supplier: doc.supplier, kind: doc.kind, status: doc.status, doc_total: doc.doc_total == null ? null : Number(doc.doc_total), note: doc.note }}
            bozze={bozzeDoc}
            righe={fonte.righeBozza.filter(r => idBozze.has(r.draft_id)) as unknown as RigaGrezza[]}
            gruppi={fonte.gruppi}
            categorie={fonte.categorie as { id: string; name: string; group_id: string }[]}
            canoniche={fonte.categorieCanoniche}
            sottoCanoniche={fonte.sottocategorieCanoniche}
            camere={camereAttive}
            pagine={fonte.ricevute
              .filter(r => r.document_id === revisioneId && r.storage_path)
              .map(r => ({ id: r.id, storage_path: r.storage_path!, page_order: r.page_order ?? 1, tipo: r.mime_type }))}
            firmaUrl={urlFirmato}
            cliente={clienteRevisioneSupabase}
            deposito={depositoRevisione}
            fatto={esito => {
              if (esito === 'confermato') { setRevisioneId(null); setAvviso('Documento confermato: le spese sono nel conto.') }
              if (esito === 'scartato') { setRevisioneId(null); setAvviso('Documento scartato.') }
              if (esito === 'salvato') setAvviso('Modifiche salvate.')
              if (esito === 'verifica') { setRevisioneId(null); setAvviso('Ricontrolla il documento: quello che era arrivato è qui, le tue modifiche sono custodite.') }
              ricarica()
            }}
            chiudi={() => setRevisioneId(null)} />
        )
      })()}
      {fogliocaricaAperto && (
        <CaricaFotoSheet ambito={ambito} coda={coda}
          salvando={salvandoCoda} nota={notaCoda} setNota={setNotaCoda}
          depositoErrore={depositoErrore}
          togli={id => setCoda(prev => {
            const via = prev.find(v => v.id === id)
            if (!via || !rimovibilePagina(via)) return prev
            if (via.url) URL.revokeObjectURL(via.url)
            return prev.filter(v => v.id !== id)
          })}
          riseleziona={riseleziona}
          aggiungiAltri={async () => accoda(await scegliFiles('image/*,application/pdf', false))}
          salvaTutte={salvaTutteLeFoto}
          chiudi={chiudiFoglioCarica} />
      )}

      {avviso && (
        <div className="fixed inset-x-4 z-[70] bottom-[calc(env(safe-area-inset-bottom)+16px)] max-w-md mx-auto px-4 py-3 text-[13px] font-semibold text-center"
          style={{ background: '#141E19', color: '#F6F6F3', borderRadius: '0.75rem' }}
          onClick={() => setAvviso(null)} role="status">
          {avviso}
        </div>
      )}

    </>
  )
}
