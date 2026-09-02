'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Minus, Plus } from 'lucide-react'
import BackBar from '@/components/BackBar'
import { supabase } from '@/lib/supabase'
import { frasiDisponibilita, notti, ordinaCamere, type PrenotazioneMinima } from '@/lib/disponibilita'
import { spiegaErrore, type CanaleRichiesta } from '@/lib/richieste'

type Camera = { id: string; name: string; active: boolean }

const INPUT = 'w-full min-w-0 appearance-none bg-white border border-card-border rounded-lg p-3 text-[15px] focus:outline-none focus:border-green-mid'
const ETICHETTA = 'text-sm text-stone mb-1'

// Giorno dopo, senza passare dal fuso orario del telefono.
function giornoDopo(iso: string): string {
  const t = Date.parse(iso + 'T00:00:00Z')
  return Number.isNaN(t) ? '' : new Date(t + 86400000).toISOString().slice(0, 10)
}

export default function NuovaRichiesta() {
  const router = useRouter()
  const [camere, setCamere] = useState<Camera[]>([])
  const [canale, setCanale] = useState<CanaleRichiesta>('telefono')
  const [nome, setNome] = useState('')
  const [cognome, setCognome] = useState('')
  const [arrivo, setArrivo] = useState('')
  const [partenza, setPartenza] = useState('')
  const [persone, setPersone] = useState(1)
  const [cameraId, setCameraId] = useState('')
  const [telefono, setTelefono] = useState('')
  const [note, setNote] = useState('')
  const [occupazione, setOccupazione] = useState<{ chiave: string; prenotazioni: PrenotazioneMinima[]; errore: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('rooms').select('id, name, active').eq('active', true).then(({ data, error }) => {
      if (error) setErrore(`Camere non caricate: ${error.message}`)
      setCamere(ordinaCamere((data || []) as Camera[]))
    })
  }, [])

  // Riga indicativa: SOLO prenotazioni confermate/completate che si
  // sovrappongono. Le altre richieste in attesa non contano.
  // (La riga si mostra solo se la chiave coincide con le date correnti:
  // niente stato da azzerare quando le date tornano non valide.)
  const dateValide = notti(arrivo, partenza) > 0
  useEffect(() => {
    if (!dateValide) return
    const chiave = `${arrivo}|${partenza}`
    let alive = true
    supabase.from('bookings')
      .select('room_id, check_in, check_out, status')
      .in('status', ['confermata', 'completata'])
      .lt('check_in', partenza).gt('check_out', arrivo)
      .then(({ data, error }) => {
        if (!alive) return
        setOccupazione({ chiave, prenotazioni: (data || []) as PrenotazioneMinima[], errore: error ? error.message : null })
      })
    return () => { alive = false }
  }, [arrivo, partenza, dateValide])

  const rigaDisponibilita = dateValide && occupazione && occupazione.chiave === `${arrivo}|${partenza}`
    ? (occupazione.errore ? `${notti(arrivo, partenza)} notti · disponibilità non leggibile (${occupazione.errore})` : frasiDisponibilita(camere, occupazione.prenotazioni, arrivo, partenza))
    : (dateValide ? `${notti(arrivo, partenza) === 1 ? '1 notte' : `${notti(arrivo, partenza)} notti`} · controllo le camere…` : '')

  function cambiaArrivo(v: string) {
    setArrivo(v)
    if (v && (!partenza || partenza <= v)) setPartenza(giornoDopo(v))
  }

  async function salva() {
    setErrore(null)
    if (!nome.trim() || !cognome.trim()) { setErrore('Nome e cognome sono obbligatori.'); return }
    if (!arrivo || !partenza) { setErrore('Indica arrivo e partenza.'); return }
    if (partenza <= arrivo) { setErrore('La partenza deve essere almeno una notte dopo l’arrivo.'); return }
    setSaving(true)
    const { data, error } = await supabase.from('richieste').insert({
      nome: nome.trim(),
      cognome: cognome.trim(),
      arrivo,
      partenza,
      persone,
      camera_id: cameraId || null,
      canale,
      telefono: telefono.trim() || null,
      note: note.trim() || null,
      stato: 'in_attesa',
    }).select('id').single()
    setSaving(false)
    if (error) { setErrore(spiegaErrore(error)); return }
    if (!data?.id) { setErrore('Salvataggio non confermato dal database: la richiesta potrebbe non essere stata registrata.'); return }
    router.push('/richieste')
  }

  return (
    <div className="p-4">
      <BackBar href="/richieste" />
      <h1 className="text-[22px] text-green-dark leading-tight mb-4 max-lg:hidden" style={{ fontFamily: 'var(--font-fraunces), Georgia, serif' }}>Nuova richiesta</h1>

      <div className="bg-white rounded-xl p-4 border border-card-border space-y-3">
        <div>
          <p className={ETICHETTA}>Canale</p>
          <div className="flex gap-2">
            {([['telefono', 'Telefono'], ['whatsapp', 'WhatsApp']] as const).map(([v, label]) => (
              <button key={v} type="button" onClick={() => setCanale(v)} aria-pressed={canale === v}
                className={`flex-1 rounded-full text-sm font-semibold px-4 py-2 transition-colors ${canale === v ? 'bg-green-mid text-cream-text' : 'border border-card-border bg-white text-stone'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="min-w-0">
            <p className={ETICHETTA}>Nome</p>
            <input value={nome} onChange={e => setNome(e.target.value)} autoComplete="off" autoCapitalize="words" placeholder="Anna" className={INPUT} />
          </div>
          <div className="min-w-0">
            <p className={ETICHETTA}>Cognome</p>
            <input value={cognome} onChange={e => setCognome(e.target.value)} autoComplete="off" autoCapitalize="words" placeholder="Rossi" className={INPUT} />
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
              <input type="date" value={partenza} min={arrivo ? giornoDopo(arrivo) : undefined} onChange={e => setPartenza(e.target.value)} className={INPUT} />
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
              <button type="button" onClick={() => setPersone(p => Math.max(1, p - 1))} disabled={persone <= 1} aria-label="Una persona in meno"
                className="w-12 h-full flex items-center justify-center text-green-dark disabled:opacity-30 active:bg-sage transition-colors">
                <Minus size={18} strokeWidth={2} aria-hidden />
              </button>
              <span className="flex-1 text-center text-lg font-semibold text-green-dark tabular-nums">{persone}</span>
              <button type="button" onClick={() => setPersone(p => Math.min(10, p + 1))} disabled={persone >= 10} aria-label="Una persona in più"
                className="w-12 h-full flex items-center justify-center text-green-dark disabled:opacity-30 active:bg-sage transition-colors">
                <Plus size={18} strokeWidth={2} aria-hidden />
              </button>
            </div>
          </div>
          <div className="min-w-0">
            <p className={ETICHETTA}>Camera</p>
            <select value={cameraId} onChange={e => setCameraId(e.target.value)} className={`${INPUT} h-[50px]`}>
              <option value="">Qualsiasi</option>
              {camere.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <p className={ETICHETTA}>Telefono / WhatsApp</p>
          <input type="tel" inputMode="tel" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+39 333 1234567" className={INPUT} />
        </div>

        <div>
          <p className={ETICHETTA}>Note</p>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Es. arriva tardi, chiede il letto aggiuntivo…" className={`${INPUT} resize-none`} />
        </div>
      </div>

      {errore && (
        <div role="alert" className="mt-3 bg-[#F6E4DE] border border-[#EAD3CC] rounded-xl p-3 text-sm text-[#8C3B2E]">{errore}</div>
      )}

      <button type="button" onClick={salva} disabled={saving}
        className="w-full mt-4 bg-green-mid text-cream-text rounded-xl py-3.5 font-semibold text-[15px] disabled:opacity-50 active:opacity-80 transition-opacity">
        {saving ? 'Salvataggio…' : 'Salva richiesta'}
      </button>
      <p className="text-xs text-stone text-center mt-2">Va in «In attesa». Nessun messaggio parte da qui.</p>
    </div>
  )
}
