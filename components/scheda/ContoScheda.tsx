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
//
// Dal 28/09/2026 la veste «Maison» (riferimento approvato da Ania, pannello
// «Conto della prenotazione»): Totale soggiorno · Già ricevuto · Come paga a
// filo, «Resta da incassare» grande in Cormorant (mattone finché resta
// qualcosa), «Aggiungi pagamento» e «Cambia come paga», l'elenco «Pagamenti
// registrati». Restano tutte le funzioni di prima: «Sconto» (regola fissa
// n. 6: è l'unico modo di cambiare il prezzo), «togli» per ogni pagamento, la
// riga «I pagamenti coprono fino alla notte del …» (regola fissa n. 9), la
// frase di come paga e il dettaglio del soggiorno apribile.
// ============================================================================
import { TITOLO_COME_PAGA } from '@/components/ComePaga'
import { COMANDO_SCONTO } from '@/lib/scontoScheda'
import { COMANDO_TOGLI } from '@/lib/pagamentoFoglio'
import {
  RIGA_TOTALE_CONCORDATO, RIGA_TOTALE_SOGGIORNO, RIGA_GIA_RICEVUTO, RIGA_RESTA_DA_INCASSARE, CONTO_SALDATO,
  TITOLO_PAGAMENTI_RICEVUTI, TITOLO_DETTAGLIO_SOGGIORNO, RIGA_PREZZO_PIENO,
  type ContoInRighe, type RigaPagamento, type RiepilogoConto,
} from '@/lib/schedaConto'

const maiuscola = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const RIGA = 'flex flex-wrap items-baseline justify-between gap-2'

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
    <div data-conto className={`mz ${className}`}>
      {/* In cima, a filo: il totale, il già ricevuto e come paga */}
      <div data-riepilogo-conto className="mz-g3">
        <div data-totale-concordato><span className="mz-lab" style={{ marginTop: 0 }}>{conto.sconto ? RIGA_TOTALE_CONCORDATO : RIGA_TOTALE_SOGGIORNO}</span><span className="mz-fld grande">{riepilogo.totale}</span></div>
        <div data-gia-ricevuto><span className="mz-lab" style={{ marginTop: 0 }}>{RIGA_GIA_RICEVUTO}</span><span className="mz-fld grande">{riepilogo.ricevuto}</span></div>
        <div data-come-paga><span className="mz-lab" style={{ marginTop: 0 }}>{TITOLO_COME_PAGA}</span><span className="mz-fld grande">{accordo.nome}</span></div>
      </div>

      {/* Quanto resta: l'etichetta e sotto la cifra grande, in mattone finché resta qualcosa */}
      <div data-residuo>
        <span className="mz-lab" style={{ marginTop: 18 }}>{RIGA_RESTA_DA_INCASSARE}</span>
        <span data-conto-titolo={riepilogo.saldato ? 'saldato' : 'manca'} className={`mz-grande block ${riepilogo.saldato ? '' : 'mat'}`}>{riepilogo.residuo}</span>
        {riepilogo.saldato && <span data-saldato className="mz-note block">{CONTO_SALDATO}</span>}
        {riepilogo.avviso && <span data-conto-avviso className="mz-note block">{riepilogo.avviso}</span>}
      </div>

      {/* I comandi sotto il residuo. Niente «Tariffe» (regola fissa n. 6): cambia solo lo sconto */}
      <p data-comandi-conto className="flex flex-wrap" style={{ marginTop: 12, gap: 18 }}>
        <button type="button" data-aggiungi-pagamento onClick={onPagamento} className="mz-lnk">Aggiungi pagamento</button>
        <button type="button" data-cambia-come-paga onClick={onComePaga} className="mz-lnk q">Cambia come paga</button>
        <button type="button" data-modifica-sconto onClick={onSconto} className="mz-lnk q">{COMANDO_SCONTO}</button>
      </p>

      {/* I pagamenti registrati, uno per riga; senza pagamenti il blocco non c'è */}
      {pagamenti.length > 0 && (
        <div data-pagamenti-ricevuti>
          <span data-titolo-pagamenti className="mz-lab" style={{ marginTop: 20 }}>{TITOLO_PAGAMENTI_RICEVUTI}</span>
          {pagamenti.map(p => (
            <div key={p.id} data-pagamento className="flex items-baseline" style={{ gap: 10, padding: '8px 0', borderBottom: '1px solid var(--m-line)', fontSize: 13 }}>
              <span className="min-w-0">
                <span className="block">{p.quando}</span>
                {p.nota && <span data-nota-pagamento className="block mz-note" style={{ marginTop: 0 }}>{p.nota}</span>}
              </span>
              <span className="mz-disp" style={{ marginLeft: 'auto', fontSize: 15, whiteSpace: 'nowrap' }}>{p.importo}</span>
              <button type="button" data-togli-pagamento={p.id} onClick={() => onTogliPagamento(p.id)} className="mz-lnk q">{COMANDO_TOGLI}</button>
            </div>
          ))}
        </div>
      )}

      {/* fin dove arrivano i soldi ricevuti (regola fissa n. 9) */}
      {copertura && <p data-copertura-pagamenti className="mz-note">{copertura}</p>}

      {/* Come paga, per esteso: la frase è una riga a sé, con la maiuscola */}
      <p data-come-paga-riga className="mz-note" aria-label={`${TITOLO_COME_PAGA}: ${accordo.nome}`}>{maiuscola(accordo.frase)}</p>

      {/* Il dettaglio del soggiorno: aperto all'inizio, si chiude toccando il titolo */}
      <details data-dettaglio-soggiorno open style={{ marginTop: 20, borderTop: '1px solid var(--m-line)', paddingTop: 12 }}>
        <summary data-apri-dettaglio className="mz-lab" style={{ marginTop: 0, cursor: 'pointer' }}>{TITOLO_DETTAGLIO_SOGGIORNO}</summary>
        {conto.righe.map(r => (
          <div key={r.chiave} data-riga-conto={r.chiave} style={{ padding: '8px 0', borderBottom: '1px solid var(--m-line)', fontSize: 13 }}>
            <div className={RIGA}>
              <span>{r.titolo}</span>
              <span className="mz-disp" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{r.importo}</span>
            </div>
            <small className="block mz-note" style={{ marginTop: 2 }}>{r.dettaglio}</small>
          </div>
        ))}
        {/* con lo sconto: il prezzo pieno, lo sconto una volta sola, poi il totale concordato */}
        {conto.sconto && (
          <>
            <div data-prezzo-pieno className={RIGA} style={{ padding: '8px 0', borderBottom: '1px solid var(--m-line)', fontSize: 13 }}>
              <span>{RIGA_PREZZO_PIENO}</span>
              <span className="mz-disp" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{conto.totale}</span>
            </div>
            <div data-sconto-riga className={RIGA} style={{ padding: '8px 0', borderBottom: '1px solid var(--m-line)', fontSize: 13, color: 'var(--m-acc)' }}>
              <span>{conto.sconto.testo}</span>
              <span className="mz-disp" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>{conto.sconto.importo}</span>
            </div>
          </>
        )}
        {/* «Totale soggiorno», o «Totale concordato» se c'è lo sconto: la cifra autorevole, la stessa in cima */}
        <div data-totale-dettaglio className={RIGA} style={{ padding: '10px 0 3px', fontSize: 13, fontWeight: 500 }}>
          <span>{conto.totaleDettaglio}</span>
          <span className="mz-disp" style={{ fontSize: 16, whiteSpace: 'nowrap' }}>{conto.daPagare}</span>
        </div>
      </details>
    </div>
  )
}
