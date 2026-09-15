// ============================================================================
// RICHIESTE E PRENOTAZIONI: DICONO LA STESSA COSA? (15/09/2026)
//
// Il riquadro «Richieste» conta le conversioni guardando SOLO lo stato della
// richiesta. Se una richiesta diventa prenotazione ma viene chiusa con lo
// stato sbagliato, o se una confermata punta a una prenotazione poi annullata,
// il numero non torna e nessuno se ne accorge.
//
// Qui NON si aggiusta niente: si dice soltanto quali righe non tornano, perché
// lo stato lo decide Ania e un nome che somiglia non è una prova. Il conteggio
// del riquadro resta quello di prima; questo è un controllo, non una regola.
// ============================================================================
import { eConfermata, eRifiutata, eScaduta } from './richiesteRiquadro.ts'
import { nomeCompleto } from '../guestName.ts'

export type RichiestaLegame = {
  id: string
  created_at: string
  stato: string
  chiusura_motivo?: string | null
  prenotazione_id?: string | null
  telefono?: string | null
  arrivo?: string | null
  nome?: string | null
  cognome?: string | null
}
export type PrenotazioneLegame = {
  id: string
  status: string
  check_in?: string | null
  telefono?: string | null
}

export type IncoerenzaRichiesta = {
  richiesta: string
  chi: string
  quando: string
  tipo: 'confermata_senza_prenotazione' | 'confermata_con_prenotazione_annullata' | 'chiusa_con_prenotazione'
  prenotazione?: string
}

const chi = (r: RichiestaLegame) => nomeCompleto({ nome: r.nome, cognome: r.cognome }) || '(senza nome)'
const viva = (p: PrenotazioneLegame | undefined) => Boolean(p) && p!.status !== 'annullata'

/** Le richieste il cui stato non torna col collegamento alla prenotazione */
export function incoerenzeRichieste(
  richieste: RichiestaLegame[], prenotazioni: PrenotazioneLegame[],
): IncoerenzaRichiesta[] {
  const per = new Map(prenotazioni.map(p => [p.id, p]))
  const fuori: IncoerenzaRichiesta[] = []
  for (const r of richieste) {
    const p = r.prenotazione_id ? per.get(r.prenotazione_id) : undefined
    if (eConfermata(r)) {
      if (!r.prenotazione_id || (!p && prenotazioni.length > 0)) {
        fuori.push({ richiesta: r.id, chi: chi(r), quando: r.created_at, tipo: 'confermata_senza_prenotazione' })
      } else if (p && !viva(p)) {
        fuori.push({ richiesta: r.id, chi: chi(r), quando: r.created_at, tipo: 'confermata_con_prenotazione_annullata', prenotazione: p.id })
      }
      continue
    }
    if ((eRifiutata(r) || eScaduta(r)) && viva(p)) {
      fuori.push({ richiesta: r.id, chi: chi(r), quando: r.created_at, tipo: 'chiusa_con_prenotazione', prenotazione: p!.id })
    }
  }
  return fuori
}

/**
 * Richieste chiuse senza collegamento per le quali ESISTE una prenotazione
 * viva con lo stesso telefono e lo stesso giorno d'arrivo.
 *
 * È un SOSPETTO da guardare a mano, non una conversione accertata: lo stesso
 * numero può aver prenotato per altro. Non si aggiorna niente da qui.
 */
export function possibiliConversioniNonRegistrate(
  richieste: RichiestaLegame[], prenotazioni: PrenotazioneLegame[],
): { richiesta: string; chi: string; quando: string; prenotazione: string }[] {
  const cifre = (t: string | null | undefined) => (t ?? '').replace(/\D/g, '').slice(-9)
  const vive = prenotazioni.filter(p => p.status !== 'annullata')
  const fuori: { richiesta: string; chi: string; quando: string; prenotazione: string }[] = []
  for (const r of richieste) {
    if (eConfermata(r) || r.prenotazione_id) continue
    if (!cifre(r.telefono) || !r.arrivo) continue
    const p = vive.find(x => cifre(x.telefono) === cifre(r.telefono) && x.check_in === r.arrivo)
    if (p) fuori.push({ richiesta: r.id, chi: chi(r), quando: r.created_at, prenotazione: p.id })
  }
  return fuori
}
