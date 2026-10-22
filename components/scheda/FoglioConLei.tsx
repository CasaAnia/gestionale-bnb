'use client'
// ============================================================================
// «CON LEI» (17/09/2026): il foglio della scheda nuova per cambiare chi
// altro dorme qui. Dentro c'è lo stesso pezzo dell'inserimento (ConLei:
// righe con nome, chi è, telefono, ✕ per togliere, «+ Aggiungi una persona»).
// Le regole stanno in lib/conLeiScheda, la scrittura in lib/righeDati: tutte
// e sei le colonne su tutte le camere della prenotazione, in una richiesta sola.
// Senza la proposta 0056 (chi_e_2) si salva il resto e lo si dice.
// Dal 22/10/2026 (Ania) come nell'inserimento: in cima chi ha prenotato e la
// spunta «Non è lei a dormire qui» (colonna 0061, solo se la riga ce l'ha),
// e ogni persona si modifica. Il cliente della prenotazione non cambia mai:
// si scrivono solo le colonne di chi dorme, su tutte le camere.
// ============================================================================
import { useState } from 'react'
import Foglio, { PiedeFoglio } from './Foglio'
import AvvisoAzione from '@/components/AvvisoAzione'
import ConLei from '@/components/nuova/ConLei'
import { PERSONE_CON_LEI_MAX, TROPPE_PERSONE, COLONNA_NON_E_LEI, NON_E_LEI, nonELeiDaRiga, type PersonaConLei } from '@/lib/nuovaPrenotazione'
import { INTESTATARIA_SCHEDA } from '@/lib/schedaMaison'
import { TITOLO_CON_LEI, SALVA_CON_LEI, AVVISO_CHI_E_2_SENZA_0056, MANCA_CHI_DORME, personeDaPrenotazione, campiChiDormeScheda, senzaChiE2, stessoChiDorme, type RigaConLei } from '@/lib/conLeiScheda'
import { aggiornaInUnColpo } from '@/lib/righeDati'
import { colonnaMancante } from '@/lib/colonnaMancante'
import { ALTEZZE_FOGLI } from '@/lib/altezzeFogli'

export default function FoglioConLei({ booking, righe, intestataria, onChiudi, onIncerto, onSalvato }: {
  booking: RigaConLei
  /** chi ha prenotato: resta il cliente della prenotazione, qui si vede soltanto */
  intestataria: { nome: string; telefono: string }
  /** tutte le camere della prenotazione, annullate comprese */
  righe: RigaConLei[]
  onChiudi: () => void
  /** la risposta è andata persa o le righe non tornano: la scheda rilegge */
  onIncerto: (messaggio: string) => void
  /** i campi appena scritti su tutte le camere attive; `cambiato` è falso se non c'era niente da salvare */
  onSalvato: (campi: Record<string, unknown>, ids: string[], avviso: string | null, cambiato: boolean) => void
}) {
  const [persone, setPersone] = useState<PersonaConLei[]>(() => personeDaPrenotazione(booking))
  // la spunta c'è solo se la riga ha la colonna (proposta 0061)
  const colonnaNonELei = COLONNA_NON_E_LEI in (booking as Record<string, unknown>)
  const [nonELei, setNonELei] = useState(() => nonELeiDaRiga(booking as Record<string, unknown>))
  const [salvando, setSalvando] = useState(false)
  const [errore, setErrore] = useState<string | null>(null)
  const ids = righe.filter(r => r.status !== 'annullata').map(r => r.id)

  async function salva() {
    if (salvando) return
    if (persone.length > PERSONE_CON_LEI_MAX) { setErrore(TROPPE_PERSONE); return }
    if (nonELei && persone.length === 0) { setErrore(MANCA_CHI_DORME); return }
    const campi = campiChiDormeScheda(persone, nonELei, colonnaNonELei)
    if (stessoChiDorme(persone, nonELei, colonnaNonELei, booking)) { onSalvato(campi, ids, null, false); return }
    setSalvando(true)
    setErrore(null)
    // in una richiesta sola: o tutte le camere o nessuna
    let esito = await aggiornaInUnColpo(ids, campi)
    let avviso: string | null = null
    let scritti = campi
    if (esito.esito === 'errore' && esito.scritte === 0 && colonnaMancante(esito.errore as { code?: string; message?: string } | null) === 'chi_e_2') {
      // senza la 0056 la colonna chi_e_2 non c'è: si salva il resto e lo si dice
      scritti = senzaChiE2(campi)
      esito = await aggiornaInUnColpo(ids, scritti)
      avviso = AVVISO_CHI_E_2_SENZA_0056
    }
    setSalvando(false)
    if (esito.esito === 'errore') {
      // incerto = qualcosa può essere stato scritto: la scheda non si fida più di quello che mostra
      if (esito.incerto) { onIncerto(esito.messaggio); return }
      setErrore(esito.messaggio)
      return
    }
    onSalvato(scritti, ids, avviso, true)
  }

  return (
    <Foglio titolo={TITOLO_CON_LEI} altezza={ALTEZZE_FOGLI.chiDorme} onChiudi={onChiudi}>
      {!nonELei && (
        <div data-intestataria className="np-persona">
          <span className="min-w-0"><span className="nm">{intestataria.nome}</span><span className="ch">{INTESTATARIA_SCHEDA}</span></span>
          <span className="tel">{intestataria.telefono}</span>
        </div>
      )}
      {colonnaNonELei && (
        <div className="np-chips" style={{ marginTop: 10 }}>
          <button type="button" data-non-e-lei aria-pressed={nonELei} className={`np-chip ${nonELei ? 'on' : ''}`}
            onClick={() => { setNonELei(!nonELei); setErrore(null) }}>{nonELei ? '☑' : '☐'} {NON_E_LEI}</button>
        </div>
      )}
      <ConLei persone={persone} onPersone={p => { setPersone(p); setErrore(null) }}
        avviso={persone.length > PERSONE_CON_LEI_MAX ? TROPPE_PERSONE : null} senzaTitolo etichetteOttone />
      {errore && <AvvisoAzione testo={errore} className="mt-3" />}
      <PiedeFoglio azione={SALVA_CON_LEI} onAzione={salva} salvando={salvando} onAnnulla={onChiudi} dati="con-lei" />
    </Foglio>
  )
}
