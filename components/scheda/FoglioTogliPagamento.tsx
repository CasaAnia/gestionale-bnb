'use client'
// ============================================================================
// «TOGLI PAGAMENTO» (17/09/2026): il foglio di conferma che si apre dal
// comando «togli» accanto a un pagamento del conto. Dice cosa si sta
// togliendo (importo in grande, giorno e modo, la nota) e quanto resterà da
// incassare senza; se la prenotazione è segnata pagata e senza questo
// pagamento resterebbe qualcosa, lo dice: il bollino verrà tolto.
//
// La pastiglia è in mattone perché si toglie qualcosa; «Annulla» chiude e
// basta. Due tocchi di fila non tolgono due volte: mentre si toglie il
// piede è spento. Le regole stanno in lib/pagamentoFoglio, la cancellazione
// in lib/pagamentiDati: qui non si scrive niente sul database.
// ============================================================================
import { useRef, useState } from 'react'
import Foglio, { PiedeFoglio, GEORGIA_FOGLIO } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import {
  TITOLO_TOGLI_PAGAMENTO, TOGLI_PAGAMENTO, DOMANDA_TOGLI, descrizionePagamento, restaSenza, bollinoDaTogliere,
  type PagamentoDaTogliere,
} from '@/lib/pagamentoFoglio'
import { togliPagamento, type EsitoTolto, type RigaPagabile } from '@/lib/pagamentiDati'

export const BOLLINO_VIA = 'La prenotazione non risulterà più pagata.'

export default function FoglioTogliPagamento({ pagamento, righe, totaleCent, ricevutiCent, onChiudi, onTolto }: {
  pagamento: PagamentoDaTogliere
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaPagabile[]
  totaleCent: number
  ricevutiCent: number
  onChiudi: () => void
  onTolto: (esito: Extract<EsitoTolto, { esito: 'ok' }>) => void
}) {
  const [togliendo, setTogliendo] = useState(false)
  // due tocchi nello stesso istante arrivano prima che lo stato si aggiorni:
  // il riferimento dice subito che si sta già togliendo
  const inCorso = useRef(false)
  const [errore, setErrore] = useState<string | null>(null)
  const cosa = descrizionePagamento(pagamento)
  const importoCent = Math.round(Number(pagamento.amount || 0) * 100)
  const resta = restaSenza(totaleCent, ricevutiCent, importoCent)
  const bollinoVia = bollinoDaTogliere(righe.some(r => !!r.pagato), totaleCent, ricevutiCent, importoCent)

  async function togli() {
    if (togliendo || inCorso.current) return
    inCorso.current = true
    setTogliendo(true)
    setErrore(null)
    const esito = await togliPagamento(righe, pagamento.id)
    setTogliendo(false)
    if (esito.esito === 'errore') { inCorso.current = false; setErrore(esito.messaggio); return }
    onTolto(esito)
  }

  return (
    <Foglio titolo={TITOLO_TOGLI_PAGAMENTO} onChiudi={onChiudi}>
      <p style={{ fontSize: 14, color: 'var(--color-green-dark)' }}>{DOMANDA_TOGLI}</p>
      <div data-pagamento-da-togliere style={{ marginTop: 12, padding: '10px 0', borderTop: '1px solid var(--color-card-border)', borderBottom: '1px solid var(--color-card-border)' }}>
        <p data-importo-da-togliere className="leading-none" style={{ fontFamily: GEORGIA_FOGLIO, fontSize: 28, color: 'var(--color-green-dark)' }}>{cosa.importo}</p>
        <p data-quando-da-togliere style={{ marginTop: 6, fontSize: 13, color: 'var(--color-stone)' }}>{cosa.quando}</p>
        {cosa.nota && <p data-nota-da-togliere style={{ marginTop: 2, fontSize: 12.5, color: 'var(--color-stone)', opacity: 0.85 }}>{cosa.nota}</p>}
      </div>
      <p data-resta-senza style={{ marginTop: 12, fontSize: 12.5, color: OTTONE }}>{resta}</p>
      {bollinoVia && <p data-bollino-via style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>{BOLLINO_VIA}</p>}
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}

      <PiedeFoglio azione={TOGLI_PAGAMENTO} onAzione={togli} salvando={togliendo} testoSalvando="Tolgo…" onAnnulla={onChiudi} mattone dati="togli-pagamento" />
    </Foglio>
  )
}
