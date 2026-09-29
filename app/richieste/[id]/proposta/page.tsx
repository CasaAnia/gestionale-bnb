'use client'
// ============================================================================
// PROPOSTA A UNA RICHIESTA — veste nuova (11/09/2026, approvata da Ania su una
// bozza): testa con il cliente, fascia delle sezioni ferma in cima, quattro
// parti che scorrono (Da controllare · Camere da proporre · Come paga ·
// Il messaggio).
//
// Cosa NON è cambiato: i testi generati (lib/richiesteTesti, bloccati il
// 04/09), l'invio su WhatsApp, «Sì, inviata», il passaggio a «Proposta
// inviata», «Modifica la richiesta» e il database.
//
// Le camere si scelgono con una spunta: partono spuntate quelle proponibili
// (lib/richiesteCamere, stessa disponibilità di prima) e il messaggio elenca
// SOLO quelle spuntate. Quando nessuna camera è libera per tutte le notti
// resta la proposta automatica di sempre (cambio camera o parte delle notti),
// scritta in una schedina, con «Un'altra soluzione» al posto del vecchio
// bottone «Cambia».
// ============================================================================
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { IconeContatto } from '@/components/scheda/TestataMaison'
import LinguetteRichiesta, { useLinguettaRichiesta, linguettaDiPartenza, type LinguettaRichiesta } from '@/components/richieste/LinguetteRichiesta'
import { mostraAlternativaAmelia, dividiNotaOpzioni } from '@/lib/richiestaMaison'
import { LARGHEZZA_FOGLIETTO_MAC, iconeFoglietto } from '@/lib/calendarioFoglietto'
import { pezziRigaElenco, pezzoCliente } from '@/lib/rigaRichiesta'
import { periodoConMese, testoNotti } from '@/lib/schedaPrenotazione'
import { euroTondi } from '@/lib/euroTondi'
import TestoWhatsApp from '@/components/TestoWhatsApp'
import FinestraConferma from '@/components/richieste/FinestraConferma'
import type { RichiestaConProposta } from '@/lib/richiesteConferma'
import ImmagineSoggiorno, { IMG_W } from '@/components/ImmagineSoggiorno'
import { supabase } from '@/lib/supabase'
import { fetchRichiesta, fetchRichieste, rifiutaRichiesta, segnaPropostaInviata, colonne0025Presenti, colonne0029Presenti, colonne0031Presenti, AVVISO_0025, AVVISO_0029, AVVISO_0031, type CondizioniSalvate } from '@/lib/richiesteDati'
import RifiutaConMotivo from '@/components/richieste/RifiutaConMotivo'
import type { MotivoRifiuto } from '@/lib/motivoRifiuto'
import { ETICHETTA_CASO, proponiSoluzioni, alternativaAmelia, personePerNotte, prezziNottiCentesimi, type Soluzione, type PrenotazioneOccupante } from '@/lib/richiesteProposta'
import { camereDaProporre, camereProponibili, camereDaSpuntare, soluzioniSpuntate, spunteCorrenti, conSpuntaCambiata } from '@/lib/richiesteCamere'
import { vociStesseDate, voceClienteCheTorna } from '@/lib/richiesteDaControllare'
import { soggiorniDellaPersona, clienteDellaRichiesta, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { provenienzaInParole } from '@/lib/provenienza'
import { camereAmmesseNotte, cameraSuccessiva, composizioneDaSoluzione, soluzioneDaComposizione, prezziTariffaPerNotte, applicaATutteLeNotti, totaleCentesimi, type Composizione, type PrezziManuali } from '@/lib/richiesteComposizione'
import StrisciaNotti, { etichettaNotte } from '@/components/StrisciaNotti'
import { generaProposta, prezzo as fmtPrezzo, centesimi, centesimiTotale, formattaEuro, condizioneDaColonne, nottiScoperte, type Condizione } from '@/lib/richiesteTesti'
import { chiaveSoluzione, soluzioneScelta } from '@/lib/richiesteScelta'
import { custodisciPendente, eliminaPendente, leggiPendente, datiPerConferma, rigaConferma, improntaRichiesta, richiestaCambiata, testoRiscrittoAMano, type PropostaPendente } from '@/lib/richiestePendente'
import { CONDIZIONI_PAGAMENTO, ETICHETTA_CONDIZIONE, caparraDefault, type CondizionePagamento } from '@/lib/condizioniPrenotazione'
import { statoCondizioni } from '@/lib/condizioniProposta'
import { testoDaRigenerare } from '@/lib/testoArchiviato'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import { lettoDaComunicare } from '@/lib/tariffe'
import { openWhatsApp, normalizzaTelefono, telefonoPerEsteso } from '@/lib/whatsapp'
import { salvaImmagine, copiaImmagine, isMobile } from '@/lib/immaginePng'
import { useDesktop, useAdesso } from '@/lib/richiesteVista'
import { opzioniAttive, opzioniScadute, occupantiDaOpzioni, notaOpzioni, opzioniSovrapposte, oraRoma, type RichiestaOpzione } from '@/lib/opzioni'
import RigaScadenza from '@/components/richieste/RigaScadenza'
import { nottiDellaRichiesta } from '@/lib/nottiRichieste'
import { giorniTra } from '@/lib/richiesteCalendario'
import { periodoCompatto } from '@/lib/dateItaliane'
import {
  CANALE_LABEL, nomeCompleto, nottiRichiesta, formatIntervallo, oraArrivo, tempoTrascorso, riassuntoPerNotte, linkModificaRichiesta, eAperta, ritornoDallaRichiesta, type Richiesta,
} from '@/lib/richieste'
import type { Room } from '@/lib/types'

const OTTONE = '#A9884E'

const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// "Amelia 13–15 set → Allegra 15–16 set"
function riassuntoSegmenti(s: Soluzione): string {
  if (s.segmenti.length === 0) return 'nessuna camera'
  return s.segmenti.map(x => `${x.camera.name} ${formatIntervallo(x.arrivo, x.partenza)}`).join(' → ')
}

// «Ambra 29 ott → 30 ott, poi Allegra 30 ott → 31 ott». Se è sempre la stessa
// camera il nome non si ripete: «Amelia 31 ott → 1 nov e 2 nov → 3 nov».
function soluzioneInParole(s: Soluzione): string {
  const date = s.segmenti.map(x => periodoCompatto(x.arrivo, x.partenza))
  const unaSola = new Set(s.segmenti.map(x => x.camera.id)).size === 1
  if (unaSola && s.segmenti.length > 0) return `${s.segmenti[0].camera.name} ${date.join(' e ')}`
  return s.segmenti.map((x, i) => `${x.camera.name} ${date[i]}`).join(', poi ')
}

export default function PropostaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  // Da dove si è arrivati: la freccia «Indietro» ci riporta lì, senza chiedere
  // niente alla cronologia del browser. Senza `?da=` si torna alle Richieste.
  const indietro = ritornoDallaRichiesta(useSearchParams().get('da'))
  const desktop = useDesktop()
  const [richiesta, setRichiesta] = useState<Richiesta & { proposta_testo?: string | null; proposta_soluzione?: Soluzione | null; proposta_alternative?: Soluzione[] | null } & Partial<CondizioniSalvate> | null>(null)
  const [camere, setCamere] = useState<Room[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneOccupante[]>([])
  const [clienti, setClienti] = useState<Record<string, unknown>[]>([])
  const [aperte, setAperte] = useState<Richiesta[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [manca0025, setManca0025] = useState(false)
  const [manca0029, setManca0029] = useState(false)
  const [manca0031, setManca0031] = useState(false)
  const adesso = useAdesso()   // avanza ogni minuto: timer della proposta
  // Le linguette (novità 14d): dal telefono una parte alla volta, dal Mac la pagina unica
  const paginaUnica = useDesktop()
  const [linguetta, sceltaLinguetta] = useLinguettaRichiesta(linguettaDiPartenza(richiesta?.stato))
  // «L'hai inviata?»: il foglio si può abbassare senza rispondere (resta «Invio da confermare»)
  const [invioNascosto, setInvioNascosto] = useState(false)

  // Soluzione scelta e bozza (null = quella generata; stringa = modificata a mano).
  // La scelta vale SOLO quando nessuna camera è libera per tutto il periodo: lì
  // resta la proposta automatica di sempre, con «Un'altra soluzione».
  const [scelta, setScelta] = useState<string | null>(null)
  // Le camere spuntate: null = non le ha ancora toccate (tutte le proponibili)
  const [spunteManuali, setSpunteManuali] = useState<string[] | null>(null)
  // «Non ho posto» scelto a mano: Ania può inviare il messaggio «siamo al completo»
  // anche quando il calcolo ha trovato una disponibilità (decisione umana).
  const [forzaNessunaDisponibilita, setForzaNessunaDisponibilita] = useState(false)
  const [testoModificato, setTestoModificato] = useState<string | null>(null)
  const [modo, setModo] = useState<'testo' | 'immagine'>('testo')
  const [pannelloCambia, setPannelloCambia] = useState(false)
  // Opzione di 3 ore (06/09/2026): le altre richieste con proposta inviata tengono in opzione camere e notti
  const [altreProposte, setAltreProposte] = useState<RichiestaOpzione[]>([])
  // Azione rimandata finché Ania non conferma di voler perdere il testo modificato a mano
  const [azioneSospesa, setAzioneSospesa] = useState<(() => void) | null>(null)
  // Condizioni di pagamento: NESSUNA preselezione, le sceglie Ania ogni volta.
  const [condizioneTipo, setCondizioneTipo] = useState<CondizionePagamento | null>(null)
  const [caparraTesto, setCaparraTesto] = useState('')          // euro digitati ("70" · "72,50")
  const [condizioneTesto, setCondizioneTesto] = useState('')    // paragrafo della personalizzata
  const [ameliaAttiva, setAmeliaAttiva] = useState(false)       // interruttore, spento di default
  // «Compongo io, notte per notte»: camera per notte scelta a mano (null = notte scoperta)
  const [manuale, setManuale] = useState(false)
  const [composizione, setComposizione] = useState<Composizione>([])
  const [prezziManuali, setPrezziManuali] = useState<PrezziManuali>([])
  const [prezzoEditor, setPrezzoEditor] = useState<number | null>(null)   // indice della notte in modifica
  const [prezzoTesto, setPrezzoTesto] = useState('')
  // Proposta già inviata che si sta rifacendo: i quattro bottoni di «Come
  // paga» si toccano anche lì (Ania, 11/09/2026). Il messaggio archiviato
  // resta quello finché non si conferma un nuovo invio.
  const [ricomponi, setRicomponi] = useState(false)
  // Il messaggio è lungo: all'inizio se ne vedono le prime righe, con una
  // sfumatura, e si apre tutto con un tocco (Ania, 11/09/2026)
  const [messaggioAperto, setMessaggioAperto] = useState(false)
  // La richiesta è cambiata dopo l'invio ma il messaggio era riscritto a mano:
  // non si cancella, si avvisa e si lascia decidere ad Ania (11/09/2026)
  const [superataAMano, setSuperataAMano] = useState(false)
  const [daRifiutare, setDaRifiutare] = useState(false)
  const [confermando, setConfermando] = useState<{ aperte: Richiesta[] } | null>(null)
  const [occupato, setOccupato] = useState<'invio' | 'rifiuto' | 'immagine' | null>(null)
  // Dopo l'apertura di WhatsApp: barra «L'hai inviata?» finché Ania non risponde
  const [chiediConferma, setChiediConferma] = useState(false)
  const barraRef = useRef<HTMLDivElement>(null)
  // Sul telefono l'app può ricaricarsi al ritorno da WhatsApp: l'attesa della
  // risposta (e il testo inviato) restano nel browser finché Ania non risponde.
  const chiavePendente = `ca_proposta_pendente_${id}`
  const [pendente, setPendente] = useState<PropostaPendente | null>(null)
  const salvataggioInCorso = useRef(false)
  const [immagineFatta, setImmagineFatta] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)
  const [scala, setScala] = useState(0.3)
  const [imgH, setImgH] = useState(0)

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetchRichiesta(id),
      supabase.from('rooms').select('*').eq('active', true),
      supabase.from('bookings').select('*, rooms(name), guests(id, full_name, phone)').in('status', ['confermata', 'completata', 'annullata']),
      // Le altre richieste aperte: le «proposta inviata» tengono l'opzione di 3 ore,
      // tutte servono alla voce «Stesse date» di «Da controllare».
      supabase.from('richieste').select('*').in('stato', ['in_attesa', 'proposta_inviata']),
      supabase.from('guests').select('*'),
    ]).then(([ric, r, b, ap, g]) => {
      const errs: string[] = []
      if (ric.error) errs.push(ric.error)
      if (r.error) errs.push(`camere: ${r.error.message}`)
      if (b.error) errs.push(`prenotazioni: ${b.error.message}`)
      if (ap.error) errs.push(`altre richieste: ${ap.error.message}`)
      if (g.error) errs.push(`clienti: ${g.error.message}`)
      setRichiesta(ric.data as typeof richiesta)
      setManca0025(!!ric.data && !colonne0025Presenti(ric.data as unknown as Record<string, unknown>))
      setManca0029(!!ric.data && !colonne0029Presenti(ric.data as unknown as Record<string, unknown>))
      setManca0031(!!ric.data && !colonne0031Presenti(ric.data as unknown as Record<string, unknown>))
      setCamere((r.data || []) as Room[])
      setPrenotazioni((b.data || []) as PrenotazioneOccupante[])
      setAperte((ap.data || []) as Richiesta[])
      setAltreProposte(((ap.data || []) as unknown as RichiestaOpzione[]).filter(x => x.stato === 'proposta_inviata'))
      setClienti((g.data || []) as Record<string, unknown>[])
      setErrore(errs.length ? errs.join(' · ') : null)
      setLoading(false)
    })
  }, [id])

  // Solo le confermate/completate occupano: le annullate servono allo storico del cliente
  const occupanti = useMemo(() => prenotazioni.filter(p => p.status !== 'annullata'), [prenotazioni])
  // Opzioni delle ALTRE richieste: attive (meno di 3 ore) bloccano camere e notti come
  // fossero confermate; scadute solo segnalate. La richiesta stessa non si blocca da sola.
  const opzAttive = useMemo(() => opzioniAttive(altreProposte, adesso, id), [altreProposte, adesso, id])
  const opzScadute = useMemo(() => opzioniScadute(altreProposte, adesso, id), [altreProposte, adesso, id])
  const prenotazioniConOpzioni = useMemo(() => [...occupanti, ...occupantiDaOpzioni(opzAttive)], [occupanti, opzAttive])
  // Camere tenute in opzione da un'altra richiesta: nell'elenco si legge il
  // perché vero («in opzione fino alle 20:15 per Carmela»), non «occupata»
  const motivoOpzione = useMemo(() => {
    if (!richiesta) return new Map<string, string>()
    return new Map(opzioniSovrapposte(opzAttive, richiesta.arrivo, richiesta.partenza).map(o => [o.cameraId, `in opzione fino alle ${oraRoma(o.scadenza)} per ${o.ospite}`]))
  }, [richiesta, opzAttive])
  const notaOpz = useMemo(() => (richiesta ? notaOpzioni(richiesta, camere, occupanti, opzAttive, opzScadute) : null), [richiesta, camere, occupanti, opzAttive, opzScadute])
  // La ricerca può rifiutare dati incoerenti (persone per notte diverse dalle
  // notti): l'errore va a schermo, mai un ripiego silenzioso
  const { soluzioni, erroreRicerca } = useMemo(() => {
    if (!richiesta) return { soluzioni: [] as Soluzione[], erroreRicerca: null as string | null }
    try { return { soluzioni: proponiSoluzioni(richiesta, camere, prenotazioniConOpzioni), erroreRicerca: null } }
    catch (e) { return { soluzioni: [] as Soluzione[], erroreRicerca: String((e as Error).message ?? e) } }
  }, [richiesta, camere, prenotazioniConOpzioni])
  const inviata = richiesta?.stato === 'proposta_inviata'
  // «inviata e ferma»: si legge quel che è partito. Rifacendola si torna a comporre.
  const inviataBloccata = inviata && !ricomponi
  // Si può cambiare la proposta: non mentre si aspetta «L'hai inviata?» e non
  // su una proposta già partita, a meno che non la si stia rifacendo.
  const modificaConsentita = !chiediConferma && !inviataBloccata

  // ── Le camere con la spunta ───────────────────────────────────────────────
  const righeCamere = useMemo(() => {
    if (!richiesta || camere.length === 0) return []
    try { return camereDaProporre(richiesta, camere, prenotazioniConOpzioni, soluzioni) } catch { return [] }
  }, [richiesta, camere, prenotazioniConOpzioni, soluzioni])
  const proponibili = useMemo(() => camereProponibili(righeCamere), [righeCamere])
  // Quali partono spuntate: la camera chiesta dal cliente se si può proporre,
  // altrimenti tutte (lib/richiesteCamere). Poi decide Ania con le spunte.
  const diPartenza = useMemo(() => camereDaSpuntare(righeCamere, richiesta?.camera_id ?? null), [righeCamere, richiesta])
  // Una camera che nel frattempo non è più proponibile sparisce dalle spunte da sola
  const spuntate = useMemo(() => spunteCorrenti(proponibili, diPartenza, spunteManuali), [proponibili, spunteManuali, diPartenza])
  const scelteSpuntate = useMemo(() => soluzioniSpuntate(righeCamere, spuntate), [righeCamere, spuntate])
  const conCamereLibere = proponibili.length > 0

  // Già inviata: si rilegge quel che è partito (testo e soluzione archiviati)
  const { soluzione: soluzioneTrovata, trovata: sceltaValida } = soluzioneScelta(soluzioni, scelta)
  const indiceScelto = soluzioni.indexOf(soluzioneTrovata as Soluzione)
  const sceltaPersa = !inviata && !manuale && !conCamereLibere && scelta !== null && !sceltaValida && !chiediConferma
  // «Compongo io»: la soluzione nasce dalla composizione; un dato incoerente va a schermo
  const { soluzioneManuale, erroreComposizione } = useMemo(() => {
    if (!manuale || inviata || !richiesta) return { soluzioneManuale: null as Soluzione | null, erroreComposizione: null as string | null }
    try { return { soluzioneManuale: soluzioneDaComposizione(richiesta, camere, composizione, prezziManuali), erroreComposizione: null } }
    catch (e) { return { soluzioneManuale: null, erroreComposizione: String((e as Error).message ?? e) } }
  }, [manuale, inviata, richiesta, camere, composizione, prezziManuali])

  const soluzioneNessuna: Soluzione | null = richiesta ? {
    caso: 'completo',
    segmenti: [],
    nottiTotali: nottiRichiesta(richiesta),
    nottiCoperte: 0,
    nottiMancanti: nottiDellaRichiesta(richiesta),
    prezzoTotale: 0,
  } : null
  // La proposta automatica che resta quando nessuna camera copre tutte le notti
  const automatica: Soluzione | null = conCamereLibere ? null : soluzioneTrovata
  const soluzioneBase: Soluzione | null = chiediConferma ? pendente?.soluzione ?? null
    : inviataBloccata ? richiesta?.proposta_soluzione ?? null
      : manuale ? soluzioneManuale
        : conCamereLibere ? scelteSpuntate[0] ?? null
          : automatica
  const soluzione: Soluzione | null = !chiediConferma && !inviata && forzaNessunaDisponibilita ? soluzioneNessuna : soluzioneBase
  const completo = soluzione?.caso === 'completo'
  const totaleCent = soluzione ? centesimiTotale(soluzione) : 0
  // Alternativa ad Amelia: solo se le condizioni del blocco sono soddisfatte (calcolo puro)
  const amelia = useMemo(
    () => (richiesta && soluzione && !inviataBloccata ? alternativaAmelia(richiesta, soluzione, camere, prenotazioniConOpzioni) : null),
    [richiesta, soluzione, camere, prenotazioniConOpzioni, inviataBloccata],
  )
  const caparraCent = centesimi(caparraTesto.replace(',', '.'))
  // Condizione scelta e controllo: senza scelta (o con importo/testo mancante) niente invio
  const condizione: Condizione | null =
    condizioneTipo === 'arrivo' ? { tipo: 'arrivo' }
      : condizioneTipo === 'caparra' ? { tipo: 'caparra', caparraCentesimi: caparraCent }
        : condizioneTipo === 'completo' ? { tipo: 'completo' }
          : condizioneTipo === 'personalizzata' ? { tipo: 'personalizzata', testo: condizioneTesto }
            : null
  const SCEGLI_COME_PAGA = 'Scegli come paga'
  const problemaCamere: string | null = !inviataBloccata && !chiediConferma && conCamereLibere && !manuale && !forzaNessunaDisponibilita && spuntate.length === 0
    ? 'Scegli almeno una camera' : null
  const problemaCondizione: string | null = completo || problemaCamere ? null
    : condizioneTipo === null ? SCEGLI_COME_PAGA
      : condizioneTipo === 'caparra' && !(caparraCent > 0) ? "Scrivi l'importo della caparra"
        : condizioneTipo === 'caparra' && caparraCent > totaleCent ? 'La caparra supera il totale'
          : condizioneTipo === 'personalizzata' && condizioneTesto.trim() === '' ? 'Scrivi le condizioni di pagamento'
            : null
  // Il messaggio elenca SOLO le camere spuntate; con una sola camera torna il
  // testo della camera unica (lib/richiesteTesti non cambia).
  const alternative = useMemo(() => {
    if (chiediConferma) return pendente?.alternative ?? null
    if (inviataBloccata) return richiesta?.proposta_alternative ?? null
    if (manuale || forzaNessunaDisponibilita || !conCamereLibere) return null
    return scelteSpuntate.length > 1 ? scelteSpuntate : null
  }, [chiediConferma, pendente, inviataBloccata, richiesta, manuale, forzaNessunaDisponibilita, conCamereLibere, scelteSpuntate])
  const bozzaGenerata = richiesta && soluzione
    ? generaProposta({ richiesta, soluzione, condizione: problemaCondizione ? null : condizione, amelia: ameliaAttiva ? amelia : null, alternative })
    : ''
  // Proposta già inviata prima di un aggiornamento dei testi: se le parole
  // sono le stesse e cambia solo il grassetto, a schermo si legge la versione
  // nuova (lib/testoArchiviato). Nel database non si scrive niente.
  const testoArchiviatoAggiornato = useMemo(() => {
    if (!inviataBloccata || !richiesta?.proposta_testo || !richiesta.proposta_soluzione) return null
    if (richiesta.amelia_alternativa) return null
    try {
      const rifatto = generaProposta({
        richiesta, soluzione: richiesta.proposta_soluzione,
        condizione: condizioneDaColonne(richiesta),
        alternative: richiesta.proposta_alternative ?? null,
      })
      return testoDaRigenerare(richiesta.proposta_testo, rifatto) ? rifatto : null
    } catch { return null }
  }, [inviataBloccata, richiesta])
  const testoFinale = chiediConferma ? pendente?.testo ?? '' : inviataBloccata && richiesta?.proposta_testo ? (testoArchiviatoAggiornato ?? richiesta.proposta_testo) : (testoModificato ?? bozzaGenerata)
  const telefonoNorm = normalizzaTelefono(richiesta?.telefono)
  const telefono = telefonoNorm.numero
  const perConferma = datiPerConferma(pendente)
  const mancaMigrazione = manca0025 ? AVVISO_0025 : manca0029 ? AVVISO_0029 : manca0031 && (alternative?.length ?? 0) > 1 ? AVVISO_0031 : null
  const condizioniSalvate: CondizioniSalvate = inviataBloccata && richiesta ? {
    condizione_pagamento: richiesta.condizione_pagamento ?? null,
    caparra_centesimi: richiesta.caparra_centesimi ?? null,
    condizione_testo: richiesta.condizione_testo ?? null,
    amelia_alternativa: richiesta.amelia_alternativa ?? false,
  } : completo || !condizione
    ? { condizione_pagamento: null, caparra_centesimi: null, condizione_testo: null, amelia_alternativa: false }
    : {
      condizione_pagamento: condizione.tipo,
      caparra_centesimi: condizione.tipo === 'caparra' ? condizione.caparraCentesimi : null,
      condizione_testo: condizione.tipo === 'personalizzata' ? condizione.testo.trim() : null,
      amelia_alternativa: ameliaAttiva && amelia !== null,
    }
  const modoEffettivo = completo || soluzione === null ? 'testo' : modo
  // I quattro bottoni di «Come paga» ci sono sempre (Ania, 11/09/2026):
  // si scelgono anche mentre si aspetta la risposta a «L'hai inviata?».
  const condizioni = statoCondizioni({ completo, inviata: inviataBloccata })

  // ── Chi è il cliente ──────────────────────────────────────────────────────
  const guest = useMemo(() => {
    if (!richiesta) return null
    // Il riconoscimento è quello di sempre, scritto in un posto solo
    // (lib/clienteCheTorna): telefono a cifre, oppure nome e cognome.
    const trovato = clienteDellaRichiesta(
      { nome: richiesta.nome, cognome: richiesta.cognome, telefono: richiesta.telefono },
      clienti as { id?: string; full_name?: string | null; phone?: string | null }[],
    )
    return (trovato ?? null) as { id?: string; rating?: string | null; vuole_ricevuta?: boolean | null; motivo_problematico?: string | null; provenienza?: string | null; struttura_nome?: string | null; notes?: string | null } | null
  }, [richiesta, clienti])
  const soggiorni = useMemo(() => {
    if (!richiesta) return { volte: 0, ricaviCent: 0, ultimo: null }
    return soggiorniDellaPersona(
      { nome: richiesta.nome, cognome: richiesta.cognome, telefono: richiesta.telefono, guest_id: guest?.id ?? null },
      prenotazioni as unknown as SoggiornoStorico[], oggiIso(),
    )
  }, [richiesta, prenotazioni, guest])
  const hrefCliente = guest?.id ? `/clienti/${guest.id}` : null
  // Le note in rosso nella testa: prima quella salvata sulla scheda del
  // cliente, poi quella scritta nella richiesta. La parolina dice chi l'ha
  // scritta: dal sito la cliente, altrimenti l'ha messa Ania.
  const noteTesta = useMemo(() => {
    const out: { etichetta: string; testo: string }[] = []
    const delCliente = (guest?.notes ?? '').trim()
    if (delCliente) out.push({ etichetta: 'nota del cliente', testo: delCliente })
    const dellaRichiesta = (richiesta?.note ?? '').trim()
    if (dellaRichiesta) out.push({ etichetta: richiesta?.canale === 'web' ? 'scrive la cliente' : 'nota', testo: dellaRichiesta })
    return out
  }, [guest, richiesta])

  // ── Da controllare ────────────────────────────────────────────────────────
  const vociControllo = useMemo(() => {
    if (!richiesta) return []
    const altre = aperte.filter(a => eAperta(a) && a.id !== richiesta.id)
    return [...vociStesseDate(richiesta, altre), ...(voceClienteCheTorna(soggiorni, hrefCliente) ? [voceClienteCheTorna(soggiorni, hrefCliente)!] : [])]
  }, [richiesta, aperte, soggiorni, hrefCliente])

  // La textarea cresce col contenuto
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [testoFinale, modoEffettivo])

  // Altezza reale dell'immagine (per l'anteprima in scala)
  useEffect(() => {
    const el = imgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setImgH(el.offsetHeight))
    ro.observe(el)
    return () => ro.disconnect()
  }, [modoEffettivo, soluzione])

  // Segmenti per l'immagine, con le stesse righe di costo della conferma
  const immagine = useMemo(() => {
    if (!richiesta || !soluzione || soluzione.segmenti.length === 0) return null
    const seg = soluzione.segmenti.map(s => ({
      id: `${s.camera.id}-${s.arrivo}`,
      check_in: s.arrivo,
      check_out: s.partenza,
      price_per_night: s.prezzoNotte,
      extra_bed: s.lettoTotale > 0,
      extra_bed_total: s.lettoTotale,
      num_guests: richiesta.persone,
      rooms: s.camera,
      persone_notti: s.personeNotti && s.personeNotti.length === s.notti ? s.personeNotti : null,
      extra_bed_dates: s.lettoNotti ?? null,
      prezzi_notti: s.prezzo_manuale ? prezziNottiCentesimi(s).map(c => c / 100) : null,
    }))
    const { righe, totale } = righeCostiSegmenti(seg, seg.length > 1, n => formattaEuro(centesimi(n)))
    const lettoAggiuntivo = seg.length === 1 && lettoDaComunicare(seg[0])
    let personeNotti: { giorno: string; persone: number }[] = []
    try { personeNotti = nottiDellaRichiesta(richiesta).map((giorno, i) => ({ giorno, persone: personePerNotte(richiesta)[i] })) } catch { personeNotti = [] }
    return { seg, righe, totale, lettoAggiuntivo, nottiNonDisponibili: nottiScoperte(richiesta, soluzione), personeNotti }
  }, [richiesta, soluzione])

  // Le azioni che rigenerano la bozza chiedono conferma se il testo è stato modificato a mano
  function conConferma(azione: () => void) {
    if (chiediConferma) return
    if (testoModificato !== null && testoModificato !== bozzaGenerata) { setAzioneSospesa(() => azione); return }
    azione()
  }
  function azzeraCondizioni() {
    setCondizioneTipo(null); setCaparraTesto(''); setCondizioneTesto(''); setAmeliaAttiva(false)
  }
  // La spunta di una camera: il messaggio si rifà, le condizioni restano
  function cambiaSpunta(cameraId: string) {
    // Come per «Come paga»: toccare una camera mentre si aspetta la risposta a
    // «L'hai inviata?» vuol dire che la proposta va cambiata, quindi si torna a
    // comporre (come con «No»). Le spunte restano quelle che sono.
    if (inviataBloccata) {
      setRicomponi(true)
      setAvviso('Stai rifacendo la proposta. Quella già inviata resta com’è finché non confermi il nuovo invio.')
    } else if (chiediConferma) {
      if (!rispostaNo()) return
      setAvviso('Hai cambiato le camere: la proposta è tornata da comporre. Se il messaggio di prima era già partito, mandane uno nuovo.')
    }
    const applica = () => {
      setTestoModificato(null)
      setSpunteManuali(prima => conSpuntaCambiata(proponibili, spunteCorrenti(proponibili, diPartenza, prima), cameraId))
    }
    if (chiediConferma || inviataBloccata) { applica(); return }
    conConferma(applica)
  }
  function scegli(i: number) {
    conConferma(() => {
      // Nuova soluzione → si ricomincia dalle condizioni: mai una scelta trascinata da un'altra soluzione
      setScelta(chiaveSoluzione(soluzioni[i])); setTestoModificato(null); setPannelloCambia(false); setManuale(false); setPrezzoEditor(null)
      setForzaNessunaDisponibilita(false)
      azzeraCondizioni()
    })
  }
  // «Compongo io»: parte dalla soluzione mostrata; «Torna alla proposta automatica» la rimette
  function apriScelgoIo() {
    if (!richiesta) return
    conConferma(() => {
      setComposizione(composizioneDaSoluzione(richiesta, soluzioneBase))
      setPrezziManuali(nottiDellaRichiesta(richiesta).map(() => null))
      setManuale(true); setPrezzoEditor(null); setTestoModificato(null)
      setForzaNessunaDisponibilita(false)
      azzeraCondizioni()
    })
  }
  function tornaAutomatica() {
    conConferma(() => { setManuale(false); setForzaNessunaDisponibilita(false); setPrezzoEditor(null); setTestoModificato(null); azzeraCondizioni() })
  }
  function scegliNessunaDisponibilita() {
    conConferma(() => {
      setForzaNessunaDisponibilita(true)
      setScelta(null); setManuale(false); setPrezzoEditor(null); setTestoModificato(null)
      azzeraCondizioni(); setPannelloCambia(false)
    })
  }
  function tornaAlleDisponibilita() {
    conConferma(() => { setForzaNessunaDisponibilita(false); setTestoModificato(null); azzeraCondizioni() })
  }
  const nomeCamera = (x: string | null) => (x === null ? 'nessuna' : (camere.find(c => c.id === x)?.name ?? '?'))
  const prezziTariffa = useMemo(() => {
    if (!manuale || !richiesta || composizione.length === 0) return [] as (number | null)[]
    try { return prezziTariffaPerNotte(richiesta, camere, composizione) } catch { return [] as (number | null)[] }
  }, [manuale, richiesta, camere, composizione])
  const personeNottiRichiesta = useMemo(() => { try { return richiesta ? personePerNotte(richiesta) : [] } catch { return [] } }, [richiesta])
  function apriPrezzo(i: number) {
    if (composizione[i] === null) return
    const attuale = prezziManuali[i] ?? prezziTariffa[i]
    setPrezzoTesto(attuale == null ? '' : fmtPrezzo(attuale / 100))
    setPrezzoEditor(i)
  }
  const prezzoEditorCent = centesimi(prezzoTesto.replace(',', '.'))
  function applicaCondizione(tipo: CondizionePagamento) {
    setCondizioneTipo(tipo)
    // Caparra: precompilata col 50% del totale, ma modificabile
    if (tipo === 'caparra' && caparraTesto === '') setCaparraTesto(fmtPrezzo(caparraDefault(totaleCent) / 100))
  }
  function scegliCondizione(tipo: CondizionePagamento) {
    // Proposta già inviata: toccare una condizione vuol dire rifarla. Quella
    // partita resta archiviata finché non si conferma un nuovo invio.
    if (condizioni === 'solo_lettura') {
      setRicomponi(true)
      setTestoModificato(null)
      setAvviso('Stai rifacendo la proposta. Quella già inviata resta com’è finché non confermi il nuovo invio.')
      applicaCondizione(tipo)
      return
    }
    // Mentre si aspetta la risposta a «L'hai inviata?» cambiare come paga vuol
    // dire che la proposta va rifatta: si torna a comporre, come con «No», e
    // la bozza si riscrive con la condizione nuova. Lo diciamo a schermo,
    // perché il messaggio di prima può essere già partito.
    if (chiediConferma) {
      if (!rispostaNo()) return
      setTestoModificato(null)
      setAvviso('Hai cambiato come paga: la proposta è tornata da comporre. Se il messaggio di prima era già partito, mandane uno nuovo.')
      applicaCondizione(tipo)
      return
    }
    conConferma(() => applicaCondizione(tipo))
  }
  function cambiaAmelia(attiva: boolean) { conConferma(() => setAmeliaAttiva(attiva)) }

  // Apre WhatsApp e basta: lo stato NON cambia qui. Cambia solo con «Sì, inviata».
  function invia() {
    if (!richiesta || !soluzione || chiediConferma) return
    setErrore(null); setAvviso(null)
    if (mancaMigrazione) { setErrore(mancaMigrazione); return }
    if (!inviataBloccata && problemaCamere) { setErrore(problemaCamere); return }
    if (!inviataBloccata && problemaCondizione) { setErrore(problemaCondizione); return }
    if (!telefono) { setErrore('Nessun numero di telefono sulla richiesta: aggiungilo prima di inviare.'); return }
    // Nel browser resta TUTTO il messaggio partito: testo, condizioni, soluzione e alternative
    const p: PropostaPendente = { testo: testoFinale, condizioni: condizioniSalvate, soluzione, alternative, impronta: improntaRichiesta(richiesta) }
    try { custodisciPendente(window.localStorage, chiavePendente, p) }
    catch (e) { setErrore(`WhatsApp non aperto: non riesco a conservare la proposta. ${e instanceof Error ? e.message : 'Riprova.'}`); return }
    setPendente(p)
    setChiediConferma(true)
    openWhatsApp(telefono, testoFinale)
  }

  // Ripresa dopo un ricaricamento: se c'è un invio in sospeso, la barra torna
  useEffect(() => {
    if (!id || loading || !richiesta) return
    const t = setTimeout(() => {
      try {
        const grezzo = window.localStorage.getItem(chiavePendente)
        if (grezzo === null) return
        const salvato = leggiPendente(grezzo)
        if (salvato?.confermataIl && richiesta.proposta_inviata_at === salvato.confermataIl) {
          eliminaPendente(window.localStorage, chiavePendente)
          setPendente(null); setChiediConferma(false)
          return
        }
        // La richiesta è stata modificata dopo l'invio: quel messaggio parla
        // di una richiesta che non esiste più. L'attesa si chiude da sola e la
        // bozza si rifà sui dati di adesso (Ania, 11/09/2026).
        if (richiestaCambiata(salvato, richiesta)) {
          // Riscritto a mano? Non si butta: si avvisa e decide Ania.
          // Si rigenera com'era ALLORA (dall'impronta), non com'è adesso:
          // altrimenti ogni messaggio sembrerebbe riscritto a mano.
          const testoAMano = (x: PropostaPendente) => testoRiscrittoAMano(x, y => generaProposta({
            richiesta: { ...richiesta, ...(y.impronta ?? {}) },
            soluzione: y.soluzione as Soluzione, condizione: condizioneDaColonne(y.condizioni), alternative: y.alternative,
          }))
          if (salvato && testoAMano(salvato)) {
            setPendente(salvato); setChiediConferma(true); setSuperataAMano(true)
            return
          }
          eliminaPendente(window.localStorage, chiavePendente)
          setPendente(null); setChiediConferma(false); setTestoModificato(null)
          setAvviso('La richiesta è cambiata dopo l’ultimo invio: il messaggio è stato rifatto sui dati di adesso. Se quello di prima era già partito, mandane uno nuovo.')
          return
        }
        setPendente(salvato)
        setChiediConferma(true)
        // Dopo un ricaricamento (sul telefono l'app riparte al ritorno da
        // WhatsApp) la scelta di «Come paga» si perde: si rimette da quello
        // che è partito, così il bottone giusto risulta acceso e si può
        // cambiare con un tocco.
        if (salvato && !inviata) {
          setCondizioneTipo(salvato.condizioni.condizione_pagamento)
          setCaparraTesto(salvato.condizioni.caparra_centesimi === null ? '' : fmtPrezzo(salvato.condizioni.caparra_centesimi / 100))
          setCondizioneTesto(salvato.condizioni.condizione_testo ?? '')
          setAmeliaAttiva(salvato.condizioni.amelia_alternativa)
        }
      } catch {
        setErrore('Non riesco a leggere o aggiornare la proposta conservata nel browser. Riapri questa pagina prima di continuare.')
        setChiediConferma(true)
      }
    }, 0)
    return () => clearTimeout(t)
  }, [id, loading, richiesta, chiavePendente, inviata])

  // «Rifai il messaggio»: butta l'attesa vecchia e riscrive la bozza sui dati
  // di adesso. Il testo riscritto a mano si perde solo qui, con un tocco suo.
  function rifaiIlMessaggio() {
    try { eliminaPendente(window.localStorage, chiavePendente) }
    catch { setErrore('Non riesco ad aggiornare la proposta conservata nel browser. Riapri questa pagina.'); return }
    setPendente(null); setChiediConferma(false); setSuperataAMano(false)
    setTestoModificato(null); setRicomponi(true)
    setAvviso('Messaggio rifatto sui dati di adesso.')
  }

  function rispostaNo(): boolean {
    if (salvataggioInCorso.current) return false
    try { eliminaPendente(window.localStorage, chiavePendente) }
    catch { setErrore('Non riesco a conservare la risposta nel browser. Riprova: l’invio resta da chiarire.'); return false }
    // Anche dopo un ricaricamento «No» riapre la stessa composizione e i prezzi.
    if (pendente?.soluzione && richiesta && !inviata) {
      const s = pendente.soluzione
      setScelta(chiaveSoluzione(s))
      // Le spunte NON si toccano (Ania, 11/09/2026): cambiano solo quando si
      // tocca una camera. Restano quelle che ci sono; se non ne è stata
      // toccata nessuna valgono quelle di partenza (camera chiesta = solo lei).
      setManuale(!!s.manuale)
      setForzaNessunaDisponibilita(s.caso === 'completo' && s.segmenti.length === 0)
      setComposizione(composizioneDaSoluzione(richiesta, s))
      setPrezziManuali(nottiDellaRichiesta(richiesta).map(g => {
        const segmento = s.segmenti.find(x => x.arrivo <= g && x.partenza > g)
        return segmento?.prezzo_manuale ? prezziNottiCentesimi(segmento)[giorniTra(segmento.arrivo, g).length] : null
      }))
      setTestoModificato(pendente.testo)
      setCondizioneTipo(pendente.condizioni.condizione_pagamento)
      setCaparraTesto(pendente.condizioni.caparra_centesimi === null ? '' : fmtPrezzo(pendente.condizioni.caparra_centesimi / 100))
      setCondizioneTesto(pendente.condizioni.condizione_testo ?? '')
      setAmeliaAttiva(pendente.condizioni.amelia_alternativa)
    } else if (!inviata) {
      setTestoModificato(null); setCondizioneTipo(null)
    }
    setPendente(null)
    setChiediConferma(false)
    setErrore(null)
    return true
  }

  // Al ritorno nella schermata la barra torna in vista
  useEffect(() => {
    if (!chiediConferma) return
    const mostra = () => { if (document.visibilityState === 'visible') barraRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
    window.addEventListener('focus', mostra)
    document.addEventListener('visibilitychange', mostra)
    return () => { window.removeEventListener('focus', mostra); document.removeEventListener('visibilitychange', mostra) }
  }, [chiediConferma])

  async function confermaInviata() {
    if (!richiesta || !perConferma || salvataggioInCorso.current || mancaMigrazione) return
    salvataggioInCorso.current = true
    setErrore(null); setAvviso(null); setOccupato('invio')
    try {
      const p = { ...perConferma, confermataIl: perConferma.confermataIl ?? new Date().toISOString() }
      custodisciPendente(window.localStorage, chiavePendente, p, pendente)
      setPendente(p)
      const r = await segnaPropostaInviata(richiesta.id, p.testo, p.soluzione, p.condizioni, manca0031 ? undefined : p.alternative, p.confermataIl)
      if (r.error) { setErrore(`Non ho conferma del salvataggio: ${r.error} La proposta è conservata: riprova «Sì, inviata» oppure riapri la pagina.`); return }
      setRichiesta({ ...richiesta, stato: 'proposta_inviata', proposta_inviata_at: r.proposta_inviata_at, proposta_testo: p.testo, proposta_soluzione: p.soluzione, proposta_alternative: p.alternative, ...p.condizioni })
      eliminaPendente(window.localStorage, chiavePendente)
      setPendente(null); setChiediConferma(false)
    } catch (e) {
      setErrore(`Conferma da verificare: ${e instanceof Error ? e.message : 'Riprova.'} La proposta resta conservata; riapri la pagina per verificare l’esito.`)
    } finally {
      salvataggioInCorso.current = false; setOccupato(null)
    }
  }

  async function rifiuta(motivo: MotivoRifiuto) {
    if (!richiesta) return
    setOccupato('rifiuto')
    const { error } = await rifiutaRichiesta(richiesta.id, motivo)
    setOccupato(null)
    setDaRifiutare(false)
    if (error) { setErrore(`Rifiuto non riuscito: ${error}`); return }
    router.push(indietro)
  }

  async function immagineSuDispositivo() {
    if (!imgRef.current || !richiesta) return
    setErrore(null); setOccupato('immagine')
    try {
      const nome = `proposta-${richiesta.cognome.toLowerCase()}-${richiesta.arrivo}.png`
      if (isMobile()) await salvaImmagine(imgRef.current, nome)
      else await copiaImmagine(imgRef.current, nome)
      setImmagineFatta(true); setTimeout(() => setImmagineFatta(false), 3000)
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') setErrore('Immagine non riuscita: riprova o usa «Solo testo».')
    }
    setOccupato(null)
  }

  // La testa della pagina: dal telefono «‹ Richieste» e lo stato a destra
  const barra = (stato: string | null) => (
    <div className="sch-top ric-top" data-riga-navigazione>
      <button type="button" className="np-back" onClick={() => router.push(indietro)}>‹ Richieste</button>
      <p className="sch-scritta">Richiesta</p>
      {stato && <span className="stato" data-stato-richiesta>{stato}</span>}
    </div>
  )
  if (loading) return <div className="maison cal ric-pag">{barra(null)}<div className="mz-caricamento">Caricamento…</div></div>
  if (!richiesta) return <div className="maison cal ric-pag">{barra(null)}<p className="ric-avviso" role="alert">{errore || 'Richiesta non trovata.'}</p></div>

  const n = nottiRichiesta(richiesta)
  const problematico = valutazioneDi(guest) === 'problematico'
  const statoTesta = richiesta.stato === 'in_attesa' ? 'In attesa' : richiesta.stato === 'proposta_inviata' ? 'Proposta inviata' : richiesta.stato === 'confermata' ? 'Confermata' : 'Chiusa'
  const telefonoEsteso = telefonoPerEsteso(richiesta.telefono)
  const iconeNome = iconeFoglietto(vuoleRicevuta(guest), valutazioneDi(guest) === 'ottimo')
  const pezziTesta = pezziRigaElenco({ notti: n, personeNotti: personeNottiRichiesta.length ? personeNottiRichiesta : [richiesta.persone], camera: richiesta.rooms?.name ?? null, maison: true })
    .filter(x => !x.speso).map(x => x.testo).join('')
  const rigaQuando = [pezzoCliente(soggiorni.volte, !!guest), CANALE_LABEL[richiesta.canale], oraArrivo(richiesta.created_at, adesso)].filter(Boolean).join(' · ')
  const vediParte = (l: LinguettaRichiesta) => paginaUnica || linguetta === l
  const avanti = (l: LinguettaRichiesta, testo: string, pieno: boolean) => (paginaUnica ? null : pieno
    ? <button type="button" className="ric-cta" data-avanti={l} onClick={() => sceltaLinguetta(l)}>{testo}</button>
    : <div className="ric-ac centro"><button type="button" className="mz-lnk" data-avanti={l} onClick={() => sceltaLinguetta(l)}>{testo}</button></div>)

  // ── Camere da proporre: casella a filo, nome in Cormorant, sotto il dettaglio, a destra il totale ──
  const dettaglioCamera = (r: typeof righeCamere[number]) => {
    if (!r.proponibile) return (motivoOpzione.get(r.camera.id)) || r.stato
    return [
      testoNotti(n),
      ...r.prezzo.map(x => `${x.importo} ${x.quando}${x.letto ? (r.prezzo.length === 1 ? ', letto compreso' : ' letto compreso') : ''}`),
      r.tripla ? 'tripla' : '', r.lettoInPiu ? '+ letto' : '', r.tavolo ? 'va tolto il tavolo' : '',
    ].filter(Boolean).join(' · ')
  }
  const elencoCamere = (
    <div className="ric-camere" data-camere-proposta data-senza-sottolinea>
      {righeCamere.map(r => {
        const spunta = spuntate.includes(r.camera.id)
        // Si possono toccare anche in attesa della risposta a «L'hai inviata?»
        const si = r.proponibile && !manuale && !forzaNessunaDisponibilita
        return (
          <button key={r.camera.id} type="button" disabled={!si} onClick={() => cambiaSpunta(r.camera.id)} aria-pressed={spunta}
            data-camera={r.camera.name} data-spuntata={spunta ? 'si' : 'no'} className={`cr ${r.proponibile ? '' : 'no'}`}>
            <span aria-hidden className={`cb ${spunta ? 'on' : ''}`}>{spunta ? '✓' : ''}</span>
            <span className="cn">{r.camera.name}<small>{dettaglioCamera(r)}</small></span>
            <span className="cp">{r.proponibile ? formattaEuro(r.totaleCent) : ''}</span>
          </button>
        )
      })}
    </div>
  )

  // Nessuna camera libera per tutte le notti: resta la proposta automatica di sempre
  const propostaAutomatica = !conCamereLibere && !manuale && !forzaNessunaDisponibilita && modificaConsentita && automatica && automatica.segmenti.length > 0 && (
    <div className="dr2" data-proposta-automatica>
      <b>{automatica.caso === 'cambio' ? 'Proposta con cambio camera' : 'Proposta per una parte delle notti'}</b>
      {soluzioneInParole(automatica)}
      <span className="so">{`${formattaEuro(centesimiTotale(automatica))} in tutto${automatica.nottiCoperte < automatica.nottiTotali ? ` · copre ${automatica.nottiCoperte} notti su ${automatica.nottiTotali}` : ''}`}</span>
    </div>
  )

  // ── «Compongo io, notte per notte»: striscia camera per notte + prezzo a mano ──
  const scelgoIo = manuale && modificaConsentita && (
    <div className="ric-scelgo" role="group" aria-label="Compongo io">
      <p className="ti">Tocca una notte per cambiare camera</p>
      <StrisciaNotti<string | null> arrivo={richiesta.arrivo} partenza={richiesta.partenza} nottiSelezionate={richiesta.notti_richieste ?? undefined} valori={composizione} aria="Camera notte per notte"
        onChange={v => { setComposizione(v); setPrezziManuali(p => p.map((x, k) => (v[k] === composizione[k] ? x : null))); setPrezzoEditor(null) }}
        cicla={(v, verso, i) => {
          const ammesse = camereAmmesseNotte(i, richiesta, camere, prenotazioniConOpzioni)
          if (verso === 1) return cameraSuccessiva(v, ammesse)
          const ids: (string | null)[] = [...ammesse.map(c => c.id), null]
          const k = ids.indexOf(v)
          return ids[(k <= 0 ? ids.length : k) - 1]
        }}
        opzioni={i => [...camereAmmesseNotte(i, richiesta, camere, prenotazioniConOpzioni).map(c => ({ valore: c.id as string | null, etichetta: c.name })), { valore: null, etichetta: 'nessuna' }]}
        menuDesktop={desktop}
        mostra={(v, i) => ({
          centro: nomeCamera(v),
          sotto: v === null ? 'scoperta' : `${personeNottiRichiesta[i] ?? ''} pers. · ${(prezziManuali[i] ?? prezziTariffa[i]) != null ? fmtPrezzo(((prezziManuali[i] ?? prezziTariffa[i]) as number) / 100) + ' €' : '—'}`,
          evidenziata: v === null,
          contorno: prezziManuali[i] != null ? OTTONE : undefined,
        })}
        onLungo={apriPrezzo} />
      <p className="so">
        {riassuntoPerNotte(richiesta.arrivo, composizione.map(nomeCamera))}
        {soluzione ? <> · totale <b>{formattaEuro(totaleCentesimi(soluzione))}</b></> : null}
        {prezziManuali.some(p => p != null) && <b className="ott"> · prezzo modificato</b>}
      </p>
      <p className="so">Tieni premuta una notte{desktop ? ' (o la matita)' : ''} per scrivere il prezzo a mano.</p>
      {erroreComposizione && <p role="alert" className="ric-avviso">{erroreComposizione}</p>}
      {prezzoEditor !== null && composizione[prezzoEditor] !== null && (
        <div className="ric-prezzo" role="group" aria-label="Prezzo a mano">
          <p className="ti">Prezzo della notte del {etichettaNotte(nottiDellaRichiesta(richiesta)[prezzoEditor])} · {nomeCamera(composizione[prezzoEditor])}</p>
          <p className="so">Tariffa: {prezziTariffa[prezzoEditor] != null ? `${fmtPrezzo((prezziTariffa[prezzoEditor] as number) / 100)} €` : '—'} · scrivi il prezzo in euro (anche con decimali)</p>
          <input type="text" inputMode="decimal" value={prezzoTesto} onChange={e => setPrezzoTesto(e.target.value)} aria-label="Prezzo della notte in euro" className="ric-fld" />
          {!(prezzoEditorCent >= 0) || prezzoTesto.trim() === '' ? <p className="ric-avviso">Scrivi un prezzo valido</p> : null}
          <div className="ric-ac">
            <button type="button" className="mz-lnk" disabled={prezzoTesto.trim() === '' || !(prezzoEditorCent >= 0)}
              onClick={() => { setPrezziManuali(p => p.map((x, k) => (k === prezzoEditor ? prezzoEditorCent : x))); setPrezzoEditor(null) }}>Applica</button>
            <button type="button" className="mz-lnk q" disabled={prezzoTesto.trim() === '' || !(prezzoEditorCent >= 0)}
              onClick={() => { setPrezziManuali(p => applicaATutteLeNotti(composizione, p, prezzoEditor, prezzoEditorCent)); setPrezzoEditor(null) }}>Applica a tutte le notti di questa camera</button>
            <button type="button" className="mz-lnk q" onClick={() => { setPrezziManuali(p => p.map((x, k) => (k === prezzoEditor ? null : x))); setPrezzoEditor(null) }}>Ripristina tariffa</button>
            <button type="button" className="mz-lnk q" onClick={() => setPrezzoEditor(null)}>Chiudi</button>
          </div>
        </div>
      )}
      <div className="ric-ac"><button type="button" onClick={tornaAutomatica} className="mz-lnk q">Torna alla proposta automatica</button></div>
    </div>
  )

  // Riepilogo della condizione salvata (proposta già inviata)
  const condizioniMostrate = chiediConferma ? pendente?.condizioni : inviataBloccata ? richiesta : null
  const condizioneInviata = condizioniMostrate ? condizioneDaColonne(condizioniMostrate) : null
  const riassuntoCondizione = condizioneInviata
    ? `${ETICHETTA_CONDIZIONE[condizioneInviata.tipo]}${condizioneInviata.tipo === 'caparra' ? ` ${formattaEuro(condizioneInviata.caparraCentesimi)}` : ''}${condizioniMostrate?.amelia_alternativa ? ' · con alternativa ad Amelia' : ''}`
    : null
  // L'alternativa Ambra/Allegra (novità 14e): sotto le camere, solo con Amelia scelta
  const ameliaScelta = !!soluzione?.segmenti.some(x => /amelia/i.test(x.camera.name)) || righeCamere.some(r => /amelia/i.test(r.camera.name) && spuntate.includes(r.camera.id))
  const mostraAmelia = mostraAlternativaAmelia({ amelia: !!amelia, ameliaScelta, completo, inviataBloccata })
  // Il titolo della nota delle opzioni: «Amelia è in opzione» · «Amelia era in opzione»
  const [titoloOpz, restoOpz] = notaOpz ? dividiNotaOpzioni(notaOpz.testo) : ['', '']
  const stesse = vociControllo.filter(v => v.chiave.startsWith('stesse_date_'))
  const torna = vociControllo.find(v => v.chiave === 'cliente_torna') ?? null

  return (
    <div className="maison cal ric-pag" data-richiesta-maison>
      {barra(statoTesta)}

      {/* ── LA TESTATA: nome con 🧾 ★ e i cerchi, il telefono per esteso, chi è e da dove, il soggiorno, la nota ── */}
      <header className="ric-testa" data-testa-richiesta>
        <div className="hd3">
          <h1 className="ti">{iconeNome && <span className="ic">{iconeNome} </span>}{nomeCompleto(richiesta)}</h1>
          <IconeContatto telefono={richiesta.telefono} nome={nomeCompleto(richiesta)} dati="richiesta" />
        </div>
        {telefonoEsteso && <p className="tel"><span className="num" data-telefono-richiesta>{telefonoEsteso}</span></p>}
        {telefonoNorm.avviso && <p className="ric-avviso">{telefonoNorm.avviso}</p>}
        <p className="hs">{rigaQuando}{provenienzaInParole(guest ?? richiesta) ? ` · ${provenienzaInParole(guest ?? richiesta)}` : ''}</p>
        <p className="hs2">{periodoConMese(richiesta.arrivo, richiesta.partenza)} · {pezziTesta}</p>
        {noteTesta.map(x => <p key={x.etichetta} className="nt2" data-nota-testa={x.etichetta}>«{x.testo}»</p>)}
        {problematico && <p className="nt2" data-problematico>Cliente segnalata{guest?.motivo_problematico ? `: ${guest.motivo_problematico}` : ''}</p>}
        {/* timer delle 3 o 24 ore: sotto la testata quando c'è una proposta inviata */}
        <RigaScadenza r={richiesta} adesso={adesso} className="ric-scad" />
      </header>

      {mancaMigrazione && <p role="alert" className="ric-avviso">{mancaMigrazione} Finché manca, la proposta non può essere registrata.</p>}
      {erroreRicerca && <p role="alert" className="ric-avviso">{erroreRicerca}</p>}

      <LinguetteRichiesta scelta={linguetta} onScegli={sceltaLinguetta} paginaUnica={paginaUnica} />

      {/* ── CONTROLLARE ─────────────────────────────────────────────────── */}
      {vediParte('controllare') && (
        <section id="parte-controllare" className="sec" role="tabpanel" data-parte="controllare">
          <p className="k">Da controllare</p>
          {!inviata && notaOpz && (
            <div className="dr2" data-nota-opzioni={notaOpz.tipo}><b>{titoloOpz}</b>{restoOpz}</div>
          )}
          {stesse.length > 0 && (
            <div className="dr2" data-stesse-date-controllo>
              <b>Stesse date · {stesse.length === 1 ? '1 altra' : `${stesse.length} altre`}</b>
              {stesse.map(v => (
                <span key={v.chiave} className="riga">{v.titolo}{v.link && <> <Link href={v.link.href} className="mz-lnk q">Vedi</Link></>}</span>
              ))}
            </div>
          )}
          {torna && (
            <div className="dr2" data-cliente-torna>
              <b>{torna.etichetta}</b>
              {[torna.titolo.charAt(0).toLowerCase() + torna.titolo.slice(1), torna.dettaglio, soggiorni.ricaviCent > 0 ? `${euroTondi(soggiorni.ricaviCent)} spesi` : ''].filter(Boolean).join(' · ')}
              {torna.link && <> <Link href={torna.link.href} className="mz-lnk q">{torna.link.testo}</Link></>}
            </div>
          )}
          {vociControllo.length === 0 && !notaOpz && <p className="ric-ok">✓ Tutto a posto</p>}
          <div className="ric-ac centro">
            <Link href={linkModificaRichiesta(richiesta, 'proposta')} className="mz-lnk q" data-modifica-richiesta>Modifica</Link>
          </div>
          {avanti('camere', 'Avanti · Camere', false)}
        </section>
      )}

      {/* ── CAMERE ──────────────────────────────────────────────────────── */}
      {vediParte('camere') && (
        <section id="parte-camere" className="sec" role="tabpanel" data-parte="camere">
          <p className="k">Camere da proporre{conCamereLibere ? ` · ${spuntate.length}` : ''}</p>
          {sceltaPersa && <p role="alert" className="ric-avviso">La soluzione scelta non è più disponibile. <button type="button" onClick={() => setPannelloCambia(true)} className="mz-lnk">Scegline un’altra</button></p>}
          {forzaNessunaDisponibilita
            ? <p className="so">Hai scelto di rispondere che non c’è posto. <button type="button" onClick={tornaAlleDisponibilita} className="mz-lnk">Torna alle disponibilità</button></p>
            : <>
              {elencoCamere}
              {propostaAutomatica}
              {scelgoIo}
              {modificaConsentita && !manuale && (
                <div className="ric-ac">
                  {!conCamereLibere && soluzioni.length > 1 && <button type="button" onClick={() => setPannelloCambia(true)} className="mz-lnk q">Un’altra soluzione</button>}
                  <button type="button" onClick={apriScelgoIo} className="mz-lnk q">Compongo io, notte per notte</button>
                  <button type="button" onClick={scegliNessunaDisponibilita} className="mz-lnk q">Non ho posto</button>
                </div>
              )}
            </>}
          {mostraAmelia && amelia && (
            <button type="button" className="dr2 ric-amelia" data-senza-sottolinea role="switch" aria-checked={ameliaAttiva} onClick={() => cambiaAmelia(!ameliaAttiva)} data-alternativa-amelia>
              <span aria-hidden className={`cb ${ameliaAttiva ? 'on' : ''}`}>{ameliaAttiva ? '✓' : ''}</span>
              Aggiungi l’alternativa Ambra/Allegra
              <span className="so">{amelia.camera.name}, {formattaEuro(amelia.differenzaNotteCentesimi)} in più a notte · totale {formattaEuro(amelia.prezzoTotaleCentesimi)}</span>
            </button>
          )}
          {problemaCamere && <p className="ric-avviso">{problemaCamere}</p>}
          {avanti('pagamento', 'Avanti · Pagamento', true)}
        </section>
      )}

      {/* ── PAGAMENTO ───────────────────────────────────────────────────── */}
      {vediParte('pagamento') && (
        <section id="parte-pagamento" className="sec" role="tabpanel" data-parte="pagamento">
          <p className="k">Come paga</p>
          {completo && <p className="so">Con «non c’è posto» non serve: il messaggio non parla di pagamento.</p>}
          {condizioni !== 'nascoste' && (
            <div role="group" aria-label="Condizioni di pagamento">
              <div className="ric-chips piatte" data-senza-sottolinea>
                {CONDIZIONI_PAGAMENTO.map(tipo => {
                  const scelta = condizioni === 'solo_lettura' ? condizioneInviata?.tipo === tipo : condizioneTipo === tipo
                  return <button key={tipo} type="button" onClick={() => scegliCondizione(tipo)} aria-pressed={scelta} className={scelta ? 'on' : ''}>{ETICHETTA_CONDIZIONE[tipo]}</button>
                })}
              </div>
              {riassuntoCondizione && condizioni === 'solo_lettura' && <p className="so">Inviata: {riassuntoCondizione}. Toccane un’altra per rifare la proposta.</p>}
              {inviata && ricomponi && (
                <p className="so">Stai rifacendo la proposta. <button type="button" onClick={() => { setRicomponi(false); setTestoModificato(null); azzeraCondizioni(); setAvviso(null) }} className="mz-lnk">Torna a quella inviata</button></p>
              )}
              {condizioni === 'scegliere' && condizioneTipo === 'caparra' && (
                <label className="ric-campo">
                  <span className="fl2">Caparra confirmatoria (€) · proposta al {fmtPrezzo(caparraDefault(totaleCent) / 100)} €, cioè il 50% di {fmtPrezzo(totaleCent / 100)} €</span>
                  <input id="caparra" type="text" inputMode="decimal" value={caparraTesto} onChange={e => setCaparraTesto(e.target.value)} aria-label="Importo della caparra in euro" className="ric-fld" />
                </label>
              )}
              {condizioni === 'scegliere' && condizioneTipo === 'personalizzata' && (
                <label className="ric-campo">
                  <span className="fl2">Scrivi il paragrafo delle condizioni: la chiusura «Grazie mille, Ania – Casa Ania» viene aggiunta da sola</span>
                  <textarea id="condizione-testo" value={condizioneTesto} onChange={e => setCondizioneTesto(e.target.value)} rows={4} aria-label="Condizioni di pagamento personalizzate" className="ric-fld area" />
                </label>
              )}
              {problemaCondizione && problemaCondizione !== SCEGLI_COME_PAGA && <p className="ric-avviso">{problemaCondizione}</p>}
            </div>
          )}
          <p className="so">La camera resta in opzione 3 ore dall’invio · con caparra o pagamento completo 24 ore</p>
          {avanti('messaggio', 'Avanti · Il messaggio', true)}
        </section>
      )}

      {/* ── MESSAGGIO ───────────────────────────────────────────────────── */}
      {vediParte('messaggio') && (
        <section id="parte-messaggio" className="sec" role="tabpanel" data-parte="messaggio">
          <p className="k">Il messaggio{soluzione ? ` · ${ETICHETTA_CASO[soluzione.caso]}` : ''}</p>
          {modificaConsentita && (
            <div role="group" aria-label="Come mandarlo" className="ric-chips piatte" data-senza-sottolinea>
              {([['testo', 'Solo testo'], ['immagine', 'Testo + immagine']] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setModo(k)} aria-pressed={modoEffettivo === k} disabled={k === 'immagine' && (completo || !immagine)} className={modoEffettivo === k ? 'on' : ''}>{label}</button>
              ))}
            </div>
          )}
          {superataAMano && (
            <p data-richiesta-cambiata className="so ott">La richiesta è cambiata: il messaggio è ancora quello di prima. <button type="button" onClick={rifaiIlMessaggio} className="mz-lnk">Rifai il messaggio</button></p>
          )}
          {inviataBloccata && !superataAMano && (
            <p data-messaggio-inviato className="so ott">Questo è il messaggio già inviato{richiesta.proposta_inviata_at ? ` ${oraArrivo(richiesta.proposta_inviata_at, adesso)}` : ''}: non è la bozza di adesso.</p>
          )}
          <div data-messaggio className={`msg ${messaggioAperto ? 'aperto' : ''}`}>
            {inviataBloccata || chiediConferma ? (
              <div className="testo"><TestoWhatsApp testo={testoFinale} /></div>
            ) : (
              <textarea ref={textareaRef} value={testoFinale} onChange={e => setTestoModificato(e.target.value)} rows={6} spellCheck={false}
                aria-label="Bozza del messaggio" className="testo" />
            )}
          </div>
          <div className="ric-ac">
            <button type="button" data-apri-messaggio onClick={() => setMessaggioAperto(v => !v)} className="mz-lnk q">{messaggioAperto ? 'Richiudi' : 'Mostra tutto'}</button>
            {modificaConsentita && (
              <button type="button" className="mz-lnk q" data-modifica-testo onClick={() => { setMessaggioAperto(true); setTimeout(() => textareaRef.current?.focus(), 0) }}>Modifica il testo</button>
            )}
            {modificaConsentita && testoModificato !== null && testoModificato !== bozzaGenerata && (
              <button type="button" className="mz-lnk q" onClick={() => setTestoModificato(null)}>Ripristina la bozza</button>
            )}
            {inviata && ricomponi && (
              <button type="button" className="mz-lnk q" onClick={() => { setRicomponi(false); setTestoModificato(null); azzeraCondizioni(); setAvviso(null) }}>Torna a quella inviata</button>
            )}
          </div>
          {modificaConsentita && testoModificato !== null && testoModificato !== bozzaGenerata && (
            <p className="so">Testo modificato a mano: ha la precedenza sulla bozza.</p>
          )}

          {modoEffettivo === 'immagine' && immagine && modificaConsentita && (
            <div className="ric-img">
              <p className="so">Anteprima dell’immagine</p>
              <div ref={el => { if (el) setScala(el.clientWidth / IMG_W) }} className="cornice" style={{ height: imgH ? imgH * scala : undefined }}>
                <div style={{ transform: `scale(${scala})`, transformOrigin: 'top left', width: IMG_W }}>
                  <ImmagineSoggiorno imgRef={imgRef} variante="proposta" nome={richiesta.nome.trim()} segmenti={immagine.seg} numOspiti={richiesta.persone}
                    righeCosti={immagine.righe} totale={immagine.totale} pagamento="contanti" lettoAggiuntivo={immagine.lettoAggiuntivo} nottiNonDisponibili={immagine.nottiNonDisponibili} personeNotti={immagine.personeNotti} lineaSempre={!!soluzione?.manuale} formattaImporto={x => formattaEuro(centesimi(x))} />
                </div>
              </div>
              <div className="ric-ac">
                <button type="button" onClick={immagineSuDispositivo} disabled={!!occupato} className="mz-lnk">
                  {occupato === 'immagine' ? 'Preparo…' : immagineFatta ? (isMobile() ? 'Immagine salvata!' : 'Immagine copiata!') : (isMobile() ? '1 · Salva immagine sul telefono' : '1 · Copia immagine')}
                </button>
              </div>
              <p className="so">{isMobile() ? 'Poi, nella chat, allega la prima foto dalla galleria e invia il testo già scritto.' : 'Poi incolla l’immagine nella chat (Cmd+V) e invia il testo già scritto.'}</p>
            </div>
          )}

          {errore && <p role="alert" className="ric-avviso">{errore}</p>}
          {avviso && <p role="status" className="so ott">{avviso}</p>}

          <button type="button" onClick={invia} disabled={!!occupato || !soluzione || chiediConferma || !!mancaMigrazione || (!inviataBloccata && (!!problemaCamere || !!problemaCondizione))} className="ric-cta" data-invia-whatsapp>
            {chiediConferma ? 'Invio da confermare' : problemaCamere ? problemaCamere : problemaCondizione ? problemaCondizione : inviata ? 'Invia di nuovo' : (modoEffettivo === 'immagine' ? '2 · Apri WhatsApp e invia' : 'Apri WhatsApp e invia')}
          </button>
          {chiediConferma && invioNascosto && (
            <div className="ric-ac centro"><button type="button" className="mz-lnk" onClick={() => setInvioNascosto(false)}>L’hai inviata? Rispondi</button></div>
          )}
          {!chiediConferma && (
            <p className="so centro">
              {inviata ? `Proposta inviata ${richiesta.proposta_inviata_at ? tempoTrascorso(richiesta.proposta_inviata_at, adesso) : ''}. Un nuovo invio, confermato, aggiorna l’ora.` : 'Dopo l’invio, confermato con «Sì, inviata», la richiesta passa a «Proposta inviata».'}
            </p>
          )}
          <div className="ric-ac colonna">
            {inviata && !chiediConferma && (
              <button type="button" className="mz-lnk" data-conferma-richiesta onClick={async () => { const { data } = await fetchRichieste(); setConfermando({ aperte: data }) }}>Conferma → crea la prenotazione</button>
            )}
            <button type="button" onClick={() => setDaRifiutare(true)} disabled={chiediConferma} className="mz-lnk mat" data-rifiuta-richiesta>Rifiuta la richiesta</button>
          </div>
        </section>
      )}

      {/* «L'hai inviata?»: al ritorno da WhatsApp, in un foglio basso */}
      {chiediConferma && !invioNascosto && (
        <FoglioMaison titolo="L’hai inviata?" altezza={perConferma ? 300 : 320} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} dati="richiesta-inviata"
          onChiudi={() => setInvioNascosto(true)}
          piede={
            <div className="ric-piede" data-piede-inviata>
              <button type="button" className="mz-lnk q" onClick={rispostaNo} disabled={occupato === 'invio' || !!pendente?.confermataIl}>{perConferma ? 'No' : 'Scarta attesa e ricomponi'}</button>
              <button type="button" className="ric-cta corto" onClick={confermaInviata} disabled={occupato === 'invio' || !perConferma || !!mancaMigrazione}>{occupato === 'invio' ? 'Salvo…' : 'Sì, inviata'}</button>
            </div>
          }>
          <div ref={barraRef} role="group" aria-label="Conferma dell'invio" className="ric-inviata">
            {perConferma && <p className="so" data-pendente>{rigaConferma(perConferma)}</p>}
            {!perConferma && <p role="alert" className="ric-avviso">Questa vecchia bozza non conserva tutte le camere e i prezzi. Non posso registrarla in modo sicuro. Controlla il messaggio in WhatsApp, poi scarta l’attesa e ricomponi la proposta corretta.</p>}
            <p className="so">Con «Sì, inviata» la richiesta passa a «Proposta inviata».</p>
            {pendente?.confermataIl && <p className="so">Salvataggio da verificare: riprova «Sì, inviata» o riapri la pagina prima di scartare.</p>}
            {errore && <p role="alert" className="ric-avviso">{errore}</p>}
          </div>
        </FoglioMaison>
      )}

      {/* Altre soluzioni trovate */}
      {pannelloCambia && (
        <FoglioMaison titolo="Soluzioni trovate" altezza={420} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} dati="richiesta-soluzioni" onChiudi={() => setPannelloCambia(false)}
          piede={<div className="ric-piede"><button type="button" className="mz-lnk q" onClick={() => setPannelloCambia(false)}>Chiudi</button></div>}>
          {soluzioni.length <= 1 && <p className="so">Nessun&apos;altra soluzione automatica.</p>}
          {soluzioni.map((x, i) => (
            <button key={i} type="button" onClick={() => scegli(i)} aria-pressed={i === indiceScelto} data-senza-sottolinea className={`dr2 ric-soluzione ${i === indiceScelto ? 'on' : ''}`}>
              <b>{riassuntoSegmenti(x)}</b>
              {x.nottiCoperte} su {x.nottiTotali} notti · {fmtPrezzo(x.prezzoTotale)} €
            </button>
          ))}
        </FoglioMaison>
      )}

      {azioneSospesa && (
        <FoglioMaison titolo="Sostituire il testo modificato?" altezza={240} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} dati="richiesta-sostituire" onChiudi={() => setAzioneSospesa(null)}
          piede={
            <div className="ric-piede">
              <button type="button" className="mz-lnk q" onClick={() => setAzioneSospesa(null)}>Annulla</button>
              <button type="button" className="ric-cta corto" onClick={() => { azioneSospesa(); setTestoModificato(null); setAzioneSospesa(null) }}>Sostituisci</button>
            </div>
          }>
          <p className="so">La bozza verrà rigenerata con la nuova scelta e le modifiche a mano andranno perse.</p>
        </FoglioMaison>
      )}
      {confermando && (
        <FinestraConferma richiesta={richiesta as RichiestaConProposta} aperte={confermando.aperte} layout={desktop ? 'desktop' : 'mobile'}
          onChiudi={() => setConfermando(null)} onCreata={(x, av) => router.push(`/scheda/${x}?da=richiesta${av ? `&avviso=${encodeURIComponent(av)}` : ''}`)} />
      )}
      {daRifiutare && (
        <RifiutaConMotivo richiesta={richiesta} occupato={occupato === 'rifiuto'} onConferma={rifiuta} onAnnulla={() => { if (occupato !== 'rifiuto') setDaRifiutare(false) }} />
      )}
    </div>
  )
}
