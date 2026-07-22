'use client'
import { useMemo, useState } from 'react'
import { ROOM_NUMBER_BY_NAME } from '@/lib/roomTypes'

// Ogni quante notti di permanenza va rifatta la biancheria (stessa regola della pagina Pulizie)
const NOTTI_CAMBIO = 4

// Soggiorni senza mai cambio biancheria: lo storico è stimato "1 cambio ogni 4 notti",
// ma per questi soggiorni sappiamo che il cambio non è mai stato fatto.
// Giovanna Ricci, Amelia, 4 maggio – 13 giugno 2026 (40 notti).
const SOGGIORNI_SENZA_CAMBIO = ['9d539f6d-85c8-4da6-9da6-7aaa74dce042']

function addDaysStr(s: string, n: number) {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(y, m - 1, d + n)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

function diffDays(a: string, b: string) {
  const [ay, am, ad] = a.split('-').map(Number)
  const [by, bm, bd] = b.split('-').map(Number)
  return Math.round((new Date(ay, am - 1, ad).getTime() - new Date(by, bm - 1, bd).getTime()) / 86400000)
}

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

// Statistiche di pulizie e cambi biancheria, mostrate in fondo alla pagina Pulizie.
// Riceve rooms/bookings/localCleaned già caricati dalla pagina.
export default function Statistiche({ rooms, bookings, localCleaned, td }:
  { rooms: any[]; bookings: any[]; localCleaned: string[]; td: string }) {
  const [periodo, setPeriodo] = useState<Periodo>('mese')
  const [offset, setOffset] = useState(0)

  // Ricostruisce lo storico: ogni soggiorno concluso = 1 pulizia (alla partenza c'è
  // sempre stata la pulizia); cambi biancheria stimati ogni 4 notti di soggiorno.
  // I prolungamenti (stesso ospite, stessa camera, date contigue) sono un unico soggiorno.
  const { pulizie, cambi } = useMemo(() => {
    const pulizie: Evento[] = []
    const cambi: Evento[] = []
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
      const conclusi = soggiorni.filter(s => s[s.length - 1].check_out <= td)
      conclusi.forEach((s, i) => {
        const coda = s[s.length - 1]
        const cleanedAt = s.map(x => x.cleaned_at).filter(Boolean).sort().slice(-1)[0]
        const segnataLocale = s.some(x => localCleaned.includes(x.id))
        // L'ultima partenza della camera non ancora segnata pulita è ancora "da pulire"
        // e non va contata — ma solo finché l'ospite successivo non è arrivato: se è
        // già entrato, la camera è stata per forza pulita anche senza premere il
        // pulsante. Le partenze più vecchie senza cleaned_at sono di prima della
        // funzione "segna pulita" e si considerano fatte alla partenza.
        const arrivoDopo = soggiorni[soggiorni.indexOf(s) + 1]?.[0]?.check_in
        const ancoraDaPulire = i === conclusi.length - 1 && !cleanedAt && !segnataLocale
          && !(arrivoDopo && arrivoDopo <= td)
        if (ancoraDaPulire) return
        let date = cleanedAt ? cleanedAt.slice(0, 10) : coda.check_out
        // Una pulizia segnata in ritardo non può cadere dopo l'arrivo dell'ospite
        // successivo: la camera era per forza già pulita a quell'arrivo
        if (arrivoDopo && date > arrivoDopo) date = arrivoDopo
        pulizie.push({ roomId: room.id, date })
      })
      for (const s of soggiorni) {
        if (s.some(x => SOGGIORNI_SENZA_CAMBIO.includes(x.id))) continue
        const inizio = s[0].check_in
        const fine = s[s.length - 1].check_out
        // Se l'app ha registrato la data del prossimo cambio (linen_next_date), i cambi
        // fatti sono quelli a ritroso ogni 4 notti da lì: più preciso della stima in
        // avanti, e non conta un cambio previsto ma mai segnato fatto (es. a fine
        // soggiorno). Senza quel dato resta la stima: un cambio ogni 4 notti dall'inizio.
        const linen = s.map(x => x.linen_next_date).filter(Boolean).sort().slice(-1)[0]
        if (linen) {
          for (let d = addDaysStr(linen, -NOTTI_CAMBIO); d > inizio; d = addDaysStr(d, -NOTTI_CAMBIO)) {
            if (d < fine && d <= td) cambi.push({ roomId: room.id, date: d })
          }
        } else {
          for (let d = addDaysStr(inizio, NOTTI_CAMBIO); d < fine && d <= td; d = addDaysStr(d, NOTTI_CAMBIO)) {
            cambi.push({ roomId: room.id, date: d })
          }
        }
      }
    }
    return { pulizie, cambi }
  }, [rooms, bookings, localCleaned, td])

  const { inizio, fine, label } = intervallo(periodo, offset)
  const nelPeriodo = (e: Evento) => e.date >= inizio && e.date <= fine
  const pulizieP = pulizie.filter(nelPeriodo)
  const cambiP = cambi.filter(nelPeriodo)

  const perCamera = rooms.map(room => ({
    room,
    shortName: room.name.split(' ').slice(-1)[0],
    pulizie: pulizieP.filter(e => e.roomId === room.id).length,
    cambi: cambiP.filter(e => e.roomId === room.id).length,
  }))
  const maxConteggio = Math.max(1, ...perCamera.map(c => Math.max(c.pulizie, c.cambi)))

  // "In media una pulizia ogni X giorni" sui giorni già trascorsi del periodo
  const giorniTrascorsi = Math.max(1, diffDays((fine < td ? fine : td), inizio) + 1)
  const ogniQuanti = pulizieP.length > 0 ? giorniTrascorsi / pulizieP.length : null
  const top = perCamera.reduce((a, b) => (b.pulizie + b.cambi > a.pulizie + a.cambi ? b : a), perCamera[0])

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

      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setOffset(offset - 1)} aria-label="Periodo precedente"
          className="rounded-full border border-card-border bg-white w-9 h-9 text-green-dark font-bold">‹</button>
        <span className="font-serif text-lg text-green-dark capitalize">{label}</span>
        <button onClick={() => setOffset(offset + 1)} disabled={offset >= 0} aria-label="Periodo successivo"
          className="rounded-full border border-card-border bg-white w-9 h-9 text-green-dark font-bold disabled:opacity-30">›</button>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-3">
        <div className="bg-white rounded-[10px] border border-card-border p-3.5">
          <p className="text-xs text-gray-500">Pulizie fatte</p>
          <p className="font-serif text-3xl text-green-dark mt-0.5">{pulizieP.length}</p>
        </div>
        <div className="bg-white rounded-[10px] border border-card-border p-3.5">
          <p className="text-xs text-gray-500">Cambi biancheria</p>
          <p className="font-serif text-3xl text-green-dark mt-0.5">{cambiP.length}</p>
        </div>
      </div>

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
          {ogniQuanti == null ? 'Nessuna pulizia in questo periodo'
            : Math.round(ogniQuanti * 10) / 10 <= 1 ? <>In media <span className="font-bold">una pulizia al giorno</span></>
            : <>In media una pulizia ogni <span className="font-bold">{(Math.round(ogniQuanti * 10) / 10).toLocaleString('it-IT')}</span> giorni</>}
        </p>
        {top && top.pulizie + top.cambi > 0 && (
          <p className="text-sm text-green-dark mt-1">
            Camera più impegnativa: <span className="font-bold">{top.shortName}</span> ({top.pulizie + top.cambi} lavori)
          </p>
        )}
      </div>

      <p className="text-[11px] text-stone leading-relaxed">
        Le pulizie contano una per ogni partenza. I cambi biancheria del passato sono stimati
        (uno ogni {NOTTI_CAMBIO} notti di soggiorno); il soggiorno lungo di Giovanna in Amelia
        (maggio–giugno) è escluso perché il cambio non è mai stato fatto.
      </p>
    </div>
  )
}
