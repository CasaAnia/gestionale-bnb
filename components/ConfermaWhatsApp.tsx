'use client'
import { useEffect, useRef, useState } from 'react'
import { ROOM_SLUG_BY_NAME } from '@/lib/roomTypes'
import { lettoDaComunicare } from '@/lib/tariffe'
import { SITO_URL } from '@/lib/config'
import { nomeOspite } from '@/lib/guestName'
import { causaleBonifico } from '@/lib/causale'
import { residuoDaPagare } from '@/lib/conto'
import type { Booking } from '@/lib/types'
import { righeCostiSegmenti } from '@/lib/riepilogoCosti'
import ImmagineSoggiorno, { IMG_W } from '@/components/ImmagineSoggiorno'
import { generaPng as generaPngDa } from '@/lib/immaginePng'

// colonne migrate a mano (assenti dall'interfaccia Booking di lib/types)
type PrenotazioneConferma = Booking & {
  bonifico?: boolean | null
  pagato?: boolean | null
  extra_bed_dates?: string[] | null
}
type PagamentoConferma = { amount: number | string; paid_on?: string | null }

// Conferma di prenotazione WhatsApp: immagine grafica (1080px, identità visiva
// del sito casaaniarozzano.it) + messaggio di testo con i link, pronti da inviare.


function formatDateIT(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Dati per il bonifico anticipato: gli stessi delle conferme testuali WhatsApp
const BONIFICO_INTESTATARIO = 'SAWICKA ANNA JANINA'
const BONIFICO_IBAN = 'IT32P0503401753000000159653'

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function formatGiornoMese(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { day: 'numeric', month: 'long' })
}


export default function ConfermaWhatsApp({ booking, groupBookings, payments = [], onClose }: { booking: PrenotazioneConferma; groupBookings: PrenotazioneConferma[]; payments?: PagamentoConferma[]; onClose: () => void }) {
  const imgRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  const [imgH, setImgH] = useState(0)
  const [busy, setBusy] = useState<'share' | 'download' | 'copyimg' | 'save' | null>(null)
  const [copied, setCopied] = useState(false)
  const [imgCopied, setImgCopied] = useState(false)
  const [saved, setSaved] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [pagamento, setPagamento] = useState<'contanti' | 'bonifico'>(booking.bonifico ? 'bonifico' : 'contanti')

  // Su telefono WhatsApp spesso non permette di incollare immagini dagli appunti:
  // lì il flusso passa da "salva in galleria + allega dalla chat"
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : ''
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isMobile = isIOS || /Android/i.test(ua)

  const isGruppo = groupBookings.length > 1
  const segmenti = isGruppo ? [...groupBookings].sort((a, z) => a.check_in.localeCompare(z.check_in)) : [booking]
  const cin = segmenti[0].check_in
  const numOspiti = booking.num_guests || 1
  const ospiti = `${numOspiti} ${numOspiti === 1 ? 'adulto' : 'adulti'}`
  // Alcune schede cliente portano caratteri invisibili residui davanti al nome
  // (es. U+FE0F di una vecchia emoji): il saluto deve risultare "Gentile Nome Cognome,"
  // pulito, senza spazi anomali né caratteri di formattazione.
  const nome = nomeOspite(booking).replace(/[\u200B-\u200D\uFE0F]/g, '').replace(/\s+/g, ' ').trim()

  // Righe del riepilogo costi dal conto unico (lib/riepilogoCosti, condivisa con la proposta)
  const { righe: righeCosti, totale } = righeCostiSegmenti(segmenti, isGruppo)
  // Importo da bonificare = residuo quando ci sono pagamenti già registrati
  const ricevuto = (payments || []).reduce((s: number, p) => s + Number(p.amount || 0), 0)
  const importoBonifico = residuoDaPagare(totale, payments)

  // Variante bonifico: scadenza = domani, anticipata al giorno di arrivo se precedente
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  const scadenza = cin <= toYMD(domani) ? cin : toYMD(domani)
  const scadenzaF = formatGiornoMese(scadenza)
  const causale = causaleBonifico(segmenti, nome)

  // Messaggio di testo con i link (con cambio camera: un link per ogni camera)
  const slugs = [...new Set(segmenti.map(s => (s.rooms?.name ? ROOM_SLUG_BY_NAME[s.rooms.name] : undefined)).filter(Boolean))]
  const linkCamere = slugs.map(sl => `${SITO_URL}/camere/${sl}`).join('\n')
  const testoMessaggio = `​
Gentile ${nome},

la sua prenotazione è confermata. 🌿

*Nell'immagine trova il riepilogo completo del soggiorno: date, camera, importo, pagamento e indirizzo. Può toccarla per visualizzarla a schermo intero.*

Le lascio anche due link che possono esserle utili:

*Informazioni utili per il soggiorno:*
${SITO_URL}/info

*La sua camera:*
${linkCamere}

💬 Appena le sarà possibile, le chiedo di comunicarmi l'orario di arrivo, così potrò organizzare al meglio la sua accoglienza.

*Per qualsiasi necessità, sono a sua disposizione.*

A presto,
Ania`

  // Anteprima in scala + altezza reale dell'immagine
  useEffect(() => {
    function measure() {
      if (frameRef.current) setScale(frameRef.current.clientWidth / IMG_W)
      if (imgRef.current) setImgH(imgRef.current.offsetHeight)
    }
    measure()
    const t = setTimeout(measure, 300)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [pagamento])

  async function generaPng(): Promise<{ dataUrl: string; file: File }> {
    const cognome = nome.trim().split(' ').slice(-1)[0].toLowerCase() || 'ospite'
    return generaPngDa(imgRef.current!, `conferma-${cognome}-${cin}.png`)
  }

  async function condividi() {
    setErrore(null); setBusy('share')
    try {
      const { file } = await generaPng()
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        await scaricaInterno()
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') setErrore('Condivisione non riuscita: usa "Scarica immagine"')
    }
    setBusy(null)
  }

  async function scaricaInterno() {
    const { dataUrl, file } = await generaPng()
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = file.name
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  async function scarica() {
    setErrore(null); setBusy('download')
    try { await scaricaInterno() } catch { setErrore("Errore nella generazione dell'immagine") }
    setBusy(null)
  }

  // Copia il PNG negli appunti: nella chat basta poi "Incolla" (Cmd+V sul Mac).
  // Il pattern con la Promise dentro ClipboardItem è richiesto da Safari per
  // non perdere il permesso durante i secondi di generazione dell'immagine.
  async function copiaImmagine() {
    setErrore(null); setBusy('copyimg')
    try {
      const blobPromise = generaPng().then(r => r.file as Blob)
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blobPromise })])
      setImgCopied(true); setTimeout(() => setImgCopied(false), 3000)
    } catch {
      try {
        const { file } = await generaPng()
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': file })])
        setImgCopied(true); setTimeout(() => setImgCopied(false), 3000)
      } catch {
        setErrore('Su questo dispositivo la copia dell\'immagine non è supportata: usa "Condividi" o "Scarica"')
      }
    }
    setBusy(null)
  }

  // Telefono: porta l'immagine nella galleria. iPhone: foglio di condivisione →
  // "Salva immagine" (finisce in Foto). Android: il download finisce in galleria.
  async function salvaSuTelefono() {
    setErrore(null); setBusy('save')
    try {
      const { dataUrl, file } = await generaPng()
      if (isIOS && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] })
      } else {
        const a = document.createElement('a')
        a.href = dataUrl
        a.download = file.name
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
      }
      setSaved(true); setTimeout(() => setSaved(false), 4000)
    } catch (e) {
      if ((e as { name?: string })?.name !== 'AbortError') setErrore('Salvataggio non riuscito: prova "Condividi"')
    }
    setBusy(null)
  }

  // Apre direttamente la chat WhatsApp del cliente con il messaggio già scritto
  // (app WhatsApp se installata, altrimenti WhatsApp Web dopo 1 secondo)
  function apriChat() {
    const raw = (booking.guests?.phone || '').replace(/\D/g, '')
    if (!raw) return
    const phone = raw.startsWith('39') ? raw : `39${raw}`
    const encoded = encodeURIComponent(testoMessaggio)
    const appUrl = `whatsapp://send?phone=${phone}&text=${encoded}`
    const webUrl = `https://wa.me/${phone}?text=${encoded}`
    let handedOff = false
    const mark = () => { handedOff = true }
    document.addEventListener('visibilitychange', mark)
    window.addEventListener('blur', mark)
    window.location.href = appUrl
    setTimeout(() => {
      document.removeEventListener('visibilitychange', mark)
      window.removeEventListener('blur', mark)
      if (!handedOff) window.open(webUrl, '_blank', 'noopener,noreferrer')
    }, 1000)
  }

  async function copiaTesto() {
    try {
      await navigator.clipboard.writeText(testoMessaggio)
    } catch {
      // Fallback per browser senza permesso clipboard
      const ta = document.createElement('textarea')
      ta.value = testoMessaggio
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] overflow-y-auto" onClick={onClose}>
      <div className="bg-cream w-full max-w-lg mx-auto min-h-full p-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-lg text-green-dark">Conferma WhatsApp</h2>
          <button onClick={onClose} className="text-gray-500 text-2xl leading-none px-2">✕</button>
        </div>

        <div className="flex gap-2 mb-3">
          {(['contanti', 'bonifico'] as const).map(p => (
            <button key={p} onClick={() => setPagamento(p)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${pagamento === p ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-[#C9BFA8]'}`}>
              {p === 'contanti' ? 'Contanti all’arrivo' : 'Bonifico anticipato'}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 mb-2">Anteprima dell&apos;immagine</p>
        <div ref={frameRef} className="rounded-xl overflow-hidden border border-[#C9BFA8] shadow-sm mb-3 bg-white"
          style={{ height: imgH ? imgH * scale : undefined }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: IMG_W }}>

            <ImmagineSoggiorno imgRef={imgRef} variante="conferma" nome={nome} segmenti={segmenti} numOspiti={numOspiti}
              righeCosti={righeCosti} totale={totale} pagamento={pagamento} lettoAggiuntivo={lettoDaComunicare(booking)}
              bonifico={{ ricevuto, importo: importoBonifico, causale, scadenzaF, intestatario: BONIFICO_INTESTATARIO, iban: BONIFICO_IBAN }} />

          </div>
        </div>

        {/* PASSO 1 — telefono: salva in galleria · computer: copia negli appunti */}
        {isMobile ? (
          <>
            <p className="text-xs font-semibold text-green-dark mb-1.5">1 · Salva l&apos;immagine sul telefono</p>
            <button onClick={salvaSuTelefono} disabled={!!busy}
              className={`w-full rounded-xl py-3 font-semibold text-sm mb-1 disabled:opacity-50 ${saved ? 'bg-sage text-green-dark' : 'bg-green-mid text-white'}`}>
              {busy === 'save' ? 'Preparo…' : saved ? 'Immagine salvata!' : 'Salva immagine'}
            </button>
            {isIOS && <p className="text-[11px] text-gray-500 mb-3">Nel menu che si apre tocca <span className="font-semibold">&quot;Salva immagine&quot;</span></p>}
            {!isIOS && <div className="mb-3" />}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-green-dark mb-1.5">1 · Copia l&apos;immagine</p>
            <button onClick={copiaImmagine} disabled={!!busy}
              className={`w-full rounded-xl py-3 font-semibold text-sm mb-2 disabled:opacity-50 ${imgCopied ? 'bg-sage text-green-dark' : 'bg-green-mid text-white'}`}>
              {busy === 'copyimg' ? 'Preparo…' : imgCopied ? 'Immagine copiata!' : 'Copia immagine'}
            </button>
          </>
        )}
        <div className="flex gap-2 mb-4">
          <button onClick={condividi} disabled={!!busy}
            className="flex-1 border border-[#C9BFA8] shadow-sm bg-white text-gray-600 rounded-xl py-2 font-semibold text-xs disabled:opacity-50">
            {busy === 'share' ? 'Preparo…' : 'Condividi'}
          </button>
          <button onClick={scarica} disabled={!!busy}
            className="flex-1 border border-[#C9BFA8] shadow-sm bg-white text-gray-600 rounded-xl py-2 font-semibold text-xs disabled:opacity-50">
            {busy === 'download' ? 'Preparo…' : 'Scarica'}
          </button>
        </div>
        {errore && <p className="text-xs text-[#8C3B2E] font-semibold mb-3">{errore}</p>}

        {/* PASSO 2: apri direttamente la chat del cliente */}
        <p className="text-xs font-semibold text-green-dark mb-1.5">2 · Apri la chat del cliente (messaggio già scritto)</p>
        {booking.guests?.phone ? (
          <button onClick={apriChat}
            className="w-full bg-green-dark text-white rounded-xl py-3 font-semibold text-sm mb-4">
            Apri chat di {nome}
          </button>
        ) : (
          <p className="text-xs text-[#8C3B2E] font-semibold mb-4">Nessun numero di telefono sulla prenotazione</p>
        )}

        {/* PASSO 3: istruzioni */}
        <div className="bg-sage border border-[#C9DDD0] rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-green-dark mb-1">3 · Nella chat che si apre:</p>
          {isMobile ? (
            <p className="text-xs text-green-dark leading-relaxed">
              Tocca la <span className="font-semibold">graffetta (o +)</span> → <span className="font-semibold">Galleria</span>: la conferma è la <span className="font-semibold">prima foto</span> → <span className="font-semibold">inviala</span>.
              Poi invia il <span className="font-semibold">messaggio già scritto</span> che trovi pronto nella casella di testo.
            </p>
          ) : (
            <p className="text-xs text-green-dark leading-relaxed">
              <span className="font-semibold">Incolla</span> l&apos;immagine nel campo del messaggio (<span className="font-semibold">Cmd+V</span>) e <span className="font-semibold">inviala</span>.
              Poi invia il <span className="font-semibold">messaggio già scritto</span> che trovi pronto nella casella di testo.
            </p>
          )}
        </div>

        {/* Riserva: testo da copiare a mano */}
        <details className="mb-4">
          <summary className="text-xs text-gray-500 cursor-pointer mb-2">Il testo del messaggio (se serve copiarlo a mano)</summary>
          <div className="bg-white border border-[#C9BFA8] shadow-sm rounded-xl p-3 mb-2 text-sm text-gray-700 whitespace-pre-wrap">
            {testoMessaggio}
          </div>
          <button onClick={copiaTesto}
            className={`w-full rounded-xl py-2.5 font-semibold text-sm ${copied ? 'bg-sage text-green-dark' : 'bg-green-mid text-white'}`}>
            {copied ? 'Copiato!' : 'Copia testo'}
          </button>
        </details>
      </div>
    </div>
  )
}
