#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 1: applica la bozza del contratto al
// progetto di prova e verifica la STRUTTURA (tabella, trigger, colonna,
// funzioni, permessi effettivi). Prerequisiti: passo0 della fase 4
// (riaggancio + guardia) e base 0020–0022 applicata (esegui-sequenza).
// STOP alla prima verifica fallita.
// ============================================================================
import { sql } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { progetto } from '../fase2b/api.mjs'
import { bozzaSql, contatore } from './ambiente.mjs'

verificaNonProduzione(progetto().ref)
const v = contatore('PASSO 1 · struttura del contratto')

// 1) applica la bozza (una transazione: begin/commit sono nel file)
await sql(bozzaSql('contratto-revisione.BOZZA.sql'))
console.log('bozza del contratto applicata')

// 2) tabella del giornale + colonna di versione
const [tab] = await sql(`select count(*)::int as n from information_schema.tables
  where table_schema='public' and table_name='family_revision_ops'`)
v.attesa('giornale presente', tab.n === 1)
const [col] = await sql(`select count(*)::int as n from information_schema.columns
  where table_schema='public' and table_name='family_documents' and column_name='revisione_rev'`)
v.attesa('revisione_rev presente', col.n === 1)

// 3) giornale APPEND-ONLY anche per postgres/service_role (trigger)
const doc = (await sql(`select id from public.family_documents limit 1`))[0]
await sql(`insert into public.family_revision_ops (op_key, document_id, kind, base_rev, manifesto_sha256, esito)
  values ('00000000-0000-0000-0000-00000000c0l1', '${doc.id}', 'salva', 0, 'x', '{"rev_dopo":1}')`)
let immutabile = false
try { await sql(`update public.family_revision_ops set base_rev=9 where op_key='00000000-0000-0000-0000-00000000c0l1'`) }
catch (e) { immutabile = String(e.message).includes('GIORNALE_IMMUTABILE') }
v.attesa('giornale immutabile (update respinto col suo messaggio)', immutabile)
let indelebile = false
try { await sql(`delete from public.family_revision_ops where op_key='00000000-0000-0000-0000-00000000c0l1'`) }
catch (e) { indelebile = String(e.message).includes('GIORNALE_IMMUTABILE') }
v.attesa('giornale indelebile (delete respinto)', indelebile)

// 4) permessi EFFETTIVI sulle quattro funzioni (matrice, non fiducia)
const funzioni = [
  ['salva_revisione', 'uuid, uuid, bigint, jsonb'],
  ['esito_revisione', 'uuid'],
  ['conferma_revisione', 'uuid, uuid, bigint, jsonb'],
  ['scarta_revisione', 'uuid, uuid, bigint, text'],
]
for (const [nome, firma] of funzioni) {
  const [p] = await sql(`select
    has_function_privilege('authenticated','public.${nome}(${firma})','execute') as autenticato,
    has_function_privilege('anon','public.${nome}(${firma})','execute') as anon,
    has_function_privilege('service_role','public.${nome}(${firma})','execute') as service`)
  v.attesa(`${nome}: execute SOLO ad authenticated`, p.autenticato === true && p.anon === false && p.service === false,
    JSON.stringify(p))
}

// 5) giornale NON accessibile direttamente dal browser
const [g] = await sql(`select
  has_table_privilege('authenticated','public.family_revision_ops','select') as sel,
  has_table_privilege('authenticated','public.family_revision_ops','insert') as ins,
  has_table_privilege('anon','public.family_revision_ops','select') as anon_sel`)
v.attesa('giornale senza accesso diretto (authenticated/anon)', g.sel === false && g.ins === false && g.anon_sel === false, JSON.stringify(g))

// 6) canonico/impronta non eseguibili dal browser
const [c] = await sql(`select
  has_function_privilege('authenticated','private.canonico(jsonb)','execute') as canonico,
  has_function_privilege('authenticated','private.impronta_canonica(jsonb)','execute') as impronta`)
v.attesa('private.canonico/impronta negati ad authenticated', c.canonico === false && c.impronta === false)

await v.chiudi()
