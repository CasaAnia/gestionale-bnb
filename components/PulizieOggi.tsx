'use client'
// «Pulizie di oggi» in Home (Ania, 07/09/2026, bozza C «lista da spuntare»):
// una riga per pulizia della giornata con un cerchio da toccare. Un tocco =
// fatta (riga in cleanings, stessa scrittura di «Da controllare»); un altro
// tocco sulla spunta = non fatta (la riga si cancella); dopo la spunta il
// link «Recuperato?» apre la scheda della biancheria. Le automatiche (cambio
// ospite) hanno la spunta tenue e niente da toccare. Rimanda e Salta restano
// nella pagina Pulizie. Le voci vengono da lib/pulizieOggi (puro) con la
// lettura dei numeri di oggi; lo schermo cambia solo a scrittura riuscita.
import { useState } from 'react'
import Link from 'next/link'
import { Check } from 'lucide-react'
import AvvisoAzione from './AvvisoAzione'
import SchedaRecupero from './SchedaRecupero'
import { ricaricaNumeriOggiOvunque, type StatoNumeriOggi } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { segnaPuliziaFatta, annullaPuliziaFatta } from '@/lib/pulizieScritture'
import { salvaRecupero } from '@/lib/biancheriaDati'
import { vuoto, type Contatori } from '@/lib/biancheria'
import { riassuntoPulizieOggi, testoRitardo, type VocePuliziaOggi } from '@/lib/pulizieOggi'
import type { Decisione } from '@/lib/pulizie'

export const TITOLO_PULIZIE_OGGI = 'Pulizie di oggi'
export const LINK_PULIZIE = 'Rimanda o salta nella pagina Pulizie'

export default function PulizieOggi({ dati }: { dati: StatoNumeriOggi }) {
  const [occupata, setOccupata] = useState<string | null>(null)
  const [avvisi, setAvvisi] = useState<Record<string, string>>({})
  const [scheda, setScheda] = useState<{ camera: string; riga: Decisione } | null>(null)
  if (dati.stato !== 'pronto' || dati.pulizieOggi.length === 0) return null
  const { oggi, pulizieOggi: voci } = dati

  function togliAvviso(chiave: string) { setAvvisi(a => { const { [chiave]: _via, ...resto } = a; void _via; return resto }) }
  function aggiornaTutto() { ricaricaNumeriOggiOvunque(); void ricaricaDaControllare() }

  // Tocco sul cerchio: da fare → fatta oggi; fatta (a mano, oggi) → non fatta
  async function tocca(v: VocePuliziaOggi) {
    if (occupata) return
    setOccupata(v.chiave); togliAvviso(v.chiave)
    let errore: string | null = null
    if (v.stato === 'da_fare' && v.daSegnare) errore = (await segnaPuliziaFatta(v.daSegnare, oggi)).errore
    else if (v.stato === 'fatta' && v.annullabile && v.decisione?.id) errore = (await annullaPuliziaFatta(v.decisione.id)).errore
    else { setOccupata(null); return }
    setOccupata(null)
    if (errore) { setAvvisi(a => ({ ...a, [v.chiave]: errore })); return }
    aggiornaTutto()
  }

  async function salvaScheda(valori: Contatori): Promise<string | null> {
    if (!scheda?.riga.id) return 'Non salvato, riprova'
    const { errore } = await salvaRecupero({ cleaning_id: scheda.riga.id, room_id: scheda.riga.room_id, booking_id: scheda.riga.booking_id, data: scheda.riga.data_effettiva || scheda.riga.data_prevista, ...valori })
    if (!errore) setScheda(null)
    return errore
  }

  const cerchio = (v: VocePuliziaOggi) => {
    const base = 'w-6 h-6 rounded-full flex items-center justify-center'
    if (v.stato === 'da_fare') return <span className={base} style={{ border: '1.5px solid var(--color-green-mid)' }} aria-hidden />
    if (v.stato === 'fatta') return <span className={`${base} bg-green-mid text-white`} aria-hidden><Check size={15} strokeWidth={2.5} /></span>
    return <span className={`${base} bg-sage text-green-mid`} aria-hidden><Check size={15} strokeWidth={2.5} /></span>
  }

  return (
    <section className="mb-5" data-pulizie-oggi>
      <p className="ed-sezione mb-1">{TITOLO_PULIZIE_OGGI} <small>{riassuntoPulizieOggi(voci)}</small></p>
      <div>
        {voci.map(v => {
          const toccabile = v.stato === 'da_fare' || (v.stato === 'fatta' && v.annullabile)
          const inCorso = occupata === v.chiave
          const etichetta = v.stato === 'da_fare' ? `Segna pulita ${v.camera}` : `Segna non fatta ${v.camera}`
          return (
            <div key={v.chiave} data-stato={v.stato} data-camera={v.camera} className="flex items-center gap-1.5 py-1.5 border-t border-card-border">
              {toccabile ? (
                <button type="button" onClick={() => tocca(v)} disabled={!!occupata} aria-label={etichetta} data-spunta
                  className="shrink-0 w-11 h-11 -ml-2.5 flex items-center justify-center transition-transform duration-100 active:scale-[0.94] disabled:opacity-60"
                  style={inCorso ? { opacity: 0.5 } : undefined}>
                  {cerchio(v)}
                </button>
              ) : (
                <span className="shrink-0 w-11 h-11 -ml-2.5 flex items-center justify-center">{cerchio(v)}</span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px] leading-snug" style={{ fontFamily: 'var(--font-serif)', color: v.stato === 'da_fare' ? 'var(--color-green-dark)' : 'var(--color-stone)' }}>
                  {v.camera}
                  {v.ritardo > 0 && <span className="ml-2 text-[11px] font-bold text-brass" data-ritardo>{testoRitardo(v.ritardo)}</span>}
                </p>
                <p className="text-[12.5px] leading-snug" style={{ color: 'var(--color-stone)' }}>
                  {v.riga}
                  {v.stato === 'fatta' && v.annullabile && v.decisione?.id && (
                    <>
                      {' · '}
                      <button type="button" onClick={() => tocca(v)} disabled={!!occupata} className="underline underline-offset-2 disabled:opacity-60" data-non-fatta>{inCorso ? 'Tolgo…' : 'Non fatta'}</button>
                      {' · '}
                      <button type="button" onClick={() => setScheda({ camera: v.camera, riga: v.decisione! })} className="font-semibold underline underline-offset-2 text-green-mid" data-recuperato>Recuperato?</button>
                    </>
                  )}
                </p>
                {avvisi[v.chiave] && <AvvisoAzione testo={avvisi[v.chiave]} className="mt-1.5" />}
              </div>
            </div>
          )
        })}
      </div>
      <Link href={`/pulizie?giorno=${oggi}`} className="inline-block mt-2 text-[12.5px] underline underline-offset-2" style={{ color: 'var(--color-stone)' }}>{LINK_PULIZIE}</Link>
      {scheda && <SchedaRecupero camera={scheda.camera} iniziale={vuoto()} onSalva={salvaScheda} onChiudi={() => setScheda(null)} />}
    </section>
  )
}
