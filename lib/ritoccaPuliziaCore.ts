// ============================================================================
// «ORA» E «TOGLI» DI UNA PULIZIA DAL REGISTRO (proposta 0064, ritocca_pulizia).
// Stesso principio degli altri salvataggi: un errore del server è certo (non
// è successo niente); una risposta persa è INCERTA e decide la rilettura; se
// non si riesce a rileggere lo si dice, senza invitare a ripetere.
// Il client arriva da fuori (test con un finto server).
// ============================================================================
export type RichiestaRitocco = { azione: 'ora'; cleaning_id: string; versione: string | null; ora: string } | { azione: 'togli'; cleaning_id: string; versione: string | null }
type Errore = { code?: string; message?: string } | null
type Client = {
  rpc: (f: string, a: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Errore }>
  rileggi: (id: string) => PromiseLike<{ data: { id: string; ora_effettiva?: string | null } | null; error: Errore }>
}
export const RITOCCO_CAMBIATA = 'La pulizia è cambiata nel frattempo: chiudi e riapri il Registro per vederla com’è adesso.'
export const RITOCCO_INCERTO = 'Non so se è andato a buon fine: la risposta non è arrivata. Non ripetere: chiudi e riapri il Registro per controllare.'
export const RITOCCO_NON_ATTIVO = 'Questa funzione non è ancora attiva: va applicata la proposta 0064.'

const certo = (e: Errore) => !!e && /^([0-9A-Z]{5}|PGRST\d+)$/.test(e.code ?? '')
export async function eseguiRitocco(client: Client, r: RichiestaRitocco): Promise<{ errore: string | null; verificato?: boolean }> {
  let risposta: { data: unknown; error: Errore }
  try { risposta = await client.rpc('ritocca_pulizia', { p_richiesta: r }) } catch (e) { risposta = { data: null, error: { message: String(e) } } }
  if (!risposta.error) return { errore: null }
  if (certo(risposta.error)) {
    const c = risposta.error!.code
    if (c === 'P0045') return { errore: RITOCCO_CAMBIATA }
    if (c === 'PGRST202' || c === '42883') return { errore: RITOCCO_NON_ATTIVO }
    if (c === '22023') return { errore: 'Valore non valido: controlla e riprova.' }
    if (c === '42501') return { errore: 'Non hai il permesso di farlo.' }
    return { errore: 'Non salvato: riprova.' }
  }
  // risposta persa: si rilegge
  try {
    const l = await client.rileggi(r.cleaning_id)
    if (l.error) return { errore: RITOCCO_INCERTO }
    if (r.azione === 'togli') return l.data ? { errore: RITOCCO_INCERTO } : { errore: null, verificato: true }
    return l.data && (l.data.ora_effettiva ?? '').slice(0, 5) === r.ora ? { errore: null, verificato: true } : { errore: RITOCCO_INCERTO }
  } catch { return { errore: RITOCCO_INCERTO } }
}
