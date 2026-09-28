'use client'
// ============================================================================
// LA RIGA DI UN CLIENTE TROVATO e il tastino «+ Nuovo cliente» (14/09/2026),
// usati dalla ricerca dell'inserimento (/nuova-prenotazione) e, dal
// 16/09/2026, dal foglio «Cambia cliente» della scheda: la stessa riga —
// 🧾 ★ nome, telefono, quante volte è stata — in un posto solo.
// Sola presentazione: le parole di sotto le fa lib/nuovaPrenotazione.
// ============================================================================
import { rigaClienteTrovato } from '@/lib/nuovaPrenotazione'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { euroTondi } from '@/lib/euroTondi'
import { useMaison } from './PezziNuova'
import type { ReactNode } from 'react'

const OTTONE = '#A9884E'
export const NUOVO_CLIENTE = '+ Nuovo cliente'

export type ClienteRiga = {
  id: string
  full_name?: string | null
  phone?: string | null
  rating?: string | null
  vuole_ricevuta?: boolean | null
  notes?: string | null
  provenienza?: string | null
  struttura_nome?: string | null
}

// Il tastino verde chiaro, alto 30: «+ Nuovo cliente» e i fratelli
export function TastinoSage({ testo, onClick, className = '' }: { testo: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" data-senza-sottolinea onClick={onClick} className={className}
      style={{ minHeight: 30, borderRadius: 6, padding: '0 9px', background: 'var(--color-sage)', color: 'var(--color-green-mid)', fontSize: 13, fontWeight: 700 }}>{testo}</button>
  )
}

/** Veste «Maison» (28/09/2026): 🧾 ★ in ottone e nome in Cormorant; sotto
 *  telefono · soggiorni e, in mattone, quanto ha speso in tutto. La stessa
 *  riga serve alla ricerca (con «›») e al cliente scelto (con «cambia»). */
export function RigaClienteMaison({ cliente, soggiorni, spesoCent, destra, onScegli, primo = false, dati }: {
  cliente: ClienteRiga; soggiorni: number; spesoCent?: number | null; destra?: ReactNode; onScegli?: () => void; primo?: boolean; dati?: Record<string, string>
}) {
  const segni = [vuoleRicevuta(cliente) ? '🧾' : '', valutazioneDi(cliente) === 'ottimo' ? '★' : ''].filter(Boolean).join(' ')
  const dentro = (
    <>
      <span className="min-w-0">
        <span className="nm">
          {segni && <b aria-label={vuoleRicevuta(cliente) ? 'vuole la ricevuta' : undefined}>{segni} </b>}
          {(cliente.full_name ?? '').trim() || 'senza nome'}
        </span>
        <span className="sm">
          {rigaClienteTrovato(cliente.phone, soggiorni)}
          {spesoCent != null && spesoCent > 0 && <> · <span className="np-mat" data-speso>{euroTondi(spesoCent)}</span></>}
        </span>
      </span>
      {destra}
    </>
  )
  if (onScegli) return <button type="button" data-cliente={cliente.id} onClick={onScegli} className={`np-cl ${primo ? 'primo' : ''}`} {...dati}>{dentro}</button>
  return <div className={`np-cl ${primo ? 'primo' : ''}`} {...dati}>{dentro}</div>
}

// Una riga dell'elenco dei clienti trovati: la forma delle righe «Da
// controllare» della Home.
export default function RigaCliente({ cliente, soggiorni, spesoCent, onScegli }: { cliente: ClienteRiga; soggiorni: number; spesoCent?: number | null; onScegli: () => void }) {
  const maison = useMaison()
  if (maison) return <RigaClienteMaison cliente={cliente} soggiorni={soggiorni} spesoCent={spesoCent} onScegli={onScegli} destra={<span aria-hidden className="ar">›</span>} />
  return (
    <button type="button" data-cliente={cliente.id} onClick={onScegli}
      className="w-full flex items-center justify-between gap-3 text-left" style={{ padding: '12px 0', borderTop: '1px solid var(--color-card-border)' }}>
      <span className="min-w-0">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-green-dark)' }}>
          {vuoleRicevuta(cliente) && <span aria-label="vuole la ricevuta">🧾 </span>}
          {valutazioneDi(cliente) === 'ottimo' && <span aria-hidden style={{ color: OTTONE }}>★ </span>}
          {(cliente.full_name ?? '').trim() || 'senza nome'}
        </span>
        <span className="block truncate" style={{ fontSize: 12.5, color: 'var(--color-stone)', marginTop: 2 }}>{rigaClienteTrovato(cliente.phone, soggiorni)}</span>
      </span>
      <span aria-hidden style={{ fontSize: 18, color: 'var(--color-stone)' }}>›</span>
    </button>
  )
}
