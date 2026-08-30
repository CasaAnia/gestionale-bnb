// ============================================================================
// REGISTRAZIONE IDEMPOTENTE (Fase 4, blocco 1) — il flusso di caricamento
// che sostituirà i tre passi separati DOPO l'applicazione della 0022.
// NON è ancora collegato alle pagine ufficiali (la RPC non esiste in
// produzione): implementazione e prove locali con archivio simulato.
//
// Idea: un TOKEN generato una volta per foto e conservato nella ripresa.
//  · esito sconosciuto → si ritenta con lo STESSO token: la RPC recupera il
//    risultato precedente o registra da zero, MAI un doppione;
//  · doppione (GIA_IN_ARCHIVIO) → la transazione è annullata: nessun
//    documento vuoto, e il NOSTRO file (percorso casuale di un token mai
//    registrato ⇒ non collegato) si può togliere in sicurezza;
//  · stesso token con contenuto diverso (TOKEN_RIUSATO) → respinto, non si
//    tocca nulla;
//  · lo stato "sospeso" del flusso attuale QUI non esiste più.
// ============================================================================
import { tipoDocumentoDaFile, type FotoDaCaricare } from './scrittura.ts'

export type PaginaDaRegistrare = {
  storage_path: string
  page_order: number
  mime_type: string | null
  file_sha256: string | null
}

export type CodiceRegistrazione =
  | 'gia_in_archivio' | 'token_riusato' | 'non_membro' | 'rete' | 'altro'

export type RispostaRegistrazione = {
  documentId?: string
  ripetuta?: boolean
  errore?: string
  codice?: CodiceRegistrazione
}

export type ClienteIdempotente = {
  caricaFile(percorso: string, file: Blob, tipo: string): Promise<{ errore?: string }>
  rimuoviFile(percorso: string): Promise<{ errore?: string }>
  ricevutaConSha(sha: string): Promise<{ esiste?: boolean; errore?: string }>
  // la RPC della 0022: atomica e ripetibile con lo stesso token
  registraDocumento(
    token: string, kind: 'scontrino' | 'fattura' | 'altro',
    ambito: 'personale' | 'azienda', nota: string | null,
    pagine: PaginaDaRegistrare[],
  ): Promise<RispostaRegistrazione>
}

// il token nasce UNA volta per foto (quando entra in coda) e non si perde più
export type RipresaToken = { token: string; percorso?: string }
export const nuovaRipresaToken = (idCasuale: () => string = () => crypto.randomUUID()): RipresaToken =>
  ({ token: idCasuale() })

export type EsitoIdempotente =
  | { ok: true; documentId: string; ripetuta: boolean }
  | { ok: false; errore: string; riprovabile: boolean; duplicato?: boolean; ripresa: RipresaToken }

// traduce il messaggio d'errore della RPC (o della rete) nel codice:
// le sentinelle sono quelle sollevate da registra_documento_caricato
export function codiceDaMessaggio(msg: string): CodiceRegistrazione {
  if (/GIA_IN_ARCHIVIO/i.test(msg)) return 'gia_in_archivio'
  if (/TOKEN_RIUSATO/i.test(msg)) return 'token_riusato'
  if (/NON_MEMBRO/i.test(msg)) return 'non_membro'
  if (/fetch|network|timeout|timed out|abort|econn|socket|load failed/i.test(msg)) return 'rete'
  return 'altro'
}

export async function caricaConToken(
  cliente: ClienteIdempotente,
  foto: FotoDaCaricare,
  ambito: 'personale' | 'azienda',
  nota: string | null,
  ripresa: RipresaToken,
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
): Promise<EsitoIdempotente> {
  const ext = (foto.nomeFile.split('.').pop() || 'jpg').toLowerCase()
  const percorso = ripresa.percorso ?? `${adesso().slice(0, 10)}/${idCasuale()}.${ext}`
  const fallito = (
    errore: string, riprovabile: boolean, extra: { duplicato?: boolean } = {},
  ): EsitoIdempotente => ({
    ok: false, errore, riprovabile, ...(extra.duplicato ? { duplicato: true } : {}),
    // il riferimento all'operazione (token) non si perde MAI
    ripresa: { token: ripresa.token, percorso },
  })

  // 0) primo tentativo: la stessa foto è già in archivio? Un controllo di
  //    cortesia per evitare un upload inutile; se non risponde si procede,
  //    perché il doppione vero lo decide la RPC in modo atomico.
  if (!ripresa.percorso && foto.sha256) {
    try {
      const c = await cliente.ricevutaConSha(foto.sha256)
      if (!c.errore && c.esiste)
        return { ok: false, errore: 'questa foto è già in archivio: non la carico di nuovo', riprovabile: false, duplicato: true, ripresa: { token: ripresa.token } }
    } catch { /* si procede */ }
  }

  // 1) file nel bucket (percorso nostro e casuale, upsert: ritentare è sicuro)
  try {
    const su = await cliente.caricaFile(percorso, foto.contenuto, foto.tipo || 'image/jpeg')
    if (su.errore) return fallito(`caricamento della foto fallito: ${su.errore}`, true)
  } catch (e) {
    return fallito(`caricamento interrotto (${String((e as Error).message ?? e)}): riprova`, true)
  }

  // 2) registrazione atomica e ripetibile
  const pagina: PaginaDaRegistrare = {
    storage_path: percorso, page_order: 1,
    mime_type: foto.tipo || null, file_sha256: foto.sha256,
  }
  let risposta: RispostaRegistrazione
  try {
    risposta = await cliente.registraDocumento(
      ripresa.token, tipoDocumentoDaFile(foto.tipo), ambito, nota, [pagina])
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
      // esito DEFINITO: la transazione è annullata, il nostro token non è
      // registrato ⇒ il nostro percorso non è collegato ⇒ pulizia sicura
      let via = ''
      try {
        const r = await cliente.rimuoviFile(percorso)
        if (r.errore) via = ` · la copia non è stata rimossa dal bucket (${r.errore})`
      } catch { via = ' · la copia non è stata rimossa dal bucket' }
      return { ok: false, errore: `questa foto è già in archivio${via}`, riprovabile: false, duplicato: true, ripresa: { token: ripresa.token } }
    }
    case 'token_riusato':
      // non dovrebbe mai succedere dal nostro client: non si tocca nulla
      return fallito('questo caricamento risulta già registrato con un contenuto diverso: non tocco nulla — segnalalo', false)
    case 'non_membro':
      return fallito('questo account non è abilitato a caricare documenti', false)
    case 'rete':
      return fallito('esito sconosciuto (rete): al prossimo tentativo recupero il risultato con lo stesso token, senza doppioni', true)
    default:
      return fallito(`registrazione rifiutata (${errore}): riprova`, true)
  }
}
