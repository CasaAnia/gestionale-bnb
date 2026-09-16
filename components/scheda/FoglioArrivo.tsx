'use client'
// ============================================================================
// «ARRIVO» (13/09/2026, veste comune dal 16/09/2026): a che ora arriva, con
// l'orologino davanti, e la navetta (No · Sì · ?) — gli stessi due dati del
// riquadro della scheda attuale, della finestra degli Arrivi e della pagina
// di inserimento, con lo stesso salvataggio a esito controllato
// (lib/arrivoOrario: prima orario e navetta insieme, poi solo l'orario se la
// colonna shuttle manca). Il dato resta uno solo, la colonna della
// prenotazione.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo } from '@/components/nuova/PezziNuova'
import { supabase } from '@/lib/supabase'
import { salvaOrarioENavetta } from '@/lib/arrivoOrario'
import { oraDigitata, oraCompleta } from '@/lib/ora'

export const TITOLO_ARRIVO = 'Arrivo'
export const ERRORE_ORA = 'L’orario si scrive con quattro cifre, per esempio 1830 diventa 18:30. Lascia vuoto se non lo sai ancora.'
// le tre pastiglie della navetta, come nell'inserimento
export const NAVETTE = [['no', 'No'], ['si', 'Sì'], ['', '?']] as const

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

  return (
    <Foglio titolo={TITOLO_ARRIVO} onChiudi={onChiudi}>
      <div className="flex flex-wrap" style={{ gap: 22 }}>
        <div className="flex-1 min-w-[140px]">
          <Etichetta testo="A che ora arriva" primo ottone />
          <RigaCampo etichetta="🕐 ora" ottone>
            <input type="text" inputMode="numeric" maxLength={5} placeholder="es. 15:30" data-campo="orario" aria-label="Orario previsto"
              value={oraForm} onChange={e => setOraForm(oraDigitata(e.target.value))} style={{ ...stileCampo, fontSize: 17, fontWeight: 600 }} />
          </RigaCampo>
        </div>
        <div>
          <Etichetta testo="Navetta" primo ottone />
          <FilaPastiglie>
            {NAVETTE.map(([v, testo]) => (
              <Pastiglia key={testo} dati={`navetta-${v || 'boh'}`} acceso={navettaForm === v} onClick={() => setNavettaForm(v)}>{testo}</Pastiglia>
            ))}
          </FilaPastiglie>
        </div>
      </div>
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione="Salva" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="arrivo" />
    </Foglio>
  )
}
