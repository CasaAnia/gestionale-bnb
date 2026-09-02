'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Globe, Phone, MessageCircle, X } from 'lucide-react'
import BackBar from '@/components/BackBar'
import ConfermaDialog from '@/components/richieste/ConfermaDialog'
import ImmagineSoggiorno, { IMG_W } from '@/components/ImmagineSoggiorno'
import { supabase } from '@/lib/supabase'
import { fetchRichiesta, rifiutaRichiesta, segnaPropostaInviata } from '@/lib/richiesteDati'
import { proponiSoluzioni, ETICHETTA_CASO, type Soluzione, type PrenotazioneOccupante } from '@/lib/richiesteProposta'
import { componiBozza, prezzo as fmtPrezzo } from '@/lib/richiesteTesti'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import { lettoDaComunicare } from '@/lib/tariffe'
import { openWhatsApp, normalizzaTelefono } from '@/lib/whatsapp'
import { salvaImmagine, copiaImmagine, isMobile } from '@/lib/immaginePng'
import { useDesktop } from '@/lib/richiesteVista'
import {
  CANALE_LABEL, nomeCompleto, nottiRichiesta, formatIntervallo, oraArrivo, tempoTrascorso, type Richiesta,
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
  const [richiesta, setRichiesta] = useState<Richiesta & { proposta_testo?: string | null; proposta_soluzione?: Soluzione | null } | null>(null)
  const [camere, setCamere] = useState<Room[]>([])
  const [prenotazioni, setPrenotazioni] = useState<PrenotazioneOccupante[]>([])
  const [loading, setLoading] = useState(true)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [adesso] = useState(() => new Date())

  // Soluzione scelta e bozza (null = quella generata; stringa = modificata a mano)
  const [indice, setIndice] = useState(0)
  const [testoModificato, setTestoModificato] = useState<string | null>(null)
  const [modo, setModo] = useState<'testo' | 'immagine'>('testo')
  const [pannelloCambia, setPannelloCambia] = useState(false)
  const [daSostituire, setDaSostituire] = useState<number | null>(null)
  const [daRifiutare, setDaRifiutare] = useState(false)
  const [occupato, setOccupato] = useState<'invio' | 'rifiuto' | 'immagine' | null>(null)
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
      supabase.from('bookings').select('room_id, check_in, check_out, status').in('status', ['confermata', 'completata']),
    ]).then(([ric, r, b]) => {
      const errs: string[] = []
      if (ric.error) errs.push(ric.error)
      if (r.error) errs.push(`camere: ${r.error.message}`)
      if (b.error) errs.push(`prenotazioni: ${b.error.message}`)
      setRichiesta(ric.data as typeof richiesta)
      setCamere((r.data || []) as Room[])
      setPrenotazioni((b.data || []) as PrenotazioneOccupante[])
      setErrore(errs.length ? errs.join(' · ') : null)
      setLoading(false)
    })
  }, [id])

  const soluzioni = useMemo(
    () => (richiesta ? proponiSoluzioni(richiesta, camere, prenotazioni) : []),
    [richiesta, camere, prenotazioni],
  )
  const inviata = richiesta?.stato === 'proposta_inviata'
  // Già inviata: si rilegge quel che è partito (testo e soluzione archiviati)
  const soluzione: Soluzione | null = inviata && richiesta?.proposta_soluzione
    ? richiesta.proposta_soluzione
    : (soluzioni[Math.min(indice, Math.max(0, soluzioni.length - 1))] ?? null)
  const bozzaGenerata = richiesta && soluzione ? componiBozza(richiesta, soluzione) : ''
  const testoFinale = inviata && richiesta?.proposta_testo ? richiesta.proposta_testo : (testoModificato ?? bozzaGenerata)
  const telefono = normalizzaTelefono(richiesta?.telefono)
  const completo = soluzione?.caso === 'completo'
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
    }))
    const { righe, totale } = righeCostiSegmenti(seg, seg.length > 1)
    const lettoAggiuntivo = seg.length === 1 && lettoDaComunicare(seg[0])
    return { seg, righe, totale, lettoAggiuntivo }
  }, [richiesta, soluzione])

  function scegli(i: number) {
    if (testoModificato !== null && testoModificato !== bozzaGenerata) { setDaSostituire(i); return }
    setIndice(i); setTestoModificato(null); setPannelloCambia(false)
  }

  async function invia() {
    if (!richiesta || !soluzione) return
    setErrore(null); setAvviso(null)
    if (!telefono) { setErrore('Nessun numero di telefono sulla richiesta: aggiungilo prima di inviare.'); return }
    setOccupato('invio')
    openWhatsApp(telefono, testoFinale)
    const r = await segnaPropostaInviata(richiesta.id, testoFinale, soluzione)
    setOccupato(null)
    if (r.error) { setErrore(`Stato non aggiornato: ${r.error}`); return }
    setRichiesta({ ...richiesta, stato: 'proposta_inviata', proposta_inviata_at: r.proposta_inviata_at, proposta_testo: testoFinale, proposta_soluzione: soluzione })
    if (r.avviso) setAvviso(r.avviso)
  }

  async function rifiuta() {
    if (!richiesta) return
    setOccupato('rifiuto')
    const { error } = await rifiutaRichiesta(richiesta.id)
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
    <div className="bg-white rounded-xl border border-card-border p-4 leading-snug">
      <p className="text-[15px] text-green-dark">
        {formatIntervallo(richiesta.arrivo, richiesta.partenza)}
        <span className="text-stone"> · </span>
        <span className="font-semibold text-brass">{n === 1 ? '1 notte' : `${n} notti`}</span>
        <span className="text-stone"> · </span>
        {richiesta.persone} {richiesta.persone === 1 ? 'persona' : 'persone'}
      </p>
      <p className="text-sm text-green-dark mt-1">Camera richiesta: <span className="font-medium">{richiesta.rooms?.name || 'qualsiasi'}</span></p>
      <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-stone mt-1.5">
        <span className="inline-flex items-center gap-1"><IconaCanale canale={richiesta.canale} />{CANALE_LABEL[richiesta.canale]}</span>
        <span aria-hidden>·</span>
        <span>{oraArrivo(richiesta.created_at, adesso)}</span>
        {richiesta.stato === 'proposta_inviata' && richiesta.proposta_inviata_at && (
          <><span aria-hidden>·</span><span className="text-green-mid font-semibold">proposta inviata {tempoTrascorso(richiesta.proposta_inviata_at, adesso)}</span></>
        )}
      </p>
      <p className="text-sm mt-1.5">
        {richiesta.telefono
          ? <span className="text-green-dark">{richiesta.telefono}</span>
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
      {!inviata && soluzioni.length > 1 && (
        <button type="button" onClick={() => setPannelloCambia(true)} className="shrink-0 text-sm font-semibold text-green-mid underline underline-offset-2">Cambia</button>
      )}
    </div>
  )

  const bozza = (
    <div>
      {!inviata && (
        <div className="flex gap-2 mb-3">
          {([['testo', 'Solo testo'], ['immagine', 'Testo + immagine']] as const).map(([k, label]) => (
            <button key={k} type="button" onClick={() => setModo(k)} aria-pressed={modoEffettivo === k} disabled={k === 'immagine' && (completo || !immagine)}
              className={`px-3.5 py-1.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 ${modoEffettivo === k ? 'bg-green-mid text-cream-text' : 'bg-white text-stone border border-card-border'}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {inviata ? (
        <div className="bg-white rounded-xl p-3 text-[13px] text-green-dark whitespace-pre-wrap leading-relaxed" style={{ border: `1px solid ${BORDO}` }}>{testoFinale}</div>
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
          <div ref={el => { if (el) setScala(el.clientWidth / IMG_W) }} className="rounded-xl overflow-hidden border border-card-border bg-white" style={{ height: imgH ? imgH * scala : undefined }}>
            <div style={{ transform: `scale(${scala})`, transformOrigin: 'top left', width: IMG_W }}>
              <ImmagineSoggiorno imgRef={imgRef} variante="proposta" nome={richiesta.nome.trim()} segmenti={immagine.seg} numOspiti={richiesta.persone}
                righeCosti={immagine.righe} totale={immagine.totale} pagamento="contanti" lettoAggiuntivo={immagine.lettoAggiuntivo} />
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
      {avviso && <div role="status" className="mt-3 bg-sand border border-card-border rounded-xl p-3 text-sm text-green-dark">{avviso}</div>}

      <button type="button" onClick={invia} disabled={!!occupato || !soluzione} className={`${PIENO} mt-4`}>
        <IconaWhatsApp />
        {occupato === 'invio' ? 'Apro WhatsApp…' : inviata ? 'Invia di nuovo' : (modoEffettivo === 'immagine' ? '2 · Apri WhatsApp e invia' : 'Apri WhatsApp e invia')}
      </button>
      <p className="text-xs text-center mt-2" style={{ color: GRIGIO_NOTA }}>
        {inviata ? `Proposta inviata ${richiesta.proposta_inviata_at ? tempoTrascorso(richiesta.proposta_inviata_at, adesso) : ''}. Un nuovo invio aggiorna l’ora.` : 'Dopo l’invio la richiesta passa a ‘Proposta inviata’.'}
      </p>
      <div className="text-center mt-6">
        <button type="button" onClick={() => setDaRifiutare(true)} className="text-xs underline underline-offset-2" style={{ color: GRIGIO_NOTA }}>Rifiuta subito</button>
      </div>
    </div>
  )

  return (
    <div className="p-4">
      <BackBar href="/richieste" />
      <h1 className="text-[22px] text-green-dark leading-tight mb-3" style={FRAUNCES}>Proposta per {nomeCompleto(richiesta)}</h1>

      <div className="md:grid md:grid-cols-[2fr_3fr] md:gap-5 md:items-start">
        <section>
          {riepilogo}
          {caso}
        </section>
        <section className="mt-4 md:mt-0">
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

      {daSostituire !== null && (
        <ConfermaDialog titolo="Sostituire il testo modificato?" testo="La bozza verrà rigenerata con la nuova soluzione e le modifiche a mano andranno perse."
          conferma="Sostituisci" onConferma={() => { setIndice(daSostituire); setTestoModificato(null); setDaSostituire(null); setPannelloCambia(false) }} onAnnulla={() => setDaSostituire(null)} />
      )}
      {daRifiutare && (
        <ConfermaDialog titolo={`Rifiutare la richiesta di ${nomeCompleto(richiesta)}?`} testo="Nessun messaggio parte da qui." conferma="Rifiuta" occupato={occupato === 'rifiuto'}
          onConferma={rifiuta} onAnnulla={() => { if (occupato !== 'rifiuto') setDaRifiutare(false) }} />
      )}
    </div>
  )
}
