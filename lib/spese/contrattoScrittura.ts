// ============================================================================
// OPERAZIONI del contratto di revisione (sviluppo LOCALE, non collegato
// alle pagine): un Salva = UN batch atomico; la custodia registra
// l'operazione (op_key, kind, documento, base_rev, impronta) PRIMA
// dell'invio; il recupero avviene per CHIAVE via esito_revisione, con
// il controllo di CORRISPONDENZA (documento+kind+base_rev+impronta) —
// un esito estraneo non chiude mai una pendenza; una lettura fallita
// non è mai «assente». SUPERATA è un conflitto esplicito: si ricarica.
// ============================================================================
import {
  batchSalvaDa, batchVuoto, corrisponde, manifestoConferma, manifestoSalva,
  manifestoScarto,
  type ClienteContratto, type HasherTesto, type OperazioneContratto,
  type RispostaContratto,
} from './contrattoRevisione.ts'
import type { StatoRevisione } from './revisione.ts'

// custodia delle OPERAZIONI del contratto (parallela alla traccia della
// revisione; in futuro vivrà nello stesso deposito durevole)
export type DepositoOperazioni = {
  salva(op: OperazioneContratto): { errore?: string }
  leggi(opKey: string): { op?: OperazioneContratto; errore?: string }
  rimuovi(opKey: string): { errore?: string }
}
export function depositoOperazioniInMemoria(): DepositoOperazioni & { contenuto: () => OperazioneContratto[] } {
  let ops: OperazioneContratto[] = []
  return {
    salva(op) { ops = [...ops.filter(o => o.opKey !== op.opKey), op]; return {} },
    leggi(opKey) { return { op: ops.find(o => o.opKey === opKey) } },
    rimuovi(opKey) { ops = ops.filter(o => o.opKey !== opKey); return {} },
    contenuto: () => [...ops],
  }
}

export type EsitoOperazione =
  | { ok: true; revDopo: number; mappaNuove: Record<string, string>; spese?: string[]; ripetuta?: boolean }
  | { ok: false; conflitto: 'superata'; errore: string }
  | { ok: false; errore: string; sentinella?: string }
  | { ok: false; incerto: true; errore: string; op: OperazioneContratto }

const rete = (msg: string) => /fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)

function daRisposta(r: RispostaContratto): EsitoOperazione {
  if (r.esito === 'APPLICATA' || r.esito === 'RIPETUTA') {
    const mappa: Record<string, string> = {}
    for (const m of r.righe_nuove) mappa[m.client_ref] = m.id
    return { ok: true, revDopo: r.rev_dopo, mappaNuove: mappa, ...(r.spese ? { spese: r.spese } : {}), ...(r.esito === 'RIPETUTA' ? { ripetuta: true } : {}) }
  }
  if (r.esito === 'SUPERATA')
    return { ok: false, conflitto: 'superata', errore: 'il documento è cambiato rispetto alla revisione attesa: ricarica e riproponi le modifiche — nulla è stato scritto' }
  return { ok: false, errore: `il servizio ha respinto l'operazione (${r.esito}${'dettaglio' in r && r.dettaglio ? `: ${r.dettaglio}` : ''}) — nulla è stato scritto`, sentinella: r.esito }
}

// esegue una delle tre operazioni: custodia PRIMA dell'invio (se
// fallisce, NIENTE parte); risposta persa → incerto con l'operazione
// custodita (il recupero passa da esito_revisione, mai reinvio cieco)
async function esegui(
  cliente: ClienteContratto, deposito: DepositoOperazioni,
  op: OperazioneContratto, invia: () => Promise<RispostaContratto>,
): Promise<EsitoOperazione> {
  const custodia = deposito.salva(op)
  if (custodia.errore)
    return { ok: false, errore: `non riesco a custodire l'operazione (${custodia.errore}): NON la invio — senza custodia una risposta persa sarebbe irrecuperabile` }
  let r: RispostaContratto
  try { r = await invia() } catch (e) {
    const msg = String((e as Error).message ?? e)
    return { ok: false, incerto: true, errore: `${rete(msg) ? 'esito incerto' : 'esito ignoto'} (${msg}): l'operazione è custodita — il recupero passa da esito_revisione, nessun reinvio automatico`, op }
  }
  const esito = daRisposta(r)
  // ogni risposta ARRIVATA chiude la responsabilità della custodia
  // (successo, superata o sentinella: l'esito è definito)
  deposito.rimuovi(op.opKey)
  return esito
}

export async function eseguiSalva(
  cliente: ClienteContratto, deposito: DepositoOperazioni,
  s: StatoRevisione, baseRev: number,
  hasher: HasherTesto, opKey: string,
): Promise<EsitoOperazione | { ok: true; nulla: true }> {
  const batch = batchSalvaDa(s, baseRev)
  if (batchVuoto(batch)) return { ok: true, nulla: true }
  const op: OperazioneContratto = {
    opKey, kind: 'salva', documentId: s.documentId, baseRev,
    impronta: await hasher(manifestoSalva(batch)),
    clientRefs: batch.nuove.map(n => n.client_ref),
  }
  return esegui(cliente, deposito, op, () =>
    cliente.salvaRevisione({ op_key: opKey, document_id: s.documentId, base_rev: baseRev, modifiche: batch }))
}

export async function eseguiConferma(
  cliente: ClienteContratto, deposito: DepositoOperazioni,
  documentId: string, baseRev: number, correzioni: Record<string, unknown>[],
  hasher: HasherTesto, opKey: string,
): Promise<EsitoOperazione> {
  const op: OperazioneContratto = {
    opKey, kind: 'conferma', documentId, baseRev,
    impronta: await hasher(manifestoConferma(documentId, baseRev, correzioni)),
    clientRefs: [],
  }
  return esegui(cliente, deposito, op, () =>
    cliente.confermaRevisione({ op_key: opKey, document_id: documentId, base_rev: baseRev, correzioni }))
}

export async function eseguiScarto(
  cliente: ClienteContratto, deposito: DepositoOperazioni,
  documentId: string, baseRev: number, motivo: string,
  hasher: HasherTesto, opKey: string,
): Promise<EsitoOperazione> {
  if (!motivo.trim()) return { ok: false, errore: 'serve il motivo dello scarto' }
  const op: OperazioneContratto = {
    opKey, kind: 'scarto', documentId, baseRev,
    impronta: await hasher(manifestoScarto(documentId, baseRev, motivo.trim())),
    clientRefs: [],
  }
  return esegui(cliente, deposito, op, () =>
    cliente.scartaRevisione({ op_key: opKey, document_id: documentId, base_rev: baseRev, motivo: motivo.trim() }))
}

// ---- RECUPERO per chiave --------------------------------------------------
export type EsitoRecupero =
  | { stato: 'applicata'; revDopo: number; mappaNuove: Record<string, string>; spese?: string[] }
  | { stato: 'assente' }                    // MAI arrivata fin qui: reinvio sicuro con la STESSA chiave
  | { stato: 'estranea'; errore: string }   // a giornale c'è ALTRO sotto quella chiave: pendenza conservata
  | { stato: 'illeggibile'; errore: string }// lettura fallita ≠ assente: pendenza conservata

export async function recuperaOperazione(
  cliente: ClienteContratto, deposito: DepositoOperazioni, op: OperazioneContratto,
): Promise<EsitoRecupero> {
  let g
  try { g = await cliente.esitoRevisione(op.opKey) } catch (e) {
    return { stato: 'illeggibile', errore: `lettura dell'esito fallita (${String((e as Error).message ?? e)}): la pendenza resta — lettura fallita non è «assente»` }
  }
  if (g.stato === 'assente') return { stato: 'assente' }
  if (!corrisponde(op, g))
    return { stato: 'estranea', errore: 'a giornale la chiave porta un\'operazione con documento, tipo, revisione o impronta DIVERSI dalla custodia: esito estraneo, la pendenza resta e va segnalata' }
  deposito.rimuovi(op.opKey)
  const mappa: Record<string, string> = {}
  for (const m of g.esito.righe_nuove ?? []) mappa[m.client_ref] = m.id
  return { stato: 'applicata', revDopo: g.esito.rev_dopo, mappaNuove: mappa, ...(g.esito.spese ? { spese: g.esito.spese } : {}) }
}
