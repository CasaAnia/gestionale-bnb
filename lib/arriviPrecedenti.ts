// ============================================================================
// «ARRIVI PRECEDENTI» (13/09/2026): come erano andati gli arrivi degli altri
// soggiorni CONCLUSI di questa cliente — periodo, camere, orario e navetta —
// le stesse righe della scheda attuale, calcolate con lib/storicoCliente.
// Solo lettura: non scrive niente. Era dentro components/scheda/
// ArriviPrecedenti; sta qui dal 22/10/2026 per essere provato in Node.
//
// Dal 22/10/2026 (Codex): con un luogo esterno lo storico dice anche DOVE e
// a che ora è arrivata («Arriva a Rogoredo alle 09:20») e il prelievo, anche
// quando l'ora in struttura non c'è. Prima leggeva solo l'ora in struttura:
// con quella vuota il luogo e la sua ora sparivano. L'ora in struttura, il
// luogo, l'autista e il prelievo restano voci distinte.
//
// PIÙ ARRIVI NELLO STESSO SOGGIORNO (audit, 22/10/2026): una prenotazione
// può avere periodi separati da notti vuote (1→3 nov, poi 8→10 nov): ogni
// periodo è un arrivo suo, con la sua data. Il criterio è quello della
// scheda (`riepilogoPeriodi`): un nuovo arrivo comincia quando un tratto
// entra DOPO l'ultima partenza vista; un cambio camera contiguo (entra il
// giorno in cui l'altro esce), camere parallele e intervalli sovrapposti
// restano lo stesso arrivo. Dentro un periodo i dati si leggono dal primo
// tratto che li ha, e la data è la SUA: se ce li ha solo un tratto
// successivo, non si attribuiscono al giorno d'arrivo del periodo.
// «Da definire» della navetta è una scelta salvata, diversa da «non
// registrata» (la riga non dice niente). Solo lettura.
// ============================================================================
import { righeStorico, type SegmentoStorico } from './storicoCliente.ts'
import { periodoCompatto, giornoMese } from './dateItaliane.ts'
import { riepilogoPeriodi } from './periodiPrenotazione.ts'
import { leggiArrivo, periodoInStruttura, circaInStruttura, navettaInScheda, navettaRichiesta, rigaLuogo, rigaPrelievo } from './arrivo.ts'

/** Un arrivo, con la data del tratto da cui si legge */
export type DettaglioArrivo = {
  /** il giorno del tratto che porta i dati («2030-11-08») */
  data: string
  /** «8 nov» */
  giorno: string
  /** l'ora in struttura («arrivo 16:00», «in struttura circa 15:30–16:30»); null quando c'è solo il luogo */
  orario: string | null
  /** «Arriva a Rogoredo alle 09:20»; null senza luogo esterno */
  luogo: string | null
  navetta: string
  /** «Prelievo a Linate · 09:15»; null senza navetta o senza dettagli */
  prelievo: string | null
}

export type ArrivoPrecedente = {
  chiave: string
  periodo: string
  camere: string
  /** gli arrivi del soggiorno in ordine di data: uno per periodo */
  arrivi: DettaglioArrivo[]
  /** le date accanto agli arrivi: con più arrivi, o con i dati su un tratto
   *  che non entra il primo giorno del soggiorno */
  conData: boolean
} & Omit<DettaglioArrivo, 'data' | 'giorno'>

export const ORARIO_NON_REGISTRATO = 'orario non registrato'
export const NAVETTA_NON_REGISTRATA = 'navetta non registrata'
export const NAVETTA_DA_DEFINIRE_STORICO = 'navetta da definire'

type Riga = Record<string, unknown>
const piena = (v: unknown) => typeof v === 'string' && v.trim() !== ''
/** La riga dice qualcosa dell'arrivo? (le colonne della 0058, o le due di sempre) */
export function haDatiArrivo(r: Riga): boolean {
  return piena(r.arrivo_tipo) || piena(r.check_in_time) || piena(r.shuttle) || piena(r.navetta)
}

function dettaglio(seg: SegmentoStorico): DettaglioArrivo {
  // Dal 21/09/2026 sera si legge il MODELLO, non le due colonne di
  // sempre: lo storico non perde più la fine della fascia, il «circa»
  // della stima e il nome dell'autista (rilievo di Codex).
  const riga = seg as unknown as Riga
  const a = leggiArrivo(riga)
  const quando = periodoInStruttura(a)
  const luogo = rigaLuogo(a)
  const circa = circaInStruttura(a) ? 'circa ' : ''
  return {
    data: seg.check_in,
    giorno: giornoMese(seg.check_in),
    orario: quando ? `${luogo ? 'in struttura' : 'arrivo'} ${circa}${quando}` : luogo ? null : ORARIO_NON_REGISTRATO,
    luogo,
    navetta: a.navetta === 'non_richiesta' ? 'navetta no'
      : navettaRichiesta(a.navetta) ? `navetta ${navettaInScheda(a).titolo.toLowerCase()}`
      // «da definire» salvato è una scelta; senza niente sulla riga non è registrata
      : riga.navetta === 'da_definire' ? NAVETTA_DA_DEFINIRE_STORICO
      : NAVETTA_NON_REGISTRATA,
    prelievo: rigaPrelievo(a),
  }
}

/** Gli arrivi di un soggiorno: uno per periodo (criterio della scheda). Fra
 *  i tratti vivi del periodo si legge il primo che ha dati, alla sua data;
 *  se nessuno ne ha, il primo tratto («non registrato»). */
export function arriviDelSoggiorno(segmenti: SegmentoStorico[]): DettaglioArrivo[] {
  // il primo arrivo fra i tratti VIVI: un tratto annullato non dice com'è
  // arrivata (rilievo di Codex, 22/10/2026)
  const vivi = segmenti.filter(s => s.status !== 'annullata')
    .sort((a, z) => a.check_in.localeCompare(z.check_in) || a.id.localeCompare(z.id))
  const periodi = riepilogoPeriodi(vivi).periodi
  // tratti senza notti (arrivo = partenza): nessun periodo, ma la riga c'è
  if (!periodi.length) return [dettaglio(vivi[0] ?? segmenti[0])]
  return periodi.map(p => {
    const dentro = vivi.filter(s => s.check_in >= p.arrivo && s.check_in < p.partenza)
    const conDati = dentro.find(s => haDatiArrivo(s as unknown as Riga))
    return dettaglio(conDati ?? dentro[0])
  })
}

export function arriviPrecedenti(altre: SegmentoStorico[], oggi: string): ArrivoPrecedente[] {
  return righeStorico(altre)
    .filter(r => r.status !== 'annullata')
    .filter(r => r.segmenti.filter(s => s.status !== 'annullata').every(s => ['confermata', 'completata'].includes(s.status) && s.check_out <= oggi))
    .sort((a, z) => z.check_in.localeCompare(a.check_in))
    .map(r => {
      const arrivi = arriviDelSoggiorno(r.segmenti)
      const { data: _d, giorno: _g, ...primo } = arrivi[0]
      void _d; void _g
      return {
        chiave: r.chiave,
        periodo: periodoCompatto(r.check_in, r.check_out, { anno: true }),
        camere: r.camere.join(' → '),
        ...primo,
        arrivi,
        conData: arrivi.length > 1 || arrivi[0].data !== r.check_in,
      }
    })
}
