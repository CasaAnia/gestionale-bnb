// ============================================================================
// «DA CONTROLLARE» in Home (versione B, 06/09/2026): elenco di ECCEZIONI, non
// di attività. Dai dati già letti (richieste aperte, prenotazioni del periodo,
// movimenti, fatture) produce le voci con tipo, urgenza, testi e destinazione.
// Le voci spariscono da sole quando il problema si risolve nella sua sezione:
// nessuna spunta «fatto», nessuna scrittura qui. Funzioni pure, senza
// Supabase e senza orologio: `oggi` e `adesso` arrivano dal chiamante.
//
// Regole (incarico del 06/09/2026):
//  Richieste  TUTTE le aperte (07/09/2026): in attesa, proposta inviata in
//             scadenza, proposta scaduta (3 ore, lib/richieste.scadenzaProposta),
//             arrivo già passato. Ordine: durata del soggiorno decrescente,
//             a parità la prima a scadere (arrivo passato, proposta scaduta,
//             in scadenza più vicina, in attesa dalla più vecchia).
//  Pagamenti  soggiorno concluso segnato pagato ma con movimenti che non
//             coprono il totale; movimenti oltre il totale; soggiorno
//             concluso da più di un giorno e non segnato pagato.
//  Calendario due prenotazioni confermate sulla stessa camera nella stessa
//             notte; letti aggiuntivi oltre i 2 del pool nella stessa notte.
//  Arrivi     arrivo di domani senza orario.
//  Fatture    scadenza passata e non pagata (approvata_da_pagare).
// Urgenza alta (linea ottone): proposta scaduta, arrivo passato, arrivo di
// domani senza orario. Ordine delle sezioni (07/09/2026): richieste, arrivi,
// pagamenti, fatture; le sovrapposizioni del calendario restano un controllo
// nascosto che compare IN FONDO solo se mai si verifica.
// ============================================================================
import { scadenzaProposta, nomeCompleto, formatIntervallo, nottiRichiesta, STATI_APERTI, ORE_SCADENZA_PROPOSTA, type StatoRichiesta } from './richieste.ts'
import { nomeOspite } from './guestName.ts'
import { spostaGiorni } from './statistiche/periodo.ts'
import { cent, prenotazioneValida, type PrenotazioneStat, type PagamentoStat, type DocumentoStat } from './statistiche/tipi.ts'
import { incongruenzePagamenti } from './statistiche/pagato.ts'
import { lettiOccupatiPerNotte } from './lettiAggiuntivi.ts'
import { EXTRA_BED_MAX } from './tariffe.ts'
import { normalizzaTelefono } from './whatsapp.ts'
import { whatsappRichiestaOrario, waHrefTesto } from './messaggiWhatsApp.ts'

export const GIORNI_CONCLUSO_NON_PAGATO = 1

export type TipoEccezione = 'calendario' | 'richiesta' | 'pagamento' | 'arrivo' | 'fattura'
export type Urgenza = 'alta' | 'normale'

// Dove porta l'unico bottone della voce: il punto esatto da sistemare
export type Destinazione =
  | { tipo: 'richiesta'; id: string }                 // /richieste/<id>
  | { tipo: 'saldo'; prenotazioneId: string }          // scheda prenotazione con «Segna come pagato» aperto
  | { tipo: 'prenotazione'; prenotazioneId: string }   // scheda prenotazione (movimenti oltre il totale)
  | { tipo: 'calendario'; giorno: string }             // calendario sul giorno
  | { tipo: 'arrivo'; prenotazioneId: string }         // Arrivi con la finestra dell'orario aperta
  | { tipo: 'fattura'; documentoId: string }           // Spese B&B, Documenti, sulla fattura

export type Eccezione = {
  chiave: string          // stabile: serve ai rinvii e alle key di React
  tipo: TipoEccezione
  urgenza: Urgenza
  data: string            // YYYY-MM-DD della cosa da sistemare (ordinamento)
  titolo: string          // chi, cosa, quando
  motivo: string          // perché compare
  bottone: string
  destinazione: Destinazione
  rimandabile: boolean    // solo le richieste hanno «Rimanda»
  // Ritocchi del 07/09/2026: chat WhatsApp con l'ospite. Negli arrivi senza
  // orario è il bottone PIENO col testo «Richiesta orario» della scheda
  // (lib/messaggiWhatsApp, stesso link); nelle proposte scadute è un ghost
  // senza testo (Ania scrive a mano). Assente senza numero di telefono.
  whatsapp?: LinkWhatsAppEccezione
}
export type LinkWhatsAppEccezione = { href: string; numero: string; testo: string; principale: boolean }

export const ETICHETTA_TIPO: Record<TipoEccezione, string> = {
  calendario: 'Calendario', richiesta: 'Richiesta', pagamento: 'Pagamento', arrivo: 'Arrivo', fattura: 'Fattura',
}

export type RichiestaDC = {
  id: string
  stato: StatoRichiesta | string
  arrivo: string
  partenza: string
  created_at: string
  proposta_inviata_at: string | null
  nome?: string | null
  cognome?: string | null
  telefono?: string | null
}

export type PrenotazioneDC = PrenotazioneStat & {
  extra_bed?: boolean | null
  extra_bed_dates?: string[] | null
  check_in_time?: string | null
  rooms?: { name: string } | null
  guests?: { full_name?: string | null; phone?: string | null } | null
}

// Rinvio di una voce (solo richieste): la chiave resta nascosta finché
// oggi < fino_a. Memoria lato server (tabella proposta 0035), mai localStorage.
export type Rinvio = { chiave: string; fino_a: string }

export type StatoDaControllare = {
  oggi: string
  adesso: Date
  richieste: RichiestaDC[]
  prenotazioni: PrenotazioneDC[]
  pagamenti: PagamentoStat[]
  documenti: DocumentoStat[]
  rinvii?: Rinvio[]
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
export function giornoBreve(iso: string): string {
  const [, m, g] = iso.split('-').map(Number)
  return `${g} ${MESI[m - 1] ?? ''}`.trim()
}
export const euroTesto = (c: number) => `${(c / 100).toLocaleString('it-IT', { minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`
const nomeCamera = (b: PrenotazioneDC) => (b.rooms?.name ?? '').split(' ').slice(-1)[0] || 'camera'
const oreTra = (da: string, adesso: Date) => (adesso.getTime() - new Date(da).getTime()) / 3600000
function giorniTesto(ore: number): string {
  const g = Math.floor(ore / 24)
  if (g >= 1) return g === 1 ? '1 giorno' : `${g} giorni`
  const h = Math.floor(ore)
  if (h === 0) return `${Math.max(1, Math.floor(ore * 60))} min`
  return h === 1 ? '1 ora' : `${h} ore`
}

// ── Richieste ───────────────────────────────────────────────────────────────
// Tutte le aperte. Per l'ordine ogni voce porta durata (notti) e «quando
// scade»: arrivo passato prima di tutto, poi proposta scaduta (dalla più
// vecchia), poi in scadenza (la più vicina), poi in attesa (dalla più vecchia).
type ClasseRichiesta = 'arrivo_passato' | 'scaduta' | 'in_scadenza' | 'in_attesa'
const RANGO_CLASSE: Record<ClasseRichiesta, number> = { arrivo_passato: 0, scaduta: 1, in_scadenza: 2, in_attesa: 3 }
type VoceRichiesta = { eccezione: Eccezione; notti: number; classe: ClasseRichiesta; quando: number }

export function eccezioniRichieste(richieste: RichiestaDC[], oggi: string, adesso: Date): Eccezione[] {
  const voci: VoceRichiesta[] = []
  for (const r of richieste) {
    if (!STATI_APERTI.includes(r.stato as StatoRichiesta)) continue   // chiusa: mai
    const chi = nomeCompleto(r) || 'Richiesta'
    const base = { chiave: `richiesta:${r.id}`, tipo: 'richiesta' as const, data: r.arrivo, bottone: 'Apri richiesta', destinazione: { tipo: 'richiesta' as const, id: r.id }, rimandabile: true }
    const titolo = `${chi} · ${formatIntervallo(r.arrivo, r.partenza)}`
    const notti = nottiRichiesta(r)
    const creata = new Date(r.created_at).getTime()
    const numero = normalizzaTelefono(r.telefono).numero
    if (r.arrivo < oggi) {
      voci.push({ notti, classe: 'arrivo_passato', quando: creata, eccezione: { ...base, urgenza: 'alta', titolo, motivo: `Arrivo del ${giornoBreve(r.arrivo)} già passato e richiesta ancora aperta` } })
      continue
    }
    if (r.stato === 'proposta_inviata') {
      const s = scadenzaProposta({ stato: 'proposta_inviata', proposta_inviata_at: r.proposta_inviata_at }, adesso)
      const scadenza = r.proposta_inviata_at ? new Date(r.proposta_inviata_at).getTime() + ORE_SCADENZA_PROPOSTA * 3600000 : creata
      if (s?.scaduta) {
        // Chat senza testo: Ania scrive a mano (ritocchi del 07/09/2026)
        const whatsapp = numero ? { href: waHrefTesto(numero, ''), numero, testo: '', principale: false } : undefined
        voci.push({ notti, classe: 'scaduta', quando: scadenza, eccezione: { ...base, urgenza: 'alta', titolo, motivo: `${s.testo.replace('Proposta inviata · ', 'Proposta ')} senza conferma né rifiuto`, whatsapp } })
      } else {
        voci.push({ notti, classe: 'in_scadenza', quando: scadenza, eccezione: { ...base, urgenza: 'normale', titolo, motivo: s ? s.testo : 'Proposta inviata, in attesa di risposta' } })
      }
      continue
    }
    voci.push({ notti, classe: 'in_attesa', quando: creata, eccezione: { ...base, urgenza: 'normale', titolo, motivo: `In attesa da ${giorniTesto(oreTra(r.created_at, adesso))} senza proposta` } })
  }
  return voci.sort((a, b) =>
    (b.notti - a.notti) || (RANGO_CLASSE[a.classe] - RANGO_CLASSE[b.classe]) || (a.quando - b.quando) || a.eccezione.titolo.localeCompare(b.eccezione.titolo),
  ).map(v => v.eccezione)
}

// ── Pagamenti ───────────────────────────────────────────────────────────────
type Soggiorno = { chiave: string; segmenti: PrenotazioneDC[]; totaleCent: number; ultimaPartenza: string; pagato: boolean; nome: string; primoId: string }

function soggiorni(prenotazioni: PrenotazioneDC[]): Soggiorno[] {
  const gruppi = new Map<string, PrenotazioneDC[]>()
  for (const b of prenotazioni.filter(prenotazioneValida)) {
    const k = b.group_id || b.id
    if (!gruppi.has(k)) gruppi.set(k, [])
    gruppi.get(k)!.push(b)
  }
  return [...gruppi.entries()].map(([chiave, segmenti]) => {
    const ordinati = [...segmenti].sort((a, b) => a.check_in.localeCompare(b.check_in))
    return {
      chiave, segmenti: ordinati,
      totaleCent: ordinati.reduce((s, b) => s + cent(b.total_amount), 0),
      ultimaPartenza: ordinati.map(b => b.check_out).sort().slice(-1)[0],
      pagato: ordinati.some(b => !!b.pagato),
      nome: nomeOspite(ordinati[0]) || 'Ospite',
      primoId: ordinati[0].id,
    }
  })
}

export function eccezioniPagamenti(prenotazioni: PrenotazioneDC[], pagamenti: PagamentoStat[], oggi: string): Eccezione[] {
  const out: Eccezione[] = []
  const incongruenze = new Map(incongruenzePagamenti(prenotazioni, pagamenti).map(i => [i.soggiorno, i]))
  const limiteConcluso = spostaGiorni(oggi, -GIORNI_CONCLUSO_NON_PAGATO)
  for (const s of soggiorni(prenotazioni)) {
    const concluso = s.ultimaPartenza <= oggi
    const inc = incongruenze.get(s.chiave)
    const idsSegmenti = new Set(s.segmenti.map(b => b.id))
    const base = { chiave: `pagamento:${s.chiave}`, tipo: 'pagamento' as const, urgenza: 'normale' as const, data: s.ultimaPartenza, rimandabile: false }
    const titolo = `${s.nome} · ${nomeCamera(s.segmenti[0])} · ${formatIntervallo(s.segmenti[0].check_in, s.ultimaPartenza)}`
    if (inc?.tipo === 'pagamenti_oltre_il_totale') {
      out.push({ ...base, titolo, motivo: `Movimenti per ${euroTesto(inc.pagatoCent)} oltre il totale di ${euroTesto(inc.totaleCent)}`, bottone: 'Apri prenotazione', destinazione: { tipo: 'prenotazione', prenotazioneId: s.primoId } })
    } else if (concluso && inc?.tipo === 'pagato_ma_incompleto') {
      out.push({ ...base, titolo, motivo: `Segnato pagato ma i movimenti coprono ${euroTesto(inc.pagatoCent)} su ${euroTesto(inc.totaleCent)}`, bottone: 'Registra saldo', destinazione: { tipo: 'saldo', prenotazioneId: s.primoId } })
    } else if (!s.pagato && s.ultimaPartenza <= limiteConcluso && s.totaleCent > 0) {
      // Falso positivo corretto il 07/09/2026 (Anna e Rosa in produzione): un
      // soggiorno i cui movimenti coprono già il totale È pagato anche se la
      // colonna `pagato` è rimasta false (il gestionale lo mostra saldato e
      // «Segna come pagato» non avrebbe nulla da registrare). Conta ciò che
      // manca davvero: totale meno movimenti registrati, di qualunque origine.
      const registratiCent = pagamenti.filter(p => idsSegmenti.has(p.booking_id)).reduce((x, p) => x + cent(p.amount), 0)
      if (registratiCent >= s.totaleCent) continue
      const motivo = registratiCent > 0
        ? `Soggiorno concluso il ${giornoBreve(s.ultimaPartenza)}: registrati ${euroTesto(registratiCent)} su ${euroTesto(s.totaleCent)}`
        : `Soggiorno concluso il ${giornoBreve(s.ultimaPartenza)} e non segnato pagato`
      out.push({ ...base, titolo, motivo, bottone: 'Registra saldo', destinazione: { tipo: 'saldo', prenotazioneId: s.primoId } })
    }
  }
  return out
}

// ── Calendario ──────────────────────────────────────────────────────────────
// Controllo nascosto (07/09/2026): niente linea ottone, compare in fondo solo
// se mai si verifica. Un cambio camera (stesso soggiorno, camere diverse, una segue l'altra) non è
// una sovrapposizione: le camere sono diverse, oppure la partenza coincide
// con l'arrivo (fine <= inizio → nessuna notte in comune).
export function eccezioniCalendario(prenotazioni: PrenotazioneDC[]): Eccezione[] {
  const out: Eccezione[] = []
  const valide = prenotazioni.filter(prenotazioneValida)
  for (let i = 0; i < valide.length; i++) for (let j = i + 1; j < valide.length; j++) {
    const a = valide[i], b = valide[j]
    if (a.room_id !== b.room_id) continue
    const da = a.check_in > b.check_in ? a.check_in : b.check_in
    const fine = a.check_out < b.check_out ? a.check_out : b.check_out
    if (fine <= da) continue
    const notti = Math.round((Date.parse(fine + 'T00:00:00Z') - Date.parse(da + 'T00:00:00Z')) / 86400000)
    const quando = notti === 1 ? `notte del ${giornoBreve(da)}` : `notti ${formatIntervallo(da, spostaGiorni(fine, -1))}`
    out.push({
      chiave: `sovrapposizione:${[a.id, b.id].sort().join(':')}`, tipo: 'calendario', urgenza: 'normale', data: da,
      titolo: `${nomeCamera(a)} · ${nomeOspite(a)} e ${nomeOspite(b)} · ${quando}`,
      motivo: 'Due prenotazioni confermate sulla stessa camera nella stessa notte',
      bottone: 'Apri calendario', destinazione: { tipo: 'calendario', giorno: da }, rimandabile: false,
    })
  }
  // Letti aggiuntivi oltre il pool (lib/lettiAggiuntivi: stessa regola del calendario)
  const occupati = lettiOccupatiPerNotte(valide)
  const notti = [...occupati.entries()].filter(([, n]) => n > EXTRA_BED_MAX).map(([g, n]) => ({ g, n })).sort((x, y) => x.g.localeCompare(y.g))
  // Notti consecutive con lo stesso eccesso → una voce sola
  let corrente: { da: string; a: string; n: number } | null = null
  const chiudi = () => {
    if (!corrente) return
    const quando = corrente.da === corrente.a ? `notte del ${giornoBreve(corrente.da)}` : `notti ${formatIntervallo(corrente.da, corrente.a)}`
    out.push({
      chiave: `letti:${corrente.da}`, tipo: 'calendario', urgenza: 'normale', data: corrente.da,
      titolo: `Letti aggiuntivi · ${corrente.n} su ${EXTRA_BED_MAX} · ${quando}`,
      motivo: 'Più letti aggiuntivi di quanti ce ne sono in casa',
      bottone: 'Apri calendario', destinazione: { tipo: 'calendario', giorno: corrente.da }, rimandabile: false,
    })
    corrente = null
  }
  for (const { g, n } of notti) {
    if (corrente && corrente.n === n && spostaGiorni(corrente.a, 1) === g) { corrente.a = g; continue }
    chiudi()
    corrente = { da: g, a: g, n }
  }
  chiudi()
  return out
}

// ── Arrivi ──────────────────────────────────────────────────────────────────
// Un segmento che comincia dove finisce un altro dello stesso soggiorno è un
// cambio camera: l'ospite è già in casa, l'orario non serve.
export function eccezioniArrivi(prenotazioni: PrenotazioneDC[], oggi: string): Eccezione[] {
  const domani = spostaGiorni(oggi, 1)
  const valide = prenotazioni.filter(prenotazioneValida)
  return valide
    .filter(b => b.check_in === domani && !(b.check_in_time ?? '').trim())
    .filter(b => !valide.some(o => o.id !== b.id && !!b.group_id && o.group_id === b.group_id && o.check_out === b.check_in))
    .sort((a, b) => nomeCamera(a).localeCompare(nomeCamera(b)))
    .map(b => {
      const wa = whatsappRichiestaOrario(b)
      return {
        chiave: `arrivo:${b.id}`, tipo: 'arrivo' as const, urgenza: 'alta' as const, data: b.check_in,
        titolo: `${nomeOspite(b)} · ${nomeCamera(b)} · domani`,
        motivo: wa ? 'Arrivo di domani senza orario' : 'Arrivo di domani senza orario e senza numero di telefono',
        bottone: 'Apri arrivo', destinazione: { tipo: 'arrivo' as const, prenotazioneId: b.id }, rimandabile: false,
        whatsapp: wa ? { ...wa, principale: true } : undefined,
      }
    })
}

// ── Fatture ─────────────────────────────────────────────────────────────────
// Stessa regola di lib/spese/fatture.scadute (stato derivato: approvata_da_pagare
// + scadenza superata), letta qui senza toccare lib/spese.
export function eccezioniFatture(documenti: DocumentoStat[], oggi: string): Eccezione[] {
  return documenti
    .filter(d => d.kind === 'fattura' && d.status === 'approvata_da_pagare' && !!d.due_date && d.due_date < oggi)
    .sort((a, b) => a.due_date!.localeCompare(b.due_date!))
    .map(d => ({
      chiave: `fattura:${d.id}`, tipo: 'fattura' as const, urgenza: 'normale' as const, data: d.due_date!,
      titolo: `${d.supplier?.trim() || 'Fattura'}${d.doc_total != null ? ` · ${euroTesto(cent(d.doc_total))}` : ''} · scaduta il ${giornoBreve(d.due_date!)}`,
      motivo: 'Scadenza passata e fattura non pagata',
      bottone: 'Apri fattura', destinazione: { tipo: 'fattura' as const, documentoId: d.id }, rimandabile: false,
    }))
}

// ── Insieme, rinvii e ordine ────────────────────────────────────────────────
export const rinvioAttivo = (r: Rinvio, oggi: string) => !!r.fino_a && oggi < r.fino_a

export function applicaRinvii(eccezioni: Eccezione[], rinvii: Rinvio[] | undefined, oggi: string): Eccezione[] {
  const nascoste = new Set((rinvii ?? []).filter(r => rinvioAttivo(r, oggi)).map(r => r.chiave))
  return eccezioni.filter(e => !(e.rimandabile && nascoste.has(e.chiave)))
}

// Ordine delle sezioni (07/09/2026): richieste, arrivi, pagamenti, fatture,
// calendario in fondo. Dentro ogni sezione resta l'ordine deciso dalla sua
// regola (ordinamento stabile).
const ORDINE_TIPI: TipoEccezione[] = ['richiesta', 'arrivo', 'pagamento', 'fattura', 'calendario']

export function ordinaEccezioni(eccezioni: Eccezione[]): Eccezione[] {
  return [...eccezioni].sort((a, b) => ORDINE_TIPI.indexOf(a.tipo) - ORDINE_TIPI.indexOf(b.tipo))
}

export function daControllareHome(stato: StatoDaControllare): Eccezione[] {
  const tutte = [
    ...eccezioniCalendario(stato.prenotazioni),
    ...eccezioniRichieste(stato.richieste, stato.oggi, stato.adesso),
    ...eccezioniPagamenti(stato.prenotazioni, stato.pagamenti, stato.oggi),
    ...eccezioniArrivi(stato.prenotazioni, stato.oggi),
    ...eccezioniFatture(stato.documenti, stato.oggi),
  ]
  return ordinaEccezioni(applicaRinvii(tutte, stato.rinvii, stato.oggi))
}

// Fino a quando nasconde un «Rimanda» fatto oggi: il giorno dopo
export const finoADomani = (oggi: string) => spostaGiorni(oggi, 1)

// ── Testi della striscia e della riga «tutto a posto» ───────────────────────
const CONTEGGIO: Record<TipoEccezione, [string, string]> = {
  richiesta: ['richiesta aperta', 'richieste aperte'],
  arrivo: ['arrivo senza orario', 'arrivi senza orario'],
  pagamento: ['pagamento', 'pagamenti'],
  fattura: ['fattura scaduta', 'fatture scadute'],
  calendario: ['sovrapposizione', 'sovrapposizioni'],
}

export function conteggiPerTipo(eccezioni: Eccezione[]): { tipo: TipoEccezione; n: number }[] {
  return ORDINE_TIPI.map(tipo => ({ tipo, n: eccezioni.filter(e => e.tipo === tipo).length })).filter(x => x.n > 0)
}

// «3 richieste aperte · 1 arrivo senza orario · 1 pagamento» (stesso ordine delle sezioni)
export function rigaConteggi(eccezioni: Eccezione[]): string {
  return conteggiPerTipo(eccezioni).map(({ tipo, n }) => `${n} ${CONTEGGIO[tipo][n === 1 ? 0 : 1]}`).join(' · ')
}

// «3 cose da controllare» · «1 cosa da controllare»
export function titoloStriscia(eccezioni: Eccezione[]): string {
  const n = eccezioni.length
  return n === 1 ? '1 cosa da controllare' : `${n} cose da controllare`
}

const A_POSTO: Record<TipoEccezione, string> = {
  calendario: 'Calendario', richiesta: 'Richieste', pagamento: 'Pagamenti', arrivo: 'Arrivi di domani', fattura: 'Fatture',
}
function elenco(voci: string[]): string {
  if (voci.length <= 1) return voci.join('')
  return `${voci.slice(0, -1).join(', ')} e ${voci[voci.length - 1]}`
}

// «Arrivi di domani e fatture: tutto a posto» — null se nessun tipo è a posto
export function rigaAPosto(eccezioni: Eccezione[]): string | null {
  const conProblemi = new Set(eccezioni.map(e => e.tipo))
  const aPosto = ORDINE_TIPI.filter(t => !conProblemi.has(t)).map(t => A_POSTO[t])
  if (aPosto.length === 0) return null
  const testo = elenco(aPosto.map((v, i) => (i === 0 ? v : v.charAt(0).toLowerCase() + v.slice(1))))
  return `${testo}: tutto a posto`
}

// Indirizzo del bottone (la Home lo usa per i Link)
export function hrefDestinazione(d: Destinazione): string {
  switch (d.tipo) {
    case 'richiesta': return `/richieste/${d.id}`
    case 'saldo': return `/prenotazioni/${d.prenotazioneId}?azione=pagato`
    case 'prenotazione': return `/prenotazioni/${d.prenotazioneId}`
    case 'calendario': return `/calendario?giorno=${d.giorno}`
    case 'arrivo': return `/arrivi?apri=${d.prenotazioneId}`
    case 'fattura': return `/spese?documento=${d.documentoId}`
  }
}

// ── Periodo di lettura e tabella dei rinvii ────────────────────────────────
// La Home legge SOLO un periodo (mai tutto lo storico): le prenotazioni che
// toccano [oggi − 31, oggi + 62) bastano per pagamenti di soggiorni appena
// conclusi, arrivi di domani e sovrapposizioni dei prossimi due mesi.
export const GIORNI_INDIETRO = 31
export const GIORNI_AVANTI = 62
export function periodoDaControllare(oggi: string): { da: string; a: string } {
  return { da: spostaGiorni(oggi, -GIORNI_INDIETRO), a: spostaGiorni(oggi, GIORNI_AVANTI) }
}

// Tabella `da_controllare_rinvii` (proposta 0035) non ancora applicata:
// PostgREST risponde PGRST205 (tabella non nel catalogo) o 42P01. In quel
// caso «Rimanda» non è disponibile e lo si dice; ogni altro errore è visibile.
export const TABELLA_RINVII = 'da_controllare_rinvii'
export const AVVISO_RINVII_NON_DISPONIBILI = 'Rimanda non disponibile: va applicata la proposta 0035 (tabella dei rinvii)'
export function tabellaRinviiAssente(e: unknown): boolean {
  const c = String((e as { code?: unknown })?.code ?? '')
  return c === 'PGRST205' || c === '42P01'
}

// ── Parametri di arrivo dalla Home (?giorno=, ?apri=, ?azione=, ?documento=) ─
export function giornoDaParametro(search: string): string | null {
  const g = new URLSearchParams(search).get('giorno')
  return g && /^\d{4}-\d{2}-\d{2}$/.test(g) ? g : null
}
export function idDaParametro(search: string, nome: string): string | null {
  const v = (new URLSearchParams(search).get(nome) ?? '').trim()
  return v && /^[\w-]{1,64}$/.test(v) ? v : null
}

// ── Statistiche: link accanto a Incassi ─────────────────────────────────────
// «1 pagamento da controllare» · «3 pagamenti da controllare» · null senza
// incongruenze (stesso conteggio della Home: stato condiviso).
export function testoPagamentiDaControllare(eccezioni: Eccezione[]): string | null {
  const n = eccezioni.filter(e => e.tipo === 'pagamento').length
  if (n === 0) return null
  return n === 1 ? '1 pagamento da controllare' : `${n} pagamenti da controllare`
}
