'use client'
// ============================================================================
// TESTA CON IL CLIENTE (11/09/2026, veste approvata da Ania): la prima cosa
// che si legge aprendo una richiesta o una prenotazione. Nome grande al
// centro, le due date ai lati con la freccia in mezzo, chi è e come si chiama
// al telefono. Nessun riquadro bianco: fili sottili, come il resto del
// gestionale (stile editoriale «B» del 06/09/2026).
//
// Componente di sola presentazione: riceve testi già pronti e non legge
// niente dal database. Lo useranno anche la scheda prenotazione e la nuova
// prenotazione, perciò qui non c'è nulla che parli di «richieste».
// ============================================================================
import Link from 'next/link'
import { Phone, MessageCircle } from 'lucide-react'
import { giornoConSettimana } from '@/lib/dateItaliane'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const GRIGIO_RIGA = '#B9B6AD'          // la prima riga, quella minuta
const VERDE_MESE = '#5B6559'           // il mese accanto al giorno
const OTTONE = '#A9884E'
const FILO_OTTONE = 'rgba(169,136,78,0.55)'
const ROSSO_NOTA = '#C00000'   // il rosso della nota del cliente, scelto da Ania l'8/09/2026: uguale in Home, scheda e proposta
const FILO_NOTA = '#E3CFC9'
const ROSSO_AVVISO = '#8C3B2E'

export type TestaClienteProps = {
  /** «Nome Cognome», già composto (lib/guestName) */
  nome: string
  /** valutazione «ottimo»: la stella in ottone prima del nome */
  stella?: boolean
  /** vuole la ricevuta: il nome in grassetto */
  ricevuta?: boolean
  /** cliente problematico: avviso rosso col motivo (vuoto = solo l'avviso) */
  problematico?: boolean
  motivoProblematico?: string | null
  /** soggiorni conclusi precedenti: 0 = cliente nuovo */
  volte?: number
  /** da dove arriva il CLIENTE: «Google», «passaparola», «mandata da Nida».
   *  Solo per chi torna; senza, accanto alle volte non si scrive niente. */
  provenienza?: string | null
  /** come e quando è arrivata la richiesta: «dal sito · oggi 20:05» */
  quando?: string | null
  /** soldi spesi in tutto nei soggiorni conclusi (centesimi), solo per chi torna */
  totaleCent?: number | null
  /** scheda del cliente: senza link il totale non si tocca */
  hrefCliente?: string | null
  arrivo: string
  partenza: string
  notti: number
  /** «3 persone» oppure il riassunto notte per notte */
  persone: string
  /** «qualsiasi camera» oppure il nome della camera chiesta */
  camera: string
  /** numero come si legge: «342 700 4354» */
  telefono?: string | null
  /** cifre intere col prefisso, per chiamare */
  telefonoDaChiamare?: string | null
  /** numero a sole cifre per WhatsApp; senza, «Scrivi» non compare */
  telefonoWhatsApp?: string | null
  avvisoTelefono?: string | null
  onScrivi?: () => void
  nota?: string | null
  hrefModifica?: string | null
  testoModifica?: string
}

// «1.360 €»: euro tondi, col punto delle migliaia. Non si usa toLocaleString:
// in italiano non raggruppa i numeri di quattro cifre e scriverebbe «1360 €».
function euroTondi(cent: number): string {
  return `${String(Math.round(cent / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} €`
}

function Data({ iso, etichetta }: { iso: string; etichetta: string }) {
  const { giorno, mese } = giornoConSettimana(iso)
  return (
    <div className="text-center">
      <p className="leading-none" style={{ fontFamily: GEORGIA, fontWeight: 400 }}>
        <span style={{ fontSize: 24, color: 'var(--color-green-dark)' }}>{giorno}</span>{' '}
        <span style={{ fontSize: 17, color: VERDE_MESE }}>{mese}</span>
      </p>
      <p className="mt-1.5" style={{ fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-stone)' }}>{etichetta}</p>
    </div>
  )
}

export default function TestaCliente({
  nome, stella = false, ricevuta = false, problematico = false, motivoProblematico = null,
  volte = 0, provenienza = null, quando = null, totaleCent = null, hrefCliente = null,
  arrivo, partenza, notti, persone, camera,
  telefono = null, telefonoDaChiamare = null, telefonoWhatsApp = null, avvisoTelefono = null, onScrivi,
  nota = null, hrefModifica = null, testoModifica = 'Modifica la richiesta',
}: TestaClienteProps) {
  const torna = volte > 0
  const testoVolte = volte === 1 ? 'Già stata qui 1 volta' : `Già stata qui ${volte} volte`
  const totale = torna && totaleCent != null && totaleCent > 0 ? euroTondi(totaleCent) : null
  const notaPulita = (nota ?? '').trim()

  return (
    <div data-testa-cliente>
      {/* Prima riga: a sinistra chi è (e, per chi torna, da dove arriva);
          in alto a destra come e quando è arrivata la richiesta e, sotto,
          per chi torna, quanto ha speso in tutto. */}
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate" style={{ fontSize: 12.5, color: GRIGIO_RIGA }}>
          {torna ? testoVolte : 'Prima volta'}{torna && provenienza ? ` · ${provenienza}` : ''}
        </p>
        <span className="shrink-0 text-right">
          {quando && <span data-quando-richiesta className="block whitespace-nowrap" style={{ fontSize: 12.5, color: GRIGIO_RIGA }}>{quando}</span>}
          {totale && (hrefCliente
            ? <Link href={hrefCliente} data-totale-cliente className="block whitespace-nowrap" style={{ fontFamily: GEORGIA, fontSize: 16, color: 'var(--color-green-dark)' }}>{totale} ›</Link>
            : <span data-totale-cliente className="block whitespace-nowrap" style={{ fontFamily: GEORGIA, fontSize: 16, color: 'var(--color-green-dark)' }}>{totale} ›</span>)}
        </span>
      </div>

      {/* Il nome, grande e al centro */}
      <h1 className="text-center mt-4 leading-tight" style={{ fontFamily: GEORGIA, fontWeight: ricevuta ? 700 : 400, fontSize: 32, color: 'var(--color-green-dark)' }}>
        {stella && <span aria-label="cliente ottimo" title="Cliente ottimo" style={{ color: OTTONE, marginRight: 8 }}>★</span>}
        {nome}
      </h1>

      {/* Le due date, con le notti sulla freccia */}
      {/* Le date non toccano i bordi: 6 px dentro i margini (Ania, 11/09/2026) */}
      <div className="grid items-center gap-3 mt-6 px-1.5" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
        <Data iso={arrivo} etichetta="arrivo" />
        <div className="pb-4">
          <p className="text-center" style={{ fontSize: 11, color: OTTONE }}>{notti === 1 ? '1 notte' : `${notti} notti`}</p>
          <span className="flex items-center w-full mt-1" aria-hidden>
            <span className="flex-1" style={{ height: 1, background: OTTONE }} />
            <span style={{ width: 0, height: 0, borderTop: '3.5px solid transparent', borderBottom: '3.5px solid transparent', borderLeft: `5px solid ${OTTONE}` }} />
          </span>
        </div>
        <Data iso={partenza} etichetta="partenza" />
      </div>

      {/* Quante persone e quale camera hanno chiesto */}
      <p className="text-center" style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 16, fontSize: 14, color: 'var(--color-green-dark)' }}>
        <span className="font-semibold">{persone}</span>
        <span style={{ color: 'var(--color-stone)' }}> · {camera}</span>
      </p>

      {/* Come si chiama il cliente: telefono e WhatsApp */}
      {(telefono || telefonoWhatsApp) && (
        <div className="flex items-center justify-center gap-5 mt-3" style={{ fontSize: 15, fontWeight: 600 }}>
          {telefono && (
            <a href={`tel:+${telefonoDaChiamare ?? telefono}`} className="inline-flex items-center gap-1.5 text-green-dark">
              <Phone size={16} strokeWidth={1.9} aria-hidden style={{ color: 'var(--color-green-mid)' }} />
              {telefono}
            </a>
          )}
          {telefonoWhatsApp && onScrivi && (
            <button type="button" onClick={onScrivi} className="inline-flex items-center gap-1.5 text-green-dark">
              <MessageCircle size={16} strokeWidth={1.9} aria-hidden style={{ color: 'var(--color-green-mid)' }} />
              Scrivi
            </button>
          )}
        </div>
      )}
      {avvisoTelefono && <p className="text-center mt-1 text-xs font-semibold" style={{ color: ROSSO_AVVISO }}>{avvisoTelefono}</p>}
      {!telefono && <p className="text-center mt-3 text-sm font-semibold" style={{ color: ROSSO_AVVISO }}>Nessun numero di telefono</p>}

      {/* La nota del cliente non deve sfuggire */}
      {notaPulita && (
        <p data-nota-cliente className="text-center mt-3" style={{ borderTop: `1px dashed ${FILO_NOTA}`, paddingTop: 10, fontSize: 13.5, fontWeight: 600, color: ROSSO_NOTA }}>
          «{notaPulita}»
        </p>
      )}

      {/* Cliente problematico: si vede, e non blocca nulla */}
      {problematico && (
        <div role="alert" data-problematico className="mt-3 rounded-xl p-3 text-sm" style={{ background: '#F6E4DE', border: '1px solid #EAD3CC', color: ROSSO_AVVISO }}>
          <p className="font-semibold">⚠️ Cliente problematico</p>
          {motivoProblematico && <p className="mt-0.5">{motivoProblematico}</p>}
        </div>
      )}

      {hrefModifica && (
        <p className="text-center mt-3">
          <Link href={hrefModifica} className="text-[13px] underline underline-offset-2" style={{ color: 'var(--color-stone)' }}>{testoModifica}</Link>
        </p>
      )}
    </div>
  )
}
