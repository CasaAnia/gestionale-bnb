'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ETICHETTE, LATO_MAX, etichettaLeggibile, percorsoDocumento, tipoAccettato, misureRidotte, dimensioneLeggibile, rigaDocumenti,
  type DocumentoCliente, type EtichettaDocumento, type LatoDocumento,
} from '@/lib/documentiCliente'

// Documenti d'identità del cliente (05/09/2026, richiesta di Ania): foto dal
// telefono, ridotte e salvate nel bucket privato «documenti» (migrazione
// 0032), tracciate in documenti_cliente. Si vedono con URL firmati validi
// un'ora, si cancellano a mano. Nessuna cancellazione automatica.
const BUCKET = 'documenti'
const AVVISO_0032 = 'I documenti non sono ancora attivi: va applicata la migrazione 0032 (tabella documenti_cliente e bucket «documenti») su Supabase.'

function manca0032(e: { code?: string; message?: string } | null | undefined): boolean {
  return !!e && (e.code === 'PGRST205' || /documenti_cliente|Bucket not found/i.test(e.message || ''))
}

// Riduce la foto (lato lungo 1600 px, JPEG 0,82). I PDF passano così come sono.
async function riduci(file: File): Promise<{ blob: Blob; tipo: string }> {
  if (file.type === 'application/pdf') return { blob: file, tipo: file.type }
  try {
    const bitmap = await createImageBitmap(file)
    const { larghezza, altezza } = misureRidotte(bitmap.width, bitmap.height, LATO_MAX)
    const canvas = document.createElement('canvas')
    canvas.width = larghezza; canvas.height = altezza
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, larghezza, altezza)
    const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.82))
    if (blob) return { blob, tipo: 'image/jpeg' }
  } catch { /* formato non leggibile dal browser (es. HEIC su alcuni): si carica l'originale */ }
  return { blob: file, tipo: file.type || 'image/jpeg' }
}

export default function DocumentiCliente({ guestId }: { guestId: string }) {
  const [documenti, setDocumenti] = useState<DocumentoCliente[]>([])
  const [anteprime, setAnteprime] = useState<Record<string, string>>({})   // id → URL firmato
  const [loading, setLoading] = useState(true)
  const [avviso, setAvviso] = useState<string | null>(null)
  const [errore, setErrore] = useState<string | null>(null)
  const [caricando, setCaricando] = useState(false)
  const [etichetta, setEtichetta] = useState<EtichettaDocumento>('carta_identita')
  const [lato, setLato] = useState<LatoDocumento | null>(null)
  const [daCancellare, setDaCancellare] = useState<DocumentoCliente | null>(null)
  const [aperto, setAperto] = useState<string | null>(null)   // URL firmato a schermo intero

  useEffect(() => {
    let vivo = true
    supabase.from('documenti_cliente').select('*').eq('guest_id', guestId).order('created_at').then(async ({ data, error }) => {
      if (!vivo) return
      if (error) { setAvviso(manca0032(error) ? AVVISO_0032 : `Documenti non leggibili: ${error.message}`); setLoading(false); return }
      const lista = (data || []) as DocumentoCliente[]
      setDocumenti(lista)
      setLoading(false)
      // URL firmati per le anteprime (un'ora)
      const urls: Record<string, string> = {}
      for (const d of lista) {
        const { data: u } = await supabase.storage.from(BUCKET).createSignedUrl(d.percorso, 3600)
        if (u?.signedUrl) urls[d.id] = u.signedUrl
      }
      if (vivo) setAnteprime(urls)
    })
    return () => { vivo = false }
  }, [guestId])

  async function carica(file: File) {
    setErrore(null)
    if (!tipoAccettato(file.type) && file.type !== '') { setErrore('Formato non accettato: serve una foto o un PDF.'); return }
    setCaricando(true)
    try {
      const { blob, tipo } = await riduci(file)
      const id = crypto.randomUUID()
      const percorso = percorsoDocumento(guestId, id, tipo)
      const { error: e1 } = await supabase.storage.from(BUCKET).upload(percorso, blob, { contentType: tipo, upsert: false })
      if (e1) throw e1
      const riga = { id, guest_id: guestId, percorso, etichetta, lato, nome_file: file.name || null, dimensione: blob.size }
      const { data, error: e2 } = await supabase.from('documenti_cliente').insert(riga).select().single()
      if (e2) { await supabase.storage.from(BUCKET).remove([percorso]); throw e2 }
      const doc = data as DocumentoCliente
      setDocumenti(l => [...l, doc])
      const { data: u } = await supabase.storage.from(BUCKET).createSignedUrl(percorso, 3600)
      if (u?.signedUrl) setAnteprime(a => ({ ...a, [doc.id]: u.signedUrl }))
    } catch (e) {
      const err = e as { code?: string; message?: string }
      setErrore(manca0032(err) ? AVVISO_0032 : `Caricamento non riuscito: ${err?.message || 'errore sconosciuto'}`)
    }
    setCaricando(false)
  }

  async function cancella(d: DocumentoCliente) {
    setErrore(null)
    const { error: e1 } = await supabase.from('documenti_cliente').delete().eq('id', d.id)
    if (e1) { setErrore(`Cancellazione non riuscita: ${e1.message}`); setDaCancellare(null); return }
    await supabase.storage.from(BUCKET).remove([d.percorso])   // se fallisce resta un file orfano, innocuo
    setDocumenti(l => l.filter(x => x.id !== d.id))
    setDaCancellare(null)
  }

  return (
    <div id="documenti" className="bg-white rounded-xl p-4 border border-[#C9BFA8] shadow-sm mb-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="font-semibold text-green-dark">Documenti</p>
        {!loading && !avviso && <span className="text-xs text-stone">{rigaDocumenti(documenti.length)}</span>}
      </div>

      {avviso && <p className="text-sm rounded-lg p-3" style={{ background: '#F6E4DE', color: '#8C3B2E' }}>{avviso}</p>}

      {!avviso && (
        <>
          {loading ? (
            <p className="text-sm text-stone">Caricamento…</p>
          ) : documenti.length === 0 ? (
            <p className="text-sm text-stone">Nessun documento allegato.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-2 mb-3">
              {documenti.map(d => (
                <li key={d.id} className="rounded-lg border border-[#C9BFA8] shadow-sm overflow-hidden bg-cream">
                  <button type="button" onClick={() => anteprime[d.id] && setAperto(anteprime[d.id])} className="block w-full aspect-[4/3] bg-sand" aria-label={`Apri ${etichettaLeggibile(d)}`}>
                    {anteprime[d.id] ? (
                      d.percorso.endsWith('.pdf')
                        ? <span className="flex items-center justify-center h-full text-3xl">📄</span>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={anteprime[d.id]} alt={etichettaLeggibile(d)} className="w-full h-full object-cover" />
                    ) : <span className="flex items-center justify-center h-full text-xs text-stone">…</span>}
                  </button>
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-green-dark truncate">{etichettaLeggibile(d)}</p>
                      <p className="text-[11px] text-stone">{new Date(d.created_at).toLocaleDateString('it-IT')}{d.dimensione ? ` · ${dimensioneLeggibile(d.dimensione)}` : ''}</p>
                    </div>
                    <button type="button" onClick={() => setDaCancellare(d)} className="shrink-0 text-[11px] font-semibold px-2 py-1 rounded-full" style={{ color: '#8C3B2E', background: '#F6E4DE' }}>Elimina</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Aggiunta: tipo di documento, lato, poi il pulsante che apre fotocamera/galleria */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <select value={etichetta} onChange={e => setEtichetta(e.target.value as EtichettaDocumento)}
              className="border border-[#C9BFA8] shadow-sm rounded-lg px-2 py-1.5 text-xs bg-white text-green-dark">
              {ETICHETTE.map(e => <option key={e.chiave} value={e.chiave}>{e.label}</option>)}
            </select>
            {(['fronte', 'retro'] as const).map(l => (
              <button key={l} type="button" onClick={() => setLato(lato === l ? null : l)} aria-pressed={lato === l}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors ${lato === l ? 'bg-green-mid text-cream-text border-green-mid' : 'bg-white text-stone border-card-border'}`}>{l}</button>
            ))}
          </div>
          <label className={`inline-flex items-center justify-center w-full rounded-xl py-2.5 text-sm font-semibold cursor-pointer ${caricando ? 'opacity-60' : ''}`} style={{ background: '#2D6A4F', color: '#F5EFE4' }}>
            {caricando ? 'Carico…' : '📷 Aggiungi documento'}
            <input type="file" accept="image/*,application/pdf" className="hidden" disabled={caricando}
              onChange={e => { const f = e.target.files?.[0]; if (f) carica(f); e.target.value = '' }} />
          </label>
          <p className="text-[11px] text-stone mt-2">Le foto vengono ridotte e salvate in un archivio privato, visibile solo a chi è entrato nel gestionale. Restano finché non le elimini tu.</p>
        </>
      )}

      {errore && <p role="alert" className="text-sm mt-2 rounded-lg p-3" style={{ background: '#F6E4DE', color: '#8C3B2E' }}>{errore}</p>}

      {daCancellare && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-green-dark/30" onClick={() => setDaCancellare(null)} />
          <div className="relative bg-white rounded-xl p-4 w-full max-w-sm border border-[#C9BFA8] shadow-sm shadow-md">
            <p className="font-semibold text-green-dark mb-1">Eliminare questo documento?</p>
            <p className="text-sm text-stone mb-3">{etichettaLeggibile(daCancellare)} · non si può recuperare.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => cancella(daCancellare)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white" style={{ background: '#8C3B2E' }}>Elimina</button>
              <button type="button" onClick={() => setDaCancellare(null)} className="flex-1 rounded-xl py-2.5 text-sm font-semibold border border-card-border bg-white text-green-dark">Annulla</button>
            </div>
          </div>
        </div>
      )}

      {aperto && (
        <div className="fixed inset-0 z-[70] bg-green-dark/90 flex items-center justify-center p-3" role="dialog" aria-modal="true" onClick={() => setAperto(null)}>
          {aperto.includes('.pdf') ? (
            <iframe src={aperto} title="Documento" className="w-full h-full bg-white rounded-lg" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={aperto} alt="Documento" className="max-w-full max-h-full object-contain rounded-lg" />
          )}
          <button type="button" onClick={() => setAperto(null)} aria-label="Chiudi" className="absolute top-3 right-3 w-9 h-9 rounded-full bg-white text-green-dark font-bold">✕</button>
        </div>
      )}
    </div>
  )
}

// Riga discreta per la scheda prenotazione: «Documenti · 2» → scheda cliente.
// Se la migrazione 0032 non c'è ancora non mostra nulla.
export function RigaDocumentiPrenotazione({ guestId, className = '' }: { guestId: string | null | undefined; className?: string }) {
  const [n, setN] = useState<number | null>(null)
  useEffect(() => {
    if (!guestId) return
    let vivo = true
    supabase.from('documenti_cliente').select('id', { count: 'exact', head: true }).eq('guest_id', guestId)
      .then(({ count, error }) => { if (vivo && !error) setN(count ?? 0) })
    return () => { vivo = false }
  }, [guestId])
  if (!guestId || n === null) return null
  return (
    <Link href={`/clienti/${guestId}#documenti`} className={`inline-flex items-center gap-1.5 text-sm text-stone underline underline-offset-2 decoration-dotted mb-1 ${className}`}>
      🪪 {rigaDocumenti(n)}
    </Link>
  )
}
