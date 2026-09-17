'use client'
// ============================================================================
// «SCONTO» (17/09/2026): il foglio della scheda nuova per mettere, cambiare o
// togliere lo sconto. Tre pastiglie come nell'inserimento (Nessuno ·
// Percentuale · Prezzo finale), il campo per il numero, e prima di salvare i
// tre numeri che contano: il totale attuale, il nuovo totale e quanto resta
// da incassare, contando i pagamenti già registrati.
//
// Le regole stanno in lib/scontoScheda (pure) e le scritture in
// lib/scontoDati: qui non si calcola e non si scrive niente.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo, MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import {
  TITOLO_SCONTO, SALVA_SCONTO, TIPI_SCONTO, ETICHETTA_PER_CENTO, ETICHETTA_IN_TUTTO,
  scontoSalvato, valoreIniziale, valoreDaCampo, erroreSconto, anteprimaSconto, righeAnteprima, nienteDaSalvare,
  type RigaScontabile, type AnteprimaSconto,
} from '@/lib/scontoScheda'
import { salvaSconto } from '@/lib/scontoDati'
import type { ScontoNuova } from '@/lib/nuovaPrenotazione'

export default function FoglioSconto({ righe, ricevutiCent, onChiudi, onSalvato }: {
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaScontabile[]
  ricevutiCent: number
  onChiudi: () => void
  /** i nuovi campi di ogni riga attiva, già scritti; `cambiato` è falso se non c'era niente da salvare */
  onSalvato: (anteprima: AnteprimaSconto, cambiato: boolean) => void
}) {
  const iniziale = scontoSalvato(righe)
  const [tipo, setTipo] = useState<ScontoNuova['tipo']>(iniziale.tipo)
  const [valore, setValore] = useState(valoreIniziale(iniziale))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  const sconto: ScontoNuova = { tipo, valore: tipo === 'nessuno' ? null : valoreDaCampo(valore) }
  const problema = erroreSconto(righe, sconto)
  const anteprima = anteprimaSconto(righe, ricevutiCent, sconto)
  const numeri = righeAnteprima(anteprima)

  async function salva() {
    if (salvando) return
    if (problema) { setErrore(problema); return }
    if (nienteDaSalvare(righe, anteprima)) { onSalvato(anteprima, false); return }
    setSalvando(true)
    setErrore(null)
    const esito = await salvaSconto(anteprima.righe)
    setSalvando(false)
    if (esito.esito === 'errore') { setErrore(esito.messaggio); return }
    onSalvato(anteprima, true)
  }

  return (
    <Foglio titolo={TITOLO_SCONTO} onChiudi={onChiudi}>
      <FilaPastiglie>
        {TIPI_SCONTO.map(t => (
          <Pastiglia key={t.chiave} dati={`sconto-${t.chiave}`} acceso={tipo === t.chiave} onClick={() => { setTipo(t.chiave); setErrore(null) }}>{t.testo}</Pastiglia>
        ))}
      </FilaPastiglie>
      {tipo !== 'nessuno' && (
        <RigaCampo etichetta={tipo === 'percentuale' ? ETICHETTA_PER_CENTO : ETICHETTA_IN_TUTTO} ottone className="mt-2">
          <input type="number" inputMode="decimal" step="0.01" min="0" data-campo="sconto" value={valore}
            onChange={e => { setValore(e.target.value); setErrore(null) }} style={{ ...stileCampo, fontSize: 17, fontWeight: 600 }} />
        </RigaCampo>
      )}

      {/* I tre numeri, prima di salvare */}
      <div data-anteprima-sconto style={{ marginTop: 16 }}>
        {numeri.map((n, i) => (
          <div key={n.chiave} data-riga-anteprima={n.chiave} className="flex items-baseline justify-between gap-3"
            style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--color-card-border)' : undefined }}>
            <span style={{ fontSize: 14, color: n.chiave === 'resta' ? OTTONE : 'var(--color-green-dark)' }}>{n.testo}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: n.chiave === 'resta' ? OTTONE : 'var(--color-green-dark)' }}>{n.importo}</span>
          </div>
        ))}
      </div>
      {anteprima.oltre && !problema && (
        <p data-oltre-il-dovuto style={{ marginTop: 6, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>I pagamenti già registrati superano il nuovo totale.</p>
      )}
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}

      <PiedeFoglio azione={SALVA_SCONTO} onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="sconto" />
    </Foglio>
  )
}
