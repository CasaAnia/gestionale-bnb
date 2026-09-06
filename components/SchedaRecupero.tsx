'use client'
// Scheda «Camera · non usato e recuperato» (06/09/2026): dopo «Pulita +
// recuperato» Ania tocca un chip per ogni pezzo di biancheria che l'ospite
// NON ha usato ed è tornato pulito; ritocca per togliere (oltre il massimo il
// chip torna a 0). Due gruppi (Lenzuola, Asciugamani), in fondo il totale e
// «Salva»: una sola scrittura (upsert sulla stessa pulizia). Se il
// salvataggio fallisce l'avviso resta nella scheda e la pulizia è già segnata.
import { useState } from 'react'
import AvvisoAzione from './AvvisoAzione'
import { VOCI, ETICHETTA_GRUPPO, TITOLO_SCHEDA, SOTTOTITOLO_SCHEDA, tocca, testoTotale, type Contatori, type Gruppo } from '@/lib/biancheria'

const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
const GRUPPI: Gruppo[] = ['lenzuola', 'asciugamani']

export default function SchedaRecupero({ camera, iniziale, onSalva, onChiudi }: {
  camera: string
  iniziale: Contatori
  onSalva: (valori: Contatori) => Promise<string | null>   // null = salvato (la scheda si chiude), altrimenti il messaggio
  onChiudi: () => void
}) {
  const [valori, setValori] = useState<Contatori>(iniziale)
  const [salvando, setSalvando] = useState(false)
  const [avviso, setAvviso] = useState<string | null>(null)

  async function salva() {
    if (salvando) return
    setSalvando(true); setAvviso(null)
    const msg = await onSalva(valori)
    setSalvando(false)
    if (msg) setAvviso(msg)
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-3 sm:p-4" style={{ background: 'rgba(31,61,47,0.45)' }} onClick={onChiudi} data-scheda-recupero>
      <div className="scheda-in w-full max-w-md rounded-2xl p-4 shadow-lg" style={{ background: '#FBF9F4', border: '1px solid #C9BFA8' }} onClick={e => e.stopPropagation()}>
        <p className="text-[19px] leading-tight text-green-dark" style={FRAUNCES}>{camera} · {TITOLO_SCHEDA}</p>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--color-stone)' }}>{SOTTOTITOLO_SCHEDA}</p>

        {GRUPPI.map(g => (
          <div key={g} className="mt-4">
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass mb-2">{ETICHETTA_GRUPPO[g]}</p>
            <div className="flex flex-wrap gap-2">
              {VOCI.filter(v => v.gruppo === g).map(v => {
                const n = valori[v.chiave]
                const attivo = n > 0
                return (
                  <button key={v.chiave} type="button" onClick={() => setValori(x => tocca(x, v.chiave))} disabled={salvando}
                    data-chip={v.chiave} data-valore={n} aria-pressed={attivo}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors duration-100 active:scale-[0.97] disabled:opacity-60"
                    style={{ minHeight: 40, background: attivo ? '#2D6A4F' : '#FFFFFF', color: attivo ? '#FFFFFF' : '#1F3D2F', border: `1px solid ${attivo ? '#2D6A4F' : '#C9BFA8'}` }}>
                    {v.chip}
                    {attivo && (
                      <span className="inline-flex items-center justify-center rounded-full text-[11px] font-bold" style={{ minWidth: 20, height: 20, padding: '0 5px', background: '#A9884E', color: '#FFFFFF' }}>{n}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {avviso && <AvvisoAzione testo={avviso} onRiprova={salva} className="mt-4" />}

        <div className="flex items-center justify-between gap-3 mt-5">
          <span className="text-[13px] font-semibold text-green-dark" data-totale>{testoTotale(valori)}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onChiudi} disabled={salvando}
              className="rounded-lg px-3 text-[13px] font-semibold disabled:opacity-60" style={{ minHeight: 40, color: 'var(--color-stone)' }}>
              Chiudi
            </button>
            <button type="button" onClick={salva} disabled={salvando}
              className="rounded-lg px-5 text-[14px] font-semibold text-white shadow-sm transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
              style={{ minHeight: 40, background: '#2D6A4F' }}>
              {salvando ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
