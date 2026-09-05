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
  type Eccezione, type Rinvio, type RichiestaDC, type PrenotazioneDC,
} from './daControllare'
import type { PagamentoStat, DocumentoStat } from './statistiche/tipi'

export const MESSAGGIO_NON_RIESCO = 'Non riesco a controllare, riprova'

export type StatoDaControllareHome =
  | { stato: 'caricamento' }
  | { stato: 'errore'; errore: string }
  | { stato: 'pronto'; eccezioni: Eccezione[]; rinviiDisponibili: boolean; oggi: string }

type Dati = { oggi: string; richieste: RichiestaDC[]; prenotazioni: PrenotazioneDC[]; pagamenti: PagamentoStat[]; documenti: DocumentoStat[]; rinvii: Rinvio[]; rinviiDisponibili: boolean }

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
  const gruppi = [...new Set(p.data!.map(b => b.group_id).filter(Boolean) as string[])]
  let segmenti: PrenotazioneDC[] = []
  if (gruppi.length > 0) {
    const r = await raccogliBlocchi<PrenotazioneDC, string>(aBlocchi(gruppi), blocco =>
      raccogliPagine<PrenotazioneDC>((offset, limite) => supabase.from('bookings').select(COLONNE_PRENOTAZIONI)
        .in('status', STATI_LETTI).in('group_id', blocco).range(offset, offset + limite - 1) as unknown as RispostaPren), b => b.id)
    if (r.error) return { data: null, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
    segmenti = r.data
  }
  const visti = new Set<string>()
  return { data: [...p.data!, ...segmenti].filter(b => (visti.has(b.id) ? false : (visti.add(b.id), true))), errore: null }
}

function leggiRichieste() {
  return pagine<RichiestaDC>('controllare le richieste', (offset, limite) => supabase.from('richieste')
    .select('id, nome, cognome, arrivo, partenza, stato, created_at, proposta_inviata_at').in('stato', STATI_APERTI)
    .order('created_at', { ascending: true }).range(offset, offset + limite - 1))
}

function leggiPagamenti() {
  return pagine<PagamentoStat>('controllare i pagamenti', (offset, limite) => supabase.from('payments')
    .select('booking_id, amount, paid_on').order('paid_on', { ascending: true }).range(offset, offset + limite - 1))
}

// Solo le fatture da pagare già scadute (sola lettura di family_documents)
function leggiFattureScadute(oggi: string) {
  return pagine<DocumentoStat>('controllare le fatture', (offset, limite) => supabase.from('family_documents')
    .select('id, kind, status, due_date, doc_total, supplier').eq('kind', 'fattura').eq('status', 'approvata_da_pagare').lt('due_date', oggi)
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
  const [ric, pren, pag, doc, rin] = await Promise.all([leggiRichieste(), leggiPrenotazioni(da, a), leggiPagamenti(), leggiFattureScadute(oggi), leggiRinvii(oggi)])
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
  pubblica({ stato: 'pronto', oggi: d.oggi, rinviiDisponibili: d.rinviiDisponibili, eccezioni: daControllareHome({ ...d, adesso: new Date() }) })
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
