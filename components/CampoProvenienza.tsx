'use client'
// «Come ci ha trovato» (08/09/2026): chip come quelli del canale (Google ·
// Passaparola · Altra struttura · Non so); con «Altra struttura» compare
// «Quale struttura» con i suggerimenti dai nomi noti mentre si scrive
// (ordinati per ospiti già portati); un nome nuovo si accetta scrivendolo.
// Non obbligatorio. Senza la proposta 0036 il campo resta nascosto e compare
// l'avviso «serve la migrazione». Nessun colore nuovo.
import { useState } from 'react'
import { PROVENIENZE, AVVISO_0036, suggerimentiDaMostrare, strutturaNota, type Provenienza, type StrutturaNota } from '@/lib/provenienza'

export type ValoreProvenienza = { provenienza: Provenienza; struttura: string }

export default function CampoProvenienza({ valore, onChange, strutture, disponibile, compatto }: {
  valore: ValoreProvenienza
  onChange: (v: ValoreProvenienza) => void
  strutture: StrutturaNota[]
  disponibile: boolean        // false = migrazione 0036 non applicata
  compatto?: boolean          // chip più piccoli (scheda prenotazione e nuova prenotazione)
}) {
  const [aperto, setAperto] = useState(false)
  if (!disponibile) {
    return (
      <div data-provenienza="non-disponibile">
        <p className="text-sm text-stone mb-1">Come ci ha trovato</p>
        <p className="text-xs text-stone">{AVVISO_0036}</p>
      </div>
    )
  }
  const chip = (attivo: boolean) => compatto
    ? `px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${attivo ? 'bg-green-mid text-white' : 'bg-white text-gray-600 border border-[#C9BFA8]'}`
    : `rounded-full text-sm font-semibold px-4 py-2 transition-colors ${attivo ? 'bg-green-mid text-cream-text' : 'border border-[#C9BFA8] bg-white text-stone'}`
  // Al tocco nel campo si vedono sempre le strutture (tutte se il nome è già
  // completo, quella attuale evidenziata); filtrate solo mentre si scrive un testo nuovo
  const { lista: suggerimenti, attuale } = suggerimentiDaMostrare(valore.struttura, strutture)
  const nuovo = valore.struttura.trim() && !strutturaNota(valore.struttura, strutture)
  return (
    <div data-provenienza={valore.provenienza}>
      <p className={compatto ? 'text-sm text-gray-500 mb-1' : 'text-sm text-stone mb-1'}>Come ci ha trovato</p>
      <div className="flex flex-wrap gap-2">
        {PROVENIENZE.map(p => (
          <button key={p.chiave} type="button" aria-pressed={valore.provenienza === p.chiave} className={chip(valore.provenienza === p.chiave)}
            onClick={() => onChange({ ...valore, provenienza: p.chiave })}>
            {p.label}
          </button>
        ))}
      </div>
      {valore.provenienza === 'altra_struttura' && (
        <div className="mt-2">
          <p className={compatto ? 'text-sm text-gray-500 mb-1' : 'text-sm text-stone mb-1'}>Quale struttura</p>
          <input value={valore.struttura} onChange={e => { onChange({ ...valore, struttura: e.target.value }); setAperto(true) }}
            onFocus={() => setAperto(true)} onClick={() => setAperto(true)} onBlur={() => setTimeout(() => setAperto(false), 150)}
            autoComplete="off" autoCapitalize="words" placeholder="Nome della struttura" aria-label="Quale struttura"
            className="w-full min-w-0 appearance-none bg-white border border-[#C9BFA8] shadow-sm rounded-lg p-3 text-[15px] focus:outline-none focus:border-green-mid" />
          {aperto && suggerimenti.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-1.5" role="listbox" aria-label="Strutture note">
              {suggerimenti.map(s => (
                <button key={s.nome} type="button" role="option" aria-selected={s.nome === attuale}
                  onPointerDown={e => e.preventDefault()} onMouseDown={e => e.preventDefault()} onClick={() => { onChange({ ...valore, struttura: s.nome }); setAperto(false) }}
                  className={`rounded-full text-[13px] px-3 py-1 border transition-colors ${s.nome === attuale ? 'bg-green-mid text-white border-green-mid' : 'border-[#C9BFA8] bg-white text-green-dark'}`}>
                  {s.nome}{s.ospiti > 0 && <span className="text-stone"> · {s.ospiti}</span>}
                </button>
              ))}
            </div>
          )}
          {nuovo && <p className="text-xs text-stone mt-1">Nome nuovo: si aggiunge all&apos;elenco al salvataggio</p>}
        </div>
      )}
    </div>
  )
}
