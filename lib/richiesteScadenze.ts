// Scadenza dell'opzione di 3 ore (incarico del 06/09/2026): cosa fa il
// controllo ogni 5 minuti (pg_cron → /api/richieste/scadenze), in regole pure:
//  · daNotificare: proposte inviate da più di 3 ore, mai notificate → Pushover
//    (suono diverso, priorità «emergenza» che ripete finché Ania conferma);
//  · daChiudere: scadute da più di 24 ore → stato «chiusa», motivo «scaduta».
// Le richieste rifiutate o confermate nel frattempo non sono più «proposta
// inviata» e quindi non rientrano mai. Ogni richiesta è notificata UNA volta
// (scadenza_notificata_at).
import { ORE_SCADENZA_PROPOSTA, formatIntervallo, nomeCompleto } from './richieste.ts'
import { ORE_CHIUSURA_DOPO_SCADENZA } from './opzioni.ts'

export type RichiestaScadenza = {
  id: string
  nome: string
  cognome: string
  stato: string
  arrivo: string
  partenza: string
  proposta_inviata_at: string | null
  scadenza_notificata_at?: string | null
  proposta_soluzione?: { segmenti?: { camera?: { name?: string } }[] } | null
}

export const SUONO_SCADENZA = 'siren'
export const OPZIONI_PUSHOVER_SCADENZA = { sound: SUONO_SCADENZA, priority: 2 as const, retry: 60, expire: 3600, url_title: 'Apri la richiesta' }

function scadenza(r: RichiestaScadenza): number | null {
  if (r.stato !== 'proposta_inviata' || !r.proposta_inviata_at) return null
  const t = Date.parse(r.proposta_inviata_at)
  return Number.isNaN(t) ? null : t + ORE_SCADENZA_PROPOSTA * 3600000
}

export function daNotificare(righe: RichiestaScadenza[], adesso: Date): RichiestaScadenza[] {
  return righe.filter(r => { const s = scadenza(r); return s !== null && s <= adesso.getTime() && !r.scadenza_notificata_at })
}

export function daChiudere(righe: RichiestaScadenza[], adesso: Date): RichiestaScadenza[] {
  return righe.filter(r => { const s = scadenza(r); return s !== null && s + ORE_CHIUSURA_DOPO_SCADENZA * 3600000 <= adesso.getTime() })
}

// «Proposta scaduta — Mario Rossi» / «Ambra 17–20 set. Controlla se ha risposto.»
export function testoNotifica(r: RichiestaScadenza): { titolo: string; messaggio: string } {
  const camere = [...new Set((r.proposta_soluzione?.segmenti ?? []).map(s => s.camera?.name).filter((n): n is string => !!n))]
  const dove = camere.length > 0 ? camere.join(' e ') + ' ' : ''
  return { titolo: `Proposta scaduta — ${nomeCompleto(r)}`, messaggio: `${dove}${formatIntervallo(r.arrivo, r.partenza)}. Controlla se ha risposto.` }
}
