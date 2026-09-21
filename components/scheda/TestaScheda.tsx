'use client'
// ============================================================================
// LA TESTA DELLA SCHEDA PRENOTAZIONE (20/09/2026 sera, disegno approvato da
// Ania: «La prenotazione, a colpo d'occhio», colonna DOPO · proposta punto 2).
// Variante SOLO per la scheda: richieste e inserimento restano con
// components/TestaCliente, che non si tocca.
//
// Dall'alto: la riga «Già ospite 4 volte · da Elyse» con, a destra, quanto
// ha speso nei soggiorni conclusi («4.300 € ›», il link che porta alla parte
// CLIENTE: Ania lo guarda al telefono prima di decidere uno sconto); il nome
// grande al centro con la stella; le due date del soggiorno intero coi giorni
// della settimana e le notti in mezzo; orario e navetta; «1 OSPITE · 3 CAMBI
// CAMERA» e la sequenza delle camere; il blocco «OGGI» fra due fili; «Resta
// da incassare»; il richiamo del documento quando manca; telefono, «Scrivi»
// e il documento; poi le note in rosso. Le parole vengono da
// lib/testaScheda; le misure sono quelle del riferimento e valgono solo qui.
// ============================================================================
import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import { pezziRigaCliente } from '@/lib/clienteCheTorna'
import { euroTondi } from '@/lib/euroTondi'
import { corpoNomeTesta } from '@/lib/testaScheda'
import type { DateTesta, DataTesta, PercorsoTesta, OggiTesta, ResiduoTesta } from '@/lib/testaScheda'

// I colori del riferimento
export const TESTO_TESTA = '#30483b'
const GRIGIO = '#8b8f83'
const ROSSO_STORICO = '#b93e32'
const OTTONE_STELLA = '#a9884e'
const OTTONE_NOTTI = '#9c814e'
const FILO_NOTTI = '#bcaa86'
const OTTONE_ARRIVO = '#756748'
const OTTONE_ETICHETTA = '#8a754b'
const FILO_CHIARO = '#dfd5c3'
const FILO_OGGI = '#d6c7a8'
const VERDE_TESTO = '#405b4b'
const FONDO_ATTENZIONE = '#f1eadb'
const TESTO_ATTENZIONE = '#665330'
const ROSSO_NOTA = '#D40000'
const FILO_NOTA = '#D8D2C4'
const GEORGIA = 'Georgia, serif'

const ETICHETTA: CSSProperties = { display: 'block', font: '9px Arial, sans-serif', letterSpacing: '1.5px', textAlign: 'center', color: GRIGIO, marginTop: 9 }
const OCCHIELLO: CSSProperties = { fontSize: 11, letterSpacing: '1.2px', color: OTTONE_ETICHETTA, marginBottom: 7 }
// un comando scritto come testo: filo a 3 px, riga alta come il testo, zona di tocco allargata dal padding
const AZIONE: CSSProperties = { minHeight: 0, padding: '6px 0', margin: '-6px 0', font: 'inherit', color: 'inherit', textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3 }

function Data({ d, etichetta, lato }: { d: DataTesta; etichetta: string; lato: 'sinistra' | 'destra' }) {
  return (
    <div data-data-testa={lato} className={lato === 'destra' ? 'text-right' : 'text-left'}>
      {/* «mar 1» in Georgia 22 (20 sul telefono), il mese in 15 (14, a capo sul telefono) */}
      <p className="whitespace-nowrap" style={{ font: `22px ${GEORGIA}` }}>
        <span className="text-[20px] min-[700px]:text-[22px]">{d.settimana} {d.giorno}</span>{' '}
        <small className="block min-[700px]:inline text-[14px] min-[700px]:text-[15px]" style={{ fontFamily: GEORGIA }}>{d.mese}{d.anno && ` ${d.anno}`}</small>
      </p>
      <span className="uppercase" style={{ ...ETICHETTA, textAlign: lato === 'destra' ? 'right' : 'left' }}>{etichetta}</span>
    </div>
  )
}

export default function TestaScheda({
  primaRiga, chiediProvenienza = null, totaleCent = null, hrefCliente = null,
  nome, stella = false, ricevuta = false,
  date, orario, navetta, onArrivo,
  percorso, oggi, residuo, daCompletare = null,
  telefono = null, telefonoDaChiamare = null, onScrivi, documento = null, note = [],
}: {
  /** «Già ospite 4 volte · da Elyse», già composta (lib/schedaPrenotazione.primaRigaScheda) */
  primaRiga: string
  /** manca la provenienza: «da dove? ›», che si tocca */
  chiediProvenienza?: { testo: string; onClick: () => void } | null
  /** quanto ha speso nei soggiorni conclusi, in centesimi: «4.300 € ›» in alto a destra */
  totaleCent?: number | null
  hrefCliente?: string | null
  nome: string
  stella?: boolean
  ricevuta?: boolean
  date: DateTesta
  /** «Arriva alle 15:10» oppure «Orario da definire» */
  orario: string
  /** «Con navetta» · «Navetta non richiesta» · «Navetta da verificare» */
  navetta: string
  /** toccando orario e navetta si apre il foglio «Modifica arrivo» di sempre */
  onArrivo?: () => void
  percorso: PercorsoTesta
  oggi: OggiTesta
  residuo: ResiduoTesta
  /** «Da completare: documento dell’ospite», solo quando manca davvero */
  daCompletare?: string | null
  /** numero come si legge, «342 700 4354» */
  telefono?: string | null
  /** cifre col prefisso, per chiamare */
  telefonoDaChiamare?: string | null
  onScrivi?: () => void
  /** la riga del documento (RigaDocumentiPrenotazione) */
  documento?: ReactNode
  note?: { etichetta: string; testo: string }[]
}) {
  const totale = totaleCent != null && totaleCent > 0 ? euroTondi(totaleCent) : null
  const notePulite = note.map(n => ({ ...n, testo: (n.testo ?? '').trim() })).filter(n => n.testo)
  return (
    <div data-testa-scheda style={{ font: '14px/1.5 Arial, sans-serif', color: TESTO_TESTA }}>
      {/* la prima riga: chi è a sinistra, lo storico della spesa a destra (resta qui: Ania) */}
      <div data-prima-riga className="flex flex-wrap items-baseline justify-between" style={{ gap: 12, fontSize: 12, color: GRIGIO }}>
        <p className="min-w-0">
          {pezziRigaCliente(primaRiga).map((p, i) => (
            p.grassetto ? <b key={i} data-grassetto-riga style={{ fontWeight: 700 }}>{p.testo}</b> : <span key={i}>{p.testo}</span>
          ))}
          {chiediProvenienza && (
            <> · <button type="button" data-chiedi-provenienza onClick={chiediProvenienza.onClick} className="ed-azione ed-azione-tenue" style={{ ...AZIONE, fontSize: 12, color: GRIGIO }}>{chiediProvenienza.testo}</button></>
          )}
        </p>
        {totale && (hrefCliente
          ? <Link href={hrefCliente} data-totale-cliente className="whitespace-nowrap" style={{ font: `17px ${GEORGIA}`, color: ROSSO_STORICO }}>{totale} ›</Link>
          : <span data-totale-cliente className="whitespace-nowrap" style={{ font: `17px ${GEORGIA}`, color: ROSSO_STORICO }}>{totale} ›</span>)}
      </div>

      {/* il nome, grande e al centro: 🧾 se vuole la ricevuta, ★ se è una cliente ottima */}
      <h1 data-nome-testa className={`text-center ${corpoNomeTesta(nome).classi}`} style={{ fontFamily: GEORGIA, fontWeight: 400, lineHeight: 1.2, margin: '23px 0 20px' }}>
        {ricevuta && <span data-ricevuta aria-label="vuole la ricevuta" title="Vuole la ricevuta">{'🧾 '}</span>}
        {stella && <span data-stella aria-label="cliente ottima" title="Cliente ottima" style={{ color: OTTONE_STELLA }}>{'★ '}</span>}
        {nome}
      </h1>

      {/* le due date del soggiorno intero, le notti in mezzo sopra il filo */}
      <div data-date-testa className="flex items-start justify-between" style={{ gap: 8 }}>
        <Data d={date.arrivo} etichetta="arriva" lato="sinistra" />
        <div data-notti-testa className="flex-1 text-center self-start min-w-[32px]" style={{ fontSize: 11, color: OTTONE_NOTTI, borderBottom: `1px solid ${FILO_NOTTI}`, paddingBottom: 7 }}>{date.notti}</div>
        <Data d={date.partenza} etichetta="parte" lato="destra" />
      </div>

      {/* orario e navetta: quello che sappiamo, o cosa manca; si tocca per cambiarli */}
      <div data-arrivo-testa className="flex flex-wrap" style={{ gap: '4px 16px', margin: '13px 0 20px', fontSize: 12, color: OTTONE_ARRIVO }}>
        {onArrivo
          ? <>
            <button type="button" data-orario-testa onClick={onArrivo} className="ed-azione" style={{ ...AZIONE, fontSize: 12, fontWeight: 400, textDecorationColor: 'transparent' }}>{orario}</button>
            <button type="button" data-navetta-testa onClick={onArrivo} className="ed-azione" style={{ ...AZIONE, fontSize: 12, fontWeight: 400, textDecorationColor: 'transparent' }}>{navetta}</button>
          </>
          : <><span data-orario-testa>{orario}</span><span data-navetta-testa>{navetta}</span></>}
      </div>

      {/* ospiti e cambi, e la sequenza intera delle camere */}
      <div data-percorso-testa className="text-center" style={{ margin: '0 0 20px', paddingTop: 16, borderTop: `1px solid ${FILO_CHIARO}` }}>
        <p data-ospiti-cambi className="uppercase" style={OCCHIELLO}>{percorso.sopra}</p>
        <p data-camere-testa className="text-[18px] min-[700px]:text-[19px]" style={{ fontFamily: GEORGIA, lineHeight: 1.5, marginTop: 7 }}>{percorso.camere}</p>
      </div>

      {/* oggi: la camera di stanotte e il prossimo evento */}
      <div data-oggi-testa style={{ borderTop: `1px solid ${FILO_OGGI}`, borderBottom: `1px solid ${FILO_OGGI}`, padding: '16px 0' }}>
        <p className="uppercase" style={OCCHIELLO}>{oggi.sopra}</p>
        <p data-adesso-testa style={{ font: `25px ${GEORGIA}`, marginBottom: 9 }}>{oggi.titolo}</p>
        {oggi.prossimo && <p data-prossimo-testa style={{ fontSize: 14, color: VERDE_TESTO }}>{oggi.prossimo.testo}<strong style={{ fontWeight: 600 }}>{oggi.prossimo.forte}</strong></p>}
      </div>

      {/* quanto resta: la cifra del conto, la stessa di sotto */}
      <div data-residuo-testa className="flex flex-wrap items-baseline justify-between" style={{ gap: 10, margin: '20px 0 16px', fontSize: 14 }}>
        <span>{residuo.etichetta}</span>
        {residuo.importo && <strong className="whitespace-nowrap" style={{ font: `27px ${GEORGIA}`, fontVariantNumeric: 'tabular-nums' }}>{residuo.importo}</strong>}
      </div>

      {/* cosa manca ancora: il documento */}
      {daCompletare && <p data-da-completare style={{ padding: '11px 13px', background: FONDO_ATTENZIONE, color: TESTO_ATTENZIONE, fontSize: 13, marginBottom: 18, borderRadius: 5 }}>{daCompletare}</p>}

      {/* telefono e WhatsApp: il numero vero, che si chiama */}
      {(telefono || onScrivi) && (
        <div data-contatti-testa className="text-center" style={{ fontSize: 13, margin: '16px 0', color: VERDE_TESTO }}>
          {telefono && <a href={`tel:+${telefonoDaChiamare ?? telefono}`} data-chiama className="inline-block" style={{ ...AZIONE, margin: '-6px 8px', color: VERDE_TESTO }}>{telefono}</a>}
          {onScrivi && <button type="button" onClick={onScrivi} data-scrivi className="inline-block ed-azione" style={{ ...AZIONE, margin: '-6px 8px', fontSize: 13, fontWeight: 400, color: VERDE_TESTO }}>Scrivi</button>}
        </div>
      )}
      {!telefono && <p className="text-center mt-3 text-sm font-semibold" style={{ color: '#8C3B2E' }}>Nessun numero di telefono</p>}
      {documento && <div data-documento-testa className="text-center" style={{ fontSize: 12, color: GRIGIO, margin: '12px 0 23px' }}>{documento}</div>}

      {/* le note in rosso, come prima: la nota del cliente e quella «questa volta» */}
      {notePulite.length > 0 && (
        <div data-note-testa style={{ marginBottom: 18, borderTop: `1px dashed ${FILO_NOTA}`, paddingTop: 10 }}>
          {notePulite.map((n, i) => (
            <div key={n.etichetta + i} data-nota-cliente className={`text-center${i > 0 ? ' mt-2.5' : ''}`}>
              {n.etichetta && <p className="uppercase" style={{ fontSize: 10, letterSpacing: '1.5px', color: ROSSO_NOTA }}>{n.etichetta}</p>}
              <p className="mt-0.5 break-words" style={{ fontSize: 14.5, fontWeight: 700, color: ROSSO_NOTA, overflowWrap: 'anywhere' }}>{n.testo}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
