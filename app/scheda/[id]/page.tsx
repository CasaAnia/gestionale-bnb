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
// Dalla striscia si cambiano camera, letto in più e ospiti notte per notte,
// e le date di ogni linea: «Modifica soggiorno» non c'è più. Dal 17/09/2026
// non c'è più nessun rimando alla scheda vecchia: sconto, tariffe, nota e
// colore, «con lei», «togli» pagamento e «Aggiungi camera» stanno qui.
//
// I testi dei messaggi NON sono qui: stanno in lib/messaggiPrenotazione, che
// li tiene identici a quelli della scheda attuale (test di confronto).
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
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
import { RigaArrivo, LinkSoggiorno } from '@/components/scheda/SoggiornoScheda'
import ArriviPrecedenti from '@/components/scheda/ArriviPrecedenti'
import FoglioArrivo from '@/components/scheda/FoglioArrivo'
import FoglioProvenienza from '@/components/scheda/FoglioProvenienza'
import FoglioComePaga from '@/components/scheda/FoglioComePaga'
import FoglioPagamento, { type PagamentoSalvato } from '@/components/scheda/FoglioPagamento'
import FoglioCliente from '@/components/scheda/FoglioCliente'
import FoglioCambiaCliente from '@/components/scheda/FoglioCambiaCliente'
import FoglioAnnulla from '@/components/scheda/FoglioAnnulla'
import FoglioSconto from '@/components/scheda/FoglioSconto'
import FoglioTogliPagamento from '@/components/scheda/FoglioTogliPagamento'
import FoglioNota from '@/components/scheda/FoglioNota'
import FoglioDate from '@/components/scheda/FoglioDate'
import FoglioCambioCamera from '@/components/scheda/FoglioCambioCamera'
import FoglioTogliCamera from '@/components/scheda/FoglioTogliCamera'
import FoglioPrezzoSoggiorno from '@/components/scheda/FoglioPrezzoSoggiorno'
import { SENZA_SCONTO, serveConfermaPrezzo, type PrezzoDeciso } from '@/lib/soggiornoSconto'
import { COMANDO_TOGLI_CAMERA, CAMERA_TOLTA, siPuoTogliere, schedaDopo } from '@/lib/togliCamera'
import { COMANDO_AGGIUNGI_CAMERA, ERRORE_SENZA_CAMERE, legameDaScrivere, hrefAggiungiCamera } from '@/lib/aggiungiCamera'
import { aggiornaInUnColpo } from '@/lib/righeDati'
import FoglioConLei from '@/components/scheda/FoglioConLei'
import { COMANDO_NOTA, NOTA_SALVATA } from '@/lib/notaScheda'
import { CON_LEI_SALVATO } from '@/lib/conLeiScheda'
import { SCONTO_SALVATO, SCONTO_TOLTO } from '@/lib/scontoScheda'
import { PAGAMENTO_TOLTO } from '@/lib/pagamentoFoglio'
import { PRENOTAZIONE_ANNULLATA } from '@/lib/annullamento'
import ConfermaVolante from '@/components/ConfermaVolante'
import { supabase } from '@/lib/supabase'
import { leggiPrenotazioneUnica, contoPrenotazione, accordoPrenotazione, chiavePrenotazione, ERRORE_CONTO_INCOMPLETO, type RigaPrenotazione } from '@/lib/prenotazioneUnica'
import {
  SEZIONI_SCHEDA, TUTTO_A_POSTO, statoScheda, primaRigaScheda, etichettaArrivoScheda, rigaGrandeScheda, statoConto, noteScheda,
  misuraCamere, MISURA_CAMERE, SEGNO_CAMBIO,
  arrivoScheda, daControllareScheda, segmentiAttivi, type SegmentoScheda,
  PRENOTAZIONE_SALVATA, PRENOTAZIONE_DA_RICHIESTA, FONDO_SALVATA, FONDO_ANNULLATA, TESTO_ANNULLATA,
} from '@/lib/schedaPrenotazione'
import { comePagaSalvato } from '@/lib/comePaga'
import { confermaPagamento, type ConfermaPagamento } from '@/lib/confermaPagamento'
import { righePerSaldo } from '@/lib/pagamentiDati'
import { saldoMancanteCent } from '@/lib/statistiche'
import { pianoNotti, stessaStriscia, ospitiDaQuiInPoi, type ContestoNotti, type NotteStriscia, type CameraStriscia, type TrattoPiano } from '@/lib/strisciaNotti'
import { ospitiPossibiliNotte } from '@/lib/nuovaPrenotazione'
import { capienzaCamera } from '@/lib/tariffe'
import { lineeDelSoggiorno, contestoLinea, contoDopoNotti, testoContoDopo, confermaNotti, conPrezzoConcordato, SPIEGAZIONE_PARALLELE, CAMERE_NON_LETTE, COMANDO_DATE, COMANDO_CAMBIO_CAMERA, type LineaSoggiorno } from '@/lib/lineeSoggiorno'
import { salvaNottiInUnColpo } from '@/lib/nottiScrittura'
import { nomeOspite } from '@/lib/guestName'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { provenienzaInParole, provenienzaDi, normalizzaProvenienza, type CampiProvenienza } from '@/lib/provenienza'
import { elencoSoggiorniPersona, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { numeroWhatsAppPrenotazione, waHrefTesto } from '@/lib/messaggiWhatsApp'
import { openWhatsApp, telefonoAGruppi } from '@/lib/whatsapp'
import buildWhatsappMsg, { perMessaggio, type TipoMessaggio } from '@/lib/messaggiPrenotazione'
import {
  testaConto, contoScheda, comePagaScheda, righePagamenti, vociCliente, personeConLei, righeStoria,
  type PagamentoScheda, type MessaggioInviato, notaCopertura } from '@/lib/schedaConto'
import { leggiCronologia } from '@/lib/cronologiaDati'
import type { EventoCronologia } from '@/lib/cronologia'
import { valutazioneDi as valutazioneCliente } from '@/lib/valutazione'
import { oggiARoma } from '@/lib/spese/adattatore'
import { spostaGiorni } from '@/lib/statistiche/periodo'
import type { PrenotazioneDC } from '@/lib/daControllare'
import type { PagamentoStat } from '@/lib/statistiche/tipi'
import type { SegmentoStorico } from '@/lib/storicoCliente'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
const VERDE_MESE = '#5B6559'
const ROSSO_CONTO = '#D40000'
const COLONNE_ALTRE = '*, rooms(name), guests(full_name, phone)'
// quante notti intorno al soggiorno si leggono le altre prenotazioni (per «Cambia date»)
const GIORNI_INTORNO = 31

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
// I cambi camera si leggono nei nomi («Lena ⇄ Amelia», regola fissa n. 8);
// il numero «⇄ 2» resta solo con due camere insieme che cambiano.
function RigaGrande({ ospiti, camere, cambi, insieme }: { ospiti: number; camere: string; cambi: number; insieme: boolean }) {
  const etichetta = { marginTop: 6, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase' as const, color: 'var(--color-stone)' }
  const misura = misuraCamere(camere)
  // allineate in basso: «ospiti» e «camera» sulla stessa riga anche coi nomi su due righe (Ania, 18/09/2026)
  return (
    <div data-riga-grande className="flex items-end justify-center" style={{ gap: 44 }}>
      <div className="text-center" data-ospiti-testa>
        <p className="leading-[1.15]" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 24, color: 'var(--color-green-dark)' }}>{ospiti}</p>
        <p style={etichetta}>ospiti</p>
      </div>
      <div className="text-center min-w-0" data-camera-scheda>
        <p className={misura === MISURA_CAMERE.normale ? 'leading-[1.15] truncate' : 'leading-[1.15] line-clamp-2'} data-misura-camere={misura}
          style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: misura, color: 'var(--color-green-dark)' }}>
          {camere}
          {insieme && cambi > 0 && <span data-cambi style={{ fontSize: 15, color: VERDE_MESE }}> {SEGNO_CAMBIO} {cambi}</span>}
        </p>
        <p style={etichetta}>camera</p>
      </div>
    </div>
  )
}

const SECONDI_SALVATA = 5

export default function SchedaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const parametri = useSearchParams()
  const oggi = oggiARoma()
  const [booking, setBooking] = useState<Prenotazione | null>(null)
  const [righe, setRighe] = useState<Prenotazione[]>([])
  const [pagamenti, setPagamenti] = useState<PagamentoStat[]>([])
  // Il conto si fa SOLO con tutte le camere e tutti i pagamenti letti: se una
  // delle due letture non riesce, niente conto e niente pagamenti da qui
  // (rilievo del 16/09/2026: prima si contava sulla sola riga aperta).
  const [contoLeggibile, setContoLeggibile] = useState(true)
  const [altreCliente, setAltreCliente] = useState<SoggiornoStorico[]>([])
  const [altreNotti, setAltreNotti] = useState<PrenotazioneDC[]>([])
  const [documenti, setDocumenti] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  // ?avviso= arriva dalla conferma di una richiesta (provenienza non copiata)
  const [avviso, setAvviso] = useState<string | null>(parametri.get('avviso'))
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
  const [foglioAnnulla, setFoglioAnnulla] = useState(false)
  const [foglioSconto, setFoglioSconto] = useState(false)
  // il pagamento da togliere: l'id della riga di payments
  const [pagamentoDaTogliere, setPagamentoDaTogliere] = useState<string | null>(null)
  const [foglioNota, setFoglioNota] = useState(false)
  // «Cambia date» di una linea: la chiave della linea aperta
  const [dateAperte, setDateAperte] = useState<string | null>(null)
  // «Cambio camera» di una linea: la chiave della linea aperta
  const [cambioAperto, setCambioAperto] = useState<string | null>(null)
  // «Togli camera» di una linea: la chiave della linea da togliere
  const [togliAperto, setTogliAperto] = useState<string | null>(null)
  // «Il soggiorno si allunga» (17/09/2026): la modifica in attesa che Ania
  // scelga come aggiornare il prezzo; il foglio di partenza resta sotto
  const [prezzoDaConfermare, setPrezzoDaConfermare] = useState<{ linea: LineaSoggiorno<Prenotazione>; nuove: NotteStriscia[]; tratti: TrattoPiano[] } | null>(null)
  const [aggiungendo, setAggiungendo] = useState(false)
  const [foglioConLei, setFoglioConLei] = useState(false)
  // appena annullata da qui: la pastiglia in mattone in cima, finché non si va via
  const [annullata, setAnnullata] = useState(false)
  // la conferma volante dopo un pagamento (Ania, 11/09/2026): due righe, pochi secondi
  const [conferma, setConferma] = useState<{ n: number; righe: ConfermaPagamento; durata?: number; conOk?: boolean } | null>(null)
  // arrivando dalla pagina di inserimento (?salvata=1) o dalla conferma di una
  // richiesta (?da=richiesta): la pastiglia verde che sparisce da sé
  const daRichiesta = parametri.get('da') === 'richiesta'
  const [salvata, setSalvata] = useState(parametri.get('salvata') === '1' || daRichiesta)
  // dalla scheda del cliente (?da=cliente&cliente=<id>): «Indietro» torna lì
  const daCliente = parametri.get('da') === 'cliente' ? parametri.get('cliente') : null
  const hrefIndietro = daCliente ? `/clienti/${daCliente}` : '/prenotazioni'
  const [arriviAperti, setArriviAperti] = useState(false)
  // la striscia delle notti: le camere di casa, la notte aperta e il salvataggio
  const [camere, setCamere] = useState<CameraStriscia[]>([])
  // la notte aperta nel foglietto: di quale linea (gruppo) e quale giorno
  const [notteAperta, setNotteAperta] = useState<{ linea: string; iso: string } | null>(null)
  const [salvandoNotti, setSalvandoNotti] = useState(false)
  // il doppio tocco: due tocchi nello stesso istante vedono ancora lo stato
  // vecchio, il ref no (prova del 17/09/2026: due chiamate alla funzione)
  const salvataggioNotti = useRef(false)
  const [versione, setVersione] = useState(0)
  // «Caricamento…» solo la prima volta che si apre QUESTA prenotazione: le
  // riletture dopo un salvataggio avvengono in silenzio, sotto la scheda
  const idCaricato = useRef<string | null>(null)
  const rileggi = () => setVersione(v => v + 1)
  // Una scrittura riuscita solo in parte, o senza risposta: quello che la
  // scheda mostra non vale più. Niente conto finché non ha riletto tutto.
  const invalida = (messaggio: string) => {
    setAvviso(messaggio)
    setContoLeggibile(false)
    setFoglioSconto(false); setFoglioNota(false); setFoglioConLei(false)
    rileggi()
  }
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
        // le altre prenotazioni nelle stesse notti e in quelle vicine (un mese
        // prima e dopo, 17/09/2026): servono a «Cambia date» per sapere se la
        // camera è libera anche fuori dalle notti di adesso; sovrapposizioni e
        // letti oltre il pool si contano comunque notte per notte
        supabase.from('bookings').select(COLONNE_ALTRE).neq('status', 'annullata').lt('check_in', spostaGiorni(partenza, GIORNI_INTORNO)).gt('check_out', spostaGiorni(arrivo, -GIORNI_INTORNO)),
        scheda.guest_id
          ? supabase.from('documenti_cliente').select('id', { count: 'exact', head: true }).eq('guest_id', scheda.guest_id)
          : Promise.resolve({ count: null, error: null }),
        // le camere di casa: servono alla striscia per sapere chi è libero
        supabase.from('rooms').select('*'),
      ])
      if (!vivo) return
      // Il conto si mostra SOLO quando camere e pagamenti sono stati riletti
      // tutti e due: dopo una scrittura incerta resta nascosto finché una
      // lettura completa non riesce (revisione del 17/09/2026).
      setContoLeggibile(!conto.errore && !pag.error)
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
  const grande = useMemo(() => rigaGrandeScheda(attive), [attive])
  // Il conto: contoPrenotazione di lib/prenotazioneUnica, come la scheda attuale
  const conto = useMemo(() => {
    if (!contoLeggibile) return null
    try { return contoPrenotazione(righe, pagamenti.map(p => ({ booking_id: p.booking_id, amount: p.amount }))) } catch { return null }
  }, [righe, pagamenti, contoLeggibile])
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
  // lo stato scritto solo se non è quello normale (Ania, 17/09/2026)
  const statoTesto = booking ? statoScheda(booking.status, ultimaPartenza, oggi) : ''
  const statoDaMostrare = statoTesto === 'Confermata' ? null : statoTesto

  // ── LE STRISCE DELLE NOTTI ───────────────────────────────────────────────
  // Una striscia per linea (lib/lineeSoggiorno): il cambio camera durante il
  // soggiorno sta in una linea sola, le camere in parallelo sono linee
  // diverse, ognuna con la sua striscia. Le regole (chi è libero, capienza,
  // i due letti di casa) stanno in lib/strisciaNotti e non si riscrivono qui.
  const linee = useMemo(() => lineeDelSoggiorno(attive), [attive])
  const contesto: ContestoNotti = useMemo(() => ({
    camere,
    altre: altreNotti as unknown as ContestoNotti['altre'],
    ospiti: Math.max(1, ...attive.map(s => Number(s.num_guests) || 1)),
  }), [camere, altreNotti, attive])
  const nonSiSposta = camere.length === 0
  // le notti dormite in casa: una notte con due camere in parallelo conta una volta
  const nottiDormite = useMemo(() => new Set(linee.flatMap(l => l.notti.filter(n => n.dentro).map(n => n.iso))).size, [linee])
  const lineaAperta = notteAperta ? (linee.find(l => l.chiave === notteAperta.linea) ?? null) : null
  const lineaDate = dateAperte ? (linee.find(l => l.chiave === dateAperte) ?? null) : null
  const lineaCambio = cambioAperto ? (linee.find(l => l.chiave === cambioAperto) ?? null) : null
  const lineaDaTogliere = togliAperto ? (linee.find(l => l.chiave === togliAperto) ?? null) : null
  // nel contesto di una linea le altre linee contano come altre prenotazioni
  const contestoAperto = lineaAperta ? contestoLinea(lineaAperta, linee, contesto) : contesto
  // l'effetto sul conto di una bozza di notti, prima di salvare: il piano
  // letto come lo leggerà la scheda, o il motivo per cui così non si salva.
  // Col prezzo finale concordato e notti o prezzo pieno che cambiano il conto
  // non si anticipa: lo decide il foglio «Il soggiorno si allunga» (17/09/2026),
  // e un totale concordato che non starebbe più sotto il prezzo pieno non è
  // un guaio, è proprio il caso in cui il foglio chiede come fare.
  const contoDellaBozza = (linea: LineaSoggiorno<Prenotazione>, bozza: NotteStriscia[]) => {
    const ctx = contestoLinea(linea, linee, contesto)
    const senza = pianoNotti(bozza, linea.segmenti, ctx, SENZA_SCONTO)
    if (senza.errore) return { testo: senza.errore, guaio: true }
    if (serveConfermaPrezzo(linea.segmenti, attive, senza)) return null
    const piano = pianoNotti(bozza, linea.segmenti, ctx)
    if (piano.errore) return { testo: piano.errore, guaio: true }
    const c = contoDopoNotti(piano, linea, attive)
    return c ? { testo: testoContoDopo(c), guaio: false } : null
  }
  // «Salva» / «Fatto» su un foglio del soggiorno: se la prenotazione ha un
  // prezzo finale concordato e la modifica cambia notti o prezzo pieno, prima
  // si apre il foglio del prezzo (il foglio di partenza resta sotto, con la
  // bozza); altrimenti si chiude e si salva subito come sempre.
  const chiediPrezzoOSalva = (linea: LineaSoggiorno<Prenotazione>, nuove: NotteStriscia[], chiudi: () => void) => {
    if (!booking || salvandoNotti) return
    if (stessaStriscia(linea.notti, nuove)) { chiudi(); return }
    const senza = pianoNotti(nuove, linea.segmenti, contestoLinea(linea, linee, contesto), SENZA_SCONTO)
    if (senza.errore) { chiudi(); setAvviso(senza.errore); return }
    if (serveConfermaPrezzo(linea.segmenti, attive, senza)) { setPrezzoDaConfermare({ linea, nuove, tratti: senza.tratti }); return }
    chiudi()
    void salvaNotti(linea, nuove)
  }
  const chiudiFogliSoggiorno = () => { setPrezzoDaConfermare(null); setNotteAperta(null); setDateAperte(null); setCambioAperto(null) }
  // «Aggiungi camera»: prima il legame fra le camere (prenotazione_id) se
  // manca, poi l'inserimento nuovo con la stessa cliente e le stesse date
  async function aggiungiCamera() {
    if (!booking || aggiungendo) return
    const legame = legameDaScrivere(righe, () => crypto.randomUUID())
    if (!legame) { setAvviso(ERRORE_SENZA_CAMERE); return }
    if (legame.ids.length > 0) {
      // su tutte le righe, annullate comprese, in una richiesta sola
      setAggiungendo(true)
      const esito = await aggiornaInUnColpo(legame.ids, { prenotazione_id: legame.prenotazioneId })
      setAggiungendo(false)
      if (esito.esito === 'errore') { if (esito.incerto) invalida(esito.messaggio); else setAvviso(esito.messaggio); return }
    }
    router.push(hrefAggiungiCamera({ guestId: booking.guest_id, prenotazioneId: legame.prenotazioneId, arrivo: primoArrivo, partenza: ultimaPartenza }))
  }
  // «da qui in poi»: le persone della notte aperta valgono anche per le notti dopo
  const conDaQui = (bozza: NotteStriscia[], daQui: boolean) => (daQui && notteAperta ? ospitiDaQuiInPoi(bozza, notteAperta.iso, contestoAperto) : bozza)

  // «Fatto» sul foglietto: si salva subito, poi la scheda si rilegge e il
  // conto si rifà da solo. Una riga che resta senza notti si ANNULLA, non si
  // cancella: l'incasso già registrato deve restare nel conto.
  // Si salva UNA linea per volta: il piano si fa sui suoi tratti soltanto,
  // le altre linee del soggiorno non si toccano (17/09/2026) — salvo la loro
  // quota di un nuovo totale deciso nel foglio del prezzo (`prezzo.altre`),
  // che viaggia nello stesso colpo: soggiorno e prezzo si salvano insieme.
  async function salvaNotti(linea: LineaSoggiorno<Prenotazione>, nuove: NotteStriscia[], prezzo?: PrezzoDeciso) {
    if (!booking || salvandoNotti || salvataggioNotti.current || stessaStriscia(linea.notti, nuove)) return
    const piano = pianoNotti(nuove, linea.segmenti, contestoLinea(linea, linee, contesto), prezzo?.scelta)
    if (piano.errore) { chiudiFogliSoggiorno(); setAvviso(piano.errore); return }
    salvataggioNotti.current = true
    setSalvandoNotti(true)
    setAvviso(null)
    // Tutti i tratti di una linea stanno nello stesso gruppo: se non c'è
    // ancora (una camera sola) se ne fa uno adesso, come fa la scheda attuale.
    const gruppo = linea.segmenti[0]?.group_id || crypto.randomUUID()
    const origine = linea.segmenti[0]
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
      (dati: Record<string, unknown>) => supabase.rpc('sposta_notti', dati), prezzo?.altre ?? [])
    salvataggioNotti.current = false
    setSalvandoNotti(false)
    chiudiFogliSoggiorno()
    if (esito.esito === 'errore') {
      // risposta persa: la transazione può essere passata, la scheda rilegge e intanto non si fida del conto
      if (esito.incerto) { invalida(esito.messaggio); return }
      setAvviso(esito.messaggio); setVersione(v => v + 1); return
    }
    // Se la riga aperta è stata annullata, la scheda passa alla prima rimasta
    // (di questa linea o delle altre)
    if (piano.annulla.includes(booking.id)) {
      const altreLinee = linee.filter(l => l.chiave !== linea.chiave).flatMap(l => l.segmenti.map(s => ({ id: s.id, check_in: s.check_in })))
      const rimaste = [...altreLinee, ...piano.aggiorna.map(a => ({ id: a.id, check_in: a.campi.check_in })), ...esito.create]
        .sort((x, z) => x.check_in.localeCompare(z.check_in))
      if (rimaste[0]) { router.replace(`/scheda/${rimaste[0].id}`); return }
    }
    // il pop-up grande (Ania, 17/09/2026): il conto com'è adesso e, con un
    // prezzo finale concordato e notti diverse, «rivedi lo sconto» — ma se il
    // prezzo è stato deciso nel foglio non c'è niente da rivedere
    const dopo = contoDopoNotti(piano, linea, attive)
    const esitoConferma = confermaNotti({
      totaleCent: prezzo ? prezzo.totaleCent : (dopo?.dopoCent ?? conto?.totaleCent ?? 0),
      nottiPrima: linea.notti.filter(n => n.dentro).length,
      nottiDopo: nuove.filter(n => n.dentro).length,
      concordato: !prezzo && conPrezzoConcordato(linea.segmenti),
    })
    // resta finché non si tocca «Ok, ho capito» (Ania, 17/09/2026)
    setConferma(c => ({ n: (c?.n ?? 0) + 1, righe: esitoConferma.righe, durata: esitoConferma.durata, conOk: true }))
    if (esitoConferma.avviso) setAvviso(esitoConferma.avviso)
    setVersione(v => v + 1)
  }

  // ── CONTO ────────────────────────────────────────────────────────────────
  const pagamentiScheda = pagamenti as unknown as PagamentoScheda[]
  const testa = conto ? testaConto(conto, pagamentiScheda, righe.some(r => r.pagato)) : null
  // il conto in righe (18/09/2026): il «da pagare» resta quello autorevole di contoPrenotazione
  const contoRighe = useMemo(() => (conto ? contoScheda(attive, conto.totaleCent) : null), [attive, conto])
  const rigePagamenti = useMemo(() => righePagamenti(pagamentiScheda), [pagamentiScheda])
  // fin dove arrivano i pagamenti, notte per notte (regola fissa n. 9, 20/09/2026)
  const copertura = useMemo(() => (conto && testa ? notaCopertura(righe, camere, conto.ricevutiCent, testa.saldato) : ''), [righe, camere, conto, testa])
  const accordoSalvato = (accordo as { accordo_pagamento?: string | null; caparra_centesimi?: number | null; caparra_entro?: string | null } | null)
  const comePagaTesto = comePagaScheda(accordoSalvato?.accordo_pagamento, accordo?.bonifico)

  // ── MESSAGGI ─────────────────────────────────────────────────────────────
  // Gli stessi testi della scheda attuale (lib/messaggiPrenotazione), con gli
  // stessi dati: la prenotazione, tutte le sue camere e i pagamenti.
  // La spunta «bonifico» vale «anticipo» solo se l'accordo lo dice (perMessaggio)
  const perIMessaggi = () => perMessaggio({ ...booking, accordo_pagamento: accordoSalvato?.accordo_pagamento ?? null, bonifico: accordo?.bonifico })
  const testoMessaggio = (tipo: TipoMessaggio) =>
    booking ? buildWhatsappMsg(perIMessaggi(), tipo, attive, pagamenti) : ''
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
  const storia = useMemo(
    () => righeStoria(eventi, messaggiInviati, booking?.created_at ?? null),
    [eventi, messaggiInviati, booking],
  )

  if (loading) return <div className="p-4"><BackBar href={hrefIndietro} /><div className="text-center py-10 text-stone">Caricamento…</div></div>
  if (!booking) return <div className="p-4"><BackBar href={hrefIndietro} /><div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore || 'Prenotazione non trovata.'}</div></div>

  return (
    /* Margini laterali 22 px, tutto centrato, come la proposta */
    <div className="py-4 px-[22px] md:max-w-[620px] md:mx-auto">
      <div className="-mx-[6px]"><BackBar href={hrefIndietro} /></div>

      {salvata && (
        <p data-salvata className="text-center uppercase" onClick={() => setSalvata(false)}
          style={{ marginBottom: 10, padding: '6px 12px', borderRadius: 999, background: FONDO_SALVATA, color: 'var(--color-green-mid)', fontSize: 11, letterSpacing: '1.5px', fontWeight: 700 }}>{daRichiesta ? PRENOTAZIONE_DA_RICHIESTA : PRENOTAZIONE_SALVATA}</p>
      )}
      {annullata && (
        <p data-annullata className="text-center uppercase"
          style={{ marginBottom: 10, padding: '6px 12px', borderRadius: 999, background: FONDO_ANNULLATA, color: TESTO_ANNULLATA, fontSize: 11, letterSpacing: '1.5px', fontWeight: 700 }}>✓ {PRENOTAZIONE_ANNULLATA}</p>
      )}

      {/* Lo stato, a destra, solo quando dice qualcosa: «Confermata» è la norma e
          non si scrive; il link di ritorno all'elenco non c'è più, torna indietro
          la freccia in cima (Ania, 17/09/2026). */}
      {statoDaMostrare && (
        <div data-riga-navigazione className="flex items-center justify-end gap-3">
          <span data-stato-scheda className="uppercase" style={{ fontSize: 11, letterSpacing: '1.5px', color: OTTONE }}>{statoDaMostrare}</span>
        </div>
      )}
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
          notti={nottiDormite}
          etichettaArrivo={etichettaArrivoScheda(primoSegmento?.check_in_time, primoSegmento?.shuttle)}
          etichettaPartenza="parte"
          personeNotti={[grande.ospiti]}
          rigaGrande={<RigaGrande ospiti={grande.ospiti} camere={grande.camere} cambi={grande.cambi} insieme={grande.insieme} />}
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

      {/* La sezione «Adesso» (conferma da mandare) non c'è più (Ania, 20/09/2026):
          conferma e dati bonifico stanno in «Messaggi». */}

      {/* ── Da controllare ────────────────────────────────────────────────── */}
      <section id="controllare" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Da controllare {controlli.length > 0 && <small>{controlli.length}</small>}</p>
        {controlli.length === 0
          ? <p data-tutto-a-posto className="mt-2 font-semibold" style={{ fontSize: 14, color: 'var(--color-green-mid)' }}>{TUTTO_A_POSTO}</p>
          : <div className="mt-2 flex flex-col gap-2">
            {controlli.map(v => <SchedinaControllo key={v.chiave} etichetta={v.etichetta} titolo={v.titolo} dettaglio={v.dettaglio} link={v.link} grande />)}
          </div>}
      </section>

      {/* ── Arrivo (Ania, 17/09/2026: prima del soggiorno) ─────────────────── */}
      <section id="arrivo" className="pt-[34px]">
        <p className="ed-sezione">Arrivo</p>
        {arrivoTesto && <RigaArrivo arrivo={arrivoTesto} etichetta={false} className="mt-3" />}
        <LinkSoggiorno
          onArrivo={() => setFoglioArrivo(true)}
          onArriviPrecedenti={() => setArriviAperti(a => !a)}
          arriviAperti={arriviAperti}
          className="mt-1"
        />
        {arriviAperti && <ArriviPrecedenti altre={altreCliente as unknown as SegmentoStorico[]} oggi={oggi} className="mt-3" />}
      </section>

      {/* ── Soggiorno ─────────────────────────────────────────────────────── */}
      <section id="soggiorno" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Soggiorno</p>
        {/* Le strisce: camera e letto in più di ogni notte, si cambiano di qui.
            Con più camere in parallelo, una striscia per linea col suo titolo. */}
        {linee.map((l, i) => (
          <div key={l.chiave} data-linea={l.chiave}>
            {linee.length > 1 && (
              <p data-linea-titolo className="text-center" style={{ marginTop: i === 0 ? 10 : 18, fontSize: 12.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>{l.titolo}</p>
            )}
            {/* sotto ogni notte le persone di quella notte (in mattone se diverse da quelle della linea) */}
            <StrisciaNottiCamere notti={l.notti} oggi={oggi} spiegazione={false}
              ospitiAttesi={Math.max(1, ...l.segmenti.map(s => Number(s.num_guests) || 1))}
              onNotte={nonSiSposta ? undefined : n => setNotteAperta({ linea: l.chiave, iso: n.iso })} className="mt-3" />
            {/* la riga dei comandi della linea (Ania, 17/09/2026): «Cambia date ·
                Cambio camera», e sull'ultima linea anche «Aggiungi camera» */}
            {!nonSiSposta && (
              <p data-comandi-linea className="flex flex-wrap items-center justify-center" style={{ marginTop: 10, gap: '0 12px', fontSize: 12.5 }}>
                <button type="button" data-cambia-date={l.chiave} onClick={() => setDateAperte(l.chiave)} className="ed-azione ed-azione-tenue">{COMANDO_DATE}</button>
                <span style={{ color: 'var(--color-stone)' }}>·</span>
                <button type="button" data-cambio-camera={l.chiave} onClick={() => setCambioAperto(l.chiave)} className="ed-azione ed-azione-tenue">{COMANDO_CAMBIO_CAMERA}</button>
                {i === linee.length - 1 && booking.status !== 'annullata' && <>
                  <span style={{ color: 'var(--color-stone)' }}>·</span>
                  <button type="button" data-aggiungi-camera onClick={aggiungiCamera} disabled={aggiungendo} className="ed-azione ed-azione-tenue">{COMANDO_AGGIUNGI_CAMERA}</button>
                </>}
                {siPuoTogliere(linee.length) && <>
                  <span style={{ color: 'var(--color-stone)' }}>·</span>
                  <button type="button" data-togli-camera={l.chiave} onClick={() => setTogliAperto(l.chiave)} className="ed-azione ed-azione-tenue" style={{ color: '#8C3B2E' }}>{COMANDO_TOGLI_CAMERA}</button>
                </>}
              </p>
            )}
          </div>
        ))}
        {linee.length > 1 && !nonSiSposta && (
          <p data-linee-parallele className="text-center" style={{ marginTop: 6, fontSize: 12, color: 'var(--color-stone)' }}>{SPIEGAZIONE_PARALLELE}</p>
        )}
        {nonSiSposta && linee.length > 0 && (
          <p data-striscia-ferma className="text-center" style={{ marginTop: 6, fontSize: 12, color: 'var(--color-stone)' }}>
            {CAMERE_NON_LETTE}
          </p>
        )}
        {/* niente righe dei tratti («Allegra · 29 → 30 · … · 85 €»): il conto,
            subito sotto, dice già le stesse cose (Ania, 17/09/2026) */}
      </section>

      {/* ── Conto ─────────────────────────────────────────────────────────── */}
      <section id="conto" className="pt-[34px] scroll-mt-28 lg:scroll-mt-16">
        <p className="ed-sezione">Conto</p>
        {testa && conto && contoRighe
          ? <ContoScheda className="mt-3" testa={testa} conto={contoRighe}
            accordo={comePagaTesto} pagamenti={rigePagamenti} copertura={copertura}
            onPagamento={() => setFoglioPagamento(true)} onComePaga={() => setFoglioComePaga(true)} onSconto={() => setFoglioSconto(true)}
            onTogliPagamento={id => setPagamentoDaTogliere(id)} />
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
          onModificaDati={() => setFoglioCliente(true)} onCambiaCliente={() => setFoglioCambiaCliente(true)} onConLei={() => setFoglioConLei(true)} />
      </section>

      {/* ── Cronologia ────────────────────────────────────────────────────── */}
      <section className="pt-[34px]">
        <p className="ed-sezione">Cronologia</p>
        <CronologiaScheda className="mt-2" righe={storia} registrata={cronologiaAccesa} />
      </section>

      {/* I tre comandi in fondo, staccati da tutto il resto */}
      <p data-comandi-fondo className="flex flex-wrap items-center justify-center mt-8 mb-4" style={{ gap: '0 12px', fontSize: 14 }}>
        <button type="button" data-nota-colore onClick={() => setFoglioNota(true)} className="ed-azione">{COMANDO_NOTA}</button>
        {booking.status !== 'annullata' && <>
          <span style={{ color: 'var(--color-stone)' }}>·</span>
          <button type="button" data-annulla-prenotazione onClick={() => setFoglioAnnulla(true)} className="ed-azione" style={{ color: '#8C3B2E' }}>Annulla prenotazione</button>
        </>}
      </p>

      {confermaAperta && (
        <ConfermaWhatsApp booking={perIMessaggi() as never} groupBookings={attive as never}
          payments={pagamenti as never} onClose={() => setConfermaAperta(false)} />
      )}

      {notteAperta && lineaAperta && (
        <FoglioNotte notti={lineaAperta.notti} iso={notteAperta.iso} contesto={contestoAperto}
          sottotitolo={linee.length > 1 ? lineaAperta.titolo : undefined}
          ospitiPossibili={cameraId => {
            // le persone di una notte, fra quelle che la camera tiene senza letto e con
            const camera = camere.find(c => c.id === cameraId) ?? null
            return ospitiPossibiliNotte(camera, capienzaCamera(camera))
          }}
          contoDopo={(bozza, daQui) => contoDellaBozza(lineaAperta, conDaQui(bozza, daQui))}
          onFatto={(nuove, daQui) => chiediPrezzoOSalva(lineaAperta, conDaQui(nuove, daQui), () => setNotteAperta(null))} onChiudi={() => setNotteAperta(null)} />
      )}

      {foglioArrivo && primoSegmento && (
        <FoglioArrivo bookingId={primoSegmento.id} ora={primoSegmento.check_in_time} navetta={primoSegmento.shuttle}
          onChiudi={() => setFoglioArrivo(false)}
          onSalvato={(campi, msg) => {
            const aggiorna = (r: Prenotazione) => (r.id === primoSegmento.id ? { ...r, ...campi } : r)
            setRighe(rs => rs.map(aggiorna))
            setBooking(b => (b ? aggiorna(b) : b))
            setFoglioArrivo(false)
            setAvviso(msg)
            rileggi()   // la cronologia (trigger 0042) e «Da controllare»
          }} />
      )}
      {foglioPagamento && conto && (
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
      {conferma && <ConfermaVolante key={conferma.n} righe={conferma.righe} durata={conferma.durata} conOk={conferma.conOk} onChiudi={() => setConferma(null)} />}
      {pagamentoDaTogliere && conto && (() => {
        const p = (pagamenti as unknown as PagamentoScheda[]).find(x => x.id === pagamentoDaTogliere)
        return p ? (
          <FoglioTogliPagamento pagamento={p} righe={righe} totaleCent={conto.totaleCent} ricevutiCent={conto.ricevutiCent}
            onChiudi={() => setPagamentoDaTogliere(null)}
            onTolto={esito => {
              // prima i pagamenti rimasti e il bollino, poi la rilettura in
              // silenzio (cronologia, «Da controllare», la testa)
              setPagamenti(esito.pagamenti as unknown as PagamentoStat[])
              if (!esito.pagato) {
                setRighe(rs => rs.map(r => ({ ...r, pagato: false })))
                setBooking(b => (b ? { ...b, pagato: false } : b))
              }
              setPagamentoDaTogliere(null)
              setAvviso(esito.avviso ?? PAGAMENTO_TOLTO)
              rileggi()
            }} />
        ) : null
      })()}
      {togliAperto && lineaDaTogliere && (
        <FoglioTogliCamera titolo={lineaDaTogliere.titolo} ids={lineaDaTogliere.segmenti.map(s => s.id)}
          onChiudi={() => setTogliAperto(null)} onIncerto={invalida}
          onTolta={(ids, campi) => {
            setTogliAperto(null)
            // se la riga aperta era fra quelle tolte, la scheda passa a un'altra camera
            const altre = linee.filter(l => l.chiave !== lineaDaTogliere.chiave).flatMap(l => l.segmenti.map(s => ({ id: s.id, check_in: s.check_in })))
            const dove = schedaDopo(booking.id, ids, altre)
            if (dove) { router.replace(`/scheda/${dove}`); return }
            const aggiorna = (r: Prenotazione): Prenotazione => (ids.includes(r.id) ? { ...r, ...campi } : r)
            setRighe(rs => rs.map(aggiorna))
            setAvviso(CAMERA_TOLTA)
            rileggi()
          }} />
      )}
      {cambioAperto && lineaCambio && (
        <FoglioCambioCamera notti={lineaCambio.notti} contesto={contestoLinea(lineaCambio, linee, contesto)}
          sottotitolo={linee.length > 1 ? lineaCambio.titolo : undefined}
          contoDopo={bozza => contoDellaBozza(lineaCambio, bozza)}
          onFatto={nuove => chiediPrezzoOSalva(lineaCambio, nuove, () => setCambioAperto(null))}
          onChiudi={() => setCambioAperto(null)} />
      )}
      {dateAperte && lineaDate && (
        <FoglioDate notti={lineaDate.notti} contesto={contestoLinea(lineaDate, linee, contesto)}
          sottotitolo={linee.length > 1 ? lineaDate.titolo : undefined}
          contoDopo={bozza => contoDellaBozza(lineaDate, bozza)}
          onFatto={nuove => chiediPrezzoOSalva(lineaDate, nuove, () => setDateAperte(null))}
          onChiudi={() => setDateAperte(null)} />
      )}
      {/* sopra il foglio di partenza, che resta sotto con la bozza: niente si
          scrive finché non si tocca «Conferma soggiorno» (17/09/2026) */}
      {prezzoDaConfermare && conto && (
        <FoglioPrezzoSoggiorno segmenti={prezzoDaConfermare.linea.segmenti} tutti={righe} tratti={prezzoDaConfermare.tratti}
          ricevutiCent={conto.ricevutiCent} salvando={salvandoNotti}
          onTorna={() => setPrezzoDaConfermare(null)}
          onConferma={prezzo => { void salvaNotti(prezzoDaConfermare.linea, prezzoDaConfermare.nuove, prezzo) }} />
      )}
      {foglioNota && (
        <FoglioNota booking={booking} righe={righe}
          onChiudi={() => setFoglioNota(false)} onIncerto={invalida}
          onSalvato={(campi, ids, cambiato) => {
            setFoglioNota(false)
            if (!cambiato) return
            const aggiorna = (r: Prenotazione): Prenotazione => (ids.includes(r.id) ? { ...r, ...campi } : r)
            setRighe(rs => rs.map(aggiorna))
            setBooking(b => (b ? aggiorna(b) : b))
            setAvviso(NOTA_SALVATA)
            rileggi()
          }} />
      )}
      {foglioConLei && (
        <FoglioConLei booking={booking} righe={righe}
          onChiudi={() => setFoglioConLei(false)} onIncerto={invalida}
          onSalvato={(campi, ids, msg, cambiato) => {
            setFoglioConLei(false)
            if (!cambiato) return
            const aggiorna = (r: Prenotazione): Prenotazione => (ids.includes(r.id) ? { ...r, ...campi } : r)
            setRighe(rs => rs.map(aggiorna))
            setBooking(b => (b ? aggiorna(b) : b))
            setAvviso(msg ?? CON_LEI_SALVATO)
            rileggi()
          }} />
      )}
      {foglioSconto && conto && (
        <FoglioSconto righe={righe} ricevutiCent={conto.ricevutiCent}
          onChiudi={() => setFoglioSconto(false)} onIncerto={invalida}
          onSalvato={(anteprima, cambiato) => {
            // prima i campi appena scritti su ogni camera attiva, poi la
            // rilettura in silenzio (cronologia, «Da controllare»)
            setFoglioSconto(false)
            if (!cambiato) return
            const per = new Map(anteprima.righe.map(r => [r.id, r.campi]))
            const aggiorna = (r: Prenotazione): Prenotazione => (per.has(r.id) ? { ...r, ...per.get(r.id) } : r)
            setRighe(rs => rs.map(aggiorna))
            setBooking(b => (b ? aggiorna(b) : b))
            setAvviso(anteprima.righe.some(r => r.campi.discount_type) ? SCONTO_SALVATO : SCONTO_TOLTO)
            rileggi()
          }} />
      )}
      {foglioAnnulla && (
        <FoglioAnnulla booking={booking} attive={attive.length} nomeCliente={nomeOspite(booking)}
          cliente={guest && booking.guest_id ? { ...guest, id: booking.guest_id } : null} arrivo={primoArrivo || null}
          onChiudi={() => setFoglioAnnulla(false)}
          onAnnullata={campi => {
            // tutte le righe attive diventano annullate; lo stato in alto lo
            // dice da sé, e la cronologia (trigger 0042) arriva con la rilettura
            const aggiorna = (r: Prenotazione): Prenotazione => (r.status === 'annullata' ? r : { ...r, ...campi })
            setBooking(b => (b ? aggiorna(b) : b))
            setRighe(rs => rs.map(aggiorna))
            setAnnullata(true)
            window.scrollTo({ top: 0 })
            rileggi()
          }}
          onProblematica={(campi, msg) => {
            setBooking(b => (b ? { ...b, guests: { ...(b.guests ?? {}), ...campi } } : b))
            setFoglioAnnulla(false)
            setAvviso(msg)
            rileggi()
          }} />
      )}
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
            setAvviso(msg)   // anche null: un avviso vecchio non resta appeso dopo un salvataggio riuscito
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
            setAvviso(avviso)
            rileggi()   // la cronologia e lo stato del conto dal server
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
