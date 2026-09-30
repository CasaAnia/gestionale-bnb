'use client'
// ============================================================================
// «SEGNA PAGATA» (Ania, 30/09/2026): il foglio che si apre dalla voce
// «Bolletta da pagare» di «Da controllare». Stessa veste del foglio
// «Aggiungi pagamento» (FoglioMaison, altezza fissa, piede «Annulla · Salva»):
// in cima la bolletta, poi Quanto (già scritto con l'importo della bolletta,
// si cambia per le commissioni) e Quando (oggi), e Come: solo Contanti o
// Bonifico. Salvataggio con esito controllato (lib/fatturaPagata): errore =
// messaggio visibile e campi intatti; riuscito = spunta «Salvato» e la voce
// sparisce da sola alla rilettura.
// ============================================================================
import { useState } from 'react'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import AvvisoAzione from '@/components/AvvisoAzione'
import { apriSelettore } from '@/components/nuova/CampoData'
import { MESI_LUNGHI, dataItaliana } from '@/lib/dateItaliane'
import { importoInCent } from '@/lib/pagamentoFoglio'
import {
  METODI_FATTURA, commissioneCent, importoIniziale, segnaFatturaPagata, ERRORE_IMPORTO_FATTURA, ERRORE_IMPORTO_MINORE,
  type ClienteFattura, type FatturaDaPagare, type MetodoFattura,
} from '@/lib/fatturaPagata'

// Contenuto più lungo misurato a 390 px (importo con la riga della commissione)
export const ALTEZZA_FOGLIO_SEGNA_PAGATA = 440

const euro = (c: number) => `${(c / 100).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`
const giornoInParole = (iso: string) => { const [a, m, g] = iso.split('-').map(Number); return iso ? `${g} ${MESI_LUNGHI[m - 1]} ${a}` : 'da scegliere' }

export default function FoglioSegnaPagata({ fattura, scadenza, oggi, client, onChiudi, onSalvato }: {
  fattura: FatturaDaPagare
  /** «scaduta il 31/03/2025» */
  scadenza: string
  oggi: string
  client: ClienteFattura
  onChiudi: () => void
  onSalvato: () => void
}) {
  const [importo, setImporto] = useState(importoIniziale(fattura.importoCent))
  const [giorno, setGiorno] = useState(oggi)
  const [metodo, setMetodo] = useState<MetodoFattura>('contanti')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvato, setSalvato] = useState<Salvataggio | null>(null)
  // pagata ma commissione non salvata: la voce si rilegge alla chiusura (non
  // subito, sennò con l'ultima voce il foglio sparirebbe col suo avviso)
  const [daRileggere, setDaRileggere] = useState(false)
  const chiudi = () => { if (daRileggere) onSalvato(); onChiudi() }

  const cent = importoInCent(importo)
  const extra = commissioneCent(importo, fattura.importoCent)
  const avvisoImporto = importo.trim() === '' || cent == null ? ERRORE_IMPORTO_FATTURA : extra == null ? ERRORE_IMPORTO_MINORE : null

  async function salva() {
    if (salvando || avvisoImporto) return
    setSalvando(true)
    setErrore(null)
    const esito = await segnaFatturaPagata(client, fattura, { giorno, metodo, importo })
    setSalvando(false)
    if (!esito.ok) {
      setErrore(esito.errore)
      if (esito.pagata) setDaRileggere(true)
      return
    }
    setSalvato({ cosa: `${fattura.nome} · pagata il ${dataItaliana(giorno)}`, quando: new Date() })
  }

  return (
    <FoglioMaison titolo={fattura.nome} sottotitolo="Segna pagata" altezza={ALTEZZA_FOGLIO_SEGNA_PAGATA} dati="segna-pagata"
      onChiudi={salvato ? () => {} : chiudi} salvato={salvato} onFineSalvato={() => { onSalvato(); onChiudi() }}
      piede={<PiedeMaison azione="Salva" onAzione={salva} salvando={salvando} disabilitato={!!avvisoImporto || !!salvato} onAnnulla={chiudi} dati="segna-pagata" />}>
      <div data-foglio-segna-pagata>
        <div>
          <span className="mz-lab">Bolletta</span>
          <strong data-importo-bolletta className="mz-grande" style={{ fontWeight: 300, display: 'block' }}>{euro(fattura.importoCent)}</strong>
          <p className="mz-hint" data-scadenza-bolletta>{fattura.numero ? `n. ${fattura.numero} · ` : ''}{scadenza}</p>
        </div>

        <div className="mz-g3" style={{ marginTop: 14 }}>
          <label><span className="mz-lab">Pagato</span>
            <input type="text" inputMode="decimal" autoComplete="off" data-campo="importo" value={importo}
              onChange={e => setImporto(e.target.value)} className="mz-fld grande" /></label>
          <label style={{ gridColumn: 'span 2' }}><span className="mz-lab">Quando</span>
            <span className="relative block">
              <span className="mz-fld grande" data-data-scritta>{giornoInParole(giorno)}</span>
              <input type="date" data-campo="giorno" value={giorno} max={oggi} onChange={e => setGiorno(e.target.value || oggi)} onClick={e => apriSelettore(e.currentTarget)}
                style={{ position: 'absolute', inset: '-8px 0', width: '100%', opacity: 0, cursor: 'pointer' }} />
            </span></label>
        </div>

        <span className="mz-lab">Come</span>
        <div className="mz-chips">
          {METODI_FATTURA.map(m => (
            <button key={m.chiave} type="button" data-pastiglia={`modo-${m.chiave}`} aria-pressed={metodo === m.chiave}
              className={`mz-chip ${metodo === m.chiave ? 'on' : ''}`} onClick={() => setMetodo(m.chiave)}>{m.testo}</button>
          ))}
        </div>

        <div aria-live="polite">
          {extra != null && extra > 0 && (
            <p data-commissione className="mz-hint" style={{ marginTop: 14 }}>
              {euro(extra)} in più della bolletta: diventano una spesa a parte, <b style={{ fontWeight: 500, color: 'var(--m-ink)' }}>Commissione pagamento</b>.
            </p>
          )}
          {importo.trim() !== '' && avvisoImporto && <p data-errore-importo className="mz-errore">{avvisoImporto}</p>}
        </div>
        {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      </div>
    </FoglioMaison>
  )
}
