// ============================================================================
// SCRITTURE DELLA REVISIONE (Fase 4, blocco 3 — correzioni) — servizi
// INIETTATI (finti nei test, revisioneSupabase.ts nelle pagine). Regole:
//  · PRIMA di ogni scrittura remota gli ORIGINALI e le modifiche vanno in
//    custodia durevole: se la custodia fallisce, non si salva nulla (le
//    correzioni per la RPC non devono potersi perdere);
//  · si aggiornano SOLO i campi di revisione della 0021; le righe nuove
//    viaggiano col PAYLOAD ESPLICITO delle colonne concesse in INSERT;
//  · errori RESTITUITI e righe toccate contate: mai successi simulati,
//    zero righe non è un successo;
//  · un errore di RETE è INCERTO su ENTRAMBI i canali (errore restituito o
//    eccezione): ci si FERMA, niente altre scritture prima di riconciliare;
//  · una riga nuova inserita si RICORDA col suo id (mai due INSERT della
//    stessa riga); una risposta persa la marca 'incerta' — si riconcilia
//    alla riapertura, MAI reinvio alla cieca;
//  · la CONFERMA passa SOLO dalla RPC atomica conferma_documento (mai
//    inserimenti diretti nelle spese definitive), con le correzioni.
// ============================================================================
import type { StatoRevisione } from './revisione.ts'
import { correzioniDa, payloadRigaNuova, tracciaDa } from './revisione.ts'
import type { ModificaBozza, ModificaRiga, RigaNuova } from './revisione.ts'
import type { DepositoRevisione } from './revisioneDurevole.ts'

export type ClienteRevisione = {
  aggiornaDocTotale(documentId: string, totale: number | null): Promise<{ errore?: string; righe?: number }>
  aggiornaBozza(id: string, campi: ModificaBozza): Promise<{ errore?: string; righe?: number }>
  aggiornaRiga(id: string, campi: ModificaRiga): Promise<{ errore?: string; righe?: number }>
  aggiungiRiga(riga: RigaNuova): Promise<{ errore?: string; id?: string }>
  // le RPC atomiche esistenti — MAI insert diretti nelle spese definitive
  confermaDocumento(documentId: string, correzioni: Record<string, unknown>[]): Promise<{ ids?: string[]; errore?: string }>
  scartaDocumento(documentId: string, motivo: string): Promise<{ errore?: string }>
}

// l'esito porta sempre lo STATO aggiornato (id delle righe inserite,
// marcature 'salvata'/'incerta'): la schermata riparte da lì, mai da capo
export type EsitoRevisione =
  | { ok: true; stato: StatoRevisione; avviso?: string }
  | { ok: false; stato: StatoRevisione; errore: string; incerto?: boolean }

const rete = (msg: string) => /fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)

// classifica un errore su QUALUNQUE canale: di rete → INCERTO (non si sa
// se la scrittura è arrivata), altrimenti fallimento normale
const esitoErrore = (stato: StatoRevisione, contesto: string, msg: string): EsitoRevisione =>
  rete(msg)
    ? { ok: false, stato, incerto: true, errore: `${contesto} dall'esito incerto (${msg}): le modifiche restano qui — chiudi e ricontrolla per vedere cosa è arrivato prima di riprovare` }
    : { ok: false, stato, errore: `${contesto}: ${msg}` }

// salva TUTTE le modifiche pendenti (totale, bozze, righe, righe nuove).
// Al primo errore ci si FERMA e lo si dice; su esito incerto NON si
// scrive altro. Le modifiche restano nello stato (e nella custodia).
export async function salvaModifiche(
  cliente: ClienteRevisione, deposito: DepositoRevisione, s: StatoRevisione,
): Promise<EsitoRevisione> {
  let stato = s
  const custodia = deposito.salva(tracciaDa(stato))
  if (custodia.errore)
    return { ok: false, stato, errore: `non riesco a mettere al sicuro gli originali (${custodia.errore}): NON salvo, altrimenti le correzioni andrebbero perse` }
  // ogni cambiamento di stato torna anche in custodia (ignorare l'errore
  // qui non perde nulla: la custodia precedente resta valida)
  const custodisci = (nuovo: StatoRevisione) => { stato = nuovo; deposito.salva(tracciaDa(stato)) }
  try {
    if (stato.docTotaleCent !== stato.docTotaleOriginaleCent) {
      const r = await cliente.aggiornaDocTotale(stato.documentId, stato.docTotaleCent == null ? null : stato.docTotaleCent / 100)
      if (r.errore) return esitoErrore(stato, 'totale non salvato', r.errore)
      if ((r.righe ?? 0) < 1) return { ok: false, stato, errore: 'totale non salvato: nessuna riga toccata (documento protetto o sparito)' }
    }
    for (const [id, campi] of Object.entries(stato.modificheBozze)) {
      if (Object.keys(campi).length === 0) continue
      const r = await cliente.aggiornaBozza(id, campi)
      if (r.errore) return esitoErrore(stato, 'una parte non è stata salvata', r.errore)
      if ((r.righe ?? 0) < 1) return { ok: false, stato, errore: 'una parte non è stata salvata: nessuna riga toccata' }
    }
    for (const [id, campi] of Object.entries(stato.modificheRighe)) {
      if (Object.keys(campi).length === 0) continue
      const r = await cliente.aggiornaRiga(id, campi)
      if (r.errore) return esitoErrore(stato, 'una voce non è stata salvata', r.errore)
      if ((r.righe ?? 0) < 1) return { ok: false, stato, errore: 'una voce non è stata salvata: nessuna riga toccata' }
    }
    // SOLO le righe mai inviate: le 'salvata' hanno già il loro id, le
    // 'incerta' aspettano la riconciliazione (mai reinvio alla cieca)
    for (const riga of stato.righeNuove.filter(r => r.stato === 'nuova')) {
      let r: { errore?: string; id?: string }
      try { r = await cliente.aggiungiRiga(payloadRigaNuova(riga)) } catch (e) {
        const msg = String((e as Error).message ?? e)
        if (rete(msg)) {
          custodisci({ ...stato, righeNuove: stato.righeNuove.map(x => x.idLocale === riga.idLocale ? { ...x, stato: 'incerta' as const } : x) })
          return esitoErrore(stato, `la voce nuova «${riga.name}»`, msg)
        }
        throw e
      }
      if (r.errore) {
        if (rete(r.errore)) {
          custodisci({ ...stato, righeNuove: stato.righeNuove.map(x => x.idLocale === riga.idLocale ? { ...x, stato: 'incerta' as const } : x) })
          return esitoErrore(stato, `la voce nuova «${riga.name}»`, r.errore)
        }
        return { ok: false, stato, errore: `una voce nuova non è stata aggiunta: ${r.errore}` }
      }
      if (!r.id) {
        custodisci({ ...stato, righeNuove: stato.righeNuove.map(x => x.idLocale === riga.idLocale ? { ...x, stato: 'incerta' as const } : x) })
        return { ok: false, stato, errore: 'una voce nuova è stata inviata ma il servizio non ha restituito l\'id: esito incerto — chiudi e ricontrolla prima di riprovare', incerto: true }
      }
      custodisci({ ...stato, righeNuove: stato.righeNuove.map(x => x.idLocale === riga.idLocale ? { ...x, stato: 'salvata' as const, id: r.id } : x) })
    }
    return { ok: true, stato }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, stato, incerto: true, errore: `salvataggio dall'esito incerto (${msg}): le modifiche restano qui — chiudi e ricontrolla per vedere cosa è arrivato` }
      : { ok: false, stato, errore: msg }
  }
}

// CONFERMA: prima si salvano le modifiche, poi la RPC atomica con le
// correzioni (differenze originale→corrente). La quadratura la rifà il
// server: un rifiuto arriva col suo messaggio, mai mascherato. A conferma
// riuscita la traccia in custodia si toglie (le correzioni ormai sono nel
// registro del database).
export async function confermaRevisione(
  cliente: ClienteRevisione, deposito: DepositoRevisione, s: StatoRevisione,
): Promise<EsitoRevisione> {
  const salvataggio = await salvaModifiche(cliente, deposito, s)
  if (!salvataggio.ok) return salvataggio
  const stato = salvataggio.stato
  try {
    const r = await cliente.confermaDocumento(stato.documentId, correzioniDa(stato))
    if (r.errore) {
      return rete(r.errore)
        ? { ok: false, stato, incerto: true, errore: `conferma dall'esito incerto (${r.errore}): NON riprovare alla cieca — chiudi e ricontrolla: se il documento risulta confermato è andata (la RPC è idempotente)` }
        : { ok: false, stato, errore: r.errore }
    }
    if (!r.ids || r.ids.length === 0)
      return { ok: false, stato, errore: 'la conferma non ha restituito le spese create: verifica lo stato prima di riprovare', incerto: true }
    const pulizia = deposito.rimuovi(stato.documentId)
    return pulizia.errore
      ? { ok: true, stato, avviso: `documento confermato, ma la traccia locale non si è tolta (${pulizia.errore}): innocua, sparirà da sola` }
      : { ok: true, stato }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, stato, incerto: true, errore: `conferma dall'esito incerto (${msg}): NON riprovare alla cieca — chiudi e ricontrolla: se il documento risulta confermato è andata (la RPC è idempotente)` }
      : { ok: false, stato, errore: msg }
  }
}

export async function scartaRevisione(
  cliente: ClienteRevisione, deposito: DepositoRevisione,
  documentId: string, motivo: string,
): Promise<{ ok: boolean; errore?: string; incerto?: boolean; avviso?: string }> {
  if (!motivo.trim()) return { ok: false, errore: 'serve il motivo dello scarto' }
  try {
    const r = await cliente.scartaDocumento(documentId, motivo.trim())
    if (r.errore) {
      return rete(r.errore)
        ? { ok: false, incerto: true, errore: `scarto dall'esito incerto (${r.errore}): chiudi e ricontrolla lo stato` }
        : { ok: false, errore: r.errore }
    }
    const pulizia = deposito.rimuovi(documentId)
    return pulizia.errore
      ? { ok: true, avviso: `documento scartato, ma la traccia locale non si è tolta (${pulizia.errore}): innocua` }
      : { ok: true }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, incerto: true, errore: `scarto dall'esito incerto (${msg}): chiudi e ricontrolla lo stato` }
      : { ok: false, errore: msg }
  }
}
