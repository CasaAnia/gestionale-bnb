'use client'
import type { MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Phone } from 'lucide-react'
import { nomeCompleto, tastoRichiesta, type Richiesta } from '@/lib/richieste'
import { normalizzaTelefono, openWhatsApp } from '@/lib/whatsapp'

// Cosa si può fare su una richiesta ancora aperta. Il testo del tasto pieno lo
// decide lib/richieste (tastoRichiesta): «Invia proposta» finché la proposta
// non è partita, «Conferma» quando è già stata inviata.
//
// Due vesti, gli stessi comandi:
//  · AzioniRichiesta — la riga di sempre, usata dal pannello del calendario;
//  · TastoPrincipale + ComandiRichiesta — la scheda dell'elenco (Ania,
//    12/09/2026): il tasto pieno largo quanto la scheda, poi la nota del
//    cliente, e per ultima la riga dei comandi, che pesa meno di tutto.
// «Invia proposta» apre /richieste/<id>/proposta, «Modifica» apre
// /richieste/<id>/modifica; rifiuto e conferma veri (con le loro finestre) li
// gestisce chi contiene.
type Props = { r: Richiesta; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void; compatto?: boolean }

// desktop (blocco 2b): pulsanti allineati a destra su una riga, larghezza dal contenuto
const PIENO = 'flex-1 md:flex-none md:px-5 inline-flex items-center justify-center rounded-xl bg-green-mid text-cream-text font-semibold active:opacity-80 transition-opacity'
const CONTORNO = 'flex-1 md:flex-none md:px-5 inline-flex items-center justify-center rounded-xl bg-white text-green-dark font-semibold border active:bg-sage transition-colors'
const CONTATTO = 'shrink-0 w-11 inline-flex items-center justify-center rounded-xl bg-white text-green-dark border active:bg-sage transition-colors'

const BORDO_TONDO = '#C9BFA8'
// I due tondi restano tondi: larghezza e altezza uguali e fisse, mai schiacciate
const TONDO = 'shrink-0 inline-flex items-center justify-center rounded-full bg-white border active:bg-sage transition-colors'
const MISURA_TONDO = { width: 46, height: 46, borderColor: BORDO_TONDO, color: 'var(--color-green-mid)' } as const

function ferma(e: MouseEvent) { e.stopPropagation() }

export default function AzioniRichiesta({ r, onRifiuta, onConferma, compatto = false }: Props) {
  const router = useRouter()
  if (r.stato !== 'in_attesa' && r.stato !== 'proposta_inviata') return null
  const misura = compatto ? 'py-2 text-[13px]' : 'py-2.5 text-sm'
  const telefono = normalizzaTelefono(r.telefono).numero
  const nome = nomeCompleto(r)

  return (
    <div className="mt-3" onClick={ferma}>
      <div className="flex gap-2 md:justify-end">
        {r.stato === 'in_attesa' ? (
          <button type="button" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/proposta`) }} className={`${PIENO} ${misura}`}>
            {tastoRichiesta(r.stato)}
          </button>
        ) : (
          <button type="button" onClick={e => { ferma(e); onConferma(r) }} className={`${PIENO} ${misura}`}>{tastoRichiesta(r.stato)}</button>
        )}
        <button type="button" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/modifica`) }} className={`${CONTORNO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
          Modifica
        </button>
        <button type="button" onClick={e => { ferma(e); onRifiuta(r) }} className={`${CONTORNO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
          Rifiuta
        </button>
        {telefono && (
          <>
            <a href={`tel:${telefono}`} onClick={ferma} aria-label={`Chiama ${nome}`} title="Chiama il cliente"
              className={`${CONTATTO} ${misura}`} style={{ borderColor: '#C9BFA8' }}>
              <Phone size={17} strokeWidth={2} aria-hidden />
            </a>
            <a href={`https://wa.me/${telefono}`} target="_blank" rel="noopener noreferrer" onClick={e => { ferma(e); e.preventDefault(); openWhatsApp(telefono, '') }} aria-label={`Scrivi su WhatsApp a ${nome}`} title="Apri WhatsApp senza testo"
              className={`${CONTATTO} ${misura}`} style={{ borderColor: '#C9BFA8', color: '#2D6A4F' }}>
              <MessageCircle size={17} strokeWidth={2} aria-hidden />
            </a>
          </>
        )}
      </div>
    </div>
  )
}

// ── La scheda dell'elenco (Ania, 12/09/2026) ────────────────────────────────

// Il tasto pieno: largo quanto la scheda, alto almeno 50 px, verde pieno e
// testo bianco. È l'unica cosa grossa della scheda, così si vede subito cosa
// fare adesso.
export function TastoPrincipale({ r, onConferma, className = '' }: { r: Richiesta; onConferma: (r: Richiesta) => void; className?: string }) {
  const router = useRouter()
  const testo = tastoRichiesta(r.stato)
  if (!testo) return null
  return (
    <button type="button" data-tasto-principale onClick={e => {
      ferma(e)
      if (r.stato === 'in_attesa') router.push(`/richieste/${r.id}/proposta`)
      else onConferma(r)
    }}
      className={`w-full inline-flex items-center justify-center rounded-xl bg-green-mid active:opacity-80 transition-opacity ${className}`}
      style={{ minHeight: 50, fontSize: 15, fontWeight: 700, color: '#fff' }}>
      {testo}
    </button>
  )
}

// La riga dei comandi, l'ultima cosa della scheda: «Modifica» e «Rifiuta»
// scritte piccole (ed-azione tiene comunque 44 px di area da toccare), e a
// destra i due tondi per chiamare e scrivere su WhatsApp.
export function ComandiRichiesta({ r, onRifiuta, className = '' }: { r: Richiesta; onRifiuta: (r: Richiesta) => void; className?: string }) {
  const router = useRouter()
  if (r.stato !== 'in_attesa' && r.stato !== 'proposta_inviata') return null
  const telefono = normalizzaTelefono(r.telefono).numero
  const nome = nomeCompleto(r)
  return (
    <div data-comandi-richiesta className={`flex items-center justify-between gap-3 ${className}`} onClick={ferma}>
      <span className="flex items-center gap-2 min-w-0">
        <button type="button" data-comando="modifica" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/modifica`) }}
          className="ed-azione" style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-green-mid)' }}>
          Modifica
        </button>
        <span aria-hidden className="text-[13.5px]" style={{ color: 'var(--color-stone)' }}>·</span>
        {/* «Rifiuta» pesa meno di tutto il resto: non è grassetto ed è color stone */}
        <button type="button" data-comando="rifiuta" onClick={e => { ferma(e); onRifiuta(r) }}
          className="ed-azione" style={{ fontSize: 13.5, fontWeight: 400, color: 'var(--color-stone)' }}>
          Rifiuta
        </button>
      </span>
      {telefono && (
        <span className="flex items-center gap-2 shrink-0">
          <a href={`tel:${telefono}`} onClick={ferma} aria-label={`Chiama ${nome}`} title="Chiama il cliente"
            className={TONDO} style={MISURA_TONDO}>
            <Phone size={18} strokeWidth={2} aria-hidden />
          </a>
          <a href={`https://wa.me/${telefono}`} target="_blank" rel="noopener noreferrer" onClick={e => { ferma(e); e.preventDefault(); openWhatsApp(telefono, '') }} aria-label={`Scrivi su WhatsApp a ${nome}`} title="Apri WhatsApp senza testo"
            className={TONDO} style={MISURA_TONDO}>
            <MessageCircle size={18} strokeWidth={2} aria-hidden />
          </a>
        </span>
      )}
    </div>
  )
}
