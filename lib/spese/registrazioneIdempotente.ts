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
// PAGINE MULTIPLE (Fase 5): più foto dello stesso documento (una fattura di
// due pagine) viaggiano con UN token e `pagine` = una voce per pagina, con
// il SUO percorso (-pN) e la SUA impronta; i campi di testa restano quelli
// della prima pagina, così le riprese custodite prima della Fase 5 (senza
// `pagine`) valgono identiche come operazioni da una pagina.
export type PaginaRipresa = { percorso: string; sha256: string; mime: string; page_order: number }
export type RipresaToken = {
  token: string
  sha256: string
  percorso: string
  mime: string
  kind: 'scontrino' | 'fattura' | 'altro'
  pagine?: PaginaRipresa[]
}
export const pagineDi = (r: RipresaToken): PaginaRipresa[] =>
  r.pagine?.length ? r.pagine : [{ percorso: r.percorso, sha256: r.sha256, mime: r.mime, page_order: 1 }]

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
// `kind` esplicito (Fase 5: «è una fattura») vince sul tipo dedotto dal file.
export async function preparaRipresa(
  foto: FotoDaCaricare | FotoDaCaricare[],
  adesso = () => new Date().toISOString(),
  idCasuale = () => crypto.randomUUID(),
  hasher: Hasher = sha256DiFile,
  kind?: 'scontrino' | 'fattura' | 'altro',
): Promise<{ ok: true; ripresa: RipresaToken } | { ok: false; errore: string; riprovabile: true }> {
  const fotos = Array.isArray(foto) ? foto : [foto]
  if (fotos.length === 0)
    return { ok: false, errore: 'nessun file da caricare', riprovabile: true }
  const token = idCasuale()
  const giorno = adesso().slice(0, 10)
  const pagine: PaginaRipresa[] = []
  for (const [i, f] of fotos.entries()) {
    let sha: string | null = null
    try { sha = await hasher(f.contenuto) } catch { sha = null }
    if (!sha)
      return { ok: false, errore: `non riesco a calcolare l'impronta della foto${fotos.length > 1 ? ` (pagina ${i + 1})` : ''}: senza impronta non la carico (riprova)`, riprovabile: true }
    const ext = (f.nomeFile.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
    pagine.push({ percorso: percorsoOperazione(giorno, token, i + 1, ext), sha256: sha, mime: f.tipo || 'image/jpeg', page_order: i + 1 })
  }
  // due pagine con la stessa impronta = la stessa foto scelta due volte:
  // la RPC la respingerebbe come doppione, meglio fermarsi prima
  if (new Set(pagine.map(p => p.sha256)).size !== pagine.length)
    return { ok: false, errore: 'due delle pagine scelte sono la stessa foto: togline una', riprovabile: true }
  return {
    ok: true,
    ripresa: {
      token, sha256: pagine[0].sha256, percorso: pagine[0].percorso, mime: pagine[0].mime,
      kind: kind ?? tipoDocumentoDaFile(fotos[0].tipo),
      ...(pagine.length > 1 ? { pagine } : {}),
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

// Lo STATO DI CHIUSURA dell'operazione, esplicito e strutturato: dice al
// deposito durevole se la traccia va conservata. "Non ritentare in
// automatico" NON significa "operazione conclusa": un errore definitivo
// che lascia un file nel bucket (o una pulizia non verificata) mantiene
// una responsabilità residua e quindi la traccia.
export type ChiusuraOperazione =
  | 'conclusa'            // nessuna responsabilità residua: rimuovibile dal deposito
  | 'da_ritentare'        // fallimento transitorio: si ripete col bottone
  | 'da_verificare'       // esito sconosciuto o anomalia: la traccia resta
  | 'in_attesa_del_file'  // serve riselezionare il file originale
  | 'pulizia_pendente'    // esito definito, ma una copia resta nel bucket

// l'esito della pulizia in forma STRUTTURATA (mai dedotto dal testo)
export type EsitoPulizia = 'rimossa' | 'collegata' | 'incerta' | 'fallita'

export type EsitoIdempotente =
  | { ok: true; documentId: string; ripetuta: boolean; avvisoDeposito?: string }
  | {
      ok: false; errore: string; riprovabile: boolean
      chiusura: ChiusuraOperazione
      duplicato?: boolean; serveFile?: boolean
      pulizia?: EsitoPulizia
      // problema del DEPOSITO locale, distinto dall'esito remoto
      avvisoDeposito?: string
      ripresa: RipresaToken
    }

const fallimento = (
  ripresa: RipresaToken, errore: string, riprovabile: boolean,
  chiusura: ChiusuraOperazione,
  extra: { duplicato?: boolean; serveFile?: boolean; pulizia?: EsitoPulizia } = {},
): EsitoIdempotente => ({
  ok: false, errore, riprovabile, chiusura,
  ...(extra.duplicato ? { duplicato: true } : {}),
  ...(extra.serveFile ? { serveFile: true } : {}),
  ...(extra.pulizia ? { pulizia: extra.pulizia } : {}),
  ripresa,   // il riferimento all'operazione non si perde MAI, intero
})

export async function caricaConToken(
  cliente: ClienteIdempotente,
  foto: FotoDaCaricare | FotoDaCaricare[],
  ambito: 'personale' | 'azienda',
  nota: string | null,
  ripresa: RipresaToken,
  hasher: Hasher = sha256DiFile,
): Promise<EsitoIdempotente> {
  const fotos = Array.isArray(foto) ? foto : [foto]
  const pagine = pagineDi(ripresa)
  // 0a) percorsi nel formato ESATTO dell'operazione, prima di ogni effetto
  if (pagine.some(p => !percorsoValido(p.percorso, ripresa.token, p.page_order))
    || new Set(pagine.map(p => p.page_order)).size !== pagine.length)
    return fallimento(ripresa, 'la ripresa ha un percorso che non appartiene a questa operazione: non tocco nulla — segnalalo', false, 'da_verificare')

  // 0b) i blob DEVONO corrispondere alle impronte fissate all'inizio: un
  //     file riselezionato diverso si ferma PRIMA di qualsiasi effetto. Con
  //     più pagine l'abbinamento è PER IMPRONTA (l'ordine di riselezione
  //     non conta): ogni pagina deve trovare il suo file
  const perSha = new Map<string, FotoDaCaricare>()
  for (const f of fotos) {
    let shaOra: string | null = null
    try { shaOra = await hasher(f.contenuto) } catch { shaOra = null }
    if (!shaOra)
      return fallimento(ripresa, 'non riesco a ricalcolare l\'impronta della foto: non tocco nulla, riprova', true, 'da_ritentare')
    perSha.set(shaOra, f)
  }
  const mancanti = pagine.filter(p => !perSha.has(p.sha256))
  if (mancanti.length)
    // l'operazione resta in attesa dei SUOI file: serveFile, non un fallimento definitivo
    return fallimento(ripresa, pagine.length > 1
      ? `${mancanti.length === pagine.length ? 'questi file NON corrispondono' : `manca${mancanti.length === 1 ? '' : 'no'} ${mancanti.length === 1 ? 'una pagina' : `${mancanti.length} pagine`}`} del tentativo originale (pagin${mancanti.length === 1 ? 'a' : 'e'} ${mancanti.map(p => p.page_order).join(', ')}): non carico nulla — riseleziona tutte le pagine giuste, o elimina l'operazione e caricale come foto nuove`
      : 'questo file NON corrisponde a quello del tentativo originale: non lo carico sopra — riseleziona il file giusto, o elimina l\'operazione e caricalo come foto nuova',
    false, 'in_attesa_del_file', { serveFile: true })

  // 0c) il tentativo precedente è arrivato? Si verifica PRIMA di toccare il
  //     bucket. Token già registrato → niente upload, decide la RPC.
  let saltaUpload = false
  try {
    const c = await cliente.documentoConToken(ripresa.token)
    if (c.errore)
      return fallimento(ripresa, `non riesco a verificare il tentativo precedente (${c.errore}): non tocco nulla, riprova`, true, 'da_verificare')
    saltaUpload = !!c.documentId
  } catch (e) {
    return fallimento(ripresa, `non riesco a verificare il tentativo precedente (${String((e as Error).message ?? e)}): non tocco nulla, riprova`, true, 'da_verificare')
  }

  for (const pagina of pagine) {
    let saltaPagina = saltaUpload
    if (!saltaPagina) {
      // 0d) l'impronta risulta già in archivio? Il client NON conclude che sia
      //     un ALTRO documento (una chiamata concorrente con lo STESSO token
      //     può essersi registrata dopo la lettura del passo 0c): si salta
      //     solo l'upload e si lascia decidere la RPC col manifesto.
      try {
        const c = await cliente.ricevutaConSha(pagina.sha256)
        if (!c.errore && c.esiste) saltaPagina = true
      } catch { /* si procede: decide comunque la RPC */ }
    }
    if (saltaPagina) continue
    // 1) file nel bucket, MAI sovrascrivendo. E "oggetto già presente" NON
    //    dimostra "stessa foto": si verifica l'impronta di ciò che è
    //    ARCHIVIATO prima di proseguire.
    const dove = pagine.length > 1 ? ` (pagina ${pagina.page_order})` : ''
    try {
      const su = await cliente.caricaFile(pagina.percorso, perSha.get(pagina.sha256)!.contenuto, pagina.mime)
      if (su.esisteGia) {
        const dentro = await cliente.improntaFile(pagina.percorso)
        if (dentro.errore || !dentro.esiste)
          return fallimento(ripresa, `al nostro percorso${dove} c'è già un oggetto ma non riesco a verificarne il contenuto: non registro e non tocco nulla, riprova`, true, 'da_verificare')
        if (dentro.sha !== pagina.sha256)
          return fallimento(ripresa, `al nostro percorso${dove} c'è un contenuto DIVERSO dalla foto attesa: non registro, non sovrascrivo e non cancello nulla — segnalalo`, false, 'da_verificare')
      } else if (su.errore) {
        return fallimento(ripresa, `caricamento della foto${dove} fallito: ${su.errore}`, true, 'da_ritentare')
      }
    } catch (e) {
      return fallimento(ripresa, `caricamento interrotto${dove} (${String((e as Error).message ?? e)}): riprova`, true, 'da_ritentare')
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
  const pagine: PaginaDaRegistrare[] = pagineDi(ripresa).map(p => ({
    storage_path: p.percorso, page_order: p.page_order,
    mime_type: p.mime, file_sha256: p.sha256,
  }))
  let risposta: RispostaRegistrazione
  try {
    risposta = await cliente.registraDocumento(ripresa.token, ripresa.kind, ambito, nota, pagine)
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
      // la copia si toglie SOLO dopo la verifica esplicita del collegamento.
      // Se la pulizia NON è andata in porto, la responsabilità resta:
      // chiusura 'pulizia_pendente', la traccia non si perde.
      // con più pagine si puliscono TUTTE le copie; basta una pulizia
      // non conclusa perché la responsabilità resti
      const esiti = []
      for (const pag of pagineDi(ripresa)) esiti.push(await pulisciSicuro(cliente, pag.percorso))
      const p = esiti.find(x => x.pulizia !== 'rimossa' && x.pulizia !== 'collegata') ?? esiti[0]
      const conclusa = esiti.every(x => x.pulizia === 'rimossa' || x.pulizia === 'collegata')
      return fallimento(ripresa, `${pagineDi(ripresa).length > 1 ? 'queste pagine sono' : 'questa foto è'} già in archivio${p.nota}`, false,
        conclusa ? 'conclusa' : 'pulizia_pendente', { duplicato: true, pulizia: p.pulizia })
    }
    case 'token_riusato':
      return fallimento(ripresa, 'questo caricamento risulta già registrato con un contenuto diverso: non tocco nulla — segnalalo', false, 'da_verificare')
    case 'richiesta_non_valida':
      // il file resta nel bucket: responsabilità residua, traccia conservata
      return fallimento(ripresa, `registrazione respinta come non valida (${errore}): non è un doppione; il file resta nel bucket — segnalalo`, false, 'da_verificare')
    case 'non_membro':
      return fallimento(ripresa, 'questo account non è abilitato a caricare documenti', false, 'da_verificare')
    case 'rete':
      return fallimento(ripresa, 'esito sconosciuto (rete): al prossimo tentativo recupero il risultato con lo stesso token, senza doppioni', true, 'da_verificare')
    default:
      return fallimento(ripresa, `registrazione rifiutata (${errore}): riprova`, true, 'da_ritentare')
  }
}

// Pulizia SICURA di un percorso: si cancella SOLO se una verifica esplicita
// dice che NON è collegato ad alcuna ricevuta. "Token non registrato" da
// solo NON basta a dimostrare che il percorso è libero. L'esito è
// STRUTTURATO: chi chiama non deve dedurlo dal testo del messaggio.
async function pulisciSicuro(
  cliente: ClienteIdempotente, percorso: string,
): Promise<{ pulizia: EsitoPulizia; nota: string }> {
  try {
    const c = await cliente.ricevutaEsiste(percorso)
    if (c.errore) return { pulizia: 'incerta', nota: ' · verifica del percorso non riuscita: la copia resta nel bucket' }
    if (c.esiste) return { pulizia: 'collegata', nota: ' · il percorso risulta COLLEGATO a una ricevuta: non lo tocco' }
    const r = await cliente.rimuoviFile(percorso)
    if (r.errore) return { pulizia: 'fallita', nota: ` · la copia non è stata rimossa dal bucket (${r.errore})` }
    return { pulizia: 'rimossa', nota: '' }
  } catch {
    return { pulizia: 'incerta', nota: ' · verifica del percorso non riuscita: la copia resta nel bucket' }
  }
}
