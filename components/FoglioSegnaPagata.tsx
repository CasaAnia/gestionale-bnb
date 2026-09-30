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
import { useRef, useState } from 'react'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import Link from 'next/link'
import AvvisoAzione from '@/components/AvvisoAzione'
import { apriSelettore } from '@/components/nuova/CampoData'
import { MESI_LUNGHI, dataItaliana } from '@/lib/dateItaliane'
import { leggiTentativoFattura, custodisciFattura, dimenticaFattura, ERRORE_CUSTODIA_FATTURA } from '@/lib/fatturaCustodia'
import { importoInCent, conLimite, LIMITE_SALVATAGGIO_MS } from '@/lib/pagamentoFoglio'
import {
  FATTURA_INCERTA, METODI_FATTURA, commissioneCent, importoIniziale, segnaFatturaPagata, ERRORE_IMPORTO_FATTURA, ERRORE_IMPORTO_MINORE,
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
  const [pendente, setPendente] = useState(() => leggiTentativoFattura(fattura.documentoId))
  const [riprovabile, setRiprovabile] = useState(false)
  const [conflitto, setConflitto] = useState(false)
  const inCorso = useRef(false)
  const [attesa, setAttesa] = useState(false)
  const [importo, setImporto] = useState(pendente?.scelta.importo ?? importoIniziale(fattura.importoCent))
  const [giorno, setGiorno] = useState(pendente?.scelta.giorno ?? oggi)
  const [metodo, setMetodo] = useState<MetodoFattura>(pendente?.scelta.metodo ?? 'contanti')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [salvato, setSalvato] = useState<Salvataggio | null>(null)
  const chiudi = () => { onSalvato(); onChiudi() }

  const cent = importoInCent(importo)
  const extra = commissioneCent(importo, fattura.importoCent)
  const avvisoImporto = importo.trim() === '' || cent == null ? ERRORE_IMPORTO_FATTURA : extra == null ? ERRORE_IMPORTO_MINORE : null

  async function salva(soloVerifica = false) {
    if (inCorso.current || salvando || avvisoImporto) return
    const tentativo = pendente ?? { fattura, scelta: { giorno, metodo, importo } }
    if (!soloVerifica && !custodisciFattura(tentativo)) { setErrore(ERRORE_CUSTODIA_FATTURA); return }
    setPendente(tentativo)
    inCorso.current = true
    setSalvando(true)
    setRiprovabile(false)
    setConflitto(false)
    setErrore(null)
    const richiesta = segnaFatturaPagata(client, tentativo.fattura, tentativo.scelta, soloVerifica)
    const risposta = await conLimite(richiesta, LIMITE_SALVATAGGIO_MS)
    // Nessun secondo invio mentre il primo è vivo, nemmeno dopo dieci secondi.
    if (risposta.scaduto) { setErrore(FATTURA_INCERTA); setAttesa(true); setSalvando(false) }
    const esito = risposta.scaduto ? await richiesta : risposta.valore
    setAttesa(false)
    inCorso.current = false
    setSalvando(false)
    if (!esito.ok) {
      setErrore(esito.errore)
      setRiprovabile(!!esito.riprovabile)
      setConflitto(!!esito.conflitto)
      // Un rifiuto certo non lascia campi bloccati per sempre. Nessuna
      // custodia incerta viene eliminata da questo ramo.
      if (esito.rifiutata && !esito.pagata && dimenticaFattura(tentativo)) setPendente(null)
      return
    }
    if (!dimenticaFattura(tentativo)) { setErrore('Pagamento verificato; non riesco a chiudere il promemoria. Riapri il gestionale e verifica di nuovo.'); return }
    setSalvato({ cosa: `${fattura.nome} · pagata il ${dataItaliana(tentativo.scelta.giorno)}`, quando: new Date() })
  }

  function chiudiPromemoria() {
    if (!pendente || !conflitto) return
    if (!dimenticaFattura(pendente)) { setErrore('Non riesco a chiudere il promemoria su questo dispositivo.'); return }
    onSalvato()
    onChiudi()
  }

  return (
    <FoglioMaison titolo={fattura.nome} sottotitolo="Segna pagata" altezza={ALTEZZA_FOGLIO_SEGNA_PAGATA} dati="segna-pagata"
      onChiudi={salvato ? () => {} : chiudi} salvato={salvato} onFineSalvato={() => { onSalvato(); onChiudi() }}
      piede={<PiedeMaison azione={attesa ? 'Attendo conferma…' : pendente ? (riprovabile ? 'Riprendi salvataggio' : 'Verifica salvataggio') : 'Salva'} onAzione={() => salva(!!pendente && !riprovabile)} salvando={salvando} disabilitato={attesa || !!avvisoImporto || !!salvato} onAnnulla={chiudi} dati="segna-pagata" />}>
      <div data-foglio-segna-pagata>
        <div>
          <span className="mz-lab">Bolletta</span>
          <strong data-importo-bolletta className="mz-grande" style={{ fontWeight: 300, display: 'block' }}>{euro(fattura.importoCent)}</strong>
          <p className="mz-hint" data-scadenza-bolletta>{fattura.numero ? `n. ${fattura.numero} · ` : ''}{scadenza}</p>
        </div>

        <div className="mz-g3" style={{ marginTop: 14 }}>
          <label><span className="mz-lab">Pagato</span>
            <input type="text" inputMode="decimal" autoComplete="off" data-campo="importo" value={importo} readOnly={!!pendente}
              onChange={e => setImporto(e.target.value)} className="mz-fld grande" /></label>
          <label style={{ gridColumn: 'span 2' }}><span className="mz-lab">Quando</span>
            <span className="relative block">
              <span className="mz-fld grande" data-data-scritta>{giornoInParole(giorno)}</span>
              <input type="date" data-campo="giorno" value={giorno} disabled={!!pendente} max={oggi} onChange={e => setGiorno(e.target.value || oggi)} onClick={e => apriSelettore(e.currentTarget)}
                style={{ position: 'absolute', inset: '-8px 0', width: '100%', opacity: 0, cursor: 'pointer' }} />
            </span></label>
        </div>

        <span className="mz-lab">Come</span>
        <div className="mz-chips">
          {METODI_FATTURA.map(m => (
            <button key={m.chiave} type="button" data-pastiglia={`modo-${m.chiave}`} aria-pressed={metodo === m.chiave} disabled={!!pendente}
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
        {pendente && !errore && !salvato && <p className="mz-note">I dati del salvataggio sono conservati. Verifica l’esito prima di registrarne un altro.</p>}
        {errore && <AvvisoAzione testo={errore} className="mt-3" />}
        {conflitto && <div className="mz-note">
          <Link className="mz-lnk" href={`/spese?documento=${fattura.documentoId}`}>Controlla nelle Spese</Link>
          <button type="button" className="mz-lnk" style={{ display: 'block', marginTop: 12 }} onClick={chiudiPromemoria}>Ho controllato nelle Spese: chiudi il promemoria</button>
        </div>}
      </div>
    </FoglioMaison>
  )
}
