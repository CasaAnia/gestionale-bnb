'use client'
// Striscia della settimana (07/09/2026; veste «Maison» del 28/09/2026): 28
// caselle da oggi che scorrono di lato col dito (7 visibili sul telefono, 14
// sul Mac). In ogni casella il giorno in alto («Oggi», «mar 29»), sotto il
// numero di camere con pulizie ancora da fare quel giorno; «✓» attenuato se
// sono tutte fatte, «—» attenuato se non c'è nulla; divisorio ottone fra una
// settimana e l'altra. Le frecce ⇄ dei cambi camera: la prima SOTTO il
// numero, la seconda SOPRA solo con due cambi (al centro dal terzo).
//
// Un tocco su un giorno NON porta più a Pulizie (novità del 28/09/2026): il
// giorno si segna col filo d'ottone sotto (nessuno sfondo) e SOTTO la
// striscia si apre il riquadro con le camere da preparare. Dal 02/10/2026
// (pulizie-domani-riferimento.html, colonna 3) il riquadro dice chi parte e
// chi arriva, con gli orari, e «Vedi nelle Pulizie ›» apre /pulizie?giorno=…
// su quel giorno; anche il nome della camera porta lì, come prima.
import { useState } from 'react'
import Link from 'next/link'
import {
  etichettaGiornoBreve, testoCasella, simboliCambi, testaRiquadro, CHIUDI_RIQUADRO, VEDI_NELLE_PULIZIE, ORARIO_DA_CHIEDERE,
  type GiornoStriscia, type CameraDaPreparare,
} from '@/lib/numeriOggi'

export const DIDASCALIA_STRISCIA = 'Camere da preparare nei prossimi 7 giorni · tocca un giorno per vedere chi parte e chi arriva'

export default function StrisciaSettimana({ giorni }: { giorni: GiornoStriscia[] }) {
  const [scelto, setScelto] = useState<string | null>(null)
  const giorno = giorni.find(g => g.giorno === scelto) ?? null
  return (
    <section aria-label={DIDASCALIA_STRISCIA} data-striscia-settimana>
      <div className="mz-wk">
        {giorni.map(g => {
          const c = testoCasella(g)
          const s = simboliCambi(g.cambi)
          return (
            <button key={g.giorno} type="button" data-giorno={g.giorno} data-camere={g.daFare} data-fatte={g.fatte} data-tono={c.tono}
              aria-pressed={scelto === g.giorno} onClick={() => setScelto(x => (x === g.giorno ? null : g.giorno))}
              className={`${g.oggi ? 'oggi' : ''} ${g.inizioSettimana ? 'sw' : ''} ${scelto === g.giorno ? 'scelto' : ''}`}>
              {g.oggi ? 'Oggi' : etichettaGiornoBreve(g.giorno)}
              <i aria-hidden data-cambi-sopra={s.sopra ? 1 : 0}>{s.sopra ? '⇄' : ''}</i>
              <b className={c.tono === 'numero' ? '' : 'q'} data-cambi={g.cambi} style={{ position: 'relative' }}>
                {c.testo}
                {s.centro && <span aria-hidden style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--m-acc)', fontSize: 11, fontFamily: 'var(--m-ui)', fontWeight: 600 }}>⇄</span>}
              </b>
              <i aria-hidden data-cambi-sotto={s.sotto ? 1 : 0}>{s.sotto ? '⇄' : ''}</i>
            </button>
          )
        })}
      </div>
      {/* Come nel riferimento: con il riquadro aperto la didascalia lascia il posto al riquadro */}
      {giorno ? <RiquadroGiorno g={giorno} onChiudi={() => setScelto(null)} /> : <p className="mz-cap">{DIDASCALIA_STRISCIA}</p>}
    </section>
  )
}

function RiquadroGiorno({ g, onChiudi }: { g: GiornoStriscia; onChiudi: () => void }) {
  const camere = g.camere ?? []
  const pulizie = `/pulizie?giorno=${g.giorno}`
  return (
    <div className="mz-wkin" data-riquadro-giorno={g.giorno}>
      <div className="hd">
        <span className="ey" data-testa-riquadro>{testaRiquadro(g.giorno, g.oggi, camere.length)}</span>
        <button type="button" className="mz-lnk q" onClick={onChiudi}>{CHIUDI_RIQUADRO}</button>
      </div>
      {camere.map(c => (
        <div key={c.roomId} className="r" data-camera-riquadro={c.camera} data-motivo={c.motivo}>
          <Link href={pulizie} className="nm">{c.camera}</Link>
          <p className="de"><CosaSuccede c={c} /></p>
        </div>
      ))}
      <Link href={pulizie} className="mz-lnk vedi" data-vedi-pulizie>{VEDI_NELLE_PULIZIE}</Link>
    </div>
  )
}

function CosaSuccede({ c }: { c: CameraDaPreparare }) {
  const seconda = [
    c.bagagli && <span key="b">bagagli {c.bagagli.cognome} <em className="a">{c.bagagli.ora}</em></span>,
    c.arriva && <span key="a">arriva {c.arriva.nome}{c.arriva.ora && <> <em className="a">{c.arriva.ora}</em></>}</span>,
  ].filter(Boolean)
  return <>
    {c.parte && (c.parte.ora ? <span data-parte>parte {c.parte.nome} <em>{c.parte.ora}</em></span> : <span data-parte>parte {c.parte.nome} · {ORARIO_DA_CHIEDERE}</span>)}
    {c.resta && <span data-resta>{c.resta}</span>}
    {c.passa && <span data-passa>{c.passa}</span>}
    {c.rimasta && <span data-rimasta>{c.rimasta}</span>}
    {seconda.length > 0 && <><br /><span data-arrivo>{seconda.flatMap((x, i) => (i ? [' · ', x] : [x]))}</span></>}
  </>
}
