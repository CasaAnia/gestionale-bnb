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
// Quando gli incassi coprono il totale la prenotazione si segna pagata da sé
// (un bottone solo, Ania 10/09/2026), con la stessa strada sicura di «Segna
// come pagato»: il saldo che manca è zero, quindi nasce solo il bollino.
// ============================================================================
import { supabase } from './supabase'
import {
  eseguiRegistraAcconto, eseguiSegnaPagato, rpcMancante, validaEsitoSegnaPagato, ErroreRispostaMalformata, saldoMancanteCent, MESSAGGIO_RILETTURA_PAGAMENTI, pendenteApplicato,
  type AccontoPendente, type MovimentoSaldo, type PagamentoStat, type PrenotazioneStat, type MetodoPagamento,
} from './statistiche'
import { chiavePrenotazione, contoPrenotazione, leggiPrenotazioneUnica, type RigaPrenotazione } from './prenotazioneUnica'
import { leggiMemoria, scriviMemoria } from './memoriaBrowser'
import { colonnaMancante } from './colonnaMancante'
import { messaggioNonSalvato } from './scritturaSicura'
import { AVVISO_BOLLINO_NON_TOLTO } from './pagamentoFoglio'

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

/** Il conto riletto quando è cambiato: le camere (con rooms), i pagamenti e le
 *  cifre di contoPrenotazione, così la scheda e il foglio si aggiornano insieme */
export type ContoRiletto = { righe: RigaPagabile[]; pagamenti: PagamentoLetto[]; conto: { totaleCent: number; ricevutiCent: number } }

export type EsitoPagamento =
  | { esito: 'ok'; pagamenti: PagamentoLetto[]; pagato: boolean; avviso: string | null }
  | { esito: 'errore'; messaggio: string; pagamenti: PagamentoLetto[] | null; contoCambiato?: ContoRiletto; incerto?: TentativoIncerto }

export const ERRORE_CONTO_CAMBIATO = 'Il conto è cambiato mentre il foglio era aperto: niente registrato.'
export const AVVISO_BOLLINO_CONTO_CAMBIATO = 'Pagamento registrato, ma il conto è cambiato nel frattempo (una camera in più o un movimento tolto): il bollino «pagato» non è stato messo. Ricarica la scheda.'

// ── Rilievo 3 (20/09/2026 notte): tre esiti diversi, tre messaggi diversi ──
// Un errore del database (codice SQLSTATE o PGRST) dice che NON è stato
// scritto; una risposta che non arriva (rete, gateway 502/503/504, connessione
// caduta, risposta irriconoscibile) lascia l'esito INCERTO: la scrittura può
// essere passata. In quel caso non si dice «non salvato»: si conserva il
// tentativo (chiave e dati) e si offre «Verifica pagamento», che CONTROLLA
// soltanto, senza registrare niente.
export const MESSAGGIO_ESITO_INCERTO = 'Non riesco a confermare se il pagamento è stato registrato. Premi “Verifica pagamento” per controllare senza registrarlo due volte.'
export const COMANDO_VERIFICA_PAGAMENTO = 'Verifica pagamento'
export const PAGAMENTO_RITROVATO = 'Pagamento ritrovato e confermato.'
export const PAGAMENTO_NON_TROVATO = 'Il pagamento non risulta registrato: puoi salvarlo adesso.'
export const VERIFICA_NON_RIUSCITA = 'Non riesco a controllare i pagamenti registrati: riprova la verifica.'
export const TENTATIVO_IN_SOSPESO = (importo: string, metodo: string, giorno: string) =>
  `C’è un pagamento non confermato: ${importo} · ${metodo} · ${giorno}. Verificalo prima di registrarne altri.`

/** Vero se l'errore dice con certezza che la scrittura NON è avvenuta:
 *  un codice del database (SQLSTATE a cinque caratteri, classi 08 e 57P
 *  escluse: connessione caduta o server che si spegne) o di PostgREST. Tutto
 *  il resto — rete, gateway, risposta malformata — è incerto. */
export function errorePerCerto(e: unknown): boolean {
  if (e instanceof ErroreRispostaMalformata) return false
  const code = String((e as { code?: unknown })?.code ?? '')
  if (/^PGRST\d+$/.test(code)) return true
  if (/^[0-9A-Z]{5}$/.test(code)) return !/^(08|57P)/.test(code)
  return false
}

/** Il tentativo incerto conservato sul telefono per questa prenotazione (chiave, importo, modo, giorno, nota) */
export type TentativoIncerto = { chiave: string; importo: number; metodo: string; giorno: string; nota: string }
export function tentativoIncerto(booking: RigaPagabile): TentativoIncerto | null {
  const t = leggiMemoria(() => localStorage, `ca_acconto_pendente_${chiavePrenotazione(booking)}`)
  try {
    const p = t ? JSON.parse(t) as AccontoPendente & { nota?: string } : null
    return p && typeof p.chiave === 'string' && Number.isFinite(Number(p.amount)) ? { chiave: p.chiave, importo: Number(p.amount), metodo: p.method, giorno: p.paid_on, nota: p.nota ?? '' } : null
  } catch { return null }
}
export const ERRORE_CONTO_CAMBIATO_NON_RILETTO = 'Il conto è cambiato mentre il foglio era aperto e non riesco a rileggerlo: niente registrato, ricarica la scheda.'
class ErroreContoCambiato extends Error { constructor() { super(ERRORE_CONTO_CAMBIATO) } }
const CONTO_CAMBIATO_DAL_SERVER = 'CONTO_CAMBIATO'

/** Il pagamento si registra intero sulla prenotazione. Con `controllo` (il
 *  foglio approvato del 20/09/2026) prima di scrivere si rilegge l'INTERO
 *  conto — camere, totale e pagamenti — e lo si confronta con quello che il
 *  foglio mostrava: se intanto è cambiato (sconto, notti, un incasso da un
 *  altro telefono) non si scrive niente e si torna con `contoCambiato`, così
 *  il foglio aggiorna le cifre invece di salvare un importo diverso da
 *  quello mostrato. Le stesse cifre attese vanno alla funzione server, che
 *  con la proposta 0057 le ricontrolla sotto il suo blocco (CONTO_CAMBIATO):
 *  finché la 0057 non è applicata resta la finestra fra rilettura e scrittura. */
export async function registraPagamento(
  booking: RigaPagabile, righe: RigaPagabile[],
  dati: { importo: number; metodo: MetodoPagamento; giorno: string; nota: string },
  controllo?: { totaleAttesoCent: number; ricevutiAttesiCent: number },
): Promise<EsitoPagamento> {
  const chiave = chiavePrenotazione(booking)
  const segmenti = righePerSaldo(righe)
  const ids = segmenti.map(b => b.id)
  const chiaveMemoria = `ca_acconto_pendente_${chiave}`
  const rileggi = () => supabase.from('payments').select('*').in('booking_id', ids).order('paid_on')
  const leggiPendente = () => { const t = leggiMemoria(() => localStorage, chiaveMemoria); try { return t ? JSON.parse(t) as AccontoPendente : null } catch { return null } }
  // l'intero conto com'è adesso: le camere della prenotazione (come le legge la scheda) e i loro pagamenti
  const rileggiConto = async (): Promise<ContoRiletto | null> => {
    const r = await leggiPrenotazioneUnica(booking, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
    if (r.errore) return null
    const pag = await supabase.from('payments').select('*').in('booking_id', r.righe.map(x => x.id)).order('paid_on')
    if (pag.error || !pag.data) return null
    const pagamenti = pag.data as PagamentoLetto[]
    try { return { righe: r.righe, pagamenti, conto: contoPrenotazione(r.righe, pagamenti) } } catch { return null }
  }
  let contoCambiato: ContoRiletto | null = null
  let cambiatoDalServer = false
  let erroreScrittura: unknown = null   // l'errore grezzo della scrittura, per dire se è certo o incerto
  const rileggiControllando = async () => {
    if (!controllo) return rileggi()
    const adesso = await rileggiConto()
    if (!adesso) return { data: null, error: new Error(MESSAGGIO_RILETTURA_PAGAMENTI) }
    // il nostro stesso pagamento, scritto la volta prima con la risposta persa,
    // non è un incasso di un altro telefono: lo riconosce eseguiRegistraAcconto
    const pendente = leggiPendente()
    const nostro = pendente && pendente.amount === dati.importo && pendente.method === dati.metodo && pendente.paid_on === dati.giorno ? Math.round(pendente.amount * 100) : 0
    const atteso = Math.round(controllo.ricevutiAttesiCent)
    const totaleCambiato = adesso.conto.totaleCent !== Math.round(controllo.totaleAttesoCent)
    const ricevutiCambiati = adesso.conto.ricevutiCent !== atteso && adesso.conto.ricevutiCent !== atteso + nostro
    if (totaleCambiato || ricevutiCambiati) { contoCambiato = adesso; return { data: null, error: new ErroreContoCambiato() } }
    return { data: adesso.pagamenti as PagamentoStat[], error: null }
  }
  // le cifre attese per la funzione server (proposta 0057), in euro
  const attesi = controllo ? { p_totale_atteso: Math.round(controllo.totaleAttesoCent) / 100, p_ricevuti_attesi: Math.round(controllo.ricevutiAttesiCent) / 100 } : {}
  const contoCambiatoDalServer = (e: unknown) => String((e as { message?: unknown })?.message ?? '').includes(CONTO_CAMBIATO_DAL_SERVER)

  const esito = await eseguiRegistraAcconto(booking.id, dati.importo, dati.metodo, dati.giorno, {
    leggiPendente,
    // la custodia porta anche la nota: il tentativo incerto si ritrova intero
    custodisci: p => scriviMemoria(() => localStorage, chiaveMemoria, JSON.stringify({ ...p, nota: dati.nota })),
    dimentica: () => { try { localStorage.removeItem(chiaveMemoria) } catch { /* senza memoria non c'è nulla da togliere */ } },
    rileggiPagamenti: rileggiControllando,
    scrivi: async (p: AccontoPendente, bookingId: string) => {
      const nomeRpc = booking.prenotazione_id ? 'registra_acconto_prenotazione' : 'registra_acconto'
      const argomenti = { p_booking_id: bookingId, p_chiave: p.chiave, p_amount: p.amount, p_metodo: p.method, p_paid_on: p.paid_on }
      let rpc: Awaited<ReturnType<typeof supabase.rpc>>
      try {
        rpc = await supabase.rpc(nomeRpc, { ...argomenti, ...attesi })
        // senza la 0057 la firma con le cifre attese non esiste: si richiama
        // com'è oggi (il controllo resta quello della rilettura qui sopra)
        if (rpc.error && controllo && rpcMancante(rpc.error, nomeRpc)) rpc = await supabase.rpc(nomeRpc, argomenti)
      } catch (e) { erroreScrittura = e ?? new Error('errore di rete'); throw e }
      if (rpc.error) erroreScrittura = rpc.error
      if (rpc.error && contoCambiatoDalServer(rpc.error)) { cambiatoDalServer = true; return { data: null, error: rpc.error } }
      if (!rpc.error) {
        const r = rpc.data as { movimento_id?: unknown; importo?: unknown; soggiorno?: string; contratto?: string; booking_id?: string } | null
        if (!r || typeof r.movimento_id !== 'string' || !Number.isFinite(Number(r.importo)) || Number(r.importo) !== p.amount
          || (booking.prenotazione_id && (r.contratto !== 'prenotazione_v1' || r.soggiorno !== chiave))) return { data: null, error: new ErroreRispostaMalformata() }
        return { data: { id: r.movimento_id, booking_id: r.booking_id || bookingId, amount: Number(r.importo), method: p.method, paid_on: p.paid_on }, error: null }
      }
      if (booking.prenotazione_id || !rpcMancante(rpc.error, 'registra_acconto')) return { data: null, error: rpc.error }
      erroreScrittura = null
      try {
        const { data, error } = await supabase.from('payments').insert({ booking_id: bookingId, amount: p.amount, method: p.method, paid_on: p.paid_on }).select().single()
        if (error) erroreScrittura = error
        return { data, error }
      } catch (e) { erroreScrittura = e ?? new Error('errore di rete'); throw e }
    },
    adesso: () => new Date().toISOString(),
    nuovaChiave: () => crypto.randomUUID(),
  })
  const cambiatoQui = contoCambiato as ContoRiletto | null   // assegnato dentro la rilettura: TypeScript non lo vede
  if (cambiatoQui) return { esito: 'errore', messaggio: ERRORE_CONTO_CAMBIATO, pagamenti: cambiatoQui.pagamenti, contoCambiato: cambiatoQui }
  if (cambiatoDalServer) {
    // la funzione server (0057) ha visto il conto cambiare DOPO la nostra rilettura: si rilegge e si mostra
    const adesso = await rileggiConto()
    if (!adesso) return { esito: 'errore', messaggio: ERRORE_CONTO_CAMBIATO_NON_RILETTO, pagamenti: null }
    return { esito: 'errore', messaggio: ERRORE_CONTO_CAMBIATO, pagamenti: adesso.pagamenti, contoCambiato: adesso }
  }
  if (esito.esito === 'errore') {
    // la scrittura è partita e la risposta non è arrivata (o non si capisce):
    // NON si dice «non salvato». Il tentativo resta custodito sul telefono.
    if (esito.fase === 'movimento' && !errorePerCerto(erroreScrittura)) {
      const t = tentativoIncerto(booking)
      if (t) return { esito: 'errore', messaggio: MESSAGGIO_ESITO_INCERTO, pagamenti: esito.pagamenti as PagamentoLetto[] | null, incerto: t }
    }
    // mancato salvataggio ACCERTATO (il database ha risposto di no): nessun
    // tentativo da custodire, altrimenti riaprendo il foglio sembrerebbe incerto
    if (esito.fase === 'movimento') { try { localStorage.removeItem(chiaveMemoria) } catch { /* niente */ } }
    return { esito: 'errore', messaggio: esito.messaggio, pagamenti: esito.pagamenti as PagamentoLetto[] | null }
  }
  return completaDopoMovimento(booking, righe, dati, (esito.movimento as { id?: string }).id, esito.pagamenti as PagamentoLetto[])
}

/** Dopo che il movimento c'è (appena scritto, o ritrovato): la nota, il
 *  bollino «pagato» se il conto è coperto, la rilettura finale. */
async function completaDopoMovimento(
  booking: RigaPagabile, righe: RigaPagabile[], dati: { metodo: MetodoPagamento; giorno: string; nota: string },
  movimentoId: string | undefined, pagamentiScritti: PagamentoLetto[],
): Promise<EsitoPagamento> {
  const chiave = chiavePrenotazione(booking)
  const segmenti = righePerSaldo(righe)
  const ids = segmenti.map(b => b.id)
  const rileggi = () => supabase.from('payments').select('*').in('booking_id', ids).order('paid_on')

  // La nota è una cortesia: la funzione della 0033 non la prende, si scrive
  // dopo, sulla riga appena nata. Senza la colonna (proposta 0055) lo si dice.
  let avviso: string | null = null
  const nota = dati.nota.trim()
  if (nota && movimentoId) {
    const n = await supabase.from('payments').update({ note: nota }).eq('id', movimentoId)
    if (n.error) avviso = colonnaMancante(n.error) === 'note' ? AVVISO_NOTA_SENZA_0055 : AVVISO_NOTA_NON_SALVATA
  }

  let pagamenti = pagamentiScritti
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

// ── «Verifica pagamento» (rilievo 3): CONTROLLA e basta, non scrive mai ─────
// Rilegge i movimenti della prenotazione e cerca quello del tentativo
// custodito (importo, modo, giorno; una riga in più di quante ce n'erano
// prima di scrivere). Ritrovato → il tentativo si dimentica e si completa
// come dopo un salvataggio (nota, bollino, rilettura). Non trovato → il
// tentativo resta custodito: un nuovo «Salva» uguale riusa la stessa
// chiave (idempotente), uno diverso ne fa una nuova.
export type EsitoVerifica =
  | { esito: 'ritrovato'; pagamenti: PagamentoLetto[]; pagato: boolean; avviso: string | null; tentativo: TentativoIncerto }
  | { esito: 'non_trovato'; pagamenti: PagamentoLetto[]; tentativo: TentativoIncerto }
  | { esito: 'nessun_tentativo' }
  | { esito: 'errore'; messaggio: string }

export async function verificaPagamento(booking: RigaPagabile, righe: RigaPagabile[]): Promise<EsitoVerifica> {
  const chiave = chiavePrenotazione(booking)
  const chiaveMemoria = `ca_acconto_pendente_${chiave}`
  const t = tentativoIncerto(booking)
  if (!t) return { esito: 'nessun_tentativo' }
  const testo = leggiMemoria(() => localStorage, chiaveMemoria)
  let pendente: AccontoPendente | null = null
  try { pendente = testo ? JSON.parse(testo) as AccontoPendente : null } catch { pendente = null }
  if (!pendente) return { esito: 'nessun_tentativo' }
  const ids = righePerSaldo(righe).map(b => b.id)
  let riletti: { data: PagamentoLetto[] | null; error: unknown }
  try { riletti = await supabase.from('payments').select('*').in('booking_id', ids).order('paid_on') as unknown as { data: PagamentoLetto[] | null; error: unknown } } catch (e) { riletti = { data: null, error: e } }
  if (riletti.error || !riletti.data) return { esito: 'errore', messaggio: VERIFICA_NON_RIUSCITA }
  const trovato = pendenteApplicato(pendente, riletti.data as PagamentoStat[])
  if (!trovato) return { esito: 'non_trovato', pagamenti: riletti.data, tentativo: t }
  try { localStorage.removeItem(chiaveMemoria) } catch { /* niente */ }
  const completato = await completaDopoMovimento(booking, righe, { metodo: t.metodo as MetodoPagamento, giorno: t.giorno, nota: t.nota }, (trovato as { id?: string }).id, riletti.data)
  if (completato.esito === 'errore') return { esito: 'errore', messaggio: completato.messaggio }
  return { esito: 'ritrovato', pagamenti: completato.pagamenti, pagato: completato.pagato, avviso: completato.avviso, tentativo: t }
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
  let bollinoContoCambiato = false
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
      const argomenti = { p_booking_id: booking.id, p_chiave: chiaveOperazione, p_metodo: metodo, p_paid_on: giorno }
      // il bollino si chiama SOLO quando il conto è coperto: al server si
      // dice «mancante atteso 0» (0057), così una camera aggiunta nel
      // frattempo non fa nascere un saldo inventato; senza la 0057 si
      // richiama com'è oggi
      let rpc = await supabase.rpc(nomeRpc, { ...argomenti, p_mancante_atteso: 0 })
      if (rpc.error && rpcMancante(rpc.error, nomeRpc)) rpc = await supabase.rpc(nomeRpc, argomenti)
      if (rpc.error && String((rpc.error as { message?: unknown }).message ?? '').includes('CONTO_CAMBIATO')) { bollinoContoCambiato = true; return { data: null, error: rpc.error, flagScritto: false } }
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
  if (esito.esito === 'errore' && bollinoContoCambiato) {
    try { localStorage.removeItem(chiaveMemoria) } catch { /* niente */ }   // niente da ritentare: il conto è un altro
    return { ...esito, messaggio: AVVISO_BOLLINO_CONTO_CAMBIATO }
  }
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
