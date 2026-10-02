'use client'
// «Spazi comuni» dopo le camere da fare. Dal 02/10/2026 (riferimento approvato
// da Ania, pulizie-timer-riferimento.html, schermata 5) ogni voce è una scheda
// come quella di una camera: nome in Cormorant, sotto «oggi 12 minuti
// segnati», il timer grande con gli stessi comandi (TimerPulizia grande:
// Avvia · Pausa · Riprendi · Ferma e riporta i minuti · Azzera · Minuti a
// mano). «Ferma e riporta» e «Salva» dei minuti a mano AGGIUNGONO i minuti al
// totale di oggi della voce (12 + 23 = 35), con salvaFuoriCamera: il timer
// riparte da zero nella stessa transazione e la riga si rilegge. Un tocco su
// «oggi 35 minuti segnati» apre il foglio «Spazi comuni · minuti a mano» per
// correggere il totale (e per «Altro» la riga «Cosa»).
// Il timer «area_comune» di prima, se c'è ancora, si legge sotto «Corridoio e
// angolo caffè»: i suoi minuti vanno nel suo giorno, come prima.
import TimerPulizia from '@/components/TimerPulizia'
import { useTimerPulizie, salvaFuoriCamera, leggiFuoriCamera, type FuoriCameraSql } from '@/lib/pulizieTempiDati'
import { chiaveTimerFuori, minutiPerVoce, minutiTimer, vociSpaziAttive, type AttivitaFuori, type TimerSql, type VoceSpazi } from '@/lib/tempoPulizie'
import { minutiDalCampo, testoOggiSpazi } from '@/lib/minutiSegnati'
import { aggiuntaSpazi } from '@/lib/spaziComuni'
import { useRef, useState } from 'react'

export const TITOLO_SPAZI = 'Spazi comuni'

export default function SpaziComuniOggi({ oggi, righe, conAltro, nomeCamera, onVaiA, onMinuti }: {
  oggi: string; righe: FuoriCameraSql[]; conAltro: boolean
  nomeCamera: (bookingId: string) => string | null; onVaiA: (chiave: string) => void
  /** tocco su «oggi … segnati»: il foglio «Spazi comuni · minuti a mano» */
  onMinuti?: (voce: VoceSpazi) => void
}) {
  const s = useTimerPulizie()
  const voci = minutiPerVoce(righe.filter(r => r.data === oggi))
  // i timer «Area comune» di prima ancora aperti (di oggi o di un altro giorno)
  const vecchi = s.timer.filter(t => /^fuori:\d{4}-\d{2}-\d{2}:area_comune$/.test(t.chiave) && !t.cleaning_id && (t.avviato_at || t.trascorsi > 0))
  return <section id="spazi-comuni" className="scroll-mt-20" data-spazi-comuni>
    <p className="pul-sez">{TITOLO_SPAZI}</p>
    {vociSpaziAttive(conAltro).map(([k, label]) => {
      const oggiT = s.timer.find(x => x.chiave === chiaveTimerFuori(oggi, k)) ?? null
      return <VoceSpaziOggi key={k} voce={k} nome={label} oggi={oggi} minuti={voci[k].minuti} timer={timerDellaVoce(oggiT, k === 'corridoio' ? vecchi : [])} chiaveOggi={chiaveTimerFuori(oggi, k)}
        nomeCamera={nomeCamera} onVaiA={onVaiA} onMinuti={onMinuti} />
    })}
  </section>
}

// Quale timer mostra la scheda: quello che corre; se nessuno corre, quello
// con secondi da riportare (prima quello di oggi); altrimenti quello di oggi.
function timerDellaVoce(oggiT: TimerSql | null, vecchi: TimerSql[]): string | null {
  const tutti = [oggiT, ...vecchi].filter((t): t is TimerSql => !!t)
  return (tutti.find(t => t.avviato_at) ?? tutti.find(t => t.trascorsi > 0))?.chiave ?? null
}

function VoceSpaziOggi({ voce, nome, oggi, minuti, timer, chiaveOggi, nomeCamera, onVaiA, onMinuti }: {
  voce: VoceSpazi; nome: string; oggi: string; minuti: number
  /** la chiave del timer da mostrare se diversa da quella di oggi (o null) */
  timer: string | null; chiaveOggi: string
  nomeCamera: (bookingId: string) => string | null; onVaiA: (chiave: string) => void
  onMinuti?: (voce: VoceSpazi) => void
}) {
  const s = useTimerPulizie()
  const chiave = timer ?? chiaveOggi
  const [, giorno, attivita] = chiave.split(':') as [string, string, AttivitaFuori]
  const t = s.timer.find(x => x.chiave === chiave) ?? null
  const [aMano, setAMano] = useState<string | null>(null)
  const [messaggio, setMessaggio] = useState('')
  const [salvando, setSalvando] = useState(false)
  const freno = useRef(false)
  const attiva = !!t?.avviato_at || (t?.trascorsi ?? 0) > 0 || aMano !== null

  // Aggiunge `n` minuti al totale del giorno della voce; `trascorsi` sono i
  // secondi del timer che il salvataggio consuma (riparte da zero).
  async function aggiungi(n: number, trascorsi: number): Promise<boolean> {
    if (freno.current) return false
    freno.current = true; setSalvando(true); setMessaggio('')
    try {
      const prima = await leggiFuoriCamera(giorno, giorno)
      if (!prima.righe) { setMessaggio(prima.errore ?? 'Non riesco a leggere i minuti di oggi. Riprova.'); return false }
      const riga = prima.righe.find(r => r.attivita === attivita) ?? null
      const conto = aggiuntaSpazi(riga?.minuti ?? null, n)
      if (conto.errore) { setMessaggio(conto.errore); return false }
      const e = await salvaFuoriCamera(giorno, attivita, conto.totale, riga?.versione ?? null, trascorsi)
      if (e.errore) { setMessaggio(e.errore); return false }
      // Rilettura: la riga deve dire il totale appena scritto
      const dopo = await leggiFuoriCamera(giorno, giorno)
      const letta = dopo.righe?.find(r => r.attivita === attivita)
      if (!letta) { setMessaggio('Salvato, ma non riesco a rileggerlo: riapri la pagina per controllare, senza risalvare.'); return true }
      if (letta.minuti !== conto.totale) { setMessaggio('La rilettura non coincide: riapri la pagina e controlla i minuti, senza risalvare.'); return true }
      if (giorno !== oggi) setMessaggio(`${n} min aggiunti al ${giorno.split('-').reverse().join('/')} (timer di prima, «Area comune»).`)
      return true
    } finally { freno.current = false; setSalvando(false) }
  }
  const apriAMano = () => { setMessaggio(''); setAMano(t && !t.avviato_at && t.trascorsi > 0 ? String(minutiTimer(t.trascorsi)) : '') }
  async function salvaAMano() {
    const n = minutiDalCampo(aMano ?? '')
    if (n === null) { setMessaggio('Scrivi i minuti, da 1 a 1440.'); return }
    if (t?.avviato_at) { setMessaggio('Ferma il timer prima di segnare i minuti.'); return }
    if (await aggiungi(n, t?.trascorsi ?? 0)) setAMano(null)
  }

  const campo = aMano !== null && <div data-minuti-a-mano-aperti>
    <div className="pul-man"><input type="number" inputMode="numeric" min="1" max="1440" autoFocus aria-label={`Minuti · ${nome}`} value={aMano} onChange={e => setAMano(e.target.value)} data-campo="minuti-a-mano" /><small>minuti</small></div>
    <div className="pul-cmd"><button type="button" className="pul-az" disabled={salvando} onClick={() => void salvaAMano()} data-salva-minuti>{salvando ? 'Salvo…' : 'Salva'}</button><button type="button" className="pul-az tn" disabled={salvando} onClick={() => { setAMano(null); setMessaggio('') }}>Annulla</button></div>
  </div>
  return <article id={`spazi-${voce}`} className={`pul-card pul-spazio${attiva ? ' cur' : ''}`} data-voce-spazi={voce} data-in-corso={t?.avviato_at ? 1 : 0}>
    <div className="hd"><b>{nome}</b></div>
    {onMinuti ? <button type="button" className="pul-chi pul-oggi-spazi" onClick={() => onMinuti(voce)} data-minuti-spazi={voce}>{testoOggiSpazi(minuti)}</button>
      : <p className="pul-chi" data-minuti-spazi={voce}>{testoOggiSpazi(minuti)}</p>}
    <TimerPulizia grande chiave={chiave} nome={nome} nomeCamera={nomeCamera} onVaiA={onVaiA} onAMano={apriAMano} sotto={campo || undefined}
      onMinuti={(n, trascorsi) => void aggiungi(n, trascorsi)} />
    {messaggio && <p role="status" className="pul-avviso" data-esito-spazi={voce}>{messaggio}</p>}
  </article>
}
