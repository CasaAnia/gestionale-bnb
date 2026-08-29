#!/usr/bin/env node
// ============================================================================
// 2C-B · PASSO 2 — verifiche dopo lo 0020, prima del bootstrap.
// a) conteggi attesi (81 documenti derivati, 215 ponte, 221/728/6 invariati);
// b) niente orfani né duplicati; doc_total derivato coerente;
// c) export fresco + confronto col backup 2C-A sui CAMPI STORICI
//    (--campi-del-riferimento: le colonne nuove dello 0020 sono ammesse,
//     i campi storici devono essere identici), file e hash compresi.
// Esce 1 (STOP) alla prima differenza.
// ============================================================================
import { execFileSync } from 'node:child_process'
import { sql } from './api2c.mjs'

const REPO = '/Users/amerigogranata/gestionale-bnb'
const BACKUP_2CA = '/Users/amerigogranata/Desktop/Casa Ania/Backup spese/Backup completo spese pre-2C 2026-08-28'
const EXPORT = process.argv[2]
if (!EXPORT) { console.error('Serve la cartella per l\'export'); process.exit(1) }

let rossi = 0
const esito = (nome, ok, extra = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${nome}${extra ? ' — ' + extra : ''}`)
  if (!ok) rossi++
}

// --- a) conteggi ---
const c = (await sql(`select
  (select count(*) from family_documents) documenti,
  (select count(*) from family_documents where doc_total_derivato) derivati,
  (select count(*) from family_expense_documents where origine='backfill_0020') ponte_backfill,
  (select count(*) from family_expense_documents) ponte_totale,
  (select count(*) from family_expenses where receipt_id is null) senza_doc,
  (select count(*) from family_receipts where document_id is null) ricevute_senza_doc,
  (select count(*) from family_expenses) spese,
  (select count(*) from family_expense_items) righe,
  (select count(*) from family_draft_expenses) bozze,
  (select count(*) from family_corrections) correzioni`))[0]
console.log('conteggi dopo 0020:', JSON.stringify(c))
esito('81 documenti (tutti derivati dal backfill)', c.documenti === 81 && c.derivati === 81)
esito('215 collegamenti ponte, tutti origine=backfill_0020', c.ponte_backfill === 215 && c.ponte_totale === 215)
esito('221 spese e 728 righe invariate', c.spese === 221 && c.righe === 728)
esito('6 spese senza documento', c.senza_doc === 6)
esito('nessuna ricevuta senza documento', c.ricevute_senza_doc === 0)
esito('zero bozze e zero correzioni (nessun dato inventato)', c.bozze === 0 && c.correzioni === 0)

// --- b) orfani e duplicati ---
const o = (await sql(`select
  (select count(*) from family_expense_documents b
     where not exists (select 1 from family_expenses e where e.id=b.expense_id)) ponte_orfano_spesa,
  (select count(*) from family_expense_documents b
     where not exists (select 1 from family_documents d where d.id=b.document_id)) ponte_orfano_doc,
  (select count(*) from (select expense_id, document_id, count(*) n
     from family_expense_documents group by 1,2 having count(*)>1) t) ponte_duplicati,
  (select count(*) from family_receipts r
     where not exists (select 1 from family_documents d where d.id=r.document_id)) ricevuta_orfana,
  (select count(*) from family_documents d
     where not exists (select 1 from family_receipts r where r.document_id=d.id)) doc_senza_file,
  (select count(*) from (select document_id, page_order, count(*) n
     from family_receipts group by 1,2 having count(*)>1) t) pagine_duplicate`))[0]
console.log('integrità:', JSON.stringify(o))
esito('nessun collegamento orfano', o.ponte_orfano_spesa === 0 && o.ponte_orfano_doc === 0)
esito('nessun collegamento duplicato', o.ponte_duplicati === 0)
esito('ogni ricevuta ha il suo documento e viceversa', o.ricevuta_orfana === 0 && o.doc_senza_file === 0)
esito('nessuna pagina duplicata', o.pagine_duplicate === 0)

// --- b2) doc_total derivato = somma delle spese collegate, al centesimo ---
const t = (await sql(`select count(*) n from (
  select d.id, round(d.doc_total*100) tot,
         (select coalesce(sum(round(e.amount*100)),0)
            from family_expense_documents b join family_expenses e on e.id=b.expense_id
           where b.document_id=d.id) somma
    from family_documents d where d.doc_total_derivato
) x where tot <> somma`))[0]
esito('doc_total derivato = somma spese collegate (al centesimo) su tutti gli 81', t.n === 0, `documenti fuori quadratura: ${t.n}`)

if (rossi) { console.error(`PASSO 2 ROSSO: ${rossi} verifiche fallite. STOP (0020 resta applicata, dati storici da ricontrollare).`); process.exit(1) }

// --- c) storici intatti: export + confronto sui campi del riferimento ---
console.log('export fresco post-0020…')
execFileSync('node', [`${REPO}/scripts/fase2c/backup-fresco.mjs`, EXPORT], { stdio: 'inherit' })
console.log('confronto campi storici col backup 2C-A (colonne nuove ammesse)…')
execFileSync('node', [`${REPO}/scripts/verifica-spese.mjs`, '--confronta', BACKUP_2CA, EXPORT, '--campi-del-riferimento'], { stdio: 'inherit' })
console.log('PASSO 2 ✓ — TUTTE le verifiche post-0020 verdi')
