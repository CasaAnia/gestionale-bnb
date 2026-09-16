'use client'
// ============================================================================
// «AGGIUNGI PAGAMENTO» (16/09/2026): il foglio della scheda nuova. Quanto (già
// scritto con quello che manca), quando (il calendario del telefono, già su
// oggi), come (Contanti · Bonifico) e una nota facoltativa; sotto, in ottone,
// quanto resterà da incassare. Oltre il dovuto si avvisa in mattone, ma si
// può salvare lo stesso.
//
// Le regole stanno in lib/pagamentoFoglio (pure) e il salvataggio in
// lib/pagamentiDati, col contratto unico dei movimenti: qui non si scrive
// niente sul database direttamente.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import CampoData from '@/components/nuova/CampoData'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo, MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import {
  TITOLO_PAGAMENTO, SALVA_PAGAMENTO, ETICHETTA_QUANTO, ETICHETTA_QUANDO, ETICHETTA_COME, ETICHETTA_NOTA, ERRORE_IMPORTO, ERRORE_GIORNO,
  MODI_PAGAMENTO, modoProposto, importoProposto, importoInCent, restaDopo, oltreIlDovuto, type ModoPagamento,
} from '@/lib/pagamentoFoglio'
import { registraPagamento, righePerSaldo, type EsitoPagamento, type RigaPagabile } from '@/lib/pagamentiDati'
import { saldoMancanteCent, type PagamentoStat } from '@/lib/statistiche'

export type PagamentoSalvato = Extract<EsitoPagamento, { esito: 'ok' }> & { importo: number; metodo: ModoPagamento }

export default function FoglioPagamento({ booking, righe, pagamenti, oggi, bonifico, onChiudi, onSalvato }: {
  booking: RigaPagabile
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaPagabile[]
  pagamenti: PagamentoStat[]
  oggi: string
  /** l'accordo aspetta un bonifico: la pastiglia proposta è quella */
  bonifico?: boolean | null
  onChiudi: () => void
  onSalvato: (esito: PagamentoSalvato) => void
}) {
  const manca = saldoMancanteCent(righePerSaldo(righe), pagamenti)
  const [importo, setImporto] = useState(importoProposto(manca))
  const [giorno, setGiorno] = useState(oggi)
  const [modo, setModo] = useState<ModoPagamento>(modoProposto(bonifico))
  const [nota, setNota] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const cent = importoInCent(importo)
  const resta = restaDopo(manca, cent)
  const oltre = oltreIlDovuto(manca, cent)

  async function salva() {
    if (salvando) return
    if (cent == null) { setErrore(ERRORE_IMPORTO); return }
    if (!giorno) { setErrore(ERRORE_GIORNO); return }
    setSalvando(true)
    setErrore(null)
    const esito = await registraPagamento(booking, righe, { importo: cent / 100, metodo: modo, giorno, nota })
    setSalvando(false)
    if (esito.esito === 'errore') { setErrore(esito.messaggio); return }
    onSalvato({ ...esito, importo: cent / 100, metodo: modo })
  }

  return (
    <Foglio titolo={TITOLO_PAGAMENTO} onChiudi={onChiudi}>
      <RigaCampo etichetta={ETICHETTA_QUANTO} ottone>
        <input type="number" inputMode="decimal" step="0.01" min="0" data-campo="importo" value={importo}
          onChange={e => setImporto(e.target.value)} style={{ ...stileCampo, fontSize: 17, fontWeight: 600 }} />
      </RigaCampo>
      <CampoData etichetta={ETICHETTA_QUANDO} valore={giorno} onValore={setGiorno} dati="giorno" ottone />
      <Etichetta testo={ETICHETTA_COME} ottone />
      <FilaPastiglie>
        {MODI_PAGAMENTO.map(m => (
          <Pastiglia key={m.chiave} dati={`modo-${m.chiave}`} acceso={modo === m.chiave} onClick={() => setModo(m.chiave)}>{m.testo}</Pastiglia>
        ))}
      </FilaPastiglie>
      <RigaCampo etichetta={ETICHETTA_NOTA} ottone className="mt-4">
        <input type="text" data-campo="nota" value={nota} onChange={e => setNota(e.target.value)} style={stileCampo} />
      </RigaCampo>

      {resta && <p data-resta-dopo style={{ marginTop: 12, fontSize: 12.5, color: OTTONE }}>{resta}</p>}
      {oltre && <p data-oltre-il-dovuto style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>{oltre}</p>}
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}

      <PiedeFoglio azione={SALVA_PAGAMENTO} onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="pagamento" />
    </Foglio>
  )
}
