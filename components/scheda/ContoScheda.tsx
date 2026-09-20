'use client'
// ============================================================================
// LA PARTE «CONTO» della scheda prenotazione, rifatta il 20/09/2026 sera sul
// disegno approvato da Ania («Il conto, senza ambiguità», colonna DOPO):
//   Totale concordato · Già ricevuto · un filo · «Resta da incassare» con la
//   cifra grande sotto, a sinistra · «Aggiungi pagamento» e «Sconto» ·
//   PAGAMENTI RICEVUTI, uno per riga con «togli», e sotto la riga «I
//   pagamenti coprono fino alla notte del …» · «Come paga» con la frase e
//   «Cambia come paga» · «Dettaglio del soggiorno», che si apre e si chiude
//   (aperto all'inizio), con le camere, il letto, lo sconto e il totale.
// Niente più cifra rossa, barretta e «800 € pagati, 7 e 16 set»; niente più
// «Da pagare» che ripeteva il totale anche dopo i pagamenti parziali.
//
// Sola presentazione: parole e cifre arrivano da lib/schedaConto, che a sua
// volta NON ricalcola il totale (viene da lib/prenotazioneUnica). Le misure
// e i colori qui sotto sono quelli del riferimento approvato (Arial 14/1,5,
// Georgia per gli importi, verde #30483b) e valgono SOLO dentro questa
// parte: il carattere dell'app non cambia. Il titolo «CONTO» col filo lo
// mette la pagina (.ed-sezione), qui non si ripete.
// ============================================================================
import type { CSSProperties } from 'react'
import { TITOLO_COME_PAGA } from '@/components/ComePaga'
import { COMANDO_SCONTO } from '@/lib/scontoScheda'
import { COMANDO_TOGLI } from '@/lib/pagamentoFoglio'
import {
  RIGA_TOTALE_CONCORDATO, RIGA_GIA_RICEVUTO, RIGA_RESTA_DA_INCASSARE, CONTO_SALDATO,
  TITOLO_PAGAMENTI_RICEVUTI, TITOLO_DETTAGLIO_SOGGIORNO, RIGA_PREZZO_PIENO,
  type ContoInRighe, type RigaPagamento, type RiepilogoConto,
} from '@/lib/schedaConto'

// I colori del riferimento
export const TESTO_CONTO = '#30483b'
const TESTO_PAGAMENTI = '#3c5145'
const DESCRIZIONE = '#73796f'
const OTTONE_SCURO = '#756748'
const TENUE = '#a0a198'
const FILO_RESIDUO = '#cdbf9f'
const FILO_BLOCCO = '#d9cdb6'
const FILO_PAGAMENTI = '#e8e0d3'
const FILO_CAMERE = '#ece6dc'
const GEORGIA = 'Georgia, serif'

// gli importi non si spezzano mai e le cifre stanno in colonna
const MONETA: CSSProperties = { whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }
// una riga «etichetta a sinistra · importo a destra»; sul telefono può andare a capo
const RIGA = 'flex flex-wrap items-baseline justify-between gap-2 sm:flex-nowrap sm:gap-[14px]'
// I comandi di testo: la veste ed-azione dell'app (manina, filo, cerchio del
// fuoco da tastiera) con le misure del riferimento: 13 px, filo a 3 px nel
// colore del testo, riga alta come il testo. La zona di tocco resta comoda:
// il padding la allarga e il margine negativo la rimangia nel disegno.
const AZIONE: CSSProperties = {
  minHeight: 0, padding: '6px 0', margin: '-6px 0',
  fontSize: 13, fontWeight: 400, lineHeight: 1.5, color: 'inherit',
  textDecoration: 'underline', textDecorationColor: 'currentColor', textUnderlineOffset: 3,
}
const AZIONE_FORTE: CSSProperties = { ...AZIONE, fontWeight: 600 }
const AZIONE_TENUE: CSSProperties = { ...AZIONE, color: TENUE }
const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)

export default function ContoScheda({ riepilogo, conto, accordo, pagamenti, copertura = '', onPagamento, onComePaga, onSconto, onTogliPagamento, className = '' }: {
  /** le tre cifre (lib/schedaConto.riepilogoConto): totale concordato, già ricevuto, resta da incassare */
  riepilogo: RiepilogoConto
  /** il conto in righe (lib/schedaConto.contoScheda), per il dettaglio del soggiorno */
  conto: ContoInRighe
  accordo: { nome: string; frase: string }
  pagamenti: RigaPagamento[]
  /** «I pagamenti coprono fino alla notte del 10 set» (regola fissa n. 9, 20/09/2026); vuota = niente */
  copertura?: string
  /** apre il foglio «Aggiungi pagamento» (16/09/2026), qui nella scheda */
  onPagamento: () => void
  onComePaga: () => void
  /** apre il foglio «Sconto» (17/09/2026): mettere, cambiare o togliere lo sconto */
  onSconto: () => void
  /** apre il foglio «Togli pagamento» (17/09/2026) per quel pagamento */
  onTogliPagamento: (id: string) => void
  className?: string
}) {
  return (
    <div data-conto className={className} style={{ font: '14px/1.5 Arial, sans-serif', color: TESTO_CONTO }}>
      {/* Le due righe del riepilogo: etichetta a sinistra, importo in Georgia a destra */}
      <div data-riepilogo-conto>
        <div data-totale-concordato className={RIGA} style={{ padding: '10px 0', fontSize: 15 }}>
          <span>{RIGA_TOTALE_CONCORDATO}</span>
          <span style={{ ...MONETA, font: `25px ${GEORGIA}` }}>{riepilogo.totale}</span>
        </div>
        <div data-gia-ricevuto className={RIGA} style={{ padding: '10px 0', fontSize: 15 }}>
          <span>{RIGA_GIA_RICEVUTO}</span>
          <span style={{ ...MONETA, font: `25px ${GEORGIA}` }}>{riepilogo.ricevuto}</span>
        </div>
      </div>

      {/* Quanto resta: l'etichetta e, sotto, la cifra grande a sinistra */}
      <div data-residuo style={{ borderTop: `1px solid ${FILO_RESIDUO}`, marginTop: 12, padding: '18px 0 20px' }}>
        <span style={{ fontSize: 16, fontWeight: 600 }}>{RIGA_RESTA_DA_INCASSARE}</span>
        <span data-conto-titolo={riepilogo.saldato ? 'saldato' : 'manca'} className="block"
          style={{ ...MONETA, font: `36px ${GEORGIA}`, marginTop: 7, color: TESTO_CONTO }}>{riepilogo.residuo}</span>
        {riepilogo.saldato && <span data-saldato className="block" style={{ marginTop: 6, fontSize: 13, color: OTTONE_SCURO }}>{CONTO_SALDATO}</span>}
        {riepilogo.avviso && <span data-conto-avviso className="block" style={{ marginTop: 6, fontSize: 13, color: OTTONE_SCURO }}>{riepilogo.avviso}</span>}
      </div>

      {/* I due comandi sotto il residuo */}
      <p data-comandi-conto className="flex flex-wrap" style={{ marginTop: 13, gap: 14 }}>
        <button type="button" data-aggiungi-pagamento onClick={onPagamento} className="ed-azione" style={AZIONE_FORTE}>Aggiungi pagamento</button>
        <button type="button" data-modifica-sconto onClick={onSconto} className="ed-azione" style={AZIONE}>{COMANDO_SCONTO}</button>
        {/* Niente «Tariffe» (Ania, 18/09/2026, regola fissa n. 6): il prezzo
            della camera è il listino e non si cambia mai; cambia solo lo sconto. */}
      </p>

      {/* I pagamenti ricevuti, uno per riga; senza pagamenti il blocco non c'è */}
      {pagamenti.length > 0 && (
        <div data-pagamenti-ricevuti>
          <p data-titolo-pagamenti className="uppercase" style={{ fontSize: 12, letterSpacing: '1.2px', color: OTTONE_SCURO, margin: '28px 0 8px' }}>{TITOLO_PAGAMENTI_RICEVUTI}</p>
          {pagamenti.map(p => (
            <div key={p.id} data-pagamento className="flex items-baseline" style={{ gap: 10, padding: '13px 0', borderBottom: `1px solid ${FILO_PAGAMENTI}`, color: TESTO_PAGAMENTI }}>
              <span className="min-w-0">
                <span className="block">{p.quando}</span>
                {p.nota && <span data-nota-pagamento className="block" style={{ fontSize: 13, color: DESCRIZIONE }}>{p.nota}</span>}
              </span>
              <span style={{ ...MONETA, marginLeft: 'auto' }}>{p.importo}</span>
              <button type="button" data-togli-pagamento={p.id} onClick={() => onTogliPagamento(p.id)} className="ed-azione" style={AZIONE_TENUE}>{COMANDO_TOGLI}</button>
            </div>
          ))}
        </div>
      )}

      {/* fin dove arrivano i soldi ricevuti (regola fissa n. 9) */}
      {copertura && <p data-copertura-pagamenti style={{ margin: '12px 0 22px', fontSize: 13, color: OTTONE_SCURO }}>{copertura}</p>}

      {/* Come paga: il nome del modo, sotto la frase per esteso, poi il comando */}
      <div data-come-paga-riga style={{ marginTop: 26, paddingTop: 17, borderTop: `1px solid ${FILO_BLOCCO}` }}>
        <div className={RIGA}>
          <span>{TITOLO_COME_PAGA}</span>
          <span>{accordo.nome}</span>
        </div>
        {/* la frase è una riga a sé: comincia con la maiuscola, come nel riferimento */}
        <p style={{ margin: '5px 0', fontSize: 13, color: DESCRIZIONE }}>{maiuscola(accordo.frase)}</p>
        <button type="button" data-cambia-come-paga onClick={onComePaga} className="ed-azione" style={AZIONE}>Cambia come paga</button>
      </div>

      {/* Il dettaglio del soggiorno: aperto all'inizio, si chiude toccando il titolo (anche da tastiera) */}
      <details data-dettaglio-soggiorno open style={{ marginTop: 28, borderTop: `1px solid ${FILO_BLOCCO}`, paddingTop: 16 }}>
        <summary data-apri-dettaglio style={{ fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>{TITOLO_DETTAGLIO_SOGGIORNO}</summary>
        {conto.righe.map(r => (
          <div key={r.chiave} data-riga-conto={r.chiave} style={{ padding: '15px 0', borderBottom: `1px solid ${FILO_CAMERE}` }}>
            <div className={RIGA}>
              <span>{r.titolo}</span>
              <span style={MONETA}>{r.importo}</span>
            </div>
            <small className="block" style={{ fontSize: 13, color: DESCRIZIONE, marginTop: 3 }}>{r.dettaglio}</small>
          </div>
        ))}
        {/* con lo sconto: il prezzo pieno, lo sconto una volta sola, poi il totale concordato */}
        {conto.sconto && (
          <>
            <div data-prezzo-pieno className={RIGA} style={{ padding: '15px 0', borderBottom: `1px solid ${FILO_CAMERE}` }}>
              <span>{RIGA_PREZZO_PIENO}</span>
              <span style={MONETA}>{conto.totale}</span>
            </div>
            <div data-sconto-riga className={RIGA} style={{ padding: '15px 0', borderBottom: `1px solid ${FILO_CAMERE}`, color: OTTONE_SCURO }}>
              <span>{conto.sconto.testo}</span>
              <span style={MONETA}>{conto.sconto.importo}</span>
            </div>
          </>
        )}
        {/* «Totale soggiorno», o «Totale concordato» se c'è lo sconto: la cifra autorevole, la stessa in cima */}
        <div data-totale-dettaglio className={RIGA} style={{ padding: '14px 0 3px', fontWeight: 600 }}>
          <span>{conto.totaleDettaglio}</span>
          <span style={MONETA}>{conto.daPagare}</span>
        </div>
      </details>
    </div>
  )
}
