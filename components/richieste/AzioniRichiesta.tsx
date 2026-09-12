'use client'
import type { MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Phone } from 'lucide-react'
import { nomeCompleto, tastoRichiesta, type Richiesta } from '@/lib/richieste'
import { normalizzaTelefono, openWhatsApp } from '@/lib/whatsapp'
import { BOTTONE_PIENO } from '@/components/BottoniWhatsApp'

// Cosa si può fare su una richiesta ancora aperta. Il testo del tasto pieno lo
// decide lib/richieste (tastoRichiesta): «Invia proposta» finché la proposta
// non è partita, «Conferma» quando è già stata inviata.
//
// Due vesti, gli stessi comandi:
//  · AzioniRichiesta — la riga di sempre, usata dal pannello del calendario;
//  · TastoPrincipale + ComandiRichiesta + IconeContatto — l'ultima riga della
//    richiesta nell'elenco (Ania, su bozza, 12/09/2026): la pastiglia verde,
//    le due parole e, in fondo a destra, le due icone nude.
// «Invia proposta» apre /richieste/<id>/proposta, «Modifica» apre
// /richieste/<id>/modifica; rifiuto e conferma veri (con le loro finestre) li
// gestisce chi contiene.
type Props = { r: Richiesta; onRifiuta: (r: Richiesta) => void; onConferma: (r: Richiesta) => void; compatto?: boolean }

// desktop (blocco 2b): pulsanti allineati a destra su una riga, larghezza dal contenuto
const PIENO = 'flex-1 md:flex-none md:px-5 inline-flex items-center justify-center rounded-xl bg-green-mid text-cream-text font-semibold active:opacity-80 transition-opacity'
const CONTORNO = 'flex-1 md:flex-none md:px-5 inline-flex items-center justify-center rounded-xl bg-white text-green-dark font-semibold border active:bg-sage transition-colors'
const CONTATTO = 'shrink-0 w-11 inline-flex items-center justify-center rounded-xl bg-white text-green-dark border active:bg-sage transition-colors'

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

// ── La riga dell'elenco (Ania, su bozza, 12/09/2026) ────────────────────────
//
// L'ultima riga della richiesta: la pastiglia verde tonda dell'azione, poi
// «Modifica» e «Rifiuta» come parole, e in fondo a destra le due icone per
// chiamare e per scrivere su WhatsApp, nude, senza cerchio.
//
// La pastiglia è l'UNICA cosa piena della pagina: tutto il resto sono parole e
// etichettine squadrate. È quella già usata nel gestionale per i tasti
// WhatsApp (BOTTONE_PIENO di components/BottoniWhatsApp), con le misure della
// bozza: 5 px sopra e sotto, 12 ai lati.
//
// Tutte e quattro le cose da toccare tengono un'area utile di almeno 44 px di
// altezza; i margini negativi fanno sì che non rubino altezza alla riga, che
// deve stare in circa 95 px.

const MISURA_PASTIGLIA = { padding: '5px 12px' } as const

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
      className={`shrink-0 inline-flex items-center py-[9px] -my-[9px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid ${className}`}>
      <span className={BOTTONE_PIENO} style={MISURA_PASTIGLIA}>{testo}</span>
    </button>
  )
}

// Le due icone per chiamare e per scrivere su WhatsApp: nude, 17 px, green-mid.
// Niente più cerchio col contorno. Senza numero di telefono non compaiono.
const ICONA = 'inline-flex items-center justify-center shrink-0 text-green-mid rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid'
const MISURA_ICONA = { width: 40, height: 44, marginTop: -9, marginBottom: -9 } as const

export function IconeContatto({ r, className = '' }: { r: Richiesta; className?: string }) {
  const telefono = normalizzaTelefono(r.telefono).numero
  if (!telefono) return null
  const nome = nomeCompleto(r)
  return (
    <span data-icone-contatto className={`flex items-center shrink-0 ${className}`} onClick={ferma}>
      <a href={`tel:${telefono}`} onClick={ferma} aria-label={`Chiama ${nome}`} title="Chiama il cliente"
        className={ICONA} style={MISURA_ICONA}>
        <Phone size={17} strokeWidth={2} aria-hidden />
      </a>
      <a href={`https://wa.me/${telefono}`} target="_blank" rel="noopener noreferrer" onClick={e => { ferma(e); e.preventDefault(); openWhatsApp(telefono, '') }} aria-label={`Scrivi su WhatsApp a ${nome}`} title="Apri WhatsApp senza testo"
        className={ICONA} style={{ ...MISURA_ICONA, marginRight: -11 }}>
        <MessageCircle size={17} strokeWidth={2} aria-hidden />
      </a>
    </span>
  )
}

// «Modifica» e «Rifiuta»: parole da toccare, 13 px color stone, distanziate di
// 14 px dalla pastiglia e fra loro. Niente sottolineatura e niente contorni.
const COMANDO = 'inline-flex items-center shrink-0 py-[15px] -my-[15px] rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-mid'
const MISURA_COMANDO = { fontSize: 13, color: 'var(--color-stone)' } as const
export const SPAZIO_COMANDI = 14

export function ComandiRichiesta({ r, onRifiuta, className = '' }: { r: Richiesta; onRifiuta: (r: Richiesta) => void; className?: string }) {
  const router = useRouter()
  if (r.stato !== 'in_attesa' && r.stato !== 'proposta_inviata') return null
  return (
    <span data-comandi-richiesta className={`flex items-center ${className}`} style={{ gap: SPAZIO_COMANDI }} onClick={ferma}>
      <button type="button" data-comando="modifica" onClick={e => { ferma(e); router.push(`/richieste/${r.id}/modifica`) }}
        className={COMANDO} style={MISURA_COMANDO}>
        Modifica
      </button>
      <button type="button" data-comando="rifiuta" onClick={e => { ferma(e); onRifiuta(r) }}
        className={COMANDO} style={MISURA_COMANDO}>
        Rifiuta
      </button>
    </span>
  )
}
