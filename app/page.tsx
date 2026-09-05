'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUpcomingRoomChanges, buildChangeGroups } from '@/lib/roomChanges'
import { nomeOspite } from '@/lib/guestName'
import { useDemoMode } from '@/lib/useDemoMode'
import { useRichiesteWeb } from '@/lib/webRequests'
import AvvisoAzione from '@/components/AvvisoAzione'
import { leggiDatiHome, type DatiHome } from '@/lib/statisticheDati'
import { cassaIntervallo, daIncassare, indiciIntervallo, spostaGiorni, TESTO_ANOMALIA_OCCUPAZIONE, pianoRicostruzione, etichettaIncassi } from '@/lib/statistiche'

// «Statistiche, numeri corretti» (05/09/2026): NESSUNA formula in questa
// pagina. I numeri del mese vengono da lib/statistiche sui dati del solo mese
// (lib/statisticheDati), solo prenotazioni confermate/completate; gli stessi
// quattro significati delle Statistiche. Denaro in centesimi → euro solo qui.
const euro = (cent: number) => (cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function today() { return ymd(new Date()) }
function tomorrow() { return spostaGiorni(today(), 1) }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function nextMonthStart() { const d = new Date(); const n = new Date(d.getFullYear(), d.getMonth() + 1, 1); return ymd(n) }
function italianDate() {
  return new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Tutti i numeri da lib/statistiche; qui solo la scelta delle righe da mostrare
function calcola(d: DatiHome, td: string, tmr: string, ms: string, nms: string) {
  const active: any[] = d.prenotazioni
  const roomNameById: Record<string, string> = {}
  active.forEach((x: any) => { if (x.rooms?.name) roomNameById[x.room_id] = x.rooms.name.split(' ').slice(-1)[0] })
  const roomChanges = getUpcomingRoomChanges(active, roomNameById, [td, tmr])

  // Un cambio camera di oggi non è né un check-in né un check-out: il segmento in
  // arrivo (to) e quello in partenza (from) vanno tolti dalle liste e mostrati solo
  // nella riga dedicata "⇄ CAMBIO".
  const byId = new Map(active.map((x: any) => [x.id, x]))
  const { edges } = buildChangeGroups(active)
  const cambioInIds = new Set<string>()
  const cambioOutIds = new Set<string>()
  const cambioInDomaniIds = new Set<string>()
  const cambioOutDomaniIds = new Set<string>()
  for (const e of edges) {
    const from: any = byId.get(e.fromId)
    const to: any = byId.get(e.toId)
    if (!from || !to) continue
    if (to.check_in === td) {
      cambioInIds.add(to.id)
      if (from.check_out === td) cambioOutIds.add(from.id)
    }
    if (to.check_in === tmr) {
      cambioInDomaniIds.add(to.id)
      if (from.check_out === tmr) cambioOutDomaniIds.add(from.id)
    }
  }
  const checkInOggi = active.filter((x: any) => x.check_in === td && !cambioInIds.has(x.id))
  const checkOutOggi = active.filter((x: any) => x.check_out === td && !cambioOutIds.has(x.id))
  const checkInDomani = active.filter((x: any) => x.check_in === tmr && !cambioInDomaniIds.has(x.id))
  const checkOutDomani = active.filter((x: any) => x.check_out === tmr && !cambioOutDomaniIds.has(x.id))
  const roomChangesOggi = roomChanges.filter((m: any) => m.date === td)
  const roomChangesDomani = roomChanges.filter((m: any) => m.date === tmr)

  // I quattro significati del mese (lib/statistiche/intervallo)
  const cassa = cassaIntervallo(d.prenotazioni, d.pagamentiMese, d.spese, ms, nms)
  // Occupazione = notti vendute ÷ notti vendibili (camere attive); ADR = tariffa media
  const indici = indiciIntervallo(ms, nms, d.camere, d.prenotazioni)
  // Da incassare: soggiorni con movimenti registrati ma non saldati
  const nomeDi = new Map(d.prenotazioniConMovimenti.map((b: any) => [b.id, nomeOspite(b)]))
  const daInc = daIncassare(d.prenotazioniConMovimenti, d.tuttiPagamenti).map(g => ({ ...g, guest: nomeDi.get(g.id) || g.nomi || 'Ospite' }))

  // R6: finché lo storico è da ricostruire la voce si chiama «Incassi registrati»
  const voceIncassi = etichettaIncassi(pianoRicostruzione(d.ricostruzione.prenotazioni, d.ricostruzione.pagamenti, d.ricostruzione.oggi).movimenti.length)

  return { cassa, indici, voceIncassi, checkInOggi, checkOutOggi, checkInDomani, checkOutDomani, roomChangesOggi, roomChangesDomani, td, daIncassare: daInc }
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  // Errore di caricamento (rete o server): la home NON mostra mai zeri al
  // posto dei numeri veri, mostra il messaggio e il tasto «Riprova».
  const [errore, setErrore] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)
  const demo = useDemoMode()
  // Richieste dal sito: tre stati distinti sullo schermo (caricamento,
  // nessuna richiesta, errore di lettura). Errori visibili, 05/09/2026.
  const richiesteWeb = useRichiesteWeb()

  useEffect(() => {
    let vivo = true
    const td = today()
    const tmr = tomorrow()
    const ms = monthStart()
    const nms = nextMonthStart()
    // Si legge il mese; se domani cade nel mese dopo, si allunga di un giorno per «Domani»
    const fine = spostaGiorni(tmr, 1) > nms ? spostaGiorni(tmr, 1) : nms
    leggiDatiHome(ms, fine, td).then(({ data: d, errore: e }) => {
      if (!vivo) return
      if (e || !d) { setErrore(e ?? 'Non riesco a caricare i dati, riprova'); setLoading(false); return }
      setData(calcola(d, td, tmr, ms, nms))
      setErrore(null)
      setLoading(false)
    })
    return () => { vivo = false }
  }, [tentativo])

  function riprova() {
    setErrore(null)
    setLoading(true)
    setTentativo(t => t + 1)
  }

  // Righe di un giorno (arrivi, partenze, cambi camera). Il prefisso rende le key
  // uniche tra le sezioni Oggi e Domani (una prenotazione può arrivare oggi e
  // ripartire domani, comparendo in entrambe).
  function renderEventi(prefix: string, checkIn: any[], checkOut: any[], changes: any[]) {
    return (
      <>
        {checkIn.map((b: any) => (
          <div key={`${prefix}-in-${b.id}`} className="flex flex-wrap items-center gap-2 text-sm py-1">
            <span className="bg-sage text-green-dark rounded px-1.5 py-0.5 text-xs font-bold">CHECK-IN</span>
            <span className="font-medium">{nomeOspite(b)}</span>
            <span className="text-gray-500">— {b.rooms?.name}</span>
            {b.check_in_time && <span className="bg-sage text-green-mid rounded px-1.5 py-0.5 text-xs font-bold">🕐 {b.check_in_time}</span>}
            {b.extra_bed && <span className="bg-[#F1E0CE] text-[#7A4B22] rounded px-1 text-xs">+letto agg.</span>}
          </div>
        ))}
        {checkOut.map((b: any) => (
          <div key={`${prefix}-out-${b.id}`} className="flex flex-wrap items-center gap-2 text-sm py-1">
            <span className="bg-[#F4E6DF] text-[#7A3B22] rounded px-1.5 py-0.5 text-xs font-bold">CHECK-OUT</span>
            <span className="font-medium">{nomeOspite(b)}</span>
            <span className="text-gray-500">— {b.rooms?.name}</span>
          </div>
        ))}
        {changes.map((m: any) => (
          <div key={`${prefix}-ch-${m.id}`} className="flex flex-wrap items-center gap-2 text-sm py-1">
            <span className="rounded px-1.5 py-0.5 text-xs font-bold" style={{ background: '#EFE2C7', color: '#7A5C1E' }}>⇄ CAMBIO</span>
            <span className="font-medium">{m.guest}</span>
            <span className="text-gray-500">— {m.fromRoom} → {m.toRoom}</span>
          </div>
        ))}
      </>
    )
  }

  return (
    <div className="p-4">
      <div className="mb-4">
        <h1 className="font-serif text-2xl text-green-dark">Buongiorno, Ania</h1>
        <p className="text-sm text-gray-500 capitalize">{italianDate()}</p>
      </div>

      {richiesteWeb.stato === 'errore' ? (
        <AvvisoAzione testo={richiesteWeb.errore} onRiprova={richiesteWeb.ricarica} className="mb-4" />
      ) : richiesteWeb.stato === 'caricamento' ? (
        <p className="text-[13px] mb-4" style={{ color: 'var(--color-stone)' }}>Controllo le richieste dal sito…</p>
      ) : richiesteWeb.richieste.length === 0 ? (
        <p className="text-[13px] mb-4" style={{ color: 'var(--color-stone)' }}>Nessuna richiesta dal sito da confermare.</p>
      ) : (
        <Link href="/calendario" className="block bg-white rounded-[10px] border border-[#C9BFA8] shadow-sm px-3 py-2.5 mb-4 text-sm font-semibold text-green-dark">
          🌐 {richiesteWeb.richieste.length === 1 ? '1 richiesta dal sito da confermare' : `${richiesteWeb.richieste.length} richieste dal sito da confermare`}
          <span className="font-normal" style={{ color: 'var(--color-stone)' }}> · {richiesteWeb.richieste[0].guest_name}{richiesteWeb.richieste.length > 1 ? ' e altre' : ''}</span>
        </Link>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : errore ? (
        <AvvisoAzione testo={errore} onRiprova={riprova} />
      ) : (
        <>
          {(() => {
            const hasOggi = data.checkInOggi.length > 0 || data.checkOutOggi.length > 0 || data.roomChangesOggi.length > 0
            const hasDomani = data.checkInDomani.length > 0 || data.checkOutDomani.length > 0 || data.roomChangesDomani.length > 0
            if (!hasOggi && !hasDomani) return null
          {/* Riquadri come nella scheda prenotazione e nel campo «Cerca nome»: bianchi, bordo #C9BFA8, ombra leggera (Ania, 05/09/2026) */}
            return (
              <div className="bg-white rounded-[10px] border border-[#C9BFA8] shadow-sm p-3 mb-4">
                {hasOggi && (
                  <>
                    <p className="text-[11px] uppercase mb-2.5 text-brass" style={{ letterSpacing: '2px' }}>Oggi</p>
                    {renderEventi('oggi', data.checkInOggi, data.checkOutOggi, data.roomChangesOggi)}
                  </>
                )}
                {hasDomani && (
                  <>
                    {hasOggi && <div className="border-t border-card-border mt-3 mb-2.5" />}
                    <p className="text-[11px] uppercase mb-2.5" style={{ letterSpacing: '2px', color: '#8a9488' }}>Domani</p>
                    {renderEventi('domani', data.checkInDomani, data.checkOutDomani, data.roomChangesDomani)}
                  </>
                )}
              </div>
            )
          })()}

          {data.daIncassare?.length > 0 && (
            <div className="bg-white rounded-[10px] border border-[#C9BFA8] shadow-sm p-3 mb-4">
              <p className="text-[11px] uppercase mb-1.5 text-brass" style={{ letterSpacing: '2px' }}>💶 Da incassare</p>
              {data.daIncassare.map((g: any) => (
                <Link key={g.id} href={`/prenotazioni/${g.id}`} className="flex items-center justify-between py-1.5 border-t border-card-border text-sm">
                  <span className="font-medium text-green-dark">{g.guest}</span>
                  <span className="font-bold" style={{ color: '#8a4f2f' }}>€{euro(g.residuoCent)}</span>
                </Link>
              ))}
            </div>
          )}

          {/* Quattro significati separati, identici alle Statistiche (05/09/2026) */}
          <div className="bg-white rounded-[10px] p-5 border border-[#C9BFA8] shadow-sm mb-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1">Ricavi per soggiorno</p>
                <p className="font-serif text-2xl text-green-dark">€{euro(data.cassa.ricaviCent)}</p>
                <p className="text-[11px] leading-tight text-gray-500 mt-1">valore delle prenotazioni confermate, diviso sulle notti dormite nel mese</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1">{data.voceIncassi.etichetta}</p>
                <p className="font-serif text-2xl text-green-dark">€{euro(data.cassa.incassiCent)}</p>
                <p className="text-[11px] leading-tight text-gray-500 mt-1">pagamenti registrati nel mese, per data di pagamento{data.voceIncassi.avviso ? <> · <span className="font-semibold text-green-dark">{data.voceIncassi.avviso}</span></> : null}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-white rounded-[10px] p-5 border border-[#C9BFA8] shadow-sm">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Saldo di cassa</p>
              <p className={`font-serif text-2xl ${data.cassa.saldoCent >= 0 ? 'text-green-dark' : 'text-[#8C3B2E]'}`}>€{euro(data.cassa.saldoCent)}</p>
              <p className="text-[11px] leading-tight text-gray-500 mt-1">incassi meno spese del mese</p>
            </div>
            <div className="bg-white rounded-[10px] p-5 border border-[#C9BFA8] shadow-sm">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Spese</p>
              <p className="font-serif text-2xl text-[#8C3B2E]">€{euro(data.cassa.speseCent)}</p>
              <p className="text-[11px] leading-tight text-gray-500 mt-1">spese del B&amp;B, per data di pagamento</p>
            </div>
            <div className="bg-white rounded-[10px] p-5 border border-[#C9BFA8] shadow-sm">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Occupazione</p>
              <p className="font-serif text-2xl text-green-dark">{data.indici.percento}<span className="text-base text-gray-400">% mese</span></p>
              <p className="text-[11px] leading-tight text-gray-500 mt-1">
                {data.indici.anomalia
                  ? <span className="font-semibold text-green-dark">{TESTO_ANOMALIA_OCCUPAZIONE}: {data.indici.nottiVendute} notti su {data.indici.nottiVendibili}</span>
                  : <>notti vendute su notti vendibili delle camere attive ({data.indici.nottiVendute} su {data.indici.nottiVendibili})</>}
              </p>
            </div>
            <div className="bg-white rounded-[10px] p-5 border border-[#C9BFA8] shadow-sm">
              <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-1.5">Tariffa media</p>
              <p className="font-serif text-2xl text-green-dark">€{euro(data.indici.adrCent)}</p>
              <p className="text-[11px] leading-tight text-gray-500 mt-1">ricavi per soggiorno diviso le notti vendute nel mese</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Link href="/prenotazioni" className="bg-white rounded-[10px] p-3 text-center border border-[#C9BFA8] shadow-sm">
              <div className="text-2xl">📅</div>
              <div className="text-xs font-semibold text-green-dark mt-1">Prenotazioni</div>
            </Link>
            <Link href="/statistiche" className="bg-white rounded-[10px] p-3 text-center border border-[#C9BFA8] shadow-sm">
              <div className="text-2xl">📊</div>
              <div className="text-xs font-semibold text-green-dark mt-1">Statistiche</div>
            </Link>
            {!demo && (
              <Link href="/spese" className="bg-white rounded-[10px] p-3 text-center border border-[#C9BFA8] shadow-sm">
                <div className="text-2xl">💶</div>
                <div className="text-xs font-semibold text-[#7A3B22] mt-1">Spese B&B</div>
              </Link>
            )}
            {!demo && (
              <Link href="/spese-famiglia" className="bg-white rounded-[10px] p-3 text-center border border-[#C9BFA8] shadow-sm">
                <div className="text-2xl">👛</div>
                <div className="text-xs font-semibold text-[#7A3B22] mt-1">Spese Famiglia</div>
              </Link>
            )}
            <Link href="/impostazioni" className="bg-white rounded-[10px] p-3 text-center border border-[#C9BFA8] shadow-sm">
              <div className="text-2xl">🔔</div>
              <div className="text-xs font-semibold text-green-dark mt-1">Impostazioni e notifiche</div>
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
