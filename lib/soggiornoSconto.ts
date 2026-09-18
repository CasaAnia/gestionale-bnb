// ============================================================================
// LO SCONTO QUANDO CAMBIA IL SOGGIORNO (17/09/2026, rifatto il 18/09/2026):
// il foglio «Il soggiorno si allunga» / «si accorcia» della scheda nuova.
//
// Il problema (Maurizio Stuppino): una notte a 90 € con 5 € di sconto, cioè
// 85 €. Allungandola a tre notti il gestionale teneva fisso il totale vecchio
// di 85 € e per farlo tornare spalmava lo sconto sulle camere nuove: tre notti
// pagate come una, e un conto illeggibile (−61,67 e −123,33).
//
// Adesso, ogni volta che cambiano le notti di un soggiorno CHE HA UNO SCONTO
// (allungato, accorciato, camera cambiata), PRIMA di salvare si apre il foglio
// con «prima» com'era, e si sceglie come aggiornare il prezzo:
//   1. «Tengo 5 € di sconto a notte» — lo sconto di adesso diviso per le notti
//      di adesso, tolto da ogni notte nuova (dai prezzi pieni veri di ogni
//      tratto); con la percentuale «Tengo il 10 % di sconto», che segue le
//      notti da sola. È la scelta accesa di partenza, quando si può proporre:
//      una linea sola (con più camere nelle stesse notti lo sconto non si
//      divide per i giorni), stesso accordo su tutti i tratti, sconto che si
//      divide in parti uguali fra le notti e che non azzera nessun tratto;
//   2. «Concordo un prezzo nuovo» — il totale dell'intero soggiorno, scritto
//      a mano, ripartito fra i tratti come fa il foglio «Sconto»; accanto al
//      campo si legge quanto viene a notte.
// Sotto, «Il nuovo conto» nelle righe di lib/contoInRighe: le camere, il
// letto in una riga sola, «Da pagare» e «3 notti · 85 € a notte · prezzo
// pieno 270 €, sconto 15 €». Il conto si rifà a ogni tocco.
//
// Soggiorno e prezzo si salvano INSIEME (la scelta entra nel piano di
// lib/strisciaNotti come `ScontoScelto`): mai le date prima e il conto dopo.
// Senza sconto il foglio non compare e il conto si rifà da solo come sempre.
//
// Funzioni pure: niente Supabase, niente orologio.
// ============================================================================
import { contoSoggiorno } from './conto.ts'
import { euroScheda, periodoConMese, testoNotti } from './schedaPrenotazione.ts'
import { giorniSoggiorno, fmtEuroBreve } from './prezzoNotti.ts'
import { euroTondi } from './euroTondi.ts'
import { ripartisciConcordato, type PianoNotti, type TrattoPiano, type ScontoScelto } from './strisciaNotti.ts'
import { prezzoPienoRiga, valoreDaCampo, type RigaScontabile } from './scontoScheda.ts'
import {
  rigaSconto, nottiANotte, dettaglioLetto, percentualeComune, percentoInParole, RIGA_LETTO,
  type RigaContoVista, type ScontoVista,
} from './contoInRighe.ts'

export const SENZA_SCONTO: ScontoScelto = { tipo: 'nessuno' }

export type RigaSoggiorno = RigaScontabile & { rooms?: { name?: string | null } | null }

const cent = (n: number) => Math.round(n * 100)
const attive = <T extends RigaScontabile>(righe: T[]) => righe.filter(r => r.status !== 'annullata')
const nottiDi = (r: RigaScontabile) => contoSoggiorno({ check_in: r.check_in, check_out: r.check_out }).notti
const nomeDi = (r: RigaSoggiorno) => (r.rooms?.name ?? '').trim() || 'camera'
/** «una notte», «3 notti» */
export const nottiInParole = (n: number) => (n === 1 ? 'una notte' : `${n} notti`)
export { periodoConMese }

// ── I testi del foglio ──────────────────────────────────────────────────────
export const TITOLO_ALLUNGA = 'Il soggiorno si allunga'
export const TITOLO_ACCORCIA = 'Il soggiorno si accorcia'
export const TITOLO_CAMBIA = 'Il soggiorno cambia'
export const DOMANDA_PREZZO = 'Come aggiorno il prezzo'
export const TITOLO_NUOVO_CONTO = 'Il nuovo conto'
export const SCELTA_PER_NOTTE = (centANotte: number) => `Tengo ${euroScheda(centANotte)} di sconto a notte`
export const SCELTA_PERCENTUALE = (percento: number) => `Tengo il ${percentoInParole(percento)} di sconto`
export const SCELTA_NUOVO_PREZZO = 'Concordo un prezzo nuovo'
export const ETICHETTA_TOTALE_SOGGIORNO = 'Totale dell’intero soggiorno'
export const TORNA_ALLE_MODIFICHE = 'Torna alle modifiche'
export const CONFERMA = 'Conferma'
export const RIGA_INCASSATI = 'Già incassati'
export const RIGA_RESTA = 'Resta da incassare'
export const LETTO_COMPRESO = 'letto compreso'
export const PREZZO_PIENO = 'prezzo pieno'
export const OLTRE_IL_TOTALE = (cent: number) => `${euroScheda(cent)} oltre il nuovo totale: i pagamenti restano come sono, controllali dopo.`
export const SCRIVI_IL_TOTALE = 'Scrivi il totale dell’intero soggiorno.'
export const TOTALE_TROPPO_ALTO = (pienoCent: number) => `Il totale non può superare il prezzo pieno (${euroScheda(pienoCent)}).`
export const TOTALE_NON_VALIDO = 'Il totale deve essere un numero sopra lo zero.'
export const SENZA_SCONTO_TESTO = 'Senza sconto: il totale è il prezzo pieno.'
// perché «tengo lo sconto» non si può proporre
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

/** Vero se una camera attiva del soggiorno ha uno sconto (percentuale o prezzo finale) */
export function soggiornoConSconto(tutti: RigaScontabile[]): boolean {
  return attive(tutti).some(s => contoSoggiorno(s).sconto > 0)
}

/** Il foglio serve quando il soggiorno ha uno sconto e la modifica cambia le
 *  notti o il prezzo pieno della linea. `pianoSenza` è il piano fatto SENZA
 *  sconto (SENZA_SCONTO): così si vedono i tratti anche quando il totale
 *  concordato non starebbe più sotto il prezzo pieno. */
export function serveConfermaPrezzo(segmentiLinea: RigaScontabile[], tutti: RigaScontabile[], pianoSenza: PianoNotti): boolean {
  if (pianoSenza.errore || pianoSenza.tratti.length === 0) return false
  if (!soggiornoConSconto(tutti)) return false
  const prima = primaDelCambio(segmentiLinea)
  const dopo = dopoIlCambio(pianoSenza.tratti)
  return prima.notti !== dopo.notti || prima.pienoCent !== dopo.pienoCent
}

// ── La testa del foglio ─────────────────────────────────────────────────────
export function titoloConferma(nottiPrima: number, nottiDopo: number): string {
  return nottiDopo > nottiPrima ? TITOLO_ALLUNGA : nottiDopo < nottiPrima ? TITOLO_ACCORCIA : TITOLO_CAMBIA
}

/** «da 1 a 3 notti · 29 nov → 2 dic», «sempre 3 notti · 29 nov → 2 dic» */
export function sottotitoloConferma(nottiPrima: number, tratti: TrattoPiano[]): string {
  const dopo = dopoIlCambio(tratti).notti
  const dal = tratti[0]?.check_in ?? ''
  const al = tratti.reduce((m, t) => (t.check_out > m ? t.check_out : m), tratti[0]?.check_out ?? '')
  const notti = dopo === nottiPrima ? `sempre ${testoNotti(dopo)}` : `da ${nottiPrima} a ${testoNotti(dopo)}`
  return dal && al ? `${notti} · ${periodoConMese(dal, al)}` : notti
}

/** «prima: 90 € − 5 € di sconto = 85 € per una notte» */
export function riepilogoPrima(p: PrimaDelCambio): string {
  const conto = p.scontoCent > 0 ? `${euroScheda(p.pienoCent)} − ${euroScheda(p.scontoCent)} di sconto = ${euroScheda(p.totaleCent)}` : euroScheda(p.totaleCent)
  return `prima: ${conto} per ${nottiInParole(p.notti)}`
}

// ── La prima scelta: tengo lo sconto ────────────────────────────────────────
export type SceltaTengo = { tipo: 'per_notte'; centANotte: number } | { tipo: 'percentuale'; percento: number }
export type OpzioneTengo = { scelta: SceltaTengo; etichetta: string; sotto: string }

/** Quanto viene ogni tratto con quella scelta, in centesimi (come lo rileggerà lib/conto) */
export function scontatiPerTratto(tratti: TrattoPiano[], scelta: SceltaTengo): number[] {
  return tratti.map(t => (scelta.tipo === 'per_notte'
    ? t.pienoCent - scelta.centANotte * t.notti
    : t.pienoCent - Math.round((t.pienoCent / 100) * scelta.percento)))
}

/** «Tengo 5 € di sconto a notte» con sotto «85 € a notte, letto compreso», o
 *  «Tengo il 10 % di sconto»; oppure il motivo per cui non si può proporre. */
export function primaScelta(segmentiLinea: RigaScontabile[], tutti: RigaScontabile[], tratti: TrattoPiano[]): { opzione: OpzioneTengo | null; motivo: string | null } {
  const vive = attive(segmentiLinea)
  // la percentuale, uguale su tutte le camere del soggiorno: si tiene com'è
  const percento = percentualeComune(attive(tutti))
  if (percento !== null && vive.length > 0) {
    const scelta: SceltaTengo = { tipo: 'percentuale', percento }
    return { opzione: { scelta, etichetta: SCELTA_PERCENTUALE(percento), sotto: sottoScontati(tratti, scontatiPerTratto(tratti, scelta)) }, motivo: null }
  }
  // il prezzo finale: lo sconto di adesso diviso per le notti di adesso
  const dellaLinea = new Set(vive.map(s => s.id))
  if (attive(tutti).some(s => !dellaLinea.has(s.id))) return { opzione: null, motivo: MOTIVO_PIU_CAMERE }
  if (vive.length === 0 || vive.some(s => s.discount_type !== 'target_total')) return { opzione: null, motivo: MOTIVO_ACCORDI_DIVERSI }
  const prima = primaDelCambio(segmentiLinea)
  if (prima.scontoCent <= 0 || prima.notti <= 0) return { opzione: null, motivo: MOTIVO_ACCORDI_DIVERSI }
  if (prima.scontoCent % prima.notti !== 0) return { opzione: null, motivo: MOTIVO_NON_SI_DIVIDE(prima.scontoCent, prima.notti) }
  const centANotte = prima.scontoCent / prima.notti
  if (tratti.some(t => t.pienoCent - centANotte * t.notti <= 0)) return { opzione: null, motivo: MOTIVO_A_ZERO(centANotte) }
  const scelta: SceltaTengo = { tipo: 'per_notte', centANotte }
  return { opzione: { scelta, etichetta: SCELTA_PER_NOTTE(centANotte), sotto: sottoScontati(tratti, scontatiPerTratto(tratti, scelta)) }, motivo: null }
}

/** «85 € a notte, letto compreso», «85 € e 75 € a notte»: gli importi veri di
 *  ogni tratto, non sempre lo stesso numero; «235 € in tutto» se non si
 *  dividono per le notti */
export function sottoScontati(tratti: TrattoPiano[], scontatiCent: number[]): string {
  const aNotte = scontatiCent.map((c, i) => (c % tratti[i].notti === 0 ? c / tratti[i].notti : null))
  const letto = tratti.some(t => t.letto > 0) ? `, ${LETTO_COMPRESO}` : ''
  if (aNotte.some(x => x === null)) return `${euroScheda(scontatiCent.reduce((s, c) => s + c, 0))} in tutto${letto}`
  const distinti = [...new Set(aNotte as number[])]
  const testo = distinti.length === 1
    ? euroScheda(distinti[0])
    : `${distinti.slice(0, -1).map(euroScheda).join(', ')} e ${euroScheda(distinti[distinti.length - 1])}`
  return `${testo} a notte${letto}`
}

// ── L'anteprima del nuovo conto ─────────────────────────────────────────────
export type RigaAnteprimaSoggiorno = { chiave: string; testo: string; importo: string }
export type SceltaFoglio = SceltaTengo | { tipo: 'finale'; testo: string }
export type AltraRigaDaScrivere = { id: string; campi: { discount_type: string | null; discount_value: number | null; total_amount: number } }

export type AnteprimaSoggiorno = {
  righe: RigaContoVista[]                  // le camere (della linea e delle altre) a prezzo pieno, e il letto in una riga
  pienoCent: number                        // il prezzo pieno dell'intero soggiorno
  sconto: ScontoVista | null               // «Sconto» −15 €, «Sconto 10 %» −27 €, o niente
  daPagare: string                         // «255 €»
  totaleCent: number                       // dell'INTERO soggiorno, altre camere comprese
  notti: number                            // le notti dormite in casa (una notte con due camere conta una volta)
  sotto: string                            // «3 notti · 85 € a notte · prezzo pieno 270 €, sconto 15 €»
  aNotteCampo: string                      // accanto al campo del totale: «85 € a notte», o vuoto
  incassi: RigaAnteprimaSoggiorno[]        // «Già incassati» 300 €, «Resta da incassare» 45 €
  oltre: string | null                     // i pagamenti superano il nuovo totale
  errore: string | null                    // il nuovo totale scritto non va bene
  nota: string | null                      // «Senza sconto: il totale è il prezzo pieno.»
  scelta: ScontoScelto | null              // cosa passare al piano della LINEA (null se c'è un errore)
  altre: AltraRigaDaScrivere[]             // le camere delle altre linee, con la loro quota del nuovo totale
  pulsante: string                         // «Conferma · 255 €»
}

/** Le righe del nuovo conto a prezzo pieno: una per camera col dettaglio, poi il letto in una riga sola */
export function righeDeiTratti(tratti: TrattoPiano[], altre: RigaSoggiorno[]): RigaContoVista[] {
  const righe: RigaContoVista[] = tratti.map((t, i) => {
    const cameraCent = t.pienoCent - cent(t.letto)
    const aNotte = t.notti > 0 && cent(t.aNotte) * t.notti === cameraCent ? ` × ${fmtEuroBreve(t.aNotte)}` : ''
    return { chiave: `tratto-${i}`, titolo: t.camera, dettaglio: `${periodoConMese(t.check_in, t.check_out)} · ${testoNotti(t.notti)}${aNotte}`, importo: euroScheda(cameraCent) }
  })
  for (const r of altre) {
    righe.push({ chiave: `altra-${r.id}`, titolo: nomeDi(r), dettaglio: `${periodoConMese(r.check_in ?? '', r.check_out ?? '')} · ${testoNotti(nottiDi(r))}`, importo: euroScheda(cent(prezzoPienoRiga(r))) })
  }
  const conLetto = tratti.filter(t => t.letto > 0)
  if (conLetto.length > 0) {
    const notti = conLetto.reduce((s, t) => s + (t.nottiLetto || t.notti), 0)
    const lettoCent = conLetto.reduce((s, t) => s + cent(t.letto), 0)
    const unitari = conLetto.map(t => cent(t.letto) / (t.nottiLetto || t.notti))
    righe.push({ chiave: 'letto', titolo: RIGA_LETTO, dettaglio: dettaglioLetto(notti, lettoCent, unitari), importo: euroScheda(lettoCent) })
  }
  return righe
}

/**
 * Il conto come sarà, per la scelta fatta nel foglio. `altreRighe` sono le
 * camere delle ALTRE linee del soggiorno (in parallelo): col nuovo totale
 * entrano nel riparto come nel foglio «Sconto», e la loro quota si scrive
 * insieme al resto; con «tengo lo sconto» restano come sono.
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
  const righe = righeDeiTratti(tratti, altre)
  const giorni = new Set<string>()
  for (const t of tratti) for (const g of giorniSoggiorno(t.check_in, t.check_out)) giorni.add(g)
  for (const r of altre) for (const g of giorniSoggiorno(r.check_in, r.check_out)) giorni.add(g)
  const notti = giorni.size

  let totaleCent: number
  let percento: number | null = null
  let errore: string | null = null
  let nota: string | null = null
  let scelta: ScontoScelto | null = null
  let daScrivere: AltraRigaDaScrivere[] = []
  let aNotteCampo = ''

  if (p.scelta.tipo === 'per_notte' || p.scelta.tipo === 'percentuale') {
    // le altre camere restano come sono: entrano col loro totale di adesso
    const lineaCent = scontatiPerTratto(tratti, p.scelta).reduce((s, c) => s + c, 0)
    totaleCent = lineaCent + altre.reduce((s, r) => s + cent(contoSoggiorno(r).totale), 0)
    percento = p.scelta.tipo === 'percentuale' ? p.scelta.percento : null
    scelta = p.scelta
  } else {
    const valore = valoreDaCampo(p.scelta.testo)
    const t = valore === null ? null : cent(valore)
    if (p.scelta.testo.trim() === '') { errore = SCRIVI_IL_TOTALE; totaleCent = pienoCent }
    else if (t === null || t <= 0) { errore = TOTALE_NON_VALIDO; totaleCent = pienoCent }
    else if (t > pienoCent) { errore = TOTALE_TROPPO_ALTO(pienoCent); totaleCent = pienoCent }
    else {
      totaleCent = t
      if (notti > 0) aNotteCampo = `${euroScheda(Math.round(t / notti))} a notte`
      if (t === pienoCent) {
        nota = SENZA_SCONTO_TESTO
        scelta = SENZA_SCONTO
        daScrivere = altre.map((r, i) => ({ id: r.id, campi: { discount_type: null, discount_value: null, total_amount: pieniAltre[i] / 100 } }))
      } else {
        // il nuovo totale si riparte fra la linea e le altre camere in
        // proporzione al prezzo pieno (la linea vale come un pezzo solo: dentro,
        // il piano la divide fra i suoi tratti al centesimo)
        const quote = ripartisciConcordato(t / 100, [pienoLineaCent / 100, ...pieniAltre.map(c => c / 100)])
        scelta = { tipo: 'finale', totaleCent: cent(quote[0]) }
        daScrivere = altre.map((r, i) => ({ id: r.id, campi: { discount_type: 'target_total', discount_value: quote[i + 1], total_amount: quote[i + 1] } }))
      }
    }
  }

  const scontoCent = Math.max(0, pienoCent - totaleCent)
  const sconto = errore ? null : rigaSconto(scontoCent, percento)
  const sotto = [nottiANotte(notti, totaleCent), `${PREZZO_PIENO} ${euroScheda(pienoCent)}${scontoCent > 0 ? `, sconto ${euroTondi(scontoCent)}` : ''}`]
    .filter(Boolean).join(' · ')

  const incassi: RigaAnteprimaSoggiorno[] = []
  let oltre: string | null = null
  if (p.ricevutiCent > 0) {
    incassi.push({ chiave: 'incassati', testo: RIGA_INCASSATI, importo: euroScheda(p.ricevutiCent) })
    if (p.ricevutiCent > totaleCent) oltre = OLTRE_IL_TOTALE(p.ricevutiCent - totaleCent)
    else incassi.push({ chiave: 'resta', testo: RIGA_RESTA, importo: euroScheda(totaleCent - p.ricevutiCent) })
  }
  return {
    righe, pienoCent, sconto, daPagare: euroScheda(totaleCent), totaleCent, notti, sotto, aNotteCampo,
    incassi, oltre, errore, nota, scelta, altre: daScrivere,
    pulsante: errore ? CONFERMA : `${CONFERMA} · ${euroScheda(totaleCent)}`,
  }
}

/** Quello che la pagina passa a chi salva, deciso nel foglio: la scelta per
 *  il piano della linea, le altre camere da riscrivere e il totale finale */
export type PrezzoDeciso = { scelta: ScontoScelto; altre: AltraRigaDaScrivere[]; totaleCent: number }
