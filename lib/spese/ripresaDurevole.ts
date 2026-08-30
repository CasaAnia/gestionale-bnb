// ============================================================================
// RIPRESA DUREVOLE (Fase 4, blocco 1 — terza revisione) — il manifesto
// completo dell'operazione viene salvato in un DEPOSITO PERSISTENTE PRIMA
// del primo effetto esterno.
// Regole:
//  · se il salvataggio della ripresa fallisce, l'upload NON parte;
//  · la traccia resta finché esiste una RESPONSABILITÀ RESIDUA: si rimuove
//    dal deposito SOLO un esito con chiusura 'conclusa' (successo, o
//    doppione con pulizia riuscita/percorso collegato). "Non ritentare in
//    automatico" non significa "operazione conclusa": richieste respinte
//    col file rimasto nel bucket, pulizie non verificate, file da
//    riselezionare restano nel deposito con il loro MOTIVO;
//  · errore di LETTURA del deposito ≠ deposito vuoto: chiave assente è
//    vuoto vero; lettura fallita, JSON corrotto o struttura non valida si
//    SEGNALANO, il contenuto esistente si conserva e i nuovi caricamenti
//    che non si possono salvare in sicurezza vengono bloccati.
// NON ancora collegato alle pagine ufficiali (dipende dalla 0022).
// ============================================================================
import {
  caricaConToken, preparaRipresa, registraOperazione,
  type ChiusuraOperazione, type ClienteIdempotente, type EsitoIdempotente,
  type Hasher, type RipresaToken,
} from './registrazioneIdempotente.ts'
import { sha256DiFile, type FotoDaCaricare } from './scrittura.ts'

// l'operazione COMPLETA, come persistita: la ripresa più ciò che serve a
// ripresentare alla RPC un manifesto identico, più l'ultimo motivo noto
export type OperazioneDurevole = RipresaToken & {
  ambito: 'personale' | 'azienda'
  nota: string | null
  nomeFile: string
  motivo?: string                 // l'ultimo errore, conservato con la traccia
  stato?: ChiusuraOperazione      // l'ultima chiusura nota (mai 'conclusa')
}

export type LetturaRiprese = { riprese: OperazioneDurevole[]; errore?: string }

export type DepositoRiprese = {
  salva(op: OperazioneDurevole): Promise<{ errore?: string }>
  leggi(): Promise<LetturaRiprese>
  rimuovi(token: string): Promise<{ errore?: string }>
}

export function depositoInMemoria(): DepositoRiprese & { contenuto: () => OperazioneDurevole[] } {
  let riprese: OperazioneDurevole[] = []
  return {
    async salva(op) { riprese = [...riprese.filter(r => r.token !== op.token), op]; return {} },
    async leggi() { return { riprese: [...riprese] } },
    async rimuovi(token) { riprese = riprese.filter(r => r.token !== token); return {} },
    contenuto: () => [...riprese],
  }
}

// ---- il deposito del browser (localStorage) --------------------------------
type Memoria = Pick<Storage, 'getItem' | 'setItem'>

const AMBITI = ['personale', 'azienda'], KINDS = ['scontrino', 'fattura', 'altro']
function operazioneValida(x: unknown): x is OperazioneDurevole {
  if (typeof x !== 'object' || x === null) return false
  const o = x as Record<string, unknown>
  return typeof o.token === 'string' && typeof o.sha256 === 'string'
    && typeof o.percorso === 'string' && typeof o.mime === 'string'
    && typeof o.nomeFile === 'string'
    && KINDS.includes(o.kind as string) && AMBITI.includes(o.ambito as string)
    && (o.nota === null || typeof o.nota === 'string')
}

// lettura con TRE esiti distinti: vuoto vero (chiave assente), contenuto
// valido, oppure ERRORE (lettura fallita / JSON corrotto / struttura non
// valida) — l'errore NON viene mai scambiato per "vuoto"
function leggiMemoria(memoria: Memoria, chiave: string): LetturaRiprese {
  let testo: string | null
  try { testo = memoria.getItem(chiave) } catch (e) {
    return { riprese: [], errore: `lettura del deposito fallita (${String((e as Error).message ?? e)})` }
  }
  if (testo === null) return { riprese: [] }           // chiave ASSENTE = davvero vuoto
  let dati: unknown
  try { dati = JSON.parse(testo) } catch {
    return { riprese: [], errore: 'il deposito contiene dati corrotti (JSON non valido)' }
  }
  if (!Array.isArray(dati) || !dati.every(operazioneValida))
    return { riprese: [], errore: 'il deposito contiene una struttura non valida' }
  return { riprese: dati }
}

export function depositoLocale(
  chiave = 'gestionale-riprese-caricamento',
  memoria: () => Memoria = () => localStorage,
): DepositoRiprese {
  return {
    async salva(op) {
      let mem: Memoria
      try { mem = memoria() } catch (e) { return { errore: String((e as Error).message ?? e) } }
      const lettura = leggiMemoria(mem, chiave)
      if (lettura.errore)
        // deposito illeggibile: NON si azzera e NON si sovrascrive — il
        // caricamento nuovo va bloccato perché non è salvabile in sicurezza
        return { errore: `deposito illeggibile, non sovrascrivo (${lettura.errore})` }
      try {
        mem.setItem(chiave, JSON.stringify([...lettura.riprese.filter(r => r.token !== op.token), op]))
        return {}
      } catch (e) { return { errore: String((e as Error).message ?? e) } }
    },
    async leggi() {
      try { return leggiMemoria(memoria(), chiave) }
      catch (e) { return { riprese: [], errore: String((e as Error).message ?? e) } }
    },
    async rimuovi(token) {
      let mem: Memoria
      try { mem = memoria() } catch (e) { return { errore: String((e as Error).message ?? e) } }
      const lettura = leggiMemoria(mem, chiave)
      if (lettura.errore) return { errore: `deposito illeggibile, non tocco nulla (${lettura.errore})` }
      try {
        mem.setItem(chiave, JSON.stringify(lettura.riprese.filter(r => r.token !== token)))
        return {}
      } catch (e) { return { errore: String((e as Error).message ?? e) } }
    },
  }
}

export type EsitoAvvio =
  | EsitoIdempotente
  | {
      ok: false; errore: string; riprovabile: boolean
      chiusura: 'da_ritentare'
      duplicato?: undefined; serveFile?: undefined; pulizia?: undefined
      avvisoDeposito?: undefined
      ripresa?: undefined
    }

export function creaControllore(
  cliente: ClienteIdempotente,
  deposito: DepositoRiprese,
  hasher: Hasher = sha256DiFile,
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
) {
  // la regola di conservazione: SOLO 'conclusa' chiude la traccia; ogni
  // altro esito la mantiene nel deposito, aggiornata col suo motivo.
  // Un errore del DEPOSITO diventa un AVVISO strutturato sull'esito: non
  // trasforma un salvataggio remoto riuscito in un fallimento, e non
  // perde la traccia (la voce resta com'era, col motivo vecchio).
  const chiudiOConserva = async (op: OperazioneDurevole, esito: EsitoIdempotente): Promise<EsitoIdempotente> => {
    if (esito.ok || esito.chiusura === 'conclusa') {
      const r = await deposito.rimuovi(op.token).catch(e => ({ errore: String((e as Error).message ?? e) }))
      if (r.errore)
        return { ...esito, avvisoDeposito: `operazione conclusa ma non rimossa dal deposito (${r.errore}): comparirà ancora tra le pendenti — un recupero la richiuderà senza doppioni` }
      return esito
    }
    const r = await deposito.salva({ ...op, motivo: esito.errore, stato: esito.chiusura })
      .catch(e => ({ errore: String((e as Error).message ?? e) }))
    if (r.errore)
      return { ...esito, avvisoDeposito: `motivo non aggiornato nel deposito (${r.errore}): la traccia resta con le informazioni precedenti` }
    return esito
  }

  return {
    // nuovo caricamento: manifesto fissato e PERSISTITO prima dell'upload
    async avvia(foto: FotoDaCaricare, ambito: 'personale' | 'azienda', nota: string | null): Promise<EsitoAvvio> {
      const prep = await preparaRipresa(foto, adesso, idCasuale, hasher)
      if (!prep.ok) return { ok: false, errore: prep.errore, riprovabile: true, chiusura: 'da_ritentare' }
      const op: OperazioneDurevole = { ...prep.ripresa, ambito, nota, nomeFile: foto.nomeFile }
      const salvataggio = await deposito.salva(op)
      if (salvataggio.errore)
        return { ok: false, errore: `non riesco a salvare la ripresa (${salvataggio.errore}): NON carico la foto, riprova`, riprovabile: true, chiusura: 'da_ritentare' }
      return chiudiOConserva(op, await caricaConToken(cliente, foto, ambito, nota, op, hasher))
    },

    // le operazioni rimaste in sospeso; un errore di lettura arriva
    // ESPLICITO, mai spacciato per deposito vuoto
    pendenti(): Promise<LetturaRiprese> { return deposito.leggi() },

    // recupero di un'operazione pendente. Senza file: si completa se il
    // token è registrato o se il file è già nel bucket (impronta verificata);
    // altrimenti si chiede di riselezionare il file, che viene riconfrontato.
    async riprendi(op: OperazioneDurevole, foto?: FotoDaCaricare): Promise<EsitoIdempotente> {
      if (foto)
        return chiudiOConserva(op, await caricaConToken(cliente, foto, op.ambito, op.nota, op, hasher))
      // 1) già registrata? (la RPC risponde "ripetuta" col manifesto)
      try {
        const c = await cliente.documentoConToken(op.token)
        if (c.errore) return chiudiOConserva(op, { ok: false, errore: `non riesco a verificare l'operazione (${c.errore}): riprova`, riprovabile: true, chiusura: 'da_verificare', ripresa: op })
        if (c.documentId) return chiudiOConserva(op, await registraOperazione(cliente, op, op.ambito, op.nota))
      } catch (e) {
        return chiudiOConserva(op, { ok: false, errore: `non riesco a verificare l'operazione (${String((e as Error).message ?? e)}): riprova`, riprovabile: true, chiusura: 'da_verificare', ripresa: op })
      }
      // 2) non registrata: il file era già stato caricato?
      const dentro: { esiste?: boolean; sha?: string; errore?: string } =
        await cliente.improntaFile(op.percorso).catch(() => ({ errore: 'verifica non riuscita' }))
      if (dentro.errore)
        return chiudiOConserva(op, { ok: false, errore: `non riesco a verificare il file caricato (${dentro.errore}): riprova`, riprovabile: true, chiusura: 'da_verificare', ripresa: op })
      if (!dentro.esiste)
        return chiudiOConserva(op, { ok: false, errore: `serve di nuovo il file «${op.nomeFile}»: riselezionalo per completare il caricamento (verrà riconosciuto dall'impronta)`, riprovabile: false, serveFile: true, chiusura: 'in_attesa_del_file', ripresa: op })
      if (dentro.sha !== op.sha256)
        return chiudiOConserva(op, { ok: false, errore: 'al percorso dell\'operazione c\'è un contenuto DIVERSO dalla foto attesa: non registro e non tocco nulla — segnalalo', riprovabile: false, chiusura: 'da_verificare', ripresa: op })
      // 3) file giusto già nel bucket: si registra e basta (niente upload)
      return chiudiOConserva(op, await registraOperazione(cliente, op, op.ambito, op.nota))
    },
  }
}
