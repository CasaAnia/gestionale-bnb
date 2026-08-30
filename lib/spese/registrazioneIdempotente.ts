// ============================================================================
// REGISTRAZIONE IDEMPOTENTE (Fase 4, blocco 1 — seconda revisione) — il
// flusso che sostituirà i tre passi separati DOPO l'applicazione della 0022.
// NON è ancora collegato alle pagine ufficiali.
//
// Invarianti:
//  · TUTTO si fissa PRIMA del primo effetto esterno: token, impronta
//    SHA-256 obbligatoria, percorso in FORMATO PRECISO derivato da token e
//    pagina (<AAAA-MM-GG>/<token>-p<pagina>.<ext>), mime e kind; la
//    persistenza della ripresa (lib/spese/ripresaDurevole.ts) va salvata
//    prima dell'upload;
//  · i BYTE nel bucket sono immutabili: mai sovrascrivere, e "oggetto già
//    presente" NON dimostra "stessa foto": si verifica l'impronta del
//    contenuto ARCHIVIATO; contenuto diverso o verifica indisponibile
//    fermano tutto senza toccare nulla;
//  · niente decisioni da letture vecchie: se il controllo doppioni trova
//    l'impronta, NON si dichiara il doppione dal client (il token potrebbe
//    essere stato registrato da una chiamata concorrente un attimo dopo la
//    nostra lettura) — si salta l'upload e si lascia decidere la RPC col
//    manifesto;
//  · si cancella un file SOLO dopo la verifica esplicita che il percorso
//    non è collegato; esito incerto → si conserva e si dice.
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
  // l'impronta del contenuto GIÀ ARCHIVIATO a un percorso (per verificare
  // che un oggetto presente sia davvero la nostra foto)
  improntaFile(percorso: string): Promise<{ esiste?: boolean; sha?: string; errore?: string }>
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
// ritentativo. La nota non sta qui: la fissa la coda al primo tentativo e
// i ritentativi la ripresentano identica alla RPC (manifesto).
export type RipresaToken = {
  token: string
  sha256: string
  percorso: string
  mime: string
  kind: 'scontrino' | 'fattura' | 'altro'
}

export type Hasher = (contenuto: Blob) => Promise<string | null>

// ---- FORMATO PRECISO del percorso (compatibile con le pagine multiple) ----
// <AAAA-MM-GG>/<token>-p<pagina>.<ext> — validato QUI prima dell'upload e
// di nuovo dalla RPC. "Contiene il token" non basta.
export const percorsoOperazione = (giorno: string, token: string, pagina: number, ext: string) =>
  `${giorno}/${token}-p${pagina}.${ext}`
export function percorsoValido(percorso: string, token: string, pagina: number): boolean {
  const sicuro = token.replace(/[.*+?^${}()|[\]\\]/g, '')
  if (sicuro !== token) return false            // il token è un uuid: niente metacaratteri
  return new RegExp(`^\\d{4}-\\d{2}-\\d{2}/${token}-p${pagina}\\.[a-z0-9]{1,8}$`).test(percorso)
}

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
  const ext = (foto.nomeFile.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  return {
    ok: true,
    ripresa: {
      token, sha256: sha,
      percorso: percorsoOperazione(adesso().slice(0, 10), token, 1, ext),
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
  | { ok: false; errore: string; riprovabile: boolean; duplicato?: boolean; serveFile?: boolean; ripresa: RipresaToken }

const fallimento = (
  ripresa: RipresaToken, errore: string, riprovabile: boolean,
  extra: { duplicato?: boolean; serveFile?: boolean } = {},
): EsitoIdempotente => ({
  ok: false, errore, riprovabile,
  ...(extra.duplicato ? { duplicato: true } : {}),
  ...(extra.serveFile ? { serveFile: true } : {}),
  ripresa,   // il riferimento all'operazione non si perde MAI, intero
})

export async function caricaConToken(
  cliente: ClienteIdempotente,
  foto: FotoDaCaricare,
  ambito: 'personale' | 'azienda',
  nota: string | null,
  ripresa: RipresaToken,
  hasher: Hasher = sha256DiFile,
): Promise<EsitoIdempotente> {
  // 0a) percorso nel formato ESATTO dell'operazione, prima di ogni effetto
  if (!percorsoValido(ripresa.percorso, ripresa.token, 1))
    return fallimento(ripresa, 'la ripresa ha un percorso che non appartiene a questa operazione: non tocco nulla — segnalalo', false)

  // 0b) il blob DEVE corrispondere all'impronta fissata all'inizio: un file
  //     riselezionato diverso si ferma PRIMA di qualsiasi effetto
  let shaOra: string | null = null
  try { shaOra = await hasher(foto.contenuto) } catch { shaOra = null }
  if (!shaOra)
    return fallimento(ripresa, 'non riesco a ricalcolare l\'impronta della foto: non tocco nulla, riprova', true)
  if (shaOra !== ripresa.sha256)
    // l'operazione resta in attesa del SUO file: serveFile, non un fallimento definitivo
    return fallimento(ripresa, 'questo file NON corrisponde a quello del tentativo originale: non lo carico sopra — riseleziona il file giusto, o elimina l\'operazione e caricalo come foto nuova', false, { serveFile: true })

  // 0c) il tentativo precedente è arrivato? Si verifica PRIMA di toccare il
  //     bucket. Token già registrato → niente upload, decide la RPC.
  let saltaUpload = false
  try {
    const c = await cliente.documentoConToken(ripresa.token)
    if (c.errore)
      return fallimento(ripresa, `non riesco a verificare il tentativo precedente (${c.errore}): non tocco nulla, riprova`, true)
    saltaUpload = !!c.documentId
  } catch (e) {
    return fallimento(ripresa, `non riesco a verificare il tentativo precedente (${String((e as Error).message ?? e)}): non tocco nulla, riprova`, true)
  }

  if (!saltaUpload) {
    // 0d) l'impronta risulta già in archivio? Il client NON conclude che sia
    //     un ALTRO documento (una chiamata concorrente con lo STESSO token
    //     può essersi registrata dopo la lettura del passo 0c): si salta
    //     solo l'upload e si lascia decidere la RPC col manifesto.
    try {
      const c = await cliente.ricevutaConSha(ripresa.sha256)
      if (!c.errore && c.esiste) saltaUpload = true
    } catch { /* si procede: decide comunque la RPC */ }
  }

  if (!saltaUpload) {
    // 1) file nel bucket, MAI sovrascrivendo. E "oggetto già presente" NON
    //    dimostra "stessa foto": si verifica l'impronta di ciò che è
    //    ARCHIVIATO prima di proseguire.
    try {
      const su = await cliente.caricaFile(ripresa.percorso, foto.contenuto, ripresa.mime)
      if (su.esisteGia) {
        const dentro = await cliente.improntaFile(ripresa.percorso)
        if (dentro.errore || !dentro.esiste)
          return fallimento(ripresa, 'al nostro percorso c\'è già un oggetto ma non riesco a verificarne il contenuto: non registro e non tocco nulla, riprova', true)
        if (dentro.sha !== ripresa.sha256)
          return fallimento(ripresa, 'al nostro percorso c\'è un contenuto DIVERSO dalla foto attesa: non registro, non sovrascrivo e non cancello nulla — segnalalo', false)
      } else if (su.errore) {
        return fallimento(ripresa, `caricamento della foto fallito: ${su.errore}`, true)
      }
    } catch (e) {
      return fallimento(ripresa, `caricamento interrotto (${String((e as Error).message ?? e)}): riprova`, true)
    }
  }

  // 2) registrazione atomica e ripetibile (manifesto completo lato RPC)
  return registraOperazione(cliente, ripresa, ambito, nota)
}

// La sola registrazione (RPC + esiti), senza upload: usata da caricaConToken
// e dal recupero durevole quando il file è già nel bucket o già registrato.
export async function registraOperazione(
  cliente: ClienteIdempotente,
  ripresa: RipresaToken,
  ambito: 'personale' | 'azienda',
  nota: string | null,
): Promise<EsitoIdempotente> {
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
      // rifiuto DEFINITO e atomico deciso dalla RPC (nessun documento resta);
      // la copia si toglie SOLO dopo la verifica esplicita del collegamento
      const via = await pulisciSicuro(cliente, ripresa.percorso)
      return fallimento(ripresa, `questa foto è già in archivio${via}`, false, { duplicato: true })
    }
    case 'token_riusato':
      return fallimento(ripresa, 'questo caricamento risulta già registrato con un contenuto diverso: non tocco nulla — segnalalo', false)
    case 'richiesta_non_valida':
      return fallimento(ripresa, `registrazione respinta come non valida (${errore}): non è un doppione; il file resta nel bucket — segnalalo`, false)
    case 'non_membro':
      return fallimento(ripresa, 'questo account non è abilitato a caricare documenti', false)
    case 'rete':
      return fallimento(ripresa, 'esito sconosciuto (rete): al prossimo tentativo recupero il risultato con lo stesso token, senza doppioni', true)
    default:
      return fallimento(ripresa, `registrazione rifiutata (${errore}): riprova`, true)
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
