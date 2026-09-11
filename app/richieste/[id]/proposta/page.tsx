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
import { useParams, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import BackBar from '@/components/BackBar'
import TestaCliente from '@/components/TestaCliente'
import FasciaSezioni from '@/components/FasciaSezioni'
import SchedinaControllo from '@/components/SchedinaControllo'
import TestoWhatsApp from '@/components/TestoWhatsApp'
import ConfermaDialog from '@/components/richieste/ConfermaDialog'
import FinestraConferma from '@/components/richieste/FinestraConferma'
import type { RichiestaConProposta } from '@/lib/richiesteConferma'
import ImmagineSoggiorno, { IMG_W } from '@/components/ImmagineSoggiorno'
import { supabase } from '@/lib/supabase'
import { fetchRichiesta, fetchRichieste, rifiutaRichiesta, segnaPropostaInviata, colonne0025Presenti, colonne0029Presenti, colonne0031Presenti, AVVISO_0025, AVVISO_0029, AVVISO_0031, type CondizioniSalvate } from '@/lib/richiesteDati'
import RifiutaConMotivo from '@/components/richieste/RifiutaConMotivo'
import type { MotivoRifiuto } from '@/lib/motivoRifiuto'
import { proponiSoluzioni, alternativaAmelia, personePerNotte, prezziNottiCentesimi, type Soluzione, type PrenotazioneOccupante } from '@/lib/richiesteProposta'
import { camereDaProporre, camereProponibili, camereDaSpuntare, soluzioniSpuntate } from '@/lib/richiesteCamere'
import { vociStesseDate, voceClienteCheTorna } from '@/lib/richiesteDaControllare'
import { soggiorniDellaPersona, chiaveNome, type SoggiornoStorico } from '@/lib/clienteCheTorna'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { provenienzaInParole } from '@/lib/provenienza'
import { camereAmmesseNotte, cameraSuccessiva, composizioneDaSoluzione, soluzioneDaComposizione, prezziTariffaPerNotte, applicaATutteLeNotti, totaleCentesimi, type Composizione, type PrezziManuali } from '@/lib/richiesteComposizione'
import StrisciaNotti, { etichettaNotte } from '@/components/StrisciaNotti'
import { generaProposta, prezzo as fmtPrezzo, centesimi, centesimiTotale, formattaEuro, condizioneDaColonne, nottiScoperte, type Condizione } from '@/lib/richiesteTesti'
import { chiaveSoluzione, soluzioneScelta } from '@/lib/richiesteScelta'
import { custodisciPendente, eliminaPendente, leggiPendente, datiPerConferma, type PropostaPendente } from '@/lib/richiestePendente'
import { CONDIZIONI_PAGAMENTO, ETICHETTA_CONDIZIONE, caparraDefault, type CondizionePagamento } from '@/lib/condizioniPrenotazione'
import { statoCondizioni } from '@/lib/condizioniProposta'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import { lettoDaComunicare } from '@/lib/tariffe'
import { openWhatsApp, normalizzaTelefono } from '@/lib/whatsapp'
import { salvaImmagine, copiaImmagine, isMobile } from '@/lib/immaginePng'
import { useDesktop, useAdesso } from '@/lib/richiesteVista'
import { opzioniAttive, opzioniScadute, occupantiDaOpzioni, notaOpzioni, opzioniSovrapposte, oraRoma, type RichiestaOpzione } from '@/lib/opzioni'
import RigaScadenza from '@/components/richieste/RigaScadenza'
import { nottiDellaRichiesta } from '@/lib/nottiRichieste'
import { giorniTra } from '@/lib/richiesteCalendario'
import { periodoCompatto } from '@/lib/dateItaliane'
import {
  CANALE_LABEL, nomeCompleto, nottiRichiesta, formatIntervallo, oraArrivo, tempoTrascorso, riassuntoPersone, riassuntoPerNotte, modificabile, eAperta, type Richiesta,
} from '@/lib/richieste'
import type { Room } from '@/lib/types'

const BORDO = '#C9BFA8'
const GRIGIO_NOTA = '#6b6b60'
const OTTONE = '#A9884E'
const GEORGIA = "Georgia, 'Times New Roman', serif"
const PIENO = 'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-mid text-cream-text font-semibold text-[15px] py-3.5 active:opacity-80 transition-opacity disabled:opacity-50'

const SEZIONI = [
  { id: 'controllare', label: 'Controllare' },
  { id: 'camere', label: 'Camere' },
  { id: 'pagamento', label: 'Pagamento' },
  { id: 'messaggio', label: 'Messaggio' },
]

const oggiIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function IconaWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5.1-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.8-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 2.9 2.9 0 0 0-.9 2.2 5 5 0 0 0 1.1 2.7 11.3 11.3 0 0 0 4.4 3.9c1.6.7 2.2.7 3 .6a2.6 2.6 0 0 0 1.7-1.2c.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  )
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
  const modificaConsentita = !chiediConferma && richiesta?.stato !== 'proposta_inviata'
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
  const spuntate = useMemo(() => (spunteManuali === null ? diPartenza : proponibili.filter(x => spunteManuali.includes(x))), [proponibili, spunteManuali, diPartenza])
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
    : inviata ? richiesta?.proposta_soluzione ?? null
      : manuale ? soluzioneManuale
        : conCamereLibere ? scelteSpuntate[0] ?? null
          : automatica
  const soluzione: Soluzione | null = !chiediConferma && !inviata && forzaNessunaDisponibilita ? soluzioneNessuna : soluzioneBase
  const completo = soluzione?.caso === 'completo'
  const totaleCent = soluzione ? centesimiTotale(soluzione) : 0
  // Alternativa ad Amelia: solo se le condizioni del blocco sono soddisfatte (calcolo puro)
  const amelia = useMemo(
    () => (richiesta && soluzione && !inviata ? alternativaAmelia(richiesta, soluzione, camere, prenotazioniConOpzioni) : null),
    [richiesta, soluzione, camere, prenotazioniConOpzioni, inviata],
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
  const problemaCamere: string | null = !inviata && !chiediConferma && conCamereLibere && !manuale && !forzaNessunaDisponibilita && spuntate.length === 0
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
    if (inviata) return richiesta?.proposta_alternative ?? null
    if (manuale || forzaNessunaDisponibilita || !conCamereLibere) return null
    return scelteSpuntate.length > 1 ? scelteSpuntate : null
  }, [chiediConferma, pendente, inviata, richiesta, manuale, forzaNessunaDisponibilita, conCamereLibere, scelteSpuntate])
  const bozzaGenerata = richiesta && soluzione
    ? generaProposta({ richiesta, soluzione, condizione: problemaCondizione ? null : condizione, amelia: ameliaAttiva ? amelia : null, alternative })
    : ''
  const testoFinale = chiediConferma ? pendente?.testo ?? '' : inviata && richiesta?.proposta_testo ? richiesta.proposta_testo : (testoModificato ?? bozzaGenerata)
  const telefonoNorm = normalizzaTelefono(richiesta?.telefono)
  const telefono = telefonoNorm.numero
  const perConferma = datiPerConferma(pendente)
  const mancaMigrazione = manca0025 ? AVVISO_0025 : manca0029 ? AVVISO_0029 : manca0031 && (alternative?.length ?? 0) > 1 ? AVVISO_0031 : null
  const condizioniSalvate: CondizioniSalvate = inviata && richiesta ? {
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
  const condizioni = statoCondizioni({ completo, inviata })

  // ── Chi è il cliente ──────────────────────────────────────────────────────
  const guest = useMemo(() => {
    if (!richiesta) return null
    const tel = normalizzaTelefono(richiesta.telefono).numero
    const chiave = chiaveNome({ nome: richiesta.nome, cognome: richiesta.cognome })
    const perTelefono = tel ? clienti.find(c => normalizzaTelefono(c.phone as string | null).numero === tel) : undefined
    const perNome = chiave ? clienti.find(c => chiaveNome({ full_name: (c.full_name as string | null) ?? null }) === chiave) : undefined
    return (perTelefono ?? perNome ?? null) as { id?: string; rating?: string | null; vuole_ricevuta?: boolean | null; motivo_problematico?: string | null; provenienza?: string | null; struttura_nome?: string | null } | null
  }, [richiesta, clienti])
  const soggiorni = useMemo(() => {
    if (!richiesta) return { volte: 0, ricaviCent: 0, ultimo: null }
    return soggiorniDellaPersona(
      { nome: richiesta.nome, cognome: richiesta.cognome, telefono: richiesta.telefono, guest_id: guest?.id ?? null },
      prenotazioni as unknown as SoggiornoStorico[], oggiIso(),
    )
  }, [richiesta, prenotazioni, guest])
  const hrefCliente = guest?.id ? `/clienti/${guest.id}` : null

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
    conConferma(() => {
      setTestoModificato(null)
      setSpunteManuali(prima => {
        const base = prima === null ? diPartenza : prima.filter(x => proponibili.includes(x))
        return base.includes(cameraId) ? base.filter(x => x !== cameraId) : proponibili.filter(x => base.includes(x) || x === cameraId)
      })
    })
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
    if (condizioni === 'solo_lettura') return
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
    if (!inviata && problemaCamere) { setErrore(problemaCamere); return }
    if (!inviata && problemaCondizione) { setErrore(problemaCondizione); return }
    if (!telefono) { setErrore('Nessun numero di telefono sulla richiesta: aggiungilo prima di inviare.'); return }
    // Nel browser resta TUTTO il messaggio partito: testo, condizioni, soluzione e alternative
    const p: PropostaPendente = { testo: testoFinale, condizioni: condizioniSalvate, soluzione, alternative }
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

  function rispostaNo(): boolean {
    if (salvataggioInCorso.current) return false
    try { eliminaPendente(window.localStorage, chiavePendente) }
    catch { setErrore('Non riesco a conservare la risposta nel browser. Riprova: l’invio resta da chiarire.'); return false }
    // Anche dopo un ricaricamento «No» riapre la stessa composizione e i prezzi.
    if (pendente?.soluzione && richiesta && !inviata) {
      const s = pendente.soluzione
      setScelta(chiaveSoluzione(s))
      // le camere del messaggio partito tornano spuntate
      const camereDelMessaggio = (pendente.alternative ?? [s]).map(x => x.segmenti[0]?.camera.id).filter((x): x is string => !!x)
      setSpunteManuali(camereDelMessaggio)
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
    router.push('/richieste')
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

  if (loading) return <div className="p-4"><BackBar href="/richieste" /><div className="text-center py-10 text-stone">Caricamento…</div></div>
  if (!richiesta) return <div className="p-4"><BackBar href="/richieste" /><div className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore || 'Richiesta non trovata.'}</div></div>

  const n = nottiRichiesta(richiesta)
  const problematico = valutazioneDi(guest) === 'problematico'

  // ── Camere da proporre ────────────────────────────────────────────────────
  const elencoCamere = (
    <ul className="ed-lista ed-lista-ottone mt-2">
      {righeCamere.map(r => {
        const spunta = spuntate.includes(r.camera.id)
        const si = r.proponibile && modificaConsentita && !manuale && !forzaNessunaDisponibilita
        return (
          <li key={r.camera.id} style={{ opacity: r.proponibile ? 1 : 0.55 }}>
            <button type="button" disabled={!si} onClick={() => cambiaSpunta(r.camera.id)} aria-pressed={spunta}
              data-camera={r.camera.name} data-spuntata={spunta ? 'si' : 'no'}
              className="w-full text-left py-3 flex items-start gap-3 disabled:cursor-default">
              <span aria-hidden className="shrink-0 inline-flex items-center justify-center" style={{
                width: 24, height: 24, borderRadius: 7, marginTop: 2,
                border: r.proponibile ? `1px solid ${spunta ? 'var(--color-green-mid)' : BORDO}` : `1px dashed ${BORDO}`,
                background: spunta ? 'var(--color-green-mid)' : 'transparent',
                color: '#F5EFE4', fontSize: 14, fontWeight: 700, lineHeight: 1,
              }}>{spunta ? '✓' : ''}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-3">
                  <span style={{ fontFamily: GEORGIA, fontSize: 20, color: 'var(--color-green-dark)' }}>{r.camera.name}</span>
                  {r.proponibile && <span style={{ fontFamily: GEORGIA, fontSize: 16, color: 'var(--color-stone)' }}>{formattaEuro(r.totaleCent)}</span>}
                </span>
                <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-1" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>
                  {r.tripla && <span className="ed-badge" style={{ borderColor: 'var(--color-green-mid)', color: 'var(--color-green-mid)' }}>tripla</span>}
                  {r.lettoInPiu && <span className="ed-badge" style={{ background: '#EFE2C7', borderColor: '#EFE2C7', color: '#7A5C1E' }}>+ letto</span>}
                  <span style={!r.proponibile && motivoOpzione.has(r.camera.id) ? { color: OTTONE } : undefined}>{(!r.proponibile && motivoOpzione.get(r.camera.id)) || r.stato}</span>
                  {r.proponibile && <>
                    <span aria-hidden>·</span>
                    <span className="font-semibold">{formattaEuro(r.prezzoNotteCent)} a notte</span>
                    {r.lettoNotteCent > 0 && <span>+ {formattaEuro(r.lettoNotteCent)} il letto</span>}
                  </>}
                  {r.tavolo && <><span aria-hidden>·</span><span>va tolto il tavolo</span></>}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )

  // Nessuna camera libera per tutte le notti: resta la proposta automatica di sempre
  const propostaAutomatica = !conCamereLibere && !manuale && !forzaNessunaDisponibilita && modificaConsentita && automatica && automatica.segmenti.length > 0 && (
    <SchedinaControllo className="mt-3"
      etichetta={automatica.caso === 'cambio' ? 'Proposta con cambio camera' : 'Proposta per una parte delle notti'}
      titolo={soluzioneInParole(automatica)}
      dettaglio={`${formattaEuro(centesimiTotale(automatica))} in tutto${automatica.nottiCoperte < automatica.nottiTotali ? ` · copre ${automatica.nottiCoperte} notti su ${automatica.nottiTotali}` : ''}`}
      azione={soluzioni.length > 1 ? { testo: "Un'altra soluzione", onClick: () => setPannelloCambia(true) } : null} />
  )

  // ── «Compongo io, notte per notte»: striscia camera per notte + prezzo a mano ──
  const scelgoIo = manuale && modificaConsentita && richiesta && (
    <div className="mt-3 ed-riga py-3" role="group" aria-label="Compongo io">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-green-dark">Tocca una notte per cambiare camera</p>
        <button type="button" onClick={tornaAutomatica} className="shrink-0 text-xs font-semibold text-green-mid underline underline-offset-2">Torna alla proposta automatica</button>
      </div>
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
      <p className="text-xs text-green-dark mt-2">
        {riassuntoPerNotte(richiesta.arrivo, composizione.map(nomeCamera))}
        {soluzione ? <> · totale <span className="font-semibold">{formattaEuro(totaleCentesimi(soluzione))}</span></> : null}
        {prezziManuali.some(p => p != null) && <span className="ml-1 font-semibold" style={{ color: OTTONE }}>· prezzo modificato</span>}
      </p>
      <p className="text-[11px] mt-1" style={{ color: GRIGIO_NOTA }}>Tieni premuta una notte{desktop ? ' (o la matita)' : ''} per scrivere il prezzo a mano.</p>
      {erroreComposizione && <div role="alert" className="mt-2 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-2.5 text-sm text-[#8C3B2E]">{erroreComposizione}</div>}
      {prezzoEditor !== null && composizione[prezzoEditor] !== null && (
        <div className="mt-3 bg-sand rounded-xl p-3" role="group" aria-label="Prezzo a mano">
          <p className="text-sm font-semibold text-green-dark mb-1.5">Prezzo della notte del {etichettaNotte(nottiDellaRichiesta(richiesta)[prezzoEditor])} · {nomeCamera(composizione[prezzoEditor])}</p>
          <p className="text-xs mb-1.5" style={{ color: GRIGIO_NOTA }}>Tariffa: {prezziTariffa[prezzoEditor] != null ? `${fmtPrezzo((prezziTariffa[prezzoEditor] as number) / 100)} €` : '—'} · scrivi il prezzo in euro (anche con decimali)</p>
          <input type="text" inputMode="decimal" value={prezzoTesto} onChange={e => setPrezzoTesto(e.target.value)} aria-label="Prezzo della notte in euro"
            className="w-full min-w-0 appearance-none bg-white rounded-xl px-3 py-2.5 text-[15px] text-green-dark focus:outline-none focus:border-green-mid" style={{ border: `1px solid ${BORDO}` }} />
          {!(prezzoEditorCent >= 0) || prezzoTesto.trim() === '' ? <p className="text-xs mt-1 font-semibold text-[#8C3B2E]">Scrivi un prezzo valido</p> : null}
          <div className="flex flex-wrap gap-2 mt-2">
            <button type="button" disabled={prezzoTesto.trim() === '' || !(prezzoEditorCent >= 0)}
              onClick={() => { setPrezziManuali(p => p.map((x, k) => (k === prezzoEditor ? prezzoEditorCent : x))); setPrezzoEditor(null) }}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-50">Applica</button>
            <button type="button" disabled={prezzoTesto.trim() === '' || !(prezzoEditorCent >= 0)}
              onClick={() => { setPrezziManuali(p => applicaATutteLeNotti(composizione, p, prezzoEditor, prezzoEditorCent)); setPrezzoEditor(null) }}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold bg-white text-green-dark border disabled:opacity-50" style={{ borderColor: BORDO }}>Applica a tutte le notti di questa camera</button>
            <button type="button" onClick={() => { setPrezziManuali(p => p.map((x, k) => (k === prezzoEditor ? null : x))); setPrezzoEditor(null) }}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold bg-white text-green-dark border" style={{ borderColor: BORDO }}>Ripristina tariffa</button>
            <button type="button" onClick={() => setPrezzoEditor(null)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-stone">Chiudi</button>
          </div>
        </div>
      )}
    </div>
  )

  // Riepilogo della condizione salvata (proposta già inviata)
  const condizioniMostrate = chiediConferma ? pendente?.condizioni : inviata ? richiesta : null
  const condizioneInviata = condizioniMostrate ? condizioneDaColonne(condizioniMostrate) : null
  const riassuntoCondizione = condizioneInviata
    ? `${ETICHETTA_CONDIZIONE[condizioneInviata.tipo]}${condizioneInviata.tipo === 'caparra' ? ` ${formattaEuro(condizioneInviata.caparraCentesimi)}` : ''}${condizioniMostrate?.amelia_alternativa ? ' · con alternativa ad Amelia' : ''}`
    : null

  return (
    <div className="p-4 md:max-w-[620px] md:mx-auto">
      <BackBar href="/richieste" />

      <TestaCliente
        nome={nomeCompleto(richiesta)}
        stella={valutazioneDi(guest) === 'ottimo'}
        ricevuta={vuoleRicevuta(guest)}
        problematico={problematico}
        motivoProblematico={guest?.motivo_problematico ?? null}
        volte={soggiorni.volte}
        provenienza={provenienzaInParole(guest ?? richiesta)}
        quando={`${CANALE_LABEL[richiesta.canale]} · ${oraArrivo(richiesta.created_at, adesso)}`}
        totaleCent={soggiorni.ricaviCent}
        hrefCliente={hrefCliente}
        arrivo={richiesta.arrivo}
        partenza={richiesta.partenza}
        notti={n}
        persone={richiesta.persone_per_notte ? riassuntoPersone(richiesta.arrivo, richiesta.persone_per_notte) : `${richiesta.persone} ${richiesta.persone === 1 ? 'persona' : 'persone'}`}
        camera={richiesta.rooms?.name || 'qualsiasi camera'}
        telefono={richiesta.telefono}
        telefonoWhatsApp={telefono || null}
        avvisoTelefono={telefonoNorm.avviso}
        onScrivi={() => telefono && openWhatsApp(telefono, '')}
        nota={richiesta.note}
        hrefModifica={modificabile(richiesta) && !chiediConferma ? `/richieste/${richiesta.id}/modifica` : null}
      />
      {/* timer delle 3 ore: stesso testo della lista e del tooltip del calendario */}
      <RigaScadenza r={richiesta} adesso={adesso} className="mt-3 text-center" />

      {mancaMigrazione && (
        <div role="alert" className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">
          {mancaMigrazione} Finché manca, la proposta non può essere registrata.
        </div>
      )}
      {erroreRicerca && (
        <div role="alert" className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{erroreRicerca}</div>
      )}

      <FasciaSezioni voci={SEZIONI} className="mt-4" />

      {/* ── Da controllare ────────────────────────────────────────────────── */}
      <section id="controllare" className="pt-5 scroll-mt-16">
        <p className="ed-sezione">Da controllare</p>
        {/* Nota ottone delle opzioni (blocco entro le 3 ore, oppure opzione scaduta) */}
        {!inviata && notaOpz && (
          <div role="note" data-nota-opzioni={notaOpz.tipo} className="mt-2 rounded-r-lg px-3 py-2.5 text-sm text-green-dark leading-snug" style={{ borderLeft: `3px solid ${OTTONE}`, background: '#F3ECD8' }}>{notaOpz.testo}</div>
        )}
        {vociControllo.length === 0 && !notaOpz
          ? <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--color-green-mid)' }}>✓ Tutto a posto</p>
          : <div className="mt-2 flex flex-col gap-2">
            {vociControllo.map(v => <SchedinaControllo key={v.chiave} etichetta={v.etichetta} titolo={v.titolo} dettaglio={v.dettaglio} link={v.link} />)}
          </div>}
      </section>

      {/* ── Camere da proporre ────────────────────────────────────────────── */}
      <section id="camere" className="pt-6 scroll-mt-16">
        <p className="ed-sezione">Camere da proporre {conCamereLibere && <small>{spuntate.length}</small>}</p>
        {sceltaPersa && <div role="alert" className="mt-2 rounded-xl bg-[#F6E4DE] p-3 text-sm text-[#8C3B2E]">La soluzione scelta non è più disponibile. <button type="button" onClick={() => setPannelloCambia(true)} className="underline font-semibold">Scegline un’altra</button></div>}
        {forzaNessunaDisponibilita
          ? <p className="mt-2 text-sm text-green-dark">Hai scelto di rispondere che non c’è posto. <button type="button" onClick={tornaAlleDisponibilita} className="font-semibold text-green-mid underline underline-offset-2">Torna alle disponibilità</button></p>
          : <>
            {elencoCamere}
            {propostaAutomatica}
            {scelgoIo}
            {modificaConsentita && !manuale && (
              <div className="flex flex-wrap gap-4 mt-3">
                <button type="button" onClick={apriScelgoIo} className="text-sm font-semibold text-green-mid underline underline-offset-2">Compongo io, notte per notte</button>
                <button type="button" onClick={scegliNessunaDisponibilita} className="text-sm font-semibold underline underline-offset-2" style={{ color: '#8C3B2E' }}>Non ho posto</button>
              </div>
            )}
          </>}
      </section>

      {/* ── Come paga ─────────────────────────────────────────────────────── */}
      <section id="pagamento" className="pt-6 scroll-mt-16">
        <p className="ed-sezione">Come paga</p>
        {completo && <p className="mt-2 text-sm text-stone">Con «non c’è posto» non serve: il messaggio non parla di pagamento.</p>}
        {condizioni !== 'nascoste' && (
          <div className="mt-2" role="group" aria-label="Condizioni di pagamento">
            <div className="flex flex-wrap gap-2">
              {CONDIZIONI_PAGAMENTO.map(tipo => {
                const scelta = condizioni === 'solo_lettura' ? condizioneInviata?.tipo === tipo : condizioneTipo === tipo
                return (
                  <button key={tipo} type="button" onClick={() => scegliCondizione(tipo)} aria-pressed={scelta} disabled={condizioni === 'solo_lettura'}
                    className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-60 ${scelta ? 'bg-green-mid text-cream-text' : 'bg-white text-green-dark border border-[#C9BFA8]'}`}>
                    {ETICHETTA_CONDIZIONE[tipo]}
                  </button>
                )
              })}
            </div>
            {riassuntoCondizione && condizioni === 'solo_lettura' && <p className="mt-2 text-sm text-stone">Inviata: {riassuntoCondizione}. Per cambiarla ricomponi la proposta con «Invia di nuovo».</p>}
            {condizioni === 'scegliere' && condizioneTipo === 'caparra' && (
              <div className="mt-2.5">
                <label className="block text-xs mb-1" style={{ color: GRIGIO_NOTA }} htmlFor="caparra">Caparra confirmatoria (€) · proposta al {fmtPrezzo(caparraDefault(totaleCent) / 100)} €, cioè il 50% di {fmtPrezzo(totaleCent / 100)} €</label>
                <input id="caparra" type="text" inputMode="decimal" value={caparraTesto} onChange={e => setCaparraTesto(e.target.value)} aria-label="Importo della caparra in euro"
                  className="w-full min-w-0 appearance-none bg-white rounded-xl px-3 py-2.5 text-[15px] text-green-dark focus:outline-none focus:border-green-mid" style={{ border: `1px solid ${BORDO}` }} />
                {problemaCondizione && problemaCondizione !== SCEGLI_COME_PAGA && <p className="text-xs mt-1 font-semibold text-[#8C3B2E]">{problemaCondizione}</p>}
              </div>
            )}
            {condizioni === 'scegliere' && condizioneTipo === 'personalizzata' && (
              <div className="mt-2.5">
                <label className="block text-xs mb-1" style={{ color: GRIGIO_NOTA }} htmlFor="condizione-testo">Scrivi il paragrafo delle condizioni: la chiusura «Grazie mille, Ania – Casa Ania» viene aggiunta da sola</label>
                <textarea id="condizione-testo" value={condizioneTesto} onChange={e => setCondizioneTesto(e.target.value)} rows={4} aria-label="Condizioni di pagamento personalizzate"
                  className="w-full bg-white rounded-xl p-3 text-[13px] text-green-dark leading-relaxed resize-none focus:outline-none focus:border-green-mid" style={{ border: `1px solid ${BORDO}` }} />
              </div>
            )}
            {condizioni === 'scegliere' && amelia && (
              <div className="mt-3 flex items-center justify-between gap-3 bg-white rounded-xl px-3 py-2.5" style={{ border: `1px solid ${BORDO}` }}>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-green-dark">Aggiungi alternativa Ambra/Allegra</span>
                  <span className="block text-xs" style={{ color: GRIGIO_NOTA }}>{amelia.camera.name}, {formattaEuro(amelia.differenzaNotteCentesimi)} in più a notte · totale {formattaEuro(amelia.prezzoTotaleCentesimi)}</span>
                </span>
                <button type="button" role="switch" aria-checked={ameliaAttiva} aria-label="Aggiungi alternativa Ambra/Allegra" onClick={() => cambiaAmelia(!ameliaAttiva)}
                  className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${ameliaAttiva ? 'bg-green-mid' : 'bg-border-soft'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${ameliaAttiva ? 'translate-x-5' : ''}`} aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── Il messaggio ──────────────────────────────────────────────────── */}
      <section id="messaggio" className="pt-6 scroll-mt-16">
        <p className="ed-sezione">Il messaggio</p>
        <div className="mt-2">
          {modificaConsentita && (
            <div role="group" aria-label="Come mandarlo" className="inline-flex rounded-full border p-0.5 mb-3" style={{ borderColor: BORDO }}>
              {([['testo', 'Solo testo'], ['immagine', 'Testo + immagine']] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setModo(k)} aria-pressed={modoEffettivo === k} disabled={k === 'immagine' && (completo || !immagine)}
                  className={`rounded-full whitespace-nowrap font-semibold transition-colors px-3 py-1.5 text-xs disabled:opacity-40 ${modoEffettivo === k ? 'bg-green-mid text-cream-text' : 'text-green-dark'}`}>
                  {label}
                </button>
              ))}
            </div>
          )}
          {inviata || chiediConferma ? (
            /* Qui il messaggio non si tocca più: si mostra come lo vedrà
               l'ospite, col grassetto al posto degli asterischi (nota
               dell'altra attività nella scheda, 11/09/2026). Il testo vero,
               quello che parte e quello archiviato, conserva gli asterischi.
               Mentre si compone resta la casella di scrittura, dove il
               grassetto non si può mostrare senza togliere la modifica. */
            <div className="bg-white rounded-xl p-3 text-[13px] text-green-dark leading-relaxed" style={{ border: `1px solid ${BORDO}` }}><TestoWhatsApp testo={testoFinale} /></div>
          ) : (
            <textarea ref={textareaRef} value={testoFinale} onChange={e => setTestoModificato(e.target.value)} rows={6} spellCheck={false}
              aria-label="Bozza del messaggio"
              className="w-full bg-white rounded-xl p-3 text-[13px] text-green-dark leading-relaxed resize-none focus:outline-none focus:border-green-mid"
              style={{ border: `1px solid ${BORDO}` }} />
          )}
          {modificaConsentita && testoModificato !== null && testoModificato !== bozzaGenerata && (
            <p className="text-xs mt-1" style={{ color: GRIGIO_NOTA }}>Testo modificato a mano: ha la precedenza sulla bozza. <button type="button" className="underline" onClick={() => setTestoModificato(null)}>Ripristina la bozza</button></p>
          )}

          {modoEffettivo === 'immagine' && immagine && modificaConsentita && (
            <div className="mt-3">
              <p className="text-xs mb-1.5" style={{ color: GRIGIO_NOTA }}>Anteprima dell’immagine</p>
              <div ref={el => { if (el) setScala(el.clientWidth / IMG_W) }} className="w-full rounded-xl overflow-hidden border border-card-border" style={{ height: imgH ? imgH * scala : undefined }}>
                <div style={{ transform: `scale(${scala})`, transformOrigin: 'top left', width: IMG_W }}>
                  <ImmagineSoggiorno imgRef={imgRef} variante="proposta" nome={richiesta.nome.trim()} segmenti={immagine.seg} numOspiti={richiesta.persone}
                    righeCosti={immagine.righe} totale={immagine.totale} pagamento="contanti" lettoAggiuntivo={immagine.lettoAggiuntivo} nottiNonDisponibili={immagine.nottiNonDisponibili} personeNotti={immagine.personeNotti} lineaSempre={!!soluzione?.manuale} formattaImporto={x => formattaEuro(centesimi(x))} />
                </div>
              </div>
              <button type="button" onClick={immagineSuDispositivo} disabled={!!occupato}
                className={`w-full mt-2 rounded-xl py-2.5 font-semibold text-sm border disabled:opacity-50 ${immagineFatta ? 'bg-sage text-green-dark' : 'bg-white text-green-dark'}`} style={{ borderColor: BORDO }}>
                {occupato === 'immagine' ? 'Preparo…' : immagineFatta ? (isMobile() ? 'Immagine salvata!' : 'Immagine copiata!') : (isMobile() ? '1 · Salva immagine sul telefono' : '1 · Copia immagine')}
              </button>
              <p className="text-xs mt-1.5" style={{ color: GRIGIO_NOTA }}>
                {isMobile() ? 'Poi, nella chat, allega la prima foto dalla galleria e invia il testo già scritto.' : 'Poi incolla l’immagine nella chat (Cmd+V) e invia il testo già scritto.'}
              </p>
            </div>
          )}

          {errore && <div role="alert" className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore}</div>}
          {avviso && <div role="status" className="mt-3 bg-white ed-campo rounded-xl p-3 text-sm text-green-dark">{avviso}</div>}

          <button type="button" onClick={invia} disabled={!!occupato || !soluzione || chiediConferma || !!mancaMigrazione || (!inviata && (!!problemaCamere || !!problemaCondizione))} className={`${PIENO} mt-4`}>
            <IconaWhatsApp />
            {chiediConferma ? 'Invio da confermare' : inviata ? 'Invia di nuovo' : problemaCamere ? problemaCamere : problemaCondizione ? problemaCondizione : (modoEffettivo === 'immagine' ? '2 · Apri WhatsApp e invia' : 'Apri WhatsApp e invia')}
          </button>
          {chiediConferma && (
            <div ref={barraRef} role="group" aria-label="Conferma dell'invio" className="scheda-in mt-3 bg-white rounded-xl p-3" style={{ border: `1px solid ${BORDO}` }}>
              <p className="text-sm font-medium text-green-dark mb-2">L’hai inviata?</p>
              {perConferma && (
                <p className="text-xs mb-2" style={{ color: GRIGIO_NOTA }} data-pendente>Proposta da confermare: {riassuntoSegmenti(perConferma.soluzione)}{perConferma.alternative && perConferma.alternative.length > 1 ? ` · ${perConferma.alternative.length} camere proposte` : ''}</p>
              )}
              {!perConferma && <p role="alert" className="text-sm mb-2 text-[#8C3B2E]">Questa vecchia bozza non conserva tutte le camere e i prezzi. Non posso registrarla in modo sicuro. Controlla il messaggio in WhatsApp, poi scarta l’attesa e ricomponi la proposta corretta.</p>}
              <div className="flex gap-2">
                <button type="button" onClick={confermaInviata} disabled={occupato === 'invio' || !perConferma || !!mancaMigrazione}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-50 active:opacity-80">
                  {occupato === 'invio' ? 'Salvo…' : 'Sì, inviata'}
                </button>
                <button type="button" onClick={rispostaNo} disabled={occupato === 'invio' || !!pendente?.confermataIl}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white text-green-dark border disabled:opacity-50" style={{ borderColor: BORDO }}>
                  {perConferma ? 'No' : 'Scarta attesa e ricomponi'}
                </button>
              </div>
              <p className="text-xs mt-2" style={{ color: GRIGIO_NOTA }}>Solo «Sì, inviata» segna la richiesta come proposta inviata.</p>
              {pendente?.confermataIl && <p className="text-xs mt-2" style={{ color: GRIGIO_NOTA }}>Salvataggio da verificare: riprova «Sì, inviata» o riapri la pagina prima di scartare.</p>}
            </div>
          )}
          <p className="text-xs text-center mt-2" style={{ color: GRIGIO_NOTA }}>
            {inviata ? `Proposta inviata ${richiesta.proposta_inviata_at ? tempoTrascorso(richiesta.proposta_inviata_at, adesso) : ''}. Un nuovo invio, confermato, aggiorna l’ora.` : 'Dopo l’invio, confermato con «Sì, inviata», la richiesta passa a ‘Proposta inviata’.'}
          </p>
          {inviata && !chiediConferma && (
            <button type="button" onClick={async () => { const { data } = await fetchRichieste(); setConfermando({ aperte: data }) }}
              className="w-full mt-3 rounded-xl py-3 text-[15px] font-semibold bg-white text-green-dark border active:bg-sage" style={{ borderColor: BORDO }}>
              Conferma → crea la prenotazione
            </button>
          )}
          {/* Staccato da tutto il resto: non si tocca per sbaglio */}
          <div className="text-center mt-10 mb-4">
            <button type="button" onClick={() => setDaRifiutare(true)} disabled={chiediConferma} className="text-[13px] underline underline-offset-2 disabled:opacity-50" style={{ color: '#C0392B' }}>Rifiuta la richiesta</button>
          </div>
        </div>
      </section>

      {/* Altre soluzioni trovate */}
      {pannelloCambia && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Altre soluzioni">
          <div className="velo-in absolute inset-0 ed-velo" onClick={() => setPannelloCambia(false)} />
          <div className={`scheda-in absolute ed-foglio shadow-lg overflow-y-auto ${desktop ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl w-[420px] max-h-[70vh] p-4' : 'left-0 right-0 bottom-0 rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[75dvh]'}`}>
            {!desktop && <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />}
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-green-dark">Soluzioni trovate</p>
              <button type="button" onClick={() => setPannelloCambia(false)} aria-label="Chiudi" className="w-9 h-9 -mr-2 flex items-center justify-center text-stone"><X size={18} strokeWidth={2} aria-hidden /></button>
            </div>
            {soluzioni.length <= 1 && <p className="text-sm text-stone py-2">Nessun&apos;altra soluzione automatica.</p>}
            <ul className="divide-y-[0.5px] divide-border-soft">
              {soluzioni.map((s, i) => (
                <li key={i}>
                  <button type="button" onClick={() => scegli(i)} aria-pressed={i === indiceScelto} className="w-full text-left py-3 flex items-start gap-3">
                    <span className="min-w-0 flex-1 text-sm text-green-dark">
                      <span className="block truncate">{riassuntoSegmenti(s)}</span>
                      <span className="block text-xs text-stone">{s.nottiCoperte} su {s.nottiTotali} notti · <span className="font-semibold text-brass">{fmtPrezzo(s.prezzoTotale)} €</span></span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {azioneSospesa && (
        <ConfermaDialog titolo="Sostituire il testo modificato?" testo="La bozza verrà rigenerata con la nuova scelta e le modifiche a mano andranno perse."
          conferma="Sostituisci" onConferma={() => { azioneSospesa(); setTestoModificato(null); setAzioneSospesa(null) }} onAnnulla={() => setAzioneSospesa(null)} />
      )}
      {confermando && (
        <FinestraConferma richiesta={richiesta as RichiestaConProposta} aperte={confermando.aperte} layout={desktop ? 'desktop' : 'mobile'}
          onChiudi={() => setConfermando(null)} onCreata={(x, av) => router.push(`/prenotazioni/${x}?da=richiesta${av ? `&avviso=${encodeURIComponent(av)}` : ''}`)} />
      )}
      {daRifiutare && (
        <RifiutaConMotivo richiesta={richiesta} occupato={occupato === 'rifiuto'} onConferma={rifiuta} onAnnulla={() => { if (occupato !== 'rifiuto') setDaRifiutare(false) }} />
      )}
    </div>
  )
}
