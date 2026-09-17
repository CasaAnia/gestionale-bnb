// ============================================================================
// LO SCONTO QUANDO CAMBIA IL SOGGIORNO (17/09/2026): il foglio «Il soggiorno
// si allunga» della scheda nuova.
//
// Il problema: con un PREZZO FINALE concordato (85 € per una notte a 90), se
// si aggiungono notti il piano teneva la cifra pattuita per l'intero
// soggiorno (85 € per tre notti) e la spalmava sui tratti: il conto tornava,
// ma non era il prezzo che Ania intendeva concordare. Adesso, PRIMA di
// salvare, si vede il nuovo conto e si sceglie come aggiornare il prezzo:
//   1. «Mantieni 5 € di sconto a notte» — lo sconto di adesso diviso per le
//      notti di adesso, tolto da ogni notte nuova (dai rispettivi prezzi
//      pieni: con tariffe diverse gli importi sono quelli veri);
//   2. «Concorda un nuovo prezzo» — il totale dell'intero soggiorno, scritto
//      a mano, ripartito fra i tratti come fa il foglio «Sconto».
// La prima scelta c'è solo se il criterio è determinabile: una linea sola
// (con più camere nelle stesse notti lo sconto non si divide per i giorni),
// stesso accordo su tutti i tratti, sconto che si divide in parti uguali
// fra le notti e che non azzera nessun tratto. Altrimenti resta la seconda.
//
// Soggiorno e prezzo si salvano INSIEME (la scelta entra nel piano di
// lib/strisciaNotti come `ScontoScelto`): mai le date prima e il conto dopo.
// Lo sconto in percentuale non passa di qui: segue le notti da solo.
//
// Funzioni pure: niente Supabase, niente orologio.
// ============================================================================
import { contoSoggiorno } from './conto.ts'
import { euroScheda, periodoTratto, testoNotti } from './schedaPrenotazione.ts'
import { MESI_BREVI } from './dateItaliane.ts'
import { ripartisciConcordato, type PianoNotti, type TrattoPiano, type ScontoScelto } from './strisciaNotti.ts'
import { prezzoPienoRiga, valoreDaCampo, type RigaScontabile } from './scontoScheda.ts'

export const SENZA_SCONTO: ScontoScelto = { tipo: 'nessuno' }

export type RigaSoggiorno = RigaScontabile & { rooms?: { name?: string | null } | null }

const cent = (n: number) => Math.round(n * 100)
const attive = <T extends RigaScontabile>(righe: T[]) => righe.filter(r => r.status !== 'annullata')
const nottiDi = (r: RigaScontabile) => contoSoggiorno({ check_in: r.check_in, check_out: r.check_out }).notti
const nomeDi = (r: RigaSoggiorno) => (r.rooms?.name ?? '').trim() || 'camera'
/** «una notte», «3 notti» */
export const nottiInParole = (n: number) => (n === 1 ? 'una notte' : `${n} notti`)
/** «29 nov → 2 dic», e anche nello stesso mese col mese: «10 → 13 set» */
export function periodoConMese(dal: string, al: string): string {
  return dal.slice(0, 7) === al.slice(0, 7) ? `${periodoTratto(dal, al)} ${MESI_BREVI[Number(al.slice(5, 7)) - 1]}` : periodoTratto(dal, al)
}

// ── I testi del foglio ──────────────────────────────────────────────────────
export const TITOLO_ALLUNGA = 'Il soggiorno si allunga'
export const TITOLO_ACCORCIA = 'Il soggiorno si accorcia'
export const TITOLO_CAMBIA = 'Il soggiorno cambia'
export const DOMANDA_PREZZO = 'Come vuoi aggiornare il prezzo?'
export const SCELTA_PER_NOTTE = (centANotte: number) => `Mantieni ${euroScheda(centANotte)} di sconto a notte`
export const SCELTA_NUOVO_PREZZO = 'Concorda un nuovo prezzo'
export const ETICHETTA_TOTALE_SOGGIORNO = 'Totale dell’intero soggiorno'
export const TORNA_ALLE_MODIFICHE = 'Torna alle modifiche'
export const CONFERMA_SOGGIORNO = 'Conferma soggiorno'
export const RIGA_PREZZO_PIENO = 'Prezzo pieno'
export const RIGA_TOTALE = 'Totale'
export const RIGA_INCASSATI = 'Già incassati'
export const RIGA_RESTA = 'Resta da incassare'
export const LETTO_INCLUSO = 'letto incluso'
export const OLTRE_IL_TOTALE = (cent: number) => `${euroScheda(cent)} oltre il nuovo totale: i pagamenti restano come sono, controllali dopo.`
export const SCRIVI_IL_TOTALE = 'Scrivi il totale dell’intero soggiorno.'
export const TOTALE_TROPPO_ALTO = (pienoCent: number) => `Il totale non può superare il prezzo pieno (${euroScheda(pienoCent)}).`
export const TOTALE_NON_VALIDO = 'Il totale deve essere un numero sopra lo zero.'
export const SENZA_SCONTO_TESTO = 'Senza sconto: il totale è il prezzo pieno.'
// perché «mantieni lo sconto a notte» non si può proporre
export const MOTIVO_PIU_CAMERE = 'Con più camere nelle stesse notti lo sconto non si divide da solo per le notti: concorda il nuovo totale.'
export const MOTIVO_ACCORDI_DIVERSI = 'I tratti del soggiorno hanno accordi diversi: concorda il nuovo totale.'
export const MOTIVO_NON_SI_DIVIDE = (scontoCent: number, notti: number) => `Lo sconto di ${euroScheda(scontoCent)} non si divide in parti uguali fra le ${notti} notti: concorda il nuovo totale.`
export const MOTIVO_A_ZERO = (centANotte: number) => `Con ${euroScheda(centANotte)} di sconto a notte una camera resterebbe a zero: concorda il nuovo totale.`

// ── Serve il foglio? ────────────────────────────────────────────────────────
export type PrimaDelCambio = { notti: number; pienoCent: number; scontoCent: number; totaleCent: number }

/** La linea com'è adesso: notti, prezzo pieno, sconto e totale dei suoi tratti attivi */
export function primaDelCambio(segmentiLinea: RigaScontabile[]): PrimaDelCambio {
  let notti = 0, pienoCent = 0, totaleCent = 0
  for (const s of attive(segmentiLinea)) {
    notti += nottiDi(s)
    pienoCent += cent(prezzoPienoRiga(s))
    totaleCent += cent(contoSoggiorno(s).totale)
  }
  return { notti, pienoCent, scontoCent: Math.max(0, pienoCent - totaleCent), totaleCent }
}

/** Il soggiorno dopo la modifica, dai tratti del piano senza sconto */
export function dopoIlCambio(tratti: TrattoPiano[]): { notti: number; pienoCent: number } {
  return { notti: tratti.reduce((s, t) => s + t.notti, 0), pienoCent: tratti.reduce((s, t) => s + t.pienoCent, 0) }
}

/** Il foglio serve quando la prenotazione ha un prezzo finale concordato e la
 *  modifica cambia le notti o il prezzo pieno della linea. `pianoSenza` è il
 *  piano fatto SENZA sconto (SENZA_SCONTO): così si vedono i tratti anche
 *  quando il totale concordato non starebbe più sotto il prezzo pieno. */
export function serveConfermaPrezzo(segmentiLinea: RigaScontabile[], tutti: RigaScontabile[], pianoSenza: PianoNotti): boolean {
  if (pianoSenza.errore || pianoSenza.tratti.length === 0) return false
  if (!attive(tutti).some(s => s.discount_type === 'target_total')) return false
  const prima = primaDelCambio(segmentiLinea)
  const dopo = dopoIlCambio(pianoSenza.tratti)
  return prima.notti !== dopo.notti || prima.pienoCent !== dopo.pienoCent
}

// ── La testa del foglio ─────────────────────────────────────────────────────
export function titoloConferma(nottiPrima: number, nottiDopo: number): string {
  return nottiDopo > nottiPrima ? TITOLO_ALLUNGA : nottiDopo < nottiPrima ? TITOLO_ACCORCIA : TITOLO_CAMBIA
}

/** «Da 1 a 3 notti · 29 nov → 2 dic», «Sempre 3 notti · 29 nov → 2 dic» */
export function sottotitoloConferma(nottiPrima: number, tratti: TrattoPiano[]): string {
  const dopo = dopoIlCambio(tratti).notti
  const dal = tratti[0]?.check_in ?? ''
  const al = tratti.reduce((m, t) => (t.check_out > m ? t.check_out : m), tratti[0]?.check_out ?? '')
  const notti = dopo === nottiPrima ? `Sempre ${testoNotti(dopo)}` : `Da ${nottiPrima} a ${testoNotti(dopo)}`
  return dal && al ? `${notti} · ${periodoConMese(dal, al)}` : notti
}

/** «Prima: 90 € − 5 € = 85 € per una notte» */
export function riepilogoPrima(p: PrimaDelCambio): string {
  const conto = p.scontoCent > 0 ? `${euroScheda(p.pienoCent)} − ${euroScheda(p.scontoCent)} = ${euroScheda(p.totaleCent)}` : euroScheda(p.totaleCent)
  return `Prima: ${conto} per ${nottiInParole(p.notti)}`
}

// ── La prima scelta: lo stesso sconto a notte ───────────────────────────────
export type OpzionePerNotte = { centANotte: number; etichetta: string; sotto: string }

/** «Mantieni 5 € di sconto a notte» con sotto «85 € a notte · letto incluso»,
 *  oppure il motivo per cui non si può proporre. */
export function opzionePerNotte(segmentiLinea: RigaScontabile[], tutti: RigaScontabile[], tratti: TrattoPiano[]): { opzione: OpzionePerNotte | null; motivo: string | null } {
  const dellaLinea = new Set(attive(segmentiLinea).map(s => s.id))
  if (attive(tutti).some(s => !dellaLinea.has(s.id))) return { opzione: null, motivo: MOTIVO_PIU_CAMERE }
  const vive = attive(segmentiLinea)
  if (vive.length === 0 || vive.some(s => s.discount_type !== 'target_total')) return { opzione: null, motivo: MOTIVO_ACCORDI_DIVERSI }
  const prima = primaDelCambio(segmentiLinea)
  if (prima.scontoCent <= 0 || prima.notti <= 0) return { opzione: null, motivo: MOTIVO_ACCORDI_DIVERSI }
  if (prima.scontoCent % prima.notti !== 0) return { opzione: null, motivo: MOTIVO_NON_SI_DIVIDE(prima.scontoCent, prima.notti) }
  const centANotte = prima.scontoCent / prima.notti
  if (tratti.some(t => t.pienoCent - centANotte * t.notti <= 0)) return { opzione: null, motivo: MOTIVO_A_ZERO(centANotte) }
  return { opzione: { centANotte, etichetta: SCELTA_PER_NOTTE(centANotte), sotto: sottoPerNotte(tratti, centANotte) }, motivo: null }
}

/** «85 € a notte · letto incluso», «85 € e 75 € a notte»: gli importi veri di
 *  ogni tratto, non sempre lo stesso numero */
export function sottoPerNotte(tratti: TrattoPiano[], centANotte: number): string {
  const aNotte = tratti.map(t => t.pienoCent - centANotte * t.notti).map((c, i) => (c % tratti[i].notti === 0 ? c / tratti[i].notti : null))
  const letto = tratti.some(t => t.letto > 0) ? ` · ${LETTO_INCLUSO}` : ''
  if (aNotte.some(x => x === null)) {
    const totale = tratti.reduce((s, t) => s + t.pienoCent - centANotte * t.notti, 0)
    return `${euroScheda(totale)} in tutto${letto}`
  }
  const distinti = [...new Set(aNotte as number[])]
  const testo = distinti.length === 1
    ? euroScheda(distinti[0])
    : `${distinti.slice(0, -1).map(euroScheda).join(', ')} e ${euroScheda(distinti[distinti.length - 1])}`
  return `${testo} a notte${letto}`
}

// ── L'anteprima del nuovo conto ─────────────────────────────────────────────
export type RigaAnteprimaSoggiorno = { chiave: string; testo: string; importo: string }
export type SceltaFoglio = { tipo: 'per_notte'; centANotte: number } | { tipo: 'finale'; testo: string }
export type AltraRigaDaScrivere = { id: string; campi: { discount_type: string | null; discount_value: number | null; total_amount: number } }

export type AnteprimaSoggiorno = {
  righe: RigaAnteprimaSoggiorno[]          // i tratti della linea (e le altre camere del soggiorno)
  pieno: RigaAnteprimaSoggiorno            // «Prezzo pieno» 270 €
  sconto: RigaAnteprimaSoggiorno | null    // «Sconto: 3 notti × 5 €» −15 €, «Sconto» −20 €, o niente
  totale: RigaAnteprimaSoggiorno           // «Totale» 255 €
  totaleCent: number                       // dell'INTERO soggiorno, altre camere comprese
  sotto: RigaAnteprimaSoggiorno[]          // «Già incassati» 300 €, «Resta da incassare» 45 €
  oltre: string | null                     // i pagamenti superano il nuovo totale
  errore: string | null                    // il nuovo totale scritto non va bene
  nota: string | null                      // «Senza sconto: il totale è il prezzo pieno.»
  scelta: ScontoScelto | null              // cosa passare al piano della LINEA (null se c'è un errore)
  altre: AltraRigaDaScrivere[]             // le camere delle altre linee, con la loro quota del nuovo totale
  pulsante: string                         // «Conferma soggiorno · 255 €»
}

const rigaTratto = (t: TrattoPiano, importoCent: number, i: number): RigaAnteprimaSoggiorno => {
  const aNotte = importoCent % t.notti === 0 ? ` × ${euroScheda(importoCent / t.notti)}` : ''
  return { chiave: `tratto-${i}`, testo: `${t.camera} · ${testoNotti(t.notti)}${aNotte}`, importo: euroScheda(importoCent) }
}

/**
 * Il conto come sarà, per la scelta fatta nel foglio. `altreRighe` sono le
 * camere delle ALTRE linee del soggiorno (in parallelo): col nuovo totale
 * entrano nel riparto come nel foglio «Sconto», e la loro quota si scrive
 * insieme al resto.
 */
export function anteprimaSoggiorno(p: {
  tratti: TrattoPiano[]
  altreRighe: RigaSoggiorno[]
  ricevutiCent: number
  scelta: SceltaFoglio
}): AnteprimaSoggiorno {
  const { tratti } = p
  const altre = attive(p.altreRighe)
  const pieniAltre = altre.map(r => cent(prezzoPienoRiga(r)))
  const pienoLineaCent = tratti.reduce((s, t) => s + t.pienoCent, 0)
  const pienoCent = pienoLineaCent + pieniAltre.reduce((s, c) => s + c, 0)
  const righeAltre: RigaAnteprimaSoggiorno[] = altre.map((r, i) => ({
    chiave: `altra-${r.id}`, testo: `${nomeDi(r)} · ${periodoTratto(r.check_in ?? '', r.check_out ?? '')} · ${testoNotti(nottiDi(r))}`, importo: euroScheda(pieniAltre[i]),
  }))
  const pieno = { chiave: 'pieno', testo: RIGA_PREZZO_PIENO, importo: euroScheda(pienoCent) }

  let righe: RigaAnteprimaSoggiorno[]
  let sconto: RigaAnteprimaSoggiorno | null = null
  let totaleCent: number
  let errore: string | null = null
  let nota: string | null = null
  let scelta: ScontoScelto | null = null
  let daScrivere: AltraRigaDaScrivere[] = []

  if (p.scelta.tipo === 'per_notte') {
    const c = p.scelta.centANotte
    righe = tratti.map((t, i) => rigaTratto(t, t.pienoCent - c * t.notti, i))
    const notti = dopoIlCambio(tratti).notti
    sconto = { chiave: 'sconto', testo: `Sconto: ${testoNotti(notti)} × ${euroScheda(c)}`, importo: `−${euroScheda(c * notti)}` }
    totaleCent = pienoCent - c * notti
    scelta = { tipo: 'per_notte', centANotte: c }
  } else {
    righe = [...tratti.map((t, i) => rigaTratto(t, t.pienoCent, i)), ...righeAltre]
    const valore = valoreDaCampo(p.scelta.testo)
    const t = valore === null ? null : cent(valore)
    if (p.scelta.testo.trim() === '') { errore = SCRIVI_IL_TOTALE; totaleCent = pienoCent }
    else if (t === null || t <= 0) { errore = TOTALE_NON_VALIDO; totaleCent = pienoCent }
    else if (t > pienoCent) { errore = TOTALE_TROPPO_ALTO(pienoCent); totaleCent = pienoCent }
    else {
      totaleCent = t
      if (t === pienoCent) {
        nota = SENZA_SCONTO_TESTO
        scelta = SENZA_SCONTO
        daScrivere = altre.map((r, i) => ({ id: r.id, campi: { discount_type: null, discount_value: null, total_amount: pieniAltre[i] / 100 } }))
      } else {
        sconto = { chiave: 'sconto', testo: 'Sconto', importo: `−${euroScheda(pienoCent - t)}` }
        // il nuovo totale si riparte fra la linea e le altre camere in
        // proporzione al prezzo pieno (la linea vale come un pezzo solo: dentro,
        // il piano la divide fra i suoi tratti al centesimo)
        const quote = ripartisciConcordato(t / 100, [pienoLineaCent / 100, ...pieniAltre.map(c => c / 100)])
        scelta = { tipo: 'finale', totaleCent: cent(quote[0]) }
        daScrivere = altre.map((r, i) => ({ id: r.id, campi: { discount_type: 'target_total', discount_value: quote[i + 1], total_amount: quote[i + 1] } }))
      }
    }
  }

  const sotto: RigaAnteprimaSoggiorno[] = []
  let oltre: string | null = null
  if (p.ricevutiCent > 0) {
    sotto.push({ chiave: 'incassati', testo: RIGA_INCASSATI, importo: euroScheda(p.ricevutiCent) })
    if (p.ricevutiCent > totaleCent) oltre = OLTRE_IL_TOTALE(p.ricevutiCent - totaleCent)
    else sotto.push({ chiave: 'resta', testo: RIGA_RESTA, importo: euroScheda(totaleCent - p.ricevutiCent) })
  }
  return {
    righe, pieno, sconto,
    totale: { chiave: 'totale', testo: RIGA_TOTALE, importo: euroScheda(totaleCent) },
    totaleCent, sotto, oltre, errore, nota, scelta, altre: daScrivere,
    pulsante: errore ? CONFERMA_SOGGIORNO : `${CONFERMA_SOGGIORNO} · ${euroScheda(totaleCent)}`,
  }
}

/** Quello che la pagina passa a chi salva, deciso nel foglio: la scelta per
 *  il piano della linea, le altre camere da riscrivere e il totale finale */
export type PrezzoDeciso = { scelta: ScontoScelto; altre: AltraRigaDaScrivere[]; totaleCent: number }
