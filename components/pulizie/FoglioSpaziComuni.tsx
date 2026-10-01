'use client'
// ============================================================================
// «SPAZI COMUNI · MINUTI A MANO» (riferimento approvato da Ania il 01/10/2026,
// pulizie-fogli-riferimento.html): si apre toccando i minuti di una voce
// degli spazi comuni (pagina Oggi) o una riga degli spazi comuni nel Registro.
// Il timer di quella voce (solo nel giorno di oggi), i minuti, e solo per
// «Altro» una riga facoltativa «Cosa» (al massimo 60 caratteri; solo con la
// proposta 0064). Salva con salvaFuoriCamera, lo stesso di TempiFuoriCamera:
// il valore scritto SOSTITUISCE il totale della voce in quella giornata; il
// timer fermato si somma in modo dichiarato (totaleProposto). Dopo il
// salvataggio si rilegge la riga e si confronta.
// ============================================================================
import { useCallback, useEffect, useRef, useState } from 'react'
import FoglioPulizie from './FoglioPulizie'
import TimerPulizia from '@/components/TimerPulizia'
import type { Salvataggio } from '@/components/maison/SalvatoMaison'
import { salvaFuoriCamera, leggiFuoriCamera, useTimerPulizie, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { chiaveTimerFuori, totaleProposto, nomeAttivita, type VoceSpazi } from '@/lib/tempoPulizie'
import { giornoLungo } from '@/lib/giornataPulizie'

export default function FoglioSpaziComuni({ giorno, oggi, voce, righe, conCosa, nomeCamera, onChiudi, onSalvato }: {
  giorno: string; oggi: string; voce: VoceSpazi
  /** le righe dei tempi di quel giorno */
  righe: FuoriCameraSql[]
  /** «Cosa · facoltativo» solo con la proposta 0064 */
  conCosa: boolean
  nomeCamera: (bookingId: string) => string | null
  onChiudi: () => void; onSalvato: () => void
}) {
  const salvata = righe.find(r => r.data === giorno && r.attivita === voce) ?? null
  // i minuti di «Area comune» di prima restano dove sono: si dicono, non si toccano
  const vecchi = voce === 'corridoio' ? righe.filter(r => r.data === giorno && r.attivita === 'area_comune').reduce((s, r) => s + r.minuti, 0) : 0
  const [minuti, setMinuti] = useState(salvata ? String(salvata.minuti) : '')
  const [cosa, setCosa] = useState(salvata?.cosa ?? '')
  const [messaggio, setMessaggio] = useState('')
  const [riportato, setRiportato] = useState<number | null>(null)
  const [salvando, setSalvando] = useState(false)
  const [salvato, setSalvato] = useState<Salvataggio | null>(null)
  const freno = useRef(false)
  const timer = useTimerPulizie()
  const chiave = chiaveTimerFuori(giorno, voce)
  const t = giorno === oggi ? timer.timer.find(x => x.chiave === chiave) ?? null : null
  const nome = nomeAttivita(voce)

  const riporta = useCallback((_: number, trascorsi: number) => {
    const p = totaleProposto(salvata?.minuti ?? null, trascorsi, minuti)
    setMinuti(String(p.minuti)); setRiportato(trascorsi); setMessaggio(p.testo)
  }, [salvata, minuti])

  // Timer in pausa con minuti non ancora riportati: si aggiungono da soli,
  // detto in chiaro («12 min salvati + 5 dal timer = 17 min»).
  useEffect(() => {
    if (!t || t.avviato_at || t.trascorsi <= 0 || riportato === t.trascorsi) return
    const id = window.setTimeout(() => riporta(0, t.trascorsi), 0)
    return () => window.clearTimeout(id)
  }, [t, riportato, riporta])

  async function salva() {
    if (freno.current) return
    const n = Number(minuti)
    if (minuti.trim() === '' || !Number.isInteger(n) || n < 0 || n > 1440) { setMessaggio('Scrivi i minuti, da 0 a 1440.'); return }
    if (t?.avviato_at) { setMessaggio('Ferma il timer prima di salvare il tempo.'); return }
    if (t && t.trascorsi > 0 && riportato !== t.trascorsi) { setMessaggio('Il timer ha minuti non ancora riportati: mettilo in pausa, i minuti si aggiungono qui.'); return }
    const testo = cosa.trim().slice(0, 60)
    freno.current = true; setSalvando(true); setMessaggio('')
    try {
      const e = await salvaFuoriCamera(giorno, voce, n, salvata?.versione ?? null, t?.trascorsi ?? 0, voce === 'altro' && conCosa ? (testo || null) : undefined)
      if (e.errore) { setMessaggio(e.errore); return }
      // Rilettura: la riga deve dire i minuti (e il «cosa») appena scritti
      const letta = await leggiFuoriCamera(giorno, giorno)
      const riga = letta.righe?.find(r => r.attivita === voce)
      if (!riga) { setMessaggio('Salvato, ma non riesco a rileggerlo: riapri la pagina per controllare, senza risalvare.'); return }
      if (riga.minuti !== n || (voce === 'altro' && conCosa && (riga.cosa ?? '') !== testo)) { setMessaggio('La rilettura non coincide con quello che hai scritto: riapri la pagina e controlla.'); return }
      setSalvato({ cosa: `${nome} · ${n} min`, quando: new Date() })
    } finally { freno.current = false; setSalvando(false) }
  }

  return <FoglioPulizie dati="spazi" eyebrow={`Spazi comuni · ${giorno === oggi ? 'oggi' : giorno.split('-').reverse().join('/')}`} titolo={nome} destra={giornoLungo(giorno)}
    onChiudi={onChiudi} salvato={salvato} onFineSalvato={() => { onSalvato(); onChiudi() }}
    azione="Salva" onAzione={() => void salva()} salvando={salvando} disabilitato={!!salvato}>
    <div data-foglio-spazi={voce}>
      {giorno === oggi && <TimerPulizia grande chiave={chiave} nome={nome} onMinuti={riporta} nomeCamera={nomeCamera} />}
      <label className="pul-fld"><span>Minuti</span>
        <input type="number" inputMode="numeric" min="0" max="1440" placeholder="—" aria-label="Minuti" data-campo="minuti-spazi" value={minuti} onChange={e => setMinuti(e.target.value)} style={{ width: 90 }} />
      </label>
      {voce === 'altro' && conCosa && <label className="pul-fld"><span>Cosa · facoltativo</span>
        <input type="text" maxLength={60} placeholder="vetri dell’ingresso" aria-label="Cosa" data-campo="cosa" value={cosa} onChange={e => setCosa(e.target.value)} className={cosa ? '' : 'vu'} style={{ flex: 1 }} />
      </label>}
      {salvata && <p className="pul-nt">Salvati finora: {salvata.minuti} min. Il numero scritto qui sostituisce il totale della giornata.</p>}
      {vecchi > 0 && <p className="pul-nt" data-area-comune>In più {vecchi} min salvati prima come «Area comune»: restano e si contano qui sotto «{nome}».</p>}
      {messaggio && <p role="status" className="pul-avviso">{messaggio}</p>}
    </div>
  </FoglioPulizie>
}
