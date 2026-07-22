'use client'
import { useEffect, useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { roomWithType, ROOM_SLUG_BY_NAME } from '@/lib/roomTypes'
import { NOME_STRUTTURA, CITTA_STRUTTURA, SITO_URL, SITO_DISPLAY, TELEFONO_DISPLAY, INDIRIZZO, INDIRIZZO_NOTA } from '@/lib/config'

// Conferma di prenotazione WhatsApp: immagine grafica (1080px, identità visiva
// del sito casaaniarozzano.it) + messaggio di testo con i link, pronti da inviare.

const IMG_W = 1080

function formatDateIT(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

function notti(cin: string, cout: string) {
  return Math.round((new Date(cout).getTime() - new Date(cin).getTime()) / 86400000)
}

function fmtEuro(n: number) {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
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

function meseBreve(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('it-IT', { month: 'short' })
}

function bagnoDesc(room: any) {
  if (room?.bathroom_type === 'privato_interno') return "privato, all'interno della camera"
  if (room?.bathroom_type === 'privato_esterno') return room?.bathroom_note ? `privato esterno (${room.bathroom_note})` : 'privato esterno'
  return ''
}

export default function ConfermaWhatsApp({ booking, groupBookings, onClose }: { booking: any; groupBookings: any[]; onClose: () => void }) {
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
  const cout = segmenti[segmenti.length - 1].check_out
  const nottiTot = notti(cin, cout)
  const numOspiti = booking.num_guests || 1
  const ospiti = `${numOspiti} ${numOspiti === 1 ? 'adulto' : 'adulti'}`
  const nome = booking.guests?.full_name || 'Ospite'

  // Righe del riepilogo costi: una per camera, più il letto supplementare se presente
  const righeCosti: { label: string; amount: number }[] = []
  for (const s of segmenti) {
    const n = notti(s.check_in, s.check_out)
    const prezzo = Number(s.price_per_night)
    righeCosti.push({
      label: n > 1 ? `Camera ${roomWithType(s.rooms?.name)} (${n} notti × ${fmtEuro(prezzo)})` : `Camera ${roomWithType(s.rooms?.name)}`,
      amount: prezzo * n,
    })
    const ebTot = Number(s.extra_bed_total || 0)
    if (s.extra_bed && ebTot > 0) {
      const ebNotti = s.extra_bed_dates?.length > 0 ? s.extra_bed_dates.length : n
      const ebPrezzo = Number(s.rooms?.extra_bed_price || 0)
      const showMolt = ebNotti > 1 && Math.abs(ebNotti * ebPrezzo - ebTot) < 0.005
      const base = isGruppo ? `Letto supplementare – ${s.rooms?.name || ''}`.trim() : 'Letto supplementare'
      righeCosti.push({ label: showMolt ? `${base} (${ebNotti} notti × ${fmtEuro(ebPrezzo)})` : base, amount: ebTot })
    }
  }
  const totale = righeCosti.reduce((s, r) => s + r.amount, 0)

  // Variante bonifico: scadenza = domani, anticipata al giorno di arrivo se precedente
  const domani = new Date()
  domani.setDate(domani.getDate() + 1)
  const scadenza = cin <= toYMD(domani) ? cin : toYMD(domani)
  const scadenzaF = formatGiornoMese(scadenza)
  const cognomeOspite = nome.trim().split(' ').slice(-1)[0]
  const nomiCamere = [...new Set(segmenti.map(s => s.rooms?.name?.split(' ').slice(-1)[0]).filter(Boolean))].join(' + ')
  const dateCausale = cin.slice(0, 7) === cout.slice(0, 7)
    ? `${Number(cin.slice(8))}–${Number(cout.slice(8))} ${meseBreve(cout)}`
    : `${Number(cin.slice(8))} ${meseBreve(cin)} – ${Number(cout.slice(8))} ${meseBreve(cout)}`
  const causale = `${nomiCamere} · ${dateCausale} · ${cognomeOspite}`

  // Messaggio di testo con i link (con cambio camera: un link per ogni camera)
  const slugs = [...new Set(segmenti.map(s => ROOM_SLUG_BY_NAME[s.rooms?.name]).filter(Boolean))]
  const linkCamere = slugs.map(sl => `${SITO_URL}/camere/${sl}`).join('\n')
  const testoMessaggio = `Basta un tocco sull'immagine e la conferma della prenotazione si apre a schermo intero, con tutti i dettagli del suo soggiorno.

Per comodità, due link utili:

Info complete per il soggiorno:
${SITO_URL}/info

La sua camera:
${linkCamere}

Appena le sarà possibile, ci comunichi l'orario di arrivo. A presto!
*Ania*`

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
    const dataUrl = await toPng(imgRef.current!, { pixelRatio: 2, backgroundColor: '#FBF9F4', cacheBust: true })
    const blob = await (await fetch(dataUrl)).blob()
    const cognome = nome.trim().split(' ').slice(-1)[0].toLowerCase() || 'ospite'
    return { dataUrl, file: new File([blob], `conferma-${cognome}-${cin}.png`, { type: 'image/png' }) }
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
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErrore('Condivisione non riuscita: usa "Scarica immagine"')
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
    } catch (e: any) {
      if (e?.name !== 'AbortError') setErrore('Salvataggio non riuscito: prova "Condividi"')
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

  // ── Stili dell'immagine (1080px, solo da leggere: nessun elemento cliccabile) ──
  const S = {
    box: { background: '#F6F2EA', borderRadius: 24, padding: '44px 48px', marginBottom: 36 } as React.CSSProperties,
    boxTitle: { fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 36, fontWeight: 600, color: '#1F3D2F', margin: '0 0 28px' } as React.CSSProperties,
    row: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 24, padding: '14px 0' } as React.CSSProperties,
    label: { fontSize: 28, color: '#6f6a5e', flexShrink: 0 } as React.CSSProperties,
    value: { fontSize: 30, fontWeight: 700, color: '#1F3D2F', textAlign: 'right' as const },
    small: { fontSize: 24, color: '#6f6a5e', lineHeight: 1.45 } as React.CSSProperties,
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
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${pagamento === p ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-card-border'}`}>
              {p === 'contanti' ? '💶 Contanti all’arrivo' : '🏦 Bonifico anticipato'}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 mb-2">Anteprima dell&apos;immagine</p>
        <div ref={frameRef} className="rounded-xl overflow-hidden border border-card-border mb-3 bg-white"
          style={{ height: imgH ? imgH * scale : undefined }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: IMG_W }}>

            {/* ═══ IMMAGINE DELLA CONFERMA (1080px) ═══ */}
            <div ref={imgRef} style={{ width: IMG_W, background: '#FBF9F4', fontFamily: 'var(--font-nunito-sans), sans-serif' }}>

              {/* TESTATA con la foto del sito e overlay verde scuro */}
              <div style={{ position: 'relative', height: 430, overflow: 'hidden' }}>
                <img src="/testata-conferma.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(rgba(31,61,47,0.52), rgba(31,61,47,0.68))' }} />
                <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 60px' }}>
                  <span style={{ border: '2px solid rgba(255,255,255,0.75)', color: 'white', borderRadius: 999, padding: '8px 30px', fontSize: 24, fontWeight: 600, letterSpacing: 6, marginBottom: 26 }}>BENVENUTI</span>
                  <p style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 58, fontWeight: 600, color: 'white', margin: 0, lineHeight: 1.15 }}>La tua prenotazione è confermata</p>
                  <p style={{ fontSize: 29, color: 'rgba(255,255,255,0.92)', margin: '18px 0 0' }}>{NOME_STRUTTURA} · a 140 metri da Humanitas</p>
                </div>
              </div>

              <div style={{ padding: '52px 52px 0' }}>

                {/* SALUTO */}
                <p style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 42, fontWeight: 600, color: '#1F3D2F', margin: '0 0 14px' }}>Gentile {nome},</p>
                <p style={{ fontSize: 30, color: '#3a3a35', lineHeight: 1.5, margin: '0 0 40px' }}>
                  grazie per aver scelto {NOME_STRUTTURA} {CITTA_STRUTTURA}. Sono lieta di confermarle il soggiorno e la aspetto con piacere!
                </p>

                {/* RIEPILOGO SOGGIORNO */}
                <div style={S.box}>
                  <p style={S.boxTitle}>Riepilogo soggiorno</p>
                  <div style={S.row}>
                    <span style={S.label}>Check-in</span>
                    <span style={S.value}>{formatDateIT(cin)}<br /><span style={{ fontSize: 24, fontWeight: 400, color: '#6f6a5e' }}>dalle 15:00 alle 20:00</span></span>
                  </div>
                  <div style={S.row}>
                    <span style={S.label}>Check-out</span>
                    <span style={S.value}>{formatDateIT(cout)}<br /><span style={{ fontSize: 24, fontWeight: 400, color: '#6f6a5e' }}>entro le 10:00</span></span>
                  </div>
                  <div style={S.row}><span style={S.label}>Notti</span><span style={S.value}>{nottiTot}</span></div>
                  <div style={S.row}><span style={S.label}>Ospiti</span><span style={S.value}>{ospiti}</span></div>
                  {isGruppo ? (
                    segmenti.map((s, i) => (
                      <div key={s.id} style={S.row}>
                        <span style={S.label}>Camera {i + 1}</span>
                        <span style={S.value}>
                          {roomWithType(s.rooms?.name)}<br />
                          <span style={{ fontSize: 24, fontWeight: 400, color: '#6f6a5e' }}>
                            {formatDateIT(s.check_in)} → {formatDateIT(s.check_out)} ({notti(s.check_in, s.check_out)} {notti(s.check_in, s.check_out) === 1 ? 'notte' : 'notti'})
                            {bagnoDesc(s.rooms) ? <><br />bagno {bagnoDesc(s.rooms)}</> : null}
                          </span>
                        </span>
                      </div>
                    ))
                  ) : (
                    <>
                      <div style={S.row}><span style={S.label}>Camera</span><span style={S.value}>{roomWithType(booking.rooms?.name)}</span></div>
                      {bagnoDesc(booking.rooms) && (
                        <div style={S.row}><span style={S.label}>Bagno</span><span style={{ ...S.value, fontWeight: 400, fontSize: 27 }}>{bagnoDesc(booking.rooms)}</span></div>
                      )}
                    </>
                  )}
                  <p style={{ ...S.small, borderTop: '1px solid #e3ddd0', paddingTop: 24, margin: '18px 0 0' }}>
                    Il check-in è flessibile: se arriva prima o dopo questi orari, ci scriva su WhatsApp il giorno precedente e troviamo sempre una soluzione.
                  </p>
                </div>

                {/* RIEPILOGO COSTI */}
                <div style={{ ...S.box, background: 'white', border: '2px solid #e3ddd0' }}>
                  <p style={S.boxTitle}>Riepilogo costi</p>
                  {righeCosti.map((r, i) => (
                    <div key={i} style={S.row}>
                      <span style={{ ...S.label, color: '#3a3a35' }}>{r.label}</span>
                      <span style={S.value}>{fmtEuro(r.amount)}</span>
                    </div>
                  ))}
                  <div style={{ ...S.row, borderTop: '2px solid #e3ddd0', marginTop: 12, paddingTop: 26 }}>
                    <span style={{ fontSize: 32, fontWeight: 700, color: '#1F3D2F' }}>Totale soggiorno</span>
                    <span style={{ fontSize: 44, fontWeight: 800, color: '#2D6A4F' }}>{fmtEuro(totale)}</span>
                  </div>
                  {pagamento === 'contanti' && (
                    <p style={{ fontSize: 30, fontWeight: 600, color: '#1F3D2F', lineHeight: 1.5, margin: '18px 0 0' }}>
                      Pagamento all&apos;arrivo, alla consegna delle chiavi, per l&apos;intera prenotazione: contanti o bonifico istantaneo.
                    </p>
                  )}
                </div>

                {/* PAGAMENTO ANTICIPATO (variante bonifico) */}
                {pagamento === 'bonifico' && (
                  <div style={S.box}>
                    <p style={S.boxTitle}>Pagamento</p>
                    <p style={{ fontSize: 28, color: '#3a3a35', lineHeight: 1.5, margin: '0 0 26px' }}>
                      Il soggiorno si salda in anticipo con bonifico bancario, per l&apos;intero importo. La prenotazione è confermata alla ricezione della ricevuta.
                    </p>
                    <div style={{ background: '#FBF9F4', borderRadius: 16, padding: '12px 32px', marginBottom: 26 }}>
                      <div style={S.row}><span style={S.label}>Importo</span><span style={{ ...S.value, fontWeight: 600 }}>{fmtEuro(totale)}</span></div>
                      <div style={S.row}><span style={S.label}>Intestatario</span><span style={{ ...S.value, fontWeight: 400 }}>{BONIFICO_INTESTATARIO}</span></div>
                      <div style={S.row}><span style={S.label}>IBAN</span><span style={{ ...S.value, fontWeight: 400, fontSize: 28, whiteSpace: 'nowrap' }}>{BONIFICO_IBAN}</span></div>
                      <div style={S.row}><span style={S.label}>Causale</span><span style={{ ...S.value, fontWeight: 400 }}>{causale}</span></div>
                      <div style={S.row}><span style={S.label}>Entro il</span><span style={{ ...S.value, fontWeight: 600 }}>{scadenzaF}</span></div>
                    </div>
                    <div style={{ background: '#FBF9F4', borderLeft: '3px solid #C58A67', borderRadius: 16, padding: '26px 40px', margin: 0 }}>
                      <p style={{ fontSize: 27, color: '#1F3D2F', lineHeight: 1.6, margin: 0 }}>
                        Quando ha effettuato il bonifico ci mandi la ricevuta su WhatsApp. Senza la ricevuta entro il {scadenzaF}, la camera torna ad essere disponibile.
                      </p>
                    </div>
                  </div>
                )}

                {/* RIQUADRO EVIDENZIATO */}
                <div style={{ background: '#EFF3EA', borderRadius: 24, padding: '38px 48px', marginBottom: 36 }}>
                  <p style={{ fontSize: 30, fontWeight: 600, color: '#2D6A4F', lineHeight: 1.5, margin: 0, textAlign: 'center' }}>
                    Appena le sarà possibile, la preghiamo di comunicarci l&apos;orario di arrivo, per organizzare al meglio la sua accoglienza.
                  </p>
                </div>

                {/* DOVE SIAMO */}
                <div style={S.box}>
                  <p style={S.boxTitle}>Dove siamo</p>
                  <p style={{ fontSize: 30, fontWeight: 700, color: '#1F3D2F', margin: '0 0 10px' }}>{INDIRIZZO}</p>
                  <p style={{ fontSize: 27, color: '#3a3a35', margin: 0 }}>{INDIRIZZO_NOTA}</p>
                </div>

                {/* CONTATTI */}
                <div style={{ background: 'white', border: '2px solid #e3ddd0', borderRadius: 24, padding: '40px 48px', marginBottom: 36, textAlign: 'center' }}>
                  <p style={{ fontSize: 28, color: '#3a3a35', margin: '0 0 12px' }}>Per qualsiasi necessità sono sempre disponibile</p>
                  <p style={{ fontSize: 38, fontWeight: 800, color: '#2D6A4F', margin: 0 }}>{TELEFONO_DISPLAY} <span style={{ fontSize: 27, fontWeight: 400, color: '#3a3a35' }}>(anche WhatsApp)</span></p>
                </div>

                <p style={{ ...S.small, textAlign: 'center', margin: '0 0 34px' }}>
                  Politica di cancellazione: cancellazione gratuita fino a 3 giorni prima dell&apos;arrivo.
                </p>

                {/* CHIUSURA */}
                <div style={{ textAlign: 'center', paddingBottom: 48 }}>
                  <p style={{ fontSize: 30, color: '#3a3a35', margin: '0 0 8px' }}>Sarà un piacere accoglierla!</p>
                  <p style={{ fontSize: 28, color: '#6f6a5e', margin: '0 0 6px' }}>A presto,</p>
                  <p style={{ fontFamily: 'var(--font-fraunces), Georgia, serif', fontSize: 46, fontWeight: 600, color: '#1F3D2F', margin: 0 }}>Ania</p>
                </div>

                {/* NOTA PERSONALE — CAMBIO NOME (ultimo elemento dell'immagine) */}
                <div style={{ background: '#FBF9F4', borderLeft: '3px solid #2D6A4F', borderRadius: 16, padding: '26px 40px', margin: '0 0 48px' }}>
                  <p style={{ fontSize: 27, color: '#1F3D2F', lineHeight: 1.6, margin: 0 }}>
                    Dopo aver rinnovato ogni stanza, questa casa non sembrava più la stessa. Così stiamo per cambiarle nome in <span style={{ fontWeight: 600 }}>Casa Ania</span>.
                  </p>
                </div>
              </div>

              {/* PIÈ DI PAGINA */}
              <div style={{ background: '#F6F2EA', padding: '26px 52px', textAlign: 'center' }}>
                <p style={{ fontSize: 26, color: '#6f6a5e', margin: 0 }}>{NOME_STRUTTURA} – {CITTA_STRUTTURA} · {SITO_DISPLAY}</p>
              </div>
            </div>
            {/* ═══ FINE IMMAGINE ═══ */}

          </div>
        </div>

        {/* PASSO 1 — telefono: salva in galleria · computer: copia negli appunti */}
        {isMobile ? (
          <>
            <p className="text-xs font-semibold text-green-dark mb-1.5">1 · Salva l&apos;immagine sul telefono</p>
            <button onClick={salvaSuTelefono} disabled={!!busy}
              className={`w-full rounded-xl py-3 font-semibold text-sm mb-1 disabled:opacity-50 ${saved ? 'bg-sage text-green-dark' : 'bg-green-mid text-white'}`}>
              {busy === 'save' ? 'Preparo…' : saved ? '✓ Immagine salvata!' : '💾 Salva immagine'}
            </button>
            {isIOS && <p className="text-[11px] text-gray-500 mb-3">Nel menu che si apre tocca <span className="font-semibold">&quot;Salva immagine&quot;</span></p>}
            {!isIOS && <div className="mb-3" />}
          </>
        ) : (
          <>
            <p className="text-xs font-semibold text-green-dark mb-1.5">1 · Copia l&apos;immagine</p>
            <button onClick={copiaImmagine} disabled={!!busy}
              className={`w-full rounded-xl py-3 font-semibold text-sm mb-2 disabled:opacity-50 ${imgCopied ? 'bg-sage text-green-dark' : 'bg-green-mid text-white'}`}>
              {busy === 'copyimg' ? 'Preparo…' : imgCopied ? '✓ Immagine copiata!' : '🖼 Copia immagine'}
            </button>
          </>
        )}
        <div className="flex gap-2 mb-4">
          <button onClick={condividi} disabled={!!busy}
            className="flex-1 border border-card-border bg-white text-gray-600 rounded-xl py-2 font-semibold text-xs disabled:opacity-50">
            {busy === 'share' ? 'Preparo…' : '📤 Condividi'}
          </button>
          <button onClick={scarica} disabled={!!busy}
            className="flex-1 border border-card-border bg-white text-gray-600 rounded-xl py-2 font-semibold text-xs disabled:opacity-50">
            {busy === 'download' ? 'Preparo…' : '⬇️ Scarica'}
          </button>
        </div>
        {errore && <p className="text-xs text-[#8C3B2E] font-semibold mb-3">{errore}</p>}

        {/* PASSO 2: apri direttamente la chat del cliente */}
        <p className="text-xs font-semibold text-green-dark mb-1.5">2 · Apri la chat del cliente (messaggio già scritto)</p>
        {booking.guests?.phone ? (
          <button onClick={apriChat}
            className="w-full bg-green-dark text-white rounded-xl py-3 font-semibold text-sm mb-4">
            💬 Apri chat di {nome}
          </button>
        ) : (
          <p className="text-xs text-[#8C3B2E] font-semibold mb-4">Nessun numero di telefono sulla prenotazione</p>
        )}

        {/* PASSO 3: istruzioni */}
        <div className="bg-sage border border-[#C9DDD0] rounded-xl p-3 mb-4">
          <p className="text-xs font-semibold text-green-dark mb-1">3 · Nella chat che si apre:</p>
          {isMobile ? (
            <p className="text-xs text-green-dark leading-relaxed">
              Tocca la <span className="font-semibold">graffetta 📎 (o +)</span> → <span className="font-semibold">Galleria</span>: la conferma è la <span className="font-semibold">prima foto</span> → <span className="font-semibold">inviala</span>.
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
          <div className="bg-white border border-card-border rounded-xl p-3 mb-2 text-sm text-gray-700 whitespace-pre-wrap">
            {testoMessaggio}
          </div>
          <button onClick={copiaTesto}
            className={`w-full rounded-xl py-2.5 font-semibold text-sm ${copied ? 'bg-sage text-green-dark' : 'bg-green-mid text-white'}`}>
            {copied ? '✓ Copiato!' : '📋 Copia testo'}
          </button>
        </details>
      </div>
    </div>
  )
}
