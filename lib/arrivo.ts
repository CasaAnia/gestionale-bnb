// ============================================================================
// ARRIVO E NAVETTA (21/09/2026, proposta visiva approvata da Ania).
//
// IL PROBLEMA CHE RISOLVE. Prima c'era un orario solo, `check_in_time`, e
// voleva dire tutto e niente: «15:00» poteva essere l'ora in cui la cliente
// atterra a Linate oppure l'ora in cui suona il campanello. «Linate alle
// 15:00» NON vuol dire «in struttura alle 15:00»: fra le due cose ci sono
// un'ora di strada e una navetta da mandare. Da qui in avanti i tre
// significati stanno in tre posti diversi e non si mescolano mai:
//   - dove arriva      (in struttura · a un luogo · da definire)
//   - a che ora, lì    (ora precisa oppure fascia indicativa, di QUEL luogo)
//   - quando in casa   (una stima di Ania, facoltativa, sempre una fascia)
// La stima la scrive Ania a mano: qui dentro non si calcolano tragitti,
// traffico, meteo o tempi aeroportuali, e non si chiama nessun servizio.
//
// LA NAVETTA ha sette stati, e tre significati che prima si confondevano:
// «Non richiesta» (decisa: non serve), «Da definire» (non si sa ancora se
// serve), «Da assegnare» (serve, l'autista non è ancora scelto) e i quattro
// autisti. Prima «sì / no / ?» non sapeva dire la differenza fra le ultime due.
//
// LE COLONNE. Le nuove stanno nella proposta
// `supabase/proposte/0058_arrivo_e_navetta.BOZZA.sql`, da incollare a mano
// nell'editor SQL. Finché non è applicata il gestionale funziona lo stesso:
// `leggiArrivo` ricostruisce l'arrivo dalle due colonne di sempre
// (`check_in_time`, `shuttle`) e `campiArrivoVecchi` sa scrivere solo quelle.
// Le due colonne di sempre restano SEMPRE aggiornate, come specchio, così
// tutto quello che già le legge (Home, Arrivi, pulizie, notifiche, storico)
// continua a dire il vero: `check_in_time` è, e resta, l'ora IN STRUTTURA —
// quando è solo una stima si scrive l'inizio della fascia, quando non si sa
// resta vuota. Mai l'ora di Linate: quella confusione è il difetto di partenza.
//
// Qui dentro non c'è nessuna veste: solo il modello, i controlli e le parole.
// Le tre superfici del riferimento leggono da qui (`pianoModuloArrivo` per
// l'inserimento, `arrivoInScheda` per la scheda, `arrivoInHome` per la Home).
// ============================================================================
import { oraCompleta } from './ora.ts'

// ── Il vocabolario ──────────────────────────────────────────────────────────

export type TipoArrivo = 'struttura' | 'luogo' | 'da_definire'

/** I tre tipi, nell'ordine del riferimento */
export const TIPI_ARRIVO = [
  { chiave: 'struttura', nome: 'In struttura' },
  { chiave: 'luogo', nome: 'Arrivo a…' },
  { chiave: 'da_definire', nome: 'Da definire' },
] as const

export type ChiaveLuogo = 'linate' | 'rogoredo' | 'centrale' | 'malpensa' | 'orio_al_serio' | 'san_donato' | 'altro'
export type GenereLuogo = 'aeroporto' | 'stazione' | 'altro'

/** I luoghi NELL'ORDINE ESATTO chiesto da Ania. «Bergamo» non esiste: si
 *  chiama Orio al Serio. `dentro` è il nome dentro una frase: nelle
 *  pastiglie la voce è «Centrale» (come l'ha chiesta Ania), ma «arriva a
 *  Centrale» in italiano zoppica, e nelle frasi diventa «Milano Centrale». */
export const LUOGHI = [
  { chiave: 'linate', nome: 'Linate', dentro: 'Linate', genere: 'aeroporto' },
  { chiave: 'rogoredo', nome: 'Rogoredo', dentro: 'Rogoredo', genere: 'stazione' },
  { chiave: 'centrale', nome: 'Centrale', dentro: 'Milano Centrale', genere: 'stazione' },
  { chiave: 'malpensa', nome: 'Malpensa', dentro: 'Malpensa', genere: 'aeroporto' },
  { chiave: 'orio_al_serio', nome: 'Orio al Serio', dentro: 'Orio al Serio', genere: 'aeroporto' },
  { chiave: 'san_donato', nome: 'San Donato', dentro: 'San Donato', genere: 'stazione' },
  { chiave: 'altro', nome: 'Altro luogo…', dentro: '', genere: 'altro' },
] as const

export type Navetta =
  | 'non_richiesta' | 'da_definire' | 'da_assegnare'
  | 'massimo' | 'aldo' | 'alberto' | 'matteo'

/** Le tre voci della navetta e i quattro autisti: scelte MUTUAMENTE
 *  ESCLUSIVE, divise in due file solo perché così le ha disegnate il
 *  riferimento. Sceglierne una spegne tutte le altre. */
export const NAVETTE = [
  { chiave: 'non_richiesta', nome: 'Non richiesta' },
  { chiave: 'da_definire', nome: 'Da definire' },
  { chiave: 'da_assegnare', nome: 'Da assegnare' },
] as const
export const AUTISTI = [
  { chiave: 'massimo', nome: 'Massimo' },
  { chiave: 'aldo', nome: 'Aldo' },
  { chiave: 'alberto', nome: 'Alberto' },
  { chiave: 'matteo', nome: 'Matteo' },
] as const

export type ModoOrario = 'precisa' | 'fascia'

/** Lo stato dell'arrivo, uno per prenotazione. Le ore sono «HH:MM» o ''. */
export type Arrivo = {
  tipo: TipoArrivo
  /** solo con tipo 'luogo' */
  luogo: ChiaveLuogo | null
  /** il testo libero di «Altro luogo…» */
  luogoAltro: string
  /** 'precisa' = una sola ora; 'fascia' = da/a */
  modo: ModoOrario
  /** l'ora al LUOGO (o in struttura, se il tipo è 'struttura') */
  oraDa: string
  /** la fine della fascia; vuota con l'ora precisa */
  oraA: string
  /** la stima facoltativa dell'arrivo IN STRUTTURA, solo con tipo 'luogo' */
  strutturaDa: string
  strutturaA: string
  navetta: Navetta
  /** l'ora del prelievo, facoltativa */
  prelievo: string
}

export const ARRIVO_VUOTO: Arrivo = {
  tipo: 'da_definire', luogo: null, luogoAltro: '', modo: 'precisa',
  oraDa: '', oraA: '', strutturaDa: '', strutturaA: '',
  navetta: 'da_definire', prelievo: '',
}

const luogoDi = (c: ChiaveLuogo | null) => LUOGHI.find(l => l.chiave === c) ?? null
const nomeAutista = (n: Navetta) => AUTISTI.find(a => a.chiave === n)?.nome ?? null

/** La navetta è richiesta davvero? «Da definire» non lo sa ancora: non è un sì. */
export function navettaRichiesta(n: Navetta): boolean {
  return n === 'da_assegnare' || !!nomeAutista(n)
}

/** Il nome del luogo dentro una frase: «Milano Centrale», o il testo libero. */
export function nomeLuogo(a: Arrivo): string {
  if (a.tipo !== 'luogo' || !a.luogo) return ''
  if (a.luogo === 'altro') return a.luogoAltro.trim()
  return luogoDi(a.luogo)?.dentro ?? ''
}
export function genereLuogo(a: Arrivo): GenereLuogo | null {
  return a.tipo === 'luogo' && a.luogo ? (luogoDi(a.luogo)?.genere ?? null) : null
}

// ── Le ore ──────────────────────────────────────────────────────────────────

const pulita = (t: string | null | undefined) => (t ?? '').trim()
/** «16:00–17:00» (trattino lungo), «16:00» da sola, '' se non si sa niente.
 *  Due ore uguali non sono una fascia: è un'ora sola. */
export function periodoOre(da: string, a: string): string {
  const d = pulita(da), f = pulita(a)
  if (d && f && d !== f) return `${d}–${f}`
  return d || f
}
/** Vero quando è davvero un intervallo: due ore diverse. */
export function eFascia(da: string, a: string): boolean {
  const d = pulita(da), f = pulita(a)
  return !!d && !!f && d !== f
}
/** L'ora in struttura, se si sa: è quella che va in `check_in_time`.
 *  Con un luogo esterno vale SOLO la stima di Ania — mai l'ora del luogo. */
export function oraInStruttura(a: Arrivo): string {
  if (a.tipo === 'struttura') return pulita(a.oraDa) || pulita(a.oraA)
  if (a.tipo === 'luogo') return pulita(a.strutturaDa) || pulita(a.strutturaA)
  return ''
}
/** L'arrivo in struttura, per esteso: «16:00–17:00» o «16:00» o ''. */
export function periodoInStruttura(a: Arrivo): string {
  if (a.tipo === 'struttura') return periodoOre(a.oraDa, a.oraA)
  if (a.tipo === 'luogo') return periodoOre(a.strutturaDa, a.strutturaA)
  return ''
}
/** L'ora in struttura è una stima o una fascia? Allora si dice «circa». */
export function circaInStruttura(a: Arrivo): boolean {
  if (!periodoInStruttura(a)) return false
  if (a.tipo === 'luogo') return true                      // una stima è sempre «circa»
  return eFascia(a.oraDa, a.oraA)
}

/** Non si sa NIENTE dell'orario: né in struttura, né al luogo dove arriva.
 *  È questo che «manca l'orario» deve voler dire: se sappiamo «Linate alle
 *  15:00» un orario ce l'abbiamo, e la stima in struttura resta facoltativa
 *  (Ania, 21/09/2026). Serve a «Da controllare» e al promemoria delle 17. */
export function orarioIgnoto(a: Arrivo): boolean {
  return !periodoInStruttura(a) && !periodoOre(a.oraDa, a.oraA)
}

// ── Leggere e scrivere ──────────────────────────────────────────────────────

type RigaPrenotazione = Record<string, unknown> | null | undefined

/** Le colonne della proposta 0058. Se non ci sono, l'arrivo si ricostruisce
 *  dalle due di sempre e il gestionale non se ne accorge. */
export const COLONNE_0058 = [
  'arrivo_tipo', 'arrivo_luogo', 'arrivo_luogo_altro', 'arrivo_ora_da', 'arrivo_ora_a',
  'arrivo_struttura_da', 'arrivo_struttura_a', 'navetta', 'navetta_prelievo',
] as const

/** La 0058 è applicata su questa riga? (basta una colonna nuova presente) */
export function haColonne0058(b: RigaPrenotazione): boolean {
  return !!b && 'arrivo_tipo' in b
}

const testo = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const unaDi = <T extends string>(v: unknown, valide: readonly T[]): T | null => {
  const t = testo(v)
  return (valide as readonly string[]).includes(t) ? (t as T) : null
}

/** L'arrivo di una prenotazione. Con le colonne nuove le legge; senza (o
 *  quando la prenotazione è più vecchia della migrazione) lo ricostruisce
 *  dalle due di sempre: un `check_in_time` scritto prima voleva dire «in
 *  struttura a quell'ora», ed è così che si continua a leggerlo. */
export function leggiArrivo(b: RigaPrenotazione): Arrivo {
  const riga = b ?? {}
  const oraVecchia = testo(riga.check_in_time)
  const shuttle = testo(riga.shuttle)
  const navettaVecchia: Navetta = shuttle === 'si' ? 'da_assegnare' : shuttle === 'no' ? 'non_richiesta' : 'da_definire'

  const tipo = unaDi<TipoArrivo>(riga.arrivo_tipo, ['struttura', 'luogo', 'da_definire'])
  if (!tipo) {
    return {
      ...ARRIVO_VUOTO,
      tipo: oraVecchia ? 'struttura' : 'da_definire',
      oraDa: oraVecchia,
      navetta: navettaVecchia,
    }
  }
  const oraDa = testo(riga.arrivo_ora_da)
  const oraA = testo(riga.arrivo_ora_a)
  return {
    tipo,
    luogo: tipo === 'luogo' ? unaDi<ChiaveLuogo>(riga.arrivo_luogo, LUOGHI.map(l => l.chiave)) : null,
    luogoAltro: tipo === 'luogo' ? testo(riga.arrivo_luogo_altro) : '',
    modo: eFascia(oraDa, oraA) ? 'fascia' : 'precisa',
    oraDa: tipo === 'da_definire' ? '' : oraDa,
    oraA: tipo === 'da_definire' ? '' : oraA,
    strutturaDa: tipo === 'luogo' ? testo(riga.arrivo_struttura_da) : '',
    strutturaA: tipo === 'luogo' ? testo(riga.arrivo_struttura_a) : '',
    navetta: unaDi<Navetta>(riga.navetta, [...NAVETTE.map(n => n.chiave), ...AUTISTI.map(a => a.chiave)]) ?? navettaVecchia,
    prelievo: testo(riga.navetta_prelievo),
  }
}

/** Le due colonne di sempre, tenute vere: `check_in_time` è l'ora IN
 *  STRUTTURA (mai quella del luogo esterno) e `shuttle` dice solo se la
 *  navetta serve. È quello che leggono Home, Arrivi, pulizie e notifiche. */
export function campiArrivoVecchi(a: Arrivo): { check_in_time: string | null; shuttle: string | null } {
  return {
    check_in_time: oraInStruttura(a) || null,
    shuttle: a.navetta === 'non_richiesta' ? 'no' : navettaRichiesta(a.navetta) ? 'si' : null,
  }
}

/** Tutto quello che si salva: le colonne nuove PIÙ lo specchio di sempre. */
export function campiArrivo(a: Arrivo): Record<string, string | null> {
  const n = normalizza(a)
  return {
    ...campiArrivoVecchi(n),
    arrivo_tipo: n.tipo,
    arrivo_luogo: n.tipo === 'luogo' ? n.luogo : null,
    arrivo_luogo_altro: n.tipo === 'luogo' && n.luogo === 'altro' ? (n.luogoAltro.trim() || null) : null,
    arrivo_ora_da: n.oraDa || null,
    arrivo_ora_a: n.oraA || null,
    arrivo_struttura_da: n.strutturaDa || null,
    arrivo_struttura_a: n.strutturaA || null,
    navetta: n.navetta,
    navetta_prelievo: navettaRichiesta(n.navetta) ? (n.prelievo || null) : null,
  }
}

/** Ripulisce quello che il tipo scelto non prevede, così non resta in giro
 *  un'ora orfana che poi qualcuno rilegge col significato sbagliato. */
export function normalizza(a: Arrivo): Arrivo {
  const n: Arrivo = { ...a }
  if (n.tipo === 'da_definire') { n.oraDa = ''; n.oraA = '' }
  if (n.tipo !== 'luogo') { n.luogo = null; n.luogoAltro = ''; n.strutturaDa = ''; n.strutturaA = '' }
  if (n.luogo !== 'altro') n.luogoAltro = ''
  if (n.modo === 'precisa') n.oraA = ''
  if (!navettaRichiesta(n.navetta)) n.prelievo = ''
  if (!eFascia(n.oraDa, n.oraA)) n.modo = n.modo === 'fascia' && n.oraDa === '' ? 'fascia' : n.modo
  return n
}

// ── Cambiare idea senza cambiare significato ────────────────────────────────

/** Cambiando tipo, le ore già scritte NON restano al loro posto con un
 *  significato nuovo: passando da «Arrivo a Linate» a «In struttura», l'ora
 *  che vale è la stima in struttura, non quella di Linate; e viceversa l'ora
 *  in struttura diventa la stima. È il cuore del difetto che stiamo
 *  chiudendo: «Linate alle 15:00» non deve mai diventare «in casa alle 15:00». */
export function cambiaTipo(a: Arrivo, tipo: TipoArrivo): Arrivo {
  if (a.tipo === tipo) return a
  if (tipo === 'struttura') {
    const da = a.tipo === 'luogo' ? a.strutturaDa : ''
    const fine = a.tipo === 'luogo' ? a.strutturaA : ''
    return normalizza({ ...a, tipo, luogo: null, luogoAltro: '', strutturaDa: '', strutturaA: '', oraDa: da, oraA: fine, modo: eFascia(da, fine) ? 'fascia' : 'precisa' })
  }
  if (tipo === 'luogo') {
    const da = a.tipo === 'struttura' ? a.oraDa : ''
    const fine = a.tipo === 'struttura' ? a.oraA : ''
    return normalizza({ ...a, tipo, oraDa: '', oraA: '', modo: 'precisa', strutturaDa: da, strutturaA: fine })
  }
  // «Da definire» non inventa nessun orario: niente mezzanotte automatica.
  return normalizza({ ...a, tipo: 'da_definire', luogo: null, luogoAltro: '', oraDa: '', oraA: '', strutturaDa: '', strutturaA: '', modo: 'precisa' })
}

/** «Ora precisa» / «Fascia oraria»: la fascia parte dall'ora già scritta. */
export function cambiaModo(a: Arrivo, modo: ModoOrario): Arrivo {
  return modo === 'precisa' ? { ...a, modo, oraA: '' } : { ...a, modo }
}

export function cambiaNavetta(a: Arrivo, navetta: Navetta): Arrivo {
  return normalizza({ ...a, navetta })
}

// ── I controlli ─────────────────────────────────────────────────────────────

export const ERRORE_ORA = 'L’orario si scrive con quattro cifre, per esempio 1830 diventa 18:30. Lascia vuoto se non lo sai ancora.'
export const ERRORE_LUOGO = 'Scegli il luogo dell’arrivo.'
export const ERRORE_LUOGO_ALTRO = 'Scrivi qual è il luogo dell’arrivo.'
export const ERRORE_FASCIA = 'La fine della fascia viene prima dell’inizio.'
export const ERRORE_FASCIA_STRUTTURA = 'La fine della stima in struttura viene prima dell’inizio.'

/** Il primo problema da far leggere ad Ania, o null se va tutto bene. */
export function controllaArrivo(a: Arrivo): string | null {
  const ore = [a.oraDa, a.oraA, a.strutturaDa, a.strutturaA, a.prelievo].map(pulita)
  if (ore.some(o => o && !oraCompleta(o))) return ERRORE_ORA
  if (a.tipo === 'luogo') {
    if (!a.luogo) return ERRORE_LUOGO
    if (a.luogo === 'altro' && !a.luogoAltro.trim()) return ERRORE_LUOGO_ALTRO
  }
  if (eFascia(a.oraDa, a.oraA) && pulita(a.oraA) < pulita(a.oraDa)) return ERRORE_FASCIA
  if (eFascia(a.strutturaDa, a.strutturaA) && pulita(a.strutturaA) < pulita(a.strutturaDa)) return ERRORE_FASCIA_STRUTTURA
  return null
}

// ── 1. L'inserimento: quali gruppi si vedono ────────────────────────────────

export const TITOLO_ARRIVO = 'Arrivo e navetta'
export const SOTTOTITOLO_ARRIVO = 'Inserisci i dettagli dell’arrivo dell’ospite'
export const ETICHETTA_TIPO = 'Tipo di arrivo'
export const ETICHETTA_LUOGO = 'Luogo'
export const ETICHETTA_ORARIO = 'Orario'
export const ETICHETTA_STIMA = 'In struttura · stima facoltativa'
export const AIUTO_STIMA = 'Una tua stima, modificabile'
export const ETICHETTA_NAVETTA = 'Navetta'
export const ETICHETTA_AUTISTA = 'Autista'
export const ETICHETTA_PRELIEVO = 'Prelievo · facoltativo'
export const ETICHETTA_LUOGO_ALTRO = 'Qual è il luogo'

export const MODI_ORARIO = [
  { chiave: 'precisa', nome: 'Ora precisa' },
  { chiave: 'fascia', nome: 'Fascia oraria' },
] as const

export type Scelta = { chiave: string; nome: string; acceso: boolean }
export type PianoModulo = {
  tipo: Scelta[]
  /** null quando il tipo non è «Arrivo a…» */
  luogo: Scelta[] | null
  /** il campo libero di «Altro luogo…» */
  luogoAltro: boolean
  /** null con «Da definire»: non si chiede un orario che non c'è */
  orario: Scelta[] | null
  /** quante caselle d'ora: 1 con l'ora precisa, 2 con la fascia */
  caselleOrario: 0 | 1 | 2
  /** la stima in struttura si chiede solo per un luogo esterno */
  stima: boolean
  navetta: Scelta[]
  autista: Scelta[]
  /** il prelievo si chiede solo se la navetta serve davvero */
  prelievo: boolean
}

/** Cosa mostra il modulo, dato lo stato: solo la struttura, nessuna veste. */
export function pianoModuloArrivo(a: Arrivo): PianoModulo {
  const conLuogo = a.tipo === 'luogo'
  return {
    tipo: TIPI_ARRIVO.map(t => ({ chiave: t.chiave, nome: t.nome, acceso: a.tipo === t.chiave })),
    luogo: conLuogo ? LUOGHI.map(l => ({ chiave: l.chiave, nome: l.nome, acceso: a.luogo === l.chiave })) : null,
    luogoAltro: conLuogo && a.luogo === 'altro',
    orario: a.tipo === 'da_definire' ? null : MODI_ORARIO.map(m => ({ chiave: m.chiave, nome: m.nome, acceso: a.modo === m.chiave })),
    caselleOrario: a.tipo === 'da_definire' ? 0 : a.modo === 'fascia' ? 2 : 1,
    stima: conLuogo,
    navetta: NAVETTE.map(n => ({ chiave: n.chiave, nome: n.nome, acceso: a.navetta === n.chiave })),
    autista: AUTISTI.map(n => ({ chiave: n.chiave, nome: n.nome, acceso: a.navetta === n.chiave })),
    prelievo: navettaRichiesta(a.navetta),
  }
}

// ── 2. La scheda della prenotazione ─────────────────────────────────────────

export type VoceArrivo = { titolo: string; sotto: string | null }

export const ARRIVO_DA_DEFINIRE = 'Arrivo da definire'
export const IN_STRUTTURA_DA_DEFINIRE = 'In struttura · orario da definire'
export const ORARIO_STRUTTURA_DA_DEFINIRE = 'Orario in struttura da definire'
export const NAVETTA_DA_CHIEDERE = 'Da chiedere all’ospite'
export const AUTISTA_DA_SCEGLIERE = 'Autista ancora da scegliere'

/** «Arriva a Linate alle 15:00» · «Arriva a Milano Centrale circa 15:00–16:00» */
export function rigaLuogo(a: Arrivo): string | null {
  const dove = nomeLuogo(a)
  if (!dove) return null
  const quando = periodoOre(a.oraDa, a.oraA)
  if (!quando) return `Arriva a ${dove} · orario da definire`
  return `Arriva a ${dove} ${eFascia(a.oraDa, a.oraA) ? 'circa' : 'alle'} ${quando}`
}

/** «In struttura circa 16:00–17:00» con sotto «Arriva a Linate alle 15:00» */
export function arrivoInScheda(a: Arrivo): VoceArrivo {
  if (a.tipo === 'da_definire') return { titolo: ARRIVO_DA_DEFINIRE, sotto: null }
  const inStruttura = periodoInStruttura(a)
  const titoloStruttura = inStruttura
    ? `In struttura ${circaInStruttura(a) ? 'circa' : 'alle'} ${inStruttura}`
    : null
  if (a.tipo === 'struttura') return { titolo: titoloStruttura ?? IN_STRUTTURA_DA_DEFINIRE, sotto: null }
  const luogo = rigaLuogo(a)
  if (!luogo) return { titolo: titoloStruttura ?? ARRIVO_DA_DEFINIRE, sotto: null }
  return titoloStruttura
    ? { titolo: titoloStruttura, sotto: luogo }
    : { titolo: luogo, sotto: ORARIO_STRUTTURA_DA_DEFINIRE }
}

/** «Prelievo a Linate · 15:30» — quello che sa la navetta, e solo quello. */
export function rigaPrelievo(a: Arrivo): string | null {
  if (!navettaRichiesta(a.navetta)) return null
  const dove = nomeLuogo(a)
  const quando = pulita(a.prelievo)
  if (dove && quando) return `Prelievo a ${dove} · ${quando}`
  if (dove) return `Prelievo a ${dove}`
  if (quando) return `Prelievo alle ${quando}`
  return null
}

/** «Massimo» con sotto «Prelievo a Linate · 15:30» */
export function navettaInScheda(a: Arrivo): VoceArrivo {
  const autista = nomeAutista(a.navetta)
  if (autista) return { titolo: autista, sotto: rigaPrelievo(a) }
  if (a.navetta === 'da_assegnare') return { titolo: 'Da assegnare', sotto: rigaPrelievo(a) ?? AUTISTA_DA_SCEGLIERE }
  if (a.navetta === 'da_definire') return { titolo: 'Da definire', sotto: NAVETTA_DA_CHIEDERE }
  return { titolo: 'Non richiesta', sotto: null }
}

// ── 3. Gli Arrivi della Home ────────────────────────────────────────────────

export type IconaArrivo = 'aereo' | 'treno' | 'luogo' | 'auto'
export type RigaHome = { icona: IconaArrivo; forte: string; sotto: string }
export type ArrivoHome = {
  /** «16:00–17:00», «16:00» oppure «Da definire» */
  grande: string
  /** l'orario c'è davvero: si scrive coi numeri grandi */
  numerico: boolean
  /** accanto ai numeri: «circa» quando è una stima o una fascia */
  circa: boolean
  sotto: string
  righe: RigaHome[]
}

export const HOME_ARRIVO_PREVISTO = 'Arrivo previsto in struttura'
export const HOME_ARRIVO_IN_STRUTTURA = 'Arrivo in struttura'
export const HOME_ORARIO_DA_DEFINIRE = 'Orario in struttura da definire'
export const HOME_DA_DEFINIRE = 'Da definire'
export const HOME_NAVETTA_IN_STRUTTURA = 'Navetta in struttura'
export const HOME_NAVETTA_DA_DEFINIRE = 'Navetta da definire'
export const HOME_AUTISTA_DA_ASSEGNARE = 'Autista da assegnare'

const SOTTO_LUOGO: Record<GenereLuogo, string> = {
  aeroporto: 'Arrivo in aeroporto',
  stazione: 'Arrivo in stazione',
  altro: 'Arrivo sul posto',
}
const ICONA_LUOGO: Record<GenereLuogo, IconaArrivo> = { aeroporto: 'aereo', stazione: 'treno', altro: 'luogo' }

/** Il riquadro «Arrivi di oggi»: l'ora in struttura grande, e sotto le due
 *  righe che spiegano da dove arriva e chi la va a prendere. */
export function arrivoInHome(a: Arrivo): ArrivoHome {
  const inStruttura = periodoInStruttura(a)
  const righe: RigaHome[] = []

  const dove = nomeLuogo(a)
  const genere = genereLuogo(a)
  if (dove && genere) {
    const quando = periodoOre(a.oraDa, a.oraA)
    righe.push({ icona: ICONA_LUOGO[genere], forte: quando ? `${dove} · ${quando}` : dove, sotto: SOTTO_LUOGO[genere] })
  }

  const autista = nomeAutista(a.navetta)
  const prelievo = pulita(a.prelievo)
  if (autista || a.navetta === 'da_assegnare') {
    const nome = autista ?? HOME_AUTISTA_DA_ASSEGNARE
    righe.push({ icona: 'auto', forte: prelievo ? `${nome} · prelievo ${prelievo}` : nome, sotto: HOME_NAVETTA_IN_STRUTTURA })
  } else if (a.navetta === 'da_definire') {
    righe.push({ icona: 'auto', forte: HOME_NAVETTA_DA_DEFINIRE, sotto: NAVETTA_DA_CHIEDERE })
  }
  // «Non richiesta» non occupa una riga: è una decisione presa, non un promemoria.

  return {
    grande: inStruttura || HOME_DA_DEFINIRE,
    numerico: !!inStruttura,
    circa: circaInStruttura(a),
    sotto: !inStruttura ? HOME_ORARIO_DA_DEFINIRE : a.tipo === 'luogo' ? HOME_ARRIVO_PREVISTO : HOME_ARRIVO_IN_STRUTTURA,
    righe,
  }
}
