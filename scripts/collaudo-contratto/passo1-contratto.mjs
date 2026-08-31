#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 1: fotografia di BASE (obbligatoria),
// applicazione della bozza del contratto, verifiche di STRUTTURA e
// permessi EFFETTIVI. I cancelli critici usano `esigi`: al primo rosso
// il passo si ferma PRIMA di altri effetti.
// ============================================================================
import { randomUUID } from 'node:crypto'
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { bozzaSql, fotografiaBase, ownerId } from './ambiente.mjs'
import { creaContatore, eseguiPasso } from './strumenti.mjs'
import { nuovoRegistro } from './registro.mjs'

await eseguiPasso('PASSO 1 · struttura del contratto', async () => {
  verificaNonProduzione(progetto().ref)
  const v = creaContatore('PASSO 1 · struttura del contratto')
  const registro = nuovoRegistro()

  // FOTOGRAFIA DI BASE prima di qualunque effetto (il passo 7 la confronta)
  registro.segna('fotografiaBase', await fotografiaBase())
  console.log(`registro: ${registro.file}`)

  // applica la bozza (begin/commit nel file); registrato PRIMA
  registro.segna('contrattoApplicato')
  await sql(bozzaSql('contratto-revisione.BOZZA.sql'))
  console.log('bozza del contratto applicata')

  const [tab] = await sql(`select count(*)::int as n from information_schema.tables
    where table_schema='public' and table_name='family_revision_ops'`)
  v.esigi('giornale presente', tab.n === 1)
  const [col] = await sql(`select count(*)::int as n from information_schema.columns
    where table_schema='public' and table_name='family_documents' and column_name='revisione_rev'`)
  v.esigi('revisione_rev presente', col.n === 1)

  // sonda a giornale: uuid VALIDO generato e REGISTRATO prima; created_by
  // esplicito (come postgres auth.uid() è nullo)
  const sonda = randomUUID()
  registro.sonda(sonda)
  const doc = (await sql(`select id from public.family_documents limit 1`))[0]
  const uid = await ownerId()
  await sql(`insert into public.family_revision_ops (op_key, document_id, kind, base_rev, manifesto_sha256, esito, created_by)
    values ('${sonda}', '${doc.id}', 'salva', 0, 'sonda', '{"rev_dopo":1}', '${uid}')`)
  let immutabile = false
  try { await sql(`update public.family_revision_ops set base_rev=9 where op_key='${sonda}'`) }
  catch (e) { immutabile = String(e.message).includes('GIORNALE_IMMUTABILE') }
  v.attesa('giornale immutabile (update respinto col suo messaggio)', immutabile)
  let indelebile = false
  try { await sql(`delete from public.family_revision_ops where op_key='${sonda}'`) }
  catch (e) { indelebile = String(e.message).includes('GIORNALE_IMMUTABILE') }
  v.attesa('giornale indelebile (delete respinto)', indelebile)

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
    v.attesa(`${nome}: execute SOLO ad authenticated`, p.autenticato === true && p.anon === false && p.service === false, JSON.stringify(p))
  }
  const [g] = await sql(`select
    has_table_privilege('authenticated','public.family_revision_ops','select') as sel,
    has_table_privilege('authenticated','public.family_revision_ops','insert') as ins,
    has_table_privilege('anon','public.family_revision_ops','select') as anon_sel`)
  v.attesa('giornale senza accesso diretto (authenticated/anon)', g.sel === false && g.ins === false && g.anon_sel === false, JSON.stringify(g))
  const [c] = await sql(`select
    has_function_privilege('authenticated','private.canonico(jsonb)','execute') as canonico,
    has_function_privilege('authenticated','private.impronta_canonica(jsonb)','execute') as impronta`)
  v.attesa('private.canonico/impronta negati ad authenticated', c.canonico === false && c.impronta === false)

  v.chiudi()
})
