'use client'
// ============================================================================
// NUOVA PRENOTAZIONE — /nuova-prenotazione (14/09/2026).
// La pagina di inserimento nella veste nuova, a un indirizzo a parte: /nuova
// resta com'è finché questa non è completa.
//
// Si parte dalla ricerca del cliente (punto 1), poi il cliente nuovo (2), il
// soggiorno con la striscia delle notti (3), arrivo/come paga/con lei/note (4)
// e il conto sempre in vista (5).
//
// Nessuna regola riscritta: le camere libere e la capienza vengono da
// lib/disponibilita e lib/tariffe, i prezzi da lib/prezzoNotti, i periodi e il
// conto da lib/prenotazioneComposta, le notti da lib/strisciaNotti (la stessa
// striscia della scheda), «come paga» da lib/comePaga. Qui sta solo la pagina.
// ============================================================================
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import BackBar from '@/components/BackBar'
import CampoRicerca from '@/components/CampoRicerca'
import { supabase } from '@/lib/supabase'
import { oggiARoma } from '@/lib/spese/adattatore'
import { dataDiOggi, rigaClienteTrovato } from '@/lib/nuovaPrenotazione'
import { valutazioneDi, vuoleRicevuta } from '@/lib/valutazione'
import { filtraClienti } from '@/lib/cambiaCliente'
import { messaggioLetturaNonRiuscita } from '@/lib/prenotazioneScritture'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const OTTONE = '#A9884E'
export const TITOLO_PAGINA = 'Nuova prenotazione'
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
    <button type="button" onClick={onClick} className={`py-[7px] -my-[7px] ${className}`}
      style={{ height: 30, borderRadius: 6, padding: '0 9px', background: 'var(--color-sage)', color: 'var(--color-green-mid)', fontSize: 13, fontWeight: 700 }}>{testo}</button>
  )
}

// Una riga dell'elenco dei clienti trovati: la forma delle righe «Da
// controllare» della Home.
export function RigaCliente({ cliente, soggiorni, onScegli }: { cliente: ClienteRiga; soggiorni: number; onScegli: () => void }) {
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

export default function NuovaPrenotazionePage() {
  const router = useRouter()
  const oggi = oggiARoma()
  const [ricerca, setRicerca] = useState('')
  const [risultati, setRisultati] = useState<ClienteRiga[]>([])
  const [soggiorni, setSoggiorni] = useState<Record<string, number>>({})
  const [erroreRicerca, setErroreRicerca] = useState<string | null>(null)
  const [cliente, setCliente] = useState<ClienteRiga | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // La ricerca: nome o telefono, con la stessa regola già in uso. Si aspetta
  // un quarto di secondo dall'ultimo tasto, come nell'inserimento di adesso.
  function scriviRicerca(v: string) {
    setRicerca(v)
    if (timer.current) clearTimeout(timer.current)
    const testo = v.trim()
    if (testo.length < 2) { setRisultati([]); return }
    timer.current = setTimeout(() => { void cerca(testo) }, 250)
  }

  async function cerca(testo: string) {
    setErroreRicerca(null)
    const cifre = testo.replace(/\D/g, '')
    let query = supabase.from('guests').select('*')
    if (cifre.length >= 3) query = query.or(`full_name.ilike.%${testo}%,phone.ilike.%${cifre}%`)
    else query = query.ilike('full_name', `%${testo}%`)
    const { data, error } = await query.limit(20)
    if (error) { setErroreRicerca(messaggioLetturaNonRiuscita(error, 'cercare il cliente')); setRisultati([]); return }
    const trovati = filtraClienti(testo, (data ?? []) as ClienteRiga[])
    setRisultati(trovati)
    // quante volte è già stata qui: soggiorni conclusi, senza le annullate
    const ids = trovati.map(c => c.id)
    if (ids.length === 0) return
    const { data: righe } = await supabase.from('bookings').select('guest_id, check_out, status').in('guest_id', ids).neq('status', 'annullata')
    const conta: Record<string, number> = {}
    for (const b of (righe ?? []) as { guest_id: string; check_out: string }[]) {
      if (b.check_out <= oggi) conta[b.guest_id] = (conta[b.guest_id] ?? 0) + 1
    }
    setSoggiorni(conta)
  }

  return (
    <div className="py-4 px-[22px] md:max-w-[620px] md:mx-auto">
      <div className="-mx-[6px]"><BackBar href="/prenotazioni" /></div>

      <h1 style={{ fontFamily: GEORGIA, fontSize: 26, lineHeight: '30px', color: 'var(--color-green-dark)', marginTop: 10 }}>{TITOLO_PAGINA}</h1>
      <p data-oggi className="uppercase" style={{ fontSize: 10, letterSpacing: '1.5px', color: OTTONE, marginTop: 4 }}>{dataDiOggi(oggi)}</p>

      {!cliente && (
        <section data-cerca-cliente style={{ marginTop: 18 }}>
          <CampoRicerca value={ricerca} onChange={scriviRicerca} placeholder="Cerca per nome o telefono…" />
          <div style={{ marginTop: 10 }}><TastinoSage testo={NUOVO_CLIENTE} onClick={() => router.push('#nuovo')} /></div>
          {erroreRicerca && <p className="mt-3" style={{ fontSize: 13, color: '#8C3B2E' }}>{erroreRicerca}</p>}
          {risultati.length > 0 && (
            <div data-trovati style={{ marginTop: 14 }}>
              {risultati.map(c => <RigaCliente key={c.id} cliente={c} soggiorni={soggiorni[c.id] ?? 0} onScegli={() => setCliente(c)} />)}
              <div style={{ marginTop: 12 }}><TastinoSage testo={NUOVO_CLIENTE} onClick={() => router.push('#nuovo')} /></div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
