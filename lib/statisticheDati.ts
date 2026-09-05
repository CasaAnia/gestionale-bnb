'use client'
// Letture per Statistiche e Home — «Statistiche, numeri corretti»
// (05/09/2026): solo il periodo scelto (mai tutto lo storico), a pagine
// oltre le 1.000 righe (lib/statistiche/paginazione), ogni errore riportato
// come testo (la pagina mostra AvvisoAzione + Riprova, mai uno zero
// credibile). Solo prenotazioni confermate/completate. I calcoli stanno in
// lib/statistiche: qui nessuna formula.
import { supabase } from './supabase'
import { messaggioLetturaNonRiuscita } from './prenotazioneScritture'
import { raccogliPagine, raccogliBlocchi, aBlocchi, mappaChiusure, type CameraStat, type PagamentoStat, type FuoriServizio } from './statistiche'
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

// Colonna/tabella non ancora migrata? (PostgREST: colonna sconosciuta / tabella assente)
const colonnaAssente = (e: unknown) => { const c = String((e as { code?: unknown })?.code ?? ''); return c === '42703' || c === 'PGRST204' }
const tabellaAssente = (e: unknown) => { const c = String((e as { code?: unknown })?.code ?? ''); return c === '42P01' || c === 'PGRST205' }

// R12: camere con le date di entrata/uscita dal servizio (proposta 0034);
// senza le colonne (prima della 0034) si ripiega su id, name, active
export async function leggiCamere(cosa = 'caricare le camere'): Promise<Esito<CameraStat[]> & { conDate: boolean }> {
  const conDate = await raccogliPagine<CameraStat>((offset, limite) => supabase.from('rooms').select('id, name, active, in_servizio_dal, fuori_servizio_dal').order('name').range(offset, offset + limite - 1))
  if (!conDate.error) return { data: conDate.data, errore: null, conDate: true }
  if (!colonnaAssente(conDate.error)) return { data: null, errore: messaggioLetturaNonRiuscita(conDate.error, cosa), conDate: false }
  const base = await pagine<CameraStat>(cosa, (offset, limite) => supabase.from('rooms').select('id, name, active').order('name').range(offset, offset + limite - 1))
  return { ...base, conDate: false }
}

// R12: periodi di fuori servizio (room_closures, proposta 0034), a pagine.
// Tabella assente = «periodi non registrati» (dichiarato, non un errore);
// ogni altro errore è visibile.
export type LetturaFuoriServizio = { intervalli: FuoriServizio[]; registrati: boolean }
export async function leggiFuoriServizio(cosa = 'caricare i periodi di fuori servizio'): Promise<Esito<LetturaFuoriServizio>> {
  const r = await raccogliPagine<{ room_id: string; da: string; a: string; motivo: string | null }>((offset, limite) => supabase.from('room_closures').select('room_id, da, a, motivo').order('da').range(offset, offset + limite - 1))
  if (r.error) {
    if (tabellaAssente(r.error)) return { data: { intervalli: [], registrati: false }, errore: null }
    return { data: null, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  }
  return { data: { intervalli: mappaChiusure(r.data), registrati: true }, errore: null }
}

export function leggiEventiSito(da: string, a: string, cosa = 'caricare le visite del sito') {
  return pagine<SiteEvent>(cosa, (offset, limite) => supabase.from('site_events').select('tipo, pagina, fonte, campagna, created_at')
    .gte('created_at', `${da}T00:00:00`).lt('created_at', `${a}T00:00:00`).order('created_at', { ascending: true }).range(offset, offset + limite - 1))
}

// Prenotazioni a blocchi di ID (R5): ogni blocco a pagine, tutto raccolto e deduplicato, stop al primo errore
async function leggiPrenotazioniPerBlocchi(colonna: 'id' | 'group_id', ids: string[], colonne: string, cosa: string): Promise<Esito<PrenotazioneSconto[]>> {
  const r = await raccogliBlocchi<PrenotazioneSconto, string>(aBlocchi(ids), blocco =>
    raccogliPagine<PrenotazioneSconto>((offset, limite) => supabase.from('bookings').select(colonne)
      .in('status', STATI_LETTI).in(colonna, blocco).range(offset, offset + limite - 1) as unknown as PromiseLike<{ data: PrenotazioneSconto[] | null; error: unknown }>),
    b => b.id)
  if (r.error) return { data: null, errore: messaggioLetturaNonRiuscita(r.error, cosa) }
  return { data: r.data, errore: null }
}

// R6/R9: base per il piano di ricostruzione degli incassi storici — tutte le
// prenotazioni confermate/completate CONCLUSE (partenza ≤ oggi, segnate
// pagate o no: regola di Ania), colonne minime, i segmenti dei loro gruppi e
// tutti i movimenti. È l'unica lettura che guarda tutto lo storico: serve a
// dire se lo storico è da ricostruire.
export type DatiRicostruzione = { prenotazioni: PrenotazioneSconto[]; pagamenti: PagamentoStat[]; oggi: string }

export async function leggiRicostruzione(oggi: string): Promise<Esito<DatiRicostruzione>> {
  const colonne = 'id, group_id, room_id, check_in, check_out, total_amount, status, pagato, guest_name, guests(full_name)'
  const cosa = 'caricare lo storico dei pagamenti'
  const [p, pag] = await Promise.all([
    pagine<PrenotazioneSconto>(cosa, (offset, limite) => supabase.from('bookings').select(colonne)
      .in('status', STATI_LETTI).lte('check_out', oggi).order('check_in', { ascending: true }).range(offset, offset + limite - 1) as unknown as PromiseLike<{ data: PrenotazioneSconto[] | null; error: unknown }>),
    leggiTuttiPagamenti(cosa),
  ])
  const errore = p.errore ?? pag.errore
  if (errore) return { data: null, errore }
  const gruppi = [...new Set(p.data!.map(b => b.group_id).filter(Boolean) as string[])]
  let segmenti: PrenotazioneSconto[] = []
  if (gruppi.length > 0) {
    const r = await leggiPrenotazioniPerBlocchi('group_id', gruppi, colonne, cosa)
    if (r.errore) return { data: null, errore: r.errore }
    segmenti = r.data!
  }
  const visti = new Set<string>()
  const prenotazioni = [...p.data!, ...segmenti].filter(b => (visti.has(b.id) ? false : (visti.add(b.id), true)))
  return { data: { prenotazioni, pagamenti: pag.data!, oggi }, errore: null }
}

export type DatiStatistiche = { prenotazioni: PrenotazioneSconto[]; pagamenti: PagamentoStat[]; spese: SpesaPagata[]; camere: CameraStat[]; eventiSito: SiteEvent[]; ricostruzione: DatiRicostruzione; fuoriServizio: LetturaFuoriServizio }

// Tutto ciò che serve alla pagina Statistiche per [da, a); il primo errore ferma tutto
export async function leggiDatiStatistiche(da: string, a: string, oggi: string): Promise<Esito<DatiStatistiche>> {
  const [p, pag, sp, cam, ev, ric, fs] = await Promise.all([leggiPrenotazioni(da, a), leggiPagamenti(da, a), leggiSpese(da, a), leggiCamere(), leggiEventiSito(da, a), leggiRicostruzione(oggi), leggiFuoriServizio()])
  const errore = p.errore ?? pag.errore ?? sp.errore ?? cam.errore ?? ev.errore ?? ric.errore ?? fs.errore
  if (errore) return { data: null, errore }
  return { data: { prenotazioni: p.data!, pagamenti: pag.data!, spese: sp.data!, camere: cam.data!, eventiSito: ev.data!, ricostruzione: ric.data!, fuoriServizio: fs.data! }, errore: null }
}

export type DatiHome = { prenotazioni: PrenotazioneSconto[]; pagamentiMese: PagamentoStat[]; tuttiPagamenti: PagamentoStat[]; prenotazioniConMovimenti: PrenotazioneSconto[]; spese: SpesaPagata[]; camere: CameraStat[]; ricostruzione: DatiRicostruzione; fuoriServizio: LetturaFuoriServizio }

// Home: il mese [da, a) più i soggiorni con movimenti registrati (per «Da incassare»)
export async function leggiDatiHome(da: string, a: string, oggi: string): Promise<Esito<DatiHome>> {
  const colonne = '*, rooms(name), guests(full_name, phone)'
  const [p, pag, sp, cam, ric, fs] = await Promise.all([leggiPrenotazioni(da, a, colonne), leggiTuttiPagamenti(), leggiSpese(da, a), leggiCamere(), leggiRicostruzione(oggi), leggiFuoriServizio()])
  const errore = p.errore ?? pag.errore ?? sp.errore ?? cam.errore ?? ric.errore ?? fs.errore
  if (errore) return { data: null, errore }
  // R5: gli ID si leggono a BLOCCHI (mai un taglio silenzioso a 500)
  const perBlocchi = (colonna: 'id' | 'group_id', ids: string[]) => leggiPrenotazioniPerBlocchi(colonna, ids, colonne, 'caricare le prenotazioni da incassare')
  const idsMese = new Set(p.data!.map(b => b.id))
  const idsFuori = [...new Set(pag.data!.map(x => x.booking_id))].filter(id => !idsMese.has(id))
  let fuori: PrenotazioneSconto[] = []
  if (idsFuori.length > 0) {
    const r = await perBlocchi('id', idsFuori)
    if (r.errore) return { data: null, errore: r.errore }
    fuori = r.data!
  }
  // I segmenti di un soggiorno con movimenti possono stare fuori dal mese: si
  // ricompongono i gruppi toccati, così «Da incassare» vede il soggiorno intero
  const gruppi = new Set([...p.data!, ...fuori].filter(b => pag.data!.some(x => x.booking_id === b.id)).map(b => b.group_id).filter(Boolean) as string[])
  let segmenti: PrenotazioneSconto[] = []
  if (gruppi.size > 0) {
    const r = await perBlocchi('group_id', [...gruppi])
    if (r.errore) return { data: null, errore: r.errore }
    segmenti = r.data!
  }
  const visti = new Set<string>()
  const conMovimenti = [...p.data!, ...fuori, ...segmenti].filter(b => (visti.has(b.id) ? false : (visti.add(b.id), true)))
  return { data: { prenotazioni: p.data!, pagamentiMese: pag.data!.filter(x => !!x.paid_on && x.paid_on >= da && x.paid_on < a), tuttiPagamenti: pag.data!, prenotazioniConMovimenti: conMovimenti, spese: sp.data!, camere: cam.data!, ricostruzione: ric.data!, fuoriServizio: fs.data! }, errore: null }
}
