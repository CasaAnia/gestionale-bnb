// ============================================================================
// LA SCHEDA PRENOTAZIONE, PARTE 2 (13/09/2026): CONTO, CLIENTE e CRONOLOGIA.
// Come nella parte 1, qui si decide COSA scrivere e la pagina decide come.
// Funzioni pure: niente Supabase, niente orologio.
//
// Il totale e il residuo NON si ricalcolano mai: arrivano da
// `contoPrenotazione` (lib/prenotazioneUnica), la stessa funzione della scheda
// attuale. Qui si usano `contoSoggiorno` e il dettaglio per notte solo per
// SPEZZARE il conto in righe leggibili; se la somma delle righe non torna col
// totale autorevole di un tratto, il tratto si mostra in una riga sola —
// stessa prudenza di `lib/riepilogoCosti`.
// ============================================================================
import { contoSoggiorno } from './conto.ts'
import { dettaglioNottiSalvato, testoDettaglioNotti, fmtEuroBreve, giorniSoggiorno, prezzoPrenotazione, type CameraTariffa } from './prezzoNotti.ts'
import { rigaSconto, nottiANotte, dettaglioLetto, percentualeComune, RIGA_LETTO, type RigaContoVista, type ScontoVista } from './contoInRighe.ts'
import { lettoInclusoNellaCamera } from './roomTypes.ts'
import { comePagaInParole } from './comePaga.ts'
import { euroScheda, periodoConMese, segmentiAttivi, testoNotti, type SegmentoScheda } from './schedaPrenotazione.ts'
import { quandoEvento, descriviEvento, type EventoCronologia } from './cronologia.ts'
import { MESI_BREVI } from './dateItaliane.ts'
import { telefonoAGruppi } from './whatsapp.ts'

// ── Lo stato del conto, in grande ──────────────────────────────────────────
export type PagamentoScheda = { id: string; booking_id?: string; amount: number | string; method?: string | null; paid_on?: string | null; note?: string | null }

const giornoBreve = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const [, m, g] = String(iso).slice(0, 10).split('-').map(Number)
  return Number.isFinite(g) && Number.isFinite(m) ? `${g} ${MESI_BREVI[m - 1]}` : ''
}
const metodoInParole = (m: string | null | undefined): string => {
  const v = (m ?? '').trim()
  return v === 'bonifico' ? 'bonifico' : v === 'carta' ? 'carta' : v === 'altro' ? 'altro' : 'contanti'
}
const importo = (p: PagamentoScheda) => Math.round(Number(p.amount || 0) * 100)

// I pagamenti registrati in ordine di data (poi di lettura)
function pagamentiInOrdine(pagamenti: PagamentoScheda[]): PagamentoScheda[] {
  return [...pagamenti].sort((a, b) => String(a.paid_on ?? '').localeCompare(String(b.paid_on ?? '')))
}
// Quando sono arrivati i soldi: «10 set» con un pagamento, «7 e 16 set» con
// due, «in 3 volte, ultimo 20 set» da tre in su (Ania, 20/09/2026: «800 €
// pagati, 16 set» non bastava, erano due pagamenti da 400)
// Torna già con la sua virgola o il suo spazio davanti, da attaccare a «pagati»
// o al modo: «, 10 set» · «, 7 e 16 set» · « in 3 volte, ultimo 20 set»
function quandoPagati(pagamenti: PagamentoScheda[]): string {
  const giorni = pagamentiInOrdine(pagamenti).map(p => giornoBreve(p.paid_on)).filter(Boolean)
  if (giorni.length === 0) return ''
  if (giorni.length === 1) return `, ${giorni[0]}`
  if (giorni.length === 2) {
    const [a, b] = giorni
    const [ga, ma] = a.split(' '), [gb, mb] = b.split(' ')
    return ma === mb ? `, ${ga} e ${gb} ${ma}` : `, ${a} e ${b}`
  }
  return ` in ${giorni.length} volte, ultimo ${giorni[giorni.length - 1]}`
}

export type TestaConto = {
  titolo: string           // «Saldato» oppure quanto manca, «250 €»
  saldato: boolean
  dettaglio: string        // «550 € su 550 €» oppure «da incassare»
  sotto: string            // «contanti, 10 set» · «300 € pagati, 10 set» · «800 € pagati, 7 e 16 set» · ''
  quotaPagata: number      // 0–1, la lunghezza della barretta
}

export function testaConto(
  conto: { totaleCent: number; ricevutiCent: number },
  pagamenti: PagamentoScheda[],
  pagato = false,
): TestaConto {
  const mancaCent = Math.max(0, conto.totaleCent - conto.ricevutiCent)
  const saldato = pagato || mancaCent <= 0
  const ordinati = pagamentiInOrdine(pagamenti)
  const ultimo = ordinati.length ? ordinati[ordinati.length - 1] : null
  const quando = quandoPagati(pagamenti)
  const quota = conto.totaleCent > 0 ? Math.min(1, Math.max(0, conto.ricevutiCent / conto.totaleCent)) : (saldato ? 1 : 0)
  if (saldato) {
    return {
      titolo: 'Saldato',
      saldato: true,
      dettaglio: `${euroScheda(conto.totaleCent)} su ${euroScheda(conto.totaleCent)}`,
      sotto: ultimo ? `${metodoInParole(ultimo.method)}${quando}` : '',
      quotaPagata: 1,
    }
  }
  return {
    titolo: euroScheda(mancaCent),
    saldato: false,
    dettaglio: 'da incassare',
    sotto: conto.ricevutiCent > 0 ? `${euroScheda(conto.ricevutiCent)} pagati${quando}` : '',
    quotaPagata: quota,
  }
}

// ── Il conto in righe ──────────────────────────────────────────────────────
// Come deciso per l'inserimento (Ania, 18/09/2026): prima una riga per ogni
// camera col dettaglio piccolo sotto («29 → 30 nov · 1 notte × 90 €»), poi
// il letto in più in UNA riga sola con tutte le notti in cui c'è, poi
// «Totale» (quanto costa senza sconto), lo sconto in UNA riga sola in ottone
// e intero senza centesimi («Sconto 10 %» in percentuale, «Sconto» se nasce
// da un prezzo concordato), poi «Da pagare» e sotto «3 notti · 85 € a notte».
// Lo sconto resta ripartito riga per riga nei dati: qui si mostra una volta.
// `daPagareCent` è il totale autorevole di lib/prenotazioneUnica: lo sconto
// mostrato è la differenza col prezzo pieno delle righe, così le tre cifre
// tornano sempre fra loro.
export type ContoInRighe = {
  righe: RigaContoVista[]
  totaleCent: number      // il prezzo pieno: la somma delle righe
  totale: string
  sconto: ScontoVista | null
  daPagare: string
  sotto: string           // «3 notti · 85 € a notte»
}

export function contoScheda(segmenti: SegmentoScheda[], daPagareCent: number): ContoInRighe {
  const righe: RigaContoVista[] = []
  const giorni = new Set<string>()
  let pienoCent = 0
  let lettoNotti = 0, lettoCent = 0
  const unitari: number[] = []
  const vivi = segmentiAttivi(segmenti)
  for (const s of vivi) {
    const conto = contoSoggiorno(s)
    const n = conto.notti
    for (const g of giorniSoggiorno(s.check_in, s.check_out)) giorni.add(g)
    const camera = (s.rooms?.name ?? '').trim() || 'camera'
    const periodo = periodoConMese(s.check_in, s.check_out)
    const prezzo = Number(s.price_per_night) || 0
    const lettoRiga = Math.round(Number(s.extra_bed_total || 0) * 100)

    // La camera: col letto compreso (Lena in tre) la riga è una sola, tutto
    // compreso; se la tariffa cambia fra le notti si scrive il dettaglio.
    const dett = dettaglioNottiSalvato(s.rooms, s)
    const compreso = lettoInclusoNellaCamera(s, n)
    const cameraCent = compreso ? Math.round(prezzo * n * 100) + lettoRiga : Math.round(prezzo * n * 100)
    const aParte = !compreso && Boolean(s.extra_bed) && lettoRiga > 0

    // Le righe devono tornare col prezzo pieno del tratto: se un dato vecchio
    // non torna, del tratto si scrive una riga sola col totale autorevole.
    if (Math.abs(cameraCent + (aParte ? lettoRiga : 0) - Math.round(conto.prezzoPieno * 100)) > 1) {
      const totaleRiga = Math.round(conto.totale * 100)
      righe.push({ chiave: `${s.id}:unica`, titolo: camera, dettaglio: `${periodo} · ${testoNotti(n)}`, importo: euroScheda(totaleRiga) })
      pienoCent += totaleRiga
      continue
    }
    const quanto = dett
      ? testoDettaglioNotti(dett, fmtEuroBreve)
      : `${testoNotti(n)} × ${fmtEuroBreve(compreso && n > 0 ? cameraCent / 100 / n : prezzo)}`
    righe.push({ chiave: `${s.id}:camera`, titolo: camera, dettaglio: `${periodo} · ${quanto}`, importo: euroScheda(cameraCent) })
    pienoCent += cameraCent

    // Il letto in più, quando viene addebitato a parte: si somma alla riga unica
    if (aParte) {
      const notti = s.extra_bed_dates && s.extra_bed_dates.length > 0 ? s.extra_bed_dates.length : n
      lettoNotti += notti
      lettoCent += lettoRiga
      unitari.push(Number.isInteger(lettoRiga / notti) ? lettoRiga / notti : -1)
      pienoCent += lettoRiga
    }
  }
  if (lettoCent > 0) {
    righe.push({ chiave: 'letto', titolo: RIGA_LETTO, dettaglio: dettaglioLetto(lettoNotti, lettoCent, unitari), importo: euroScheda(lettoCent) })
  }
  const scontoCent = Math.max(0, pienoCent - daPagareCent)
  return {
    righe,
    totaleCent: pienoCent,
    totale: euroScheda(pienoCent),
    sconto: rigaSconto(scontoCent, percentualeComune(vivi)),
    daPagare: euroScheda(daPagareCent),
    sotto: nottiANotte(giorni.size, daPagareCent),
  }
}

// ── Fino a dove arrivano i pagamenti ────────────────────────────────────────
// REGOLA FISSA n. 9 (Ania, 20/09/2026): il pagamento non si divide fra le
// camere, si registra intero sulla prenotazione. Per sapere «fin dove» arriva
// si fanno scorrere i soldi ricevuti lungo le notti in ordine di tempo, come
// nel calendario (le notti coperte in verde): qui si scrive l'ultima notte
// coperta per intero, «I pagamenti coprono fino alla notte del 10 set».
// Il prezzo di ogni notte viene da lib/prezzoNotti; se il tratto ha uno sconto
// (il totale salvato è diverso dalla somma delle notti) le notti si scalano in
// proporzione, così la copertura torna col conto.
export const COPERTURA_FINO = (notte: string) => `I pagamenti coprono fino alla notte del ${notte}`
export const COPERTURA_NIENTE = 'I pagamenti non coprono ancora la prima notte'

/** L'ultima notte (YYYY-MM-DD) coperta per intero dai soldi ricevuti; null se
 *  nessuna; 'tutte' se coprono tutto il soggiorno. */
export function ultimaNotteCoperta(
  segmenti: SegmentoScheda[], camere: (CameraTariffa & { id?: string })[], ricevutiCent: number,
): string | null | 'tutte' {
  let soldi = Math.round(ricevutiCent)
  if (soldi <= 0) return null
  const vivi = segmentiAttivi(segmenti)
  let ultima: string | null = null
  for (const s of vivi) {
    const camera = camere.find(c => c.id && c.id === s.room_id) ?? s.rooms ?? null
    const giorni = giorniSoggiorno(s.check_in, s.check_out)
    let tariffe = prezzoPrenotazione(camera, s).notti.map(x => Math.round(x.tariffa * 100))
    const totale = Math.round(Number(s.total_amount ?? 0) * 100)
    const somma = tariffe.reduce((a, b) => a + b, 0)
    if (tariffe.length !== giorni.length || somma <= 0 || tariffe.some(t => t <= 0)) {
      // senza un prezzo per notte leggibile si divide il totale in parti uguali
      tariffe = giorni.map(() => Math.round(totale / Math.max(1, giorni.length)))
    } else if (totale > 0 && somma !== totale) {
      tariffe = tariffe.map(t => Math.round(t * totale / somma))
    }
    for (let i = 0; i < giorni.length; i++) {
      if (soldi < tariffe[i]) return ultima
      soldi -= tariffe[i]
      ultima = giorni[i]
    }
  }
  return 'tutte'
}

/** La riga piccola sotto i pagamenti; vuota quando non c'è niente da dire
 *  (nessun incasso) o il conto è saldato (lo dice già la testa). */
export function notaCopertura(
  segmenti: SegmentoScheda[], camere: (CameraTariffa & { id?: string })[], ricevutiCent: number, saldato: boolean,
): string {
  if (saldato || ricevutiCent <= 0) return ''
  const notte = ultimaNotteCoperta(segmenti, camere, ricevutiCent)
  if (notte === 'tutte') return ''
  if (!notte) return COPERTURA_NIENTE
  return COPERTURA_FINO(giornoBreve(notte))
}

// ── Come paga ───────────────────────────────────────────────────────────────
// I nomi e le frasi stanno in un posto solo (lib/comePaga): qui si legge
// soltanto quello che è salvato sulla prenotazione.
export function comePagaScheda(accordo: string | null | undefined, bonifico?: boolean | null): { nome: string; frase: string } {
  return comePagaInParole(accordo, bonifico)
}

// ── I pagamenti già registrati ─────────────────────────────────────────────
// La nota (proposta 0055) si legge sotto, in piccolo; senza, niente.
export type RigaPagamento = { id: string; quando: string; importo: string; nota: string }

export function righePagamenti(pagamenti: PagamentoScheda[]): RigaPagamento[] {
  return [...pagamenti]
    .sort((a, b) => String(a.paid_on ?? '').localeCompare(String(b.paid_on ?? '')))
    .map(p => ({
      id: p.id,
      quando: [giornoBreve(p.paid_on), metodoInParole(p.method)].filter(Boolean).join(' · '),
      importo: euroScheda(importo(p)),
      nota: (p.note ?? '').trim(),
    }))
}

// ── La parte CLIENTE ───────────────────────────────────────────────────────
export type VoceCliente = { etichetta: string; valore: string; chiedi?: boolean }

export const VALUTAZIONE_IN_PAROLE: Record<string, string> = {
  ottimo: '★ ottima',
  problematico: 'problematica',
  normale: 'normale',
}

export function vociCliente(c: {
  telefono?: string | null
  provenienza?: string | null     // già in parole (lib/provenienza.provenienzaInParole)
  valutazione?: string | null
  ricevuta?: boolean
  nota?: string | null
}): VoceCliente[] {
  const provenienza = (c.provenienza ?? '').trim()
  const voci: VoceCliente[] = [
    { etichetta: 'telefono', valore: (c.telefono ?? '').trim() || 'nessun numero' },
    provenienza
      ? { etichetta: 'arrivata da', valore: provenienza }
      : { etichetta: 'arrivata da', valore: 'da dove? ›', chiedi: true },
    { etichetta: 'valutazione', valore: VALUTAZIONE_IN_PAROLE[(c.valutazione ?? 'normale')] ?? 'normale' },
    { etichetta: 'ricevuta', valore: c.ricevuta ? 'sì' : 'no' },
  ]
  const nota = (c.nota ?? '').trim()
  if (nota) voci.push({ etichetta: 'nota del cliente', valore: nota })
  return voci
}

// Chi ha soggiornato con lei: i contatti in più della prenotazione (nome e
// numero). Senza uno dei due si scrive «senza nome» o «senza numero»; se non
// c'è né l'uno né l'altro la persona non esiste e non compare.
// Chi è: `chi_e` per la prima persona, `chi_e_2` per la seconda (proposta 0056).
export type PersonaConLei = { chiave: string; nome: string; chiE: string; telefono: string; senzaNome: boolean; senzaNumero: boolean }

export function personeConLei(b: {
  extra_phone_1?: string | null; extra_phone_1_name?: string | null; chi_e?: string | null
  extra_phone_2?: string | null; extra_phone_2_name?: string | null; chi_e_2?: string | null
} | null | undefined): PersonaConLei[] {
  const coppie = [
    { chiave: 'uno', nome: b?.extra_phone_1_name, telefono: b?.extra_phone_1, chiE: b?.chi_e },
    { chiave: 'due', nome: b?.extra_phone_2_name, telefono: b?.extra_phone_2, chiE: b?.chi_e_2 },
  ]
  return coppie
    .map(c => ({ chiave: c.chiave, nome: (c.nome ?? '').trim(), telefono: (c.telefono ?? '').trim(), chiE: (c.chiE ?? '').trim() }))
    .filter(c => c.nome || c.telefono)
    .map(c => ({
      chiave: c.chiave,
      nome: c.nome || 'senza nome',
      chiE: c.chiE,
      // il numero si legge come nella testa: «333 456 7890»
      telefono: c.telefono ? (telefonoAGruppi(c.telefono) || c.telefono) : 'senza numero',
      senzaNome: !c.nome,
      senzaNumero: !c.telefono,
    }))
}

// ── La cronologia ──────────────────────────────────────────────────────────
// Le modifiche le scrive il database (booking_events, proposta 0042); i
// messaggi partiti stanno in booking_whatsapp_log. Qui si mettono insieme,
// DALLA PIÙ VECCHIA, che è come si legge una storia.
export type MessaggioInviato = { id: string; message_type: string; created_at: string }
export type RigaStoria = { id: string; quando: string; cosa: string; messaggio: boolean }

export const NOME_MESSAGGIO: Record<string, string> = {
  conferma: 'Conferma inviata',
  modifica: 'Modifica inviata',
  annullamento: 'Annullamento inviato',
}

export const NOTA_CRONOLOGIA = 'Qui compaiono i messaggi che mandi tu dal gestionale. Le risposte della cliente restano solo su WhatsApp.'

// Prima riga della storia: la prenotazione è nata.
export function righeStoria(
  eventi: EventoCronologia[],
  messaggi: MessaggioInviato[],
  creata: string | null | undefined,
  adesso: Date = new Date(),
): RigaStoria[] {
  const righe: (RigaStoria & { ordine: string; n: number })[] = []
  if (creata) righe.push({ id: 'creata', quando: quandoEvento(creata, adesso), cosa: 'Prenotazione creata', messaggio: false, ordine: creata, n: -1 })
  for (const e of eventi) {
    const cosa = descriviEvento(e)
    righe.push({ id: e.id, quando: quandoEvento(e.created_at, adesso), cosa: cosa.charAt(0).toUpperCase() + cosa.slice(1), messaggio: false, ordine: e.created_at, n: Number(e.n ?? 0) })
  }
  for (const m of messaggi) {
    righe.push({ id: m.id, quando: quandoEvento(m.created_at, adesso), cosa: NOME_MESSAGGIO[m.message_type] ?? 'Messaggio inviato', messaggio: true, ordine: m.created_at, n: 0 })
  }
  return righe
    .sort((a, b) => a.ordine.localeCompare(b.ordine) || a.n - b.n)
    .map(({ id, quando, cosa, messaggio }) => ({ id, quando, cosa, messaggio }))
}
