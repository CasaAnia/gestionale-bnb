// ============================================================================
// IL PERIODO DI REGISTRO E STATISTICHE DELLE PULIZIE (riferimento approvato da
// Ania il 01/10/2026): «‹ SETT. | MESE | DAL–AL ›», predefinito il mese
// corrente. Regole scritte qui una volta sola (integrazione di Ania, punto 5):
//   - i giorni sono INCLUSI: dal 1 al 30 settembre sono 30 giorni;
//   - settimana = da lunedì a domenica; mese = dal primo all'ultimo giorno;
//     dal–al = le due date scelte;
//   - PERIODO IN CORSO: si contano solo i giorni fino a oggi compreso (il
//     resto del mese non è ancora successo). Le medie a settimana / mese /
//     anno si fanno su questi giorni, non sul mese intero;
//   - CONFRONTO col periodo uguale precedente, con lo stesso numero di giorni
//     contati: il mese prima (se il mese è in corso, gli stessi giorni del
//     mese prima: 1–5 ottobre contro 1–5 settembre), la settimana prima, o
//     per il dal–al i giorni subito prima, tanti quanti.
// Funzioni pure, provate con node --test.
// ============================================================================
import { MESI_BREVI, MESI_LUNGHI } from './dateItaliane.ts'

export type ModoPeriodo = 'sett' | 'mese' | 'dal_al'
export type Periodo = { modo: ModoPeriodo; dal: string; al: string }

const g = (iso: string) => Date.parse(`${iso}T12:00:00Z`)
export const spostaGiorni = (iso: string, n: number) => new Date(g(iso) + n * 86400000).toISOString().slice(0, 10)
export const giorniFra = (dal: string, al: string) => Math.round((g(al) - g(dal)) / 86400000) + 1
const fineMese = (iso: string) => { const [y, m] = iso.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10) }
const inizioMese = (iso: string) => `${iso.slice(0, 7)}-01`
function spostaMesi(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1 + n, 1))
  const ultimo = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate()
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`
}
const lunedi = (iso: string) => spostaGiorni(iso, -((new Date(g(iso)).getUTCDay() + 6) % 7))

export function periodoIniziale(oggi: string, modo: ModoPeriodo = 'mese'): Periodo {
  if (modo === 'sett') { const l = lunedi(oggi); return { modo, dal: l, al: spostaGiorni(l, 6) } }
  if (modo === 'mese') return { modo, dal: inizioMese(oggi), al: fineMese(oggi) }
  // dal–al proposto: gli ultimi tre mesi interi
  const al = fineMese(spostaMesi(oggi, -1))
  return { modo, dal: inizioMese(spostaMesi(oggi, -3)), al }
}

/** Le frecce: una settimana, un mese, o il periodo tanti giorni quanti. */
export function sposta(p: Periodo, verso: 1 | -1): Periodo {
  if (p.modo === 'sett') return { ...p, dal: spostaGiorni(p.dal, 7 * verso), al: spostaGiorni(p.al, 7 * verso) }
  if (p.modo === 'mese') { const dal = inizioMese(spostaMesi(p.dal, verso)); return { ...p, dal, al: fineMese(dal) } }
  if (mesiInteri(p)) { const k = mesiInteri(p)!; const dal = inizioMese(spostaMesi(p.dal, k * verso)); return { ...p, dal, al: fineMese(spostaMesi(dal, k - 1)) } }
  const n = giorniFra(p.dal, p.al)
  return { ...p, dal: spostaGiorni(p.dal, n * verso), al: spostaGiorni(p.al, n * verso) }
}

/** Quanti mesi interi copre (dal primo all'ultimo giorno), o null */
export function mesiInteri(p: Pick<Periodo, 'dal' | 'al'>): number | null {
  if (p.dal !== inizioMese(p.dal) || p.al !== fineMese(p.al) || p.al < p.dal) return null
  const [y1, m1] = p.dal.split('-').map(Number), [y2, m2] = p.al.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1) + 1
}

/** I giorni che contano davvero: fino a oggi compreso. null se tutto nel futuro. */
export function giorniContati(p: Pick<Periodo, 'dal' | 'al'>, oggi: string): { dal: string; al: string; giorni: number } | null {
  if (p.dal > oggi) return null
  const al = p.al > oggi ? oggi : p.al
  return { dal: p.dal, al, giorni: giorniFra(p.dal, al) }
}

/** Il periodo uguale precedente, con lo stesso numero di giorni contati. */
export function precedente(p: Periodo, oggi: string): { dal: string; al: string } | null {
  const c = giorniContati(p, oggi)
  if (!c) return null
  if (p.modo === 'mese') { const dal = inizioMese(spostaMesi(p.dal, -1)); return { dal, al: spostaGiorni(dal, c.giorni - 1) > fineMese(dal) ? fineMese(dal) : spostaGiorni(dal, c.giorni - 1) } }
  if (p.modo === 'sett') return { dal: spostaGiorni(c.dal, -7), al: spostaGiorni(c.al, -7) }
  const k = mesiInteri(p)
  if (k && c.al === p.al) { const dal = inizioMese(spostaMesi(p.dal, -k)); return { dal, al: fineMese(spostaMesi(dal, k - 1)) } }
  return { dal: spostaGiorni(c.dal, -c.giorni), al: spostaGiorni(c.dal, -1) }
}

const NUMERI = ['', 'un', 'due', 'tre', 'quattro', 'cinque', 'sei', 'sette', 'otto', 'nove', 'dieci', 'undici', 'dodici']
const aMese = (m: number) => `${/^[aeiou]/.test(MESI_LUNGHI[m - 1]) ? 'ad' : 'a'} ${MESI_LUNGHI[m - 1]}`
/** «rispetto ad agosto», «rispetto agli stessi giorni di settembre», «rispetto alla settimana prima», «rispetto ai tre mesi prima», «rispetto ai 20 giorni prima» */
export function testoConfronto(p: Periodo, oggi: string): string {
  const c = giorniContati(p, oggi)
  if (p.modo === 'mese') {
    const m = Number(spostaMesi(p.dal, -1).slice(5, 7))
    return c && c.al < p.al ? `rispetto agli stessi giorni di ${MESI_LUNGHI[m - 1]}` : `rispetto ${aMese(m)}`
  }
  if (p.modo === 'sett') return 'rispetto alla settimana prima'
  const k = mesiInteri(p)
  if (k && c && c.al === p.al) return k === 1 ? 'rispetto al mese prima' : `rispetto ai ${NUMERI[k] ?? k} mesi prima`
  return `rispetto ai ${c ? c.giorni : giorniFra(p.dal, p.al)} giorni prima`
}

/** «ottobre 2026», «28 set – 4 ott», «lug – set 2026», «3 lug – 20 set 2026» */
export function etichettaPeriodo(p: Periodo): string {
  const [y1, m1, d1] = p.dal.split('-').map(Number), [y2, m2, d2] = p.al.split('-').map(Number)
  if (p.modo === 'mese') return `${MESI_LUNGHI[m1 - 1]} ${y1}`
  if (p.modo === 'sett') return m1 === m2 ? `${d1} – ${d2} ${MESI_BREVI[m2 - 1]}` : `${d1} ${MESI_BREVI[m1 - 1]} – ${d2} ${MESI_BREVI[m2 - 1]}`
  if (mesiInteri(p)) return m1 === m2 && y1 === y2 ? `${MESI_LUNGHI[m1 - 1]} ${y1}` : `${MESI_BREVI[m1 - 1]}${y1 !== y2 ? ` ${y1}` : ''} – ${MESI_BREVI[m2 - 1]} ${y2}`
  return `${d1} ${MESI_BREVI[m1 - 1]}${y1 !== y2 ? ` ${y1}` : ''} – ${d2} ${MESI_BREVI[m2 - 1]} ${y2}`
}

/** «1 luglio 2026» nei campi Dal / Al */
export const dataPiena = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MESI_LUNGHI[m - 1]} ${y}` }

/** Cambiando modo: settimana e mese ripartono da oggi, il dal–al dagli ultimi tre mesi. */
export const cambiaModo = (modo: ModoPeriodo, oggi: string): Periodo => periodoIniziale(oggi, modo)
