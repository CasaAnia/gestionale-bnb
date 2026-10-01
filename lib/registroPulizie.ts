// ============================================================================
// IL REGISTRO DELLE PULIZIE (riferimento approvato da Ania il 01/10/2026,
// pulizie-registro-statistiche-riferimento.html, «Registro»): il diario,
// giorno per giorno, il più recente in alto. In ogni giorno:
//   - le pulizie confermate (ora in cui è stata segnata, camera, tipo,
//     letti, minuti, recuperati);
//   - i tempi degli spazi comuni (una riga per voce: area_comune dentro
//     «Corridoio e angolo caffè», sommata una volta sola);
//   - rinvii e salti, attenuati (non sono lavori fatti);
//   - le pulizie «automatiche» di prima (cambio ospite ricostruito), con i
//     loro due comandi di sempre.
// Gli interventi di camere oggi disattivate restano (integrazione di Ania).
// La testata del giorno: «2 pulizie · 50 min» — pulizie confermate e tempo
// totale noto, spazi comuni compresi. Funzioni pure, provate in node.
// ============================================================================
import type { Decisione, PuliziaAutomatica } from './pulizie.ts'
import { assettoDaSql, recuperoDaRiga, totalePezzi, totaleSenzaMisura } from './dotazionePulizie.ts'
import { lettiTesto } from './pulizieVista.ts'
import { minutiPerVoce, VOCI_SPAZI, type VoceSpazi } from './tempoPulizie.ts'
import { oraSegnata, romaDi, oraTesto } from './giornataPulizie.ts'
import { MESI_LUNGHI } from './dateItaliane.ts'

export const TIPO_REGISTRO: Record<Decisione['tipo'], string> = { fine_soggiorno: 'Cambio ospite', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
type Evento = Decisione & { assetto?: unknown; minuti?: number | null; ora_effettiva?: unknown; aggiornata_at?: string | null }
type Tempo = { data: string; attivita: string; minuti: number; aggiornato_at?: string | null; cosa?: string | null }

export type RigaRegistro =
  | { tipo: 'pulizia'; chiave: string; ora: string | null; camera: string; roomId: string; etichetta: string; letti: string; minuti: number | null; recuperati: number | null; evento: Evento }
  | { tipo: 'spazi'; chiave: string; ora: string | null; voce: VoceSpazi; nome: string; cosa: string | null; minuti: number; giorno: string }
  | { tipo: 'rinvio'; chiave: string; camera: string; roomId: string; etichetta: string; testo: string; destra: 'rinvio' | 'salto' }
  | { tipo: 'automatica'; chiave: string; camera: string; roomId: string; etichetta: string; auto: PuliziaAutomatica }
export type GiornoRegistro = { giorno: string; titolo: string; pulizie: number; minuti: number; righe: RigaRegistro[] }

const GIORNI = ['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab']
/** «gio 1 ottobre» */
export function titoloGiorno(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${GIORNI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d} ${MESI_LUNGHI[m - 1]}`
}
/** «50 min», «2 h 05» */
export const tempoBreve = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`)
const giornoMese = (iso: string) => { const [, m, d] = iso.split('-').map(Number); return `${d} ${MESI_LUNGHI[m - 1]}` }
/** «1 matrimoniale + 1 singolo · 3 completi» */
export function lettiRegistro(assetto: unknown): string {
  const a = assettoDaSql(assetto)
  return a ? `${lettiTesto(a) || 'nessun letto'} · ${a.ospiti} ${a.ospiti === 1 ? 'completo' : 'completi'}` : 'letti non documentati'
}

export type FiltroRegistro = 'tutte' | 'spazi' | { roomId: string }

export function registroPulizie({ events, recuperi, tempi, automatiche, dal, al, filtro, nomeCamera }: {
  events: Evento[]; recuperi: Record<string, unknown>[] | null; tempi: Tempo[]; automatiche: PuliziaAutomatica[]
  dal: string; al: string; filtro: FiltroRegistro; nomeCamera: (roomId: string) => string
}): GiorniRegistro {
  const dentro = (d: string) => d >= dal && d <= al
  const camera = (roomId: string) => filtro === 'tutte' || (typeof filtro === 'object' && filtro.roomId === roomId)
  const perId = new Map((recuperi ?? []).map(r => [String(r.cleaning_id), r]))
  const righe: (RigaRegistro & { giorno: string; minutiOrd: number })[] = []
  if (filtro !== 'spazi') {
    for (const e of events) {
      if (!e.id || !camera(e.room_id)) continue
      if (e.stato === 'fatta') {
        const giorno = e.data_effettiva || e.data_prevista
        if (!dentro(giorno)) continue
        const o = oraSegnata(e, romaDi)
        const rec = recuperi === null ? undefined : perId.get(e.id)
        const letto = rec ? recuperoDaRiga(rec) : null
        righe.push({ tipo: 'pulizia', chiave: `p:${e.id}`, giorno, minutiOrd: o ?? 9999, ora: o === null ? null : oraTesto(o), camera: nomeCamera(e.room_id), roomId: e.room_id,
          etichetta: TIPO_REGISTRO[e.tipo], letti: lettiRegistro(e.assetto), minuti: e.minuti ?? null,
          recuperati: rec === undefined ? null : letto ? totalePezzi(letto.pezzi) + totaleSenzaMisura(letto.senzaMisura) : null, evento: e })
      } else if (dentro(e.data_prevista)) {
        righe.push({ tipo: 'rinvio', chiave: `r:${e.id}`, giorno: e.data_prevista, minutiOrd: 10000, camera: nomeCamera(e.room_id), roomId: e.room_id,
          etichetta: e.tipo === 'soggiorno' ? '4 notti' : TIPO_REGISTRO[e.tipo],
          testo: e.stato === 'rimandata' ? `rimandata al ${e.prossima_data ? giornoMese(e.prossima_data) : '—'}` : 'cambio saltato', destra: e.stato === 'rimandata' ? 'rinvio' : 'salto' })
      }
    }
    for (const a of automatiche) {
      if (!dentro(a.data) || !camera(a.roomId)) continue
      righe.push({ tipo: 'automatica', chiave: `a:${a.partenza.id}`, giorno: a.data, minutiOrd: 9998, camera: nomeCamera(a.roomId), roomId: a.roomId, etichetta: TIPO_REGISTRO[a.tipo], auto: a })
    }
  }
  if (filtro === 'tutte' || filtro === 'spazi') {
    const perGiorno = new Map<string, Tempo[]>()
    for (const t of tempi) if (dentro(t.data)) perGiorno.set(t.data, [...(perGiorno.get(t.data) ?? []), t])
    for (const [giorno, lista] of perGiorno) {
      const voci = minutiPerVoce(lista)
      for (const [k, nome] of VOCI_SPAZI) {
        const v = voci[k]
        if (!v.righe.length || v.minuti <= 0) continue
        const r = v.ultimo ? romaDi(v.ultimo) : null
        const o = r && r.giorno === giorno ? r.minuti : null
        righe.push({ tipo: 'spazi', chiave: `s:${giorno}:${k}`, giorno, minutiOrd: o ?? 9999, ora: o === null ? null : oraTesto(o), voce: k, nome, cosa: v.righe.find(x => x.cosa)?.cosa ?? null, minuti: v.minuti })
      }
    }
  }
  const giorni = new Map<string, typeof righe>()
  for (const r of righe) giorni.set(r.giorno, [...(giorni.get(r.giorno) ?? []), r])
  return [...giorni].sort((a, b) => b[0].localeCompare(a[0])).map(([giorno, lista]) => {
    lista.sort((x, y) => x.minutiOrd - y.minutiOrd || x.chiave.localeCompare(y.chiave))
    const pulizie = lista.filter(r => r.tipo === 'pulizia').length
    const minuti = lista.reduce((s, r) => s + (r.tipo === 'pulizia' ? r.minuti ?? 0 : r.tipo === 'spazi' ? r.minuti : 0), 0)
    return { giorno, titolo: titoloGiorno(giorno), pulizie, minuti, righe: lista.map(r => { const copia: Record<string, unknown> = { ...r }; delete copia.giorno; delete copia.minutiOrd; return copia as RigaRegistro }) }
  })
}
export type GiorniRegistro = GiornoRegistro[]

/** «2 pulizie · 50 min», «1 pulizia · 41 min», «spazi comuni · 12 min» */
export function testataGiorno(g: Pick<GiornoRegistro, 'pulizie' | 'minuti'>): string {
  const p = g.pulizie === 1 ? '1 pulizia' : `${g.pulizie} pulizie`
  return g.minuti > 0 ? `${p} · ${tempoBreve(g.minuti)}` : p
}
/** Nome della voce in due pezzi come nel riferimento: «Corridoio» + «e angolo caffè» */
export function nomeInDue(nome: string): [string, string] {
  const i = nome.indexOf(' ')
  return i < 0 ? [nome, ''] : [nome.slice(0, i), nome.slice(i + 1)]
}
