// ============================================================================
// RIPRESA DUREVOLE (Fase 4, blocco 1 — seconda revisione) — il manifesto
// completo dell'operazione viene salvato in un DEPOSITO PERSISTENTE PRIMA
// del primo effetto esterno: la chiusura o il ricaricamento della pagina
// non perdono più l'operazione (niente file orfani da "upload riuscito,
// registrazione mai arrivata, ripresa persa").
// Regole:
//  · se il salvataggio della ripresa fallisce, l'upload NON parte;
//  · il recupero riusa l'operazione ORIGINALE (token, percorso, impronta,
//    mime, kind, ambito, nota): se il file va riselezionato, l'impronta
//    viene riconfrontata;
//  · un'operazione esce dal deposito solo con un esito DEFINITO (successo,
//    doppione, respinta); gli esiti riprovabili la lasciano lì.
// NON ancora collegato alle pagine ufficiali (dipende dalla 0022).
// ============================================================================
import {
  caricaConToken, preparaRipresa, registraOperazione,
  type ClienteIdempotente, type EsitoIdempotente, type Hasher, type RipresaToken,
} from './registrazioneIdempotente.ts'
import { sha256DiFile, type FotoDaCaricare } from './scrittura.ts'

// l'operazione COMPLETA, come persistita: la ripresa più ciò che serve a
// ripresentare alla RPC un manifesto identico
export type OperazioneDurevole = RipresaToken & {
  ambito: 'personale' | 'azienda'
  nota: string | null
  nomeFile: string
}

export type DepositoRiprese = {
  salva(op: OperazioneDurevole): Promise<{ errore?: string }>
  leggi(): Promise<OperazioneDurevole[]>
  rimuovi(token: string): Promise<void>
}

export function depositoInMemoria(): DepositoRiprese & { contenuto: () => OperazioneDurevole[] } {
  let riprese: OperazioneDurevole[] = []
  return {
    async salva(op) { riprese = [...riprese.filter(r => r.token !== op.token), op]; return {} },
    async leggi() { return [...riprese] },
    async rimuovi(token) { riprese = riprese.filter(r => r.token !== token) },
    contenuto: () => [...riprese],
  }
}

// il deposito del browser (localStorage): può non esserci o essere pieno —
// in quel caso salva() RESTITUISCE l'errore e il chiamante non carica nulla
export function depositoLocale(chiave = 'gestionale-riprese-caricamento'): DepositoRiprese {
  const tutte = (): OperazioneDurevole[] => {
    try { return JSON.parse(localStorage.getItem(chiave) || '[]') } catch { return [] }
  }
  return {
    async salva(op) {
      try {
        localStorage.setItem(chiave, JSON.stringify([...tutte().filter(r => r.token !== op.token), op]))
        return {}
      } catch (e) { return { errore: String((e as Error).message ?? e) } }
    },
    async leggi() { return tutte() },
    async rimuovi(token) {
      try { localStorage.setItem(chiave, JSON.stringify(tutte().filter(r => r.token !== token))) } catch { /* resta */ }
    },
  }
}

export type EsitoAvvio =
  | EsitoIdempotente
  | { ok: false; errore: string; riprovabile: boolean; ripresa?: undefined }

export function creaControllore(
  cliente: ClienteIdempotente,
  deposito: DepositoRiprese,
  hasher: Hasher = sha256DiFile,
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
) {
  // regola: un esito DEFINITO (successo, doppione, respinta) chiude
  // l'operazione nel deposito; uno riprovabile o "serve il file" la lascia
  // lì per il prossimo recupero
  return {
    // nuovo caricamento: manifesto fissato e PERSISTITO prima dell'upload
    async avvia(foto: FotoDaCaricare, ambito: 'personale' | 'azienda', nota: string | null): Promise<EsitoAvvio> {
      const prep = await preparaRipresa(foto, adesso, idCasuale, hasher)
      if (!prep.ok) return { ok: false, errore: prep.errore, riprovabile: true }
      const op: OperazioneDurevole = { ...prep.ripresa, ambito, nota, nomeFile: foto.nomeFile }
      const salvataggio = await deposito.salva(op)
      if (salvataggio.errore)
        return { ok: false, errore: `non riesco a salvare la ripresa (${salvataggio.errore}): NON carico la foto, riprova`, riprovabile: true }
      const esito = await caricaConToken(cliente, foto, ambito, nota, op, hasher)
      if (esito.ok) await deposito.rimuovi(op.token)
      else if (!esito.riprovabile && !esito.serveFile) await deposito.rimuovi(op.token)
      return esito
    },

    // le operazioni rimaste in sospeso (dopo un ricaricamento della pagina)
    pendenti(): Promise<OperazioneDurevole[]> { return deposito.leggi() },

    // recupero di un'operazione pendente. Senza file: si completa se il
    // token è registrato o se il file è già nel bucket (impronta verificata);
    // altrimenti si chiede di riselezionare il file, che viene riconfrontato.
    async riprendi(op: OperazioneDurevole, foto?: FotoDaCaricare): Promise<EsitoIdempotente> {
      if (foto) {
        const esito = await caricaConToken(cliente, foto, op.ambito, op.nota, op, hasher)
        return finalizzaDopo(esito)
      }
      // 1) già registrata? (la RPC risponde "ripetuta" col manifesto)
      try {
        const c = await cliente.documentoConToken(op.token)
        if (c.errore) return { ok: false, errore: `non riesco a verificare l'operazione (${c.errore}): riprova`, riprovabile: true, ripresa: op }
        if (c.documentId) return finalizzaDopo(await registraOperazione(cliente, op, op.ambito, op.nota))
      } catch (e) {
        return { ok: false, errore: `non riesco a verificare l'operazione (${String((e as Error).message ?? e)}): riprova`, riprovabile: true, ripresa: op }
      }
      // 2) non registrata: il file era già stato caricato?
      const dentro: { esiste?: boolean; sha?: string; errore?: string } =
        await cliente.improntaFile(op.percorso).catch(() => ({ errore: 'verifica non riuscita' }))
      if (dentro.errore)
        return { ok: false, errore: `non riesco a verificare il file caricato (${dentro.errore}): riprova`, riprovabile: true, ripresa: op }
      if (!dentro.esiste)
        return { ok: false, errore: `serve di nuovo il file «${op.nomeFile}»: riselezionalo per completare il caricamento (verrà riconosciuto dall'impronta)`, riprovabile: false, serveFile: true, ripresa: op }
      if (dentro.sha !== op.sha256)
        return { ok: false, errore: 'al percorso dell\'operazione c\'è un contenuto DIVERSO dalla foto attesa: non registro e non tocco nulla — segnalalo', riprovabile: false, ripresa: op }
      // 3) file giusto già nel bucket: si registra e basta (niente upload)
      return finalizzaDopo(await registraOperazione(cliente, op, op.ambito, op.nota))

      async function finalizzaDopo(esito: EsitoIdempotente): Promise<EsitoIdempotente> {
        if (esito.ok || (!esito.riprovabile && !esito.serveFile)) await deposito.rimuovi(op.token)
        return esito
      }
    },
  }
}
