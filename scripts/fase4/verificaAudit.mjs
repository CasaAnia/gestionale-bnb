// ============================================================================
// VERIFICATORE dell'audit permessi (Fase 4) — logica PURA e testata.
// Confronta gli OSSERVATI (righe delle query di metadati) con una MATRICE
// ESPLICITA ricavata dalle migrazioni 0020/0021: identità qualificate,
// ruoli, comandi, modalità e CONDIZIONI delle policy — mai ricerche di
// sottostringhe, mai completezza per solo conteggio. Le policy AGGIUNTIVE
// non vengono dichiarate innocue: sono differenze da analizzare.
// ============================================================================

// canonizzazione delle condizioni: minuscole, niente spazi, via gli alias
// di rendering di pg_policies e i cast ::text — poi UGUAGLIANZA ESATTA
export const canon = (s) => String(s ?? '')
  .toLowerCase()
  .replace(/\s+/g, '')
  .replace(/asis_app_member/g, '').replace(/asis_app_owner/g, '')
  .replace(/::text/g, '')

const MEMBRO = canon("(select private.is_app_member())")
const OWNER = canon("(select private.is_app_owner())")
const STORAGE = canon("((bucket_id = 'scontrini') and (select private.is_app_member()))")
const RUOLI_AUTH = '{authenticated}'

export const TAB_FAMILY = [
  'family_groups', 'family_categories', 'family_subcategories',
  'family_expenses', 'family_expense_items', 'family_receipts',
  'family_budgets', 'family_product_rules',
  'family_canonical_categories', 'family_canonical_subcategories',
  'family_subcategory_map', 'family_documents', 'family_draft_expenses',
  'family_draft_items', 'family_expense_documents', 'family_corrections',
]
// le 18 tabelle attese, per NOME QUALIFICATO (identità, non conteggio)
export const TABELLE_ATTESE = [
  ...TAB_FAMILY.map(t => `public.${t}`), 'public.app_members', 'storage.objects',
]

// le 5 RPC per nome E FIRMA ESATTA (un solo overload ciascuna)
export const RPC_ATTESE = {
  conferma_documento: 'uuid, jsonb',
  approva_fattura_da_pagare: 'uuid, jsonb',
  paga_fattura: 'uuid, date, text, jsonb',
  conferma_fattura_pagata: 'uuid, date, text, jsonb',
  scarta_documento: 'uuid, text',
}

// la MATRICE delle policy attese, dalla 0021 (riga per riga)
export function matricePolicy() {
  const righe = TAB_FAMILY.map(t => ({
    schema: 'public', tabella: t, nome: `${t}_solo_membri`,
    ruoli: RUOLI_AUTH, cmd: 'ALL', permissiva: true, qual: MEMBRO, check: MEMBRO,
  }))
  righe.push(
    { schema: 'public', tabella: 'app_members', nome: 'app_members_lettura_membri',
      ruoli: RUOLI_AUTH, cmd: 'SELECT', permissiva: true, qual: MEMBRO, check: '' },
    { schema: 'public', tabella: 'app_members', nome: 'app_members_gestione_owner',
      ruoli: RUOLI_AUTH, cmd: 'ALL', permissiva: true, qual: OWNER, check: OWNER },
    { schema: 'storage', tabella: 'objects', nome: 'scontrini_membri_select',
      ruoli: RUOLI_AUTH, cmd: 'SELECT', permissiva: true, qual: STORAGE, check: '' },
    { schema: 'storage', tabella: 'objects', nome: 'scontrini_membri_insert',
      ruoli: RUOLI_AUTH, cmd: 'INSERT', permissiva: true, qual: '', check: STORAGE },
    { schema: 'storage', tabella: 'objects', nome: 'scontrini_membri_update',
      ruoli: RUOLI_AUTH, cmd: 'UPDATE', permissiva: true, qual: STORAGE, check: STORAGE },
    { schema: 'storage', tabella: 'objects', nome: 'scontrini_membri_delete',
      ruoli: RUOLI_AUTH, cmd: 'DELETE', permissiva: true, qual: STORAGE, check: '' },
  )
  return righe
}

// ---- verifica delle policy: identità + TUTTI i campi ----------------------
// osservate: righe pg_policies {schemaname, tablename, policyname, roles,
// cmd, permissive, qual, with_check}
export function verificaPolicy(osservate) {
  const differenze = []
  const chiave = (p) => `${p.schema}.${p.tabella}.${p.nome}`
  const mappa = new Map((osservate ?? []).map(o => [
    `${o.schemaname}.${o.tablename}.${o.policyname}`, o,
  ]))
  const attese = matricePolicy()
  for (const a of attese) {
    const o = mappa.get(chiave(a))
    if (!o) { differenze.push(`ASSENTE: ${chiave(a)}`); continue }
    const problemi = []
    if (canon(o.roles) !== canon(a.ruoli)) problemi.push(`ruoli ${o.roles}`)
    if (String(o.cmd).toUpperCase() !== a.cmd) problemi.push(`cmd ${o.cmd}`)
    const perm = String(o.permissive ?? '').toUpperCase() !== 'RESTRICTIVE'
    if (perm !== a.permissiva) problemi.push(`modalità ${o.permissive}`)
    if (canon(o.qual) !== a.qual) problemi.push(`USING [${o.qual}]`)
    if (canon(o.with_check) !== a.check) problemi.push(`WITH CHECK [${o.with_check}]`)
    if (problemi.length) differenze.push(`${chiave(a)}: ${problemi.join(' · ')}`)
    mappa.delete(chiave(a))
  }
  // qualunque policy in più sulle tabelle sorvegliate NON è innocua per
  // definizione: è una differenza da analizzare
  for (const [k, o] of mappa) differenze.push(`AGGIUNTIVA da analizzare: ${k} (ruoli ${o.roles}, cmd ${o.cmd}, USING [${o.qual}], CHECK [${o.with_check}])`)
  return { ok: differenze.length === 0, differenze, attese: attese.length }
}

// ---- completezza per IDENTITÀ: le 18 tabelle qualificate ------------------
// osservate: righe {schema, tabella, rls}
export function verificaTabelleRls(osservate) {
  const differenze = []
  const mappa = new Map((osservate ?? []).map(o => [`${o.schema}.${o.tabella}`, o]))
  for (const nome of TABELLE_ATTESE) {
    const o = mappa.get(nome)
    if (!o) { differenze.push(`ASSENTE: ${nome}`); continue }
    if (o.rls !== true) differenze.push(`${nome}: RLS spenta`)
    mappa.delete(nome)
  }
  for (const [k] of mappa) differenze.push(`tabella INATTESA nel perimetro: ${k} (non compensa nulla: da analizzare)`)
  return { ok: differenze.length === 0, differenze, attese: TABELLE_ATTESE.length }
}

// ---- le 5 RPC per nome e FIRMA esatta -------------------------------------
// osservate: righe {proname, firma, autenticato, anonimo, service}
export function verificaRpc(osservate) {
  const differenze = []
  const righe = osservate ?? []
  for (const [nome, firma] of Object.entries(RPC_ATTESE)) {
    const overload = righe.filter(o => o.proname === nome)
    if (overload.length === 0) { differenze.push(`ASSENTE: ${nome}(${firma})`); continue }
    if (overload.length > 1) { differenze.push(`${nome}: ${overload.length} OVERLOAD (attesa una sola firma)`); continue }
    const o = overload[0]
    if (canon(o.firma) !== canon(firma)) differenze.push(`${nome}: firma osservata (${o.firma}) ≠ attesa (${firma})`)
    if (o.autenticato !== true || o.anonimo !== false || o.service !== false)
      differenze.push(`${nome}: privilegi fuori contratto (auth=${o.autenticato} anon=${o.anonimo} service=${o.service})`)
  }
  for (const o of righe)
    if (!(o.proname in RPC_ATTESE)) differenze.push(`funzione INATTESA nel perimetro: ${o.proname}(${o.firma})`)
  return { ok: differenze.length === 0, differenze, attese: Object.keys(RPC_ATTESE).length }
}
