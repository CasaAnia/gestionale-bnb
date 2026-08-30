// ============================================================================
// VERIFICATORE dell'audit permessi (Fase 4) — logica PURA e testata.
// Confronta gli OSSERVATI (righe delle query di metadati) con una MATRICE
// ESPLICITA ricavata dalle migrazioni 0020/0021: identità qualificate,
// ruoli, comandi, modalità e CONDIZIONI delle policy — mai ricerche di
// sottostringhe, mai completezza per solo conteggio. Le policy AGGIUNTIVE
// non vengono dichiarate innocue: sono differenze da analizzare.
// ============================================================================

// canonizzazione delle condizioni: SOLO differenze sintattiche innocue.
// Fuori dalle virgolette: minuscole, niente spazi, via gli alias di
// rendering di pg_policies e i cast ::text. DENTRO stringhe letterali
// ('…', con '' come apice raddoppiato) e identificatori quotati ("…") non
// si tocca NULLA: 'scontrini', 'SCONTRINI' e 's c o n t r i n i' devono
// restare tre valori diversi. Poi UGUAGLIANZA ESATTA.
export function canon(s) {
  const pezzi = String(s ?? '').split(/('(?:[^']|'')*'|"(?:[^"]|"")*")/)
  return pezzi.map((pezzo, i) => i % 2 === 1
    ? pezzo   // letterale o identificatore quotato: INTATTO
    : pezzo.toLowerCase().replace(/\s+/g, '')
        .replace(/asis_app_member/g, '').replace(/asis_app_owner/g, '')
        .replace(/::text/g, ''),
  ).join('')
}

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

// Normalizza una firma nel SOLO elenco dei tipi. Regge sia il formato di
// pg_get_function_identity_arguments — che CONSERVA i nomi degli argomenti
// («p_document_id uuid, p_correzioni jsonb») — sia l'elenco di tipi nudo.
// Per ogni argomento: via IN/OUT/INOUT/VARIADIC, poi se restano più parole
// la PRIMA è il nome dell'argomento e cade; il resto è il tipo.
export function normalizzaFirma(firma) {
  return String(firma ?? '').split(',').map(parte => {
    let parole = parte.trim().split(/\s+/).filter(Boolean)
    while (parole.length && ['in', 'out', 'inout', 'variadic'].includes(parole[0].toLowerCase())) parole = parole.slice(1)
    if (parole.length > 1) parole = parole.slice(1)   // cade il nome dell'argomento
    return parole.join(' ').toLowerCase()
  }).filter(Boolean).join(', ')
}

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
    const modo = String(o.permissive ?? '').toUpperCase()
    if (modo !== 'PERMISSIVE' && modo !== 'RESTRICTIVE')
      problemi.push(`modalità ASSENTE o sconosciuta («${o.permissive ?? ''}»): risultato INCOMPLETO`)
    else if ((modo === 'PERMISSIVE') !== a.permissiva) problemi.push(`modalità ${o.permissive}`)
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
    if (normalizzaFirma(o.firma) !== normalizzaFirma(firma))
      differenze.push(`${nome}: firma osservata (${o.firma}) ≠ attesa (${firma})`)
    if (o.autenticato !== true || o.anonimo !== false || o.service !== false)
      differenze.push(`${nome}: privilegi fuori contratto (auth=${o.autenticato} anon=${o.anonimo} service=${o.service})`)
  }
  for (const o of righe)
    if (!(o.proname in RPC_ATTESE)) differenze.push(`funzione INATTESA nel perimetro: ${o.proname}(${o.firma})`)
  return { ok: differenze.length === 0, differenze, attese: Object.keys(RPC_ATTESE).length }
}


// ---- privilegi EFFETTIVI di tabella: booleani ESPLICITI e completezza -----
// righe: {tabella, privilegio, ruolo, effettivo}; casiAttesi = [{tabella,
// privilegio, ruolo}] — ogni caso deve comparire e valere ESATTAMENTE false
// (true = riaperto; null/assente = INCOMPLETO, mai "tutti negati")
export function verificaEffettiviTabella(righe, casiAttesi) {
  const differenze = []
  const mappa = new Map((righe ?? []).map(r => [`${r.tabella}/${r.privilegio}/${r.ruolo}`, r]))
  for (const c of casiAttesi) {
    const k = `${c.tabella}/${c.privilegio}/${c.ruolo}`
    const r = mappa.get(k)
    if (!r) { differenze.push(`INCOMPLETO: caso ${k} assente`); continue }
    if (r.effettivo === true) differenze.push(`${c.tabella}: ${c.ruolo} può ${c.privilegio} (effettivo)`) 
    else if (r.effettivo !== false) differenze.push(`INCOMPLETO: ${k} senza booleano esplicito (${JSON.stringify(r.effettivo)})`)
  }
  return { ok: differenze.length === 0, differenze }
}

// ---- privilegi EFFETTIVI di COLONNA (has_column_privilege: PUBLIC ed ------
// ereditarietà compresi) contro le autorizzazioni della 0021
export const COLONNE_CONSENTITE = {
  'family_documents/UPDATE': ['doc_total', 'document_date', 'due_date', 'invoice_number', 'kind', 'note', 'supplier'],
  'family_documents/INSERT': ['doc_total', 'document_date', 'due_date', 'invoice_number', 'kind', 'note', 'supplier', 'upload_ambito'],
  'family_draft_expenses/UPDATE': ['arrotondamento_cent', 'canonical_category_id', 'canonical_subcategory_id', 'category_id', 'description', 'expense_date', 'expense_nature', 'group_id', 'payment_method', 'room_id', 'store', 'subcategory'],
  'family_draft_expenses/INSERT': ['arrotondamento_cent', 'canonical_category_id', 'canonical_subcategory_id', 'category_id', 'description', 'document_id', 'expense_date', 'expense_nature', 'group_id', 'payment_method', 'room_id', 'store', 'subcategory'],
  'family_draft_items/UPDATE': ['amount', 'canonical_category_id', 'canonical_subcategory_id', 'category_id', 'discount', 'excluded', 'group_id', 'name', 'necessity', 'planning', 'qty', 'subcategory', 'unit_price'],
  'family_draft_items/INSERT': ['amount', 'canonical_category_id', 'canonical_subcategory_id', 'category_id', 'discount', 'draft_id', 'group_id', 'name', 'necessity', 'planning', 'qty', 'subcategory', 'unit_price'],
  'family_expense_documents/UPDATE': [], 'family_expense_documents/INSERT': [],
  'family_corrections/UPDATE': [], 'family_corrections/INSERT': [],
}
// colonne RISERVATE che DEVONO comparire negate (completezza per identità)
export const COLONNE_RISERVATE_MINIME = {
  family_documents: ['status', 'error_message', 'upload_ambito'],
  family_draft_expenses: ['status', 'expense_id', 'confidence', 'discard_reason'],
  family_draft_items: ['user_added', 'raw_name', 'confidence'],
  family_expense_documents: ['expense_id', 'document_id'],
  family_corrections: ['id'],
}
// NB: upload_ambito è consentita SOLO in INSERT sui documenti — in UPDATE è riservata.

// righe: {tabella, colonna, ruolo, privilegio, effettivo}
export function verificaColonneEffettive(righe) {
  const differenze = []
  const mappa = new Map((righe ?? []).map(r => [`${r.tabella}/${r.colonna}/${r.ruolo}/${r.privilegio}`, r]))
  const controlla = (tabella, colonna, ruolo, privilegio, atteso) => {
    const k = `${tabella}/${colonna}/${ruolo}/${privilegio}`
    const r = mappa.get(k)
    if (!r) { differenze.push(`INCOMPLETO: caso ${k} assente`); return }
    if (typeof r.effettivo !== 'boolean') { differenze.push(`INCOMPLETO: ${k} senza booleano esplicito`); return }
    if (r.effettivo !== atteso)
      differenze.push(atteso
        ? `${tabella}.${colonna}: ${privilegio} CONSENTITO dalla 0021 ma negato a ${ruolo}`
        : `${tabella}.${colonna}: ${privilegio} RIAPERTO per ${ruolo} (PUBLIC/ereditarietà comprese)`)
  }
  for (const [chiave, consentite] of Object.entries(COLONNE_CONSENTITE)) {
    const [tabella, privilegio] = chiave.split('/')
    for (const c of consentite) controlla(tabella, c, 'authenticated', privilegio, true)
    for (const c of COLONNE_RISERVATE_MINIME[tabella] ?? [])
      if (!consentite.includes(c)) controlla(tabella, c, 'authenticated', privilegio, false)
  }
  // anon: MAI scritture, su nessuna colonna osservata o attesa
  for (const r of righe ?? []) {
    if (r.ruolo === 'anon' && ['INSERT', 'UPDATE'].includes(r.privilegio)) {
      if (typeof r.effettivo !== 'boolean') differenze.push(`INCOMPLETO: ${r.tabella}/${r.colonna}/anon/${r.privilegio} senza booleano`)
      else if (r.effettivo) differenze.push(`${r.tabella}.${r.colonna}: ${r.privilegio} APERTO ad anon`)
    }
    // qualunque colonna osservata NON consentita deve risultare negata
    if (r.ruolo === 'authenticated' && ['INSERT', 'UPDATE'].includes(r.privilegio)) {
      const consentite = COLONNE_CONSENTITE[`${r.tabella}/${r.privilegio}`]
      if (consentite && !consentite.includes(r.colonna) && r.effettivo === true)
        differenze.push(`${r.tabella}.${r.colonna}: ${r.privilegio} RIAPERTO per authenticated`)
    }
  }
  return { ok: differenze.length === 0, differenze: [...new Set(differenze)] }
}