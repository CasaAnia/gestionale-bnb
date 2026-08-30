'use client'
// Visore delle fotografie di un documento (3.2B): pagine in ordine, link
// firmati al volo (bucket privato), errori gestiti senza chiudere il foglio.
import { useEffect, useState } from 'react'
import { TEMA as t, DISPLAY } from './tema'
import { Foglio } from './mattoni'

export type PaginaFoto = { id: string; storage_path: string; page_order: number }

export function FotoSheet({ titolo, pagine, firmaUrl, chiudi }: {
  titolo: string
  pagine: PaginaFoto[]
  firmaUrl: (storagePath: string) => Promise<string | null>
  chiudi: () => void
}) {
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [errore, setErrore] = useState<string | null>(null)
  const [caricamento, setCaricamento] = useState(true)

  useEffect(() => {
    let vivo = true
    ;(async () => {
      try {
        const trovate: Record<string, string> = {}
        for (const p of pagine) {
          const url = await firmaUrl(p.storage_path)
          if (url) trovate[p.id] = url
        }
        if (!vivo) return
        setUrls(trovate)
        setErrore(Object.keys(trovate).length === 0 && pagine.length > 0
          ? 'Non riesco ad aprire le foto: controlla la connessione e riprova.' : null)
      } catch {
        if (vivo) setErrore('Non riesco ad aprire le foto: controlla la connessione e riprova.')
      } finally {
        if (vivo) setCaricamento(false)
      }
    })()
    return () => { vivo = false }
  }, [pagine, firmaUrl])

  const ordinate = [...pagine].sort((a, b) => a.page_order - b.page_order)

  return (
    <Foglio aria={`Fotografie: ${titolo}`} chiudi={chiudi} scorrevole>
      <p className={`${DISPLAY} text-[17px] mb-3`} style={{ color: t.inchiostro }}>
        {titolo} <span className="font-semibold text-[12px]" style={{ color: t.sub }}>
          · {pagine.length === 1 ? '1 foto' : `${pagine.length} foto`}</span>
      </p>
      {caricamento && <p className="text-[13px] py-6 text-center" style={{ color: t.sub }}>Apro le foto…</p>}
      {errore && (
        <p className="text-[13px] py-4 text-center font-semibold" role="alert" style={{ color: t.rosso }}>{errore}</p>
      )}
      <div className="flex flex-col gap-3 pb-2">
        {ordinate.map(p => urls[p.id] && (
          <figure key={p.id}>
            {/* eslint-disable-next-line @next/next/no-img-element -- link firmato temporaneo, niente ottimizzatore */}
            <img src={urls[p.id]} alt={`${titolo} — pagina ${p.page_order}`}
              className="w-full h-auto" style={{ borderRadius: t.r, border: t.bordoCarta }} />
            {ordinate.length > 1 && (
              <figcaption className="text-[11.5px] mt-1 text-center" style={{ color: t.sub }}>
                pagina {p.page_order} di {ordinate.length}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </Foglio>
  )
}
