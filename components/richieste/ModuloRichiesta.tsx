'use client'
import { conIniziali, maiuscoleNelCampo } from '@/lib/maiuscole'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import StrisciaNotti from '@/components/StrisciaNotti'
import { supabase } from '@/lib/supabase'
import { frasiDisponibilita, notti, ordinaCamere, type PrenotazioneMinima } from '@/lib/disponibilita'
import { selezioneNottiValida, elencoNotti } from '@/lib/nottiRichieste'
import { giorniTra } from '@/lib/richiesteCalendario'
import { capienzaCamera } from '@/lib/tariffe'
import { riassuntoPersone, type CanaleRichiesta, type ValoriModifica } from '@/lib/richieste'
import { normalizzaTelefono, telefonoLeggibile } from '@/lib/whatsapp'
import CampoProvenienza from '@/components/CampoProvenienza'
import { campiProvenienza, normalizzaProvenienza, type Provenienza, type StrutturaNota } from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura, cercaClientePerTelefono, salvaProvenienzaCliente, type ClienteTrovato } from '@/lib/provenienzaDati'
import { etichettaGiaStato } from '@/lib/clienteCheTorna'
import { ETICHETTA_RICEVUTA_BREVE } from '@/lib/valutazione'

// Il modulo della richiesta (pezzo 9): lo STESSO per «Nuova richiesta» e per
// «Modifica» (precompilato). Sotto «Persone», appena arrivo e partenza sono
// validi, la striscia delle notti: ogni notte parte dal valore di Persone; un
// tocco cicla 1 → … → massimo (la capienza più alta fra le camere con brande).
// Il valore salvato è null quando tutte le notti sono uguali a Persone.

type Camera = { id: string; name: string; active: boolean; has_extra_bed?: boolean | null; base_price?: number | string | null; double_price?: number | string | null }

export type ValoriModulo = {
  canale: CanaleRichiesta
  nome: string; cognome: string
  arrivo: string; partenza: string
  persone: number
  nottiRichieste?: string[] | null
  personePerNotte: number[] | null
  cameraId: string
  telefono: string
  note: string
  // Provenienza (08/09/2026): «Come ci ha trovato» + nome della struttura
  provenienza: Provenienza
  struttura: string
}

const INPUT = 'w-full min-w-0 appearance-none bg-white ed-campo p-3 text-[15px] focus:outline-none focus:border-green-mid'
const ETICHETTA = 'text-sm text-stone mb-1'
const MAX_PERSONE_SENZA_CAMERE = 4

// Giorno dopo, senza passare dal fuso orario del telefono.
function giornoDopo(iso: string): string {
  const t = Date.parse(iso + 'T00:00:00Z')
  return Number.isNaN(t) ? '' : new Date(t + 86400000).toISOString().slice(0, 10)
}

export const VALORI_VUOTI: ValoriModulo = { canale: 'telefono', nome: '', cognome: '', arrivo: '', partenza: '', persone: 1, personePerNotte: null, cameraId: '', telefono: '', note: '', provenienza: 'non_so', struttura: '' }

// Dai valori del modulo a quelli da salvare (stessa normalizzazione del telefono della proposta WhatsApp)
// conProvenienza = colonne della 0036 disponibili: solo allora i campi entrano nel payload
export function valoriDaSalvare(v: ValoriModulo, conProvenienza = false): ValoriModifica {
  return {
    nome: conIniziali(v.nome), cognome: conIniziali(v.cognome), arrivo: v.arrivo, partenza: v.partenza,
    persone: v.persone, persone_per_notte: v.personePerNotte,
    ...(v.nottiRichieste != null ? { notti_richieste: v.nottiRichieste } : {}),
    camera_id: v.cameraId || null, canale: v.canale,
    telefono: telefonoLeggibile(normalizzaTelefono(v.telefono)) || null,
    note: v.note.trim() || null,
    ...(conProvenienza ? campiProvenienza(v.provenienza, v.struttura) : {}),
  }
}

// Le persone per notte «pulite»: null se tutte uguali al valore base
export function normalizzaPersonePerNotte(perNotte: number[] | null, base: number, nottiN: number): number[] | null {
  if (!perNotte || perNotte.length !== nottiN) return null
  return perNotte.every(x => x === base) ? null : perNotte
}

export default function ModuloRichiesta({ iniziale, etichettaSalva, onSalva, notaSotto }: {
  iniziale?: ValoriModulo
  etichettaSalva: string
  onSalva: (valori: ValoriModifica) => Promise<string | null>   // torna l'errore da mostrare, oppure null
  notaSotto?: string
}) {
  const [v, setV] = useState<ValoriModulo>(iniziale ?? VALORI_VUOTI)
  const [camere, setCamere] = useState<Camera[]>([])
  const [occupazione, setOccupazione] = useState<{ chiave: string; prenotazioni: PrenotazioneMinima[]; errore: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const [avviso, setAvviso] = useState<string | null>(null)
  // Strutture note (0036): disponibile = false finché la migrazione non c'è
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const set = <K extends keyof ValoriModulo>(k: K, val: ValoriModulo[K]) => setV(x => ({ ...x, [k]: val }))

  useEffect(() => {
    let vivo = true
    leggiStrutture().then(r => { if (vivo) { setStrutture({ disponibile: r.disponibile, lista: r.strutture }); if (r.errore) setAvviso(r.errore) } })
    return () => { vivo = false }
  }, [])

  // Provenienza del CLIENTE (0037): se il telefono è di un cliente esistente
  // i chip si precompilano con la sua provenienza (una volta per cliente) e
  // accanto compare «Già stato da noi · N soggiorni»
  const [cliente, setCliente] = useState<ClienteTrovato | null>(null)
  const precompilatoPer = useRef<string | null>(null)
  useEffect(() => {
    const tel = v.telefono.trim()
    let vivo = true
    const t = setTimeout(() => {
      if (!tel) { setCliente(null); return }
      const oggi = new Date(); const iso = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}-${String(oggi.getDate()).padStart(2, '0')}`
      cercaClientePerTelefono(tel, iso).then(c => {
        if (!vivo) return
        setCliente(c)
        if (c && c.conColonne && precompilatoPer.current !== c.id) {
          precompilatoPer.current = c.id
          setV(x => ({ ...x, provenienza: normalizzaProvenienza(c.provenienza), struttura: c.struttura_nome ?? '' }))
        }
      })
    }, 400)
    return () => { vivo = false; clearTimeout(t) }
  }, [v.telefono])

  useEffect(() => {
    supabase.from('rooms').select('id, name, active, has_extra_bed, base_price, double_price').eq('active', true).then(({ data, error }) => {
      if (error) setErrore(`Camere non caricate: ${error.message}`)
      setCamere(ordinaCamere((data || []) as Camera[]))
    })
  }, [])

  const { arrivo, partenza, persone } = v
  const dateValide = notti(arrivo, partenza) > 0
  const nottiN = dateValide ? notti(arrivo, partenza) : 0
  // massimo per notte: la capienza più alta fra le camere con brande (Lena: 4)
  const maxPersone = useMemo(() => Math.max(MAX_PERSONE_SENZA_CAMERE, ...camere.filter(c => c.has_extra_bed).map(c => capienzaCamera(c))), [camere])

  // Riga indicativa: SOLO prenotazioni confermate/completate che si sovrappongono.
  useEffect(() => {
    if (!dateValide) return
    const chiave = `${arrivo}|${partenza}`
    let alive = true
    supabase.from('bookings')
      .select('room_id, check_in, check_out, status, num_guests, extra_bed, extra_bed_dates')
      .in('status', ['confermata', 'completata'])
      .lt('check_in', partenza).gt('check_out', arrivo)
      .then(({ data, error }) => {
        if (!alive) return
        setOccupazione({ chiave, prenotazioni: (data || []) as PrenotazioneMinima[], errore: error ? error.message : null })
      })
    return () => { alive = false }
  }, [arrivo, partenza, dateValide])

  const personeMax = v.personePerNotte ? Math.max(...v.personePerNotte) : persone
  const rigaDisponibilita = dateValide && occupazione && occupazione.chiave === `${arrivo}|${partenza}`
    ? (v.nottiRichieste ? `${v.nottiRichieste.length} notti scelte: disponibilità verificata nella proposta` : occupazione.errore ? `${nottiN} notti · disponibilità non leggibile (${occupazione.errore})` : frasiDisponibilita(camere, occupazione.prenotazioni, arrivo, partenza, personeMax))
    : (dateValide ? `${nottiN === 1 ? '1 notte' : `${nottiN} notti`} · controllo le camere…` : '')

  // Le date cambiano → le notti cambiano: la striscia riparte da «Persone»
  // (una striscia con un numero diverso di caselle sarebbe un dato incoerente)
  function cambiaArrivo(val: string) {
    setV(x => { const fine = val && (!x.partenza || x.partenza <= val) ? giornoDopo(val) : x.partenza; return { ...x, arrivo: val, partenza: fine, personePerNotte: null, ...(x.nottiRichieste != null ? { nottiRichieste: x.nottiRichieste.filter(g => g >= val && g < fine) } : {}) } })
  }
  function cambiaPartenza(val: string) { setV(x => ({ ...x, partenza: val, personePerNotte: null, ...(x.nottiRichieste != null ? { nottiRichieste: x.nottiRichieste.filter(g => g >= x.arrivo && g < val) } : {}) })) }
  function cambiaPersone(n: number) { setV(x => ({ ...x, persone: n, personePerNotte: null })) }
  const valoriStriscia = v.personePerNotte ?? Array.from({ length: nottiN }, () => persone)

  async function salva() {
    setErrore(null)
    if (!v.nome.trim() || !v.cognome.trim()) { setErrore('Nome e cognome sono obbligatori.'); return }
    if (!arrivo || !partenza) { setErrore('Indica arrivo e partenza.'); return }
    if (partenza <= arrivo) { setErrore('La partenza deve essere almeno una notte dopo l’arrivo.'); return }
    if (v.nottiRichieste != null && !selezioneNottiValida(v.nottiRichieste, arrivo, partenza)) { setErrore('Seleziona almeno una notte compresa nelle date della richiesta.'); return }
    if (v.personePerNotte && v.personePerNotte.length !== nottiN) { setErrore('La striscia delle notti non corrisponde alle date: ricontrolla le persone per notte.'); return }
    setSaving(true)
    const e = await onSalva(valoriDaSalvare({ ...v, personePerNotte: normalizzaPersonePerNotte(v.personePerNotte, persone, nottiN) }, strutture.disponibile))
    // La provenienza è del cliente: se esiste già, si aggiorna la sua (vale per tutti i suoi soggiorni)
    if (!e && strutture.disponibile && cliente?.conColonne) {
      const errCliente = await salvaProvenienzaCliente(cliente.id, campiProvenienza(v.provenienza, v.struttura))
      if (errCliente) setAvviso(`Richiesta salvata, ma la provenienza del cliente non è stata aggiornata: ${errCliente}`)
    }
    // Nome di struttura nuovo → entra nell'elenco (non blocca il salvataggio)
    if (!e && strutture.disponibile && v.provenienza === 'altra_struttura') {
      const errStruttura = await ricordaStruttura(v.struttura, strutture.lista)
      if (errStruttura) setAvviso(`Richiesta salvata, ma il nome della struttura non è stato aggiunto all'elenco: ${errStruttura}`)
    }
    setSaving(false)
    if (e) setErrore(e)
  }

  return (
    <>
      <div className="ed-riga py-4 space-y-3">
        <div>
          <p className={ETICHETTA}>Canale</p>
          <div className="flex gap-2">
            {([['telefono', 'Telefono'], ['whatsapp', 'WhatsApp'], ...(v.canale === 'web' ? [['web', 'Dal sito']] : [])] as [CanaleRichiesta, string][]).map(([c, label]) => (
              <button key={c} type="button" onClick={() => set('canale', c)} aria-pressed={v.canale === c}
                className={`flex-1 rounded-full text-sm font-semibold px-4 py-2 transition-colors ${v.canale === c ? 'bg-green-mid text-cream-text' : 'border border-[#C9BFA8] text-stone'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <CampoProvenienza valore={{ provenienza: v.provenienza, struttura: v.struttura }} onChange={x => setV(y => ({ ...y, provenienza: x.provenienza, struttura: x.struttura }))}
          strutture={strutture.lista} disponibile={strutture.disponibile}
          nota={cliente ? (etichettaGiaStato(cliente.soggiorniConclusi) ?? `Cliente già in archivio${cliente.full_name ? `: ${cliente.full_name}` : ''}`) : null}
          nota2={cliente?.ricevuta ? ETICHETTA_RICEVUTA_BREVE : null} />
        {avviso && <p className="text-xs text-stone">{avviso}</p>}

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <p className={ETICHETTA}>Nome</p>
            <input value={v.nome} onChange={e => set('nome', maiuscoleNelCampo(e.target))} autoComplete="off" autoCapitalize="words" placeholder="Anna" className={INPUT} />
          </div>
          <div className="min-w-0">
            <p className={ETICHETTA}>Cognome</p>
            <input value={v.cognome} onChange={e => set('cognome', maiuscoleNelCampo(e.target))} autoComplete="off" autoCapitalize="words" placeholder="Rossi" className={INPUT} />
          </div>
        </div>

        {/* I campi data nativi di iPhone hanno una larghezza minima propria:
            min-w-0 + appearance-none impediscono alle due caselle di sovrapporsi. */}
        <div>
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0">
              <p className={ETICHETTA}>Arrivo</p>
              <input type="date" value={arrivo} onChange={e => cambiaArrivo(e.target.value)} className={INPUT} />
            </div>
            <div className="min-w-0">
              <p className={ETICHETTA}>Partenza</p>
              <input type="date" value={partenza} min={arrivo ? giornoDopo(arrivo) : undefined} onChange={e => cambiaPartenza(e.target.value)} className={INPUT} />
            </div>
          </div>
          {arrivo && partenza && partenza <= arrivo && (
            <p className="text-xs text-[#8C3B2E] mt-1.5">La partenza deve essere dopo l’arrivo.</p>
          )}
          {rigaDisponibilita && (
            <p className="text-sm font-medium text-brass mt-2" aria-live="polite">{rigaDisponibilita}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <p className={ETICHETTA}>Persone</p>
            <div className="flex items-center ed-campo p-0 overflow-hidden h-[50px]">
              <button type="button" onClick={() => cambiaPersone(Math.max(1, persone - 1))} disabled={persone <= 1} aria-label="Una persona in meno"
                className="w-12 h-full flex items-center justify-center text-green-dark disabled:opacity-30 active:bg-sage transition-colors">
                <Minus size={18} strokeWidth={2} aria-hidden />
              </button>
              <span className="flex-1 text-center text-lg font-semibold text-green-dark tabular-nums">{persone}</span>
              <button type="button" onClick={() => cambiaPersone(Math.min(10, persone + 1))} disabled={persone >= 10} aria-label="Una persona in più"
                className="w-12 h-full flex items-center justify-center text-green-dark disabled:opacity-30 active:bg-sage transition-colors">
                <Plus size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <p className={ETICHETTA}>Camera</p>
            <select value={v.cameraId} onChange={e => set('cameraId', e.target.value)} className={`${INPUT} h-[50px]`}>
              <option value="">Qualsiasi</option>
              {camere.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        {dateValide && v.nottiRichieste != null && <div className="rounded-xl border border-green-mid p-3">
          <p className="font-semibold text-sm mb-2">Richiesta soltanto per le notti selezionate</p>
          <div className="flex flex-wrap gap-2">{giorniTra(arrivo, partenza).map(g => <button type="button" role="checkbox" aria-checked={v.nottiRichieste!.includes(g)} key={g}
            onClick={() => setV(x => ({ ...x, nottiRichieste: x.nottiRichieste!.includes(g) ? x.nottiRichieste!.filter(n => n !== g) : [...x.nottiRichieste!, g].sort() }))}
            className={`min-h-11 px-3 rounded-lg border text-sm ${v.nottiRichieste!.includes(g) ? 'bg-green-mid text-white' : 'bg-white'}`}>{Number(g.slice(8))}/{Number(g.slice(5,7))}</button>)}</div>
          <p className="text-xs mt-2">Notti del {elencoNotti(v.nottiRichieste)}. Le altre sono escluse.</p>
        </div>}

        {dateValide && (
          <div>
            <p className={ETICHETTA}>Persone notte per notte <span className="text-xs">· tocca una notte per cambiarla (1–{maxPersone})</span></p>
            <StrisciaNotti arrivo={arrivo} partenza={partenza} nottiSelezionate={v.nottiRichieste ?? undefined} valori={v.nottiRichieste ? v.nottiRichieste.map(g => valoriStriscia[giorniTra(arrivo, partenza).indexOf(g)]) : valoriStriscia} min={1} max={maxPersone}
              onChange={vals => { const tutte = v.nottiRichieste ? giorniTra(arrivo, partenza).map((g, i) => { const k = v.nottiRichieste!.indexOf(g); return k < 0 ? valoriStriscia[i] : vals[k] }) : vals; set('personePerNotte', normalizzaPersonePerNotte(tutte, persone, nottiN)) }} />
            <p className="text-xs text-green-dark mt-1.5" aria-live="polite">
              {v.nottiRichieste ? 'Persone indicate solo per le notti scelte' : riassuntoPersone(arrivo, valoriStriscia)}
              {v.personePerNotte ? '' : ` · tutte le notti in ${persone}`}
            </p>
          </div>
        )}

        <div>
          <p className={ETICHETTA}>Telefono / WhatsApp</p>
          <input type="tel" inputMode="tel" value={v.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+39 333 1234567" className={INPUT} />
          {v.telefono.trim() && (() => {
            const t = normalizzaTelefono(v.telefono)
            return (
              <p className={`text-xs mt-1 ${t.avviso ? 'text-[#8C3B2E] font-semibold' : 'text-stone'}`}>
                {t.avviso ? `${t.avviso} · verrà salvato come ${telefonoLeggibile(t)}` : `Verrà salvato come ${telefonoLeggibile(t)}`}
              </p>
            )
          })()}
        </div>

        <div>
          <p className={ETICHETTA}>Note</p>
          <textarea value={v.note} onChange={e => set('note', e.target.value)} rows={2} placeholder="Es. arriva tardi, chiede il letto aggiuntivo…" className={`${INPUT} resize-none`} />
        </div>
      </div>

      {errore && (
        <div role="alert" className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore}</div>
      )}

      <button type="button" onClick={salva} disabled={saving}
        className="w-full mt-4 bg-green-mid text-cream-text rounded-xl py-3.5 font-semibold text-[15px] disabled:opacity-50 active:opacity-80 transition-opacity">
        {saving ? 'Salvataggio…' : etichettaSalva}
      </button>
      {notaSotto && <p className="text-xs text-stone text-center mt-2">{notaSotto}</p>}
    </>
  )
}

// Da una richiesta salvata ai valori del modulo (per «Modifica»)
export function valoriDaRichiesta(r: { canale: CanaleRichiesta; nome: string; cognome: string; arrivo: string; partenza: string; persone: number; persone_per_notte?: number[] | null; notti_richieste?: string[] | null; camera_id: string | null; telefono: string | null; note: string | null; provenienza?: string | null; struttura_nome?: string | null }): ValoriModulo {
  const n = giorniTra(r.arrivo, r.partenza).length
  return {
    canale: r.canale, nome: r.nome, cognome: r.cognome, arrivo: r.arrivo, partenza: r.partenza, persone: Number(r.persone) || 1,
    nottiRichieste: r.notti_richieste,
    personePerNotte: Array.isArray(r.persone_per_notte) && r.persone_per_notte.length === n ? r.persone_per_notte : null,
    cameraId: r.camera_id ?? '', telefono: r.telefono ?? '', note: r.note ?? '',
    provenienza: normalizzaProvenienza(r.provenienza), struttura: r.struttura_nome ?? '',
  }
}
