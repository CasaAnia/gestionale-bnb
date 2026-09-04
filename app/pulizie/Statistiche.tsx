'use client'
import { useMemo, useState } from 'react'
import { ROOM_NUMBER_BY_NAME } from '@/lib/roomTypes'
import { NOTTI_CAMBIO, CUTOFF_STORICO, addDaysStr, diffDays, pulizieAutomatiche, NOTA_AUTOMATICA_TOLTA, type Decisione } from '@/lib/pulizie'
import { riassuntoInterventi, testoMediaGiorno, testoOgniGiorni, testoDettaglio } from '@/lib/pulizieStatistiche'

// Soggiorni senza mai cambio biancheria: lo storico stimato è "1 cambio ogni
// 4 notti", ma per questi sappiamo che il cambio non è mai stato fatto.
// Giovanna Ricci, Amelia, 4 maggio – 13 giugno 2026 (40 notti).
const SOGGIORNI_SENZA_CAMBIO = ['9d539f6d-85c8-4da6-9da6-7aaa74dce042']

type Periodo = 'settimana' | 'mese' | 'anno'

// Intervallo [inizio, fine] del periodo scelto; offset 0 = corrente, -1 = precedente...
function intervallo(periodo: Periodo, offset: number): { inizio: string; fine: string; label: string } {
  const oggi = new Date()
  if (periodo === 'settimana') {
    const lun = new Date(oggi)
    lun.setDate(oggi.getDate() - ((oggi.getDay() + 6) % 7) + offset * 7)
    const dom = new Date(lun)
    dom.setDate(lun.getDate() + 6)
    const s = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const label = `${lun.getDate()} ${lun.toLocaleDateString('it-IT', { month: 'long' })} – ${dom.getDate()} ${dom.toLocaleDateString('it-IT', { month: 'long' })}`
    return { inizio: s(lun), fine: s(dom), label }
  }
  if (periodo === 'mese') {
    const m = new Date(oggi.getFullYear(), oggi.getMonth() + offset, 1)
    const fine = new Date(m.getFullYear(), m.getMonth() + 1, 0)
    const s = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { inizio: s(m), fine: s(fine), label: m.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }) }
  }
  const anno = oggi.getFullYear() + offset
  return { inizio: `${anno}-01-01`, fine: `${anno}-12-31`, label: String(anno) }
}

type Evento = { roomId: string; date: string }

// Statistiche di pulizie e cambi biancheria, in fondo alla pagina Pulizie.
//
// Due fonti, con un confine netto (CUTOFF_STORICO, 24/08/2026):
//  - PRIMA del confine: stime dalle prenotazioni, come da sempre (una pulizia
//    per ogni partenza, un cambio ogni 4 notti di soggiorno);
//  - DAL confine in poi: la tabella cleanings, cioè le pulizie realmente
//    segnate da Ania. Numeri veri, non più stimati — comprese rimandate
//    e saltate, che prima non lasciavano traccia — PIÙ le pulizie
//    automatiche dei cambi ospite (partenza e nuovo arrivo lo stesso giorno
//    o il giorno dopo: lib/pulizie, regola del 04/09/2026), anche nelle
//    settimane passate. Una pulizia segnata a mano lo stesso giorno nella
//    stessa camera non si conta due volte (lo garantisce pulizieAutomatiche).
export default function Statistiche({ rooms, bookings, events, td }:
  { rooms: any[]; bookings: any[]; events: Decisione[]; td: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('mese')
  const [offset, setOffset] = useState(0)

  const { pulizie, cambi, rimandate, saltate, ritardi } = useMemo(() => {
    const pulizie: Evento[] = []
    const cambi: Evento[] = []
    const rimandate: Evento[] = []
    const saltate: Evento[] = []
    const ritardi: number[] = []   // giorni di rinvio di ogni "rimandata" (per la media)

    // --- Stime per il passato (prima del confine) ---
    for (const room of rooms) {
      const own = bookings
        .filter(b => b.room_id === room.id)
        .sort((a, b) => a.check_in.localeCompare(b.check_in))
      // Unisce i prolungamenti in soggiorni continuativi
      const soggiorni: any[][] = []
      for (const b of own) {
        const ultimo = soggiorni[soggiorni.length - 1]
        const coda = ultimo?.[ultimo.length - 1]
        if (coda && coda.guest_id && coda.guest_id === b.guest_id && coda.check_out === b.check_in) ultimo.push(b)
        else soggiorni.push([b])
      }
      // Una pulizia per ogni soggiorno concluso prima del confine (al cambio
      // ospite la pulizia c'è sempre stata). Dal confine in poi contano solo
      // le pulizie segnate davvero.
      const conclusi = soggiorni.filter(s => s[s.length - 1].check_out <= td && s[s.length - 1].check_out < CUTOFF_STORICO)
      conclusi.forEach(s => {
        const coda = s[s.length - 1]
        const cleanedAt = s.map(x => x.cleaned_at).filter(Boolean).sort().slice(-1)[0]
        let date = cleanedAt ? cleanedAt.slice(0, 10) : coda.check_out
        // Una pulizia segnata in ritardo non può cadere dopo l'arrivo dell'ospite
        // successivo: la camera era per forza già pulita a quell'arrivo
        const arrivoDopo = soggiorni[soggiorni.indexOf(s) + 1]?.[0]?.check_in
        if (arrivoDopo && date > arrivoDopo) date = arrivoDopo
        pulizie.push({ roomId: room.id, date })
      })
      for (const s of soggiorni) {
        if (s.some(x => SOGGIORNI_SENZA_CAMBIO.includes(x.id))) continue
        const inizio = s[0].check_in
        const fine = s[s.length - 1].check_out
        // Cambi stimati SOLO fino al confine: da lì in poi valgono le decisioni vere
        const limite = CUTOFF_STORICO < fine ? CUTOFF_STORICO : fine
        const linen = s.map(x => x.linen_next_date).filter(Boolean).sort().slice(-1)[0]
        if (linen) {
          for (let d = addDaysStr(linen, -NOTTI_CAMBIO); d > inizio; d = addDaysStr(d, -NOTTI_CAMBIO)) {
            if (d < limite && d <= td) cambi.push({ roomId: room.id, date: d })
          }
        } else {
          for (let d = addDaysStr(inizio, NOTTI_CAMBIO); d < limite && d <= td; d = addDaysStr(d, NOTTI_CAMBIO)) {
            cambi.push({ roomId: room.id, date: d })
          }
        }
      }
    }

    // --- Dati veri (tabella cleanings) ---
    for (const e of events) {
      if (e.stato === 'fatta') {
        const date = e.data_effettiva || e.data_prevista
        if (e.tipo === 'soggiorno') cambi.push({ roomId: e.room_id, date })
        else pulizie.push({ roomId: e.room_id, date })
      } else if (e.stato === 'rimandata') {
        rimandate.push({ roomId: e.room_id, date: e.data_prevista })
        if (e.prossima_data) ritardi.push(diffDays(e.prossima_data, e.data_prevista))
      } else if (e.stato === 'saltata' && e.note !== NOTA_AUTOMATICA_TOLTA) {
        // «non fatta» su un'automatica toglie solo quella: non è una saltata concordata
        saltate.push({ roomId: e.room_id, date: e.data_prevista })
      }
    }

    // --- Cambi ospite automatici (dal confine in poi, fino a oggi) ---
    for (const a of pulizieAutomatiche(bookings, events, td)) pulizie.push({ roomId: a.roomId, date: a.data })

    return { pulizie, cambi, rimandate, saltate, ritardi }
  }, [rooms, bookings, events, td])

  const { inizio, fine, label } = intervallo(periodo, offset)
  const nelPeriodo = (e: Evento) => e.date >= inizio && e.date <= fine
  const pulizieP = pulizie.filter(nelPeriodo)
  const cambiP = cambi.filter(nelPeriodo)
  const rimandateP = rimandate.filter(nelPeriodo)
  const saltateP = saltate.filter(nelPeriodo)

  const perCamera = rooms.map(room => ({
    room,
    shortName: room.name.split(' ').slice(-1)[0],
    pulizie: pulizieP.filter(e => e.roomId === room.id).length,
    cambi: cambiP.filter(e => e.roomId === room.id).length,
  }))
  const maxConteggio = Math.max(1, ...perCamera.map(c => Math.max(c.pulizie, c.cambi)))

  // Dato principale (04/09/2026): TOTALE INTERVENTI = pulizie (a mano e
  // automatiche) + cambi biancheria, con la media al giorno sui giorni già
  // trascorsi del periodo; sotto, in piccolo, «di cui N pulizie, N cambi»
  const riassunto = riassuntoInterventi(pulizie, cambi, inizio, fine, td)
  const top = perCamera.reduce((a, b) => (b.pulizie + b.cambi > a.pulizie + a.cambi ? b : a), perCamera[0])
  const ritardoMedio = ritardi.length > 0 ? Math.round((ritardi.reduce((a, b) => a + b, 0) / ritardi.length) * 10) / 10 : null

  return (
    <div className="mt-8">
      <h2 className="font-serif text-xl text-green-dark mb-1">Statistiche</h2>
      <p className="text-sm text-gray-500 mb-3">Quante volte sono state rifatte le camere</p>

      <div className="flex gap-1.5 mb-3">
        {(['settimana', 'mese', 'anno'] as Periodo[]).map(p => (
          <button key={p} onClick={() => { setPeriodo(p); setOffset(0) }}
            className={`rounded-full text-xs font-semibold px-3.5 py-1.5 capitalize transition-colors ${periodo === p ? 'text-cream-text' : 'border border-card-border bg-white text-stone'}`}
            style={periodo === p ? { background: '#2D6A4F' } : undefined}>
            {p}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mb-3">
        <button onClick={() => setOffset(offset - 1)} aria-label="Periodo precedente"
          className="shrink-0 rounded-full border border-card-border bg-white w-9 h-9 text-green-dark font-bold">‹</button>
        <span className="text-lg text-green-dark capitalize text-center min-w-[120px]" style={{ fontFamily: 'Georgia, serif', fontWeight: 600 }}>{label}</span>
        <button onClick={() => { if (offset < 0) setOffset(offset + 1) }} aria-label="Periodo successivo"
          className="shrink-0 rounded-full border border-card-border bg-white w-9 h-9 text-green-dark font-bold">›</button>
      </div>

      <div className="bg-white rounded-[10px] border border-card-border p-3.5 mb-3">
        <p className="text-xs text-gray-500">Interventi</p>
        <p className="font-serif text-3xl text-green-dark mt-0.5">{riassunto.interventi}</p>
        <p className="text-[11px] text-stone mt-0.5">{testoDettaglio(riassunto)}</p>
      </div>

      {(rimandateP.length > 0 || saltateP.length > 0) && (
        <div className="grid grid-cols-2 gap-2.5 mb-3">
          <div className="bg-white rounded-[10px] border border-card-border p-3.5">
            <p className="text-xs text-gray-500">Rimandate</p>
            <p className="font-serif text-3xl text-green-dark mt-0.5">{rimandateP.length}</p>
            {ritardoMedio != null && (
              <p className="text-[11px] text-stone mt-0.5">rinvio medio {ritardoMedio.toLocaleString('it-IT')} {ritardoMedio === 1 ? 'giorno' : 'giorni'}</p>
            )}
          </div>
          <div className="bg-white rounded-[10px] border border-card-border p-3.5">
            <p className="text-xs text-gray-500">Saltate</p>
            <p className="font-serif text-3xl text-green-dark mt-0.5">{saltateP.length}</p>
            <p className="text-[11px] text-stone mt-0.5">concordate con l&apos;ospite</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">Per camera</p>
          <p className="text-[11px] text-stone">
            <span className="inline-block w-2 h-2 rounded-full align-middle mr-1" style={{ background: '#6C9A7C' }} />pulizie
            <span className="inline-block w-2 h-2 rounded-full align-middle ml-2.5 mr-1" style={{ background: '#7C857A' }} />cambi
          </p>
        </div>
        {perCamera.map(({ room, shortName, pulizie, cambi }) => (
          <div key={room.id} className="mb-3 last:mb-0">
            <div className="flex items-baseline gap-2">
              <span className="font-serif text-sm text-brass">{ROOM_NUMBER_BY_NAME[shortName] || ''}</span>
              <span className="font-serif text-green-dark">{shortName}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 rounded-full" style={{ background: '#6C9A7C', width: `${(pulizie / maxConteggio) * 82}%`, minWidth: pulizie > 0 ? 6 : 0 }} />
              <span className="text-xs font-semibold text-green-dark">{pulizie}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="h-1.5 rounded-full" style={{ background: '#7C857A', width: `${(cambi / maxConteggio) * 82}%`, minWidth: cambi > 0 ? 6 : 0 }} />
              <span className="text-xs font-semibold text-stone">{cambi}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[10px] border border-card-border p-4 mb-3">
        <p className="text-sm text-green-dark">
          {riassunto.alGiorno === null ? testoMediaGiorno(riassunto)
            : <>In media <span className="font-bold">{riassunto.alGiorno === 1 ? 'un intervento' : `${riassunto.alGiorno.toLocaleString('it-IT')} interventi`}</span> al giorno</>}
        </p>
        {testoOgniGiorni(riassunto) && <p className="text-[11px] text-stone mt-0.5">{testoOgniGiorni(riassunto)}</p>}
        {top && top.pulizie + top.cambi > 0 && (
          <p className="text-sm text-green-dark mt-1">
            Camera più impegnativa: <span className="font-bold">{top.shortName}</span> ({top.pulizie + top.cambi} {top.pulizie + top.cambi === 1 ? 'intervento' : 'interventi'})
          </p>
        )}
      </div>

      <p className="text-[11px] text-stone leading-relaxed">
        Gli interventi sommano pulizie e cambi biancheria: ogni cambio vale uno.
        Fino al 23 agosto 2026 i numeri sono ricostruiti dalle prenotazioni (una
        pulizia per ogni partenza, un cambio stimato ogni {NOTTI_CAMBIO} notti; il
        soggiorno lungo di Giovanna in Amelia è escluso perché il cambio non è mai
        stato fatto). Dal 24 agosto contano le pulizie segnate davvero nella
        pagina, comprese rimandate e saltate, più quelle automatiche dei cambi
        ospite (partenza e nuovo arrivo lo stesso giorno o il giorno dopo).
      </p>
    </div>
  )
}
