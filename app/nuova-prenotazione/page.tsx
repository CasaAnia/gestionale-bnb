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
import TestaNuova from '@/components/nuova/TestaNuova'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { oggiARoma } from '@/lib/spese/adattatore'
import { spostaGiorni } from '@/lib/statistiche/periodo'
import { dataDiOggi, AGGIUNGI_CAMERA, SENZA_TELEFONO, SENZA_NOME, parametriInserimento, spesoConcluso } from '@/lib/nuovaPrenotazione'
import RigaCliente, { RigaClienteMaison, NUOVO_CLIENTE, type ClienteRiga } from '@/components/nuova/RigaCliente'
import { filtraClienti } from '@/lib/cambiaCliente'
import { messaggioLetturaNonRiuscita } from '@/lib/prenotazioneScritture'
import NuovoCliente, { type DatiNuovoCliente } from '@/components/nuova/NuovoCliente'
import { leggiStrutture } from '@/lib/provenienzaDati'
import { creaClienteNuovo } from '@/lib/cambiaClienteDati'
import { moduloDaRicerca, campiNuovoCliente } from '@/lib/datiCliente'
import { numeroUsabile } from '@/lib/whatsapp'
import type { StrutturaNota } from '@/lib/provenienza'
import CameraSoggiorno from '@/components/nuova/CameraSoggiorno'
import ArrivoNavetta from '@/components/ArrivoNavetta'
import { ARRIVO_VUOTO, campiArrivo, controllaArrivo, type Arrivo } from '@/lib/arrivo'
import NotteScelta from '@/components/nuova/NotteScelta'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, TastinoTenue, stileCampo, VesteMaison } from '@/components/nuova/PezziNuova'
import {
  camereDelPeriodo, rigaCamereLibere, datiLinea, nottiDellaLinea, raggruppaPerCamera, periodiDaNottiTenendoVuote,
  periodiDellaLinea, soggiorniConclusi, conflittiConAltre, nottiNonSalvabili, NOTTE_NON_SALVABILE,
  RINUNCIABILI, SENZA_NON_SI_SALVA, COLONNE_ARRIVO_0058, mancaColonnaNecessaria, avvisoDegradazione, type RigaSoggiorno,
  ospitiPossibiliNotte, ospitiMassimi, ospitiScegliendoCamera, contoNuovaPrenotazione, scontoInParole,
  mancaAlConto, doveManca, tariffaDiListino, conLettoDiListino, prezzoLettoInParole,
  type ScontoNuova,
} from '@/lib/nuovaPrenotazione'
import {
  nottiDaPeriodi, motivoLettoObbligatorio, lettoDisponibileNotte,
  cambiaCamera as cambiaCameraNotte, cambiaLetto as cambiaLettoNotte, nonDormeQui,
  camereDellaNotte, ospitiDaNotte, titoloNotte, type CameraStriscia, type ContestoNotti, type NotteStriscia,
} from '@/lib/strisciaNotti'
import { conLettoAutomatico, type PeriodoComposto, type CameraComposta } from '@/lib/prenotazioneComposta'
import { capienzaCamera } from '@/lib/tariffe'
import type { PrenotazioneMinima } from '@/lib/disponibilita'
import type { PrenotazioneLetti } from '@/lib/lettiAggiuntivi'
import ComePaga from '@/components/ComePaga'
import ChiDormeInCamera from '@/components/nuova/ChiDormeInCamera'
import { COLONNA_NON_E_LEI, campiChiDorme, type PersonaConLei } from '@/lib/nuovaPrenotazione'
import { SALVATO, COSA_SALVATA, DURATA_SALVATO_MS, testoSalvato } from '@/lib/salvatoMaison'
import { campiComePaga, chiedeScadenza as chiedeScadenzaComePaga, type ComePaga as ComePagaModo } from '@/lib/comePaga'
import { pagamentoAbitualeDi, comePagaIniziale, daSalvareAllaPrima } from '@/lib/pagamentoAbituale'
import { salvaPagamentoAbitualeAllaPrima } from '@/lib/pagamentoAbitualeDati'
import ContoNuova, { TastoSalva } from '@/components/nuova/ContoNuova'
import { scontoPerRiga, totaliScontati, righeDaSalvare } from '@/lib/nuovaPrenotazione'
import { partenzaSpostandoArrivo } from '@/lib/lineeSoggiorno'
import { AVVISO_AGGIUNTA, CLIENTE_DIVERSO, LEGAME_NON_CONFERMATO, legameConfermato } from '@/lib/aggiungiCamera'
import { problemi } from '@/lib/prenotazioneComposta'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { lettiOccupatiPerNotte } from '@/lib/lettiAggiuntivi'
import { leggiOccupazioni, daQuandoLeggere, CAMPI_OCCUPAZIONE, NON_LETTE } from '@/lib/occupazioniDati'
import { messaggioSovrapposizione } from '@/lib/erroreSovrapposizione'

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
  // quanto ha speso in tutto, in centesimi (in mattone accanto ai soggiorni)
  const [speso, setSpeso] = useState<Record<string, number>>({})
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
  const [arrivo, setArrivo] = useState<Arrivo>(ARRIVO_VUOTO)
  const [comePaga, setComePaga] = useState<ComePagaModo>('da_vedere')
  // la camera in più di una prenotazione che c'è già (?prenotazione=…): la
  // riga nuova entra nello stesso legame; come paga e caparra non si toccano
  const [aggiungoA, setAggiungoA] = useState<{ prenotazione: string; guestId: string | null } | null>(null)
  const [caparra, setCaparra] = useState<number | null>(null)
  const [caparraData, setCaparraData] = useState('')
  const [caparraOra, setCaparraOra] = useState('')
  const [persone, setPersone] = useState<PersonaConLei[]>([])
  // «Non è lei a dormire qui» (punto 12c); la spunta si mostra solo se il
  // database ha la colonna (proposta 0061): si guarda una volta, all'apertura
  const [nonELei, setNonELei] = useState(false)
  const [colonnaNonELei, setColonnaNonELei] = useState(false)
  // la conferma «B» dopo un salvataggio riuscito
  const [conferma, setConferma] = useState<{ cosa: string; quando: Date } | null>(null)
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

  // Quante volte è già stata qui: si contano i SOGGIORNI, non le righe —
  // una visita con due cambi camera è una visita sola (15/09/2026) — e
  // quanto ha speso in tutto (28/09/2026). Se la lettura non riesce non si
  // scrive un numero sbagliato: si lascia stare.
  async function leggiStorico(ids: string[]) {
    if (ids.length === 0) return
    const { data: righe, error: erroreSoggiorni } = await supabase
      .from('bookings').select('id, guest_id, check_out, prenotazione_id, group_id, total_amount')
      .in('guest_id', ids).neq('status', 'annullata').limit(2000)
    if (erroreSoggiorni) { setSoggiorni({}); setSpeso({}); return }
    setSoggiorni(soggiorniConclusi((righe ?? []) as RigaSoggiorno[], oggi))
    setSpeso(spesoConcluso((righe ?? []) as RigaSoggiorno[], oggi))
  }

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
        if (data) { setCliente(data as ClienteRiga); setRicerca(''); setRisultati([]); void leggiStorico([String(data.id)]) }
      })
    }
  }

  useEffect(() => {
    let vivo = true
    void leggiStrutture().then(r => { if (!vivo) return; setStrutture(r.strutture); setStruttureOk(r.disponibile) })
    // la colonna della spunta «Non è lei a dormire qui» c'è? (proposta 0061)
    void supabase.from('bookings').select(COLONNA_NON_E_LEI).limit(1).then(({ error }) => { if (vivo) setColonnaNonELei(!error) })
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
    await leggiStorico(trovati.map(c => c.id))
  }

  // ── le camere della prenotazione ─────────────────────────────────────────
  const linee = useMemo(() => raggruppaPerCamera(periodi), [periodi])
  const trovaCamera = (id: string | null): CameraComposta | null => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null
  // Il letto in più a prezzo fisso (punto 12b, 28/09/2026): ogni tratto col
  // letto porta il listino di LETTO_AGGIUNTIVO_A_NOTTE per la sua camera e i
  // suoi ospiti, a notte. È quello che il conto mostra e che si salva.
  const periodiColLetto = useMemo(
    () => conLettoDiListino(periodi, trovaCamera),
    // trovaCamera dipende da `camere`
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [periodi, camere],
  )
  const conto = useMemo(
    () => contoNuovaPrenotazione(periodiColLetto, id => (camere.find(c => c.id === id) as CameraComposta | undefined) ?? null, sconto),
    [periodiColLetto, camere, sconto],
  )

  // Scelto il cliente si comincia subito dalla prima camera
  // «Paga di solito con» (ritocchi del 29/09/2026, D1): scelta la cliente, in
  // «Come paga» si accende la sua pastiglia (si cambia lo stesso); senza valore come prima
  const idCliente = cliente?.id ?? null
  useEffect(() => {
    const abituale = pagamentoAbitualeDi(cliente as { pagamento_abituale?: string | null } | null)
    if (abituale) setComePaga(prima => comePagaIniziale(abituale, prima))
  }, [idCliente]) // eslint-disable-line react-hooks/exhaustive-deps

  function scegliCliente(c: ClienteRiga) {
    setCliente(c)
    setRicerca('')
    setRisultati([])
    if (periodi.length === 0) aggiungiCamera()
  }

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
  function cambiaLinea(gruppo: string, pezzo: { arrivo?: string; partenza?: string; roomId?: string | null; ospiti?: number }) {
    setPeriodi(ps => {
      const linea = raggruppaPerCamera(ps).find(l => l.gruppo === gruppo)
      if (!linea) return ps
      const d = datiLinea(linea)
      const cambiaCamera = pezzo.roomId !== undefined && pezzo.roomId !== d.roomId
      const camera = trovaCamera(pezzo.roomId !== undefined ? pezzo.roomId : d.roomId)
      const arrivo = pezzo.arrivo ?? d.arrivo
      // cambiando l'ARRIVO la partenza si sposta con le stesse notti (Ania,
      // 29/09/2026); cambiando la partenza l'arrivo resta dov'è
      const partenza = pezzo.partenza ?? (pezzo.arrivo !== undefined ? partenzaSpostandoArrivo(d.arrivo, d.partenza, pezzo.arrivo) : d.partenza)
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
      // «libera» serve sempre: anche una notte nuova (date allungate) prende la
      // camera della notte accanto solo se è libera (regola fissa n. 5)
      const rifatti = periodiDellaLinea({ gruppo, arrivo, partenza }, linea.periodi, {
        libera,
        ...(pezzo.roomId !== undefined ? { cameraScelta: pezzo.roomId } : {}),
        ...(pezzo.ospiti !== undefined
          ? { ospiti: pezzo.ospiti }
          : cambiaCamera ? { ospiti: ospitiScegliendoCamera(d.ospiti, trovaCamera(d.roomId), camera) } : {}),
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

  // gli ospiti prenotati (tutte le camere): il massimo di «Chi dorme in camera»
  const ospitiPrenotati = linee.reduce((t, l) => t + datiLinea(l).ospiti, 0) || 1

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
    const guaioArrivo = controllaArrivo(arrivo)
    if (guaioArrivo) fuori.push(guaioArrivo)
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
      // Arrivo e navetta (21/09/2026): le colonne nuove PIÙ le due di
      // sempre, tenute vere. Se la 0058 non è ancora applicata il server
      // rifiuta la riga e `salvaPrenotazione` riprova senza le nuove.
      ...campiArrivo(arrivo),
      // chi dorme in camera e, se la colonna c'è, la spunta (punto 12c)
      ...campiChiDorme(persone, nonELei, colonnaNonELei),
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
      const togli = ['extra_bed_importo', 'extra_bed_criterio'].includes(colonna) ? ['extra_bed_importo', 'extra_bed_criterio']
        : COLONNE_ARRIVO_0058.includes(colonna) ? COLONNE_ARRIVO_0058
        : [colonna]
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
    // la prima prenotazione dice come paga di solito la cliente (D1): si scrive su
    // di lei solo se non ha ancora un valore; aggiungendo una camera il come paga non si tocca
    const abituale = aggiungoA ? null : daSalvareAllaPrima(cliente as { pagamento_abituale?: string | null }, comePaga)
    if (abituale && cliente.id) void salvaPagamentoAbitualeAllaPrima(String(cliente.id), abituale)
    // la conferma «B» sotto il tasto, poi la scheda si apre da sola
    setSalvata(String(prima.id))
    setConferma({ cosa: COSA_SALVATA.prenotazione((cliente.full_name ?? '').trim() || 'senza nome'), quando: new Date() })
    window.setTimeout(() => router.push(`/scheda/${prima.id}?salvata=1`), DURATA_SALVATO_MS)
  }

  return (
    <VesteMaison>
    <div className="maison np -mt-12 lg:mt-0" data-senza-sottolinea data-nuova-prenotazione>
      {/* La testata (veste «Maison», 28/09/2026): titolo, la data di oggi e il
          cliente scelto; a destra «‹ Indietro». Sul telefono la barra in
          alto non c'è: la testata è la pagina. */}
      <TestaNuova data={dataDiOggi(oggi)} sotto={cliente ? ((cliente.full_name ?? '').trim() || 'senza nome') : nuovo ? 'nuovo cliente' : null} riserva="/prenotazioni" />

      {!cliente && !nuovo && (
        <>
          <section data-cerca-cliente className="np-sec">
            <label className="np-srch">
              <span aria-hidden>⌕</span>
              <input type="search" enterKeyHint="search" value={ricerca} onChange={e => scriviRicerca(e.target.value)}
                placeholder="Cerca per nome o telefono…" aria-label="Cerca per nome o telefono" data-campo="ricerca" />
            </label>
            {erroreRicerca && <p className="np-hint m" data-errore-ricerca>{erroreRicerca}</p>}
            <p style={{ marginTop: 12 }}><button type="button" className="mz-lnk np-lnk" data-nuovo-cliente onClick={() => setNuovo(moduloDaRicerca(ricerca))}>{NUOVO_CLIENTE}</button></p>
          </section>
          {risultati.length > 0 && (
            <section data-trovati className="np-sec">
              <p className="mz-eyebrow" style={{ marginBottom: 4 }}>Trovati</p>
              {risultati.map(c => <RigaCliente key={c.id} cliente={c} soggiorni={soggiorni[c.id] ?? 0} spesoCent={speso[c.id] ?? null} onScegli={() => scegliCliente(c)} />)}
              <p style={{ marginTop: 14 }}><button type="button" className="mz-lnk np-lnk" data-nuovo-cliente onClick={() => setNuovo(moduloDaRicerca(ricerca))}>{NUOVO_CLIENTE}</button></p>
            </section>
          )}
        </>
      )}

      {!cliente && nuovo && (
        <>
          <NuovoCliente className="np-sec" dati={nuovo} onDati={setNuovo} strutture={strutture} struttureDisponibili={struttureOk}
            onAvanti={() => void creaCliente()} avantiSpento={salvandoCliente} />
          {/* gli avvisi del cliente nuovo, in mattone sotto «Avanti» */}
          {avviso && <div className="np-sec" style={{ paddingTop: 10 }}><p className="np-hint m" role="alert" data-avviso-cliente>{avviso}</p></div>}
        </>
      )}

      {cliente && (
        <>
          {/* Il cliente scelto resta in cima, con «cambia» a destra;
              aggiungendo una camera la cliente è quella della prenotazione */}
          <div className="np-sec">
            <RigaClienteMaison cliente={cliente} soggiorni={soggiorni[cliente.id] ?? 0} spesoCent={speso[cliente.id] ?? null} primo
              dati={{ 'data-cliente-scelto': '' }}
              destra={!aggiungoA ? <button type="button" data-cambia-cliente className="mz-lnk q np-lnk" onClick={() => { setCliente(null); setRicerca(''); setRisultati([]) }}>cambia</button> : null} />
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
              <CameraSoggiorno key={linea.gruppo}
                titolo={i === 0 ? 'Soggiorno' : `Camera ${i + 1}`}
                arrivo={d.arrivo} partenza={d.partenza}
                onArrivo={v => cambiaLinea(linea.gruppo, { arrivo: v })}
                onPartenza={v => cambiaLinea(linea.gruppo, { partenza: v })}
                notti={nottiDellaLinea(linea)}
                camere={scelte} roomId={d.roomId} onCamera={id => cambiaLinea(linea.gruppo, { roomId: id })}
                rigaLibere={rigaCamereLibere(scelte, d.arrivo, d.partenza)}
                ospiti={d.ospiti} onOspiti={n => cambiaLinea(linea.gruppo, { ospiti: n })} ospitiMax={ospitiMassimi(camera, scelte)}
                listino={tariffaDiListino(camera, d.ospiti)}
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
                      prezzoLetto={prezzoLettoInParole(cameraNotte, notte.dentro ? notte.persone : d.ospiti)}
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

          {/* «+ Aggiungi camera», centrato dopo l'ultima camera: apre la
              camera dopo con le sue date, ospiti e striscia (Ania, 14/09/2026) */}
          <div className="np-sec" style={{ paddingTop: 18 }}>
            <TastinoTenue testo={AGGIUNGI_CAMERA} onClick={aggiungiCamera} dati="aggiungi-camera" />
          </div>

          {/* Lo sconto, SUBITO PRIMA del conto (riferimento del 28/09/2026):
              è l'unico modo di cambiare il prezzo, la tariffa è il listino */}
          {periodi.length > 0 && (
            <div data-sconto className="np-sec">
              <Etichetta testo="Sconto" centrata primo />
              <FilaPastiglie centrata>
                {([['nessuno', 'Nessuno'], ['percentuale', 'Percentuale'], ['finale', 'Prezzo finale']] as const).map(([tipo, testo]) => (
                  <Pastiglia key={tipo} dati={`sconto-${tipo}`} acceso={sconto.tipo === tipo} onClick={() => setSconto({ tipo, valore: tipo === 'nessuno' ? null : sconto.valore })}>{testo}</Pastiglia>
                ))}
              </FilaPastiglie>
              {sconto.tipo !== 'nessuno' && (
                <div className="np-g2" style={{ alignItems: 'end', marginTop: 4 }}>
                  <RigaCampo etichetta={sconto.tipo === 'percentuale' ? 'Quanto per cento' : 'Quanto paga in tutto'}>
                    <input type="number" inputMode="decimal" data-campo="sconto" value={sconto.valore ?? ''}
                      onChange={e => setSconto(sc => ({ ...sc, valore: e.target.value === '' ? null : Number(e.target.value) }))} style={stileCampo} />
                  </RigaCampo>
                  <p data-sconto-conto className="np-hint o" style={{ paddingBottom: 6 }}>{scontoInParole(conto.totaleCent, sconto)}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Il conto, raggruppato per camera ────────────────────────
              Sta qui e non in fondo (Ania, 15/09/2026): mentre si scelgono
              camere, notti, letto e sconto i numeri sono già sotto gli occhi,
              senza scorrere. È uno solo: in fondo resta il tasto e basta. */}
          <ContoNuova conto={conto} manca={mancaAlConto(periodiColLetto, trovaCamera)} />

          {/* ── Come paga ─────────────────────────────────────────────────
              Aggiungendo una camera a una prenotazione che c'è già come paga
              e caparra restano quelli: al loro posto la frase di sempre. */}
          {aggiungoA
            ? <div className="np-sec"><p data-aggiungo-a className="np-aggiungo">{AVVISO_AGGIUNTA}</p></div>
            : <section data-come-paga-parte className="np-sec">
              <p className="mz-eyebrow">Come paga</p>
              <ComePaga modo={comePaga} onModo={setComePaga} totaleCent={conto.daPagareCent}
                importo={caparra} onImporto={setCaparra}
                data={caparraData} ora={caparraOra} onData={setCaparraData} onOra={setCaparraOra} />
            </section>}

          {/* ── Chi dorme in camera (era «Con lei», punto 12c) ─────────── */}
          <ChiDormeInCamera intestataria={{ nome: (cliente.full_name ?? '').trim() || 'senza nome', telefono: (cliente.phone ?? '').trim() }}
            persone={persone} onPersone={setPersone} nonELei={nonELei} onNonELei={setNonELei}
            spuntaDisponibile={colonnaNonELei} ospiti={ospitiPrenotati} />

          {/* ── La nota di questo soggiorno ─────────────────────────────── */}
          <section data-nota className="np-sec">
            <p className="mz-eyebrow">Nota di questo soggiorno</p>
            <RigaCampo etichetta="Nota">
              <textarea rows={2} data-campo="nota" value={nota} onChange={e => setNota(e.target.value)} style={{ ...stileCampo, resize: 'none' }} />
            </RigaCampo>
          </section>

          {/* ── Arrivo e navetta, per ultimo ──────────────────────────────
              Lo stesso modulo del foglio della scheda (components/
              ArrivoNavetta) nella veste «Maison»: dove arriva, a che ora LÌ,
              la stima facoltativa in struttura e la navetta con l'autista. */}
          <section data-arrivo className="np-sec">
            <p className="mz-eyebrow">Arrivo e navetta</p>
            <ArrivoNavetta arrivo={arrivo} onArrivo={setArrivo} />
          </section>

          {/* ── E in fondo si salva ─────────────────────────────────────── */}
          <div className="np-savebox" data-salva-in-fondo>
            {/* Finché non si sa chi occupa le camere, non si promette che siano
                libere: lo si dice, e il salvataggio rilegge comunque prima di
                scrivere (rilievo del 15/09/2026). */}
            {occupazioni.stato !== 'pronte' && (
              <p data-occupazioni-stato className="np-hint o" style={{ marginBottom: 12 }}>
                {occupazioni.stato === 'carico' ? 'Sto guardando quali camere sono libere…' : NON_LETTE}
              </p>
            )}
            <TastoSalva onSalva={() => void salva()} spento={salvando || salvata !== null} avviso={avvisoSalva && !guai.includes(avvisoSalva) ? avvisoSalva : null} />
            {/* gli avvisi che fermano il salvataggio, in mattone sotto il tasto */}
            {guai.length > 0 && (
              <div data-guai style={{ marginTop: 10 }}>
                {guai.map(g => <p key={g} className="np-hint m c" role="alert">{g}</p>)}
              </div>
            )}
            {/* la conferma «B»: spunta, «Salvato», cosa e l'ora; poi la scheda si apre da sola */}
            {conferma && (
              <div className="np-ok conferma-in" role="status" aria-live="polite" data-salvato-maison>
                <i aria-hidden>✓</i>{SALVATO}<small>{testoSalvato(conferma.cosa, conferma.quando)}</small>
              </div>
            )}
            {salvata && (
              <p style={{ marginTop: 12 }}>
                <button type="button" data-apri-salvata className="mz-cta np-cta" onClick={() => router.push(`/scheda/${salvata}?salvata=1`)}>Apri la prenotazione</button>
              </p>
            )}
          </div>
        </>
      )}

    </div>
    </VesteMaison>
  )
}
