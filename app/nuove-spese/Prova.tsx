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
//   ?oggi=AAAA-MM-GG   → il giorno «di oggi» (scadenzario: scaduta/in scadenza)
//   ?fattura=<id>      → apre subito il dettaglio/pagamento di una fattura
//   ?revisione=<id>    → apre subito la revisione di un documento (es. d-fatt-rev)
// FATTURE (Fase 5): revisione e pagamento passano dal SERVIZIO FINTO
// RIGOROSO (lib/spese/fattureServerFinto) sulle tabelle sintetiche, che
// vengono MUTATE come farebbe il database: il guscio si ricostruisce dalle
// stesse tabelle con l'adattatore vero. ?scrittura=errore|rete|persa|lenta|zero
// vale anche per le RPC fattura.
import { useMemo, useState } from 'react'
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
import { costruisciDatiSpese } from '@/lib/spese/adattatore'
import { costruisciPacchettoBozze, type LetturaDocumento } from '@/lib/spese/elaborazioneBozze'
import { creaServerFattureFinto, type GuastoFinto } from '@/lib/spese/fattureServerFinto'
import { dettaglioFattura } from '@/lib/spese/fattureVista'
import { creaPagatore } from '@/lib/spese/fatturePagamento'
import { FatturaSheet } from '@/components/spese/FatturaSheet'
import { DATI_QUASI_VUOTI, OGGI_FINTO, TABELLE_FINTE } from './dati-finti'

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
    // Fase 5: qui non usate (d-rev è uno scontrino); le fatture passano
    // dal servizio finto rigoroso sulle tabelle
    async aggiornaDocumento() { await attesa(); const g = guasto(); if (g) return g; return { righe: 1 } },
    async approvaFattura() { return { errore: 'd-rev è uno scontrino: le fatture usano il servizio finto sulle tabelle' } },
    async pagaFattura() { return { errore: 'd-rev è uno scontrino: le fatture usano il servizio finto sulle tabelle' } },
    async confermaFatturaPagata() { return { errore: 'd-rev è uno scontrino: le fatture usano il servizio finto sulle tabelle' } },
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
// VERA sul server finto RIGOROSO del contratto, senza rete. L'ARCHIVIO
// del finto (documento, bozze, righe E GIORNALE) è PERSISTENTE in
// localStorage: una ricarica della pagina ricrea controller e servizi
// ma NON finge che il server abbia perso il giornale (C09). I guasti
// simulati passano da un RIVESTIMENTO del cliente (come nel collaudo):
//   ?scrittura=errore   → rifiuto DIMOSTRATO (P0001, quadratura simulata)
//   ?scrittura=rete     → errore senza prova di rifiuto (pendenza custodita)
//   ?scrittura=persa    → effetto REALE, poi risposta persa (recupero
//                         all'apertura successiva: riapri il documento)
//   ?scrittura=lenta    → risposte in 2,5 s (controlli spenti)
//   ?scrittura=giornale → la LETTURA del giornale fallisce: la
//                         riconciliazione resta bloccante, niente scritture
//   ?scrittura=giornale1 → fallisce solo il PRIMO tentativo: il bottone
//                          «Riprova la riconciliazione» risolve davvero
//   ?reset=1            → azzera l'archivio e le custodie della prova
const CHIAVE_ARCHIVIO_CONTRATTO = 'gestionale-archivio-contratto-prova'
type ArchivioContrattoSalvato = {
  documento: { status: string; revisione_rev: number; doc_total: number | null }
  bozze: [string, Record<string, unknown>][]
  righe: [string, Record<string, unknown>][]
  giornale: [string, unknown][]
}
function caricaMondoContratto(archivio: ArchivioRevisione): { mondo: MondoFinto; documento: { status: string; revisione_rev: number; doc_total: number | null }; giornale: [string, unknown][] } {
  try {
    const testo = localStorage.getItem(CHIAVE_ARCHIVIO_CONTRATTO)
    if (testo) {
      const salvato = JSON.parse(testo) as ArchivioContrattoSalvato
      return {
        documento: salvato.documento, giornale: salvato.giornale,
        mondo: {
          documenti: new Map([['d-rev', salvato.documento]]),
          bozze: new Map(salvato.bozze as [string, { document_id: string; status: string } & Record<string, unknown>][]),
          righe: new Map(salvato.righe as [string, { draft_id: string } & Record<string, unknown>][]),
        },
      }
    }
  } catch { /* archivio illeggibile: si riparte dal seme */ }
  const documento = { status: archivio.docStatus, revisione_rev: 0, doc_total: archivio.docTotale }
  return {
    documento, giornale: [],
    mondo: {
      documenti: new Map([['d-rev', documento]]),
      bozze: new Map(archivio.bozze.map(b => [b.id, b as unknown as { document_id: string; status: string } & Record<string, unknown>])),
      righe: new Map(archivio.righe.map(r => [r.id, r as unknown as { draft_id: string } & Record<string, unknown>])),
    },
  }
}
function clienteContrattoProva(modo: string | null, base: ClienteContratto, persisti: () => void): ClienteContratto {
  const attesa = () => modo === 'lenta' ? new Promise(r => setTimeout(r, 2500)) : Promise.resolve()
  let primaLetturaGiornale = true
  const involucro = <P,>(vera: (p: P) => Promise<unknown>) => async (p: P) => {
    await attesa()
    if (modo === 'errore') return { errore: 'Quadratura non esatta (simulata dal finto)', codice: 'P0001' }
    if (modo === 'rete') return { errore: 'Failed to fetch (finto: errore di rete restituito)' }
    try {
      const r = await vera(p)
      if (modo === 'persa') throw new Error('Failed to fetch (finto: risposta persa DOPO l\'effetto reale)')
      return r
    } finally { persisti() }                            // l'effetto reale resta, anche a risposta persa
  }
  return {
    salvaRevisione: involucro(base.salvaRevisione) as ClienteContratto['salvaRevisione'],
    confermaRevisione: involucro(base.confermaRevisione) as ClienteContratto['confermaRevisione'],
    scartaRevisione: involucro(base.scartaRevisione) as ClienteContratto['scartaRevisione'],
    esitoRevisione: k => {
      if (modo === 'giornale') throw new Error('Failed to fetch (finto: giornale non raggiungibile)')
      if (modo === 'giornale1' && primaLetturaGiornale) {
        primaLetturaGiornale = false
        throw new Error('Failed to fetch (finto: giornale non raggiungibile, solo al primo tentativo)')
      }
      return base.esitoRevisione(k)
    },
  }
}

// ---- DEMO del blocco «SOLO BOZZE» (?elabora=1 | ?elabora=errore) ----------
// La lettura finta passa dal COSTRUTTORE VERO (costruisciPacchettoBozze):
// bozze, dubbi e totale che la pagina mostra sono il suo output — il
// documento arriva «da elaborare» e diventa una PROPOSTA controllabile
// (o un errore col motivo), mai una spesa definitiva.
function letturaDemo(rotta: boolean): LetturaDocumento {
  return {
    totale: rotta ? 13 : 12.5,           // 13 NON quadra e senza dubbio → rifiutata
    sorelle: [
      {
        ambito: 'personale', destinatario: 'g-casa', data: '2026-08-29',
        negozio: 'Mercato di Rozzano', metodo: 'contanti', arrotondamento_cent: 1,
        dubbi: [{ campo: 'store', confidence: 0.55, motivo: 'nome del negozio poco leggibile' }],
        voci: [
          { raw_name: 'FRUTTA MISTA KG1', name: 'Frutta mista', amount: 4.5, sottocategoria: 'Frutta' },
          { raw_name: 'PANE COMUNE', name: 'Pane comune', amount: 2.5, sottocategoria: 'Pane', dubbi: [{ campo: 'amount', confidence: 0.6, motivo: 'importo poco leggibile' }] },
          { raw_name: 'PANE COMUNE', name: 'Pane (letto due volte)', amount: 2.5, sottocategoria: 'Pane', escludi: true },
          { raw_name: null, name: 'Sacchetto', amount: 0.5, sottocategoria: 'Sacchetti' },
        ],
      },
      {
        ambito: 'azienda', destinatario: 'g-bnb', data: '2026-08-29',
        negozio: 'Mercato di Rozzano', metodo: 'contanti',
        voci: [{ raw_name: 'ACETO ALCOL X2', name: 'Aceto di alcol', qty: 2, amount: 4.99, sottocategoria: 'Detersivi e pulizia' }],
      },
    ],
    // contratto della nota (revisioni R2/R5): la lettura DICHIARA come
    // ha applicato la nota con un EFFETTO strutturato che il costruttore
    // CONFRONTA col pacchetto — senza, o in contraddizione, rifiuta
    notaApplicata: {
      nota: 'metà è di Casa Ania',
      effetto: { tipo: 'divisione', ambiti: ['personale', 'azienda'] },
      come: 'la parte di Casa Ania è la sorella dell\'ambito azienda (Aceto di alcol)',
    },
    notaNonAttribuita: null,
  }
}

type TabelleDemo = typeof TABELLE_FINTE
function tabellePerElaborazione(modo: string | null): { tabelle: TabelleDemo; nota: string } | null {
  if (modo !== '1' && modo !== 'errore') return null
  const esito = costruisciPacchettoBozze(letturaDemo(modo === 'errore'), {
    documentId: 'd-rev',
    gruppi: TABELLE_FINTE.gruppi.map(g => ({ id: g.id, ambito: g.ambito === 'azienda' ? 'azienda' as const : 'personale' as const })),
    sottoCanoniche: TABELLE_FINTE.sottocategorieCanoniche
      .map(x => ({ id: x.id, canonical_category_id: (x as { canonical_category_id?: string | null }).canonical_category_id ?? '' })),
    nota: 'metà è di Casa Ania',
  })
  const tabelle = JSON.parse(JSON.stringify(TABELLE_FINTE)) as TabelleDemo
  const doc = (tabelle.documenti as Record<string, unknown>[]).find(d => d.id === 'd-rev')!
  const senzaDRev = { bozze: (tabelle.bozze as { document_id?: string }[]).filter(b => b.document_id !== 'd-rev') }
  if (!esito.ok) {
    doc.status = 'errore'
    doc.error_message = `l'elaborazione ha rifiutato la lettura: ${esito.errore}`
    doc.doc_total = null
    const idBozze = new Set((tabelle.bozze as { id: string; document_id?: string }[]).filter(b => b.document_id === 'd-rev').map(b => b.id))
    tabelle.bozze = senzaDRev.bozze as typeof tabelle.bozze
    tabelle.righeBozza = (tabelle.righeBozza as { draft_id: string }[]).filter(r => !idBozze.has(r.draft_id)) as typeof tabelle.righeBozza
    return { tabelle, nota: `Elaborazione RIFIUTATA dal modulo «solo bozze»: ${esito.errore}` }
  }
  doc.status = 'in_revisione'
  doc.doc_total = esito.pacchetto.documento.doc_total
  const idPerRif = new Map<string, string>()
  const bozzeNuove = esito.pacchetto.bozze.map((b, i) => {
    const id = `b-elab-${i + 1}`
    idPerRif.set(b.rif, id)
    const { rif, ...campi } = b
    void rif
    return { ...campi, id }
  })
  const idVecchie = new Set((tabelle.bozze as { id: string; document_id?: string }[]).filter(b => b.document_id === 'd-rev').map(b => b.id))
  tabelle.bozze = [...senzaDRev.bozze, ...bozzeNuove] as typeof tabelle.bozze
  tabelle.righeBozza = [
    ...(tabelle.righeBozza as { draft_id: string }[]).filter(r => !idVecchie.has(r.draft_id)),
    ...esito.pacchetto.righe.map((r, j) => {
      const { bozzaRif, ...campi } = r
      return { ...campi, id: `r-elab-${j + 1}`, draft_id: idPerRif.get(bozzaRif)! }
    }),
  ] as typeof tabelle.righeBozza
  return { tabelle, nota: 'Documento elaborato ADESSO dal modulo «solo bozze» (demo): le bozze e i dubbi in «Da controllare» sono l\'output del costruttore vero — nessuna spesa definitiva è stata creata.' }
}

function statoIniziale(): { c: Contesto; t: SezioneSpese; filtri: boolean; statoDati: string; oggi: string } {
  const q = new URLSearchParams(window.location.search)
  const c: Contesto = q.get('c') === 'ania' ? 'ania' : 'mia'
  const t = (['panoramica', 'movimenti', 'documenti', 'analisi'].includes(q.get('t') || '')
    ? q.get('t') : 'panoramica') as SezioneSpese
  const oggi = /^\d{4}-\d{2}-\d{2}$/.test(q.get('oggi') ?? '') ? q.get('oggi')! : OGGI_FINTO
  return { c, t, filtri: q.get('filtri') === '1', statoDati: q.get('stato') ?? 'pronto', oggi }
}

export default function Prova() {
  const [elaborato] = useState(() => tabellePerElaborazione(typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('elabora') : null))
  // le TABELLE della prova sono MUTABILI (il servizio finto delle fatture le
  // cambia come farebbe il database) e il guscio si ricostruisce da lì
  const [TABELLE_DEMO] = useState<TabelleDemo>(() => JSON.parse(JSON.stringify(elaborato?.tabelle ?? TABELLE_FINTE)) as TabelleDemo)
  const [{ c, t, filtri, statoDati, oggi }] = useState(() => statoIniziale())
  const [versione, setVersione] = useState(0)
  const dati = useMemo<StatoDati<DatiSpese>>(() =>
    statoDati === 'caricamento' ? { stato: 'caricamento' }
      : statoDati === 'errore' ? { stato: 'errore', messaggio: 'Il telefono era senza rete mentre chiedevo i movimenti.' }
        : { stato: 'pronto', dati: statoDati === 'vuoto' ? DATI_QUASI_VUOTI : costruisciDatiSpese(TABELLE_DEMO, oggi) },
  // eslint-disable-next-line react-hooks/exhaustive-deps -- versione = «le tabelle sono cambiate»
  [TABELLE_DEMO, statoDati, oggi, versione])
  const ricarica = () => setVersione(v => v + 1)
  const [scelta, setScelta] = useState<string | null>(null)
  const [notaRevisione, setNotaRevisione] = useState<string | null>(elaborato?.nota ?? null)
  const [moduloAperto, setModuloAperto] = useState(false)
  const [revisioneId, setRevisioneId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('revisione') : null)
  const [fatturaId, setFatturaId] = useState<string | null>(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('fattura') : null)
  const revisioneAperta = revisioneId === 'd-rev'
  const setRevisioneAperta = (aperta: boolean) => setRevisioneId(aperta ? 'd-rev' : null)
  const modoScrittura = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('scrittura') : null
  const scritturaFallisce = modoScrittura === 'errore'
  // il servizio finto RIGOROSO delle fatture (RPC 0020 sulle tabelle) e il
  // pagatore con presidio per documento
  const fattureServer = useMemo(() => creaServerFattureFinto(TABELLE_DEMO, {
    guasto: () => (['errore', 'rete', 'persa', 'lenta', 'zero'].includes(modoScrittura ?? '') ? modoScrittura : null) as GuastoFinto,
  }), [TABELLE_DEMO, modoScrittura])
  const pagatore = useMemo(() => creaPagatore(fattureServer.cliente), [fattureServer])
  // l'archivio finto SOPRAVVIVE a chiusura e riapertura del foglio: come il
  // database vero, dopo un Salva restituisce i valori già corretti (il
  // cliente finto lo muta sul posto, la riapertura lo rilegge)
  const [archivio] = useState<ArchivioRevisione>(() => {
    const doc = (TABELLE_DEMO.documenti as { id: string; status?: string; doc_total?: number | null }[]).find(d => d.id === 'd-rev')
    return {
      docTotale: doc?.doc_total ?? 12.5, docStatus: doc?.status ?? 'in_revisione', contatore: 0,
      bozze: JSON.parse(JSON.stringify(TABELLE_DEMO.bozze)) as BozzaGrezza[],
      righe: JSON.parse(JSON.stringify(TABELLE_DEMO.righeBozza)) as RigaGrezza[],
    }
  })
  const percorsoProva = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('percorso') : null
  // MONDO PERSISTENTE del contratto: la ricarica ricrea controller e
  // servizi, ma archivio remoto finto e custodie restano (C09); la
  // versione iniziale è quella LETTA dal documento, come farà la fonte
  const [contratto] = useState<{ orchestrazione: OrchestrazioneRevisione; mondo: MondoFinto; documento: { status: string; revisione_rev: number; doc_total: number | null } } | null>(() => {
    if (percorsoProva !== 'contratto') return null
    if (new URLSearchParams(window.location.search).get('reset') === '1') {
      for (const k of Object.keys(localStorage))
        if (k.includes('-prova') || k.includes('revisione-prova')) localStorage.removeItem(k)
    }
    const { mondo, documento, giornale } = caricaMondoContratto(archivio)
    const server = creaServerContratto(mondo, improntaSha256)
    for (const [k, v] of giornale) server.giornale.set(k, v as never)
    const persisti = () => {
      try {
        const salvato: ArchivioContrattoSalvato = {
          documento,
          bozze: [...mondo.bozze.entries()] as ArchivioContrattoSalvato['bozze'],
          righe: [...mondo.righe.entries()] as ArchivioContrattoSalvato['righe'],
          giornale: [...server.giornale.entries()],
        }
        localStorage.setItem(CHIAVE_ARCHIVIO_CONTRATTO, JSON.stringify(salvato))
      } catch { /* la persistenza della prova è best-effort */ }
    }
    const orchestrazione = orchestrazioneContratto({
      cliente: clienteContrattoProva(modoScrittura, server.cliente, persisti),
      depositoRevisione: depositoProva,
      depositoOperazioni: depositoOperazioniDurevole(undefined, 'gestionale-op-contratto-prova'),
      ponte: ponteContrattoDurevole(undefined, 'gestionale-ponte-contratto-prova'),
      revisioneIniziale: documento.revisione_rev,
    })
    return { orchestrazione, mondo, documento }
  })
  return (
    <>
      <SpeseShell dati={dati} contestoIniziale={c} sezioneIniziale={t} filtriApertiIniziale={filtri}
        riprova={() => window.location.reload()}
        aggiungi={v => { if (v === 'manuale') setModuloAperto(true); else setScelta(v) }}
        apriRevisione={id => {
          const doc = (TABELLE_DEMO.documenti as { id: string; status?: string }[]).find(d => d.id === id)
          if (doc?.status === 'approvata_da_pagare') setFatturaId(id)
          else setRevisioneId(id)
        }}
        apriFattura={id => setFatturaId(id)}
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
          bozze={(contratto
            ? [...contratto.mondo.bozze.entries()].map(([id, b]) => ({ ...(b as object), id }))
            : JSON.parse(JSON.stringify(archivio.bozze))) as BozzaGrezza[]}
          righe={(contratto
            ? [...contratto.mondo.righe.entries()].map(([id, r]) => ({ ...(r as object), id }))
            : JSON.parse(JSON.stringify(archivio.righe))) as RigaGrezza[]}
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
      {revisioneId && revisioneId !== 'd-rev' && (() => {
        const doc = (TABELLE_DEMO.documenti as { id: string; kind: string; status: string; doc_total: number | null; supplier: string | null; invoice_number?: string | null; document_date: string | null; due_date: string | null; note: string | null }[]).find(d => d.id === revisioneId)
        if (!doc) return null
        const bozzeDoc = (TABELLE_DEMO.bozze as { document_id: string }[]).filter(b => b.document_id === revisioneId) as unknown as BozzaGrezza[]
        const idBozze = new Set(bozzeDoc.map(b => b.id))
        return (
          <RevisioneSheet
            documento={{ id: doc.id, supplier: doc.supplier, kind: doc.kind, status: doc.status, doc_total: doc.doc_total, note: doc.note,
              invoice_number: doc.invoice_number ?? null, document_date: doc.document_date, due_date: doc.due_date }}
            oggi={oggi}
            bozze={JSON.parse(JSON.stringify(bozzeDoc)) as BozzaGrezza[]}
            righe={JSON.parse(JSON.stringify((TABELLE_DEMO.righeBozza as { draft_id: string }[]).filter(r => idBozze.has(r.draft_id)))) as RigaGrezza[]}
            gruppi={TABELLE_FINTE.gruppi.map(g => ({ id: g.id, name: g.name, ambito: g.ambito ?? 'personale' }))}
            categorie={TABELLE_FINTE.categorie.map(x => ({ id: x.id, name: x.name, group_id: x.group_id ?? '' }))}
            canoniche={TABELLE_FINTE.categorieCanoniche}
            sottoCanoniche={TABELLE_FINTE.sottocategorieCanoniche}
            camere={TABELLE_FINTE.camere}
            pagine={(TABELLE_DEMO.ricevute as { id: string; document_id: string | null; storage_path?: string; page_order?: number; mime_type?: string | null }[])
              .filter(r => r.document_id === revisioneId && r.storage_path)
              .map(r => ({ id: r.id, storage_path: r.storage_path!, page_order: r.page_order ?? 1, tipo: r.mime_type }))}
            firmaUrl={async () => PAGINA_SVG}
            cliente={fattureServer.cliente}
            deposito={depositoProva}
            fatto={esito => {
              if (esito === 'salvato') { setNotaRevisione('salvate nelle tabelle finte: chiudi e riapri per vedere originali e correzioni conservati'); ricarica(); return }
              if (esito === 'confermato') setNotaRevisione('fattura confermata come GIÀ PAGATA (finto): la spesa è nel conto alla data del pagamento')
              if (esito === 'approvata') setNotaRevisione('fattura APPROVATA da pagare (finto): nello scadenzario e nell\'Impegnato, ZERO spese')
              if (esito === 'scartato') setNotaRevisione('documento scartato (finto)')
              if (esito === 'verifica') setNotaRevisione('da ricontrollare: riapri il documento — modifiche e responsabilità sono custodite')
              setRevisioneId(null); ricarica()
            }}
            chiudi={() => setRevisioneId(null)} />
        )
      })()}
      {fatturaId && (() => {
        const dettaglio = dettaglioFattura(TABELLE_DEMO, fatturaId, oggi)
        if (!dettaglio) return null
        return (
          <FatturaSheet dettaglio={dettaglio} oggi={oggi}
            apriFoto={dettaglio.pagine.length ? () => setNotaRevisione(`(finto) qui si aprirebbero le ${dettaglio.pagine.length} pagine`) : undefined}
            paga={dettaglio.stato === 'da_pagare' ? richiesta => pagatore.paga(fatturaId, richiesta, oggi) : undefined}
            fatto={esito => {
              setFatturaId(null)
              if (esito === 'pagata') setNotaRevisione('fattura PAGATA (finto): la spesa è nel conto alla data del pagamento, l\'Impegnato è sceso')
              if (esito === 'verifica') setNotaRevisione('da ricontrollare: riapri la fattura — se risulta pagata è andata')
              ricarica()
            }}
            chiudi={() => setFatturaId(null)} />
        )
      })()}
      {notaRevisione && !revisioneId && !fatturaId && (
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
