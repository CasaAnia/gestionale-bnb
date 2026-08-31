// ============================================================================
// ADATTATORE (Fase 3.2A → 3.2A.1) — costruisce DatiSpese dallo schema REALE
// (0020), in SOLA LETTURA: funzione pura, nessuna rete, nessuna scrittura.
//
// Regole:
//  · una spesa storica = contata UNA volta (documento o movimento manuale);
//  · documento misto = UNA voce con quote per ambito (somma = totale);
//  · fatture approvate ma NON pagate = "da pagare", FUORI dallo Speso;
//  · documenti in revisione = movimento "da_controllare" costruito dalle
//    BOZZE attive (contesto economico dalle bozze, mai da upload_ambito se
//    esistono dati economici), righe complete con esclusioni e dubbi;
//  · analisi per RIGA (item prima, spesa madre come ripiego): è la lente
//    con cui Ania vuole vedere dove spende;
//  · dati definitivi incoerenti = ERRORE esplicito, mai vista parziale.
// ============================================================================
import { SOGLIA_CONFIDENCE } from './controlli.ts'
import { controllaMisto } from './vista.ts'
import { ritmoEPrevisione } from './periodo.ts'
import type {
  Contesto, DatiSpese, DocumentoVista, MovimentoVista, OpzioniFiltri,
  PanoramicaAniaVista, PanoramicaMiaVista, PeriodoVista, RigaMovimentoVista,
  StatoDocumento, StatoMovimento,
} from './vista'

// ---- righe grezze (solo i campi che servono qui) ----
export type GrezzoGruppo = { id: string; name: string; ambito: string | null; sort?: number; emoji?: string | null }
export type GrezzaCategoria = { id: string; name: string; group_id?: string | null; sort?: number }
export type GrezzaCategoriaCanonica = { id: string; name: string }
export type GrezzaSottocategoriaCanonica = { id: string; name: string; canonical_category_id?: string | null }
export type GrezzaCamera = { id: string; name: string; active?: boolean | null }
export type GrezzaSpesa = {
  id: string; amount: number; expense_date: string; group_id: string | null
  category_id: string | null; subcategory: string | null; description: string | null
  store: string | null; product: string | null; receipt_id: string | null
  payment_method?: string | null; paid_at?: string | null; room_id?: string | null
  canonical_category_id?: string | null; canonical_subcategory_id?: string | null
  expense_nature?: string | null; recurring?: boolean | null; source?: string | null
}
export type GrezzaRiga = {
  id: string; expense_id: string; name: string; amount: number
  category_id: string | null; subcategory: string | null
  qty?: number | null; unit_price?: number | null; discount?: number | null
  group_id?: string | null; canonical_category_id?: string | null
  canonical_subcategory_id?: string | null; necessity?: string | null
  planning?: string | null; is_adjustment?: boolean | null
}
export type GrezzoDocumento = {
  id: string; kind: string; status: string; doc_total: number | null
  supplier: string | null; invoice_number?: string | null
  document_date: string | null; due_date: string | null
  upload_ambito: string; error_message: string | null; note: string | null
  doc_total_derivato?: boolean | null; created_at: string
}
export type GrezzoPonte = { expense_id: string; document_id: string }
export type GrezzaRicevuta = {
  id: string; document_id: string | null
  storage_path?: string; page_order?: number; mime_type?: string | null
  note?: string | null; status?: string | null; ambito?: string | null
  uploaded_at?: string | null
}
export type Confidence = Record<string, { confidence?: number; doubt_reason?: string } | null | undefined>
export type GrezzaBozza = {
  id: string; document_id: string; status: string; expense_date: string
  group_id: string | null; category_id: string | null; subcategory: string | null
  canonical_category_id: string | null; canonical_subcategory_id: string | null
  store: string | null; description: string | null; payment_method: string | null
  room_id: string | null; expense_nature: string | null
  confidence: Confidence; arrotondamento_cent: number; expense_id: string | null
}
export type GrezzaRigaBozza = {
  id: string; draft_id: string; raw_name: string | null; name: string
  qty: number; unit_price: number | null; discount: number; amount: number
  group_id: string | null; category_id: string | null; subcategory: string | null
  canonical_category_id: string | null; canonical_subcategory_id: string | null
  necessity: string | null; planning: string | null; confidence: Confidence
  excluded: boolean; user_added: boolean
}
export type GrezzoBudget = { id?: string; ambito: string; category_name: string; monthly_amount: number }

export type TabelleGrezze = {
  documenti: GrezzoDocumento[]
  ponte: GrezzoPonte[]
  spese: GrezzaSpesa[]
  righe: GrezzaRiga[]
  ricevute: GrezzaRicevuta[]
  bozze: GrezzaBozza[]
  righeBozza: GrezzaRigaBozza[]
  gruppi: GrezzoGruppo[]
  categorie: GrezzaCategoria[]
  categorieCanoniche: GrezzaCategoriaCanonica[]
  sottocategorieCanoniche: GrezzaSottocategoriaCanonica[]
  camere: GrezzaCamera[]
  budget?: GrezzoBudget[]
}

const cent = (n: number) => Math.round(Number(n) * 100)
const daCent = (c: number) => c / 100

// etichette delle persone: il gruppo "Matteo" si mostra come "Teo",
// "Matteo e Ania" come "M e A" (decisioni approvate; il dato non cambia)
export function etichettaPersona(nomeGruppo: string): string {
  if (nomeGruppo === 'Matteo') return 'Teo'
  if (nomeGruppo === 'Matteo e Ania') return 'M e A'
  return nomeGruppo
}

// etichette dei metodi di pagamento (valori dello schema 0020 + storici)
const METODI: Record<string, string> = {
  contanti: 'Contanti', carta_personale: 'Carta personale',
  carta_attivita: 'Carta attività', bonifico: 'Bonifico', altro: 'Altro',
}
export const etichettaMetodo = (v: string) => METODI[v] ?? v

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

// "oggi" nel fuso Europe/Rome (testabile passando l'istante): subito dopo la
// mezzanotte italiana il giorno è quello NUOVO, anche se in UTC è ancora ieri
export function oggiARoma(istante: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(istante)
}

export function etichettaGiorno(iso: string, oggi: string): string {
  if (iso === oggi) return 'Oggi'
  const [a, m, g] = iso.split('-').map(Number)
  const [ao] = oggi.split('-').map(Number)
  return `${g} ${MESI_BREVI[m - 1]}${a !== ao ? ` ${a}` : ''}`
}

const ultimoGiornoDelMese = (anno: number, mese1a12: number) =>
  new Date(Date.UTC(anno, mese1a12, 0)).getUTCDate()
const iso = (d: Date) => d.toISOString().slice(0, 10)

// il lunedì della settimana di una data ISO (per l'id STABILE della settimana:
// due giorni della stessa settimana → stesso id)
export function lunediDella(isoData: string): string {
  const d = new Date(`${isoData}T00:00:00Z`)
  const daLunedi = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - daLunedi)
  return iso(d)
}

// periodi con id stabile: mese corrente, mese scorso, questa settimana
// (id = lunedì), ogni anno presente nei dati, e il Dal–al libero
export function costruisciPeriodi(oggi: string, anniPresenti: number[]): PeriodoVista[] {
  const [anno, mese] = oggi.split('-').map(Number)
  const meseId = (a: number, m: number) => `${a}-${String(m).padStart(2, '0')}`
  const mesePeriodo = (a: number, m: number): PeriodoVista => ({
    id: meseId(a, m), tipo: 'mese',
    etichetta: `${MESI[m - 1][0].toUpperCase()}${MESI[m - 1].slice(1)} ${a}`,
    dal: `${meseId(a, m)}-01`, al: `${meseId(a, m)}-${String(ultimoGiornoDelMese(a, m)).padStart(2, '0')}`,
  })
  const scorso = mese === 1 ? mesePeriodo(anno - 1, 12) : mesePeriodo(anno, mese - 1)
  const lunedi = lunediDella(oggi)
  const domenica = new Date(`${lunedi}T00:00:00Z`); domenica.setUTCDate(domenica.getUTCDate() + 6)
  const anni = [...new Set([anno, ...anniPresenti])].sort((x, y) => y - x)
  return [
    mesePeriodo(anno, mese),
    scorso,
    { id: `settimana-${lunedi}`, etichetta: 'Questa settimana', tipo: 'settimana', dal: lunedi, al: iso(domenica) },
    ...anni.map(a => ({ id: String(a), etichetta: `Anno ${a}`, tipo: 'anno' as const, dal: `${a}-01-01`, al: `${a}-12-31` })),
    { id: 'intervallo', etichetta: 'Dal–al…', tipo: 'intervallo', dal: '', al: '' },
  ]
}

// stati e tipi ESAUSTIVI: uno stato o un tipo sconosciuto è un errore chiaro,
// mai una trasformazione silenziosa
export function statoDocumentoVista(d: { id: string; status: string; kind: string }): StatoDocumento {
  switch (d.status) {
    case 'da_elaborare': return 'da_elaborare'
    case 'in_revisione': return 'da_controllare'
    case 'approvata_da_pagare': return 'da_pagare'
    case 'confermato': return d.kind === 'fattura' ? 'pagata' : 'confermato'
    case 'errore': return 'errore'
    case 'scartato': return 'scartato'
    default: throw new Error(`Stato documento sconosciuto "${d.status}" (documento ${d.id}): lo schema ne prevede sei, questo non è tra quelli.`)
  }
}
export function tipoDocumentoVista(d: { id: string; kind: string }): DocumentoVista['tipo'] {
  switch (d.kind) {
    case 'scontrino': return 'scontrino'
    case 'fattura': return 'fattura'
    case 'altro': return 'altro'
    default: throw new Error(`Tipo documento sconosciuto "${d.kind}" (documento ${d.id}).`)
  }
}
const nomeTipo = (tipo: DocumentoVista['tipo']) =>
  tipo === 'fattura' ? 'Fattura' : tipo === 'altro' ? 'Documento' : 'Scontrino'

// campi con affidabilità sotto la soglia stabilita (0,8)
function campiDubbi(c: Confidence | null | undefined): { n: number; motivi: Map<string, string> } {
  const motivi = new Map<string, string>()
  for (const [campo, v] of Object.entries(c ?? {})) {
    if (v?.confidence != null && v.confidence < SOGLIA_CONFIDENCE)
      motivi.set(campo, v.doubt_reason || `affidabilità bassa (${v.confidence})`)
  }
  return { n: motivi.size, motivi }
}

// ---------------------------------------------------------------------------
export function costruisciDatiSpese(t: TabelleGrezze, oggi: string): DatiSpese {
  const anomalie: string[] = []
  const gruppoDi = new Map(t.gruppi.map(g => [g.id, g]))
  const categoriaDi = new Map(t.categorie.map(c => [c.id, c.name]))
  const canonicaDi = new Map(t.categorieCanoniche.map(c => [c.id, c.name]))
  const sottoCanonicaDi = new Map(t.sottocategorieCanoniche.map(c => [c.id, c.name]))
  // TUTTE le camere risolvono i riferimenti storici; una camera oggi
  // archiviata non manda in errore la pagina: compare come "Nome (archiviata)"
  const cameraDi = new Map(t.camere.map(c => [c.id, c.active === false ? `${c.name} (archiviata)` : c.name]))
  const spesaDi = new Map(t.spese.map(s => [s.id, s]))
  const documentoGrezzoDi = new Map(t.documenti.map(d => [d.id, d]))

  // --- ANOMALIE STRUTTURALI: mai saltare dati incoerenti in silenzio ---
  const controllaRif = (dove: string, id: string | null | undefined, mappa: Map<string, unknown>, cosa: string) => {
    if (id && !mappa.has(id)) anomalie.push(`${dove}: ${cosa} "${id}" inesistente`)
  }
  for (const s of t.spese) {
    controllaRif(`spesa ${s.id}`, s.group_id, gruppoDi, 'gruppo')
    controllaRif(`spesa ${s.id}`, s.category_id, categoriaDi, 'categoria')
    controllaRif(`spesa ${s.id}`, s.room_id, cameraDi, 'camera')
    controllaRif(`spesa ${s.id}`, s.canonical_category_id, canonicaDi, 'categoria canonica')
    controllaRif(`spesa ${s.id}`, s.canonical_subcategory_id, sottoCanonicaDi, 'sottocategoria canonica')
  }
  const ambitoGrezzo = (groupId: string | null | undefined) =>
    (groupId ? gruppoDi.get(groupId)?.ambito : 'personale') === 'azienda' ? 'azienda' : 'personale'
  for (const r of t.righe) {
    if (!spesaDi.has(r.expense_id)) anomalie.push(`riga ${r.id}: spesa madre "${r.expense_id}" inesistente`)
    controllaRif(`riga ${r.id}`, r.group_id, gruppoDi, 'gruppo')
    controllaRif(`riga ${r.id}`, r.category_id, categoriaDi, 'categoria')
    controllaRif(`riga ${r.id}`, r.canonical_category_id, canonicaDi, 'categoria canonica')
    controllaRif(`riga ${r.id}`, r.canonical_subcategory_id, sottoCanonicaDi, 'sottocategoria canonica')
    // personale e azienda stanno in SORELLE separate: la riga può cambiare
    // persona dentro l'ambito personale, mai ambito rispetto alla madre
    const madre = spesaDi.get(r.expense_id)
    if (madre && r.group_id && gruppoDi.has(r.group_id) && (madre.group_id == null || gruppoDi.has(madre.group_id))
      && ambitoGrezzo(r.group_id) !== ambitoGrezzo(madre.group_id))
      anomalie.push(`riga ${r.id}: gruppo di ambito ${ambitoGrezzo(r.group_id)} dentro una spesa ${ambitoGrezzo(madre.group_id)}`)
  }
  const documentoDiSpesa = new Map<string, string>()
  for (const p of t.ponte) {
    if (!spesaDi.has(p.expense_id)) anomalie.push(`ponte: spesa "${p.expense_id}" inesistente`)
    if (!documentoGrezzoDi.has(p.document_id)) anomalie.push(`ponte: documento "${p.document_id}" inesistente`)
    if (documentoDiSpesa.has(p.expense_id) && documentoDiSpesa.get(p.expense_id) !== p.document_id)
      anomalie.push(`spesa ${p.expense_id}: collegata a più documenti`)
    documentoDiSpesa.set(p.expense_id, p.document_id)
  }
  for (const s of t.spese) {
    if (s.receipt_id && !documentoDiSpesa.has(s.id))
      anomalie.push(`spesa ${s.id}: ha receipt_id ma nessun ponte (backfill incompleto?)`)
  }
  // quadratura di OGNI spesa definitiva che ha righe (anche manuale senza
  // documento): la somma delle righe deve essere l'importo della madre.
  // Le spese SENZA righe mantengono il ripiego legittimo sull'importo madre.
  {
    const righeDi = new Map<string, number>()
    for (const r of t.righe) {
      if (!spesaDi.has(r.expense_id)) continue // già segnalata
      righeDi.set(r.expense_id, (righeDi.get(r.expense_id) ?? 0) + cent(r.amount))
    }
    for (const [expenseId, somma] of righeDi) {
      const s2 = spesaDi.get(expenseId)!
      if (somma !== cent(s2.amount))
        anomalie.push(`spesa ${expenseId}: le righe sommano ${somma} ma l'importo è ${cent(s2.amount)} (centesimi)`)
    }
  }
  for (const b of t.bozze) {
    if (!documentoGrezzoDi.has(b.document_id)) anomalie.push(`bozza ${b.id}: documento "${b.document_id}" inesistente`)
    controllaRif(`bozza ${b.id}`, b.group_id, gruppoDi, 'gruppo')
    controllaRif(`bozza ${b.id}`, b.room_id, cameraDi, 'camera')
    controllaRif(`bozza ${b.id}`, b.category_id, categoriaDi, 'categoria')
    controllaRif(`bozza ${b.id}`, b.canonical_category_id, canonicaDi, 'categoria canonica')
    controllaRif(`bozza ${b.id}`, b.canonical_subcategory_id, sottoCanonicaDi, 'sottocategoria canonica')
  }
  const bozzaDi = new Map(t.bozze.map(b => [b.id, b]))
  for (const r of t.righeBozza) {
    if (!bozzaDi.has(r.draft_id)) anomalie.push(`riga di bozza ${r.id}: bozza "${r.draft_id}" inesistente`)
    controllaRif(`riga di bozza ${r.id}`, r.group_id, gruppoDi, 'gruppo')
    controllaRif(`riga di bozza ${r.id}`, r.category_id, categoriaDi, 'categoria')
    controllaRif(`riga di bozza ${r.id}`, r.canonical_category_id, canonicaDi, 'categoria canonica')
    controllaRif(`riga di bozza ${r.id}`, r.canonical_subcategory_id, sottoCanonicaDi, 'sottocategoria canonica')
    const madre = bozzaDi.get(r.draft_id)
    if (madre && r.group_id && gruppoDi.has(r.group_id) && (madre.group_id == null || gruppoDi.has(madre.group_id))
      && ambitoGrezzo(r.group_id) !== ambitoGrezzo(madre.group_id))
      anomalie.push(`riga di bozza ${r.id}: gruppo di ambito ${ambitoGrezzo(r.group_id)} dentro una bozza ${ambitoGrezzo(madre.group_id)}`)
  }

  // --- mappe di appoggio ---
  const righeDiSpesa = new Map<string, GrezzaRiga[]>()
  for (const r of t.righe) {
    if (!righeDiSpesa.has(r.expense_id)) righeDiSpesa.set(r.expense_id, [])
    righeDiSpesa.get(r.expense_id)!.push(r)
  }
  const fotoDiDocumento = new Map<string, number>()
  for (const r of t.ricevute) {
    if (r.document_id) fotoDiDocumento.set(r.document_id, (fotoDiDocumento.get(r.document_id) ?? 0) + 1)
  }
  const bozzeDiDocumento = new Map<string, GrezzaBozza[]>()
  for (const b of t.bozze) {
    if (!bozzeDiDocumento.has(b.document_id)) bozzeDiDocumento.set(b.document_id, [])
    bozzeDiDocumento.get(b.document_id)!.push(b)
  }
  const righeDiBozza = new Map<string, GrezzaRigaBozza[]>()
  for (const r of t.righeBozza) {
    if (!righeDiBozza.has(r.draft_id)) righeDiBozza.set(r.draft_id, [])
    righeDiBozza.get(r.draft_id)!.push(r)
  }
  const speseDiDocumento = new Map<string, GrezzaSpesa[]>()
  for (const [expenseId, docId] of documentoDiSpesa) {
    const s = spesaDi.get(expenseId)
    if (!s) continue // già segnalato tra le anomalie
    if (!speseDiDocumento.has(docId)) speseDiDocumento.set(docId, [])
    speseDiDocumento.get(docId)!.push(s)
  }

  const ambitoDiGruppo = (groupId: string | null | undefined): Contesto =>
    (groupId ? gruppoDi.get(groupId)?.ambito : 'personale') === 'azienda' ? 'ania' : 'mia'
  const personaDiGruppo = (groupId: string | null | undefined): string | undefined => {
    const g = groupId ? gruppoDi.get(groupId) : undefined
    return g && g.ambito !== 'azienda' ? etichettaPersona(g.name) : undefined
  }
  // catena di ripiego ESPLICITA per la categoria: canonica della riga →
  // storica della riga → canonica del padre → storica del padre. Mai nomi inventati.
  const nomeCategoria = (
    riga: { canonical_category_id?: string | null; category_id?: string | null },
    padre: { canonical_category_id?: string | null; category_id?: string | null },
  ): string | undefined =>
    (riga.canonical_category_id ? canonicaDi.get(riga.canonical_category_id) : undefined)
      ?? (riga.category_id ? categoriaDi.get(riga.category_id) : undefined)
      ?? (padre.canonical_category_id ? canonicaDi.get(padre.canonical_category_id) : undefined)
      ?? (padre.category_id ? categoriaDi.get(padre.category_id) : undefined)
  const nomeSottocategoria = (
    riga: { canonical_subcategory_id?: string | null; subcategory?: string | null },
    padre: { canonical_subcategory_id?: string | null; subcategory?: string | null },
  ): string | undefined =>
    (riga.canonical_subcategory_id ? sottoCanonicaDi.get(riga.canonical_subcategory_id) : undefined)
      ?? riga.subcategory
      ?? (padre.canonical_subcategory_id ? sottoCanonicaDi.get(padre.canonical_subcategory_id) : undefined)
      ?? padre.subcategory
      ?? undefined

  const principale = (valori: (string | undefined)[]): string | undefined => {
    const conta = new Map<string, number>()
    for (const v of valori) if (v) conta.set(v, (conta.get(v) ?? 0) + 1)
    return [...conta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  }

  // --- una spesa DEFINITIVA → le sue righe di vista (riga prima, madre come
  //     ripiego). L'ambito/persona/camera della riga usa item.group_id quando
  //     presente, altrimenti il gruppo della spesa madre. ---
  const righeVista = (s: GrezzaSpesa): RigaMovimentoVista[] => {
    const righe = righeDiSpesa.get(s.id) ?? []
    const diRiga = (r: GrezzaRiga): RigaMovimentoVista => {
      const gruppo = r.group_id ?? s.group_id
      const contesto = ambitoDiGruppo(gruppo)
      return {
        nome: r.name, importo: Number(r.amount), contesto,
        categoria: nomeCategoria(r, s), sottocategoria: nomeSottocategoria(r, s),
        persona: personaDiGruppo(gruppo),
        camera: contesto === 'ania' ? (s.room_id ? cameraDi.get(s.room_id) ?? 'Generale' : 'Generale') : undefined,
        quantita: r.qty != null ? Number(r.qty) : undefined,
        prezzoUnitario: r.unit_price != null ? Number(r.unit_price) : undefined,
        sconto: r.discount ? Number(r.discount) : undefined,
        necessita: r.necessity ?? undefined,
        pianificazione: r.planning ?? undefined,
        arrotondamento: r.is_adjustment || undefined,
      }
    }
    if (righe.length === 0) {
      const contesto = ambitoDiGruppo(s.group_id)
      return [{
        nome: s.product || s.description || 'Spesa', importo: Number(s.amount), contesto,
        categoria: nomeCategoria({}, s), sottocategoria: nomeSottocategoria({}, s),
        persona: personaDiGruppo(s.group_id),
        camera: contesto === 'ania' ? (s.room_id ? cameraDi.get(s.room_id) ?? 'Generale' : 'Generale') : undefined,
      }]
    }
    return righe.map(diRiga)
  }

  // --- una BOZZA → le sue righe di vista (escluse comprese, marcate) ---
  const righeVistaBozza = (b: GrezzaBozza): RigaMovimentoVista[] => {
    const gruppoBozza = b.group_id
    return (righeDiBozza.get(b.id) ?? []).map(r => {
      const gruppo = r.group_id ?? gruppoBozza
      const contesto = ambitoDiGruppo(gruppo)
      const dubbi = campiDubbi(r.confidence)
      return {
        nome: r.name, importo: Number(r.amount), contesto,
        categoria: nomeCategoria(r, b), sottocategoria: nomeSottocategoria(r, b),
        persona: personaDiGruppo(gruppo),
        camera: contesto === 'ania' ? (b.room_id ? cameraDi.get(b.room_id) ?? 'Generale' : 'Generale') : undefined,
        dubbio: dubbi.n ? [...dubbi.motivi.values()][0] : undefined,
        nomeGrezzo: r.raw_name ?? undefined,
        quantita: Number(r.qty), prezzoUnitario: r.unit_price != null ? Number(r.unit_price) : undefined,
        sconto: r.discount ? Number(r.discount) : undefined,
        necessita: r.necessity ?? undefined, pianificazione: r.planning ?? undefined,
        esclusa: r.excluded || undefined, aggiuntaUtente: r.user_added || undefined,
      }
    })
  }

  // --- MOVIMENTI ---
  const movimenti: MovimentoVista[] = []
  for (const d of t.documenti) {
    const tipo = tipoDocumentoVista(d)
    const statoDoc = statoDocumentoVista(d)
    const spese = speseDiDocumento.get(d.id) ?? []

    if (spese.length > 0) {
      // documento con spese definitive (confermato o fattura pagata)
      const ambiti = new Set(spese.map(s => ambitoDiGruppo(s.group_id)))
      const contesto: MovimentoVista['contesto'] = ambiti.size > 1 ? 'misto' : [...ambiti][0]
      const totaleCent = spese.reduce((sum, s) => sum + cent(s.amount), 0)
      if (d.doc_total != null && cent(d.doc_total) !== totaleCent
        && (d.status === 'confermato'))
        anomalie.push(`documento ${d.id} confermato: somma spese sorelle ${totaleCent} ≠ doc_total ${cent(d.doc_total)} (centesimi)`)
      const righe = spese.flatMap(righeVista)
      // la quadratura per sorella (somma righe = importo) è già verificata
      // GLOBALMENTE su tutte le spese definitive con righe
      const data = spese.map(s => s.expense_date).sort().at(-1)!
      const metodi = [...new Set(spese.map(s => s.payment_method).filter((x): x is string => !!x).map(etichettaMetodo))]
      const stato: StatoMovimento = statoDoc === 'pagata' ? 'pagata' : 'confermato'
      movimenti.push({
        id: `doc-${d.id}`,
        titolo: d.supplier || principale(spese.map(s => s.store ?? undefined))
          || principale(spese.map(s => s.description ?? undefined)) || nomeTipo(tipo),
        negozio: principale(spese.map(s => s.store ?? undefined)),
        data, giorno: etichettaGiorno(data, oggi),
        importo: d.doc_total != null ? Number(d.doc_total) : daCent(totaleCent),
        categoria: principale(righe.map(r => r.categoria)) ?? 'Altro',
        contesto,
        persona: principale(spese.map(s => personaDiGruppo(s.group_id))) ?? (contesto === 'ania' ? 'Casa Ania' : 'Casa'),
        metodo: metodi.length === 1 ? metodi[0] : undefined,
        stato,
        categorie: [...new Set(righe.map(r => r.categoria).filter((x): x is string => !!x))],
        sottocategorie: [...new Set(righe.map(r => r.sottocategoria).filter((x): x is string => !!x))],
        persone: [...new Set(righe.map(r => r.persona).filter((x): x is string => !!x))],
        camere: [...new Set(righe.map(r => r.camera).filter((x): x is string => !!x))],
        metodi,
        sorelle: contesto === 'misto'
          ? (['mia', 'ania'] as const).map(c => ({
              contesto: c,
              // quota esplicita, anche zero: mai sottintesa
              importo: daCent(spese.filter(s => ambitoDiGruppo(s.group_id) === c).reduce((sum, s) => sum + cent(s.amount), 0)),
            }))
          : undefined,
        righe,
        senzaFoto: !fotoDiDocumento.get(d.id),
      })
      continue
    }

    // documento SENZA spese: in revisione o fattura approvata → il contesto
    // economico viene dalle BOZZE attive; upload_ambito è solo l'ultimo
    // ripiego per un documento appena caricato senza alcun dato economico
    if (d.status !== 'in_revisione' && d.status !== 'approvata_da_pagare') continue
    // economicamente ATTIVE = da_controllare o pronta (coerente con le RPC):
    // confermata/errore/scartata restano storico, fuori da quote e conti
    const bozzeAttive = (bozzeDiDocumento.get(d.id) ?? [])
      .filter(b => b.status === 'da_controllare' || b.status === 'pronta')
    // ogni bozza è una SORELLA: quota = righe attive + il SUO arrotondamento
    const perBozza = bozzeAttive.map(b => {
      const righeBozza = righeVistaBozza(b)
      const quotaCent = righeBozza.filter(r => !r.esclusa).reduce((sum, r) => sum + cent(r.importo), 0)
        + (b.arrotondamento_cent ?? 0)
      return { b, righeBozza, quotaCent, ambito: ambitoDiGruppo(b.group_id) }
    })
    const righe = perBozza.flatMap(x => x.righeBozza)
    const attive = righe.filter(r => !r.esclusa)
    const arrotondamentoCent = bozzeAttive.reduce((sum, b) => sum + (b.arrotondamento_cent ?? 0), 0)
    const attiveCent = perBozza.reduce((sum, x) => sum + x.quotaCent, 0)
    const perAmbito = (c: Contesto) => perBozza.filter(x => x.ambito === c).reduce((sum, x) => sum + x.quotaCent, 0)
    // il contesto viene dalle BOZZE attive anche quando (per ora) non hanno
    // righe; upload_ambito è SOLO l'ultimo ripiego senza bozze attive
    const ambiti = new Set(perBozza.map(x => x.ambito))
    const contesto: MovimentoVista['contesto'] = ambiti.size > 1 ? 'misto'
      : ambiti.size === 1 ? [...ambiti][0]
        : d.upload_ambito === 'azienda' ? 'ania' : 'mia'
    // dubbi ancora da risolvere: bozze attive + righe NON escluse
    const dubbiDoc = bozzeAttive.reduce((sum, b) => sum + campiDubbi(b.confidence).n, 0)
      + bozzeAttive.flatMap(b => righeDiBozza.get(b.id) ?? [])
        .filter(r => !r.excluded)
        .reduce((sum, r) => sum + campiDubbi(r.confidence).n, 0)
    // insiemi anche dalle bozze senza righe (categoria/camera/persona della bozza)
    const senzaRighe = perBozza.filter(x => x.righeBozza.length === 0).map(x => x.b)
    const extraCategorie = senzaRighe.map(b => nomeCategoria({}, b)).filter((x): x is string => !!x)
    const extraPersone = senzaRighe.map(b => personaDiGruppo(b.group_id)).filter((x): x is string => !!x)
    const extraCamere = perBozza.filter(x => x.ambito === 'ania')
      .map(x => x.b.room_id ? cameraDi.get(x.b.room_id) ?? 'Generale' : 'Generale')
    // un documento in revisione PUÒ non quadrare: è un avviso bloccante
    // DENTRO il documento (è quello che Ania deve sistemare), non un errore
    const avviso = d.doc_total != null && bozzeAttive.length > 0 && attiveCent !== cent(d.doc_total)
      ? `le righe attive sommano ${eurTesto(daCent(attiveCent))}, il documento dice ${eurTesto(Number(d.doc_total))}`
      : undefined
    const data = bozzeAttive.map(b => b.expense_date).sort().at(-1) ?? d.document_date ?? d.created_at.slice(0, 10)
    const metodi = [...new Set(bozzeAttive.map(b => b.payment_method).filter((x): x is string => !!x).map(etichettaMetodo))]
    movimenti.push({
      id: `doc-${d.id}`,
      titolo: d.supplier || principale(bozzeAttive.map(b => b.store ?? undefined))
        || principale(bozzeAttive.map(b => b.description ?? undefined))
        || (d.status === 'approvata_da_pagare' ? 'Fattura da pagare' : nomeTipo(tipo)),
      negozio: principale(bozzeAttive.map(b => b.store ?? undefined)),
      data, giorno: etichettaGiorno(data, oggi),
      importo: d.doc_total != null ? Number(d.doc_total) : daCent(attiveCent),
      categoria: principale(attive.map(r => r.categoria)) ?? (tipo === 'fattura' ? 'Fatture' : 'Altro'),
      contesto,
      persona: principale(attive.map(r => r.persona)) ?? (contesto === 'ania' ? 'Casa Ania' : 'Casa'),
      metodo: metodi.length === 1 ? metodi[0] : undefined,
      stato: d.status === 'approvata_da_pagare' ? 'da_pagare' : 'da_controllare',
      categorie: [...new Set([...attive.map(r => r.categoria), ...extraCategorie].filter((x): x is string => !!x))],
      sottocategorie: [...new Set(attive.map(r => r.sottocategoria).filter((x): x is string => !!x))],
      persone: [...new Set([...attive.map(r => r.persona), ...extraPersone].filter((x): x is string => !!x))],
      camere: [...new Set([...attive.map(r => r.camera), ...extraCamere].filter((x): x is string => !!x))],
      metodi,
      sorelle: contesto === 'misto'
        ? (['mia', 'ania'] as const).map(c => {
            const arr = perBozza.filter(x => x.ambito === c)
              .reduce((sum, x) => sum + (x.b.arrotondamento_cent ?? 0), 0)
            return {
              contesto: c,
              importo: daCent(perAmbito(c)),   // esplicita anche se ZERO
              ...(arr !== 0 ? { arrotondamento: daCent(arr) } : {}),
            }
          })
        : undefined,
      righe: righe.length ? righe : undefined,
      dubbio: dubbiDoc > 0 ? (dubbiDoc === 1 ? '1 campo dubbio' : `${dubbiDoc} campi dubbi`) : undefined,
      avviso,
      arrotondamentoCent: arrotondamentoCent || undefined,
      senzaFoto: !fotoDiDocumento.get(d.id),
    })
  }

  // --- spese manuali senza documento: una voce ciascuna ---
  for (const s of t.spese) {
    if (documentoDiSpesa.has(s.id)) continue     // già dentro un documento
    const righe = righeVista(s)
    const contesto = ambitoDiGruppo(s.group_id)
    movimenti.push({
      id: `spesa-${s.id}`,
      titolo: s.description || s.product || s.store || 'Spesa manuale',
      negozio: s.store ?? undefined,
      data: s.expense_date, giorno: etichettaGiorno(s.expense_date, oggi),
      importo: Number(s.amount),
      categoria: righe[0]?.categoria ?? 'Altro',
      contesto,
      persona: personaDiGruppo(s.group_id) ?? (contesto === 'ania' ? 'Casa Ania' : 'Casa'),
      metodo: s.payment_method ? etichettaMetodo(s.payment_method) : undefined,
      stato: 'senza_documento',
      categorie: [...new Set(righe.map(r => r.categoria).filter((x): x is string => !!x))],
      sottocategorie: [...new Set(righe.map(r => r.sottocategoria).filter((x): x is string => !!x))],
      persone: [...new Set(righe.map(r => r.persona).filter((x): x is string => !!x))],
      camere: [...new Set(righe.map(r => r.camera).filter((x): x is string => !!x))],
      metodi: s.payment_method ? [etichettaMetodo(s.payment_method)] : [],
      righe: righe.length > 1 ? righe : undefined,
      senzaFoto: true,
    })
  }
  movimenti.sort((a, b) => b.data.localeCompare(a.data))

  // ogni misto deve avere le DUE quote esplicite e quadrate col totale:
  // sui dati definitivi è un'anomalia, su un documento in revisione è
  // l'avviso bloccante interno (è ciò che Ania deve sistemare)
  for (const m of movimenti) {
    if (m.contesto !== 'misto') continue
    const problemi = controllaMisto(m)
    if (problemi.length === 0) continue
    if (m.stato === 'da_controllare' || m.stato === 'da_pagare') {
      m.avviso = m.avviso ?? problemi[0]
    } else {
      anomalie.push(`movimento ${m.id} (misto): ${problemi.join('; ')}`)
    }
  }

  // dati DEFINITIVI incoerenti → errore chiaro, mai una vista parziale
  if (anomalie.length > 0) {
    throw new Error('DATI INCOERENTI — la vista non viene costruita per non mostrare numeri sbagliati:\n· '
      + anomalie.slice(0, 12).join('\n· ')
      + (anomalie.length > 12 ? `\n· … e altre ${anomalie.length - 12}` : ''))
  }

  // --- DOCUMENTI ---
  const documenti: DocumentoVista[] = t.documenti.map(d => {
    const tipo = tipoDocumentoVista(d)
    const spese = speseDiDocumento.get(d.id) ?? []
    const bozzeAttive = (bozzeDiDocumento.get(d.id) ?? [])
      .filter(b => b.status === 'da_controllare' || b.status === 'pronta')
    const ambiti = spese.length
      ? new Set(spese.map(s => ambitoDiGruppo(s.group_id)))
      : new Set(bozzeAttive.map(b => ambitoDiGruppo(b.group_id)))
    const contesto: DocumentoVista['contesto'] = ambiti.size > 1 ? 'misto'
      : ambiti.size === 1 ? [...ambiti][0]
        : d.upload_ambito === 'azienda' ? 'ania' : 'mia'
    const pagine = fotoDiDocumento.get(d.id) ?? 0
    const dataDoc = d.document_date ?? spese.map(s => s.expense_date).sort().at(-1)
      ?? bozzeAttive.map(b => b.expense_date).sort().at(-1) ?? d.created_at.slice(0, 10)
    const dubbi = bozzeAttive.reduce((sum, b) => sum + campiDubbi(b.confidence).n
      + (righeDiBozza.get(b.id) ?? []).filter(r => !r.excluded).reduce((s2, r) => s2 + campiDubbi(r.confidence).n, 0), 0)
    return {
      id: d.id,
      titolo: d.supplier ? `${nomeTipo(tipo)} ${d.supplier}`
        : `${nomeTipo(tipo)}${spese[0]?.store ? ` ${spese[0].store}` : bozzeAttive[0]?.store ? ` ${bozzeAttive[0].store}` : ''}`,
      tipo,
      contesto,
      stato: statoDocumentoVista(d),
      importo: d.doc_total != null ? Number(d.doc_total)
        : spese.length ? daCent(spese.reduce((x, s) => x + cent(s.amount), 0)) : undefined,
      giorno: etichettaGiorno(dataDoc, oggi),
      scade: d.due_date && d.status === 'approvata_da_pagare' ? etichettaGiorno(d.due_date, oggi) : undefined,
      pagine: pagine || undefined,
      senzaFoto: pagine === 0,
      motivo: d.error_message ?? (d.status === 'scartato' ? d.note ?? undefined : undefined),
      dubbi: dubbi || undefined,
    }
  })

  // --- ANALISI PER RIGA: item prima, spesa madre come ripiego ---
  // Ogni riga porta gruppo (item.group_id ?? spesa), categoria (riga ?? spesa)
  // e l'importo della riga. Gli arrotondamenti restano nei totali di categoria
  // (così la somma torna con lo Speso) ma FUORI dalla metrica sotto i 5 €.
  type RigaAnalisi = { data: string; cent: number; contesto: Contesto; persona?: string; categoria: string; nome: string; arrotondamento: boolean; camera?: string }
  const righeAnalisi: RigaAnalisi[] = []
  for (const s of t.spese) {
    for (const r of righeVista(s)) {
      righeAnalisi.push({
        data: s.expense_date, cent: cent(r.importo), contesto: r.contesto,
        persona: r.persona, categoria: r.categoria ?? 'Altro', nome: r.nome,
        arrotondamento: !!r.arrotondamento, camera: r.camera,
      })
    }
  }

  // --- PANORAMICHE (mese di "oggi"; Speso = solo denaro uscito) ---
  const [annoOggi, meseOggi] = oggi.split('-').map(Number)
  const idMese = `${annoOggi}-${String(meseOggi).padStart(2, '0')}`
  const idMeseScorso = meseOggi === 1 ? `${annoOggi - 1}-12` : `${annoOggi}-${String(meseOggi - 1).padStart(2, '0')}`
  const sommaCent = (liste: GrezzaSpesa[]) => liste.reduce((x, s) => x + cent(s.amount), 0)
  const personali = t.spese.filter(s => ambitoDiGruppo(s.group_id) === 'mia')
  const aziendali = t.spese.filter(s => ambitoDiGruppo(s.group_id) === 'ania')
  const mesePers = personali.filter(s => s.expense_date.startsWith(idMese))
  const scorsoPers = sommaCent(personali.filter(s => s.expense_date.startsWith(idMeseScorso)))

  const righeMesePers = righeAnalisi.filter(r => r.contesto === 'mia' && r.data.startsWith(idMese))
  const categorieMese = new Map<string, number>()
  for (const r of righeMesePers) categorieMese.set(r.categoria, (categorieMese.get(r.categoria) ?? 0) + r.cent)
  const piccole = righeMesePers.filter(r => !r.arrotondamento && r.cent > 0 && r.cent < 500)
  const righeTeo = righeMesePers.filter(r => r.persona === 'Teo')
  const teoPerCat = new Map<string, number>()
  for (const r of righeTeo) teoPerCat.set(r.categoria, (teoPerCat.get(r.categoria) ?? 0) + r.cent)
  // "da controllare" in Panoramica: per i misti conta la QUOTA dell'ambito
  // visualizzato (il totale documento resta nella pastiglia del movimento)
  const movDaControllare = movimenti.filter(m => m.stato === 'da_controllare')
  const quotaNelContesto = (m: MovimentoVista, c: Contesto) =>
    m.contesto === 'misto' ? (m.sorelle?.find(q => q.contesto === c)?.importo ?? 0) : m.importo

  const ritmoDi = (totCent: number) => {
    const r = ritmoEPrevisione(daCent(totCent), idMese, new Date(`${oggi}T12:00:00`))
    return r.isCurrentMonth && r.giorniPassati > 0
      ? { mediaGiorno: r.mediaGiorno, previsione: r.previsione } : null
  }
  const mia: PanoramicaMiaVista = {
    mese: `${MESI[meseOggi - 1][0].toUpperCase()}${MESI[meseOggi - 1].slice(1)}`,
    speso: daCent(sommaCent(mesePers)),
    confrontoPct: scorsoPers > 0 ? Math.round((sommaCent(mesePers) - scorsoPers) / scorsoPers * 100) : null,
    daControllare: {
      n: movDaControllare.filter(m => m.contesto !== 'ania').length,
      tot: daCent(movDaControllare.filter(m => m.contesto !== 'ania')
        .reduce((x, m) => x + cent(quotaNelContesto(m, 'mia')), 0)),
    },
    budget: (t.budget ?? []).filter(b => b.ambito !== 'azienda').map(b => ({
      nome: b.category_name,
      speso: daCent(categorieMese.get(b.category_name) ?? 0),
      tetto: Number(b.monthly_amount),
    })),
    // testo NEUTRO: la ripetizione e le abitudini si calcolano in Fase 6
    ripetute: piccole.length > 0 ? {
      frase: `${piccole.length} voci sotto i 5 €`,
      tot: daCent(piccole.reduce((s2, r) => s2 + r.cent, 0)),
      esempio: [...new Set(piccole.map(r => r.nome.toLowerCase()))].slice(0, 3).join(', '),
    } : null,
    categorie: [...categorieMese.entries()].sort((a, b) => b[1] - a[1])
      .map(([nome, tot]) => ({ nome, tot: daCent(tot) })),
    ritmo: ritmoDi(sommaCent(mesePers)),
    teo: righeTeo.length ? {
      tot: daCent(righeTeo.reduce((s2, r) => s2 + r.cent, 0)),
      voci: [...teoPerCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([n, v]) => [n, daCent(v)] as [string, number]),
    } : null,
  }

  const meseAz = aziendali.filter(s => s.expense_date.startsWith(idMese))
  const daPagare = t.documenti.filter(d => d.status === 'approvata_da_pagare')
  const giorniA = (isoData: string) => Math.round((Date.parse(isoData) - Date.parse(oggi)) / 86400000)
  const metodiMese = new Map<string, number>()
  for (const s of meseAz) {
    const nome = s.payment_method ? etichettaMetodo(s.payment_method) : 'Non indicato'
    metodiMese.set(nome, (metodiMese.get(nome) ?? 0) + cent(s.amount))
  }
  const totMeseAz = sommaCent(meseAz)
  const righeMeseAz = righeAnalisi.filter(r => r.contesto === 'ania' && r.data.startsWith(idMese))
  const perCamera = new Map<string, number>()
  for (const r of righeMeseAz) perCamera.set(r.camera ?? 'Generale', (perCamera.get(r.camera ?? 'Generale') ?? 0) + r.cent)
  const andamento: number[] = []
  for (let i = 5; i >= 0; i--) {
    const dRif = new Date(Date.UTC(annoOggi, meseOggi - 1 - i, 1))
    const id = `${dRif.getUTCFullYear()}-${String(dRif.getUTCMonth() + 1).padStart(2, '0')}`
    andamento.push(daCent(sommaCent(aziendali.filter(s => s.expense_date.startsWith(id)))))
  }
  const ania: PanoramicaAniaVista = {
    mese: mia.mese,
    speso: daCent(totMeseAz),
    impegnato: { tot: daCent(daPagare.reduce((x, d) => x + cent(d.doc_total ?? 0), 0)), n: daPagare.length },
    scadenze: daPagare.filter(d => d.due_date)
      .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
      .slice(0, 5)
      .map(d => ({
        fornitore: d.supplier ?? 'Fattura', importo: Number(d.doc_total ?? 0),
        scade: etichettaGiorno(d.due_date!, oggi), giorni: giorniA(d.due_date!),
      })),
    fattureDaControllare: t.documenti.filter(d => d.kind === 'fattura' && d.status === 'in_revisione').length,
    metodi: totMeseAz > 0
      ? [...metodiMese.entries()].sort((a, b) => b[1] - a[1])
        .map(([nome, v]) => ({ nome, quota: Math.round(v / totMeseAz * 100) }))
      : [],
    costiCamere: [...perCamera.entries()].sort((a, b) => b[1] - a[1])
      .map(([nome, v]) => ({ nome, tot: daCent(v) })),
    andamento,
    budget: (t.budget ?? []).filter(b => b.ambito === 'azienda').map(b => {
      const speso = righeMeseAz.filter(r => r.categoria === b.category_name)
        .reduce((sum, r) => sum + r.cent, 0)
      return { nome: b.category_name, speso: daCent(speso), tetto: Number(b.monthly_amount) }
    }),
    ritmo: ritmoDi(totMeseAz),
  }

  // --- OPZIONI dei filtri, dai dati ---
  const anniPresenti = [...new Set(t.spese.map(s => Number(s.expense_date.slice(0, 4))))]
  const periodi = costruisciPeriodi(oggi, anniPresenti)
  const perAmbitoOpzioni = (c: Contesto): OpzioniFiltri => {
    const mov = movimenti.filter(m => m.contesto === c || m.contesto === 'misto')
    return {
      periodi,
      ...(c === 'mia' ? { persone: [...new Set(mov.flatMap(m => m.persone))].sort() } : {}),
      ...(c === 'ania' ? {
        camere: ['Generale',
          ...t.camere.filter(x => x.active !== false).map(x => x.name).filter(n => n !== 'Generale'),
          // una camera archiviata compare SOLO se davvero presente nei dati
          ...[...new Set(mov.flatMap(m => m.camere))].filter(n => n.endsWith('(archiviata)'))],
      } : {}),
      categorie: [...new Set(mov.flatMap(m => m.categorie))].sort(),
      metodi: [...new Set(mov.flatMap(m => m.metodi))].sort(),
    }
  }

  return { mia, ania, movimenti, documenti, opzioni: { mia: perAmbitoOpzioni('mia'), ania: perAmbitoOpzioni('ania') } }
}

// formato compatto per i messaggi d'avviso (senza dipendere dalla vista)
function eurTesto(n: number): string {
  const c = Math.round(Math.abs(n) * 100)
  const corpo = `${Math.floor(c / 100)}${c % 100 ? ',' + String(c % 100).padStart(2, '0') : ''} €`
  return (n < 0 ? '−' : '') + corpo
}
