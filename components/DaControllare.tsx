'use client'
// «Da controllare» in Home (versione B, 06/09/2026; veste «Maison» del
// 28/09/2026): l'intestazione «Da controllare · N cose · conteggi per tipo»
// (la striscia col titolo grande di prima si fonde qui), poi le ECCEZIONI
// ordinate per urgenza. Ogni voce: il tipo in ottone, il titolo in
// Cormorant, il perché in grigio, UN'azione sottolineata che porta al punto
// esatto; nelle richieste anche «Rimanda» (memoria lato server). Le voci
// spariscono da sole quando il problema si risolve nella sua sezione.
// Le pulizie NON compaiono qui (Ania, 11/09/2026): stanno in «Pulizie di
// oggi». Gli arrivi hanno il loro blocco; le richieste stanno in cima, nel
// riepilogo che si apre (`richieste`). Zero eccezioni = niente sezione.
// Lettura fallita = «Non riesco a controllare, riprova» + Riprova, mai un
// «tutto a posto» finto.
import { useEffect, useState } from 'react'
import NotaCliente from './richieste/NotaCliente'
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import { useDaControllare } from '@/lib/daControllareDati'
import { openWhatsApp } from '@/lib/whatsapp'
import { ETICHETTA_TIPO, PAROLA_NAVETTA, hrefDestinazione, rigaAPosto, rigaConteggi, type Eccezione } from '@/lib/daControllare'
import { ETICHETTA_CHIEDI_ORARIO, ETICHETTA_APRI_CHAT } from './BottoniWhatsApp'

export const ID_SEZIONE = 'da-controllare'

/** «2 cose» */
export const quanteCose = (n: number) => (n === 1 ? '1 cosa' : `${n} cose`)

export default function DaControllare({ dati, richieste = false }: { dati: ReturnType<typeof useDaControllare>; richieste?: boolean }) {
  const dc = dati
  // Avviso vicino alla voce (Rimanda non riuscito o non disponibile)
  const [avvisi, setAvvisi] = useState<Record<string, string>>({})
  const [rimandando, setRimandando] = useState<string | null>(null)
  // Dalle Statistiche («N pagamenti da controllare») si arriva con #da-controllare
  const pronto = dc.stato === 'pronto'
  useEffect(() => {
    if (!pronto || typeof window === 'undefined' || window.location.hash !== `#${richieste ? 'richieste-home' : ID_SEZIONE}`) return
    document.getElementById(richieste ? 'richieste-home' : ID_SEZIONE)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [pronto, richieste])

  async function rimanda(e: Eccezione) {
    if (rimandando) return
    setRimandando(e.chiave)
    setAvvisi(a => { const { [e.chiave]: _via, ...resto } = a; void _via; return resto })
    const msg = await dc.rimanda(e.chiave)
    setRimandando(null)
    if (msg) setAvvisi(a => ({ ...a, [e.chiave]: msg }))
  }

  // In cima alla Home: durante il controllo non si occupa spazio; con zero
  // eccezioni la Home resta com'è
  if (dc.stato === 'caricamento') return null
  if (dc.stato === 'errore') {
    return <AvvisoAzione testo={dc.errore} onRiprova={dc.ricarica} className={richieste ? 'my-2' : 'mx-[var(--home-gutter)] mt-3'} />
  }
  // Gli arrivi hanno già il loro blocco operativo sopra: esclusi anche dai conteggi.
  const eccezioni = dc.eccezioni.filter(e => richieste ? e.tipo === 'richiesta' : e.tipo !== 'arrivo' && e.tipo !== 'richiesta')
  if (eccezioni.length === 0) return null
  const aPosto = richieste ? null : rigaAPosto(eccezioni, ['arrivo', 'richiesta'])

  const voci = eccezioni.map(e => (
    <div key={e.chiave} data-urgenza={e.urgenza} className={richieste ? 'it' : 'mz-dc'}>
      <p className="mz-eyebrow" style={{ fontSize: 8.5 }}>{ETICHETTA_TIPO[e.tipo]}</p>
      <p className={richieste ? 'nm' : 'ti'}>{e.titolo}</p>
      <p className={richieste ? 'sm' : 'mo'}>
        {e.motivo}
        {/* Navetta confermata senza orario (06/09/2026): la parola in ottone */}
        {e.navetta && <> · <span data-navetta style={{ color: 'var(--m-acc)', fontWeight: 500 }}>{PAROLA_NAVETTA}</span></>}
      </p>
      {/* Nota del cliente nella richiesta (Ania, 07/09/2026): sotto il motivo */}
      <NotaCliente note={e.nota} piccola maison className="mt-1" />
      <div className="azioni" data-bottoni style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', minHeight: 30, marginTop: richieste ? 7 : 0 }}>
        {e.whatsapp?.principale && <button type="button" className="mz-lnk" data-whatsapp="chiedi-orario" onClick={() => openWhatsApp(e.whatsapp!.numero, e.whatsapp!.testo)}>{ETICHETTA_CHIEDI_ORARIO}</button>}
        <Link href={hrefDestinazione(e.destinazione)} className={e.whatsapp?.principale ? 'mz-lnk q' : 'mz-lnk'}>{e.bottone}</Link>
        {(e.whatsappChat || (e.whatsapp && !e.whatsapp.principale)) && (() => {
          const w = e.whatsappChat ?? e.whatsapp!
          return <button type="button" className="mz-lnk q" data-whatsapp="apri-chat" onClick={() => openWhatsApp(w.numero, '')}>{ETICHETTA_APRI_CHAT}</button>
        })()}
        {e.rimandabile && (
          <button type="button" onClick={() => rimanda(e)} disabled={rimandando === e.chiave} className="mz-lnk q">
            {rimandando === e.chiave ? 'Rimando…' : 'Rimanda'}
          </button>
        )}
      </div>
      {avvisi[e.chiave] && <AvvisoAzione testo={avvisi[e.chiave]} className="mt-2" />}
    </div>
  ))

  if (richieste) return <>{voci}</>
  return (
    <section id={ID_SEZIONE} className="mz-sec scroll-mt-4" data-da-controllare>
      <p className="mz-eyebrow">Da controllare <small>· {quanteCose(eccezioni.length)} · {rigaConteggi(eccezioni)}</small></p>
      <div>{voci}</div>
      {aPosto && <p className="mz-note" style={{ paddingTop: 8 }}>{aPosto}</p>}
    </section>
  )
}
