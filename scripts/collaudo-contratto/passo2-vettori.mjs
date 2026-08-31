#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 2: i VETTORI COMUNI. La canonicalizzazione
// del SERVER (private.canonico / private.impronta_canonica) deve
// produrre ESATTAMENTE le forme e le impronte fissate dal client in
// lib/spese/contrattoVettori.ts — è il punto più delicato del contratto
// (numeric vs forma minima dei numeri): qualunque scostamento è STOP.
// Il vettore «manifesto_conferma» verifica anche l'ORDINAMENTO delle
// correzioni fatto dal server (stessa chiave d'ordine del client).
// ============================================================================
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { contatore, vettoriComuni } from './ambiente.mjs'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 2 · vettori comuni client/server')
const lettera = s => s.replaceAll("'", "''")

for (const caso of vettoriComuni()) {
  if (caso.tipo === 'manifesto_conferma') {
    // il server ORDINA le correzioni come il client, poi canonicalizza
    const [r] = await sql(`
      with ordinate as (
        select coalesce(jsonb_agg(c order by
          coalesce(c ->> 'draft_id', ''), coalesce(c ->> 'draft_item_id', ''), coalesce(c ->> 'field', '')), '[]'::jsonb) as corr
        from jsonb_array_elements('${lettera(JSON.stringify(caso.valore.correzioni))}'::jsonb) as c)
      select private.canonico(jsonb_build_object(
        'kind','conferma','document_id','${caso.valore.document_id}',
        'base_rev',${caso.valore.base_rev},'correzioni',(select corr from ordinate))) as canonico,
      private.impronta_canonica(jsonb_build_object(
        'kind','conferma','document_id','${caso.valore.document_id}',
        'base_rev',${caso.valore.base_rev},'correzioni',(select corr from ordinate))) as impronta`)
    v.attesa(`[conferma disordinata] canonico identico`, r.canonico === caso.canonico, r.canonico)
    v.attesa(`[conferma disordinata] impronta identica`, r.impronta === caso.sha256, r.impronta)
    continue
  }
  const [r] = await sql(`select
    private.canonico('${lettera(JSON.stringify(caso.valore))}'::jsonb) as canonico,
    private.impronta_canonica('${lettera(JSON.stringify(caso.valore))}'::jsonb) as impronta`)
  v.attesa(`[${caso.nome}] canonico identico`, r.canonico === caso.canonico, `atteso ${caso.canonico} · avuto ${r.canonico}`)
  v.attesa(`[${caso.nome}] impronta identica`, r.impronta === caso.sha256, r.impronta)
}

await v.chiudi()
