'use client'
// ============================================================================
// «DATI DELLA CLIENTE» (16/09/2026): il foglio della scheda nuova coi campi
// dell'inserimento — nome e cognome, telefono, ricevuta e valutazione sulla
// stessa riga, come ci ha trovato con le strutture, la nota — cioè lo STESSO
// modulo (components/nuova/NuovoCliente), non una copia.
//
// I dati sono della CLIENTE (guests), non di questa prenotazione: valgono
// per tutti i suoi soggiorni, e il foglio lo dice. Le regole per passare dal
// modulo ai campi stanno in lib/datiCliente; qui c'è solo la scrittura, a
// esito controllato. Il motivo interno ha bisogno della colonna della 0046:
// senza, non si salva niente e il testo resta qui (stessa regola della
// scheda cliente).
// ============================================================================
import { useEffect, useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import NuovoCliente from '@/components/nuova/NuovoCliente'
import { supabase } from '@/lib/supabase'
import { leggiStrutture, ricordaStruttura } from '@/lib/provenienzaDati'
import { clienteConProvenienza, type StrutturaNota } from '@/lib/provenienza'
import { colonnaRicevutaPresente } from '@/lib/valutazione'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { messaggioNonSalvato } from '@/lib/scritturaSicura'
import { moduloDaCliente, campiDaModulo, TITOLO_DATI_CLIENTE, AVVISO_TUTTI_I_SOGGIORNI, type ClienteSalvato, type ModuloCliente } from '@/lib/datiCliente'

export const ERRORE_MOTIVO_SENZA_0046 = 'Il motivo interno non può ancora essere registrato (serve la proposta 0046). Nessuna modifica alla cliente è stata salvata: il testo resta qui.'

export default function FoglioCliente({ cliente, onChiudi, onSalvato }: {
  cliente: ClienteSalvato & { id: string }
  onChiudi: () => void
  /** i campi appena scritti su guests: la scheda li mette su TUTTE le righe della cliente */
  onSalvato: (campi: Record<string, unknown>, avviso: string | null) => void
}) {
  const [dati, setDati] = useState<ModuloCliente>(() => moduloDaCliente(cliente))
  const [strutture, setStrutture] = useState<{ disponibile: boolean; lista: StrutturaNota[] }>({ disponibile: false, lista: [] })
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true
    void leggiStrutture().then(r => { if (vivo) setStrutture({ disponibile: r.disponibile, lista: r.strutture }) })
    return () => { vivo = false }
  }, [])

  async function salva() {
    if (salvando) return
    const m = campiDaModulo(dati, cliente, { colonnaRicevuta: colonnaRicevutaPresente(cliente), conProvenienza: clienteConProvenienza(cliente) && strutture.disponibile })
    if (!m.ok) { setErrore(m.errore); return }
    setSalvando(true)
    setErrore(null)
    let esito: { error: { code?: string; message?: string } | null }
    try { esito = await supabase.from('guests').update(m.campi).eq('id', cliente.id) } catch (err) { esito = { error: { message: String((err as Error)?.message ?? err) } } }
    if (esito.error) {
      setSalvando(false)
      setErrore(colonnaMancante(esito.error) === 'motivo_problematico' ? ERRORE_MOTIVO_SENZA_0046 : messaggioNonSalvato(esito.error))
      return
    }
    // un nome di struttura nuovo entra nell'elenco (se non riesce non blocca: il cliente è salvato)
    let avviso: string | null = null
    if (m.campi.provenienza === 'altra_struttura' && typeof m.campi.struttura_nome === 'string') {
      const e = await ricordaStruttura(m.campi.struttura_nome, strutture.lista)
      if (e) avviso = `Salvato, ma il nome della struttura non è stato aggiunto all’elenco: ${e}`
    }
    setSalvando(false)
    onSalvato(m.campi, avviso)
  }

  return (
    <Foglio titolo={TITOLO_DATI_CLIENTE} onChiudi={onChiudi}>
      <p data-vale-per-tutti style={{ fontSize: 12.5, color: 'var(--color-stone)', marginBottom: 14 }}>{AVVISO_TUTTI_I_SOGGIORNI}</p>
      <NuovoCliente dati={dati} onDati={setDati} strutture={strutture.lista} struttureDisponibili={clienteConProvenienza(cliente) && strutture.disponibile}
        titolo={null} avanti={null} etichetteOttone />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione="Salva" onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="cliente" />
    </Foglio>
  )
}
