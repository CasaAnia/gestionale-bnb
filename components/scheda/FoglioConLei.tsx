'use client'
// ============================================================================
// «CON LEI» (17/09/2026): il foglio della scheda nuova per cambiare chi
// altro dorme qui. Dentro c'è lo stesso pezzo dell'inserimento (ConLei:
// righe con nome, chi è, telefono, ✕ per togliere, «+ Aggiungi una persona»).
// Le regole stanno in lib/conLeiScheda, la scrittura in lib/righeDati: tutte
// e sei le colonne su tutte le camere della prenotazione, riga per riga.
// Senza la proposta 0056 (chi_e_2) si salva il resto e lo si dice.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import ConLei from '@/components/nuova/ConLei'
import { PERSONE_CON_LEI_MAX, TROPPE_PERSONE, type PersonaConLei } from '@/lib/nuovaPrenotazione'
import { TITOLO_CON_LEI, SALVA_CON_LEI, AVVISO_CHI_E_2_SENZA_0056, personeDaPrenotazione, campiConLeiCompleti, senzaChiE2, stessePersone, type RigaConLei } from '@/lib/conLeiScheda'
import { aggiornaRigaPerRiga, stessiCampi } from '@/lib/righeDati'
import { colonnaMancante } from '@/lib/colonnaMancante'

export default function FoglioConLei({ booking, righe, onChiudi, onSalvato }: {
  booking: RigaConLei
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaConLei[]
  onChiudi: () => void
  /** i campi appena scritti su tutte le camere attive; `cambiato` è falso se non c'era niente da salvare */
  onSalvato: (campi: Record<string, unknown>, ids: string[], avviso: string | null, cambiato: boolean) => void
}) {
  const [persone, setPersone] = useState<PersonaConLei[]>(() => personeDaPrenotazione(booking))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const ids = righe.filter(r => r.status !== 'annullata').map(r => r.id)

  async function salva() {
    if (salvando) return
    if (persone.length > PERSONE_CON_LEI_MAX) { setErrore(TROPPE_PERSONE); return }
    const campi = campiConLeiCompleti(persone)
    if (stessePersone(persone, booking)) { onSalvato(campi, ids, null, false); return }
    setSalvando(true)
    setErrore(null)
    let esito = await aggiornaRigaPerRiga(stessiCampi(ids, campi))
    let avviso: string | null = null
    let scritti = campi
    if (esito.esito === 'errore' && esito.scritte === 0 && colonnaMancante(esito.errore as { code?: string; message?: string } | null) === 'chi_e_2') {
      // senza la 0056 la colonna chi_e_2 non c'è: si salva il resto e lo si dice
      scritti = senzaChiE2(campi)
      esito = await aggiornaRigaPerRiga(stessiCampi(ids, scritti))
      avviso = AVVISO_CHI_E_2_SENZA_0056
    }
    setSalvando(false)
    if (esito.esito === 'errore') { setErrore(esito.messaggio); return }
    onSalvato(scritti, ids, avviso, true)
  }

  return (
    <Foglio titolo={TITOLO_CON_LEI} onChiudi={onChiudi}>
      <ConLei persone={persone} onPersone={p => { setPersone(p); setErrore(null) }}
        avviso={persone.length > PERSONE_CON_LEI_MAX ? TROPPE_PERSONE : null} senzaTitolo etichetteOttone />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione={SALVA_CON_LEI} onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="con-lei" />
    </Foglio>
  )
}
