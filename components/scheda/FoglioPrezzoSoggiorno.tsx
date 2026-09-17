'use client'
// ============================================================================
// «IL SOGGIORNO SI ALLUNGA» (17/09/2026): il foglio di conferma che si apre
// quando una modifica del soggiorno (date, cambio camera, foglietto della
// notte) cambia notti o prezzo pieno di una prenotazione col PREZZO FINALE
// concordato. Si vede il nuovo conto e si sceglie come aggiornare il prezzo:
// «Mantieni 5 € di sconto a notte» oppure «Concorda un nuovo prezzo» (il
// totale dell'intero soggiorno). Niente viene scritto finché non si tocca
// «Conferma soggiorno»; «Torna alle modifiche» chiude solo questo foglio, e
// il foglio di partenza resta sotto con la sua bozza.
//
// Le regole e i testi stanno in lib/soggiornoSconto (pure): qui si mostra e
// si passa la scelta a chi salva. Nessuna chiamata al database.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import { RigaCampo, stileCampo, MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import {
  primaDelCambio, dopoIlCambio, titoloConferma, sottotitoloConferma, riepilogoPrima, opzionePerNotte, anteprimaSoggiorno,
  DOMANDA_PREZZO, SCELTA_NUOVO_PREZZO, ETICHETTA_TOTALE_SOGGIORNO, TORNA_ALLE_MODIFICHE,
  type RigaSoggiorno, type SceltaFoglio, type PrezzoDeciso,
} from '@/lib/soggiornoSconto'
import type { TrattoPiano } from '@/lib/strisciaNotti'

const GEORGIA = "Georgia, 'Times New Roman', serif"
const FILO_OTTONE = 'rgba(169,136,78,0.55)'
export const TESTO_SALVANDO = 'Salvo…'

/** Una delle due scelte: il pallino, il testo e la riga sotto */
function Scelta({ acceso, etichetta, sotto, onClick, dati }: { acceso: boolean; etichetta: string; sotto?: string | null; onClick: () => void; dati: string }) {
  return (
    <button type="button" role="radio" aria-checked={acceso} data-scelta-prezzo={dati} onClick={onClick}
      className="w-full text-left flex items-start" style={{ gap: 10, padding: '9px 0', borderBottom: '1px solid var(--color-card-border)', minHeight: 44 }}>
      <span aria-hidden className="shrink-0" style={{
        width: 18, height: 18, borderRadius: 999, marginTop: 1, boxSizing: 'border-box',
        border: `1.5px solid ${acceso ? 'var(--color-green-mid)' : OTTONE}`, background: acceso ? 'var(--color-green-mid)' : 'transparent',
        boxShadow: acceso ? 'inset 0 0 0 3px var(--color-cream)' : 'none',
      }} />
      <span className="min-w-0">
        <span className="block" style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{etichetta}</span>
        {sotto && <span className="block" style={{ marginTop: 2, fontSize: 12.5, color: 'var(--color-stone)' }}>{sotto}</span>}
      </span>
    </button>
  )
}

export default function FoglioPrezzoSoggiorno({ segmenti, tutti, tratti, ricevutiCent, salvando, onConferma, onTorna }: {
  /** i tratti della linea che si sta modificando, com'è salvata adesso */
  segmenti: RigaSoggiorno[]
  /** tutte le camere della prenotazione (annullate comprese): le altre linee entrano nel nuovo totale */
  tutti: RigaSoggiorno[]
  /** i tratti del piano SENZA sconto: il soggiorno com'è dopo la modifica */
  tratti: TrattoPiano[]
  ricevutiCent: number
  salvando: boolean
  onConferma: (prezzo: PrezzoDeciso) => void
  onTorna: () => void
}) {
  const prima = primaDelCambio(segmenti)
  const dopo = dopoIlCambio(tratti)
  const perNotte = opzionePerNotte(segmenti, tutti, tratti)
  const [tipo, setTipo] = useState<SceltaFoglio['tipo']>(perNotte.opzione ? 'per_notte' : 'finale')
  const [totale, setTotale] = useState('')
  const dellaLinea = new Set(segmenti.map(s => s.id))
  const altreRighe = tutti.filter(r => !dellaLinea.has(r.id))
  const scelta: SceltaFoglio = tipo === 'per_notte' && perNotte.opzione ? { tipo: 'per_notte', centANotte: perNotte.opzione.centANotte } : { tipo: 'finale', testo: totale }
  const anteprima = anteprimaSoggiorno({ tratti, altreRighe, ricevutiCent, scelta })

  function conferma() {
    if (salvando || anteprima.errore || !anteprima.scelta) return
    onConferma({ scelta: anteprima.scelta, altre: anteprima.altre, totaleCent: anteprima.totaleCent })
  }

  const riga = (r: { chiave: string; testo: string; importo: string }, colore = 'var(--color-green-dark)', peso = 400, primo = false) => (
    <div key={r.chiave} data-riga-prezzo={r.chiave} className="flex items-baseline justify-between gap-3" style={{ padding: '7px 0', borderTop: primo ? undefined : '1px solid var(--color-card-border)' }}>
      <span className="min-w-0" style={{ fontSize: 14, fontWeight: peso, color: colore }}>{r.testo}</span>
      <span className="shrink-0" style={{ fontSize: 14, fontWeight: 600, color: colore }}>{r.importo}</span>
    </div>
  )

  return (
    <Foglio titolo={titoloConferma(prima.notti, dopo.notti)} onChiudi={onTorna}>
      <p data-sottotitolo-prezzo style={{ marginTop: -6, fontSize: 12.5, fontWeight: 600, color: OTTONE }}>{sottotitoloConferma(prima.notti, tratti)}</p>
      <p data-prima-del-cambio style={{ marginTop: 6, fontSize: 13, color: 'var(--color-stone)' }}>{riepilogoPrima(prima)}</p>

      {/* ── La domanda e le due scelte ─────────────────────────────────── */}
      <p data-domanda-prezzo className="uppercase" style={{ marginTop: 18, marginBottom: 4, fontSize: 9.5, letterSpacing: '1.4px', color: OTTONE }}>{DOMANDA_PREZZO}</p>
      <div role="radiogroup" aria-label={DOMANDA_PREZZO}>
        {perNotte.opzione && (
          <Scelta acceso={tipo === 'per_notte'} etichetta={perNotte.opzione.etichetta} sotto={perNotte.opzione.sotto} onClick={() => setTipo('per_notte')} dati="per-notte" />
        )}
        <Scelta acceso={tipo === 'finale'} etichetta={SCELTA_NUOVO_PREZZO} sotto={perNotte.opzione ? null : perNotte.motivo} onClick={() => setTipo('finale')} dati="nuovo-prezzo" />
      </div>
      {tipo === 'finale' && (
        <RigaCampo etichetta={ETICHETTA_TOTALE_SOGGIORNO} ottone className="mt-2">
          <input type="number" inputMode="decimal" step="0.01" min="0" data-campo="totale-soggiorno" value={totale} autoFocus
            onChange={e => setTotale(e.target.value)} style={{ ...stileCampo, fontSize: 17, fontWeight: 600 }} />
        </RigaCampo>
      )}

      {/* ── Il nuovo conto ─────────────────────────────────────────────── */}
      <div data-anteprima-soggiorno style={{ marginTop: 16 }}>
        {anteprima.righe.map((r, i) => riga(r, 'var(--color-green-dark)', 400, i === 0))}
        {riga(anteprima.pieno, 'var(--color-green-dark)', 600, anteprima.righe.length === 0)}
        {anteprima.sconto && riga(anteprima.sconto, OTTONE)}
        <div data-riga-prezzo="totale" className="flex items-baseline justify-between gap-3" style={{ borderTop: `1px solid ${FILO_OTTONE}`, paddingTop: 8, marginTop: 2 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-green-dark)' }}>{anteprima.totale.testo}</span>
          <span style={{ fontFamily: GEORGIA, fontSize: 24, color: 'var(--color-green-dark)' }}>{anteprima.totale.importo}</span>
        </div>
        {anteprima.sotto.map(r => riga(r, 'var(--color-stone)'))}
      </div>
      {anteprima.nota && <p data-nota-prezzo style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-stone)' }}>{anteprima.nota}</p>}
      {anteprima.oltre && <p data-oltre-il-totale style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>{anteprima.oltre}</p>}
      {anteprima.errore && tipo === 'finale' && totale.trim() !== '' && <p data-errore-prezzo style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>{anteprima.errore}</p>}

      <PiedeFoglio azione={anteprima.pulsante} onAzione={conferma} salvando={salvando} testoSalvando={TESTO_SALVANDO}
        onAnnulla={onTorna} testoAnnulla={TORNA_ALLE_MODIFICHE} dati="prezzo-soggiorno" />
    </Foglio>
  )
}
