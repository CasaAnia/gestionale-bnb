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
//  · TastoPrincipale + TondiContatto + ComandiRichiesta — la scheda
//    dell'elenco (Ania, su bozza, 12/09/2026): il tasto pieno e i due tondi
//    sulla stessa riga, e sotto «Modifica» · «Rifiuta», che pesano meno.
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
const MISURA_TONDO = { width: 38, height: 38, borderColor: BORDO_TONDO, color: 'var(--color-green-mid)' } as const

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

// Il tasto pieno: verde pieno, testo bianco, alto 38 px. Si allarga per tutta
// la riga lasciando posto ai due tondi, che stanno in fondo a destra (Ania, su
// bozza, 12/09/2026: la scheda deve restare corta).
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
      className={`flex-1 min-w-0 inline-flex items-center justify-center rounded-xl bg-green-mid active:opacity-80 transition-opacity ${className}`}
      style={{ height: 38, fontSize: 13, fontWeight: 700, color: '#fff' }}>
      {testo}
    </button>
  )
}

// I due tondi per chiamare e per scrivere su WhatsApp: 38 px, contorno chiaro
// e segno verde. Senza numero di telefono non compaiono.
export function TondiContatto({ r, className = '' }: { r: Richiesta; className?: string }) {
  const telefono = normalizzaTelefono(r.telefono).numero
  if (!telefono) return null
  const nome = nomeCompleto(r)
  return (
    <span data-tondi-contatto className={`flex items-center gap-2 shrink-0 ${className}`} onClick={ferma}>
      <a href={`tel:${telefono}`} onClick={ferma} aria-label={`Chiama ${nome}`} title="Chiama il cliente"
        className={TONDO} style={MISURA_TONDO}>
        <Phone size={16} strokeWidth={2} aria-hidden />
      </a>
      <a href={`https://wa.me/${telefono}`} target="_blank" rel="noopener noreferrer" onClick={e => { ferma(e); e.preventDefault(); openWhatsApp(telefono, '') }} aria-label={`Scrivi su WhatsApp a ${nome}`} title="Apri WhatsApp senza testo"
        className={TONDO} style={MISURA_TONDO}>
        <MessageCircle size={16} strokeWidth={2} aria-hidden />
      </a>
    </span>
  )
}

// L'ultima riga della scheda: «Modifica» e «Rifiuta», scritte piccole.
// L'area da toccare resta di 44 px (13 px di imbottitura sopra e sotto), ma i
// margini negativi la fanno pesare quasi niente in altezza: la scheda deve
// stare in circa 125 px (Ania, su bozza, 12/09/2026).
const COMANDO = 'inline-flex items-center py-[13px] -my-[13px] rounded-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid'
const FILO_COMANDO = { textDecorationColor: 'var(--color-card-border)' } as const

export function ComandiRichiesta({ r, onRifiuta, className = '' }: { r: Richiesta; onRifiuta: (r: Richiesta) => void; className?: string }) {
  const router = useRouter()
  if (r.stato !== 'in_attesa' && r.stato !== 'proposta_inviata') return null
  return (
    <div data-comandi-richiesta className={`flex items-center gap-2 ${className}`} onClick={ferma}>
      <button type="button" data-comando="modifica" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/modifica`) }}
        className={COMANDO} style={{ ...FILO_COMANDO, fontSize: 12.5, fontWeight: 600, color: 'var(--color-green-mid)' }}>
        Modifica
      </button>
      <span aria-hidden className="text-[12.5px]" style={{ color: 'var(--color-stone)' }}>·</span>
      {/* «Rifiuta» pesa meno di tutto il resto: non è grassetto ed è color stone */}
      <button type="button" data-comando="rifiuta" onClick={e => { ferma(e); onRifiuta(r) }}
        className={COMANDO} style={{ ...FILO_COMANDO, fontSize: 12.5, fontWeight: 400, color: 'var(--color-stone)' }}>
        Rifiuta
      </button>
    </div>
  )
}
