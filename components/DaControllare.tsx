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
import Link from 'next/link'
import AvvisoAzione from './AvvisoAzione'
import { useDaControllare } from '@/lib/daControllareDati'
import { ETICHETTA_TIPO, hrefDestinazione, rigaAPosto, rigaConteggi, titoloStriscia, type Eccezione } from '@/lib/daControllare'
import { BottoneWhatsApp, EtichettaBreve, BOTTONE_PIENO, BOTTONE_GHOST, ETICHETTA_CHIEDI_ORARIO, ETICHETTA_APRI_CHAT } from './BottoniWhatsApp'

const FRAUNCES = { fontFamily: 'var(--font-fraunces), Georgia, serif' }
export const ID_SEZIONE = 'da-controllare'

export default function DaControllare() {
  const dc = useDaControllare()
  // Avviso vicino alla voce (Rimanda non riuscito o non disponibile)
  const [avvisi, setAvvisi] = useState<Record<string, string>>({})
  const [rimandando, setRimandando] = useState<string | null>(null)

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
      <div className="rounded-[10px] px-3.5 py-3 mb-3" style={{ background: '#F3ECD8' }}>
        <p className="text-[19px] leading-tight text-green-dark" style={FRAUNCES}>{titoloStriscia(eccezioni)}</p>
        <p className="text-[12.5px] mt-1" style={{ color: 'var(--color-stone)' }}>{rigaConteggi(eccezioni)}</p>
      </div>

      <p className="text-[11px] uppercase mb-2 text-brass" style={{ letterSpacing: '2px' }}>Da controllare</p>
      <div className="bg-white rounded-[10px] border border-[#C9BFA8] shadow-sm overflow-hidden">
        {eccezioni.map((e, i) => (
          <div key={e.chiave} data-urgenza={e.urgenza}
            className={`px-3.5 py-3 ${i > 0 ? 'border-t border-card-border' : ''}`}
            style={e.urgenza === 'alta' ? { boxShadow: 'inset 3px 0 0 #A9884E' } : undefined}>
            <p className="text-[10px] uppercase tracking-[1.5px] text-brass">{ETICHETTA_TIPO[e.tipo]}</p>
            <p className="text-[15px] font-semibold text-green-dark leading-snug mt-0.5">{e.titolo}</p>
            <p className="text-[12.5px] leading-snug mt-0.5" style={{ color: 'var(--color-stone)' }}>{e.motivo}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 mt-2.5" data-bottoni>
              {/* Arrivo senza orario (08/09/2026): «Chiedi orario» (pieno) · «Apri chat» (ghost) · «Apri arrivo» (ghost) */}
              {e.whatsapp?.principale && <BottoneWhatsApp href={e.whatsapp.href} numero={e.whatsapp.numero} testo={e.whatsapp.testo} etichetta={ETICHETTA_CHIEDI_ORARIO} pieno tipo="chiedi-orario" />}
              {e.whatsappChat && <BottoneWhatsApp href={e.whatsappChat.href} numero={e.whatsappChat.numero} testo="" etichetta={ETICHETTA_APRI_CHAT} pieno={false} tipo="apri-chat" />}
              <Link href={hrefDestinazione(e.destinazione)}
                className={e.whatsapp?.principale ? BOTTONE_GHOST : BOTTONE_PIENO} style={e.whatsapp?.principale ? { color: '#2D6A4F' } : undefined}>
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
          <p className="mx-3.5 py-2.5 text-[12.5px] border-t border-dashed border-[#C9BFA8]" style={{ color: 'var(--color-stone)' }}>{aPosto}</p>
        )}
      </div>
    </section>
  )
}
