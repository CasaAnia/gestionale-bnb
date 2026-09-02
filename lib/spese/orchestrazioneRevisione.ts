// ============================================================================
// ORCHESTRAZIONE della revisione dietro l'INTERRUTTORE di percorso
// (lib/spese/percorso.ts). La schermata parla con QUESTA interfaccia:
//  · orchestrazioneLegacy — il percorso attuale, delega PURA a
//    revisioneScrittura (comportamento identico, bit per bit);
//  · orchestrazioneContratto — il contratto collaudato: batch atomico
//    con op_key, custodia delle operazioni registrata PRIMA dell'invio,
//    conferma/scarto versionati, PONTE durevole fra le due custodie
//    (ponteContratto) e riconciliazione delle pendenze.
// COORDINAMENTO PER DOCUMENTO (presidio, condiviso a livello di modulo
// da pagina, guscio e scritture): scritture e riconciliazioni sullo
// stesso documento NON si intrecciano mai — chi trova il documento
// presidiato riceve un esito esplicito e riprova, mai un'attesa cieca
// né un recupero che tocca l'operazione di un altro. L'ACQUISIZIONE è
// convalidata con le REGOLE DEL CONTRATTO (validaEsitoGiornale) e
// condizionata all'identità e alla generazione pertinenti; l'INVIO è
// vincolato al riferimento del ponte: una sequenza superata non parte.
// I controlli del blocco 3 restano identici e DAVANTI anche sul
// contratto; NESSUNA scrittura nuova (Scarta compreso) finché resta
// qualcosa da riconciliare.
// ============================================================================
import type { StatoRevisione, TracciaRevisione } from './revisione.ts'
import { correzioniDa, tracciaDa, vincoliVuoti } from './revisione.ts'
import type { DepositoRevisione } from './revisioneDurevole.ts'
import {
  approvaFatturaRevisione, confermaFatturaPagataRevisione,
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
// traccia della revisione. Un «bloccante» vieta ogni nuova scrittura.
export type AperturaRevisione = {
  risolte: number
  avvisi: string[]
  bloccante?: string
  revPerDocumento: Record<string, number>
}

export type OrchestrazioneRevisione = {
  salva(s: StatoRevisione): Promise<EsitoRevisione>
  conferma(s: StatoRevisione): Promise<EsitoRevisione>
  scarta(s: StatoRevisione, motivo: string): Promise<EsitoScarto>
  apertura(documentId: string): Promise<AperturaRevisione>
  // FATTURE (Fase 5): approvazione «da pagare» (zero spese) e conferma
  // «già pagata» (spese con expense_date = data del pagamento)
  approvaFattura(s: StatoRevisione): Promise<EsitoRevisione>
  confermaFatturaPagata(s: StatoRevisione, dataPagamento: string, metodo: string): Promise<EsitoRevisione>
}

// ---- percorso LEGACY: delega pura, nessun comportamento nuovo -------------
export function orchestrazioneLegacy(cliente: ClienteRevisione, deposito: DepositoRevisione): OrchestrazioneRevisione {
  return {
    salva: s => salvaModifiche(cliente, deposito, s),
    conferma: s => confermaRevisione(cliente, deposito, s),
    scarta: (s, motivo) => scartaRevisione(cliente, deposito, s, motivo),
    apertura: async () => ({ risolte: 0, avvisi: [], revPerDocumento: {} }),
    approvaFattura: s => approvaFatturaRevisione(cliente, deposito, s),
    confermaFatturaPagata: (s, data, metodo) => confermaFatturaPagataRevisione(cliente, deposito, s, data, metodo),
  }
}

// il percorso a CONTRATTO non copre ancora le tre RPC fattura (rientreranno
// versionate con la transizione, che è un blocco separato e non autorizzato):
// un rifiuto ESPLICITO, mai una scrittura fuori contratto
export const MESSAGGIO_FATTURE_FUORI_CONTRATTO =
  'le fatture non sono ancora coperte dal contratto di revisione: questo percorso le rifiuta (rientreranno con la transizione, da autorizzare a parte) — nessuna scrittura è partita'

// ---- PRESIDIO per documento (condiviso nel contesto della pagina) ---------
// Chi lo tiene lavora da solo sul documento; chi lo trova occupato NON
// aspetta alla cieca (un preparatore sospeso lo terrebbe per sempre):
// riceve un esito esplicito e riprova. È la stessa serratura per
// pagina, guscio e scritture — il coordinamento chiesto dal metodo.
const presidi = new Set<string>()
export const MESSAGGIO_PRESIDIO = 'un\'altra operazione o riconciliazione su questo documento è ancora in corso in questa sessione: attendi che finisca e riprova'
async function conPresidio<T>(documentId: string, seOccupato: () => T, corpo: () => Promise<T>): Promise<T> {
  if (presidi.has(documentId)) return seOccupato()
  presidi.add(documentId)
  try { return await corpo() } finally { presidi.delete(documentId) }
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

// l'esito custodito nel ponte viene CONVALIDATO con le stesse regole
// del giornale (mai una seconda convalida più debole): struttura,
// identità completa, revisione, mappa esatta dei client_ref e id
function esitoPonteValido(rif: RiferimentoOperazione, esito: NonNullable<RiferimentoOperazione['esito']>): string | null {
  const sintetico = {
    stato: 'applicata', document_id: rif.documentId, kind: rif.kind,
    base_rev: rif.baseRev, manifesto_sha256: rif.impronta,
    esito: {
      rev_dopo: esito.revDopo,
      righe_nuove: Object.entries(esito.mappaNuove ?? {}).map(([client_ref, id]) => ({ client_ref, id })),
      ...(esito.spese ? { spese: esito.spese } : {}),
    },
  }
  const v = validaEsitoGiornale(opDaRiferimento(rif), sintetico)
  if (v.tipo === 'applicata') return null
  return v.tipo === 'assente' ? 'esito assente' : v.perche
}

export async function riconciliaContratto(dip: ServiziContratto, documentId?: string): Promise<AperturaRevisione> {
  const { cliente, depositoRevisione, depositoOperazioni, ponte } = dip
  const hasher = dip.hasher ?? improntaSha256
  const avvisi: string[] = []
  const revPerDocumento: Record<string, number> = {}
  let risolte = 0
  const esitoFinale = (bloccante?: string): AperturaRevisione =>
    ({ risolte, avvisi, ...(bloccante ? { bloccante } : {}), revPerDocumento })

  const eOps = depositoOperazioni.elenca()
  if (eOps.errore) return esitoFinale(`custodia delle operazioni illeggibile (${eOps.errore}): niente scritture finché non si riesce a leggerla`)
  const ePonti = ponte.elenca()
  if (ePonti.errore) return esitoFinale(`ponte fra le custodie illeggibile (${ePonti.errore}): niente scritture finché non si riesce a leggerlo`)
  const ops = (eOps.ops ?? []).filter(o => !documentId || o.documentId === documentId)
  const rifs = (ePonti.rifs ?? []).filter(r => !documentId || r.documentId === documentId)
  // il documento RICHIESTO passa dal presidio ANCHE senza record nei due
  // depositi: un preparatore sospeso PRIMA della prima impronta non ha
  // ancora scritto nulla, ma tiene il presidio — l'apertura deve
  // scoprirlo (bloccante), non concludere «niente da fare» e lasciare
  // che il guscio entri nella presa legacy creando vincoli irrisolvibili
  const documenti = [...new Set([
    ...(documentId ? [documentId] : []),
    ...ops.map(o => o.documentId), ...rifs.map(r => r.documentId),
  ])]

  for (const doc of documenti) {
    const bloccante = await conPresidio<string | null>(doc,
      () => MESSAGGIO_PRESIDIO,
      () => riconciliaDocumento(
        { cliente, depositoRevisione, depositoOperazioni, ponte, hasher },
        doc,
        ops.filter(o => o.documentId === doc),
        rifs.filter(r => r.documentId === doc),
        avvisi,
        n => { risolte += n },
        (d, r) => { revPerDocumento[d] = Math.max(revPerDocumento[d] ?? 0, r) },
      ))
    if (bloccante) return esitoFinale(bloccante)
  }
  return esitoFinale()
}

// la riconciliazione di UN documento, dentro il suo presidio.
// Restituisce il motivo bloccante, o null.
async function riconciliaDocumento(
  dip: Required<Pick<ServiziContratto, 'cliente' | 'depositoRevisione' | 'depositoOperazioni' | 'ponte'>> & { hasher: HasherTesto },
  documentId: string,
  ops: OperazioneContratto[],
  rifs: RiferimentoOperazione[],
  avvisi: string[],
  contaRisolte: (n: number) => void,
  registraRev: (documentId: string, rev: number) => void,
): Promise<string | null> {
  const { cliente, depositoRevisione, depositoOperazioni, ponte } = dip

  // l'ACQUISIZIONE nella traccia, CONDIZIONATA a identità e generazione
  // pertinenti: si tocca SOLO ciò che appartiene a QUESTA operazione.
  // Un rifiuto di IDENTITÀ del ponte (un'altra operazione è subentrata)
  // è uno STOP con dati conservati, mai un avviso da scavalcare.
  const acquisisci = (rif: RiferimentoOperazione, esito: NonNullable<RiferimentoOperazione['esito']>): string | null => {
    const invalido = esitoPonteValido(rif, esito)
    if (invalido)
      return `l'esito custodito per l'operazione «${rif.kind}» non è valido (${invalido}): acquisizione FERMATA, riferimento conservato — va verificato dal giornale`
    const durevole = ponte.salva({ ...rif, esito })
    if (durevole.errore) {
      if (/già|UN'ALTRA/.test(durevole.errore))
        return `il ponte appartiene ormai a un'altra operazione (${durevole.errore}): questa acquisizione si ferma senza toccare nulla`
      avvisi.push(`esito non custodito nel ponte (${durevole.errore}): resta ricostruibile dal giornale`)
    }
    const lettura = depositoRevisione.leggi(rif.documentId)
    if (lettura.errore)
      return `custodia della revisione illeggibile (${lettura.errore}): acquisizione sospesa — l'esito resta custodito e niente scritture nuove`
    const traccia = lettura.traccia
    if (rif.kind === 'conferma' || rif.kind === 'scarto') {
      if (traccia) {
        // la rimozione usa la generazione DELL'OPERAZIONE: una chiusura
        // vecchia non cancella la traccia di una schermata più recente
        const gen = rif.generazione > 0 ? rif.generazione : (traccia.generazione ?? 0)
        const rm = depositoRevisione.rimuovi(rif.documentId, gen)
        if (rm.errore) {
          if (/superata/.test(rm.errore)) {
            avvisi.push(`documento chiuso: la traccia più recente resta al suo posto (${rm.errore}) — la schermata nuova scoprirà la chiusura al prossimo passo`)
          } else {
            return `documento chiuso ma traccia non rimossa (${rm.errore}): acquisizione sospesa, si completa alla prossima riconciliazione`
          }
        }
      }
    } else if (traccia) {
      if ((traccia.generazione ?? 0) > rif.generazione && rif.generazione > 0) {
        // la traccia appartiene a una schermata più recente: le voci di
        // QUESTA operazione (in_invio/incerte con i suoi idLocale) si
        // aggiornano, ma annotazioni e vincoli ALTRUI non si toccano
        const righe = traccia.righeNuove.map(r =>
          rif.inInvio.includes(r.idLocale) && esito.mappaNuove[r.idLocale]
            ? { ...r, stato: 'salvata' as const, id: esito.mappaNuove[r.idLocale] }
            : r)
        const sc = depositoRevisione.salva({ ...traccia, righeNuove: righe })
        if (sc.errore)
          return `esito ritrovato ma traccia non aggiornata (${sc.errore}): acquisizione sospesa — l'esito resta custodito nel ponte`
      } else {
        const righe = traccia.righeNuove.map(r =>
          rif.inInvio.includes(r.idLocale) && esito.mappaNuove[r.idLocale]
            ? { ...r, stato: 'salvata' as const, id: esito.mappaNuove[r.idLocale] }
            : r)
        const aggiornata: TracciaRevisione = { ...traccia, righeNuove: righe }
        // annotazione e vincoli si sciolgono SOLO se sono di questa
        // operazione (stessa generazione), mai quelli di un'altra
        if (!aggiornata.inCorso || aggiornata.inCorso.generazione === rif.generazione || rif.generazione === 0)
          delete aggiornata.inCorso
        if (!aggiornata.inCorso) delete aggiornata.vincoli
        const sc = depositoRevisione.salva(aggiornata)
        if (sc.errore)
          return `esito ritrovato ma traccia non aggiornata (${sc.errore}): acquisizione sospesa — l'esito resta custodito nel ponte`
      }
    }
    chiudiPonte(rif)
    registraRev(rif.documentId, esito.revDopo)
    contaRisolte(1)
    return null
  }

  // il ponte si chiude SOLO se contiene ancora QUESTO riferimento
  const chiudiPonte = (rif: RiferimentoOperazione) => {
    const attuale = ponte.leggi(rif.documentId)
    if (attuale.errore) { avvisi.push(`ponte non richiuso (${attuale.errore}): verrà richiuso alla prossima riconciliazione`); return }
    if (attuale.rif && attuale.rif.opKey !== rif.opKey) return          // appartiene a un altro: non si tocca
    const chiusa = ponte.rimuovi(rif.documentId)
    if (chiusa.errore) avvisi.push(`ponte non chiuso (${chiusa.errore}): la prossima riconciliazione lo richiuderà senza effetti doppi`)
  }

  // la chiusura SENZA effetti (superata, o giornale che prova «mai
  // applicata»): SOLO le voci di questa operazione tornano «nuova»,
  // SOLO la sua annotazione si toglie
  const annulla = (rif: RiferimentoOperazione, motivo: string): string | null => {
    const lettura = depositoRevisione.leggi(rif.documentId)
    if (lettura.errore)
      return `custodia della revisione illeggibile (${lettura.errore}): pendenza conservata`
    const traccia = lettura.traccia
    if (traccia && !((traccia.generazione ?? 0) > rif.generazione && rif.generazione > 0)) {
      const aggiornata: TracciaRevisione = rif.kind === 'salva'
        ? {
          ...traccia,
          righeNuove: traccia.righeNuove.map(r =>
            rif.inInvio.includes(r.idLocale) && (r.stato === 'in_invio' || r.stato === 'incerta')
              ? { ...r, stato: 'nuova' as const } : r),
        }
        : { ...traccia }
      if (!aggiornata.inCorso || aggiornata.inCorso.generazione === rif.generazione || rif.generazione === 0)
        delete aggiornata.inCorso
      const sc = depositoRevisione.salva(aggiornata)
      if (sc.errore && !/superata/.test(sc.errore))
        return `traccia non aggiornata (${sc.errore}): pendenza conservata`
    }
    chiudiPonte(rif)
    contaRisolte(1)
    avvisi.push(motivo)
    return null
  }

  const rifPer = new Map(rifs.map(r => [r.opKey, r]))

  // 1) le operazioni ancora nel DEPOSITO (risposta mai convalidata)
  for (const op of ops) {
    const rif = rifPer.get(op.opKey) ?? {
      opKey: op.opKey, kind: op.kind, documentId: op.documentId, baseRev: op.baseRev,
      impronta: op.impronta, clientRefs: op.clientRefs, inInvio: op.clientRefs, generazione: 0,
    }
    rifPer.delete(op.opKey)
    const r = await recuperaOperazione(cliente, depositoOperazioni, op)
    if (r.stato === 'applicata') {
      const stop = acquisisci(rif, { revDopo: r.revDopo, mappaNuove: r.mappaNuove, ...(r.spese ? { spese: r.spese } : {}) })
      if (stop) return stop
      avvisi.push(`l'operazione «${op.kind}» interrotta era ARRIVATA: ritrovata a giornale e acquisita${r.avviso ? ` (${r.avviso})` : ''}`)
      continue
    }
    if (r.stato === 'assente') {
      const ri = await reinviaOperazione(cliente, depositoOperazioni, op.opKey, dip.hasher)
      if (ri.ok && !('nulla' in ri)) {
        const stop = acquisisci(rif, { revDopo: ri.revDopo, mappaNuove: ri.mappaNuove, ...(ri.spese ? { spese: ri.spese } : {}) })
        if (stop) return stop
        avvisi.push(`l'operazione «${op.kind}» non era mai arrivata: reinviata dalla custodia, applicata e acquisita`)
        continue
      }
      if (!ri.ok && 'conflitto' in ri) {
        const stop = annulla(rif, `l'operazione «${op.kind}» custodita è stata SUPERATA nel frattempo: chiusa senza effetti`)
        if (stop) return stop
        continue
      }
      return `il reinvio dell'operazione custodita non si è concluso (${!ri.ok ? ri.errore : 'esito inatteso'}): niente nuove scritture finché la pendenza non è risolta`
    }
    return r.errore
  }

  // 2) i riferimenti del PONTE rimasti senza operazione nel deposito
  for (const rif of rifPer.values()) {
    if (rif.esito) {
      const stop = acquisisci(rif, rif.esito)
      if (stop) return stop
      avvisi.push(`l'esito dell'operazione «${rif.kind}» era già custodito nel ponte: acquisizione completata`)
      continue
    }
    let g: unknown
    try { g = await cliente.esitoRevisione(rif.opKey) } catch (e) {
      return `lettura del giornale fallita (${String((e as Error).message ?? e)}): pendenza conservata`
    }
    const v = validaEsitoGiornale(opDaRiferimento(rif), g)
    if (v.tipo === 'applicata') {
      const stop = acquisisci(rif, { revDopo: v.revDopo, mappaNuove: v.mappaNuove, ...(v.spese ? { spese: v.spese } : {}) })
      if (stop) return stop
      avvisi.push(`l'operazione «${rif.kind}» era ARRIVATA: ritrovata a giornale e acquisita`)
      continue
    }
    if (v.tipo === 'assente') {
      // il giornale non la conosce E il presidio garantisce che nessun
      // preparatore di questa sessione è in volo sul documento (chi lo
      // fosse terrebbe il presidio e questa riconciliazione non sarebbe
      // partita); la guardia d'invio impedisce comunque una partenza
      // tardiva a ponte annullato
      const stop = annulla(rif, `l'operazione «${rif.kind}» non risulta a giornale: nulla è stato applicato, le voci tornano modificabili`)
      if (stop) return stop
      continue
    }
    return `l'esito a giornale per l'operazione custodita non è verificabile (${v.perche}): pendenza conservata`
  }

  return null
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

  // la GUARDIA D'INVIO: la richiesta parte SOLO se il ponte contiene
  // ancora QUESTO riferimento — una sequenza superata (riconciliata o
  // rimpiazzata mentre il preparatore era sospeso) NON parte, e riceve
  // un rifiuto DEFINITO che chiude il suo tentativo senza effetti
  const clienteVincolato = (rifPre: RiferimentoOperazione): ClienteContratto => {
    const vincola = <P, R>(vera: (p: P) => Promise<R>) => async (p: P): Promise<R> => {
      const attuale = ponte.leggi(rifPre.documentId)
      if (attuale.errore || attuale.rif?.opKey !== rifPre.opKey)
        return { errore: 'richiesta NON inviata: la sequenza è stata superata (il riferimento nel ponte non è più questo) — nulla è partito da questo tentativo', codice: 'P0001' } as R
      return vera(p)
    }
    return {
      salvaRevisione: vincola(cliente.salvaRevisione.bind(cliente)),
      confermaRevisione: vincola(cliente.confermaRevisione.bind(cliente)),
      scartaRevisione: vincola(cliente.scartaRevisione.bind(cliente)),
      esitoRevisione: k => cliente.esitoRevisione(k),
    }
  }

  // i CANCELLI comuni a ogni scrittura (Scarta compreso)
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
      const dopo = marca(stato, inInvio, 'incerta')
      depositoRevisione.salva({ ...tracciaDa(dopo), inCorso: { tipo: 'salva', generazione: dopo.generazione } })
      return { ok: false, stato: dopo, incerto: true, errore: r.errore }
    }
    const dopo = marca(stato, inInvio, 'nuova')
    depositoRevisione.salva(tracciaDa(dopo))
    const chiuso = ponte.rimuovi(rifPre.documentId)
    const coda = chiuso.errore ? ` (ponte non chiuso: ${chiuso.errore} — verrà richiuso alla prossima riconciliazione)` : ''
    if ('conflitto' in r) return { ok: false, stato: dopo, errore: superata(r.errore) + coda }
    return { ok: false, stato: dopo, errore: r.errore + coda }
  }

  const salvaInterno = async (s: StatoRevisione): Promise<EsitoRevisione> => {
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
    const r = await eseguiSalva(clienteVincolato(rifPre), depositoOperazioni, s, rev as number, hasher, opKey)
    if ('nulla' in r) {
      depositoRevisione.salva(tracciaDa(s))
      ponte.rimuovi(s.documentId)
      return { ok: true, stato: s }
    }
    return chiudiSalva(stato, inInvio, rifPre, r)
  }

  const chiudiChiusura = (s: StatoRevisione, rifPre: RiferimentoOperazione, r: EsitoOperazione, avvisi: string[]): { avviso?: string } => {
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

  const confermaInterna = async (s: StatoRevisione): Promise<EsitoRevisione> => {
    const pendenza = pendenzaNonDimostrata(s)
    if (pendenza)
      return { ok: false, stato: s, errore: `la conferma è bloccata: l'invio della voce «${pendenza.name}» è senza esito dimostrato — chiudi e riapri per riconciliarlo dal giornale` }
    if (!vincoliVuoti(s.vincoli))
      return { ok: false, stato: s, errore: 'la conferma è bloccata: alcuni campi sono vincolati da un salvataggio precedente senza esito riferibile (lo scarto resta possibile)' }
    const salvataggio = await salvaInterno(s)
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
    const r = await eseguiConferma(clienteVincolato(rifPre), depositoOperazioni, stato.documentId, rev as number, correzioni, hasher, opKey)
    if (r.ok) {
      const chiusura = chiudiChiusura(stato, rifPre, r, avvisi)
      return { ok: true, stato, ...(chiusura.avviso ? { avviso: chiusura.avviso } : {}) }
    }
    if ('incerto' in r && r.incerto)
      return { ok: false, stato, incerto: true, errore: r.errore }
    depositoRevisione.salva(tracciaDa(stato))
    const chiuso = ponte.rimuovi(stato.documentId)
    const coda = chiuso.errore ? ` (ponte non chiuso: ${chiuso.errore})` : ''
    if ('conflitto' in r) return { ok: false, stato, errore: superata(r.errore) + coda }
    return { ok: false, stato, errore: r.errore + coda }
  }

  const scartaInterno = async (s: StatoRevisione, motivo: string): Promise<EsitoScarto> => {
    if (!motivo.trim()) return { ok: false, errore: 'serve il motivo dello scarto' }
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
    const r = await eseguiScarto(clienteVincolato(rifPre), depositoOperazioni, s.documentId, rev as number, motivo, hasher, opKey)
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

  // ogni ingresso passa dal PRESIDIO del documento: chi lo trova
  // occupato riceve un esito esplicito e riprova (mai attese cieche)
  return {
    salva: s => conPresidio<EsitoRevisione>(s.documentId,
      () => ({ ok: false, stato: s, errore: MESSAGGIO_PRESIDIO }),
      () => salvaInterno(s)),
    conferma: s => conPresidio<EsitoRevisione>(s.documentId,
      () => ({ ok: false, stato: s, errore: MESSAGGIO_PRESIDIO }),
      () => confermaInterna(s)),
    scarta: (s, motivo) => conPresidio<EsitoScarto>(s.documentId,
      () => ({ ok: false, errore: MESSAGGIO_PRESIDIO }),
      () => scartaInterno(s, motivo)),
    approvaFattura: async s => ({ ok: false, stato: s, errore: MESSAGGIO_FATTURE_FUORI_CONTRATTO }),
    confermaFatturaPagata: async s => ({ ok: false, stato: s, errore: MESSAGGIO_FATTURE_FUORI_CONTRATTO }),
    apertura: async (documentId) => {
      const esito = await riconciliaContratto({ cliente, depositoRevisione, depositoOperazioni, ponte, hasher }, documentId)
      const raggiunta = esito.revPerDocumento[documentId]
      if (Number.isInteger(raggiunta)) rev = Math.max(rev ?? 0, raggiunta)
      return esito
    },
  }
}
