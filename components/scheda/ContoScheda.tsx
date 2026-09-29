'use client'
// ============================================================================
// LA LINGUETTA «CONTO» della scheda prenotazione.
//
// Storia: rifatta il 20/09/2026 sera sul disegno approvato da Ania («Il
// conto, senza ambiguità»), vestita «Maison» il 28/09/2026 mattina, e dallo
// stesso giorno impaginata come il riferimento della scheda a linguette
// (docs/design/scheda-riferimento.html, telefoni 3 e 3b):
//
//   TOTALE CONCORDATO   GIÀ RICEVUTO   COME PAGA
//   470 €               0 €            Caparra del 50%
//   ─────────────────────────────────────────── (filo d'ottone)
//   Resta da incassare                   470 €   (mattone; «Saldato 0 €» in verde)
//        Caparra del 50%, il resto all’arrivo · 235 € entro mer 30 set
//   AGGIUNGI PAGAMENTO · CAMBIA COME PAGA · SCONTO
//   PAGAMENTI REGISTRATI ─────────────────────
//   28 set · contanti / saldo completo      470 €  TOGLI
//   I pagamenti coprono fino alla notte del …
//   DETTAGLIO DEL SOGGIORNO ──────────────────
//   Ambra / 28 set → 1 ott · 3 notti × 80 €  240 €
//   Prezzo pieno ~~490 €~~ · Sconto − 20 € · Totale concordato 470 €
//
// Restano tutte le funzioni di prima: «Sconto» (regola fissa n. 6: è l'unico
// modo di cambiare il prezzo), «togli» per ogni pagamento, la riga «I
// pagamenti coprono fino alla notte del …» (regola fissa n. 9), la frase di
// come paga. Sola presentazione: parole e cifre da lib/schedaConto e
// lib/schedaMaison, che NON ricalcolano il totale (lib/prenotazioneUnica).
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

export default function ContoScheda({ riepilogo, conto, accordo, pagamenti, tipi, nessunPagamento, copertura = '', onPagamento, onComePaga, onSconto, onTogliPagamento, className = '' }: {
  /** le tre cifre (lib/schedaConto.riepilogoConto): totale concordato, già ricevuto, resta da incassare */
  riepilogo: RiepilogoConto
  /** il conto in righe (lib/schedaConto.contoScheda), per il dettaglio del soggiorno */
  conto: ContoInRighe
  /** il nome e la frase per esteso, con la caparra (lib/schedaMaison.fraseComePagaEstesa) */
  accordo: { nome: string; frase: string }
  pagamenti: RigaPagamento[]
  /** sotto ogni pagamento: «acconto» o «saldo completo» (lib/schedaMaison.tipoPagamenti) */
  tipi: Map<string, string>
  /** «Nessun pagamento registrato · si incassa all’arrivo.» */
  nessunPagamento: string
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
    <div data-conto className={className}>
      <section className="np-sec" style={{ paddingTop: 16 }}>
        {/* In cima: il totale, il già ricevuto e come paga */}
        <div data-riepilogo-conto className="sch-g3">
          <div data-totale-concordato><p className="sch-k">{conto.sconto ? RIGA_TOTALE_CONCORDATO : RIGA_TOTALE_SOGGIORNO}</p><p className="sch-big v">{riepilogo.totale}</p></div>
          <div data-gia-ricevuto><p className="sch-k">{RIGA_GIA_RICEVUTO}</p><p className="sch-big v">{riepilogo.ricevuto}</p></div>
          <div data-come-paga><p className="sch-k">{TITOLO_COME_PAGA}</p><p className="sch-big v">{accordo.nome}</p></div>
        </div>

        {/* Quanto resta: a sinistra le parole, a destra la cifra grande; mattone finché resta, verde da saldato */}
        <div data-residuo className={`sch-resta ${riepilogo.saldato ? 'saldato' : ''}`}>
          <span>{riepilogo.saldato ? CONTO_SALDATO : RIGA_RESTA_DA_INCASSARE}</span>
          <b data-conto-titolo={riepilogo.saldato ? 'saldato' : 'manca'} className="sch-big">{riepilogo.residuo}</b>
        </div>
        {riepilogo.avviso && <p data-conto-avviso className="np-hint m" style={{ textAlign: 'right' }}>{riepilogo.avviso}</p>}

        {/* Come paga, per esteso: la frase è una riga a sé, con la maiuscola */}
        <p data-come-paga-riga className="np-hint" style={{ textAlign: 'right', marginTop: 0 }} aria-label={`${TITOLO_COME_PAGA}: ${accordo.nome}`}>{maiuscola(accordo.frase)}</p>

        {/* I comandi sotto il residuo. Niente «Tariffe» (regola fissa n. 6): cambia solo lo sconto */}
        <p data-comandi-conto className="sch-azioni">
          <button type="button" data-aggiungi-pagamento onClick={onPagamento} className="mz-lnk">Aggiungi pagamento</button>
          <button type="button" data-cambia-come-paga onClick={onComePaga} className="mz-lnk q">Cambia come paga</button>
          <button type="button" data-modifica-sconto onClick={onSconto} className="mz-lnk q">{COMANDO_SCONTO}</button>
        </p>
      </section>

      {/* I pagamenti registrati, uno per riga */}
      <section className="np-sec" data-pagamenti-ricevuti>
        <p data-titolo-pagamenti className="mz-eyebrow">{TITOLO_PAGAMENTI_RICEVUTI}</p>
        {pagamenti.length === 0 && <p data-nessun-pagamento className="np-hint">{nessunPagamento}</p>}
        {pagamenti.map(p => (
          <div key={p.id} data-pagamento className="sch-pag">
            <span className="min-w-0">
              {p.quando}
              {tipi.get(p.id) && <small data-tipo-pagamento>{tipi.get(p.id)}</small>}
              {p.nota && <small data-nota-pagamento>{p.nota}</small>}
            </span>
            <span className="sch-pag-dx">
              <b className="sch-big">{p.importo}</b>
              <button type="button" data-togli-pagamento={p.id} onClick={() => onTogliPagamento(p.id)} className="sch-togli">{COMANDO_TOGLI}</button>
            </span>
          </div>
        ))}
        {/* fin dove arrivano i soldi ricevuti (regola fissa n. 9) */}
        {copertura && <p data-copertura-pagamenti className="np-hint">{copertura}.</p>}
      </section>

      {/* Il dettaglio del soggiorno */}
      <section className="np-sec" data-dettaglio-soggiorno>
        <p className="mz-eyebrow">{TITOLO_DETTAGLIO_SOGGIORNO}</p>
        {conto.righe.map(r => (
          <div key={r.chiave} data-riga-conto={r.chiave} className="sch-det">
            <span className="min-w-0"><span className="sch-big nm">{r.titolo}</span><small>{r.dettaglio}</small></span>
            <b className="sch-big">{r.importo}</b>
          </div>
        ))}
        {/* con lo sconto: il prezzo pieno barrato, lo sconto una volta sola in ottone */}
        {conto.sconto && (
          <>
            <div data-prezzo-pieno className="sch-det-pieno"><span>{RIGA_PREZZO_PIENO}</span><s>{conto.totale}</s></div>
            <div data-sconto-riga className="sch-det-sconto"><span>{conto.sconto.testo}</span><span>{conto.sconto.importo}</span></div>
          </>
        )}
        {/* «Totale soggiorno», o «Totale concordato» se c'è lo sconto: la cifra autorevole, la stessa in cima */}
        <div data-totale-dettaglio className="sch-det-tot">
          <span className="sch-big">{conto.totaleDettaglio}</span>
          <b className="sch-big">{conto.daPagare}</b>
        </div>
      </section>
    </div>
  )
}
