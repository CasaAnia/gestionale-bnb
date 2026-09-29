'use client'
// ============================================================================
// IL FOGLIETTO DI UNA RICHIESTA (Richieste «Maison», novità 14b del
// 29/09/2026): sale dal basso toccando una scheda tratteggiata sul nastro, al
// posto del vecchio pannello. FoglioMaison ad ALTEZZA FISSA (380 px): in
// cima «RICHIESTA · DAL SITO · OGGI 08:41», il nome con 🧾 ★ davanti e i due
// cerchi (cornetta e WhatsApp); le sette righe TELEFONO · DATE · PERSONE ·
// CAMERA · STATO · NOTA · CLIENTE (lib/richiesteFoglietto); in fondo
// «Invia proposta» (o «Conferma») · «Modifica» · «Rifiuta» · «Chiudi».
// Con più richieste sovrapposte le mostra una sotto l'altra: stessa altezza,
// si scorre dentro.
//
// Ritocchi del 29/09/2026 (A4, come il foglietto del Calendario): il numero
// per esteso sotto il nome coi cerchi a destra, e la riga TELEFONO non c'è
// più (Ania: così non è ripetuto); in fondo «Modifica · Rifiuta» sottolineati
// e sotto, affiancati a metà larghezza, «Invia proposta» / «Conferma» pieno e
// «Chiudi» a filo (components/calendario/PezziFoglietto).
// ============================================================================
import type { ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import FoglioMaison from '@/components/maison/FoglioMaison'
import { TelefonoFoglietto, TastiFoglietto } from '@/components/calendario/PezziFoglietto'
import { LARGHEZZA_FOGLIETTO_MAC } from '@/lib/calendarioFoglietto'
import { iconeFoglietto } from '@/lib/calendarioFoglietto'
import { nomeCompleto, type Richiesta } from '@/lib/richieste'
import { testaFogliettoRichiesta, righeFogliettoRichiesta, azioniFogliettoRichiesta, ALTEZZA_FOGLIETTO_RICHIESTA } from '@/lib/richiesteFoglietto'

export type DatiCliente = { volte: number; inArchivio: boolean; stella: boolean; ricevuta: boolean; totaleCent: number }

export default function FogliettoRichiesta({ gruppo, adesso, libere, cliente, onChiudi, onConferma, onRifiuta }: {
  gruppo: Richiesta[]
  adesso: Date
  /** le camere libere per tutte le notti di una richiesta «qualsiasi» */
  libere: (r: Richiesta) => string[]
  /** quello che si sa della cliente (lo stesso dell'elenco) */
  cliente: (r: Richiesta) => DatiCliente
  onChiudi: () => void
  onConferma: (r: Richiesta) => void
  onRifiuta: (r: Richiesta) => void
}) {
  const router = useRouter()
  const piu = gruppo.length > 1

  const testa = (r: Richiesta): ReactNode => {
    const c = cliente(r)
    const nome = nomeCompleto(r)
    const icone = iconeFoglietto(c.ricevuta, c.stella)
    return (
      <div className="cal-fog-testa" data-testa-foglietto-richiesta={r.id}>
        <div className="k">{testaFogliettoRichiesta(r, adesso)}</div>
        <div className="hd2">
          <div className="ti">{icone && <span className="ic">{icone} </span>}{nome}</div>
        </div>
        <TelefonoFoglietto telefono={r.telefono} nome={nome} dati="foglietto-richiesta" />
      </div>
    )
  }
  const righe = (r: Richiesta) => {
    const c = cliente(r)
    return (
      <div className="cal-fog" data-foglietto-richiesta={r.id}>
        {righeFogliettoRichiesta(r, { libere: libere(r), volte: c.volte, inArchivio: c.inArchivio, spesoCent: c.totaleCent }, adesso).map(x => (
          <div key={x.etichetta} className="dr" data-riga-foglietto={x.etichetta}>
            <span className="dk">{x.etichetta}</span>
            <span className="dv"><span className={x.tipo === 'numero' ? 'num' : x.tipo === 'mat' ? 'mat' : undefined}>{x.valore}</span></span>
          </div>
        ))}
      </div>
    )
  }
  const azioni = (r: Richiesta, conChiudi: boolean) => {
    const tutte = azioniFogliettoRichiesta(r)
    const piena = tutte.find(a => a.azione === 'proposta' || a.azione === 'conferma')
    const altre = tutte.filter(a => a !== piena)
    const fai = (azione: string) => {
      if (azione === 'proposta') router.push(`/richieste/${r.id}/proposta`)
      else if (azione === 'conferma') onConferma(r)
      else if (azione === 'modifica') router.push(`/richieste/${r.id}/modifica`)
      else onRifiuta(r)
    }
    return (
      <div data-azioni-foglietto-richiesta>
        <TastiFoglietto
          sopra={altre.length > 0 ? altre.map((a, i) => (
            <span key={a.azione}>
              {i > 0 && <span className="sep" aria-hidden> · </span>}
              <button type="button" data-azione={a.azione} className={a.azione === 'rifiuta' ? 'mz-lnk q mat' : 'mz-lnk q'} onClick={() => fai(a.azione)}>{a.testo}</button>
            </span>
          )) : undefined}
          azione={piena?.testo} onAzione={piena ? () => fai(piena.azione) : undefined} datiAzione={piena ? { 'data-azione': piena.azione } : undefined}
          onChiudi={conChiudi ? onChiudi : undefined} />
      </div>
    )
  }

  if (!piu) {
    const r = gruppo[0]
    return (
      <FoglioMaison titolo={nomeCompleto(r)} testa={testa(r)} altezza={ALTEZZA_FOGLIETTO_RICHIESTA} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC}
        veloChiaro onChiudi={onChiudi} dati="foglietto-richiesta">
        {righe(r)}
        {azioni(r, true)}
      </FoglioMaison>
    )
  }
  // Più richieste sovrapposte: una sotto l'altra, si scorre dentro il foglio
  return (
    <FoglioMaison titolo={`${gruppo.length} richieste`} testa={<span />} altezza={ALTEZZA_FOGLIETTO_RICHIESTA} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC}
      veloChiaro onChiudi={onChiudi} dati="foglietto-richiesta">
      {gruppo.map(r => (
        <section key={r.id} className="ric-fog-blocco">
          {testa(r)}
          {righe(r)}
          {azioni(r, false)}
        </section>
      ))}
      <TastiFoglietto onChiudi={onChiudi} />
    </FoglioMaison>
  )
}
