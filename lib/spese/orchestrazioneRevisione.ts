// ============================================================================
// ORCHESTRAZIONE della revisione dietro l'INTERRUTTORE di percorso
// (lib/spese/percorso.ts). La schermata parla con QUESTA interfaccia:
//  · orchestrazioneLegacy — il percorso attuale, delega PURA a
//    revisioneScrittura (comportamento identico, bit per bit);
//  · orchestrazioneContratto — il contratto collaudato: batch atomico
//    con op_key, custodia delle operazioni registrata PRIMA dell'invio,
//    conferma/scarto versionati, recupero delle pendenze all'apertura.
// I controlli del blocco 3 restano identici e DAVANTI anche sul
// contratto: custodia degli originali PRIMA di scrivere, fermaOperazione
// (generazioni), vincoli, pendenze non dimostrate.
// ============================================================================
import type { StatoRevisione } from './revisione.ts'
import { correzioniDa, tracciaDa, vincoliVuoti } from './revisione.ts'
import type { DepositoRevisione } from './revisioneDurevole.ts'
import {
  confermaRevisione, fermaOperazione, pendenzaNonDimostrata, salvaModifiche,
  scartaRevisione, type ClienteRevisione, type EsitoRevisione,
} from './revisioneScrittura.ts'
import type { ClienteContratto, HasherTesto, OperazioneContratto } from './contrattoRevisione.ts'
import {
  eseguiConferma, eseguiSalva, eseguiScarto, recuperaOperazione,
  reinviaOperazione, type EsitoOperazione,
} from './contrattoScrittura.ts'
import type { DepositoOperazioniElencabile } from './depositoOperazioniDurevole.ts'
import { improntaSha256 } from './improntaTesto.ts'

export type EsitoScarto = { ok: boolean; errore?: string; incerto?: boolean; avviso?: string }

// l'esito del recupero all'APERTURA: le pendenze del deposito delle
// operazioni per questo documento vengono risolte (giornale, o reinvio
// della richiesta custodita); un «bloccante» vieta ogni nuova scrittura
export type AperturaRevisione = { risolte: number; avvisi: string[]; bloccante?: string }

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
    apertura: async () => ({ risolte: 0, avvisi: [] }),
  }
}

// ---- percorso CONTRATTO ---------------------------------------------------
export function orchestrazioneContratto(dip: {
  cliente: ClienteContratto
  depositoRevisione: DepositoRevisione
  depositoOperazioni: DepositoOperazioniElencabile
  // revisione_rev del documento al CARICAMENTO della pagina: da lì in
  // poi la tiene aggiornata l'orchestrazione (successi e recuperi);
  // SUPERATA impone la ricarica, mai un rincorrere silenzioso
  revisioneIniziale: number
  hasher?: HasherTesto
  nuovaChiave?: () => string
}): OrchestrazioneRevisione {
  const { cliente, depositoRevisione, depositoOperazioni } = dip
  const hasher = dip.hasher ?? improntaSha256
  const nuovaChiave = dip.nuovaChiave ?? (() => globalThis.crypto.randomUUID())
  let rev = dip.revisioneIniziale

  const pendenzeDoc = (documentId: string): { ops: OperazioneContratto[] } | { errore: string } => {
    const e = depositoOperazioni.elenca()
    if (e.errore) return { errore: e.errore }
    return { ops: (e.ops ?? []).filter(o => o.documentId === documentId) }
  }
  const marca = (s: StatoRevisione, idLocali: string[], statoRiga: 'nuova' | 'in_invio' | 'salvata' | 'incerta', ids?: Record<string, string>): StatoRevisione => ({
    ...s,
    righeNuove: s.righeNuove.map(r => idLocali.includes(r.idLocale)
      ? { ...r, stato: statoRiga, ...(ids?.[r.idLocale] ? { id: ids[r.idLocale] } : {}) } : r),
  })
  // il messaggio di un esito «superata» del contratto, per la schermata
  const superata = (errore: string) => `${errore} — chiudi e ricarica il documento`

  // la CHIUSURA di un Salva: mappa l'esito dell'operazione sullo stato
  // (id delle voci nuove, marcature) e sistema la traccia
  const chiudiSalva = (stato: StatoRevisione, inInvio: string[], r: EsitoOperazione): EsitoRevisione => {
    if (r.ok) {
      rev = r.revDopo
      const dopo = marca(stato, inInvio, 'salvata', r.mappaNuove)
      const pulizia = depositoRevisione.salva(tracciaDa(dopo))
      const avvisi = [r.avviso, pulizia.errore ? `custodia non aggiornata (${pulizia.errore}): resta valida quella precedente, più prudente` : undefined]
        .filter((x): x is string => !!x)
      return { ok: true, stato: dopo, ...(avvisi.length ? { avviso: avvisi.join(' · ') } : {}) }
    }
    if ('incerto' in r && r.incerto) {
      // l'esito NON è definito: le voci restano 'incerta', la traccia
      // conserva l'annotazione inCorso (la prossima apertura riconcilia)
      const dopo = marca(stato, inInvio, 'incerta')
      depositoRevisione.salva({ ...tracciaDa(dopo), inCorso: { tipo: 'salva', generazione: dopo.generazione } })
      return { ok: false, stato: dopo, incerto: true, errore: r.errore }
    }
    // esito DEFINITO (superata / rifiuto / sentinella): nulla è stato
    // scritto, le voci tornano 'nuova' e l'annotazione si toglie
    const dopo = marca(stato, inInvio, 'nuova')
    depositoRevisione.salva(tracciaDa(dopo))
    if ('conflitto' in r) return { ok: false, stato: dopo, errore: superata(r.errore) }
    return { ok: false, stato: dopo, errore: r.errore }
  }

  const salva = async (s: StatoRevisione): Promise<EsitoRevisione> => {
    let stato = s
    // niente scritture NUOVE finché restano operazioni pendenti: si
    // risolvono all'apertura (recupero per chiave), mai alla cieca
    const p = pendenzeDoc(s.documentId)
    if ('errore' in p)
      return { ok: false, stato, errore: `custodia delle operazioni illeggibile (${p.errore}): non salvo — chiudi e riapri per la riconciliazione` }
    if (p.ops.length > 0)
      return { ok: false, stato, errore: 'c\'è un\'operazione precedente senza esito da riconciliare: chiudi e riapri il documento (all\'apertura si risolve dal giornale)' }
    const inCorso = { tipo: 'salva' as const, generazione: s.generazione }
    const annota = depositoRevisione.salva({ ...tracciaDa(stato), inCorso })
    if (annota.errore)
      return { ok: false, stato, errore: `non riesco a mettere al sicuro gli originali (${annota.errore}): NON salvo, altrimenti le correzioni andrebbero perse` }
    const stop = fermaOperazione(depositoRevisione, stato)
    if (stop) return { ok: false, stato, errore: stop }
    // la RESPONSABILITÀ delle voci nuove si persiste PRIMA dell'invio
    // (il batch atomico le contiene tutte): traccia con 'in_invio'
    const inInvio = stato.righeNuove.filter(r => r.stato === 'nuova').map(r => r.idLocale)
    stato = marca(stato, inInvio, 'in_invio')
    const presa = depositoRevisione.salva({ ...tracciaDa(stato), inCorso })
    if (presa.errore) {
      stato = marca(stato, inInvio, 'nuova')
      return { ok: false, stato, errore: `non riesco a custodire l'invio (${presa.errore}): NON invio nulla — senza traccia un'interruzione creerebbe un doppione` }
    }
    // il batch si costruisce dallo stato PRIMA della marcatura (le voci
    // sono le stesse: fra i due passi non cambia nulla)
    const r = await eseguiSalva(cliente, depositoOperazioni, s, rev, hasher, nuovaChiave())
    if ('nulla' in r) {
      depositoRevisione.salva(tracciaDa(s))
      return { ok: true, stato: s }
    }
    return chiudiSalva(stato, inInvio, r)
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
    const annotata = depositoRevisione.salva({ ...tracciaDa(stato), inCorso: { tipo: 'conferma', generazione: stato.generazione } })
    if (annotata.errore)
      return { ok: false, stato, errore: `non riesco ad annotare la conferma in custodia (${annotata.errore}): non la avvio` }
    const stop = fermaOperazione(depositoRevisione, stato)
    if (stop) return { ok: false, stato, errore: stop }
    const r = await eseguiConferma(cliente, depositoOperazioni, stato.documentId, rev, correzioniDa(stato), hasher, nuovaChiave())
    if (r.ok) {
      rev = r.revDopo
      const pulizia = depositoRevisione.rimuovi(stato.documentId, stato.generazione)
      if (pulizia.errore) avvisi.push(`documento confermato, ma la traccia locale non è stata rimossa (${pulizia.errore})`)
      if (r.avviso) avvisi.push(r.avviso)
      return { ok: true, stato, ...(avvisi.length ? { avviso: avvisi.join(' · ') } : {}) }
    }
    if ('incerto' in r && r.incerto)
      return { ok: false, stato, incerto: true, errore: r.errore }   // annotazione CONSERVATA
    depositoRevisione.salva(tracciaDa(stato))                        // esito definito: si toglie
    if ('conflitto' in r) return { ok: false, stato, errore: superata(r.errore) }
    return { ok: false, stato, errore: r.errore }
  }

  const scarta = async (s: StatoRevisione, motivo: string): Promise<EsitoScarto> => {
    const annotata = depositoRevisione.salva({ ...tracciaDa(s), inCorso: { tipo: 'scarto', generazione: s.generazione } })
    if (annotata.errore)
      return { ok: false, errore: `non riesco ad annotare lo scarto in custodia (${annotata.errore}): non lo avvio` }
    const stop = fermaOperazione(depositoRevisione, s)
    if (stop) return { ok: false, errore: stop }
    const r = await eseguiScarto(cliente, depositoOperazioni, s.documentId, rev, motivo, hasher, nuovaChiave())
    if (r.ok) {
      const pulizia = depositoRevisione.rimuovi(s.documentId, s.generazione)
      return pulizia.errore
        ? { ok: true, avviso: `documento scartato, ma la traccia locale non è stata rimossa (${pulizia.errore})` }
        : { ok: true, ...(r.avviso ? { avviso: r.avviso } : {}) }
    }
    if ('incerto' in r && r.incerto) return { ok: false, incerto: true, errore: r.errore }
    depositoRevisione.salva(tracciaDa(s))
    if ('conflitto' in r) return { ok: false, errore: superata(r.errore) }
    return { ok: false, errore: r.errore }
  }

  const apertura = async (documentId: string): Promise<AperturaRevisione> => {
    const avvisi: string[] = []
    let risolte = 0
    const p = pendenzeDoc(documentId)
    if ('errore' in p)
      return { risolte, avvisi, bloccante: `custodia delle operazioni illeggibile (${p.errore}): niente scritture finché non si riesce a leggerla` }
    for (const op of p.ops) {
      const r = await recuperaOperazione(cliente, depositoOperazioni, op)
      if (r.stato === 'applicata') {
        rev = Math.max(rev, r.revDopo)
        risolte++
        avvisi.push(`l'operazione «${op.kind}» interrotta era ARRIVATA: ritrovata a giornale e chiusa${r.avviso ? ` (${r.avviso})` : ''}`)
        continue
      }
      if (r.stato === 'assente') {
        // mai partita: il reinvio usa SOLO la richiesta custodita
        const ri = await reinviaOperazione(cliente, depositoOperazioni, op.opKey, hasher)
        if (ri.ok && !('nulla' in ri)) {
          rev = Math.max(rev, ri.revDopo)
          risolte++
          avvisi.push(`l'operazione «${op.kind}» non era mai arrivata: reinviata dalla custodia e applicata`)
          continue
        }
        if (!ri.ok && 'conflitto' in ri) {
          risolte++
          avvisi.push(`l'operazione «${op.kind}» custodita è stata SUPERATA nel frattempo: chiusa senza effetti`)
          continue
        }
        return { risolte, avvisi, bloccante: `il reinvio dell'operazione custodita non si è concluso (${!ri.ok ? ri.errore : 'esito inatteso'}): niente nuove scritture finché la pendenza non è risolta` }
      }
      // estranea o illeggibile: pendenza CONSERVATA, scritture vietate
      return { risolte, avvisi, bloccante: r.errore }
    }
    return { risolte, avvisi }
  }

  return { salva, conferma, scarta, apertura }
}
