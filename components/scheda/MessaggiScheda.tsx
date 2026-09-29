'use client'
// ============================================================================
// LA LINGUETTA «MESSAGGI» della scheda prenotazione.
//
// Storia: rifatta il 21/09/2026 sul disegno approvato da Ania («I messaggi,
// al momento giusto», punto 6); dal 28/09/2026 impaginata come il
// riferimento della scheda a linguette (docs/design/scheda-riferimento.html,
// telefono 4). Qui si decide COME si vede; COSA proporre lo decidono
// lib/messaggiFase (la fase del soggiorno) e lib/schedaMaison (destinatario e
// griglia).
//
// Dall'alto in basso:
//  1. l'interruttore «WhatsApp Ania | Business» (la scelta di sempre);
//  2. «A chi scrivi»: «Maria · ha prenotato» accesa, e «Teresa · dorme» solo
//     quando in camera dorme un'altra persona (spunta della Nuova
//     prenotazione): i link WhatsApp usano il numero della persona scelta;
//  3. il riquadro «Conferma prenotazione · Immagine e testo», SEMPRE, in ogni
//     fase: apre la finestra vera di ConfermaWhatsApp;
//  4. «Utili adesso» a pastiglie (messaggiFase, senza «Messaggio libero»);
//  5. «Tutti i messaggi» in una griglia a due colonne nell'ordine approvato,
//     col messaggio di annullamento in mattone (è un TESTO: non annulla niente).
// «Messaggio libero» non c'è più: al suo posto la nuvoletta accanto al nome.
//
// I testi NON stanno qui: arrivano da lib/messaggiPrenotazione, identici a
// quelli approvati parola per parola.
// ============================================================================
import AvvisoSaluto from '@/components/AvvisoSaluto'
import { avvisoSaluto } from '@/lib/avvisoSaluto'
import type { Saluto } from '@/lib/guestName'
import { type TipoMessaggio } from '@/lib/messaggiPrenotazione'
import {
  type FaseMessaggi, type VoceMessaggio,
  TITOLO_CONFERMA, SOTTOTITOLO_CONFERMA, SEMPRE_DISPONIBILE, UTILI_ADESSO, TUTTI_I_MESSAGGI_TITOLO,
} from '@/lib/messaggiFase'
import { GRIGLIA_MESSAGGI, utiliScheda, A_CHI_SCRIVI, type Destinatario } from '@/lib/schedaMaison'

export default function MessaggiScheda({ fase, saluto, business, onBusiness, destinatari, destinatario, onDestinatario, conNumero, senzaNumero, onConfermaImmagine, href, onMessaggio, className = '' }: {
  /** la fase del soggiorno intero (lib/messaggiFase.faseMessaggi) */
  fase: FaseMessaggi
  /** il nome che finisce dopo «Gentile» (lib/guestName.salutoOspite): quando
   *  non si ricava, l'avviso lo dice e i tasti restano spenti */
  saluto: Saluto
  business: boolean
  onBusiness: (v: boolean) => void
  destinatari: Destinatario[]
  destinatario: Destinatario['chiave']
  onDestinatario: (d: Destinatario['chiave']) => void
  /** la persona scelta ha un numero: senza, i messaggi non partono */
  conNumero: boolean
  /** la frase di sempre quando manca il numero */
  senzaNumero: string
  onConfermaImmagine: () => void
  /** il link wa.me già pronto per quel messaggio (per aprire in una scheda nuova) */
  href: (tipo: TipoMessaggio) => string
  onMessaggio: (tipo: TipoMessaggio) => (e: React.MouseEvent) => void
  className?: string
}) {
  const utili = utiliScheda(fase)
  // Senza un nome da scrivere dopo «Gentile» nessun messaggio è pronto: le
  // pastiglie restano lì, ma spente, e l'avviso sopra dice cosa fare.
  const bloccato = avvisoSaluto(saluto)?.blocca === true || !conNumero
  // una pastiglia, uguale dappertutto
  const pastiglia = (m: VoceMessaggio, griglia: boolean) => (
    <a key={m.tipo} href={bloccato ? undefined : href(m.tipo)}
      onClick={bloccato ? (e: React.MouseEvent) => e.preventDefault() : onMessaggio(m.tipo)}
      target="_blank" rel="noopener noreferrer"
      data-messaggio={m.tipo} aria-disabled={bloccato || undefined}
      className={`np-chip ${m.tipo === 'annullamento' ? 'm' : ''} ${griglia ? 'sch-chip-griglia' : ''} ${bloccato ? 'pointer-events-none opacity-40' : ''}`}>
      {m.label}
    </a>
  )

  return (
    <div data-messaggi data-fase={fase} className={className}>
      <section className="np-sec" style={{ paddingTop: 16 }}>
        {/* Quale WhatsApp: la voce scelta col filo d'ottone */}
        <div className="mz-seg sch-seg" role="radiogroup" aria-label="Quale WhatsApp" data-interruttore="whatsapp">
          <button type="button" role="radio" aria-checked={!business} className={!business ? 'on' : ''} data-scelta="ania" onClick={() => onBusiness(false)}>WhatsApp Ania</button>
          <button type="button" role="radio" aria-checked={business} className={business ? 'on' : ''} data-scelta="business" onClick={() => onBusiness(true)}>Business</button>
        </div>

        {/* A chi scrivi: la persona scelta decide il numero dei link */}
        <p className="np-lab c" style={{ marginTop: 12 }}>{A_CHI_SCRIVI}</p>
        <div className="np-chips c" data-destinatari>
          {destinatari.map(d => (
            <button key={d.chiave} type="button" data-destinatario={d.chiave} aria-pressed={destinatario === d.chiave}
              className={`np-chip ${destinatario === d.chiave ? 'on' : ''}`} onClick={() => onDestinatario(d.chiave)}>{d.etichetta}</button>
          ))}
        </div>

        <AvvisoSaluto saluto={saluto} className="mt-3" />
        {!conNumero && <p data-senza-numero-messaggi className="np-hint m c">{senzaNumero}</p>}

        {/* La conferma con IMMAGINE E TESTO: sempre qui, in ogni fase */}
        <button type="button" onClick={onConfermaImmagine} data-conferma-immagine disabled={!conNumero} className="sch-conferma">
          <span className="sch-big">{TITOLO_CONFERMA}</span>
          <span className="sch-k">{SOTTOTITOLO_CONFERMA}</span>
        </button>
        <p data-conferma-sempre className="np-hint c">{SEMPRE_DISPONIBILE}</p>

        {/* Utili adesso: pochi, a pastiglie */}
        {utili.length > 0 && <>
          <p data-utili-adesso className="np-lab">{UTILI_ADESSO}</p>
          <div data-suggeriti className="np-chips">{utili.map(m => pastiglia(m, false))}</div>
        </>}

        {/* Tutti i messaggi: due colonne, nell'ordine approvato */}
        <p className="np-lab" style={{ marginTop: 16 }}>{TUTTI_I_MESSAGGI_TITOLO}</p>
        <div data-tutti-messaggi className="sch-griglia">
          {GRIGLIA_MESSAGGI.map(m => pastiglia(m, true))}
        </div>
      </section>
    </div>
  )
}
