'use client'
// ANTEPRIMA NUOVA PRENOTAZIONE (09/09/2026) — disegno approvato da Ania:
// ricerca in cima, cliente e suoi soggiorni, camere e periodi, sconto, totale,
// e in fondo le quattro righe «già a posto» che si toccano solo se cambiano.
// Tutto finto: nessuna riga entra o esce da Supabase.
import { useMemo, useState } from 'react'
import s from './anteprima.module.css'
import { CAMERE, LETTI_TOTALI, LETTO_IMPORTO_INIZIALE, STRUTTURE, cerca, type Cliente, type Provenienza, type Valutazione } from './dati'
import {
  caparraAttesa, costoLetto, dividiPerCambio, giorni, lettiPerNotte, notti, prezzoPieno,
  righeConto, scontoNonValido, totaleFinale, totalePeriodo, valoreSconto,
  type Accordo, type Periodo, type Sconto,
} from './conto'

const OGGI = new Date()
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const piuGiorni = (base: string, n: number) => { const [y, m, d] = base.split('-').map(Number); return iso(new Date(y, m - 1, d + n)) }
const euro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const gg = (i: string) => { if (!i) return '—'; const [, m, d] = i.split('-').map(Number); return `${d} ${MESI[m - 1]}` }
const ggAnno = (i: string) => { const [a, m, d] = i.split('-').map(Number); return `${d} ${MESI[m - 1]} ${String(a).slice(2)}` }
// «12→15 mar 26» quando il mese è lo stesso, «28 ago→2 set 25» quando cambia
function periodoBreve(dal: string, al: string) {
  const [ya, ma, da] = dal.split('-').map(Number)
  const [yb, mb, db] = al.split('-').map(Number)
  const coda = `${MESI[mb - 1]} ${String(yb).slice(2)}`
  return ma === mb && ya === yb ? `${da}→${db} ${coda}` : `${da} ${MESI[ma - 1]}→${db} ${coda}`
}
const nomeCamera = (id: string | null) => CAMERE.find(c => c.id === id)?.nome ?? 'Scegli camera'
const ETICHETTA_PROV: Record<Provenienza, string> = {
  chiamata: 'Chiamata', google: 'Google', whatsapp: 'WhatsApp', passaparola: 'Passaparola', struttura: 'Altra struttura', non_so: 'Non so',
}

type NuovoCliente = {
  nome: string; cognome: string; telefono: string
  valutazione: Valutazione; ricevuta: boolean
  provenienza: Provenienza | null; struttura: string; nota: string
}
type Contatto = { nome: string; cognome: string; chiE: string; telefono: string }
const CONTATTO_VUOTO: Contatto = { nome: '', cognome: '', chiE: '', telefono: '' }

let contatore = 0
const nuovoId = () => `p${++contatore}`

function periodoVuoto(gruppo?: string): Periodo {
  const arrivo = iso(OGGI)
  return {
    id: nuovoId(), gruppo: gruppo ?? `g${++contatore}`, cameraId: null,
    arrivo, partenza: piuGiorni(arrivo, 1), ospiti: 2, tariffa: null,
    letto: { attivo: false, notti: [], importo: LETTO_IMPORTO_INIZIALE, criterio: 'notte' },
  }
}

export default function AnteprimaNuova() {
  // ── cliente ───────────────────────────────────────────────────────────────
  const [ricerca, setRicerca] = useState('')
  const [cliente, setCliente] = useState<Cliente | null>(null)
  const [nuovo, setNuovo] = useState<NuovoCliente | null>(null)
  const [bloccato, setBloccato] = useState<Cliente | null>(null)
  const [storicoAperto, setStoricoAperto] = useState(false)
  const [modifica, setModifica] = useState<Cliente | null>(null)
  const risultati = useMemo(() => cerca(ricerca), [ricerca])

  // ── camere ────────────────────────────────────────────────────────────────
  const [periodi, setPeriodi] = useState<Periodo[]>([periodoVuoto()])
  const [cambioSu, setCambioSu] = useState<string | null>(null)
  const [cambio, setCambio] = useState({ cameraId: '', dal: '', tariffa: '' })

  // ── sconto, accordo, persone, note ────────────────────────────────────────
  const [sconto, setSconto] = useState<Sconto>(null)
  const [pct, setPct] = useState('')
  const [target, setTarget] = useState('')
  const [erroreSconto, setErroreSconto] = useState<string | null>(null)
  const [aperta, setAperta] = useState<'arrivo' | 'pagamento' | 'chi' | 'note' | null>(null)
  const [orario, setOrario] = useState('')
  const [navetta, setNavetta] = useState<'da_definire' | 'si' | 'no'>('da_definire')
  const [accordo, setAccordo] = useState<Accordo>({ modo: 'contanti' })
  const [chi, setChi] = useState<'prenota' | 'altra'>('prenota')
  const [contatti, setContatti] = useState<Contatto[]>([{ ...CONTATTO_VUOTO }])
  const [note, setNote] = useState('')
  const [salvata, setSalvata] = useState<string[] | null>(null)
  const [errori, setErrori] = useState<string[]>([])

  // ── conti ─────────────────────────────────────────────────────────────────
  const pieno = prezzoPieno(periodi)
  const scontoErr = scontoNonValido(pieno, sconto)
  const scontato = valoreSconto(pieno, sconto)
  const totale = totaleFinale(pieno, sconto)
  const caparra = caparraAttesa(totale, accordo)
  const righe = righeConto(periodi, nomeCamera)
  const lettiUsati = lettiPerNotte(periodi)
  const nottiTroppoPiene = Object.entries(lettiUsati).filter(([, n]) => n > LETTI_TOTALI).map(([g]) => g)

  const nomeCliente = cliente ? `${cliente.nome} ${cliente.cognome}` : nuovo ? `${nuovo.nome} ${nuovo.cognome}`.trim() : ''
  const telefonoCliente = cliente?.telefono ?? nuovo?.telefono ?? ''
  const scelto = Boolean(cliente || nuovo)

  function aggiornaPeriodo(id: string, dati: Partial<Periodo>) {
    setPeriodi(ps => ps.map(p => (p.id === id ? { ...p, ...dati } : p)))
  }
  function aggiornaLetto(id: string, dati: Partial<Periodo['letto']>) {
    setPeriodi(ps => ps.map(p => (p.id === id ? { ...p, letto: { ...p.letto, ...dati } } : p)))
  }
  function cambiaCamera(id: string, cameraId: string) {
    const camera = CAMERE.find(c => c.id === cameraId)
    setPeriodi(ps => ps.map(p => (p.id === id ? { ...p, cameraId, tariffa: p.tariffa ?? camera?.tariffa ?? null } : p)))
  }
  function aggiungiCamera() {
    const ultimo = periodi[periodi.length - 1]
    const p = periodoVuoto()
    setPeriodi(ps => [...ps, { ...p, arrivo: ultimo?.arrivo ?? p.arrivo, partenza: ultimo?.partenza ?? p.partenza }])
  }
  function rimuovi(id: string) { setPeriodi(ps => (ps.length > 1 ? ps.filter(p => p.id !== id) : ps)) }

  function applicaCambio(p: Periodo) {
    const dal = cambio.dal
    const dentro = giorni(p.arrivo, p.partenza)
    if (!cambio.cameraId || !dal || !dentro.includes(dal) || dal === p.arrivo) return
    const tariffa = cambio.tariffa === '' ? (CAMERE.find(c => c.id === cambio.cameraId)?.tariffa ?? null) : Number(cambio.tariffa.replace(',', '.'))
    const [primo, secondo] = dividiPerCambio(p, dal, cambio.cameraId, tariffa, nuovoId())
    setPeriodi(ps => ps.flatMap(x => (x.id === p.id ? [primo, secondo] : [x])))
    setCambioSu(null); setCambio({ cameraId: '', dal: '', tariffa: '' })
  }

  function applicaPct() {
    const v = Number(pct.replace(',', '.'))
    if (!v) return
    const err = scontoNonValido(pieno, { tipo: 'percentuale', valore: v })
    if (err) { setErroreSconto(err); return }
    setErroreSconto(null); setSconto({ tipo: 'percentuale', valore: v }); setTarget('')
  }
  function applicaTarget() {
    const v = Number(target.replace(',', '.'))
    if (!v) return
    const err = scontoNonValido(pieno, { tipo: 'totale', valore: v })
    if (err) { setErroreSconto(err); return }
    setErroreSconto(null); setSconto({ tipo: 'totale', valore: v }); setPct('')
  }

  function salva() {
    const problemi: string[] = []
    if (!scelto) problemi.push('Manca il cliente.')
    if (nuovo && (!nuovo.nome.trim() || !nuovo.cognome.trim() || !nuovo.telefono.trim())) problemi.push('Del cliente nuovo servono nome, cognome e telefono.')
    if (nuovo && !nuovo.provenienza) problemi.push('Scegli come ci ha trovato.')
    periodi.forEach(p => {
      if (!p.cameraId) problemi.push('Una camera non è stata scelta.')
      else if (notti(p) <= 0) problemi.push(`${nomeCamera(p.cameraId)}: la partenza deve venire dopo l'arrivo.`)
      else if (p.tariffa === null) problemi.push(`${nomeCamera(p.cameraId)}: manca la tariffa a notte.`)
      const camera = CAMERE.find(c => c.id === p.cameraId)
      if (camera && p.ospiti > camera.capienza) problemi.push(`${camera.nome} tiene al massimo ${camera.capienza} persone.`)
    })
    if (nottiTroppoPiene.length > 0) problemi.push(`I letti aggiuntivi sono solo ${LETTI_TOTALI}: troppe richieste il ${nottiTroppoPiene.map(gg).join(', ')}.`)
    if (scontoErr) problemi.push(scontoErr)
    if ((accordo.modo === 'caparra50' || accordo.modo === 'caparra_libera')) {
      const { data, ora } = accordo
      if (Boolean(data) !== Boolean(ora)) problemi.push('Della caparra servono data e ora, oppure nessuna delle due.')
      if (accordo.modo === 'caparra_libera' && accordo.importo === null) problemi.push('Scrivi l\'importo della caparra.')
    }
    setErrori(problemi)
    if (problemi.length > 0) return
    const riepilogo = [
      `${nomeCliente} · ${telefonoCliente || 'senza telefono'}`,
      ...periodi.map(p => `${nomeCamera(p.cameraId)} ${gg(p.arrivo)} → ${gg(p.partenza)} · ${notti(p)} notti · ${p.ospiti} osp${costoLetto(p) > 0 ? ' · letto' : ''} · ${euro(totalePeriodo(p) ?? 0)}`),
      sconto ? `Sconto: −${euro(scontato)}` : 'Nessuno sconto',
      `Totale: ${totale === null ? 'da completare' : euro(totale)}`,
      `Pagamento: ${{ contanti: 'contanti all\'arrivo', bonifico_arrivo: 'bonifico all\'arrivo', bonifico_intero: 'bonifico, intero importo', caparra50: 'bonifico, caparra del 50%', caparra_libera: 'bonifico, caparra personalizzata' }[accordo.modo]}${caparra !== null ? ` · caparra ${euro(caparra)}` : ''}`,
      `Arrivo: ${orario || 'da definire'} · navetta ${navetta === 'da_definire' ? 'da definire' : navetta === 'si' ? 'sì' : 'no'}`,
      chi === 'prenota' ? `Soggiorna chi prenota` : `Soggiornano: ${contatti.map(c => `${c.nome} ${c.cognome}${c.chiE ? ` (${c.chiE})` : ''}`).join(', ')}`,
      note ? `Note: ${note}` : 'Nessuna nota',
    ]
    setSalvata(riepilogo)
  }

  // ── pezzi di pagina ───────────────────────────────────────────────────────
  const testoNavetta = navetta === 'da_definire' ? 'Navetta da definire' : navetta === 'si' ? 'Navetta sì' : 'Navetta no'
  const testoAccordo = {
    contanti: 'Contanti all\'arrivo', bonifico_arrivo: 'Bonifico all\'arrivo', bonifico_intero: 'Bonifico · intero importo',
    caparra50: 'Bonifico · caparra del 50%', caparra_libera: 'Bonifico · caparra personalizzata',
  }[accordo.modo]

  return (
    <div className={s.pagina}>
      <p className={s.sotto}>{OGGI.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <h1 className={s.titolo}>Nuova prenotazione</h1>

      {/* RICERCA — sempre in cima, come nel Calendario */}
      <div className={s.cerca}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ color: 'var(--color-stone)' }} aria-hidden>
          <circle cx="11" cy="11" r="7" /><path d="M20.5 20.5l-4-4" />
        </svg>
        <input value={ricerca} onChange={e => { setRicerca(e.target.value); setBloccato(null) }} placeholder="Cerca nome o telefono…" enterKeyHint="search" />
        {ricerca !== '' && <button type="button" className={s.svuota} onClick={() => setRicerca('')} aria-label="Svuota la ricerca">✕</button>}
      </div>

      {!scelto && (
        <>
          {ricerca.trim() !== '' && (
            <p className={s.sotto} style={{ marginTop: 14 }}>
              {risultati.length === 0 ? 'Nessun cliente con questo nome' : `${risultati.length} client${risultati.length === 1 ? 'e trovato' : 'i trovati'}`}
            </p>
          )}
          {risultati.map(c => {
            const no = c.valutazione === 'problematico'
            return (
              <button key={c.id} type="button" className={`${s.risultato} ${no ? s.spento : ''}`}
                onClick={() => { if (no) { setBloccato(c); return } setCliente(c); setRicerca(''); setBloccato(null) }}>
                <span>
                  <span className={s.risultatoNome}>{c.nome} {c.cognome}</span>
                  <span className={s.risultatoTel}>{c.telefono}{c.soggiorni.length > 0 ? ` · ${c.soggiorni.length} soggiorn${c.soggiorni.length === 1 ? 'o' : 'i'}` : ''}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {c.valutazione === 'ottimo' && <span className={`${s.badge} ${s.badgeOttone}`}>★ Ottimo</span>}
                  {c.ricevuta && <span className={s.badge}>Ricevuta</span>}
                  {no && <span className={`${s.badge} ${s.badgeNo}`}>Problematico</span>}
                </span>
              </button>
            )
          })}
          {bloccato && (
            <p className={s.avviso}>
              <b>{bloccato.nome} {bloccato.cognome} è segnato come problematico.</b><br />
              {bloccato.motivo}<br />Non si può usare per una nuova prenotazione.
            </p>
          )}
          <div className={s.azioni} style={{ borderTop: '1px solid var(--color-card-border)', marginTop: 2 }}>
            <button type="button" className={s.azione} onClick={() => {
              const parti = ricerca.trim().split(' ')
              const soloCifre = /\d/.test(ricerca)
              setNuovo({
                nome: soloCifre ? '' : parti[0] ?? '', cognome: soloCifre ? '' : parti.slice(1).join(' '),
                telefono: soloCifre ? ricerca.trim() : '', valutazione: 'normale', ricevuta: false,
                provenienza: null, struttura: '', nota: '',
              })
              setRicerca('')
            }}>Inserisci nuovo cliente</button>
          </div>
        </>
      )}

      {/* CLIENTE SCELTO */}
      {cliente && (
        <>
          <div className={`${s.riga} ${s.rigaOttone}`} style={{ alignItems: 'flex-start', paddingTop: 12 }}>
            <span>
              <span className={s.titoloMedio} style={{ display: 'block' }}>{cliente.nome} {cliente.cognome}</span>
              <span className={s.risultatoTel}>{cliente.telefono}{cliente.provenienza ? ` · ${ETICHETTA_PROV[cliente.provenienza]}${cliente.struttura ? ` (${cliente.struttura})` : ''}` : ''}</span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              {cliente.valutazione === 'ottimo' && <span className={`${s.badge} ${s.badgeOttone}`}>★ Ottimo</span>}
              {cliente.ricevuta && <span className={s.badge}>Ricevuta</span>}
            </span>
          </div>
          {cliente.nota && <p className={s.nota} style={{ margin: '6px 0 0' }}>{cliente.nota}</p>}

          <p className={s.sezione} style={{ marginTop: 16 }}>Soggiorni precedenti</p>
          {cliente.soggiorni.length === 0 && <p className={s.nota} style={{ marginTop: 10 }}>Nessun soggiorno concluso: la scheda esiste ma non è ancora venuta.</p>}
          {cliente.soggiorni.slice(0, 3).map(sg => (
            <button key={sg.id} type="button" className={s.storico} onClick={() => setStoricoAperto(true)}>
              <span className={s.storicoData}>{periodoBreve(sg.dal, sg.al)}</span>
              <span className={s.storicoDato}>{sg.camera}</span>
              <span className={s.storicoDato}>{sg.ospiti} osp</span>
              <span className={s.storicoDato}>{Math.round((sg.al ? giorni(sg.dal, sg.al).length : 0))} × {Math.round(sg.totale / Math.max(1, giorni(sg.dal, sg.al).length))}</span>
              {sg.pieno && <span className={s.storicoPieno}>{sg.pieno}</span>}
              <span className={`${s.storicoTotale} ${sg.pieno ? s.verde : ''}`}>{sg.totale} €</span>
              <span className={s.freccia}>›</span>
            </button>
          ))}
          {cliente.soggiorni.length > 0 && (
            <button type="button" className={s.storicoTot} onClick={() => setStoricoAperto(true)}>
              <span className={s.eti}>{cliente.soggiorni.length} soggiorni conclusi <span style={{ color: 'var(--color-brass)' }}>· aprili tutti</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={s.numero}>{cliente.soggiorni.reduce((t, x) => t + x.totale, 0).toLocaleString('it-IT', { useGrouping: true })} €</span>
                <span className={s.freccia}>›</span>
              </span>
            </button>
          )}
          <div className={s.azioni}>
            <button type="button" className={s.azione} onClick={() => setModifica(cliente)}>Modifica dati</button>
            <button type="button" className={s.azione} onClick={() => { setCliente(null); setStoricoAperto(false) }}>Cambia cliente</button>
          </div>
        </>
      )}

      {/* CLIENTE NUOVO: qui, e solo qui, si compila la scheda */}
      {nuovo && (
        <>
          <p className={s.sezione}>Nuovo cliente</p>
          <div className={s.due} style={{ marginTop: 8 }}>
            <label className={`${s.riga} ${s.rigaOttone}`}><span className={s.eti}>Nome</span>
              <input className={s.campo} value={nuovo.nome} onChange={e => setNuovo({ ...nuovo, nome: e.target.value })} /></label>
            <label className={`${s.riga} ${s.rigaOttone}`}><span className={s.eti}>Cognome</span>
              <input className={s.campo} value={nuovo.cognome} onChange={e => setNuovo({ ...nuovo, cognome: e.target.value })} /></label>
          </div>
          <label className={s.riga}><span className={s.eti}>Telefono</span>
            <input className={s.campo} inputMode="tel" value={nuovo.telefono} onChange={e => setNuovo({ ...nuovo, telefono: e.target.value })} /></label>
          <div className={s.riga} style={{ display: 'block' }}>
            <span className={s.eti}>Valutazione</span>
            <div className={s.pillole} style={{ marginTop: 8 }}>
              {(['ottimo', 'normale', 'problematico'] as Valutazione[]).map(v => (
                <button key={v} type="button" className={nuovo.valutazione === v ? s.pil : s.pilT} onClick={() => setNuovo({ ...nuovo, valutazione: v })}>
                  {v === 'ottimo' ? '★ Ottimo' : v === 'normale' ? 'Normale' : 'Problematico'}
                </button>
              ))}
              <button type="button" className={nuovo.ricevuta ? s.pilC : s.pilT} onClick={() => setNuovo({ ...nuovo, ricevuta: !nuovo.ricevuta })}>Richiede ricevuta</button>
            </div>
          </div>
          <div className={s.riga} style={{ display: 'block' }}>
            <span className={s.eti}>Come ci ha trovato · da scegliere</span>
            <div className={s.pillole} style={{ marginTop: 8 }}>
              {(Object.keys(ETICHETTA_PROV) as Provenienza[]).map(p => (
                <button key={p} type="button" className={nuovo.provenienza === p ? s.pil : s.pilT}
                  onClick={() => setNuovo({ ...nuovo, provenienza: p, struttura: p === 'struttura' ? nuovo.struttura : '' })}>{ETICHETTA_PROV[p]}</button>
              ))}
            </div>
            {nuovo.provenienza === 'struttura' && (
              <label className={s.riga} style={{ borderTop: 'none' }}><span className={s.eti}>Quale struttura</span>
                <input className={s.campo} list="strutture" value={nuovo.struttura} onChange={e => setNuovo({ ...nuovo, struttura: e.target.value })} placeholder="cerca o scrivine una nuova" />
                <datalist id="strutture">{STRUTTURE.map(x => <option key={x} value={x} />)}</datalist>
              </label>
            )}
          </div>
          <div className={s.riga} style={{ display: 'block' }}>
            <span className={s.eti}>Nota del cliente · resta anche le prossime volte</span>
            <textarea className={s.campo} style={{ textAlign: 'left', fontWeight: 400, marginTop: 4 }} rows={2}
              value={nuovo.nota} onChange={e => setNuovo({ ...nuovo, nota: e.target.value })} placeholder="quello che va ricordato ogni volta" />
          </div>
          <div className={s.azioni}>
            <button type="button" className={s.azione} onClick={() => setNuovo(null)}>Annulla il cliente nuovo</button>
          </div>
        </>
      )}

      <div style={scelto ? undefined : { opacity: 0.45, pointerEvents: 'none' }}>
        {/* CAMERE E PERIODI */}
        <p className={s.sezione}>Camere e periodi</p>
        {periodi.map(p => {
          const n = notti(p)
          const camera = CAMERE.find(c => c.id === p.cameraId)
          const troppePersone = camera && p.ospiti > camera.capienza
          const tuttoIlPeriodo = giorni(p.arrivo, p.partenza)
          return (
            <div key={p.id} className={s.blocco}>
              <div className={s.bloccoTop}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <select className={`${s.campo} ${s.campoSinistra}`} style={{ fontFamily: 'Georgia, serif', fontSize: 21, fontWeight: 400 }}
                    value={p.cameraId ?? ''} onChange={e => cambiaCamera(p.id, e.target.value)}>
                    <option value="">Scegli camera</option>
                    {CAMERE.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                  </select>
                  <p className={s.date}>{n > 0 ? `${gg(p.arrivo)} → ${gg(p.partenza)} · ${n} ${n === 1 ? 'notte' : 'notti'}` : 'date da sistemare'}</p>
                </div>
                <span className={s.numero}>{totalePeriodo(p) === null ? '—' : euro(totalePeriodo(p)!)}</span>
              </div>

              <div className={s.due} style={{ marginTop: 8 }}>
                <label className={s.riga}><span className={s.eti}>Arrivo</span>
                  <input type="date" className={s.campo} value={p.arrivo} onChange={e => aggiornaPeriodo(p.id, { arrivo: e.target.value })} /></label>
                <label className={s.riga}><span className={s.eti}>Partenza</span>
                  <input type="date" className={s.campo} value={p.partenza} onChange={e => aggiornaPeriodo(p.id, { partenza: e.target.value })} /></label>
              </div>
              <div className={s.due}>
                <label className={s.riga}><span className={s.eti}>Ospiti</span>
                  <input type="number" inputMode="numeric" min={1} className={s.campo} value={p.ospiti} onChange={e => aggiornaPeriodo(p.id, { ospiti: Number(e.target.value) })} /></label>
                <label className={s.riga}><span className={s.eti}>Tariffa</span>
                  <input type="number" inputMode="decimal" className={s.campo} value={p.tariffa ?? ''} placeholder="€"
                    onChange={e => aggiornaPeriodo(p.id, { tariffa: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              </div>
              {troppePersone && <p className={s.avviso}>{camera!.nome} tiene al massimo {camera!.capienza} persone.</p>}

              {/* letto aggiuntivo */}
              <div className={s.riga} style={{ alignItems: 'flex-start' }}>
                <button type="button" className={`${s.quadro} ${p.letto.attivo ? s.quadroOn : ''}`} aria-label="Letto aggiuntivo"
                  onClick={() => aggiornaLetto(p.id, { attivo: !p.letto.attivo, notti: !p.letto.attivo ? tuttoIlPeriodo : [] })} />
                <div style={{ flex: 1, marginLeft: -2 }}>
                  <b style={{ fontSize: 14 }}>Letto aggiuntivo</b>
                  <p className={s.nota} style={{ margin: '1px 0 0' }}>
                    {p.letto.attivo ? 'Si paga per le notti scelte, anche con due ospiti.' : `Parte da ${LETTO_IMPORTO_INIZIALE} € a notte, ne restano ${LETTI_TOTALI}.`}
                  </p>
                  {p.letto.attivo && (
                    <>
                      <div className={s.notti}>
                        <button type="button" className={`${s.notte} ${p.letto.notti.length === tuttoIlPeriodo.length ? s.notteOn : ''}`}
                          onClick={() => aggiornaLetto(p.id, { notti: tuttoIlPeriodo })}>tutte le notti</button>
                        {tuttoIlPeriodo.map(g => (
                          <button key={g} type="button" className={`${s.notte} ${p.letto.notti.includes(g) ? s.notteOn : ''}`}
                            onClick={() => aggiornaLetto(p.id, { notti: p.letto.notti.includes(g) ? p.letto.notti.filter(x => x !== g) : [...p.letto.notti, g].sort() })}>
                            {Number(g.slice(8))}
                          </button>
                        ))}
                      </div>
                      <div className={s.due} style={{ marginTop: 2 }}>
                        <label className={s.riga}><span className={s.eti}>Importo</span>
                          <input type="number" inputMode="decimal" className={s.campo} value={p.letto.importo ?? ''} placeholder="€"
                            onChange={e => aggiornaLetto(p.id, { importo: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                      </div>
                      <div className={s.pillole} style={{ marginTop: 6 }}>
                        {([['notte', 'A notte'], ['ogni4', 'Ogni 4 notti'], ['totale', 'Totale concordato']] as const).map(([k, t]) => (
                          <button key={k} type="button" className={p.letto.criterio === k ? s.pil : s.pilT} onClick={() => aggiornaLetto(p.id, { criterio: k })}>{t}</button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                {costoLetto(p) > 0 && <span className={s.numeroPiccolo}>{euro(costoLetto(p))}</span>}
              </div>

              {/* cambio camera */}
              {cambioSu === p.id ? (
                <div className={s.seguito}>
                  <p className={s.sotto}>Cambio camera</p>
                  <label className={s.riga} style={{ borderTop: 'none' }}><span className={s.eti}>Va in</span>
                    <select className={s.campo} value={cambio.cameraId} onChange={e => setCambio({ ...cambio, cameraId: e.target.value, tariffa: String(CAMERE.find(c => c.id === e.target.value)?.tariffa ?? '') })}>
                      <option value="">Scegli camera</option>
                      {CAMERE.filter(c => c.id !== p.cameraId).map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                    </select></label>
                  <div className={s.due}>
                    <label className={s.riga}><span className={s.eti}>Dal</span>
                      <input type="date" className={s.campo} min={piuGiorni(p.arrivo, 1)} max={p.partenza} value={cambio.dal} onChange={e => setCambio({ ...cambio, dal: e.target.value })} /></label>
                    <label className={s.riga}><span className={s.eti}>Tariffa</span>
                      <input type="number" inputMode="decimal" className={s.campo} value={cambio.tariffa} placeholder="€" onChange={e => setCambio({ ...cambio, tariffa: e.target.value })} /></label>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button type="button" className={s.pil} disabled={!cambio.cameraId || !cambio.dal} onClick={() => applicaCambio(p)}>Aggiungi cambio</button>
                    <button type="button" className={s.pilT} onClick={() => { setCambioSu(null); setCambio({ cameraId: '', dal: '', tariffa: '' }) }}>Annulla</button>
                  </div>
                </div>
              ) : (
                <div className={s.azioni} style={{ borderTop: '1px solid var(--color-card-border)', marginTop: 8 }}>
                  <button type="button" className={s.azione} onClick={() => { setCambioSu(p.id); setCambio({ cameraId: '', dal: '', tariffa: '' }) }}>Aggiungi cambio camera</button>
                  {periodi.length > 1 && <button type="button" className={s.azione} onClick={() => rimuovi(p.id)}>Rimuovi</button>}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ paddingTop: 14, borderTop: '1px solid var(--color-card-border)', marginTop: 14 }}>
          <button type="button" className={s.pilC} style={{ width: '100%', minHeight: 42 }} onClick={aggiungiCamera}>Aggiungi camera</button>
        </div>

        {/* SCONTO */}
        <p className={s.sezione}>Sconto a lei riservato</p>
        <p className={s.sezioneNota}>Uno solo per prenotazione. La tariffa a notte non si tocca.</p>
        <div className={s.riga} style={{ borderTop: '1px solid rgba(169,136,78,.55)', gap: 8 }}>
          <input type="number" inputMode="decimal" className={s.campo} style={{ maxWidth: 90, textAlign: 'center' }} placeholder="%" value={pct} onChange={e => setPct(e.target.value)} />
          <button type="button" className={s.pil} disabled={!pct} onClick={applicaPct}>Applica %</button>
        </div>
        <div className={s.riga} style={{ gap: 8 }}>
          <input type="number" inputMode="decimal" className={`${s.campo} ${s.campoSinistra}`} placeholder="Porta il totale a €" value={target} onChange={e => setTarget(e.target.value)} />
          <button type="button" className={s.pilC} disabled={!target} onClick={applicaTarget}>Applica</button>
        </div>
        {erroreSconto && <p className={s.avviso}>{erroreSconto}</p>}
        {sconto && pieno !== null && (
          <>
            <div className={s.riga}>
              <span className={s.eti}>{euro(pieno)} − {euro(scontato)}</span>
              <span className={`${s.numero} ${s.verde}`}>{euro(totale ?? 0)}</span>
            </div>
            <div className={s.azioni}><button type="button" className={s.azione} onClick={() => { setSconto(null); setPct(''); setTarget('') }}>Togli lo sconto</button></div>
          </>
        )}

        {/* TOTALE */}
        <p className={s.sezione}>Totale</p>
        <div className={s.distinta}>
          {righe.length === 0 && <p className={s.nota}>Manca la camera o la tariffa: il conto è da completare.</p>}
          {righe.map((r, i) => (
            <div key={i} className={s.dRiga}><span>{r.etichetta}</span><span className={s.punti} /><span className={s.dImporto}>{r.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
          ))}
          {sconto && (
            <div className={s.dRiga} style={{ borderTop: '1px solid var(--color-card-border)', marginTop: 4, paddingTop: 6 }}>
              <span className={s.verde}>Sconto a lei riservato</span><span className={s.punti} /><span className={`${s.dImporto} ${s.verde}`}>− {scontato.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className={s.dTot}>
            <div>
              <p className={s.dNota}>Totale prenotazione</p>
              <p className={s.numeroGrande} style={{ marginTop: 3, color: totale === null ? 'var(--color-stone)' : undefined }}>{totale === null ? 'da completare' : euro(totale)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className={s.eti} style={{ fontSize: 12 }}>{testoAccordo}</p>
              {caparra !== null && <p className={s.eti} style={{ fontSize: 11 }}>caparra {euro(caparra)}</p>}
            </div>
          </div>
        </div>

        {/* GIÀ A POSTO */}
        <p className={s.sezione}>Già a posto <small style={{ letterSpacing: 0, textTransform: 'none', fontSize: 12, color: 'var(--color-stone)' }}>— tocca solo se cambia</small></p>

        <button type="button" className={`${s.gia} ${s.rigaOttone}`} onClick={() => setAperta(aperta === 'arrivo' ? null : 'arrivo')}>
          <span className={s.giaEti}>Arrivo</span>
          <span className={`${s.giaValore} ${orario ? '' : s.giaVuota}`}>{orario ? `Verso le ${orario}` : 'Orario da definire'}<small className={s.giaSotto}>{testoNavetta}</small></span>
          <span className={s.freccia}>{aperta === 'arrivo' ? '⌄' : '›'}</span>
        </button>
        {aperta === 'arrivo' && (
          <div style={{ paddingLeft: 2 }}>
            <label className={s.riga}><span className={s.eti}>Orario previsto</span>
              <input type="time" className={s.campo} style={{ maxWidth: 120 }} value={orario} onChange={e => setOrario(e.target.value)} /></label>
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.eti}>Navetta</span>
              <div className={s.pillole} style={{ marginTop: 8 }}>
                {([['da_definire', 'Da definire'], ['si', 'Sì'], ['no', 'No']] as const).map(([k, t]) => (
                  <button key={k} type="button" className={navetta === k ? s.pil : s.pilT} onClick={() => setNavetta(k)}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button type="button" className={s.gia} onClick={() => setAperta(aperta === 'pagamento' ? null : 'pagamento')}>
          <span className={s.giaEti}>Pagamento</span>
          <span className={s.giaValore}>{testoAccordo}
            <small className={s.giaSotto}>{caparra !== null ? `Caparra ${euro(caparra)}${(accordo.modo === 'caparra50' || accordo.modo === 'caparra_libera') && accordo.data ? ` entro il ${gg(accordo.data)} alle ${accordo.ora}` : ' · scadenza da impostare'}` : 'Nessuna caparra da chiedere'}</small></span>
          <span className={s.freccia}>{aperta === 'pagamento' ? '⌄' : '›'}</span>
        </button>
        {aperta === 'pagamento' && (
          <div>
            {([['contanti', 'Contanti all\'arrivo'], ['bonifico_arrivo', 'Bonifico all\'arrivo'], ['bonifico_intero', 'Bonifico · intero importo'], ['caparra50', 'Bonifico · caparra del 50%'], ['caparra_libera', 'Bonifico · caparra personalizzata']] as const).map(([k, t]) => (
              <button key={k} type="button" className={s.scelta} onClick={() => {
                if (k === 'caparra50') setAccordo({ modo: 'caparra50', data: '', ora: '' })
                else if (k === 'caparra_libera') setAccordo({ modo: 'caparra_libera', importo: null, data: '', ora: '' })
                else setAccordo({ modo: k })
              }}>
                <span className={`${s.tondo} ${accordo.modo === k ? s.tondoOn : ''}`} />
                <span style={{ flex: 1 }}>
                  <span className={s.sceltaTitolo}>{t}</span>
                  {k === 'caparra50' && accordo.modo === 'caparra50' && totale !== null && <span className={s.sceltaNota}>{euro(totale / 2)} sul totale, letti e sconto compresi</span>}
                </span>
              </button>
            ))}
            {(accordo.modo === 'caparra50' || accordo.modo === 'caparra_libera') && (
              <>
                {accordo.modo === 'caparra_libera' && (
                  <label className={s.riga}><span className={s.eti}>Importo caparra</span>
                    <input type="number" inputMode="decimal" className={s.campo} placeholder="€" value={accordo.importo ?? ''}
                      onChange={e => setAccordo({ ...accordo, importo: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                )}
                <div className={s.due}>
                  <label className={s.riga}><span className={s.eti}>Entro il</span>
                    <input type="date" className={s.campo} value={accordo.data} onChange={e => setAccordo({ ...accordo, data: e.target.value })} /></label>
                  <label className={s.riga}><span className={s.eti}>Ora</span>
                    <input type="time" className={s.campo} value={accordo.ora} onChange={e => setAccordo({ ...accordo, ora: e.target.value })} /></label>
                </div>
                <p className={s.nota}>In Home comparirà con il tempo che manca.</p>
              </>
            )}
          </div>
        )}

        <button type="button" className={s.gia} onClick={() => setAperta(aperta === 'chi' ? null : 'chi')}>
          <span className={s.giaEti}>Chi arriva</span>
          <span className={s.giaValore}>
            {chi === 'prenota' ? (nomeCliente || 'Chi prenota') : contatti.map(c => `${c.nome} ${c.cognome}`.trim() || 'da compilare').join(' e ')}
            <small className={s.giaSotto}>{chi === 'prenota' ? `Soggiorna chi prenota · ${telefonoCliente || 'senza telefono'}` : 'Soggiorna un\'altra persona'}</small>
          </span>
          <span className={s.freccia}>{aperta === 'chi' ? '⌄' : '›'}</span>
        </button>
        {aperta === 'chi' && (
          <div>
            <button type="button" className={s.scelta} onClick={() => setChi('prenota')}>
              <span className={`${s.tondo} ${chi === 'prenota' ? s.tondoOn : ''}`} />
              <span><span className={s.sceltaTitolo}>Soggiorna chi prenota</span><span className={s.sceltaNota}>{nomeCliente || '—'} · {telefonoCliente || 'senza telefono'}</span></span>
            </button>
            <button type="button" className={s.scelta} onClick={() => setChi('altra')}>
              <span className={`${s.tondo} ${chi === 'altra' ? s.tondoOn : ''}`} />
              <span className={s.sceltaTitolo}>Soggiorna un&apos;altra persona</span>
            </button>
            {chi === 'altra' && (
              <div>
                {contatti.map((c, i) => (
                  <div key={i}>
                    {i > 0 && <p className={s.sotto} style={{ marginTop: 12 }}>Secondo contatto</p>}
                    <div className={s.due}>
                      <label className={s.riga}><span className={s.eti}>Nome</span>
                        <input className={s.campo} value={c.nome} onChange={e => setContatti(cs => cs.map((x, j) => j === i ? { ...x, nome: e.target.value } : x))} /></label>
                      <label className={s.riga}><span className={s.eti}>Cognome</span>
                        <input className={s.campo} value={c.cognome} onChange={e => setContatti(cs => cs.map((x, j) => j === i ? { ...x, cognome: e.target.value } : x))} /></label>
                    </div>
                    <div className={s.due}>
                      <label className={s.riga}><span className={s.eti}>Chi è</span>
                        <input className={s.campo} value={c.chiE} placeholder="mamma, collega…" onChange={e => setContatti(cs => cs.map((x, j) => j === i ? { ...x, chiE: e.target.value } : x))} /></label>
                      <label className={s.riga}><span className={s.eti}>Telefono</span>
                        <input className={s.campo} inputMode="tel" value={c.telefono} onChange={e => setContatti(cs => cs.map((x, j) => j === i ? { ...x, telefono: e.target.value } : x))} /></label>
                    </div>
                  </div>
                ))}
                <div className={s.azioni}>
                  {contatti.length < 2
                    ? <button type="button" className={s.azione} onClick={() => setContatti(cs => [...cs, { ...CONTATTO_VUOTO }])}>Aggiungi secondo contatto</button>
                    : <button type="button" className={s.azione} onClick={() => setContatti(cs => cs.slice(0, 1))}>Rimuovi secondo contatto</button>}
                </div>
              </div>
            )}
          </div>
        )}

        <button type="button" className={s.gia} onClick={() => setAperta(aperta === 'note' ? null : 'note')}>
          <span className={s.giaEti}>Note</span>
          <span className={`${s.giaValore} ${note ? '' : s.giaVuota}`}>{note || 'Nessuna nota per questo soggiorno'}</span>
          <span className={s.freccia}>{aperta === 'note' ? '⌄' : '›'}</span>
        </button>
        {aperta === 'note' && (
          <div className={s.riga} style={{ display: 'block' }}>
            <textarea className={s.campo} style={{ textAlign: 'left', fontWeight: 400 }} rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Solo per questo soggiorno: non finisce nei messaggi né nella scheda del cliente." />
          </div>
        )}

        {errori.length > 0 && (
          <div className={s.avviso}>
            <b>Prima di salvare:</b>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{errori.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}

        <div className={s.barra}>
          <div>
            <p className={s.eti} style={{ fontSize: 11 }}>Totale</p>
            <p className={s.numeroPiccolo} style={{ color: totale === null ? 'var(--color-stone)' : undefined }}>{totale === null ? '—' : euro(totale)}</p>
          </div>
          <button type="button" className={s.pil} onClick={salva}>Salva prenotazione</button>
        </div>
      </div>

      <p className={s.nota} style={{ textAlign: 'center', marginTop: 12 }}>Anteprima · dati finti, il salvataggio è simulato</p>

      {/* foglio: storico completo */}
      {storicoAperto && cliente && (
        <div className={s.velo} onClick={() => setStoricoAperto(false)}>
          <div className={s.foglio} onClick={e => e.stopPropagation()}>
            <p className={s.sotto}>Soggiorni di {cliente.nome} {cliente.cognome}</p>
            <h2 className={s.titolo} style={{ fontSize: 24 }}>Storico</h2>
            {cliente.soggiorni.map(sg => (
              <div key={sg.id} className={s.riga} style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span className={s.titoloMedio} style={{ fontSize: 17 }}>{sg.camera}</span>
                  <span className={`${s.numero} ${sg.pieno ? s.verde : ''}`} style={{ fontSize: 18 }}>{sg.totale} €</span>
                </div>
                <p className={s.nota}>{ggAnno(sg.dal)} → {ggAnno(sg.al)} · {giorni(sg.dal, sg.al).length} notti · {sg.ospiti} ospiti{sg.pieno ? ` · prezzo pieno ${sg.pieno} €` : ''}</p>
              </div>
            ))}
            <button type="button" className={s.pilC} style={{ width: '100%', minHeight: 44, marginTop: 14 }} onClick={() => setStoricoAperto(false)}>Chiudi</button>
          </div>
        </div>
      )}

      {/* foglio: modifica dei dati del cliente conosciuto */}
      {modifica && (
        <div className={s.velo} onClick={() => setModifica(null)}>
          <div className={s.foglio} onClick={e => e.stopPropagation()}>
            <p className={s.sotto}>Stessa persona, dati corretti</p>
            <h2 className={s.titolo} style={{ fontSize: 24 }}>Modifica dati</h2>
            <div className={s.due} style={{ marginTop: 10 }}>
              <label className={`${s.riga} ${s.rigaOttone}`}><span className={s.eti}>Nome</span>
                <input className={s.campo} value={modifica.nome} onChange={e => setModifica({ ...modifica, nome: e.target.value })} /></label>
              <label className={`${s.riga} ${s.rigaOttone}`}><span className={s.eti}>Cognome</span>
                <input className={s.campo} value={modifica.cognome} onChange={e => setModifica({ ...modifica, cognome: e.target.value })} /></label>
            </div>
            <label className={s.riga}><span className={s.eti}>Telefono</span>
              <input className={s.campo} inputMode="tel" value={modifica.telefono} onChange={e => setModifica({ ...modifica, telefono: e.target.value })} /></label>
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.eti}>Valutazione</span>
              <div className={s.pillole} style={{ marginTop: 8 }}>
                {(['ottimo', 'normale', 'problematico'] as Valutazione[]).map(v => (
                  <button key={v} type="button" className={modifica.valutazione === v ? s.pil : s.pilT} onClick={() => setModifica({ ...modifica, valutazione: v })}>
                    {v === 'ottimo' ? '★ Ottimo' : v === 'normale' ? 'Normale' : 'Problematico'}
                  </button>
                ))}
                <button type="button" className={modifica.ricevuta ? s.pilC : s.pilT} onClick={() => setModifica({ ...modifica, ricevuta: !modifica.ricevuta })}>Richiede ricevuta</button>
              </div>
            </div>
            {modifica.valutazione === 'problematico' && (
              <div className={s.riga} style={{ display: 'block' }}>
                <span className={s.eti}>Note interne · cosa è successo</span>
                <textarea className={s.campo} style={{ textAlign: 'left', fontWeight: 400, marginTop: 4 }} rows={2}
                  value={modifica.motivo ?? ''} onChange={e => setModifica({ ...modifica, motivo: e.target.value })} />
                <p className={s.nota}>Resta fra noi: non finisce mai nei messaggi agli ospiti.</p>
              </div>
            )}
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.eti}>Come ci ha trovato</span>
              <div className={s.pillole} style={{ marginTop: 8 }}>
                {(Object.keys(ETICHETTA_PROV) as Provenienza[]).map(pv => (
                  <button key={pv} type="button" className={modifica.provenienza === pv ? s.pil : s.pilT}
                    onClick={() => setModifica({ ...modifica, provenienza: pv, struttura: pv === 'struttura' ? modifica.struttura : undefined })}>{ETICHETTA_PROV[pv]}</button>
                ))}
              </div>
            </div>
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.eti}>Nota del cliente</span>
              <textarea className={s.campo} style={{ textAlign: 'left', fontWeight: 400, marginTop: 4 }} rows={2}
                value={modifica.nota ?? ''} onChange={e => setModifica({ ...modifica, nota: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" className={s.pilT} style={{ minHeight: 44 }} onClick={() => setModifica(null)}>Annulla</button>
              <button type="button" className={s.pil} style={{ flex: 1, minHeight: 44 }} onClick={() => { setCliente(modifica); setModifica(null) }}>Salva modifica</button>
            </div>
          </div>
        </div>
      )}

      {/* foglio: salvataggio finto */}
      {salvata && (
        <div className={s.velo} onClick={() => setSalvata(null)}>
          <div className={s.foglio} onClick={e => e.stopPropagation()}>
            <p className={s.sotto}>Anteprima · non è stato salvato niente</p>
            <h2 className={s.titolo} style={{ fontSize: 24 }}>Ecco cosa salverebbe</h2>
            {salvata.map((r, i) => <p key={i} className={s.riga} style={{ display: 'block', fontSize: 13 }}>{r}</p>)}
            <button type="button" className={s.pil} style={{ width: '100%', minHeight: 44, marginTop: 14 }} onClick={() => setSalvata(null)}>Chiudi</button>
          </div>
        </div>
      )}
    </div>
  )
}
