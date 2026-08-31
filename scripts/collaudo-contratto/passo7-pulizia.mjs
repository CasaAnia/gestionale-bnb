#!/usr/bin/env node
// ============================================================================
// Collaudo contratto — PASSO 7: PULIZIA per IDENTIFICATIVI ESATTI dal
// registro durevole (mai per nome). La fotografia di base scattata al
// passo 1 è OBBLIGATORIA e viene CONFRONTATA con quella finale: se non
// coincidono la pulizia NON è verde. Il giornale si smonta col DROP
// della tabella (niente DELETE contro GIORNALE_IMMUTABILE); le spese e
// il ponte si eliminano solo per i docIds registrati. In caso di
// interruzione: RILANCIARE questo passo — riparte dall'istruzione
// registrata in puliziaArrivataA (piano idempotente). L'azzeramento
// della 2B NON è un ripiego ordinario: solo su autorizzazione esplicita
// se il registro risultasse perso o corrotto.
// ============================================================================
import { sql, progetto } from '../fase2b/api.mjs'
import { verificaNonProduzione } from '../fase2b/guardia.mjs'
import { LEGACY, fotografiaBase } from './ambiente.mjs'
import { creaContatore, eseguiPasso, pianoPulizia, eseguiPiano, confrontaFotografie, validaFotografia } from './strumenti.mjs'
import { apriUltimoRegistro } from './registro.mjs'

await eseguiPasso('PASSO 7 · pulizia verificata', async () => {
  verificaNonProduzione(progetto().ref)
  const v = creaContatore('PASSO 7 · pulizia verificata')
  const registro = apriUltimoRegistro()
  if (!registro) throw new Error('nessun registro in REGISTRO_DIR: senza gli identificativi la pulizia non parte')
  // la fotografia si VALIDA (struttura e completezza) PRIMA di qualunque
  // effetto: una fotografia vuota non deve far partire i DROP
  validaFotografia(registro.dati.fotografiaBase)

  // ---- 1) transizione: smontaggio con l'ORDINE corretto ---------------------
  // (a) originali ripristinati dal backup; (b) RI-GRANT di 0021 e degli
  // execute legacy PRIMA di toccare backup e copie private (se ci si
  // interrompe qui, il backup c'è ancora e il passo si rilancia);
  // (c) verifica; (d) via le copie private; (e) il backup per ULTIMO.
  const [backup] = await sql(`select count(*)::int as n from information_schema.tables
    where table_schema='private' and table_name='transizione_backup'`)
  if (backup.n === 1) {
    await sql(`do $$ declare r record; begin
      for r in select nome, definizione from private.transizione_backup loop execute r.definizione; end loop; end $$;`)
    await sql(`grant update (expense_date, group_id, category_id, subcategory, canonical_category_id,
        canonical_subcategory_id, store, description, payment_method, room_id, expense_nature, arrotondamento_cent)
      on public.family_draft_expenses to authenticated;
      grant insert (document_id, expense_date, group_id, category_id, subcategory, canonical_category_id,
        canonical_subcategory_id, store, description, payment_method, room_id, expense_nature, arrotondamento_cent)
      on public.family_draft_expenses to authenticated;
      grant update (name, qty, unit_price, discount, amount, group_id, category_id, subcategory,
        canonical_category_id, canonical_subcategory_id, necessity, planning, excluded)
      on public.family_draft_items to authenticated;
      grant insert (draft_id, name, qty, unit_price, discount, amount, group_id, category_id, subcategory,
        canonical_category_id, canonical_subcategory_id, necessity, planning)
      on public.family_draft_items to authenticated;
      grant update (kind, doc_total, supplier, invoice_number, document_date, due_date, note)
      on public.family_documents to authenticated;`)
    for (const n of LEGACY) {
      await sql(`do $$ declare f text; begin
        select pg_get_function_identity_arguments(p.oid) into f from pg_proc p
          join pg_namespace ns on ns.oid=p.pronamespace where ns.nspname='public' and p.proname='${n}';
        execute format('grant execute on function public.${n}(%s) to authenticated', f); end $$;`)
    }
    for (const n of LEGACY) {
      const [pr] = await sql(`select has_function_privilege('authenticated',
        (select p.oid from pg_proc p join pg_namespace ns on ns.oid=p.pronamespace
         where ns.nspname='public' and p.proname='${n}'), 'execute') as e`)
      v.esigi(`legacy ripristinata ed eseguibile: ${n}`, pr.e === true)
    }
    await sql(`do $$ declare r record; begin
      for r in select p.proname as nome, pg_get_function_identity_arguments(p.oid) as f
        from pg_proc p join pg_namespace n on n.oid=p.pronamespace
        where n.nspname='private' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})
      loop execute format('drop function private.%I(%s)', r.nome, r.f); end loop; end $$;`)
    await sql(`drop table private.transizione_backup;`)
    v.attesa('transizione smontata (grant rimessi PRIMA, backup eliminato per ULTIMO)', true)
  } else {
    v.attesa('nessun resto di transizione da smontare', registro.dati.transizioneApplicata !== true
      || backup.n === 0, 'transizione segnata applicata ma senza backup: verificare a mano')
  }

  // ---- 2) expenseIds CONSERVATI prima di eliminare i riferimenti -----------
  // le spese confermate si raggiungono solo via ponte/bozze: gli id si
  // salvano DUREVOLMENTE nel registro PRIMA delle eliminazioni; a una
  // ripresa si riusano quelli salvati (i riferimenti potrebbero non
  // esserci più)
  const doc = registro.dati.docIds.map(id => `'${id}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`
  if (!Array.isArray(registro.dati.expenseIds)) {
    const trovate = await sql(`select distinct expense_id as id from (
        select expense_id from public.family_expense_documents where document_id in (${doc})
        union all
        select expense_id from public.family_draft_expenses where document_id in (${doc})
      ) x where expense_id is not null`)
    registro.segna('expenseIds', trovate.map(r => r.id))
  }

  // ---- 3) il PIANO per identificativi esatti, con progresso durevole -------
  const piano = pianoPulizia({ docIds: registro.dati.docIds, expenseIds: registro.dati.expenseIds })
  const da = (registro.dati.puliziaArrivataA ?? -1) + 1
  if (da > 0) console.log(`  ripresa della pulizia interrotta: dall'istruzione ${da} di ${piano.length}`)
  await eseguiPiano(sql, piano.slice(da), i => registro.segna('puliziaArrivataA', da + i))
  v.attesa(`piano di pulizia completato (${piano.length} istruzioni, solo id registrati)`, registro.dati.puliziaArrivataA === piano.length - 1)

  // ---- 4) FOTOGRAFIA finale ≡ fotografia di base ----------------------------
  const fine = await fotografiaBase()
  const confronto = confrontaFotografie(registro.dati.fotografiaBase, fine)
  v.esigi('fotografia finale IDENTICA alla base (impronte dei dati, legacy, privilegi esatti, EXECUTE)',
    confronto.uguali, confronto.differenze.join(' · '))

  // ---- 5) residui espliciti -------------------------------------------------
  const spesa = registro.dati.expenseIds.map(id => `'${id}'`).join(',') || `'00000000-0000-0000-0000-000000000000'`
  const [residui] = await sql(`select
    (select count(*)::int from information_schema.tables where table_name='family_revision_ops') as giornale,
    (select count(*)::int from information_schema.columns where table_name='family_documents' and column_name='revisione_rev') as rev,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='public' and p.proname like '%_revisione') as funzioni,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='private' and p.proname='proteggi_giornale_revisione') as trigger_fn,
    (select count(*)::int from public.family_documents where id in (${doc})) as fixture,
    (select count(*)::int from public.family_expenses where id in (${spesa})) as spese,
    (select count(*)::int from public.family_expense_items where expense_id in (${spesa})) as voci,
    (select count(*)::int from public.family_corrections where document_id in (${doc}) or expense_id in (${spesa})) as correzioni,
    (select count(*)::int from pg_proc p join pg_namespace n on n.oid=p.pronamespace
       where n.nspname='private' and p.proname in (${LEGACY.map(x => `'${x}'`).join(',')})) as private_,
    (select count(*)::int from information_schema.tables
       where table_schema='private' and table_name='transizione_backup') as backup`)
  v.attesa('nessun residuo del contratto né della transizione (funzione del trigger compresa)',
    residui.giornale === 0 && residui.rev === 0 && residui.funzioni === 0
    && residui.trigger_fn === 0 && residui.private_ === 0 && residui.backup === 0, JSON.stringify(residui))
  v.attesa('nessun artefatto registrato è rimasto (documenti, spese, righe definitive, correzioni)',
    residui.fixture === 0 && residui.spese === 0 && residui.voci === 0 && residui.correzioni === 0, JSON.stringify(residui))

  // «pulito» SOLO dopo che TUTTE le verifiche sono positive: chiudi()
  // lancia su qualunque rosso e la marcatura non viene mai raggiunta
  v.chiudi()
  registro.segna('pulito')
  console.log(`  registro chiuso: ${registro.file}`)
})
