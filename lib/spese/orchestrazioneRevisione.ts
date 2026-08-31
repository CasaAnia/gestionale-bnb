// ============================================================================
// ORCHESTRAZIONE della revisione dietro l'INTERRUTTORE di percorso
// (lib/spese/percorso.ts). La schermata parla con QUESTA interfaccia:
//  · orchestrazioneLegacy — il percorso attuale, delega PURA a
//    revisioneScrittura (comportamento identico, bit per bit);
//  · orchestrazioneContratto — il contratto collaudato: batch atomico
//    con op_key, custodia delle operazioni registrata PRIMA dell'invio,
//    conferma/scarto versionati, PONTE durevole fra le due custodie
//    (ponteContratto) e riconciliazione delle pendenze.
// La RICONCILIAZIONE (riconciliaContratto) è un motore A SÉ: non
// dipende dal montaggio della schermata modificabile — la pagina la usa
// anche per i documenti ormai CHIUSI (una conferma mai arrivata al
// client va chiusa lo stesso), e il guscio della schermata la esegue
// PRIMA di ogni decisione del cancello di presa in carico.
// I controlli del blocco 3 restano identici e DAVANTI anche sul
// contratto: custodia degli originali PRIMA di scrivere, fermaOperazione
// (generazioni), vincoli, pendenze non dimostrate — e NESSUNA scrittura
// nuova (Scarta compreso) finché resta qualcosa da riconciliare.
// ============================================================================
import type { StatoRevisione, TracciaRevisione } from './revisione.ts'
import { correzioniDa, tracciaDa, vincoliVuoti } from './revisione.ts'
import type { DepositoRevisione } from './revisioneDurevole.ts'
import {
  confermaRevisione, fermaOperazione, pendenzaNonDimostrata, salvaModifiche,
  scartaRevisione, type ClienteRevisione, type EsitoRevisione,
} from './revisioneScrittura.ts'
import {
  batchSalvaDa, batchVuoto, manifestoConferma, manifestoSalva, manifestoScarto,
  validaEsitoGiornale,
  type ClienteContratto, type HasherTesto, type OperazioneContratto,
} from './contrattoRevisione.ts'
import {
  eseguiConferma, eseguiSalva, eseguiScarto, recuperaOperazione,
  reinviaOperazione, type EsitoOperazione,
} from './contrattoScrittura.ts'
import type { DepositoOperazioniElencabile } from './depositoOperazioniDurevole.ts'
import type { PonteContratto, RiferimentoOperazione } from './ponteContratto.ts'
import { improntaSha256 } from './improntaTesto.ts'

export type EsitoScarto = { ok: boolean; errore?: string; incerto?: boolean; avviso?: string }

// l'esito della RICONCILIAZIONE: le pendenze (deposito operazioni +
// ponte) vengono risolte — giornale, reinvio della richiesta custodita,
// o acquisizione dell'esito già custodito nel ponte — e ACQUISITE nella
// traccia della revisione (voci «salvata» con l'id, annotazione tolta,
// vincoli sciolti; chiusure che rimuovono la traccia). Un «bloccante»
// vieta ogni nuova scrittura.
export type AperturaRevisione = {
  risolte: number
  avvisi: string[]
  bloccante?: string
  // la revisione raggiunta da ciascun documento toccato (per aggiornare
  // la versione interna delle orchestrazioni aperte)
  revPerDocumento: Record<string, number>
}

export type OrchestrazioneRevisione = {
  salva(s: StatoRevisione): Promise<EsitoRevisione>
  conferma(s: StatoRevisione): Promise<EsitoRevisione>
  scarta(s: StatoRevisione, motivo: string): Promise<EsitoScarto>
  apertura(documentId: string): Promise<AperturaRevisione>
}

// ---- percorso LEGACY: delega pura, nessun comportamento nuovo -------------
export function orchestrazioneLegacy(cliente: ClienteRevisione, deposito: DepositoRevisione): OrchestrazioneRevisione {
  return {
    salva: s => salvaModifiche(cliente, deposito, s),
    conferma: s => confermaRevisione(cliente, deposito, s),
    scarta: (s, motivo) => scartaRevisione(cliente, deposito, s, motivo),
    // il legacy non ha un giornale da riconciliare: le sue pendenze
    // (righe incerte, inCorso) passano già dalla presa in carico
    apertura: async () => ({ risolte: 0, avvisi: [], revPerDocumento: {} }),
  }
}

// ---- il MOTORE di riconciliazione (indipendente dalla schermata) ----------
export type ServiziContratto = {
  cliente: ClienteContratto
  depositoRevisione: DepositoRevisione
  depositoOperazioni: DepositoOperazioniElencabile
  ponte: PonteContratto
  hasher?: HasherTesto
}

// un'operazione RICOSTRUITA dal riferimento del ponte: l'identità basta
// a convalidare l'esito del giornale (validaEsitoGiornale non guarda la
// richiesta), il campo richiesta è un segnaposto MAI usato per inviare
const opDaRiferimento = (rif: RiferimentoOperazione): OperazioneContratto => ({
  opKey: rif.opKey, kind: rif.kind, documentId: rif.documentId, baseRev: rif.baseRev,
  impronta: rif.impronta, clientRefs: rif.clientRefs,
  richiesta: { kind: 'scarto', motivo: '(segnaposto: mai inviato)' } as OperazioneContratto['richiesta'],
})

export async function riconciliaContratto(dip: ServiziContratto, documentId?: string): Promise<AperturaRevisione> {
  const { cliente, depositoRevisione, depositoOperazioni, ponte } = dip
  const hasher = dip.hasher ?? improntaSha256
  const avvisi: string[] = []
  const revPerDocumento: Record<string, number> = {}
  let risolte = 0
  const blocca = (bloccante: string): AperturaRevisione => ({ risolte, avvisi, bloccante, revPerDocumento })

  // l'ACQUISIZIONE nella traccia della revisione: prima l'esito diventa
  // DUREVOLE nel ponte (se non lo è già), poi la traccia — voci
  // «salvata» con l'id, annotazione tolta, vincoli sciolti — e SOLO a
  // traccia aggiornata il ponte si chiude. Un guasto lascia il ponte
  // con l'esito: la prossima riconciliazione completa (idempotente).
  const acquisisci = (rif: RiferimentoOperazione, esito: NonNullable<RiferimentoOperazione['esito']>): { bloccante?: string } => {
    const durevole = ponte.salva({ ...rif, esito })
    if (durevole.errore) avvisi.push(`esito non custodito nel ponte (${durevole.errore}): resta ricostruibile dal giornale`)
    const lettura = depositoRevisione.leggi(rif.documentId)
    if (lettura.errore)
      return { bloccante: `custodia della revisione illeggibile (${lettura.errore}): acquisizione sospesa — l'esito resta custodito e niente scritture nuove` }
    const traccia = lettura.traccia
    if (rif.kind === 'conferma' || rif.kind === 'scarto') {
      if (traccia) {
        const rm = depositoRevisione.rimuovi(rif.documentId, Math.max(traccia.generazione ?? 0, rif.generazione))
        if (rm.errore)
          return { bloccante: `documento chiuso ma traccia non rimossa (${rm.errore}): acquisizione sospesa, si completa alla prossima riconciliazione` }
      }
    } else if (traccia) {
      const righe = traccia.righeNuove.map(r =>
        rif.inInvio.includes(r.idLocale) && esito.mappaNuove[r.idLocale]
          ? { ...r, stato: 'salvata' as const, id: esito.mappaNuove[r.idLocale] }
          : r)
      const aggiornata: TracciaRevisione = { ...traccia, righeNuove: righe }
      delete aggiornata.inCorso            // l'annotazione era di questa operazione
      delete aggiornata.vincoli            // l'esito è DIMOSTRATO: i vincoli si sciolgono
      const sc = depositoRevisione.salva(aggiornata)
      if (sc.errore)
        return { bloccante: `esito ritrovato ma traccia non aggiornata (${sc.errore}): acquisizione sospesa — l'esito resta custodito nel ponte` }
    }
    const chiusa = ponte.rimuovi(rif.documentId)
    if (chiusa.errore) avvisi.push(`ponte non chiuso (${chiusa.errore}): la prossima riconciliazione lo richiuderà senza effetti doppi`)
    revPerDocumento[rif.documentId] = Math.max(revPerDocumento[rif.documentId] ?? 0, esito.revDopo)
    risolte++
    return {}
  }

  // la chiusura SENZA effetti (superata, o giornale che prova «mai
  // applicata»): le voci tornano «nuova», l'annotazione si toglie
  const annulla = (rif: RiferimentoOperazione, motivo: string): { bloccante?: string } => {
    const lettura = depositoRevisione.leggi(rif.documentId)
    if (lettura.errore)
      return { bloccante: `custodia della revisione illeggibile (${lettura.errore}): pendenza conservata` }
    if (lettura.traccia && rif.kind === 'salva') {
      const righe = lettura.traccia.righeNuove.map(r =>
        rif.inInvio.includes(r.idLocale) && (r.stato === 'in_invio' || r.stato === 'incerta')
          ? { ...r, stato: 'nuova' as const } : r)
      const aggiornata: TracciaRevisione = { ...lettura.traccia, righeNuove: righe }
      delete aggiornata.inCorso
      const sc = depositoRevisione.salva(aggiornata)
      if (sc.errore) return { bloccante: `traccia non aggiornata (${sc.errore}): pendenza conservata` }
    } else if (lettura.traccia) {
      const aggiornata: TracciaRevisione = { ...lettura.traccia }
      delete aggiornata.inCorso
      const sc = depositoRevisione.salva(aggiornata)
      if (sc.errore) return { bloccante: `traccia non aggiornata (${sc.errore}): pendenza conservata` }
    }
    const chiusa = ponte.rimuovi(rif.documentId)
    if (chiusa.errore) avvisi.push(`ponte non chiuso (${chiusa.errore}): verrà richiuso alla prossima riconciliazione`)
    risolte++
    avvisi.push(motivo)
    return {}
  }

  const eOps = depositoOperazioni.elenca()
  if (eOps.errore) return blocca(`custodia delle operazioni illeggibile (${eOps.errore}): niente scritture finché non si riesce a leggerla`)
  const ePonti = ponte.elenca()
  if (ePonti.errore) return blocca(`ponte fra le custodie illeggibile (${ePonti.errore}): niente scritture finché non si riesce a leggerlo`)
  const ops = (eOps.ops ?? []).filter(o => !documentId || o.documentId === documentId)
  const rifs = (ePonti.rifs ?? []).filter(r => !documentId || r.documentId === documentId)
  const rifPer = new Map(rifs.map(r => [r.opKey, r]))

  // 1) le operazioni ancora nel DEPOSITO (risposta mai convalidata):
  //    giornale, o reinvio della SOLA richiesta custodita
  for (const op of ops) {
    const rif = rifPer.get(op.opKey) ?? {
      opKey: op.opKey, kind: op.kind, documentId: op.documentId, baseRev: op.baseRev,
      impronta: op.impronta, clientRefs: op.clientRefs, inInvio: op.clientRefs, generazione: 0,
    }
    rifPer.delete(op.opKey)
    const r = await recuperaOperazione(cliente, depositoOperazioni, op)
    if (r.stato === 'applicata') {
      const a = acquisisci(rif, { revDopo: r.revDopo, mappaNuove: r.mappaNuove, ...(r.spese ? { spese: r.spese } : {}) })
      if (a.bloccante) return blocca(a.bloccante)
      avvisi.push(`l'operazione «${op.kind}» interrotta era ARRIVATA: ritrovata a giornale e acquisita${r.avviso ? ` (${r.avviso})` : ''}`)
      continue
    }
    if (r.stato === 'assente') {
      const ri = await reinviaOperazione(cliente, depositoOperazioni, op.opKey, hasher)
      if (ri.ok && !('nulla' in ri)) {
        const a = acquisisci(rif, { revDopo: ri.revDopo, mappaNuove: ri.mappaNuove, ...(ri.spese ? { spese: ri.spese } : {}) })
        if (a.bloccante) return blocca(a.bloccante)
        avvisi.push(`l'operazione «${op.kind}» non era mai arrivata: reinviata dalla custodia, applicata e acquisita`)
        continue
      }
      if (!ri.ok && 'conflitto' in ri) {
        const a = annulla(rif, `l'operazione «${op.kind}» custodita è stata SUPERATA nel frattempo: chiusa senza effetti`)
        if (a.bloccante) return blocca(a.bloccante)
        continue
      }
      return blocca(`il reinvio dell'operazione custodita non si è concluso (${!ri.ok ? ri.errore : 'esito inatteso'}): niente nuove scritture finché la pendenza non è risolta`)
    }
    // estranea o illeggibile: pendenza CONSERVATA, scritture vietate
    return blocca(r.errore)
  }

  // 2) i riferimenti del PONTE rimasti senza operazione nel deposito:
  //    l'operazione si era già risolta, ma l'ACQUISIZIONE non è finita
  for (const rif of rifPer.values()) {
    if (rif.esito) {
      const a = acquisisci(rif, rif.esito)
      if (a.bloccante) return blocca(a.bloccante)
      avvisi.push(`l'esito dell'operazione «${rif.kind}» era già custodito nel ponte: acquisizione completata`)
      continue
    }
    // niente esito custodito: fa fede il GIORNALE, interrogato con
    // l'identità completa del riferimento
    let g: unknown
    try { g = await cliente.esitoRevisione(rif.opKey) } catch (e) {
      return blocca(`lettura del giornale fallita (${String((e as Error).message ?? e)}): pendenza conservata`)
    }
    const v = validaEsitoGiornale(opDaRiferimento(rif), g)
    if (v.tipo === 'applicata') {
      const a = acquisisci(rif, { revDopo: v.revDopo, mappaNuove: v.mappaNuove, ...(v.spese ? { spese: v.spese } : {}) })
      if (a.bloccante) return blocca(a.bloccante)
      avvisi.push(`l'operazione «${rif.kind}» era ARRIVATA: ritrovata a giornale e acquisita`)
      continue
    }
    if (v.tipo === 'assente') {
      // il giornale non la conosce: mai applicata (respinta con esito
      // definito, o mai partita) — le voci tornano modificabili
      const a = annulla(rif, `l'operazione «${rif.kind}» non risulta a giornale: nulla è stato applicato, le voci tornano modificabili`)
      if (a.bloccante) return blocca(a.bloccante)
      continue
    }
    return blocca(`l'esito a giornale per l'operazione custodita non è verificabile (${v.perche}): pendenza conservata`)
  }

  return { risolte, avvisi, revPerDocumento }
}

// ---- percorso CONTRATTO ---------------------------------------------------
export function orchestrazioneContratto(dip: ServiziContratto & {
  // revisione_rev del documento al CARICAMENTO della pagina. Va LETTA
  // davvero (fonte): se manca — colonna non ancora migrata, riga senza
  // valore — le scritture si RIFIUTANO con un errore esplicito, mai uno
  // zero implicito che finirebbe in SUPERATA perpetua.
  revisioneIniziale: number | null | undefined
  nuovaChiave?: () => string
}): OrchestrazioneRevisione {
  const { cliente, depositoRevisione, depositoOperazioni, ponte } = dip
  const hasher = dip.hasher ?? improntaSha256
  const nuovaChiave = dip.nuovaChiave ?? (() => globalThis.crypto.randomUUID())
  let rev: number | null = Number.isInteger(dip.revisioneIniziale) ? (dip.revisioneIniziale as number) : null

  const marca = (s: StatoRevisione, idLocali: string[], statoRiga: 'nuova' | 'in_invio' | 'salvata' | 'incerta', ids?: Record<string, string>): StatoRevisione => ({
    ...s,
    righeNuove: s.righeNuove.map(r => idLocali.includes(r.idLocale)
      ? { ...r, stato: statoRiga, ...(ids?.[r.idLocale] ? { id: ids[r.idLocale] } : {}) } : r),
  })
  const superata = (errore: string) => `${errore} — chiudi e ricarica il documento`

  // i CANCELLI comuni a ogni scrittura (Scarta compreso): versione
  // caricata, nessuna operazione pendente, nessun ponte da acquisire
  const cancelli = (documentId: string): string | null => {
    if (rev === null)
      return 'versione del documento (revisione_rev) non caricata: senza versione il contratto non scrive — ricarica la pagina'
    const e = depositoOperazioni.elenca()
    if (e.errore) return `custodia delle operazioni illeggibile (${e.errore}): non scrivo — chiudi e riapri per la riconciliazione`
    if ((e.ops ?? []).some(o => o.documentId === documentId))
      return 'c\'è un\'operazione precedente senza esito da riconciliare: chiudi e riapri il documento (all\'apertura si risolve dal giornale)'
    const pl = ponte.leggi(documentId)
    if (pl.errore) return `ponte fra le custodie illeggibile (${pl.errore}): non scrivo — chiudi e riapri per la riconciliazione`
    if (pl.rif) return 'c\'è un\'operazione da acquisire (ponte): chiudi e riapri il documento — la riconciliazione la completa'
    return null
  }

  // la CHIUSURA di un Salva: esito durevole nel ponte PRIMA della
  // traccia; il ponte si chiude solo a traccia aggiornata
  const chiudiSalva = (stato: StatoRevisione, inInvio: string[], rifPre: RiferimentoOperazione, r: EsitoOperazione): EsitoRevisione => {
    if (r.ok) {
      rev = r.revDopo
      const avvisi: string[] = r.avviso ? [r.avviso] : []
      const durevole = ponte.salva({ ...rifPre, esito: { revDopo: r.revDopo, mappaNuove: r.mappaNuove, ...(r.spese ? { spese: r.spese } : {}) } })
      if (durevole.errore) avvisi.push(`esito non custodito nel ponte (${durevole.errore}): resta ricostruibile dal giornale`)
      const dopo = marca(stato, inInvio, 'salvata', r.mappaNuove)
      const pulizia = depositoRevisione.salva(tracciaDa(dopo))
      if (pulizia.errore) {
        avvisi.push(`traccia non aggiornata (${pulizia.errore}): l'esito resta custodito nel ponte e la prossima apertura completa l'acquisizione`)
      } else {
        const chiuso = ponte.rimuovi(rifPre.documentId)
        if (chiuso.errore) avvisi.push(`ponte non chiuso (${chiuso.errore}): verrà richiuso alla prossima riconciliazione, senza effetti doppi`)
      }
      return { ok: true, stato: dopo, ...(avvisi.length ? { avviso: avvisi.join(' · ') } : {}) }
    }
    if ('incerto' in r && r.incerto) {
      // esito NON definito: voci «incerta», annotazione conservata, il
      // ponte resta con la sola identità (la riconciliazione decide)
      const dopo = marca(stato, inInvio, 'incerta')
      depositoRevisione.salva({ ...tracciaDa(dopo), inCorso: { tipo: 'salva', generazione: dopo.generazione } })
      return { ok: false, stato: dopo, incerto: true, errore: r.errore }
    }
    // esito DEFINITO (superata / rifiuto / sentinella): nulla è stato
    // scritto — voci «nuova», annotazione e ponte si tolgono
    const dopo = marca(stato, inInvio, 'nuova')
    depositoRevisione.salva(tracciaDa(dopo))
    const chiuso = ponte.rimuovi(rifPre.documentId)
    const coda = chiuso.errore ? ` (ponte non chiuso: ${chiuso.errore} — verrà richiuso alla prossima riconciliazione)` : ''
    if ('conflitto' in r) return { ok: false, stato: dopo, errore: superata(r.errore) + coda }
    return { ok: false, stato: dopo, errore: r.errore + coda }
  }

  const salva = async (s: StatoRevisione): Promise<EsitoRevisione> => {
    let stato = s
    const stopCancelli = cancelli(s.documentId)
    if (stopCancelli) return { ok: false, stato, errore: stopCancelli }
    const inCorso = { tipo: 'salva' as const, generazione: s.generazione }
    const annota = depositoRevisione.salva({ ...tracciaDa(stato), inCorso })
    if (annota.errore)
      return { ok: false, stato, errore: `non riesco a mettere al sicuro gli originali (${annota.errore}): NON salvo, altrimenti le correzioni andrebbero perse` }
    const stop = fermaOperazione(depositoRevisione, stato)
    if (stop) return { ok: false, stato, errore: stop }
    const batch = batchSalvaDa(s, rev as number)
    if (batchVuoto(batch)) {
      depositoRevisione.salva(tracciaDa(s))
      return { ok: true, stato: s }
    }
    // la RESPONSABILITÀ si persiste PRIMA dell'invio: voci «in_invio»
    // nella traccia E riferimento con l'IDENTITÀ COMPLETA nel ponte
    const inInvio = stato.righeNuove.filter(r => r.stato === 'nuova').map(r => r.idLocale)
    stato = marca(stato, inInvio, 'in_invio')
    const presa = depositoRevisione.salva({ ...tracciaDa(stato), inCorso })
    if (presa.errore) {
      stato = marca(stato, inInvio, 'nuova')
      return { ok: false, stato, errore: `non riesco a custodire l'invio (${presa.errore}): NON invio nulla — senza traccia un'interruzione creerebbe un doppione` }
    }
    const opKey = nuovaChiave()
    const rifPre: RiferimentoOperazione = {
      opKey, kind: 'salva', documentId: s.documentId, baseRev: rev as number,
      impronta: await hasher(manifestoSalva(batch)),
      clientRefs: batch.nuove.map(n => n.client_ref), inInvio, generazione: s.generazione,
    }
    const inPonte = ponte.salva(rifPre)
    if (inPonte.errore) {
      stato = marca(stato, inInvio, 'nuova')
      depositoRevisione.salva(tracciaDa(stato))
      return { ok: false, stato, errore: `non riesco a custodire il riferimento dell'operazione (${inPonte.errore}): NON invio nulla — senza ponte un guasto dopo la risposta perderebbe l'esito` }
    }
    const r = await eseguiSalva(cliente, depositoOperazioni, s, rev as number, hasher, opKey)
    if ('nulla' in r) {
      depositoRevisione.salva(tracciaDa(s))
      ponte.rimuovi(s.documentId)
      return { ok: true, stato: s }
    }
    return chiudiSalva(stato, inInvio, rifPre, r)
  }

  // la chiusura di CONFERMA e SCARTO: successo → esito nel ponte, poi
  // traccia rimossa, poi ponte chiuso; guasti dichiarati, mai ignorati
  const chiudiChiusura = (s: StatoRevisione, rifPre: RiferimentoOperazione, r: EsitoOperazione, avvisi: string[]): { esito?: string; avviso?: string } => {
    if (!r.ok) return {}
    rev = r.revDopo
    const durevole = ponte.salva({ ...rifPre, esito: { revDopo: r.revDopo, mappaNuove: r.mappaNuove, ...(r.spese ? { spese: r.spese } : {}) } })
    if (durevole.errore) avvisi.push(`esito non custodito nel ponte (${durevole.errore}): resta ricostruibile dal giornale`)
    const pulizia = depositoRevisione.rimuovi(s.documentId, s.generazione)
    if (pulizia.errore) {
      avvisi.push(`documento chiuso, ma la traccia locale non è stata rimossa (${pulizia.errore}): la prossima riconciliazione completa la chiusura`)
    } else {
      const chiuso = ponte.rimuovi(s.documentId)
      if (chiuso.errore) avvisi.push(`ponte non chiuso (${chiuso.errore}): verrà richiuso alla prossima riconciliazione`)
    }
    if (r.avviso) avvisi.push(r.avviso)
    return { avviso: avvisi.length ? avvisi.join(' · ') : undefined }
  }

  const conferma = async (s: StatoRevisione): Promise<EsitoRevisione> => {
    const pendenza = pendenzaNonDimostrata(s)
    if (pendenza)
      return { ok: false, stato: s, errore: `la conferma è bloccata: l'invio della voce «${pendenza.name}» è senza esito dimostrato — chiudi e riapri per riconciliarlo dal giornale` }
    if (!vincoliVuoti(s.vincoli))
      return { ok: false, stato: s, errore: 'la conferma è bloccata: alcuni campi sono vincolati da un salvataggio precedente senza esito riferibile (lo scarto resta possibile)' }
    const salvataggio = await salva(s)
    if (!salvataggio.ok) return salvataggio
    const stato = salvataggio.stato
    const avvisi = salvataggio.avviso ? [salvataggio.avviso] : []
    const stopCancelli = cancelli(stato.documentId)
    if (stopCancelli) return { ok: false, stato, errore: stopCancelli }
    const annotata = depositoRevisione.salva({ ...tracciaDa(stato), inCorso: { tipo: 'conferma', generazione: stato.generazione } })
    if (annotata.errore)
      return { ok: false, stato, errore: `non riesco ad annotare la conferma in custodia (${annotata.errore}): non la avvio` }
    const stop = fermaOperazione(depositoRevisione, stato)
    if (stop) return { ok: false, stato, errore: stop }
    const correzioni = correzioniDa(stato)
    const opKey = nuovaChiave()
    const rifPre: RiferimentoOperazione = {
      opKey, kind: 'conferma', documentId: stato.documentId, baseRev: rev as number,
      impronta: await hasher(manifestoConferma(stato.documentId, rev as number, correzioni)),
      clientRefs: [], inInvio: [], generazione: stato.generazione,
    }
    const inPonte = ponte.salva(rifPre)
    if (inPonte.errore) {
      depositoRevisione.salva(tracciaDa(stato))
      return { ok: false, stato, errore: `non riesco a custodire il riferimento della conferma (${inPonte.errore}): non la avvio` }
    }
    const r = await eseguiConferma(cliente, depositoOperazioni, stato.documentId, rev as number, correzioni, hasher, opKey)
    if (r.ok) {
      const chiusura = chiudiChiusura(stato, rifPre, r, avvisi)
      return { ok: true, stato, ...(chiusura.avviso ? { avviso: chiusura.avviso } : {}) }
    }
    if ('incerto' in r && r.incerto)
      return { ok: false, stato, incerto: true, errore: r.errore }   // annotazione e ponte CONSERVATI
    depositoRevisione.salva(tracciaDa(stato))                        // esito definito: si toglie
    const chiuso = ponte.rimuovi(stato.documentId)
    const coda = chiuso.errore ? ` (ponte non chiuso: ${chiuso.errore})` : ''
    if ('conflitto' in r) return { ok: false, stato, errore: superata(r.errore) + coda }
    return { ok: false, stato, errore: r.errore + coda }
  }

  const scarta = async (s: StatoRevisione, motivo: string): Promise<EsitoScarto> => {
    if (!motivo.trim()) return { ok: false, errore: 'serve il motivo dello scarto' }
    // STESSI cancelli delle altre scritture: uno scarto durante una
    // riconciliazione in sospeso potrebbe chiudere il documento mentre
    // un salvataggio custodito è ancora per aria
    const stopCancelli = cancelli(s.documentId)
    if (stopCancelli) return { ok: false, errore: stopCancelli }
    const annotata = depositoRevisione.salva({ ...tracciaDa(s), inCorso: { tipo: 'scarto', generazione: s.generazione } })
    if (annotata.errore)
      return { ok: false, errore: `non riesco ad annotare lo scarto in custodia (${annotata.errore}): non lo avvio` }
    const stop = fermaOperazione(depositoRevisione, s)
    if (stop) return { ok: false, errore: stop }
    const opKey = nuovaChiave()
    const rifPre: RiferimentoOperazione = {
      opKey, kind: 'scarto', documentId: s.documentId, baseRev: rev as number,
      impronta: await hasher(manifestoScarto(s.documentId, rev as number, motivo.trim())),
      clientRefs: [], inInvio: [], generazione: s.generazione,
    }
    const inPonte = ponte.salva(rifPre)
    if (inPonte.errore) {
      depositoRevisione.salva(tracciaDa(s))
      return { ok: false, errore: `non riesco a custodire il riferimento dello scarto (${inPonte.errore}): non lo avvio` }
    }
    const r = await eseguiScarto(cliente, depositoOperazioni, s.documentId, rev as number, motivo, hasher, opKey)
    if (r.ok) {
      const avvisi: string[] = []
      const chiusura = chiudiChiusura(s, rifPre, r, avvisi)
      return { ok: true, ...(chiusura.avviso ? { avviso: chiusura.avviso } : {}) }
    }
    if ('incerto' in r && r.incerto) return { ok: false, incerto: true, errore: r.errore }
    depositoRevisione.salva(tracciaDa(s))
    const chiuso = ponte.rimuovi(s.documentId)
    const coda = chiuso.errore ? ` (ponte non chiuso: ${chiuso.errore})` : ''
    if ('conflitto' in r) return { ok: false, errore: superata(r.errore) + coda }
    return { ok: false, errore: r.errore + coda }
  }

  const apertura = async (documentId: string): Promise<AperturaRevisione> => {
    const esito = await riconciliaContratto({ cliente, depositoRevisione, depositoOperazioni, ponte, hasher }, documentId)
    const raggiunta = esito.revPerDocumento[documentId]
    if (Number.isInteger(raggiunta)) rev = Math.max(rev ?? 0, raggiunta)
    return esito
  }

  return { salva, conferma, scarta, apertura }
}
