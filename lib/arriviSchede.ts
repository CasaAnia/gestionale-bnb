// ============================================================================
// LE SCHEDE DEGLI ARRIVI «MAISON» (riferimento approvato da Ania il
// 29/09/2026: docs/design/arrivi-riferimento.html) — la parte pura.
//
// Stesso nastro e stesse schede del Calendario (lib/calendarioSchede), ma la
// scheda parla di ARRIVO:
//   (a) «26 set → 1 ott · 3 notti»             (con «· arrivata» se è passato)
//   (b) «15:30» grande, poi le icone e il nome  («?» in mattone se manca l'ora)
//   (c) «atterra a Malpensa 14:15 · navetta Aldo, prelievo 14:30»
//   (d) vuota
// e il colore dice lo stato dell'arrivo: VERDE tutto a posto (orario in
// struttura e autista), OTTONE arrivo autonomo con l'orario, BLU manca
// qualcosa (autista da assegnare o da definire, oppure l'orario).
//
// I pezzi dell'arrivo (luoghi, ore, autisti) si leggono da lib/arrivo: qui si
// sceglie solo la forma breve su una riga.
// ============================================================================
import {
  AUTISTI, LUOGHI, genereLuogo, navettaRichiesta, oraInStruttura, periodoInStruttura, periodoOre, eFascia,
  type Arrivo,
} from './arrivo.ts'
import { rigaDate, CAMBIO_CAMERA, ORARIO_DA_CHIEDERE } from './calendarioSchede.ts'
import { TINTE_ARRIVO, MATTONE, RIGA_NAVETTA_MANCA, type TintaScheda } from './calendarioMobile.ts'

export type StatoArrivo = 'ok' | 'autonomo' | 'manca'

const pulita = (t: string | null | undefined) => (t ?? '').trim()
const autistaDi = (a: Arrivo) => AUTISTI.find(x => x.chiave === a.navetta)?.nome ?? null

/** C'è l'orario IN STRUTTURA (ora precisa o fascia, anche la stima di Ania)? */
export const haOrario = (a: Arrivo) => !!periodoInStruttura(a)

/**
 * Il colore della scheda. Verde solo con l'orario in struttura E un autista;
 * ottone con l'orario e la navetta «Non richiesta»; blu in tutti gli altri
 * casi (navetta da assegnare o da definire, oppure l'orario che manca).
 */
export function statoArrivo(a: Arrivo): StatoArrivo {
  if (!haOrario(a)) return 'manca'
  if (a.navetta === 'non_richiesta') return 'autonomo'
  if (autistaDi(a)) return 'ok'
  return 'manca'
}

export const ORARIO_MANCANTE = '?'
/** (b) L'ora grande: quella che va in check_in_time («HH:MM»), o «?» */
export const orarioScheda = (a: Arrivo) => oraInStruttura(a) || ORARIO_MANCANTE

/** Fondo, filo e testo della scheda; `dalSito` = richiesta da confermare */
export function tintaArrivo(stato: StatoArrivo, dalSito = false): TintaScheda {
  return dalSito ? TINTE_ARRIVO.dalSito : TINTE_ARRIVO[stato]
}

/** Il colore della riga (c) e del «?»: mattone senza orario, blu scuro sulle
 *  schede blu con l'orario, altrimenti quello della scheda (undefined) */
export function coloreRigaArrivo(a: Arrivo, stato: StatoArrivo): string | undefined {
  if (!haOrario(a)) return MATTONE
  return stato === 'manca' ? RIGA_NAVETTA_MANCA : undefined
}

// ── La riga (c) ─────────────────────────────────────────────────────────────
export const ARRIVO_AUTONOMO = 'arrivo autonomo'
export const ARRIVATA = 'arrivata'

/** Il luogo in breve: il nome della pastiglia («Centrale»), o il testo di «Altro luogo…» */
export function luogoBreve(a: Arrivo): string {
  if (a.tipo !== 'luogo' || !a.luogo) return ''
  if (a.luogo === 'altro') return pulita(a.luogoAltro)
  return LUOGHI.find(l => l.chiave === a.luogo)?.nome ?? ''
}
/** «atterra a Malpensa», «in treno a Rogoredo», «a Villa Rosa» */
function doveBreve(a: Arrivo): string {
  const dove = luogoBreve(a)
  const genere = genereLuogo(a)
  return genere === 'aeroporto' ? `atterra a ${dove}` : genere === 'stazione' ? `in treno a ${dove}` : `a ${dove}`
}
/** «navetta Aldo, prelievo 14:30» (col luogo se la riga non l'ha già detto), «navetta da assegnare», «arrivo autonomo» */
function navettaBreve(a: Arrivo, luogoGiaDetto: boolean): string {
  const ora = pulita(a.prelievo)
  const dove = luogoBreve(a)
  const prelievo = navettaRichiesta(a.navetta) && ora ? `, prelievo ${ora}${!luogoGiaDetto && dove ? ` a ${dove}` : ''}` : ''
  const autista = autistaDi(a)
  if (autista) return `navetta ${autista}${prelievo}`
  if (a.navetta === 'da_assegnare') return `navetta da assegnare${prelievo}`
  if (a.navetta === 'da_definire') return 'navetta da definire'
  return ARRIVO_AUTONOMO
}

/**
 * (c) L'arrivo in forma breve, su una riga. Sul tratto che arriva da un
 * cambio camera: «cambio camera · da Ambra»; su quello che parte, in coda,
 * «· poi Lena».
 */
export function rigaArrivoArrivi(a: Arrivo, cambio: { poi?: string | null; da?: string | null } = {}): string {
  if (cambio.da) return `${CAMBIO_CAMERA} · da ${cambio.da}`
  const parti: string[] = []
  const inStruttura = periodoInStruttura(a)
  const conNavetta = a.navetta !== 'da_definire'
  if (a.tipo === 'luogo' && luogoBreve(a)) {
    const oraLuogo = periodoOre(pulita(a.luogoDa), a.modoLuogo === 'fascia' ? pulita(a.luogoA) : '')
    if (oraLuogo) {
      parti.push(`${doveBreve(a)} ${oraLuogo}`, navettaBreve(a, true))
    } else if (inStruttura) {
      // niente ora al luogo, ma la stima di Ania: il luogo lo dice il prelievo, se c'è
      const prelievoConLuogo = navettaRichiesta(a.navetta) && !!pulita(a.prelievo)
      parti.push(`in struttura ${inStruttura} circa`)
      if (!prelievoConLuogo) parti.push(doveBreve(a))
      parti.push(navettaBreve(a, !prelievoConLuogo))
    } else {
      parti.push(doveBreve(a), ORARIO_DA_CHIEDERE, navettaBreve(a, true))
    }
  } else if (inStruttura) {
    // l'ora grande dice già l'inizio: la fascia intera solo quando è una fascia
    const [da, fine] = a.tipo === 'struttura' ? [a.strutturaDa, a.modoStruttura === 'fascia' ? a.strutturaA : ''] : [a.stimaDa, a.stimaA]
    if (eFascia(da, fine)) parti.push(`in struttura ${inStruttura}${a.tipo === 'luogo' ? ' circa' : ''}`)
    parti.push(navettaBreve(a, true))
  } else {
    parti.push(ORARIO_DA_CHIEDERE)
    if (conNavetta) parti.push(navettaBreve(a, true))
  }
  if (cambio.poi) parti.push(`poi ${cambio.poi}`)
  return parti.join(' · ')
}

/** Arrivo già avvenuto: il check-in è prima di oggi */
export const arrivoPassato = (checkIn: string, oggi: string) => checkIn < oggi

/** (a) «26 set → 1 ott · 3 notti», con «· dal sito 🌐» o «· arrivata» */
export function rigaDateArrivi(checkIn: string, checkOut: string, s: { dalSito?: boolean; passato?: boolean } = {}): string {
  const base = rigaDate(checkIn, checkOut, s.dalSito ? 'dalSito' : null)
  return s.passato ? `${base} · ${ARRIVATA}` : base
}

/**
 * Il primo tratto di una catena di cambio camera: il tratto che arriva prende
 * il colore di quello che parte, perché l'arrivo è uno solo. `archi` sono gli
 * spostamenti di lib/roomChanges (da → a).
 */
export function primoTratto(id: string, archi: { fromId: string; toId: string }[]): string {
  const da = new Map(archi.map(e => [e.toId, e.fromId]))
  const visti = new Set<string>([id])
  let corrente = id
  while (da.has(corrente)) {
    const prima = da.get(corrente)!
    if (visti.has(prima)) break   // una catena storta non fa girare in tondo
    visti.add(prima)
    corrente = prima
  }
  return corrente
}
