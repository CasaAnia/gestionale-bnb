// ============================================================================
// LE STATISTICHE DELLE PULIZIE NELLA VESTE NUOVA (riferimento approvato da
// Ania il 01/10/2026, pulizie-registro-statistiche-riferimento.html).
// Sopra i conti di sempre (statistichePulizie: un intervento confermato = una
// riga, nella sua data effettiva). Regole scritte una volta sola
// (integrazione di Ania, punto 5):
//   - le medie dei minuti si fanno SOLO sugli interventi coi minuti: uno senza
//     minuti non vale zero; il numero di interventi coi minuti si dichiara;
//   - gli spazi comuni entrano nel LAVORO TOTALE, mai nella media a camera;
//     con una camera scelta non le si attribuiscono (si dice);
//   - area_comune si legge dentro «Corridoio e angolo caffè», una volta sola;
//   - le medie a settimana / mese / anno: totale ÷ giorni contati del periodo
//     (fino a oggi, lib/periodoPulizie) × 7 / × 30,44 / × 365; si arrotonda
//     solo a schermo;
//   - costi e totali della lavanderia si calcolano coi numeri interi, prima
//     di arrotondare; un prezzo vuoto è «da inserire», non zero.
// Funzioni pure, provate con node --test.
// ============================================================================
import { statistichePulizie, type InterventoStat } from './pulizieDotazioneStatistiche.ts'
import { totalePezzi, type PezziPulizie } from './dotazionePulizie.ts'
import { minutiPerVoce, VOCI_SPAZI, type VoceSpazi } from './tempoPulizie.ts'
import { spostaGiorni } from './periodoPulizie.ts'

export const GIORNI_MESE = 30.44
type Tempo = { data: string; attivita: string; minuti: number }
type Rinvio = { room_id: string; stato: string; data_prevista: string }

// Tipo di camera dal listino di casa (Ania, 01/10/2026)
export const TIPO_CAMERA: Record<string, 'matrimoniale' | 'singola' | 'tripla'> = { Ambra: 'matrimoniale', Allegra: 'matrimoniale', Amelia: 'singola', Lena: 'tripla' }

export type PezzoLavanderia = 'lenzuola_matrimoniali' | 'lenzuola_singole' | 'federe' | 'teli_doccia' | 'viso_mani' | 'tappetini'
export const PEZZI_LAVANDERIA: [PezzoLavanderia, string, (keyof PezziPulizie)[]][] = [
  ['lenzuola_matrimoniali', 'Lenzuola matrimoniali', ['sotto_matrimoniale', 'sopra_matrimoniale']],
  ['lenzuola_singole', 'Lenzuola singole', ['sotto_singolo', 'sopra_singolo']],
  ['federe', 'Federe', ['federe']],
  ['teli_doccia', 'Teli doccia', ['telo_doccia']],
  ['viso_mani', 'Viso e mani', ['asciugamano_viso', 'asciugamano_mani']],
  ['tappetini', 'Tappetini e tappeti', ['tappeto_bagno', 'scendidoccia']],
]

function conti(interventi: InterventoStat[], tempi: Tempo[], dal: string, al: string, roomId: string) {
  const base = statistichePulizie(interventi, dal, spostaGiorni(al, 1), roomId)
  const spazi = minutiPerVoce(tempi.filter(t => t.data >= dal && t.data <= al))
  const minutiSpazi = VOCI_SPAZI.reduce((s, [k]) => s + spazi[k].minuti, 0)
  return { base, spazi, minutiSpazi }
}
const media = (r: InterventoStat[]) => { const c = r.filter(x => x.minuti !== null); return { n: r.length, conMinuti: c.length, media: c.length ? c.reduce((s, x) => s + x.minuti!, 0) / c.length : null } }

export function statisticheNuove({ interventi, tempi, rinvii, dal, al, prima, roomId = '', nomeCamera }: {
  interventi: InterventoStat[]; tempi: Tempo[]; rinvii: Rinvio[]
  /** i giorni CONTATI del periodo (fino a oggi) */
  dal: string; al: string
  /** il periodo uguale precedente (lib/periodoPulizie.precedente) */
  prima: { dal: string; al: string } | null
  roomId?: string
  nomeCamera: (roomId: string) => string
}) {
  const { base, spazi, minutiSpazi } = conti(interventi, tempi, dal, al, roomId)
  const giorni = Math.round((Date.parse(`${al}T12:00:00Z`) - Date.parse(`${dal}T12:00:00Z`)) / 86400000) + 1
  const righe = base.righe
  // Spazi comuni: nel lavoro totale solo senza una camera scelta
  const lavoro = base.minuti + (roomId ? 0 : minutiSpazi)
  const aCamera = media(righe)
  const rifare = media(righe.filter(r => r.tipo !== 'soggiorno'))
  const biancheria = media(righe.filter(r => r.tipo === 'soggiorno'))
  // Per camera: tutte quelle che hanno interventi nel periodo (anche disattivate)
  const perCamera = [...new Set(righe.map(r => r.roomId))].map(id => {
    const sue = righe.filter(r => r.roomId === id)
    const c = media(sue)
    return { roomId: id, nome: nomeCamera(id), n: sue.length, minuti: sue.reduce((s, r) => s + (r.minuti ?? 0), 0), conMinuti: c.conMinuti }
  }).sort((a, b) => b.minuti - a.minuti || b.n - a.n)
  // Come si usano le camere: ogni intervento coi letti segnati
  const uso = [...new Set(righe.map(r => r.roomId))].map(id => {
    const nome = nomeCamera(id), tipo = TIPO_CAMERA[nome] ?? null
    const conLetti = righe.filter(r => r.roomId === id && r.assetto)
    const conta = (f: (a: NonNullable<InterventoStat['assetto']>) => boolean) => conLetti.filter(r => f(r.assetto!)).length
    const pillole: { n: number; testo: string }[] = tipo === 'tripla'
      ? [1, 2, 3, 4].map(k => ({ n: conta(a => a.ospiti === k), testo: `in ${k}` }))
      : tipo === 'singola'
        ? [{ n: conta(a => a.singoli <= 1), testo: 'in 1' }, { n: conta(a => a.singoli > 1), testo: '+ letto in più' }]
        : [{ n: conta(a => a.singoli === 0 && a.ospiti >= 2), testo: 'in 2' }, { n: conta(a => a.singoli === 0 && a.ospiti === 1), testo: 'uso singolo' }, { n: conta(a => a.singoli > 0), testo: '+ letto in più' }]
    return { roomId: id, nome, tipo, volte: conLetti.length, pillole: pillole.filter(p => p.n > 0) }
  }).filter(u => u.volte > 0).sort((a, b) => a.nome.localeCompare(b.nome))
  // Completi usati: un completo matrimoniale per ogni intervento col
  // matrimoniale (anche uso singolo), uno singolo per ogni letto singolo
  // (compreso il letto in più), un completo asciugamani per ospite.
  const completi = { matrimoniali: 0, singole: 0, asciugamani: 0 }
  for (const r of righe) if (r.assetto) { completi.matrimoniali += r.assetto.matrimoniali > 0 ? 1 : 0; completi.singole += r.assetto.singoli; completi.asciugamani += r.assetto.ospiti }
  const scala = (n: number) => ({ settimana: n / giorni * 7, mese: n / giorni * GIORNI_MESE, anno: n / giorni * 365 })
  // Mandati a lavare: dotazione meno recuperati, per pezzo (recuperi non
  // annotati = niente recuperato in quell'intervento, cioè tutto a lavare)
  const mandati = PEZZI_LAVANDERIA.map(([k, nome, voci]) => {
    const totale = voci.reduce((s, v) => s + base.dotazione[v], 0)
    const recuperati = voci.reduce((s, v) => s + base.recuperi[v], 0)
    return { pezzo: k, nome, totale, recuperati, aLavare: totale - recuperati, alMese: (totale - recuperati) / giorni * GIORNI_MESE }
  })
  const preparati = totalePezzi(base.dotazione), recuperati = totalePezzi(base.recuperi)
  const tipiRinvio = rinvii.filter(r => r.data_prevista >= dal && r.data_prevista <= al && (!roomId || r.room_id === roomId))
  // Confronto col periodo uguale precedente
  let confronto: { testo: string; meglio: boolean } | null = null
  if (prima) {
    const p = conti(interventi, tempi, prima.dal, prima.al, roomId)
    const mp = media(p.base.righe).media
    if (aCamera.media !== null && mp !== null && Math.round(aCamera.media) !== Math.round(mp)) {
      const d = Math.round(aCamera.media) - Math.round(mp)
      confronto = { testo: `${d < 0 ? '↓' : '↑'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'minuto' : 'minuti'} a camera`, meglio: d < 0 }
    } else if (p.base.interventi !== righe.length && (p.base.interventi > 0 || righe.length > 0)) {
      const d = righe.length - p.base.interventi
      confronto = { testo: `${d > 0 ? '↑' : '↓'} ${Math.abs(d)} ${Math.abs(d) === 1 ? 'pulizia' : 'pulizie'}`, meglio: true }
    }
  }
  return {
    base, giorni, pulizie: righe.length, lavoro, minutiCamere: base.minuti, minutiSpazi: roomId ? null : minutiSpazi,
    aCamera, rifare, biancheria, perCamera, uso, completi: { matrimoniali: scala(completi.matrimoniali), singole: scala(completi.singole), asciugamani: scala(completi.asciugamani), totali: completi },
    mandati, preparati, recuperati, aLavare: preparati - recuperati, percentuale: preparati ? recuperati / preparati * 100 : null,
    spazi: VOCI_SPAZI.map(([k, nome]) => ({ voce: k as VoceSpazi, nome, minuti: spazi[k].minuti })),
    rimandate: tipiRinvio.filter(r => r.stato === 'rimandata').length, saltate: tipiRinvio.filter(r => r.stato === 'saltata').length,
    confronto,
  }
}

/** «21 h», «6 h 40», «46′» */
export function ore(min: number): string {
  if (min < 60) return `${Math.round(min)}′`
  const h = Math.floor(min / 60), m = Math.round(min % 60)
  return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`
}

/** Prova lavanderia: costi coi numeri interi; prezzo assente = da inserire. */
export function provaLavanderia(mandati: { pezzo: PezzoLavanderia; nome: string; aLavare: number; alMese: number }[], prezzi: Partial<Record<PezzoLavanderia, number>>) {
  const righe = mandati.map(m => {
    const prezzo = prezzi[m.pezzo]
    return { ...m, prezzo: prezzo ?? null, costoMese: prezzo === undefined ? null : m.alMese * prezzo, costoPeriodo: prezzo === undefined ? null : m.aLavare * prezzo }
  })
  const mancanti = righe.filter(r => r.prezzo === null && r.aLavare > 0).map(r => r.nome)
  return {
    righe, mancanti, parziale: mancanti.length > 0,
    alMese: righe.reduce((s, r) => s + (r.costoMese ?? 0), 0),
    periodo: righe.reduce((s, r) => s + (r.costoPeriodo ?? 0), 0),
  }
}
/** «66,50» */
export const euro = (n: number, decimali = 2) => n.toLocaleString('it-IT', { minimumFractionDigits: decimali, maximumFractionDigits: decimali })
