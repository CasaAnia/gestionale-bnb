'use client'
import SezioneFogli from '@/components/maison/SezioneFogli'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getUpcomingRoomChanges, buildChangeGroups } from '@/lib/roomChanges'
import { nomeConAltri } from '@/lib/guestName'
import { useDemoMode } from '@/lib/useDemoMode'
import { useRichiesteWeb } from '@/lib/webRequests'
import AvvisoAzione from '@/components/AvvisoAzione'
import DaControllare from '@/components/DaControllare'
import RichiesteHome from '@/components/RichiesteHome'
import StrisciaFoto from '@/components/maison/StrisciaFoto'
import { partenzeConResiduo, vociDaIncassare, incassatiOggi, type PrenotazioneIncasso, type PagamentoIncasso } from '@/lib/incassiHome'
import SoldiHome from '@/components/maison/SoldiHome'
import { ricaricaDaControllare, useDaControllare } from '@/lib/daControllareDati'
import NumeriOggi from '@/components/NumeriOggi'
import PulizieOggi from '@/components/PulizieOggi'
import ArriviOggi from '@/components/ArriviOggi'
import { useNumeriOggi, ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { leggiDatiHome, type DatiHome } from '@/lib/statisticheDati'
import { cassaIntervallo, daIncassare, indiciIntervallo, spostaGiorni, TESTO_ANOMALIA_OCCUPAZIONE, pianoRicostruzione, etichettaIncassi } from '@/lib/statistiche'

// «Statistiche, numeri corretti» (05/09/2026): NESSUNA formula in questa
// pagina. I numeri del mese vengono da lib/statistiche sui dati del solo mese
// (lib/statisticheDati), solo prenotazioni confermate/completate; gli stessi
// quattro significati delle Statistiche. Denaro in centesimi → euro solo qui.
// «Da incassare €» nei numeri in cima: la somma dei residui della sezione Da incassare
const totaleDaIncassareEuro = (voci: { residuoCent: number }[]) => Math.round(voci.reduce((t, v) => t + v.residuoCent, 0) / 100)
const euro = (cent: number) => (cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
function ymd(d: Date) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
function today() { return ymd(new Date()) }
function tomorrow() { return spostaGiorni(today(), 1) }
/** «settembre» */
function nomeMese() { return new Date().toLocaleDateString('it-IT', { month: 'long', timeZone: 'Europe/Rome' }) }
function monthStart() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01` }
function nextMonthStart() { const d = new Date(); const n = new Date(d.getFullYear(), d.getMonth() + 1, 1); return ymd(n) }

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
  const indici = indiciIntervallo(ms, nms, d.camere, d.prenotazioni, d.fuoriServizio.intervalli)
  // Da incassare: soggiorni con movimenti registrati ma non saldati
  const nomeDi = new Map(d.prenotazioniConMovimenti.map((b: any) => [b.id, nomeConAltri(b)]))
  const daInc = daIncassare(d.prenotazioniConMovimenti, d.tuttiPagamenti).map(g => ({ ...g, guest: nomeDi.get(g.id) || g.nomi || 'Ospite' }))

  // R6: finché lo storico è da ricostruire la voce si chiama «Incassi registrati»
  const voceIncassi = etichettaIncassi(pianoRicostruzione(d.ricostruzione.prenotazioni, d.ricostruzione.pagamenti, d.ricostruzione.oggi).movimenti.length)

  // Home «Maison» (28/09/2026): le partenze di oggi con un residuo, nella giornata
  const idsMese = new Set(d.prenotazioni.map(b => b.id))
  const tutte = [...d.prenotazioni, ...d.prenotazioniConMovimenti.filter(b => !idsMese.has(b.id))] as unknown as PrenotazioneIncasso[]
  const pagamenti = d.tuttiPagamenti as PagamentoIncasso[]
  const partenzeResiduo = partenzeConResiduo(checkOutOggi as PrenotazioneIncasso[], tutte, pagamenti)
  // «Da incassare» e «Incassati oggi» (lib/incassiHome): le stesse voci e cifre di daIncassare, con le parole della veste nuova
  const vociIncasso = vociDaIncassare(d.prenotazioniConMovimenti as unknown as PrenotazioneIncasso[], pagamenti, td)
  const incassiOggi = incassatiOggi(tutte, pagamenti, td)

  return { cassa, indici, voceIncassi, checkInOggi, checkOutOggi, checkInDomani, checkOutDomani, roomChangesOggi, roomChangesDomani, td, daIncassare: daInc, partenzeResiduo, vociIncasso, incassiOggi }
}

export default function Dashboard() {
  // Numeri di oggi, striscia della settimana e «Pulizie di oggi»: una sola lettura (07/09/2026)
  const numeriOggi = useNumeriOggi()
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
  const controlli = useDaControllare()
  const numeroRichieste = richiesteWeb.richieste.length + (controlli.stato === 'pronto' ? controlli.eccezioni.filter(e => e.tipo === 'richiesta').length : 0)

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

  function aggiornaArrivo(id: string, campi: Record<string, unknown>) {
    void ricaricaDaControllare() // rimuove l’avviso di orario mancante appena risolto
    ricaricaNumeriOggiOvunque() // anche il prospetto pulizie mostra l’orario aggiornato
    // Il foglio restituisce i campi riletti dal server. Aggiorniamo anche le
    // righe Oggi/Domani più in basso, senza spostare la pagina o i conteggi.
    setData((prima: ReturnType<typeof calcola> | null) => {
      if (!prima) return prima
      const aggiorna = (righe: Record<string, unknown>[]) => righe.map(b => b.id === id ? { ...b, ...campi } : b)
      return { ...prima,
        checkInOggi: aggiorna(prima.checkInOggi), checkInDomani: aggiorna(prima.checkInDomani),
        checkOutOggi: aggiorna(prima.checkOutOggi), checkOutDomani: aggiorna(prima.checkOutDomani),
      }
    })
  }

  // Dopo un pagamento dalla Home (Segna pagato, Registra pagamento) si rilegge in silenzio
  function dopoPagamento() {
    void ricaricaDaControllare()
    setTentativo(t => t + 1)
  }

  return (
    <SezioneFogli sezione="home">
    <div className="maison mz-home -mt-12 lg:mt-0 pb-8" data-senza-sottolinea>
      <StrisciaFoto />

      {(numeroRichieste > 0 || richiesteWeb.stato === 'errore' || controlli.stato === 'errore') && <details className="mz-req" data-richieste-home>
        <summary><span style={{ fontSize: 15 }} aria-hidden>🌐</span><b>{numeroRichieste > 0 ? `${numeroRichieste} ${numeroRichieste === 1 ? 'richiesta da gestire' : 'richieste da gestire'}` : 'Richieste da controllare'}</b></summary>
        <RichiesteHome web={richiesteWeb} controlli={controlli} />
      </details>}
      <NumeriOggi dati={numeriOggi} daIncassareEuro={!loading && !errore && data ? totaleDaIncassareEuro(data.daIncassare) : null} />

      {/* «La giornata» e «Arrivi di domani» (Home «Maison», 28/09/2026; gli
          arrivi in cima dal 21/09/2026, Ania: «nella home mettiamoli in alto,
          non a metà pagina»). Qui dentro anche le partenze di oggi con un
          residuo e i cambi camera: il vecchio blocco «Oggi / Domani» non c'è
          più. Finché i dati si caricano non occupa spazio. */}
      {!loading && !errore && data && <ArriviOggi oggi={data.checkInOggi} domani={data.checkInDomani} partenze={data.partenzeResiduo} cambi={data.roomChangesOggi}
        partenzeOggi={data.checkOutOggi.length} onSalvato={aggiornaArrivo} onPagato={dopoPagamento} />}

      {/* «Pulizie di oggi» (Ania, 07/09/2026; in cima dall'11/09/2026): TUTTE le
          pulizie della giornata da spuntare dalla Home, stessa lettura dei numeri
          e della striscia; senza pulizie non compare. Le pulizie stanno SOLO qui:
          «Da controllare» non le ripete più (Ania, 11/09/2026: «due stanze sopra e
          tre sotto è confusionale, voglio vedere da fare oggi») */}
      <PulizieOggi dati={numeriOggi} />

      {/* «Da controllare» (versione B, 06/09/2026; in cima dal 07/09/2026): striscia
          con i conteggi e sezione delle eccezioni SOPRA i numeri del giorno; con
          zero eccezioni non occupa spazio (components/DaControllare) */}
      <DaControllare dati={controlli} />

      {loading ? (
        <div className="mz-caricamento">Caricamento…</div>
      ) : errore ? (
        <div className="mx-[var(--home-gutter)] mt-3"><AvvisoAzione testo={errore} onRiprova={riprova} /></div>
      ) : (
        <>
          {/* «Da incassare» e «Incassati oggi» (Home «Maison», 28/09/2026) */}
          <SoldiHome voci={data.vociIncasso} incassati={data.incassiOggi} onPagato={dopoPagamento} />

          {/* «Il mese»: sei cifre su due colonne, sotto le descrizioni in una riga
              grigia. Gli stessi significati delle Statistiche (05/09/2026). */}
          <section className="mz-sec" data-mese>
            <p className="mz-eyebrow">Il mese <small>· {nomeMese()}</small></p>
            <div className="mz-mese">
              <div>Ricavi per soggiorno<b>{euro(data.cassa.ricaviCent)} €</b></div>
              <div>{data.voceIncassi.etichetta}<b>{euro(data.cassa.incassiCent)} €</b></div>
              <div>Spese<b>{euro(data.cassa.speseCent)} €</b></div>
              <div>Saldo di cassa<b>{euro(data.cassa.saldoCent)} €</b></div>
              <div>Occupazione<b>{data.indici.percento} %</b></div>
              <div>Tariffa media<b>{euro(data.indici.adrCent)} €</b></div>
            </div>
            <p className="mz-mese-note" data-descrizioni-mese>
              Ricavi = valore delle prenotazioni confermate, diviso sulle notti dormite nel mese · {data.voceIncassi.etichetta} = pagamenti registrati nel mese, per data di pagamento{data.voceIncassi.avviso ? <> ({data.voceIncassi.avviso})</> : null} · Spese = spese del B&amp;B, per data di pagamento · Saldo di cassa = incassi meno spese del mese · Occupazione = {data.indici.anomalia
                ? <>{TESTO_ANOMALIA_OCCUPAZIONE}: {data.indici.nottiVendute} notti su {data.indici.nottiVendibili}</>
                : <>notti vendute su notti vendibili delle camere in servizio ({data.indici.nottiVendute} su {data.indici.nottiVendibili})</>} · Tariffa media = ricavi per soggiorno diviso le notti vendute nel mese
            </p>
          </section>

          {/* Scorciatoie: righe col filo e la freccia d'ottone */}
          <section className="mz-sec" data-vai-a>
            <p className="mz-eyebrow">Vai a</p>
            <div className="mz-vai">
              <Link href="/prenotazioni"><span>Prenotazioni</span><span>→</span></Link>
              <Link href="/statistiche"><span>Statistiche</span><span>→</span></Link>
              {!demo && <Link href="/spese"><span>Spese B&B</span><span>→</span></Link>}
              {!demo && <Link href="/spese-famiglia"><span>Spese Famiglia</span><span>→</span></Link>}
              <Link href="/impostazioni"><span>Impostazioni e notifiche</span><span>→</span></Link>
            </div>
          </section>
        </>
      )}
    </div>
    </SezioneFogli>
  )
}
