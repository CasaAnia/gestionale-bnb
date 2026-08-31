'use client'
// Prova del guscio reale (Fase 3.1) con dati sintetici.
// Stato pilotabile dall'URL per le verifiche:
//   ?percorso=contratto → la revisione scrive col CONTRATTO collaudato
//                         sul suo server finto (senza rete)
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
import { RevisioneSheet } from '@/components/spese/RevisioneSheet'
import { CAMPI_RIGA_NUOVA, type BozzaGrezza, type RigaGrezza } from '@/lib/spese/revisione'
import type { ClienteRevisione } from '@/lib/spese/revisioneScrittura'
import { depositoRevisioneLocale } from '@/lib/spese/revisioneDurevole'
import { creaServerContratto, type MondoFinto } from '@/lib/spese/contrattoServerFinto'
import type { ClienteContratto } from '@/lib/spese/contrattoRevisione'
import { improntaSha256 } from '@/lib/spese/improntaTesto'
import { depositoOperazioniDurevole } from '@/lib/spese/depositoOperazioniDurevole'
import { ponteContrattoDurevole } from '@/lib/spese/ponteContratto'
import { orchestrazioneContratto, type OrchestrazioneRevisione } from '@/lib/spese/orchestrazioneRevisione'
import type { Contesto, DatiSpese, StatoDati } from '@/lib/spese/vista'
import { DATI_FINTI, DATI_QUASI_VUOTI, OGGI_FINTO, TABELLE_FINTE } from './dati-finti'

// cliente FINTO in memoria: per provare salvataggi, errori e doppio clic
// senza toccare nulla di vero (?scrittura=errore simula il fallimento)
function clienteFinto(fallisci: boolean): ClienteScrittura {
  const nega = async () => fallisci ? { errore: 'connessione assente (simulata)' } : {}
  return {
    inserisciSpesa: nega,
    eliminaSpesa: async () => fallisci ? { errore: 'connessione assente (simulata)' } : { righe: 1 },
    caricaFile: nega,
    rimuoviFile: nega,
    creaDocumento: async () => fallisci ? { errore: 'connessione assente (simulata)' } : { id: 'doc-finto' },
    creaRicevuta: nega,
    ricevutaEsiste: async () => ({ esiste: false }),
    ricevutaConSha: async () => ({ esiste: false }),
    salvaBudget: nega,
    aggiornaBudget: async () => fallisci ? { errore: 'connessione assente (simulata)' } : { righe: 1 },
    eliminaBudget: async () => fallisci ? { errore: 'connessione assente (simulata)' } : { righe: 1 },
  }
}

// ---- REVISIONE di prova: un ARCHIVIO FINTO che si comporta come il
// database vero (i Salva lo MUTANO: alla riapertura restituisce i valori
// corretti come farebbe Supabase — è la custodia locale a conservare gli
// originali). Modalità dall'URL:
//   ?scrittura=errore → il server RIFIUTA (quadratura simulata)
//   ?scrittura=rete   → errore RESTITUITO «Failed to fetch» (esito incerto)
//   ?scrittura=persa  → ECCEZIONE «Failed to fetch» (risposta persa)
//   ?scrittura=lenta  → risposte in 2,5 s (per vedere i controlli SPENTI)
type ArchivioRevisione = { docTotale: number | null; docStatus: string; bozze: BozzaGrezza[]; righe: RigaGrezza[]; contatore: number }

function clienteRevisioneFinto(modo: string | null, db: ArchivioRevisione): ClienteRevisione {
  const attesa = () => modo === 'lenta' ? new Promise(r => setTimeout(r, 2500)) : Promise.resolve()
  const guasto = () => {
    if (modo === 'persa') throw new Error('Failed to fetch (finto: risposta persa)')
    if (modo === 'rete') return { errore: 'Failed to fetch (finto: errore di rete restituito)' }
    if (modo === 'errore') return { errore: 'connessione assente (simulata)' }
    return null
  }
  return {
    async aggiornaDocTotale(_id, totale) {
      await attesa(); const g = guasto(); if (g) return g
      db.docTotale = totale; return { righe: 1 }
    },
    async aggiornaBozza(id, campi) {
      await attesa(); const g = guasto(); if (g) return g
      const b = db.bozze.find(x => x.id === id); if (!b) return { righe: 0 }
      Object.assign(b, campi); return { righe: 1 }
    },
    async aggiornaRiga(id, campi) {
      await attesa(); const g = guasto(); if (g) return g
      const r = db.righe.find(x => x.id === id); if (!r) return { righe: 0 }
      // NOT NULL della 0020 anche in UPDATE: qty/discount/amount mai null
      for (const k of ['qty', 'discount', 'amount', 'name'] as const)
        if (k in campi && (campi as Record<string, unknown>)[k] == null) return { errore: `null vietato su ${k} (finto)` }
      Object.assign(r, campi); return { righe: 1 }
    },
    async aggiungiRiga(riga) {
      await attesa(); const g = guasto(); if (g) return g
      // RIGORE come il database: colonne concesse dalla 0021 E vincoli
      // della 0020 (qty NOT NULL > 0, discount NOT NULL ≥ 0, amount ≥ 0)
      const consentite = new Set<string>(CAMPI_RIGA_NUOVA)
      for (const k of Object.keys(riga)) if (!consentite.has(k)) return { errore: `colonna inesistente: ${k} (finto)` }
      if (riga.qty == null || riga.qty <= 0) return { errore: 'vincolo violato: qty NOT NULL > 0 (finto)' }
      if (riga.discount == null || riga.discount < 0) return { errore: 'vincolo violato: discount NOT NULL ≥ 0 (finto)' }
      if (riga.amount == null || riga.amount < 0) return { errore: 'vincolo violato: amount ≥ 0 (finto)' }
      const id = `finta-${++db.contatore}`
      db.righe.push({
        id, draft_id: riga.draft_id, raw_name: null, name: riga.name,
        qty: riga.qty, unit_price: riga.unit_price ?? null, discount: riga.discount,
        amount: riga.amount, group_id: riga.group_id ?? null,
        category_id: riga.category_id ?? null, subcategory: riga.subcategory ?? null,
        canonical_category_id: riga.canonical_category_id ?? null,
        canonical_subcategory_id: riga.canonical_subcategory_id ?? null,
        necessity: riga.necessity ?? null, planning: riga.planning ?? null,
        excluded: false, user_added: true, confidence: null,
      })
      return { id }
    },
    async confermaDocumento() {
      if (modo === 'persa') throw new Error('Failed to fetch (finto: risposta persa)')
      if (modo === 'rete') return { errore: 'Failed to fetch (finto: errore di rete restituito)' }
      if (modo === 'errore')
        return { errore: 'Quadratura non esatta: righe+arrotondamento=1200 cent, documento=1250 cent (simulata)' }
      // stati REALI della 0020: bozze 'confermata', documento 'confermato'
      db.bozze.forEach(b => { (b as { status: string }).status = 'confermata' })
      db.docStatus = 'confermato'
      return { ids: ['spesa-finta-1', 'spesa-finta-2'] }
    },
    async scartaDocumento() {
      const g = guasto(); if (g) return { errore: g.errore }
      db.bozze.forEach(b => { (b as { status: string }).status = 'scartata' })
      db.docStatus = 'scartato'
      return {}
    },
  }
}

// due pagine per il visore: un'immagine (SVG) e un PDF, per provare che il
// tipo si conserva e i due visori sono diversi
const PAGINA_SVG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="500"><rect width="100%" height="100%" fill="#f4f1ea"/><text x="30" y="60" font-size="22" fill="#141E19">MERCATO DI ROZZANO</text><text x="30" y="110" font-size="16" fill="#444">Pomodori ......... 4,50</text><text x="30" y="140" font-size="16" fill="#444">Insalata ......... 2,50</text><text x="30" y="170" font-size="16" fill="#444">TOTALE .......... 12,50</text></svg>')
const PAGINE_FINTE = [
  { id: 'pg-1', storage_path: 'finta/p1.svg', page_order: 1, tipo: 'image/svg+xml' },
  { id: 'pg-2', storage_path: 'finta/p2.pdf', page_order: 2, tipo: 'application/pdf' },
]
const urlFinto = async (percorso: string) => percorso.endsWith('.pdf') ? 'about:blank' : PAGINA_SVG

const depositoProva = depositoRevisioneLocale('gestionale-revisione-prova')

// ---- PERCORSO A CONTRATTO in prova (?percorso=contratto): la schermata
// VERA sul server finto RIGOROSO del contratto, senza rete. I guasti
// simulati passano da un RIVESTIMENTO del cliente (come nel collaudo):
//   ?scrittura=errore → rifiuto DIMOSTRATO (P0001, quadratura simulata)
//   ?scrittura=rete   → errore senza prova di rifiuto (pendenza custodita)
//   ?scrittura=persa  → effetto REALE, poi risposta persa (recupero
//                       all'apertura successiva: riapri il documento)
//   ?scrittura=lenta  → risposte in 2,5 s (controlli spenti)
function clienteContrattoProva(modo: string | null, base: ClienteContratto): ClienteContratto {
  const attesa = () => modo === 'lenta' ? new Promise(r => setTimeout(r, 2500)) : Promise.resolve()
  const involucro = <P,>(vera: (p: P) => Promise<unknown>) => async (p: P) => {
    await attesa()
    if (modo === 'errore') return { errore: 'Quadratura non esatta (simulata dal finto)', codice: 'P0001' }
    if (modo === 'rete') return { errore: 'Failed to fetch (finto: errore di rete restituito)' }
    const r = await vera(p)
    if (modo === 'persa') throw new Error('Failed to fetch (finto: risposta persa DOPO l\'effetto reale)')
    return r
  }
  return {
    salvaRevisione: involucro(base.salvaRevisione) as ClienteContratto['salvaRevisione'],
    confermaRevisione: involucro(base.confermaRevisione) as ClienteContratto['confermaRevisione'],
    scartaRevisione: involucro(base.scartaRevisione) as ClienteContratto['scartaRevisione'],
    esitoRevisione: k => base.esitoRevisione(k),        // il recupero non si guasta: serve a risolvere
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
  const [notaRevisione, setNotaRevisione] = useState<string | null>(null)
  const [moduloAperto, setModuloAperto] = useState(false)
  const [revisioneAperta, setRevisioneAperta] = useState(false)
  const modoScrittura = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('scrittura') : null
  const scritturaFallisce = modoScrittura === 'errore'
  // l'archivio finto SOPRAVVIVE a chiusura e riapertura del foglio: come il
  // database vero, dopo un Salva restituisce i valori già corretti (il
  // cliente finto lo muta sul posto, la riapertura lo rilegge)
  const [archivio] = useState<ArchivioRevisione>(() => ({
    docTotale: 12.5, docStatus: 'in_revisione', contatore: 0,
    bozze: JSON.parse(JSON.stringify(TABELLE_FINTE.bozze)) as BozzaGrezza[],
    righe: JSON.parse(JSON.stringify(TABELLE_FINTE.righeBozza)) as RigaGrezza[],
  }))
  const percorsoProva = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('percorso') : null
  // il MONDO del server finto CONDIVIDE gli oggetti dell'archivio: i
  // salvataggi del contratto mutano le stesse bozze/righe che la
  // riapertura rilegge (come farebbe il database vero)
  const [contratto] = useState<{ orchestrazione: OrchestrazioneRevisione; documento: { status: string; revisione_rev: number; doc_total: number | null } } | null>(() => {
    if (percorsoProva !== 'contratto') return null
    const documento = { status: archivio.docStatus, revisione_rev: 0, doc_total: archivio.docTotale }
    const mondo: MondoFinto = {
      documenti: new Map([['d-rev', documento]]),
      bozze: new Map(archivio.bozze.map(b => [b.id, b as unknown as { document_id: string; status: string } & Record<string, unknown>])),
      righe: new Map(archivio.righe.map(r => [r.id, r as unknown as { draft_id: string } & Record<string, unknown>])),
    }
    const server = creaServerContratto(mondo, improntaSha256)
    const orchestrazione = orchestrazioneContratto({
      cliente: clienteContrattoProva(modoScrittura, server.cliente),
      depositoRevisione: depositoProva,
      depositoOperazioni: depositoOperazioniDurevole(undefined, 'gestionale-op-contratto-prova'),
      ponte: ponteContrattoDurevole(undefined, 'gestionale-ponte-contratto-prova'),
      revisioneIniziale: 0,
    })
    return { orchestrazione, documento }
  })
  return (
    <>
      <SpeseShell dati={dati} contestoIniziale={c} sezioneIniziale={t} filtriApertiIniziale={filtri}
        riprova={() => window.location.reload()}
        aggiungi={v => { if (v === 'manuale') setModuloAperto(true); else setScelta(v) }}
        apriRevisione={() => setRevisioneAperta(true)}
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
      {revisioneAperta && (
        <RevisioneSheet
          documento={{ id: 'd-rev', supplier: 'Mercato di Rozzano', kind: 'scontrino',
            status: contratto ? contratto.documento.status : archivio.docStatus,
            doc_total: contratto ? contratto.documento.doc_total : archivio.docTotale, note: 'metà è di Casa Ania' }}
          bozze={JSON.parse(JSON.stringify(archivio.bozze)) as BozzaGrezza[]}
          righe={JSON.parse(JSON.stringify(archivio.righe)) as RigaGrezza[]}
          gruppi={TABELLE_FINTE.gruppi.map(g => ({ id: g.id, name: g.name, ambito: g.ambito ?? 'personale' }))}
          categorie={TABELLE_FINTE.categorie.map(x => ({ id: x.id, name: x.name, group_id: x.group_id ?? '' }))}
          canoniche={TABELLE_FINTE.categorieCanoniche}
          sottoCanoniche={TABELLE_FINTE.sottocategorieCanoniche}
          camere={TABELLE_FINTE.camere}
          pagine={PAGINE_FINTE}
          firmaUrl={urlFinto}
          cliente={clienteRevisioneFinto(modoScrittura, archivio)}
          deposito={depositoProva}
          orchestrazione={contratto?.orchestrazione}
          fatto={esito => {
            // come la pagina VERA: dopo Salva il foglio RESTA aperto
            if (esito === 'salvato') { setNotaRevisione('salvate nell\'archivio finto: chiudi e riapri per vedere originali e correzioni conservati'); return }
            if (esito === 'confermato') setNotaRevisione('documento confermato (finto)')
            if (esito === 'scartato') setNotaRevisione('documento scartato (finto)')
            if (esito === 'verifica') setNotaRevisione('da ricontrollare: riapri il documento — modifiche e responsabilità sono custodite')
            setRevisioneAperta(false)
          }}
          chiudi={() => setRevisioneAperta(false)} />
      )}
      {notaRevisione && !revisioneAperta && (
        <div className="fixed inset-x-4 z-[70] bottom-[calc(env(safe-area-inset-bottom)+16px)] max-w-md mx-auto px-4 py-3 text-[13px] font-semibold text-center"
          style={{ background: '#141E19', color: '#F6F6F3', borderRadius: '0.75rem' }}
          onClick={() => setNotaRevisione(null)} role="status">
          {notaRevisione}
        </div>
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
