'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { decisioneConferma } from '@/lib/clienteTelefono'
import { cercaSchedaPerTelefono } from '@/lib/clienteTelefonoDati'
import Link from 'next/link'
import FoglioMaison, { PiedeMaison } from '@/components/maison/FoglioMaison'
import { LARGHEZZA_FOGLIETTO_MAC } from '@/lib/calendarioFoglietto'
import { periodoConMese, testoNotti } from '@/lib/schedaPrenotazione'
import { condizioneDaColonne, formattaEuro } from '@/lib/richiesteTesti'
import { ETICHETTA_CASO, type Soluzione } from '@/lib/richiesteProposta'
import { richiesteInConflitto, erroreDiDisponibilita, conLettoExtra, type RichiestaConProposta } from '@/lib/richiesteConferma'
import { confermaRichiesta, scegliSoluzioneInviata, allineaTelefonoRichiesta, rileggiTelefonoRichiesta, clienteDellaPrenotazione } from '@/lib/richiesteDati'
import { allineaConVerifica, creaSchedaConVerifica } from '@/lib/confermaPassi'
import { creaClienteNuovo } from '@/lib/cambiaClienteDati'
import type { ClienteBreve } from '@/lib/cambiaCliente'
import { nomeDaSalvare } from '@/lib/guestName'
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
  // Il cliente della prenotazione (21/10/2026, R2): la RPC cerca la scheda
  // con le stesse cifre del telefono. Prima di confermare si leggono le schede
  // con lo STESSO numero in qualunque forma e si decide (decisioneConferma):
  // con più schede sceglie Ania, una scheda scritta in un'altra forma viene
  // usata (il telefono della richiesta prende la sua forma), i casi che la
  // RPC non saprebbe distinguere fermano la conferma. Mai un doppione.
  // Dal 21/10/2026 sera (T1/T3 di Codex): il cliente NUOVO non lo crea più la
  // RPC a sole cifre (+45… diventava 4532123456, irriconoscibile): l'app crea
  // prima la scheda col «+», poi la RPC la trova per cifre. Ogni passo si
  // verifica sul valore salvato; un esito incerto ferma tutto. Prima di
  // scrivere l'archivio si rilegge: se è cambiato, si mostra e ci si ferma.
  type SchedaArchivio = { id: string; phone?: string | null; full_name?: string | null }
  type Archivio = { stato: 'carico' } | { stato: 'errore'; testo: string } | { stato: 'pronto'; schede: SchedaArchivio[]; righe: SchedaArchivio[] }
  const [archivio, setArchivio] = useState<Archivio>({ stato: 'carico' })
  const [sceltaScheda, setSceltaScheda] = useState<string | null>(null)
  // il telefono della richiesta com'è ADESSO (dopo un allineamento riuscito)
  const [telefonoRichiesta, setTelefonoRichiesta] = useState(richiesta.telefono ?? '')
  const leggiArchivio = useCallback(async (telefono: string): Promise<Archivio> => {
    try {
      const r = await cercaSchedaPerTelefono<SchedaArchivio>(telefono)
      return r.errore ? { stato: 'errore', testo: r.errore } : { stato: 'pronto', schede: r.schede, righe: r.righe }
    } catch (err) { return { stato: 'errore', testo: String((err as Error)?.message ?? err) } }
  }, [])
  useEffect(() => {
    let vivo = true
    void leggiArchivio(telefonoRichiesta).then(a => { if (vivo) setArchivio(a) })
    return () => { vivo = false }
  }, [telefonoRichiesta, leggiArchivio])
  const decidi = (a: Archivio) => (a.stato === 'pronto' ? decisioneConferma(telefonoRichiesta, a.schede, sceltaScheda, a.righe) : null)
  const decisione = decidi(archivio)
  const fermo = archivio.stato === 'carico' ? 'Controllo se il numero è già in archivio…'
    : archivio.stato === 'errore' ? `Non creo la prenotazione: non sono riuscito a controllare se il numero è già in archivio (${archivio.testo}). Riprova.`
    : decisione?.tipo === 'scegli' ? 'Questo numero è su più schede cliente: scegli quella giusta.'
    : decisione?.tipo === 'bloccata' ? decisione.motivo
    : null
  // dopo un errore a metà strada: si rilegge l'archivio, la prossima prova
  // decide su quello che è davvero salvato (scheda già creata, numero allineato)
  async function dopoErrore(testo: string) {
    setErrore(testo)
    setArchivio({ stato: 'carico' })
    setArchivio(await leggiArchivio(telefonoRichiesta))
    setOccupato(false)
  }

  async function crea() {
    if (occupato) return          // secondo tocco: niente doppioni (e la RPC è idempotente)
    if (fermo || !decisione) { setErrore(fermo ?? 'Controllo del numero non pronto.'); return }
    setErrore(null); setOccupato(true)
    // l'archivio è ancora quello mostrato? (una scheda nata nel frattempo cambia la decisione)
    const ora = await leggiArchivio(telefonoRichiesta)
    const adesso = decidi(ora)
    const firma = (d: typeof decisione) => JSON.stringify(d && { t: d.tipo, s: 'scheda' in d ? d.scheda?.id ?? null : null, tel: 'telefono' in d ? d.telefono : null })
    if (!adesso || firma(adesso) !== firma(decisione)) {
      setArchivio(ora)
      setErrore(ora.stato === 'errore' ? `Non creo la prenotazione: ${ora.testo}` : 'Nel frattempo l’archivio dei clienti è cambiato: controlla qui sopra e conferma di nuovo.')
      setOccupato(false)
      return
    }
    let attesa: string | null = decisione.tipo === 'libera' || decisione.tipo === 'allinea' ? decisione.scheda?.id ?? null : null
    if (decisione.tipo === 'nuova') {
      const creata = await creaSchedaConVerifica<ClienteBreve>({
        crea: () => creaClienteNuovo({ full_name: nomeDaSalvare({ nome: richiesta.nome, cognome: richiesta.cognome }) || null, phone: decisione.telefono } as never, []),
        cerca: () => cercaSchedaPerTelefono<ClienteBreve>(decisione.telefono),
      })
      if (creata.esito !== 'ok') { await dopoErrore(`Prenotazione non creata: ${creata.testo}.`); return }
      attesa = creata.valore.id
    }
    // la RPC cerca per cifre: se quelle della richiesta («345 600 0001») non
    // sono quelle della scheda («+393456000001»), la richiesta prende la forma della scheda
    const allineaA = decisione.tipo === 'allinea' ? decisione.telefono
      : decisione.tipo === 'nuova' && decisione.telefono.replace(/\D/g, '') !== telefonoRichiesta.replace(/\D/g, '') ? decisione.telefono : null
    if (allineaA) {
      const allineato = await allineaConVerifica({
        telefono: allineaA,
        scrivi: () => allineaTelefonoRichiesta(richiesta.id, allineaA),
        rileggi: () => rileggiTelefonoRichiesta(richiesta.id),
      })
      if (allineato.esito !== 'ok') { await dopoErrore(`Prenotazione non creata: ${allineato.testo}.`); return }
      setTelefonoRichiesta(allineaA)
    }
    if (piuCamere) {
      if (!sol) { setErrore('Scegli la camera accettata dal cliente.'); setOccupato(false); return }
      const scelto = await scegliSoluzioneInviata(richiesta.id, sol)
      if (scelto.error) { await dopoErrore(`Camera non registrata: ${scelto.error}`); return }
    }
    const r = await confermaRichiesta(richiesta.id, [...spuntate])
    if (r.error || !r.prenotazioneId) { await dopoErrore(r.error || 'Conferma non riuscita.'); return }
    // la prenotazione è sulla scheda attesa? (rilettura, nessuna scrittura)
    let avvisoCliente: string | null = null
    if (attesa) {
      const letto = await clienteDellaPrenotazione(r.prenotazioneId)
      if (letto.error) avvisoCliente = `Prenotazione creata, ma non sono riuscito a rileggere a quale scheda cliente è andata: ${letto.error}`
      else if (letto.guestId !== attesa) avvisoCliente = 'Prenotazione creata, ma su una scheda cliente diversa da quella col numero: controlla il cliente nella scheda.'
    }
    // Provenienza (0037): quella provvisoria della richiesta va sul CLIENTE
    // della prenotazione creata (se lui non ne ha già una); se non riesce la
    // prenotazione resta valida e lo si dice nella scheda
    const avvisoProvenienza = 'provenienza' in richiesta ? await applicaProvenienzaAlCliente(richiesta, r.prenotazioneId) : null
    onCreata(r.prenotazioneId, [avvisoCliente, avvisoProvenienza].filter(Boolean).join(' · ') || null)
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
        <PiedeMaison azione="Crea prenotazione" testoSalvando="Creo…" salvando={occupato} disabilitato={!sol || !!fermo}
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
        {decisione?.tipo === 'scegli' && (
          <div role="group" aria-label="Scheda del cliente" data-scegli-scheda>
            <p className="so">Questo numero è su {decisione.schede.length} schede cliente: su quale va la prenotazione?</p>
            <div className="ric-chips piatte" data-senza-sottolinea>
              {decisione.schede.map(g => (
                <button key={g.id} type="button" disabled={occupato} aria-pressed={sceltaScheda === g.id} className={sceltaScheda === g.id ? 'on' : ''}
                  data-scheda-conferma={g.id} onClick={() => setSceltaScheda(g.id)}>{(g.full_name || '').trim() || 'senza nome'} · {g.phone}</button>
              ))}
            </div>
          </div>
        )}
        {sceltaScheda && decisione && decisione.tipo !== 'scegli' && (
          <p className="so"><button type="button" className="mz-lnk q" disabled={occupato} onClick={() => setSceltaScheda(null)}>scegli un’altra scheda</button></p>
        )}
        {decisione?.tipo === 'nuova' && (
          <p className="so" data-scheda-nuova>Cliente nuovo: la scheda nasce col numero {decisione.telefono}.</p>
        )}
        {decisione?.tipo === 'allinea' && (
          <p className="so" data-va-sulla-scheda>Va sulla scheda di {(decisione.scheda.full_name || '').trim() || 'senza nome'}: stesso numero, salvato come {decisione.telefono}.</p>
        )}
        {fermo && archivio.stato !== 'carico' && <p className="ric-avviso" role="alert" data-avviso-doppione>{fermo}</p>}
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
