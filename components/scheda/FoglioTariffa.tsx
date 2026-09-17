'use client'
// ============================================================================
// «TARIFFE» (17/09/2026): il foglio della scheda nuova con la tariffa a
// notte di ogni tratto. Sotto, il totale attuale e il nuovo totale. Le
// regole stanno in lib/tariffaScheda (pure), la scrittura in lib/righeDati.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { RigaCampo, stileCampo } from '@/components/nuova/PezziNuova'
import {
  TITOLO_TARIFFE, SALVA_TARIFFE, vociTariffa, campiTariffe, anteprimaTariffe, righeAnteprimaTariffe, type RigaTariffabile, type CampiTariffa,
} from '@/lib/tariffaScheda'
import { aggiornaRigaPerRiga } from '@/lib/righeDati'

export default function FoglioTariffa({ righe, onChiudi, onIncerto, onSalvato }: {
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaTariffabile[]
  onChiudi: () => void
  /** la scrittura è riuscita solo in parte o la risposta è andata persa: la scheda rilegge */
  onIncerto: (messaggio: string) => void
  /** le righe appena scritte; `cambiato` è falso se non c'era niente da salvare */
  onSalvato: (scritte: { id: string; campi: CampiTariffa }[], cambiato: boolean) => void
}) {
  const voci = vociTariffa(righe)
  const [scritte, setScritte] = useState<Record<string, string>>(() => Object.fromEntries(voci.map(v => [v.id, v.tariffa])))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const anteprima = righeAnteprimaTariffe(anteprimaTariffe(righe, scritte))

  async function salva() {
    if (salvando) return
    const esito = campiTariffe(righe, scritte)
    if (!esito.ok) { setErrore(esito.errore); return }
    if (esito.righe.length === 0) { onSalvato([], false); return }
    setSalvando(true)
    setErrore(null)
    const scrittura = await aggiornaRigaPerRiga(esito.righe)
    setSalvando(false)
    if (scrittura.esito === 'errore') {
      // incerto = qualcosa può essere stato scritto: la scheda non si fida più di quello che mostra
      if (scrittura.incerto) { onIncerto(scrittura.messaggio); return }
      setErrore(scrittura.messaggio)
      return
    }
    onSalvato(esito.righe, true)
  }

  return (
    <Foglio titolo={TITOLO_TARIFFE} onChiudi={onChiudi}>
      {voci.map(v => (
        <RigaCampo key={v.id} etichetta={`${v.camera}, ${v.periodo} · a notte, €`} ottone>
          <input type="number" inputMode="decimal" step="0.01" min="0" data-campo={`tariffa-${v.id}`} value={scritte[v.id] ?? ''}
            onChange={e => { setScritte(s => ({ ...s, [v.id]: e.target.value })); setErrore(null) }} style={{ ...stileCampo, fontSize: 17, fontWeight: 600 }} />
        </RigaCampo>
      ))}
      <div data-anteprima-tariffe style={{ marginTop: 16 }}>
        {anteprima.map((n, i) => (
          <div key={n.chiave} data-riga-anteprima={n.chiave} className="flex items-baseline justify-between gap-3"
            style={{ padding: '8px 0', borderTop: i > 0 ? '1px solid var(--color-card-border)' : undefined }}>
            <span style={{ fontSize: 14, color: 'var(--color-green-dark)' }}>{n.testo}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{n.importo}</span>
          </div>
        ))}
      </div>
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione={SALVA_TARIFFE} onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="tariffe" />
    </Foglio>
  )
}
