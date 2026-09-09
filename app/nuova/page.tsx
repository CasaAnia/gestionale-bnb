'use client'
// NUOVA PRENOTAZIONE (09/09/2026) — disegno scelto da Ania fra tre proposte:
// ricerca in cima come nel Calendario, il cliente coi suoi soggiorni, le camere
// e i periodi (anche più camere e il cambio camera prima di salvare), lo sconto,
// il totale, e in fondo le quattro righe «già a posto» da toccare solo se
// cambiano. I prezzi e i letti restano quelli delle regole di sempre
// (lib/tariffe, lib/prezzoNotti): qui si compone, non si inventano listini.
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackBar from '@/components/BackBar'
import CampoRicerca from '@/components/CampoRicerca'
import s from './nuova.module.css'
import {
  conLettoAutomatico, contoPeriodo, dividiPerCambio, lettoDaRegole, notti as nottiPeriodo,
  ospitiIniziali, problemi, rigaDaSalvare, righeConto, tariffaProposta, totalePieno,
  type CameraComposta, type PeriodoComposto,
} from '@/lib/prenotazioneComposta'
import { giorniSoggiorno } from '@/lib/prezzoNotti'
import { capienzaCamera } from '@/lib/tariffe'
import { lettiPoolPrenotazione, nottiLettoExtra } from '@/lib/lettiAggiuntivi'
import { contoSoggiorno } from '@/lib/conto'
import { conInizialiONull, maiuscoleNelCampo } from '@/lib/maiuscole'
import { smartBack, returnToSicuro } from '@/lib/navHistory'
import { messaggioErroreDati } from '@/lib/connessione'
import { leggiConEsito } from '@/lib/prenotazioneScritture'
import {
  ETICHETTA_PROVENIENZA, PROVENIENZE, campiProvenienza, normalizzaProvenienza,
  type Provenienza, type StrutturaNota,
} from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura, salvaProvenienzaCliente } from '@/lib/provenienzaDati'
import { cercaSchedaPerTelefono } from '@/lib/clienteTelefonoDati'
import { nomeSuPrenotazione as calcolaNomeSuPrenotazione } from '@/lib/clienteTelefono'
import {
  colonnaRicevutaPresente, payloadValutazione, valutazioneDi, vuoleRicevuta, type Valutazione,
} from '@/lib/valutazione'

type ClienteRiga = {
  id: string; full_name: string | null; phone: string | null; email: string | null
  rating: string; note?: string | null
  provenienza?: string | null; struttura_nome?: string | null
}
type CameraRiga = CameraComposta & {
  base_price: number | string; double_price?: number | string | null
  has_extra_bed?: boolean | null; extra_bed_price?: number | string | null
}
type RigaStorico = {
  id: string; group_id: string | null; status: string; check_in: string; check_out: string
  num_guests: number; total_amount: number | string; price_per_night: number | string
  extra_bed_total?: number | string | null; discount_type?: string | null; discount_value?: number | string | null
  rooms?: { name?: string | null } | null
}
type SoggiornoConcluso = {
  chiave: string; dal: string; al: string; camere: string; ospiti: number
  notti: number; totale: number; pieno: number
}
type Contatto = { nome: string; chiE: string; telefono: string }
type Accordo = {
  modo: 'contanti' | 'bonifico_arrivo' | 'bonifico_intero' | 'caparra_meta' | 'caparra_libera'
  importo: number | null; data: string; ora: string
}

const MESI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const euro = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const piuUnGiorno = (base: string) => { if (!base) return ''; const [y, m, d] = base.split('-').map(Number); return iso(new Date(y, m - 1, d + 1)) }
const gg = (i: string) => { if (!i) return '—'; const [, m, d] = i.split('-').map(Number); return `${d} ${MESI[m - 1]}` }
const ggAnno = (i: string) => { const [a, m, d] = i.split('-').map(Number); return `${d} ${MESI[m - 1]} ${String(a).slice(2)}` }
function periodoBreve(dal: string, al: string) {
  const [ya, ma, da] = dal.split('-').map(Number)
  const [yb, mb, db] = al.split('-').map(Number)
  return ma === mb && ya === yb ? `${da}→${db} ${MESI[mb - 1]} ${String(yb).slice(2)}` : `${da} ${MESI[ma - 1]}→${ggAnno(al)}`
}
const ETICHETTA_ACCORDO: Record<Accordo['modo'], string> = {
  contanti: 'Contanti all’arrivo', bonifico_arrivo: 'Bonifico all’arrivo', bonifico_intero: 'Bonifico · intero importo',
  caparra_meta: 'Bonifico · caparra del 50%', caparra_libera: 'Bonifico · caparra personalizzata',
}

export default function NuovaPrenotazionePage() {
  return <Suspense><NuovaPrenotazione /></Suspense>
}

let contatore = 0
const nuovoId = () => `n${Date.now().toString(36)}${++contatore}`

function NuovaPrenotazione() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = returnToSicuro(searchParams.get('returnTo')) || '/prenotazioni'
  const cameraDaUrl = searchParams.get('room_id') || ''
  const arrivoDaUrl = searchParams.get('check_in') || iso(new Date())
  const clienteDaUrl = searchParams.get('guest_id') || ''
  const gruppoDaUrl = searchParams.get('group_id') || ''

  const [camere, setCamere] = useState<CameraRiga[]>([])
  const trovaCamera = useCallback((id: string | null) => camere.find(c => c.id === id) ?? null, [camere])

  // ── cliente ───────────────────────────────────────────────────────────────
  const [ricerca, setRicerca] = useState('')
  const [risultati, setRisultati] = useState<ClienteRiga[]>([])
  const [cercando, setCercando] = useState(false)
  const [erroreRicerca, setErroreRicerca] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClienteRiga | null>(null)
  const [bloccato, setBloccato] = useState<ClienteRiga | null>(null)
  const [nuovo, setNuovo] = useState<{ nome: string; telefono: string; valutazione: Valutazione; ricevuta: boolean; nota: string } | null>(null)
  const [modifica, setModifica] = useState<{ nome: string; telefono: string; valutazione: Valutazione; ricevuta: boolean; nota: string } | null>(null)
  const [storico, setStorico] = useState<SoggiornoConcluso[]>([])
  const [erroreStorico, setErroreStorico] = useState<string | null>(null)
  const [storicoAperto, setStoricoAperto] = useState(false)
  const [nomeSuQuesta, setNomeSuQuesta] = useState<string | null>(null)

  // ── provenienza ───────────────────────────────────────────────────────────
  const [provenienza, setProvenienza] = useState<{ provenienza: Provenienza | null; struttura: string }>({ provenienza: null, struttura: '' })
  const [altraStruttura, setAltraStruttura] = useState(false)
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const [avvisoProvenienza, setAvvisoProvenienza] = useState<string | null>(null)

  // ── camere e periodi ──────────────────────────────────────────────────────
  const [periodi, setPeriodi] = useState<PeriodoComposto[]>([{
    id: nuovoId(), gruppo: gruppoDaUrl || nuovoId(), roomId: cameraDaUrl || null,
    checkIn: arrivoDaUrl, checkOut: piuUnGiorno(arrivoDaUrl), ospiti: 2, nottiLetto: [], letto: null, tariffa: null,
  }])
  const [cambioSu, setCambioSu] = useState<string | null>(null)
  const [cambio, setCambio] = useState({ roomId: '', dal: '', tariffa: '' })
  const [conflitti, setConflitti] = useState<string[]>([])
  const [lettiAltrui, setLettiAltrui] = useState<Map<string, number>>(new Map())

  // ── sconto, accordo, persone, note ────────────────────────────────────────
  const [sconto, setSconto] = useState<{ tipo: 'percentuale' | 'totale'; valore: number } | null>(null)
  const [pct, setPct] = useState('')
  const [target, setTarget] = useState('')
  const [erroreSconto, setErroreSconto] = useState<string | null>(null)
  const [aperta, setAperta] = useState<'arrivo' | 'pagamento' | 'chi' | 'note' | null>(null)
  const [orario, setOrario] = useState('')
  const [navetta, setNavetta] = useState<'' | 'si' | 'no'>('')
  const [accordo, setAccordo] = useState<Accordo>({ modo: 'contanti', importo: null, data: '', ora: '' })
  const [chi, setChi] = useState<'prenota' | 'altra'>('prenota')
  const [contatti, setContatti] = useState<Contatto[]>([{ nome: '', chiE: '', telefono: '' }])
  const [note, setNote] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [errori, setErrori] = useState<string[]>([])
  const [avvisoSalvataggio, setAvvisoSalvataggio] = useState<string | null>(null)
  const [salvata, setSalvata] = useState<string | null>(null)

  // ── conti ─────────────────────────────────────────────────────────────────
  const pieno = totalePieno(periodi, trovaCamera)
  const valoreSconto = useMemo(() => {
    if (pieno === null || !sconto) return 0
    const v = sconto.tipo === 'percentuale' ? pieno * sconto.valore / 100 : Math.max(0, pieno - sconto.valore)
    return Math.round(v * 100) / 100
  }, [pieno, sconto])
  const totale = pieno === null ? null : Math.round((pieno - valoreSconto) * 100) / 100
  const righe = righeConto(periodi, trovaCamera)
  const caparra = totale === null ? null
    : accordo.modo === 'caparra_meta' ? Math.round(totale * 50) / 100
    : accordo.modo === 'caparra_libera' ? accordo.importo
    : null
  const scelto = Boolean(cliente || nuovo)
  const nomeCliente = cliente?.full_name ?? nuovo?.nome ?? ''
  const telefonoCliente = cliente?.phone ?? nuovo?.telefono ?? ''

  // ── caricamenti ───────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.from('rooms').select('*').eq('active', true).then(({ data }) => {
      const ORDINE = ['Amelia', 'Allegra', 'Ambra', 'Lena']
      const lista = ((data || []) as CameraRiga[]).sort((a, b) => {
        const ia = ORDINE.findIndex(o => a.name?.includes(o)), ib = ORDINE.findIndex(o => b.name?.includes(o))
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
      })
      setCamere(lista)
      // Arrivando dal calendario la camera è già scelta: applica le sue
      // persone e il letto aggiuntivo come se l'avessi appena toccata.
      if (cameraDaUrl) {
        const camera = lista.find(c => c.id === cameraDaUrl) ?? null
        setPeriodi(ps => ps.map((p, i) => (i === 0 && p.roomId === cameraDaUrl
          ? conLettoAutomatico({ ...p, ospiti: ospitiIniziali(camera) }, camera)
          : p)))
      }
    })
    leggiStrutture().then(r => { setStrutture({ disponibile: r.disponibile, lista: r.strutture }); if (r.errore) setAvvisoProvenienza(r.errore) })
    // camere e strutture si leggono una volta sola all'apertura; la camera che
    // arriva dal calendario è nell'indirizzo e non cambia mentre sei qui
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function caricaCliente(id: string) {
    const { data, error } = await supabase.from('guests').select('*').eq('id', id).single()
    if (error) { setErroreRicerca(messaggioErroreDati(error, 'caricare il cliente')); return }
    if (data) scegliCliente(data as ClienteRiga)
  }

  // Storico: i soggiorni CONCLUSI, uno per gruppo (un cambio camera non è
  // una seconda visita) e con quanto ha pagato davvero.
  async function caricaStorico(guestId: string) {
    setErroreStorico(null)
    const oggi = iso(new Date())
    const { data, errore } = await leggiConEsito<RigaStorico[]>(
      () => supabase.from('bookings').select('*, rooms(name)').eq('guest_id', guestId).neq('status', 'annullata').lt('check_out', oggi).order('check_in', { ascending: false }),
      'caricare i soggiorni precedenti')
    if (errore) { setStorico([]); setErroreStorico(errore); return }
    const gruppi = new Map<string, RigaStorico[]>()
    for (const r of data || []) {
      const k = r.group_id || r.id
      gruppi.set(k, [...(gruppi.get(k) || []), r])
    }
    const lista: SoggiornoConcluso[] = [...gruppi.entries()].map(([chiave, righe]) => {
      const ordinate = [...righe].sort((a, b) => a.check_in.localeCompare(b.check_in))
      const conti = ordinate.map(r => contoSoggiorno(r))
      return {
        chiave,
        dal: ordinate[0].check_in,
        al: ordinate[ordinate.length - 1].check_out,
        camere: [...new Set(ordinate.map(r => r.rooms?.name || 'camera'))].join(' → '),
        ospiti: Math.max(...ordinate.map(r => Number(r.num_guests) || 1)),
        notti: ordinate.reduce((t, r) => t + giorniSoggiorno(r.check_in, r.check_out).length, 0),
        totale: Math.round(conti.reduce((t, c) => t + c.totale, 0) * 100) / 100,
        pieno: Math.round(conti.reduce((t, c) => t + c.prezzoPieno, 0) * 100) / 100,
      }
    }).sort((a, b) => b.dal.localeCompare(a.dal))
    setStorico(lista)
  }

  // ── ricerca cliente, come in Calendario, Arrivi e Richieste ───────────────
  // La ricerca parte dal campo (non da un effetto): si scrive, si aspetta un
  // quarto di secondo e si cerca, così ogni lettera non fa una domanda a Supabase.
  const timerRicerca = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clienteDaUrlFatto = useRef(false)
  useEffect(() => {
    if (!clienteDaUrl || clienteDaUrlFatto.current) return
    clienteDaUrlFatto.current = true
    void caricaCliente(clienteDaUrl)
    // caricaCliente non cambia fra un giro e l'altro: dipende solo dall'id
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteDaUrl])

  function scriviRicerca(v: string) {
    setRicerca(v)
    setBloccato(null)
    setRisultati([])
    if (timerRicerca.current) clearTimeout(timerRicerca.current)
    const testo = v.trim()
    if (testo.length < 2) return
    timerRicerca.current = setTimeout(() => { void cerca(testo) }, 250)
  }

  async function cerca(testo: string) {
    setCercando(true); setErroreRicerca(null)
    try {
      const cifre = testo.replace(/\D/g, '')
      const trovati = new Map<string, ClienteRiga>()
      const { data: perNome, error: e1 } = await supabase.from('guests').select('*').ilike('full_name', `%${testo}%`).limit(10)
      if (e1) throw e1
      for (const g of perNome || []) trovati.set(g.id, g)
      if (cifre.length >= 3) {
        const corto = cifre.startsWith('39') ? cifre.slice(2) : cifre
        const { data: perTelefono, error: e2 } = await supabase.from('guests').select('*').or(`phone.ilike.%${corto}%,phone.ilike.%${cifre}%`).limit(10)
        if (e2) throw e2
        for (const g of perTelefono || []) trovati.set(g.id, g)
      }
      // nomi e numeri aggiuntivi delle prenotazioni (chi ha soggiornato per qualcun altro)
      const { data: daPrenotazioni, error: e3 } = await supabase.from('bookings')
        .select('guests(*)')
        .or(`extra_phone_1_name.ilike.%${testo}%,guest_name.ilike.%${testo}%`)
        .neq('status', 'annullata').limit(5)
      if (e3) throw e3
      for (const b of (daPrenotazioni || []) as unknown as { guests: ClienteRiga | null }[]) if (b.guests) trovati.set(b.guests.id, b.guests)
      setRisultati([...trovati.values()])
    } catch (err) {
      setErroreRicerca(messaggioErroreDati(err, 'cercare il cliente'))
      setRisultati([])
    } finally {
      setCercando(false)
    }
  }

  function scegliCliente(c: ClienteRiga) {
    if (valutazioneDi(c) === 'problematico') { setBloccato(c); return }
    setCliente(c); setBloccato(null); setRicerca(''); setRisultati([])
    setNomeSuQuesta(null)
    const p = (c as unknown as Record<string, unknown>)
    if ('provenienza' in p) setProvenienza({ provenienza: normalizzaProvenienza(p.provenienza), struttura: (p.struttura_nome as string) ?? '' })
    void caricaStorico(c.id)
  }

  // ── camere ────────────────────────────────────────────────────────────────
  function aggiorna(id: string, dati: Partial<PeriodoComposto>) {
    setPeriodi(ps => ps.map(p => {
      if (p.id !== id) return p
      const dopo = { ...p, ...dati }
      // notti col letto sempre dentro il periodo, e letto acceso da solo
      // quando le persone superano la capienza della camera
      const dentro = giorniSoggiorno(dopo.checkIn, dopo.checkOut)
      dopo.nottiLetto = dopo.nottiLetto.filter(n => dentro.includes(n))
      const tocca = 'ospiti' in dati || 'checkIn' in dati || 'checkOut' in dati
      return tocca ? conLettoAutomatico(dopo, trovaCamera(dopo.roomId)) : dopo
    }))
  }
  // Scegliendo la camera si prendono le sue persone (Amelia una, le altre due)
  // e, se servono, il letto aggiuntivo col suo prezzo. Se Ania aveva già
  // scritto un numero suo diverso dal solito, quello resta.
  function scegliCamera(id: string, roomId: string) {
    const nuova = trovaCamera(roomId)
    setPeriodi(ps => ps.map(p => {
      if (p.id !== id) return p
      const prima = trovaCamera(p.roomId)
      const eraIlSolito = p.roomId === null || p.ospiti === ospitiIniziali(prima)
      const ospiti = eraIlSolito ? ospitiIniziali(nuova) : Math.min(p.ospiti, capienzaCamera(nuova))
      return conLettoAutomatico({ ...p, roomId, ospiti }, nuova)
    }))
  }
  function aggiungiCamera() {
    const ultimo = periodi[periodi.length - 1]
    setPeriodi(ps => [...ps, {
      id: nuovoId(), gruppo: nuovoId(), roomId: null,
      checkIn: ultimo?.checkIn ?? arrivoDaUrl, checkOut: ultimo?.checkOut ?? piuUnGiorno(arrivoDaUrl),
      ospiti: 2, nottiLetto: [], letto: null, tariffa: null,
    }])
  }
  function rimuovi(id: string) { setPeriodi(ps => (ps.length > 1 ? ps.filter(p => p.id !== id) : ps)) }
  // Togliere uno spostamento non accorcia il soggiorno: il periodo di prima
  // torna lungo com'era e si riprende le notti del letto.
  function togliCambio(id: string) {
    setPeriodi(ps => {
      const i = ps.findIndex(p => p.id === id)
      if (i <= 0) return ps
      const dopo = ps[i]
      const prima = ps[i - 1]
      if (prima.gruppo !== dopo.gruppo) return ps
      const ricucito = { ...prima, checkOut: dopo.checkOut, nottiLetto: [...new Set([...prima.nottiLetto, ...dopo.nottiLetto])].sort() }
      return ps.map(p => (p.id === prima.id ? ricucito : p)).filter(p => p.id !== dopo.id)
    })
  }
  function applicaCambio(p: PeriodoComposto) {
    const dentro = giorniSoggiorno(p.checkIn, p.checkOut)
    if (!cambio.roomId || !cambio.dal || !dentro.includes(cambio.dal) || cambio.dal === p.checkIn) return
    const tariffa = cambio.tariffa === '' ? null : Number(cambio.tariffa.replace(',', '.'))
    const [primo, secondo] = dividiPerCambio(p, cambio.dal, cambio.roomId, tariffa, nuovoId())
    setPeriodi(ps => ps.flatMap(x => (x.id === p.id ? [primo, secondo] : [x])))
    setCambioSu(null); setCambio({ roomId: '', dal: '', tariffa: '' })
  }

  // Disponibilità e letti già impegnati da ALTRE prenotazioni
  useEffect(() => {
    let vivo = true
    const validi = periodi.filter(p => p.roomId && nottiPeriodo(p) > 0)
    const dal = validi.map(p => p.checkIn).sort()[0]
    const al = validi.map(p => p.checkOut).sort().slice(-1)[0]
    const controlla = async () => {
      if (validi.length === 0) { if (vivo) { setConflitti([]); setLettiAltrui(new Map()) } return }
      const [{ data: occupate }, { data: conLetto }] = await Promise.all([
        supabase.from('bookings').select('id, room_id, check_in, check_out, guest_name, rooms(name), guests(full_name)')
          .neq('status', 'annullata').lt('check_in', al).gt('check_out', dal),
        supabase.from('bookings').select('id, room_id, num_guests, extra_bed, extra_bed_dates, check_in, check_out')
          .eq('extra_bed', true).neq('status', 'annullata').lt('check_in', al).gt('check_out', dal),
      ])
      if (!vivo) return
      const avvisi: string[] = []
      for (const p of validi) {
        for (const b of (occupate || []) as unknown as { room_id: string; check_in: string; check_out: string; guest_name?: string | null; rooms?: { name?: string } | null; guests?: { full_name?: string } | null }[]) {
          if (b.room_id !== p.roomId) continue
          if (b.check_in < p.checkOut && b.check_out > p.checkIn) {
            avvisi.push(`${trovaCamera(p.roomId)?.name ?? 'La camera'} è già occupata dal ${gg(b.check_in)} al ${gg(b.check_out)} (${b.guest_name || b.guests?.full_name || 'altro cliente'}).`)
          }
        }
      }
      const perNotte = new Map<string, number>()
      for (const b of (conLetto || []) as unknown as { room_id: string; num_guests: number; extra_bed: boolean; extra_bed_dates: string[] | null; check_in: string; check_out: string }[]) {
        const quanti = lettiPoolPrenotazione(b)
        for (const n of nottiLettoExtra(b)) perNotte.set(n, (perNotte.get(n) || 0) + quanti)
      }
      setConflitti([...new Set(avvisi)])
      setLettiAltrui(perNotte)
    }
    const t = setTimeout(() => { void controlla() }, 300)
    return () => { vivo = false; clearTimeout(t) }
  }, [periodi, trovaCamera])

  // ── sconto ────────────────────────────────────────────────────────────────
  function applicaPct() {
    const v = Number(pct.replace(',', '.'))
    if (!v || v <= 0 || v >= 100) { setErroreSconto('La percentuale deve stare fra 1 e 99.'); return }
    setErroreSconto(null); setSconto({ tipo: 'percentuale', valore: v }); setTarget('')
  }
  function applicaTarget() {
    const v = Number(target.replace(',', '.'))
    if (!v || pieno === null) return
    if (v >= pieno) { setErroreSconto(`Il totale concordato deve restare sotto il prezzo pieno (${euro(pieno)}).`); return }
    setErroreSconto(null); setSconto({ tipo: 'totale', valore: v }); setPct('')
  }

  // ── salvataggio ───────────────────────────────────────────────────────────
  async function salva() {
    const guai = problemi(periodi, trovaCamera, lettiAltrui)
    if (!scelto) guai.unshift('Manca il cliente.')
    if (nuovo && !nuovo.nome.trim()) guai.push('Del cliente nuovo serve il nome.')
    if (nuovo && !nuovo.telefono.trim()) guai.push('Del cliente nuovo serve il telefono.')
    if (nuovo && strutture.disponibile && !provenienza.provenienza) guai.push('Scegli come ci ha trovato.')
    if (provenienza.provenienza === 'altra_struttura' && !provenienza.struttura.trim()) guai.push('Scegli o scrivi quale struttura.')
    if ((accordo.modo === 'caparra_meta' || accordo.modo === 'caparra_libera') && Boolean(accordo.data) !== Boolean(accordo.ora)) guai.push('Della caparra servono data e ora, oppure nessuna delle due.')
    if (accordo.modo === 'caparra_libera' && !accordo.importo) guai.push('Scrivi l’importo della caparra.')
    if (accordo.modo === 'caparra_libera' && accordo.importo && totale !== null && accordo.importo > totale) guai.push('La caparra non può superare il totale.')
    if (conflitti.length > 0) guai.push(...conflitti)
    setErrori(guai)
    if (guai.length > 0) return

    setSalvando(true); setAvvisoSalvataggio(null)
    try {
      let guestId = cliente?.id ?? null
      let nomeSu = nomeSuQuesta

      if (!guestId && nuovo) {
        // Il numero è già di una scheda? si usa quella, senza crearne una seconda
        const { scheda } = await cercaSchedaPerTelefono<ClienteRiga>(nuovo.telefono)
        if (scheda) {
          guestId = scheda.id
          nomeSu = calcolaNomeSuPrenotazione(nuovo.nome, scheda.full_name)
          setCliente(scheda)
        } else {
          const cifre = nuovo.telefono.replace(/\D/g, '')
          const telefono = cifre ? (cifre.startsWith('39') ? cifre : `39${cifre}`) : null
          const base = {
            phone: telefono, full_name: conInizialiONull(nuovo.nome), email: null,
            ...(nuovo.nota.trim() ? { note: nuovo.nota.trim() } : {}),
            ...(strutture.disponibile ? campiProvenienza(provenienza.provenienza ?? 'non_so', provenienza.struttura) : {}),
          }
          let { data: creato, error } = await supabase.from('guests').insert({ ...base, ...payloadValutazione(nuovo.valutazione, nuovo.ricevuta, true) }).select().single()
          if (error && /vuole_ricevuta/i.test(error.message || '')) {
            ({ data: creato, error } = await supabase.from('guests').insert({ ...base, ...payloadValutazione(nuovo.valutazione, nuovo.ricevuta, false) }).select().single())
          }
          if (error && error.code === '23505') {
            const { scheda: esistente } = await cercaSchedaPerTelefono<ClienteRiga>(nuovo.telefono)
            if (esistente) { guestId = esistente.id; nomeSu = calcolaNomeSuPrenotazione(nuovo.nome, esistente.full_name); setCliente(esistente) }
          }
          if (!guestId) {
            if (error || !creato) { setErrori([`Il cliente non è stato creato: ${error?.message || 'errore sconosciuto'}`]); setSalvando(false); return }
            guestId = creato.id
            setCliente(creato as ClienteRiga)
          }
        }
      }
      if (!guestId) { setErrori(['Manca il cliente.']); setSalvando(false); return }

      // gruppi: periodi legati da un cambio camera → stesso group_id
      const gruppoId = new Map<string, string>()
      for (const p of periodi) if (!gruppoId.has(p.gruppo)) gruppoId.set(p.gruppo, p.gruppo === gruppoDaUrl && gruppoDaUrl ? gruppoDaUrl : crypto.randomUUID())

      // Lo sconto vale sull'intera prenotazione: in percentuale si applica a
      // ogni riga (le somme tornano); «porta il totale a» con più camere
      // diventa la percentuale che dà quel totale, così nessuna riga sballa.
      let campiSconto: Record<string, unknown> = {}
      if (sconto && pieno) {
        if (sconto.tipo === 'percentuale') campiSconto = { discount_type: 'percentage', discount_value: sconto.valore }
        else if (periodi.length === 1) campiSconto = { discount_type: 'target_total', discount_value: sconto.valore }
        else campiSconto = { discount_type: 'percentage', discount_value: Math.round((1 - sconto.valore / pieno) * 10000) / 100 }
      }

      const contattoUno = contatti[0]
      const comuni = {
        guest_id: guestId, status: 'confermata', source: 'diretta', pagato: false,
        bonifico: accordo.modo !== 'contanti',
        notes: note.trim() || null,
        ...(orario ? { check_in_time: orario } : {}),
        ...(navetta ? { shuttle: navetta } : {}),
        ...(nomeSu ? { guest_name: nomeSu } : {}),
        ...(chi === 'altra' && contattoUno?.nome ? { extra_phone_1_name: conInizialiONull(contattoUno.nome) } : {}),
        ...(chi === 'altra' && contattoUno?.telefono ? { extra_phone_1: contattoUno.telefono.replace(/\s/g, '') } : {}),
        ...(chi === 'altra' && contattoUno?.chiE ? { chi_e: contattoUno.chiE } : {}),
        ...(chi === 'altra' && contatti[1]?.nome ? { extra_phone_2_name: conInizialiONull(contatti[1].nome) } : {}),
        ...(chi === 'altra' && contatti[1]?.telefono ? { extra_phone_2: contatti[1].telefono.replace(/\s/g, '') } : {}),
        ...campiSconto,
      }
      const accordoCampi = {
        accordo_pagamento: accordo.modo,
        ...(caparra ? { caparra_centesimi: Math.round(caparra * 100) } : {}),
        ...(accordo.data && accordo.ora ? { caparra_entro: `${accordo.data}T${accordo.ora}:00` } : {}),
      }
      const righeDaSalvare = periodi.map(p => ({ ...rigaDaSalvare(p, trovaCamera(p.roomId)!, gruppoId.get(p.gruppo)!), ...comuni }))

      // La proposta 0041 può non essere ancora applicata: in quel caso si
      // salva lo stesso, senza i campi dell'accordo, e lo si dice.
      let senzaAccordo = false
      let { data: create, error } = await supabase.from('bookings').insert(righeDaSalvare.map(r => ({ ...r, ...accordoCampi }))).select('id, check_in')
      if (error && /accordo_pagamento|caparra_centesimi|caparra_entro/i.test(error.message || '')) {
        ({ data: create, error } = await supabase.from('bookings').insert(righeDaSalvare).select('id, check_in'))
        senzaAccordo = !error
      }
      if (error || !create || create.length === 0) {
        setErrori([`La prenotazione non è stata salvata: ${error?.message || 'errore sconosciuto'}`])
        setSalvando(false); return
      }

      if (strutture.disponibile && provenienza.provenienza) {
        const err = await salvaProvenienzaCliente(guestId, campiProvenienza(provenienza.provenienza, provenienza.struttura))
        if (err) setAvvisoProvenienza(`Prenotazione salvata, ma la provenienza non è stata aggiornata: ${err}`)
        if (provenienza.provenienza === 'altra_struttura') await ricordaStruttura(provenienza.struttura, strutture.lista)
      }
      const prima = [...create].sort((a, b) => String(a.check_in).localeCompare(String(b.check_in)))[0]
      // Se manca la proposta 0041 la caparra non è stata registrata: non si
      // porta via la pagina senza dirlo, altrimenti l'avviso non lo vede nessuno.
      if (senzaAccordo && caparra !== null) {
        setSalvata(String(prima.id))
        setAvvisoSalvataggio(`Prenotazione salvata, ma la caparra di ${euro(caparra)} e la sua scadenza NON sono state registrate: serve la proposta 0041 (accordo di pagamento) applicata su Supabase. Il resto (camere, prezzi, bonifico) c'è tutto.`)
        setSalvando(false)
        return
      }
      router.push(`/prenotazioni/${prima.id}`)
    } catch (err) {
      setErrori([messaggioErroreDati(err, 'salvare la prenotazione')])
      setSalvando(false)
    }
  }

  // ── pezzi ripetuti ────────────────────────────────────────────────────────
  const testoNavetta = navetta === '' ? 'Navetta da definire' : navetta === 'si' ? 'Navetta sì' : 'Navetta no'

  return (
    <div className={s.pagina}>
      <BackBar onClick={() => smartBack(router, returnTo)} />
      {/* Stessa testata della Home e di Pulizie (Ania, 09/09/2026): prima il
          titolo grande, sotto la data in maiuscoletto ottone. */}
      <h1 className={s.titolo}>Nuova prenotazione</h1>
      <p className={s.sotto} style={{ marginTop: 8 }}>{new Date().toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>

      <CampoRicerca value={ricerca} onChange={scriviRicerca} className="mt-3" />

      {!scelto && (
        <>
          {erroreRicerca && <p className={s.avviso}>{erroreRicerca}</p>}
          {cercando && <p className={s.sotto} style={{ marginTop: 12 }}>Cerco…</p>}
          {!cercando && ricerca.trim().length >= 2 && (
            <p className={s.sotto} style={{ marginTop: 12 }}>
              {risultati.length === 0 ? 'Nessun cliente con questo nome' : `${risultati.length} client${risultati.length === 1 ? 'e trovato' : 'i trovati'}`}
            </p>
          )}
          {risultati.map(c => {
            const no = valutazioneDi(c) === 'problematico'
            return (
              <button key={c.id} type="button" className={`${s.risultato} ${no ? s.spento : ''}`} onClick={() => scegliCliente(c)}>
                <span>
                  <span className={s.risultatoNome}>{c.full_name || 'senza nome'}</span>
                  <span className={s.risultatoTel}>{c.phone || 'senza telefono'}</span>
                </span>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  {valutazioneDi(c) === 'ottimo' && <span className={`${s.badge} ${s.badgeOttone}`}>★ Ottimo</span>}
                  {vuoleRicevuta(c) && <span className={s.badge}>Ricevuta</span>}
                  {no && <span className={`${s.badge} ${s.badgeNo}`}>Problematico</span>}
                </span>
              </button>
            )
          })}
          {bloccato && (
            <p className={s.avviso}>
              <b>{bloccato.full_name} è segnato come problematico.</b><br />
              {bloccato.note || 'Nelle note interne c’è il motivo.'}<br />Non si può usare per una nuova prenotazione.
            </p>
          )}
          <div className={s.azioni}>
            <button type="button" className={s.azione} onClick={() => {
              const testo = ricerca.trim()
              const cifre = /\d/.test(testo)
              setNuovo({ nome: cifre ? '' : testo, telefono: cifre ? testo : '', valutazione: 'normale', ricevuta: false, nota: '' })
              setRicerca(''); setRisultati([])
            }}>Inserisci nuovo cliente</button>
          </div>
        </>
      )}

      {cliente && (
        <>
          <div className={s.riga} style={{ alignItems: 'flex-start', paddingTop: 12, borderTop: 'none' }}>
            <span>
              <span className={s.titoloMedio} style={{ display: 'block' }}>{cliente.full_name || 'senza nome'}</span>
              <span className={s.risultatoTel}>{cliente.phone || 'senza telefono'}{provenienza.provenienza ? ` · ${ETICHETTA_PROVENIENZA[provenienza.provenienza]}${provenienza.struttura ? ` (${provenienza.struttura})` : ''}` : ''}</span>
            </span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              {valutazioneDi(cliente) === 'ottimo' && <span className={`${s.badge} ${s.badgeOttone}`}>★ Ottimo</span>}
              {vuoleRicevuta(cliente) && <span className={s.badge}>Ricevuta</span>}
            </span>
          </div>
          {cliente.note && <p className={s.nota} style={{ margin: '6px 0 0' }}>{cliente.note}</p>}

          <p className={s.sezione} style={{ marginTop: 16 }}>Soggiorni precedenti</p>
          {erroreStorico && <p className={s.avviso}>{erroreStorico}</p>}
          {!erroreStorico && storico.length === 0 && <p className={s.nota} style={{ marginTop: 10 }}>Nessun soggiorno concluso.</p>}
          {storico.slice(0, 3).map(sg => (
            <button key={sg.chiave} type="button" className={s.storico} onClick={() => setStoricoAperto(true)}>
              <span className={s.storicoData}>{periodoBreve(sg.dal, sg.al)}</span>
              <span className={s.storicoDato}>{sg.camere}</span>
              <span className={s.storicoDato}>{sg.ospiti} osp</span>
              <span className={s.storicoDato}>{sg.notti} × {Math.round(sg.totale / Math.max(1, sg.notti))}</span>
              {sg.pieno > sg.totale + 0.005 && <span className={s.storicoPieno}>{Math.round(sg.pieno)}</span>}
              <span className={`${s.storicoTotale} ${sg.pieno > sg.totale + 0.005 ? s.verde : ''}`}>{Math.round(sg.totale)} €</span>
              <span className={s.freccia}>›</span>
            </button>
          ))}
          {storico.length > 0 && (
            <button type="button" className={s.storicoTot} onClick={() => setStoricoAperto(true)}>
              <span className={s.eti}>{storico.length} soggiorni conclusi <span style={{ color: 'var(--color-brass)' }}>· aprili tutti</span></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={s.numero}>{Math.round(storico.reduce((t, x) => t + x.totale, 0)).toLocaleString('it-IT')} €</span>
                <span className={s.freccia}>›</span>
              </span>
            </button>
          )}
          <div className={s.azioni}>
            <button type="button" className={s.azione} onClick={() => setModifica({
              nome: cliente.full_name || '', telefono: cliente.phone || '',
              valutazione: valutazioneDi(cliente), ricevuta: vuoleRicevuta(cliente), nota: cliente.note || '',
            })}>Modifica dati</button>
            <button type="button" className={s.azione} onClick={() => { setCliente(null); setStorico([]); setProvenienza({ provenienza: null, struttura: '' }) }}>Cambia cliente</button>
          </div>
        </>
      )}

      {nuovo && (
        <>
          <p className={s.sezione}>Nuovo cliente</p>
          <label className={s.campoBlocco} style={{ borderTop: '1px solid rgba(169,136,78,.55)' }}>
            <span className={s.campoEti}>Nome e cognome</span>
            <input className={s.campo} value={nuovo.nome} autoCapitalize="words"
              onChange={e => setNuovo({ ...nuovo, nome: maiuscoleNelCampo(e.target) })} />
          </label>
          <label className={s.campoBlocco}>
            <span className={s.campoEti}>Telefono</span>
            <input className={s.campo} inputMode="tel" value={nuovo.telefono} onChange={e => setNuovo({ ...nuovo, telefono: e.target.value })} />
          </label>
          <div className={s.riga} style={{ display: 'block' }}>
            <span className={s.campoEti}>Valutazione</span>
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
            <span className={s.campoEti}>Nota del cliente · resta anche le prossime volte</span>
            <textarea className={s.campo} rows={2} value={nuovo.nota} onChange={e => setNuovo({ ...nuovo, nota: e.target.value })}
              placeholder="quello che va ricordato ogni volta" />
          </div>
          <div className={s.azioni}>
            <button type="button" className={s.azione} onClick={() => setNuovo(null)}>Annulla il cliente nuovo</button>
          </div>
        </>
      )}

      {/* Come ci ha trovato: obbligatoria solo per un cliente nuovo */}
      {scelto && strutture.disponibile && (
        <div className={s.riga} style={{ display: 'block', borderTop: 'none' }}>
          <span className={s.campoEti}>Come ci ha trovato{nuovo ? ' · da scegliere' : ''}</span>
          <div className={s.pillole} style={{ marginTop: 8 }}>
            {PROVENIENZE.map(p => (
              <button key={p.chiave} type="button" className={provenienza.provenienza === p.chiave ? s.pil : s.pilT}
                onClick={() => { setProvenienza({ provenienza: p.chiave, struttura: p.chiave === 'altra_struttura' ? provenienza.struttura : '' }); setAltraStruttura(false) }}>
                {p.label}
              </button>
            ))}
          </div>
          {provenienza.provenienza === 'altra_struttura' && (
            <>
              <div className={s.pillole} style={{ marginTop: 8 }}>
                {strutture.lista.map(x => (
                  <button key={x.nome} type="button" className={provenienza.struttura === x.nome ? s.pil : s.pilT}
                    onClick={() => { setProvenienza({ ...provenienza, struttura: x.nome }); setAltraStruttura(false) }}>{x.nome}</button>
                ))}
                <button type="button" className={altraStruttura ? s.pilC : s.pilT}
                  onClick={() => { setAltraStruttura(true); setProvenienza({ ...provenienza, struttura: '' }) }}>Un&apos;altra…</button>
              </div>
              {altraStruttura && (
                <>
                  <input className={s.campo} style={{ marginTop: 10 }} autoCapitalize="words" placeholder="Nome della struttura"
                    value={provenienza.struttura} onChange={e => setProvenienza({ ...provenienza, struttura: e.target.value })} />
                  <p className={s.nota}>Nome nuovo: si aggiunge all&apos;elenco al salvataggio.</p>
                </>
              )}
            </>
          )}
        </div>
      )}
      {avvisoProvenienza && <p className={s.nota} style={{ marginTop: 6 }}>{avvisoProvenienza}</p>}

      {/* Niente pagina sbiadita finché manca il cliente (Ania, 09/09/2026:
          «non si legge nulla»): le camere e le date si compilano lo stesso,
          per esempio arrivando dal calendario. È il salvataggio a fermarsi. */}
      <div>
        <p className={s.sezione}>Camere e periodi</p>
        {periodi.map((p, indice) => {
          const seguito = indice > 0 && periodi[indice - 1].gruppo === p.gruppo
          const camera = trovaCamera(p.roomId)
          const conto = contoPeriodo(p, camera)
          const n = nottiPeriodo(p)
          const giorni = giorniSoggiorno(p.checkIn, p.checkOut)
          const proposta = camera ? tariffaProposta(p, camera) : null
          return (
            <div key={p.id} className={seguito ? s.seguito : s.blocco}>
              {seguito && <p className={s.sotto}>Poi si sposta</p>}
              <div className={s.bloccoTop}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <select className={s.campo} style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 400 }}
                    value={p.roomId ?? ''} onChange={e => scegliCamera(p.id, e.target.value)}>
                    <option value="">Scegli camera</option>
                    {camere.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className={s.date}>{n > 0 ? `${gg(p.checkIn)} → ${gg(p.checkOut)} · ${n} ${n === 1 ? 'notte' : 'notti'}` : 'date da sistemare'}</p>
                </div>
                <span className={s.numero}>{conto ? euro(conto.totale) : '—'}</span>
              </div>

              <div className={s.due} style={{ marginTop: 8 }}>
                <label className={s.campoBlocco}><span className={s.campoEti}>Arrivo</span>
                  <input type="date" className={s.campo} value={p.checkIn} onChange={e => aggiorna(p.id, { checkIn: e.target.value })} /></label>
                <label className={s.campoBlocco}><span className={s.campoEti}>Partenza</span>
                  <input type="date" className={s.campo} value={p.checkOut} onChange={e => aggiorna(p.id, { checkOut: e.target.value })} /></label>
              </div>
              <div className={s.due}>
                <label className={s.campoBlocco}><span className={s.campoEti}>Ospiti</span>
                  <input type="number" inputMode="numeric" min={1} max={camera ? capienzaCamera(camera) : 5} className={s.campo}
                    value={p.ospiti} onChange={e => aggiorna(p.id, { ospiti: Number(e.target.value) })} /></label>
                <label className={s.campoBlocco}><span className={s.campoEti}>Tariffa a notte</span>
                  <input type="number" inputMode="decimal" className={s.campo} value={p.tariffa ?? (proposta ?? '')}
                    onChange={e => aggiorna(p.id, { tariffa: e.target.value === '' ? null : Number(e.target.value) })} /></label>
              </div>

              <div className={s.riga} style={{ alignItems: 'flex-start' }}>
                <button type="button" className={`${s.quadro} ${p.nottiLetto.length > 0 ? s.quadroOn : ''}`} aria-label="Letto aggiuntivo"
                  onClick={() => aggiorna(p.id, p.nottiLetto.length > 0
                    ? { nottiLetto: [], letto: null }
                    : { nottiLetto: giorni, letto: p.letto ?? { importo: lettoDaRegole(camera, p.ospiti), criterio: 'notte' } })} />
                <div style={{ flex: 1, marginLeft: -2 }}>
                  <b style={{ fontSize: 14 }}>Letto aggiuntivo</b>
                  <p className={s.nota} style={{ margin: '1px 0 0' }}>
                    {p.nottiLetto.length === 0
                      ? 'Il prezzo lo propongono le regole della camera; puoi cambiarlo.'
                      : conto && conto.lettoTotale > 0
                        ? 'Si paga nelle notti scelte.'
                        : 'Qui le regole non lo addebitano: scrivi un importo se vuoi farlo pagare.'}
                  </p>
                  {p.nottiLetto.length > 0 && (
                    <>
                    <div className={s.notti}>
                      <button type="button" className={`${s.notte} ${p.nottiLetto.length === giorni.length ? s.notteOn : ''}`}
                        onClick={() => aggiorna(p.id, { nottiLetto: giorni })}>tutte le notti</button>
                      {giorni.map(g => (
                        <button key={g} type="button" className={`${s.notte} ${p.nottiLetto.includes(g) ? s.notteOn : ''}`}
                          onClick={() => aggiorna(p.id, { nottiLetto: p.nottiLetto.includes(g) ? p.nottiLetto.filter(x => x !== g) : [...p.nottiLetto, g].sort() })}>
                          {Number(g.slice(8))}
                        </button>
                      ))}
                    </div>
                    <label className={s.campoBlocco} style={{ maxWidth: 130 }}>
                      <span className={s.campoEti}>Quanto costa</span>
                      <input type="number" inputMode="decimal" className={s.campo} placeholder="€"
                        value={p.letto?.importo ?? ''}
                        onChange={e => aggiorna(p.id, { letto: { importo: e.target.value === '' ? 0 : Number(e.target.value), criterio: p.letto?.criterio ?? 'notte' } })} />
                    </label>
                    <div className={s.pillole} style={{ marginTop: 4 }}>
                      {([['notte', 'A notte'], ['ogni4', 'Ogni 4 notti'], ['totale', 'Totale concordato']] as const).map(([k, t]) => (
                        <button key={k} type="button" className={(p.letto?.criterio ?? 'notte') === k ? s.pil : s.pilT}
                          onClick={() => aggiorna(p.id, { letto: { importo: p.letto?.importo ?? lettoDaRegole(camera, p.ospiti), criterio: k } })}>{t}</button>
                      ))}
                    </div>
                    </>
                  )}
                </div>
                {conto && conto.lettoTotale > 0 && <span className={s.numeroPiccolo}>{euro(conto.lettoTotale)}</span>}
              </div>

              {cambioSu === p.id ? (
                <div className={s.seguito}>
                  <p className={s.sotto}>Cambio camera</p>
                  <label className={s.campoBlocco} style={{ borderTop: 'none' }}><span className={s.campoEti}>Va in</span>
                    <select className={s.campo} value={cambio.roomId} onChange={e => setCambio({ ...cambio, roomId: e.target.value, tariffa: '' })}>
                      <option value="">Scegli camera</option>
                      {camere.filter(c => c.id !== p.roomId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></label>
                  <div className={s.due}>
                    <label className={s.campoBlocco}><span className={s.campoEti}>Dal</span>
                      <input type="date" className={s.campo} min={piuUnGiorno(p.checkIn)} max={p.checkOut} value={cambio.dal} onChange={e => setCambio({ ...cambio, dal: e.target.value })} /></label>
                    <label className={s.campoBlocco}><span className={s.campoEti}>Tariffa</span>
                      <input type="number" inputMode="decimal" className={s.campo} placeholder="di listino" value={cambio.tariffa} onChange={e => setCambio({ ...cambio, tariffa: e.target.value })} /></label>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                    <button type="button" className={s.pil} disabled={!cambio.roomId || !cambio.dal} onClick={() => applicaCambio(p)}>Aggiungi cambio</button>
                    <button type="button" className={s.pilT} onClick={() => { setCambioSu(null); setCambio({ roomId: '', dal: '', tariffa: '' }) }}>Annulla</button>
                  </div>
                </div>
              ) : (
                <div className={s.azioni} style={{ borderTop: '1px solid var(--color-card-border)', marginTop: 8 }}>
                  <button type="button" className={s.azione} onClick={() => { setCambioSu(p.id); setCambio({ roomId: '', dal: '', tariffa: '' }) }}>Aggiungi cambio camera</button>
                  {seguito
                    ? <button type="button" className={s.azione} onClick={() => togliCambio(p.id)}>Togli il cambio</button>
                    : periodi.length > 1 && <button type="button" className={s.azione} onClick={() => rimuovi(p.id)}>Rimuovi</button>}
                </div>
              )}
            </div>
          )
        })}

        <div style={{ paddingTop: 14, borderTop: '1px solid var(--color-card-border)', marginTop: 14 }}>
          <button type="button" className={s.pilC} style={{ width: '100%', minHeight: 42 }} onClick={aggiungiCamera}>Aggiungi camera</button>
        </div>
        {conflitti.map((c, i) => <p key={i} className={s.avviso}>{c}</p>)}

        <p className={s.sezione}>Sconto a lei riservato</p>
        <p className={s.sezioneNota}>Uno solo per prenotazione. La tariffa a notte non si tocca.</p>
        <div className={s.riga} style={{ borderTop: '1px solid rgba(169,136,78,.55)', gap: 8 }}>
          <input type="number" inputMode="decimal" className={s.campo} style={{ maxWidth: 90, textAlign: 'center' }} placeholder="%" value={pct} onChange={e => setPct(e.target.value)} />
          <button type="button" className={s.pil} disabled={!pct} onClick={applicaPct}>Applica %</button>
        </div>
        <div className={s.riga} style={{ gap: 8 }}>
          <input type="number" inputMode="decimal" className={s.campo} placeholder="Porta il totale a €" value={target} onChange={e => setTarget(e.target.value)} />
          <button type="button" className={s.pilC} disabled={!target} onClick={applicaTarget}>Applica</button>
        </div>
        {erroreSconto && <p className={s.avviso}>{erroreSconto}</p>}
        {sconto && pieno !== null && (
          <>
            <div className={s.riga}>
              <span className={s.eti}>{euro(pieno)} − {euro(valoreSconto)}</span>
              <span className={`${s.numero} ${s.verde}`}>{euro(totale ?? 0)}</span>
            </div>
            {sconto.tipo === 'totale' && periodi.length > 1 && <p className={s.nota}>Con più camere lo sconto si divide fra loro in proporzione.</p>}
            <div className={s.azioni}><button type="button" className={s.azione} onClick={() => { setSconto(null); setPct(''); setTarget('') }}>Togli lo sconto</button></div>
          </>
        )}

        <p className={s.sezione}>Totale</p>
        <div className={s.distinta}>
          {righe.length === 0 && <p className={s.nota}>Manca la camera o la tariffa: il conto è da completare.</p>}
          {righe.map((r, i) => (
            <div key={i} className={s.dRiga}><span>{r.etichetta}</span><span className={s.punti} /><span className={s.dImporto}>{r.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span></div>
          ))}
          {sconto && (
            <div className={s.dRiga} style={{ borderTop: '1px solid var(--color-card-border)', marginTop: 4, paddingTop: 6 }}>
              <span className={s.verde}>Sconto a lei riservato</span><span className={s.punti} /><span className={`${s.dImporto} ${s.verde}`}>− {valoreSconto.toLocaleString('it-IT', { minimumFractionDigits: 2 })}</span>
            </div>
          )}
          <div className={s.dTot}>
            <div>
              <p className={s.dNota}>Totale prenotazione</p>
              <p className={s.numeroGrande} style={{ marginTop: 3, color: totale === null ? 'var(--color-stone)' : undefined }}>{totale === null ? 'da completare' : euro(totale)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p className={s.eti} style={{ fontSize: 12 }}>{ETICHETTA_ACCORDO[accordo.modo]}</p>
              {caparra !== null && <p className={s.eti} style={{ fontSize: 11 }}>caparra {euro(caparra)}</p>}
            </div>
          </div>
        </div>

        <p className={s.sezione}>Già a posto <small style={{ letterSpacing: 0, textTransform: 'none', fontSize: 12, color: 'var(--color-stone)' }}>— tocca solo se cambia</small></p>

        <button type="button" className={`${s.gia} ${s.rigaOttone}`} onClick={() => setAperta(aperta === 'arrivo' ? null : 'arrivo')}>
          <span className={s.giaEti}>Arrivo</span>
          <span className={`${s.giaValore} ${orario ? '' : s.giaVuota}`}>{orario ? `Verso le ${orario}` : 'Orario da definire'}<small className={s.giaSotto}>{testoNavetta}</small></span>
          <span className={s.freccia}>{aperta === 'arrivo' ? '⌄' : '›'}</span>
        </button>
        {aperta === 'arrivo' && (
          <div>
            <label className={s.campoBlocco}><span className={s.campoEti}>Orario previsto</span>
              <input type="time" className={s.campo} style={{ maxWidth: 130 }} value={orario} onChange={e => setOrario(e.target.value)} /></label>
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.campoEti}>Navetta</span>
              <div className={s.pillole} style={{ marginTop: 8 }}>
                {([['', 'Da definire'], ['si', 'Sì'], ['no', 'No']] as const).map(([k, t]) => (
                  <button key={t} type="button" className={navetta === k ? s.pil : s.pilT} onClick={() => setNavetta(k)}>{t}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        <button type="button" className={s.gia} onClick={() => setAperta(aperta === 'pagamento' ? null : 'pagamento')}>
          <span className={s.giaEti}>Pagamento</span>
          <span className={s.giaValore}>{ETICHETTA_ACCORDO[accordo.modo]}
            <small className={s.giaSotto}>{caparra !== null
              ? `Caparra ${euro(caparra)}${accordo.data && accordo.ora ? ` entro il ${gg(accordo.data)} alle ${accordo.ora}` : ' · scadenza da impostare'}`
              : 'Nessuna caparra da chiedere'}</small></span>
          <span className={s.freccia}>{aperta === 'pagamento' ? '⌄' : '›'}</span>
        </button>
        {aperta === 'pagamento' && (
          <div>
            {(Object.keys(ETICHETTA_ACCORDO) as Accordo['modo'][]).map(k => (
              <button key={k} type="button" className={s.scelta} onClick={() => setAccordo({ ...accordo, modo: k, importo: k === 'caparra_libera' ? accordo.importo : null })}>
                <span className={`${s.tondo} ${accordo.modo === k ? s.tondoOn : ''}`} />
                <span style={{ flex: 1 }}>
                  <span className={s.sceltaTitolo}>{ETICHETTA_ACCORDO[k]}</span>
                  {k === 'caparra_meta' && accordo.modo === k && totale !== null && <span className={s.sceltaNota}>{euro(totale / 2)} sul totale, letti e sconto compresi</span>}
                </span>
              </button>
            ))}
            {(accordo.modo === 'caparra_meta' || accordo.modo === 'caparra_libera') && (
              <>
                {accordo.modo === 'caparra_libera' && (
                  <label className={s.campoBlocco}><span className={s.campoEti}>Importo caparra</span>
                    <input type="number" inputMode="decimal" className={s.campo} placeholder="€" value={accordo.importo ?? ''}
                      onChange={e => setAccordo({ ...accordo, importo: e.target.value === '' ? null : Number(e.target.value) })} /></label>
                )}
                <div className={s.due}>
                  <label className={s.campoBlocco}><span className={s.campoEti}>Entro il</span>
                    <input type="date" className={s.campo} value={accordo.data} onChange={e => setAccordo({ ...accordo, data: e.target.value })} /></label>
                  <label className={s.campoBlocco}><span className={s.campoEti}>Ora</span>
                    <input type="time" className={s.campo} value={accordo.ora} onChange={e => setAccordo({ ...accordo, ora: e.target.value })} /></label>
                </div>
              </>
            )}
          </div>
        )}

        <button type="button" className={s.gia} onClick={() => setAperta(aperta === 'chi' ? null : 'chi')}>
          <span className={s.giaEti}>Chi arriva</span>
          <span className={s.giaValore}>
            {chi === 'prenota' ? (nomeCliente || 'Chi prenota') : (contatti.map(c => c.nome.trim()).filter(Boolean).join(' e ') || 'da compilare')}
            <small className={s.giaSotto}>{chi === 'prenota' ? `Soggiorna chi prenota · ${telefonoCliente || 'senza telefono'}` : 'Soggiorna un’altra persona'}</small>
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
                    <label className={s.campoBlocco}><span className={s.campoEti}>Nome e cognome</span>
                      <input className={s.campo} value={c.nome} autoCapitalize="words"
                        onChange={e => { const v = maiuscoleNelCampo(e.target); setContatti(cs => cs.map((x, j) => (j === i ? { ...x, nome: v } : x))) }} /></label>
                    <div className={s.due}>
                      <label className={s.campoBlocco}><span className={s.campoEti}>Chi è</span>
                        <input className={s.campo} value={c.chiE} placeholder="mamma, collega…" onChange={e => setContatti(cs => cs.map((x, j) => (j === i ? { ...x, chiE: e.target.value } : x)))} /></label>
                      <label className={s.campoBlocco}><span className={s.campoEti}>Telefono</span>
                        <input className={s.campo} inputMode="tel" value={c.telefono} onChange={e => setContatti(cs => cs.map((x, j) => (j === i ? { ...x, telefono: e.target.value } : x)))} /></label>
                    </div>
                  </div>
                ))}
                <div className={s.azioni}>
                  {contatti.length < 2
                    ? <button type="button" className={s.azione} onClick={() => setContatti(cs => [...cs, { nome: '', chiE: '', telefono: '' }])}>Aggiungi secondo contatto</button>
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
            <textarea className={s.campo} rows={3} value={note} onChange={e => setNote(e.target.value)}
              placeholder="Solo per questo soggiorno: non finisce nei messaggi né nella scheda del cliente." />
          </div>
        )}

        {errori.length > 0 && (
          <div className={s.avviso}>
            <b>Prima di salvare:</b>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>{errori.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </div>
        )}
        {avvisoSalvataggio && (
          <div className={s.avviso}>
            {avvisoSalvataggio}
            {salvata && (
              <div style={{ marginTop: 8 }}>
                <button type="button" className={s.pil} onClick={() => router.push(`/prenotazioni/${salvata}`)}>Apri la prenotazione</button>
              </div>
            )}
          </div>
        )}

        <div className={s.barra}>
          <div>
            <p className={s.eti} style={{ fontSize: 11 }}>Totale</p>
            <p className={s.numeroPiccolo} style={{ color: totale === null ? 'var(--color-stone)' : undefined }}>{totale === null ? '—' : euro(totale)}</p>
          </div>
          <button type="button" className={scelto ? s.pil : s.pilC} disabled={salvando} onClick={salva}>
            {salvando ? 'Salvo…' : scelto ? 'Salva prenotazione' : 'Scegli prima il cliente'}
          </button>
        </div>
      </div>

      {storicoAperto && cliente && (
        <div className={s.velo} onClick={() => setStoricoAperto(false)}>
          <div className={s.foglio} onClick={e => e.stopPropagation()}>
            <p className={s.sotto}>Soggiorni di {cliente.full_name}</p>
            <h2 className={s.titolo} style={{ fontSize: 24 }}>Storico</h2>
            {storico.map(sg => (
              <div key={sg.chiave} className={s.riga} style={{ display: 'block' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                  <span className={s.titoloMedio} style={{ fontSize: 17 }}>{sg.camere}</span>
                  <span className={`${s.numero} ${sg.pieno > sg.totale + 0.005 ? s.verde : ''}`} style={{ fontSize: 18 }}>{euro(sg.totale)}</span>
                </div>
                <p className={s.nota}>{ggAnno(sg.dal)} → {ggAnno(sg.al)} · {sg.notti} notti · {sg.ospiti} ospiti{sg.pieno > sg.totale + 0.005 ? ` · prezzo pieno ${euro(sg.pieno)}` : ''}</p>
              </div>
            ))}
            <button type="button" className={s.pilC} style={{ width: '100%', minHeight: 44, marginTop: 14 }} onClick={() => setStoricoAperto(false)}>Chiudi</button>
          </div>
        </div>
      )}

      {modifica && cliente && (
        <div className={s.velo} onClick={() => setModifica(null)}>
          <div className={s.foglio} onClick={e => e.stopPropagation()}>
            <p className={s.sotto}>Stessa persona, dati corretti</p>
            <h2 className={s.titolo} style={{ fontSize: 24 }}>Modifica dati</h2>
            <label className={s.campoBlocco} style={{ borderTop: '1px solid rgba(169,136,78,.55)' }}>
              <span className={s.campoEti}>Nome e cognome</span>
              <input className={s.campo} value={modifica.nome} autoCapitalize="words" onChange={e => setModifica({ ...modifica, nome: maiuscoleNelCampo(e.target) })} /></label>
            <label className={s.campoBlocco}><span className={s.campoEti}>Telefono</span>
              <input className={s.campo} inputMode="tel" value={modifica.telefono} onChange={e => setModifica({ ...modifica, telefono: e.target.value })} /></label>
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.campoEti}>Valutazione</span>
              <div className={s.pillole} style={{ marginTop: 8 }}>
                {(['ottimo', 'normale', 'problematico'] as Valutazione[]).map(v => (
                  <button key={v} type="button" className={modifica.valutazione === v ? s.pil : s.pilT} onClick={() => setModifica({ ...modifica, valutazione: v })}>
                    {v === 'ottimo' ? '★ Ottimo' : v === 'normale' ? 'Normale' : 'Problematico'}
                  </button>
                ))}
                <button type="button" className={modifica.ricevuta ? s.pilC : s.pilT} onClick={() => setModifica({ ...modifica, ricevuta: !modifica.ricevuta })}>Richiede ricevuta</button>
              </div>
            </div>
            <div className={s.riga} style={{ display: 'block' }}>
              <span className={s.campoEti}>{modifica.valutazione === 'problematico' ? 'Note interne · cosa è successo' : 'Nota del cliente'}</span>
              <textarea className={s.campo} rows={2} value={modifica.nota} onChange={e => setModifica({ ...modifica, nota: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
              <button type="button" className={s.pilT} style={{ minHeight: 44 }} onClick={() => setModifica(null)}>Annulla</button>
              <button type="button" className={s.pil} style={{ flex: 1, minHeight: 44 }} onClick={async () => {
                const cifre = modifica.telefono.replace(/\D/g, '')
                const { error } = await supabase.from('guests').update({
                  full_name: conInizialiONull(modifica.nome),
                  phone: cifre ? (cifre.startsWith('39') ? cifre : `39${cifre}`) : null,
                  note: modifica.nota.trim() || null,
                  ...payloadValutazione(modifica.valutazione, modifica.ricevuta, colonnaRicevutaPresente(cliente as unknown as { vuole_ricevuta?: boolean })),
                }).eq('id', cliente.id)
                if (error) { setErrori([`I dati del cliente non sono stati salvati: ${error.message}`]); return }
                setCliente({ ...cliente, full_name: conInizialiONull(modifica.nome), phone: modifica.telefono, note: modifica.nota.trim() || null, rating: modifica.valutazione })
                setModifica(null)
              }}>Salva modifica</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
