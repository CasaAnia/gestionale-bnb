'use client'
// ============================================================================
// LA PARTE «MESSAGGI» della scheda prenotazione — rifatta il 21/09/2026 sul
// disegno approvato da Ania («I messaggi, al momento giusto», colonna DOPO ·
// punto 6). Qui si decide COME si vede; COSA proporre lo decide
// lib/messaggiFase (funzioni pure, provate a parte).
//
// Dall'alto in basso:
//  1. l'interruttore «WhatsApp Ania / Business», che è lo STESSO oggetto di
//     «Mese | 2 settimane» del calendario (components/InterruttorePillola):
//     la scelta è quella di sempre, non ne nasce una nuova;
//  2. il tasto pieno verde, largo quanto la SCRITTA e centrato (Ania,
//     21/09/2026 sera: «fallo più corto sul computer ma anche nel
//     cellulare»), SEMPRE in cima e in ogni fase del soggiorno:
//     «Conferma prenotazione» e, sotto in grassetto,
//     «Immagine e testo». Apre la finestra vera di ConfermaWhatsApp (immagine
//     + anteprima + scelta del WhatsApp), non un semplice testo;
//  3. «Utili adesso»: i pochi messaggi che servono in questa fase, uno sotto
//     l'altro, allineati a sinistra, fondo salvia e angoli tondi;
//  4. un filo sottile e «Tutti i messaggi», chiuso all'inizio: dentro ci sono
//     tutti e nove, compreso il messaggio di annullamento col suo tono
//     mattone (è un TESTO: non annulla niente).
//
// Il selettore «Prova anteprima» del disegno serviva solo alla dimostrazione:
// qui la fase si ricava dalle date, e infatti non c'è.
//
// I testi NON stanno qui: arrivano da lib/messaggiPrenotazione, che li tiene
// identici a quelli della scheda attuale, approvati parola per parola.
// ============================================================================
import InterruttorePillola from '@/components/InterruttorePillola'
import { type TipoMessaggio } from '@/lib/messaggiPrenotazione'
import {
  TUTTI_I_MESSAGGI, messaggiUtili, type FaseMessaggi, type VoceMessaggio,
  TITOLO_CONFERMA, SOTTOTITOLO_CONFERMA, SEMPRE_DISPONIBILE, UTILI_ADESSO, TUTTI_I_MESSAGGI_TITOLO,
} from '@/lib/messaggiFase'

export const FONDO_TASTO = 'var(--color-sage)'
export const BORDO_ANNULLAMENTO = '#D9B3AC'
export const TESTO_ANNULLAMENTO = '#8C3B2E'
/** il filo sottile del disegno: lo stesso ottone attenuato della fascia di sezione */
export const FILO_SEZIONE = 'color-mix(in srgb, var(--color-brass) 45%, transparent)'

const TASTO = {
  background: FONDO_TASTO,
  color: 'var(--color-green-dark)',
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 24,
  minHeight: 38,
}
// I consigliati: stessa pastiglia, ma alta 44 e col testo a sinistra
const TASTO_UTILE = { ...TASTO, minHeight: 44 }
const TASTO_ANNULLAMENTO = {
  border: `1px solid ${BORDO_ANNULLAMENTO}`,
  color: TESTO_ANNULLAMENTO,
  fontSize: 13,
  fontWeight: 600,
  borderRadius: 24,
  minHeight: 38,
}

export default function MessaggiScheda({ fase, business, onBusiness, onConfermaImmagine, href, onMessaggio, className = '' }: {
  /** la fase del soggiorno intero (lib/messaggiFase.faseMessaggi) */
  fase: FaseMessaggi
  business: boolean
  onBusiness: (v: boolean) => void
  onConfermaImmagine: () => void
  /** il link wa.me già pronto per quel messaggio (per aprire in una scheda nuova) */
  href: (tipo: TipoMessaggio) => string
  onMessaggio: (tipo: TipoMessaggio) => (e: React.MouseEvent) => void
  className?: string
}) {
  const utili = messaggiUtili(fase)
  // una pastiglia, uguale dappertutto: cambia solo se sta a sinistra o al centro
  const pastiglia = (m: VoceMessaggio, aSinistra: boolean) => (
    <a key={m.tipo} href={href(m.tipo)} onClick={onMessaggio(m.tipo)} target="_blank" rel="noopener noreferrer"
      data-messaggio={m.tipo}
      className={`inline-flex items-center transition-transform duration-100 active:scale-[0.97] ${aSinistra ? 'justify-start px-4' : 'justify-center px-3 text-center'}`}
      style={m.tipo === 'annullamento' ? TASTO_ANNULLAMENTO : aSinistra ? TASTO_UTILE : TASTO}>
      {m.label}
    </a>
  )

  return (
    <div data-messaggi data-fase={fase} className={className}>
      <InterruttorePillola
        voci={[['ania', 'WhatsApp Ania'], ['business', 'Business']] as const}
        scelta={business ? 'business' : 'ania'}
        onScegli={v => onBusiness(v === 'business')}
        nome="Quale WhatsApp"
        dati="whatsapp"
      />

      {/* La conferma con IMMAGINE E TESTO: sempre qui in cima, in ogni fase.
          Larga quanto la scritta e centrata, non quanto la riga (Ania,
          21/09/2026: «fallo più corto sul computer ma anche nel cellulare»). */}
      <div className="text-center mt-3">
        <button type="button" onClick={onConfermaImmagine} data-conferma-immagine data-senza-sottolinea
          className="inline-flex flex-col items-center justify-center px-7 transition-transform duration-100 active:scale-[0.97]"
          style={{ background: 'var(--color-green-mid)', color: '#fff', fontSize: 14, borderRadius: 25, paddingTop: 12, paddingBottom: 12, minHeight: 60 }}>
          <span style={{ fontWeight: 600 }}>{TITOLO_CONFERMA}</span>
          <strong style={{ fontWeight: 700 }}>{SOTTOTITOLO_CONFERMA}</strong>
        </button>
      </div>
      <p data-conferma-sempre className="text-center mt-2" style={{ fontSize: 12, color: 'var(--color-stone)' }}>{SEMPRE_DISPONIBILE}</p>

      {/* Utili adesso: pochi, in colonna, allineati a sinistra */}
      <p data-utili-adesso className="mt-5 uppercase" style={{ fontSize: 11, letterSpacing: 1, color: 'var(--color-brass)' }}>{UTILI_ADESSO}</p>
      <div data-suggeriti className="grid mt-2" style={{ gap: 9 }}>
        {utili.map(m => pastiglia(m, true))}
      </div>

      {/* Tutti gli altri restano qui, chiusi all'inizio: non si toglie niente */}
      <details data-tutti-messaggi className="mt-6" style={{ borderTop: `1px solid ${FILO_SEZIONE}`, paddingTop: 16 }}>
        <summary style={{ fontSize: 14, fontWeight: 600 }}>{TUTTI_I_MESSAGGI_TITOLO}</summary>
        <div className="grid grid-cols-2 mt-3" style={{ gap: 8 }}>
          {TUTTI_I_MESSAGGI.map(m => pastiglia(m, false))}
        </div>
      </details>
    </div>
  )
}
