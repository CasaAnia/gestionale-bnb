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
  // incerto=true quando NON si può sapere se l'inserimento è avvenuto
  // (es. risposta senza id): non è un rifiuto ordinario
  aggiungiRiga(riga: RigaNuova): Promise<{ errore?: string; id?: string; incerto?: boolean }>
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
  const avvisi: string[] = []
  const custodia = deposito.salva(tracciaDa(stato))
  if (custodia.errore)
    return { ok: false, stato, errore: `non riesco a mettere al sicuro gli originali (${custodia.errore}): NON salvo, altrimenti le correzioni andrebbero perse` }
  // ogni cambiamento di stato torna in custodia. Un fallimento QUI non
  // perde responsabilità (la custodia precedente è più prudente: 'in_invio'
  // resta 'in_invio' o la voce resta pendente), ma si DICE, mai ignorato.
  const custodisci = (nuovo: StatoRevisione) => {
    stato = nuovo
    const r = deposito.salva(tracciaDa(stato))
    if (r.errore) avvisi.push(`custodia non aggiornata (${r.errore}): resta valida quella precedente, più prudente`)
  }
  const marca = (idLocale: string, statoRiga: 'nuova' | 'in_invio' | 'salvata' | 'incerta', id?: string) =>
    ({ ...stato, righeNuove: stato.righeNuove.map(x => x.idLocale === idLocale ? { ...x, stato: statoRiga, ...(id ? { id } : {}) } : x) })
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
    // 'incerta' aspettano una risoluzione esplicita (mai reinvio cieco)
    for (const riga of stato.righeNuove.filter(r => r.stato === 'nuova')) {
      // la RESPONSABILITÀ si persiste PRIMA della richiesta: se questa
      // custodia fallisce l'INSERT NON parte (altrimenti una pagina morta
      // con la risposta per aria produrrebbe un doppione al Salva dopo)
      stato = marca(riga.idLocale, 'in_invio')
      const presa = deposito.salva(tracciaDa(stato))
      if (presa.errore) {
        stato = marca(riga.idLocale, 'nuova')
        return { ok: false, stato, errore: `non riesco a custodire l'invio della voce «${riga.name}» (${presa.errore}): NON la invio — senza traccia un'interruzione creerebbe un doppione` }
      }
      let r: { errore?: string; id?: string; incerto?: boolean }
      try { r = await cliente.aggiungiRiga(payloadRigaNuova(riga)) } catch (e) {
        // QUALSIASI eccezione a richiesta partita è esito ignoto
        const msg = String((e as Error).message ?? e)
        custodisci(marca(riga.idLocale, 'incerta'))
        return { ok: false, stato, incerto: true, errore: `la voce nuova «${riga.name}» ha l'esito incerto (${msg}): nessun reinvio automatico — chiudi e ricontrolla` }
      }
      if (r.errore && !r.incerto && !rete(r.errore)) {
        // rifiuto ESPLICITO del servizio: non inserita, si può ritentare
        custodisci(marca(riga.idLocale, 'nuova'))
        return { ok: false, stato, errore: `una voce nuova non è stata aggiunta: ${r.errore}` }
      }
      if (r.errore || r.incerto || !r.id) {
        custodisci(marca(riga.idLocale, 'incerta'))
        return { ok: false, stato, incerto: true, errore: `la voce nuova «${riga.name}» ha l'esito incerto (${r.errore ?? 'risposta senza id'}): nessun reinvio automatico — chiudi e ricontrolla` }
      }
      custodisci(marca(riga.idLocale, 'salvata', r.id))
    }
    return { ok: true, stato, avviso: avvisi.length ? avvisi.join(' · ') : undefined }
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
