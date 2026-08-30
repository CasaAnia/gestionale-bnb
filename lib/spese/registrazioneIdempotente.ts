// ============================================================================
// REGISTRAZIONE IDEMPOTENTE (Fase 4, blocco 1 — corretto) — il flusso di
// caricamento che sostituirà i tre passi separati DOPO l'applicazione della
// 0022. NON è ancora collegato alle pagine ufficiali.
//
// Invarianti (revisione del blocco 1):
//  · TUTTO si fissa PRIMA del primo effetto esterno (preparaRipresa): token,
//    impronta SHA-256 (OBBLIGATORIA: senza impronta non si carica), percorso
//    DERIVATO dal token (<giorno>/<token>.<ext> — proprietà verificabile, e
//    due chiamate concorrenti calcolano lo STESSO percorso), mime e kind;
//  · i BYTE nel bucket sono immutabili: l'upload non sovrascrive MAI (un
//    oggetto già presente al nostro percorso è nostro e identico, perché il
//    blob viene riconfrontato con l'impronta fissata prima di ogni invio);
//  · prima di caricare qualsiasi cosa si verifica se il token è GIÀ
//    registrato: in quel caso niente upload, si va dritti alla RPC che
//    decide (ripetuta o TOKEN_RIUSATO col manifesto completo);
//  · si cancella un file SOLO dopo che una verifica esplicita dice che il
//    percorso NON è collegato; esito di verifica incerto → si conserva e
//    si dice.
// ============================================================================
import { sha256DiFile, tipoDocumentoDaFile, type FotoDaCaricare } from './scrittura.ts'

export type PaginaDaRegistrare = {
  storage_path: string
  page_order: number
  mime_type: string | null
  file_sha256: string
}

export type CodiceRegistrazione =
  | 'gia_in_archivio' | 'token_riusato' | 'richiesta_non_valida'
  | 'non_membro' | 'rete' | 'altro'

export type RispostaRegistrazione = {
  documentId?: string
  ripetuta?: boolean
  errore?: string
  codice?: CodiceRegistrazione
}

export type ClienteIdempotente = {
  // upload SENZA sovrascrittura: un oggetto già presente → { esisteGia }
  caricaFile(percorso: string, file: Blob, tipo: string): Promise<{ errore?: string; esisteGia?: boolean }>
  rimuoviFile(percorso: string): Promise<{ errore?: string }>
  ricevutaConSha(sha: string): Promise<{ esiste?: boolean; errore?: string }>
  ricevutaEsiste(storagePath: string): Promise<{ esiste?: boolean; errore?: string }>
  // il tentativo precedente è arrivato? (SELECT per upload_token)
  documentoConToken(token: string): Promise<{ documentId?: string; errore?: string }>
  // la RPC della 0022: atomica e ripetibile con lo stesso token
  registraDocumento(
    token: string, kind: 'scontrino' | 'fattura' | 'altro',
    ambito: 'personale' | 'azienda', nota: string | null,
    pagine: PaginaDaRegistrare[],
  ): Promise<RispostaRegistrazione>
}

// Lo stato dell'operazione, fissato UNA volta e riusato identico in ogni
// ritentativo. La nota non sta qui: la fissa la coda al primo tentativo
// (codaCaricamento) e i ritentativi la ripresentano identica alla RPC.
export type RipresaToken = {
  token: string
  sha256: string
  percorso: string
  mime: string
  kind: 'scontrino' | 'fattura' | 'altro'
}

export type Hasher = (contenuto: Blob) => Promise<string | null>

// Fissa token, impronta, percorso e metadati PRIMA di ogni effetto esterno.
// Se l'impronta non si può calcolare, errore RECUPERABILE prima di caricare.
export async function preparaRipresa(
  foto: FotoDaCaricare,
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
  hasher: Hasher = sha256DiFile,
): Promise<{ ok: true; ripresa: RipresaToken } | { ok: false; errore: string; riprovabile: true }> {
  let sha: string | null = null
  try { sha = await hasher(foto.contenuto) } catch { sha = null }
  if (!sha)
    return { ok: false, errore: 'non riesco a calcolare l\'impronta della foto: senza impronta non la carico (riprova)', riprovabile: true }
  const token = idCasuale()
  const ext = (foto.nomeFile.split('.').pop() || 'jpg').toLowerCase()
  return {
    ok: true,
    ripresa: {
      token, sha256: sha,
      percorso: `${adesso().slice(0, 10)}/${token}.${ext}`,
      mime: foto.tipo || 'image/jpeg',
      kind: tipoDocumentoDaFile(foto.tipo),
    },
  }
}

// traduce il messaggio d'errore della RPC (o della rete) nel codice:
// le sentinelle sono quelle sollevate da registra_documento_caricato
export function codiceDaMessaggio(msg: string): CodiceRegistrazione {
  if (/GIA_IN_ARCHIVIO/i.test(msg)) return 'gia_in_archivio'
  if (/TOKEN_RIUSATO/i.test(msg)) return 'token_riusato'
  if (/NON_MEMBRO/i.test(msg)) return 'non_membro'
  if (/PAGINE_MALFORMATE|PERCORSO_NON_COERENTE|IMPRONTA_(MANCANTE|NON_VALIDA)|KIND_NON_VALIDO|AMBITO_NON_VALIDO|PAGINE_MANCANTI|TOKEN_MANCANTE|RICHIESTA_NON_VALIDA/i.test(msg))
    return 'richiesta_non_valida'
  if (/fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)) return 'rete'
  return 'altro'
}

export type EsitoIdempotente =
  | { ok: true; documentId: string; ripetuta: boolean }
  | { ok: false; errore: string; riprovabile: boolean; duplicato?: boolean; ripresa: RipresaToken }

export async function caricaConToken(
  cliente: ClienteIdempotente,
  foto: FotoDaCaricare,
  ambito: 'personale' | 'azienda',
  nota: string | null,
  ripresa: RipresaToken,
  hasher: Hasher = sha256DiFile,
): Promise<EsitoIdempotente> {
  const fallito = (
    errore: string, riprovabile: boolean, extra: { duplicato?: boolean } = {},
  ): EsitoIdempotente => ({
    ok: false, errore, riprovabile, ...(extra.duplicato ? { duplicato: true } : {}),
    ripresa,   // il riferimento all'operazione non si perde MAI, intero
  })

  // 0a) il blob DEVE corrispondere all'impronta fissata all'inizio: se dopo
  //     un ricaricamento è stato riselezionato un file diverso, ci si ferma
  //     PRIMA di qualsiasi effetto (i byte già caricati restano intatti)
  let shaOra: string | null = null
  try { shaOra = await hasher(foto.contenuto) } catch { shaOra = null }
  if (!shaOra)
    return fallito('non riesco a ricalcolare l\'impronta della foto: non tocco nulla, riprova', true)
  if (shaOra !== ripresa.sha256)
    return fallito('questo file NON corrisponde a quello del tentativo originale: non lo carico sopra — togli la voce e caricalo come foto nuova', false)

  // 0b) il tentativo precedente è arrivato? Si verifica PRIMA di toccare il
  //     bucket. Se il token è già registrato NIENTE upload: decide la RPC
  //     (che confronta il manifesto completo: ripetuta o TOKEN_RIUSATO).
  let giaRegistrato = false
  try {
    const c = await cliente.documentoConToken(ripresa.token)
    if (c.errore)
      return fallito(`non riesco a verificare il tentativo precedente (${c.errore}): non tocco nulla, riprova`, true)
    giaRegistrato = !!c.documentId
  } catch (e) {
    return fallito(`non riesco a verificare il tentativo precedente (${String((e as Error).message ?? e)}): non tocco nulla, riprova`, true)
  }

  if (!giaRegistrato) {
    // 0c) doppione di un ALTRO documento? Controllo di cortesia per evitare
    //     un upload inutile; se non risponde decide comunque la RPC.
    try {
      const c = await cliente.ricevutaConSha(ripresa.sha256)
      if (!c.errore && c.esiste) {
        const via = await pulisciSicuro(cliente, ripresa.percorso)
        return fallito(`questa foto è già in archivio: non la carico di nuovo${via}`, false, { duplicato: true })
      }
    } catch { /* si procede */ }

    // 1) file nel bucket, MAI sovrascrivendo: se al nostro percorso c'è già
    //    un oggetto, è il NOSTRO stesso contenuto (percorso derivato dal
    //    token + impronta verificata al passo 0a) e si prosegue
    try {
      const su = await cliente.caricaFile(ripresa.percorso, foto.contenuto, ripresa.mime)
      if (su.errore && !su.esisteGia)
        return fallito(`caricamento della foto fallito: ${su.errore}`, true)
    } catch (e) {
      return fallito(`caricamento interrotto (${String((e as Error).message ?? e)}): riprova`, true)
    }
  }

  // 2) registrazione atomica e ripetibile (manifesto completo lato RPC)
  const pagina: PaginaDaRegistrare = {
    storage_path: ripresa.percorso, page_order: 1,
    mime_type: ripresa.mime, file_sha256: ripresa.sha256,
  }
  let risposta: RispostaRegistrazione
  try {
    risposta = await cliente.registraDocumento(ripresa.token, ripresa.kind, ambito, nota, [pagina])
  } catch (e) {
    const msg = String((e as Error).message ?? e)
    risposta = { errore: msg, codice: codiceDaMessaggio(msg) }
  }
  if (risposta.documentId)
    return { ok: true, documentId: risposta.documentId, ripetuta: !!risposta.ripetuta }

  const errore = risposta.errore ?? 'risposta senza id'
  const codice = risposta.codice ?? codiceDaMessaggio(errore)
  switch (codice) {
    case 'gia_in_archivio': {
      // rifiuto DEFINITO e atomico (nessun documento resta); la copia si
      // toglie SOLO dopo la verifica esplicita che il percorso non è collegato
      const via = await pulisciSicuro(cliente, ripresa.percorso)
      return fallito(`questa foto è già in archivio${via}`, false, { duplicato: true })
    }
    case 'token_riusato':
      return fallito('questo caricamento risulta già registrato con un contenuto diverso: non tocco nulla — segnalalo', false)
    case 'richiesta_non_valida':
      return fallito(`registrazione respinta come non valida (${errore}): non è un doppione; il file resta nel bucket — segnalalo`, false)
    case 'non_membro':
      return fallito('questo account non è abilitato a caricare documenti', false)
    case 'rete':
      return fallito('esito sconosciuto (rete): al prossimo tentativo recupero il risultato con lo stesso token, senza doppioni', true)
    default:
      return fallito(`registrazione rifiutata (${errore}): riprova`, true)
  }
}

// Pulizia SICURA di un percorso: si cancella SOLO se una verifica esplicita
// dice che NON è collegato ad alcuna ricevuta. "Token non registrato" da
// solo NON basta a dimostrare che il percorso è libero.
async function pulisciSicuro(cliente: ClienteIdempotente, percorso: string): Promise<string> {
  try {
    const c = await cliente.ricevutaEsiste(percorso)
    if (c.errore) return ' · verifica del percorso non riuscita: la copia resta nel bucket'
    if (c.esiste) return ' · il percorso risulta COLLEGATO a una ricevuta: non lo tocco'
    const r = await cliente.rimuoviFile(percorso)
    return r.errore ? ` · la copia non è stata rimossa dal bucket (${r.errore})` : ''
  } catch {
    return ' · verifica del percorso non riuscita: la copia resta nel bucket'
  }
}
