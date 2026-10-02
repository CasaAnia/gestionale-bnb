'use client'
// Pop-up approvato da Ania il 25/09/2026 (riferimento congelato in outputs/riferimento-pulizie-approvato.zip, app/anteprima-pulizie):
// una sola scheda con dotazione, federe, recuperi a tocco, timer, minuti e
// conferma. Qui salva davvero: gestisci_pulizia (0059) scrive intervento,
// dotazione, recuperi e minuti nella stessa transazione, poi si rilegge
// tutto e si confronta con quanto inviato prima di dire «salvato».
import { useCallback, useEffect, useRef, useState } from 'react'
import FoglioPulizie, { ALTEZZA_FOGLI_PULIZIE } from './pulizie/FoglioPulizie'
import type { Salvataggio } from './maison/SalvatoMaison'
import { COSA_SALVATA } from '@/lib/salvatoMaison'
import { apriSelettore } from './nuova/CampoData'
import { MESI_BREVI, MESI_LUNGHI } from '@/lib/dateItaliane'
import { useParte0064 } from '@/lib/schema0064Dati'
import TimerPulizia from './TimerPulizia'
import { oraBreve, oraPerSql } from '@/lib/schema0064'
import { oraSegnata, romaDi, oraTesto } from '@/lib/giornataPulizie'
import { ritoccaPulizia } from '@/lib/ritoccaPulizia'
import { supabase } from '@/lib/supabase'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { leggiOperazionePulizia, TIMER_CAMBIATO, type RispostaPulizia, type TimerVisto } from '@/lib/pulizieOperazioni'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { useTimerPulizie, leggiTimer, statoTimerAttuale } from '@/lib/pulizieTempiDati'
import { chiaveTimerPulizia, testoCronometro, secondiTimer, type TimerSql } from '@/lib/tempoPulizie'
import { lettiTesto } from '@/lib/pulizieVista'
import { fotoTimer, stessoTimer, type MinutiSegnati } from '@/lib/minutiSegnati'
import type { Decisione, PrenotazionePulizie, TipoPulizia } from '@/lib/pulizie'
import {
  VOCI_DOTAZIONE, dotazioneDaAssetto, pezziVuoti, totalePezzi, daLavare, validaAssetto, assettoPerSql, assettoDaSql, pezziDaSql,
  recuperoDaRiga, recuperoPerSql, recuperiOltre, totaleSenzaMisura, proponiAssettoDaSoggiorno,
  type AssettoPulizia, type PezziPulizie, type SenzaMisura,
} from '@/lib/dotazionePulizie'

export const TIPI_INTERVENTO: Record<TipoPulizia, string> = { fine_soggiorno: 'Fine soggiorno', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
/** Dal 01/10/2026 (Ania, P7): tutti i fogli delle Pulizie hanno la stessa
 *  altezza, quella di questo foglio nella veste nuova: fino a 790 px, entro il 92% dello schermo, con
 *  i tasti a 96 px dal fondo (components/pulizie/FoglioPulizie). Prima 866. */
export const ALTEZZA_FOGLIO_PULIZIA = ALTEZZA_FOGLI_PULIZIE
/** Il tipo nell'eyebrow e nel Registro (riferimento del 01/10/2026) */
export const TIPI_FOGLIO: Record<TipoPulizia, string> = { fine_soggiorno: 'Cambio ospite', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
const NESSUNO: SenzaMisura = { lenzuolo_sotto: 0, lenzuolo_sopra: 0 }
// Fotografia del timer che si vedeva quando si sono scritti o riportati i minuti (lib/minutiSegnati).

type Bozza = {
  data: string; assetto: AssettoPulizia; assettoDaConfermare: boolean; federeScelte: boolean
  recuperi: PezziPulizie | null; senzaMisura: SenzaMisura; minuti: number | null
  versione: string | null; versioneRecupero: string | null
  /** correzione: l'ora a schermo («9:02») e quella da cui si parte */
  ora: string | null; oraIniziale: string | null
}

export default function SchedaPulizia({ camera, pulizia, booking, oggi, ultimaId, onChiudi, onSalvato, onTolta, nomeCamera, onVaiA, minutiSegnati }: {
  camera: string                       // nome breve («Amelia»)
  pulizia: Decisione                   // da confermare (senza id) o già confermata
  booking?: PrenotazionePulizie | null // assente: si legge dal database (Home)
  oggi: string; ultimaId: string | null
  onChiudi: () => void; onSalvato?: (r: RispostaPulizia) => void
  /** dopo «togli»: la pulizia non c'è più */
  onTolta?: (id: string) => void
  nomeCamera?: (bookingId: string) => string | null; onVaiA?: (chiave: string) => void
  /** i minuti già segnati sulla scheda della camera (02/10/2026): il foglio parte da quelli */
  minutiSegnati?: MinutiSegnati
}) {
  // Le proprietà dell'apertura si fissano: un nuovo disegno della pagina non riapre la scheda.
  const [iniziale] = useState(() => ({ pulizia, booking, minuti: minutiSegnati ?? null }))
  const correzione = !!pulizia.id && pulizia.stato === 'fatta'
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pendente, setPendente] = useState(false)
  // Conferma B (28/09/2026): dopo il salvataggio la spunta, poi il foglio si chiude da solo
  const [salvato, setSalvato] = useState<(Salvataggio & { risposta: RispostaPulizia }) | null>(null)
  // «Cambia» dei letti preparati e il campo dei minuti, aperti al tocco
  const [cambiaLetti, setCambiaLetti] = useState(false)
  // «Segnata per sbaglio · togli» e l'ora corretta a mano: solo con la proposta 0064
  const oraPulizia0064 = useParte0064('oraPulizia')
  const conRitocchi = correzione && oraPulizia0064.stato === 'si'
  const [chiediTogli, setChiediTogli] = useState(false)
  const [scriviMinuti, setScriviMinuti] = useState(false)
  const blocco = useRef(false)
  const timer = useTimerPulizie()
  const chiave = !correzione && pulizia.booking_id ? chiaveTimerPulizia(pulizia.booking_id, pulizia.tipo, pulizia.data_prevista) : null
  const t = chiave ? timer.timer.find(x => x.chiave === chiave) ?? null : null
  // undefined = minuti mai scritti né riportati in questa scheda
  const [visto, setVisto] = useState<TimerVisto | null | undefined>(() => iniziale.minuti && !correzione ? iniziale.minuti.timer : undefined)
  const ultimoT = useRef(t)
  useEffect(() => { ultimoT.current = t }, [t])

  // Apertura: per una correzione si rilegge la pulizia e il suo recupero dal
  // database (un'altra scheda può averli cambiati); per una nuova, proposta
  // dal soggiorno. Il timer NON parte aprendo la scheda.
  useEffect(() => {
    let viva = true
    const { pulizia } = iniziale
    async function apri() {
      try { setPendente(!!leggiOperazionePulizia(window.localStorage, pulizia.room_id)) } catch { setPendente(true) }
      let booking = iniziale.booking ?? null
      if (iniziale.booking === undefined && pulizia.booking_id) {
        const letta = await supabase.from('bookings').select('*').eq('id', pulizia.booking_id).maybeSingle()
        booking = (letta.data as PrenotazionePulizie | null) ?? null
      }
      const giorno = correzione ? (pulizia.data_effettiva || pulizia.data_prevista) : oggi
      const proposta = booking ? proponiAssettoDaSoggiorno(camera, booking, giorno, pulizia.persone_servite) : null
      const riserva: AssettoPulizia = camera === 'Amelia' ? { matrimoniali: 0, singoli: 1, ospiti: 1, federeMatrimoniale: 4 } : { matrimoniali: 1, singoli: 0, ospiti: 1, federeMatrimoniale: 4 }
      if (!correzione) {
        const assetto = proposta ?? riserva
        // Recuperi «non annotati» (null) finché non si tocca un riquadro o «Niente recuperato»:
        // zero è solo una scelta esplicita (rilievo di Codex del 01/10/2026, comportamento di prima)
        if (viva) setBozza({ data: oggi, assetto, assettoDaConfermare: !proposta, federeScelte: !(assetto.matrimoniali && assetto.ospiti === 1), recuperi: null, senzaMisura: NESSUNO, minuti: iniziale.minuti?.minuti ?? null, versione: null, versioneRecupero: null, ora: null, oraIniziale: null })
        return
      }
      const [c, r] = await Promise.all([
        supabase.from('cleanings').select('*').eq('id', pulizia.id!).maybeSingle(),
        leggiRecuperiDellePulizie([pulizia.id!]),
      ])
      if (!viva) return
      if (c.error || !c.data || r.errore || !r.tabella) { setErrore('Non riesco a rileggere questa pulizia. Chiudi e riprova.'); return }
      const riga = c.data as Decisione & { assetto?: unknown; minuti?: number | null; aggiornata_at?: string | null }
      const salvato = assettoDaSql(riga.assetto)
      const rec = recuperoDaRiga(r.righe[0] as unknown as Record<string, unknown>)
      const assetto = salvato ?? proposta ?? riserva
      setBozza({ data: riga.data_effettiva || riga.data_prevista, assetto, assettoDaConfermare: !salvato, federeScelte: !!salvato || !(assetto.matrimoniali && assetto.ospiti === 1),
        recuperi: rec?.pezzi ?? null, senzaMisura: rec?.senzaMisura ?? NESSUNO, minuti: riga.minuti ?? null,
        versione: riga.aggiornata_at ?? null, versioneRecupero: r.righe[0]?.updated_at ?? null,
        ...(o => ({ ora: o, oraIniziale: o }))((m => m === null ? null : oraTesto(m))(oraSegnata(riga as Parameters<typeof oraSegnata>[0], romaDi))) })
    }
    apri().catch(() => { if (viva) setErrore('Non riesco a rileggere questa pulizia. Chiudi e riprova.') })
    return () => { viva = false }
  }, [camera, correzione, oggi, iniziale])

  const cambiaAssetto = (campi: Partial<AssettoPulizia>) => {
    if (!bozza) return
    const assetto = { ...bozza.assetto, ...campi }, problema = validaAssetto(assetto)
    if (problema) { setErrore(problema); return }
    setErrore(''); setBozza({ ...bozza, assetto, assettoDaConfermare: false })
  }
  const riportaMinuti = useCallback((n: number) => { setBozza(b => b ? { ...b, minuti: n || null } : b); setVisto(fotoTimer(ultimoT.current)) }, [])

  // Riferimento approvato il 01/10/2026 (pulizie-fogli-riferimento.html,
  // «Dopo»): eyebrow «CAMBIO OSPITE · PULITA E RECUPERATO», camera in grande.
  const eyebrow = `${TIPI_FOGLIO[pulizia.tipo]} · ${correzione ? 'Correzione' : 'Pulita e recuperato'}`
  if (!bozza) return <FoglioPulizie dati="recupero" eyebrow={eyebrow} titolo={camera} onChiudi={onChiudi} azione={correzione ? 'Salva correzione' : 'Conferma pulizia'} onAzione={() => {}} disabilitato>
    <p className="pul-avviso" style={{ marginTop: 16 }}>{errore || 'Lettura della pulizia…'}</p>
  </FoglioPulizie>

  const dotazione = dotazioneDaAssetto(bozza.assetto)
  const oltre = bozza.recuperi ? recuperiOltre(dotazione, bozza.recuperi, bozza.senzaMisura) : []
  const recuperati = bozza.recuperi ? totalePezzi(bozza.recuperi) : null
  const lavaggio = bozza.recuperi && !oltre.length ? daLavare(dotazione, bozza.recuperi) : null
  const timerInCorso = !!t?.avviato_at
  const timerNonRiportato = !timerInCorso && !!t && t.trascorsi > 0 && bozza.minuti === null
  const tocca = (k: keyof PezziPulizie) => {
    const r = bozza.recuperi ?? pezziVuoti(), n = r[k] + 1
    // dopo il massimo torna a zero; un valore già oltre il limite (dato di prima) riparte da zero
    setBozza({ ...bozza, recuperi: { ...r, [k]: n > dotazione[k] ? 0 : n } })
  }

  async function salva() {
    if (!bozza || blocco.current) return
    if (timerInCorso) { setErrore('Ferma il timer prima di confermare la pulizia.'); return }
    if (timerNonRiportato) { setErrore(`Il timer segna ${testoCronometro(t!.trascorsi)}: premi «Ferma e riporta i minuti», scrivi i minuti effettivi oppure azzera il timer.`); return }
    if (!bozza.federeScelte) { setErrore('Scegli due o quattro federe per il matrimoniale.'); return }
    if (!bozza.data || bozza.data > oggi) { setErrore('Scegli la data in cui hai fatto la pulizia, fino a oggi.'); return }
    if (bozza.minuti !== null && (!Number.isInteger(bozza.minuti) || bozza.minuti < 1 || bozza.minuti > 1440)) { setErrore('I minuti vanno da 1 a 1440, oppure lascia il campo vuoto.'); return }
    if (oltre.length) { setErrore(`Da correggere prima di salvare: ${oltre.join(', ')}.`); return }
    // Il timer è cambiato dopo i minuti (un'altra sessione, un altro telefono):
    // si chiede di ricontrollarli; premendo di nuovo si conferma il valore scritto.
    const attuale = fotoTimer(t)
    if (chiave && !correzione && bozza.minuti !== null && visto !== undefined && !stessoTimer(visto, attuale)) {
      setVisto(attuale); setErrore(`${TIMER_CAMBIATO} Ora il timer segna ${testoCronometro(attuale?.trascorsi ?? 0)}.`); return
    }
    const timerInviato = bozza.minuti === null || visto === undefined ? attuale : visto
    blocco.current = true; setSalvando(true); setErrore('')
    const assetto = assettoPerSql(bozza.assetto)
    const recupero = bozza.recuperi ? recuperoPerSql(bozza.recuperi, bozza.senzaMisura) : null
    try {
      const esito = pendente ? await inviaOperazionePulizia(pulizia.room_id, null) : correzione
        ? await inviaOperazionePulizia(pulizia.room_id, { azione: 'dettagli', cleaning_id: pulizia.id!, versione: bozza.versione, versione_recupero: bozza.versioneRecupero, data_effettiva: bozza.data, assetto, minuti: bozza.minuti, recupero })
        : await inviaOperazionePulizia(pulizia.room_id, { azione: 'registra', ultima_id: ultimaId, recupero, pulizia: {
          room_id: pulizia.room_id, booking_id: pulizia.booking_id, tipo: pulizia.tipo, stato: 'fatta', data_prevista: pulizia.data_prevista,
          data_effettiva: bozza.data, prossima_data: null, cambio_biancheria: true, note: pulizia.note ?? null,
          persone_servite: Number(booking?.num_guests) || pulizia.persone_servite || null, assetto, minuti: bozza.minuti, ...(chiave ? { timer: timerInviato } : {}) } })
      try { setPendente(!!leggiOperazionePulizia(window.localStorage, pulizia.room_id)) } catch { setPendente(true) }
      if (esito.errore === TIMER_CAMBIATO) {
        // Niente salvato e timer non consumato: rileggo e mostro il tempo di adesso.
        await leggiTimer()
        const nuovo = fotoTimer(statoTimerAttuale().timer.find(x => x.chiave === chiave))
        setVisto(nuovo); setErrore(`${TIMER_CAMBIATO} Ora il timer segna ${testoCronometro(nuovo?.trascorsi ?? 0)}.`); return
      }
      if (esito.errore || !esito.risposta) { setErrore(esito.errore || 'Risposta incompleta. Premi Riprova per verificare il salvataggio.'); return }
      if (pendente) { setSalvato({ cosa: COSA_SALVATA.pulizia(camera), quando: new Date(), risposta: esito.risposta }); return }
      // Rilettura completa: la risposta deve coincidere con quanto inviato e con il database.
      const verifica = await verificaSalvataggio(esito.risposta, { data: bozza.data, assetto, minuti: bozza.minuti, recupero })
      if (verifica) { setErrore(verifica); return }
      // L'ora corretta a mano (0064): un secondo passo, con la versione appena riletta
      if (conRitocchi && bozza.ora && bozza.ora !== bozza.oraIniziale) {
        const o = await ritoccaPulizia({ azione: 'ora', cleaning_id: esito.risposta.pulizia.id!, versione: (esito.risposta.pulizia as { aggiornata_at?: string | null }).aggiornata_at ?? null, ora: oraPerSql(bozza.ora) })
        if (o.errore) { setErrore(`Letti, recuperi e minuti sono salvati; l’ora no: ${o.errore}`); return }
      }
      setSalvato({ cosa: COSA_SALVATA.pulizia(camera), quando: new Date(), risposta: esito.risposta })
    } finally { blocco.current = false; setSalvando(false) }
  }

  async function togli() {
    if (!bozza || blocco.current || !pulizia.id) return
    blocco.current = true; setSalvando(true); setErrore('')
    try {
      const e = await ritoccaPulizia({ azione: 'togli', cleaning_id: pulizia.id, versione: bozza.versione })
      if (e.errore) { setErrore(e.errore); return }
      setSalvato({ cosa: `Pulizia tolta · ${camera}`, quando: new Date(), risposta: null as unknown as RispostaPulizia })
    } finally { blocco.current = false; setSalvando(false) }
  }

  // La domanda di «togli»: stesso foglio, tasti «Annulla» (torna alla correzione) e «Togli»
  if (chiediTogli) return <FoglioPulizie dati="recupero" eyebrow={eyebrow} titolo={camera} destra={<>pulita il {dataCorta(bozza.data)}</>}
    onChiudi={onChiudi} onAnnulla={() => { setChiediTogli(false); setErrore('') }} mattone azione="Togli" onAzione={() => void togli()} salvando={salvando} disabilitato={!!salvato}
    salvato={salvato} onFineSalvato={() => { onTolta?.(pulizia.id!); ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); onChiudi() }}>
    <div data-domanda-togli>
      <p className="pul-togli">{domandaTogli(camera, bozza.data)}<small>{SPIEGA_TOGLI}</small></p>
      {errore && <p role="alert" className="pul-errore">{errore}</p>}
    </div>
  </FoglioPulizie>

  const a = bozza.assetto
  const tile = ([k, label]: [keyof PezziPulizie, string]) => {
    const n = bozza.recuperi?.[k] ?? 0
    return <button type="button" key={k} aria-label={`Recuperati ${VOCI_DOTAZIONE.find(v => v[0] === k)![1]}: ${n} su ${dotazione[k]}`} aria-pressed={n > 0} data-voce={k} data-valore={n}
      className={`pul-tile${n > 0 ? ' on' : ''}`} onClick={() => tocca(k)}><span>{label}</span><b>{n}<small> / {dotazione[k]}</small></b></button>
  }
  const visibile = ([k]: [keyof PezziPulizie, string]) => dotazione[k] > 0 || (bozza.recuperi?.[k] ?? 0) > 0
  const conMisura = dotazione.sotto_matrimoniale + dotazione.sopra_matrimoniale > 0 && dotazione.sotto_singolo + dotazione.sopra_singolo > 0
  const lenzuola = chipLenzuola(conMisura).filter(visibile)
  const asciugamani = CHIP_ASCIUGAMANI.filter(visibile)
  const preparati = totalePezzi(dotazione)
  // «fatta oggi» / «fatta il 30 set»: la parola sottolineata apre il calendario
  const giornoFatta = <span className="relative inline-block">
    <button type="button" className="u" data-data-scritta>{bozza.data === oggi && !correzione ? 'oggi' : dataCorta(bozza.data)}</button>
    <input aria-label="Fatta il" type="date" max={oggi} value={bozza.data} onChange={e => setBozza({ ...bozza, data: e.target.value })}
      onClick={e => apriSelettore(e.currentTarget)} style={{ position: 'absolute', inset: '-10px -6px', width: 'calc(100% + 12px)', opacity: 0, cursor: 'pointer' }} />
  </span>
  return <FoglioPulizie dati="recupero" eyebrow={eyebrow} titolo={camera}
    destra={correzione ? <>pulita il {giornoFatta}{bozza.ora && !conRitocchi && <> alle {bozza.ora}</>}{conRitocchi && <> alle <span className="relative inline-block">
      <button type="button" className="u" data-ora-scritta>{bozza.ora ?? '—'}</button>
      <input aria-label="Alle" type="time" value={bozza.ora ? oraPerSql(bozza.ora) : ''} onChange={e => setBozza({ ...bozza, ora: oraBreve(e.target.value) })}
        onClick={e => apriSelettore(e.currentTarget)} style={{ position: 'absolute', inset: '-10px -6px', width: 'calc(100% + 12px)', opacity: 0, cursor: 'pointer' }} />
    </span></>}</> : <>fatta {giornoFatta}</>}
    onChiudi={onChiudi} salvato={salvato} onFineSalvato={() => { if (salvato) onSalvato?.(salvato.risposta); ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); onChiudi() }}
    azione={pendente ? 'Riprova' : correzione ? 'Salva correzione' : 'Conferma pulizia'} onAzione={() => void salva()}
    salvando={salvando} disabilitato={!bozza.federeScelte || !bozza.data || bozza.data > oggi || !!salvato}>
    <div data-scheda-pulizia={camera} data-recuperati={recuperati ?? ''}>
      <p className="pul-lb"><span>Letti preparati</span><button type="button" onClick={() => setCambiaLetti(x => !x)} aria-expanded={cambiaLetti} data-cambia-letti>{cambiaLetti ? 'Chiudi' : 'Cambia'}</button></p>
      <p className="pul-ln1" data-letti>{lettiTesto(a) || 'nessun letto'} <small>· {a.ospiti} {a.ospiti === 1 ? 'ospite' : 'ospiti'}</small>{bozza.assettoDaConfermare && <em className="dc" data-da-confermare> · da confermare</em>}</p>
      {cambiaLetti && <div className="mz-g3" style={{ marginTop: 10 }}>{([['matrimoniali', 'Matrimoniali'], ['singoli', 'Singoli'], ['ospiti', 'Ospiti']] as const).map(([k, label]) => <label key={k}><span className="mz-lab">{label}</span><input className="mz-fld grande" type="number" inputMode="numeric" min={k === 'ospiti' ? 1 : 0} max={k === 'ospiti' ? 4 : k === 'matrimoniali' ? 1 : 2} value={a[k]} onChange={e => cambiaAssetto({ [k]: Number(e.target.value) })} /></label>)}</div>}
      {!!a.matrimoniali && <div className="pul-seg" role="group" aria-label="Federe sul matrimoniale" data-federe>{([2, 4] as const).map(n => <button type="button" key={n} aria-pressed={bozza.federeScelte && a.federeMatrimoniale === n} className={bozza.federeScelte && a.federeMatrimoniale === n ? 'on' : ''} onClick={() => { setBozza({ ...bozza, assetto: { ...a, federeMatrimoniale: n }, federeScelte: true, assettoDaConfermare: false }); setErrore('') }}>{n === 2 ? '2 federe' : '4 federe sul matrimoniale'}</button>)}</div>}
      {lenzuola.length > 0 && <><p className="pul-lb"><span>Recuperato · lenzuola</span></p><div className="pul-tiles">{lenzuola.map(tile)}</div></>}
      {asciugamani.length > 0 && <><p className="pul-lb"><span>Recuperato · asciugamani</span></p><div className="pul-tiles">{asciugamani.map(tile)}</div></>}
      <div className="pul-lav2">
        <div data-da-lavare={lavaggio ? totalePezzi(lavaggio) : ''}><b>{lavaggio ? totalePezzi(lavaggio) : '—'}</b><small>da lavare</small>
          <span>{recuperati === null ? 'recuperi non ancora annotati' : `${preparati} preparati − ${recuperati} recuperati`}</span></div>
        <div className="r" data-minuti-foglio={bozza.minuti ?? ''}>
          {timerInCorso && t ? <><CifreTimer t={t} scarto={timer.scarto} /><small>in corso</small></>
            : scriviMinuti ? <><input className="pul-min" type="number" inputMode="numeric" min="1" max="1440" autoFocus aria-label="Minuti effettivi" value={bozza.minuti ?? ''}
              onChange={e => { setBozza({ ...bozza, minuti: e.target.value === '' ? null : Number(e.target.value) }); setVisto(fotoTimer(t)) }} onBlur={() => setScriviMinuti(false)} /><small>min</small><span>scrivi i minuti</span></>
            : <button type="button" className="tocca" onClick={() => setScriviMinuti(true)} data-tocca-minuti>
              <b>{bozza.minuti ? `${bozza.minuti} min` : '— min'}</b><small>{bozza.minuti ? (correzione ? 'salvati' : visto && t && t.trascorsi > 0 ? 'dal timer' : 'scritti') : ''}</small>
              <span>{bozza.minuti ? 'tocca per correggere' : 'scrivi i minuti'}</span></button>}
        </div>
      </div>
      <p className="pul-nota" data-nota-recuperi>{bozza.recuperi ? 'Un tocco aggiunge un pezzo recuperato; dopo il massimo torna a zero.' : 'Recuperi non ancora annotati: puoi aggiungerli anche dopo.'} <button type="button" className="pul-az tn" style={{ fontSize: 10.5 }} onClick={() => setBozza({ ...bozza, recuperi: pezziVuoti() })} data-niente-recuperato>Niente recuperato</button></p>
      {chiave && <TimerPulizia foglio chiave={chiave} nome={camera} onMinuti={riportaMinuti} nomeCamera={nomeCamera ?? (() => null)} onVaiA={onVaiA} />}
      {correzione && <p className="pul-nota">Correzione: i minuti sono quelli salvati, nessun timer li sostituisce.</p>}
      {totaleSenzaMisura(bozza.senzaMisura) > 0 && <div className="pul-avviso" data-senza-misura><p>Nello storico: {bozza.senzaMisura.lenzuolo_sotto ? `${bozza.senzaMisura.lenzuolo_sotto} lenzuolo sotto` : ''}{bozza.senzaMisura.lenzuolo_sotto && bozza.senzaMisura.lenzuolo_sopra ? ' e ' : ''}{bozza.senzaMisura.lenzuolo_sopra ? `${bozza.senzaMisura.lenzuolo_sopra} lenzuolo sopra` : ''} senza misura. Restano così finché non li riporti sulla misura giusta.</p><button type="button" className="pul-az tn" style={{ marginTop: 6 }} onClick={() => setBozza({ ...bozza, senzaMisura: NESSUNO, recuperi: bozza.recuperi ?? pezziVuoti() })}>Riporta sulla misura</button></div>}
      {!!a.matrimoniali && !bozza.federeScelte && <p className="pul-avviso" data-federe-da-scegliere>Scegli due o quattro federe per il matrimoniale.</p>}
      {oltre.length > 0 && <p role="alert" className="pul-errore" data-recuperi-oltre>Recuperi oltre la dotazione di questi letti: {oltre.join(', ')}. Correggili prima di salvare.</p>}
            {timerNonRiportato && <p className="pul-avviso">Il timer segna {testoCronometro(t!.trascorsi)}: riporta i minuti prima di confermare.</p>}
      {pendente && <p role="status" className="pul-avviso">Un salvataggio di questa camera attende conferma: premi Riprova per verificarlo senza duplicarlo.</p>}
      {errore && <p role="alert" className="pul-errore">{errore}</p>}
      {conRitocchi && !pendente && <button type="button" className="pul-del" data-togli onClick={() => { setErrore(''); setChiediTogli(true) }}>Segnata per sbaglio · togli</button>}
    </div>
  </FoglioPulizie>
}

/** «Togli la pulizia di Allegra del 1 ottobre?» */
export const domandaTogli = (camera: string, giorno: string) => { const [, m, d] = giorno.split('-').map(Number); return `Togli la pulizia di ${camera} del ${d} ${MESI_LUNGHI[m - 1]}?` }
export const SPIEGA_TOGLI = 'I letti e i recuperati segnati spariscono dal registro e dalle statistiche.'

// Le cifre che corrono, nere, nel foglio (il timer della camera in corso)
function CifreTimer({ t, scarto }: { t: TimerSql; scarto: number }) {
  const [ora, setOra] = useState(0)
  useEffect(() => {
    const primo = window.setTimeout(() => setOra(Date.now()), 0)
    const giro = window.setInterval(() => setOra(Date.now()), 1000)
    return () => { window.clearTimeout(primo); window.clearInterval(giro) }
  }, [])
  return <b className="vivo" role="timer" aria-live="off">{testoCronometro(ora ? secondiTimer(t, ora, scarto) : t.trascorsi).padStart(5, '0')}</b>
}

// I chip del recuperato come nel riferimento (28/09/2026): «Federa, Sotto,
// Sopra» e «Telo doccia, Viso, Mani, Tappetino doccia, Tappeto bagno». Con un
// matrimoniale E un singolo le lenzuola dicono anche la misura.
function chipLenzuola(conMisura: boolean): [keyof PezziPulizie, string][] {
  return [['federe', 'Federa'],
    ['sotto_matrimoniale', conMisura ? 'Sotto matr.' : 'Sotto'], ['sopra_matrimoniale', conMisura ? 'Sopra matr.' : 'Sopra'],
    ['sotto_singolo', conMisura ? 'Sotto sing.' : 'Sotto'], ['sopra_singolo', conMisura ? 'Sopra sing.' : 'Sopra']]
}
const CHIP_ASCIUGAMANI: [keyof PezziPulizie, string][] = [['telo_doccia', 'Telo doccia'], ['asciugamano_viso', 'Viso'], ['asciugamano_mani', 'Mani'], ['scendidoccia', 'Tappetino doccia'], ['tappeto_bagno', 'Tappeto bagno']]
/** «30 set» */
function dataCorta(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return iso ? `${d} ${MESI_BREVI[m - 1]}` : 'da scegliere'
}

// Confronto fra quanto inviato, la risposta del database e una nuova lettura.
async function verificaSalvataggio(r: RispostaPulizia, atteso: { data: string; assetto: ReturnType<typeof assettoPerSql>; minuti: number | null; recupero: ReturnType<typeof recuperoPerSql> | null }): Promise<string | null> {
  const id = r.pulizia.id
  if (!id) return 'Risposta incompleta. Riapri la scheda per verificare.'
  const [c, rec] = await Promise.all([supabase.from('cleanings').select('*').eq('id', id).maybeSingle(), leggiRecuperiDellePulizie([id])])
  if (c.error || !c.data || rec.errore) return 'Salvato, ma non riesco a rileggerlo: riapri la scheda per controllare, senza ripetere la pulizia.'
  const riga = c.data as Decisione & { assetto?: unknown; dotazione?: unknown; minuti?: number | null }
  const letto = assettoDaSql(riga.assetto)
  const uguali = riga.stato === 'fatta' && riga.data_effettiva === atteso.data && (riga.minuti ?? null) === atteso.minuti
    && !!letto && JSON.stringify(assettoPerSql(letto)) === JSON.stringify(atteso.assetto)
    && JSON.stringify(pezziDaSql(riga.dotazione)) === JSON.stringify(dotazioneDaAssetto(letto))
  if (!uguali) return 'La rilettura non coincide con quanto salvato: riapri la scheda e controlla.'
  if (atteso.recupero) {
    const x = recuperoDaRiga(rec.righe[0] as unknown as Record<string, unknown>)
    if (!x || JSON.stringify(recuperoPerSql(x.pezzi, x.senzaMisura)) !== JSON.stringify(atteso.recupero)) return 'I recuperi riletti non coincidono: riapri la scheda e controlla.'
  }
  return null
}
