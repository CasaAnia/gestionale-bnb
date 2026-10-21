'use client'
// ============================================================================
// «Quali documenti passano alla cliente nuova» (D2, Ania 21/10/2026, scelta b)
//
// Usato da «Cambia cliente» nel foglio della scheda nuova e nella finestra
// vecchia. Ogni documento della cliente di partenza ha la sua casella, con la
// miniatura e la data per riconoscerlo; all'inizio NESSUNO è spuntato. Sotto,
// una riga dice esattamente cosa succederà: da chi, a chi, quali documenti
// (o che restano tutti dove sono). Le scelte stanno nel componente padre.
// ============================================================================
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { descriviDocumento, titoloSceltaDocumenti, riepilogoDocumenti, type DocumentoDaScegliere } from '@/lib/cambiaCliente'

export default function SceltaDocumenti({ documenti, scelti, onScegli, nomeVecchio, nomeNuovo, disabilitata = false }: {
  documenti: DocumentoDaScegliere[]
  scelti: string[]
  onScegli: (id: string, si: boolean) => void
  nomeVecchio: string | null | undefined
  nomeNuovo: string | null | undefined
  disabilitata?: boolean
}) {
  const [anteprime, setAnteprime] = useState<Record<string, string>>({})
  const chiave = documenti.map(d => d.id).join(',')
  useEffect(() => {
    let vivo = true
    void (async () => {
      const urls: Record<string, string> = {}
      for (const d of documenti) {
        try {
          const { data } = await supabase.storage.from('documenti').createSignedUrl(d.percorso, 3600)
          if (data?.signedUrl) urls[d.id] = data.signedUrl
        } catch { /* senza miniatura resta la descrizione */ }
      }
      if (vivo) setAnteprime(urls)
    })()
    return () => { vivo = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chiave])

  const titolo = titoloSceltaDocumenti(documenti.length, nomeVecchio)
  if (!titolo) return null
  const riepilogo = riepilogoDocumenti(documenti.filter(d => scelti.includes(d.id)), documenti.length, nomeVecchio, nomeNuovo)
  return (
    <div data-scelta-documenti className="mt-3" style={{ fontSize: 13, color: 'var(--color-green-dark)' }}>
      <p data-titolo-scelta-documenti>{titolo}</p>
      <ul className="mt-2 space-y-1.5">
        {documenti.map(d => (
          <li key={d.id}>
            <label className="flex items-center gap-2.5 cursor-pointer" data-documento-da-scegliere={d.id}>
              <input type="checkbox" checked={scelti.includes(d.id)} disabled={disabilitata}
                onChange={e => onScegli(d.id, e.target.checked)} className="accent-[#2D6A4F]" aria-label={`Sposta ${descriviDocumento(d)}`} />
              <span className="shrink-0 overflow-hidden rounded" style={{ width: 56, height: 42, background: 'var(--m-line, #e7e3da)' }}>
                {anteprime[d.id] && !d.percorso.endsWith('.pdf')
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={anteprime[d.id]} alt="" className="w-full h-full object-cover" />
                  : <span className="flex w-full h-full items-center justify-center" style={{ fontSize: 11 }}>{d.percorso.endsWith('.pdf') ? 'PDF' : '…'}</span>}
              </span>
              <span>{descriviDocumento(d)}</span>
            </label>
          </li>
        ))}
      </ul>
      {riepilogo && <p data-riepilogo-documenti className="mt-2" style={{ fontWeight: 600 }}>{riepilogo}</p>}
    </div>
  )
}
