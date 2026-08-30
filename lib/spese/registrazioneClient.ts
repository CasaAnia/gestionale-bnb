// ============================================================================
// FABBRICA del ClienteIdempotente reale (Fase 4, collaudo 0022): gli stessi
// adattatori effettivi (upload senza sovrascrittura, impronta del contenuto
// archiviato, RPC) costruiti su UN client Supabase INIETTATO. Le pagine
// ufficiali useranno il client del browser (registrazioneSupabase.ts); il
// collaudo li usa IDENTICI puntati al progetto di prova. Nessun percorso
// alternativo: la logica è una sola.
// ============================================================================
import { sha256DiFile } from './scrittura.ts'
import { codiceDaMessaggio, type ClienteIdempotente } from './registrazioneIdempotente.ts'

// il minimo che serve dal client Supabase (browser o node, è uguale)
export type ClientSupabaseMinimo = {
  storage: {
    from(bucket: string): {
      upload(percorso: string, file: Blob, opzioni: { contentType: string; upsert: boolean }): Promise<{ error: { message: string } | null }>
      remove(percorsi: string[]): Promise<{ error: { message: string } | null }>
      download(percorso: string): Promise<{ data: Blob | null; error: { message: string } | null }>
    }
  }
  from(tabella: string): {
    select(colonne: string): {
      eq(colonna: string, valore: string): {
        limit(n: number): Promise<{ data: unknown[] | null; error: { message: string } | null }>
      }
    }
  }
  rpc(nome: string, parametri: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>
}

export function creaClienteIdempotente(supabase: ClientSupabaseMinimo): ClienteIdempotente {
  const unaRiga = async (tabella: string, colonna: string, valore: string) => {
    const { data, error } = await supabase.from(tabella).select('id').eq(colonna, valore).limit(1)
    if (error) return { errore: error.message }
    return { righe: data ?? [] }
  }
  return {
    // MAI upsert: i byte di un oggetto presente sono immutabili; l'oggetto
    // già esistente al NOSTRO percorso viene poi verificato con improntaFile
    async caricaFile(percorso, file, tipo) {
      const { error } = await supabase.storage.from('scontrini')
        .upload(percorso, file, { contentType: tipo, upsert: false })
      if (!error) return {}
      if (/already exists|duplicate|409/i.test(error.message)) return { esisteGia: true }
      return { errore: error.message }
    },
    async rimuoviFile(percorso) {
      const { error } = await supabase.storage.from('scontrini').remove([percorso])
      return error ? { errore: error.message } : {}
    },
    // l'impronta di ciò che è DAVVERO archiviato: si scarica l'oggetto e la
    // si ricalcola (le foto sono piccole; è il controllo affidabile quando
    // un oggetto risulta già presente al nostro percorso)
    async improntaFile(percorso) {
      const { data, error } = await supabase.storage.from('scontrini').download(percorso)
      if (error) {
        if (/not.?found|404|does not exist/i.test(error.message)) return { esiste: false }
        return { errore: error.message }
      }
      if (!data) return { errore: 'scaricamento vuoto' }
      const sha = await sha256DiFile(data)
      if (!sha) return { errore: 'impronta non calcolabile' }
      return { esiste: true, sha }
    },
    async ricevutaConSha(sha) {
      const r = await unaRiga('family_receipts', 'file_sha256', sha)
      return r.errore ? { errore: r.errore } : { esiste: r.righe!.length > 0 }
    },
    async ricevutaEsiste(storagePath) {
      const r = await unaRiga('family_receipts', 'storage_path', storagePath)
      return r.errore ? { errore: r.errore } : { esiste: r.righe!.length > 0 }
    },
    async documentoConToken(token) {
      const r = await unaRiga('family_documents', 'upload_token', token)
      if (r.errore) return { errore: r.errore }
      return r.righe!.length ? { documentId: (r.righe![0] as { id: string }).id } : {}
    },
    async registraDocumento(token, kind, ambito, nota, pagine) {
      const { data, error } = await supabase.rpc('registra_documento_caricato', {
        p_token: token, p_kind: kind, p_ambito: ambito, p_nota: nota, p_pagine: pagine,
      })
      if (error) return { errore: error.message, codice: codiceDaMessaggio(error.message) }
      const r = data as { document_id?: string; ripetuta?: boolean } | null
      if (!r?.document_id) return { errore: 'risposta senza id', codice: 'altro' }
      return { documentId: r.document_id, ripetuta: !!r.ripetuta }
    },
  }
}
