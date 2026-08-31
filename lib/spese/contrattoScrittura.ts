// ============================================================================
// OPERAZIONI del contratto di revisione (sviluppo LOCALE, non collegato
// alle pagine): un Salva = UN batch atomico; la custodia registra la
// RICHIESTA ORIGINALE COMPLETA (op_key, kind, documento, base_rev,
// impronta E payload) PRIMA dell'invio, ed è IMMUTABILE: una chiave già
// pendente non può cambiare identità o contenuto. La custodia si tocca
// SOLO dopo la CONVALIDA completa della risposta (validaRisposta):
// risposte malformate ed errori di trasporto conservano la pendenza; il
// reinvio riparte dalla richiesta custodita, mai dallo stato corrente
// della schermata. Gli errori del deposito vengono RIPORTATI.
// ============================================================================
import {
  batchSalvaDa, batchVuoto, manifestoConferma, manifestoSalva,
  manifestoScarto, validaEsitoGiornale, validaRisposta,
  type ClienteContratto, type HasherTesto, type OperazioneContratto,
} from './contrattoRevisione.ts'
import type { StatoRevisione } from './revisione.ts'

// custodia delle OPERAZIONI del contratto (parallela alla traccia della
// revisione; in futuro vivrà nello stesso deposito durevole)
export type DepositoOperazioni = {
  salva(op: OperazioneContratto): { errore?: string }
  leggi(opKey: string): { op?: OperazioneContratto; errore?: string }
  rimuovi(opKey: string): { errore?: string }
}

// deposito in memoria, serializzabile: accetta un contenuto INIZIALE
// (es. ricreato da JSON dopo una riapertura) e conserva COPIE profonde
// (le modifiche successive dell'utente non toccano le pendenze). Una
// chiave già pendente NON è sovrascrivibile con un'operazione diversa.
export function depositoOperazioniInMemoria(iniziali: OperazioneContratto[] = []): DepositoOperazioni & { contenuto: () => OperazioneContratto[] } {
  let ops: OperazioneContratto[] = JSON.parse(JSON.stringify(iniziali))
  return {
    salva(op) {
      const esistente = ops.find(o => o.opKey === op.opKey)
      if (esistente) {
        if (esistente.impronta === op.impronta && esistente.kind === op.kind
          && esistente.documentId === op.documentId && esistente.baseRev === op.baseRev) return {}
        return { errore: `la chiave ${op.opKey} è già pendente con UN'ALTRA richiesta: una pendenza non cambia identità né contenuto` }
      }
      ops = [...ops, JSON.parse(JSON.stringify(op))]
      return {}
    },
    leggi(opKey) {
      const op = ops.find(o => o.opKey === opKey)
      return { op: op ? JSON.parse(JSON.stringify(op)) : undefined }
    },
    rimuovi(opKey) { ops = ops.filter(o => o.opKey !== opKey); return {} },
    contenuto: () => JSON.parse(JSON.stringify(ops)),
  }
}

export type EsitoOperazione =
  | { ok: true; revDopo: number; mappaNuove: Record<string, string>; spese?: string[]; ripetuta?: boolean; avviso?: string }
  | { ok: false; conflitto: 'superata'; errore: string }
  | { ok: false; errore: string; sentinella?: string }
  | { ok: false; incerto: true; errore: string; op: OperazioneContratto }

const rete = (msg: string) => /fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)

// esegue un'operazione: custodia PRIMA dell'invio (se fallisce, NIENTE
// parte); la risposta viene CONVALIDATA per l'operazione specifica e la
// custodia si rimuove SOLO a esito definito (successo, superata,
// sentinella o rifiuto restituito) — un errore della rimozione diventa
// un AVVISO, mai un silenzio.
async function esegui(
  cliente: ClienteContratto, deposito: DepositoOperazioni,
  op: OperazioneContratto, invia: () => Promise<unknown>,
): Promise<EsitoOperazione> {
  const custodia = deposito.salva(op)
  if (custodia.errore)
    return { ok: false, errore: `non riesco a custodire l'operazione (${custodia.errore}): NON la invio — senza custodia una risposta persa sarebbe irrecuperabile` }
  let r: unknown
  try { r = await invia() } catch (e) {
    const msg = String((e as Error).message ?? e)
    return { ok: false, incerto: true, errore: `${rete(msg) ? 'esito incerto' : 'esito ignoto'} (${msg}): l'operazione è custodita — il recupero passa da esito_revisione, nessun reinvio automatico`, op }
  }
  const v = validaRisposta(op, r)
  if (v.tipo === 'incerta')
    return { ok: false, incerto: true, errore: `${v.perche} — l'operazione resta custodita, il recupero passa da esito_revisione`, op }
  // esito DEFINITO: si chiude la responsabilità; se la rimozione
  // fallisce lo si DICE (la pendenza ricomparirà e verrà riconciliata)
  const pulizia = deposito.rimuovi(op.opKey)
  const avviso = pulizia.errore
    ? `custodia non rimossa (${pulizia.errore}): la pendenza ricomparirà e il recupero la richiuderà senza effetti doppi`
    : undefined
  if (v.tipo === 'successo')
    return { ok: true, revDopo: v.revDopo, mappaNuove: v.mappaNuove, ...(v.spese ? { spese: v.spese } : {}), ...(v.ripetuta ? { ripetuta: true } : {}), ...(avviso ? { avviso } : {}) }
  if (v.tipo === 'superata')
    return { ok: false, conflitto: 'superata', errore: `il documento è cambiato rispetto alla revisione attesa: ricarica e riproponi le modifiche — nulla è stato scritto${avviso ? ` (${avviso})` : ''}` }
  if (v.tipo === 'rifiuto')
    return { ok: false, errore: `il servizio ha rifiutato l'operazione: ${v.errore}${avviso ? ` (${avviso})` : ''}` }
  return { ok: false, errore: `il servizio ha respinto l'operazione (${v.sentinella}${v.dettaglio ? `: ${v.dettaglio}` : ''}) — nulla è stato scritto${avviso ? ` (${avviso})` : ''}`, sentinella: v.sentinella }
}

// l'invio EFFETTIVO di un'operazione custodita: sempre e solo dalla
// RICHIESTA originale (serve al primo invio e al reinvio dopo 'assente')
function inviaDaCustodia(cliente: ClienteContratto, op: OperazioneContratto): () => Promise<unknown> {
  const base = { op_key: op.opKey, document_id: op.documentId, base_rev: op.baseRev }
  if (op.richiesta.kind === 'salva') {
    const modifiche = op.richiesta.modifiche
    return () => cliente.salvaRevisione({ ...base, modifiche })
  }
  if (op.richiesta.kind === 'conferma') {
    const correzioni = op.richiesta.correzioni
    return () => cliente.confermaRevisione({ ...base, correzioni })
  }
  const motivo = op.richiesta.motivo
  return () => cliente.scartaRevisione({ ...base, motivo })
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
    richiesta: { kind: 'salva', modifiche: batch },
  }
  return esegui(cliente, deposito, op, inviaDaCustodia(cliente, op))
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
    richiesta: { kind: 'conferma', correzioni },
  }
  return esegui(cliente, deposito, op, inviaDaCustodia(cliente, op))
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
    richiesta: { kind: 'scarto', motivo: motivo.trim() },
  }
  return esegui(cliente, deposito, op, inviaDaCustodia(cliente, op))
}

// REINVIO di una pendenza (dopo un recupero «assente»): stessa chiave,
// stessa richiesta CUSTODITA — mai ricostruita dalla schermata
export function reinviaOperazione(
  cliente: ClienteContratto, deposito: DepositoOperazioni, op: OperazioneContratto,
): Promise<EsitoOperazione> {
  return esegui(cliente, deposito, op, inviaDaCustodia(cliente, op))
}

// ---- RECUPERO per chiave --------------------------------------------------
export type EsitoRecupero =
  | { stato: 'applicata'; revDopo: number; mappaNuove: Record<string, string>; spese?: string[]; avviso?: string }
  | { stato: 'assente' }                    // MAI arrivata fin qui: reinvio sicuro con la STESSA richiesta custodita
  | { stato: 'estranea'; errore: string }   // a giornale c'è ALTRO sotto quella chiave: pendenza conservata
  | { stato: 'illeggibile'; errore: string }// lettura fallita o esito malformato ≠ assente: pendenza conservata

export async function recuperaOperazione(
  cliente: ClienteContratto, deposito: DepositoOperazioni, op: OperazioneContratto,
): Promise<EsitoRecupero> {
  let g
  try { g = await cliente.esitoRevisione(op.opKey) } catch (e) {
    return { stato: 'illeggibile', errore: `lettura dell'esito fallita (${String((e as Error).message ?? e)}): la pendenza resta — lettura fallita non è «assente»` }
  }
  // l'esito del giornale viene CONVALIDATO PER INTERO prima di toccare
  // la custodia: identità piena E corpo valido (revisione, mappa, spese)
  const v = validaEsitoGiornale(op, g)
  if (v.tipo === 'assente') return { stato: 'assente' }
  if (v.tipo === 'estranea')
    return { stato: 'estranea', errore: `a giornale la chiave porta un'operazione con ${v.perche}: esito estraneo, la pendenza resta e va segnalata` }
  if (v.tipo === 'malformata')
    return { stato: 'illeggibile', errore: `l'esito a giornale è MALFORMATO (${v.perche}): la pendenza resta finché non è verificabile` }
  const pulizia = deposito.rimuovi(op.opKey)
  return {
    stato: 'applicata', revDopo: v.revDopo, mappaNuove: v.mappaNuove,
    ...(v.spese ? { spese: v.spese } : {}),
    ...(pulizia.errore ? { avviso: `custodia non rimossa (${pulizia.errore}): la pendenza ricomparirà e verrà richiusa senza effetti doppi` } : {}),
  }
}
