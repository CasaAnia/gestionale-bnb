'use client'
import { useState } from 'react'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import { LARGHEZZA_FOGLIETTO_MAC } from '@/lib/calendarioFoglietto'
import { periodoConMese } from '@/lib/schedaPrenotazione'
import { MOTIVI_RIFIUTO_SCELTE, type MotivoRifiuto } from '@/lib/motivoRifiuto'
import { formatDateRichiesta, nomeCompleto, type Richiesta } from '@/lib/richieste'

// «Perché la rifiuti?» (07/09/2026): prima di chiudere una richiesta si sceglie
// il motivo. Dal 29/09/2026 (Richieste «Maison», telefono 11) un FoglioMaison
// ad altezza fissa, 400 px: maiuscoletto «ANNA RINALDI · 30 SET → 3 OTT ·
// RIFIUTA», il titolo, i quattro motivi come righe con la casella a filo, la
// nota dell'archivio, il tasto pieno MATTONE «Rifiuta la richiesta» (attivo
// solo dopo aver scelto un motivo) e «Annulla».
type Props = {
  richiesta: Pick<Richiesta, 'nome' | 'cognome' | 'arrivo' | 'partenza' | 'camera_id' | 'rooms'> & { notti_richieste?: string[] | null }
  occupato?: boolean
  onConferma: (motivo: MotivoRifiuto) => void
  onAnnulla: () => void
}

export default function RifiutaConMotivo({ richiesta, occupato = false, onConferma, onAnnulla }: Props) {
  const [motivo, setMotivo] = useState<MotivoRifiuto | null>(null)
  const titolo = 'Perché la rifiuti?'
  const periodo = richiesta.notti_richieste ? formatDateRichiesta(richiesta) : periodoConMese(richiesta.arrivo, richiesta.partenza)
  return (
    <FoglioMaison titolo={titolo} altezza={400} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} dati="richiesta-rifiuta" onChiudi={() => { if (!occupato) onAnnulla() }}
      testa={
        <div className="cal-fog-testa">
          <div className="k">{nomeCompleto(richiesta)} · {periodo} · Rifiuta</div>
          <div className="hd2"><div className="ti">{titolo}</div></div>
        </div>
      }
      piede={
        <PiedeMaison mattone azione="Rifiuta la richiesta" testoSalvando="Un attimo…" salvando={occupato} disabilitato={!motivo}
          onAzione={() => { if (motivo) onConferma(motivo) }} onAnnulla={onAnnulla} datiAzione={{ 'data-conferma-rifiuto': '' }} />
      }>
      <div className="ric-pag ric-camere" role="group" aria-label="Motivo" data-senza-sottolinea>
        {MOTIVI_RIFIUTO_SCELTE.map(s => {
          const attivo = motivo === s.codice
          return (
            <button key={s.codice} type="button" onClick={() => setMotivo(s.codice)} aria-pressed={attivo} disabled={occupato} data-motivo={s.codice} className="cr">
              <span aria-hidden className={`cb ${attivo ? 'on' : ''}`}>{attivo ? '✓' : ''}</span>
              <span className="cn">{s.testo}</span>
            </button>
          )
        })}
        <p className="so">La richiesta resta in archivio fra le chiuse per 3 giorni, con «Riapri».</p>
      </div>
    </FoglioMaison>
  )
}
