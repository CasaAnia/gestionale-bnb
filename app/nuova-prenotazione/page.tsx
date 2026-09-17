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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BackBar from '@/components/BackBar'
import CampoRicerca from '@/components/CampoRicerca'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { oggiARoma } from '@/lib/spese/adattatore'
import { spostaGiorni } from '@/lib/statistiche/periodo'
import { dataDiOggi, rigaClienteTrovato, AGGIUNGI_CAMERA, SENZA_TELEFONO, SENZA_NOME, parametriInserimento } from '@/lib/nuovaPrenotazione'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import RigaCliente, { TastinoSage, NUOVO_CLIENTE, type ClienteRiga } from '@/components/nuova/RigaCliente'
import { filtraClienti } from '@/lib/cambiaCliente'
import { messaggioLetturaNonRiuscita } from '@/lib/prenotazioneScritture'
import NuovoCliente, { NUOVO_CLIENTE_VUOTO, type DatiNuovoCliente } from '@/components/nuova/NuovoCliente'
import { leggiStrutture } from '@/lib/provenienzaDati'
import { creaClienteNuovo } from '@/lib/cambiaClienteDati'
import { campiNuovoCliente } from '@/lib/datiCliente'
import { numeroUsabile } from '@/lib/whatsapp'
import AvvisoAzione from '@/components/AvvisoAzione'
import type { StrutturaNota } from '@/lib/provenienza'
import CameraSoggiorno from '@/components/nuova/CameraSoggiorno'
import NotteScelta from '@/components/nuova/NotteScelta'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, TastinoTenue, stileCampo, OTTONE as OTTONE_PEZZI } from '@/components/nuova/PezziNuova'
import {
  camereDelPeriodo, rigaCamereLibere, datiLinea, nottiDellaLinea, raggruppaPerCamera, periodiDaNottiTenendoVuote,
  periodiDellaLinea, soggiorniConclusi, conflittiConAltre, nottiNonSalvabili, NOTTE_NON_SALVABILE,
  RINUNCIABILI, SENZA_NON_SI_SALVA, mancaColonnaNecessaria, avvisoDegradazione, type RigaSoggiorno,
  ospitiPossibiliNotte, ospitiMassimi, ospitiScegliendoCamera, contoNuovaPrenotazione, scontoInParole, listinoLetto, CRITERI_LETTO, LETTO_COMPRESO_LISTINO,
  statoLettoNuova, mancaAlConto, doveManca,
  type ScontoNuova,
} from '@/lib/nuovaPrenotazione'
import {
  nottiDaPeriodi, prezzoLettoNotte, motivoLettoObbligatorio, lettoDisponibileNotte,
  cambiaCamera as cambiaCameraNotte, cambiaLetto as cambiaLettoNotte, nonDormeQui,
  camereDellaNotte, ospitiDaNotte, titoloNotte, type CameraStriscia, type ContestoNotti, type NotteStriscia,
} from '@/lib/strisciaNotti'
import { conLettoAutomatico, tariffaProposta, lettoProposto, type PeriodoComposto, type CameraComposta } from '@/lib/prenotazioneComposta'
import { capienzaCamera } from '@/lib/tariffe'
import type { PrenotazioneMinima } from '@/lib/disponibilita'
import type { PrenotazioneLetti } from '@/lib/lettiAggiuntivi'
import ComePaga from '@/components/ComePaga'
import ConLei from '@/components/nuova/ConLei'
import { oraDigitata } from '@/lib/ora'
import { PERSONE_CON_LEI_MAX, TROPPE_PERSONE, type PersonaConLei } from '@/lib/nuovaPrenotazione'
import { campiComePaga, chiedeScadenza as chiedeScadenzaComePaga, type ComePaga as ComePagaModo } from '@/lib/comePaga'
import ContoNuova, { TastoSalva } from '@/components/nuova/ContoNuova'
import { campiConLei, scontoPerRiga, totaliScontati, righeDaSalvare } from '@/lib/nuovaPrenotazione'
import { AVVISO_AGGIUNTA, CLIENTE_DIVERSO, LEGAME_NON_CONFERMATO, legameConfermato } from '@/lib/aggiungiCamera'
import { problemi } from '@/lib/prenotazioneComposta'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { lettiOccupatiPerNotte, lettiLiberi, lettiPoolPrenotazione } from '@/lib/lettiAggiuntivi'
import { leggiOccupazioni, daQuandoLeggere, CAMPI_OCCUPAZIONE, NON_LETTE } from '@/lib/occupazioniDati'
import { messaggioSovrapposizione } from '@/lib/erroreSovrapposizione'
import { oraCompleta } from '@/lib/ora'

const OTTONE = '#A9884E'
// I testi della pagina (TITOLO_PAGINA, AGGIUNGI_CAMERA, SENZA_TELEFONO,
// SENZA_NOME) stanno in lib/nuovaPrenotazione; la riga del cliente trovato e
// «+ Nuovo cliente» in components/nuova/RigaCliente. Una pagina di Next non
// può esportare altro che il componente (16/09/2026).

let contatore = 0
const nuovoId = () => `n${Date.now().toString(36)}${++contatore}`

/** Una pagina di occupazioni: la query sta qui, la logica in lib/occupazioniDati */
const paginaOccupazioni = (dal: string) => (da: number, a: number) =>
  supabase.from('bookings').select(CAMPI_OCCUPAZIONE)
    .neq('status', 'annullata').gte('check_out', dal).order('check_in').range(da, a)

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
  // Chi occupa camere e letti, con lo stato della lettura: «non letto» non
  // vuol dire «libero» (rilievo del 15/09/2026).
  const [altre, setAltre] = useState<(PrenotazioneMinima & PrenotazioneLetti)[]>([])
  const [occupazioni, setOccupazioni] = useState<{ stato: 'carico' | 'pronte' | 'errore'; dal: string }>({ stato: 'carico', dal: oggiARoma() })
  const [periodi, setPeriodi] = useState<PeriodoComposto[]>([])
  const [letto, setLetto] = useState<{ importo: number | null; criterio: 'notte' | 'ogni4' | 'totale' }>({ importo: null, criterio: 'notte' })
  const [sconto, setSconto] = useState<ScontoNuova>({ tipo: 'nessuno', valore: null })
  const [notteScelta, setNotteScelta] = useState<{ gruppo: string; iso: string } | null>(null)
  // «Solo questa notte / da qui in poi»: finché la domanda è a schermo si passa
  // dall'una all'altra, e vale sempre quella accesa. Per tornare indietro serve
  // com'erano le notti PRIMA del cambio (Ania, 15/09/2026).
  // La fotografia sta nello stato insieme alla domanda: un ref letto durante
  // il disegno della pagina è proprio quello che React sconsiglia, e il
  // controllo statico lo segnalava (rilievo 12 del 15/09/2026).
  const [domandaOspiti, setDomandaOspiti] = useState<{ iso: string; daQui: boolean; prima: NotteStriscia[] } | null>(null)
  function chiudiDomanda() { setDomandaOspiti(null) }
  // ── arrivo, come paga, con lei, nota ─────────────────────────────────────
  const [orario, setOrario] = useState('')
  const [navetta, setNavetta] = useState<'si' | 'no' | ''>('')
  const [comePaga, setComePaga] = useState<ComePagaModo>('da_vedere')
  // la camera in più di una prenotazione che c'è già (?prenotazione=…): la
  // riga nuova entra nello stesso legame; come paga e caparra non si toccano
  const [aggiungoA, setAggiungoA] = useState<{ prenotazione: string; guestId: string | null } | null>(null)
  const [caparra, setCaparra] = useState<number | null>(null)
  const [caparraData, setCaparraData] = useState('')
  const [caparraOra, setCaparraOra] = useState('')
  const [persone, setPersone] = useState<PersonaConLei[]>([])
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [guai, setGuai] = useState<string[]>([])
  const [avvisoSalva, setAvvisoSalva] = useState<string | null>(null)
  // salvata ma con qualcosa di meno: si resta qui e si apre col tuo tocco
  const [salvata, setSalvata] = useState<string | null>(null)
  // chi ci manda (calendario, «Scelgo io», scheda del cliente): si applica una volta, quando le camere sono lette
  const parametriApplicati = useRef(false)

  // Legge TUTTE le pagine e dice com'è andata; torna l'esito, così chi salva
  // può rileggere e fermarsi se la lettura non riesce.
  // Non scrive niente PRIMA di leggere: segnare «sto caricando» è compito di
  // chi la chiama da un tocco, così dentro l'effetto non parte un giro in più.
  const caricaOccupazioni = useCallback(async (dal: string) => {
    const esito = await leggiOccupazioni(paginaOccupazioni(dal), dal)
    if (esito.stato === 'errore') { setOccupazioni({ stato: 'errore', dal }); return esito }
    setAltre(esito.righe as (PrenotazioneMinima & PrenotazioneLetti)[])
    setOccupazioni({ stato: 'pronte', dal })
    return esito
  }, [])

  // I parametri dell'indirizzo, una volta sola, appena lette le camere: il
  // cliente (guest_id) si legge dall'archivio; camera e date (room_id,
  // check_in, check_out) aprono la prima camera già compilata. Si legge
  // window.location e non useSearchParams: la pagina è statica e non ha un
  // confine Suspense. Lo stato si scrive nella risposta della lettura, non
  // nel corpo di un effetto.
  function applicaParametri(lette: CameraStriscia[]) {
    if (parametriApplicati.current) return
    parametriApplicati.current = true
    const p = parametriInserimento(window.location.search)
    if (p.checkIn || p.roomId) {
      const gruppo = nuovoId()
      const arrivo = p.checkIn ?? oggi
      const partenza = p.checkOut ?? spostaGiorni(arrivo, 1)
      const camera = p.roomId && lette.some(c => c.id === p.roomId) ? p.roomId : null
      setPeriodi([{ id: nuovoId(), gruppo, roomId: camera, checkIn: arrivo, checkOut: partenza, ospiti: camera ? ospitiScegliendoCamera(1, null, lette.find(c => c.id === camera)) : 1, nottiLetto: [], letto: null, tariffa: null }])
    }
    if (p.prenotazione) setAggiungoA({ prenotazione: p.prenotazione, guestId: p.guestId })
    if (p.guestId) {
      void supabase.from('guests').select('*').eq('id', p.guestId).maybeSingle().then(({ data }) => {
        if (data) { setCliente(data as ClienteRiga); setRicerca(''); setRisultati([]) }
      })
    }
  }

  useEffect(() => {
    let vivo = true
    void leggiStrutture().then(r => { if (!vivo) return; setStrutture(r.strutture); setStruttureOk(r.disponibile) })
    void supabase.from('rooms').select('*').eq('active', true).then(({ data }) => {
      if (!vivo) return
      const lette = (data ?? []) as CameraStriscia[]
      setCamere(lette)
      applicaParametri(lette)
    })
    // come le due letture qui sopra: lo stato si scrive nella risposta, non
    // nel corpo dell'effetto
    void leggiOccupazioni(paginaOccupazioni(oggi), oggi).then(esito => {
      if (!vivo) return
      if (esito.stato === 'errore') { setOccupazioni({ stato: 'errore', dal: oggi }); return }
      setAltre(esito.righe as (PrenotazioneMinima & PrenotazioneLetti)[])
      setOccupazioni({ stato: 'pronte', dal: oggi })
    })
    return () => { vivo = false }
    // applicaParametri legge solo window.location e gli stati iniziali: si applica una volta
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oggi])


  // Il cliente nuovo si salva subito: da qui in poi è un cliente come gli altri
  async function creaCliente() {
    if (!nuovo || salvandoCliente) return
    if (!nuovo.nome.trim()) { setAvviso(SENZA_NOME); return }
    if (!numeroUsabile(nuovo.telefono)) { setAvviso(SENZA_TELEFONO); return }
    setSalvandoCliente(true)
    setAvviso(null)
    // gli stessi campi anche quando il cliente nuovo nasce dalla scheda
    // («Cambia cliente» → nuovo): stanno in lib/datiCliente
    const campi = campiNuovoCliente(nuovo, struttureOk)
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
    // Quante volte è già stata qui: si contano i SOGGIORNI, non le righe —
    // una visita con due cambi camera è una visita sola (15/09/2026). Se la
    // lettura non riesce non si scrive un numero sbagliato: si lascia stare.
    const ids = trovati.map(c => c.id)
    if (ids.length === 0) return
    const { data: righe, error: erroreSoggiorni } = await supabase
      .from('bookings').select('id, guest_id, check_out, prenotazione_id, group_id')
      .in('guest_id', ids).neq('status', 'annullata').limit(2000)
    if (erroreSoggiorni) { setSoggiorni({}); return }
    setSoggiorni(soggiorniConclusi((righe ?? []) as RigaSoggiorno[], oggi))
  }

  // ── le camere della prenotazione ─────────────────────────────────────────
  const linee = useMemo(() => raggruppaPerCamera(periodi), [periodi])
  const trovaCamera = (id: string | null): CameraComposta | null => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null
  // il letto scelto una volta sola vale per tutti i periodi
  // Il letto scelto una volta sola vale per tutti i periodi. Se l'importo non
  // è stato scritto a mano vale il LISTINO della camera, non zero: con 4
  // ospiti in Lena il letto costa 10 € e la notte va a 100 (Ania, 14/09/2026).
  const periodiColLetto = useMemo(
    () => periodi.map(p => ({
      ...p,
      letto: p.nottiLetto.length > 0
        ? { importo: letto.importo ?? lettoProposto(trovaCamera(p.roomId), p.ospiti), criterio: letto.criterio }
        : null,
    })),
    // trovaCamera dipende da `camere`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodi, letto, camere],
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
      const c = (camere.find(x => x.id === p.roomId) as CameraComposta | undefined) ?? null
      if (!c || p.nottiLetto.length === 0) continue
      viste.set(c.name, lettoProposto(c, p.ospiti))
    }
    return [...viste.entries()].map(([nome, importo]) => ({ nome, importo }))
  }, [periodi, camere])
  const prezzoLetto = letto.importo ?? (righeListino[0]?.importo ?? 0)

  // Il letto in più: si vede appena c'è una camera che lo prevede, e resta
  // spento con «non disponibile» quando i due letti di casa sono già impegnati.
  const lettiPresi = useMemo(
    () => lettiOccupatiPerNotte(altre.filter(a => a.status === 'confermata' || a.status === 'completata')),
    [altre],
  )
  const statoLetto = useMemo(
    () => statoLettoNuova(periodi, trovaCamera, (iso, roomId) => {
      const servono = Math.max(1, lettiPoolPrenotazione({ room_id: roomId, num_guests: periodi.find(p => p.roomId === roomId)?.ospiti ?? 1, extra_bed: true }))
      return lettiLiberi(lettiPresi, iso) >= servono
    }),
    // trovaCamera dipende da `camere`: cambiando le camere il conto si rifà
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodi, camere, lettiPresi],
  )

  function aggiungiCamera() {
    const gruppo = nuovoId()
    setPeriodi(ps => [...ps, {
      id: nuovoId(), gruppo, roomId: null,
      checkIn: ps[0]?.checkIn ?? oggi, checkOut: ps[0]?.checkOut ?? spostaGiorni(oggi, 1),
      ospiti: 1, nottiLetto: [], letto: null, tariffa: null,
    }])
  }

  // I campi di una linea. La camera NON si spalma sull'intero soggiorno alla
  // cieca: va nelle notti in cui è libera (regola di lib/disponibilita, chiesta
  // una notte alla volta), le altre restano senza camera e la striscia le
  // segna. Il cambio camera a mano si fa dalla striscia.
  function cambiaLinea(gruppo: string, pezzo: { arrivo?: string; partenza?: string; roomId?: string | null; ospiti?: number; tariffa?: number | null }) {
    setPeriodi(ps => {
      const linea = raggruppaPerCamera(ps).find(l => l.gruppo === gruppo)
      if (!linea) return ps
      const d = datiLinea(linea)
      const cambiaCamera = pezzo.roomId !== undefined && pezzo.roomId !== d.roomId
      const camera = trovaCamera(pezzo.roomId !== undefined ? pezzo.roomId : d.roomId)
      const arrivo = pezzo.arrivo ?? d.arrivo
      const partenza = pezzo.partenza ?? d.partenza
      // una prenotazione che comincia prima del giorno già letto deve vedere
      // chi c'era allora: si rilegge da lì (15/09/2026)
      if (arrivo && arrivo < occupazioni.dal) { setOccupazioni(o => ({ ...o, stato: 'carico' })); void caricaOccupazioni(arrivo) }
      const fuori = ps.filter(p => p.gruppo !== gruppo)
      // le altre camere di QUESTA compilazione occupano come le prenotazioni vere
      const occupate = [
        ...altre,
        ...fuori.filter(p => p.roomId).map(p => ({
          room_id: p.roomId!, check_in: p.checkIn, check_out: p.checkOut, status: 'confermata',
          num_guests: p.ospiti, extra_bed: p.nottiLetto.length > 0, extra_bed_dates: p.nottiLetto,
        })),
      ]
      const scelte = camereDelPeriodo(camere, occupate, arrivo, partenza)
      const libera = (iso: string, id: string) => scelte.find(s => s.camera.id === id)?.notti.includes(iso) ?? false
      // Si tocca SOLO quello che è stato toccato: la camera di una notte
      // sistemata a mano non si perde perché si cambiano gli ospiti o le date.
      const rifatti = periodiDellaLinea({ gruppo, arrivo, partenza }, linea.periodi, {
        ...(pezzo.roomId !== undefined ? { cameraScelta: pezzo.roomId, libera } : {}),
        ...(pezzo.ospiti !== undefined
          ? { ospiti: pezzo.ospiti }
          : cambiaCamera ? { ospiti: ospitiScegliendoCamera(d.ospiti, trovaCamera(d.roomId), camera) } : {}),
        ...(pezzo.tariffa !== undefined ? { tariffa: pezzo.tariffa, cameraDellaTariffa: d.roomId } : {}),
      }, nuovoId)
      return [...fuori, ...rifatti.map(p => conLettoAutomatico(p, trovaCamera(p.roomId)))]
        .sort((a, z) => a.checkIn.localeCompare(z.checkIn) || a.gruppo.localeCompare(z.gruppo))
    })
  }

  // La notte scelta: camera, ospiti, letto e «non dorme qui» si cambiano dalla
  // parte sotto la striscia, e valgono subito. Le regole restano quelle di
  // lib/strisciaNotti; qui si rifanno i periodi con le notti nuove.
  function cambiaNotte(gruppo: string, trasforma: (notti: NotteStriscia[]) => NotteStriscia[]) {
    setPeriodi(ps => {
      const linea = raggruppaPerCamera(ps).find(l => l.gruppo === gruppo)
      if (!linea) return ps
      const notti = trasforma(nottiDaPeriodi(linea.periodi, camere))
      const fuori = ps.filter(p => p.gruppo !== gruppo)
      return [...fuori, ...periodiDaNottiTenendoVuote(notti, linea, nuovoId)]
        .sort((a, z) => a.checkIn.localeCompare(z.checkIn) || a.gruppo.localeCompare(z.gruppo))
    })
  }
  function scegliCameraNotte(gruppo: string, iso: string, camera: CameraStriscia) {
    const ctx = contesto(gruppo)
    chiudiDomanda()
    cambiaNotte(gruppo, notti => cambiaCameraNotte(notti, iso, camera, ctx))
  }
  // Gli ospiti di una notte: si riparte SEMPRE da com'erano prima del primo
  // cambio, così «solo questa notte» rimette le notti dopo come stavano —
  // eccezioni messe a mano comprese — e si può passare avanti e indietro.
  function scegliOspitiNotte(gruppo: string, iso: string, quanti: number, daQui: boolean) {
    const linea = linee.find(l => l.gruppo === gruppo)
    if (!linea) return
    const ctx = contesto(gruppo)
    // si riparte SEMPRE da com'erano le notti prima del primo cambio
    const prima = domandaOspiti?.iso === iso ? domandaOspiti.prima : nottiDaPeriodi(linea.periodi, camere)
    const fatte = ospitiDaNotte(prima, iso, quanti, daQui, ctx)
    setDomandaOspiti({ iso, daQui, prima })
    cambiaNotte(gruppo, () => fatte)
  }
  function scegliLettoNotte(gruppo: string, iso: string, acceso: boolean) {
    const ctx = contesto(gruppo)
    chiudiDomanda()
    cambiaNotte(gruppo, notti => cambiaLettoNotte(notti, iso, acceso, ctx, { ospitiAParte: true }))
  }
  function togliNotte(gruppo: string, iso: string) {
    chiudiDomanda()
    cambiaNotte(gruppo, notti => nonDormeQui(notti, iso))
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
    // La camera in più di una prenotazione che c'è già: la cliente è quella,
    // e il legame si ricontrolla adesso (esiste, ha camere attive, è tutto
    // della stessa cliente), non ci si fida dell'indirizzo (17/09/2026).
    if (aggiungoA) {
      if (aggiungoA.guestId && cliente.id !== aggiungoA.guestId) { setGuai([CLIENTE_DIVERSO]); setAvvisoSalva(CLIENTE_DIVERSO); return }
      setSalvando(true)
      let legame: { data: { guest_id?: string | null; status?: string | null }[] | null; error: unknown }
      try { legame = await supabase.from('bookings').select('id, guest_id, status').eq('prenotazione_id', aggiungoA.prenotazione) } catch (err) { legame = { data: null, error: err } }
      setSalvando(false)
      if (legame.error || !legameConfermato(legame.data, cliente.id)) { setGuai([LEGAME_NON_CONFERMATO]); setAvvisoSalva(LEGAME_NON_CONFERMATO); return }
    }
    // Prima di scrivere si rilegge chi occupa: fra l'apertura della pagina e
    // adesso può essere arrivata un'altra prenotazione. Se la lettura non
    // riesce NON si salva: «non letto» non vuol dire «libero» (15/09/2026).
    setSalvando(true)
    setOccupazioni(o => ({ ...o, stato: 'carico' }))
    const lettura = await caricaOccupazioni(daQuandoLeggere(oggi, periodi.map(p => p.checkIn)))
    setSalvando(false)
    if (lettura.stato === 'errore') { setGuai([NON_LETTE]); setAvvisoSalva(NON_LETTE); return }
    const adesso = lettura.righe
    const trova = (id: string | null) => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null
    const lettiAdesso = lettiOccupatiPerNotte(adesso.filter((a: { status: string }) => a.status === 'confermata' || a.status === 'completata'))
    const fuori = problemi(periodiColLetto, trova, lettiAdesso)
    fuori.push(...conflittiConAltre(periodiColLetto, trova, adesso))
    // e le notti che il modello non saprebbe risalvare come sono a schermo
    for (const iso of nottiNonSalvabili(nottiDaPeriodi(periodiColLetto, camere), trova)) {
      const n = nottiDaPeriodi(periodiColLetto, camere).find(x => x.iso === iso)
      fuori.push(NOTTE_NON_SALVABILE(titoloNotte(iso), n?.camera ?? 'camera', n?.persone ?? 0))
    }
    if (orario && !oraCompleta(orario)) fuori.push('L’orario di arrivo è incompleto: scrivi per esempio 15:30.')
    if (chiedeScadenzaComePaga(comePaga) && Boolean(caparraData) !== Boolean(caparraOra)) fuori.push('Della caparra servono data e ora, oppure nessuna delle due.')
    if (comePaga === 'caparra' && (!caparra || caparra <= 0)) fuori.push('La caparra deve essere un importo positivo.')
    setGuai(fuori)
    // Il tasto non resta muto: dice il campo che manca e porta la pagina lì.
    const manca = doveManca(fuori)
    setAvvisoSalva(manca?.avviso ?? null)
    if (manca) {
      document.querySelector(manca.dove)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }

    setSalvando(true)
    const prenotazioneId = aggiungoA?.prenotazione ?? crypto.randomUUID()
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
    }
    const primo = [...periodiColLetto].sort((a, z) => a.checkIn.localeCompare(z.checkIn))[0]?.id
    // le righe di sempre, col letto ripartito fra i tratti come nel conto
    const base = righeDaSalvare(periodiColLetto, trova, p => gruppi.get(p.gruppo)!)
    // con uno sconto il totale di ogni riga si scrive già scontato, e lo
    // sconto si salva riga per riga (col prezzo finale: la quota di ogni riga)
    const totaliBase = base.map(r => Number(r.total_amount) || 0)
    const scontati = totaliScontati(totaliBase, sconto)
    const scontoRighe = scontoPerRiga(totaliBase, sconto)
    const righe = periodiColLetto.map((p, i) => ({
      ...base[i],
      total_amount: scontati[i],
      ...comuni,
      ...scontoRighe[i],
      prenotazione_id: prenotazioneId,
      // come paga e caparra sono della prenotazione: aggiungendo una camera restano quelli
      ...(aggiungoA ? {} : { accordo_pagamento: pagamento.accordo_pagamento }),
      ...(p.id === primo && !aggiungoA ? { caparra_centesimi: pagamento.caparra_centesimi, caparra_entro: pagamento.caparra_entro } : {}),
      // Importo e criterio vanno INSIEME o non vanno (vincolo 0048
      // bookings_extra_bed_accordo_coerente). Con l'importo non scritto a mano
      // qui finiva null accanto a «a notte» e il database rifiutava tutta la
      // prenotazione (trovato in produzione il 15/09/2026). Si scrive quello
      // che il conto ha davvero applicato: p.letto, listino compreso.
      ...(p.nottiLetto.length > 0 && p.letto
        ? { extra_bed_importo: p.letto.importo, extra_bed_criterio: p.letto.criterio }
        : {}),
    }))

    // Le colonne arrivate dopo possono mancare: si toglie SOLO quella e si
    // riprova, come fa l'inserimento di adesso.
    // Se una colonna non c'è ancora si toglie e si riprova, ma NON in
    // silenzio: quello che si perde per strada si dice, e le colonne che
    // tengono insieme la prenotazione non si possono perdere affatto
    // (rilievo del 15/09/2026).
    let tentativo: Record<string, unknown>[] = righe
    const persi: string[] = []
    let esito = await supabase.from('bookings').insert(tentativo).select('id, check_in')
    for (let giro = 0; giro < 6 && esito.error; giro++) {
      const colonna = colonnaMancante(esito.error)
      if (!colonna || !RINUNCIABILI.has(colonna)) break
      if (SENZA_NON_SI_SALVA.has(colonna)) break        // qui ci si ferma, non si degrada
      const togli = ['extra_bed_importo', 'extra_bed_criterio'].includes(colonna) ? ['extra_bed_importo', 'extra_bed_criterio'] : [colonna]
      if (togli.some(c => tentativo.some(r => r[c] != null))) persi.push(...togli)
      tentativo = tentativo.map(r => Object.fromEntries(Object.entries(r).filter(([k]) => !togli.includes(k))))
      esito = await supabase.from('bookings').insert(tentativo).select('id, check_in')
    }
    setSalvando(false)
    if (esito.error || !esito.data?.length) {
      const colonna = colonnaMancante(esito.error)
      const motivo = messaggioSovrapposizione(esito.error)
        ?? (colonna && SENZA_NON_SI_SALVA.has(colonna) ? mancaColonnaNecessaria(colonna) : null)
        ?? `La prenotazione non è stata salvata: ${esito.error?.message ?? 'errore sconosciuto'}`
      setGuai([motivo])
      setAvvisoSalva(motivo)
      return
    }
    const prima = [...esito.data].sort((a, z) => String(a.check_in).localeCompare(String(z.check_in)))[0]
    // salvata, ma con qualcosa di meno: NON si va via facendo finta di niente
    if (persi.length > 0) {
      const detto = avvisoDegradazione([...new Set(persi)])
      setGuai([detto])
      setAvvisoSalva(detto)
      setSalvata(String(prima.id))
      return
    }
    router.push(`/scheda/${prima.id}?salvata=1`)
  }

  return (
    <div className="py-4 px-[22px] md:max-w-[620px] md:mx-auto">
      <div className="-mx-[6px]"><BackBar href="/prenotazioni" /></div>

      {/* Il titolo non si scrive: lo dice già la barra in alto, e leggerlo due
          volte ruba una riga di schermo (Ania, 14/09/2026 — come nelle
          Richieste). Resta la data di oggi, che la barra non dice. */}
      <p data-oggi className="uppercase" style={{ fontSize: 10, letterSpacing: '1.5px', color: OTTONE, marginTop: 10 }}>{dataDiOggi(oggi)}</p>

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
            {/* aggiungendo una camera la cliente è quella della prenotazione: non si cambia da qui */}
            {!aggiungoA && (
              <button type="button" data-cambia-cliente onClick={() => { setCliente(null); setRicerca(''); setRisultati([]) }}
                className="py-2 -my-2 shrink-0" style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-green-mid)' }}>cambia</button>
            )}
          </div>

          {linee.map((linea, i) => {
            const d = datiLinea(linea)
            // anche le ALTRE camere di questa compilazione occupano: due volte
            // la stessa camera nelle stesse notti non si può
            const scelte = camereDelPeriodo(camere, contesto(linea.gruppo).altre, d.arrivo, d.partenza)
            const camera = trovaCamera(d.roomId)
            // Le notti rimaste senza camera la striscia le nomina da sé, una
            // volta sola: «lun 14 e mar 15 senza camera». Il perché non serve
            // scriverlo (Ania, 15/09/2026).
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
                ospiti={d.ospiti} onOspiti={n => cambiaLinea(linea.gruppo, { ospiti: n })} ospitiMax={ospitiMassimi(camera, scelte)}
                tariffa={d.tariffa} tariffaProposta={camera && linea.periodi[0] ? tariffaProposta(linea.periodi[0], camera) : null}
                onTariffa={v => cambiaLinea(linea.gruppo, { tariffa: v })}
                strisciaNotti={notti}
                onNotte={n => { chiudiDomanda(); setNotteScelta(s => (s && s.gruppo === linea.gruppo && s.iso === n.iso ? null : { gruppo: linea.gruppo, iso: n.iso })) }}
                notteScelta={notteScelta?.gruppo === linea.gruppo ? notteScelta.iso : null}
                sottoStriscia={(() => {
                  if (notteScelta?.gruppo !== linea.gruppo) return null
                  const notte = notti.find(n => n.iso === notteScelta.iso)
                  if (!notte) return null
                  const ctx = contesto(linea.gruppo)
                  const cameraNotte = trovaCamera(notte.cameraId)
                  const libereOra = new Set(camereDellaNotte(notte.iso, ctx).map(c => c.id))
                  // il numero di questa notte può salire fino a quello che la
                  // camera tiene; se però altre notti hanno già il letto, il
                  // loro numero comanda (è uno solo per tutta la camera)
                  const altreColLetto = linea.periodi.some(p => p.nottiLetto.some(g => g !== notte.iso))
                  return (
                    <NotteScelta key={notte.iso} notte={notte}
                      camere={camere.map(c => ({ camera: c, libera: libereOra.has(c.id) }))}
                      ospitiPossibili={ospitiPossibiliNotte(cameraNotte, altreColLetto ? d.ospiti : capienzaCamera(cameraNotte))}
                      lettoLibero={lettoDisponibileNotte(notte.iso, notte.cameraId, ctx)}
                      prezzoLetto={prezzoLettoNotte(cameraNotte as never, notte.dentro ? notte.persone : d.ospiti, { importo: letto.importo, criterio: letto.criterio })}
                      motivoLetto={notte.dentro ? motivoLettoObbligatorio(cameraNotte as never, notte.persone) : null}
                      domanda={domandaOspiti?.iso === notte.iso} daQui={Boolean(domandaOspiti?.daQui)}
                      onCamera={c => scegliCameraNotte(linea.gruppo, notte.iso, c)}
                      onOspiti={(quanti, daQui) => scegliOspitiNotte(linea.gruppo, notte.iso, quanti, daQui)}
                      onLetto={acceso => scegliLettoNotte(linea.gruppo, notte.iso, acceso)}
                      onNonDormeQui={() => togliNotte(linea.gruppo, notte.iso)} />
                  )
                })()}
              />
            )
          })}

          {/* Il letto e lo sconto valgono per tutta la prenotazione */}
          {statoLetto.possibile && (
            <div data-prezzo-letto style={{ marginTop: 4 }}>
              <Etichetta testo="Quanto costa il letto" centrata />
              {statoLetto.testo && <p data-letto-non-disponibile className="text-center" style={{ fontSize: 12, color: OTTONE_PEZZI, marginTop: -4, marginBottom: 10 }}>{statoLetto.testo}</p>}
              <FilaPastiglie centrata>
                {CRITERI_LETTO.map(c => (
                  <Pastiglia key={c.chiave} dati={`letto-${c.chiave}`} acceso={letto.criterio === c.chiave} onClick={() => setLetto(l => ({ ...l, criterio: c.chiave }))}>
                    {c.chiave === 'notte' ? (prezzoLetto > 0 ? `${prezzoLetto} € a notte` : 'a notte') : c.etichetta}
                  </Pastiglia>
                ))}
              </FilaPastiglie>
              <div className="flex items-end" style={{ gap: 12, marginTop: 10 }}>
                <RigaCampo etichetta="Quanto" className="flex-1 min-w-0">
                  {/* come la tariffa: il listino è già scritto, non in grigio */}
                  <input type="number" inputMode="decimal" data-campo="letto" value={letto.importo ?? (prezzoLetto > 0 ? prezzoLetto : '')}
                    placeholder={LETTO_COMPRESO_LISTINO}
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

          {/* Centrato dopo lo sconto: apre la seconda camera con le sue date,
              ospiti, tariffa e striscia (Ania, 14/09/2026). */}
          <div style={{ marginTop: 18, marginBottom: 4 }}>
            <TastinoTenue testo={AGGIUNGI_CAMERA} onClick={aggiungiCamera} dati="aggiungi-camera" />
          </div>

          {/* ── Il conto, subito sotto il soggiorno ─────────────────────
              Sta qui e non in fondo (Ania, 15/09/2026): mentre si scelgono
              camere, notti, letto e sconto i numeri sono già sotto gli occhi,
              senza scorrere. È uno solo: in fondo resta il tasto e basta. */}
          <ContoNuova className="mt-6" conto={conto} manca={mancaAlConto(periodiColLetto, trovaCamera)} />

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
          {aggiungoA
            ? <p data-aggiungo-a className="mt-6" style={{ fontSize: 12.5, color: OTTONE_PEZZI }}>{AVVISO_AGGIUNTA}</p>
            : <section data-come-paga-parte className="mt-6">
              <p className="ed-sezione">Come paga</p>
              <div className="mt-3">
                <ComePaga modo={comePaga} onModo={setComePaga} totaleCent={conto.daPagareCent}
                  importo={caparra} onImporto={setCaparra}
                  data={caparraData} ora={caparraOra} onData={setCaparraData} onOra={setCaparraOra} />
              </div>
            </section>}

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

          {/* ── E in fondo si salva ─────────────────────────────────────── */}
          {guai.length > 0 && (
            <div data-guai className="mt-6">
              {guai.map(g => <AvvisoAzione key={g} testo={g} className="mt-2" />)}
            </div>
          )}
          {/* Finché non si sa chi occupa le camere, non si promette che siano
              libere: lo si dice, e il salvataggio rilegge comunque prima di
              scrivere (rilievo del 15/09/2026). */}
          {occupazioni.stato !== 'pronte' && (
            <p data-occupazioni-stato className="text-center" style={{ fontSize: 12, color: OTTONE_PEZZI, marginTop: 10 }}>
              {occupazioni.stato === 'carico' ? 'Sto guardando quali camere sono libere…' : NON_LETTE}
            </p>
          )}
          <TastoSalva className="mt-6" onSalva={() => void salva()} spento={salvando || salvata !== null} avviso={avvisoSalva} />
          {salvata && (
            <p className="text-center" style={{ marginTop: 10 }}>
              <button type="button" data-apri-salvata onClick={() => router.push(`/scheda/${salvata}?salvata=1`)}
                style={{ minHeight: 44, padding: '0 18px', borderRadius: 999, background: 'var(--color-green-mid)', color: 'var(--color-cream)', fontSize: 13, fontWeight: 600 }}>
                Apri la prenotazione
              </button>
            </p>
          )}
        </>
      )}

    </div>
  )
}
