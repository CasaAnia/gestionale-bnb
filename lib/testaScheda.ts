// ============================================================================
// LA TESTA DELLA SCHEDA PRENOTAZIONE, rifatta il 20/09/2026 sera sul disegno
// approvato da Ania («La prenotazione, a colpo d'occhio», colonna DOPO ·
// proposta punto 2). Qui si decide COSA scrivere; il componente
// (components/scheda/TestaScheda) decide come. Funzioni pure: niente
// Supabase, niente orologio — «oggi» arriva da fuori (data di Roma).
//
//  · le due date del SOGGIORNO INTERO: «mar 1 settembre» → «ven 25 settembre»,
//    con l'anno solo quando arrivo e partenza stanno in anni diversi;
//  · sotto le date: l'orario d'arrivo e la navetta, oppure «Orario da
//    definire» / «Navetta da verificare» quando non sono stati registrati
//    (un valore assente NON vuol dire «no»);
//  · «1 ospite · 3 cambi camera» e la sequenza intera delle camere, con
//    tutti i nomi anche ripetuti («Ambra ⇄ Amelia ⇄ Ambra ⇄ Lena»): quattro
//    periodi sono tre cambi. Il «+» resta per due camere nelle stesse notti
//    (lib/schedaPrenotazione.rigaGrandeScheda, regola fissa n. 8);
//  · «Oggi · 20 settembre» · «In Ambra» · «Prossimo cambio: 22 settembre →
//    Lena»: la camera della notte di oggi e il prossimo evento vero (cambio,
//    partenza, arrivo); niente check-in automatico, è solo il calendario;
//  · «Resta da incassare» con la cifra del conto (lib/schedaConto.
//    riepilogoConto: la stessa fonte del conto, nessun secondo calcolo).
// ============================================================================
import { riepilogoPeriodi } from './periodiPrenotazione.ts'
import { AUTISTI, circaInStruttura, periodoInStruttura, type Arrivo } from './arrivo.ts'
import { rigaGrandeScheda, segmentiAttivi, type SegmentoScheda } from './schedaPrenotazione.ts'
import { giorniSoggiorno } from './prezzoNotti.ts'
import { GIORNI_BREVI, MESI_LUNGHI } from './dateItaliane.ts'
import { conPreposizione } from './richiesteTesti.ts'
import type { RiepilogoConto } from './schedaConto.ts'

const pezzi = (iso: string) => { const [a, m, g] = iso.slice(0, 10).split('-').map(Number); return { a, m, g } }
const settimana = (iso: string) => { const p = pezzi(iso); return GIORNI_BREVI[new Date(Date.UTC(p.a, p.m - 1, p.g)).getUTCDay()] }
/** «22 settembre», con l'anno se diverso da quello di riferimento: «2 gennaio 2027» */
export function giornoEMese(iso: string, annoDiRiferimento?: number): string {
  const p = pezzi(iso)
  return `${p.g} ${MESI_LUNGHI[p.m - 1]}${annoDiRiferimento !== undefined && p.a !== annoDiRiferimento ? ` ${p.a}` : ''}`
}
const nomeCamera = (s: SegmentoScheda) => (s.rooms?.name ?? '').trim() || 'camera'

// ── Le date del soggiorno ───────────────────────────────────────────────────
export type DataTesta = { settimana: string; giorno: number; mese: string; anno: string }
export type DateTesta = { arrivo: DataTesta; partenza: DataTesta; notti: string }

/** «mar 1» + «settembre»; l'anno compare solo quando i due anni sono diversi */
export function dateTesta(arrivo: string, partenza: string, notti: number): DateTesta {
  const a = pezzi(arrivo), p = pezzi(partenza)
  const anniDiversi = a.a !== p.a
  const data = (iso: string, x: { a: number; m: number; g: number }): DataTesta =>
    ({ settimana: settimana(iso), giorno: x.g, mese: MESI_LUNGHI[x.m - 1], anno: anniDiversi ? String(x.a) : '' })
  return { arrivo: data(arrivo, a), partenza: data(partenza, p), notti: notti === 1 ? '1 notte' : `${notti} notti` }
}

// ── Orario e navetta ────────────────────────────────────────────────────────
export const ORARIO_DA_DEFINIRE = 'Orario da definire'
export const NAVETTA_DA_VERIFICARE = 'Navetta da verificare'
export const NAVETTA_NON_RICHIESTA = 'Navetta non richiesta'
export const CON_NAVETTA = 'Con navetta'
export const ARRIVA_ALLE = (ora: string) => `Arriva alle ${ora}`

export type ArrivoTesta = { orario: string; navetta: string; orarioDaDefinire: boolean; navettaDaVerificare: boolean }

/** I due pezzi sotto le date, LETTI DAL MODELLO (21/09/2026 sera, rilievo di
 *  Codex): prima la testa leggeva le due colonne di sempre e perdeva per
 *  strada la fine della fascia, il «circa» della stima e il nome
 *  dell'autista — «Arriva alle 16:00 · Con navetta» anche quando il
 *  soggiorno diceva «circa 16:00–17:00, la va a prendere Massimo».
 *
 *  Il disegno della testa non cambia (Ania, 20/09/2026, «La prenotazione, a
 *  colpo d'occhio»): restano due righe brevi, con le stesse parole di prima
 *  quando non c'è niente in più da dire. */
export function arrivoTestaDaArrivo(a: Arrivo): ArrivoTesta {
  const inStruttura = periodoInStruttura(a)
  const autista = AUTISTI.find(x => x.chiave === a.navetta)?.nome ?? null
  const orario = inStruttura
    ? (circaInStruttura(a) || eFasciaTesta(inStruttura) ? `Arriva ${circaInStruttura(a) ? 'circa' : ''} ${inStruttura}`.replace('  ', ' ') : ARRIVA_ALLE(inStruttura))
    : ORARIO_DA_DEFINIRE
  const navetta = autista ? `${CON_NAVETTA} · ${autista}`
    : a.navetta === 'da_assegnare' ? CON_NAVETTA
    : a.navetta === 'non_richiesta' ? NAVETTA_NON_RICHIESTA
    : NAVETTA_DA_VERIFICARE
  return {
    orario,
    navetta,
    orarioDaDefinire: !inStruttura,
    navettaDaVerificare: a.navetta === 'da_definire',
  }
}
const eFasciaTesta = (periodo: string) => periodo.includes('–')

/** I due pezzi sotto le date. `shuttle` è 'si' | 'no' | null: null NON è «no».
 *  Resta per le pagine che leggono ancora le due colonne di sempre. */
export function arrivoTesta(checkInTime: string | null | undefined, shuttle: string | null | undefined): ArrivoTesta {
  const ora = (checkInTime ?? '').trim()
  const s = (shuttle ?? '').trim()
  return {
    orario: ora ? ARRIVA_ALLE(ora) : ORARIO_DA_DEFINIRE,
    navetta: s === 'si' ? CON_NAVETTA : s === 'no' ? NAVETTA_NON_RICHIESTA : NAVETTA_DA_VERIFICARE,
    orarioDaDefinire: !ora,
    navettaDaVerificare: s !== 'si' && s !== 'no',
  }
}

// ── Ospiti, cambi e la sequenza delle camere ───────────────────────────────
export type PercorsoTesta = { sopra: string; camere: string }

/** «1 ospite · 3 cambi camera» (le maiuscole le fa il disegno) e i nomi per esteso */
export function percorsoTesta(segmenti: SegmentoScheda[]): PercorsoTesta {
  // una prenotazione annullata non ha tratti attivi: si leggono lo stesso i suoi, per dire com'era
  const daLeggere = segmentiAttivi(segmenti).length ? segmenti : segmenti.map(s => ({ ...s, status: 'confermata' }))
  const r = rigaGrandeScheda(daLeggere)
  const riepilogo = riepilogoPeriodi(daLeggere)
  const ospiti = riepilogo.ospitiVariabili ? 'Ospiti indicati per periodo' : r.ospiti === 1 ? '1 ospite' : `${r.ospiti} ospiti`
  const pezziSopra = [ospiti]
  if (riepilogo.separati) pezziSopra.push(`${riepilogo.periodi.length} periodi separati`)
  if (r.insieme) pezziSopra.push(`${r.camere.split(' + ').length} camere insieme`)
  if (r.cambi === 1) pezziSopra.push('1 cambio camera')
  else if (r.cambi > 1) pezziSopra.push(`${r.cambi} cambi camera`)
  return { sopra: pezziSopra.join(' · '), camere: r.camere }
}

// ── Oggi, e il prossimo evento ──────────────────────────────────────────────
// La notte di una data appartiene al soggiorno se check_in ≤ data < check_out:
// la notte della partenza non è del soggiorno.
export type OggiTesta = {
  sopra: string                 // «Oggi · 20 settembre»
  titolo: string                // «In Ambra» · «Arriva l'1 settembre» · «Soggiorno concluso» · «Prenotazione annullata» · «Stanotte non in casa»
  prossimo: { testo: string; forte: string } | null   // «Prossimo cambio: » + «22 settembre → Lena»
}
export const IN_CASA = (camere: string) => `In ${camere}`
export const SOGGIORNO_CONCLUSO = 'Soggiorno concluso'
export const PRENOTAZIONE_ANNULLATA_TESTA = 'Prenotazione annullata'
export const NON_IN_CASA = 'Stanotte non in casa'
export const PROSSIMO_CAMBIO = 'Prossimo cambio: '
export const PARTE = 'Parte: '
export const PRIMA_CAMERA = 'Prima camera: '
export const TORNA = 'Torna: '
export const PARTITA = 'Partita: '

function camereDellaNotte(segmenti: SegmentoScheda[], iso: string): string[] {
  const nomi = segmentiAttivi(segmenti).filter(s => s.check_in <= iso && iso < s.check_out).map(nomeCamera)
  return [...new Set(nomi)]
}
const stesse = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

export function oggiTesta(segmenti: SegmentoScheda[], oggi: string, status: string | null | undefined): OggiTesta {
  const anno = pezzi(oggi).a
  const sopra = `Oggi · ${giornoEMese(oggi)}`
  const quando = (iso: string) => giornoEMese(iso, anno)
  const attivi = segmentiAttivi(segmenti)
  if (status === 'annullata' || attivi.length === 0) return { sopra, titolo: PRENOTAZIONE_ANNULLATA_TESTA, prossimo: null }
  const notti = [...new Set(attivi.flatMap(s => giorniSoggiorno(s.check_in, s.check_out)))].sort()
  const primoArrivo = notti[0]
  const ultimaPartenza = attivi.reduce((m, s) => (s.check_out > m ? s.check_out : m), '')
  // conclusa: l'ultima partenza è oggi o è già passata
  if (ultimaPartenza <= oggi) return { sopra, titolo: SOGGIORNO_CONCLUSO, prossimo: { testo: PARTITA, forte: quando(ultimaPartenza) } }
  // futura: il prossimo evento è l'arrivo
  if (primoArrivo > oggi) {
    const g = pezzi(primoArrivo).g
    return { sopra, titolo: `Arriva ${conPreposizione('il', g)} ${MESI_LUNGHI[pezzi(primoArrivo).m - 1]}${pezzi(primoArrivo).a !== anno ? ` ${pezzi(primoArrivo).a}` : ''}`, prossimo: { testo: PRIMA_CAMERA, forte: camereDellaNotte(segmenti, primoArrivo).join(' + ') } }
  }
  // in corso: la camera di stanotte e il primo giorno in cui cambia qualcosa
  const oggiCamere = camereDellaNotte(segmenti, oggi)
  const titolo = oggiCamere.length ? IN_CASA(oggiCamere.join(' + ')) : NON_IN_CASA
  const giorniDopo = notti.filter(n => n > oggi)
  if (!oggiCamere.length) {
    // pausa nel soggiorno: si torna alla prossima notte in casa
    const rientro = giorniDopo[0]
    return { sopra, titolo, prossimo: rientro ? { testo: TORNA, forte: `${quando(rientro)} → ${camereDellaNotte(segmenti, rientro).join(' + ')}` } : { testo: PARTE, forte: quando(ultimaPartenza) } }
  }
  // Il PRIMO evento in ordine di calendario, un giorno alla volta fino
  // all'ultima partenza, contando anche le notti senza camera: una pausa che
  // viene prima di un cambio camera è la partenza più vicina, non il cambio
  // (difetto riprodotto dalla verifica del 20/09/2026: Ambra 20 → 22, pausa,
  // Lena 24 → 26; oggi 20 → «Parte: 22, torna: 24», non «Prossimo cambio: 24»).
  for (let g = spostaUnGiorno(oggi); g < ultimaPartenza; g = spostaUnGiorno(g)) {
    const c = camereDellaNotte(segmenti, g)
    if (!c.length) {
      const rientro = giorniDopo.find(n => n > g)
      return { sopra, titolo, prossimo: { testo: PARTE, forte: rientro ? `${quando(g)}, ${TORNA.toLowerCase().trim()} ${quando(rientro)}` : quando(g) } }
    }
    if (!stesse(c, oggiCamere)) return { sopra, titolo, prossimo: { testo: PROSSIMO_CAMBIO, forte: `${quando(g)} → ${c.join(' + ')}` } }
  }
  return { sopra, titolo, prossimo: { testo: PARTE, forte: quando(ultimaPartenza) } }
}
function spostaUnGiorno(iso: string): string {
  const p = pezzi(iso)
  return new Date(Date.UTC(p.a, p.m - 1, p.g + 1)).toISOString().slice(0, 10)
}

// ── Il residuo, dalla stessa fonte del conto ────────────────────────────────
export const RESTA_DA_INCASSARE = 'Resta da incassare'
export const SALDATO_TESTA = 'Saldato'
export const BONIFICO_ATTESO = 'Bonifico atteso'
export const CONTO_DA_RILEGGERE = 'Conto da rileggere'
export const SEGNATA_PAGATA_TESTA = 'Segnata come pagata'
export type ResiduoTesta = { etichetta: string; importo: string | null }

/** Etichetta e cifra: la cifra è quella di riepilogoConto; senza conto (lettura
 *  fallita) niente cifra, mai «0 €». Bonifico atteso = accordo bonifico e
 *  niente ancora ricevuto (come lo stato di sempre, lib/schedaPrenotazione).
 *  Col vecchio segno «pagato» senza i movimenti la cifra resta quella vera,
 *  come nel conto. Annullata: nessuna cifra. */
export function residuoTesta(riepilogo: RiepilogoConto | null, bonificoAtteso = false, annullata = false): ResiduoTesta {
  if (annullata) return { etichetta: PRENOTAZIONE_ANNULLATA_TESTA, importo: null }
  if (!riepilogo) return { etichetta: CONTO_DA_RILEGGERE, importo: null }
  if (riepilogo.saldato) return { etichetta: riepilogo.residuoCent > 0 ? SEGNATA_PAGATA_TESTA : SALDATO_TESTA, importo: riepilogo.residuo }
  return { etichetta: bonificoAtteso ? BONIFICO_ATTESO : RESTA_DA_INCASSARE, importo: riepilogo.residuo }
}

export const DA_COMPLETARE_DOCUMENTO = 'Da completare: documento dell’ospite'

// ── Il corpo del nome in cima (Ania, 21/09/2026) ───────────────────────────
// Col doppio nome («Luca Tassone / Massimo Tassone», quando dorme un'altra
// persona) il titolo si allungherebbe su tre righe: qui si sceglie un corpo
// più piccolo man mano che il nome cresce, senza mai toccare i nomi corti,
// che restano grandi come sempre. Due misure: telefono e schermo largo.
export function corpoNomeTesta(nome: string): { classi: string } {
  const lungo = (nome || '').trim().length
  if (lungo <= 20) return { classi: 'text-[25px] min-[700px]:text-[30px]' }
  if (lungo <= 34) return { classi: 'text-[21px] min-[700px]:text-[26px]' }
  return { classi: 'text-[18px] min-[700px]:text-[22px]' }
}
