// Il ClienteIdempotente vero — DA COLLEGARE alle pagine SOLO DOPO
// l'applicazione della migrazione 0022 (la RPC oggi non esiste in
// produzione: chiamarla ora fallirebbe). Nessun service role: chiave anon
// + sessione, la RPC verifica da sé l'appartenenza ad app_members.
import { supabase } from '@/lib/supabase'
import { clienteSupabase } from './scritturaSupabase'
import { codiceDaMessaggio, type ClienteIdempotente } from './registrazioneIdempotente'

export const clienteIdempotenteSupabase: ClienteIdempotente = {
  caricaFile: clienteSupabase.caricaFile,
  rimuoviFile: clienteSupabase.rimuoviFile,
  ricevutaConSha: clienteSupabase.ricevutaConSha,
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
