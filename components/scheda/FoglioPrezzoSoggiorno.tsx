'use client'
// ============================================================================
// «IL SOGGIORNO SI ALLUNGA» / «SI ACCORCIA» (17/09/2026, rifatto il
// 18/09/2026 con le parole di Ania): il foglio che si apre quando una
// modifica del soggiorno (date, cambio camera, foglietto della notte) cambia
// le notti di una prenotazione CHE HA UNO SCONTO. Nella veste dei fogli della
// scheda, con il titolo in Georgia 24 centrato; sotto, in 12,5 stone, «da 1 a
// 3 notti · 29 nov → 2 dic»; il riquadro chiaro con «prima: 90 € − 5 € di
// sconto = 85 € per una notte»; «COME AGGIORNO IL PREZZO» con le TRE scelte
// col pallino («Tengo lo stesso sconto a notte», accesa di partenza; «Tengo
// lo stesso sconto in tutto»; «Concordo un prezzo nuovo», che apre il campo
// del totale con accanto quanto viene a notte); «IL NUOVO CONTO» nelle righe
// di sempre, «Da pagare» in Georgia 28 e
// sotto «3 notti · 85 € a notte · prezzo pieno 270 €, sconto 15 €»; in fondo
// «Conferma · 255 €» e «Torna alle modifiche».
//
// Le tre scelte si cambiano avanti e indietro e il conto si rifà a ogni tocco.
// Niente viene scritto finché non si tocca «Conferma»; «Torna alle modifiche»
// chiude solo questo foglio, e il foglio di partenza resta sotto con la bozza.
//
// Le regole e i testi stanno in lib/soggiornoSconto (pure): qui si mostra e
// si passa la scelta a chi salva. Nessuna chiamata al database.
// ============================================================================
import { useState, type ReactNode } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import { Etichetta, stileCampo, MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import { RigaConto, ScontoConto, DaPagareConto } from '@/components/ContoRighe'
import {
  primaDelCambio, dopoIlCambio, titoloConferma, sottotitoloConferma, riepilogoPrima, scelteTengo, anteprimaSoggiorno,
  DOMANDA_PREZZO, TITOLO_NUOVO_CONTO, SCELTA_NUOVO_PREZZO, ETICHETTA_TOTALE_SOGGIORNO, TORNA_ALLE_MODIFICHE,
  type RigaSoggiorno, type SceltaFoglio, type PrezzoDeciso,
} from '@/lib/soggiornoSconto'
import type { TrattoPiano } from '@/lib/strisciaNotti'

export const FONDO_PRIMA = '#F5EFE2'
export const TESTO_PRIMA = '#7A5C1E'
export const TESTO_SALVANDO = 'Salvo…'

/** Una delle due scelte: il pallino, il testo, la riga sotto e il filo */
function Scelta({ acceso, etichetta, sotto, onClick, dati, children }: { acceso: boolean; etichetta: string; sotto?: string | null; onClick: () => void; dati: string; children?: ReactNode }) {
  return (
    <div style={{ borderBottom: '1px solid var(--color-card-border)' }}>
      <button type="button" role="radio" aria-checked={acceso} data-scelta-prezzo={dati} onClick={onClick}
        className="w-full text-left flex items-start" style={{ gap: 10, padding: '9px 0', minHeight: 44 }}>
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
      {children}
    </div>
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
  const tengo = scelteTengo(segmenti, tutti, tratti)
  // la scelta accesa di partenza: a notte, se no in tutto, se no il prezzo nuovo
  const [tipo, setTipo] = useState<'a_notte' | 'in_tutto' | 'finale'>(tengo.aNotte ? 'a_notte' : tengo.inTutto ? 'in_tutto' : 'finale')
  const [totale, setTotale] = useState('')
  const dellaLinea = new Set(segmenti.map(s => s.id))
  const altreRighe = tutti.filter(r => !dellaLinea.has(r.id))
  const scelta: SceltaFoglio = tipo === 'a_notte' && tengo.aNotte ? tengo.aNotte.scelta
    : tipo === 'in_tutto' && tengo.inTutto ? tengo.inTutto.scelta
    : { tipo: 'finale', testo: totale }
  const anteprima = anteprimaSoggiorno({ tratti, altreRighe, ricevutiCent, scelta })

  function conferma() {
    if (salvando || anteprima.errore || !anteprima.scelta) return
    onConferma({ scelta: anteprima.scelta, altre: anteprima.altre, totaleCent: anteprima.totaleCent })
  }

  return (
    <Foglio titolo={titoloConferma(prima.notti, dopo.notti)} centrato onChiudi={onTorna}>
      <p data-sottotitolo-prezzo className="text-center" style={{ marginTop: -8, fontSize: 12.5, color: 'var(--color-stone)' }}>{sottotitoloConferma(prima.notti, tratti)}</p>
      <p data-prima-del-cambio className="text-center" style={{ marginTop: 14, padding: '9px 12px', borderRadius: 10, background: FONDO_PRIMA, fontSize: 12.5, color: TESTO_PRIMA }}>{riepilogoPrima(prima)}</p>

      {/* ── Come aggiorno il prezzo: le due scelte ─────────────────────── */}
      <Etichetta testo={DOMANDA_PREZZO} ottone className="mt-[22px]" />
      <div role="radiogroup" aria-label={DOMANDA_PREZZO} data-domanda-prezzo>
        {tengo.aNotte && (
          <Scelta acceso={tipo === 'a_notte'} etichetta={tengo.aNotte.etichetta} sotto={tengo.aNotte.sotto} onClick={() => setTipo('a_notte')} dati="a-notte" />
        )}
        {tengo.inTutto && (
          <Scelta acceso={tipo === 'in_tutto'} etichetta={tengo.inTutto.etichetta} sotto={tengo.inTutto.sotto} onClick={() => setTipo('in_tutto')} dati="in-tutto" />
        )}
        <Scelta acceso={tipo === 'finale'} etichetta={SCELTA_NUOVO_PREZZO} sotto={tengo.aNotte ? null : tengo.motivo} onClick={() => setTipo('finale')} dati="nuovo-prezzo">
          {tipo === 'finale' && (
            // il campo in euro col totale e, accanto in ottone, quanto viene a notte
            <label className="block" style={{ padding: '0 0 10px 28px' }}>
              <span className="block uppercase" style={{ fontSize: 9.5, letterSpacing: '1.4px', color: OTTONE }}>{ETICHETTA_TOTALE_SOGGIORNO}</span>
              <span className="flex items-baseline gap-3">
                <input type="number" inputMode="decimal" step="0.01" min="0" data-campo="totale-soggiorno" value={totale} autoFocus
                  onChange={e => setTotale(e.target.value)} style={{ ...stileCampo, fontSize: 17, fontWeight: 600 }} />
                {anteprima.aNotteCampo && <span data-a-notte-campo className="shrink-0" style={{ fontSize: 12.5, fontWeight: 600, color: OTTONE }}>{anteprima.aNotteCampo}</span>}
              </span>
            </label>
          )}
        </Scelta>
      </div>
      {anteprima.errore && tipo === 'finale' && totale.trim() !== '' && <p data-errore-prezzo style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>{anteprima.errore}</p>}

      {/* ── Il nuovo conto ─────────────────────────────────────────────── */}
      <Etichetta testo={TITOLO_NUOVO_CONTO} ottone />
      <div data-anteprima-soggiorno>
        {anteprima.righe.map(r => <RigaConto key={r.chiave} riga={r} />)}
        {anteprima.sconto && <ScontoConto sconto={anteprima.sconto} />}
        <DaPagareConto importo={anteprima.daPagare} sotto={anteprima.sotto}>
          {anteprima.incassi.map(r => (
            <div key={r.chiave} data-riga-prezzo={r.chiave} className="flex items-baseline justify-between gap-3" style={{ paddingTop: 6 }}>
              <span style={{ fontSize: 13, color: 'var(--color-stone)' }}>{r.testo}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-stone)' }}>{r.importo}</span>
            </div>
          ))}
        </DaPagareConto>
      </div>
      {anteprima.nota && <p data-nota-prezzo style={{ marginTop: 8, fontSize: 12.5, color: 'var(--color-stone)' }}>{anteprima.nota}</p>}
      {anteprima.oltre && <p data-oltre-il-totale style={{ marginTop: 8, fontSize: 12.5, fontWeight: 600, color: MATTONE }}>{anteprima.oltre}</p>}

      <PiedeFoglio azione={anteprima.pulsante} onAzione={conferma} salvando={salvando} testoSalvando={TESTO_SALVANDO}
        onAnnulla={onTorna} testoAnnulla={TORNA_ALLE_MODIFICHE} dati="prezzo-soggiorno" />
    </Foglio>
  )
}
