// ============================================================================
// ANNULLARE UNA PRENOTAZIONE dalla scheda nuova (16/09/2026) — la logica pura.
//
// Prima cosa, CHI ha annullato: «Errore mio», «La cliente», «Non si è
// presentata». Il motivo scritto a mano è facoltativo. Si salva come sempre
// (status annullata, cancelled_at, cancelled_reason: la stessa scrittura
// della scheda attuale), e in cancelled_reason entra chi ha annullato, con
// il motivo dopo un punto mediano: «La cliente · ha trovato altro».
//
//  · «Errore mio»: la prenotazione non è mai esistita davvero, quindi
//    SPARISCE dallo storico della cliente (lib/storicoCliente la salta). Non
//    si cancella la riga: i pagamenti già registrati e la cronologia restano.
//  · «La cliente» e «Non si è presentata»: resta nello storico, col motivo.
//  · «Non si è presentata»: dopo il salvataggio si propone di segnare la
//    cliente come problematica, con un tasto che lo fa.
//
// I motivi vecchi, scritti liberi, restano com'erano: chiHaAnnullato torna
// null e la prenotazione resta nello storico. Niente Supabase qui.
// ============================================================================
import { scriviPoiAggiorna, type RispostaScrittura } from './scritturaSicura.ts'
import { dataItaliana } from './dateItaliane.ts'

export type ChiAnnulla = 'errore_mio' | 'cliente' | 'no_show'

export const CHI_ANNULLA: { chiave: ChiAnnulla; testo: string }[] = [
  { chiave: 'errore_mio', testo: 'Errore mio' },
  { chiave: 'cliente', testo: 'La cliente' },
  { chiave: 'no_show', testo: 'Non si è presentata' },
]
export const TESTO_CHI: Record<ChiAnnulla, string> = Object.fromEntries(CHI_ANNULLA.map(c => [c.chiave, c.testo])) as Record<ChiAnnulla, string>

export const TITOLO_ANNULLA = 'Annulla la prenotazione'
export const AZIONE_ANNULLA = 'Annulla la prenotazione'
export const TORNA_INDIETRO = 'Torna indietro'
export const DOMANDA_CHI = 'Chi ha annullato?'
export const ETICHETTA_MOTIVO = 'Motivo · può restare vuoto'
export const SCEGLI_CHI = 'Prima di tutto: chi ha annullato?'
export const PRENOTAZIONE_ANNULLATA = 'Prenotazione annullata'
export const SEGNA_PROBLEMATICA = 'Segna come problematica'
export const LASCIA_COSI = 'No, lascia così'
export const ERRORE_RIGHE = 'Ricarica per verificare quali camere sono state annullate'

const SEPARATORE = ' · '

/** Quello che si legge sotto le tre pastiglie: cosa succede allo storico */
export function spiegazione(chi: ChiAnnulla | null): string {
  if (chi === 'errore_mio') return 'Sparisce dallo storico della cliente: i pagamenti già registrati restano nel conto.'
  if (chi) return 'Resta nello storico della cliente, col motivo.'
  return ''
}

/** Il motivo da salvare: «Errore mio», oppure «La cliente · ha trovato altro» */
export function motivoAnnullamento(chi: ChiAnnulla, motivo: string | null | undefined): string {
  const m = (motivo ?? '').replace(/\s+/g, ' ').trim()
  return m ? `${TESTO_CHI[chi]}${SEPARATORE}${m}` : TESTO_CHI[chi]
}

/** Dal motivo salvato a chi ha annullato; null per i motivi scritti liberi (quelli vecchi) */
export function chiHaAnnullato(cancelledReason: string | null | undefined): ChiAnnulla | null {
  const r = (cancelledReason ?? '').trim().toLowerCase()
  if (!r) return null
  for (const c of CHI_ANNULLA) {
    const t = c.testo.toLowerCase()
    if (r === t || r.startsWith(t + SEPARATORE.trim()) || r.startsWith(t + ' ·')) return c.chiave
  }
  return null
}

/** Con «Errore mio» la prenotazione non si vede più nello storico della cliente */
export const sparisceDalloStorico = (cancelledReason: string | null | undefined): boolean => chiHaAnnullato(cancelledReason) === 'errore_mio'

/** I campi da scrivere: la stessa scrittura della scheda attuale */
export function campiAnnullamento(chi: ChiAnnulla, motivo: string | null | undefined, adesso: string): { status: 'annullata'; cancelled_at: string; cancelled_reason: string } {
  return { status: 'annullata', cancelled_at: adesso, cancelled_reason: motivoAnnullamento(chi, motivo) }
}

/** Dopo «Non si è presentata»: la riga che propone di segnare la cliente; null negli altri casi */
export function propostaProblematica(chi: ChiAnnulla, nome: string | null | undefined): string | null {
  if (chi !== 'no_show') return null
  const n = (nome ?? '').trim() || 'la cliente'
  return `Segnare ${n} come cliente problematica?`
}

/** Il motivo interno da scrivere sulla cliente: «Non si è presentata il 12/09/2026» */
export function motivoProblematicaNoShow(arrivo: string | null | undefined): string {
  const g = dataItaliana(arrivo)
  return g ? `Non si è presentata il ${g}` : 'Non si è presentata'
}

/**
 * La scrittura, con la regola della scheda attuale: si annullano SOLO le
 * righe non ancora annullate del soggiorno, e le righe toccate devono essere
 * quante quelle attive — altrimenti niente cambia sullo schermo e si chiede
 * di ricaricare. `aggiorna` gira solo a scrittura riuscita.
 */
export async function salvaAnnullamento(
  scrivi: () => PromiseLike<RispostaScrittura & { data?: { id: string }[] | null }>,
  attese: number,
  aggiorna: () => void,
): Promise<string | null> {
  return scriviPoiAggiorna(async () => {
    const r = await scrivi()
    if (r && r.error) return r
    const toccate = Array.isArray(r?.data) ? r.data.length : 0
    return { error: toccate === attese ? null : new Error(ERRORE_RIGHE) }
  }, aggiorna)
}
