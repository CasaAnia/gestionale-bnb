// Il calcolo delle pulizie, scritto UNA volta sola.
//
// Prima dell'audit del 24 agosto 2026 la stessa logica viveva in due copie
// (pagina Pulizie e notifiche push) che divergevano in silenzio. Questo
// modulo è ora l'unica fonte: la pagina, il cron delle notifiche e le
// statistiche leggono tutti da qui. Funzioni pure, senza React e senza
// Supabase, così girano identiche sul telefono e sul server e si testano
// con `npm test` (lib/pulizie.test.ts).
//
// Le pulizie PREVISTE non vengono mai salvate: si ricalcolano sempre dalle
// prenotazioni, quindi non esistono code di eventi vecchi da ripulire.
// Le DECISIONI (fatta / rimandata / saltata) stanno nella tabella
// `cleanings` (migrazione 0018) e comandano il ciclo:
//
//   FATTA il [data]  → il conteggio delle 4 notti riparte dalla data
//                      effettiva (regola fissata da Ania il 24/08/2026)
//   RIMANDA al [data]→ la stessa pulizia resta aperta, cambia solo la data
//   SALTA            → quella pulizia si chiude; la successiva è proposta
//                      a prevista + 4, modificabile prima della conferma

export const NOTTI_CAMBIO = 4
// Con quanti giorni di anticipo mostrare il prossimo cambio (per anticiparlo)
export const GIORNI_PREAVVISO = 2
// Da questa data in poi le pulizie di fine soggiorno restano "aperte" finché
// non vengono segnate fatte. Le partenze precedenti si considerano pulite
// (vecchio comportamento): senza questo confine ogni check-out del passato
// comparirebbe come arretrato il giorno dell'attivazione.
export const CUTOFF_STORICO = '2026-08-24'

export type StatoPrenotazione = 'confermata' | 'in_attesa' | 'annullata' | 'completata'

// Una riga della tabella cleanings
export type Decisione = {
  id?: string
  room_id: string
  booking_id: string | null
  tipo: 'fine_soggiorno' | 'soggiorno' | 'cambio_camera'
  stato: 'fatta' | 'saltata' | 'rimandata'
  data_prevista: string
  data_effettiva?: string | null
  prossima_data?: string | null
  cambio_biancheria?: boolean
  note?: string | null     // NOTA_AUTOMATICA_* quando la riga corregge una pulizia automatica
  created_at?: string
}

export type TipoPulizia = 'fine_soggiorno' | 'soggiorno' | 'cambio_camera'
export type Priorita = 'urgente' | 'alta' | 'flessibile' | 'nessuna_fretta'

// Una pulizia aperta (da fare oggi o in ritardo) o in arrivo
export type Pulizia = {
  roomId: string
  tipo: TipoPulizia
  booking: any            // partenza (fine soggiorno/cambio camera) o soggiorno in corso (4 notti)
  prevista: string        // data prevista originale (partenza o scadenza del ciclo)
  due: string             // data attesa dopo eventuali rimandi
  ritardo: number         // giorni di ritardo rispetto a oggi (0 = non scaduta)
  rinvii: Decisione[]     // rimandi registrati per questa pulizia
  cambioCameraVerso?: any // per chi parte spostandosi in un'altra camera
  automatica?: boolean    // cambio ospite: già registrata da sola, non c'è nulla da segnare
  arrivoAutomatico?: any  // la prenotazione che arriva lo stesso giorno o il giorno dopo
}

export type ProssimoArrivo = {
  booking: any
  giorni: number          // 0 = oggi, 1 = domani...
  cambioDa: any | null    // prenotazione di provenienza se è un cambio camera
}

// ---------------------------------------------------------------- date utili

export function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function addDaysStr(s: string, n: number): string {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Giorni da b ad a (positivo se a è nel futuro rispetto a b)
export function diffDays(a: string, b: string): number {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()) / 86400000)
}

// ------------------------------------------------------------- prenotazioni

// Le sole prenotazioni che contano per le pulizie: confermate o completate.
// Le "in attesa" (richieste dal sito mai confermate) NON sono ospiti:
// trattarle come tali ha prodotto la notifica fantasma di Anna Sawicka
// del 23/08/2026 (Caso 2 dell'audit).
export function attive(bookings: any[]): any[] {
  return (bookings || []).filter(b => b.status === 'confermata' || b.status === 'completata')
}

// Prolungamenti: stesso ospite, stessa camera, date contigue = un unico
// soggiorno (es. prenotazione separata per distinguere il pagamento).
// Il confine non è né una partenza né un arrivo e le 4 notti non ripartono.
export function continuaIn(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && x.room_id === b.room_id && b.guest_id && x.guest_id === b.guest_id && x.check_in === b.check_out) || null
}
export function continuaDa(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && x.room_id === b.room_id && b.guest_id && x.guest_id === b.guest_id && x.check_out === b.check_in) || null
}

// Cambio camera: stesso ospite che lo stesso giorno si sposta in un'altra camera.
export function cambioCameraOut(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && b.guest_id && x.guest_id === b.guest_id && x.check_in === b.check_out && x.room_id !== b.room_id) || null
}
export function cambioCameraIn(bookings: any[], b: any) {
  return bookings.find(x => x.id !== b.id && b.guest_id && x.guest_id === b.guest_id && x.check_out === b.check_in && x.room_id !== b.room_id) || null
}

// Soggiorno continuativo attorno a una prenotazione: indietro fino al primo
// segmento, avanti fino all'ultimo (prolungamenti già prenotati).
export function soggiornoContinuativo(bookings: any[], b: any): { inizio: any; fine: any; tratto: any[] } {
  let inizio = b
  const tratto = [b]
  for (let prev = continuaDa(bookings, inizio); prev; prev = continuaDa(bookings, prev)) { inizio = prev; tratto.push(prev) }
  let fine = b
  for (let next = continuaIn(bookings, fine); next; next = continuaIn(bookings, next)) { fine = next; tratto.push(next) }
  return { inizio, fine, tratto }
}

// --------------------------------------------------- decisioni (cleanings)

// Ultima decisione registrata per un insieme di prenotazioni e un tipo.
// L'ordine è created_at (poi id): l'ultima azione di Ania comanda.
function ultimaDecisione(events: Decisione[], bookingIds: Set<string>, tipi: TipoPulizia[]): Decisione | null {
  const propri = (events || [])
    .filter(e => e.booking_id && bookingIds.has(e.booking_id) && tipi.includes(e.tipo))
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id || '').localeCompare(String(b.id || '')))
  return propri.length ? propri[propri.length - 1] : null
}

// Rimandi consecutivi in coda alla storia di una pulizia (per mostrare
// "rimandata dal 20 al 22" e contare i rinvii nelle statistiche).
function rinviiInCoda(events: Decisione[], bookingIds: Set<string>, tipi: TipoPulizia[]): Decisione[] {
  const propri = (events || [])
    .filter(e => e.booking_id && bookingIds.has(e.booking_id) && tipi.includes(e.tipo))
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id || '').localeCompare(String(b.id || '')))
  const coda: Decisione[] = []
  for (let i = propri.length - 1; i >= 0 && propri[i].stato === 'rimandata'; i--) coda.unshift(propri[i])
  return coda
}

// ------------------------------------------------- cambio ogni 4 notti

export type CicloCambio = {
  due: string | null      // prossima scadenza (null = nessun cambio previsto per questo soggiorno)
  prevista: string | null // scadenza prima degli eventuali rimandi
  base: string            // spiegazione del punto di partenza (per il pannello "perché")
  rinvii: Decisione[]
}

// Prossimo cambio biancheria di un soggiorno continuativo.
//
// Precedenza: ultima decisione registrata (fatta → effettiva + 4;
// saltata/rimandata → la data scelta) → poi linen_next_date (le decisioni
// prese prima della tabella cleanings) → poi la regola base check-in + 4.
export function cicloCambio(bookings: any[], inCorso: any, events: Decisione[]): CicloCambio {
  const { inizio, fine, tratto } = soggiornoContinuativo(bookings, inCorso)
  const ids = new Set<string>(tratto.map(b => String(b.id)))
  const ev = ultimaDecisione(events, ids, ['soggiorno'])
  const rinvii = rinviiInCoda(events, ids, ['soggiorno'])

  let due: string | null = null
  let base: string
  if (ev && ev.stato === 'fatta' && ev.data_effettiva) {
    due = addDaysStr(ev.data_effettiva, NOTTI_CAMBIO)
    base = `ultima pulizia fatta il ${dataIt(ev.data_effettiva)} + ${NOTTI_CAMBIO} notti`
  } else if (ev && ev.prossima_data) {
    due = ev.prossima_data
    base = ev.stato === 'saltata'
      ? `pulizia del ${dataIt(ev.data_prevista)} saltata → proposta ${dataIt(ev.prossima_data)}`
      : `rimandata dal ${dataIt(ev.data_prevista)} al ${dataIt(ev.prossima_data)}`
  } else {
    const salvata = inCorso.linen_next_date
      ?? tratto.map(b => b.linen_next_date).filter(Boolean).sort().slice(-1)[0]
    if (salvata) {
      due = salvata
      base = `data salvata nell'app dal vecchio sistema (${dataIt(salvata)})`
    } else {
      due = addDaysStr(inizio.check_in, NOTTI_CAMBIO)
      base = `check-in del ${dataIt(inizio.check_in)} + ${NOTTI_CAMBIO} notti (regola base)`
    }
  }
  // La scadenza prima dei rimandi in coda (per "rimandata dal X al Y")
  const prevista = rinvii.length > 0 ? rinvii[0].data_prevista : due
  // Niente cambio se cadrebbe il giorno della partenza o dopo: la camera
  // si rifà comunque al cambio ospite.
  if (due !== null && due >= fine.check_out) return { due: null, prevista: null, base, rinvii }
  return { due, prevista, base, rinvii }
}

// --------------------------------------------- fine soggiorno / cambio camera

export type FineSoggiorno = {
  partenza: any           // ultimo segmento del soggiorno (il check-out vero)
  tipo: TipoPulizia       // 'cambio_camera' se l'ospite si sposta, altrimenti 'fine_soggiorno'
  cambioCameraVerso: any | null
  chiusa: boolean         // già segnata fatta o saltata
  due: string             // check-out, oppure la data del rimando
  rinvii: Decisione[]
}

// Stato della pulizia legata a una partenza definitiva.
export function statoFineSoggiorno(bookings: any[], partenza: any, events: Decisione[]): FineSoggiorno {
  const verso = cambioCameraOut(bookings, partenza)
  const tipo: TipoPulizia = verso ? 'cambio_camera' : 'fine_soggiorno'
  const ids = new Set<string>([String(partenza.id)])
  const ev = ultimaDecisione(events, ids, ['fine_soggiorno', 'cambio_camera'])
  const rinvii = rinviiInCoda(events, ids, ['fine_soggiorno', 'cambio_camera'])
  const chiusa = !!ev && (ev.stato === 'fatta' || ev.stato === 'saltata')
  const due = !chiusa && ev && ev.stato === 'rimandata' && ev.prossima_data ? ev.prossima_data : partenza.check_out
  return { partenza, tipo, cambioCameraVerso: verso, chiusa, due, rinvii }
}

// Ultima partenza definitiva della camera con check-out <= oggi che può
// essere ancora "aperta": dal CUTOFF_STORICO in poi, e solo se nessun nuovo
// ospite è già arrivato dopo (in quel caso la camera era per forza pulita).
export function partenzaAperta(bookings: any[], roomId: string, oggi: string, events: Decisione[]): FineSoggiorno | null {
  const partenze = bookings
    .filter(b => b.room_id === roomId && b.check_out <= oggi && b.check_out >= CUTOFF_STORICO && !continuaIn(bookings, b))
    .sort((a, b) => a.check_out.localeCompare(b.check_out))
  const ultima = partenze[partenze.length - 1]
  if (!ultima) return null
  const arrivatoDopo = bookings.some(b => b.room_id === roomId && b.check_in >= ultima.check_out && b.check_in <= oggi && !continuaDa(bookings, b))
  if (arrivatoDopo && ultima.check_out < oggi) return null
  const stato = statoFineSoggiorno(bookings, ultima, events)
  return stato.chiusa ? null : stato
}

// ------------------------------------------------------------ prossimo arrivo

// Il prossimo ospite che entra nella camera (oggi o dopo), escludendo i
// prolungamenti. Serve per la priorità e per la riga "Prossimo arrivo: ...".
export function prossimoArrivo(bookings: any[], roomId: string, oggi: string): ProssimoArrivo | null {
  const arrivo = bookings
    .filter(b => b.room_id === roomId && b.check_in >= oggi && !continuaDa(bookings, b))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0]
  if (!arrivo) return null
  return { booking: arrivo, giorni: diffDays(arrivo.check_in, oggi), cambioDa: cambioCameraIn(bookings, arrivo) }
}

// Testo leggibile per la scheda: "oggi alle 14:30", "domani", "tra 3 giorni (27 ago)"...
export function testoArrivo(arrivo: ProssimoArrivo | null): string {
  if (!arrivo) return 'Nessun arrivo previsto'
  const b = arrivo.booking
  const ora = b.check_in_time ? ` alle ${b.check_in_time}` : ''
  if (arrivo.giorni === 0) return `Prossimo arrivo: oggi${ora}`
  if (arrivo.giorni === 1) return `Prossimo arrivo: domani${ora}`
  const [y, m, d] = b.check_in.split('-').map(Number)
  const data = new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
  return `Prossimo arrivo tra ${arrivo.giorni} giorni — ${data}`
}

// ------------------------------------------------------------------ priorità

// Priorità semplice a 4 livelli (concordata nell'audit del 24/08/2026):
//   URGENTE     la camera serve oggi (arrivo oggi, incluso un cambio camera)
//   ALTA        arrivo domani, oppure pulizia delle 4 notti scaduta o di oggi
//   FLESSIBILE  prossimo arrivo tra 2-3 giorni
//   NESSUNA FRETTA nessun arrivo nei prossimi 4 giorni (o camera libera)
export function prioritaDi(pulizia: Pulizia, arrivo: ProssimoArrivo | null): Priorita {
  if (arrivo && arrivo.giorni === 0) return 'urgente'
  if (pulizia.tipo === 'soggiorno') return 'alta'
  if (arrivo && arrivo.giorni === 1) return 'alta'
  if (arrivo && arrivo.giorni <= 3) return 'flessibile'
  return 'nessuna_fretta'
}

// ------------------------------------------------- cambio ospite automatico

// Regola (04/09/2026): quando in una camera un ospite parte e un altro
// arriva lo stesso giorno o il giorno dopo, la camera è stata per forza
// rifatta in mezzo. Quella pulizia si considera FATTA da sola, con la data
// della partenza, senza che Ania la segni. Vale solo per prenotazioni
// confermate/completate (mai richieste in attesa) e non è mai salvata: si
// ricalcola dalle prenotazioni, così se una prenotazione si sposta o si
// annulla la pulizia automatica sparisce, e se nasce un nuovo cambio
// compare. Negli altri casi (partenza senza arrivo vicino, 4 notti) nulla
// cambia: si segna a mano come prima.
export const GIORNI_CAMBIO_OSPITE = 1
// Note delle righe cleanings con cui Ania corregge un'automatica
export const NOTA_AUTOMATICA_CORRETTA = 'automatica: data corretta'
export const NOTA_AUTOMATICA_TOLTA = 'automatica: non fatta'

export type PuliziaAutomatica = {
  roomId: string
  tipo: TipoPulizia
  partenza: any           // chi parte (il check-out vero del soggiorno)
  arrivo: any             // chi entra lo stesso giorno o il giorno dopo
  data: string            // = partenza.check_out
}

// Il nuovo ospite che entra nella stessa camera entro GIORNI_CAMBIO_OSPITE
// dalla partenza (escluso il prolungamento dello stesso ospite).
export function arrivoDopoPartenza(bookings: any[], partenza: any): any | null {
  if (continuaIn(bookings, partenza)) return null
  const limite = addDaysStr(partenza.check_out, GIORNI_CAMBIO_OSPITE)
  return bookings
    .filter(b => b.id !== partenza.id && b.room_id === partenza.room_id && b.check_in >= partenza.check_out && b.check_in <= limite && !continuaDa(bookings, b))
    .sort((a, b) => a.check_in.localeCompare(b.check_in))[0] || null
}

// La pulizia di questa partenza è automatica? No se Ania ha già deciso
// qualcosa per lei (fatta a mano, rimandata, saltata, corretta o tolta) o
// se nello stesso giorno c'è già una pulizia segnata a mano nella camera.
export function cambioOspiteAutomatico(bookings: any[], partenza: any, events: Decisione[]): PuliziaAutomatica | null {
  const arrivo = arrivoDopoPartenza(bookings, partenza)
  if (!arrivo) return null
  const decisa = (events || []).some(e => e.booking_id === partenza.id && (e.tipo === 'fine_soggiorno' || e.tipo === 'cambio_camera'))
  if (decisa) return null
  const manualeStessoGiorno = (events || []).some(e => e.room_id === partenza.room_id && e.stato === 'fatta' && (e.data_effettiva || e.data_prevista) === partenza.check_out)
  if (manualeStessoGiorno) return null
  return { roomId: partenza.room_id, tipo: cambioCameraOut(bookings, partenza) ? 'cambio_camera' : 'fine_soggiorno', partenza, arrivo, data: partenza.check_out }
}

// Tutte le pulizie automatiche già avvenute (partenza fino a `oggi`), dal
// CUTOFF_STORICO in poi: prima di quella data le statistiche stimano già una
// pulizia per ogni partenza, e conterebbero due volte. Anche il passato
// recente rientra, così i conteggi delle settimane scorse tornano giusti.
export function pulizieAutomatiche(tutteLePrenotazioni: any[], events: Decisione[], oggi: string): PuliziaAutomatica[] {
  const bookings = attive(tutteLePrenotazioni)
  const out: PuliziaAutomatica[] = []
  for (const b of bookings) {
    if (b.check_out > oggi || b.check_out < CUTOFF_STORICO) continue
    const a = cambioOspiteAutomatico(bookings, b, events)
    if (a) out.push(a)
  }
  return out.sort((x, y) => x.data.localeCompare(y.data) || String(x.roomId).localeCompare(String(y.roomId)))
}

// ------------------------------------------------------- pulizie di un giorno

// Le pulizie aperte di una camera al giorno `oggi` (fine soggiorno rimasti
// da fare + cambio 4 notti scaduto). È il cuore della sezione "Oggi".
export function pulizieAperte(bookings: any[], roomId: string, oggi: string, events: Decisione[]): Pulizia[] {
  const out: Pulizia[] = []

  const fs = partenzaAperta(bookings, roomId, oggi, events)
  if (fs && fs.due <= oggi) {
    // Cambio ospite: la pulizia è già registrata da sola. Resta in «Oggi»
    // come lavoro della giornata (con la priorità dell'arrivo) ma senza
    // pulsanti e mai «in ritardo».
    const auto = cambioOspiteAutomatico(bookings, fs.partenza, events)
    out.push({
      roomId, tipo: fs.tipo, booking: fs.partenza,
      prevista: fs.partenza.check_out, due: fs.due,
      ritardo: auto ? 0 : Math.max(0, diffDays(oggi, fs.due)),
      rinvii: fs.rinvii, cambioCameraVerso: fs.cambioCameraVerso,
      ...(auto ? { automatica: true, arrivoAutomatico: auto.arrivo } : {}),
    })
  }

  const inCorso = bookings.find(b => b.room_id === roomId && b.check_in <= oggi && b.check_out > oggi) || null
  if (inCorso) {
    const ciclo = cicloCambio(bookings, inCorso, events)
    if (ciclo.due && ciclo.due <= oggi) {
      out.push({
        roomId, tipo: 'soggiorno', booking: inCorso,
        prevista: ciclo.prevista || ciclo.due, due: ciclo.due,
        ritardo: Math.max(0, diffDays(oggi, ciclo.due)),
        rinvii: ciclo.rinvii,
      })
    }
  }
  return out
}

// ---------------------------------------------------------------- cronologia

// Registro di una voce della cronologia (richiesta di Ania, 24/08/2026):
//   reale       = evento registrato davvero (tabella cleanings, o movimento
//                 di una prenotazione: check-in, prolungamento, partenza)
//   ricostruita = data teorica del vecchio sistema, ricostruita a ritroso
//                 ogni 4 notti: l'esito NON è noto e non va mai spacciata
//                 per una pulizia fatta
//   futura      = la prossima scadenza calcolata (una sola, mai una serie)
export type Registro = 'reale' | 'ricostruita' | 'futura'
export type VoceCronologia = { data: string; testo: string; registro: Registro }

function dataIt(s: string): string {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}

// Cronologia delle pulizie di una camera: il soggiorno in corso (ciclo delle
// 4 notti compreso) e/o la pulizia di fine soggiorno ancora aperta.
// Solo lettura: non tocca la logica di calcolo, la racconta.
export function cronologiaCamera(bookings: any[], roomId: string, oggi: string, events: Decisione[], rooms: any[] = []): VoceCronologia[] {
  const voci: (VoceCronologia & { ordine: number })[] = []
  let n = 0
  const push = (data: string, testo: string, registro: Registro) => voci.push({ data, testo, registro, ordine: n++ })
  const nomeDi = (b: any) => b?.guest_name || b?.guests?.full_name || 'Ospite'
  const shortOf = (id: string) => {
    const r = rooms.find(rr => rr.id === id)
    return r ? r.name.split(' ').slice(-1)[0] : 'un’altra camera'
  }

  // --- Pulizia di fine soggiorno ancora aperta (ospite già partito) ---
  const fs = partenzaAperta(bookings, roomId, oggi, events)
  if (fs) {
    push(fs.partenza.check_in, `check-in di ${nomeDi(fs.partenza)}`, 'reale')
    push(fs.partenza.check_out, fs.cambioCameraVerso
      ? `${nomeDi(fs.partenza)} cambia camera → va in ${shortOf(fs.cambioCameraVerso.room_id)} · pulizia prevista`
      : `partenza di ${nomeDi(fs.partenza)} · pulizia prevista`, 'reale')
    for (const r of fs.rinvii) push(r.data_prevista, `rimandata dal ${dataIt(r.data_prevista)} al ${dataIt(r.prossima_data!)}`, 'reale')
    if (fs.due > oggi) push(fs.due, 'pulizia attesa (dopo il rinvio)', 'futura')
  }

  // --- Soggiorno in corso: il ciclo delle 4 notti ---
  const inCorso = bookings.find(b => b.room_id === roomId && b.check_in <= oggi && b.check_out > oggi) || null
  if (inCorso) {
    const { inizio, fine, tratto } = soggiornoContinuativo(bookings, inCorso)
    push(inizio.check_in, `check-in di ${nomeDi(inizio)}`, 'reale')
    for (const seg of tratto.filter(s => s.id !== inizio.id).sort((a, b) => a.check_in.localeCompare(b.check_in))) {
      push(seg.check_in, 'prolungamento del soggiorno', 'reale')
    }

    const ids = new Set<string>(tratto.map(b => String(b.id)))
    const propri = (events || [])
      .filter(e => e.booking_id && ids.has(e.booking_id) && e.tipo === 'soggiorno')
      .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')) || String(a.id || '').localeCompare(String(b.id || '')))
    const previsteRegistrate = new Set(propri.map(e => e.data_prevista))

    // Ricostruzione del vecchio sistema: a ritroso ogni 4 notti dall'ultima
    // scadenza salvata (o in avanti dal check-in se non c'è nulla). L'esito
    // di queste date non è registrato da nessuna parte: mai chiamarle "fatte".
    const anchor = tratto.map(b => b.linen_next_date).filter(Boolean).sort().slice(-1)[0] || null
    if (anchor) {
      for (let d = addDaysStr(anchor, -NOTTI_CAMBIO); d > inizio.check_in; d = addDaysStr(d, -NOTTI_CAMBIO)) {
        push(d, 'prevista — ricostruita dal vecchio sistema, esito non registrato', 'ricostruita')
      }
      if (!previsteRegistrate.has(anchor) && anchor < fine.check_out) {
        push(anchor, 'scadenza salvata dal vecchio sistema, esito non registrato', 'ricostruita')
      }
    } else if (propri.length === 0) {
      for (let d = addDaysStr(inizio.check_in, NOTTI_CAMBIO); d < CUTOFF_STORICO && d < fine.check_out && d <= oggi; d = addDaysStr(d, NOTTI_CAMBIO)) {
        push(d, 'prevista — ricostruita dal vecchio sistema, esito non registrato', 'ricostruita')
      }
    }

    // Le decisioni vere del nuovo storico
    for (const e of propri) {
      if (e.stato === 'fatta') {
        push(e.data_effettiva || e.data_prevista, e.data_effettiva && e.data_effettiva !== e.data_prevista
          ? `fatta (era prevista il ${dataIt(e.data_prevista)})`
          : 'fatta', 'reale')
      } else if (e.stato === 'rimandata') {
        push(e.data_prevista, `rimandata dal ${dataIt(e.data_prevista)} al ${dataIt(e.prossima_data!)}`, 'reale')
      } else {
        push(e.data_prevista, `saltata (concordato) · proposta successiva il ${dataIt(e.prossima_data!)}`, 'reale')
      }
    }

    // Una sola data futura: la prossima scadenza calcolata adesso
    const ciclo = cicloCambio(bookings, inCorso, events)
    if (ciclo.due) {
      if (ciclo.due <= oggi) {
        const rit = diffDays(oggi, ciclo.due)
        push(ciclo.due, `pulizia attesa · ${ciclo.base}${rit > 0 ? ` · in ritardo di ${rit} ${rit === 1 ? 'giorno' : 'giorni'}` : ''}`, 'reale')
      } else {
        push(ciclo.due, `prossima prevista · ${ciclo.base}`, 'futura')
      }
    } else {
      const verso = cambioCameraOut(bookings, fine)
      push(fine.check_out, verso
        ? `nessun'altra pulizia del ciclo: il ${dataIt(fine.check_out)} ${nomeDi(fine)} cambia camera → ${shortOf(verso.room_id)}`
        : `nessun'altra pulizia del ciclo: cadrebbe alla partenza del ${dataIt(fine.check_out)}`, 'futura')
    }

    // La fine del soggiorno chiude sempre la cronologia
    const verso = cambioCameraOut(bookings, fine)
    push(fine.check_out, verso
      ? `${nomeDi(fine)} cambia camera → va in ${shortOf(verso.room_id)}`
      : `partenza di ${nomeDi(fine)}`, fine.check_out > oggi ? 'futura' : 'reale')
  }

  return voci
    .sort((a, b) => a.data.localeCompare(b.data) || a.ordine - b.ordine)
    .map(({ data, testo, registro }) => ({ data, testo, registro }))
}

// ------------------------------------------------------------------ notifica

export type RigaNotifica = {
  shortName: string
  tipo: TipoPulizia
  testo: string           // riga completa già pronta per il pop-up
  ritardo: number
}

export type Notifica = { domani: RigaNotifica[]; inRitardo: RigaNotifica[] }

function shortName(room: any): string {
  return room.name.split(' ').slice(-1)[0]
}

function etichettaPriorita(p: Priorita): string {
  return p === 'urgente' ? 'URGENTE' : p === 'alta' ? 'priorità alta' : p === 'flessibile' ? 'flessibile' : 'nessuna fretta'
}

// Le righe del pop-up della sera prima: pulizie in scadenza domani, con
// motivo, prossimo arrivo e priorità. Gli arretrati vanno in `inRitardo`
// e vengono chiamati col loro nome — MAI più rietichettati "domani" ogni
// sera (Caso 1 dell'audit del 24/08/2026).
export function calcolaNotifica(rooms: any[], tutteLePrenotazioni: any[], events: Decisione[], oggi: string): Notifica {
  const bookings = attive(tutteLePrenotazioni)
  const domani = addDaysStr(oggi, 1)
  const righeDomani: RigaNotifica[] = []
  const righeRitardo: RigaNotifica[] = []

  for (const room of rooms) {
    const nome = shortName(room)
    const nomeDi = (b: any) => b?.guest_name || b?.guests?.full_name || 'Ospite'

    // Pulizie che scadono domani: partenza domani (o rimandata a domani)...
    const partenzaDomani = bookings.find(b => b.room_id === room.id && b.check_out === domani && !continuaIn(bookings, b))
    let fsDomani: FineSoggiorno | null = null
    if (partenzaDomani) {
      const st = statoFineSoggiorno(bookings, partenzaDomani, events)
      if (!st.chiusa) fsDomani = st
    }
    const fsAperta = partenzaAperta(bookings, room.id, oggi, events)
    if (!fsDomani && fsAperta && fsAperta.due === domani) fsDomani = fsAperta

    if (fsDomani) {
      const arrivo = prossimoArrivo(bookings, room.id, domani)
      const p: Pulizia = {
        roomId: room.id, tipo: fsDomani.tipo, booking: fsDomani.partenza,
        prevista: fsDomani.partenza.check_out, due: fsDomani.due, ritardo: 0, rinvii: fsDomani.rinvii,
        cambioCameraVerso: fsDomani.cambioCameraVerso,
      }
      // La priorità è calcolata rispetto a domani (il giorno della pulizia)
      const prio = prioritaDi(p, arrivo ? { ...arrivo, giorni: diffDays(arrivo.booking.check_in, domani) } : null)
      const motivo = fsDomani.tipo === 'cambio_camera'
        ? `CAMBIO CAMERA — ${nomeDi(fsDomani.partenza)} va in ${shortName(rooms.find(r => r.id === fsDomani!.cambioCameraVerso?.room_id) || { name: 'altra camera' })}`
        : `fine soggiorno (parte ${nomeDi(fsDomani.partenza)})`
      const arrivoTxt = testoArrivo(arrivo ? { ...arrivo, giorni: diffDays(arrivo.booking.check_in, domani) } : null)
        .replace('Prossimo arrivo: oggi', 'prossimo arrivo: domani stesso')
        .replace('Prossimo arrivo: domani', 'prossimo arrivo: dopodomani')
        .replace('Prossimo arrivo', 'prossimo arrivo')
        .replace('Nessun arrivo previsto', 'nessun arrivo previsto')
      righeDomani.push({ shortName: nome, tipo: fsDomani.tipo, ritardo: 0, testo: `${nome} — ${motivo} · ${arrivoTxt} · ${etichettaPriorita(prio)}` })
    }

    // ...e cambio 4 notti in scadenza domani (ospite presente anche domani)
    const inCorsoDomani = bookings.find(b => b.room_id === room.id && b.check_in <= domani && b.check_out > domani)
    if (inCorsoDomani) {
      const ciclo = cicloCambio(bookings, inCorsoDomani, events)
      if (ciclo.due === domani) {
        righeDomani.push({ shortName: nome, tipo: 'soggiorno', ritardo: 0, testo: `${nome} — pulizia 4 notti · ${nomeDi(inCorsoDomani)} resta · priorità alta` })
      }
    }

    // Arretrati: aperti con scadenza oggi o prima. Compaiono come contesto,
    // col loro ritardo vero, solo in coda a una notifica che parte comunque.
    for (const p of pulizieAperte(bookings, room.id, oggi, events)) {
      if (p.automatica) continue   // cambio ospite: registrata da sola, mai un arretrato
      const giorni = diffDays(oggi, p.due)
      const label = p.tipo === 'soggiorno' ? 'pulizia 4 notti' : p.tipo === 'cambio_camera' ? 'cambio camera' : 'fine soggiorno'
      const ritardoTxt = giorni === 0 ? 'era per oggi' : giorni === 1 ? 'in ritardo di 1 giorno' : `in ritardo di ${giorni} giorni`
      righeRitardo.push({ shortName: nome, tipo: p.tipo, ritardo: giorni, testo: `${nome} — ${label} · ${ritardoTxt}` })
    }
  }
  return { domani: righeDomani, inRitardo: righeRitardo }
}

// ------------------------------------------- lavori di UN giorno (Home + Pulizie)

// Stato di una camera in un GIORNO preciso, con la stessa regola e la stessa
// fonte della pagina Pulizie (08/09/2026, striscia della settimana in Home):
//  · partenze e cambi camera con la scadenza quel giorno (rimandi di Ania
//    compresi): da fare finché non sono segnati fatti/saltati; per oggi anche
//    quelli in ritardo (come la sezione «Oggi»); la pulizia AUTOMATICA alla
//    partenza (nuovo ospite nella stessa camera entro il giorno dopo, già
//    avvenuta) vale come fatta;
//  · cambio biancheria ogni 4 notti (rettifiche registrate comprese): da fare
//    quando scade quel giorno (per oggi anche se scaduto), fatta se segnata
//    fatta con data effettiva quel giorno;
//  · arrivi (non prolungamenti): la camera conta come FATTA se è già pulita e
//    segnata (l'ultima partenza precedente è chiusa o automatica, o non ce
//    n'è), altrimenti come da fare.
// Ogni camera conta UNA volta al giorno: «da fare» vince su «fatta».
export type StatoCameraGiorno = 'da_fare' | 'fatta' | 'nessuna'
export type ConteggioGiorno = { daFare: number; fatte: number }
type Prenotazioni = Parameters<typeof pulizieAperte>[0]

export function statoCameraGiorno(bookings: Prenotazioni, roomId: string, giorno: string, oggi: string, events: Decisione[]): StatoCameraGiorno {
  if (giorno < oggi) return 'nessuna'
  let daFare = false, fatta = false
  const segna = (fattaQuesta: boolean) => { if (fattaQuesta) fatta = true; else daFare = true }
  const chiusaOAutomatica = (partenza: Prenotazioni[number]) => {
    const st = statoFineSoggiorno(bookings, partenza, events)
    return st.chiusa || (partenza.check_out <= oggi && !!cambioOspiteAutomatico(bookings, partenza, events))
  }

  // Partenze e cambi camera
  const partenze = bookings.filter(b => b.room_id === roomId && b.check_out <= giorno && b.check_out >= CUTOFF_STORICO && !continuaIn(bookings, b))
  for (const p of partenze) {
    const st = statoFineSoggiorno(bookings, p, events)
    if (st.due === giorno) segna(chiusaOAutomatica(p))
  }
  if (giorno === oggi) {
    // In ritardo (come «Oggi» della pagina): l'ultima partenza aperta con scadenza passata
    const fs = partenzaAperta(bookings, roomId, oggi, events)
    if (fs && fs.due < oggi) segna(!!cambioOspiteAutomatico(bookings, fs.partenza, events))
  }

  // Cambio biancheria
  const inCorso = bookings.find(b => b.room_id === roomId && b.check_in <= giorno && b.check_out > giorno) || null
  if (inCorso) {
    const ciclo = cicloCambio(bookings, inCorso, events)
    if (ciclo.due === giorno || (giorno === oggi && ciclo.due !== null && ciclo.due < oggi)) segna(false)
  }
  if ((events || []).some(e => e.room_id === roomId && e.tipo === 'soggiorno' && e.stato === 'fatta' && (e.data_effettiva || e.data_prevista) === giorno)) segna(true)

  // Arrivi: la camera è pronta?
  const arrivi = bookings.filter(b => b.room_id === roomId && b.check_in === giorno && !continuaDa(bookings, b))
  if (arrivi.length > 0) {
    const precedente = bookings
      .filter(b => b.room_id === roomId && b.check_out <= giorno && !continuaIn(bookings, b) && !arrivi.some(a => a.id === b.id))
      .sort((a, b) => a.check_out.localeCompare(b.check_out)).slice(-1)[0]
    const pronta = !precedente || precedente.check_out < CUTOFF_STORICO || chiusaOAutomatica(precedente)
    segna(pronta)
  }
  return daFare ? 'da_fare' : fatta ? 'fatta' : 'nessuna'
}

// Quante camere hanno pulizie ancora da fare e quante le hanno tutte fatte
// quel giorno: È IL numero della striscia in Home e della pagina Pulizie.
export function conteggioGiorno(rooms: { id: string }[], tutteLePrenotazioni: Prenotazioni, events: Decisione[], giorno: string, oggi: string): ConteggioGiorno {
  const bookings = attive(tutteLePrenotazioni)
  const stati = rooms.map(r => statoCameraGiorno(bookings, r.id, giorno, oggi, events))
  return { daFare: stati.filter(s => s === 'da_fare').length, fatte: stati.filter(s => s === 'fatta').length }
}
