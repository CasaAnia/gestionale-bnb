'use client'
// Letture per Statistiche e Home — «Statistiche, numeri corretti»
// (05/09/2026): solo il periodo scelto (mai tutto lo storico), a pagine
// oltre le 1.000 righe (lib/statistiche/paginazione), ogni errore riportato
// come testo (la pagina mostra AvvisoAzione + Riprova, mai uno zero
// credibile). Solo prenotazioni confermate/completate. I calcoli stanno in
// lib/statistiche: qui nessuna formula.
import { supabase } from './supabase'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { raccogliPagine, type CameraStat, type PagamentoStat } from './statistiche'
import type { SpesaPagata } from './statistiche/intervallo'
import type { PrenotazioneSconto } from './statistiche/sconti'
import type { SiteEvent } from './siteStats'

export const STATI_LETTI = ['confermata', 'completata']

type Esito<T> = { data: T | null; errore: string | null }

async function pagine<T>(cosa: string, pagina: (offset: number, limite: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<Esito<T[]>> {
  const r = await raccogliPagine<T>(pagina)
  if (r.error) return { data: null, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  return { data: r.data, errore: null }
}

// Prenotazioni confermate che toccano [da, a): check_in < a e check_out > da
export function leggiPrenotazioni(da: string, a: string, colonne = '*', cosa = 'caricare le prenotazioni') {
  return pagine<PrenotazioneSconto>(cosa, (offset, limite) => supabase.from('bookings').select(colonne)
    .in('status', STATI_LETTI).lt('check_in', a).gt('check_out', da)
    .order('check_in', { ascending: true }).range(offset, offset + limite - 1) as unknown as PromiseLike<{ data: PrenotazioneSconto[] | null; error: unknown }>)
}

export function leggiPagamenti(da: string, a: string, cosa = 'caricare gli incassi') {
  return pagine<PagamentoStat>(cosa, (offset, limite) => supabase.from('payments').select('booking_id, amount, paid_on')
    .gte('paid_on', da).lt('paid_on', a).order('paid_on', { ascending: true }).range(offset, offset + limite - 1))
}

// Tutti i movimenti (tabella piccola: solo acconti e saldi registrati), a pagine
export function leggiTuttiPagamenti(cosa = 'caricare gli incassi') {
  return pagine<PagamentoStat>(cosa, (offset, limite) => supabase.from('payments').select('booking_id, amount, paid_on')
    .order('paid_on', { ascending: true }).range(offset, offset + limite - 1))
}

// Spese del B&B (gruppi con ambito azienda) per data di pagamento: paid_at se
// c'è, altrimenti expense_date
export function leggiSpese(da: string, a: string, cosa = 'caricare le spese') {
  return pagine<SpesaPagata>(cosa, (offset, limite) => supabase.from('family_expenses')
    .select('expense_date, amount, paid_at, family_groups!inner(ambito)').eq('family_groups.ambito', 'azienda')
    .or(`and(paid_at.gte.${da},paid_at.lt.${a}),and(paid_at.is.null,expense_date.gte.${da},expense_date.lt.${a})`)
    .order('expense_date', { ascending: true }).range(offset, offset + limite - 1) as unknown as PromiseLike<{ data: SpesaPagata[] | null; error: unknown }>)
}

export function leggiCamere(cosa = 'caricare le camere') {
  return pagine<CameraStat>(cosa, (offset, limite) => supabase.from('rooms').select('id, name, active').order('name').range(offset, offset + limite - 1))
}

export function leggiEventiSito(da: string, a: string, cosa = 'caricare le visite del sito') {
  return pagine<SiteEvent>(cosa, (offset, limite) => supabase.from('site_events').select('tipo, pagina, fonte, campagna, created_at')
    .gte('created_at', `${da}T00:00:00`).lt('created_at', `${a}T00:00:00`).order('created_at', { ascending: true }).range(offset, offset + limite - 1))
}

export type DatiStatistiche = { prenotazioni: PrenotazioneSconto[]; pagamenti: PagamentoStat[]; spese: SpesaPagata[]; camere: CameraStat[]; eventiSito: SiteEvent[] }

// Tutto ciò che serve alla pagina Statistiche per [da, a); il primo errore ferma tutto
export async function leggiDatiStatistiche(da: string, a: string): Promise<Esito<DatiStatistiche>> {
  const [p, pag, sp, cam, ev] = await Promise.all([leggiPrenotazioni(da, a), leggiPagamenti(da, a), leggiSpese(da, a), leggiCamere(), leggiEventiSito(da, a)])
  const errore = p.errore ?? pag.errore ?? sp.errore ?? cam.errore ?? ev.errore
  if (errore) return { data: null, errore }
  return { data: { prenotazioni: p.data!, pagamenti: pag.data!, spese: sp.data!, camere: cam.data!, eventiSito: ev.data! }, errore: null }
}

export type DatiHome = { prenotazioni: PrenotazioneSconto[]; pagamentiMese: PagamentoStat[]; tuttiPagamenti: PagamentoStat[]; prenotazioniConMovimenti: PrenotazioneSconto[]; spese: SpesaPagata[]; camere: CameraStat[] }

// Home: il mese [da, a) più i soggiorni con movimenti registrati (per «Da incassare»)
export async function leggiDatiHome(da: string, a: string): Promise<Esito<DatiHome>> {
  const colonne = '*, rooms(name), guests(full_name, phone)'
  const [p, pag, sp, cam] = await Promise.all([leggiPrenotazioni(da, a, colonne), leggiTuttiPagamenti(), leggiSpese(da, a), leggiCamere()])
  const errore = p.errore ?? pag.errore ?? sp.errore ?? cam.errore
  if (errore) return { data: null, errore }
  const idsMese = new Set(p.data!.map(b => b.id))
  const idsFuori = [...new Set(pag.data!.map(x => x.booking_id))].filter(id => !idsMese.has(id))
  let fuori: PrenotazioneSconto[] = []
  if (idsFuori.length > 0) {
    const r = await pagine<PrenotazioneSconto>('caricare le prenotazioni da incassare', (offset, limite) => supabase.from('bookings').select(colonne)
      .in('status', STATI_LETTI).in('id', idsFuori.slice(0, 500)).range(offset, offset + limite - 1) as unknown as PromiseLike<{ data: PrenotazioneSconto[] | null; error: unknown }>)
    if (r.errore) return { data: null, errore: r.errore }
    fuori = r.data!
  }
  // I segmenti di un soggiorno con movimenti possono stare fuori dal mese: si
  // ricompongono i gruppi toccati, così «Da incassare» vede il soggiorno intero
  const gruppi = new Set([...p.data!, ...fuori].filter(b => pag.data!.some(x => x.booking_id === b.id)).map(b => b.group_id).filter(Boolean) as string[])
  let segmenti: PrenotazioneSconto[] = []
  if (gruppi.size > 0) {
    const r = await pagine<PrenotazioneSconto>('caricare le prenotazioni da incassare', (offset, limite) => supabase.from('bookings').select(colonne)
      .in('status', STATI_LETTI).in('group_id', [...gruppi].slice(0, 500)).range(offset, offset + limite - 1) as unknown as PromiseLike<{ data: PrenotazioneSconto[] | null; error: unknown }>)
    if (r.errore) return { data: null, errore: r.errore }
    segmenti = r.data!
  }
  const visti = new Set<string>()
  const conMovimenti = [...p.data!, ...fuori, ...segmenti].filter(b => (visti.has(b.id) ? false : (visti.add(b.id), true)))
  return { data: { prenotazioni: p.data!, pagamentiMese: pag.data!.filter(x => !!x.paid_on && x.paid_on >= da && x.paid_on < a), tuttiPagamenti: pag.data!, prenotazioniConMovimenti: conMovimenti, spese: sp.data!, camere: cam.data! }, errore: null }
}
