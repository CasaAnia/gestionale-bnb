// ============================================================================
// LA SCHEDA PRENOTAZIONE «MAISON» (riferimento approvato da Ania il
// 28/09/2026: docs/design/scheda-riferimento.html) — la logica pura delle
// parti nuove. Qui si decide COSA scrivere; la pagina decide come.
//
// Le parti nuove sono: le cinque linguette (una parte alla volta, la scelta
// nell'indirizzo, i puntini dove c'è qualcosa da sistemare), la riga «dorme
// …» quando chi dorme non è chi ha prenotato, «In breve» e «Prossimi giorni»
// della linguetta Oggi, l'arrivo e le camere della linguetta Soggiorno, la
// frase per esteso di come paga, il destinatario e la griglia dei messaggi,
// le voci nuove della linguetta Cliente.
//
// I testi che il gestionale mostra già (lib/testaScheda, lib/schedaPrenotazione,
// lib/arrivo, lib/comePaga, lib/messaggiPrenotazione…) NON si riscrivono qui:
// si leggono e, dove il riferimento li mette in frase, si compongono.
// Niente Supabase, niente orologio: `oggi` arriva dal chiamante.
// ============================================================================
import { GIORNI_BREVI, MESI_BREVI, dataConGiorno } from './dateItaliane.ts'
import { conPreposizione } from './richiesteTesti.ts'
import { euroScheda, periodoConMese, testoNotti, segmentiAttivi, trattiCamera, type SegmentoScheda, type CasellaSoggiorno } from './schedaPrenotazione.ts'
import {
  nomeLuogo, genereLuogo, periodoInStruttura, eFascia, periodoOre, navettaRichiesta, quandoInParole,
  AUTISTI, AUTISTA_DA_SCEGLIERE, NAVETTA_DA_CHIEDERE, ARRIVO_DA_DEFINIRE, type Arrivo,
} from './arrivo.ts'
import { MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO, type TipoMessaggio } from './messaggiPrenotazione.ts'
import { messaggiUtili, type FaseMessaggi, type VoceMessaggio } from './messaggiFase.ts'
import { comePagaSalvato, fraseComePaga, GRUPPI_COME_PAGA } from './comePaga.ts'
import { COPERTURA_NIENTE } from './schedaConto.ts'
import { TITOLO_NESSUN_PAGAMENTO } from './schedaPrenotazione.ts'
import { nonELeiDaRiga } from './nuovaPrenotazione.ts'

// ── Le linguette ────────────────────────────────────────────────────────────
export type Linguetta = 'oggi' | 'soggiorno' | 'conto' | 'messaggi' | 'cliente'
export const LINGUETTE: { id: Linguetta; label: string }[] = [
  { id: 'oggi', label: 'Oggi' },
  { id: 'soggiorno', label: 'Soggiorno' },
  { id: 'conto', label: 'Conto' },
  { id: 'messaggi', label: 'Messaggi' },
  { id: 'cliente', label: 'Cliente' },
]
export const LINGUETTA_INIZIALE: Linguetta = 'oggi'

/** La linguetta dall'indirizzo: #conto, #cliente, #messaggi, #soggiorno, #oggi.
 *  I link di prima continuano a funzionare: #arrivo apre Soggiorno,
 *  #controllare apre Oggi, #documenti apre Cliente. Tutto il resto: Oggi. */
export function linguettaDaHash(hash: string | null | undefined): Linguetta {
  const h = (hash ?? '').replace(/^#/, '').trim().toLowerCase()
  const trovata = LINGUETTE.find(l => l.id === h)
  if (trovata) return trovata.id
  if (h === 'arrivo') return 'soggiorno'
  if (h === 'documenti') return 'cliente'
  return LINGUETTA_INIZIALE
}

/** Dove porta una voce di «Da controllare» (incarico, punto 5): pagamento →
 *  Conto, documento → Cliente, arrivo e cambio camera → Soggiorno; le
 *  richieste e tutto il resto → Oggi. */
export function linguettaDellaVoce(chiave: string): Linguetta {
  if (chiave === 'pagamento' || chiave.startsWith('pagamento:')) return 'conto'
  if (chiave === 'documento' || chiave.startsWith('documento:')) return 'cliente'
  if (chiave.startsWith('arrivo:') || chiave.startsWith('cambio:')) return 'soggiorno'
  return 'oggi'
}

/** Le linguette col puntino mattone, nell'ordine delle linguette */
export function puntiniLinguette(voci: { chiave: string }[]): Linguetta[] {
  const dove = new Set(voci.map(v => linguettaDellaVoce(v.chiave)))
  return LINGUETTE.map(l => l.id).filter(id => dove.has(id))
}

/** Sotto «Soggiorno»: «28 set → 4 ott» */
export const periodoLinguetta = (arrivo: string, partenza: string) => (arrivo && partenza ? periodoConMese(arrivo, partenza) : '')

/** Sotto «Conto»: «resta 470 €» oppure «saldato»; null = conto non leggibile */
export function contoLinguetta(residuoCent: number | null, saldato: boolean): { testo: string; resta: boolean } | null {
  if (residuoCent == null) return null
  if (saldato || residuoCent <= 0) return { testo: 'saldato', resta: false }
  return { testo: `resta ${euroScheda(residuoCent)}`, resta: true }
}

/** Lo stato nella barra in cima: anche «Confermata» si scrive (riferimento) */
export const statoBarra = (stato: string) => stato || 'Confermata'

// ── Chi dorme in camera ─────────────────────────────────────────────────────
// La riga «dorme …» in testata c'è SOLO con la spunta «Non è lei a dormire
// qui» della Nuova prenotazione (colonna della proposta 0061). Senza la
// colonna, o con la spunta spenta, non compare e tutto resta come prima.
export type RigaChiDorme = {
  extra_phone_1?: string | null; extra_phone_1_name?: string | null; chi_e?: string | null
  [colonna: string]: unknown
}
export type PersonaCheDorme = { nome: string; chiE: string; telefono: string | null }

export function chiDormeAlPosto(riga: RigaChiDorme | null | undefined): PersonaCheDorme | null {
  if (!riga || !nonELeiDaRiga(riga)) return null
  const nome = String(riga.extra_phone_1_name ?? '').trim()
  if (!nome) return null
  const telefono = String(riga.extra_phone_1 ?? '').trim()
  return { nome, chiE: String(riga.chi_e ?? '').trim(), telefono: telefono || null }
}

const minuscola = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

/** «dorme Teresa Bianchi · mamma» */
export const testoDorme = (p: PersonaCheDorme) => `dorme ${p.nome}${p.chiE ? ` · ${minuscola(p.chiE)}` : ''}`
/** Nella linguetta Cliente: «Mamma · dorme lei, non chi ha prenotato» */
export const DORME_LEI = 'dorme lei, non chi ha prenotato'
export const etichettaDormeLei = (chiE: string) => (chiE.trim() ? `${maiuscola(chiE.trim())} · ${DORME_LEI}` : maiuscola(DORME_LEI))
// i nomi stanno una volta sola, in lib/conLeiScheda (era «Con lei», punto 14d)
export { TITOLO_CON_LEI as TITOLO_CHI_DORME_SCHEDA, COMANDO_CON_LEI as COMANDO_CHI_DORME } from './conLeiScheda.ts'
export const INTESTATARIA_SCHEDA = 'Intestataria · dati della prenotazione'

// ── La testata ──────────────────────────────────────────────────────────────
export const NESSUN_NUMERO = 'Nessun numero di telefono'
/** La riga «Già ospite 4 volte · da Nida · 640 €»: il testo di sempre
 *  (primaRigaScheda) più lo speso, che la pagina scrive in mattone */
export function spesoTestata(totaleCent: number): string | null {
  return totaleCent > 0 ? euroScheda(totaleCent) : null
}
export const QUESTA_VOLTA = 'Questa volta'

// ── Oggi · In breve ─────────────────────────────────────────────────────────
/** «oggi» per l'arrivo di oggi, altrimenti «gio 1 ott» */
export const quandoGiorno = (iso: string, oggi: string) => (iso === oggi ? 'oggi' : dataConGiorno(iso))
/** «mer 30» */
export function giornoSettimana(iso: string): string {
  const [a, m, g] = iso.split('-').map(Number)
  return `${GIORNI_BREVI[new Date(Date.UTC(a, m - 1, g)).getUTCDay()]} ${g}`
}

const nomeAutista = (a: Arrivo) => AUTISTI.find(x => x.chiave === a.navetta)?.nome ?? null
const pulita = (t: string | null | undefined) => (t ?? '').trim()

/** Il prelievo in parole: «prelievo a Malpensa 14:15» (In breve) */
function prelievoBreve(a: Arrivo): string {
  const dove = nomeLuogo(a)
  const ora = pulita(a.prelievo)
  if (dove && ora) return `prelievo a ${dove} ${ora}`
  if (dove) return `prelievo a ${dove}`
  if (ora) return `prelievo alle ${ora}`
  return ''
}
export const ARRIVO_AUTONOMO = 'arrivo autonomo'

/** La navetta in una parola sola: «navetta Massimo», «arrivo autonomo» */
export function navettaInBreve(a: Arrivo, conPrelievo = false): string {
  const autista = nomeAutista(a)
  const prelievo = conPrelievo ? prelievoBreve(a) : ''
  if (autista) return `navetta ${autista}${prelievo ? ` · ${prelievo}` : ''}`
  if (a.navetta === 'da_assegnare') return `navetta da assegnare${prelievo ? ` · ${prelievo}` : ''}`
  if (a.navetta === 'non_richiesta') return ARRIVO_AUTONOMO
  return 'navetta da definire'
}

/** Il verbo dell'arrivo al luogo: «atterra a Malpensa», «arriva a Milano Centrale» */
function verboLuogo(a: Arrivo): string {
  const dove = nomeLuogo(a)
  return genereLuogo(a) === 'aeroporto' ? `atterra a ${dove}` : `arriva a ${dove}`
}
const oreLuogo = (a: Arrivo): [string, string] => [pulita(a.luogoDa), a.modoLuogo === 'fascia' ? pulita(a.luogoA) : '']
const oreStruttura = (a: Arrivo): [string, string] => [pulita(a.strutturaDa), a.modoStruttura === 'fascia' ? pulita(a.strutturaA) : '']

/** «In breve · Arrivo». Una riga («oggi alle 15:10 · navetta Massimo»,
 *  «gio 1 ott, orario da definire · arrivo autonomo»); tre righe quando arriva
 *  da un luogo esterno: l'ora in struttura (la stima di Ania, col «circa»),
 *  l'arrivo al luogo e la navetta col prelievo. */
export function arrivoInBreve(a: Arrivo, checkIn: string, oggi: string): string[] {
  const quando = quandoGiorno(checkIn, oggi)
  const dove = nomeLuogo(a)
  if (a.tipo === 'luogo' && dove) {
    const stima = periodoInStruttura(a)
    const prima = stima ? `${quando}, in struttura ${stima} circa` : `${quando}, orario in struttura da definire`
    const [da, fine] = oreLuogo(a)
    const seconda = periodoOre(da, fine) ? `${verboLuogo(a)} ${quandoInParole(da, fine, false)}` : `${verboLuogo(a)} · orario da definire`
    return [prima, seconda, navettaInBreve(a, true)]
  }
  const ore = a.tipo === 'struttura' ? oreStruttura(a) : (['', ''] as [string, string])
  const orario = periodoOre(...ore) ? `${quando} ${quandoInParole(...ore, false)}` : `${quando}, orario da definire`
  return [`${orario} · ${navettaInBreve(a)}`]
}

/** Le notti di fila nella stessa camera (le caselle di caselleSoggiorno) */
type Tratto = { camera: string; notti: number; da: string }
function trattiDiFila(caselle: CasellaSoggiorno[]): Tratto[] {
  const out: Tratto[] = []
  for (const c of caselle) {
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.camera === c.camera) ultimo.notti += 1
    else out.push({ camera: c.camera, notti: 1, da: c.iso })
  }
  return out
}

/** «Ambra», «Ambra, poi Lena da gio 1», «Ambra 2 notti · Lena 2 · Allegra 2» */
export function camereInBreve(caselle: CasellaSoggiorno[]): string {
  const t = trattiDiFila(caselle)
  if (t.length === 0) return ''
  if (t.length === 1) return t[0].camera
  if (t.length === 2) return `${t[0].camera}, poi ${t[1].camera} da ${giornoSettimana(t[1].da)}`
  return t.map((x, i) => (i === 0 ? `${x.camera} ${testoNotti(x.notti)}` : `${x.camera} ${x.notti}`)).join(' · ')
}

/** «2, poi 3 dal 30 (letto in più)» — solo quando gli ospiti cambiano;
 *  «dall'1», «dall'8», «dall'11» (regola fissa n. 3) */
export function ospitiInBreve(caselle: CasellaSoggiorno[], nottiConLetto: Set<string>): string | null {
  if (caselle.length === 0) return null
  const pezzi: string[] = [String(caselle[0].persone)]
  for (let i = 1; i < caselle.length; i++) {
    if (caselle[i].persone !== caselle[i - 1].persone) pezzi.push(`poi ${caselle[i].persone} ${conPreposizione('dal', Number(caselle[i].iso.slice(8, 10)))}`)
  }
  if (pezzi.length === 1) return null
  const letto = caselle.some(c => nottiConLetto.has(c.iso))
  return `${pezzi.join(', ')}${letto ? ' (letto in più)' : ''}`
}

/** Le notti col letto in più, lette dai tratti */
export function nottiConLetto(segmenti: SegmentoScheda[]): Set<string> {
  const out = new Set<string>()
  for (const s of segmentiAttivi(segmenti)) {
    const date = (s as { extra_bed_dates?: string[] | null }).extra_bed_dates
    if (Array.isArray(date) && date.length > 0) date.forEach(d => out.add(d))
  }
  return out
}

/** La caparra ancora da ricevere: importo e scadenza, o null */
export type AccordoCaparra = { accordo_pagamento?: string | null; bonifico?: boolean | null; caparra_centesimi?: number | null; caparra_entro?: string | null }
export function caparraDaRicevere(accordo: AccordoCaparra | null | undefined, totaleCent: number, ricevutiCent: number): { importoCent: number; entro: string } | null {
  if (!accordo) return null
  const modo = comePagaSalvato(accordo.accordo_pagamento, accordo.bonifico)
  if (modo !== 'meta' && modo !== 'caparra') return null
  const entro = pulita(accordo.caparra_entro).slice(0, 10)
  if (!entro) return null
  const importoCent = accordo.caparra_centesimi != null ? Number(accordo.caparra_centesimi) : modo === 'meta' ? Math.round(totaleCent / 2) : 0
  if (importoCent <= 0 || ricevutiCent >= importoCent) return null
  return { importoCent, entro }
}

/** «In breve · Conto»: «470 € · caparra entro mer 30» in mattone finché
 *  resta qualcosa, «saldato» in verde */
export function contoInBreve(residuoCent: number, saldato: boolean, caparra: { entro: string } | null): { testo: string; saldato: boolean } {
  if (saldato || residuoCent <= 0) return { testo: 'saldato', saldato: true }
  return { testo: `${euroScheda(residuoCent)}${caparra ? ` · caparra entro ${giornoSettimana(caparra.entro)}` : ''}`, saldato: false }
}

export const DOCUMENTO_CARICATO = 'caricato'
export const DOCUMENTO_DA_CHIEDERE = 'da chiedere all’arrivo'
/** null = non si sa (lettura non riuscita): la riga non compare */
export function documentoInBreve(documenti: number | null): { testo: string; manca: boolean } | null {
  if (documenti == null) return null
  return documenti > 0 ? { testo: DOCUMENTO_CARICATO, manca: false } : { testo: DOCUMENTO_DA_CHIEDERE, manca: true }
}

/** «Note» in breve: le due note una dopo l'altra (la pagina le tiene su una riga) */
export function noteInBreve(note: { testo: string }[]): string | null {
  const t = note.map(n => (n.testo ?? '').trim()).filter(Boolean)
  return t.length ? t.join(' · ') : null
}

// ── Oggi · Da fare oggi ─────────────────────────────────────────────────────
export type AzioneDaFare = 'Pagamento' | 'Documento' | 'Arrivo' | 'Calendario'
/** L'unica azione a destra di una voce di «Da controllare» */
export function azioneDaFare(chiave: string): AzioneDaFare {
  if (chiave === 'pagamento') return 'Pagamento'
  if (chiave === 'documento') return 'Documento'
  if (chiave.startsWith('arrivo:')) return 'Arrivo'
  return 'Calendario'
}
export const DA_FARE_OGGI = 'Da fare oggi'
export const IN_BREVE = 'In breve'
export const PROSSIMI_GIORNI = 'Prossimi giorni'

// ── Oggi · Prossimi giorni ──────────────────────────────────────────────────
export type GiornoProssimo = { chiave: string; giorno: string; cosa: string; nota: string }
/** «da Lena ad Allegra»: «ad» davanti ad «a» */
const aCamera = (camera: string) => (/^a/i.test(camera) ? `ad ${camera}` : `a ${camera}`)
export function prossimiGiorni(caselle: CasellaSoggiorno[], oggi: string, ultimaPartenza: string, residuoCent: number): GiornoProssimo[] {
  const out: GiornoProssimo[] = []
  caselle.forEach((c, i) => {
    if (!c.cambia || c.iso <= oggi) return
    out.push({ chiave: `cambio:${c.iso}`, giorno: giornoSettimana(c.iso), cosa: `⇄ da ${caselle[i - 1].camera} ${aCamera(c.camera)}`, nota: `${c.camera} va pronta prima` })
  })
  if (ultimaPartenza && ultimaPartenza > oggi) {
    out.push({ chiave: 'partenza', giorno: giornoSettimana(ultimaPartenza), cosa: 'parte', nota: residuoCent > 0 ? `saldo ${euroScheda(residuoCent)}` : '' })
  }
  return out
}

// ── Soggiorno · Arrivo e navetta ────────────────────────────────────────────
/** L'orario grande: «Oggi alle 15:10», «Oggi, 15:30–16:30» (+ «circa»),
 *  «Gio 1 ott, orario da definire», «Arrivo da definire» */
export function arrivoGrande(a: Arrivo, checkIn: string, oggi: string): { testo: string; circa: boolean } {
  const Quando = maiuscola(quandoGiorno(checkIn, oggi))
  if (a.tipo === 'da_definire') return { testo: ARRIVO_DA_DEFINIRE, circa: false }
  if (a.tipo === 'luogo') {
    const stima = periodoInStruttura(a)
    return stima ? { testo: `${Quando}, ${stima}`, circa: true } : { testo: `${Quando}, orario da definire`, circa: false }
  }
  const [da, fine] = oreStruttura(a)
  if (!periodoOre(da, fine)) return { testo: `${Quando}, orario da definire`, circa: false }
  return eFascia(da, fine) ? { testo: `${Quando}, ${periodoOre(da, fine)}`, circa: false } : { testo: `${Quando} alle ${periodoOre(da, fine)}`, circa: false }
}

/** Il blocco «Arrivo a Malpensa» / «fra le 13:00 e le 14:00 · in aereo» */
export function luogoInSoggiorno(a: Arrivo): { etichetta: string; testo: string } | null {
  const dove = nomeLuogo(a)
  if (a.tipo !== 'luogo' || !dove) return null
  const [da, fine] = oreLuogo(a)
  const quando = periodoOre(da, fine) ? quandoInParole(da, fine, false) : 'orario da definire'
  const mezzo = genereLuogo(a) === 'aeroporto' ? 'in aereo' : genereLuogo(a) === 'stazione' ? 'in treno' : ''
  return { etichetta: `Arrivo a ${dove}`, testo: mezzo ? `${quando} · ${mezzo}` : quando }
}

/** Il blocco «Navetta»: il nome in grassetto e il resto.
 *  «Massimo · prelievo a Milano Centrale alle 14:30», «Da assegnare · autista
 *  ancora da scegliere», «Da definire · da chiedere all’ospite», «Non richiesta» */
export function navettaInSoggiorno(a: Arrivo): { forte: string; resto: string } {
  const dove = nomeLuogo(a)
  const ora = pulita(a.prelievo)
  const prelievo = !navettaRichiesta(a.navetta) ? ''
    : dove && ora ? `prelievo a ${dove} alle ${ora}` : dove ? `prelievo a ${dove}` : ora ? `prelievo alle ${ora}` : ''
  const autista = nomeAutista(a)
  if (autista) return { forte: autista, resto: prelievo ? ` · ${prelievo}` : '' }
  if (a.navetta === 'da_assegnare') return { forte: 'Da assegnare', resto: ` · ${prelievo || minuscola(AUTISTA_DA_SCEGLIERE)}` }
  if (a.navetta === 'da_definire') return { forte: 'Da definire', resto: ` · ${minuscola(NAVETTA_DA_CHIEDERE)}` }
  return { forte: 'Non richiesta', resto: '' }
}

export const SOTTO_STRISCIA = 'un tocco su una notte: camera, ospiti, letto in più di quella notte'

// ── Soggiorno · Camere ──────────────────────────────────────────────────────
export type RigaCameraSoggiorno = { id: string; nome: string; cambio: boolean; dettaglio: string; nota: string | null; importo: string }
const testoOspiti = (n: number) => (n === 1 ? '1 ospite' : `${n} ospiti`)
export function camereSoggiorno(segmenti: SegmentoScheda[]): RigaCameraSoggiorno[] {
  const attivi = segmentiAttivi(segmenti)
  const tratti = trattiCamera(attivi)
  return attivi.map((s, i) => {
    const t = tratti[i]
    const n = Math.max(0, Math.round((Date.parse(s.check_out) - Date.parse(s.check_in)) / 86400000))
    const date = ((s as { extra_bed_dates?: string[] | null }).extra_bed_dates ?? []).filter(d => d >= s.check_in && d < s.check_out).sort()
    const letto = !s.extra_bed && date.length === 0 ? ''
      : date.length === 0 || date.length >= n ? ' · letto in più'
      : ` · letto in più ${date.map(giornoSettimana).join(', ')}`
    return {
      id: s.id,
      nome: t.camera,
      cambio: t.cambio,
      dettaglio: `${periodoConMese(s.check_in, s.check_out)} · ${testoNotti(n)} · ${testoOspiti(Math.max(1, Number(s.num_guests) || 1))}${letto}`,
      nota: t.cambio ? `${t.camera} va pronta prima del cambio` : null,
      importo: t.prezzo,
    }
  })
}
/** «· 2 cambi» accanto a «Camere»; niente con una camera sola */
export const cambiCamere = (righe: RigaCameraSoggiorno[]) => {
  const n = righe.filter(r => r.cambio).length
  return n === 0 ? '' : n === 1 ? '1 cambio' : `${n} cambi`
}

// ── Conto ───────────────────────────────────────────────────────────────────
/** La frase di come paga per esteso, con la caparra:
 *  «caparra del 50%, il resto all’arrivo · 235 € entro mer 30 set» */
export function fraseComePagaEstesa(accordo: AccordoCaparra | null | undefined, totaleCent: number): string {
  const modo = comePagaSalvato(accordo?.accordo_pagamento, accordo?.bonifico)
  const frase = maiuscola(fraseComePaga(modo))
  const entro = pulita(accordo?.caparra_entro).slice(0, 10)
  if ((modo !== 'meta' && modo !== 'caparra') || !entro) return frase
  const importo = accordo?.caparra_centesimi != null ? Number(accordo.caparra_centesimi) : modo === 'meta' ? Math.round(totaleCent / 2) : 0
  const [, m] = entro.split('-').map(Number)
  return `${frase}${importo > 0 ? ` · ${euroScheda(importo)} entro ${giornoSettimana(entro)} ${MESI_BREVI[m - 1]}` : ''}`
}

/** «Nessun pagamento registrato · si incassa all’arrivo.» (paga quando
 *  arriva) oppure «· i pagamenti non coprono ancora la prima notte.» */
export function nessunPagamento(accordo: AccordoCaparra | null | undefined): string {
  const modo = comePagaSalvato(accordo?.accordo_pagamento, accordo?.bonifico)
  const allArrivo = GRUPPI_COME_PAGA.find(g => g.id === 'arrivo')?.modi.includes(modo)
  return `${TITOLO_NESSUN_PAGAMENTO} · ${allArrivo ? 'si incassa all’arrivo' : minuscola(COPERTURA_NIENTE)}.`
}

/** Sotto ogni pagamento: «acconto» finché non arriva al totale, poi «saldo completo» */
export const SALDO_COMPLETO = 'saldo completo'
export const ACCONTO = 'acconto'
export function tipoPagamenti(pagamenti: { id: string; amount: number | string; paid_on?: string | null }[], totaleCent: number): Map<string, string> {
  const out = new Map<string, string>()
  let somma = 0
  for (const p of [...pagamenti].sort((a, b) => String(a.paid_on ?? '').localeCompare(String(b.paid_on ?? '')))) {
    somma += Math.round(Number(p.amount) * 100)
    out.set(p.id, totaleCent > 0 && somma >= totaleCent ? SALDO_COMPLETO : ACCONTO)
  }
  return out
}

// ── Messaggi ────────────────────────────────────────────────────────────────
export type Destinatario = { chiave: 'intestataria' | 'dorme'; etichetta: string; telefono: string | null }
const primoNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''
/** «Maria · ha prenotato» e, solo quando dorme un'altra persona, «Teresa · dorme» */
export function destinatariMessaggi(intestataria: { nome: string; telefono: string | null }, dorme: PersonaCheDorme | null): Destinatario[] {
  const out: Destinatario[] = [{ chiave: 'intestataria', etichetta: `${primoNome(intestataria.nome)} · ha prenotato`, telefono: intestataria.telefono }]
  if (dorme) out.push({ chiave: 'dorme', etichetta: `${primoNome(dorme.nome)} · dorme`, telefono: dorme.telefono })
  return out
}
export const A_CHI_SCRIVI = 'A chi scrivi'

/** «Tutti i messaggi» a due colonne, nell'ordine del riferimento (riga per
 *  riga): Conferma · solo testo | Dati bonifico / Modifica soggiorno |
 *  Promemoria bonifico / Richiesta orario | Pagamento ricevuto /
 *  Ringraziamento | Messaggio di annullamento. Niente «Messaggio libero». */
export const ORDINE_GRIGLIA: TipoMessaggio[] = ['conferma', 'dati_bonifico', 'modifica', 'promemoria_bonifico', 'richiesta_orario', 'pagamento_ricevuto', 'ringraziamento', 'annullamento']
const TUTTE: VoceMessaggio[] = [...MESSAGGI_SCHEDA, MESSAGGIO_ANNULLAMENTO]
export const GRIGLIA_MESSAGGI: VoceMessaggio[] = ORDINE_GRIGLIA.map(tipo => {
  const v = TUTTE.find(x => x.tipo === tipo)
  if (!v) throw new Error(`messaggio sconosciuto: ${tipo}`)
  return v
})
/** «Utili adesso» della scheda: quelli di messaggiFase, senza «Messaggio libero»
 *  (al suo posto c'è la nuvoletta accanto al nome) */
export const utiliScheda = (fase: FaseMessaggi) => messaggiUtili(fase).filter(v => v.tipo !== 'libero')

// ── Cliente ─────────────────────────────────────────────────────────────────
/** «4 volte · 640 €», «prima volta» */
export function giaOspite(volte: number, totaleCent: number): string {
  if (volte <= 0) return 'prima volta'
  return `${volte === 1 ? '1 volta' : `${volte} volte`}${totaleCent > 0 ? ` · ${euroScheda(totaleCent)}` : ''}`
}
/** «nessuno» (con «Aggiungi»), «1 caricato ›», «3 caricati ›»; null = non si sa */
export function documentiCliente(n: number | null): { testo: string; nessuno: boolean } | null {
  if (n == null) return null
  if (n <= 0) return { testo: 'nessuno', nessuno: true }
  return { testo: n === 1 ? '1 caricato ›' : `${n} caricati ›`, nessuno: false }
}
export const ANNULLA_PRENOTAZIONE = 'Annulla prenotazione'
