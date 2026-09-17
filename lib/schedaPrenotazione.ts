// ============================================================================
// LA NUOVA SCHEDA PRENOTAZIONE (13/09/2026, /scheda/<id>) — la logica pura.
// Qui si decide COSA scrivere: la pagina decide come. Niente Supabase, niente
// orologio: `oggi` arriva dal chiamante. Le cifre del conto NON si
// ricalcolano: arrivano da lib/prenotazioneUnica (contoPrenotazione), la
// stessa funzione della scheda attuale.
//
// Parti coperte (parte 1 di 2): la testa (chi è, stato, etichette delle
// date, riga grande, stato del conto, note), la fascia, «Da controllare» di
// QUESTA prenotazione e il soggiorno (striscia delle notti, arrivo, tratti).
// ============================================================================
import { giorniSoggiorno, personePerNottePrenotazione, dettaglioNottiSalvato, testoDettaglioNotti, fmtEuroBreve, type CameraTariffa } from './prezzoNotti.ts'
import { contoSoggiorno } from './conto.ts'
import { GIORNI_BREVI, MESI_BREVI } from './dateItaliane.ts'
import { chiEIlCliente } from './clienteCheTorna.ts'
import { euroTondi } from './euroTondi.ts'
import { spostaGiorni } from './statistiche/periodo.ts'
import { eccezioniPagamenti, eccezioniArrivi, eccezioniCalendario, hrefDestinazione, ETICHETTA_TIPO, type PrenotazioneDC, type Eccezione } from './daControllare.ts'
import type { PagamentoStat } from './statistiche/tipi.ts'
import type { VoceControllo } from './richiesteDaControllare.ts'

// Un tratto di camera della prenotazione: una riga di `bookings` con la camera
export type SegmentoScheda = {
  id: string
  room_id?: string | null
  group_id?: string | null
  prenotazione_id?: string | null
  guest_id?: string | null
  check_in: string
  check_out: string
  status: string
  num_guests?: number | string | null
  price_per_night?: number | string | null
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
  extra_bed_total?: number | string | null
  discount_type?: string | null
  discount_value?: number | string | null
  total_amount?: number | string | null
  check_in_time?: string | null
  shuttle?: string | null
  notes?: string | null
  pagato?: boolean | null
  bonifico?: boolean | null
  guest_name?: string | null
  rooms?: (CameraTariffa & { id?: string; name?: string | null }) | null
  guests?: { full_name?: string | null; phone?: string | null } | null
}

export const SEZIONI_SCHEDA = [
  { id: 'controllare', label: 'Controllare' },
  { id: 'soggiorno', label: 'Soggiorno' },
  { id: 'conto', label: 'Conto' },
  { id: 'messaggi', label: 'Messaggi' },
  { id: 'cliente', label: 'Cliente' },
]

const nomeCamera = (s: SegmentoScheda) => (s.rooms?.name ?? '').trim() || 'camera'
const perData = (a: SegmentoScheda, z: SegmentoScheda) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id)
export const segmentiAttivi = (segmenti: SegmentoScheda[]) => segmenti.filter(s => s.status !== 'annullata').sort(perData)
const notti = (a: string, z: string) => Math.max(0, Math.round((Date.parse(`${z}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000))
export const testoNotti = (n: number) => (n === 1 ? '1 notte' : `${n} notti`)
const testoOspiti = (n: number) => (n === 1 ? '1 ospite' : `${n} ospiti`)

// «550 €» quando è tondo, «72,50 €» quando non lo è: mai un arrotondamento
// che cambia il conto
export function euroScheda(cent: number): string {
  const c = Math.round(Number.isFinite(cent) ? cent : 0)
  if (c % 100 === 0) return euroTondi(c)
  return `${(c / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
}

// ── Stato in alto a destra ──────────────────────────────────────────────────
// «Conclusa» quando l'ultima partenza è passata, anche se lo stato salvato
// è ancora «confermata»: a Ania interessa se la cliente è già andata via.
export function statoScheda(status: string, ultimaPartenza: string, oggi: string): string {
  if (status === 'annullata') return 'Annullata'
  if (status === 'in_attesa') return 'In attesa'
  if (status === 'completata' || ultimaPartenza <= oggi) return 'Conclusa'
  return 'Confermata'
}

// ── Prima riga: chi è e da dove arriva ──────────────────────────────────────
// «Già stata qui 3 volte · passaparola», «Prima volta». Senza provenienza la
// pagina aggiunge «da dove? ›», che si tocca: qui si dice solo se serve.
export function primaRigaScheda(volte: number, provenienza: string | null | undefined): { testo: string; chiediProvenienza: boolean } {
  const chiE = chiEIlCliente(volte, false)
  const p = (provenienza ?? '').trim()
  return p ? { testo: `${chiE} · ${p}`, chiediProvenienza: false } : { testo: chiE, chiediProvenienza: true }
}

// ── Sotto la data di arrivo ─────────────────────────────────────────────────
// «arriva 15:10 · navetta» (le maiuscole le fa il disegno). Senza orario solo
// «arriva»; «· navetta» soltanto se la navetta è confermata.
export function etichettaArrivoScheda(checkInTime: string | null | undefined, shuttle: string | null | undefined): string {
  const ora = (checkInTime ?? '').trim()
  const pezzi = ['arriva']
  if (ora) pezzi.push(ora)
  const testo = pezzi.join(' ')
  return shuttle === 'si' ? `${testo} · navetta` : testo
}

// ── Le persone di ogni notte, sommando le camere in parallelo ──────────────
function personePerNotte(segmenti: SegmentoScheda[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const s of segmentiAttivi(segmenti)) {
    const giorni = giorniSoggiorno(s.check_in, s.check_out)
    const persone = personePerNottePrenotazione(s.rooms, s)
    giorni.forEach((g, i) => out.set(g, (out.get(g) ?? 0) + (persone[i] ?? 1)))
  }
  return out
}

// Le linee della prenotazione: un cambio camera resta una linea sola (stesso
// group_id), due camere nelle stesse notti sono due linee.
function linee(segmenti: SegmentoScheda[]): SegmentoScheda[][] {
  const gruppi = new Map<string, SegmentoScheda[]>()
  for (const s of segmentiAttivi(segmenti)) {
    const k = s.group_id || s.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(s)
  }
  return [...gruppi.values()].sort((a, b) => perData(a[0], b[0]))
}

// ── La riga grande: OSPITI e CAMERA ─────────────────────────────────────────
// Ospiti = le persone MASSIME in casa in una notte. Camera = il nome della
// camera d'arrivo di ogni linea («Lena + Amelia» con due camere insieme) e,
// se la linea cambia camera, quanti cambi fa (la pagina scrive «⇄ 2»).
export type RigaGrandeScheda = { ospiti: number; camere: string; cambi: number }
export function rigaGrandeScheda(segmenti: SegmentoScheda[]): RigaGrandeScheda {
  const persone = personePerNotte(segmenti)
  const ospiti = persone.size ? Math.max(...persone.values()) : Math.max(1, ...segmentiAttivi(segmenti).map(s => Number(s.num_guests) || 1))
  const nomi: string[] = []
  let cambi = 0
  for (const linea of linee(segmenti)) {
    nomi.push(nomeCamera(linea[0]))
    for (let i = 1; i < linea.length; i++) if (nomeCamera(linea[i]) !== nomeCamera(linea[i - 1])) cambi += 1
  }
  return { ospiti, camere: nomi.join(' + ') || 'camera', cambi }
}

// ── Lo stato del conto, in Georgia sotto la riga grande ─────────────────────
// Le cifre arrivano già fatte (contoPrenotazione): qui si sceglie la frase.
//  · saldato (residuo zero, oppure segnato pagato)     → «✓ 550 € pagato»
//  · accordo bonifico e non è arrivato niente          → «550 € bonifico atteso»
//  · manca qualcosa                                    → «250 € da incassare»
export type StatoConto = { tipo: 'pagato' | 'bonifico_atteso' | 'da_incassare'; testo: string }
export function statoConto(c: { totaleCent: number; ricevutiCent: number; pagato?: boolean | null; bonifico?: boolean | null }): StatoConto {
  const residuo = c.totaleCent - c.ricevutiCent
  if (c.pagato || residuo <= 0) return { tipo: 'pagato', testo: `✓ ${euroScheda(c.totaleCent)} pagato` }
  if (c.bonifico && c.ricevutiCent <= 0) return { tipo: 'bonifico_atteso', testo: `${euroScheda(residuo)} bonifico atteso` }
  return { tipo: 'da_incassare', testo: `${euroScheda(residuo)} da incassare` }
}

// ── Le note in rosso ────────────────────────────────────────────────────────
// Prima quella del cliente (la sua scheda), senza parolina; poi quella di
// questa prenotazione, preceduta da «questa volta». Vuote = niente.
export const ETICHETTA_NOTA_PRENOTAZIONE = 'questa volta'
export function noteScheda(notaCliente: string | null | undefined, notaPrenotazione: string | null | undefined): { etichetta: string; testo: string }[] {
  const out: { etichetta: string; testo: string }[] = []
  const c = (notaCliente ?? '').trim()
  const p = (notaPrenotazione ?? '').trim()
  if (c) out.push({ etichetta: '', testo: c })
  if (p) out.push({ etichetta: ETICHETTA_NOTA_PRENOTAZIONE, testo: p })
  return out
}

// ── La striscia delle notti ─────────────────────────────────────────────────
export type CasellaSoggiorno = {
  iso: string
  giorno: string        // «gio», oppure «Oggi»
  numero: number        // il giorno del mese
  camera: string        // «Amelia», «Lena + Amelia»
  persone: number
  cambia: boolean       // la camera è diversa dalla notte prima
  oggi: boolean
  segmentoId: string    // il tratto che si apre toccando la notte
}
const giornoSettimana = (iso: string) => {
  const [a, m, g] = iso.split('-').map(Number)
  return GIORNI_BREVI[new Date(Date.UTC(a, m - 1, g)).getUTCDay()]
}

export function caselleSoggiorno(segmenti: SegmentoScheda[], oggi: string): CasellaSoggiorno[] {
  const attivi = segmentiAttivi(segmenti)
  if (attivi.length === 0) return []
  const persone = personePerNotte(attivi)
  const giorni = [...new Set(attivi.flatMap(s => giorniSoggiorno(s.check_in, s.check_out)))].sort()
  const out: CasellaSoggiorno[] = []
  for (const iso of giorni) {
    const dentro = attivi.filter(s => s.check_in <= iso && iso < s.check_out)
    const camera = [...new Set(dentro.map(nomeCamera))].join(' + ') || 'camera'
    out.push({
      iso,
      giorno: iso === oggi ? 'Oggi' : giornoSettimana(iso),
      numero: Number(iso.slice(8, 10)),
      camera,
      persone: persone.get(iso) ?? 1,
      cambia: out.length > 0 && out[out.length - 1].camera !== camera,
      oggi: iso === oggi,
      segmentoId: dentro[0]?.id ?? attivi[0].id,
    })
  }
  return out
}

// ── La riga «Arrivo» sotto la striscia ──────────────────────────────────────
// «oggi 🕐 15:10 con navetta»: la pagina mette l'orario nella pastiglia.
// Senza orario: «da chiedere», in ottone.
export type ArrivoScheda = { quando: string; orario: string | null; navetta: string | null }
export function arrivoScheda(checkIn: string, oggi: string, checkInTime: string | null | undefined, shuttle: string | null | undefined): ArrivoScheda {
  const quando = checkIn === oggi ? 'oggi'
    : checkIn === spostaGiorni(oggi, 1) ? 'domani'
    : checkIn === spostaGiorni(oggi, -1) ? 'ieri'
    : `${giornoSettimana(checkIn)} ${Number(checkIn.slice(8, 10))} ${MESI_BREVI[Number(checkIn.slice(5, 7)) - 1]}`
  const orario = (checkInTime ?? '').trim() || null
  const navetta = shuttle === 'si' ? 'con navetta' : shuttle === 'no' ? 'senza navetta' : null
  return { quando, orario, navetta }
}

// ── I tratti di camera ──────────────────────────────────────────────────────
// Una riga per tratto: «Lena  240 €» e sotto «10 → 13 · 3 notti · 2 ospiti ·
// 80 € a notte». Il numero delle notti c'è SEMPRE. Il prezzo del tratto è
// quello salvato (contoSoggiorno in lettura), mai rifatto.
export type TrattoCamera = {
  id: string
  camera: string
  prezzo: string
  dettaglio: string
  cambio: boolean       // segue un altro tratto della stessa linea: «⇄ CAMBIO»
}
// «10 → 13» nello stesso mese, «30 set → 2 ott» quando il mese cambia
export function periodoTratto(dal: string, al: string): string {
  const g = (iso: string) => Number(iso.slice(8, 10))
  const m = (iso: string) => MESI_BREVI[Number(iso.slice(5, 7)) - 1]
  if (dal.slice(0, 7) === al.slice(0, 7)) return `${g(dal)} → ${g(al)}`
  return `${g(dal)} ${m(dal)} → ${g(al)} ${m(al)}`
}
export function trattiCamera(segmenti: SegmentoScheda[]): TrattoCamera[] {
  const attivi = segmentiAttivi(segmenti)
  return attivi.map((s, i) => {
    const n = notti(s.check_in, s.check_out)
    const conto = contoSoggiorno(s)
    const dett = dettaglioNottiSalvato(s.rooms, s)
    const aNotte = dett ? testoDettaglioNotti(dett, fmtEuroBreve) : `${fmtEuroBreve(Number(s.price_per_night) || 0)} a notte`
    const ospiti = Math.max(1, Number(s.num_guests) || 1)
    const precedente = attivi.slice(0, i).find(p => (p.group_id || p.id) === (s.group_id || s.id) && p.check_out === s.check_in)
    return {
      id: s.id,
      camera: nomeCamera(s),
      prezzo: euroScheda(Math.round(conto.totale * 100)),
      dettaglio: `${periodoTratto(s.check_in, s.check_out)} · ${testoNotti(n)} · ${testoOspiti(ospiti)} · ${aNotte}`,
      // «cambio» solo se la camera è davvero un'altra: due tratti della stessa
      // camera (persone diverse, 17/09/2026) non sono un cambio camera
      cambio: !!precedente && nomeCamera(precedente) !== nomeCamera(s),
    }
  })
}

// ── Da controllare, di QUESTA prenotazione ──────────────────────────────────
// Le regole sono quelle della Home (lib/daControllare): pagamenti, arrivo
// senza orario, sovrapposizioni. In più due cose che si vedono solo da qui:
//  · CAMBIO CAMERA — oggi o domani la cliente cambia camera;
//  · DOCUMENTO — non ha ancora un documento caricato (in casa o prima dell'arrivo).
// Le voci hanno la forma delle schedine della proposta (VoceControllo).
export type DatiControlloScheda = {
  segmenti: SegmentoScheda[]        // i tratti di questa prenotazione
  altre: PrenotazioneDC[]           // le altre prenotazioni nelle stesse notti (sovrapposizioni, letti)
  pagamenti: PagamentoStat[]
  oggi: string
  documenti: number | null          // quanti documenti ha il cliente; null = non si sa ancora
  hrefDocumenti: string | null
}

const comeDC = (s: SegmentoScheda): PrenotazioneDC => ({
  id: s.id, group_id: s.group_id ?? null, room_id: s.room_id ?? s.rooms?.id ?? '', check_in: s.check_in, check_out: s.check_out,
  status: s.status, total_amount: s.total_amount ?? null, pagato: s.pagato ?? null, bonifico: s.bonifico ?? null,
  num_guests: s.num_guests ?? null, guest_name: s.guest_name ?? null, guest_id: s.guest_id ?? null,
  extra_bed: s.extra_bed ?? null, extra_bed_dates: s.extra_bed_dates ?? null, check_in_time: s.check_in_time ?? null, shuttle: s.shuttle ?? null,
  rooms: s.rooms?.name ? { name: s.rooms.name } : null, guests: s.guests ?? null,
})

function daEccezione(e: Eccezione): VoceControllo {
  return {
    chiave: e.chiave,
    etichetta: ETICHETTA_TIPO[e.tipo],
    titolo: e.motivo,
    dettaglio: e.titolo,
    link: { testo: e.bottone, href: hrefDestinazione(e.destinazione) },
  }
}

export function daControllareScheda(d: DatiControlloScheda): VoceControllo[] {
  const attivi = segmentiAttivi(d.segmenti)
  if (attivi.length === 0) return []
  const miei = attivi.map(comeDC)
  const ids = new Set(miei.map(m => m.id))
  const out: VoceControllo[] = []

  // Arrivo di oggi o domani senza orario
  out.push(...eccezioniArrivi(miei, d.oggi).map(daEccezione))

  // Cambio camera oggi o domani
  const domani = spostaGiorni(d.oggi, 1)
  const caselle = caselleSoggiorno(attivi, d.oggi)
  caselle.forEach((c, i) => {
    if (!c.cambia || (c.iso !== d.oggi && c.iso !== domani)) return
    const prima = caselle[i - 1]
    out.push({
      chiave: `cambio:${c.iso}`,
      etichetta: 'Cambio camera',
      titolo: `${c.iso === d.oggi ? 'Oggi' : 'Domani'} passa da ${prima.camera} a ${c.camera}`,
      dettaglio: `${c.camera} va pronta prima del cambio`,
      link: null,
    })
  })

  // Pagamenti: solo i tratti di questa prenotazione
  out.push(...eccezioniPagamenti(miei, d.pagamenti, d.oggi).map(daEccezione))

  // Documento: nessun documento caricato, finché il soggiorno non è finito
  // (Ania, 17/09/2026: prima solo con la cliente in casa; se manca, lo si
  // vuole vedere anche prima dell'arrivo)
  const arrivo = attivi[0].check_in
  const partenza = attivi.reduce((m, s) => (s.check_out > m ? s.check_out : m), attivi[0].check_out)
  if (d.documenti === 0 && partenza > d.oggi) {
    const inCasa = arrivo <= d.oggi
    out.push({
      chiave: 'documento',
      etichetta: 'Documento',
      titolo: 'Nessun documento caricato',
      dettaglio: inCasa ? 'la cliente è in casa: manca la foto del documento' : 'manca la foto del documento: da chiedere all’arrivo',
      link: d.hrefDocumenti ? { testo: 'Aggiungi documento', href: d.hrefDocumenti } : null,
    })
  }

  // Sovrapposizioni e letti oltre il pool, solo quelle che toccano queste camere
  const tutte = [...miei, ...d.altre.filter(a => !ids.has(a.id))]
  for (const e of eccezioniCalendario(tutte)) {
    const mia = e.chiave.startsWith('sovrapposizione:')
      ? e.chiave.split(':').slice(1).some(id => ids.has(id))
      : miei.some(m => !!m.extra_bed && m.check_in <= e.data && e.data < m.check_out)
    if (mia) out.push(daEccezione(e))
  }
  return out
}

export const TUTTO_A_POSTO = '✓ Tutto a posto'

// Le pastiglie in cima alla scheda: stanno qui perché una pagina di Next non
// può esportare costanti (16/09/2026).
export const PRENOTAZIONE_SALVATA = '✓ Prenotazione salvata'
export const PRENOTAZIONE_DA_RICHIESTA = '✓ Prenotazione creata dalla richiesta'
export const FONDO_SALVATA = 'var(--color-sage)'
export const FONDO_ANNULLATA = '#F6E4DE'
export const TESTO_ANNULLATA = '#8C3B2E'
