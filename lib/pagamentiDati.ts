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
  eseguiRegistraAcconto, eseguiSegnaPagato, rpcMancante, validaEsitoSegnaPagato, ErroreRispostaMalformata, saldoMancanteCent, MESSAGGIO_RILETTURA_PAGAMENTI, ritrovaPendente,
  type AccontoPendente, type MovimentoSaldo, type PagamentoStat, type PrenotazioneStat, type MetodoPagamento,
} from './statistiche'
import { chiavePrenotazione, contoPrenotazione, leggiPrenotazioneUnica, type RigaPrenotazione } from './prenotazioneUnica'
import { leggiMemoria, scriviMemoria } from './memoriaBrowser'
import { colonnaMancante } from './colonnaMancante'
import { messaggioNonSalvato } from './scritturaSicura'
import { AVVISO_BOLLINO_NON_TOLTO } from './pagamentoFoglio'

export const AVVISO_NOTA_SENZA_0055 = 'Pagamento registrato; la nota però no: serve la proposta 0055 applicata su Supabase.'
export const AVVISO_NOTA_NON_SALVATA = 'Pagamento registrato, ma la nota non è stata salvata.'
// La nota si scrive SOLO se il movimento non ne ha già una (21/09/2026): una
// nota scritta nel frattempo da un altro telefono non si sovrascrive in silenzio
export const AVVISO_NOTA_GIA_PRESENTE = 'Pagamento registrato; la nota non è stata scritta perché il movimento ne ha già una diversa.'
// Movimento ritrovato per stima (senza la chiave): l'incasso si conferma, la nota no
export const AVVISO_NOTA_MOVIMENTO_STIMATO = 'Pagamento ritrovato e confermato; la nota non è stata scritta perché il movimento non è identificato con certezza.'
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
  | { esito: 'ok'; pagamenti: PagamentoLetto[]; pagato: boolean; avviso: string | null; giaRegistrato?: boolean }
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
// Non trovato ≠ fallito: la richiesta di prima può essere ancora in corso. Il
// tentativo resta custodito e si rimanda con la STESSA chiave (idempotente).
export const PAGAMENTO_NON_TROVATO = 'Il pagamento non risulta ancora registrato. Puoi rimandarlo: se intanto è arrivato, non si registra due volte.'
export const COMANDO_RIPROVA_PAGAMENTO = 'Riprova lo stesso pagamento'
// Scritto con l'INSERT di ripiego (senza funzione server): non c'è una chiave
// che renda sicuro il rinvio, quindi ci si ferma
export const PAGAMENTO_NON_RIPROVABILE = 'Il pagamento non risulta registrato. Senza la funzione del server non posso rimandarlo in sicurezza: controlla i movimenti nella scheda e chiedi assistenza.'
export const VERIFICA_NON_RIUSCITA = 'Non riesco a controllare i pagamenti registrati: riprova la verifica.'
// C'è già un tentativo non confermato per questa prenotazione e il pagamento
// chiesto adesso è un ALTRO: non si scrive niente, altrimenti nascerebbe una
// chiave nuova accanto a una scrittura che potrebbe essere solo tardiva.
export const MESSAGGIO_TENTATIVO_DA_VERIFICARE = 'C’è un pagamento non confermato su questa prenotazione: verificalo prima di registrarne un altro.'
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
export type TentativoIncerto = { chiave: string; importo: number; metodo: string; giorno: string; nota: string; senzaChiave: boolean }

// ── La custodia e il CAMBIO DI IDENTITÀ della prenotazione (21/09/2026) ─────
// La custodia vive sotto `ca_acconto_pendente_<identità del soggiorno>`, e
// l'identità è prenotazione_id, altrimenti group_id, altrimenti l'id della
// riga. «Aggiungi camera» (anche da un altro telefono) scrive prenotazione_id
// su righe che prima erano singole o solo in gruppo: da quel momento
// l'indirizzo cambia e il tentativo resta scritto ma irraggiungibile —
// «nessun tentativo», campi liberi, e la registrazione dopo nascerebbe con
// una chiave NUOVA, cioè un secondo pagamento se la prima scrittura era solo
// tardiva. Le identità possibili si ricavano dai LEGAMI veri delle righe
// (prenotazione_id, group_id, id), mai da importo, data o cliente.
export const PREFISSO_CUSTODIA = 'ca_acconto_pendente_'
export function identitaPossibili(booking: RigaPagabile, righe?: RigaPagabile[]): string[] {
  const viste = new Set<string>()
  const aggiungi = (v?: string | null) => { if (typeof v === 'string' && v) viste.add(v) }
  aggiungi(chiavePrenotazione(booking))   // quella di adesso, sempre per prima
  aggiungi(booking.prenotazione_id); aggiungi(booking.group_id); aggiungi(booking.id)
  for (const r of righe ?? []) { aggiungi(r.prenotazione_id); aggiungi(r.group_id); aggiungi(r.id) }
  return [...viste]
}

type CustodiaTrovata = { chiaveMemoria: string; pendente: AccontoPendente & { nota?: string } }
function custodieTrovate(booking: RigaPagabile, righe?: RigaPagabile[]): CustodiaTrovata[] {
  const fuori: CustodiaTrovata[] = []
  for (const identita of identitaPossibili(booking, righe)) {
    const chiaveMemoria = PREFISSO_CUSTODIA + identita
    const testo = leggiMemoria(() => localStorage, chiaveMemoria)
    if (!testo) continue
    try {
      const p = JSON.parse(testo) as AccontoPendente & { nota?: string }
      if (p && typeof p.chiave === 'string' && Number.isFinite(Number(p.amount))) fuori.push({ chiaveMemoria, pendente: p })
    } catch { /* custodia illeggibile: si lascia dov'è, non si butta */ }
  }
  return fuori
}

/** Riporta sotto l'identità di ADESSO il tentativo rimasto sotto un'identità
 *  precedente della stessa prenotazione, con la sua chiave e i suoi dati.
 *  Non sovrascrive mai una custodia già presente e non ne cancella nessuna:
 *  con più tentativi si sposta solo il più vecchio (per `creato`, a parità
 *  l'indirizzo), gli altri restano dove sono e si ritrovano al giro dopo. */
function allineaCustodia(booking: RigaPagabile, righe?: RigaPagabile[]): CustodiaTrovata[] {
  const trovate = custodieTrovate(booking, righe)
  const corrente = PREFISSO_CUSTODIA + chiavePrenotazione(booking)
  if (trovate.length === 0 || trovate.some(c => c.chiaveMemoria === corrente)) return trovate
  const piuVecchia = [...trovate].sort((a, z) =>
    String(a.pendente.creato ?? '').localeCompare(String(z.pendente.creato ?? '')) || a.chiaveMemoria.localeCompare(z.chiaveMemoria))[0]
  if (!scriviMemoria(() => localStorage, corrente, JSON.stringify(piuVecchia.pendente))) return trovate
  try { localStorage.removeItem(piuVecchia.chiaveMemoria) } catch { /* senza memoria non c'è nulla da togliere */ }
  return trovate.map(c => c === piuVecchia ? { chiaveMemoria: corrente, pendente: c.pendente } : c)
}

const daCustodia = (p: AccontoPendente & { nota?: string }): TentativoIncerto =>
  ({ chiave: p.chiave, importo: Number(p.amount), metodo: p.method, giorno: p.paid_on, nota: p.nota ?? '', senzaChiave: !!p.senzaChiave })

export function tentativoIncerto(booking: RigaPagabile, righe?: RigaPagabile[]): TentativoIncerto | null {
  const trovate = allineaCustodia(booking, righe)
  const corrente = PREFISSO_CUSTODIA + chiavePrenotazione(booking)
  const scelta = trovate.find(c => c.chiaveMemoria === corrente) ?? trovate[0]
  return scelta ? daCustodia(scelta.pendente) : null
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
  let ultimoPendente: AccontoPendente | null = null   // per dire se un «già applicato» è identificato per chiave
  const leggiPendente = () => { const t = leggiMemoria(() => localStorage, chiaveMemoria); try { ultimoPendente = t ? JSON.parse(t) as AccontoPendente : null } catch { ultimoPendente = null } return ultimoPendente }
  // Il tentativo di prima può essere rimasto sotto l'identità VECCHIA della
  // prenotazione (Aggiungi camera, anche da un altro telefono): lo si riporta
  // qui con la sua chiave. Poi: o si rimanda LO STESSO pagamento (stessa
  // chiave, idempotente), o non si scrive. Mai una chiave nuova mentre un
  // tentativo è incerto — sarebbe un secondo movimento se la prima scrittura
  // era solo tardiva (21/09/2026).
  allineaCustodia(booking, righe)
  const inSospeso = leggiPendente()
  if (inSospeso && !(Math.round(Number(inSospeso.amount) * 100) === Math.round(dati.importo * 100)
    && inSospeso.method === dati.metodo && inSospeso.paid_on === dati.giorno)) {
    return { esito: 'errore', messaggio: MESSAGGIO_TENTATIVO_DA_VERIFICARE, pagamenti: null, incerto: tentativoIncerto(booking, righe) ?? undefined }
  }
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
  let giaPresente = false               // la funzione ha ritrovato la chiave del tentativo di prima (gia_presente)
  const rileggiControllando = async () => {
    if (!controllo) return rileggi()
    const adesso = await rileggiConto()
    if (!adesso) return { data: null, error: new Error(MESSAGGIO_RILETTURA_PAGAMENTI) }
    // il nostro stesso pagamento, scritto la volta prima con la risposta persa,
    // non è un incasso di un altro telefono: lo si ritrova per chiave (o per
    // stima, senza la colonna) e lo riconosce anche eseguiRegistraAcconto
    const pendente = leggiPendente()
    const nostro = pendente && ritrovaPendente(pendente, adesso.pagamenti as PagamentoStat[]) ? Math.round(pendente.amount * 100) : 0
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
        const r = rpc.data as { movimento_id?: unknown; importo?: unknown; soggiorno?: string; contratto?: string; booking_id?: string; gia_presente?: unknown } | null
        if (!r || typeof r.movimento_id !== 'string' || !Number.isFinite(Number(r.importo)) || Number(r.importo) !== p.amount
          || (booking.prenotazione_id && (r.contratto !== 'prenotazione_v1' || r.soggiorno !== chiave))) return { data: null, error: new ErroreRispostaMalformata() }
        giaPresente = r.gia_presente === true
        return { data: { id: r.movimento_id, booking_id: r.booking_id || bookingId, amount: Number(r.importo), method: p.method, paid_on: p.paid_on }, error: null }
      }
      if (booking.prenotazione_id || !rpcMancante(rpc.error, 'registra_acconto')) return { data: null, error: rpc.error }
      erroreScrittura = null
      // INSERT di ripiego: il movimento non porterà la chiave. Lo si annota nella
      // custodia PRIMA di scrivere: un esito incerto qui non è rinviabile in sicurezza
      scriviMemoria(() => localStorage, chiaveMemoria, JSON.stringify({ ...p, nota: dati.nota, senzaChiave: true }))
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
      const t = tentativoIncerto(booking, righe)
      if (t) return { esito: 'errore', messaggio: MESSAGGIO_ESITO_INCERTO, pagamenti: esito.pagamenti as PagamentoLetto[] | null, incerto: t }
    }
    // mancato salvataggio ACCERTATO (il database ha risposto di no): nessun
    // tentativo da custodire, altrimenti riaprendo il foglio sembrerebbe incerto
    if (esito.fase === 'movimento') { try { localStorage.removeItem(chiaveMemoria) } catch { /* niente */ } }
    return { esito: 'errore', messaggio: esito.messaggio, pagamenti: esito.pagamenti as PagamentoLetto[] | null }
  }
  // già applicato la volta prima (risposta persa): la nota solo se il movimento è il nostro per chiave
  const pendenteLetto = ultimoPendente as AccontoPendente | null
  const identificato = !esito.giaApplicato || !pendenteLetto || (ritrovaPendente(pendenteLetto, esito.pagamenti as PagamentoStat[])?.certo ?? false)
  const completato = await completaDopoMovimento(booking, righe, dati, (esito.movimento as { id?: string }).id, esito.pagamenti as PagamentoLetto[], identificato)
  // già scritto la volta prima (ritrovato qui o dalla funzione per chiave): la conferma lo dice
  return completato.esito === 'ok' ? { ...completato, giaRegistrato: esito.giaApplicato || giaPresente } : completato
}

/** Dopo che il movimento c'è (appena scritto, o ritrovato): la nota, il
 *  bollino «pagato» se il conto è coperto, la rilettura finale. */
async function completaDopoMovimento(
  booking: RigaPagabile, righe: RigaPagabile[], dati: { metodo: MetodoPagamento; giorno: string; nota: string },
  movimentoId: string | undefined, pagamentiScritti: PagamentoLetto[], identificato = true,
): Promise<EsitoPagamento> {
  const chiave = chiavePrenotazione(booking)
  const segmenti = righePerSaldo(righe)
  const ids = segmenti.map(b => b.id)
  const rileggi = () => supabase.from('payments').select('*').in('booking_id', ids).order('paid_on')

  // La nota è una cortesia: la funzione della 0033 non la prende, si scrive
  // dopo, sulla riga appena nata. Senza la colonna (proposta 0055) lo si dice.
  // Solo sul movimento identificato con certezza (id dalla funzione server, o
  // ritrovato per chiave), e solo se non ha già una nota (21/09/2026).
  let avviso: string | null = null
  const nota = dati.nota.trim()
  if (nota && movimentoId && identificato) avviso = await scriviNota(movimentoId, nota)
  else if (nota && !identificato) avviso = AVVISO_NOTA_MOVIMENTO_STIMATO

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

/** La nota sul movimento, SOLO se non ne ha già una: un UPDATE condizionato
 *  (`note is null`). Zero righe toccate → si rilegge: se la nota è già la
 *  nostra va bene, altrimenti la si lascia com'è e lo si dice. Torna l'avviso. */
async function scriviNota(movimentoId: string, nota: string): Promise<string | null> {
  const n = await supabase.from('payments').update({ note: nota }).eq('id', movimentoId).is('note', null).select('id')
  if (n.error) return colonnaMancante(n.error) === 'note' ? AVVISO_NOTA_SENZA_0055 : AVVISO_NOTA_NON_SALVATA
  if ((n.data ?? []).length === 1) return null
  const letta = await supabase.from('payments').select('note').eq('id', movimentoId).maybeSingle()
  if (letta.error || !letta.data) return AVVISO_NOTA_NON_SALVATA
  return String((letta.data as { note?: string | null }).note ?? '').trim() === nota ? null : AVVISO_NOTA_GIA_PRESENTE
}

// ── «Verifica pagamento» (rilievo 3): CONTROLLA, non registra mai incassi ───
// Rilegge i movimenti della prenotazione e cerca quello del tentativo
// custodito: per CHIAVE (chiave_operazione = la nostra: identificato con
// certezza) oppure, senza la colonna o dopo l'INSERT di ripiego, per stima
// (una riga uguale in più di quante ce n'erano prima di scrivere).
// Ritrovato → il tentativo si dimentica e si completa come dopo un
// salvataggio: la nota SOLO sul movimento certo e solo se non ne ha già una
// (scriviNota), il bollino «pagato» se il conto è coperto (segna_pagato con
// mancante atteso 0: con la 0057 non inventa mai un incasso; senza, resta la
// regola della 0049 come dopo un salvataggio normale), la rilettura.
// Non trovato → NON vuol dire fallito: la richiesta di prima può essere
// ancora in corso. Il tentativo resta custodito con la sua chiave e i suoi
// dati; «Riprova lo stesso pagamento» la rimanda tale e quale (idempotente:
// se intanto è arrivata, la funzione torna gia_presente). Dopo l'INSERT di
// ripiego (senzaChiave) il rinvio non è sicuro: riprovabile = false.
export type EsitoVerifica =
  | { esito: 'ritrovato'; pagamenti: PagamentoLetto[]; pagato: boolean; avviso: string | null; tentativo: TentativoIncerto; certo: boolean }
  | { esito: 'non_trovato'; pagamenti: PagamentoLetto[]; tentativo: TentativoIncerto; riprovabile: boolean }
  | { esito: 'nessun_tentativo' }
  | { esito: 'errore'; messaggio: string }

export async function verificaPagamento(booking: RigaPagabile, righe: RigaPagabile[]): Promise<EsitoVerifica> {
  // Tutte le custodie di QUESTA prenotazione, comprese quelle rimaste sotto
  // un'identità precedente (Aggiungi camera): il tentativo si recupera, non
  // si perde. Con più tentativi si risolvono uno per uno, ciascuno col suo
  // movimento e la sua nota: nessuno si butta, nessuno si scambia per un altro.
  const custodie = allineaCustodia(booking, righe)
  if (custodie.length === 0) return { esito: 'nessun_tentativo' }
  const ids = righePerSaldo(righe).map(b => b.id)
  let riletti: { data: PagamentoLetto[] | null; error: unknown }
  try { riletti = await supabase.from('payments').select('*').in('booking_id', ids).order('paid_on') as unknown as { data: PagamentoLetto[] | null; error: unknown } } catch (e) { riletti = { data: null, error: e } }
  if (riletti.error || !riletti.data) return { esito: 'errore', messaggio: VERIFICA_NON_RIUSCITA }

  const restate: CustodiaTrovata[] = []
  let ultimo: { tentativo: TentativoIncerto; certo: boolean; completato: EsitoPagamento & { esito: 'ok' } } | null = null
  for (const c of custodie) {
    const trovato = ritrovaPendente(c.pendente, riletti.data as PagamentoStat[])
    if (!trovato) { restate.push(c); continue }
    try { localStorage.removeItem(c.chiaveMemoria) } catch { /* niente */ }
    const t = daCustodia(c.pendente)
    const completato = await completaDopoMovimento(booking, righe, { metodo: t.metodo as MetodoPagamento, giorno: t.giorno, nota: t.nota }, (trovato.movimento as { id?: string }).id, riletti.data, trovato.certo)
    if (completato.esito === 'errore') return { esito: 'errore', messaggio: completato.messaggio }
    ultimo = { tentativo: t, certo: trovato.certo, completato }
  }
  if (ultimo) return { esito: 'ritrovato', pagamenti: ultimo.completato.pagamenti, pagato: ultimo.completato.pagato, avviso: ultimo.completato.avviso, tentativo: ultimo.tentativo, certo: ultimo.certo }

  // nessuno ritrovato: resta in sospeso quello sotto l'identità di adesso
  const corrente = PREFISSO_CUSTODIA + chiavePrenotazione(booking)
  const attiva = restate.find(c => c.chiaveMemoria === corrente) ?? restate[0]
  const t = daCustodia(attiva.pendente)
  return { esito: 'non_trovato', pagamenti: riletti.data, tentativo: t, riprovabile: !t.senzaChiave }
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
