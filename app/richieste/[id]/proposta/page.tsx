'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Globe, Phone, MessageCircle, X } from 'lucide-react'
import BackBar from '@/components/BackBar'
import ConfermaDialog from '@/components/richieste/ConfermaDialog'
import FinestraConferma from '@/components/richieste/FinestraConferma'
import type { RichiestaConProposta } from '@/lib/richiesteConferma'
import ImmagineSoggiorno, { IMG_W } from '@/components/ImmagineSoggiorno'
import { supabase } from '@/lib/supabase'
import { fetchRichiesta, fetchRichieste, rifiutaRichiesta, segnaPropostaInviata, colonne0025Presenti, colonne0029Presenti, colonne0031Presenti, AVVISO_0025, AVVISO_0029, AVVISO_0031, MOTIVI_RIFIUTO, type CondizioniSalvate } from '@/lib/richiesteDati'
import { proponiSoluzioni, alternativaAmelia, personePerNotte, prezziNottiCentesimi, motiviEsclusione, testoMotivo, ETICHETTA_CASO, type Soluzione, type PrenotazioneOccupante } from '@/lib/richiesteProposta'
import { camereAmmesseNotte, cameraSuccessiva, composizioneDaSoluzione, soluzioneDaComposizione, prezziTariffaPerNotte, applicaATutteLeNotti, totaleCentesimi, type Composizione, type PrezziManuali } from '@/lib/richiesteComposizione'
import StrisciaNotti, { etichettaNotte } from '@/components/StrisciaNotti'
import { generaProposta, camereDelCasoA, prezzo as fmtPrezzo, centesimi, centesimiTotale, formattaEuro, condizioneDaColonne, nottiScoperte, type Condizione } from '@/lib/richiesteTesti'
import { CONDIZIONI_PAGAMENTO, ETICHETTA_CONDIZIONE, caparraDefault, type CondizionePagamento } from '@/lib/condizioniPrenotazione'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import { lettoDaComunicare } from '@/lib/tariffe'
import { openWhatsApp, normalizzaTelefono } from '@/lib/whatsapp'
import { salvaImmagine, copiaImmagine, isMobile } from '@/lib/immaginePng'
import { useDesktop, useAdesso } from '@/lib/richiesteVista'
import RigaScadenza from '@/components/richieste/RigaScadenza'
import { giorniTra } from '@/lib/richiesteCalendario'
import Link from 'next/link'
import {
  CANALE_LABEL, nomeCompleto, nottiRichiesta, formatIntervallo, oraArrivo, tempoTrascorso, riassuntoPersone, riassuntoPerNotte, modificabile, type Richiesta,
} from '@/lib/richieste'
import type { Room } from '@/lib/types'

const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
const BORDO = '#C9BFA8'
const GRIGIO_NOTA = '#6b6b60'
const PIENO = 'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-green-mid text-cream-text font-semibold text-[15px] py-3.5 active:opacity-80 transition-opacity disabled:opacity-50'

function IconaCanale({ canale }: { canale: Richiesta['canale'] }) {
  const props = { size: 13, strokeWidth: 1.8, 'aria-hidden': true as const, className: 'shrink-0' }
  if (canale === 'web') return <Globe {...props} />
  if (canale === 'whatsapp') return <MessageCircle {...props} />
  return <Phone {...props} />
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

export default function PropostaPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const desktop = useDesktop()
  const [richiesta, setRichiesta] = useState<Richiesta & { proposta_testo?: string | null; proposta_soluzione?: Soluzione | null; proposta_alternative?: Soluzione[] | null } & Partial<CondizioniSalvate> | null>(null)
  const [camere, setCamere] = useState<Room[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneOccupante[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [manca0025, setManca0025] = useState(false)
  const [manca0029, setManca0029] = useState(false)
  const [manca0031, setManca0031] = useState(false)
  const adesso = useAdesso()   // avanza ogni minuto: timer della proposta

  // Soluzione scelta e bozza (null = quella generata; stringa = modificata a mano)
  const [indice, setIndice] = useState(0)
  const [testoModificato, setTestoModificato] = useState<string | null>(null)
  const [modo, setModo] = useState<'testo' | 'immagine'>('testo')
  const [pannelloCambia, setPannelloCambia] = useState(false)
  // Azione rimandata finché Ania non conferma di voler perdere il testo modificato a mano
  const [azioneSospesa, setAzioneSospesa] = useState<(() => void) | null>(null)
  // Condizioni di pagamento (pezzo 6): NESSUNA preselezione, le sceglie Ania ogni volta.
  const [condizioneTipo, setCondizioneTipo] = useState<CondizionePagamento | null>(null)
  const [caparraTesto, setCaparraTesto] = useState('')          // euro digitati ("70" · "72,50")
  const [condizioneTesto, setCondizioneTesto] = useState('')    // paragrafo della personalizzata
  const [ameliaAttiva, setAmeliaAttiva] = useState(false)       // interruttore, spento di default
  // «Scelgo io» (pezzo 10): camera per notte scelta a mano (null = notte scoperta) e prezzi a mano in centesimi
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
      supabase.from('bookings').select('room_id, check_in, check_out, status, num_guests, extra_bed, extra_bed_dates').in('status', ['confermata', 'completata']),
    ]).then(([ric, r, b]) => {
      const errs: string[] = []
      if (ric.error) errs.push(ric.error)
      if (r.error) errs.push(`camere: ${r.error.message}`)
      if (b.error) errs.push(`prenotazioni: ${b.error.message}`)
      setRichiesta(ric.data as typeof richiesta)
      setManca0025(!!ric.data && !colonne0025Presenti(ric.data as unknown as Record<string, unknown>))
      setManca0029(!!ric.data && !colonne0029Presenti(ric.data as unknown as Record<string, unknown>))
      setManca0031(!!ric.data && !colonne0031Presenti(ric.data as unknown as Record<string, unknown>))
      setCamere((r.data || []) as Room[])
      setPrenotazioni((b.data || []) as PrenotazioneOccupante[])
      setErrore(errs.length ? errs.join(' · ') : null)
      setLoading(false)
    })
  }, [id])

  // La ricerca può rifiutare dati incoerenti (persone per notte diverse dalle
  // notti): l'errore va a schermo, mai un ripiego silenzioso
  const { soluzioni, erroreRicerca } = useMemo(() => {
    if (!richiesta) return { soluzioni: [] as Soluzione[], erroreRicerca: null as string | null }
    try { return { soluzioni: proponiSoluzioni(richiesta, camere, prenotazioni), erroreRicerca: null } }
    catch (e) { return { soluzioni: [] as Soluzione[], erroreRicerca: String((e as Error).message ?? e) } }
  }, [richiesta, camere, prenotazioni])
  const inviata = richiesta?.stato === 'proposta_inviata'
  // Già inviata: si rilegge quel che è partito (testo e soluzione archiviati)
  const soluzioneAuto: Soluzione | null = inviata && richiesta?.proposta_soluzione
    ? richiesta.proposta_soluzione
    : (soluzioni[Math.min(indice, Math.max(0, soluzioni.length - 1))] ?? null)
  // «Scelgo io»: la soluzione nasce dalla composizione; un dato incoerente va a schermo
  const { soluzioneManuale, erroreComposizione } = useMemo(() => {
    if (!manuale || inviata || !richiesta) return { soluzioneManuale: null as Soluzione | null, erroreComposizione: null as string | null }
    try { return { soluzioneManuale: soluzioneDaComposizione(richiesta, camere, composizione, prezziManuali), erroreComposizione: null } }
    catch (e) { return { soluzioneManuale: null, erroreComposizione: String((e as Error).message ?? e) } }
  }, [manuale, inviata, richiesta, camere, composizione, prezziManuali])
  const soluzione: Soluzione | null = manuale && !inviata ? soluzioneManuale : soluzioneAuto
  // «Altre camere»: perché le camere fuori dalla soluzione non sono state proposte
  const altreCamere = useMemo(() => {
    if (!richiesta || camere.length === 0) return []
    try {
      const usate = new Set((soluzione?.segmenti ?? []).map(s => s.camera.id))
      return motiviEsclusione(richiesta, camere, prenotazioni).filter(x => !usate.has(x.camera.id))
    } catch { return [] }
  }, [richiesta, camere, prenotazioni, soluzione])
  const completo = soluzione?.caso === 'completo'
  const totaleCent = soluzione ? centesimiTotale(soluzione) : 0
  // Alternativa ad Amelia: solo se le condizioni del blocco sono soddisfatte (calcolo puro)
  const amelia = useMemo(
    () => (richiesta && soluzione && !inviata ? alternativaAmelia(richiesta, soluzione, camere, prenotazioni) : null),
    [richiesta, soluzione, camere, prenotazioni, inviata],
  )
  const caparraCent = centesimi(caparraTesto.replace(',', '.'))
  // Condizione scelta e controllo: senza scelta (o con importo/testo mancante) niente invio
  const condizione: Condizione | null =
    condizioneTipo === 'arrivo' ? { tipo: 'arrivo' }
    : condizioneTipo === 'caparra' ? { tipo: 'caparra', caparraCentesimi: caparraCent }
    : condizioneTipo === 'completo' ? { tipo: 'completo' }
    : condizioneTipo === 'personalizzata' ? { tipo: 'personalizzata', testo: condizioneTesto }
    : null
  const problemaCondizione: string | null = completo ? null
    : condizioneTipo === null ? 'Scegli le condizioni di pagamento'
    : condizioneTipo === 'caparra' && !(caparraCent > 0) ? "Scrivi l'importo della caparra"
    : condizioneTipo === 'caparra' && caparraCent > totaleCent ? 'La caparra supera il totale'
    : condizioneTipo === 'personalizzata' && condizioneTesto.trim() === '' ? 'Scrivi le condizioni di pagamento'
    : null
  // Caso A con più camere libere (pezzo 9): il messaggio le elenca tutte;
  // già inviata: quelle archiviate in proposta_alternative
  const alternative = useMemo(() => {
    if (!soluzione || soluzione.caso !== 'completa' || soluzione.manuale) return null
    if (inviata) return richiesta?.proposta_alternative ?? null
    return camereDelCasoA(soluzione, soluzioni.filter(s => s.caso === 'completa'))
  }, [soluzione, soluzioni, inviata, richiesta])
  const bozzaGenerata = richiesta && soluzione
    ? generaProposta({ richiesta, soluzione, condizione: problemaCondizione ? null : condizione, amelia: ameliaAttiva ? amelia : null, alternative })
    : ''
  const testoFinale = inviata && richiesta?.proposta_testo ? richiesta.proposta_testo : (testoModificato ?? bozzaGenerata)
  const telefonoNorm = normalizzaTelefono(richiesta?.telefono)
  const telefono = telefonoNorm.numero
  // La 0031 è necessaria solo se il messaggio elenca più camere (proposta_alternative da salvare)
  const mancaMigrazione = manca0025 ? AVVISO_0025 : manca0029 ? AVVISO_0029 : manca0031 && (alternative?.length ?? 0) > 1 ? AVVISO_0031 : null
  // Cosa si salva con «Sì, inviata» (nel caso E nessuna condizione)
  const condizioniSalvate: CondizioniSalvate = completo || !condizione
    ? { condizione_pagamento: null, caparra_centesimi: null, condizione_testo: null, amelia_alternativa: false }
    : {
      condizione_pagamento: condizione.tipo,
      caparra_centesimi: condizione.tipo === 'caparra' ? condizione.caparraCentesimi : null,
      condizione_testo: condizione.tipo === 'personalizzata' ? condizione.testo.trim() : null,
      amelia_alternativa: ameliaAttiva && amelia !== null,
    }
  const modoEffettivo = completo || soluzione === null ? 'testo' : modo

  // La textarea cresce col contenuto
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [testoFinale, modoEffettivo])

  // Altezza reale dell'immagine (per l'anteprima in scala): misurata da un
  // ResizeObserver, mai leggendo il ref durante il render.
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
      // pezzo 9/10: persone di ogni notte, notti col letto addebitato e, se
      // scritti a mano, i prezzi effettivi: le righe dicono gli stessi numeri del testo
      persone_notti: s.personeNotti && s.personeNotti.length === s.notti ? s.personeNotti : null,
      extra_bed_dates: s.lettoNotti ?? null,
      prezzi_notti: s.prezzo_manuale ? prezziNottiCentesimi(s).map(c => c / 100) : null,
    }))
    const { righe, totale } = righeCostiSegmenti(seg, seg.length > 1, n => formattaEuro(centesimi(n)))
    const lettoAggiuntivo = seg.length === 1 && lettoDaComunicare(seg[0])
    // Caso C: le notti scoperte vanno nell'immagine come spazi vuoti (mai un soggiorno continuo)
    let personeNotti: { giorno: string; persone: number }[] = []
    try { personeNotti = giorniTra(richiesta.arrivo, richiesta.partenza).map((giorno, i) => ({ giorno, persone: personePerNotte(richiesta)[i] })) } catch { personeNotti = [] }
    return { seg, righe, totale, lettoAggiuntivo, nottiNonDisponibili: nottiScoperte(richiesta, soluzione), personeNotti }
  }, [richiesta, soluzione])

  // Le azioni che rigenerano la bozza chiedono conferma se il testo è stato modificato a mano
  function conConferma(azione: () => void) {
    if (testoModificato !== null && testoModificato !== bozzaGenerata) { setAzioneSospesa(() => azione); return }
    azione()
  }
  function scegli(i: number) {
    conConferma(() => {
      // Nuova soluzione → si ricomincia dalle condizioni: mai una scelta trascinata da un'altra soluzione
      setIndice(i); setTestoModificato(null); setPannelloCambia(false); setManuale(false); setPrezzoEditor(null)
      setCondizioneTipo(null); setCaparraTesto(''); setCondizioneTesto(''); setAmeliaAttiva(false)
    })
  }
  // «Scelgo io»: parte dalla soluzione automatica corrente; «Torna alla proposta automatica» la rimette
  function apriScelgoIo() {
    if (!richiesta) return
    conConferma(() => {
      setComposizione(composizioneDaSoluzione(richiesta, soluzioneAuto))
      setPrezziManuali(giorniTra(richiesta.arrivo, richiesta.partenza).map(() => null))
      setManuale(true); setPrezzoEditor(null); setTestoModificato(null)
      setCondizioneTipo(null); setCaparraTesto(''); setCondizioneTesto(''); setAmeliaAttiva(false)
    })
  }
  function tornaAutomatica() {
    conConferma(() => { setManuale(false); setPrezzoEditor(null); setTestoModificato(null); setCondizioneTipo(null); setCaparraTesto(''); setCondizioneTesto(''); setAmeliaAttiva(false) })
  }
  const nomeCamera = (id: string | null) => (id === null ? 'nessuna' : (camere.find(c => c.id === id)?.name ?? '?'))
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
  function scegliCondizione(tipo: CondizionePagamento) {
    conConferma(() => {
      setCondizioneTipo(tipo)
      // Caparra: precompilata col 50% del totale, ma modificabile
      if (tipo === 'caparra' && caparraTesto === '') setCaparraTesto(fmtPrezzo(caparraDefault(totaleCent) / 100))
    })
  }
  function cambiaAmelia(attiva: boolean) { conConferma(() => setAmeliaAttiva(attiva)) }

  // Apre WhatsApp e basta: lo stato NON cambia qui. Cambia solo con «Sì, inviata».
  function invia() {
    if (!richiesta || !soluzione) return
    setErrore(null); setAvviso(null)
    if (mancaMigrazione) { setErrore(mancaMigrazione); return }
    if (!inviata && problemaCondizione) { setErrore(problemaCondizione); return }
    if (!telefono) { setErrore('Nessun numero di telefono sulla richiesta: aggiungilo prima di inviare.'); return }
    try { window.localStorage.setItem(chiavePendente, JSON.stringify({ testo: testoFinale, condizioni: condizioniSalvate })) } catch { /* senza memoria la barra vive solo in pagina */ }
    openWhatsApp(telefono, testoFinale)
    setChiediConferma(true)
  }

  // Ripresa dopo un ricaricamento: se c'è un invio in sospeso, la barra torna
  useEffect(() => {
    if (!id || loading || !richiesta) return
    let salvato: { testo?: string; condizioni?: Partial<CondizioniSalvate> } | null = null
    try { salvato = JSON.parse(window.localStorage.getItem(chiavePendente) || 'null') } catch { salvato = null }
    if (!salvato) return
    const testoSalvato = salvato.testo
    const condSalvate = salvato.condizioni
    const t = setTimeout(() => {
      setChiediConferma(true)
      if (richiesta.stato !== 'proposta_inviata') {
        if (testoSalvato) setTestoModificato(prev => prev ?? testoSalvato)
        // Anche le condizioni scelte tornano, così «Sì, inviata» salva quel che è partito
        if (condSalvate?.condizione_pagamento) {
          setCondizioneTipo(condSalvate.condizione_pagamento)
          if (condSalvate.caparra_centesimi) setCaparraTesto(fmtPrezzo(condSalvate.caparra_centesimi / 100))
          if (condSalvate.condizione_testo) setCondizioneTesto(condSalvate.condizione_testo)
          setAmeliaAttiva(!!condSalvate.amelia_alternativa)
        }
      }
    }, 0)
    return () => clearTimeout(t)
  }, [id, loading, richiesta, chiavePendente])

  function rispostaNo() {
    try { window.localStorage.removeItem(chiavePendente) } catch { /* niente */ }
    setChiediConferma(false)
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
    if (!richiesta || !soluzione) return
    setErrore(null); setAvviso(null); setOccupato('invio')
    const r = await segnaPropostaInviata(richiesta.id, testoFinale, soluzione, condizioniSalvate, alternative)
    setOccupato(null)
    if (r.error) { setErrore(`Stato non aggiornato: ${r.error}`); return }
    try { window.localStorage.removeItem(chiavePendente) } catch { /* niente */ }
    setChiediConferma(false)
    setRichiesta({ ...richiesta, stato: 'proposta_inviata', proposta_inviata_at: r.proposta_inviata_at, proposta_testo: testoFinale, proposta_soluzione: soluzione, proposta_alternative: alternative && alternative.length > 1 ? alternative : null, ...condizioniSalvate })
  }

  async function rifiuta(motivo?: string) {
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

  const riepilogo = (
    <div className="bg-white rounded-xl border border-[#C9BFA8] shadow-sm p-4 leading-snug">
      <p className="text-[15px] text-green-dark">
        {formatIntervallo(richiesta.arrivo, richiesta.partenza)}
        <span className="text-stone"> · </span>
        <span className="font-semibold text-brass">{n === 1 ? '1 notte' : `${n} notti`}</span>
        <span className="text-stone"> · </span>
        {richiesta.persone_per_notte ? riassuntoPersone(richiesta.arrivo, richiesta.persone_per_notte) : `${richiesta.persone} ${richiesta.persone === 1 ? 'persona' : 'persone'}`}
      </p>
      <p className="text-sm text-green-dark mt-1">Camera richiesta: <span className="font-medium">{richiesta.rooms?.name || 'qualsiasi'}</span></p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-stone mt-1.5">
        <span className="inline-flex items-center gap-1"><IconaCanale canale={richiesta.canale} />{CANALE_LABEL[richiesta.canale]}</span>
        <span aria-hidden>·</span>
        <span>{oraArrivo(richiesta.created_at, adesso)}</span>
      </p>
      {/* timer delle 3 ore: stesso testo della lista e del tooltip del calendario */}
      <RigaScadenza r={richiesta} adesso={adesso} className="mt-1.5" />
      {modificabile(richiesta) && (
        <Link href={`/richieste/${richiesta.id}/modifica`} className="inline-block mt-2 text-sm font-semibold text-green-mid underline underline-offset-2">Modifica la richiesta</Link>
      )}
      <p className="text-sm mt-1.5">
        {richiesta.telefono
          ? <span className="text-green-dark">{richiesta.telefono}{telefonoNorm.avviso && <span className="ml-2 text-xs font-semibold text-[#8C3B2E]">{telefonoNorm.avviso}</span>}</span>
          : <span className="text-[#8C3B2E] font-semibold">Nessun numero di telefono</span>}
      </p>
    </div>
  )

  const caso = soluzione && (
    <div className="flex items-center gap-2 mt-3 flex-wrap">
      <span className="shrink-0 rounded-full bg-green-mid text-cream-text text-xs font-semibold px-3 py-1">{ETICHETTA_CASO[soluzione.caso]}</span>
      <span className="text-sm text-green-dark min-w-0 flex-1 truncate">
        {soluzione.segmenti.length > 0 ? <>{riassuntoSegmenti(soluzione)} · <span className="font-semibold">{fmtPrezzo(soluzione.prezzoTotale)} €</span></> : 'nessuna camera libera'}
      </span>
      {!inviata && (
        <button type="button" onClick={() => setPannelloCambia(true)} className="shrink-0 text-sm font-semibold text-green-mid underline underline-offset-2">Cambia</button>
      )}
      {!inviata && !manuale && (
        <button type="button" onClick={apriScelgoIo} className="shrink-0 text-sm font-semibold text-green-mid underline underline-offset-2">Scelgo io</button>
      )}
    </div>
  )

  // ── Altre camere (pezzo 10): sempre visibile, con il motivo ──────────────
  const altre = altreCamere.length > 0 && (
    <div className="mt-3 bg-white rounded-xl border border-[#C9BFA8] shadow-sm px-3 py-2.5">
      <p className="text-xs font-semibold text-stone mb-1">Altre camere</p>
      <ul className="text-sm text-green-dark divide-y-[0.5px] divide-border-soft">
        {altreCamere.map(x => (
          <li key={x.camera.id} className="flex items-baseline justify-between gap-3 py-1">
            <span className="font-medium">{x.camera.name}</span>
            <span className={`text-right ${x.motivo.stato === 'libera' ? 'text-green-mid' : 'text-stone'}`}>{testoMotivo(x.motivo)}</span>
          </li>
        ))}
      </ul>
    </div>
  )

  // ── «Scelgo io» (pezzo 10): striscia camera per notte + prezzo a mano ────
  const scelgoIo = manuale && !inviata && richiesta && (
    <div className="mt-3 bg-white rounded-xl border border-[#C9BFA8] shadow-sm p-3" role="group" aria-label="Scelgo io">
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-green-dark">Scelgo io · tocca una notte per cambiare camera</p>
        <button type="button" onClick={tornaAutomatica} className="shrink-0 text-xs font-semibold text-green-mid underline underline-offset-2">Torna alla proposta automatica</button>
      </div>
      <StrisciaNotti<string | null> arrivo={richiesta.arrivo} partenza={richiesta.partenza} valori={composizione} aria="Camera notte per notte"
        onChange={v => { setComposizione(v); setPrezziManuali(p => p.map((x, k) => (v[k] === composizione[k] ? x : null))); setPrezzoEditor(null) }}
        cicla={(v, verso, i) => {
          const ammesse = camereAmmesseNotte(i, richiesta, camere, prenotazioni)
          if (verso === 1) return cameraSuccessiva(v, ammesse)
          const ids: (string | null)[] = [...ammesse.map(c => c.id), null]
          const k = ids.indexOf(v)
          return ids[(k <= 0 ? ids.length : k) - 1]
        }}
        opzioni={i => [...camereAmmesseNotte(i, richiesta, camere, prenotazioni).map(c => ({ valore: c.id as string | null, etichetta: c.name })), { valore: null, etichetta: 'nessuna' }]}
        menuDesktop={desktop}
        mostra={(v, i) => ({
          centro: nomeCamera(v),
          sotto: v === null ? 'scoperta' : `${personeNottiRichiesta[i] ?? ''} pers. · ${(prezziManuali[i] ?? prezziTariffa[i]) != null ? fmtPrezzo(((prezziManuali[i] ?? prezziTariffa[i]) as number) / 100) + ' €' : '—'}`,
          evidenziata: v === null,
          contorno: prezziManuali[i] != null ? '#A9884E' : undefined,
        })}
        onLungo={apriPrezzo} />
      <p className="text-xs text-green-dark mt-2">
        {riassuntoPerNotte(richiesta.arrivo, composizione.map(nomeCamera))}
        {soluzione ? <> · totale <span className="font-semibold">{formattaEuro(totaleCentesimi(soluzione))}</span></> : null}
        {prezziManuali.some(p => p != null) && <span className="ml-1 font-semibold" style={{ color: '#A9884E' }}>· prezzo modificato</span>}
      </p>
      <p className="text-[11px] mt-1" style={{ color: GRIGIO_NOTA }}>Tieni premuta una notte{desktop ? ' (o la matita)' : ''} per scrivere il prezzo a mano.</p>
      {erroreComposizione && <div role="alert" className="mt-2 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-2.5 text-sm text-[#8C3B2E]">{erroreComposizione}</div>}
      {prezzoEditor !== null && composizione[prezzoEditor] !== null && (
        <div className="mt-3 bg-sand rounded-xl p-3" role="group" aria-label="Prezzo a mano">
          <p className="text-sm font-semibold text-green-dark mb-1.5">Prezzo della notte del {etichettaNotte(giorniTra(richiesta.arrivo, richiesta.partenza)[prezzoEditor])} · {nomeCamera(composizione[prezzoEditor])}</p>
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
  const condizioneInviata = inviata ? condizioneDaColonne(richiesta) : null
  const riassuntoCondizione = condizioneInviata
    ? `${ETICHETTA_CONDIZIONE[condizioneInviata.tipo]}${condizioneInviata.tipo === 'caparra' ? ` ${formattaEuro(condizioneInviata.caparraCentesimi)}` : ''}${richiesta.amelia_alternativa ? ' · con alternativa ad Amelia' : ''}`
    : null

  const condizioni = !inviata && soluzione && !completo && (
    <div className="mt-3" role="group" aria-label="Condizioni di pagamento">
      <p className="text-sm font-semibold text-green-dark mb-2">Condizioni di pagamento</p>
      <div className="flex flex-wrap gap-2">
        {CONDIZIONI_PAGAMENTO.map(tipo => (
          <button key={tipo} type="button" onClick={() => scegliCondizione(tipo)} aria-pressed={condizioneTipo === tipo}
            className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors ${condizioneTipo === tipo ? 'bg-green-mid text-cream-text' : 'bg-white text-green-dark border border-[#C9BFA8]'}`}>
            {ETICHETTA_CONDIZIONE[tipo]}
          </button>
        ))}
      </div>
      {condizioneTipo === 'caparra' && (
        <div className="mt-2.5">
          <label className="block text-xs mb-1" style={{ color: GRIGIO_NOTA }} htmlFor="caparra">Caparra confirmatoria (€) · proposta al {fmtPrezzo(caparraDefault(totaleCent) / 100)} €, cioè il 50% di {fmtPrezzo(totaleCent / 100)} €</label>
          <input id="caparra" type="text" inputMode="decimal" value={caparraTesto} onChange={e => setCaparraTesto(e.target.value)} aria-label="Importo della caparra in euro"
            className="w-full min-w-0 appearance-none bg-white rounded-xl px-3 py-2.5 text-[15px] text-green-dark focus:outline-none focus:border-green-mid" style={{ border: `1px solid ${BORDO}` }} />
          {problemaCondizione && problemaCondizione !== 'Scegli le condizioni di pagamento' && <p className="text-xs mt-1 font-semibold text-[#8C3B2E]">{problemaCondizione}</p>}
        </div>
      )}
      {condizioneTipo === 'personalizzata' && (
        <div className="mt-2.5">
          <label className="block text-xs mb-1" style={{ color: GRIGIO_NOTA }} htmlFor="condizione-testo">Scrivi il paragrafo delle condizioni: la chiusura «Grazie mille, Ania – Casa Ania» viene aggiunta da sola</label>
          <textarea id="condizione-testo" value={condizioneTesto} onChange={e => setCondizioneTesto(e.target.value)} rows={4} aria-label="Condizioni di pagamento personalizzate"
            className="w-full bg-white rounded-xl p-3 text-[13px] text-green-dark leading-relaxed resize-none focus:outline-none focus:border-green-mid" style={{ border: `1px solid ${BORDO}` }} />
        </div>
      )}
      {amelia && (
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
  )

  const bozza = (
    <div>
      {!inviata && (
        <div className="flex gap-2 mb-3">
          {([['testo', 'Solo testo'], ['immagine', 'Testo + immagine']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setModo(k)} aria-pressed={modoEffettivo === k} disabled={k === 'immagine' && (completo || !immagine)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 ${modoEffettivo === k ? 'bg-green-mid text-cream-text' : 'bg-white text-stone border border-[#C9BFA8]'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {inviata ? (
        <>
          <div className="bg-white rounded-xl p-3 text-[13px] text-green-dark whitespace-pre-wrap leading-relaxed" style={{ border: `1px solid ${BORDO}` }}>{testoFinale}</div>
          {riassuntoCondizione && <p className="text-xs mt-1.5" style={{ color: GRIGIO_NOTA }}>Condizioni inviate: {riassuntoCondizione}</p>}
        </>
      ) : (
        <textarea ref={textareaRef} value={testoFinale} onChange={e => setTestoModificato(e.target.value)} rows={6} spellCheck={false}
          aria-label="Bozza del messaggio"
          className="w-full bg-white rounded-xl p-3 text-[13px] text-green-dark leading-relaxed resize-none focus:outline-none focus:border-green-mid"
          style={{ border: `1px solid ${BORDO}` }} />
      )}
      {!inviata && testoModificato !== null && testoModificato !== bozzaGenerata && (
        <p className="text-xs mt-1" style={{ color: GRIGIO_NOTA }}>Testo modificato a mano: ha la precedenza sulla bozza. <button type="button" className="underline" onClick={() => setTestoModificato(null)}>Ripristina la bozza</button></p>
      )}

      {modoEffettivo === 'immagine' && immagine && !inviata && (
        <div className="mt-3">
          <p className="text-xs mb-1.5" style={{ color: GRIGIO_NOTA }}>Anteprima dell’immagine</p>
          <div ref={el => { if (el) setScala(el.clientWidth / IMG_W) }} className="w-full rounded-xl overflow-hidden border border-[#C9BFA8] shadow-sm bg-white" style={{ height: imgH ? imgH * scala : undefined }}>
            <div style={{ transform: `scale(${scala})`, transformOrigin: 'top left', width: IMG_W }}>
              <ImmagineSoggiorno imgRef={imgRef} variante="proposta" nome={richiesta.nome.trim()} segmenti={immagine.seg} numOspiti={richiesta.persone}
                righeCosti={immagine.righe} totale={immagine.totale} pagamento="contanti" lettoAggiuntivo={immagine.lettoAggiuntivo} nottiNonDisponibili={immagine.nottiNonDisponibili} personeNotti={immagine.personeNotti} lineaSempre={!!soluzione?.manuale} formattaImporto={n => formattaEuro(centesimi(n))} />
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
      {avviso && <div role="status" className="mt-3 bg-white border border-[#C9BFA8] shadow-sm rounded-xl p-3 text-sm text-green-dark">{avviso}</div>}

      <button type="button" onClick={invia} disabled={!!occupato || !soluzione || chiediConferma || !!mancaMigrazione || (!inviata && !!problemaCondizione)} className={`${PIENO} mt-4`}>
        <IconaWhatsApp />
        {inviata ? 'Invia di nuovo' : problemaCondizione ? problemaCondizione : (modoEffettivo === 'immagine' ? '2 · Apri WhatsApp e invia' : 'Apri WhatsApp e invia')}
      </button>
      {chiediConferma && (
        <div ref={barraRef} role="group" aria-label="Conferma dell'invio" className="scheda-in mt-3 bg-white rounded-xl p-3" style={{ border: `1px solid ${BORDO}` }}>
          <p className="text-sm font-medium text-green-dark mb-2">L’hai inviata?</p>
          <div className="flex gap-2">
            <button type="button" onClick={confermaInviata} disabled={occupato === 'invio'}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-green-mid text-cream-text disabled:opacity-50 active:opacity-80">
              {occupato === 'invio' ? 'Salvo…' : 'Sì, inviata'}
            </button>
            <button type="button" onClick={rispostaNo} disabled={occupato === 'invio'}
              className="flex-1 rounded-xl py-2.5 text-sm font-semibold bg-white text-green-dark border disabled:opacity-50" style={{ borderColor: BORDO }}>
              No
            </button>
          </div>
          <p className="text-xs mt-2" style={{ color: GRIGIO_NOTA }}>Solo «Sì, inviata» segna la richiesta come proposta inviata.</p>
        </div>
      )}
      <p className="text-xs text-center mt-2" style={{ color: GRIGIO_NOTA }}>
        {inviata ? `Proposta inviata ${richiesta.proposta_inviata_at ? tempoTrascorso(richiesta.proposta_inviata_at, adesso) : ''}. Un nuovo invio, confermato, aggiorna l’ora.` : 'Dopo l’invio, confermato con «Sì, inviata», la richiesta passa a ‘Proposta inviata’.'}
      </p>
      {inviata && (
        <button type="button" onClick={async () => { const { data } = await fetchRichieste(); setConfermando({ aperte: data }) }}
          className="w-full mt-3 rounded-xl py-3 text-[15px] font-semibold bg-white text-green-dark border active:bg-sage" style={{ borderColor: BORDO }}>
          Conferma → crea la prenotazione
        </button>
      )}
      <div className="text-center mt-6">
        <button type="button" onClick={() => setDaRifiutare(true)} className="text-xs underline underline-offset-2" style={{ color: GRIGIO_NOTA }}>Rifiuta subito</button>
      </div>
    </div>
  )

  return (
    <div className="p-4">
      <BackBar href="/richieste" />
      <h1 className="text-[22px] text-green-dark leading-tight mb-3" style={FRAUNCES}>Proposta per {nomeCompleto(richiesta)}</h1>
      {mancaMigrazione && (
        <div role="alert" className="mb-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">
          {mancaMigrazione} Finché manca, la proposta non può essere registrata.
        </div>
      )}
      {erroreRicerca && (
        <div role="alert" className="mb-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{erroreRicerca}</div>
      )}

      <div className="md:grid md:grid-cols-[2fr_3fr] md:gap-5 md:items-start">
        <section>
          {riepilogo}
          {caso}
          {altre}
          {scelgoIo}
          {condizioni}
        </section>
        <section className="mt-4 md:mt-0 min-w-0">
          {bozza}
        </section>
      </div>

      {/* Altre soluzioni trovate */}
      {pannelloCambia && (
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Altre soluzioni">
          <div className="velo-in absolute inset-0 bg-green-dark/30" onClick={() => setPannelloCambia(false)} />
          <div className={`scheda-in absolute bg-white shadow-lg overflow-y-auto ${desktop ? 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl w-[420px] max-h-[70vh] p-4' : 'left-0 right-0 bottom-0 rounded-t-2xl px-4 pt-2 pb-[calc(1rem+env(safe-area-inset-bottom))] max-h-[75dvh]'}`}>
            {!desktop && <div className="w-10 h-1 rounded-full bg-border-soft mx-auto mb-3" aria-hidden />}
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-semibold text-green-dark">Soluzioni trovate</p>
              <button type="button" onClick={() => setPannelloCambia(false)} aria-label="Chiudi" className="w-9 h-9 -mr-2 flex items-center justify-center text-stone"><X size={18} strokeWidth={2} aria-hidden /></button>
            </div>
            {soluzioni.length <= 1 && <p className="text-sm text-stone py-2">Nessun&apos;altra soluzione automatica.</p>}
            <ul className="divide-y-[0.5px] divide-border-soft">
              {soluzioni.map((s, i) => (
                <li key={i}>
                  <button type="button" onClick={() => scegli(i)} aria-pressed={i === indice} className={`w-full text-left py-3 flex items-start gap-3 ${i === indice ? 'opacity-100' : ''}`}>
                    <span className={`shrink-0 rounded-full text-xs font-semibold px-2.5 py-0.5 ${i === indice ? 'bg-green-mid text-cream-text' : 'bg-sage text-green-dark'}`}>{ETICHETTA_CASO[s.caso]}</span>
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
          onChiudi={() => setConfermando(null)} onCreata={(id, avviso) => router.push(`/prenotazioni/${id}?da=richiesta${avviso ? `&avviso=${encodeURIComponent(avviso)}` : ''}`)} />
      )}
      {daRifiutare && (
        <ConfermaDialog titolo={`Rifiutare la richiesta di ${nomeCompleto(richiesta)}?`} testo="Nessun messaggio parte da qui." conferma="Rifiuta" occupato={occupato === 'rifiuto'} scelte={MOTIVI_RIFIUTO}
          onConferma={rifiuta} onAnnulla={() => { if (occupato !== 'rifiuto') setDaRifiutare(false) }} />
      )}
    </div>
  )
}
