'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import { LARGHEZZA_FOGLIETTO_MAC } from '@/lib/calendarioFoglietto'
import { periodoConMese, testoNotti } from '@/lib/schedaPrenotazione'
import { condizioneDaColonne, formattaEuro } from '@/lib/richiesteTesti'
import { ETICHETTA_CASO, type Soluzione } from '@/lib/richiesteProposta'
import { richiesteInConflitto, erroreDiDisponibilita, conLettoExtra, type RichiestaConProposta } from '@/lib/richiesteConferma'
import { confermaRichiesta, scegliSoluzioneInviata } from '@/lib/richiesteDati'
import { applicaProvenienzaAlCliente } from '@/lib/provenienzaDati'
import { prezzo as fmtPrezzo, dalAl } from '@/lib/richiesteTesti'
import { nomeCompleto, formatDateRichiesta, nottiRichiesta, riassuntoPersone, type Richiesta } from '@/lib/richieste'

// «Creare la prenotazione?»: dal 29/09/2026 (Richieste «Maison», telefono 10)
// un FoglioMaison ad altezza fissa, 520 px; dal Mac lo stesso foglio al centro.
// Riepilogo della soluzione INVIATA, altre richieste aperte sulle stesse date
// (spuntate = rifiutate in cascata), chiamata alla sola RPC.
type Props = {
  richiesta: RichiestaConProposta
  aperte: Richiesta[]
  layout: 'desktop' | 'mobile'
  onChiudi: () => void
  onCreata: (prenotazioneId: string, avviso?: string | null) => void   // avviso: provenienza non copiata (0036)
}


export default function FinestraConferma({ richiesta, aperte, layout, onChiudi, onCreata }: Props) {
  // Pezzo 9: se il messaggio elencava più camere (caso A), Ania sceglie qui
  // quella accettata dal cliente; la scelta diventa proposta_soluzione PRIMA
  // della RPC (che legge solo quella). Nessuna preselezione se ce n'è più di una.
  const alternative: Soluzione[] = (richiesta as { proposta_alternative?: Soluzione[] | null }).proposta_alternative ?? []
  const piuCamere = alternative.length > 1
  const [scelta, setScelta] = useState<number | null>(piuCamere ? null : 0)
  const sol = piuCamere ? (scelta === null ? null : alternative[scelta]) : (richiesta.proposta_soluzione ?? null)
  const conflitti = useMemo(() => (sol ? richiesteInConflitto(sol, aperte, richiesta.id) : []), [sol, aperte, richiesta.id])
  const [spuntate, setSpuntate] = useState<Set<string>>(() => new Set(conflitti.map(c => c.id)))
  const [occupato, setOccupato] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function crea() {
    if (occupato) return          // secondo tocco: niente doppioni (e la RPC è idempotente)
    setErrore(null); setOccupato(true)
    if (piuCamere) {
      if (!sol) { setErrore('Scegli la camera accettata dal cliente.'); setOccupato(false); return }
      const scelto = await scegliSoluzioneInviata(richiesta.id, sol)
      if (scelto.error) { setErrore(`Camera non registrata: ${scelto.error}`); setOccupato(false); return }
    }
    const r = await confermaRichiesta(richiesta.id, [...spuntate])
    if (r.error || !r.prenotazioneId) { setErrore(r.error || 'Conferma non riuscita.'); setOccupato(false); return }
    // Provenienza (0037): quella provvisoria della richiesta va sul CLIENTE
    // della prenotazione creata (se lui non ne ha già una); se non riesce la
    // prenotazione resta valida e lo si dice nella scheda
    const avvisoProvenienza = 'provenienza' in richiesta ? await applicaProvenienzaAlCliente(richiesta, r.prenotazioneId) : null
    onCreata(r.prenotazioneId, avvisoProvenienza)
  }

  // «pagamento all’arrivo» · «caparra 90 €» · «pagamento completo» · «condizioni personalizzate»
  const condizione = (() => {
    const c = condizioneDaColonne(richiesta as unknown as Parameters<typeof condizioneDaColonne>[0])
    if (!c) return ''
    if (c.tipo === 'arrivo') return 'pagamento all’arrivo'
    if (c.tipo === 'caparra') return `caparra ${formattaEuro(c.caparraCentesimi)}`
    if (c.tipo === 'completo') return 'pagamento completo'
    return 'condizioni personalizzate'
  })()
  const chiudi = () => { if (!occupato) onChiudi() }
  void layout
  return (
    <FoglioMaison titolo="Creare la prenotazione?" altezza={520} larghezzaDesktop={LARGHEZZA_FOGLIETTO_MAC} dati="richiesta-conferma" onChiudi={chiudi}
      testa={
        <div className="cal-fog-testa">
          <div className="k">{nomeCompleto(richiesta)} · {periodoConMese(richiesta.arrivo, richiesta.partenza)} · Conferma</div>
          <div className="hd2"><div className="ti">Creare la prenotazione?</div></div>
        </div>
      }
      piede={
        <PiedeMaison azione="Crea prenotazione" testoSalvando="Creo…" salvando={occupato} disabilitato={!sol}
          onAzione={crea} onAnnulla={onChiudi} datiAzione={{ 'data-crea-prenotazione': '' }} />
      }>
      <div className="ric-pag ric-fog-conferma">
        <p className="so">{nomeCompleto(richiesta)} · {richiesta.persone_per_notte ? riassuntoPersone(richiesta.arrivo, richiesta.persone_per_notte) : `${richiesta.persone} ${richiesta.persone === 1 ? 'persona' : 'persone'}`}</p>
        {piuCamere && (
          <div role="group" aria-label="Camera accettata dal cliente">
            <p className="so">Il messaggio proponeva {alternative.length} camere: quale ha scelto la cliente?</p>
            <div className="ric-chips piatte" data-senza-sottolinea>
              {alternative.map((a, i) => (
                <button key={i} type="button" onClick={() => setScelta(i)} aria-pressed={scelta === i} disabled={occupato} className={scelta === i ? 'on' : ''}>
                  {a.segmenti[0]?.camera.name} · {fmtPrezzo(a.prezzoTotale)} €
                </button>
              ))}
            </div>
          </div>
        )}
        {sol ? (
          <div className="cal-fog">
            <div className="dr" data-soluzione-conferma>
              <span className="dk">Soluzione</span>
              <span className="dv">
                {[ETICHETTA_CASO[sol.caso], testoNotti(nottiRichiesta(richiesta)), `${conLettoExtra(sol) ? 'con letto aggiuntivo · ' : ''}${fmtPrezzo(sol.prezzoTotale)} €`, condizione].filter(Boolean).join(' · ')}
                {sol.segmenti.length > 1 && sol.segmenti.map((x, i) => <span key={i} className="riga-seg">{x.camera.name} {dalAl(x.arrivo, x.partenza)} · {x.notti === 1 ? '1 notte' : `${x.notti} notti`}</span>)}
              </span>
            </div>
          </div>
        ) : (
          <p className="ric-avviso">{piuCamere ? 'Scegli la camera accettata dal cliente.' : 'Nessuna proposta inviata: prima va inviata una proposta.'}</p>
        )}
        {conflitti.length > 0 && (
          <div className="sec-conflitti">
            <p className="k">Altre richieste per le stesse date · Rifiuta anche queste</p>
            {conflitti.map(c => (
              <button key={c.id} type="button" className="dr2" data-senza-sottolinea role="checkbox" aria-checked={spuntate.has(c.id)} disabled={occupato}
                onClick={() => setSpuntate(prev => { const n = new Set(prev); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n })}>
                <span aria-hidden className={`cb ${spuntate.has(c.id) ? 'on' : ''}`}>{spuntate.has(c.id) ? '✓' : ''}</span>
                {nomeCompleto(c)} · {formatDateRichiesta(c)} · {nottiRichiesta(c)} {nottiRichiesta(c) === 1 ? 'notte' : 'notti'} · {c.rooms?.name || 'qualsiasi camera'}
              </button>
            ))}
          </div>
        )}
        {errore && (
          <div role="alert" className="ric-avviso">
            {errore}
            {erroreDiDisponibilita(errore) && <> <Link href={`/richieste/${richiesta.id}/proposta`} className="mz-lnk">Prepara una nuova proposta</Link></>}
          </div>
        )}
      </div>
    </FoglioMaison>
  )
}
