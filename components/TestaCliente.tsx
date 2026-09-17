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
import type { ReactNode } from 'react'
import { Phone, MessageCircle } from 'lucide-react'
import { giornoConSettimana } from '@/lib/dateItaliane'
import { personeTesta, caselleNotti, personeCambiano, cameraTesta } from '@/lib/personeTesta'
import { chiEIlCliente } from '@/lib/clienteCheTorna'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const GRIGIO_RIGA = '#B9B6AD'          // la prima riga, quella minuta
const VERDE_MESE = '#5B6559'           // il mese accanto al giorno
const OTTONE = '#A9884E'
const FILO_OTTONE = 'rgba(169,136,78,0.55)'
const ROSSO_NOTA = '#D40000'   // il rosso delle note (cliente e prenotazione): lo stesso di «da incassare», in grassetto vero (Ania, 17/09/2026); uguale in Home, scheda e proposta
const FILO_NOTA = '#E3CFC9'
const FILO_NOTA_SCHEDA = '#D8D2C4'   // la scheda prenotazione (13/09/2026): filo tratteggiato più neutro
const ROSSO_AVVISO = '#8C3B2E'
// quanto ha già speso la cliente, in cima alla scheda: lo stesso rosso acceso
// di «da incassare» nel conto (Ania, 17/09/2026)
const ROSSO_SPESO = '#D40000'
const MATTONE = '#8a4f2f'   // la notte in cui le persone cambiano

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
  /** soggiorni conclusi precedenti: 0 = nessuno concluso */
  volte?: number
  /** il cliente è già nell'archivio, anche senza soggiorni conclusi */
  inArchivio?: boolean
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
  /** le persone di ogni notte, in ordine: da qui nascono il valore grande
   *  («3», «3 → 1», «da 1 a 3») e la strisciolina delle notti */
  personeNotti: number[]
  /** le notti richieste, in ordine: servono alla strisciolina */
  nottiRichieste?: string[]
  /** nome della camera chiesta dalla cliente; senza, vale «qualsiasi» */
  cameraChiesta?: string | null
  /** numero come si legge: «342 700 4354» */
  telefono?: string | null
  /** cifre intere col prefisso, per chiamare */
  telefonoDaChiamare?: string | null
  /** numero a sole cifre per WhatsApp; senza, «Scrivi» non compare */
  telefonoWhatsApp?: string | null
  avvisoTelefono?: string | null
  onScrivi?: () => void
  /** Le note in rosso sotto i contatti: prima quella del cliente (la sua
   *  scheda), poi quella scritta nella richiesta. Vuoto = non compare nulla. */
  note?: { etichetta: string; testo: string }[]
  hrefModifica?: string | null
  testoModifica?: string
  // ── Solo per la NUOVA SCHEDA PRENOTAZIONE (13/09/2026) ──────────────────
  // Senza queste la testa resta quella della proposta, identica a prima.
  /** la prima riga scritta per intero dalla pagina («Prima volta · Google») */
  primaRiga?: string | null
  /** manca la provenienza: «da dove? ›» nello stesso grigio, che si tocca */
  chiediProvenienza?: { testo: string; onClick: () => void } | null
  /** il nome sempre in peso normale, anche con la ricevuta (Ania: NON grassetto) */
  nomeNormale?: boolean
  /** al posto di «arrivo» / «partenza» sotto le date: «arriva 15:10 · navetta», «parte» */
  etichettaArrivo?: string
  etichettaPartenza?: string
  /** la riga grande al posto di persone e camera chiesta (OSPITI · CAMERA) */
  rigaGrande?: ReactNode
  /** sotto la riga grande, prima dei contatti: lo stato del conto */
  sottoRigaGrande?: ReactNode
  /** dopo i contatti, prima delle note: la riga del documento */
  dopoContatti?: ReactNode
  /** note nella veste della scheda: filo #D8D2C4, 14,5 px, parolina solo se c'è */
  noteScheda?: boolean
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
  volte = 0, inArchivio = false, provenienza = null, quando = null, totaleCent = null, hrefCliente = null,
  arrivo, partenza, notti, personeNotti, nottiRichieste = [], cameraChiesta = null,
  telefono = null, telefonoDaChiamare = null, telefonoWhatsApp = null, avvisoTelefono = null, onScrivi,
  note = [], hrefModifica = null, testoModifica = 'Modifica la richiesta',
  primaRiga = null, chiediProvenienza = null, nomeNormale = false, etichettaArrivo = 'arrivo', etichettaPartenza = 'partenza',
  rigaGrande = null, sottoRigaGrande = null, dopoContatti = null, noteScheda = false,
}: TestaClienteProps) {
  const torna = volte > 0
  // Chi è: già stata qui, oppure solo già in archivio (nessun soggiorno
  // concluso: prenotazione futura, annullata, o solo una scheda). Un cliente
  // davvero nuovo resta «Prima volta» (Ania, 12/09/2026).
  const chiE = chiEIlCliente(volte, inArchivio)
  const totale = torna && totaleCent != null && totaleCent > 0 ? euroTondi(totaleCent) : null
  const pezziPersone = personeTesta(personeNotti)
  const caselle = personeCambiano(personeNotti) ? caselleNotti(nottiRichieste, personeNotti) : []
  const camera = cameraTesta(cameraChiesta)
  const notePulite = note.map(n => ({ ...n, testo: (n.testo ?? '').trim() })).filter(n => n.testo)

  return (
    <div data-testa-cliente>
      {/* Prima riga: a sinistra chi è (e, per chi torna, da dove arriva);
          in alto a destra come e quando è arrivata la richiesta e, sotto,
          per chi torna, quanto ha speso in tutto. */}
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate" style={{ fontSize: 12.5, color: GRIGIO_RIGA }}>
          {primaRiga ?? <>{chiE}{(torna || inArchivio) && provenienza ? ` · ${provenienza}` : ''}</>}
          {chiediProvenienza && (
            <> · <button type="button" data-chiedi-provenienza onClick={chiediProvenienza.onClick} className="py-2 -my-2" style={{ fontSize: 12.5, color: GRIGIO_RIGA }}>{chiediProvenienza.testo}</button></>
          )}
        </p>
        <span className="shrink-0 text-right">
          {quando && <span data-quando-richiesta className="block whitespace-nowrap" style={{ fontSize: 12.5, color: GRIGIO_RIGA }}>{quando}</span>}
          {totale && (hrefCliente
            ? <Link href={hrefCliente} data-totale-cliente className="block whitespace-nowrap" style={{ fontFamily: GEORGIA, fontSize: 16, color: ROSSO_SPESO }}>{totale} ›</Link>
            : <span data-totale-cliente className="block whitespace-nowrap" style={{ fontFamily: GEORGIA, fontSize: 16, color: ROSSO_SPESO }}>{totale} ›</span>)}
        </span>
      </div>

      {/* Il nome, grande e al centro. Davanti, sempre in quest'ordine (Ania,
          13/09/2026): la RICEVUTA 🧾, poi la STELLA della cliente ottima, poi
          il nome — «🧾 ★ Carmela Sabia». Sono testo, nella misura del nome,
          divisi da uno spazio normale; con la ricevuta il nome resta in
          grassetto come prima. */}
      <h1 className="text-center mt-4 leading-tight" style={{ fontFamily: GEORGIA, fontWeight: ricevuta ? 700 : 400, fontSize: 32, color: 'var(--color-green-dark)', ...(nomeNormale ? { fontWeight: 400 } : {}) }}>
        {ricevuta && <span data-ricevuta aria-label="vuole la ricevuta" title="Vuole la ricevuta">{'🧾 '}</span>}
        {stella && <span data-stella aria-label="cliente ottima" title="Cliente ottima" style={{ color: OTTONE }}>{'★ '}</span>}
        {nome}
      </h1>

      {/* Le due date, con le notti sulla freccia */}
      {/* Le date non toccano i bordi: 6 px dentro i margini (Ania, 11/09/2026) */}
      <div className="grid items-center gap-3 mt-6 px-1.5" style={{ gridTemplateColumns: 'auto 1fr auto' }}>
        <Data iso={arrivo} etichetta={etichettaArrivo} />
        <div className="pb-4">
          <p className="text-center" style={{ fontSize: 11, color: OTTONE }}>{notti === 1 ? '1 notte' : `${notti} notti`}</p>
          <span className="flex items-center w-full mt-1" aria-hidden>
            <span className="flex-1" style={{ height: 1, background: OTTONE }} />
            <span style={{ width: 0, height: 0, borderTop: '3.5px solid transparent', borderBottom: '3.5px solid transparent', borderLeft: `5px solid ${OTTONE}` }} />
          </span>
        </div>
        <Data iso={partenza} etichetta={etichettaPartenza} />
      </div>

      {/* Quante persone e quale camera: stessa forma delle date sopra —
          valore grande, etichetta piccola sotto (Ania, 12/09/2026) */}
      <div style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 16 }}>
        {rigaGrande ?? <>
        <div className="flex items-start justify-center" style={{ gap: 44 }}>
          <div className="text-center" data-persone-testa>
            <p className="leading-[1.15]" style={{ fontFamily: GEORGIA, fontWeight: 400 }}>
              {pezziPersone.map((x, i) => (
                <span key={i} style={x.grande
                  ? { fontSize: 24, color: 'var(--color-green-dark)' }
                  : { fontSize: 15, color: VERDE_MESE }}>{i > 0 ? ' ' : ''}{x.testo}</span>
              ))}
            </p>
            <p style={{ marginTop: 6, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-stone)' }}>persone</p>
          </div>
          <div className="text-center min-w-0" data-camera-testa>
            <p className="leading-[1.15] truncate" style={{ fontFamily: GEORGIA, fontWeight: 400, fontSize: 24, color: 'var(--color-green-dark)' }}>
              {camera.valore}
            </p>
            <p style={{ marginTop: 6, fontSize: 9, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--color-stone)' }}>{camera.etichetta}</p>
          </div>
        </div>
        {/* La strisciolina: una casellina per notte, solo se le persone cambiano */}
        {caselle.length > 0 && (
          <div data-striscia-notti className="flex justify-center flex-wrap" style={{ marginTop: 14, gap: 5 }}>
            {caselle.map((c, i) => (
              <div key={i} className="text-center" style={{ maxWidth: 62 }}>
                <p style={{ fontSize: 9, letterSpacing: '0.4px', textTransform: 'uppercase', color: 'var(--color-stone)' }}>{c.etichetta}</p>
                <p style={{ borderTop: `1px solid ${OTTONE}`, paddingTop: 4, marginTop: 2, fontFamily: GEORGIA, fontSize: 17, color: c.cambia ? MATTONE : 'var(--color-green-dark)' }}>{c.persone}</p>
              </div>
            ))}
          </div>
        )}
        </>}
      </div>
      {sottoRigaGrande}

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
      {dopoContatti}

      {/* Le note non devono sfuggire: rosso #C00000, ognuna con la sua
          parolina sopra, sotto un filo tratteggiato (Ania, 11/09/2026) */}
      {notePulite.length > 0 && (
        <div className="mt-3" style={{ borderTop: `1px dashed ${noteScheda ? FILO_NOTA_SCHEDA : FILO_NOTA}`, paddingTop: 10 }}>
          {notePulite.map((n, i) => (
            <div key={n.etichetta + i} data-nota-cliente className={`text-center${i > 0 ? ' mt-2.5' : ''}`}>
              {(n.etichetta || !noteScheda) && <p style={{ fontSize: noteScheda ? 10 : 9.5, letterSpacing: '1.5px', textTransform: 'uppercase', color: ROSSO_NOTA }}>{n.etichetta}</p>}
              <p className="mt-0.5 break-words" style={{ fontSize: noteScheda ? 14.5 : 13.5, fontWeight: 700, color: ROSSO_NOTA, overflowWrap: 'anywhere' }}>{noteScheda ? n.testo : `«${n.testo}»`}</p>
            </div>
          ))}
        </div>
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
