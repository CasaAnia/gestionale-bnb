'use client'
// ============================================================================
// LA PARTE «CONTO» della nuova scheda prenotazione (13/09/2026, rifatta il
// 18/09/2026): quanto manca (o «Saldato») in grande a sinistra, il dettaglio
// a destra, una barretta che dice a occhio quanto è stato pagato, poi il
// conto nelle righe di sempre (components/ContoRighe, le stesse
// dell'inserimento): una riga per camera col dettaglio piccolo, il letto in
// più in una riga sola, «Totale», lo sconto in una riga sola in ottone,
// «Da pagare» in grande con sotto «3 notti · 85 € a notte»; poi «Come paga»
// e i pagamenti già registrati.
//
// Sola presentazione: i testi e le cifre arrivano da lib/schedaConto, che a
// sua volta NON ricalcola il totale (viene da lib/prenotazioneUnica).
// ============================================================================
import { TITOLO_COME_PAGA } from '@/components/ComePaga'
import { RigaConto, TotaleConto, ScontoConto, DaPagareConto } from '@/components/ContoRighe'
import { COMANDO_SCONTO } from '@/lib/scontoScheda'
import { COMANDO_TOGLI } from '@/lib/pagamentoFoglio'
import { COMANDO_TARIFFE } from '@/lib/tariffaScheda'
import type { ContoInRighe, RigaPagamento, TestaConto } from '@/lib/schedaConto'

const GEORGIA = "Georgia, 'Times New Roman', serif"
export const ROSSO_CONTO = '#D40000'
export const FONDO_BARRA = '#EFE9DC'
export const ALTEZZA_BARRA = 4

export default function ContoScheda({ testa, conto, accordo, pagamenti, onPagamento, onComePaga, onSconto, onTogliPagamento, onTariffe, className = '' }: {
  testa: TestaConto
  /** il conto in righe (lib/schedaConto.contoScheda) */
  conto: ContoInRighe
  accordo: { nome: string; frase: string }
  pagamenti: RigaPagamento[]
  /** apre il foglio «Aggiungi pagamento» (16/09/2026), qui nella scheda */
  onPagamento: () => void
  onComePaga: () => void
  /** apre il foglio «Sconto» (17/09/2026): mettere, cambiare o togliere lo sconto */
  onSconto: () => void
  /** apre il foglio «Togli pagamento» (17/09/2026) per quel pagamento */
  onTogliPagamento: (id: string) => void
  /** apre il foglio «Tariffe» (17/09/2026): la tariffa a notte di ogni tratto */
  onTariffe: () => void
  className?: string
}) {
  return (
    <div data-conto className={className}>
      {/* Quanto manca, in grande; a destra il dettaglio su due righe */}
      <div className="flex items-start justify-between gap-3">
        <p data-conto-titolo={testa.saldato ? 'saldato' : 'manca'} className="leading-none"
          style={{ fontFamily: GEORGIA, fontSize: 32, color: testa.saldato ? 'var(--color-green-dark)' : ROSSO_CONTO }}>
          {testa.titolo}
        </p>
        <p className="text-right shrink-0 leading-snug" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>
          {testa.dettaglio}
          {testa.sotto && <><br />{testa.sotto}</>}
        </p>
      </div>

      {/* La barretta: quanto è già stato pagato */}
      <div data-barra-conto aria-hidden className="mt-3 overflow-hidden"
        style={{ height: ALTEZZA_BARRA, borderRadius: ALTEZZA_BARRA, background: FONDO_BARRA }}>
        <div style={{ width: `${Math.round(testa.quotaPagata * 100)}%`, height: '100%', background: 'var(--color-green-mid)', opacity: 0.55 }} />
      </div>

      {/* Il conto in righe: camere, letto, totale, sconto, da pagare */}
      <div data-righe-conto className="mt-3">
        {conto.righe.map(r => <RigaConto key={r.chiave} riga={r} />)}
        <TotaleConto importo={conto.totale} />
        {conto.sconto && <ScontoConto sconto={conto.sconto} />}
        <DaPagareConto importo={conto.daPagare} sotto={conto.sotto} />
      </div>

      {/* Come paga: il nome del modo e, sotto, la frase per esteso */}
      <div data-come-paga-riga className="flex items-baseline justify-between gap-3" style={{ padding: '14px 0 0' }}>
        <span style={{ fontSize: 14, color: 'var(--color-stone)' }}>{TITOLO_COME_PAGA}</span>
        <span className="text-right min-w-0">
          <span className="block" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{accordo.nome}</span>
          <span className="block" style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{accordo.frase}</span>
        </span>
      </div>

      {/* I pagamenti già registrati */}
      {pagamenti.map(p => (
        <div key={p.id} data-pagamento className="flex items-baseline justify-between gap-3" style={{ padding: '8px 0 0' }}>
          <span className="min-w-0">
            <span className="block" style={{ fontSize: 14, color: 'var(--color-stone)' }}>{p.quando}</span>
            {p.nota && <span data-nota-pagamento className="block" style={{ fontSize: 12.5, color: 'var(--color-stone)', opacity: 0.85 }}>{p.nota}</span>}
          </span>
          <span className="shrink-0 flex items-baseline" style={{ gap: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{p.importo}</span>
            <button type="button" data-togli-pagamento={p.id} onClick={() => onTogliPagamento(p.id)} className="py-2 -my-2"
              style={{ fontSize: 12.5, color: 'var(--color-stone)' }}>{COMANDO_TOGLI}</button>
          </span>
        </div>
      ))}

      <p className="flex flex-wrap items-center mt-2" style={{ gap: '0 12px', fontSize: 14 }}>
        <button type="button" data-aggiungi-pagamento onClick={onPagamento} className="py-2 -my-2" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-mid)' }}>Aggiungi pagamento</button>
        <button type="button" onClick={onComePaga} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>Cambia come paga</button>
        <button type="button" data-modifica-sconto onClick={onSconto} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>{COMANDO_SCONTO}</button>
        <button type="button" data-modifica-tariffe onClick={onTariffe} className="py-2 -my-2" style={{ fontSize: 14, color: 'var(--color-stone)' }}>{COMANDO_TARIFFE}</button>
      </p>
    </div>
  )
}
