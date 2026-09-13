'use client'
// ============================================================================
// «CAMBIA COME PAGA» (13/09/2026): lo STESSO componente dell'inserimento
// (components/ComePaga) dentro un foglio della scheda. Il salvataggio sta in
// lib/comePagaDati: il modo su tutte le camere della prenotazione, la caparra
// una volta sola sulla riga che arriva per prima.
// ============================================================================
import { useState } from 'react'
import Foglio from './Foglio'
import ComePaga, { TITOLO_COME_PAGA } from '@/components/ComePaga'
import AvvisoAzione from '@/components/AvvisoAzione'
import { supabase } from '@/lib/supabase'
import { campiComePaga, chiedeImporto, chiedeScadenza, type ComePaga as ComePagaModo, type CampiComePaga } from '@/lib/comePaga'
import { salvaComePaga } from '@/lib/comePagaDati'
import { oraCompleta } from '@/lib/ora'

export const ERRORE_SCADENZA = 'Della caparra servono data e ora, oppure nessuna delle due.'
export const ERRORE_ORA = 'L’ora si scrive con quattro cifre, per esempio 1800 diventa 18:00.'
export const ERRORE_IMPORTO = 'La caparra deve essere un importo positivo.'

export default function FoglioComePaga({ idRighe, idPrima, modo, importo, data, ora, totaleCent, onChiudi, onSalvato }: {
  /** tutte le camere della prenotazione */
  idRighe: string[]
  /** la riga che porta la caparra (quella che arriva per prima) */
  idPrima: string
  modo: ComePagaModo
  /** la caparra già salvata, in euro */
  importo: number | null
  data: string
  ora: string
  totaleCent: number | null
  onChiudi: () => void
  onSalvato: (campi: CampiComePaga, avviso: string | null) => void
}) {
  const [scelta, setScelta] = useState<ComePagaModo>(modo)
  const [importoForm, setImporto] = useState<number | null>(importo)
  const [dataForm, setData] = useState(data)
  const [oraForm, setOra] = useState(ora)
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  async function salva() {
    if (salvando) return
    if (chiedeScadenza(scelta) && Boolean(dataForm) !== Boolean(oraForm)) { setErrore(ERRORE_SCADENZA); return }
    if (oraForm && !oraCompleta(oraForm)) { setErrore(ERRORE_ORA); return }
    if (chiedeImporto(scelta) && (!importoForm || !Number.isFinite(importoForm) || importoForm <= 0)) { setErrore(ERRORE_IMPORTO); return }
    setSalvando(true)
    setErrore(null)
    const campi = campiComePaga(scelta, {
      totaleCent,
      importoCent: importoForm == null ? null : Math.round(importoForm * 100),
      entro: dataForm && oraForm ? `${dataForm}T${oraForm}:00` : null,
    })
    const esito = await salvaComePaga(campi,
      c => supabase.from('bookings').update(c).in('id', idRighe),
      c => supabase.from('bookings').update(c).eq('id', idPrima),
    )
    setSalvando(false)
    if (esito.esito === 'errore') { setErrore(esito.messaggio); return }
    onSalvato(campi, esito.messaggio)
  }

  return (
    <Foglio titolo={TITOLO_COME_PAGA} grande onChiudi={onChiudi}>
      <ComePaga modo={scelta} onModo={m => { setScelta(m); if (!chiedeImporto(m)) setImporto(null) }}
        totaleCent={totaleCent} importo={importoForm} onImporto={setImporto}
        data={dataForm} ora={oraForm} onData={setData} onOra={setOra} />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <div className="flex gap-2 mt-4 mb-1">
        <button type="button" onClick={salva} disabled={salvando} className="ed-pillola flex-1" style={{ minHeight: 44 }}>{salvando ? 'Salvo…' : 'Salva'}</button>
        <button type="button" onClick={onChiudi} className="ed-pillola-tenue" style={{ minHeight: 44 }}>Annulla</button>
      </div>
    </Foglio>
  )
}
