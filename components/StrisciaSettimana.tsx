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
// striscia si apre il riquadro con le camere da preparare, il perché e, se
// c'è l'orario, «Prossimo arrivo: 16:00». Il nome della camera apre
// /pulizie?giorno=…, come faceva prima la casella.
import { useState } from 'react'
import Link from 'next/link'
import {
  etichettaGiornoBreve, testoCasella, simboliCambi, testaRiquadro, PROSSIMO_ARRIVO_RIQUADRO, CHIUDI_RIQUADRO,
  type GiornoStriscia,
} from '@/lib/numeriOggi'

export const DIDASCALIA_STRISCIA = 'Camere da preparare nei prossimi 7 giorni'

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
  return (
    <div className="mz-wkin" data-riquadro-giorno={g.giorno}>
      <div className="hd">
        <span className="sm" data-testa-riquadro>{testaRiquadro(camere.length, g.cambi)}</span>
        <button type="button" className="mz-lnk q" onClick={onChiudi}>{CHIUDI_RIQUADRO}</button>
      </div>
      {camere.map(c => (
        <div key={c.roomId} className="r" data-camera-riquadro={c.camera} data-motivo={c.motivo}>
          <Link href={`/pulizie?giorno=${g.giorno}`} className="nm">
            {c.camera} <small className={c.motivo === 'cambio' ? 'cambio' : ''}>{c.motivo === 'cambio' ? c.testoMotivo : `· ${c.testoMotivo}`}</small>
          </Link>
          {c.chiVaDove && <p className="de">{c.chiVaDove}</p>}
          {c.arrivo && <p className="de" data-prossimo-arrivo>{PROSSIMO_ARRIVO_RIQUADRO} <b>{c.arrivo}</b></p>}
        </div>
      ))}
    </div>
  )
}
