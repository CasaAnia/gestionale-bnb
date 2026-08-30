// Il ClienteIdempotente vero — DA COLLEGARE alle pagine SOLO DOPO
// l'applicazione della migrazione 0022 (la RPC oggi non esiste in
// produzione: chiamarla ora fallirebbe). Nessun service role: chiave anon
// + sessione, la RPC verifica da sé l'appartenenza ad app_members.
import { supabase } from '@/lib/supabase'
import { clienteSupabase } from './scritturaSupabase'
import { sha256DiFile } from './scrittura'
import { codiceDaMessaggio, type ClienteIdempotente } from './registrazioneIdempotente'

export const clienteIdempotenteSupabase: ClienteIdempotente = {
  // MAI upsert: i byte di un oggetto presente sono immutabili; l'oggetto
  // già esistente al NOSTRO percorso (derivato dal token) è nostro e
  // identico, quindi "esiste già" NON è un errore
  async caricaFile(percorso, file, tipo) {
    const { error } = await supabase.storage.from('scontrini')
      .upload(percorso, file, { contentType: tipo, upsert: false })
    if (!error) return {}
    if (/already exists|duplicate|409/i.test(error.message)) return { esisteGia: true }
    return { errore: error.message }
  },
  rimuoviFile: clienteSupabase.rimuoviFile,
  // l'impronta di ciò che è DAVVERO archiviato: si scarica l'oggetto e lo
  // si ricalcola (le foto sono piccole; è il controllo affidabile richiesto
  // quando un oggetto risulta già presente al nostro percorso)
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
  ricevutaConSha: clienteSupabase.ricevutaConSha,
  ricevutaEsiste: clienteSupabase.ricevutaEsiste,
  async documentoConToken(token) {
    const { data, error } = await supabase.from('family_documents')
      .select('id').eq('upload_token', token).limit(1)
    if (error) return { errore: error.message }
    return data?.length ? { documentId: (data[0] as { id: string }).id } : {}
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
