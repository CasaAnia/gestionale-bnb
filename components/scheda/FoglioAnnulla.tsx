'use client'
// ============================================================================
// «ANNULLA LA PRENOTAZIONE» (16/09/2026): il foglio della scheda nuova. Prima
// cosa la domanda «chi ha annullato», con tre pastiglie — «Errore mio» · «La
// cliente» · «Non si è presentata» — poi il motivo, facoltativo. La pastiglia
// dell'azione è in mattone, e sotto c'è «Torna indietro».
//
// Con «Errore mio» la prenotazione sparisce dallo storico della cliente; con
// gli altri due resta, col motivo. Con «Non si è presentata», dopo il
// salvataggio il foglio propone in una riga di segnare la cliente come
// problematica, con un tasto che lo fa.
//
// Le regole stanno in lib/annullamento (pure): la scrittura è quella della
// scheda attuale (status, cancelled_at, cancelled_reason su tutte le righe
// attive del soggiorno, con la verifica delle righe toccate). Non si cancella
// nessuna riga: pagamenti e cronologia restano.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import { Etichetta, FilaPastiglie, Pastiglia, RigaCampo, stileCampo, MATTONE, OTTONE } from '@/components/nuova/PezziNuova'
import { supabase } from '@/lib/supabase'
import { filtroPrenotazione, type IdentitaPrenotazione } from '@/lib/prenotazioneUnica'
import { payloadValutazione, vuoleRicevuta, colonnaRicevutaPresente, type ClienteValutato } from '@/lib/valutazione'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { messaggioNonSalvato } from '@/lib/scritturaSicura'
import {
  CHI_ANNULLA, TITOLO_ANNULLA, AZIONE_ANNULLA, TORNA_INDIETRO, DOMANDA_CHI, ETICHETTA_MOTIVO, SCEGLI_CHI, PRENOTAZIONE_ANNULLATA,
  SEGNA_PROBLEMATICA, LASCIA_COSI, spiegazione, campiAnnullamento, propostaProblematica, motivoProblematicaNoShow, salvaAnnullamento,
  type ChiAnnulla,
} from '@/lib/annullamento'

export const AVVISO_MOTIVO_SENZA_0046 = 'Cliente segnata come problematica; il motivo interno però no: serve la proposta 0046 applicata su Supabase.'

export type CampiAnnullamento = ReturnType<typeof campiAnnullamento>

export default function FoglioAnnulla({ booking, attive, nomeCliente, cliente, arrivo, onChiudi, onAnnullata, onProblematica }: {
  booking: IdentitaPrenotazione
  /** quante righe del soggiorno sono ancora attive: la scrittura deve toccarle tutte */
  attive: number
  nomeCliente: string
  /** la cliente (guests), per segnarla problematica; senza id non si propone */
  cliente: (ClienteValutato & { id?: string | null }) | null
  /** il primo arrivo: finisce nel motivo interno («Non si è presentata il …») */
  arrivo: string | null
  onChiudi: () => void
  /** a scrittura riuscita: la scheda aggiorna le righe */
  onAnnullata: (campi: CampiAnnullamento) => void
  /** dopo «Segna come problematica»: i campi scritti sulla cliente */
  onProblematica: (campi: Record<string, unknown>, avviso: string | null) => void
}) {
  const [chi, setChi] = useState<ChiAnnulla | null>(null)
  const [motivo, setMotivo] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  // dopo il salvataggio con «Non si è presentata»: la proposta resta a schermo
  const [proposta, setProposta] = useState<string | null>(null)

  async function annulla() {
    if (salvando) return
    if (!chi) { setErrore(SCEGLI_CHI); return }
    setSalvando(true)
    setErrore(null)
    const campi = campiAnnullamento(chi, motivo, new Date().toISOString())
    const f = filtroPrenotazione(booking)
    const e = await salvaAnnullamento(
      () => supabase.from('bookings').update(campi).eq(f.colonna, f.valore).neq('status', 'annullata').select('id'),
      attive,
      () => onAnnullata(campi),
    )
    setSalvando(false)
    if (e) { setErrore(e); return }
    const p = cliente?.id ? propostaProblematica(chi, nomeCliente) : null
    if (p) setProposta(p)
    else onChiudi()
  }

  async function segnaProblematica() {
    if (salvando || !cliente?.id) return
    setSalvando(true)
    setErrore(null)
    const base = payloadValutazione('problematico', vuoleRicevuta(cliente), colonnaRicevutaPresente(cliente))
    let campi: Record<string, unknown> = { ...base, motivo_problematico: motivoProblematicaNoShow(arrivo) }
    let avviso: string | null = null
    let esito = await supabase.from('guests').update(campi).eq('id', cliente.id)
    if (esito.error && colonnaMancante(esito.error) === 'motivo_problematico') {
      // senza la 0046 si segna lo stesso, e lo si dice
      campi = { ...base }
      avviso = AVVISO_MOTIVO_SENZA_0046
      esito = await supabase.from('guests').update(campi).eq('id', cliente.id)
    }
    setSalvando(false)
    if (esito.error) { setErrore(messaggioNonSalvato(esito.error)); return }
    onProblematica(campi, avviso)
  }

  if (proposta) {
    return (
      <Foglio titolo={TITOLO_ANNULLA} onChiudi={onChiudi}>
        <p data-annullata style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-green-dark)' }}>✓ {PRENOTAZIONE_ANNULLATA}</p>
        <p data-proposta-problematica style={{ marginTop: 14, fontSize: 14.5, color: 'var(--color-green-dark)' }}>{proposta}</p>
        <p style={{ marginTop: 4, fontSize: 12.5, color: 'var(--color-stone)' }}>Resta scritto solo per noi, con la data di oggi: non entra in nessun messaggio.</p>
        {errore && <AvvisoAzione testo={errore} className="mt-3" />}
        <PiedeFoglio azione={SEGNA_PROBLEMATICA} onAzione={segnaProblematica} salvando={salvando} onAnnulla={onChiudi} testoAnnulla={LASCIA_COSI} mattone dati="problematica" />
      </Foglio>
    )
  }

  return (
    <Foglio titolo={TITOLO_ANNULLA} onChiudi={onChiudi}>
      <Etichetta testo={DOMANDA_CHI} primo ottone />
      <FilaPastiglie>
        {CHI_ANNULLA.map(c => (
          <Pastiglia key={c.chiave} dati={`chi-${c.chiave}`} acceso={chi === c.chiave} colore={MATTONE} onClick={() => { setChi(c.chiave); setErrore(null) }}>{c.testo}</Pastiglia>
        ))}
      </FilaPastiglie>
      {chi && <p data-spiegazione style={{ marginTop: 10, fontSize: 12.5, color: OTTONE }}>{spiegazione(chi)}</p>}
      <RigaCampo etichetta={ETICHETTA_MOTIVO} ottone className="mt-4">
        <input type="text" data-campo="motivo" value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="es. ha trovato altro" style={stileCampo} />
      </RigaCampo>
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione={AZIONE_ANNULLA} onAzione={annulla} salvando={salvando} testoSalvando="Annullo…" onAnnulla={onChiudi} testoAnnulla={TORNA_INDIETRO} mattone dati="annulla" />
    </Foglio>
  )
}
