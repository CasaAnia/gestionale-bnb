// ============================================================================
// IL FOGLIETTO DI DETTAGLIO DEL CALENDARIO (riferimento approvato da Ania il
// 29/09/2026, telefono «Foglietto al tocco») — la parte pura.
//
// Un tocco su una scheda del calendario non apre più la scheda prenotazione:
// apre dal basso un foglietto ad ALTEZZA FISSA con tutto il dettaglio, righe
// etichetta/valore sempre nello stesso ordine:
//   AMBRA · 1 → 5 OTT · 4 NOTTI · CONFERMATA
//   🧾 ⭐ Giovanni Serra                              (cornetta) (WhatsApp)
//   dorme Teresa Bianchi · mamma                     (solo se è un'altra)
//   CAMERE     Ambra 2 notti, poi Lena 2
//   OSPITI     3 · letto in più dal 3 ott
//   PREZZO     ~~420 €~~ 380 € · sconto 40 €
//   PAGAMENTO  ricevuti 190 € · restano 190 € · bonifico, caparra entro mer 30
//   ARRIVO     gio 1 ott, in struttura 16:00 circa · atterra a Malpensa 14:15 · …
//   NOTE       nota del cliente · Questa volta: nota della prenotazione
//   CLIENTE    già ospite 4 volte · da Nida · vuole ricevuta · 1.020 € con questa
//
// I dati si leggono con le STESSE funzioni della scheda prenotazione
// (lib/schedaPrenotazione, schedaConto, schedaMaison, arrivo, comePaga,
// clienteCheTorna, guestName): qui si compongono soltanto.
// Niente React, niente Supabase: `oggi` arriva dal chiamante.
// ============================================================================
import { caselleSoggiorno, euroScheda, noteScheda, periodoConMese, primaRigaScheda, segmentiAttivi, statoScheda, testoNotti, TITOLO_CONTO_NON_LEGGIBILE, type CasellaSoggiorno, type SegmentoScheda } from './schedaPrenotazione.ts'
import { contoScheda, riepilogoConto } from './schedaConto.ts'
import { caparraDaRicevere, arrivoInBreve, giornoSettimana, navettaInBreve, nottiConLetto, quandoGiorno, testoDorme, chiDormeAlPosto, QUESTA_VOLTA, type AccordoCaparra, type RigaChiDorme } from './schedaMaison.ts'
import { orarioIgnoto, type Arrivo } from './arrivo.ts'
import { comePagaSalvato, NOME_COME_PAGA } from './comePaga.ts'
import { conPreposizione } from './richiesteTesti.ts'
import { MESI_BREVI } from './dateItaliane.ts'
import { ORARIO_DA_CHIEDERE } from './calendarioSchede.ts'

/** L'altezza fissa del foglietto, la stessa per ogni prenotazione. Dai
 *  ritocchi del 29/09/2026 (A4) dentro ci sono anche la riga del numero e i
 *  due tasti 28 px sotto l'ultima riga, con aria sotto: 500 (misurata a 390
 *  px sul foglietto di Carmela Sabia, righe lunghe, dell'anteprima finta) */
export const ALTEZZA_FOGLIETTO = 500
/** Dal Mac lo stesso foglietto, al centro, largo 620 px */
export const LARGHEZZA_FOGLIETTO_MAC = 620
export const APRI_LA_SCHEDA = 'Apri la scheda'
export const CHIUDI = 'Chiudi'
/** Il valore mentre la lettura al tocco non è ancora arrivata */
export const IN_ARRIVO = '…'

/** Un pezzo del valore: normale, in mattone, in verde (saldato) o barrato */
export type Pezzo = { testo: string; tipo?: 'mat' | 'verde' | 'barrato' }
export type RigaFoglietto = { etichetta: string; valore: Pezzo[] }
export const ETICHETTE_FOGLIETTO = ['Camere', 'Ospiti', 'Prezzo', 'Pagamento', 'Arrivo', 'Note', 'Cliente'] as const

// Il nome della camera «corto», come sul calendario («01 Ambra» → «Ambra»)
export const cameraCorta = (nome: string | null | undefined) => (nome ?? '').trim().split(' ').slice(-1)[0] || 'camera'

const minuscolaIniziale = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

// ── La testa ───────────────────────────────────────────────────────────────
/** «Ambra · 1 → 5 ott · 4 notti» (camera del tratto toccato, date del soggiorno intero) */
export function testaFoglietto(camera: string, arrivo: string, partenza: string): string {
  const n = Math.max(0, Math.round((Date.parse(`${partenza}T00:00:00Z`) - Date.parse(`${arrivo}T00:00:00Z`)) / 86400000))
  return `${camera} · ${periodoConMese(arrivo, partenza)} · ${testoNotti(n)}`
}

/** Lo stato in maiuscoletto: i testi della scheda (Confermata, In attesa, Annullata, Conclusa, Mancato arrivo) */
export const statoFoglietto = (status: string, ultimaPartenza: string, oggi: string, mancato: boolean) =>
  (mancato ? 'Mancato arrivo' : statoScheda(status, ultimaPartenza, oggi))

/** 🧾 ⭐ davanti al nome, come nel riferimento */
export const iconeFoglietto = (ricevuta: boolean, ottimo: boolean) => [ricevuta && '🧾', ottimo && '⭐'].filter(Boolean).join(' ')

/** «dorme Teresa Bianchi · mamma», solo quando chi dorme non è chi ha prenotato */
export function dormeFoglietto(riga: RigaChiDorme | null | undefined): string | null {
  const p = chiDormeAlPosto(riga)
  return p ? testoDorme(p) : null
}

// ── Camere e ospiti ────────────────────────────────────────────────────────
/** Le notti di fila nella stessa camera */
function trattiDiFila(caselle: CasellaSoggiorno[]): { camera: string; notti: number }[] {
  const out: { camera: string; notti: number }[] = []
  for (const c of caselle) {
    const ultimo = out[out.length - 1]
    if (ultimo && ultimo.camera === c.camera) ultimo.notti += 1
    else out.push({ camera: c.camera, notti: 1 })
  }
  return out
}

/** «Ambra», «Ambra 2 notti, poi Lena 2», «Ambra 2 notti, poi Lena 2, poi Ambra 1» */
export function camereFoglietto(caselle: CasellaSoggiorno[]): string {
  const t = trattiDiFila(caselle)
  if (t.length <= 1) return t[0]?.camera ?? ''
  return t.map((x, i) => (i === 0 ? `${x.camera} ${testoNotti(x.notti)}` : `poi ${x.camera} ${x.notti}`)).join(', ')
}

/** «3 · letto in più dal 3 ott», «2», «3 · letto in più» (tutte le notti) */
export function ospitiFoglietto(caselle: CasellaSoggiorno[], conLetto: Set<string>): string {
  if (caselle.length === 0) return ''
  const persone = Math.max(...caselle.map(c => c.persone))
  const notti = caselle.map(c => c.iso)
  const col = notti.filter(g => conLetto.has(g)).sort()
  if (col.length === 0) return String(persone)
  if (col.length >= notti.length) return `${persone} · letto in più`
  const [, m, g] = col[0].split('-').map(Number)
  return `${persone} · letto in più ${conPreposizione('dal', g)} ${MESI_BREVI[m - 1]}`
}

// ── Prezzo e pagamento ─────────────────────────────────────────────────────
export type ContoFoglietto = { totaleCent: number; ricevutiCent: number } | null

/** «~~420 €~~ 380 € · sconto 40 €» col prezzo pieno barrato SOLO se c'è sconto */
export function prezzoFoglietto(attive: SegmentoScheda[], conto: ContoFoglietto): Pezzo[] {
  if (!conto) return [{ testo: TITOLO_CONTO_NON_LEGGIBILE, tipo: 'mat' }]
  const righe = contoScheda(attive, conto.totaleCent)
  const scontoCent = righe.totaleCent - conto.totaleCent
  if (!righe.sconto || scontoCent <= 0) return [{ testo: euroScheda(conto.totaleCent) }]
  return [{ testo: righe.totale, tipo: 'barrato' }, { testo: ` ${euroScheda(conto.totaleCent)} · sconto ${euroScheda(scontoCent)}` }]
}

/** Come paga, in breve: il nome di lib/comePaga («bonifico», «caparra del 50%»…) e la scadenza della caparra */
export function comePagaFoglietto(accordo: AccordoCaparra | null | undefined, totaleCent: number, ricevutiCent: number): string {
  const modo = comePagaSalvato(accordo?.accordo_pagamento, accordo?.bonifico)
  const nome = minuscolaIniziale(NOME_COME_PAGA[modo])
  const caparra = caparraDaRicevere(accordo, totaleCent, ricevutiCent)
  if (!caparra) return nome
  const entro = `entro ${giornoSettimana(caparra.entro)}`
  return modo === 'meta' || modo === 'caparra' ? `${nome} ${entro}` : `${nome}, caparra ${entro}`
}

/** «ricevuti 190 € · restano 190 € · bonifico, caparra entro mer 30»; «saldato» in verde */
export function pagamentoFoglietto(conto: ContoFoglietto, pagato: boolean, accordo: AccordoCaparra | null | undefined): Pezzo[] {
  if (!conto) return [{ testo: TITOLO_CONTO_NON_LEGGIBILE, tipo: 'mat' }]
  const r = riepilogoConto(conto, pagato)
  const out: Pezzo[] = []
  if (conto.ricevutiCent > 0) out.push({ testo: `ricevuti ${r.ricevuto} · ` })
  if (r.saldato) { out.push({ testo: 'saldato', tipo: 'verde' }); return out }
  out.push({ testo: `restano ${r.residuo}`, tipo: 'mat' })
  out.push({ testo: ` · ${comePagaFoglietto(accordo, conto.totaleCent, conto.ricevutiCent)}` })
  return out
}

// ── Arrivo, note, cliente ──────────────────────────────────────────────────
/**
 * L'arrivo con i testi della scheda («In breve» di lib/schedaMaison, da
 * lib/arrivo) su una riga; senza nessun orario «orario da chiedere».
 */
export function arrivoFoglietto(a: Arrivo, checkIn: string, oggi: string): string {
  if (orarioIgnoto(a)) return `${quandoGiorno(checkIn, oggi)}, ${ORARIO_DA_CHIEDERE} · ${navettaInBreve(a, true)}`
  return arrivoInBreve(a, checkIn, oggi).join(' · ')
}

/** Con più arrivi (un rientro dopo una pausa) il primo futuro; se sono tutti passati, l'ultimo */
export function arrivoDaMostrare<T extends { check_in: string }>(arrivi: T[], oggi: string): T | null {
  if (arrivi.length === 0) return null
  return arrivi.find(a => a.check_in >= oggi) ?? arrivi[arrivi.length - 1]
}

/** «nota del cliente · Questa volta: nota della prenotazione»; vuoto se non ce ne sono */
export function noteFoglietto(notaCliente: string | null | undefined, notaPrenotazione: string | null | undefined): string {
  return noteScheda(notaCliente, notaPrenotazione)
    .map(n => (n.etichetta ? `${QUESTA_VOLTA}: ${n.testo}` : n.testo))
    .join(' · ')
}

/**
 * «già ospite 4 volte · da Nida · vuole ricevuta · 1.020 € con questa»: la
 * prima riga della scheda (primaRigaScheda), la ricevuta, e in mattone lo
 * speso nei soggiorni precedenti PIÙ il totale concordato di questa.
 */
export function clienteFoglietto(volte: number, provenienza: string | null | undefined, ricevuta: boolean, spesoPrimaCent: number, questaCent: number | null): Pezzo[] {
  const prima = minuscolaIniziale(primaRigaScheda(volte, provenienza).testo)
  const testo = [prima, ricevuta ? 'vuole ricevuta' : ''].filter(Boolean).join(' · ')
  if (questaCent == null) return [{ testo }]
  return [{ testo: `${testo} · ` }, { testo: euroScheda(spesoPrimaCent + questaCent), tipo: 'mat' }, { testo: ' con questa' }]
}

// ── Tutte le righe, nell'ordine ────────────────────────────────────────────
export type DatiFoglietto = {
  segmenti: SegmentoScheda[]
  oggi: string
  conto: ContoFoglietto
  pagato: boolean
  accordo: AccordoCaparra | null | undefined
  arrivo: { dati: Arrivo; checkIn: string } | null
  notaCliente: string | null | undefined
  notaPrenotazione: string | null | undefined
  volte: number
  provenienza: string | null | undefined
  ricevuta: boolean
  spesoPrimaCent: number
}

export function righeFoglietto(d: DatiFoglietto): RigaFoglietto[] {
  const attive = segmentiAttivi(d.segmenti)
  const caselle = caselleSoggiorno(attive, d.oggi)
  const note = noteFoglietto(d.notaCliente, d.notaPrenotazione)
  return [
    { etichetta: 'Camere', valore: [{ testo: camereFoglietto(caselle) }] },
    { etichetta: 'Ospiti', valore: [{ testo: ospitiFoglietto(caselle, nottiConLetto(attive)) }] },
    { etichetta: 'Prezzo', valore: prezzoFoglietto(attive, d.conto) },
    { etichetta: 'Pagamento', valore: pagamentoFoglietto(d.conto, d.pagato, d.accordo) },
    { etichetta: 'Arrivo', valore: [{ testo: d.arrivo ? arrivoFoglietto(d.arrivo.dati, d.arrivo.checkIn, d.oggi) : ORARIO_DA_CHIEDERE }] },
    { etichetta: 'Note', valore: note ? [{ testo: note, tipo: 'mat' }] : [] },
    { etichetta: 'Cliente', valore: clienteFoglietto(d.volte, d.provenienza, d.ricevuta, d.spesoPrimaCent, d.conto ? d.conto.totaleCent : null) },
  ]
}

/** Le stesse righe, col valore «…» mentre la lettura al tocco non è arrivata */
export const righeInArrivo = (): RigaFoglietto[] => ETICHETTE_FOGLIETTO.map(etichetta => ({ etichetta, valore: [{ testo: IN_ARRIVO }] }))
