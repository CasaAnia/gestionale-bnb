// «Pulizie di oggi» in Home (Ania, 07/09/2026: «dalla Home dovevo vedere le
// pulizie della giornata e spuntarle»): logica PURA, si prova in node.
//
// Una voce per ogni pulizia della giornata, tre stati:
//  · da_fare     aperta oggi o in ritardo (lib/pulizie.pulizieAperte: la stessa
//                regola della sezione «Oggi» della pagina Pulizie e della
//                striscia della settimana), con la pulizia da segnare «fatta»;
//  · automatica  cambio ospite: registrata da sola, niente da spuntare;
//  · fatta       segnata fatta con data di oggi (riga in cleanings), da poter
//                riportare a «non fatta» (si cancella quella riga).
// Ordine: prima le da fare (più urgenti in cima, poi il ritardo), poi le
// automatiche, poi le fatte nell'ordine in cui sono state segnate.
import {
  confrontaDecisioni, attive, pulizieAperte, prossimoArrivo, prioritaDi, continuaDa, continuaIn, statoFineSoggiorno, cambioOspiteAutomatico, diffDays, CUTOFF_STORICO,
  soggiornoContinuativo, type Decisione, type Priorita, type TipoPulizia,
} from './pulizie.ts'
import { nomeOspite } from './guestName.ts'

export type StatoVoce = 'da_fare' | 'automatica' | 'fatta'
export type PuliziaDaSegnareOggi = { room_id: string; booking_id: string | null; tipo: TipoPulizia; data_prevista: string }

export type VocePuliziaOggi = {
  persone?: number | null
  partenza?: string
  ultimaId?: string | null
  chiave: string
  roomId: string
  camera: string            // nome breve («Ambra»)
  stato: StatoVoce
  tipo: TipoPulizia
  riga: string              // «è partito Rossi · arriva Bianchi alle 16:00»
  ritardo: number           // giorni di ritardo (solo da_fare)
  priorita: Priorita | null
  daSegnare?: PuliziaDaSegnareOggi   // da_fare: cosa scrivere con la spunta
  decisione?: Decisione     // fatta: la riga da cancellare con «non fatta»
  oraFatta?: string         // fatta: «10:40» (ora di Roma), se nota
  annullabile: boolean      // fatta segnata a mano oggi (non una correzione di un'automatica)
}

const RANK: Record<Priorita, number> = { urgente: 0, alta: 1, flessibile: 2, nessuna_fretta: 3 }
const ORDINE_STATO: Record<StatoVoce, number> = { da_fare: 0, automatica: 1, fatta: 2 }

export const nomeBreve = (nome: string) => nome.split(' ').slice(-1)[0]
export function dataBreve(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}
export function oraRoma(istante: string | undefined | null): string | undefined {
  if (!istante) return undefined
  const t = Date.parse(istante)
  if (!Number.isFinite(t)) return undefined
  return new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }).format(new Date(t))
}
export const testoRitardo = (n: number) => (n <= 0 ? '' : n === 1 ? 'in ritardo di 1 giorno' : `in ritardo di ${n} giorni`)

type Camera = { id: string; name: string; active?: boolean | null }

type Prenotazioni = Parameters<typeof pulizieAperte>[0]

export function pulizieDiOggi(rooms: Camera[], tutteLePrenotazioni: Prenotazioni, events: Decisione[], oggi: string): VocePuliziaOggi[] {
  const bookings = attive(tutteLePrenotazioni)
  const camere = rooms.filter(r => r.active !== false)
  const breve = (id: string | undefined) => { const r = camere.find(x => x.id === id) ?? rooms.find(x => x.id === id); return r ? nomeBreve(r.name) : 'un’altra camera' }
  const out: VocePuliziaOggi[] = []
  for (const room of camere) {
    const arrivo = prossimoArrivo(bookings, room.id, oggi)
    const arrivoTesto = !arrivo ? ''
      : arrivo.giorni === 0 ? ` · arriva ${nomeOspite(arrivo.booking)}${arrivo.booking.check_in_time ? ` alle ${arrivo.booking.check_in_time}` : ''}`
        : arrivo.giorni === 1 ? ` · domani arriva ${nomeOspite(arrivo.booking)}` : ''
    const gestite = new Set<string>()
    for (const p of pulizieAperte(bookings, room.id, oggi, events)) {
      gestite.add(String(p.booking.id))
      const nome = nomeOspite(p.booking)
      const cosa = p.tipo === 'soggiorno' ? `${nome} resta · cambio biancheria`
        : p.tipo === 'cambio_camera' ? `${nome} va in ${breve(p.cambioCameraVerso?.room_id)}`
          : p.prevista === oggi ? `è partito ${nome}` : `partenza del ${dataBreve(p.prevista)} · ${nome}`
      if (p.automatica) {
        out.push({
          chiave: `automatica:${room.id}:${p.booking.id}`, roomId: room.id, camera: nomeBreve(room.name), stato: 'automatica', tipo: p.tipo,
          riga: `${cosa}${p.arrivoAutomatico ? ` · arriva ${nomeOspite(p.arrivoAutomatico)}` : ''} · registrata da sola`,
          ritardo: 0, priorita: prioritaDi(p, arrivo), annullabile: false,
        })
        continue
      }
      out.push({
        chiave: `da_fare:${room.id}:${p.tipo}:${p.booking.id}`, roomId: room.id, camera: nomeBreve(room.name), stato: 'da_fare', tipo: p.tipo,
        riga: `${cosa}${arrivoTesto}`, ritardo: p.ritardo, priorita: prioritaDi(p, arrivo),
        daSegnare: { room_id: room.id, booking_id: p.booking.id ?? null, tipo: p.tipo, data_prevista: p.due },
        annullabile: false,
      })
    }
    // Arrivo di oggi con la pulizia della partenza precedente mai segnata
    // (partenza di due o più giorni fa): pulizieAperte la considera chiusa
    // dall'arrivo, ma la striscia e «Da controllare» la contano da fare
    // (lib/daControllare.eccezioniPulizie): qui si spunta
    const arrivi = bookings.filter(b => b.room_id === room.id && b.check_in === oggi && !continuaDa(bookings, b))
    if (arrivi.length > 0) {
      const precedente = bookings
        .filter(x => x.room_id === room.id && x.check_out <= oggi && x.check_out >= CUTOFF_STORICO && !continuaIn(bookings, x) && !arrivi.some(a => a.id === x.id))
        .sort((x, y) => x.check_out.localeCompare(y.check_out)).slice(-1)[0]
      const st = precedente && !gestite.has(String(precedente.id)) ? statoFineSoggiorno(bookings, precedente, events) : null
      if (precedente && st && !st.chiusa && st.due <= oggi && !cambioOspiteAutomatico(bookings, precedente, events)) {
        gestite.add(String(precedente.id))
        const nome = nomeOspite(precedente)
        const cosa = st.tipo === 'cambio_camera' ? `${nome} va in ${breve(st.cambioCameraVerso?.room_id)}` : `partenza del ${dataBreve(precedente.check_out)} · ${nome}`
        out.push({
          chiave: `da_fare:${room.id}:${st.tipo}:${precedente.id}`, roomId: room.id, camera: nomeBreve(room.name), stato: 'da_fare', tipo: st.tipo,
          riga: `${cosa}${arrivoTesto}`, ritardo: Math.max(0, diffDays(oggi, st.due)), priorita: 'urgente',
          daSegnare: { room_id: room.id, booking_id: precedente.id ?? null, tipo: st.tipo, data_prevista: st.due },
          annullabile: false,
        })
      }
    }
    // Segnate fatte oggi (a mano): con «non fatta» la riga si cancella
    for (const e of events) {
      if (e.room_id !== room.id || e.stato !== 'fatta' || (e.data_effettiva || e.data_prevista) !== oggi) continue
      const b = e.booking_id ? bookings.find(x => x.id === e.booking_id) ?? tutteLePrenotazioni.find(x => x.id === e.booking_id) : null
      const nome = b ? nomeOspite(b) : ''
      const cosa = e.tipo === 'soggiorno' ? (nome ? `${nome} resta · cambio biancheria` : 'cambio biancheria')
        : e.tipo === 'cambio_camera' ? (nome ? `cambio camera di ${nome}` : 'cambio camera')
          : nome ? `è partito ${nome}` : 'fine soggiorno'
      const ora = oraRoma(e.created_at)
      out.push({
        chiave: `fatta:${e.id ?? `${room.id}:${e.tipo}:${e.data_prevista}`}`, roomId: room.id, camera: nomeBreve(room.name), stato: 'fatta', tipo: e.tipo,
        riga: `${cosa} · fatta${ora ? ` alle ${ora}` : ''}`, ritardo: 0, priorita: null,
        decisione: e, oraFatta: ora, annullabile: !e.note,
      })
    }
  }
  const posto = (v: VocePuliziaOggi) => camere.findIndex(c => c.id === v.roomId)
  for (const v of out) {
    const b = tutteLePrenotazioni.find(x => x.id === (v.daSegnare?.booking_id ?? v.decisione?.booking_id))
    v.persone = v.decisione?.persone_servite ?? (Number(b?.num_guests) || null)
    v.partenza = b ? soggiornoContinuativo(bookings, b).fine.check_out : undefined
    v.ultimaId = events.filter(e => e.room_id === v.roomId).sort((a, b) => confrontaDecisioni(b, a))[0]?.id ?? null
  }
  return out.sort((a, b) => ORDINE_STATO[a.stato] - ORDINE_STATO[b.stato]
    || (a.stato === 'da_fare' ? RANK[a.priorita!] - RANK[b.priorita!] || b.ritardo - a.ritardo : 0)
    || (a.stato === 'fatta' ? confrontaDecisioni(a.decisione!, b.decisione!) : 0)
    || posto(a) - posto(b))
}

// «2 da fare · 1 in ritardo» · «tutte fatte» · «1 da fare»
export function riassuntoPulizieOggi(voci: VocePuliziaOggi[]): string {
  const daFare = voci.filter(v => v.stato === 'da_fare')
  const inRitardo = daFare.filter(v => v.ritardo > 0).length
  if (daFare.length === 0) return voci.length ? 'tutte fatte' : ''
  const base = daFare.length === 1 ? '1 da fare' : `${daFare.length} da fare`
  return inRitardo ? `${base} · ${inRitardo} in ritardo` : base
}
