'use client'
// «Da controllare» in Home (versione B, 06/09/2026): letture e stato UNICO
// per tutta l'app. La striscia, la sezione e il link delle Statistiche
// leggono lo stesso stato: un «Riprova» aggiorna tutti. Solo il periodo
// (lib/daControllare.periodoDaControllare), a pagine oltre le 1.000 righe
// (lib/statistiche/paginazione); ogni errore torna come testo e la Home
// mostra «Non riesco a controllare, riprova», mai un «tutto a posto» finto.
// Le regole stanno in lib/daControllare (pure): qui nessuna formula.
import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { supabase } from './supabase'
import { raccogliPagine, raccogliBlocchi, aBlocchi } from './statistiche/paginazione'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { scriviPoiAggiorna } from './scritturaSicura'
import { STATI_APERTI } from './richieste'
import { STATI_LETTI } from './statisticheDati'
import {
  daControllareHome, periodoDaControllare, tabellaRinviiAssente, finoADomani, TABELLA_RINVII, AVVISO_RINVII_NON_DISPONIBILI,
  GIORNI_AVVISO_FATTURE, STATI_FATTURA_DA_PAGARE,
  type Eccezione, type Rinvio, type RichiestaDC, type PrenotazioneDC, type FatturaDC,
} from './daControllare'
import type { PagamentoStat } from './statistiche/tipi'
import { spostaGiorni } from './statistiche/periodo'
import { NOMI_CATEGORIA_COMMISSIONE, type ClienteFattura, type FatturaRiletta, type SpesaFattura } from './fatturaPagata'

import { aggiungiFattureInSospeso } from './fatturaCustodia'

export const MESSAGGIO_NON_RIESCO = 'Non riesco a controllare, riprova'

export type StatoDaControllareHome =
  | { stato: 'caricamento' }
  | { stato: 'errore'; errore: string }
  | { stato: 'pronto'; eccezioni: Eccezione[]; rinviiDisponibili: boolean; oggi: string }

type Dati = { oggi: string; richieste: RichiestaDC[]; prenotazioni: PrenotazioneDC[]; pagamenti: PagamentoStat[]; documenti: FatturaDC[]; rinvii: Rinvio[]; rinviiDisponibili: boolean }

const due = (n: number) => String(n).padStart(2, '0')
const oggiLocale = () => { const d = new Date(); return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}` }

type Esito<T> = { data: T | null; errore: string | null }
async function pagine<T>(cosa: string, pagina: (offset: number, limite: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<Esito<T[]>> {
  const r = await raccogliPagine<T>(pagina)
  if (r.error) return { data: null, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  return { data: r.data, errore: null }
}

const COLONNE_PRENOTAZIONI = '*, rooms(name), guests(full_name, phone)'
type RispostaPren = PromiseLike<{ data: PrenotazioneDC[] | null; error: unknown }>

// Prenotazioni confermate che toccano [da, a); poi TUTTI i segmenti dei
// soggiorni toccati (cambi camera fuori dal periodo), a blocchi di ID, così
// il totale del soggiorno è intero e non nasce un «incompleto» finto.
async function leggiPrenotazioni(da: string, a: string): Promise<Esito<PrenotazioneDC[]>> {
  const cosa = 'controllare le prenotazioni'
  const p = await pagine<PrenotazioneDC>(cosa, (offset, limite) => supabase.from('bookings').select(COLONNE_PRENOTAZIONI)
    .in('status', STATI_LETTI).lt('check_in', a).gt('check_out', da).order('check_in', { ascending: true }).range(offset, offset + limite - 1) as unknown as RispostaPren)
  if (p.errore) return p
  // Le altre camere dello stesso cambio camera (group_id) e della stessa
  // prenotazione (prenotazione_id, regola fissa n. 9: il conto è uno solo)
  const gruppi = [...new Set(p.data!.map(b => b.group_id).filter(Boolean) as string[])]
  const prenotazioniId = [...new Set(p.data!.map(b => b.prenotazione_id).filter(Boolean) as string[])]
  let segmenti: PrenotazioneDC[] = []
  for (const [colonna, valori] of [['group_id', gruppi], ['prenotazione_id', prenotazioniId]] as const) {
    if (valori.length === 0) continue
    const r = await raccogliBlocchi<PrenotazioneDC, string>(aBlocchi(valori), blocco =>
      raccogliPagine<PrenotazioneDC>((offset, limite) => supabase.from('bookings').select(COLONNE_PRENOTAZIONI)
        .in('status', STATI_LETTI).in(colonna, blocco).range(offset, offset + limite - 1) as unknown as RispostaPren), b => b.id)
    if (r.error) return { data: null, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
    segmenti = [...segmenti, ...r.data]
  }
  // I mancati arrivi restano da incassare anche oltre l'intervallo della Home.
  // Leggere anche le altre righe annullate conserva gli incassi dell'intera prenotazione.
  const annullate = await pagine<PrenotazioneDC>(cosa, (offset, limite) => supabase.from('bookings').select(COLONNE_PRENOTAZIONI)
    .eq('status', 'annullata').order('id').range(offset, offset + limite - 1) as unknown as RispostaPren)
  if (annullate.errore) return annullate
  const visti = new Set<string>()
  return { data: [...p.data!, ...segmenti, ...annullate.data!].filter(b => (visti.has(b.id) ? false : (visti.add(b.id), true))), errore: null }
}

function leggiRichieste() {
  return pagine<RichiestaDC>('controllare le richieste', (offset, limite) => supabase.from('richieste')
    .select('id, nome, cognome, telefono, arrivo, partenza, stato, created_at, proposta_inviata_at, condizione_pagamento, note').in('stato', STATI_APERTI)
    .order('created_at', { ascending: true }).range(offset, offset + limite - 1))
}

function leggiPagamenti() {
  return pagine<PagamentoStat>('controllare i pagamenti', (offset, limite) => supabase.from('payments')
    .select('booking_id, amount, paid_on').order('paid_on', { ascending: true }).range(offset, offset + limite - 1))
}

// Le bollette/fatture non pagate con la scadenza passata o entro 7 giorni
// (Ania, 30/09/2026), col PDF e il gruppo della bozza (sola lettura)
function leggiFattureDaPagare(oggi: string) {
  return pagine<FatturaDC>('controllare le bollette', (offset, limite) => supabase.from('family_documents')
    .select('id, kind, status, due_date, doc_total, supplier, note, invoice_number, family_receipts(storage_path, page_order), family_draft_expenses(group_id, status)')
    .eq('kind', 'fattura').in('status', [...STATI_FATTURA_DA_PAGARE]).lte('due_date', spostaGiorni(oggi, GIORNI_AVVISO_FATTURE))
    .order('due_date', { ascending: true }).range(offset, offset + limite - 1))
}

// Rinvii ancora validi. Tabella assente (proposta 0035 non applicata) =
// «Rimanda non disponibile», non un errore; ogni altro errore è visibile.
async function leggiRinvii(oggi: string): Promise<Esito<{ rinvii: Rinvio[]; disponibili: boolean }>> {
  const r = await raccogliPagine<Rinvio>((offset, limite) => supabase.from(TABELLA_RINVII).select('chiave, fino_a').gt('fino_a', oggi).range(offset, offset + limite - 1))
  if (r.error) {
    if (tabellaRinviiAssente(r.error)) return { data: { rinvii: [], disponibili: false }, errore: null }
    return { data: null, errore: messaggioLetturaNonRiuscita(r.error, 'controllare i rinvii') }
  }
  return { data: { rinvii: r.data, disponibili: true }, errore: null }
}

async function leggiTutto(oggi: string): Promise<Esito<Dati>> {
  const { da, a } = periodoDaControllare(oggi)
  // Le pulizie non si leggono qui (11/09/2026): stanno in «Pulizie di oggi», che
  // legge cleanings una volta sola per i numeri, la striscia e la lista.
  const [ric, pren, pag, doc, rin] = await Promise.all([leggiRichieste(), leggiPrenotazioni(da, a), leggiPagamenti(), leggiFattureDaPagare(oggi), leggiRinvii(oggi)])
  const errore = ric.errore ?? pren.errore ?? pag.errore ?? doc.errore ?? rin.errore
  if (errore) return { data: null, errore }
  return { data: { oggi, richieste: ric.data!, prenotazioni: pren.data!, pagamenti: pag.data!, documenti: doc.data!, rinvii: rin.data!.rinvii, rinviiDisponibili: rin.data!.disponibili }, errore: null }
}

// ── Stato condiviso ─────────────────────────────────────────────────────────
const IN_CARICAMENTO: StatoDaControllareHome = { stato: 'caricamento' }
let statoCondiviso: StatoDaControllareHome = IN_CARICAMENTO
let datiCondivisi: Dati | null = null
let letturaInCorso: Promise<void> | null = null
const ascoltatori = new Set<() => void>()

function iscrivi(fn: () => void): () => void {
  ascoltatori.add(fn)
  return () => { ascoltatori.delete(fn) }
}
function pubblica(s: StatoDaControllareHome) {
  statoCondiviso = s
  for (const fn of ascoltatori) fn()
}
function pubblicaDati(d: Dati) {
  datiCondivisi = d
  pubblica({ stato: 'pronto', oggi: d.oggi, rinviiDisponibili: d.rinviiDisponibili, eccezioni: aggiungiFattureInSospeso(daControllareHome({ ...d, adesso: new Date() })) })
}

// Rilegge tutto e aggiorna chi ascolta. Con `daCapo` mostra prima il
// caricamento (tasto «Riprova»); altrimenti lo stato resta finché non arriva
// la risposta. Una lettura alla volta: le chiamate concorrenti la condividono.
export function ricaricaDaControllare(daCapo = false): Promise<void> {
  if (letturaInCorso && !daCapo) return letturaInCorso
  if (daCapo) pubblica(IN_CARICAMENTO)
  const lettura = (async () => {
    const { data, errore } = await leggiTutto(oggiLocale())
    if (errore || !data) pubblica({ stato: 'errore', errore: MESSAGGIO_NON_RIESCO })
    else pubblicaDati(data)
  })().finally(() => { if (letturaInCorso === lettura) letturaInCorso = null })
  letturaInCorso = lettura
  return lettura
}

// «Rimanda» (solo richieste): memoria LATO SERVER nella tabella dei rinvii,
// fino a domani. Lo schermo cambia solo a scrittura riuscita (lib/scritturaSicura);
// senza tabella torna l'avviso e non parte nessuna richiesta.
export async function rimandaVoce(chiave: string): Promise<string | null> {
  const d = datiCondivisi
  if (!d) return MESSAGGIO_NON_RIESCO
  if (!d.rinviiDisponibili) return AVVISO_RINVII_NON_DISPONIBILI
  const fino_a = finoADomani(oggiLocale())
  return scriviPoiAggiorna(
    () => supabase.from(TABELLA_RINVII).upsert({ chiave, fino_a }, { onConflict: 'chiave' }),
    () => { if (datiCondivisi === d) pubblicaDati({ ...d, rinvii: [...d.rinvii.filter(r => r.chiave !== chiave), { chiave, fino_a }] }) },
  )
}

// Stato «Da controllare» con aggiornamento al ritorno in primo piano (sul
// telefono il gestionale resta aperto per giorni: l'elenco non deve invecchiare).
export function useDaControllare(): StatoDaControllareHome & { ricarica: () => void; rimanda: (chiave: string) => Promise<string | null> } {
  const stato = useSyncExternalStore(iscrivi, () => statoCondiviso, () => IN_CARICAMENTO)
  useEffect(() => {
    const load = () => { void ricaricaDaControllare() }
    load()
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', load)
    return () => {
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', load)
    }
  }, [])
  const ricarica = useCallback(() => { void ricaricaDaControllare(true) }, [])
  return { ...stato, ricarica, rimanda: rimandaVoce }
}

// «Segna pagata» sulle bollette (30/09/2026): il client vero per
// lib/fatturaPagata (RPC della 0020 e, se si è pagato di più, la spesa della
// commissione nello stesso gruppo). Dopo il salvataggio la Home rilegge.
export const clienteFattura: ClienteFattura = {
  rpc: (nome, argomenti) => supabase.rpc(nome, argomenti),
  async categoriaCommissione(gruppoId) {
    const { data, error } = await supabase.from('family_categories').select('id, name').eq('group_id', gruppoId).in('name', [...NOMI_CATEGORIA_COMMISSIONE])
    if (error) return { id: null, error }
    const righe = (data ?? []) as { id: string; name: string }[]
    const scelta = NOMI_CATEGORIA_COMMISSIONE.map(n => righe.find(r => r.name === n)).find(Boolean)
    return { id: scelta?.id ?? null, error: null }
  },
  async leggiFattura(documentoId) {
    const [doc, bozze, legami] = await Promise.all([
      supabase.from('family_documents').select('id, kind, status, doc_total').eq('id', documentoId).maybeSingle(),
      supabase.from('family_draft_expenses').select('id, status, expense_id, group_id').eq('document_id', documentoId),
      supabase.from('family_expense_documents').select('expense_id').eq('document_id', documentoId),
    ])
    const error = doc.error ?? bozze.error ?? legami.error
    if (error || !doc.data || !bozze.data || !legami.data) return { data: null, error: error ?? { message: 'Rilettura incompleta' } }
    const ids = legami.data.map(r => r.expense_id)
    const spese = ids.length ? await supabase.from('family_expenses').select('*').in('id', ids) : { data: [], error: null }
    if (spese.error || !spese.data || spese.data.length !== ids.length) return { data: null, error: spese.error ?? { message: 'Spese incomplete' } }
    return { data: { documento: doc.data, bozze: bozze.data, spese: spese.data } as FatturaRiletta, error: null }
  },
  async leggiCommissione(id, nota) {
    const [perId, perNota] = await Promise.all([
      supabase.from('family_expenses').select('*').eq('id', id),
      supabase.from('family_expenses').select('*').eq('notes', nota),
    ])
    const error = perId.error ?? perNota.error
    if (error || !perId.data || !perNota.data) return { data: null, error: error ?? { message: 'Rilettura incompleta' } }
    return { data: [...new Map([...perId.data, ...perNota.data].map(r => [r.id, r])).values()] as SpesaFattura[], error: null }
  },
  inserisciSpesa: riga => supabase.from('family_expenses').insert(riga).select('*'),
}

// Il PDF della bolletta: URL firmato per un'ora (il bucket è privato)
export async function urlPdf(percorso: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage.from('scontrini').createSignedUrl(percorso, 3600)
    return error ? null : data?.signedUrl ?? null
  } catch {
    return null
  }
}
