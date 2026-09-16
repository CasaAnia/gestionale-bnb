'use client'
// ============================================================================
// LA NUOVA SCHEDA PRENOTAZIONE — /scheda/<id> (13/09/2026).
// Nasce a un indirizzo a parte: la scheda vecchia (/prenotazioni/<id>) resta
// com'è finché questa non è completa. Stile della pagina della proposta delle
// richieste e della Home: testa col cliente (TestaCliente), fascia delle
// sezioni ferma in cima (FasciaSezioni), schedine di «Da controllare»
// (SchedinaControllo).
//
// Le parti, nell'ordine della fascia: DA CONTROLLARE · SOGGIORNO · CONTO ·
// MESSAGGI · CLIENTE, e in fondo CRONOLOGIA, che non sta nella fascia.
//
// I dati sono quelli veri della prenotazione: tutte le camere della stessa
// prenotazione con lib/prenotazioneUnica (la stessa lettura della scheda
// attuale), i pagamenti, gli altri soggiorni della cliente. Le cifre del
// conto vengono da contoPrenotazione, mai ricalcolate qui.
//
// I fogli di modifica si aprono QUI, nella stessa veste (components/scheda/
// Foglio*): «Aggiungi pagamento», «Come paga», «Dati della cliente», «Cambia
// cliente», «Annulla la prenotazione», «Arrivo», «da dove?» e il FOGLIETTO
// DELLA NOTTE. I salvataggi sono quelli già in casa (lib/pagamentiDati,
// lib/comePagaDati, lib/cambiaClienteDati, lib/arrivoOrario,
// lib/provenienzaDati, lib/strisciaNotti): nessuna regola riscritta. Dopo
// ogni salvataggio la scheda si aggiorna da sé, senza ricaricare la pagina:
// prima con quello che ha appena salvato, poi rileggendo in silenzio
// (`rileggi`), così conto, cronologia e «Da controllare» tornano insieme.
// Dalla striscia si cambiano camera e letto in più notte per notte:
// «Modifica soggiorno» non c'è più. «Vedi tutto» porta ancora alla scheda
// completa, che resta com'è.
//
// I testi dei messaggi NON sono qui: stanno in lib/messaggiPrenotazione, che
// li tiene identici a quelli della scheda attuale (test di confronto).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import BackBar from '@/components/BackBar'
import TestaCliente from '@/components/TestaCliente'
import FasciaSezioni from '@/components/FasciaSezioni'
import SchedinaControllo from '@/components/SchedinaControllo'
import ClienteScheda from '@/components/scheda/ClienteScheda'
import ContoScheda from '@/components/scheda/ContoScheda'
import MessaggiScheda from '@/components/scheda/MessaggiScheda'
import CronologiaScheda from '@/components/scheda/CronologiaScheda'
import ConfermaWhatsApp from '@/components/ConfermaWhatsApp'
import AvvisoAzione from '@/components/AvvisoAzione'
import { RigaDocumentiPrenotazione } from '@/components/DocumentiCliente'
import StrisciaNottiCamere from '@/components/StrisciaNottiCamere'
import FoglioNotte from '@/components/FoglioNotte'
import { RigaArrivo, TrattiCameraScheda, LinkSoggiorno } from '@/components/scheda/SoggiornoScheda'
import ArriviPrecedenti from '@/components/scheda/ArriviPrecedenti'
import FoglioArrivo from '@/components/scheda/FoglioArrivo'
import FoglioProvenienza from '@/components/scheda/FoglioProvenienza'
import FoglioComePaga from '@/components/scheda/FoglioComePaga'
import FoglioPagamento, { type PagamentoSalvato } from '@/components/scheda/FoglioPagamento'
import FoglioCliente from '@/components/scheda/FoglioCliente'
import FoglioCambiaCliente from '@/components/scheda/FoglioCambiaCliente'
import ConfermaVolante from '@/components/ConfermaVolante'
import AdessoScheda from '@/components/scheda/AdessoScheda'
import { supabase } from '@/lib/supabase'
import { leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, chiavePrenotazione, ERRORE_CONTO_INCOMPLETO, type RigaPrenotazione } from '@/lib/prenotazioneUnica'
import {
  SEZIONI_SCHEDA, TUTTO_A_POSTO, statoScheda, primaRigaScheda, etichettaArrivoScheda, rigaGrandeScheda, statoConto, noteScheda,
  arrivoScheda, trattiCamera, daControllareScheda, segmentiAttivi, euroScheda, type SegmentoScheda,
} from '@/lib/schedaPrenotazione'
import { comePagaSalvato } from '@/lib/comePaga'
import { confermaPagamento, type ConfermaPagamento } from '@/lib/confermaPagamento'
import { righePerSaldo } from '@/lib/pagamentiDati'
import { saldoMancanteCent } from '@/lib/statistiche'
import { nottiDaSegmenti, pianoNotti, stessaStriscia, type ContestoNotti, type NotteStriscia, type CameraStriscia } from '@/lib/strisciaNotti'
import { salvaNottiInUnColpo } from '@/lib/nottiScrittura'
import { nomeOspite } from '@/lib/guestName'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { provenienzaInParole, provenienzaDi, normalizzaProvenienza, type CampiProvenienza } from '@/lib/provenienza'
import { elencoSoggiorniPersona, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { numeroWhatsAppPrenotazione, waHrefTesto } from '@/lib/messaggiWhatsApp'
import { openWhatsApp, telefonoAGruppi } from '@/lib/whatsapp'
import buildWhatsappMsg, { type TipoMessaggio } from '@/lib/messaggiPrenotazione'
import {
  testaConto, righeConto, comePagaScheda, righePagamenti, vociCliente, personeConLei, righeStoria,
  type PagamentoScheda, type MessaggioInviato,
} from '@/lib/schedaConto'
import { leggiCronologia } from '@/lib/cronologiaDati'
import type { EventoCronologia } from '@/lib/cronologia'
import { valutazioneDi as valutazioneCliente } from '@/lib/valutazione'
import { oggiARoma } from '@/lib/spese/adattatore'
import type { PrenotazioneDC } from '@/lib/daControllare'
import type { PagamentoStat } from '@/lib/statistiche/tipi'
import type { SegmentoStorico } from '@/lib/storicoCliente'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
const VERDE_MESE = '#5B6559'
const ROSSO_CONTO = '#D40000'
const COLONNE_ALTRE = '*, rooms(name), guests(full_name, phone)'

type Prenotazione = SegmentoScheda & RigaPrenotazione & {
  guests?: { id?: string; full_name?: string | null; phone?: string | null; rating?: string | null; vuole_ricevuta?: boolean | null; notes?: string | null; provenienza?: string | null; struttura_nome?: string | null } | null
  provenienza?: string | null
  struttura_nome?: string | null
  created_at?: string | null
  // I contatti in più della prenotazione: chi dorme con lei («CON LEI»)
  extra_phone_1?: string | null
  extra_phone_1_name?: string | null
  extra_phone_2?: string | null
  extra_phone_2_name?: string | null
}

// La riga grande: OSPITI e CAMERA (con «⇄ 2» se cambia camera)
function RigaGrande({ ospiti, camere, cambi }: { ospiti: number; camere: string; cambi: number }) {
  const etichetta = { marginTop: 6, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--color-stone)' }
  return (
    <div data-riga-grande className="flex items-start justify-center" style={{ gap: 44 }}>
      <div className="text-center" data-ospiti-testa>
        <p className="leading-[1.15]" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 24, color: 'var(--color-green-dark)' }}>{ospiti}</p>
        <p style={etichetta}>ospiti</p>
      </div>
      <div className="text-center min-w-0" data-camera-scheda>
        <p className="leading-[1.15] truncate" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 24, color: 'var(--color-green-dark)' }}>
          {camere}
          {cambi > 0 && <span data-cambi style={{ fontSize: 15, color: VERDE_MESE }}> ⇄ {cambi}</span>}
        </p>
        <p style={etichetta}>camera</p>
      </div>
    </div>
  )
}

export const PRENOTAZIONE_SALVATA = '✓ Prenotazione salvata'
export const FONDO_SALVATA = 'var(--color-sage)'
const SECONDI_SALVATA = 5

export default function SchedaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const parametri = useSearchParams()
  const oggi = oggiARoma()
  const [booking, setBooking] = useState<Prenotazione | null>(null)
  const [righe, setRighe] = useState<Prenotazione[]>([])
  const [pagamenti, setPagamenti] = useState<PagamentoStat[]>([])
  const [altreCliente, setAltreCliente] = useState<SoggiornoStorico[]>([])
  const [altreNotti, setAltreNotti] = useState<PrenotazioneDC[]>([])
  const [documenti, setDocumenti] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [eventi, setEventi] = useState<EventoCronologia[]>([])
  const [cronologiaAccesa, setCronologiaAccesa] = useState(true)
  const [messaggiInviati, setMessaggiInviati] = useState<MessaggioInviato[]>([])
  const [business, setBusiness] = useState(false)
  const [confermaAperta, setConfermaAperta] = useState(false)
  const [foglioArrivo, setFoglioArrivo] = useState(false)
  const [foglioProvenienza, setFoglioProvenienza] = useState(false)
  const [foglioComePaga, setFoglioComePaga] = useState(false)
  const [foglioPagamento, setFoglioPagamento] = useState(false)
  const [foglioCliente, setFoglioCliente] = useState(false)
  const [foglioCambiaCliente, setFoglioCambiaCliente] = useState(false)
  // la conferma volante dopo un pagamento (Ania, 11/09/2026): due righe, pochi secondi
  const [conferma, setConferma] = useState<{ n: number; righe: ConfermaPagamento } | null>(null)
  // arrivando dalla pagina di inserimento: la pastiglia verde che sparisce da sé
  const [salvata, setSalvata] = useState(parametri.get('salvata') === '1')
  const [arriviAperti, setArriviAperti] = useState(false)
  // la striscia delle notti: le camere di casa, la notte aperta e il salvataggio
  const [camere, setCamere] = useState<CameraStriscia[]>([])
  const [notteAperta, setNotteAperta] = useState<string | null>(null)
  const [salvandoNotti, setSalvandoNotti] = useState(false)
  const [versione, setVersione] = useState(0)
  // «Caricamento…» solo la prima volta che si apre QUESTA prenotazione: le
  // riletture dopo un salvataggio avvengono in silenzio, sotto la scheda
  const idCaricato = useRef<string | null>(null)
  const rileggi = () => setVersione(v => v + 1)
  // dalla Home, «Registra saldo» arriva con ?azione=pagato: il foglio si apre da sé, una volta
  const pagamentoDaAprire = useRef(parametri.get('azione') === 'pagato')

  useEffect(() => {
    if (!salvata) return
    const t = setTimeout(() => setSalvata(false), SECONDI_SALVATA * 1000)
    return () => clearTimeout(t)
  }, [salvata])

  useEffect(() => {
    if (!id) return
    let vivo = true
    ;(async () => {
      if (idCaricato.current !== id) setLoading(true)
      const { data: b, error } = await supabase.from('bookings').select('*, rooms(*), guests(*)').eq('id', id).single()
      if (!vivo) return
      if (error || !b) { setBooking(null); setErrore(error?.message || 'Prenotazione non trovata.'); setLoading(false); return }
      const scheda = b as Prenotazione
      setBooking(scheda)
      // Tutte le camere della prenotazione: la stessa lettura della scheda attuale
      const conto = await leggiPrenotazioneUnica(scheda, f => supabase.from('bookings').select('*, rooms(*)').eq(f.colonna, f.valore).order('check_in'))
      if (!vivo) return
      // Le righe arrivano con la camera ma senza il cliente: è lo stesso per tutte
      const tutte = (conto.errore ? [scheda] : (conto.righe as Prenotazione[])).map(r => ({ ...r, guests: r.guests ?? scheda.guests, guest_name: r.guest_name ?? scheda.guest_name }))
      setRighe(tutte)
      if (conto.errore) setAvviso(conto.errore)
      const ids = tutte.map(r => r.id)
      const attive = segmentiAttivi(tutte)
      const arrivo = attive[0]?.check_in ?? scheda.check_in
      const partenza = attive.reduce((m, s) => (s.check_out > m ? s.check_out : m), scheda.check_out)
      const [pag, altre, vicine, doc, stanze] = await Promise.all([
        supabase.from('payments').select('*').in('booking_id', ids).order('paid_on'),
        scheda.guest_id
          ? supabase.from('bookings').select('*, rooms(name), guests(full_name, phone)').eq('guest_id', scheda.guest_id).order('check_in', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
        // le altre prenotazioni nelle stesse notti: sovrapposizioni e letti oltre il pool
        supabase.from('bookings').select(COLONNE_ALTRE).neq('status', 'annullata').lt('check_in', partenza).gt('check_out', arrivo),
        scheda.guest_id
          ? supabase.from('documenti_cliente').select('id', { count: 'exact', head: true }).eq('guest_id', scheda.guest_id)
          : Promise.resolve({ count: null, error: null }),
        // le camere di casa: servono alla striscia per sapere chi è libero
        supabase.from('rooms').select('*'),
      ])
      if (!vivo) return
      if (pag.error) setAvviso(a => a ?? `Non riesco a leggere i pagamenti: ${pag.error.message}`)
      // La cronologia: le modifiche le scrive il database, i messaggi partiti
      // stanno in booking_whatsapp_log (tabella di sempre).
      leggiCronologia(ids).then(c => {
        if (!vivo) return
        setEventi(c.eventi)
        setCronologiaAccesa(c.registrata)
        if (c.errore) setAvviso(a => a ?? c.errore)
      })
      supabase.from('booking_whatsapp_log').select('id, message_type, created_at').in('booking_id', ids).order('created_at')
        .then(({ data, error }) => { if (vivo && !error) setMessaggiInviati((data ?? []) as MessaggioInviato[]) })
      setPagamenti((pag.data ?? []) as PagamentoStat[])
      const chiave = chiavePrenotazione(scheda)
      setAltreCliente(((altre.data ?? []) as SoggiornoStorico[]).filter(x => chiavePrenotazione(x as RigaPrenotazione) !== chiave))
      setAltreNotti(((vicine.data ?? []) as PrenotazioneDC[]).filter(x => !ids.includes(x.id)))
      setDocumenti(doc.error ? null : (doc.count ?? 0))
      setCamere(((stanze.data ?? []) as CameraStriscia[]))
      if (stanze.error) setAvviso(a => a ?? 'Non riesco a leggere le camere: dalla striscia non si possono spostare le notti.')
      idCaricato.current = id
      setLoading(false)
      if (pagamentoDaAprire.current) { pagamentoDaAprire.current = false; setFoglioPagamento(true) }
    })().catch(() => { if (vivo) { setErrore(ERRORE_CONTO_INCOMPLETO); setLoading(false) } })
    return () => { vivo = false }
  }, [id, versione])

  const guest = booking?.guests ?? null
  const hrefCliente = booking?.guest_id ? `/clienti/${booking.guest_id}` : null
  const attive = useMemo(() => segmentiAttivi(righe), [righe])
  const primoArrivo = attive[0]?.check_in ?? booking?.check_in ?? ''
  const ultimaPartenza = attive.reduce((m, s) => (s.check_out > m ? s.check_out : m), booking?.check_out ?? '')
  const tratti = useMemo(() => trattiCamera(attive), [attive])
  const grande = useMemo(() => rigaGrandeScheda(attive), [attive])
  // Il conto: contoPrenotazione di lib/prenotazioneUnica, come la scheda attuale
  const conto = useMemo(() => {
    try { return contoPrenotazione(righe, pagamenti.map(p => ({ booking_id: p.booking_id, amount: p.amount }))) } catch { return null }
  }, [righe, pagamenti])
  const accordo = useMemo(() => accordoPrenotazione(righe) ?? booking, [righe, booking])
  const stato = conto ? statoConto({ totaleCent: conto.totaleCent, ricevutiCent: conto.ricevutiCent, pagato: righe.some(r => r.pagato), bonifico: accordo?.bonifico }) : null
  // Chi è: soggiorni conclusi della stessa persona, fuori questa prenotazione
  const soggiorni = useMemo(() => {
    if (!booking) return []
    const persona = { guest_id: booking.guest_id ?? null, telefono: guest?.phone ?? null, full_name: booking.guest_name || guest?.full_name || null }
    return elencoSoggiorniPersona(persona, altreCliente, oggi, chiavePrenotazione(booking))
  }, [booking, guest, altreCliente, oggi])
  const totaleSoggiorniCent = soggiorni.reduce((t, s) => t + s.totaleCent, 0)
  const provenienza = provenienzaInParole(guest ?? booking)
  const primaRiga = primaRigaScheda(soggiorni.length, provenienza)
  const note = noteScheda(guest?.notes, booking?.notes)
  const arrivoTesto = booking ? arrivoScheda(primoArrivo, oggi, attive[0]?.check_in_time ?? booking.check_in_time, attive[0]?.shuttle ?? booking.shuttle) : null
  const controlli = useMemo(() => booking ? daControllareScheda({
    segmenti: attive, altre: altreNotti, pagamenti, oggi, documenti, hrefDocumenti: hrefCliente ? `${hrefCliente}#documenti` : null,
  }) : [], [booking, attive, altreNotti, pagamenti, oggi, documenti, hrefCliente])

  const telefono = guest?.phone ?? null
  const waNumero = numeroWhatsAppPrenotazione(telefono)
  const primoSegmento = attive[0] ?? booking
  const hrefVecchia = (segmentoId: string) => `/prenotazioni/${segmentoId}`

  // ── LA STRISCIA DELLE NOTTI ──────────────────────────────────────────────
  // Le notti come sono salvate; le regole (chi è libero, capienza, i due letti
  // di casa) stanno in lib/strisciaNotti e non si riscrivono qui.
  const notti = useMemo(() => nottiDaSegmenti(attive), [attive])
  const contesto: ContestoNotti = useMemo(() => ({
    camere,
    altre: altreNotti as unknown as ContestoNotti['altre'],
    ospiti: Math.max(1, ...attive.map(s => Number(s.num_guests) || 1)),
  }), [camere, altreNotti, attive])
  const nonSiSposta = camere.length === 0 || attive.some(s => s.group_id !== attive[0].group_id)

  // «Fatto» sul foglietto: si salva subito, poi la scheda si rilegge e il
  // conto si rifà da solo. Una riga che resta senza notti si ANNULLA, non si
  // cancella: l'incasso già registrato deve restare nel conto.
  async function salvaNotti(nuove: NotteStriscia[]) {
    setNotteAperta(null)
    if (!booking || salvandoNotti || stessaStriscia(notti, nuove)) return
    const piano = pianoNotti(nuove, attive, contesto)
    if (piano.errore) { setAvviso(piano.errore); return }
    setSalvandoNotti(true)
    setAvviso(null)
    // Tutti i tratti di un soggiorno stanno nello stesso gruppo: se non c'è
    // ancora (una camera sola) se ne fa uno adesso, come fa la scheda attuale.
    const gruppo = attive[0]?.group_id || crypto.randomUUID()
    const origine = attive[0]
    const comuni: Record<string, unknown> = {
      guest_id: booking.guest_id ?? null,
      ...(origine?.guest_name ? { guest_name: origine.guest_name } : {}),
      ...(origine?.prenotazione_id ? { prenotazione_id: origine.prenotazione_id } : {}),
      status: origine?.status === 'in_attesa' ? 'in_attesa' : 'confermata',
      bonifico: accordo?.bonifico ?? false,
      pagato: false,
      group_id: gruppo,
    }
    // Le tre cose — accorciare, creare, annullare — vanno insieme o non vanno:
    // le fa la funzione della proposta 0053 dentro una transazione sola. Se non
    // è applicata NON si spezza il salvataggio in tre: si dice che manca
    // (rilievo del 15/09/2026).
    const arrivoDi = (checkIn: string) => (checkIn === primoArrivo
      ? { check_in_time: primoSegmento?.check_in_time ?? null, shuttle: primoSegmento?.shuttle ?? null }
      : {})
    const esito = await salvaNottiInUnColpo(piano, gruppo, comuni, arrivoDi,
      (dati: Record<string, unknown>) => supabase.rpc('sposta_notti', dati))
    setSalvandoNotti(false)
    if (esito.esito === 'errore') { setAvviso(esito.messaggio); setVersione(v => v + 1); return }
    // Se la riga aperta è stata annullata, la scheda passa alla prima rimasta
    if (piano.annulla.includes(booking.id)) {
      const rimaste = [...piano.aggiorna.map(a => ({ id: a.id, check_in: a.campi.check_in })), ...esito.create]
        .sort((x, z) => x.check_in.localeCompare(z.check_in))
      if (rimaste[0]) { router.replace(`/scheda/${rimaste[0].id}`); return }
    }
    setVersione(v => v + 1)
  }

  // ── CONTO ────────────────────────────────────────────────────────────────
  const pagamentiScheda = pagamenti as unknown as PagamentoScheda[]
  const testa = conto ? testaConto(conto, pagamentiScheda, righe.some(r => r.pagato)) : null
  const rigeConto = useMemo(() => righeConto(attive), [attive])
  const rigePagamenti = useMemo(() => righePagamenti(pagamentiScheda), [pagamentiScheda])
  const accordoSalvato = (accordo as { accordo_pagamento?: string | null; caparra_centesimi?: number | null; caparra_entro?: string | null } | null)
  const comePagaTesto = comePagaScheda(accordoSalvato?.accordo_pagamento, accordo?.bonifico)

  // ── MESSAGGI ─────────────────────────────────────────────────────────────
  // Gli stessi testi della scheda attuale (lib/messaggiPrenotazione), con gli
  // stessi dati: la prenotazione, tutte le sue camere e i pagamenti.
  const testoMessaggio = (tipo: TipoMessaggio) =>
    booking ? buildWhatsappMsg({ ...booking, bonifico: accordo?.bonifico }, tipo, attive, pagamenti) : ''
  const hrefMessaggio = (tipo: TipoMessaggio) => waHrefTesto(waNumero ?? '', testoMessaggio(tipo))
  const apriMessaggio = (tipo: TipoMessaggio) => (e: React.MouseEvent) => {
    e.preventDefault()
    if (waNumero) openWhatsApp(waNumero, testoMessaggio(tipo), business)
  }

  // ── CLIENTE ──────────────────────────────────────────────────────────────
  const voci = vociCliente({
    telefono: telefonoAGruppi(telefono) || telefono,
    provenienza,
    valutazione: valutazioneCliente(guest),
    ricevuta: vuoleRicevuta(guest),
    nota: guest?.notes ?? null,
  })
  const conLei = personeConLei(booking)

  // ── CRONOLOGIA ───────────────────────────────────────────────────────────
  // «Adesso» si vede finché la conferma non è partita e la cliente non è
  // ancora andata via: appena mandata, sparisce da sé.
  const daFare = messaggiInviati.every(m => m.message_type !== 'conferma') && ultimaPartenza > oggi && booking?.status !== 'annullata'

  const storia = useMemo(
    () => righeStoria(eventi, messaggiInviati, booking?.created_at ?? null),
    [eventi, messaggiInviati, booking],
  )

  if (loading) return <div className="p-4"><BackBar href="/prenotazioni" /><div className="text-center py-10 text-stone">Caricamento…</div></div>
  if (!booking) return <div className="p-4"><BackBar href="/prenotazioni" /><div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore || 'Prenotazione non trovata.'}</div></div>

  return (
    /* Margini laterali 22 px, tutto centrato, come la proposta */
    <div className="py-4 px-[22px] md:max-w-[620px] md:mx-auto">
      <div className="-mx-[6px]"><BackBar href="/prenotazioni" /></div>

      {salvata && (
        <p data-salvata className="text-center uppercase" onClick={() => setSalvata(false)}
          style={{ marginBottom: 10, padding: '6px 12px', borderRadius: 999, background: FONDO_SALVATA, color: 'var(--color-green-mid)', fontSize: 11, letterSpacing: '1.5px', fontWeight: 700 }}>{PRENOTAZIONE_SALVATA}</p>
      )}

      {/* La riga di navigazione: «‹ Prenotazioni» a sinistra, lo stato a destra */}
      <div data-riga-navigazione className="flex items-center justify-between gap-3">
        <Link href="/prenotazioni" className="py-2 -my-2" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }}>‹ Prenotazioni</Link>
        <span data-stato-scheda className="uppercase" style={{ fontSize: 11, letterSpacing: '1.5px', color: OTTONE }}>{statoScheda(booking.status, ultimaPartenza, oggi)}</span>
      </div>
      {avviso && <AvvisoAzione testo={avviso} className="mt-3" />}

      <div style={{ marginTop: 14 }}>
        <TestaCliente
          nome={nomeOspite(booking)}
          stella={valutazioneDi(guest) === 'ottimo'}
          ricevuta={vuoleRicevuta(guest)}
          nomeNormale
          primaRiga={primaRiga.testo}
          chiediProvenienza={primaRiga.chiediProvenienza && booking.guest_id ? { testo: 'da dove? ›', onClick: () => setFoglioProvenienza(true) } : null}
          volte={soggiorni.length}
          inArchivio
          totaleCent={totaleSoggiorniCent}
          hrefCliente="#cliente"
          arrivo={primoArrivo}
          partenza={ultimaPartenza}
          notti={notti.filter(n => n.dentro).length}
          etichettaArrivo={etichettaArrivoScheda(primoSegmento?.check_in_time, primoSegmento?.shuttle)}
          etichettaPartenza="parte"
          personeNotti={[grande.ospiti]}
          rigaGrande={<RigaGrande ospiti={grande.ospiti} camere={grande.camere} cambi={grande.cambi} />}
          sottoRigaGrande={stato && (
            <p data-stato-conto={stato.tipo} className="text-center" style={{ marginTop: 12, fontFamily: GEORGIA, fontSize: 22, lineHeight: 1.2, color: stato.tipo === 'pagato' ? 'var(--color-green-mid)' : ROSSO_CONTO }}>{stato.testo}</p>
          )}
          telefono={telefonoAGruppi(telefono) || telefono}
          telefonoDaChiamare={waNumero}
          telefonoWhatsApp={waNumero}
          onScrivi={() => waNumero && openWhatsApp(waNumero, '')}
          dopoContatti={<p className="text-center mt-2"><RigaDocumentiPrenotazione guestId={booking.guest_id} conteggio={documenti} scheda /></p>}
          note={note}
          noteScheda
        />
      </div>

      <FasciaSezioni voci={SEZIONI_SCHEDA} className="mt-[22px]" top="top-12 lg:top-0" spaziatura={0.6} />

      {/* ── Adesso: la conferma da mandare ────────────────────────────────── */}
      {daFare && waNumero && (
        <AdessoScheda className="pt-[34px]"
          onConfermaImmagine={() => setConfermaAperta(true)}
          hrefBonifico={accordo?.bonifico ? hrefMessaggio('dati_bonifico') : null}
          onBonifico={apriMessaggio('dati_bonifico')} />
      )}

      {/* ── Da controllare ────────────────────────────────────────────────── */}
      <section id="controllare" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Da controllare {controlli.length > 0 && <small>{controlli.length}</small>}</p>
        {controlli.length === 0
          ? <p data-tutto-a-posto className="mt-2 font-semibold" style={{ fontSize: 14, color: 'var(--color-green-mid)' }}>{TUTTO_A_POSTO}</p>
          : <div className="mt-2 flex flex-col gap-2">
            {controlli.map(v => <SchedinaControllo key={v.chiave} etichetta={v.etichetta} titolo={v.titolo} dettaglio={v.dettaglio} link={v.link} grande />)}
          </div>}
      </section>

      {/* ── Soggiorno ─────────────────────────────────────────────────────── */}
      <section id="soggiorno" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Soggiorno</p>
        {/* La striscia: camera e letto in più di ogni notte, si cambiano di qui */}
        <StrisciaNottiCamere notti={notti} oggi={oggi} onNotte={nonSiSposta ? undefined : n => setNotteAperta(n.iso)} className="mt-3" />
        {nonSiSposta && notti.length > 0 && (
          <p data-striscia-ferma className="text-center" style={{ marginTop: 6, fontSize: 12, color: 'var(--color-stone)' }}>
            {camere.length === 0 ? 'Le camere non si leggono: le notti si spostano dalla scheda completa.' : 'Questa prenotazione ha più camere nelle stesse notti: le notti si spostano dalla scheda completa.'}
          </p>
        )}
        {arrivoTesto && <RigaArrivo arrivo={arrivoTesto} className="mt-3" />}
        <TrattiCameraScheda tratti={tratti} className="mt-2" />
        <LinkSoggiorno
          onArrivo={() => setFoglioArrivo(true)}
          onArriviPrecedenti={() => setArriviAperti(a => !a)}
          arriviAperti={arriviAperti}
          className="mt-1"
        />
        {arriviAperti && <ArriviPrecedenti altre={altreCliente as unknown as SegmentoStorico[]} oggi={oggi} className="mt-3" />}
      </section>

      {/* ── Conto ─────────────────────────────────────────────────────────── */}
      <section id="conto" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Conto</p>
        {testa && conto
          ? <ContoScheda className="mt-3" testa={testa} righe={rigeConto} totale={euroScheda(conto.totaleCent)}
            accordo={comePagaTesto} pagamenti={rigePagamenti}
            onPagamento={() => setFoglioPagamento(true)} onComePaga={() => setFoglioComePaga(true)} />
          : <p className="mt-2" style={{ fontSize: 13, color: 'var(--color-stone)' }}>Non riesco a leggere il conto. Ricarica la scheda prima di toccare i pagamenti.</p>}
      </section>

      {/* ── Messaggi ──────────────────────────────────────────────────────── */}
      <section id="messaggi" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Messaggi</p>
        {waNumero
          ? <MessaggiScheda className="mt-3" business={business} onBusiness={setBusiness}
            onConfermaImmagine={() => setConfermaAperta(true)}
            href={hrefMessaggio} onMessaggio={apriMessaggio} />
          : <p className="mt-2 font-semibold" style={{ fontSize: 14, color: '#8C3B2E' }}>Senza numero di telefono non si può scrivere alla cliente.</p>}
      </section>

      {/* ── Cliente ───────────────────────────────────────────────────────── */}
      <section id="cliente" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Cliente</p>
        <ClienteScheda className="mt-3" voci={voci} soggiorni={soggiorni} totaleCent={totaleSoggiorniCent} conLei={conLei}
          onChiediProvenienza={booking.guest_id ? () => setFoglioProvenienza(true) : undefined}
          onModificaDati={() => setFoglioCliente(true)} onCambiaCliente={() => setFoglioCambiaCliente(true)} />
      </section>

      {/* ── Cronologia ────────────────────────────────────────────────────── */}
      <section className="pt-[34px]">
        <p className="ed-sezione">Cronologia</p>
        <CronologiaScheda className="mt-2" righe={storia} registrata={cronologiaAccesa} />
      </section>

      {/* I tre comandi in fondo, staccati da tutto il resto */}
      <p data-comandi-fondo className="flex flex-wrap items-center justify-center mt-8 mb-4" style={{ gap: '0 12px', fontSize: 14 }}>
        <Link href={hrefVecchia(booking.id)} className="py-2 -my-2" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }}>Vedi tutto</Link>
        <span style={{ color: 'var(--color-stone)' }}>·</span>
        <Link href={hrefVecchia(booking.id)} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>Altre modifiche</Link>
        <span style={{ color: 'var(--color-stone)' }}>·</span>
        <Link href={hrefVecchia(booking.id)} className="py-2 -my-2" style={{ fontSize: 14, color: '#8C3B2E' }}>Annulla prenotazione</Link>
      </p>

      {confermaAperta && (
        <ConfermaWhatsApp booking={{ ...booking, bonifico: accordo?.bonifico } as never} groupBookings={attive as never}
          payments={pagamenti as never} onClose={() => setConfermaAperta(false)} />
      )}

      {notteAperta && (
        <FoglioNotte notti={notti} iso={notteAperta} contesto={contesto}
          onFatto={salvaNotti} onChiudi={() => setNotteAperta(null)} />
      )}

      {foglioArrivo && primoSegmento && (
        <FoglioArrivo bookingId={primoSegmento.id} ora={primoSegmento.check_in_time} navetta={primoSegmento.shuttle}
          onChiudi={() => setFoglioArrivo(false)}
          onSalvato={(campi, msg) => {
            const aggiorna = (r: Prenotazione) => (r.id === primoSegmento.id ? { ...r, ...campi } : r)
            setRighe(rs => rs.map(aggiorna))
            setBooking(b => (b ? aggiorna(b) : b))
            setFoglioArrivo(false)
            if (msg) setAvviso(msg)
          }} />
      )}
      {foglioPagamento && (
        <FoglioPagamento booking={booking} righe={righe} pagamenti={pagamenti} oggi={oggi} bonifico={accordo?.bonifico}
          onChiudi={() => setFoglioPagamento(false)}
          onSalvato={(esito: PagamentoSalvato) => {
            // prima quello che si è appena salvato, poi la rilettura in silenzio
            // (cronologia, «Da controllare» e il bollino «pagato» dal server)
            const nuovi = esito.pagamenti as unknown as PagamentoStat[]
            setPagamenti(nuovi)
            if (esito.pagato) {
              setRighe(rs => rs.map(r => ({ ...r, pagato: true })))
              setBooking(b => (b ? { ...b, pagato: true } : b))
            }
            setFoglioPagamento(false)
            setAvviso(esito.avviso)
            setConferma(c => ({ n: (c?.n ?? 0) + 1, righe: confermaPagamento(esito.importo, esito.metodo, saldoMancanteCent(righePerSaldo(righe), nuovi)) }))
            rileggi()
          }} />
      )}
      {conferma && <ConfermaVolante key={conferma.n} righe={conferma.righe} onChiudi={() => setConferma(null)} />}
      {foglioCambiaCliente && (
        <FoglioCambiaCliente booking={booking as never} segmenti={attive.length} pagamenti={pagamenti.length}
          confermaInviata={messaggiInviati.some(m => m.message_type === 'conferma')} oggi={oggi}
          onChiudi={() => setFoglioCambiaCliente(false)}
          onCambiato={(cliente, msg) => {
            // cambia SOLO il riferimento al cliente, su tutte le righe; il nome
            // scritto sulla prenotazione si azzera (lib/cambiaCliente). Poi la
            // scheda rilegge in silenzio: soggiorni, documenti, cronologia.
            const aggiorna = (r: Prenotazione): Prenotazione => ({ ...r, guest_id: cliente.id, guest_name: null, guests: cliente })
            setBooking(b => (b ? aggiorna(b) : b))
            setRighe(rs => rs.map(aggiorna))
            setFoglioCambiaCliente(false)
            setAvviso(msg)
            rileggi()
          }} />
      )}
      {foglioCliente && booking.guest_id && (
        <FoglioCliente cliente={{ ...(guest ?? {}), id: booking.guest_id }}
          onChiudi={() => setFoglioCliente(false)}
          onSalvato={(campi, msg) => {
            // i dati sono della cliente: valgono su questa riga, sulle altre
            // camere e sugli altri soggiorni già letti, poi si rilegge in silenzio
            const aggiorna = <T extends { guests?: Prenotazione['guests'] }>(r: T): T => ({ ...r, guests: { ...(r.guests ?? {}), ...campi } })
            setBooking(b => (b ? aggiorna(b) : b))
            setRighe(rs => rs.map(aggiorna))
            setAltreCliente(as => as.map(a => aggiorna(a as unknown as { guests?: Prenotazione['guests'] }) as unknown as SoggiornoStorico))
            setFoglioCliente(false)
            if (msg) setAvviso(msg)
            rileggi()
          }} />
      )}
      {foglioComePaga && accordo && (
        <FoglioComePaga
          idRighe={righe.map(r => r.id)}
          idPrima={accordo.id}
          modo={comePagaSalvato(accordoSalvato?.accordo_pagamento, accordo.bonifico)}
          importo={accordoSalvato?.caparra_centesimi == null ? null : accordoSalvato.caparra_centesimi / 100}
          data={(accordoSalvato?.caparra_entro ?? '').slice(0, 10)}
          ora={(accordoSalvato?.caparra_entro ?? '').slice(11, 16)}
          totaleCent={conto?.totaleCent ?? null}
          onChiudi={() => setFoglioComePaga(false)}
          onSalvato={(campi, avviso) => {
            setRighe(rs => rs.map(r => ({
              ...r,
              accordo_pagamento: campi.accordo_pagamento,
              bonifico: campi.bonifico,
              ...(r.id === accordo.id
                ? { caparra_centesimi: campi.caparra_centesimi, caparra_entro: campi.caparra_entro }
                : { caparra_centesimi: null, caparra_entro: null }),
            } as Prenotazione)))
            setFoglioComePaga(false)
            if (avviso) setAvviso(avviso)
          }} />
      )}
      {foglioProvenienza && booking.guest_id && (
        <FoglioProvenienza guestId={booking.guest_id}
          iniziale={{ provenienza: normalizzaProvenienza(provenienzaDi(booking).provenienza), struttura: provenienzaDi(booking).struttura_nome ?? '' }}
          onChiudi={() => setFoglioProvenienza(false)}
          onSalvata={(campi: CampiProvenienza) => {
            setBooking(b => (b ? { ...b, guests: { ...(b.guests ?? {}), ...campi } } : b))
            setFoglioProvenienza(false)
          }} />
      )}
    </div>
  )
}
