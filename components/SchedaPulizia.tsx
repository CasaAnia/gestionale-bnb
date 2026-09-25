'use client'
// Pop-up approvato da Ania il 25/09/2026 (riferimento congelato in outputs/riferimento-pulizie-approvato.zip, app/anteprima-pulizie):
// una sola scheda con dotazione, federe, recuperi a tocco, timer, minuti e
// conferma. Qui salva davvero: gestisci_pulizia (0059) scrive intervento,
// dotazione, recuperi e minuti nella stessa transazione, poi si rilegge
// tutto e si confronta con quanto inviato prima di dire «salvato».
import { useCallback, useEffect, useRef, useState } from 'react'
import TimerPulizia from './TimerPulizia'
import { supabase } from '@/lib/supabase'
import { leggiRecuperiDellePulizie } from '@/lib/biancheriaDati'
import { inviaOperazionePulizia } from '@/lib/pulizieServizio'
import { leggiOperazionePulizia, type RispostaPulizia } from '@/lib/pulizieOperazioni'
import { ricaricaNumeriOggiOvunque } from '@/lib/numeriOggiDati'
import { ricaricaDaControllare } from '@/lib/daControllareDati'
import { useTimerPulizie } from '@/lib/pulizieTempiDati'
import { chiaveTimerPulizia, testoCronometro } from '@/lib/tempoPulizie'
import type { Decisione, PrenotazionePulizie, TipoPulizia } from '@/lib/pulizie'
import {
  VOCI_DOTAZIONE, dotazioneDaAssetto, pezziVuoti, totalePezzi, daLavare, validaAssetto, assettoPerSql, assettoDaSql, pezziDaSql,
  recuperoDaRiga, recuperoPerSql, recuperiOltre, totaleSenzaMisura, proponiAssettoDaSoggiorno,
  type AssettoPulizia, type PezziPulizie, type SenzaMisura,
} from '@/lib/dotazionePulizie'

export const TIPI_INTERVENTO: Record<TipoPulizia, string> = { fine_soggiorno: 'Fine soggiorno', soggiorno: 'Durante il soggiorno', cambio_camera: 'Cambio camera' }
const classe = 'ed-pillola-contorno'
const NESSUNO: SenzaMisura = { lenzuolo_sotto: 0, lenzuolo_sopra: 0 }

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
  const [recuperoAperto, setRecuperoAperto] = useState(false)
  const [pendente, setPendente] = useState(false)
  const blocco = useRef(false)
  const timer = useTimerPulizie()
  const chiave = !correzione && pulizia.booking_id ? chiaveTimerPulizia(pulizia.booking_id, pulizia.tipo, pulizia.data_prevista) : null
  const t = chiave ? timer.timer.find(x => x.chiave === chiave) ?? null : null

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
      setRecuperoAperto(!!rec)
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
  const riportaMinuti = useCallback((n: number) => setBozza(b => b ? { ...b, minuti: n || null } : b), [])

  if (!bozza) return <Guscio camera={camera} tipo={pulizia.tipo} onChiudi={onChiudi}><p className="text-sm mt-4">{errore || 'Lettura della pulizia…'}</p></Guscio>

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
    blocco.current = true; setSalvando(true); setErrore('')
    const assetto = assettoPerSql(bozza.assetto)
    const recupero = bozza.recuperi ? recuperoPerSql(bozza.recuperi, bozza.senzaMisura) : null
    try {
      const esito = pendente ? await inviaOperazionePulizia(pulizia.room_id, null) : correzione
        ? await inviaOperazionePulizia(pulizia.room_id, { azione: 'dettagli', cleaning_id: pulizia.id!, versione: bozza.versione, versione_recupero: bozza.versioneRecupero, data_effettiva: bozza.data, assetto, minuti: bozza.minuti, recupero })
        : await inviaOperazionePulizia(pulizia.room_id, { azione: 'registra', ultima_id: ultimaId, recupero, pulizia: {
          room_id: pulizia.room_id, booking_id: pulizia.booking_id, tipo: pulizia.tipo, stato: 'fatta', data_prevista: pulizia.data_prevista,
          data_effettiva: bozza.data, prossima_data: null, cambio_biancheria: true, note: pulizia.note ?? null,
          persone_servite: Number(booking?.num_guests) || pulizia.persone_servite || null, assetto, minuti: bozza.minuti } })
      try { setPendente(!!leggiOperazionePulizia(window.localStorage, pulizia.room_id)) } catch { setPendente(true) }
      if (esito.errore || !esito.risposta) { setErrore(esito.errore || 'Risposta incompleta. Premi Riprova per verificare il salvataggio.'); return }
      if (pendente) { onSalvato?.(esito.risposta); ricaricaNumeriOggiOvunque(); void ricaricaDaControllare(); onChiudi(); return }
      // Rilettura completa: la risposta deve coincidere con quanto inviato e con il database.
      const verifica = await verificaSalvataggio(esito.risposta, { data: bozza.data, assetto, minuti: bozza.minuti, recupero })
      if (verifica) { setErrore(verifica); return }
      onSalvato?.(esito.risposta)
      ricaricaNumeriOggiOvunque(); void ricaricaDaControllare()
      onChiudi()
    } finally { blocco.current = false; setSalvando(false) }
  }

  const a = bozza.assetto
  return <Guscio camera={camera} tipo={pulizia.tipo} onChiudi={salvando ? () => {} : onChiudi}>
    <p className="text-sm text-stone mt-2">Dotazione del soggiorno che stai pulendo. Questi numeri resteranno nel registro.</p>
    {bozza.assettoDaConfermare && <p className="text-sm mt-2" data-da-confermare>Letti non documentati: questa è una proposta dal soggiorno, da confermare.</p>}
    <label className="block text-sm mt-4">Fatta il<input className="ed-campo mt-1 block" type="date" max={oggi} value={bozza.data} onChange={e => setBozza({ ...bozza, data: e.target.value })} /></label>
    <div className="grid grid-cols-3 gap-3 mt-4">{([['matrimoniali', 'Matrimoniali'], ['singoli', 'Singoli'], ['ospiti', 'Ospiti']] as const).map(([k, label]) => <label key={k} className="text-xs">{label}<input className="ed-campo w-full mt-1" type="number" inputMode="numeric" min={k === 'ospiti' ? 1 : 0} max={k === 'ospiti' ? 4 : k === 'matrimoniali' ? 1 : 2} value={a[k]} onChange={e => cambiaAssetto({ [k]: Number(e.target.value) })} /></label>)}</div>
    {!!a.matrimoniali && <div className="mt-4"><p className="text-sm mb-2">Federe sul matrimoniale{!bozza.federeScelte ? ' · scegli per questa pulizia' : ''}</p><div className="flex gap-3">{([2, 4] as const).map(n => <button type="button" key={n} aria-pressed={bozza.federeScelte && a.federeMatrimoniale === n} className={bozza.federeScelte && a.federeMatrimoniale === n ? 'ed-pillola' : classe} onClick={() => { setBozza({ ...bozza, assetto: { ...a, federeMatrimoniale: n }, federeScelte: true, assettoDaConfermare: false }); setErrore('') }}>{n} federe</button>)}</div></div>}
    <p className="text-sm mt-3" data-dotazione={totalePezzi(dotazione)}>{dotazione.federe} federe totali · {a.ospiti} {a.ospiti === 1 ? 'completo' : 'completi'} asciugamani · 1 tappeto bagno · 1 scendidoccia</p>
    <div className="ed-riga py-4 mt-4"><button type="button" className={classe} aria-expanded={recuperoAperto} onClick={() => setRecuperoAperto(!recuperoAperto)}>{recuperoAperto ? 'Chiudi quantità' : 'Segna il recuperato'}</button><button type="button" className={`${classe} ml-2 mt-2`} onClick={() => { setBozza({ ...bozza, recuperi: pezziVuoti() }); setRecuperoAperto(false) }}>Niente recuperato</button><p className="text-xs text-stone mt-2" data-recuperati={bozza.recuperi ? totalePezzi(bozza.recuperi) : ''}>{bozza.recuperi ? (totalePezzi(bozza.recuperi) === 0 ? 'Niente recuperato' : totalePezzi(bozza.recuperi) === 1 ? '1 pezzo recuperato' : `${totalePezzi(bozza.recuperi)} pezzi recuperati`) : 'Recuperi non ancora annotati: puoi aggiungerli anche dopo.'}</p></div>
    {totaleSenzaMisura(bozza.senzaMisura) > 0 && <div className="text-sm py-2" data-senza-misura><p>Nello storico: {bozza.senzaMisura.lenzuolo_sotto ? `${bozza.senzaMisura.lenzuolo_sotto} lenzuolo sotto` : ''}{bozza.senzaMisura.lenzuolo_sotto && bozza.senzaMisura.lenzuolo_sopra ? ' e ' : ''}{bozza.senzaMisura.lenzuolo_sopra ? `${bozza.senzaMisura.lenzuolo_sopra} lenzuolo sopra` : ''} senza misura. Restano così finché non li riporti sulla misura giusta.</p><button type="button" className={`${classe} mt-2`} onClick={() => { setBozza({ ...bozza, senzaMisura: NESSUNO, recuperi: bozza.recuperi ?? pezziVuoti() }); setRecuperoAperto(true) }}>Riporta sulla misura</button></div>}
    {recuperoAperto && <div className="flex flex-wrap gap-3 py-3">{VOCI_DOTAZIONE.filter(([k]) => dotazione[k] > 0 || (bozza.recuperi?.[k] ?? 0) > 0).map(([k, label]) => { const n = bozza.recuperi?.[k] ?? 0; return <button type="button" key={k} aria-label={`Recuperati ${label}: ${n} su ${dotazione[k]}`} aria-pressed={n > 0} data-voce={k} data-valore={n} className={n > 0 ? 'ed-pillola' : classe} onClick={() => tocca(k)}>{label} · {n}</button> })}<p className="text-xs text-stone w-full">Un tocco aggiunge un pezzo recuperato; dopo il massimo torna a zero.</p></div>}
    {oltre.length > 0 && <p role="alert" className="text-sm text-red-800 mt-2" data-recuperi-oltre>Recuperi oltre la dotazione di questi letti: {oltre.join(', ')}. Correggili prima di salvare.</p>}
    {lavaggio && <p className="text-sm mt-3" data-da-lavare={totalePezzi(lavaggio)}>{totalePezzi(dotazione)} preparati − {totalePezzi(bozza.recuperi!)} recuperati = <strong>{totalePezzi(lavaggio)} pezzi da lavare</strong></p>}
    {chiave && <TimerPulizia chiave={chiave} nome={camera} onMinuti={riportaMinuti} nomeCamera={nomeCamera} onVaiA={onVaiA} />}
    {correzione && <p className="text-xs text-stone mt-4">Correzione: i minuti qui sotto sono quelli salvati, nessun timer li sostituisce.</p>}
    <label className="block text-sm mt-4">Minuti effettivi <span className="text-stone">· facoltativi</span><input className="ed-campo w-24 block mt-2" type="number" inputMode="numeric" min="1" max="1440" value={bozza.minuti ?? ''} onChange={e => setBozza({ ...bozza, minuti: e.target.value === '' ? null : Number(e.target.value) })} /></label>
    {timerNonRiportato && <p className="text-xs text-stone mt-2">Il timer segna {testoCronometro(t!.trascorsi)}: riporta i minuti prima di confermare.</p>}
    {pendente && <p role="status" className="text-sm mt-3">Un salvataggio di questa camera attende conferma: premi Riprova per verificarlo senza duplicarlo.</p>}
    {errore && <p role="alert" className="text-red-800 my-3">{errore}</p>}
    <div className="flex justify-end gap-3 mt-6"><button type="button" className={classe} disabled={salvando} onClick={onChiudi}>Annulla</button><button type="button" className="ed-pillola disabled:opacity-40" disabled={!bozza.federeScelte || salvando || !bozza.data || bozza.data > oggi} onClick={() => void salva()}>{salvando ? 'Salvo…' : pendente ? 'Riprova' : correzione ? 'Salva correzione' : 'Conferma pulizia'}</button></div>
  </Guscio>
}

function Guscio({ camera, tipo, onChiudi, children }: { camera: string; tipo: TipoPulizia; onChiudi: () => void; children: React.ReactNode }) {
  const scheda = useRef<HTMLDivElement>(null)
  const chiudi = useRef(onChiudi)
  useEffect(() => { chiudi.current = onChiudi }, [onChiudi])
  // Il fuoco entra nella scheda all'apertura e torna al comando che l'ha aperta.
  useEffect(() => {
    const prima = document.activeElement as HTMLElement | null
    scheda.current?.focus()
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') chiudi.current() }
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('keydown', esc); prima?.focus?.() }
  }, [])
  return <div className="fixed inset-0 z-[80] bg-black/40 flex items-end sm:items-center justify-center p-3" role="dialog" aria-modal="true" aria-label={`Pulizia ${camera}`} data-scheda-pulizia={camera}>
    <div ref={scheda} tabIndex={-1} className="w-full max-w-xl max-h-[90dvh] overflow-y-auto bg-cream p-5 rounded-2xl shadow-lg outline-none">
      <h2 className="font-serif text-2xl">{camera} · {TIPI_INTERVENTO[tipo]}</h2>
      {children}
    </div>
  </div>
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
