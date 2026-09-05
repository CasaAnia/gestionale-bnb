'use client'
import { useEffect, useState } from 'react'
import BackBar from '@/components/BackBar'
import AvvisoAzione from '@/components/AvvisoAzione'
import { ROOM_NUMBER_BY_NAME } from '@/lib/roomTypes'
import { buildSiteFunnel, type SiteEvent } from '@/lib/siteStats'
import { leggiDatiStatistiche, type DatiStatistiche } from '@/lib/statisticheDati'
import { supabase } from '@/lib/supabase'
import { nomeOspite } from '@/lib/guestName'
import { messaggioNonSalvato } from '@/lib/scritturaSicura'
import { isErroreDiRete } from '@/lib/connessione'
import { cassaIntervallo, incassiCent, occupazioneIntervallo, ricaviPerCamera, scontiPeriodo, spostaGiorni, TESTO_ANOMALIA_OCCUPAZIONE, pianoRicostruzione, etichettaIncassi, rpcMancante, vociPerRpc, validaEsitoRicostruzione, type Occupazione } from '@/lib/statistiche'

// «Statistiche, numeri corretti» (05/09/2026): NESSUNA formula in questa
// pagina. Ogni numero viene da lib/statistiche (funzioni pure, testate) sui
// dati del solo periodo letto da lib/statisticheDati; contano solo le
// prenotazioni confermate/completate. Denaro in centesimi → euro solo qui.
const euro = (cent: number) => (cent / 100).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

// Data in formato YYYY-MM-DD nel fuso locale (mai toISOString: di notte scala al giorno prima).
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Lunedì della settimana che contiene `ref`.
function mondayOf(ref: Date) {
  const day = ref.getDay()
  const monday = new Date(ref); monday.setDate(ref.getDate() - (day === 0 ? 6 : day - 1))
  monday.setHours(0, 0, 0, 0)
  return monday
}

// Tutte le funzioni di periodo ricevono `ref`: la data di riferimento scelta con le frecce
// (oggi all'apertura), così si possono guardare anche settimane/mesi/anni passati.
function getWeekDays(ref: Date) {
  const monday = mondayOf(ref)
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    days.push(ymd(d))
  }
  return days
}

function getMonthDays(ref: Date) {
  const year = ref.getFullYear(); const month = ref.getMonth()
  const lastDay = new Date(year, month + 1, 0).getDate()
  const days = []
  for (let i = 1; i <= lastDay; i++) {
    days.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`)
  }
  return days
}

function getYearMonths(ref: Date) {
  const year = ref.getFullYear()
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
}

const primoDelMeseDopo = (mese: string) => {
  const [y, m] = mese.split('-').map(Number)
  return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
}

type Periodo = 'settimana' | 'mese' | 'anno'

// Intervallo [da, a) del periodo scelto
function intervalloPeriodo(ref: Date, period: Periodo): { da: string; a: string } {
  if (period === 'settimana') { const g = getWeekDays(ref); return { da: g[0], a: spostaGiorni(g[6], 1) } }
  if (period === 'mese') { const g = getMonthDays(ref); return { da: g[0], a: spostaGiorni(g[g.length - 1], 1) } }
  return { da: `${ref.getFullYear()}-01-01`, a: `${ref.getFullYear() + 1}-01-01` }
}

// Intervallo LETTO dal database: l'anno di `ref` (serve a occupazione e camere),
// allargato alla settimana se sta a cavallo di due anni. Mai tutto lo storico.
function intervalloLettura(ref: Date, period: Periodo): { da: string; a: string } {
  const anno = { da: `${ref.getFullYear()}-01-01`, a: `${ref.getFullYear() + 1}-01-01` }
  const p = intervalloPeriodo(ref, period)
  return { da: p.da < anno.da ? p.da : anno.da, a: p.a > anno.a ? p.a : anno.a }
}

// Sposta la data di riferimento di un periodo avanti (+1) o indietro (−1).
function shiftRef(ref: Date, period: Periodo, dir: 1 | -1) {
  const d = new Date(ref)
  if (period === 'settimana') d.setDate(d.getDate() + 7 * dir)
  else if (period === 'mese') { d.setDate(1); d.setMonth(d.getMonth() + dir) }
  else { d.setDate(1); d.setFullYear(d.getFullYear() + dir) }
  return d
}

// Vero se oggi cade nel periodo di `ref` (in quel caso la freccia avanti è spenta).
function isCurrentPeriod(ref: Date, period: Periodo) {
  const now = new Date()
  if (period === 'settimana') return ymd(mondayOf(ref)) === ymd(mondayOf(now))
  if (period === 'mese') return ref.getFullYear() === now.getFullYear() && ref.getMonth() === now.getMonth()
  return ref.getFullYear() === now.getFullYear()
}

// Etichetta del periodo mostrata fra le frecce: «1–7 set 2026», «Settembre 2026», «2026».
function periodLabel(ref: Date, period: Periodo) {
  if (period === 'anno') return String(ref.getFullYear())
  if (period === 'mese') return `${MESI_NOMI[ref.getMonth()]} ${ref.getFullYear()}`
  const a = mondayOf(ref)
  const b = new Date(a); b.setDate(a.getDate() + 6)
  const mese = (d: Date) => d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '')
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${mese(a)} ${a.getFullYear()}`
  return `${a.getDate()} ${mese(a)} – ${b.getDate()} ${mese(b)} ${b.getFullYear()}`
}

// Colore della cella occupazione: dal crema chiaro (0%) al verde scuro Casa Ania (100%).
function occColor(pct: number) {
  const t = Math.max(0, Math.min(1, pct / 100))
  const r = Math.round(237 + (45 - 237) * t)
  const g = Math.round(243 + (106 - 243) * t)
  const b = Math.round(233 + (79 - 233) * t)
  return `rgb(${r}, ${g}, ${b})`
}

const MESI_INIZIALI = ['G', 'F', 'M', 'A', 'M', 'G', 'L', 'A', 'S', 'O', 'N', 'D']
const MESI_NOMI = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']

function todayStr() { return ymd(new Date()) }

export default function Statistiche() {
  const [period, setPeriod] = useState<Periodo>('mese')
  // Data di riferimento del periodo: oggi all'apertura, poi spostata con le frecce.
  const [ref, setRef] = useState<Date>(() => new Date())
  const [data, setData] = useState<DatiStatistiche | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [tentativo, setTentativo] = useState(0)
  // R6: ricostruzione una tantum degli incassi storici (dietro il tasto di Ania)
  const [ricostruendo, setRicostruendo] = useState(false)
  const [erroreRicostruzione, setErroreRicostruzione] = useState<string | null>(null)
  const [esitoRicostruzione, setEsitoRicostruzione] = useState<string | null>(null)

  // Si rilegge quando cambia l'anno letto (frecce o periodo): solo quel periodo
  const lettura = intervalloLettura(ref, period)
  const chiaveLettura = `${lettura.da}|${lettura.a}`
  useEffect(() => {
    let vivo = true
    const [da, a] = chiaveLettura.split('|')
    leggiDatiStatistiche(da, a, todayStr()).then(({ data: d, errore: e }) => {
      if (!vivo) return
      if (e) { setErrore(e); setData(null); setLoading(false); return }
      setData(d)
      setErrore(null)
      setLoading(false)
    })
    return () => { vivo = false }
  }, [chiaveLettura, tentativo])

  function riprova() {
    setErrore(null)
    setLoading(true)
    setTentativo(t => t + 1)
  }

  // Righe del grafico e della tabella: ogni riga è un intervallo (giorno o
  // mese) e i suoi numeri vengono da cassaIntervallo (lib/statistiche)
  function calcPeriod() {
    if (!data) return []
    const riga = (label: string, da: string, a: string) => {
      const c = cassaIntervallo(data.prenotazioni, data.pagamenti, data.spese, da, a)
      return { label, ricavi: c.ricaviCent, incassi: c.incassiCent, spese: c.speseCent, saldo: c.saldoCent }
    }
    if (period === 'settimana') return getWeekDays(ref).map(day => riga(new Date(day).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric' }), day, spostaGiorni(day, 1)))
    if (period === 'mese') return getMonthDays(ref).map(day => riga(new Date(day).getDate().toString(), day, spostaGiorni(day, 1)))
    return getYearMonths(ref).map(month => riga(new Date(month + '-01').toLocaleDateString('it-IT', { month: 'short' }), `${month}-01`, primoDelMeseDopo(month)))
  }

  const intervallo = intervalloPeriodo(ref, period)
  const totali = data ? cassaIntervallo(data.prenotazioni, data.pagamenti, data.spese, intervallo.da, intervallo.a) : null

  // Sconti concessi nel periodo (mese o anno): pro-quota sulle notti dormite (lib/statistiche/sconti)
  const sconti = data && period !== 'settimana'
    ? { ...scontiPeriodo(data.prenotazioni, intervallo.da, intervallo.a), incassatoCent: incassiCent(data.pagamenti, intervallo.da, intervallo.a) }
    : null

  // Occupazione mese per mese dell'anno letto: notti vendute ÷ notti vendibili
  // (camere attive per giorno), MAI bloccata a 100: oltre è un'anomalia
  const occ: { anno: number; mesi: (Occupazione | null)[] } | null = data ? (() => {
    const anno = ref.getFullYear()
    const oggi = todayStr()
    const mesi = Array.from({ length: 12 }, (_, m) => {
      const da = `${anno}-${String(m + 1).padStart(2, '0')}-01`
      if (da > oggi) return null
      return occupazioneIntervallo(da, primoDelMeseDopo(da.slice(0, 7)), data.camere, data.prenotazioni)
    })
    return { anno, mesi }
  })() : null

  // Ricavi per camera dell'anno letto (competenza fino a stanotte), solo camere attive
  const roomStats = data ? ricaviPerCamera(ref.getFullYear(), todayStr(), data.camere, data.prenotazioni) : null
  const siteStats = data ? buildSiteFunnel(data.eventiSito as SiteEvent[], period, ref) : null
  const label = periodLabel(ref, period)
  const current = isCurrentPeriod(ref, period)

  const rows = calcPeriod()
  const maxIncassi = Math.max(...rows.map(r => r.incassi), 1)

  // R6: piano di ricostruzione (funzione pura) ed etichetta della voce Incassi
  const piano = data ? pianoRicostruzione(data.ricostruzione.prenotazioni, data.ricostruzione.pagamenti, data.ricostruzione.oggi) : { movimenti: [], totaleCent: 0, esclusi: [] }
  const voceIncassi = etichettaIncassi(piano.movimenti.length)
  const nomeDi = new Map((data?.ricostruzione.prenotazioni ?? []).map(b => [b.id, nomeOspite(b)]))

  // R9: alla RPC ricostruisci_incassi (proposta 0033) vanno SOLO identità e
  // chiavi del piano approvato; il server blocca, rilegge, ricalcola e scrive
  // il saldo effettivo in un'unica transazione. Una risposta di rete persa non
  // autorizza «nulla è stato scritto»: esito INCERTO, si rilegge e si
  // verifica il piano prima di dire com'è andata.
  async function confermaRicostruzione() {
    if (ricostruendo || piano.movimenti.length === 0) return
    setRicostruendo(true)
    setErroreRicostruzione(null)
    setEsitoRicostruzione(null)
    const voci = vociPerRpc(piano)
    try {
      const { data: r, error: e } = await supabase.rpc('ricostruisci_incassi', { p_piano: voci })
      if (e) {
        if (rpcMancante(e, 'ricostruisci_incassi')) { setErroreRicostruzione('Serve la migrazione 0033 (proposta in supabase/proposte) prima di ricostruire: nulla è stato scritto'); return }
        if (isErroreDiRete(e)) { setEsitoRicostruzione('Non so se la ricostruzione è stata scritta (risposta persa): rileggo e ricontrollo il piano'); riprova(); return }
        setErroreRicostruzione(`${messaggioNonSalvato(e)}: la ricostruzione è stata annullata per intero`)
        return
      }
      const esito = validaEsitoRicostruzione(r, voci.length)
      if (!esito) { setEsitoRicostruzione('Risposta del server non riconosciuta: rileggo e ricontrollo il piano prima di dare la ricostruzione per fatta'); riprova(); return }
      setEsitoRicostruzione(`Ricostruzione eseguita: ${esito.scritti} movimenti scritti${esito.saltati ? `, ${esito.saltati} già presenti` : ''}${esito.nulla ? `, ${esito.nulla} già coperti` : ''} — rileggo per conferma`)
      riprova()
    } finally {
      setRicostruendo(false)
    }
  }

  return (
    <div className="p-4">
      <BackBar href="/" />
      <h1 className="font-serif text-xl text-green-dark mb-4 max-lg:hidden">Statistiche</h1>

      <div className="flex gap-2 mb-3">
        {(['settimana', 'mese', 'anno'] as const).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${period === p ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-[#C9BFA8]'}`}>
            {p}
          </button>
        ))}
      </div>

      {/* Frecce per cambiare periodo; tocco sull'etichetta = torna a oggi */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-[#C9BFA8] shadow-sm mb-4">
        <button type="button" aria-label={`${period} precedente`} onClick={() => setRef(shiftRef(ref, period, -1))}
          className="px-5 py-1.5 text-2xl leading-none self-stretch text-green-dark active:bg-gray-50 rounded-l-xl">‹</button>
        <button type="button" onClick={() => setRef(new Date())} disabled={current}
          className="flex-1 py-2.5 text-sm font-semibold text-green-dark text-center">
          {label}
          {!current && <span className="block text-[10px] font-normal text-gray-400">tocca per tornare a oggi</span>}
        </button>
        <button type="button" aria-label={`${period} successivo`} onClick={() => setRef(shiftRef(ref, period, 1))} disabled={current}
          className={`px-5 py-1.5 text-2xl leading-none self-stretch rounded-r-xl ${current ? 'text-gray-300' : 'text-green-dark active:bg-gray-50'}`}>›</button>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400">Caricamento...</div>
      ) : errore || !totali ? (
        <AvvisoAzione testo={errore ?? 'Non riesco a caricare le statistiche, riprova'} onRiprova={riprova} />
      ) : (
        <>
          {/* Quattro significati separati, identici alla Home (05/09/2026):
              ricavi per soggiorno (competenza), incassi (cassa), spese (cassa), saldo */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm">
              <p className="text-xs text-gray-500">Ricavi per soggiorno</p>
              <p className="font-bold text-green-dark text-base">€{euro(totali.ricaviCent)}</p>
              <p className="text-[10px] leading-tight text-gray-400 mt-0.5">valore delle prenotazioni confermate, diviso sulle notti dormite nel periodo</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm">
              <p className="text-xs text-gray-500">{voceIncassi.etichetta}</p>
              <p className="font-bold text-green-mid text-base">€{euro(totali.incassiCent)}</p>
              <p className="text-[10px] leading-tight text-gray-400 mt-0.5">pagamenti registrati, per data di pagamento{voceIncassi.avviso ? <> · <span className="font-semibold text-green-dark">{voceIncassi.avviso}</span></> : null}</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm">
              <p className="text-xs text-gray-500">Spese</p>
              <p className="font-bold text-[#8C3B2E] text-base">€{euro(totali.speseCent)}</p>
              <p className="text-[10px] leading-tight text-gray-400 mt-0.5">spese del B&amp;B, per data di pagamento</p>
            </div>
            <div className="bg-white rounded-xl p-3 border border-[#C9BFA8] shadow-sm">
              <p className="text-xs text-gray-500">Saldo di cassa</p>
              <p className={`font-bold text-base ${totali.saldoCent >= 0 ? 'text-green-mid' : 'text-[#8C3B2E]'}`}>€{euro(totali.saldoCent)}</p>
              <p className="text-[10px] leading-tight text-gray-400 mt-0.5">incassi meno spese del periodo</p>
            </div>
          </div>

          {esitoRicostruzione && <AvvisoAzione testo={esitoRicostruzione} className="mb-4" />}

          {/* R6: storico incassi da ricostruire — elenco e totale, scrittura solo
              con il tasto di conferma, in un'unica operazione idempotente */}
          {piano.movimenti.length > 0 && (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
              <p className="text-sm font-semibold text-gray-600">Storico incassi da ricostruire</p>
              <p className="text-xs text-gray-400 mb-3">soggiorni conclusi senza un pagamento registrato che copra il totale (regola: si è sempre pagato all’arrivo): la ricostruzione crea un movimento «all’arrivo (ricostruito)» con la data di arrivo; l’importo lo ricalcola il server al momento della scrittura</p>
              <div className="rounded-lg border border-[#C9BFA8] overflow-hidden">
                {piano.movimenti.map(m => (
                  <div key={m.chiave_operazione} className="flex items-center justify-between gap-2 px-3 py-2 text-sm border-b border-gray-50 last:border-b-0">
                    <span className="min-w-0">
                      <span className="font-medium text-green-dark">{nomeDi.get(m.booking_id) || m.nomi || 'Ospite'}</span>
                      <span className="text-gray-500"> · {m.arrivo} → {m.partenza}</span>
                      {m.registratiCent > 0 && <span className="text-gray-400 text-xs"> · acconti €{euro(m.registratiCent)}</span>}
                      <span className="block text-[11px] text-gray-400">{m.motivo === 'concluso_non_segnato' ? 'concluso, non segnato pagato' : 'segnato pagato senza movimenti'}</span>
                    </span>
                    <span className="font-semibold text-green-mid whitespace-nowrap">€{(m.amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-3 py-2 text-sm bg-gray-50 font-semibold">
                  <span className="text-gray-600">Totale · {piano.movimenti.length} {piano.movimenti.length === 1 ? 'movimento' : 'movimenti'}</span>
                  <span className="text-green-dark">€{(piano.totaleCent / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
              <button type="button" onClick={confermaRicostruzione} disabled={ricostruendo}
                className="w-full mt-3 bg-green-mid text-white rounded-xl py-3 font-semibold disabled:opacity-60">
                {ricostruendo ? 'Scrivo...' : `Conferma la ricostruzione (${piano.movimenti.length} ${piano.movimenti.length === 1 ? 'movimento' : 'movimenti'}, €${euro(piano.totaleCent)})`}
              </button>
              {erroreRicostruzione && <AvvisoAzione testo={erroreRicostruzione} className="mt-2" />}
              {piano.esclusi.length > 0 && (
                <p className="text-[11px] text-gray-400 mt-3">
                  Fuori dal piano perché non conclusi: {piano.esclusi.map(e => `${nomeDi.get(e.soggiorno) || e.nomi || 'Ospite'} (${e.perche === 'in_corso' ? 'in corso' : 'futuro'}, ${e.arrivo} → ${e.partenza})`).join(' · ')}
                </p>
              )}
            </div>
          )}

          {siteStats && (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-gray-600">Sito e richieste</p>
                  <p className="text-xs text-gray-400">dati anonimi · {label}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-green-mid">{siteStats.conversioneVisita}%</p>
                  <p className="text-[10px] text-gray-400">visita → richiesta</p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-1.5">
                {[
                  ['Visite', siteStats.visite],
                  ['Pagina prenotazione', siteStats.paginaPrenota],
                  ['Modulo iniziato', siteStats.moduliIniziati],
                  ['Richiesta inviata', siteStats.richiesteInviate],
                ].map(([label, value], index) => (
                  <div key={String(label)} className={`rounded-lg p-2 text-center ${index === 3 ? 'bg-[#EDF3E9]' : 'bg-gray-50'}`}>
                    <p className={`text-lg font-bold ${index === 3 ? 'text-green-mid' : 'text-green-dark'}`}>{value}</p>
                    <p className="text-[10px] leading-tight text-gray-500">{label}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                <div>
                  <p className="text-sm font-semibold text-gray-700">{siteStats.conversioneModulo}%</p>
                  <p className="text-[10px] text-gray-400">modulo → richiesta</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">{siteStats.nonConcluseStimate}</p>
                  <p className="text-[10px] text-gray-400">non concluse (stima)</p>
                </div>
                <div>
                  <p className={`text-sm font-semibold ${siteStats.errori > 0 ? 'text-[#8C3B2E]' : 'text-gray-700'}`}>{siteStats.errori}</p>
                  <p className="text-[10px] text-gray-400">errori</p>
                </div>
              </div>

              {siteStats.fontiRichieste.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Da dove arrivano le richieste</p>
                  <div className="space-y-1.5">
                    {siteStats.fontiRichieste.slice(0, 5).map(source => (
                      <div key={source.nome} className="flex justify-between text-xs">
                        <span className="text-gray-600">{source.nome}</span>
                        <span className="font-semibold text-green-mid">{source.valore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {siteStats.campagneRichieste.length > 0 && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Campagne che hanno generato richieste</p>
                  <div className="space-y-1.5">
                    {siteStats.campagneRichieste.slice(0, 5).map(campaign => (
                      <div key={campaign.nome} className="flex justify-between text-xs">
                        <span className="text-gray-600">{campaign.nome}</span>
                        <span className="font-semibold text-green-mid">{campaign.valore}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Grafico a barre */}
          <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
            <p className="text-sm font-semibold text-gray-600">Incassi per {period}</p>
            <p className="text-xs text-gray-400 mb-3">pagamenti registrati, nel giorno in cui sono arrivati</p>
            <div className="flex items-end gap-1" style={{ height: 120 }}>
              {rows.map((r, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex flex-col justify-end" style={{ height: 100 }}>
                    <div className="w-full bg-green-mid rounded-t-sm transition-all"
                      style={{ height: `${Math.max(2, (r.incassi / maxIncassi) * 100)}%` }} />
                  </div>
                  {rows.length <= 12 && (
                    <span className="text-[9px] text-gray-400 text-center leading-tight">{r.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Tabella riepilogo */}
          <div className="bg-white rounded-xl border border-[#C9BFA8] shadow-sm overflow-hidden">
            <div className="grid grid-cols-4 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-500">
              <span>Periodo</span><span className="text-right">Incassi</span><span className="text-right">Spese</span><span className="text-right">Saldo di cassa</span>
            </div>
            {rows.filter(r => r.incassi > 0 || r.spese > 0).map((r, i) => (
              <div key={i} className="grid grid-cols-4 px-3 py-2 text-sm border-t border-gray-50">
                <span className="text-gray-600">{r.label}</span>
                <span className="text-right text-green-mid">€{euro(r.incassi)}</span>
                <span className="text-right text-[#8C3B2E]">€{euro(r.spese)}</span>
                <span className={`text-right font-semibold ${r.saldo >= 0 ? 'text-green-mid' : 'text-[#8C3B2E]'}`}>€{euro(r.saldo)}</span>
              </div>
            ))}
            {rows.filter(r => r.incassi > 0 || r.spese > 0).length === 0 && (
              <div className="text-center py-6 text-gray-400 text-sm">Nessun dato per questo periodo</div>
            )}
          </div>

          {/* Sconti concessi: valore pieno, sconti, valore dopo sconto, incassato.
              Attribuiti alle notti dormite del periodo, dal conto unico */}
          {sconti && (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mt-4">
              <p className="text-sm font-semibold text-gray-600">Sconti concessi</p>
              <p className="text-xs text-gray-400 mb-3">{period === 'mese' ? label : `anno ${label}`} · valori attribuiti alle notti del periodo</p>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Valore a prezzo pieno</span>
                <span className="font-semibold">€{euro(sconti.pienoCent)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Sconti concessi</span>
                <span className="font-semibold" style={{ color: '#8a4f2f' }}>−€{euro(sconti.scontiCent)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5 border-b border-gray-50">
                <span className="text-gray-600">Valore soggiorni dopo sconto</span>
                <span className="font-semibold text-green-mid">€{euro(sconti.valoreCent)}</span>
              </div>
              <div className="flex justify-between text-sm py-1.5">
                <span className="text-gray-600">Incassi nel periodo (pagamenti registrati)</span>
                <span className="font-bold text-green-mid">€{euro(sconti.incassatoCent)}</span>
              </div>
            </div>
          )}

          {/* Occupazione dell'anno letto, mese per mese: notti vendute ÷ notti vendibili
              (camere attive per ogni giorno). Oltre il 100 % non si blocca: è un'anomalia */}
          {occ && (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mt-4">
              <p className="text-sm font-semibold text-gray-600">Occupazione</p>
              <p className="text-xs text-gray-400 mb-3">notti vendute su notti vendibili delle camere attive, mese per mese — verde più intenso = più pieno</p>
              <div className="overflow-x-auto">
                <table className="border-separate w-full" style={{ borderSpacing: 2, tableLayout: 'fixed' }}>
                  <thead>
                    <tr>
                      <th style={{ width: 30 }}></th>
                      {MESI_INIZIALI.map((m, i) => (
                        <th key={i} className="text-[10px] font-normal text-gray-400 pb-1" title={MESI_NOMI[i]}>{m}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-[10px] text-gray-500 pr-1 whitespace-nowrap">{occ.anno}</td>
                      {occ.mesi.map((v, m) => {
                        if (v == null) return <td key={m} className="rounded" style={{ height: 26, background: '#F6F2EA' }} />
                        // Oltre il 100 % non si blocca a 100: la cella dice il numero vero
                        // e sotto la tabella compare «sovrapposizione da controllare»
                        return (
                          <td key={m} title={`${MESI_NOMI[m]} ${occ.anno}: ${v.percento}% (${v.nottiVendute} notti su ${v.nottiVendibili})${v.anomalia ? ` — ${TESTO_ANOMALIA_OCCUPAZIONE}` : ''}`}
                            className={`text-center text-[10px] rounded ${v.anomalia ? 'font-bold' : ''}`}
                            style={v.anomalia ? { height: 26, background: '#F6F2EA', color: '#1F3D2F', outline: '1px solid #C9BFA8' } : { height: 26, background: occColor(v.percento), color: v.percento >= 55 ? '#fff' : '#1F3D2F' }}>
                            {v.anomalia ? `${v.percento}!` : v.percento}
                          </td>
                        )
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-gray-400">0%</span>
                <div className="flex-1 h-2 rounded-full" style={{ background: `linear-gradient(to right, ${occColor(0)}, ${occColor(50)}, ${occColor(100)})` }} />
                <span className="text-[10px] text-gray-400">100%</span>
              </div>
              {occ.mesi.some(v => v?.anomalia) && (
                <div role="alert" className="mt-3 rounded-lg px-3 py-2 text-[12px] font-semibold" style={{ background: '#F6F2EA', border: '1px solid #C9BFA8', color: '#1F3D2F' }}>
                  {occ.mesi.map((v, m) => v?.anomalia ? `${MESI_NOMI[m]}: ${TESTO_ANOMALIA_OCCUPAZIONE} (${v.nottiVendute} notti su ${v.nottiVendibili})` : null).filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* Rendimento camere: classifica dell'anno in corso (incassi pro-quota a notte) */}
          {roomStats && (
            <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mt-4">
              <p className="text-sm font-semibold text-gray-600">Ricavi per camera</p>
              <p className="text-xs text-gray-400 mb-3">anno {roomStats.anno} · {roomStats.annoPassato ? 'tutto l’anno' : 'notti dormite fino a oggi'} · valore dei soggiorni confermati diviso sulle notti, non gli incassi{roomStats.limite ? ` · occupazione ${roomStats.limite}` : ''}</p>
              {roomStats.lista.map((s, i) => (
                <div key={s.name} className={i > 0 ? 'mt-3' : ''}>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm font-medium text-green-dark">
                      {s.name}
                      {i === 0 && <span className="ml-1.5 text-[10px] bg-[#EDF3E9] text-green-mid rounded-full px-2 py-0.5">migliore</span>}
                    </span>
                    <span className="text-sm font-semibold text-green-mid">€{euro(s.ricaviCent)}</span>
                  </div>
                  <div className="h-1.5 rounded-full my-1.5" style={{ background: '#F6F2EA' }}>
                    <div className="h-1.5 rounded-full" style={{ width: `${Math.max(3, (s.ricaviCent / roomStats.lista[0].ricaviCent) * 100)}%`, background: i === 0 ? '#2D6A4F' : '#6C9A7C' }} />
                  </div>
                  <p className="text-[11px] text-gray-400">
                    {s.notti} notti · {Math.round(s.occupazionePerMille / 10)}% occupazione su {s.giorniVendibili} giorni · media €{euro(s.adrCent)}/notte
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Camera del mese: incasso di ogni camera in ogni mese, in grassetto la migliore,
              ultima riga = media mensile (incasso totale ÷ mesi trascorsi) */}
          {roomStats && (() => {
            const cols = [...roomStats.lista].sort((a, b2) => (ROOM_NUMBER_BY_NAME[a.name] || '99').localeCompare(ROOM_NUMBER_BY_NAME[b2.name] || '99'))
            const gridCols = { display: 'grid', gridTemplateColumns: `44px repeat(${cols.length}, 1fr)` } as const
            const months = Array.from({ length: roomStats.numMesi }, (_, k) => roomStats.primoMese + k)
            return (
              <div className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mt-4">
                <p className="text-sm font-semibold text-gray-600">Camera del mese</p>
                <p className="text-xs text-gray-400 mb-3">ricavi per soggiorno di ogni camera, mese per mese — in verde la migliore del mese</p>
                <div className="rounded-lg border border-[#C9BFA8] shadow-sm overflow-hidden">
                  <div className="bg-gray-50 px-2 py-2 text-xs font-semibold text-gray-500" style={gridCols}>
                    <span></span>
                    {cols.map(s => <span key={s.name} className="text-right truncate">{s.name}</span>)}
                  </div>
                  {months.map(m => {
                    const top = Math.max(...cols.map(s => s.mensiliCent[m]))
                    return (
                      <div key={m} className="px-2 py-2 text-xs border-t border-gray-50" style={gridCols}>
                        <span className="text-gray-600">{MESI_NOMI[m].slice(0, 3)}</span>
                        {cols.map(s => (
                          <span key={s.name} className={`text-right ${s.mensiliCent[m] <= 0 ? 'text-gray-300' : top > 0 && s.mensiliCent[m] === top ? 'font-semibold text-green-mid' : 'text-gray-600'}`}>
                            {s.mensiliCent[m] <= 0 ? '—' : `€${euro(s.mensiliCent[m])}`}
                          </span>
                        ))}
                      </div>
                    )
                  })}
                  <div className="px-2 py-2 text-xs border-t border-card-border bg-gray-50" style={gridCols}>
                    <span className="font-semibold text-gray-500">Media</span>
                    {cols.map(s => (
                      <span key={s.name} className="text-right font-semibold text-green-mid">€{euro(Math.round(s.ricaviCent / roomStats.numMesi))}</span>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Media = ricavi al mese, calcolata su tutti i mesi da {MESI_NOMI[roomStats.primoMese]} a {MESI_NOMI[roomStats.meseCorrente]}
                </p>
              </div>
            )
          })()}
        </>
      )}
    </div>
  )
}
