'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ETICHETTE, LATO_MAX, etichettaLeggibile, percorsoDocumento, tipoAccettato, misureRidotte, dimensioneLeggibile, rigaDocumenti, raccogliAnteprime,
  type DocumentoCliente, type EtichettaDocumento, type LatoDocumento,
} from '@/lib/documentiCliente'
import AvvisoAzione from '@/components/AvvisoAzione'
import VisoreDocumento from '@/components/VisoreDocumento'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { giornoMeseAnno } from '@/lib/dateItaliane'

/** Il foglio «Eliminare questo documento?»: la domanda, una riga e i due comandi (B1) */
export const ALTEZZA_ELIMINA_DOCUMENTO = 190

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
  const [aperto, setAperto] = useState<DocumentoCliente | null>(null)   // documento a schermo intero
  // Parte 3 (05/09/2026): anteprime non ottenute → avviso con Riprova, non caselle vuote
  const [erroreAnteprime, setErroreAnteprime] = useState<string | null>(null)

  // URL firmati per le anteprime (un'ora): ogni risposta controlla error
  async function caricaAnteprime(lista: DocumentoCliente[]): Promise<{ urls: Record<string, string>; errore: string | null }> {
    const risultati = []
    for (const d of lista) {
      try {
        const { data: u, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.percorso, 3600)
        risultati.push({ id: d.id, url: u?.signedUrl, error })
      } catch (e) {
        risultati.push({ id: d.id, url: null, error: e ?? new Error('errore sconosciuto') })
      }
    }
    return raccogliAnteprime(risultati)
  }

  async function riprovaAnteprime() {
    setErroreAnteprime(null)
    const { urls, errore } = await caricaAnteprime(documenti)
    setAnteprime(urls)
    setErroreAnteprime(errore)
  }

  useEffect(() => {
    let vivo = true
    supabase.from('documenti_cliente').select('*').eq('guest_id', guestId).order('created_at').then(async ({ data, error }) => {
      if (!vivo) return
      if (error) { setAvviso(manca0032(error) ? AVVISO_0032 : `Documenti non leggibili: ${error.message}`); setLoading(false); return }
      const lista = (data || []) as DocumentoCliente[]
      setDocumenti(lista)
      setLoading(false)
      const { urls, errore } = await caricaAnteprime(lista)
      if (vivo) { setAnteprime(urls); setErroreAnteprime(errore) }
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
      const { data: u, error: e3 } = await supabase.storage.from(BUCKET).createSignedUrl(percorso, 3600)
      if (e3 || !u?.signedUrl) setErroreAnteprime(raccogliAnteprime([{ id: doc.id, url: u?.signedUrl, error: e3 }]).errore)
      else setAnteprime(a => ({ ...a, [doc.id]: u.signedUrl }))
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

  // Veste «Maison» della scheda cliente (ritocchi del 29/09/2026, D3; riferimento 2):
  // «DOCUMENTI · N», griglia a due colonne con l'anteprima 4:3, sotto l'etichetta e
  // «data · dimensione · elimina»; le chip del tipo e del lato, «Aggiungi documento»
  // sottolineato; la conferma dell'eliminazione nel foglio Maison. Stessa lettura,
  // stessa riduzione delle foto, stesso archivio e stessi errori di prima.
  return (
    <section id="documenti" className="np-sec cli-doc" style={{ paddingTop: 22 }}>
      <p className="mz-eyebrow">Documenti{!loading && !avviso ? ` · ${documenti.length}` : ''}</p>

      {avviso && <p className="mz-hint" style={{ color: '#8C3B2E' }}>{avviso}</p>}

      {!avviso && (
        <>
          {erroreAnteprime && <AvvisoAzione testo={erroreAnteprime} onRiprova={riprovaAnteprime} className="mt-2" />}
          {loading ? (
            <p className="mz-hint">Caricamento…</p>
          ) : documenti.length === 0 ? (
            <p className="mz-hint" data-nessun-documento>Nessun documento allegato.</p>
          ) : (
            <ul className="cli-doc-griglia" data-griglia-documenti>
              {documenti.map(d => (
                <li key={d.id} data-documento={d.id}>
                  <button type="button" onClick={() => anteprime[d.id] && setAperto(d)} className="ant" aria-label={`Apri ${etichettaLeggibile(d)}`}>
                    {anteprime[d.id] ? (
                      d.percorso.endsWith('.pdf')
                        ? <span className="pdf">📄</span>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={anteprime[d.id]} alt={etichettaLeggibile(d)} />
                    ) : <span>…</span>}
                  </button>
                  <p className="et">{etichettaLeggibile(d)}</p>
                  <p className="da">
                    {[giornoMeseAnno(String(d.created_at).slice(0, 10)), dimensioneLeggibile(d.dimensione)].filter(Boolean).join(' · ')}
                    {' · '}<button type="button" className="mz-lnk q el" data-elimina-documento onClick={() => setDaCancellare(d)}>elimina</button>
                  </p>
                </li>
              ))}
            </ul>
          )}

          {/* Aggiunta: tipo di documento, lato, poi «Aggiungi documento» che apre fotocamera/galleria */}
          <div className="cli-chips" style={{ marginTop: 14 }} data-tipo-documento>
            {ETICHETTE.filter(e => e.chiave !== 'documento').map(e => (
              <button key={e.chiave} type="button" aria-pressed={etichetta === e.chiave} className={etichetta === e.chiave ? 'on' : ''} onClick={() => setEtichetta(e.chiave)}>{e.label}</button>
            ))}
          </div>
          <div className="cli-doc-lato">
            <span className="cli-chips" data-lato-documento>
              {(['fronte', 'retro'] as const).map(l => (
                <button key={l} type="button" onClick={() => setLato(lato === l ? null : l)} aria-pressed={lato === l} className={lato === l ? 'on' : ''}>{l}</button>
              ))}
            </span>
            <label className={`mz-lnk ${caricando ? 'q' : ''}`} data-aggiungi-documento>
              {caricando ? 'Carico…' : 'Aggiungi documento'}
              <input type="file" accept="image/*,application/pdf" className="hidden" disabled={caricando}
                onChange={e => { const f = e.target.files?.[0]; if (f) carica(f); e.target.value = '' }} />
            </label>
          </div>
          <p className="cli-doc-nota">Le foto vengono ridotte e salvate in un archivio privato, visibile solo a chi è entrato nel gestionale. Restano finché non le elimini tu.</p>
        </>
      )}

      {errore && <p role="alert" className="mz-hint" style={{ color: '#8C3B2E' }}>{errore}</p>}

      {daCancellare && (
        <FoglioMaison titolo="Eliminare questo documento?" altezza={ALTEZZA_ELIMINA_DOCUMENTO} larghezzaDesktop={440} dati="elimina-documento" onChiudi={() => setDaCancellare(null)}
          piede={
            <div className="mz-foot" data-piede-foglio>
              <span />
              <span className="acts">
                <button type="button" className="mz-lnk q" data-annulla-foglio onClick={() => setDaCancellare(null)}>Annulla</button>
                <button type="button" className="mz-cta mat" data-azione-foglio="elimina-documento" onClick={() => cancella(daCancellare)}>Elimina</button>
              </span>
            </div>
          }>
          <p className="mz-hint">{etichettaLeggibile(daCancellare)} · non si può recuperare.</p>
        </FoglioMaison>
      )}

      {aperto && anteprime[aperto.id] && (
        <VisoreDocumento url={anteprime[aperto.id]} etichetta={etichettaLeggibile(aperto)} onChiudi={() => setAperto(null)} />
      )}
    </section>
  )
}

// Riga discreta per la scheda prenotazione: «Documenti · 2» → scheda cliente.
// Se la migrazione 0032 non c'è ancora non mostra nulla.
// La nuova scheda prenotazione (13/09/2026) passa `conteggio` già letto e
// chiede la veste `scheda`: «🪪 Nessun documento · aggiungi» (14 px stone,
// «aggiungi» verde) oppure «🪪 documento caricato ›», che apre i documenti.
export function RigaDocumentiPrenotazione({ guestId, className = '', conteggio, scheda = false }: { guestId: string | null | undefined; className?: string; conteggio?: number | null; scheda?: boolean }) {
  const [letto, setLetto] = useState<number | null>(null)
  useEffect(() => {
    if (!guestId || conteggio !== undefined) return
    let vivo = true
    supabase.from('documenti_cliente').select('id', { count: 'exact', head: true }).eq('guest_id', guestId)
      .then(({ count, error }) => { if (vivo && !error) setLetto(count ?? 0) })
    return () => { vivo = false }
  }, [guestId, conteggio])
  const n = conteggio !== undefined ? conteggio : letto
  if (!guestId || n === null) return null
  if (scheda) {
    return (
      // nella testa della scheda (20/09/2026 sera, disegno approvato): «Aggiungi
      // documento» sottolineato quando manca, «documento caricato ›» quando c'è;
      // porta sempre ai documenti della cliente, come prima
      <Link href={`/clienti/${guestId}#documenti`} data-riga-documento data-senza-sottolinea className={`inline-block ${className}`} style={{ fontSize: 12, color: '#8b8f83' }}>
        {n === 0
          ? <span className="ed-azione" style={{ minHeight: 0, fontSize: 12, fontWeight: 400, color: '#405b4b', textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3 }}>Aggiungi documento</span>
          : <span>{n === 1 ? 'documento caricato' : `${n} documenti caricati`} ›</span>}
      </Link>
    )
  }
  return (
    <Link href={`/clienti/${guestId}#documenti`} className={`inline-flex items-center gap-1.5 text-sm text-stone underline underline-offset-2 decoration-dotted mb-1 ${className}`}>
      🪪 {rigaDocumenti(n)}
    </Link>
  )
}
