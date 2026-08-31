// ============================================================================
// SCRITTURE DELLA REVISIONE (Fase 4, blocco 3 — quarta revisione) — servizi
// INIETTATI (finti nei test, revisioneSupabase.ts nelle pagine). Regole:
//  · PRIMA di ogni scrittura remota gli ORIGINALI e le modifiche vanno in
//    custodia durevole: se la custodia fallisce, non si salva nulla;
//  · COORDINAMENTO PER DOCUMENTO sull'INTERO ciclo: l'operazione annota
//    «inCorso» nella traccia prima di scrivere e RICONTROLLA la
//    generazione prima di OGNI chiamata remota — se un'altra apertura ha
//    preso in mano il documento, la sequenza si FERMA subito (niente
//    scritture superate che rimettono valori vecchi) e lo dice; anche la
//    RIMOZIONE della custodia rispetta la generazione;
//  · si aggiornano SOLO i campi di revisione della 0021; le righe nuove
//    viaggiano col PAYLOAD ESPLICITO delle colonne concesse in INSERT;
//  · errori RESTITUITI e righe toccate contate: mai successi simulati;
//  · un errore di RETE è INCERTO su ENTRAMBI i canali: ci si FERMA;
//  · una riga nuova inserita si RICORDA col suo id (mai due INSERT);
//    una risposta persa la marca 'incerta' — nessun reinvio automatico;
//  · la CONFERMA passa SOLO dalla RPC atomica, e RIFIUTA di partire
//    finché resta una pendenza d'invio senza esito dimostrato (anche
//    'riconosciuta': l'annotazione non è una prova) — il controllo vive
//    QUI, non solo nel bottone.
// ============================================================================
import type { StatoRevisione, TracciaRevisione } from './revisione.ts'
import { correzioniDa, payloadRigaNuova, tracciaDa, vincoliVuoti } from './revisione.ts'
import type { ModificaBozza, ModificaRiga, OperazioneInCorsa, RigaNuova } from './revisione.ts'
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

// PRIMA di ogni chiamata remota si verifica chi ha in mano il documento.
// TRE esiti distinti, e ci si ferma su ognuno: se la custodia non si può
// LEGGERE non si può nemmeno sapere se si è stati superati — quindi non
// si scrive (fermarsi dopo, con un avviso, non basterebbe: la scrittura
// incompatibile sarebbe già partita).
export function fermaOperazione(deposito: DepositoRevisione, s: StatoRevisione): string | null {
  const lettura = deposito.leggi(s.documentId)
  if (lettura.errore)
    return `custodia illeggibile durante l'operazione (${lettura.errore}): non posso verificare chi ha in mano il documento — mi fermo PRIMA della prossima scrittura`
  if (!lettura.traccia)
    return 'la custodia del documento è sparita durante l\'operazione (un\'altra apertura l\'ha chiusa): mi fermo prima della prossima scrittura'
  const g = lettura.traccia.generazione ?? 0
  if (g > s.generazione)
    return `operazione superata: il documento è stato ripreso da un'altra apertura (generazione ${g} > ${s.generazione}) — questa sequenza si ferma senza altre scritture`
  return null
}

// una pendenza d'invio senza esito DIMOSTRATO (anche riconosciuta)
export const pendenzaNonDimostrata = (s: StatoRevisione) =>
  s.righeNuove.find(r => r.stato === 'incerta' || r.stato === 'in_invio' || r.stato === 'riconosciuta')

// salva TUTTE le modifiche pendenti (totale, bozze, righe, righe nuove).
// Al primo errore ci si FERMA e lo si dice; su esito incerto NON si
// scrive altro. Le modifiche restano nello stato (e nella custodia).
export async function salvaModifiche(
  cliente: ClienteRevisione, deposito: DepositoRevisione, s: StatoRevisione,
): Promise<EsitoRevisione> {
  let stato = s
  const avvisi: string[] = []
  const inCorso: OperazioneInCorsa = { tipo: 'salva', generazione: s.generazione }
  const conOperazione = (t: TracciaRevisione): TracciaRevisione => ({ ...t, inCorso })
  // l'operazione si ANNOTA nella traccia prima di qualunque scrittura:
  // se la custodia non riesce, non si salva nulla
  const custodia = deposito.salva(conOperazione(tracciaDa(stato)))
  if (custodia.errore)
    return { ok: false, stato, errore: `non riesco a mettere al sicuro gli originali (${custodia.errore}): NON salvo, altrimenti le correzioni andrebbero perse` }
  // ogni cambiamento di stato torna in custodia. Un fallimento QUI non
  // perde responsabilità (resta la custodia precedente, più prudente),
  // ma si DICE, mai ignorato.
  const custodisci = (nuovo: StatoRevisione, chiusa = false) => {
    stato = nuovo
    const t = chiusa ? tracciaDa(stato) : conOperazione(tracciaDa(stato))
    const r = deposito.salva(t)
    if (r.errore) avvisi.push(`custodia non aggiornata (${r.errore}): resta valida quella precedente, più prudente`)
  }
  const marca = (idLocale: string, statoRiga: 'nuova' | 'in_invio' | 'salvata' | 'incerta', id?: string) =>
    ({ ...stato, righeNuove: stato.righeNuove.map(x => x.idLocale === idLocale ? { ...x, stato: statoRiga, ...(id ? { id } : {}) } : x) })
  // chiusura PULITA dell'operazione (successo o rifiuto definitivo):
  // l'annotazione inCorso si toglie; su esito INCERTO invece resta, così
  // la prossima apertura sa che una richiesta può essere ancora per aria
  const chiudi = (esito: EsitoRevisione): EsitoRevisione => {
    if (!esito.ok && esito.incerto) return esito
    const r = deposito.salva(tracciaDa(stato))
    if (r.errore && !avvisi.some(a => a.includes(r.errore!))) avvisi.push(`custodia non aggiornata (${r.errore})`)
    if (esito.ok) return { ...esito, avviso: avvisi.length ? avvisi.join(' · ') : undefined }
    return esito
  }
  try {
    if (stato.docTotaleCent !== stato.docTotaleOriginaleCent) {
      const stop = fermaOperazione(deposito, stato)
      if (stop) return { ok: false, stato, errore: stop }
      const r = await cliente.aggiornaDocTotale(stato.documentId, stato.docTotaleCent == null ? null : stato.docTotaleCent / 100)
      if (r.errore) return chiudi(esitoErrore(stato, 'totale non salvato', r.errore))
      if ((r.righe ?? 0) < 1) return chiudi({ ok: false, stato, errore: 'totale non salvato: nessuna riga toccata (documento protetto o sparito)' })
    }
    for (const [id, campi] of Object.entries(stato.modificheBozze)) {
      if (Object.keys(campi).length === 0) continue
      const stop = fermaOperazione(deposito, stato)
      if (stop) return { ok: false, stato, errore: stop }
      const r = await cliente.aggiornaBozza(id, campi)
      if (r.errore) return chiudi(esitoErrore(stato, 'una parte non è stata salvata', r.errore))
      if ((r.righe ?? 0) < 1) return chiudi({ ok: false, stato, errore: 'una parte non è stata salvata: nessuna riga toccata' })
    }
    for (const [id, campi] of Object.entries(stato.modificheRighe)) {
      if (Object.keys(campi).length === 0) continue
      const stop = fermaOperazione(deposito, stato)
      if (stop) return { ok: false, stato, errore: stop }
      const r = await cliente.aggiornaRiga(id, campi)
      if (r.errore) return chiudi(esitoErrore(stato, 'una voce non è stata salvata', r.errore))
      if ((r.righe ?? 0) < 1) return chiudi({ ok: false, stato, errore: 'una voce non è stata salvata: nessuna riga toccata' })
    }
    // SOLO le righe mai inviate: le 'salvata' hanno già il loro id, le
    // 'incerta'/'riconosciuta' aspettano il contratto idempotente
    for (const riga of stato.righeNuove.filter(r => r.stato === 'nuova')) {
      const stop = fermaOperazione(deposito, stato)
      if (stop) return { ok: false, stato, errore: stop }
      // la RESPONSABILITÀ si persiste PRIMA della richiesta: se questa
      // custodia fallisce l'INSERT NON parte
      stato = marca(riga.idLocale, 'in_invio')
      const presa = deposito.salva(conOperazione(tracciaDa(stato)))
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
        return chiudi({ ok: false, stato, errore: `una voce nuova non è stata aggiunta: ${r.errore}` })
      }
      if (r.errore || r.incerto || !r.id) {
        custodisci(marca(riga.idLocale, 'incerta'))
        return { ok: false, stato, incerto: true, errore: `la voce nuova «${riga.name}» ha l'esito incerto (${r.errore ?? 'risposta senza id'}): nessun reinvio automatico — chiudi e ricontrolla` }
      }
      custodisci(marca(riga.idLocale, 'salvata', r.id))
    }
    return chiudi({ ok: true, stato })
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, stato, incerto: true, errore: `salvataggio dall'esito incerto (${msg}): le modifiche restano qui — chiudi e ricontrolla per vedere cosa è arrivato` }
      : chiudi({ ok: false, stato, errore: msg })
  }
}

// CONFERMA: prima si salvano le modifiche, poi la RPC atomica con le
// correzioni. La quadratura la rifà il server. A conferma riuscita la
// traccia si toglie (rispettando la generazione: quella di una schermata
// più recente NON viene cancellata). RIFIUTA di partire finché resta una
// pendenza d'invio senza esito dimostrato — anche 'riconosciuta'.
export async function confermaRevisione(
  cliente: ClienteRevisione, deposito: DepositoRevisione, s: StatoRevisione,
): Promise<EsitoRevisione> {
  const pendenza = pendenzaNonDimostrata(s)
  if (pendenza)
    return { ok: false, stato: s, errore: `la conferma è bloccata: l'invio della voce «${pendenza.name}» è senza esito dimostrato — si sblocca col contratto idempotente (proposta 0023)` }
  if (!vincoliVuoti(s.vincoli))
    return { ok: false, stato: s, errore: 'la conferma è bloccata: alcuni campi sono vincolati da un salvataggio precedente senza esito riferibile (lo scarto resta possibile)' }
  const salvataggio = await salvaModifiche(cliente, deposito, s)
  if (!salvataggio.ok) return salvataggio
  const stato = salvataggio.stato
  const avvisi = salvataggio.avviso ? [salvataggio.avviso] : []
  const annotata = deposito.salva({ ...tracciaDa(stato), inCorso: { tipo: 'conferma', generazione: stato.generazione } })
  if (annotata.errore)
    return { ok: false, stato, errore: `non riesco ad annotare la conferma in custodia (${annotata.errore}): non la avvio` }
  const stop = fermaOperazione(deposito, stato)
  if (stop) return { ok: false, stato, errore: stop }
  try {
    const r = await cliente.confermaDocumento(stato.documentId, correzioniDa(stato))
    if (r.errore) {
      if (rete(r.errore))
        return { ok: false, stato, incerto: true, errore: `conferma dall'esito incerto (${r.errore}): NON riprovare alla cieca — chiudi e ricontrolla: se il documento risulta confermato è andata (la RPC è idempotente)` }
      deposito.salva(tracciaDa(stato))                  // rifiuto definitivo: l'annotazione si toglie
      return { ok: false, stato, errore: r.errore }
    }
    if (!r.ids || r.ids.length === 0)
      return { ok: false, stato, errore: 'la conferma non ha restituito le spese create: verifica lo stato prima di riprovare', incerto: true }
    const pulizia = deposito.rimuovi(stato.documentId, stato.generazione)
    if (pulizia.errore) avvisi.push(`documento confermato, ma la traccia locale non è stata rimossa (${pulizia.errore})`)
    return { ok: true, stato, avviso: avvisi.length ? avvisi.join(' · ') : undefined }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, stato, incerto: true, errore: `conferma dall'esito incerto (${msg}): NON riprovare alla cieca — chiudi e ricontrolla: se il documento risulta confermato è andata (la RPC è idempotente)` }
      : { ok: false, stato, errore: msg }
  }
}

// SCARTO: stesso protocollo delle altre operazioni — l'annotazione
// «inCorso» va in custodia PRIMA della RPC (se la custodia è illeggibile
// o non scrivibile, la RPC NON parte), un esito incerto conserva
// l'annotazione (la prossima apertura passerà dalla presa in carico), un
// rifiuto definitivo la toglie, la rimozione rispetta la generazione.
export async function scartaRevisione(
  cliente: ClienteRevisione, deposito: DepositoRevisione,
  s: StatoRevisione, motivo: string,
): Promise<{ ok: boolean; errore?: string; incerto?: boolean; avviso?: string }> {
  if (!motivo.trim()) return { ok: false, errore: 'serve il motivo dello scarto' }
  const annotata = deposito.salva({ ...tracciaDa(s), inCorso: { tipo: 'scarto', generazione: s.generazione } })
  if (annotata.errore)
    return { ok: false, errore: `non riesco ad annotare lo scarto in custodia (${annotata.errore}): non lo avvio` }
  const stop = fermaOperazione(deposito, s)
  if (stop) return { ok: false, errore: stop }
  try {
    const r = await cliente.scartaDocumento(s.documentId, motivo.trim())
    if (r.errore) {
      if (rete(r.errore))
        return { ok: false, incerto: true, errore: `scarto dall'esito incerto (${r.errore}): chiudi e ricontrolla lo stato` }
      deposito.salva(tracciaDa(s))                     // rifiuto definitivo: l'annotazione si toglie
      return { ok: false, errore: r.errore }
    }
    const pulizia = deposito.rimuovi(s.documentId, s.generazione)
    return pulizia.errore
      ? { ok: true, avviso: `documento scartato, ma la traccia locale non è stata rimossa (${pulizia.errore})` }
      : { ok: true }
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    return rete(msg)
      ? { ok: false, incerto: true, errore: `scarto dall'esito incerto (${msg}): chiudi e ricontrolla lo stato` }
      : { ok: false, errore: msg }
  }
}
