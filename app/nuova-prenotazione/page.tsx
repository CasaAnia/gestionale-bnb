'use client'
// ============================================================================
// NUOVA PRENOTAZIONE — /nuova-prenotazione (14/09/2026).
// La pagina di inserimento nella veste nuova, a un indirizzo a parte: /nuova
// resta com'è finché questa non è completa.
//
// Si parte dalla ricerca del cliente (punto 1), poi il cliente nuovo (2), il
// soggiorno con la striscia delle notti (3), arrivo/come paga/con lei/note (4)
// e il conto sempre in vista (5).
//
// Nessuna regola riscritta: le camere libere e la capienza vengono da
// lib/disponibilita e lib/tariffe, i prezzi da lib/prezzoNotti, i periodi e il
// conto da lib/prenotazioneComposta, le notti da lib/strisciaNotti (la stessa
// striscia della scheda), «come paga» da lib/comePaga. Qui sta solo la pagina.
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import BackBar from '@/components/BackBar'
import CampoRicerca from '@/components/CampoRicerca'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { oggiARoma } from '@/lib/spese/adattatore'
import { spostaGiorni } from '@/lib/statistiche/periodo'
import { dataDiOggi, rigaClienteTrovato } from '@/lib/nuovaPrenotazione'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { filtraClienti } from '@/lib/cambiaCliente'
import { messaggioLetturaNonRiuscita } from '@/lib/prenotazioneScritture'
import NuovoCliente, { NUOVO_CLIENTE_VUOTO, type DatiNuovoCliente } from '@/components/nuova/NuovoCliente'
import { leggiStrutture } from '@/lib/provenienzaDati'
import { creaClienteNuovo } from '@/lib/cambiaClienteDati'
import { nomeCompleto } from '@/lib/guestName'
import { numeroUsabile } from '@/lib/whatsapp'
import AvvisoAzione from '@/components/AvvisoAzione'
import type { StrutturaNota } from '@/lib/provenienza'
import CameraSoggiorno from '@/components/nuova/CameraSoggiorno'
import FoglioNotte from '@/components/FoglioNotte'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, TastinoTenue, stileCampo, OTTONE as OTTONE_PEZZI } from '@/components/nuova/PezziNuova'
import {
  camereDelPeriodo, rigaCamereLibere, datiLinea, nottiDellaLinea, raggruppaPerCamera, periodiDaNotti,
  ospitiPossibiliNotte, contoNuovaPrenotazione, scontoInParole, listinoLetto, CRITERI_LETTO, LETTO_COMPRESO_LISTINO,
  type ScontoNuova,
} from '@/lib/nuovaPrenotazione'
import { nottiDaPeriodi, type CameraStriscia, type ContestoNotti, type NotteStriscia } from '@/lib/strisciaNotti'
import { conLettoAutomatico, tariffaProposta, ospitiIniziali, lettoProposto, type PeriodoComposto, type CameraComposta } from '@/lib/prenotazioneComposta'
import { capienzaCamera } from '@/lib/tariffe'
import type { PrenotazioneMinima } from '@/lib/disponibilita'
import type { PrenotazioneLetti } from '@/lib/lettiAggiuntivi'
import ComePaga from '@/components/ComePaga'
import ConLei from '@/components/nuova/ConLei'
import { oraDigitata } from '@/lib/ora'
import { PERSONE_CON_LEI_MAX, TROPPE_PERSONE, type PersonaConLei } from '@/lib/nuovaPrenotazione'
import { campiComePaga, chiedeScadenza as chiedeScadenzaComePaga, type ComePaga as ComePagaModo } from '@/lib/comePaga'
import ContoNuova from '@/components/nuova/ContoNuova'
import { campiConLei, campiSconto, totaliScontati } from '@/lib/nuovaPrenotazione'
import { rigaDaSalvare, problemi } from '@/lib/prenotazioneComposta'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { lettiOccupatiPerNotte } from '@/lib/lettiAggiuntivi'
import { oraCompleta } from '@/lib/ora'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
export const TITOLO_PAGINA = 'Nuova prenotazione'
export const NUOVO_CLIENTE = '+ Nuovo cliente'

export type ClienteRiga = {
  id: string
  full_name?: string | null
  phone?: string | null
  rating?: string | null
  vuole_ricevuta?: boolean | null
  notes?: string | null
  provenienza?: string | null
  struttura_nome?: string | null
}

// Il tastino verde chiaro, alto 30: «+ Nuovo cliente» e i fratelli
export function TastinoSage({ testo, onClick, className = '' }: { testo: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} className={`py-[7px] -my-[7px] ${className}`}
      style={{ height: 30, borderRadius: 6, padding: '0 9px', background: 'var(--color-sage)', color: 'var(--color-green-mid)', fontSize: 13, fontWeight: 700 }}>{testo}</button>
  )
}

// Una riga dell'elenco dei clienti trovati: la forma delle righe «Da
// controllare» della Home.
export function RigaCliente({ cliente, soggiorni, onScegli }: { cliente: ClienteRiga; soggiorni: number; onScegli: () => void }) {
  return (
    <button type="button" data-cliente={cliente.id} onClick={onScegli}
      className="w-full flex items-center justify-between gap-3 text-left" style={{ padding: '12px 0', borderTop: '1px solid var(--color-card-border)' }}>
      <span className="min-w-0">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-green-dark)' }}>
          {vuoleRicevuta(cliente) && <span aria-label="vuole la ricevuta">🧾 </span>}
          {valutazioneDi(cliente) === 'ottimo' && <span aria-hidden style={{ color: OTTONE }}>★ </span>}
          {(cliente.full_name ?? '').trim() || 'senza nome'}
        </span>
        <span className="block truncate" style={{ fontSize: 12.5, color: 'var(--color-stone)', marginTop: 2 }}>{rigaClienteTrovato(cliente.phone, soggiorni)}</span>
      </span>
      <span aria-hidden style={{ fontSize: 18, color: 'var(--color-stone)' }}>›</span>
    </button>
  )
}

let contatore = 0
const nuovoId = () => `n${Date.now().toString(36)}${++contatore}`

export const SENZA_TELEFONO = 'Il numero di telefono è obbligatorio: senza non si può né chiamare né scrivere.'
export const SENZA_NOME = 'Del cliente nuovo serve il nome.'

export default function NuovaPrenotazionePage() {
  const router = useRouter()
  const oggi = oggiARoma()
  const [ricerca, setRicerca] = useState('')
  const [risultati, setRisultati] = useState<ClienteRiga[]>([])
  const [soggiorni, setSoggiorni] = useState<Record<string, number>>({})
  const [erroreRicerca, setErroreRicerca] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClienteRiga | null>(null)
  const [nuovo, setNuovo] = useState<DatiNuovoCliente | null>(null)
  const [strutture, setStrutture] = useState<StrutturaNota[]>([])
  const [struttureOk, setStruttureOk] = useState(false)
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [avviso, setAvviso] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // ── il soggiorno ─────────────────────────────────────────────────────────
  const [camere, setCamere] = useState<CameraStriscia[]>([])
  const [altre, setAltre] = useState<(PrenotazioneMinima & PrenotazioneLetti)[]>([])
  const [periodi, setPeriodi] = useState<PeriodoComposto[]>([])
  const [letto, setLetto] = useState<{ importo: number | null; criterio: 'notte' | 'ogni4' | 'totale' }>({ importo: null, criterio: 'notte' })
  const [sconto, setSconto] = useState<ScontoNuova>({ tipo: 'nessuno', valore: null })
  const [notteAperta, setNotteAperta] = useState<{ gruppo: string; iso: string } | null>(null)
  // ── arrivo, come paga, con lei, nota ─────────────────────────────────────
  const [orario, setOrario] = useState('')
  const [navetta, setNavetta] = useState<'si' | 'no' | ''>('')
  const [comePaga, setComePaga] = useState<ComePagaModo>('da_vedere')
  const [caparra, setCaparra] = useState<number | null>(null)
  const [caparraData, setCaparraData] = useState('')
  const [caparraOra, setCaparraOra] = useState('')
  const [persone, setPersone] = useState<PersonaConLei[]>([])
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [guai, setGuai] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    void leggiStrutture().then(r => { if (!vivo) return; setStrutture(r.strutture); setStruttureOk(r.disponibile) })
    void supabase.from('rooms').select('*').eq('active', true).then(({ data }) => { if (vivo) setCamere((data ?? []) as CameraStriscia[]) })
    // le prenotazioni che occupano camere e letti: da oggi in avanti
    void supabase.from('bookings').select('room_id, check_in, check_out, status, num_guests, extra_bed, extra_bed_dates')
      .neq('status', 'annullata').gte('check_out', oggi)
      .then(({ data }) => { if (vivo) setAltre((data ?? []) as (PrenotazioneMinima & PrenotazioneLetti)[]) })
    return () => { vivo = false }
  }, [oggi])

  // Il cliente nuovo si salva subito: da qui in poi è un cliente come gli altri
  async function creaCliente() {
    if (!nuovo || salvandoCliente) return
    if (!nuovo.nome.trim()) { setAvviso(SENZA_NOME); return }
    if (!numeroUsabile(nuovo.telefono)) { setAvviso(SENZA_TELEFONO); return }
    setSalvandoCliente(true)
    setAvviso(null)
    const campi: Record<string, unknown> = {
      full_name: nomeCompleto({ nome: nuovo.nome, cognome: nuovo.cognome }),
      phone: nuovo.telefono.replace(/\s/g, ''),
      rating: nuovo.valutazione,
      vuole_ricevuta: nuovo.ricevuta,
      notes: nuovo.note.trim() || null,
      ...(nuovo.valutazione === 'problematico' && nuovo.motivo.trim() ? { motivo_problematico: nuovo.motivo.trim() } : {}),
      ...(struttureOk && nuovo.provenienza ? { provenienza: nuovo.provenienza, struttura_nome: nuovo.provenienza === 'altra_struttura' ? (nuovo.struttura.trim() || null) : null } : {}),
    }
    const esito = await creaClienteNuovo(campi as never, strutture)
    setSalvandoCliente(false)
    if (esito.errore || !esito.cliente) { setAvviso(esito.errore ?? 'Cliente non salvato, riprova'); return }
    setCliente({ ...esito.cliente, rating: nuovo.valutazione, vuole_ricevuta: nuovo.ricevuta, notes: nuovo.note.trim() || null } as ClienteRiga)
    setNuovo(null)
    if (periodi.length === 0) aggiungiCamera()
  }

  // La ricerca: nome o telefono, con la stessa regola già in uso. Si aspetta
  // un quarto di secondo dall'ultimo tasto, come nell'inserimento di adesso.
  function scriviRicerca(v: string) {
    setRicerca(v)
    if (timer.current) clearTimeout(timer.current)
    const testo = v.trim()
    if (testo.length < 2) { setRisultati([]); return }
    timer.current = setTimeout(() => { void cerca(testo) }, 250)
  }

  async function cerca(testo: string) {
    setErroreRicerca(null)
    const cifre = testo.replace(/\D/g, '')
    let query = supabase.from('guests').select('*')
    if (cifre.length >= 3) query = query.or(`full_name.ilike.%${testo}%,phone.ilike.%${cifre}%`)
    else query = query.ilike('full_name', `%${testo}%`)
    const { data, error } = await query.limit(20)
    if (error) { setErroreRicerca(messaggioLetturaNonRiuscita(error, 'cercare il cliente')); setRisultati([]); return }
    const trovati = filtraClienti(testo, (data ?? []) as ClienteRiga[])
    setRisultati(trovati)
    // quante volte è già stata qui: soggiorni conclusi, senza le annullate
    const ids = trovati.map(c => c.id)
    if (ids.length === 0) return
    const { data: righe } = await supabase.from('bookings').select('guest_id, check_out, status').in('guest_id', ids).neq('status', 'annullata')
    const conta: Record<string, number> = {}
    for (const b of (righe ?? []) as { guest_id: string; check_out: string }[]) {
      if (b.check_out <= oggi) conta[b.guest_id] = (conta[b.guest_id] ?? 0) + 1
    }
    setSoggiorni(conta)
  }

  // ── le camere della prenotazione ─────────────────────────────────────────
  const linee = useMemo(() => raggruppaPerCamera(periodi), [periodi])
  const trovaCamera = (id: string | null): CameraComposta | null => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null
  // il letto scelto una volta sola vale per tutti i periodi
  const periodiColLetto = useMemo(
    () => periodi.map(p => ({ ...p, letto: p.nottiLetto.length > 0 ? { importo: letto.importo ?? 0, criterio: letto.criterio } : null })),
    [periodi, letto],
  )
  const conto = useMemo(
    () => contoNuovaPrenotazione(periodiColLetto, id => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null, sconto),
    [periodiColLetto, camere, sconto],
  )

  // Scelto il cliente si comincia subito dalla prima camera
  function scegliCliente(c: ClienteRiga) {
    setCliente(c)
    setRicerca('')
    setRisultati([])
    if (periodi.length === 0) aggiungiCamera()
  }

  // il prezzo del letto secondo le regole, camera per camera
  const righeListino = useMemo(() => {
    const viste = new Map<string, number>()
    for (const p of periodi) {
      const c = trovaCamera(p.roomId)
      if (!c || p.nottiLetto.length === 0) continue
      viste.set(c.name, lettoProposto(c, p.ospiti))
    }
    return [...viste.entries()].map(([nome, importo]) => ({ nome, importo }))
  }, [periodi, camere])
  const prezzoLetto = letto.importo ?? (righeListino[0]?.importo ?? 0)

  function aggiungiCamera() {
    const gruppo = nuovoId()
    setPeriodi(ps => [...ps, {
      id: nuovoId(), gruppo, roomId: null,
      checkIn: ps[0]?.checkIn ?? oggi, checkOut: ps[0]?.checkOut ?? spostaGiorni(oggi, 1),
      ospiti: 1, nottiLetto: [], letto: null, tariffa: null,
    }])
  }

  // I campi di una linea: cambiandoli la linea torna a essere un periodo solo
  function cambiaLinea(gruppo: string, pezzo: { arrivo?: string; partenza?: string; roomId?: string | null; ospiti?: number; tariffa?: number | null }) {
    setPeriodi(ps => {
      const linea = raggruppaPerCamera(ps).find(l => l.gruppo === gruppo)
      if (!linea) return ps
      const d = datiLinea(linea)
      const primo = linea.periodi[0]
      const camera = trovaCamera(pezzo.roomId !== undefined ? pezzo.roomId : d.roomId)
      const cambiaCamera = pezzo.roomId !== undefined && pezzo.roomId !== d.roomId
      const unito: PeriodoComposto = {
        ...primo,
        roomId: pezzo.roomId !== undefined ? pezzo.roomId : d.roomId,
        checkIn: pezzo.arrivo ?? d.arrivo,
        checkOut: pezzo.partenza ?? d.partenza,
        ospiti: pezzo.ospiti ?? (cambiaCamera ? ospitiIniziali(camera) : d.ospiti),
        tariffa: pezzo.tariffa !== undefined ? pezzo.tariffa : (cambiaCamera ? null : d.tariffa),
        nottiLetto: linea.periodi.flatMap(p => p.nottiLetto),
        letto: primo.letto,
      }
      const fuori = ps.filter(p => p.gruppo !== gruppo)
      // le date o la camera cambiate rifanno la linea intera: il cambio camera
      // si rifà dalla striscia, che è l'unico posto da cui si spezza
      return [...fuori, conLettoAutomatico(unito, camera)].sort((a, z) => a.checkIn.localeCompare(z.checkIn) || a.gruppo.localeCompare(z.gruppo))
    })
  }

  // Il foglietto della notte: cambia camera, letto e ospiti di quella notte
  function chiudiNotte() { setNotteAperta(null) }
  function applicaNotti(gruppo: string, nuove: NotteStriscia[], daQuiInPoi: boolean, iso: string) {
    setPeriodi(ps => {
      const linea = raggruppaPerCamera(ps).find(l => l.gruppo === gruppo)
      if (!linea) return ps
      let notti = nuove
      if (daQuiInPoi) {
        // quello che è cambiato su questa notte vale anche per quelle dopo
        const scelta = nuove.find(n => n.iso === iso)
        if (scelta) {
          notti = nuove.map(n => (n.iso > iso && n.dentro
            ? { ...n, cameraId: scelta.cameraId, camera: scelta.camera, letto: scelta.letto, persone: scelta.persone }
            : n))
        }
      }
      const fuori = ps.filter(p => p.gruppo !== gruppo)
      return [...fuori, ...periodiDaNotti(notti, linea, nuovoId)].sort((a, z) => a.checkIn.localeCompare(z.checkIn) || a.gruppo.localeCompare(z.gruppo))
    })
    setNotteAperta(null)
  }

  const contesto = (gruppo: string): ContestoNotti => {
    const linea = linee.find(l => l.gruppo === gruppo)
    const miei = new Set(linea?.periodi.map(p => p.id))
    return {
      camere,
      // le altre prenotazioni vere più le ALTRE camere di questa compilazione
      altre: [
        ...altre,
        ...periodi.filter(p => !miei.has(p.id) && p.roomId).map(p => ({
          room_id: p.roomId!, check_in: p.checkIn, check_out: p.checkOut, status: 'confermata',
          num_guests: p.ospiti, extra_bed: p.nottiLetto.length > 0, extra_bed_dates: p.nottiLetto,
        })),
      ],
      ospiti: linea ? datiLinea(linea).ospiti : 1,
    }
  }

  // ── il salvataggio ───────────────────────────────────────────────────────
  // Le righe le scrive rigaDaSalvare, le stesse di sempre; i controlli sono
  // quelli di lib/prenotazioneComposta (camere, capienza, letti della casa).
  async function salva() {
    if (salvando || !cliente) return
    const lettiAltrui = lettiOccupatiPerNotte(altre.filter(a => a.status === 'confermata' || a.status === 'completata'))
    const fuori = problemi(periodiColLetto, id => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null, lettiAltrui)
    if (orario && !oraCompleta(orario)) fuori.push('L’orario di arrivo è incompleto: scrivi per esempio 15:30.')
    if (chiedeScadenzaComePaga(comePaga) && Boolean(caparraData) !== Boolean(caparraOra)) fuori.push('Della caparra servono data e ora, oppure nessuna delle due.')
    if (comePaga === 'caparra' && (!caparra || caparra <= 0)) fuori.push('La caparra deve essere un importo positivo.')
    setGuai(fuori)
    if (fuori.length > 0) return

    setSalvando(true)
    const prenotazioneId = crypto.randomUUID()
    const gruppi = new Map<string, string>()
    for (const l of linee) gruppi.set(l.gruppo, crypto.randomUUID())
    const pagamento = campiComePaga(comePaga, {
      totaleCent: conto.daPagareCent,
      importoCent: caparra == null ? null : Math.round(caparra * 100),
      entro: caparraData && caparraOra ? `${caparraData}T${caparraOra}:00` : null,
    })
    const comuni: Record<string, unknown> = {
      guest_id: cliente.id, status: 'confermata', source: 'diretta', pagato: false,
      bonifico: pagamento.bonifico,
      notes: nota.trim() || null,
      ...(oraCompleta(orario) ? { check_in_time: orario } : {}),
      ...(navetta ? { shuttle: navetta } : {}),
      ...campiConLei(persone),
      ...campiSconto(conto.totaleCent, sconto, periodi.length === 1),
    }
    const primo = [...periodiColLetto].sort((a, z) => a.checkIn.localeCompare(z.checkIn))[0]?.id
    const base = periodiColLetto.map(p => rigaDaSalvare(p, camere.find(c => c.id === p.roomId) as CameraComposta, gruppi.get(p.gruppo)!))
    // con uno sconto il totale di ogni riga si scrive già scontato
    const scontati = totaliScontati(base.map(r => Number(r.total_amount) || 0), sconto)
    const righe = periodiColLetto.map((p, i) => ({
      ...base[i],
      total_amount: scontati[i],
      ...comuni,
      prenotazione_id: prenotazioneId,
      accordo_pagamento: pagamento.accordo_pagamento,
      ...(p.id === primo ? { caparra_centesimi: pagamento.caparra_centesimi, caparra_entro: pagamento.caparra_entro } : {}),
      ...(p.nottiLetto.length > 0 ? { extra_bed_importo: letto.importo, extra_bed_criterio: letto.criterio } : {}),
    }))

    // Le colonne arrivate dopo possono mancare: si toglie SOLO quella e si
    // riprova, come fa l'inserimento di adesso.
    const facoltative = new Set(['prenotazione_id', 'extra_bed_importo', 'extra_bed_criterio', 'accordo_pagamento', 'caparra_centesimi', 'caparra_entro'])
    let tentativo: Record<string, unknown>[] = righe
    let esito = await supabase.from('bookings').insert(tentativo).select('id, check_in')
    for (let giro = 0; giro < 6 && esito.error; giro++) {
      const colonna = colonnaMancante(esito.error)
      if (!colonna || !facoltative.has(colonna)) break
      const togli = ['extra_bed_importo', 'extra_bed_criterio'].includes(colonna) ? ['extra_bed_importo', 'extra_bed_criterio'] : [colonna]
      tentativo = tentativo.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !togli.includes(k))))
      esito = await supabase.from('bookings').insert(tentativo).select('id, check_in')
    }
    setSalvando(false)
    if (esito.error || !esito.data?.length) {
      setGuai([`La prenotazione non è stata salvata: ${esito.error?.message ?? 'errore sconosciuto'}`])
      return
    }
    // si apre la scheda della prenotazione appena fatta
    const prima = [...esito.data].sort((a, z) => String(a.check_in).localeCompare(String(z.check_in)))[0]
    router.push(`/scheda/${prima.id}?salvata=1`)
  }

  return (
    <div className="py-4 px-[22px] md:max-w-[620px] md:mx-auto">
      <div className="-mx-[6px]"><BackBar href="/prenotazioni" /></div>

      <h1 style={{ fontFamily: GEORGIA, fontSize: 26, lineHeight: '30px', color: 'var(--color-green-dark)', marginTop: 10 }}>{TITOLO_PAGINA}</h1>
      <p data-oggi className="uppercase" style={{ fontSize: 10, letterSpacing: '1.5px', color: OTTONE, marginTop: 4 }}>{dataDiOggi(oggi)}</p>

      {avviso && <AvvisoAzione testo={avviso} className="mt-3" />}

      {!cliente && !nuovo && (
        <section data-cerca-cliente style={{ marginTop: 18 }}>
          <CampoRicerca value={ricerca} onChange={scriviRicerca} placeholder="Cerca per nome o telefono…" />
          <div style={{ marginTop: 10 }}><TastinoSage testo={NUOVO_CLIENTE} onClick={() => setNuovo(NUOVO_CLIENTE_VUOTO)} /></div>
          {erroreRicerca && <p className="mt-3" style={{ fontSize: 13, color: '#8C3B2E' }}>{erroreRicerca}</p>}
          {risultati.length > 0 && (
            <div data-trovati style={{ marginTop: 14 }}>
              {risultati.map(c => <RigaCliente key={c.id} cliente={c} soggiorni={soggiorni[c.id] ?? 0} onScegli={() => scegliCliente(c)} />)}
              <div style={{ marginTop: 12 }}><TastinoSage testo={NUOVO_CLIENTE} onClick={() => setNuovo(NUOVO_CLIENTE_VUOTO)} /></div>
            </div>
          )}
        </section>
      )}

      {!cliente && nuovo && (
        <NuovoCliente className="mt-4" dati={nuovo} onDati={setNuovo} strutture={strutture} struttureDisponibili={struttureOk}
          onAvanti={() => void creaCliente()} avantiSpento={salvandoCliente} />
      )}

      {cliente && (
        <>
          {/* Il cliente scelto resta in cima, con «cambia» a destra */}
          <div data-cliente-scelto className="flex items-center justify-between gap-3" style={{ marginTop: 16, padding: '10px 0', borderBottom: '1px solid var(--color-card-border)' }}>
            <span className="min-w-0">
              <span className="block truncate" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-green-dark)' }}>
                {vuoleRicevuta(cliente) && <span aria-label="vuole la ricevuta">🧾 </span>}
                {valutazioneDi(cliente) === 'ottimo' && <span aria-hidden style={{ color: OTTONE }}>★ </span>}
                {(cliente.full_name ?? '').trim() || 'senza nome'}
              </span>
              <span className="block truncate" style={{ fontSize: 12.5, color: 'var(--color-stone)', marginTop: 2 }}>{rigaClienteTrovato(cliente.phone, soggiorni[cliente.id] ?? 0)}</span>
            </span>
            <button type="button" data-cambia-cliente onClick={() => { setCliente(null); setRicerca(''); setRisultati([]) }}
              className="py-2 -my-2 shrink-0" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-green-mid)' }}>cambia</button>
          </div>

          {linee.map((linea, i) => {
            const d = datiLinea(linea)
            // anche le ALTRE camere di questa compilazione occupano: due volte
            // la stessa camera nelle stesse notti non si può
            const scelte = camereDelPeriodo(camere, contesto(linea.gruppo).altre, d.arrivo, d.partenza)
            const camera = trovaCamera(d.roomId)
            const notti = nottiDaPeriodi(linea.periodi, camere)
            return (
              <CameraSoggiorno key={linea.gruppo} className="mt-5"
                titolo={i === 0 ? 'Soggiorno' : `Camera ${i + 1}`}
                arrivo={d.arrivo} partenza={d.partenza}
                onArrivo={v => cambiaLinea(linea.gruppo, { arrivo: v })}
                onPartenza={v => cambiaLinea(linea.gruppo, { partenza: v })}
                notti={nottiDellaLinea(linea)}
                camere={scelte} roomId={d.roomId} onCamera={id => cambiaLinea(linea.gruppo, { roomId: id })}
                rigaLibere={rigaCamereLibere(scelte, d.arrivo, d.partenza)}
                ospiti={d.ospiti} onOspiti={n => cambiaLinea(linea.gruppo, { ospiti: n })} ospitiMax={capienzaCamera(camera)}
                tariffa={d.tariffa} tariffaProposta={camera && linea.periodi[0] ? tariffaProposta(linea.periodi[0], camera) : null}
                onTariffa={v => cambiaLinea(linea.gruppo, { tariffa: v })}
                strisciaNotti={d.roomId ? notti : []}
                onNotte={n => setNotteAperta({ gruppo: linea.gruppo, iso: n.iso })}
              />
            )
          })}

          {/* Il letto e lo sconto valgono per tutta la prenotazione */}
          {periodi.some(p => p.nottiLetto.length > 0) && (
            <div data-prezzo-letto style={{ marginTop: 4 }}>
              <Etichetta testo="Quanto costa il letto" centrata />
              <FilaPastiglie centrata>
                {CRITERI_LETTO.map(c => (
                  <Pastiglia key={c.chiave} dati={`letto-${c.chiave}`} acceso={letto.criterio === c.chiave} onClick={() => setLetto(l => ({ ...l, criterio: c.chiave }))}>
                    {c.chiave === 'notte' ? (prezzoLetto > 0 ? `${prezzoLetto} € a notte` : 'a notte') : c.etichetta}
                  </Pastiglia>
                ))}
              </FilaPastiglie>
              <div className="flex items-end" style={{ gap: 12, marginTop: 10 }}>
                <RigaCampo etichetta="Quanto" className="flex-1 min-w-0">
                  <input type="number" inputMode="decimal" data-campo="letto" value={letto.importo ?? ''}
                    placeholder={prezzoLetto > 0 ? String(prezzoLetto) : LETTO_COMPRESO_LISTINO}
                    onChange={e => setLetto(l => ({ ...l, importo: e.target.value === '' ? null : Number(e.target.value) }))} style={stileCampo} />
                </RigaCampo>
                <p data-listino-letto style={{ fontSize: 12, color: 'var(--color-stone)', paddingBottom: 10 }}>{listinoLetto(righeListino)}</p>
              </div>
            </div>
          )}

          {periodi.length > 0 && (
            <div data-sconto>
              <Etichetta testo="Sconto" centrata />
              <FilaPastiglie centrata>
                {([['nessuno', 'Nessuno'], ['percentuale', 'Percentuale'], ['finale', 'Prezzo finale']] as const).map(([tipo, testo]) => (
                  <Pastiglia key={tipo} dati={`sconto-${tipo}`} acceso={sconto.tipo === tipo} onClick={() => setSconto({ tipo, valore: tipo === 'nessuno' ? null : sconto.valore })}>{testo}</Pastiglia>
                ))}
              </FilaPastiglie>
              {sconto.tipo !== 'nessuno' && (
                <div className="flex items-end" style={{ gap: 12, marginTop: 10 }}>
                  <RigaCampo etichetta={sconto.tipo === 'percentuale' ? 'Quanto per cento' : 'Quanto paga in tutto'} className="flex-1 min-w-0">
                    <input type="number" inputMode="decimal" data-campo="sconto" value={sconto.valore ?? ''}
                      onChange={e => setSconto(sc => ({ ...sc, valore: e.target.value === '' ? null : Number(e.target.value) }))} style={stileCampo} />
                  </RigaCampo>
                  <p data-sconto-conto style={{ fontSize: 12, color: OTTONE_PEZZI, paddingBottom: 10 }}>{scontoInParole(conto.totaleCent, sconto)}</p>
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 22 }}><TastinoTenue testo="+ Aggiungi camera" onClick={aggiungiCamera} /></div>

          {/* ── Arrivo ──────────────────────────────────────────────────── */}
          <section data-arrivo className="mt-6">
            <p className="ed-sezione">Arrivo</p>
            <div className="flex flex-wrap" style={{ gap: 22 }}>
              <div className="flex-1 min-w-[140px]">
                <Etichetta testo="A che ora arriva" />
                <RigaCampo etichetta="🕐 ora">
                  <input type="text" inputMode="numeric" maxLength={5} placeholder="es. 15:30" data-campo="orario"
                    value={orario} onChange={e => setOrario(oraDigitata(e.target.value))} style={stileCampo} />
                </RigaCampo>
              </div>
              <div>
                <Etichetta testo="Navetta" />
                <FilaPastiglie>
                  {([['no', 'No'], ['si', 'Sì'], ['', '?']] as const).map(([v, testo]) => (
                    <Pastiglia key={testo} dati={`navetta-${v || 'boh'}`} acceso={navetta === v} onClick={() => setNavetta(v)}>{testo}</Pastiglia>
                  ))}
                </FilaPastiglie>
              </div>
            </div>
          </section>

          {/* ── Come paga ───────────────────────────────────────────────── */}
          <section data-come-paga-parte className="mt-6">
            <p className="ed-sezione">Come paga</p>
            <div className="mt-3">
              <ComePaga modo={comePaga} onModo={setComePaga} totaleCent={conto.daPagareCent}
                importo={caparra} onImporto={setCaparra}
                data={caparraData} ora={caparraOra} onData={setCaparraData} onOra={setCaparraOra} />
            </div>
          </section>

          {/* ── Con lei ─────────────────────────────────────────────────── */}
          <ConLei className="mt-6" persone={persone} onPersone={setPersone}
            avviso={persone.length > PERSONE_CON_LEI_MAX ? TROPPE_PERSONE : null} />

          {/* ── La nota di questo soggiorno ─────────────────────────────── */}
          <section data-nota className="mt-6">
            <p className="ed-sezione">Nota di questo soggiorno</p>
            <RigaCampo etichetta="Nota">
              <textarea rows={2} data-campo="nota" value={nota} onChange={e => setNota(e.target.value)} style={{ ...stileCampo, resize: 'none' }} />
            </RigaCampo>
          </section>

          {/* ── Il conto, sempre in vista ───────────────────────────────── */}
          {guai.length > 0 && (
            <div data-guai className="mt-6">
              {guai.map(g => <AvvisoAzione key={g} testo={g} className="mt-2" />)}
            </div>
          )}
          <ContoNuova className="mt-6" conto={conto} onSalva={() => void salva()} salvaSpento={salvando || conto.daPagareCent === null} />
        </>
      )}

      {notteAperta && (() => {
        const linea = linee.find(l => l.gruppo === notteAperta.gruppo)
        if (!linea) return null
        const d = datiLinea(linea)
        return (
          <FoglioNotte notti={nottiDaPeriodi(linea.periodi, camere)} iso={notteAperta.iso} contesto={contesto(notteAperta.gruppo)}
            ospitiPossibili={cameraId => {
              // il numero di questa notte può salire fino a quello che la camera
              // tiene; se però altre notti hanno già il letto, il loro numero
              // comanda (è uno solo per tutta la camera)
              const camera = trovaCamera(cameraId)
              const altreColLetto = linea.periodi.some(p => p.nottiLetto.some(g => g !== notteAperta.iso))
              return ospitiPossibiliNotte(camera, altreColLetto ? d.ospiti : capienzaCamera(camera))
            }}
            onFatto={(nuove, daQui) => applicaNotti(notteAperta.gruppo, nuove, daQui, notteAperta.iso)}
            onChiudi={chiudiNotte} />
        )
      })()}
    </div>
  )
}
