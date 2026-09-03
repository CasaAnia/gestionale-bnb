'use client'
import { useEffect, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import StrisciaNotti from '@/components/StrisciaNotti'
import { supabase } from '@/lib/supabase'
import { frasiDisponibilita, notti, ordinaCamere, type PrenotazioneMinima } from '@/lib/disponibilita'
import { giorniTra } from '@/lib/richiesteCalendario'
import { capienzaCamera } from '@/lib/tariffe'
import { riassuntoPersone, type CanaleRichiesta, type ValoriModifica } from '@/lib/richieste'
import { normalizzaTelefono, telefonoLeggibile } from '@/lib/whatsapp'

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
  personePerNotte: number[] | null
  cameraId: string
  telefono: string
  note: string
}

const INPUT = 'w-full min-w-0 appearance-none bg-white border border-card-border rounded-lg p-3 text-[15px] focus:outline-none focus:border-green-mid'
const ETICHETTA = 'text-sm text-stone mb-1'
const MAX_PERSONE_SENZA_CAMERE = 4

// Giorno dopo, senza passare dal fuso orario del telefono.
function giornoDopo(iso: string): string {
  const t = Date.parse(iso + 'T00:00:00Z')
  return Number.isNaN(t) ? '' : new Date(t + 86400000).toISOString().slice(0, 10)
}

export const VALORI_VUOTI: ValoriModulo = { canale: 'telefono', nome: '', cognome: '', arrivo: '', partenza: '', persone: 1, personePerNotte: null, cameraId: '', telefono: '', note: '' }

// Dai valori del modulo a quelli da salvare (stessa normalizzazione del telefono della proposta WhatsApp)
export function valoriDaSalvare(v: ValoriModulo): ValoriModifica {
  return {
    nome: v.nome.trim(), cognome: v.cognome.trim(), arrivo: v.arrivo, partenza: v.partenza,
    persone: v.persone, persone_per_notte: v.personePerNotte,
    camera_id: v.cameraId || null, canale: v.canale,
    telefono: telefonoLeggibile(normalizzaTelefono(v.telefono)) || null,
    note: v.note.trim() || null,
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
  const set = <K extends keyof ValoriModulo>(k: K, val: ValoriModulo[K]) => setV(x => ({ ...x, [k]: val }))

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
    ? (occupazione.errore ? `${nottiN} notti · disponibilità non leggibile (${occupazione.errore})` : frasiDisponibilita(camere, occupazione.prenotazioni, arrivo, partenza, personeMax))
    : (dateValide ? `${nottiN === 1 ? '1 notte' : `${nottiN} notti`} · controllo le camere…` : '')

  // Le date cambiano → le notti cambiano: la striscia riparte da «Persone»
  // (una striscia con un numero diverso di caselle sarebbe un dato incoerente)
  function cambiaArrivo(val: string) {
    setV(x => ({ ...x, arrivo: val, partenza: val && (!x.partenza || x.partenza <= val) ? giornoDopo(val) : x.partenza, personePerNotte: null }))
  }
  function cambiaPartenza(val: string) { setV(x => ({ ...x, partenza: val, personePerNotte: null })) }
  function cambiaPersone(n: number) { setV(x => ({ ...x, persone: n, personePerNotte: null })) }
  const valoriStriscia = v.personePerNotte ?? Array.from({ length: nottiN }, () => persone)

  async function salva() {
    setErrore(null)
    if (!v.nome.trim() || !v.cognome.trim()) { setErrore('Nome e cognome sono obbligatori.'); return }
    if (!arrivo || !partenza) { setErrore('Indica arrivo e partenza.'); return }
    if (partenza <= arrivo) { setErrore('La partenza deve essere almeno una notte dopo l’arrivo.'); return }
    if (v.personePerNotte && v.personePerNotte.length !== nottiN) { setErrore('La striscia delle notti non corrisponde alle date: ricontrolla le persone per notte.'); return }
    setSaving(true)
    const e = await onSalva(valoriDaSalvare({ ...v, personePerNotte: normalizzaPersonePerNotte(v.personePerNotte, persone, nottiN) }))
    setSaving(false)
    if (e) setErrore(e)
  }

  return (
    <>
      <div className="bg-white rounded-xl p-4 border border-card-border space-y-3">
        <div>
          <p className={ETICHETTA}>Canale</p>
          <div className="flex gap-2">
            {([['telefono', 'Telefono'], ['whatsapp', 'WhatsApp'], ...(v.canale === 'web' ? [['web', 'Dal sito']] : [])] as [CanaleRichiesta, string][]).map(([c, label]) => (
              <button key={c} type="button" onClick={() => set('canale', c)} aria-pressed={v.canale === c}
                className={`flex-1 rounded-full text-sm font-semibold px-4 py-2 transition-colors ${v.canale === c ? 'bg-green-mid text-cream-text' : 'border border-card-border bg-white text-stone'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <p className={ETICHETTA}>Nome</p>
            <input value={v.nome} onChange={e => set('nome', e.target.value)} autoComplete="off" autoCapitalize="words" placeholder="Anna" className={INPUT} />
          </div>
          <div className="min-w-0">
            <p className={ETICHETTA}>Cognome</p>
            <input value={v.cognome} onChange={e => set('cognome', e.target.value)} autoComplete="off" autoCapitalize="words" placeholder="Rossi" className={INPUT} />
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
            <div className="flex items-center border border-card-border rounded-lg overflow-hidden h-[50px]">
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

        {dateValide && (
          <div>
            <p className={ETICHETTA}>Persone notte per notte <span className="text-xs">· tocca una notte per cambiarla (1–{maxPersone})</span></p>
            <StrisciaNotti arrivo={arrivo} partenza={partenza} valori={valoriStriscia} min={1} max={maxPersone}
              onChange={vals => set('personePerNotte', normalizzaPersonePerNotte(vals, persone, nottiN))} />
            <p className="text-xs text-green-dark mt-1.5" aria-live="polite">
              {riassuntoPersone(arrivo, valoriStriscia)}
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
export function valoriDaRichiesta(r: { canale: CanaleRichiesta; nome: string; cognome: string; arrivo: string; partenza: string; persone: number; persone_per_notte?: number[] | null; camera_id: string | null; telefono: string | null; note: string | null }): ValoriModulo {
  const n = giorniTra(r.arrivo, r.partenza).length
  return {
    canale: r.canale, nome: r.nome, cognome: r.cognome, arrivo: r.arrivo, partenza: r.partenza, persone: Number(r.persone) || 1,
    personePerNotte: Array.isArray(r.persone_per_notte) && r.persone_per_notte.length === n ? r.persone_per_notte : null,
    cameraId: r.camera_id ?? '', telefono: r.telefono ?? '', note: r.note ?? '',
  }
}
