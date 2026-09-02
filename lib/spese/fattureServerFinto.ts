// ============================================================================
// SERVIZIO FINTO RIGOROSO per il percorso fatture (Fase 5): un ClienteRevisione
// che lavora su TABELLE GREZZE nello schema reale (le stesse che
// l'adattatore trasforma in DatiSpese) e riproduce le regole delle RPC
// della 0020 — conferma_documento, approva_fattura_da_pagare, paga_fattura,
// conferma_fattura_pagata, scarta_documento — e i permessi per colonna della
// 0021 sugli UPDATE. Serve ai test d'integrazione e alla preview sintetica
// (app/nuove-spese): nessuna rete, nessun database.
// Quello che NON modella: lock/concorrenza fra processi, RLS, is_app_member.
// GUASTI iniettabili per RPC:
//   'errore' → rifiuto RESTITUITO senza effetti (es. quadratura)
//   'rete'   → errore di rete RESTITUITO senza effetti
//   'persa'  → effetto REALE, poi eccezione (risposta persa)
//   'zero'   → effetto REALE, risposta senza spese (mai un successo)
//   'lenta'  → risposta normale dopo un'attesa
// ============================================================================
import type { TabelleGrezze } from './adattatore.ts'
import { METODI_VALIDI } from './fatture.ts'
import { CAMPI_BOZZA_REVISIONE, CAMPI_DOCUMENTO_REVISIONE, CAMPI_RIGA_NUOVA, CAMPI_RIGA_REVISIONE } from './revisione.ts'
import type { ClienteRevisione } from './revisioneScrittura.ts'

export type GuastoFinto = null | 'errore' | 'rete' | 'persa' | 'zero' | 'lenta'
export type Correzione = Record<string, unknown> & { document_id: string; source: string }

export type ServerFattureFinto = {
  cliente: ClienteRevisione
  chiamate: { rpc: string; argomenti: unknown }[]
  correzioni: Correzione[]
}

const cent = (n: number) => Math.round(Number(n) * 100)
const ATTIVE = ['da_controllare', 'pronta']

export function creaServerFattureFinto(t: TabelleGrezze, opzioni: {
  guasto?: () => GuastoFinto
  genId?: () => string
  attesaMs?: number
} = {}): ServerFattureFinto {
  let contatore = 0
  const genId = opzioni.genId ?? (() => `finto-${++contatore}`)
  const chiamate: { rpc: string; argomenti: unknown }[] = []
  const correzioni: Correzione[] = []
  const guasto = () => opzioni.guasto?.() ?? null
  const attendi = () => guasto() === 'lenta'
    ? new Promise<void>(r => setTimeout(r, opzioni.attesaMs ?? 2500)) : Promise.resolve()

  const doc = (id: string) => t.documenti.find(d => d.id === id)
  const bozzeAttive = (documentId: string) =>
    t.bozze.filter(b => b.document_id === documentId && ATTIVE.includes(b.status))
  const ambitoDi = (groupId: string | null) =>
    (groupId ? t.gruppi.find(g => g.id === groupId)?.ambito : 'personale') === 'azienda' ? 'azienda' : 'personale'

  // private.registra_correzioni: validazione di appartenenza e append
  const registraCorrezioni = (documentId: string, lista: Record<string, unknown>[]) => {
    if (!Array.isArray(lista)) throw new Error('Correzioni non valide: atteso un array (anche vuoto)')
    for (const c of lista) {
      if (!c.field) throw new Error('Correzione senza campo')
      if (c.draft_id && !t.bozze.some(b => b.id === c.draft_id && b.document_id === documentId))
        throw new Error(`Correzione respinta: la bozza ${String(c.draft_id)} non appartiene al documento`)
      if (c.draft_item_id && !t.righeBozza.some(r => r.id === c.draft_item_id
        && t.bozze.some(b => b.id === r.draft_id && b.document_id === documentId)))
        throw new Error(`Correzione respinta: la riga ${String(c.draft_item_id)} non appartiene al documento`)
    }
    for (const c of lista) correzioni.push({ ...c, document_id: documentId, source: 'revisione' })
  }

  const quadratura = (documentId: string, docTotal: number) => {
    const attive = bozzeAttive(documentId)
    const righe = t.righeBozza.filter(r => attive.some(b => b.id === r.draft_id) && !r.excluded)
    const somma = righe.reduce((s, r) => s + cent(r.amount), 0)
      + attive.reduce((s, b) => s + (b.arrotondamento_cent ?? 0), 0)
    if (somma !== cent(docTotal))
      throw new Error(`Quadratura non esatta: righe+arrotondamento=${somma} cent, documento=${cent(docTotal)} cent`)
  }

  // private.valida_fattura
  const validaFattura = (documentId: string, richiediScadenza: boolean) => {
    const d = doc(documentId)!
    if (d.doc_total == null) throw new Error('Totale documento mancante')
    if (!d.document_date) throw new Error('Data documento mancante')
    if (richiediScadenza && !d.due_date) throw new Error('Scadenza mancante')
    if (!d.supplier) throw new Error('Fornitore mancante')
    const attive = bozzeAttive(documentId)
    if (!attive.length) throw new Error('Nessuna bozza attiva: documento senza bozze o con bozze scartate/in errore')
    if (attive.some(b => !b.group_id)) throw new Error('Bozza senza gruppo: assegnare il gruppo prima di approvare')
    // parte negativa dopo l'arrotondamento: la stessa regola che
    // spese_crea_da_bozze applica al pagamento, anticipata all'approvazione
    // (nella 0020 manca: proposta 0030 in supabase/proposte)
    for (const b of attive) {
      const righe = t.righeBozza.filter(r => r.draft_id === b.id && !r.excluded)
      const amountCent = righe.reduce((s, r) => s + cent(r.amount), 0) + (b.arrotondamento_cent ?? 0)
      if (amountCent < 0) throw new Error(`Importo sorella negativo (${amountCent / 100}) dopo l'arrotondamento: non valido`)
    }
    quadratura(documentId, d.doc_total)
  }

  // private.spese_crea_da_bozze
  const creaSpese = (documentId: string, expenseDate: string | null, paidAt: string | null, metodo: string | null): string[] => {
    const d = doc(documentId)!
    if (d.doc_total == null) throw new Error('Totale documento mancante: conferma bloccata')
    const attive = bozzeAttive(documentId)
    if (!attive.length) throw new Error('Nessuna bozza attiva: documento senza bozze o con bozze scartate/in errore')
    if (attive.some(b => !b.group_id)) throw new Error('Bozza senza gruppo: assegnare il gruppo prima di confermare')
    if (metodo == null && attive.some(b => ambitoDi(b.group_id) === 'azienda' && !b.payment_method))
      throw new Error('Metodo di pagamento mancante sulle righe Casa Ania: obbligatorio prima della conferma')
    quadratura(documentId, d.doc_total)
    const ids: string[] = []
    let madriCent = 0
    for (const b of attive) {
      const righe = t.righeBozza.filter(r => r.draft_id === b.id && !r.excluded)
      const amountCent = righe.reduce((s, r) => s + cent(r.amount), 0) + (b.arrotondamento_cent ?? 0)
      if (amountCent < 0) throw new Error(`Importo sorella negativo (${amountCent / 100}) dopo l'arrotondamento: non valido`)
      const expenseId = genId()
      t.spese.push({
        id: expenseId, expense_date: expenseDate ?? b.expense_date, amount: amountCent / 100,
        group_id: b.group_id, category_id: b.category_id, subcategory: b.subcategory,
        description: b.description, store: b.store, product: null, receipt_id: null,
        payment_method: metodo ?? b.payment_method ?? null, paid_at: paidAt,
        room_id: b.room_id, canonical_category_id: b.canonical_category_id,
        canonical_subcategory_id: b.canonical_subcategory_id, expense_nature: b.expense_nature,
        recurring: false, source: 'foto',
      })
      for (const r of righe) {
        t.righe.push({
          id: genId(), expense_id: expenseId, name: r.name, amount: Number(r.amount),
          category_id: r.category_id, subcategory: r.subcategory, qty: r.qty,
          unit_price: r.unit_price, discount: r.discount, group_id: r.group_id,
          canonical_category_id: r.canonical_category_id, canonical_subcategory_id: r.canonical_subcategory_id,
          necessity: r.necessity, planning: r.planning, is_adjustment: false,
        })
      }
      if ((b.arrotondamento_cent ?? 0) !== 0) {
        t.righe.push({
          id: genId(), expense_id: expenseId, name: 'Arrotondamento', amount: (b.arrotondamento_cent ?? 0) / 100,
          category_id: b.category_id, subcategory: b.subcategory, qty: 1, is_adjustment: true,
        })
      }
      madriCent += amountCent
      t.ponte.push({ expense_id: expenseId, document_id: documentId })
      b.status = 'confermata'
      b.expense_id = expenseId
      ids.push(expenseId)
    }
    if (madriCent !== cent(d.doc_total))
      throw new Error(`Incoerenza interna: somma sorelle (${madriCent}) diversa dal totale documento (${cent(d.doc_total)})`)
    d.status = 'confermato'
    return ids
  }
  const speseGiaConfermate = (documentId: string) =>
    t.bozze.filter(b => b.document_id === documentId && b.expense_id).map(b => b.expense_id!)

  // fotografia e ripristino IN PLACE delle tabelle (gli array sono condivisi
  // con chi legge: si svuotano e si riempiono, mai sostituiti)
  const TABELLE = ['documenti', 'bozze', 'righeBozza', 'spese', 'righe', 'ponte'] as const
  const fotografia = () => Object.fromEntries(TABELLE.map(k => [k, structuredClone(t[k])])) as Record<typeof TABELLE[number], unknown[]>
  const ripristina = (foto: Record<typeof TABELLE[number], unknown[]>) => {
    for (const k of TABELLE) {
      const arr = t[k] as unknown[]
      arr.splice(0, arr.length, ...structuredClone(foto[k]))
    }
  }

  // il rivestimento di ogni RPC: guasti PRIMA (senza effetti) o DOPO
  // (effetto reale con risposta persa/vuota), errori SQL → errore restituito
  // i rifiuti della RPC portano il CODICE applicativo (P0001 = raise
  // exception), come fa il gateway vero; l'errore di rete NON ha codice
  const rpc = async <T extends { ids?: string[] }>(nome: string, argomenti: unknown, corpo: () => T): Promise<T | { errore: string; codice?: string }> => {
    chiamate.push({ rpc: nome, argomenti })
    await attendi()
    const g = guasto()
    if (g === 'errore') return { errore: 'Quadratura non esatta: righe+arrotondamento=0 cent, documento=1 cent (simulata dal finto)', codice: 'P0001' }
    if (g === 'rete') return { errore: 'Failed to fetch (finto: errore di rete restituito)' }
    // TRANSAZIONE: il corpo lavora sulle tabelle vere; se lancia a metà,
    // TUTTO torna com'era (come il rollback della RPC), mai effetti parziali
    const foto = fotografia()
    let esito: T
    try { esito = corpo() } catch (e) { ripristina(foto); return { errore: (e as Error).message, codice: 'P0001' } }
    if (g === 'persa') throw new Error('Failed to fetch (finto: risposta persa DOPO l\'effetto reale)')
    if (g === 'zero') return { ...esito, ids: [] }
    return esito
  }
  const consentiti = (campi: Record<string, unknown>, ammessi: readonly string[], dove: string) => {
    for (const k of Object.keys(campi))
      if (!ammessi.includes(k)) return { errore: `colonna «${k}» inesistente o non concessa in ${dove} (finto)` }
    return null
  }

  const cliente: ClienteRevisione = {
    async aggiornaDocTotale(documentId, totale) {
      await attendi()
      const d = doc(documentId); if (!d) return { righe: 0 }
      d.doc_total = totale; return { righe: 1 }
    },
    async aggiornaDocumento(documentId, campi) {
      await attendi()
      const no = consentiti(campi as Record<string, unknown>, CAMPI_DOCUMENTO_REVISIONE, 'update su family_documents')
      if (no) return no
      if ('kind' in campi && !['scontrino', 'fattura', 'altro'].includes(String(campi.kind)))
        return { errore: 'vincolo violato: kind non ammesso (finto)' }
      const d = doc(documentId); if (!d) return { righe: 0 }
      Object.assign(d, campi); return { righe: 1 }
    },
    async aggiornaBozza(id, campi) {
      await attendi()
      const no = consentiti(campi as Record<string, unknown>, CAMPI_BOZZA_REVISIONE, 'update su family_draft_expenses')
      if (no) return no
      const b = t.bozze.find(x => x.id === id); if (!b) return { righe: 0 }
      Object.assign(b, campi); return { righe: 1 }
    },
    async aggiornaRiga(id, campi) {
      await attendi()
      const no = consentiti(campi as Record<string, unknown>, CAMPI_RIGA_REVISIONE, 'update su family_draft_items')
      if (no) return no
      const r = t.righeBozza.find(x => x.id === id); if (!r) return { righe: 0 }
      for (const k of ['qty', 'discount', 'amount', 'name'] as const)
        if (k in campi && (campi as Record<string, unknown>)[k] == null) return { errore: `null vietato su ${k} (finto)` }
      Object.assign(r, campi); return { righe: 1 }
    },
    async aggiungiRiga(riga) {
      await attendi()
      const no = consentiti(riga as Record<string, unknown>, CAMPI_RIGA_NUOVA, 'insert su family_draft_items')
      if (no) return no
      if (riga.qty == null || riga.qty <= 0) return { errore: 'vincolo violato: qty NOT NULL > 0 (finto)' }
      if (riga.discount == null || riga.discount < 0) return { errore: 'vincolo violato: discount NOT NULL ≥ 0 (finto)' }
      if (riga.amount == null || riga.amount < 0) return { errore: 'vincolo violato: amount ≥ 0 (finto)' }
      const id = genId()
      t.righeBozza.push({
        id, draft_id: riga.draft_id, raw_name: null, name: riga.name, qty: riga.qty,
        unit_price: riga.unit_price ?? null, discount: riga.discount, amount: riga.amount,
        group_id: riga.group_id ?? null, category_id: riga.category_id ?? null,
        subcategory: riga.subcategory ?? null, canonical_category_id: riga.canonical_category_id ?? null,
        canonical_subcategory_id: riga.canonical_subcategory_id ?? null,
        necessity: riga.necessity ?? null, planning: riga.planning ?? null,
        excluded: false, user_added: true, confidence: {},
      })
      return { id }
    },
    confermaDocumento: (documentId, correzioni) => rpc('conferma_documento', { documentId, correzioni }, () => {
      const d = doc(documentId); if (!d) throw new Error('Documento inesistente')
      if (d.kind === 'fattura') throw new Error('Tipo non valido: per le fatture usare approva_fattura_da_pagare / paga_fattura / conferma_fattura_pagata')
      if (d.status === 'confermato') return { ids: speseGiaConfermate(documentId) }
      if (d.status !== 'in_revisione') throw new Error(`Stato non valido per la conferma: ${d.status} (serve in_revisione)`)
      registraCorrezioni(documentId, correzioni)
      return { ids: creaSpese(documentId, null, null, null) }
    }),
    async scartaDocumento(documentId, motivo) {
      const r = await rpc('scarta_documento', { documentId, motivo }, () => {
        const d = doc(documentId); if (!d) throw new Error('Documento inesistente')
        if (d.status === 'scartato') return {}
        if (!['da_elaborare', 'in_revisione', 'errore'].includes(d.status)) throw new Error(`Stato non valido per lo scarto: ${d.status}`)
        for (const b of t.bozze) if (b.document_id === documentId && ['da_controllare', 'pronta', 'errore'].includes(b.status)) b.status = 'scartata'
        d.status = 'scartato'
        correzioni.push({ document_id: documentId, field: 'scarto', corrected: motivo, source: 'scarto' })
        return {}
      })
      return 'errore' in r ? { errore: r.errore } : {}
    },
    async approvaFattura(documentId, correzioniRpc) {
      const r = await rpc('approva_fattura_da_pagare', { documentId, correzioni: correzioniRpc }, () => {
        const d = doc(documentId); if (!d) throw new Error('Documento inesistente')
        if (d.kind !== 'fattura') throw new Error('Tipo non valido: solo le fatture si approvano da pagare')
        if (d.status === 'approvata_da_pagare') return {}
        if (d.status !== 'in_revisione') throw new Error(`Stato non valido per l'approvazione: ${d.status} (serve in_revisione)`)
        validaFattura(documentId, true)
        registraCorrezioni(documentId, correzioniRpc)
        d.status = 'approvata_da_pagare'      // NESSUNA spesa
        return {}
      })
      return 'errore' in r ? { errore: r.errore, ...(r.codice ? { codice: r.codice } : {}) } : {}
    },
    pagaFattura: (documentId, data, metodo, correzioniRpc) => rpc('paga_fattura', { documentId, data, metodo, correzioni: correzioniRpc }, () => {
      const d = doc(documentId); if (!d) throw new Error('Documento inesistente')
      if (d.kind !== 'fattura') throw new Error('Tipo non valido: paga_fattura accetta solo fatture')
      if (d.status === 'confermato') return { ids: speseGiaConfermate(documentId) }
      if (d.status !== 'approvata_da_pagare') throw new Error(`Stato non valido per il pagamento: ${d.status} (serve approvata_da_pagare)`)
      if (!data) throw new Error('Data di pagamento obbligatoria')
      if (!metodo || !(METODI_VALIDI as readonly string[]).includes(metodo))
        throw new Error('Metodo di pagamento obbligatorio e valido quando la fattura viene pagata')
      registraCorrezioni(documentId, correzioniRpc)
      return { ids: creaSpese(documentId, data, data, metodo) }
    }),
    confermaFatturaPagata: (documentId, data, metodo, correzioniRpc) => rpc('conferma_fattura_pagata', { documentId, data, metodo, correzioni: correzioniRpc }, () => {
      const d = doc(documentId); if (!d) throw new Error('Documento inesistente')
      if (d.kind !== 'fattura') throw new Error('Tipo non valido: conferma_fattura_pagata accetta solo fatture')
      if (d.status === 'confermato') return { ids: speseGiaConfermate(documentId) }
      if (d.status !== 'in_revisione') throw new Error(`Stato non valido: ${d.status} (serve in_revisione)`)
      if (!data) throw new Error('Data di pagamento obbligatoria')
      if (!metodo || !(METODI_VALIDI as readonly string[]).includes(metodo))
        throw new Error('Metodo di pagamento obbligatorio e valido per una fattura già pagata')
      validaFattura(documentId, false)
      registraCorrezioni(documentId, correzioniRpc)
      return { ids: creaSpese(documentId, data, data, metodo) }
    }),
  }
  return { cliente, chiamate, correzioni }
}
