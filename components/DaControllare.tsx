'use client'
// «Da controllare» in Home (versione B, 06/09/2026): striscia con il numero e
// i conteggi per tipo, poi la sezione con le ECCEZIONI ordinate per urgenza.
// Ogni voce: etichetta del tipo in ottone, titolo (chi, cosa, quando), una
// riga con il perché, UN bottone che porta al punto esatto; nelle richieste
// anche «Rimanda» (ghost, memoria lato server). Le voci spariscono da sole
// quando il problema si risolve nella sua sezione: nessuna spunta «fatto».
// Zero eccezioni = né striscia né sezione. Lettura fallita = «Non riesco a
// controllare, riprova» + Riprova, mai un «tutto a posto» finto.
import { useEffect, useState } from 'react'
import NotaCliente from './richieste/NotaCliente'
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import { useDaControllare, ricaricaDaControllare } from '@/lib/daControllareDati'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { segnaPuliziaFatta } from '@/lib/pulizieScritture'
import { salvaRecupero } from '@/lib/biancheriaDati'
import { vuoto, type Contatori } from '@/lib/biancheria'
import SchedaRecupero from './SchedaRecupero'
import type { Decisione } from '@/lib/pulizie'
import { ETICHETTA_TIPO, PAROLA_NAVETTA, hrefDestinazione, rigaAPosto, rigaConteggi, titoloStriscia, type Eccezione } from '@/lib/daControllare'
import { BottoneWhatsApp, EtichettaBreve, BOTTONE_PIENO, BOTTONE_GHOST, ETICHETTA_CHIEDI_ORARIO, ETICHETTA_APRI_CHAT } from './BottoniWhatsApp'

export const ID_SEZIONE = 'da-controllare'

export default function DaControllare() {
  const dc = useDaControllare()
  // Avviso vicino alla voce (Rimanda non riuscito o non disponibile)
  const [avvisi, setAvvisi] = useState<Record<string, string>>({})
  const [rimandando, setRimandando] = useState<string | null>(null)
  // Recupero biancheria (06/09/2026): «Pulita» / «Pulita + recuperato» sulla voce pulizia
  const [segnando, setSegnando] = useState<string | null>(null)
  const [scheda, setScheda] = useState<{ camera: string; riga: Decisione } | null>(null)

  // Dalle Statistiche («N pagamenti da controllare») si arriva con #da-controllare
  const pronto = dc.stato === 'pronto'
  useEffect(() => {
    if (!pronto || typeof window === 'undefined' || window.location.hash !== `#${ID_SEZIONE}`) return
    document.getElementById(ID_SEZIONE)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [pronto])

  async function rimanda(e: Eccezione) {
    if (rimandando) return
    setRimandando(e.chiave)
    setAvvisi(a => { const { [e.chiave]: _via, ...resto } = a; void _via; return resto })
    const msg = await dc.rimanda(e.chiave)
    setRimandando(null)
    if (msg) setAvvisi(a => ({ ...a, [e.chiave]: msg }))
  }

  // Segna la pulizia fatta oggi (riga in cleanings, esito controllato); poi Home
  // e striscia si rileggono e la voce sparisce da sola. Con `recupero` apre la
  // scheda della biancheria: se quel salvataggio fallisce la pulizia resta segnata.
  async function segnaPulita(e: Eccezione, recupero: boolean) {
    if (segnando || !e.pulizia || dc.stato !== 'pronto') return
    setSegnando(e.chiave)
    setAvvisi(a => { const { [e.chiave]: _via, ...resto } = a; void _via; return resto })
    const { errore, riga } = await segnaPuliziaFatta(e.pulizia, dc.oggi)
    setSegnando(null)
    if (errore || !riga) { setAvvisi(a => ({ ...a, [e.chiave]: errore ?? 'Non salvato, riprova' })); return }
    void ricaricaDaControllare()
    ricaricaNumeriOggiOvunque()
    if (recupero) setScheda({ camera: e.pulizia.camera, riga })
  }

  async function salvaScheda(valori: Contatori): Promise<string | null> {
    if (!scheda?.riga.id) return 'Non salvato, riprova'
    const { errore } = await salvaRecupero({ cleaning_id: scheda.riga.id, room_id: scheda.riga.room_id, booking_id: scheda.riga.booking_id, data: scheda.riga.data_effettiva || scheda.riga.data_prevista, ...valori })
    if (!errore) setScheda(null)
    return errore
  }

  // In cima alla Home (ritocchi del 07/09/2026): durante il controllo non si
  // occupa spazio; con zero eccezioni la Home resta com'è
  if (dc.stato === 'caricamento') return null
  if (dc.stato === 'errore') {
    return <AvvisoAzione testo={dc.errore} onRiprova={dc.ricarica} className="mb-4" />
  }
  const { eccezioni } = dc
  if (eccezioni.length === 0) return null
  const aPosto = rigaAPosto(eccezioni)

  return (
    <section id={ID_SEZIONE} className="mb-4 scroll-mt-20">
      {/* Striscia: «N cose da controllare» + conteggi per tipo */}
      {/* Stile editoriale (06/09/2026): filo ottone e titolo leggero al posto del riquadro sabbia */}
      <div className="ed-riga-ottone pb-3 mb-3">
        <p className="ed-titolo-medio">{titoloStriscia(eccezioni)}</p>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--color-stone)' }}>{rigaConteggi(eccezioni)}</p>
      </div>

      <p className="ed-sezione mb-1">Da controllare</p>
      <div>
        {eccezioni.map((e, i) => (
          <div key={e.chiave} data-urgenza={e.urgenza}
            className={`py-3 ${i > 0 ? 'border-t border-card-border' : ''}`}
            style={e.urgenza === 'alta' ? { borderLeft: '2px solid #A9884E', paddingLeft: 10 } : undefined}>
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass">{ETICHETTA_TIPO[e.tipo]}</p>
            <p className="text-[15px] font-semibold text-green-dark leading-snug mt-0.5">{e.titolo}</p>
            <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: 'var(--color-stone)' }}>
              {e.motivo}
              {/* Navetta confermata senza orario (06/09/2026): la parola in ottone, lo stesso segno dell'ombra in Arrivi */}
              {e.navetta && <> · <span data-navetta className="font-bold text-brass">{PAROLA_NAVETTA}</span></>}
            </p>
            {/* Nota del cliente nella richiesta (Ania, 07/09/2026): sotto il motivo, come nella pagina Richieste */}
            <NotaCliente note={e.nota} piccola className="mt-1" />
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2.5" data-bottoni>
              {/* Arrivo senza orario (08/09/2026): «Chiedi orario» (pieno) · «Apri chat» (ghost) · «Apri arrivo» (ghost) */}
              {e.whatsapp?.principale && <BottoneWhatsApp href={e.whatsapp.href} numero={e.whatsapp.numero} testo={e.whatsapp.testo} etichetta={ETICHETTA_CHIEDI_ORARIO} pieno tipo="chiedi-orario" />}
              {e.whatsappChat && <BottoneWhatsApp href={e.whatsappChat.href} numero={e.whatsappChat.numero} testo="" etichetta={ETICHETTA_APRI_CHAT} pieno={false} tipo="apri-chat" />}
              {/* Pulizia non registrata (06/09/2026): «Pulita» (pieno) · «Pulita + recuperato» (contorno) · «Apri pulizie» */}
              {e.pulizia && (
                <>
                  <button type="button" onClick={() => segnaPulita(e, false)} disabled={segnando === e.chiave} data-pulita
                    className="ed-pillola text-[13px] disabled:opacity-60"
                    style={{ minHeight: 40 }}>
                    {segnando === e.chiave ? 'Segno…' : 'Pulita'}
                  </button>
                  <button type="button" onClick={() => segnaPulita(e, true)} disabled={segnando === e.chiave} data-pulita-recuperato
                    className="ed-pillola-contorno text-[13px] disabled:opacity-60"
                    style={{ minHeight: 40 }}>
                    Pulita + recuperato
                  </button>
                </>
              )}
              <Link href={hrefDestinazione(e.destinazione)}
                className={e.whatsapp?.principale || e.pulizia ? BOTTONE_GHOST : BOTTONE_PIENO} style={e.whatsapp?.principale || e.pulizia ? { color: '#2D6A4F' } : undefined}>
                {e.tipo === 'arrivo' ? <EtichettaBreve testo={e.bottone} /> : e.bottone}
              </Link>
              {e.whatsapp && !e.whatsapp.principale && <BottoneWhatsApp href={e.whatsapp.href} numero={e.whatsapp.numero} testo="" etichetta={ETICHETTA_APRI_CHAT} pieno={false} tipo="apri-chat" />}
              {e.rimandabile && (
                <button type="button" onClick={() => rimanda(e)} disabled={rimandando === e.chiave}
                  className="text-[12px] font-semibold px-2 py-1.5 rounded-lg whitespace-nowrap transition-transform duration-100 active:scale-[0.97] disabled:opacity-60"
                  style={{ color: 'var(--color-stone)' }}>
                  {rimandando === e.chiave ? 'Rimando…' : 'Rimanda'}
                </button>
              )}
            </div>
            {avvisi[e.chiave] && <AvvisoAzione testo={avvisi[e.chiave]} className="mt-2" />}
          </div>
        ))}
        {aPosto && (
          <p className="py-2.5 text-[12.5px] border-t border-dashed border-[#C9BFA8]" style={{ color: 'var(--color-stone)' }}>{aPosto}</p>
        )}
      </div>
      {scheda && <SchedaRecupero camera={scheda.camera} iniziale={vuoto()} onSalva={salvaScheda} onChiudi={() => setScheda(null)} />}
    </section>
  )
}
