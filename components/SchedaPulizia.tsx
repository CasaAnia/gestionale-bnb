'use client'
// Pop-up approvato da Ania il 25/09/2026 (riferimento congelato in outputs/riferimento-pulizie-approvato.zip, app/anteprima-pulizie):
// una sola scheda con dotazione, federe, recuperi a tocco, timer, minuti e
// conferma. Qui salva davvero: gestisci_pulizia (0059) scrive intervento,
// dotazione, recuperi e minuti nella stessa transazione, poi si rilegge
// tutto e si confronta con quanto inviato prima di dire «salvato».
import { useCallback, useEffect, useRef, useState } from 'react'
import TimerPulizia from './TimerPulizia'
import FoglioMaison, { PiedeMaison } from './maison/FoglioMaison'
import type { Salvataggio } from './maison/SalvatoMaison'
import { COSA_SALVATA } from '@/lib/salvatoMaison'
import { apriSelettore } from './nuova/CampoData'
import { MESI_LUNGHI } from '@/lib/dateItaliane'
import { supabase } from '@/lib/supabase'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { leggiOperazionePulizia, TIMER_CAMBIATO, type RispostaPulizia, type TimerVisto } from '@/lib/pulizieOperazioni'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { useTimerPulizie, leggiTimer, statoTimerAttuale } from '@/lib/pulizieTempiDati'
import { chiaveTimerPulizia, testoCronometro, type TimerSql } from '@/lib/tempoPulizie'
import type { Decisione, PrenotazionePulizie, TipoPulizia } from '@/lib/pulizie'
import {
  VOCI_DOTAZIONE, dotazioneDaAssetto, pezziVuoti, totalePezzi, daLavare, validaAssetto, assettoPerSql, assettoDaSql, pezziDaSql,
  recuperoDaRiga, recuperoPerSql, recuperiOltre, totaleSenzaMisura, proponiAssettoDaSoggiorno,
  type AssettoPulizia, type PezziPulizie, type SenzaMisura,
} from '@/lib/dotazionePulizie'

export const TIPI_INTERVENTO: Record<TipoPulizia, string> = { fine_soggiorno: 'Fine soggiorno', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
/** Il foglio ha un'altezza fissa, quella del caso più lungo (letti, federe, due file di chip, timer) */
export const ALTEZZA_FOGLIO_PULIZIA = 780
const NESSUNO: SenzaMisura = { lenzuolo_sotto: 0, lenzuolo_sopra: 0 }
// Fotografia del timer che si vedeva quando si sono scritti o riportati i minuti.
const fotoTimer = (t: TimerSql | null | undefined): TimerVisto | null => t ? { versione: Number(t.versione), trascorsi: Number(t.trascorsi) } : null
const stessoTimer = (a: TimerVisto | null, b: TimerVisto | null) => (a?.versione ?? null) === (b?.versione ?? null) && (a?.trascorsi ?? 0) === (b?.trascorsi ?? 0)

type Bozza = {
  data: string; assetto: AssettoPulizia; assettoDaConfermare: boolean; federeScelte: boolean
  recuperi: PezziPulizie | null; senzaMisura: SenzaMisura; minuti: number | null
  versione: string | null; versioneRecupero: string | null
}

export default function SchedaPulizia({ camera, pulizia, booking, oggi, ultimaId, onChiudi, onSalvato, nomeCamera, onVaiA }: {
  camera: string                       // nome breve («Amelia»)
  pulizia: Decisione                   // da confermare (senza id) o già confermata
  booking?: PrenotazionePulizie | null // assente: si legge dal database (Home)
  oggi: string; ultimaId: string | null
  onChiudi: () => void; onSalvato?: (r: RispostaPulizia) => void
  nomeCamera: (bookingId: string) => string | null; onVaiA?: (chiave: string) => void
}) {
  // Le proprietà dell'apertura si fissano: un nuovo disegno della pagina non riapre la scheda.
  const [iniziale] = useState(() => ({ pulizia, booking }))
  const correzione = !!pulizia.id && pulizia.stato === 'fatta'
  const [bozza, setBozza] = useState<Bozza | null>(null)
  const [errore, setErrore] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [pendente, setPendente] = useState(false)
  // Conferma B (28/09/2026): dopo il salvataggio la spunta, poi il foglio si chiude da solo
  const [salvato, setSalvato] = useState<(Salvataggio & { risposta: RispostaPulizia }) | null>(null)
  const blocco = useRef(false)
  const timer = useTimerPulizie()
  const chiave = !correzione && pulizia.booking_id ? chiaveTimerPulizia(pulizia.booking_id, pulizia.tipo, pulizia.data_prevista) : null
  const t = chiave ? timer.timer.find(x => x.chiave === chiave) ?? null : null
  // undefined = minuti mai scritti né riportati in questa scheda
  const [visto, setVisto] = useState<TimerVisto | null | undefined>(undefined)
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
        if (viva) setBozza({ data: oggi, assetto, assettoDaConfermare: !proposta, federeScelte: !(assetto.matrimoniali && assetto.ospiti === 1), recuperi: null, senzaMisura: NESSUNO, minuti: null, versione: null, versioneRecupero: null })
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
        versione: riga.aggiornata_at ?? null, versioneRecupero: r.righe[0]?.updated_at ?? null })
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

  const sottotitolo = `${TIPI_INTERVENTO[pulizia.tipo]} · ${correzione ? 'Correzione' : 'Pulita e recuperato'}`
  if (!bozza) return <FoglioMaison titolo={camera} sottotitolo={sottotitolo} altezza={ALTEZZA_FOGLIO_PULIZIA} onChiudi={onChiudi} dati="pulizia">
    <p className="mz-hint" style={{ marginTop: 16 }}>{errore || 'Lettura della pulizia…'}</p>
  </FoglioMaison>

  const dotazione = dotazioneDaAssetto(bozza.assetto)
  const oltre = bozza.recuperi ? recuperiOltre(dotazione, bozza.recuperi, bozza.senzaMisura) : []
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
      setSalvato({ cosa: COSA_SALVATA.pulizia(camera), quando: new Date(), risposta: esito.risposta })
    } finally { blocco.current = false; setSalvando(false) }
  }

  const a = bozza.assetto
  const pezzi = bozza.recuperi ? totalePezzi(bozza.recuperi) : null
  const testoPezzi = pezzi === null ? '' : pezzi === 0 ? 'Niente recuperato' : pezzi === 1 ? '1 pezzo recuperato' : `${pezzi} pezzi recuperati`
  const chip = ([k, label]: [keyof PezziPulizie, string]) => {
    const n = bozza.recuperi?.[k] ?? 0
    return <button type="button" key={k} aria-label={`Recuperati ${VOCI_DOTAZIONE.find(v => v[0] === k)![1]}: ${n} su ${dotazione[k]}`} aria-pressed={n > 0} data-voce={k} data-valore={n}
      className={`mz-chip ${n > 0 ? 'on' : ''}`} onClick={() => tocca(k)}>{label}{n > 0 && <b>{n}</b>}</button>
  }
  const visibile = ([k]: [keyof PezziPulizie, string]) => dotazione[k] > 0 || (bozza.recuperi?.[k] ?? 0) > 0
  const conMisura = dotazione.sotto_matrimoniale + dotazione.sopra_matrimoniale > 0 && dotazione.sotto_singolo + dotazione.sopra_singolo > 0
  const lenzuola = chipLenzuola(conMisura).filter(visibile)
  const asciugamani = CHIP_ASCIUGAMANI.filter(visibile)
  return <FoglioMaison titolo={camera} sottotitolo={sottotitolo} altezza={ALTEZZA_FOGLIO_PULIZIA} dati="pulizia"
    onChiudi={salvando || salvato ? () => {} : onChiudi}
    salvato={salvato} onFineSalvato={() => { if (salvato) onSalvato?.(salvato.risposta); ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); onChiudi() }}
    piede={<PiedeMaison azione={pendente ? 'Riprova' : correzione ? 'Salva correzione' : 'Conferma pulizia'} onAzione={() => void salva()} onAnnulla={onChiudi}
      salvando={salvando} disabilitato={!bozza.federeScelte || !bozza.data || bozza.data > oggi || !!salvato}
      totale={<span data-recuperati={bozza.recuperi ? totalePezzi(bozza.recuperi) : ''}>{testoPezzi}</span>} dati="pulizia" />}>
    <div data-scheda-pulizia={camera}>
    <p className="mz-hint">Dotazione del soggiorno che stai pulendo. Questi numeri resteranno nel registro.</p>
    {bozza.assettoDaConfermare && <p className="mz-hint" data-da-confermare>Letti non documentati: questa è una proposta dal soggiorno, da confermare.</p>}
    <label className="block">
      <span className="mz-lab">Fatta il</span>
      <span className="relative block">
        <span className="mz-fld" data-data-scritta>{dataFatta(bozza.data)}</span>
        <input aria-label="Fatta il" type="date" max={oggi} value={bozza.data} onChange={e => setBozza({ ...bozza, data: e.target.value })}
          onClick={e => apriSelettore(e.currentTarget)} style={{ position: 'absolute', inset: '-8px 0', width: '100%', opacity: 0, cursor: 'pointer' }} />
      </span>
    </label>
    <div className="mz-g3" style={{ marginTop: 16 }}>{([['matrimoniali', 'Matrimoniali'], ['singoli', 'Singoli'], ['ospiti', 'Ospiti']] as const).map(([k, label]) => <label key={k}><span className="mz-lab">{label}</span><input className="mz-fld grande" type="number" inputMode="numeric" min={k === 'ospiti' ? 1 : 0} max={k === 'ospiti' ? 4 : k === 'matrimoniali' ? 1 : 2} value={a[k]} onChange={e => cambiaAssetto({ [k]: Number(e.target.value) })} /></label>)}</div>
    {!!a.matrimoniali && <><span className="mz-lab">Federe sul matrimoniale{!bozza.federeScelte ? ' · scegli per questa pulizia' : ''}</span><div className="mz-seg">{([2, 4] as const).map(n => <button type="button" key={n} aria-pressed={bozza.federeScelte && a.federeMatrimoniale === n} className={bozza.federeScelte && a.federeMatrimoniale === n ? 'on' : ''} onClick={() => { setBozza({ ...bozza, assetto: { ...a, federeMatrimoniale: n }, federeScelte: true, assettoDaConfermare: false }); setErrore('') }}>{n} federe</button>)}</div></>}
    <p className="mz-note" data-dotazione={totalePezzi(dotazione)}>{dotazione.federe} federe totali · {a.ospiti} {a.ospiti === 1 ? 'completo' : 'completi'} asciugamani · 1 tappeto bagno · 1 scendidoccia</p>
    {totaleSenzaMisura(bozza.senzaMisura) > 0 && <div className="mz-note" data-senza-misura><p>Nello storico: {bozza.senzaMisura.lenzuolo_sotto ? `${bozza.senzaMisura.lenzuolo_sotto} lenzuolo sotto` : ''}{bozza.senzaMisura.lenzuolo_sotto && bozza.senzaMisura.lenzuolo_sopra ? ' e ' : ''}{bozza.senzaMisura.lenzuolo_sopra ? `${bozza.senzaMisura.lenzuolo_sopra} lenzuolo sopra` : ''} senza misura. Restano così finché non li riporti sulla misura giusta.</p><button type="button" className="mz-lnk q" style={{ marginTop: 6 }} onClick={() => setBozza({ ...bozza, senzaMisura: NESSUNO, recuperi: bozza.recuperi ?? pezziVuoti() })}>Riporta sulla misura</button></div>}
    {lenzuola.length > 0 && <><span className="mz-lab">Recuperato · Lenzuola</span><div className="mz-chips">{lenzuola.map(chip)}</div></>}
    {asciugamani.length > 0 && <><span className="mz-lab">Recuperato · Asciugamani</span><div className="mz-chips">{asciugamani.map(chip)}</div></>}
    <p className="mz-note">Un tocco aggiunge un pezzo recuperato; dopo il massimo torna a zero.{bozza.recuperi ? '' : ' Recuperi non ancora annotati: puoi aggiungerli anche dopo.'} <button type="button" className="mz-lnk q" onClick={() => setBozza({ ...bozza, recuperi: pezziVuoti() })}>Niente recuperato</button></p>
    {oltre.length > 0 && <p role="alert" className="mz-errore" data-recuperi-oltre>Recuperi oltre la dotazione di questi letti: {oltre.join(', ')}. Correggili prima di salvare.</p>}
    {lavaggio && <p className="mz-note" data-da-lavare={totalePezzi(lavaggio)}>{totalePezzi(dotazione)} preparati − {totalePezzi(bozza.recuperi!)} recuperati = <strong style={{ fontWeight: 500, color: 'var(--m-ink)' }}>{totalePezzi(lavaggio)} pezzi da lavare</strong></p>}
    {chiave && <TimerPulizia maison chiave={chiave} nome={camera} onMinuti={riportaMinuti} nomeCamera={nomeCamera} onVaiA={onVaiA} />}
    {correzione && <p className="mz-note">Correzione: i minuti qui sotto sono quelli salvati, nessun timer li sostituisce.</p>}
    <label className="block"><span className="mz-lab">Minuti effettivi · facoltativi</span><input className="mz-fld" style={{ width: 80 }} type="number" inputMode="numeric" min="1" max="1440" value={bozza.minuti ?? ''} onChange={e => { setBozza({ ...bozza, minuti: e.target.value === '' ? null : Number(e.target.value) }); setVisto(fotoTimer(t)) }} /></label>
    {timerNonRiportato && <p className="mz-note">Il timer segna {testoCronometro(t!.trascorsi)}: riporta i minuti prima di confermare.</p>}
    {pendente && <p role="status" className="mz-note">Un salvataggio di questa camera attende conferma: premi Riprova per verificarlo senza duplicarlo.</p>}
    {errore && <p role="alert" className="mz-errore">{errore}</p>}
    </div>
  </FoglioMaison>
}

// I chip del recuperato come nel riferimento (28/09/2026): «Federa, Sotto,
// Sopra» e «Telo doccia, Viso, Mani, Tappetino doccia, Tappeto bagno». Con un
// matrimoniale E un singolo le lenzuola dicono anche la misura.
function chipLenzuola(conMisura: boolean): [keyof PezziPulizie, string][] {
  return [['federe', 'Federa'],
    ['sotto_matrimoniale', conMisura ? 'Sotto matrimoniale' : 'Sotto'], ['sopra_matrimoniale', conMisura ? 'Sopra matrimoniale' : 'Sopra'],
    ['sotto_singolo', conMisura ? 'Sotto singolo' : 'Sotto'], ['sopra_singolo', conMisura ? 'Sopra singolo' : 'Sopra']]
}
const CHIP_ASCIUGAMANI: [keyof PezziPulizie, string][] = [['telo_doccia', 'Telo doccia'], ['asciugamano_viso', 'Viso'], ['asciugamano_mani', 'Mani'], ['scendidoccia', 'Tappetino doccia'], ['tappeto_bagno', 'Tappeto bagno']]
/** «28 settembre 2026» */
function dataFatta(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return iso ? `${d} ${MESI_LUNGHI[m - 1]} ${y}` : 'da scegliere'
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
