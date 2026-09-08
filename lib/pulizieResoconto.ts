import { confrontaDecisioni, addDaysStr, diffDays, NOTA_AUTOMATICA_TOLTA, soggiornoContinuativo, pulizieAutomatiche, type PrenotazionePulizie, type Decisione, type TipoPulizia } from './pulizie.ts'
import { CHIAVI, VOCI, totale, sommaPerVoce, vuoto, type Recupero } from './biancheria.ts'
import { stimeStoriche } from './pulizieStimeStoriche.ts'

export type PeriodoPulizie = 'settimana' | 'mese' | 'anno'
export const TIPI_PULIZIA: Record<TipoPulizia, string> = { fine_soggiorno: 'Fine soggiorno', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
const iso = (d: Date) => d.toISOString().slice(0, 10)
export function periodoPulizie(tipo: PeriodoPulizie, offset: number, oggi: string) {
  const d = new Date(`${oggi}T12:00:00Z`), anno = d.getUTCFullYear(), mese = d.getUTCMonth()
  let da: string, a: string
  if (tipo === 'mese') { da = iso(new Date(Date.UTC(anno, mese + offset, 1))); a = iso(new Date(Date.UTC(anno, mese + offset + 1, 1))) }
  else if (tipo === 'anno') { da = `${anno + offset}-01-01`; a = `${anno + offset + 1}-01-01` }
  else { da = addDaysStr(oggi, -((d.getUTCDay() + 6) % 7) + offset * 7); a = addDaysStr(da, 7) }
  return { da, a, fino: a <= oggi ? a : addDaysStr(oggi, 1) }
}
export function confrontoPeriodoPulizie(tipo: PeriodoPulizie, offset: number, oggi: string) {
  const corrente = periodoPulizie(tipo, offset, oggi), precedente = periodoPulizie(tipo, offset - 1, oggi)
  if (corrente.a > oggi) precedente.fino = [precedente.a, addDaysStr(precedente.da, diffDays(corrente.fino, corrente.da))].sort()[0]
  return precedente
}

type Camera = { id: string; name: string; active?: boolean | null }
export type SpostamentoPulizia = { roomId: string; bookingId: string | null; tipo: TipoPulizia; prevista: string; prossima: string; rinvii: Decisione[]; giorni: number }

// Le decisioni consecutive sulla stessa scadenza compongono UNA pulizia.
// Il mese del rinvio è quello della prima data prevista, mai tutta la storia.
export function raggruppaRinvii(events: Decisione[], bookings: PrenotazionePulizie[] = []): SpostamentoPulizia[] {
  const gruppi: SpostamentoPulizia[] = [], aperti = new Map<string, SpostamentoPulizia>()
  for (const e of [...events].sort((a, b) => confrontaDecisioni({ ...a, created_at: a.created_at || `${a.data_prevista}T00:00:00Z` }, { ...b, created_at: b.created_at || `${b.data_prevista}T00:00:00Z` }))) {
    const b = e.tipo === 'soggiorno' ? bookings.find(b => b.id === e.booking_id) : null
    const soggiornoId = b ? soggiornoContinuativo(bookings, b).inizio.id : e.booking_id
    const k = `${e.room_id}:${soggiornoId}:${e.tipo}`
    if (e.stato !== 'rimandata') { aperti.delete(k); continue }
    if (!e.prossima_data) continue
    let gruppo = aperti.get(k)
    if (!gruppo || gruppo.prossima !== e.data_prevista) {
      gruppo = { roomId: e.room_id, bookingId: e.booking_id, tipo: e.tipo, prevista: e.data_prevista, prossima: e.data_prevista, rinvii: [], giorni: 0 }
      gruppi.push(gruppo); aperti.set(k, gruppo)
    }
    gruppo.rinvii.push(e); gruppo.prossima = e.prossima_data
    gruppo.giorni = diffDays(gruppo.prossima, gruppo.prevista)
  }
  return gruppi
}

export function resocontoPulizie(rooms: Camera[], bookings: PrenotazionePulizie[], events: Decisione[], recuperi: Recupero[] | null, da: string, a: string, oggi: string) {
  const entro = (d: string) => d >= da && d < a && d <= oggi
  const avvisi: string[] = []
  const visti = new Set<string>()
  const unici = events.filter(e => { if (!e.id) return true; if (visti.has(e.id)) { avvisi.push('Una pulizia è stata letta due volte.'); return false } visti.add(e.id); return true })
  const fatte = unici.filter(e => e.stato === 'fatta' && entro(e.data_effettiva || e.data_prevista))
  const recuperiPerId = new Map((recuperi ?? []).map(r => [r.cleaning_id, r]))
  const righe = fatte.map(e => {
    const r = e.id ? recuperiPerId.get(e.id) : undefined
    if (r && (r.room_id !== e.room_id || r.data !== (e.data_effettiva || e.data_prevista))) avvisi.push('Un recupero ha camera o data diversa dalla sua pulizia.')
    const persone = e.persone_servite ?? Number(bookings.find(b => b.id === e.booking_id)?.num_guests)
    if (r && persone && [r.telo_doccia, r.asciugamano_viso, r.asciugamano_mani].some(n => n > persone)) avvisi.push('Un recupero supera gli ospiti registrati: controlla la dotazione di quella pulizia.')
    return { pulizia: e, recupero: r ?? null, pezzi: recuperi === null ? null : r ? totale(r) : 0 }
  }).sort((x, y) => (y.pulizia.data_effettiva || y.pulizia.data_prevista).localeCompare(x.pulizia.data_effettiva || x.pulizia.data_prevista))
  const recuperati = righe.flatMap(r => r.recupero ? [r.recupero] : [])
  const spostate = raggruppaRinvii(unici, bookings).filter(g => entro(g.prevista))
  const saltate = unici.filter(e => e.stato === 'saltata' && e.note !== NOTA_AUTOMATICA_TOLTA && entro(e.data_prevista))
  const rinvioMedio = spostate.length ? spostate.reduce((n, g) => n + g.giorni, 0) / spostate.length : null
  const notti = new Set<string>()
  for (const b of bookings.filter(b => ['confermata', 'completata'].includes(b.status ?? ''))) {
    for (let d = b.check_in > da ? b.check_in : da; d < b.check_out && d < a && d <= oggi; d = addDaysStr(d, 1)) notti.add(`${b.room_id}:${d}`)
  }
  const perCamera = rooms.map(room => ({ room, interventi: fatte.filter(e => e.room_id === room.id).length,
    pezzi: recuperi === null ? null : recuperati.filter(r => r.room_id === room.id).reduce((n, r) => n + totale(r), 0),
    notti: [...notti].filter(k => k.startsWith(`${room.id}:`)).length,
  }))
  const intervalli: { roomId: string; da: string; a: string; notti: number }[] = []
  const ultimoCambio = new Map<string, string>()
  for (const e of unici.filter(e => e.stato === 'fatta' && e.tipo === 'soggiorno').sort((x, y) => String(x.data_effettiva || x.data_prevista).localeCompare(String(y.data_effettiva || y.data_prevista)))) {
    const b = bookings.find(b => b.id === e.booking_id)
    if (!b) continue
    const soggiorno = soggiornoContinuativo(bookings, b)
    const k = `${e.room_id}:${soggiorno.inizio.id}`, data = e.data_effettiva || e.data_prevista
    const precedente = ultimoCambio.get(k)
    if (precedente && data > precedente && entro(data)) intervalli.push({ roomId: e.room_id, da: precedente, a: data, notti: diffDays(data, precedente) })
    ultimoCambio.set(k, data)
  }
  const storiche = stimeStoriche(rooms, bookings, oggi)
  const stime = [...storiche.pulizie.map(e => ({ ...e, tipo: 'fine_soggiorno' as TipoPulizia })), ...storiche.cambi.map(e => ({ ...e, tipo: 'soggiorno' as TipoPulizia })), ...pulizieAutomatiche(bookings, unici, oggi).map(e => ({ roomId: e.roomId, date: e.data, tipo: e.tipo }))]
    .filter(e => entro(e.date) && !fatte.some(f => f.room_id === e.roomId && (f.data_effettiva || f.data_prevista) === e.date && f.tipo === e.tipo))
  return { fatte, righe, recuperati, spostate, saltate, rinvioMedio, perCamera, intervalli, stime,
    perTipo: (Object.keys(TIPI_PULIZIA) as TipoPulizia[]).map(tipo => ({ tipo, n: fatte.filter(e => e.tipo === tipo).length })),
    pezzi: recuperi === null ? null : recuperati.reduce((n, r) => n + totale(r), 0),
    perVoce: recuperi === null ? null : sommaPerVoce(recuperati),
    conRecuperi: recuperi === null ? null : righe.filter(r => Number(r.pezzi) > 0).length,
    numeroRinvii: spostate.reduce((n, g) => n + g.rinvii.length, 0),
    notti: notti.size, cadenza: intervalli.length ? intervalli.reduce((n, i) => n + i.notti, 0) / intervalli.length : null,
    avvisi: [...new Set(avvisi)],
  }
}

export function csvPulizie(report: ReturnType<typeof resocontoPulizie>, rooms: Camera[]) {
  const nome = (id: string) => rooms.find(r => r.id === id)?.name ?? id
  const tabella: (string | number | null)[][] = [['Data', 'Camera', 'Tipo', 'Fonte', 'Stato', 'Data prevista', 'Prossima data', 'Pezzi recuperati', ...VOCI.map(v => v.plurale), 'Recupero aggiornato il', 'ID pulizia']]
  for (const r of report.righe) tabella.push([r.pulizia.data_effettiva || r.pulizia.data_prevista, nome(r.pulizia.room_id), TIPI_PULIZIA[r.pulizia.tipo], 'Confermata', 'Fatta', r.pulizia.data_prevista, '', r.pezzi, ...CHIAVI.map(k => r.recupero?.[k] ?? (report.pezzi === null ? null : vuoto()[k])), r.recupero?.updated_at ?? '', r.pulizia.id ?? ''])
  for (const g of report.spostate) for (const r of g.rinvii) tabella.push([g.prevista, nome(g.roomId), TIPI_PULIZIA[g.tipo], 'Decisione', 'Rimandata', r.data_prevista, r.prossima_data ?? '', '', ...CHIAVI.map(() => ''), '', r.id ?? ''])
  for (const r of report.saltate) tabella.push([r.data_prevista, nome(r.room_id), TIPI_PULIZIA[r.tipo], 'Decisione', 'Saltata', r.data_prevista, r.prossima_data ?? '', '', ...CHIAVI.map(() => ''), '', r.id ?? ''])
  for (const r of report.stime) tabella.push([r.date, nome(r.roomId), TIPI_PULIZIA[r.tipo], 'Stima storica', 'Ricostruita', '', '', '', ...CHIAVI.map(() => ''), '', ''])
  return '\ufeff' + tabella.map(r => r.map(v => `"${String(v ?? '').replace(/^[=+@-]/, "'$&").replaceAll('"', '""')}"`).join(';')).join('\r\n')
}
