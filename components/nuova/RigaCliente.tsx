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
    <button type="button" data-senza-sottolinea onClick={onClick} className={`py-[7px] -my-[7px] ${className}`}
      style={{ height: 30, borderRadius: 6, padding: '0 9px', background: 'var(--color-sage)', color: 'var(--color-green-mid)', fontSize: 13, fontWeight: 700 }}>{testo}</button>
  )
}

// Una riga dell'elenco dei clienti trovati: la forma delle righe «Da
// controllare» della Home.
export default function RigaCliente({ cliente, soggiorni, onScegli }: { cliente: ClienteRiga; soggiorni: number; onScegli: () => void }) {
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
