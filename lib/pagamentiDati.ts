'use client'
// ============================================================================
// REGISTRARE UN PAGAMENTO dalla scheda nuova (16/09/2026): le chiamate a
// Supabase, col CONTRATTO UNICO dei movimenti di lib/statistiche/pagato
// (eseguiRegistraAcconto, eseguiSegnaPagato): chiave custodita prima
// dell'invio, rilettura dei pagamenti prima di ogni tentativo, RPC idempotente
// della 0033 oppure INSERT, risposta malformata mai presa per buona.
//
// È la stessa strada di «Aggiungi acconto» della scheda attuale, che la tiene
// dentro la pagina: qui sta in una libreria, così la scheda nuova la usa
// senza riscriverla e la scheda attuale resta com'è.
//
// Con cambio camera o camera aggiunta il pagamento si DIVIDE fra le parti in
// ordine di tempo (regola fissa n. 9, Ania 20/09/2026): una riga per parte.
//
// Quando gli incassi coprono il totale la prenotazione si segna pagata da sé
// (un bottone solo, Ania 10/09/2026), con la stessa strada sicura di «Segna
// come pagato»: il saldo che manca è zero, quindi nasce solo il bollino.
// ============================================================================
import { supabase } from './supabase'
import {
  eseguiRegistraAcconto, eseguiSegnaPagato, rpcMancante, validaEsitoSegnaPagato, ErroreRispostaMalformata, saldoMancanteCent, MESSAGGIO_RILETTURA_PAGAMENTI,
  type AccontoPendente, type MovimentoSaldo, type PagamentoStat, type PrenotazioneStat, type MetodoPagamento,
} from './statistiche'
import { chiavePrenotazione, type RigaPrenotazione } from './prenotazioneUnica'
import { leggiMemoria, scriviMemoria } from './memoriaBrowser'
import { colonnaMancante } from './colonnaMancante'
import { messaggioNonSalvato } from './scritturaSicura'
import { AVVISO_BOLLINO_NON_TOLTO } from './pagamentoFoglio'
import { pianoDaUsare, notaParte } from './pagamentoDiviso'

export const AVVISO_NOTA_SENZA_0055 = 'Pagamento registrato; la nota però no: serve la proposta 0055 applicata su Supabase.'
export const AVVISO_NOTA_NON_SALVATA = 'Pagamento registrato, ma la nota non è stata salvata.'
export const AVVISO_RILETTURA_CONTO = 'Pagamento registrato, ma non riesco a rileggere il conto: ricarica la scheda.'
export const AVVISO_RILETTURA_DOPO_TOLTO = 'Pagamento tolto, ma non riesco a rileggere il conto: ricarica la scheda.'
export const ERRORE_PAGAMENTO_NON_TROVATO = 'Il pagamento non c’è più: ricarica la scheda.'

export type RigaPagabile = RigaPrenotazione & { pagato?: boolean | null }

/** Le righe come le vede il saldo: un tratto annullato non è più dovuto, ma
 *  il suo incasso resta nel conto (stessa regola della scheda attuale). */
export const righePerSaldo = (righe: RigaPagabile[]): PrenotazioneStat[] =>
  righe.map(r => (r.status === 'annullata' ? { ...r, total_amount: 0 } : r)) as unknown as PrenotazioneStat[]

export type PagamentoLetto = PagamentoStat & { id?: string; method?: string | null; note?: string | null }

export type EsitoPagamento =
  | { esito: 'ok'; pagamenti: PagamentoLetto[]; pagato: boolean; avviso: string | null }
  | { esito: 'errore'; messaggio: string; pagamenti: PagamentoLetto[] | null }

export async function registraPagamento(
  booking: RigaPagabile, righe: RigaPagabile[],
  dati: { importo: number; metodo: MetodoPagamento; giorno: string; nota: string },
): Promise<EsitoPagamento> {
  const chiave = chiavePrenotazione(booking)
  const segmenti = righePerSaldo(righe)
  const ids = segmenti.map(b => b.id)
  const rileggi = () => supabase.from('payments').select('*').in('booking_id', ids).order('paid_on')

  // REGOLA FISSA n. 9 (Ania, 20/09/2026): con cambio camera o camera aggiunta
  // il pagamento si divide fra le parti del soggiorno in ordine di tempo,
  // saldando del tutto la prima prima di passare alla seconda. Il piano delle
  // parti si custodisce sul telefono: se la PWA si ricarica a metà, al nuovo
  // tentativo le parti sono le stesse (lib/pagamentoDiviso).
  let primaLettura: { data: PagamentoLetto[] | null; error: unknown }
  try { primaLettura = await rileggi() as { data: PagamentoLetto[] | null; error: unknown } } catch (e) { primaLettura = { data: null, error: e ?? new Error('errore sconosciuto') } }
  if (primaLettura.error || !primaLettura.data) return { esito: 'errore', messaggio: MESSAGGIO_RILETTURA_PAGAMENTI, pagamenti: null }
  const amountCent = Math.round(dati.importo * 100)
  const chiavePiano = `ca_acconto_piano_${chiave}`
  const custodito = (() => { const t = leggiMemoria(() => localStorage, chiavePiano); try { return t ? JSON.parse(t) as unknown : null } catch { return null } })()
  const piano = pianoDaUsare(custodito, righe, primaLettura.data, { amountCent, method: dati.metodo, paid_on: dati.giorno })
  if (piano.parti.length === 0) piano.parti = [{ booking_id: booking.id, amountCent }]
  if (piano.parti.length > 1) scriviMemoria(() => localStorage, chiavePiano, JSON.stringify(piano))

  let avviso: string | null = null
  let pagamenti: PagamentoLetto[] = primaLettura.data
  const nota = notaParte(dati.nota, amountCent, piano.parti.length)
  for (const parte of piano.parti) {
    const chiaveMemoria = piano.parti.length > 1 ? `ca_acconto_pendente_${chiave}_${parte.booking_id}` : `ca_acconto_pendente_${chiave}`
    const esito = await eseguiRegistraAcconto(parte.booking_id, parte.amountCent / 100, dati.metodo, dati.giorno, {
      leggiPendente: () => { const t = leggiMemoria(() => localStorage, chiaveMemoria); try { return t ? JSON.parse(t) as AccontoPendente : null } catch { return null } },
      custodisci: p => scriviMemoria(() => localStorage, chiaveMemoria, JSON.stringify(p)),
      dimentica: () => { try { localStorage.removeItem(chiaveMemoria) } catch { /* senza memoria non c'è nulla da togliere */ } },
      rileggiPagamenti: rileggi,
      scrivi: async (p: AccontoPendente, bookingId: string) => {
        const nomeRpc = booking.prenotazione_id ? 'registra_acconto_prenotazione' : 'registra_acconto'
        const rpc = await supabase.rpc(nomeRpc, { p_booking_id: bookingId, p_chiave: p.chiave, p_amount: p.amount, p_metodo: p.method, p_paid_on: p.paid_on })
        if (!rpc.error) {
          const r = rpc.data as { movimento_id?: unknown; importo?: unknown; soggiorno?: string; contratto?: string; booking_id?: string } | null
          if (!r || typeof r.movimento_id !== 'string' || !Number.isFinite(Number(r.importo)) || Number(r.importo) !== p.amount
            || (booking.prenotazione_id && (r.contratto !== 'prenotazione_v1' || r.soggiorno !== chiave))) return { data: null, error: new ErroreRispostaMalformata() }
          return { data: { id: r.movimento_id, booking_id: r.booking_id || bookingId, amount: Number(r.importo), method: p.method, paid_on: p.paid_on }, error: null }
        }
        if (booking.prenotazione_id || !rpcMancante(rpc.error, 'registra_acconto')) return { data: null, error: rpc.error }
        const { data, error } = await supabase.from('payments').insert({ booking_id: bookingId, amount: p.amount, method: p.method, paid_on: p.paid_on }).select().single()
        return { data, error }
      },
      adesso: () => new Date().toISOString(),
      nuovaChiave: () => crypto.randomUUID(),
    })
    // Una parte non scritta: ci si ferma qui, il piano custodito resta per il
    // nuovo tentativo (le parti già scritte si riconoscono alla rilettura).
    if (esito.esito === 'errore') return { esito: 'errore', messaggio: esito.messaggio, pagamenti: esito.pagamenti as PagamentoLetto[] | null }
    pagamenti = esito.pagamenti as PagamentoLetto[]

    // La nota è una cortesia: la funzione della 0033 non la prende, si scrive
    // dopo, sulla riga appena nata. Senza la colonna (proposta 0055) lo si dice.
    const movimentoId = (esito.movimento as { id?: string }).id
    if (nota && movimentoId && !esito.giaApplicato) {
      const n = await supabase.from('payments').update({ note: nota }).eq('id', movimentoId)
      if (n.error) avviso = colonnaMancante(n.error) === 'note' ? AVVISO_NOTA_SENZA_0055 : AVVISO_NOTA_NON_SALVATA
    }
  }
  try { localStorage.removeItem(chiavePiano) } catch { /* niente */ }

  let pagato = righe.some(r => !!r.pagato)
  if (!pagato && saldoMancanteCent(segmenti, pagamenti) <= 0) {
    const bollino = await segnaPagata(booking, righe, ids, chiave, dati.metodo, dati.giorno, rileggi)
    if (bollino.esito === 'errore') return { esito: 'ok', pagamenti: (bollino.pagamenti as PagamentoLetto[] | null) ?? pagamenti, pagato: false, avviso: bollino.messaggio }
    pagamenti = bollino.pagamenti as PagamentoLetto[]
    pagato = true
  }

  // Il server può aver ricalcolato dopo un incasso da un altro telefono: si rilegge.
  const riletti = await rileggi()
  if (!riletti.error && riletti.data) pagamenti = riletti.data as PagamentoLetto[]
  else avviso = avviso ?? AVVISO_RILETTURA_CONTO
  return { esito: 'ok', pagamenti, pagato, avviso }
}

// «Segna come pagato» — contratto unico (lib/statistiche/pagato): chiave
// custodita PRIMA dell'invio e riusata finché non riesce, RPC segna_pagato
// della 0033 oppure, senza RPC, INSERT + bollino su TUTTI i tratti con
// verifica delle righe toccate. Le stesse regole della scheda attuale.
async function segnaPagata(
  booking: RigaPagabile, righe: RigaPagabile[], ids: string[], chiave: string, metodo: MetodoPagamento, giorno: string,
  rileggi: () => PromiseLike<{ data: PagamentoStat[] | null; error: unknown }>,
) {
  const chiaveMemoria = `ca_pagato_chiave_${chiave}`
  const esito = await eseguiSegnaPagato(righePerSaldo(righe), giorno, metodo, booking.id, {
    custodisciChiave: () => {
      const salvata = leggiMemoria(() => localStorage, chiaveMemoria)
      if (salvata) return salvata
      const nuova = crypto.randomUUID()
      return scriviMemoria(() => localStorage, chiaveMemoria, nuova) ? nuova : null
    },
    rileggiPagamenti: rileggi,
    scrivi: async (chiaveOperazione: string, m: MovimentoSaldo | null) => {
      const nomeRpc = booking.prenotazione_id ? 'segna_pagato_prenotazione' : 'segna_pagato'
      const rpc = await supabase.rpc(nomeRpc, { p_booking_id: booking.id, p_chiave: chiaveOperazione, p_metodo: metodo, p_paid_on: giorno })
      if (!rpc.error) {
        const valido = validaEsitoSegnaPagato(rpc.data)
        const sistemate = righe.filter(r => ['confermata', 'completata'].includes(r.status)).length
        if (!valido || valido.soggiorno !== chiave || (booking.prenotazione_id && (rpc.data?.contratto !== 'prenotazione_v1' || valido.segmenti_aggiornati !== sistemate))) {
          return { data: null, error: new ErroreRispostaMalformata(), flagScritto: false }
        }
        const riga = valido.movimento_id ? { id: valido.movimento_id, booking_id: rpc.data?.booking_id || booking.id, amount: valido.importo, method: metodo, paid_on: giorno } : null
        return { data: riga, error: null, flagScritto: true }
      }
      if (booking.prenotazione_id || !rpcMancante(rpc.error, 'segna_pagato')) return { data: null, error: rpc.error, flagScritto: false }
      // Ripiego senza la 0033: INSERT semplice (la protezione è la rilettura prima di ogni tentativo)
      if (!m) return { data: null, error: null, flagScritto: false }
      const { data, error } = await supabase.from('payments').insert({ booking_id: m.booking_id, amount: m.amount, method: m.method, paid_on: m.paid_on }).select().single()
      return { data, error, flagScritto: false }
    },
    segnaFlag: async () => {
      const { data, error } = await supabase.from('bookings').update({ pagato: true }).in('id', ids).select('id')
      return { error: error || (data?.length !== ids.length ? new Error('Non tutte le camere sono state aggiornate') : null), righe: data?.length ?? 0 }
    },
  })
  if (esito.esito === 'ok') { try { localStorage.removeItem(chiaveMemoria) } catch { /* niente */ } }
  return esito
}

// ── TOGLIERE UN PAGAMENTO (17/09/2026) ──────────────────────────────────────
// La stessa cancellazione di «rimuovi» della scheda attuale (delete sulla riga
// di payments), con in più: il controllo che la riga toccata sia UNA, la
// rilettura dei pagamenti rimasti e, se senza quel pagamento resta qualcosa
// da incassare, il bollino «pagato» tolto da tutte le camere (con verifica
// delle righe toccate). Niente viene dato per fatto senza esserlo.
export type EsitoTolto =
  | { esito: 'ok'; pagamenti: PagamentoLetto[]; pagato: boolean; avviso: string | null }
  | { esito: 'errore'; messaggio: string }

export async function togliPagamento(righe: RigaPagabile[], pagamentoId: string): Promise<EsitoTolto> {
  const segmenti = righePerSaldo(righe)
  const ids = segmenti.map(b => b.id)
  let cancellate: { id: string }[] | null = null
  try {
    const { data, error } = await supabase.from('payments').delete().eq('id', pagamentoId).select('id')
    if (error) return { esito: 'errore', messaggio: messaggioNonSalvato(error) }
    cancellate = (data ?? []) as { id: string }[]
  } catch (err) {
    return { esito: 'errore', messaggio: messaggioNonSalvato(err) }
  }
  if (cancellate.length !== 1) return { esito: 'errore', messaggio: ERRORE_PAGAMENTO_NON_TROVATO }

  let avviso: string | null = null
  let pagamenti: PagamentoLetto[] | null = null
  const riletti = await supabase.from('payments').select('*').in('booking_id', ids).order('paid_on')
  if (!riletti.error && riletti.data) pagamenti = riletti.data as PagamentoLetto[]
  else { avviso = AVVISO_RILETTURA_DOPO_TOLTO }

  let pagato = righe.some(r => !!r.pagato)
  if (pagato && pagamenti && saldoMancanteCent(segmenti, pagamenti) > 0) {
    const { data, error } = await supabase.from('bookings').update({ pagato: false }).in('id', ids).select('id')
    if (error || (data?.length ?? 0) !== ids.length) avviso = avviso ?? AVVISO_BOLLINO_NON_TOLTO
    else pagato = false
  }
  return { esito: 'ok', pagamenti: pagamenti ?? [], pagato, avviso }
}
