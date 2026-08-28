#!/usr/bin/env node
// Riporta il progetto di PROVA allo stato vergine: tabelle public, schema
// private, policy storage, bucket e utenti Auth fittizi. Mai la produzione
// (guardia dentro api.mjs).
import { sql, rest, maschera, progetto } from './api.mjs'

console.log('azzero il progetto di prova', maschera(progetto().ref), '…')
await sql(`
do $$ declare r record; begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;
  for r in select p.proname, pg_get_function_identity_arguments(p.oid) args
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' loop
    execute format('drop function if exists public.%I(%s) cascade', r.proname, r.args);
  end loop;
end $$;
drop schema if exists private cascade;
drop policy if exists scontrini_membri_select on storage.objects;
drop policy if exists scontrini_membri_insert on storage.objects;
drop policy if exists scontrini_membri_update on storage.objects;
drop policy if exists scontrini_membri_delete on storage.objects;
drop policy if exists "scontrini_utenti_autenticati" on storage.objects;
`)
// storage: si svuota e si elimina via API (il SQL diretto è vietato dalla piattaforma)
{
  const lista = await rest('/storage/v1/object/list/scontrini', 'service', {
    method: 'POST', body: JSON.stringify({ prefix: '', limit: 1000 }),
  })
  if (lista.ok) {
    const oggetti = await lista.json()
    const percorsi = []
    for (const o of oggetti) {
      if (o.id === null) { // cartella: elenca dentro
        const dentro = await (await rest('/storage/v1/object/list/scontrini', 'service', {
          method: 'POST', body: JSON.stringify({ prefix: o.name, limit: 1000 }),
        })).json()
        for (const f of dentro) percorsi.push(o.name + '/' + f.name)
      } else percorsi.push(o.name)
    }
    if (percorsi.length)
      await rest('/storage/v1/object/scontrini', 'service', { method: 'DELETE', body: JSON.stringify({ prefixes: percorsi }) })
    await rest('/storage/v1/bucket/scontrini/empty', 'service', { method: 'POST', body: '{}' })
    await rest('/storage/v1/bucket/scontrini', 'service', { method: 'DELETE' })
    console.log('bucket scontrini svuotato ed eliminato (' + percorsi.length + ' file)')
  } else {
    console.log('bucket scontrini assente: niente da svuotare')
  }
}
// utenti Auth fittizi
const r = await rest('/auth/v1/admin/users?per_page=100', 'service')
const utenti = (await r.json()).users || []
for (const u of utenti) {
  await rest('/auth/v1/admin/users/' + u.id, 'service', { method: 'DELETE' })
}
console.log('azzerato: tabelle, schema private, bucket e', utenti.length, 'utenti fittizi rimossi')
