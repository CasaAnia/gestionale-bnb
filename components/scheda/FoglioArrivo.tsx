'use client'
// ============================================================================
// «MODIFICA ARRIVO» (13/09/2026): orario previsto e navetta, gli stessi due
// dati del riquadro della scheda attuale e della finestra degli Arrivi, con
// lo stesso salvataggio a esito controllato (lib/arrivoOrario: prima orario e
// navetta insieme, poi solo l'orario se la colonna shuttle manca). Il dato
// resta uno solo, la colonna della prenotazione.
// ============================================================================
import { useState } from 'react'
import Foglio from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { supabase } from '@/lib/supabase'
import { salvaOrarioENavetta } from '@/lib/arrivoOrario'
import { oraDigitata, oraCompleta } from '@/lib/ora'

export const ERRORE_ORA = 'L’orario si scrive con quattro cifre, per esempio 1830 diventa 18:30. Lascia vuoto se non lo sai ancora.'

export default function FoglioArrivo({ bookingId, ora, navetta, onChiudi, onSalvato }: {
  bookingId: string
  ora: string | null | undefined
  navetta: string | null | undefined
  onChiudi: () => void
  onSalvato: (campi: { check_in_time: string | null; shuttle: string | null }, avviso: string | null) => void
}) {
  const [oraForm, setOraForm] = useState((ora ?? '').trim())
  const [navettaForm, setNavettaForm] = useState<'si' | 'no' | ''>(navetta === 'si' ? 'si' : navetta === 'no' ? 'no' : '')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function salva() {
    if (salvando) return
    if (oraForm && !oraCompleta(oraForm)) { setErrore(ERRORE_ORA); return }
    setSalvando(true)
    setErrore(null)
    const campi = { check_in_time: oraForm || null, shuttle: navettaForm || null }
    const esito = await salvaOrarioENavetta(
      () => supabase.from('bookings').update(campi).eq('id', bookingId),
      () => supabase.from('bookings').update({ check_in_time: campi.check_in_time }).eq('id', bookingId),
      !!navettaForm,
    )
    setSalvando(false)
    if (esito.esito === 'errore') { setErrore(esito.messaggio); return }
    onSalvato(esito.esito === 'solo_orario' ? { check_in_time: campi.check_in_time, shuttle: navetta ?? null } : campi, esito.messaggio)
  }

  const pillola = (attiva: boolean) => attiva ? 'ed-pillola' : 'ed-pillola-tenue'
  return (
    <Foglio titolo="Modifica arrivo" onChiudi={onChiudi}>
      <label className="block">
        <span className="block text-sm text-stone mb-1">Orario previsto</span>
        <input type="text" inputMode="numeric" maxLength={5} placeholder="es. 18:30" value={oraForm} aria-label="Orario previsto"
          onChange={e => setOraForm(oraDigitata(e.target.value))}
          className="w-full min-w-0 appearance-none bg-white ed-campo p-3 text-[17px] focus:outline-none focus:border-green-mid" />
      </label>
      <p className="text-sm text-stone mt-3 mb-1">Navetta</p>
      <div className="flex gap-2" role="group" aria-label="Navetta">
        {([['si', 'Sì'], ['no', 'No'], ['', 'Non so']] as const).map(([val, testo]) => (
          <button key={testo} type="button" aria-pressed={navettaForm === val} onClick={() => setNavettaForm(val)} className={pillola(navettaForm === val)} style={{ minHeight: 40 }}>{testo}</button>
        ))}
      </div>
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <div className="flex gap-2 mt-4">
        <button type="button" onClick={salva} disabled={salvando} className="ed-pillola flex-1" style={{ minHeight: 42 }}>{salvando ? 'Salvo…' : 'Salva arrivo'}</button>
        <button type="button" onClick={onChiudi} className="ed-pillola-tenue" style={{ minHeight: 42 }}>Annulla</button>
      </div>
    </Foglio>
  )
}
