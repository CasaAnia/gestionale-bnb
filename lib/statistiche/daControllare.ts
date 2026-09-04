// ============================================================================
// «DA CONTROLLARE»: dato lo stato, l'elenco di ciò che merita un'occhiata —
// richieste ferme (stessa regola di lib/richieste.avvisoFerma), arrivi e
// partenze nei prossimi 3 giorni, pagamenti incoerenti o mancanti, camere
// sovrapposte fra confermate, fatture scadute. Mai una richiesta o una
// prenotazione «in attesa» contata come confermata.
// ============================================================================
import { avvisoFerma, type Richiesta } from '../richieste.ts'
import { cent, prenotazioneValida, type DocumentoStat, type PagamentoStat, type PrenotazioneStat } from './tipi.ts'
import { incassiMese, type Incoerenza } from './cassa.ts'
import { spostaGiorni } from './periodo.ts'

export const GIORNI_ORIZZONTE = 3

export type Sovrapposizione = { room_id: string; a: PrenotazioneStat; b: PrenotazioneStat; notti: string[] }

export type DaControllare = {
  richiesteFerme: { id: string; avviso: string }[]
  arrivi: PrenotazioneStat[]            // check_in in [oggi, oggi + 3)
  partenze: PrenotazioneStat[]          // check_out in [oggi, oggi + 3)
  pagamenti: Incoerenza[]               // incoerenti o mancanti (pagato senza righe, non segnato, oltre il totale)
  pagamentiMancanti: PrenotazioneStat[] // soggiorni conclusi senza né pagato né righe
  sovrapposizioni: Sovrapposizione[]
  fattureScadute: DocumentoStat[]
}

export function daControllare(stato: {
  oggi: string
  adesso?: Date
  richieste: Pick<Richiesta, 'id' | 'stato' | 'arrivo' | 'created_at' | 'proposta_inviata_at'>[]
  prenotazioni: PrenotazioneStat[]
  pagamenti: PagamentoStat[]
  documenti: DocumentoStat[]
}): DaControllare {
  const { oggi } = stato
  const adesso = stato.adesso ?? new Date(oggi + 'T12:00:00Z')
  const limite = spostaGiorni(oggi, GIORNI_ORIZZONTE)
  const valide = stato.prenotazioni.filter(prenotazioneValida)

  const richiesteFerme = stato.richieste
    .map(r => ({ id: r.id, avviso: avvisoFerma(r, adesso) }))
    .filter((x): x is { id: string; avviso: string } => x.avviso !== null)

  const arrivi = valide.filter(b => b.check_in >= oggi && b.check_in < limite).sort((a, b) => a.check_in.localeCompare(b.check_in))
  const partenze = valide.filter(b => b.check_out >= oggi && b.check_out < limite).sort((a, b) => a.check_out.localeCompare(b.check_out))

  // Pagamenti: le incoerenze non dipendono dal mese; si prende il mese di oggi solo per la firma della funzione
  const pagamenti = incassiMese(oggi.slice(0, 7), valide, stato.pagamenti, oggi).incoerenze
  const conRighe = new Set(stato.pagamenti.map(p => p.booking_id))
  const pagamentiMancanti = valide.filter(b => b.check_out <= oggi && !b.pagato && !conRighe.has(b.id) && cent(b.total_amount) > 0)

  const sovrapposizioni: Sovrapposizione[] = []
  for (let i = 0; i < valide.length; i++) for (let j = i + 1; j < valide.length; j++) {
    const a = valide[i], b = valide[j]
    if (a.room_id !== b.room_id) continue
    const da = a.check_in > b.check_in ? a.check_in : b.check_in
    const fine = a.check_out < b.check_out ? a.check_out : b.check_out
    if (fine <= da) continue
    const notti: string[] = []
    for (let g = da; g < fine; g = spostaGiorni(g, 1)) notti.push(g)
    sovrapposizioni.push({ room_id: a.room_id, a, b, notti })
  }

  const fattureScadute = stato.documenti.filter(d => d.kind === 'fattura' && d.status === 'approvata_da_pagare' && !!d.due_date && d.due_date < oggi)

  return { richiesteFerme, arrivi, partenze, pagamenti, pagamentiMancanti, sovrapposizioni, fattureScadute }
}
