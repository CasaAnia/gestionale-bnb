-- ============================================================================
-- LEGGI IL CATALOGO DEL DATABASE (17/11/2026) — SOLO LETTURA, una SELECT sola.
-- ============================================================================
-- Cosa fa: restituisce UN solo JSON con vincoli, indici, policy RLS, trigger e
-- funzioni dello schema `public`. Non scrive e non cambia niente.
-- Come si usa: si incolla nell'editor SQL di Supabase, si esegue, si copia il
-- risultato in un file (per esempio catalogo-produzione.json) e si lancia
--   DATABASE_URL=postgres://postgres@127.0.0.1:5433/postgres \
--   node scripts/schema/confronta-schema.mjs openapi.json --catalogo catalogo-produzione.json
-- che lo confronta con quello di un database costruito dalle sole migrazioni.
-- Di ogni funzione si porta anche l'impronta (md5) del corpo, non il corpo.
-- ============================================================================
select jsonb_build_object(
  'vincoli', (select coalesce(jsonb_agg(jsonb_build_object('tabella', c.conrelid::regclass::text, 'nome', c.conname, 'tipo', c.contype::text, 'definizione', pg_get_constraintdef(c.oid)) order by c.conrelid::regclass::text, c.conname), '[]'::jsonb)
              from pg_constraint c where c.connamespace = 'public'::regnamespace),
  'indici', (select coalesce(jsonb_agg(jsonb_build_object('tabella', i.tablename, 'nome', i.indexname, 'definizione', i.indexdef) order by i.tablename, i.indexname), '[]'::jsonb)
             from pg_indexes i where i.schemaname = 'public'),
  'rls', (select coalesce(jsonb_agg(jsonb_build_object('tabella', r.relname, 'attiva', r.relrowsecurity, 'forzata', r.relforcerowsecurity) order by r.relname), '[]'::jsonb)
          from pg_class r where r.relnamespace = 'public'::regnamespace and r.relkind = 'r'),
  'policy', (select coalesce(jsonb_agg(jsonb_build_object('tabella', p.tablename, 'nome', p.policyname, 'comando', p.cmd, 'ruoli', p.roles::text, 'using', p.qual, 'with_check', p.with_check) order by p.tablename, p.policyname), '[]'::jsonb)
             from pg_policies p where p.schemaname = 'public'),
  'trigger', (select coalesce(jsonb_agg(jsonb_build_object('tabella', t.tgrelid::regclass::text, 'nome', t.tgname, 'definizione', pg_get_triggerdef(t.oid)) order by t.tgrelid::regclass::text, t.tgname), '[]'::jsonb)
              from pg_trigger t where not t.tgisinternal and t.tgrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace)),
  'funzioni', (select coalesce(jsonb_agg(jsonb_build_object('nome', f.proname, 'argomenti', pg_get_function_identity_arguments(f.oid), 'ritorno', f.prorettype::regtype::text, 'security_definer', f.prosecdef, 'impronta', md5(f.prosrc)) order by f.proname, pg_get_function_identity_arguments(f.oid)), '[]'::jsonb)
               from pg_proc f where f.pronamespace = 'public'::regnamespace and f.prokind = 'f'
                 and not exists (select 1 from pg_depend d where d.objid = f.oid and d.deptype = 'e')),
  'estensioni', (select coalesce(jsonb_agg(e.extname order by e.extname), '[]'::jsonb) from pg_extension e)
) as catalogo;
