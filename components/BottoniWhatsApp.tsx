'use client'
// Bottoni WhatsApp con lo stesso nome e la stessa icona ovunque (08/09/2026):
// «Chiedi orario» (pieno: apre la chat col messaggio «Richiesta orario» già
// scritto) e «Apri chat» (ghost: la chat senza testo, per vedere se l'ospite
// ha già risposto). Stesso link wa.me e stessa apertura della scheda
// prenotazione (lib/whatsapp.openWhatsApp). Senza numero non si mostrano.
import { MessageCircle } from 'lucide-react'
import { openWhatsApp } from '@/lib/whatsapp'
import { waHrefTesto, type LinkWhatsApp } from '@/lib/messaggiWhatsApp'

export const BOTTONE_PIENO = 'inline-flex items-center gap-1.5 rounded-lg bg-green-mid text-white px-3.5 py-2 text-[13px] font-semibold shadow-sm transition-transform duration-100 active:scale-[0.97]'
export const BOTTONE_GHOST = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-transform duration-100 active:scale-[0.97]'
export const ETICHETTA_CHIEDI_ORARIO = 'Chiedi orario'
export const ETICHETTA_APRI_CHAT = 'Apri chat'

export function BottoneWhatsApp({ href, numero, testo, etichetta, pieno, tipo }: { href: string; numero: string; testo: string; etichetta: string; pieno: boolean; tipo: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" data-whatsapp={tipo}
      onClick={e => { e.preventDefault(); openWhatsApp(numero, testo) }}
      className={pieno ? BOTTONE_PIENO : BOTTONE_GHOST} style={pieno ? undefined : { color: '#2D6A4F' }}>
      <MessageCircle size={15} strokeWidth={2.2} aria-hidden />{etichetta}
    </a>
  )
}

// La coppia «Chiedi orario» + «Apri chat» per un arrivo (Home e pannello Arrivi)
export function BottoniOrario({ wa }: { wa: LinkWhatsApp }) {
  return (
    <>
      <BottoneWhatsApp href={wa.href} numero={wa.numero} testo={wa.testo} etichetta={ETICHETTA_CHIEDI_ORARIO} pieno tipo="chiedi-orario" />
      <BottoneWhatsApp href={waHrefTesto(wa.numero, '')} numero={wa.numero} testo="" etichetta={ETICHETTA_APRI_CHAT} pieno={false} tipo="apri-chat" />
    </>
  )
}
