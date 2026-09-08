'use client'
import { useEffect, useRef, useState } from 'react'
import SchedaRecupero from './SchedaRecupero'
import AvvisoAzione from './AvvisoAzione'
import { addDaysStr, type Decisione } from '@/lib/pulizie'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { limitiRecupero, normalizza, riassunto, vuoto, type Contatori, type Recupero } from '@/lib/biancheria'
import { leggiOperazionePulizia, type RichiestaPulizia, type RispostaPulizia } from '@/lib/pulizieOperazioni'
import { inviaOperazionePulizia, leggiPersonePulizia } from '@/lib/pulizieServizio'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'

type Props = {
  camera: string; oggi: string; pulizia: Decisione; ultimaId: string | null
  persone?: number | null; partenza?: string; scegliData?: boolean; home?: boolean
  onSalvato?: (risposta: RispostaPulizia) => void
}

// Un solo percorso per Home, pulizie aperte e registro. Il recupero prima
// della conferma viene scritto nella stessa transazione della pulizia.
export default function ControlliPulizia({ camera, oggi, pulizia, ultimaId, persone, partenza, scegliData, home = false, onSalvato }: Props) {
  const [confermata, setConfermata] = useState<Decisione | null>(pulizia.id && pulizia.stato === 'fatta' ? pulizia : null)
  const [recupero, setRecupero] = useState<Recupero | null>(null)
  const [scheda, setScheda] = useState<{ valori: Contatori; limiti: Contatori; versione: string | null; persone: number } | null>(null)
  const [occupata, setOccupata] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [rilettura, setRilettura] = useState(0)
  const [pendente, setPendente] = useState(false)
  const [data, setData] = useState(oggi)
  const [sposta, setSposta] = useState<{ stato: 'rimandata' | 'saltata'; data: string } | null>(null)
  const blocco = useRef(false)


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
        if (stessa) setRecupero(esito.risposta.recupero); setScheda(null); setSposta(null)
        onSalvato?.(esito.risposta)
        ricaricaNumeriOggiOvunque(); void ricaricaDaControllare()
      }
      return null
    } finally { blocco.current = false; setOccupata(false) }
  }

  async function registra(stato: Decisione['stato'], valori: Contatori | null = null, n?: number) {
    if (pendente) return invia(null)
    const quanti = n ?? persone ?? pulizia.persone_servite ?? await leggiPersonePulizia(pulizia.booking_id)
    if (!quanti) { const msg = 'Non riesco a leggere il numero di ospiti del soggiorno. Riprova.'; setErrore(msg); return msg }
    if (stato === 'fatta' && (!data || data > oggi)) { const msg = 'Scegli la data in cui hai fatto la pulizia, fino a oggi.'; setErrore(msg); return msg }
    return invia({ azione: 'registra', ultima_id: ultimaId, pulizia: {
      ...pulizia, stato, data_effettiva: stato === 'fatta' ? data : null,
      prossima_data: stato === 'fatta' ? null : sposta?.data ?? null,
      cambio_biancheria: stato === 'fatta', persone_servite: quanti,
    }, recupero: valori })
  }

  async function apriRecupero() {
    if (blocco.current || pendente) return
    blocco.current = true; setOccupata(true); setErrore(null)
    try {
      const r = confermata?.id ? await leggiRecuperiDellePulizie([confermata.id]) : null
      if (r && (r.errore || !r.tabella)) { setErrore(r.errore || 'Il recupero biancheria non è disponibile.'); return }
      const precedente = r?.righe[0] ?? null
      const n = confermata?.persone_servite ?? persone ?? pulizia.persone_servite ?? await leggiPersonePulizia(pulizia.booking_id)
      if (!n) { setErrore('Non riesco a leggere il numero di ospiti del soggiorno. Riprova.'); return }
      const valori = precedente ? normalizza(precedente) : vuoto()
      setScheda({ valori, limiti: limitiRecupero(n, valori), versione: precedente?.updated_at ?? null, persone: n })
    } catch { setErrore('Non riesco a leggere il recupero. Riprova.') }
    finally { blocco.current = false; setOccupata(false) }
  }

  const riepilogo = recupero && riassunto(recupero)
  return <div className="mt-2" data-controlli-pulizia>
    <div className={`flex flex-wrap items-center ${home ? 'gap-x-6 gap-y-0' : 'gap-2'}`}>
      {confermata ? <span className="text-sm text-green-mid font-semibold" data-fatta>✓ Pulita</span> : <>
        {scegliData && <label className="text-xs text-stone">Fatta il <input aria-label={`Fatta il · ${camera}`} type="date" max={oggi} value={data} onChange={e => setData(e.target.value)} disabled={occupata || pendente} className="ed-campo text-xs py-1" /></label>}
        <button type="button" onClick={() => void registra('fatta')} disabled={occupata || pendente} className={home ? 'ed-azione' : 'ed-pillola disabled:opacity-50'} style={{ minHeight: 44 }} data-pulita>{occupata ? 'Salvo…' : 'Pulita'}</button>
      </>}
      <button type="button" onClick={() => void apriRecupero()} disabled={occupata || pendente} className={home ? 'ed-azione' : 'ed-pillola-contorno disabled:opacity-50'} style={{ minHeight: 44 }} data-recuperato>{!confermata ? 'Pulita e recuperato' : riepilogo ? 'Modifica recupero' : 'Recuperato'}</button>
      {!confermata && <div className={`flex items-center gap-5 ${home ? 'basis-full' : ''}`}>
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
    {scheda && <SchedaRecupero camera={`${camera} · ${scheda.persone} ${scheda.persone === 1 ? 'ospite' : 'ospiti'}`} iniziale={scheda.valori} limiti={scheda.limiti} bloccata={pendente}
      onChiudi={() => setScheda(null)} onSalva={valori => pendente ? invia(null) : confermata?.id
        ? invia({ azione: 'recupero', cleaning_id: confermata.id, versione: scheda.versione, recupero: valori })
        : registra('fatta', valori, scheda.persone)} />}
  </div>
}
