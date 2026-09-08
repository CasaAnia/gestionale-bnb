import type { Decisione } from './pulizie.ts'
import type { Recupero, Contatori } from './biancheria.ts'

export type RichiestaPulizia =
  | { azione: 'registra'; ultima_id: string | null; pulizia: Decisione; recupero: Contatori | null }
  | { azione: 'recupero'; cleaning_id: string; versione: string | null; recupero: Contatori }
export type RispostaPulizia = { pulizia: Decisione; recupero: Recupero | null }
export type CustodiaPulizia = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type TrasportoPulizia = (id: string, richiesta: RichiestaPulizia) => Promise<{ data: RispostaPulizia | null; error: { code?: string; message?: string } | null }>
export type PendentePulizia = { id: string; richiesta: RichiestaPulizia }
const chiave = (camera: string) => `casa-ania:pulizia:v1:${camera}`

export function leggiOperazionePulizia(custodia: CustodiaPulizia, camera: string): PendentePulizia | null {
  const raw = custodia.getItem(chiave(camera))
  if (raw === null) return null
  const p = JSON.parse(raw) as PendentePulizia
  if (!p.id || !p.richiesta || !['registra', 'recupero'].includes(p.richiesta.azione)) throw new Error('Salvataggio custodito non leggibile')
  return p
}

export async function eseguiOperazionePulizia(camera: string, richiesta: RichiestaPulizia | null, custodia: CustodiaPulizia, trasporto: TrasportoPulizia, nuovoId: () => string): Promise<{ errore: string | null; risposta: RispostaPulizia | null }> {
  let pendente: PendentePulizia
  try {
    const precedente = leggiOperazionePulizia(custodia, camera)
    if (!precedente && !richiesta) return { errore: null, risposta: null }
    if (precedente && richiesta && JSON.stringify(precedente.richiesta) !== JSON.stringify(richiesta)) {
      return { errore: 'Prima completa il salvataggio precedente con Riprova.', risposta: null }
    }
    pendente = precedente ?? { id: nuovoId(), richiesta: richiesta! }
    const raw = JSON.stringify(pendente)
    custodia.setItem(chiave(camera), raw)
    if (custodia.getItem(chiave(camera)) !== raw) throw new Error('Custodia non conservata')
  } catch {
    return { errore: 'Non posso conservare il salvataggio su questo dispositivo. Riprova prima di chiudere.', risposta: null }
  }
  let esito: Awaited<ReturnType<TrasportoPulizia>>
  try { esito = await trasporto(pendente.id, pendente.richiesta) }
  catch { return { errore: 'Risposta non ricevuta. Premi Riprova: il salvataggio non verrà duplicato.', risposta: null } }
  const definitiva = esito.error && /^(22[A-Z0-9]{3}|42501|23502|23503|23514|P0045|PGRST202|42883)$/.test(esito.error.code ?? '')
  if (esito.error && !definitiva) return { errore: 'Non riesco a confermare il salvataggio. Premi Riprova prima di modificarlo.', risposta: null }
  if (!esito.error && !esito.data?.pulizia?.id) return { errore: 'Risposta incompleta. Premi Riprova per verificare il salvataggio.', risposta: null }
  try {
    // Una risposta tardiva di un altro tab non deve cancellare una nuova
    // operazione iniziata nel frattempo sullo stesso dispositivo.
    const attuale = leggiOperazionePulizia(custodia, camera)
    if (attuale && attuale.id !== pendente.id) return { errore: 'È presente un altro salvataggio da confermare. Premi Riprova.', risposta: null }
    if (attuale) custodia.removeItem(chiave(camera))
    if (custodia.getItem(chiave(camera)) !== null) throw new Error('Custodia non rimossa')
  } catch {
    return { errore: esito.error ? 'Operazione non eseguita; non riesco a chiudere il tentativo. Premi Riprova.' : 'Salvato, ma il dispositivo non ha chiuso il tentativo. Premi Riprova.', risposta: null }
  }
  if (esito.error) {
    const code = esito.error.code
    return { errore: code === 'P0045' ? 'La pulizia è cambiata nel frattempo. Ricarica e riapri la scheda.'
      : code === 'PGRST202' || code === '42883' ? 'Il nuovo salvataggio delle pulizie deve ancora essere attivato.'
        : 'Non salvato: controlla date, quantità e soggiorno della pulizia.', risposta: null }
  }
  return { errore: null, risposta: esito.data }
}
