'use client'
// ============================================================================
// «DA DOVE?» (13/09/2026): il foglio che si apre dalla prima riga della
// scheda quando manca la provenienza del cliente. Le stesse quattro scelte
// del campo «Come ci ha trovato» (components/CampoProvenienza) e lo stesso
// salvataggio sul CLIENTE (lib/provenienzaDati.salvaProvenienzaCliente):
// la provenienza è della persona, non della prenotazione.
// ============================================================================
import { useEffect, useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import CampoProvenienza, { type ValoreProvenienza } from '@/components/CampoProvenienza'
import AvvisoAzione from '@/components/AvvisoAzione'
import { campiProvenienza, type CampiProvenienza, type StrutturaNota } from '@/lib/provenienza'
import { leggiStrutture, ricordaStruttura, salvaProvenienzaCliente } from '@/lib/provenienzaDati'
import { ALTEZZE_FOGLI } from '@/lib/altezzeFogli'

export default function FoglioProvenienza({ guestId, iniziale, onChiudi, onSalvata }: {
  guestId: string
  iniziale: ValoreProvenienza
  onChiudi: () => void
  onSalvata: (campi: CampiProvenienza) => void
}) {
  const [valore, setValore] = useState<ValoreProvenienza>(iniziale)
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: true, lista: [] })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    leggiStrutture().then(r => { if (vivo) setStrutture({ disponibile: r.disponibile, lista: r.strutture }) })
    return () => { vivo = false }
  }, [])

  async function salva() {
    if (salvando) return
    setSalvando(true)
    setErrore(null)
    const campi = campiProvenienza(valore.provenienza, valore.struttura)
    const msg = await salvaProvenienzaCliente(guestId, campi)
    if (msg) { setErrore(msg); setSalvando(false); return }
    if (campi.struttura_nome) await ricordaStruttura(campi.struttura_nome, strutture.lista)
    setSalvando(false)
    onSalvata(campi)
  }

  return (
    <Foglio titolo="Da dove arriva la cliente?" altezza={ALTEZZE_FOGLI.provenienza} onChiudi={onChiudi}>
      <CampoProvenienza valore={valore} onChange={setValore} strutture={strutture.lista} disponibile={strutture.disponibile} compatto />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione="Salva sul cliente" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="provenienza" />
    </Foglio>
  )
}
