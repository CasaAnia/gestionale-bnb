'use client'
// ============================================================================
// «TOGLI CAMERA» (17/09/2026): il foglio di conferma, dalla riga sotto la
// striscia. Dice quale camera e quali notti, e che i pagamenti restano.
// Pastiglia in mattone perché si toglie qualcosa; «Annulla» chiude e basta.
// Le righe della linea si annullano in una richiesta sola (lib/righeDati).
// ============================================================================
import { useRef, useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { OTTONE } from '@/components/nuova/PezziNuova'
import { TITOLO_TOGLI_CAMERA, TOGLI_LA_CAMERA, NOTA_PAGAMENTI, domandaTogliCamera, campiTogliCamera } from '@/lib/togliCamera'
import { aggiornaInUnColpo } from '@/lib/righeDati'

export default function FoglioTogliCamera({ titolo, ids, onChiudi, onIncerto, onTolta }: {
  /** «Allegra · 29 → 30 nov» */
  titolo: string
  /** le righe della linea da annullare */
  ids: string[]
  onChiudi: () => void
  onIncerto: (messaggio: string) => void
  onTolta: (ids: string[], campi: ReturnType<typeof campiTogliCamera>) => void
}) {
  const [togliendo, setTogliendo] = useState(false)
  const inCorso = useRef(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function togli() {
    if (togliendo || inCorso.current) return
    inCorso.current = true
    setTogliendo(true)
    setErrore(null)
    const campi = campiTogliCamera(new Date().toISOString())
    const esito = await aggiornaInUnColpo(ids, campi)
    setTogliendo(false)
    if (esito.esito === 'errore') {
      inCorso.current = false
      if (esito.incerto) { onIncerto(esito.messaggio); return }
      setErrore(esito.messaggio)
      return
    }
    onTolta(ids, campi)
  }

  return (
    <Foglio titolo={TITOLO_TOGLI_CAMERA} onChiudi={onChiudi}>
      <p data-domanda-togli-camera style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-green-dark)' }}>{domandaTogliCamera(titolo)}</p>
      <p style={{ marginTop: 8, fontSize: 12.5, color: OTTONE }}>{NOTA_PAGAMENTI}</p>
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione={TOGLI_LA_CAMERA} onAzione={togli} salvando={togliendo} testoSalvando="Tolgo…" onAnnulla={onChiudi} mattone dati="togli-camera" />
    </Foglio>
  )
}
