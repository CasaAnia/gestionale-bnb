// ============================================================================
// SCRITTURE DELLA REVISIONE (Fase 4, blocco 3) — servizi INIETTATI (finti
// nei test, revisioneSupabase.ts nelle pagine). Regole:
//  · si aggiornano SOLO i campi di revisione (i tipi di revisione.ts non
//    contengono i campi riservati: confidence/raw_name/status/expense_id
//    non possono nemmeno essere scritti per sbaglio);
//  · errori RESTITUITI e righe toccate contate: mai successi simulati,
//    zero righe non è un successo;
//  · la CONFERMA passa SOLO dalla RPC atomica conferma_documento (mai
//    inserimenti diretti nelle spese definitive), con le correzioni;
//  · una risposta INCERTA non finge successo e non cancella le modifiche:
//    lo dice, e invita a ricaricare per VERIFICARE lo stato.
// ============================================================================
import type { ModificaBozza, ModificaRiga, RigaNuova, StatoRevisione } from './revisione.ts'
import { correzioniDa } from './revisione.ts'

export type ClienteRevisione = {
  aggiornaDocTotale(documentId: string, totale: number | null): Promise<{ errore?: string; righe?: number }>
  aggiornaBozza(id: string, campi: ModificaBozza): Promise<{ errore?: string; righe?: number }>
  aggiornaRiga(id: string, campi: ModificaRiga): Promise<{ errore?: string; righe?: number }>
  aggiungiRiga(riga: RigaNuova): Promise<{ errore?: string; id?: string }>
  // le RPC atomiche esistenti — MAI insert diretti nelle spese definitive
  confermaDocumento(documentId: string, correzioni: Record<string, unknown>[]): Promise<{ ids?: string[]; errore?: string }>
  scartaDocumento(documentId: string, motivo: string): Promise<{ errore?: string }>
}

export type EsitoRevisione =
  | { ok: true }
  | { ok: false; errore: string; incerto?: boolean }

const rete = (msg: string) => /fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)

// salva TUTTE le modifiche pendenti (bozze, righe, nuove righe, totale).
// Al primo errore si FERMA e lo dice: le modifiche restano nello stato
// della schermata, nulla viene perso o finto.
export async function salvaModifiche(cliente: ClienteRevisione, s: StatoRevisione): Promise<EsitoRevisione> {
  try {
    if (s.docTotaleCent !== s.docTotaleOriginaleCent) {
      const r = await cliente.aggiornaDocTotale(s.documentId, s.docTotaleCent == null ? null : s.docTotaleCent / 100)
      if (r.errore) return { ok: false, errore: `totale non salvato: ${r.errore}` }
      if ((r.righe ?? 0) < 1) return { ok: false, errore: 'totale non salvato: nessuna riga toccata (documento protetto o sparito)' }
    }
    for (const [id, campi] of Object.entries(s.modificheBozze)) {
      if (Object.keys(campi).length === 0) continue
      const r = await cliente.aggiornaBozza(id, campi)
      if (r.errore) return { ok: false, errore: `una parte non è stata salvata: ${r.errore}` }
      if ((r.righe ?? 0) < 1) return { ok: false, errore: 'una parte non è stata salvata: nessuna riga toccata' }
    }
    for (const [id, campi] of Object.entries(s.modificheRighe)) {
      if (Object.keys(campi).length === 0) continue
      const r = await cliente.aggiornaRiga(id, campi)
      if (r.errore) return { ok: false, errore: `una voce non è stata salvata: ${r.errore}` }
      if ((r.righe ?? 0) < 1) return { ok: false, errore: 'una voce non è stata salvata: nessuna riga toccata' }
    }
    for (const riga of s.righeNuove) {
      const r = await cliente.aggiungiRiga(riga)
      if (r.errore || !r.id) return { ok: false, errore: `una voce nuova non è stata aggiunta: ${r.errore ?? 'senza id'}` }
    }
    return { ok: true }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, incerto: true, errore: `salvataggio dall'esito incerto (${msg}): le modifiche restano qui — ricarica per verificare cosa è arrivato` }
      : { ok: false, errore: msg }
  }
}

// CONFERMA: prima si salvano le modifiche, poi la RPC atomica con le
// correzioni (differenze originale→corrente). La quadratura la rifà il
// server: un rifiuto arriva col suo messaggio, mai mascherato.
export async function confermaRevisione(cliente: ClienteRevisione, s: StatoRevisione): Promise<EsitoRevisione> {
  const salvataggio = await salvaModifiche(cliente, s)
  if (!salvataggio.ok) return salvataggio
  try {
    const r = await cliente.confermaDocumento(s.documentId, correzioniDa(s))
    if (r.errore) return { ok: false, errore: r.errore }
    if (!r.ids || r.ids.length === 0) return { ok: false, errore: 'la conferma non ha restituito le spese create: verifica lo stato prima di riprovare', incerto: true }
    return { ok: true }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, incerto: true, errore: `conferma dall'esito incerto (${msg}): NON riprovare alla cieca — ricarica: se il documento risulta confermato è andata (la RPC è idempotente)` }
      : { ok: false, errore: msg }
  }
}

export async function scartaRevisione(cliente: ClienteRevisione, documentId: string, motivo: string): Promise<EsitoRevisione> {
  if (!motivo.trim()) return { ok: false, errore: 'serve il motivo dello scarto' }
  try {
    const r = await cliente.scartaDocumento(documentId, motivo.trim())
    if (r.errore) return { ok: false, errore: r.errore }
    return { ok: true }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, incerto: true, errore: `scarto dall'esito incerto (${msg}): ricarica per verificare lo stato` }
      : { ok: false, errore: msg }
  }
}
