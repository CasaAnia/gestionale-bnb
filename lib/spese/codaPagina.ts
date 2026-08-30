// ============================================================================
// CODA DI CARICAMENTO DELLE PAGINE (Fase 4, blocco 2) — l'integrazione che
// /spese e /spese-famiglia usano DAVVERO, come strato sottile sul flusso
// idempotente già collaudato (ripresaDurevole.creaControllore +
// registrazioneSupabase): NESSUN secondo percorso di registrazione.
// Regole:
//  · ogni voce ha un identificativo stabile; il ciclo lavora sullo stato
//    VIVO (aggiungere/togliere durante l'attesa è sicuro);
//  · le operazioni PENDENTI del deposito durevole diventano voci visibili
//    anche dopo chiusura del foglio, navigazione e ricaricamento, con
//    ambito, token e manifesto ORIGINALI;
//  · stati espliciti: da_ritentare / da_verificare / da_riselezionare /
//    pulizia_pendente / duplicato — la traccia non si cancella finché
//    resta qualcosa da recuperare (ci pensa il controller collaudato);
//  · un errore di lettura del deposito arriva ESPLICITO, mai come vuoto.
// ============================================================================
import type { ChiusuraOperazione, EsitoIdempotente } from './registrazioneIdempotente.ts'
import type { OperazioneDurevole } from './ripresaDurevole.ts'
import type { FotoDaCaricare } from './scrittura.ts'

export type StatoVocePagina =
  | 'in_attesa'          // scelta ora, mai inviata
  | 'in_invio'
  | 'salvata'
  | 'da_ritentare'       // fallimento transitorio: il bottone Salva la riprova
  | 'da_verificare'      // esito sconosciuto o anomalia (riprovabile o no)
  | 'da_riselezionare'   // serve di nuovo il file originale
  | 'pulizia_pendente'   // doppione accertato, copia ancora nel bucket
  | 'duplicato'          // doppione accertato e chiuso

export type VocePagina = {
  id: string                                   // token dell'operazione, o id locale
  nome: string
  tipo: string
  ambito: 'personale' | 'azienda'              // l'ambito ORIGINALE dell'operazione
  stato: StatoVocePagina
  riprovabile?: boolean
  errore?: string
  avviso?: string                              // es. avvisoDeposito
  file?: Blob | null                           // solo per le voci di questa sessione
  op?: OperazioneDurevole                      // presente appena l'operazione esiste
}

// il controller di ripresaDurevole, come lo vede questa coda
export type ControllerPagina = {
  avvia(foto: FotoDaCaricare, ambito: 'personale' | 'azienda', nota: string | null): Promise<EsitoIdempotente | { ok: false; errore: string; riprovabile: boolean; ripresa?: undefined }>
  pendenti(): Promise<{ riprese: OperazioneDurevole[]; errore?: string }>
  riprendi(op: OperazioneDurevole, foto?: FotoDaCaricare): Promise<EsitoIdempotente>
}

const statoDaChiusura = (c: ChiusuraOperazione | undefined): StatoVocePagina =>
  c === 'da_ritentare' ? 'da_ritentare'
    : c === 'in_attesa_del_file' ? 'da_riselezionare'
    : c === 'pulizia_pendente' ? 'pulizia_pendente'
    : 'da_verificare'

// le operazioni pendenti del deposito → voci (senza file: sopravvivono al
// ricaricamento; ambito/token/manifesto restano quelli originali)
export function vociDaPendenti(riprese: OperazioneDurevole[]): VocePagina[] {
  return riprese.map(op => {
    const stato = statoDaChiusura(op.stato)
    return {
      id: op.token, nome: op.nomeFile, tipo: op.mime, ambito: op.ambito,
      stato, errore: op.motivo, file: null, op,
      // il recupero senza file è sempre tentabile: verifica da sé cosa fare
      riprovabile: stato !== 'da_riselezionare',
    }
  })
}

export function nuoveVociPagina(
  files: { file: Blob; nome: string; tipo: string }[],
  ambito: 'personale' | 'azienda',
  genId: () => string,
): VocePagina[] {
  return files.map(f => ({
    id: genId(), nome: f.nome, tipo: f.tipo, ambito,
    stato: 'in_attesa' as const, file: f.file,
  }))
}

export function applicaEsitoPagina(v: VocePagina, esito: Awaited<ReturnType<ControllerPagina['avvia']>>, nota: string | null): VocePagina {
  if (esito.ok) return { ...v, stato: 'salvata', errore: undefined, riprovabile: false, avviso: esito.avvisoDeposito, op: undefined }
  const ripresa = 'ripresa' in esito ? esito.ripresa : undefined
  // la nota ORIGINALE dell'operazione è immutabile, NULL COMPRESO: se
  // l'operazione esiste già si conserva la sua (anche nulla); la nota del
  // campo vale solo per la PRIMA creazione
  const notaOriginale = v.op ? v.op.nota : nota
  const op: OperazioneDurevole | undefined = ripresa
    ? { ...ripresa, ambito: v.ambito, nota: notaOriginale, nomeFile: v.nome }
    : v.op
  const chiusura = 'chiusura' in esito ? esito.chiusura : 'da_ritentare'
  const duplicato = 'duplicato' in esito && esito.duplicato
  return {
    ...v,
    stato: duplicato && chiusura === 'conclusa' ? 'duplicato' : statoDaChiusura(chiusura === 'conclusa' ? 'da_verificare' : chiusura),
    riprovabile: esito.riprovabile,
    errore: esito.errore,
    avviso: 'avvisoDeposito' in esito ? esito.avvisoDeposito : undefined,
    // l'operazione si conserva finché il deposito la tiene (chiusura ≠ conclusa)
    op: chiusura === 'conclusa' ? undefined : op,
  }
}

// si (ri)invia col bottone Salva: le nuove col loro file, e le pendenti
// RIPROVABILI (anche senza file: il recupero decide da sé); mai le
// da_riselezionare senza file né le chiuse.
// Caso particolare: un fallimento PRIMA della creazione dell'operazione
// (impronta non calcolabile, deposito momentaneamente non scrivibile) non
// ha op né effetti esterni — si riprova da capo col file in mano, ma SOLO
// se esplicitamente riprovabile: niente sblocchi indiscriminati delle
// voci senza operazione
export const inviabilePagina = (v: VocePagina): boolean =>
  (v.stato === 'in_attesa' && !!v.file)
  || (v.stato === 'da_ritentare' && (!!v.op || (!!v.file && v.riprovabile === true)))
  || (v.stato === 'pulizia_pendente' && !!v.op)
  || (v.stato === 'da_verificare' && v.riprovabile === true && !!v.op)
  || (v.stato === 'da_riselezionare' && !!v.file && !!v.op)   // file appena riselezionato

export const rimovibilePagina = (v: VocePagina): boolean =>
  v.stato === 'in_attesa' || v.stato === 'duplicato' || v.stato === 'salvata'
  // tutto il resto ha una traccia nel deposito: si recupera, non si nasconde

const fotoDa = (v: VocePagina): FotoDaCaricare =>
  ({ nomeFile: v.nome, tipo: v.tipo, contenuto: v.file as Blob, sha256: null })

// Il ciclo di invio della PAGINA: per identificativi, sullo stato vivo.
export async function salvaCodaPagina(
  leggi: () => VocePagina[],
  scrivi: (aggiorna: (coda: VocePagina[]) => VocePagina[]) => void,
  controller: ControllerPagina,
  nota: string | null,
): Promise<{ salvate: number }> {
  const ids = leggi().filter(inviabilePagina).map(v => v.id)
  let salvate = 0
  for (const id of ids) {
    const voce = leggi().find(v => v.id === id)
    if (!voce || !inviabilePagina(voce)) continue
    scrivi(coda => coda.map(v => (v.id === id ? { ...v, stato: 'in_invio' as const } : v)))
    let esito: Awaited<ReturnType<ControllerPagina['avvia']>>
    try {
      esito = voce.op
        ? await controller.riprendi(voce.op, voce.file ? fotoDa(voce) : undefined)
        : await controller.avvia(fotoDa(voce), voce.ambito, nota)
    } catch (e) {
      esito = { ok: false, errore: String((e as Error).message ?? e), riprovabile: true, ripresa: undefined }
    }
    if (esito.ok) salvate++
    scrivi(coda => coda.map(v => (v.id === id ? applicaEsitoPagina({ ...voce }, esito, nota) : v)))
  }
  return { salvate }
}

// la riselezione del file per una voce da_riselezionare (o per riprovare
// un ritentativo con i byte in mano): il controller riconfronta l'impronta
export function conFileRiselezionato(v: VocePagina, file: Blob, nome: string, tipo: string): VocePagina {
  return { ...v, file, nome: v.op?.nomeFile ?? nome, tipo }
}
