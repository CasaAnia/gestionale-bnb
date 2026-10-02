'use client'
import { useEffect, useRef, useState } from 'react'
import TimerPulizia from './TimerPulizia'
import { useTimerPulizie } from '@/lib/pulizieTempiDati'
import { chiaveTimerPulizia } from '@/lib/tempoPulizie'
import SchedaPulizia from './SchedaPulizia'
import AvvisoAzione from './AvvisoAzione'
import { addDaysStr, type Decisione } from '@/lib/pulizie'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { type Contatori, type Recupero } from '@/lib/biancheria'
import { recuperoDaRiga, totalePezzi, totaleSenzaMisura } from '@/lib/dotazionePulizie'
import { leggiOperazionePulizia, type RichiestaPulizia, type RispostaPulizia } from '@/lib/pulizieOperazioni'
import { inviaOperazionePulizia, leggiPersonePulizia } from '@/lib/pulizieServizio'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { type Salvataggio } from './maison/SalvatoMaison'
import { COSA_SALVATA } from '@/lib/salvatoMaison'
import FoglioRimanda from './pulizie/FoglioRimanda'

type Props = {
  camera: string; oggi: string; pulizia: Decisione; ultimaId: string | null
  persone?: number | null; partenza?: string; scegliData?: boolean; home?: boolean
  /** la veste della pagina Pulizie nuova (01/10/2026): timer grande e comandi sottolineati */
  pagina?: boolean
  /** nel foglio «Rimanda o salta» per il cambio biancheria: «Lucia Ferri · 4ª notte» */
  chi?: string
  nomeCamera?: (bookingId: string) => string | null; onVaiA?: (chiave: string) => void
  onSalvato?: (risposta: RispostaPulizia) => void
}

// Un solo percorso per Home, pulizie aperte e registro. Il recupero prima
// della conferma viene scritto nella stessa transazione della pulizia.
export default function ControlliPulizia({ camera, oggi, pulizia, ultimaId, persone, partenza, scegliData, home = false, pagina = false, chi, nomeCamera, onVaiA, onSalvato }: Props) {
  const [confermata, setConfermata] = useState<Decisione | null>(pulizia.id && pulizia.stato === 'fatta' ? pulizia : null)
  const [recupero, setRecupero] = useState<Recupero | null>(null)
  // Il pop-up approvato (SchedaPulizia) per «Pulita e recuperato» e per le correzioni.
  const [scheda, setScheda] = useState<Decisione | null>(null)
  const [occupata, setOccupata] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [rilettura, setRilettura] = useState(0)
  const [pendente, setPendente] = useState(false)
  const [data, setData] = useState(oggi)
  const [menuSposta, setMenuSposta] = useState(false)
  const [sposta, setSposta] = useState<{ stato: 'rimandata' | 'saltata'; data: string } | null>(null)
  const blocco = useRef(false)
  const tempi = useTimerPulizie()
  const timer = tempi.timer.find(t => t.chiave === chiaveTimerPulizia(pulizia.booking_id ?? '', pulizia.tipo, pulizia.data_prevista))


  useEffect(() => {
    const leggi = () => {
      try { setPendente(!!leggiOperazionePulizia(window.localStorage, pulizia.room_id)) }
      catch { setErrore('Non riesco a leggere il salvataggio conservato su questo dispositivo.'); setPendente(true) }
    }
    const t = window.setTimeout(leggi, 0)
    const dopoSalvataggio = () => { leggi(); setRilettura(x => x + 1) }
    window.addEventListener('pulizie-salvataggi', dopoSalvataggio)
    window.addEventListener('storage', dopoSalvataggio); window.addEventListener('focus', dopoSalvataggio)
    return () => { window.clearTimeout(t); window.removeEventListener('pulizie-salvataggi', dopoSalvataggio); window.removeEventListener('storage', dopoSalvataggio); window.removeEventListener('focus', dopoSalvataggio) }
  }, [pulizia.room_id])

  useEffect(() => {
    if (!confermata?.id) return
    let viva = true
    leggiRecuperiDellePulizie([confermata.id]).then(r => {
      if (!viva) return
      if (r.errore || !r.tabella) setErrore(r.errore || 'Il recupero biancheria non è disponibile.')
      else setRecupero(r.righe[0] ?? null)
    }).catch(() => { if (viva) setErrore('Non riesco a leggere il recupero. Riprova.') })
    return () => { viva = false }
  }, [confermata?.id, rilettura])

  // Home «Maison» (28/09/2026): dopo «Conferma» di Rimanda/Salta il pannello
  // mostra la conferma B; la rilettura della Home parte quando si chiude,
  // altrimenti la voce sparirebbe sotto la spunta.
  const [salvato, setSalvato] = useState<Salvataggio | null>(null)
  const rinviaRilettura = useRef(false)
  function fineSalvato() {
    setSalvato(null); setSposta(null); setMenuSposta(false)
    ricaricaNumeriOggiOvunque(); void ricaricaDaControllare()
  }

  async function invia(richiesta: RichiestaPulizia | null): Promise<string | null> {
    if (blocco.current) return 'Salvataggio già in corso.'
    blocco.current = true; setOccupata(true); setErrore(null)
    try {
      const esito = await inviaOperazionePulizia(pulizia.room_id, richiesta)
      try { setPendente(!!leggiOperazionePulizia(window.localStorage, pulizia.room_id)) }
      catch { setPendente(true) }
      if (esito.errore) {
        if (esito.errore.includes('cambiata nel frattempo')) setScheda(null)
        setErrore(esito.errore); return esito.errore
      }
      if (esito.risposta) {
        const stessa = confermata ? esito.risposta.pulizia.id === confermata.id : esito.risposta.pulizia.booking_id === pulizia.booking_id && esito.risposta.pulizia.tipo === pulizia.tipo && esito.risposta.pulizia.data_prevista === pulizia.data_prevista
        if (stessa && esito.risposta.pulizia.stato === 'fatta') setConfermata(esito.risposta.pulizia)
        if (stessa) setRecupero(esito.risposta.recupero); setScheda(null)
        onSalvato?.(esito.risposta)
        if (rinviaRilettura.current && richiesta?.azione === 'registra' && (richiesta.pulizia.stato === 'rimandata' || richiesta.pulizia.stato === 'saltata')) {
          setSalvato({ cosa: (richiesta.pulizia.stato === 'rimandata' ? COSA_SALVATA.rimandata : COSA_SALVATA.saltata)(camera), quando: new Date() })
        } else {
          setSposta(null)
          ricaricaNumeriOggiOvunque(); void ricaricaDaControllare()
        }
      }
      return null
    } finally { blocco.current = false; setOccupata(false) }
  }

  async function registra(stato: Decisione['stato'], valori: Contatori | null = null, n?: number, prossima?: string) {
    if (pendente) return invia(null)
    const quanti = n ?? persone ?? pulizia.persone_servite ?? await leggiPersonePulizia(pulizia.booking_id)
    if (!quanti) { const msg = 'Non riesco a leggere il numero di ospiti del soggiorno. Riprova.'; setErrore(msg); return msg }
    if (stato === 'fatta' && (!data || data > oggi)) { const msg = 'Scegli la data in cui hai fatto la pulizia, fino a oggi.'; setErrore(msg); return msg }
    return invia({ azione: 'registra', ultima_id: ultimaId, pulizia: {
      ...pulizia, stato, data_effettiva: stato === 'fatta' ? data : null,
      prossima_data: stato === 'fatta' ? null : prossima ?? sposta?.data ?? null,
      cambio_biancheria: stato === 'fatta', persone_servite: quanti,
    }, recupero: valori })
  }

  function apriRecupero() {
    if (blocco.current || pendente) return
    setErrore(null)
    setScheda(confermata ?? { ...pulizia, stato: 'fatta', persone_servite: persone ?? pulizia.persone_servite })
  }

  const letto = recupero ? recuperoDaRiga(recupero as unknown as Record<string, unknown>) : null
  const pezzi = letto ? totalePezzi(letto.pezzi) + totaleSenzaMisura(letto.senzaMisura) : 0
  const riepilogo = letto && pezzi > 0 ? `Recuperato: ${pezzi === 1 ? '1 pezzo' : `${pezzi} pezzi`}` : null
  // ── Home «Maison» (28/09/2026) ────────────────────────────────────────
  // Timer compatto, poi «Pulita» (ottone), «Pulita e recuperato» e «Rimanda o
  // salta» (grigie). «Rimanda o salta» si apre sotto la voce come prima:
  // selettore «Rimanda | Salta» a filo, la data a filo, la frase sulla
  // partenza quando vale, «Annulla» e «Conferma» pieno. Stesse date di prima.
  // ── Pagina Pulizie (riferimento del 01/10/2026) ───────────────────────
  // Il timer GRANDE (TimerPulizia, stessa logica) e i tre comandi di sempre:
  // «Pulita» pieno d'inchiostro solo nella camera col timer in corso, gli
  // altri sottolineati; «Rimanda o salta» apre il suo foglio (FoglioRimanda), come in Home.
  if (pagina) {
    const inCorso = !!timer?.avviato_at
    const apriSposta = () => { setErrore(null); setMenuSposta(true) }
    return <div data-controlli-pulizia data-veste="pagina">
      {!confermata && pulizia.booking_id && <TimerPulizia grande chiave={chiaveTimerPulizia(pulizia.booking_id, pulizia.tipo, pulizia.data_prevista)} nome={camera} nomeCamera={nomeCamera ?? (id => id === pulizia.booking_id ? camera : null)} onVaiA={onVaiA} onMinuti={apriRecupero} />}
      <div className="pul-azioni">
        {confermata ? <span className="pul-az" data-fatta>✓ Pulita</span>
          : <button type="button" className={`pul-az${inCorso ? ' p' : ''}`} onClick={() => timer && (timer.avviato_at || timer.trascorsi > 0) ? apriRecupero() : void registra('fatta')} disabled={occupata || pendente} data-pulita>{occupata && !sposta ? 'Salvo…' : 'Pulita'}</button>}
        <button type="button" className="pul-az" onClick={apriRecupero} disabled={occupata || pendente} data-recuperato>{!confermata ? 'Pulita e recuperato' : riepilogo ? 'Modifica recupero' : 'Recuperato'}</button>
        {!confermata && <button type="button" className="pul-az tn" disabled={occupata || pendente} onClick={apriSposta} aria-expanded={menuSposta} data-rimanda-o-salta>Rimanda o salta</button>}
      </div>
      {riepilogo && <p className="pul-avviso" data-riepilogo-recupero>{riepilogo}</p>}
      {!confermata && menuSposta && <FoglioRimanda camera={camera} pulizia={pulizia} oggi={oggi} chi={chi} partenza={partenza} occupato={occupata || pendente}
        errore={errore} salvato={salvato} onFineSalvato={fineSalvato} onAnnulla={() => { setSposta(null); setMenuSposta(false) }}
        onConferma={(stato, data) => { rinviaRilettura.current = true; setSposta({ stato, data }); void registra(stato, null, undefined, data).finally(() => { rinviaRilettura.current = false }) }} />}
      {(errore || pendente) && <AvvisoAzione testo={errore || 'Un salvataggio attende conferma. Premi Riprova.'} className="mt-2" onRiprova={pendente ? () => void invia(null) : () => window.location.reload()} />}
      {scheda && <SchedaPulizia camera={camera} pulizia={scheda} oggi={oggi} ultimaId={ultimaId} onChiudi={() => setScheda(null)}
        nomeCamera={nomeCamera ?? (id => id === pulizia.booking_id ? camera : null)} onVaiA={onVaiA}
        onSalvato={r => { if (r.pulizia.stato === 'fatta' && (!confermata || r.pulizia.id === confermata.id)) setConfermata(r.pulizia); setRecupero(r.recupero); setRilettura(x => x + 1); onSalvato?.(r) }} />}
    </div>
  }

  if (home) {
    const apriSposta = () => { setErrore(null); setMenuSposta(true) }
    return <div data-controlli-pulizia>
      {!confermata && pulizia.booking_id && <TimerPulizia compatto chiave={chiaveTimerPulizia(pulizia.booking_id, pulizia.tipo, pulizia.data_prevista)} nome={camera} nomeCamera={id => id === pulizia.booking_id ? camera : null} onMinuti={apriRecupero} />}
      <div className="ac">
        {confermata ? <span className="mz-lnk" data-fatta>✓ Pulita</span>
          : <button type="button" className="mz-lnk" onClick={() => timer && (timer.avviato_at || timer.trascorsi > 0) ? apriRecupero() : void registra('fatta')} disabled={occupata || pendente} data-pulita>{occupata && !sposta ? 'Salvo…' : 'Pulita'}</button>}
        <button type="button" className="mz-lnk q" onClick={apriRecupero} disabled={occupata || pendente} data-recuperato>{!confermata ? 'Pulita e recuperato' : riepilogo ? 'Modifica recupero' : 'Recuperato'}</button>
        {!confermata && <button type="button" className="mz-lnk q" disabled={occupata || pendente} onClick={apriSposta} aria-expanded={menuSposta} data-rimanda-o-salta>Rimanda o salta</button>}
      </div>
      {riepilogo && <p className="mz-note" data-riepilogo-recupero>{riepilogo}</p>}
      {partenza && confermata?.tipo === 'soggiorno' && confermata.data_effettiva && <p className="mz-note">{addDaysStr(confermata.data_effettiva, 4) >= partenza ? 'Nessun altro cambio prima della partenza.' : `Prossimo cambio: ${addDaysStr(confermata.data_effettiva, 4).split('-').reverse().join('/')}`}</p>}
      {!confermata && menuSposta && <FoglioRimanda camera={camera} pulizia={pulizia} oggi={oggi} chi={chi} partenza={partenza} occupato={occupata || pendente}
        errore={errore} salvato={salvato} onFineSalvato={fineSalvato} onAnnulla={() => { setSposta(null); setMenuSposta(false) }}
        onConferma={(stato, data) => { rinviaRilettura.current = true; setSposta({ stato, data }); void registra(stato, null, undefined, data).finally(() => { rinviaRilettura.current = false }) }} />}
      {(errore || pendente) && <AvvisoAzione testo={errore || 'Un salvataggio attende conferma. Premi Riprova.'} className="mt-2" onRiprova={pendente ? () => void invia(null) : () => window.location.reload()} />}
      {scheda && <SchedaPulizia camera={camera} pulizia={scheda} oggi={oggi} ultimaId={ultimaId} onChiudi={() => setScheda(null)}
        nomeCamera={id => id === pulizia.booking_id ? camera : null}
        onSalvato={r => { if (r.pulizia.stato === 'fatta' && (!confermata || r.pulizia.id === confermata.id)) setConfermata(r.pulizia); setRecupero(r.recupero); setRilettura(x => x + 1); onSalvato?.(r) }} />}
    </div>
  }

  return <div className="mt-2" data-controlli-pulizia>
    {home && !confermata && pulizia.booking_id && <TimerPulizia compatto chiave={chiaveTimerPulizia(pulizia.booking_id, pulizia.tipo, pulizia.data_prevista)} nome={camera} nomeCamera={id => id === pulizia.booking_id ? camera : null} onMinuti={apriRecupero} />}
    <div className={`flex flex-wrap items-center ${home ? 'home-pulizia-azioni' : 'gap-2'}`}>
      {confermata ? <span className="text-sm text-green-mid font-semibold" data-fatta>✓ Pulita</span> : <>
        {scegliData && <label className="text-xs text-stone">Fatta il <input aria-label={`Fatta il · ${camera}`} type="date" max={oggi} value={data} onChange={e => setData(e.target.value)} disabled={occupata || pendente} className="ed-campo text-xs py-1" /></label>}
        <button type="button" onClick={() => timer && (timer.avviato_at || timer.trascorsi > 0) ? apriRecupero() : void registra('fatta')} disabled={occupata || pendente} className={home ? 'ed-azione' : 'ed-pillola disabled:opacity-50'} style={{ minHeight: 44 }} data-pulita>{occupata ? 'Salvo…' : 'Pulita'}</button>
      </>}
      <button type="button" onClick={apriRecupero} disabled={occupata || pendente} className={home ? 'ed-azione' : 'ed-pillola-contorno disabled:opacity-50'} style={{ minHeight: 44 }} data-recuperato>{!confermata ? 'Pulita e recuperato' : riepilogo ? 'Modifica recupero' : 'Recuperato'}</button>
      {!confermata && home && <button type="button" className="ed-azione ed-azione-tenue" style={{ minHeight: 44 }} disabled={occupata || pendente} onClick={() => setMenuSposta(x => !x)} aria-expanded={menuSposta}>Rimanda o salta</button>}
      {!confermata && (!home || menuSposta) && <div className={`flex items-center gap-5 ${home ? 'basis-full' : ''}`}>
        <button type="button" onClick={() => setSposta({ stato: 'rimandata', data: addDaysStr(pulizia.data_prevista > oggi ? pulizia.data_prevista : oggi, 1) })} disabled={occupata || pendente} className={home ? 'ed-azione ed-azione-tenue' : 'ed-pillola-tenue'} style={{ minHeight: 44 }}>Rimanda</button>
        {pulizia.tipo === 'soggiorno' && <button type="button" onClick={() => setSposta({ stato: 'saltata', data: addDaysStr(pulizia.data_prevista, 4) })} disabled={occupata || pendente} className={home ? 'ed-azione ed-azione-tenue' : 'ed-pillola-tenue'} style={{ minHeight: 44 }}>Salta</button>}
      </div>}
    </div>
    {riepilogo && <p className="text-xs text-green-mid mt-2" data-riepilogo-recupero>{riepilogo}</p>}
    {partenza && confermata?.tipo === 'soggiorno' && confermata.data_effettiva && <p className="text-xs text-stone mt-2">{partenza && addDaysStr(confermata.data_effettiva, 4) >= partenza ? 'Nessun altro cambio prima della partenza.' : `Prossimo cambio: ${addDaysStr(confermata.data_effettiva, 4).split('-').reverse().join('/')}`}</p>}
    {sposta && <div className="mt-2 p-3 bg-cream rounded-lg text-sm flex flex-wrap items-center gap-2">
      <label>{sposta.stato === 'rimandata' ? 'Rimanda al ' : 'Salta questa · prossima il '}<input type="date" aria-label="Prossima pulizia" min={addDaysStr(pulizia.data_prevista, 1)} value={sposta.data} onChange={e => setSposta({ ...sposta, data: e.target.value })} disabled={occupata || pendente} className="ed-campo text-xs" /></label>
      {partenza && sposta.data >= partenza && <p className="w-full text-xs text-stone">Nessun altro cambio prima della partenza del {partenza.split('-').reverse().join('/')}.</p>}
      <button type="button" className="ed-pillola" disabled={occupata || pendente || sposta.data <= pulizia.data_prevista} onClick={() => void registra(sposta.stato)}>Conferma</button>
      <button type="button" className="ed-pillola-tenue" disabled={occupata || pendente} onClick={() => setSposta(null)}>Annulla</button>
    </div>}
    {(errore || pendente) && <AvvisoAzione testo={errore || 'Un salvataggio attende conferma. Premi Riprova.'} className="mt-2" onRiprova={pendente ? () => void invia(null) : () => window.location.reload()} />}
    {scheda && <SchedaPulizia camera={camera} pulizia={scheda} oggi={oggi} ultimaId={ultimaId} onChiudi={() => setScheda(null)}
      nomeCamera={id => id === pulizia.booking_id ? camera : null}
      onSalvato={r => { if (r.pulizia.stato === 'fatta' && (!confermata || r.pulizia.id === confermata.id)) setConfermata(r.pulizia); setRecupero(r.recupero); setRilettura(x => x + 1); onSalvato?.(r) }} />}
  </div>
}
