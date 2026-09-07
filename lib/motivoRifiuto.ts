// ============================================================================
// MOTIVO DEL RIFIUTO di una richiesta (07/09/2026, «Rifiuta con motivo»).
// Quattro codici salvati in richieste.motivo_rifiuto (colonna già presente
// dalla 0027, prima usata per testi liberi come «Completo» / «Prezzo»):
//   non_risposto · detto_no · data_ad_altro · altro
// La chiusura automatica per scadenza NON passa da qui (resta chiusura_motivo
// = 'scaduta', senza motivo di rifiuto). I valori vecchi si leggono lo stesso:
// normalizzaMotivoRifiuto li riporta a un codice. Funzioni pure, nessun Supabase.
// ============================================================================

export type MotivoRifiuto = 'non_risposto' | 'detto_no' | 'data_ad_altro' | 'altro'

export const MOTIVI_RIFIUTO_CODICI: MotivoRifiuto[] = ['non_risposto', 'detto_no', 'data_ad_altro', 'altro']

// Bottoni della finestra «Perché la rifiuti?», nell'ordine in cui compaiono
export const MOTIVI_RIFIUTO_SCELTE: { codice: MotivoRifiuto; testo: string }[] = [
  { codice: 'non_risposto', testo: 'Non ha risposto' },
  { codice: 'detto_no', testo: 'Ha detto di no' },
  { codice: 'data_ad_altro', testo: 'L’ho data a un altro' },
  { codice: 'altro', testo: 'Altro motivo' },
]

// Il motivo in parole, per la riga «Rifiutata da te · ha detto di no · 4 set»
export const MOTIVO_RIFIUTO_PAROLE: Record<MotivoRifiuto, string> = {
  non_risposto: 'non ha risposto',
  detto_no: 'ha detto di no',
  data_ad_altro: 'data a un altro',
  altro: 'altro motivo',
}

const eCodice = (v: string): v is MotivoRifiuto => (MOTIVI_RIFIUTO_CODICI as string[]).includes(v)

// Dal valore salvato (codice nuovo o testo vecchio) al codice; null se non c'è
// nessun motivo. Testi vecchi: «Non ha più risposto» → non_risposto; «date
// assegnate a altro cliente» (rifiuto in cascata della RPC conferma_richiesta)
// → data_ad_altro; tutto il resto (Completo, Prezzo, Altro, testo libero) → altro.
export function normalizzaMotivoRifiuto(raw: string | null | undefined): MotivoRifiuto | null {
  const v = (raw ?? '').trim()
  if (!v) return null
  if (eCodice(v)) return v
  const t = v.toLowerCase()
  if (/non ha (più |piu )?risposto/.test(t)) return 'non_risposto'
  if (/altro cliente|qualcun altro|a un altro/.test(t)) return 'data_ad_altro'
  return 'altro'
}

export function motivoRifiutoInParole(raw: string | null | undefined): string | null {
  const m = normalizzaMotivoRifiuto(raw)
  return m ? MOTIVO_RIFIUTO_PAROLE[m] : null
}
