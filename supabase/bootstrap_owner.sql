-- ============================================================================
-- BOOTSTRAP OWNER — script MANUALE, da incollare nell'SQL Editor di Supabase
-- (Fase 2B sul progetto di prova; Fase 2C sul database vero).
--
-- ⚠️  NON ANCORA DA ESEGUIRE. Va eseguito DOPO la 0020 e PRIMA della 0021.
--
-- Cosa fa: inserisce come OWNER l'unico utente registrato in Supabase
-- Authentication. Generico e sicuro per costruzione:
--   - nessuna email o UUID scritti qui dentro;
--   - pretende ESATTAMENTE UN utente in auth.users: con 0 o più di 1
--     si ferma con un errore chiaro (in quel caso l'owner va scelto a mano
--     con cognizione, non da uno script);
--   - idempotente: rieseguirlo non duplica e non degrada il ruolo;
--   - verifica finale: esattamente un owner presente.
-- ============================================================================
do $$
declare
  v_utenti int;
  v_owner int;
  v_user_id uuid;
begin
  select count(*) into v_utenti from auth.users;

  if v_utenti = 0 then
    raise exception 'BOOTSTRAP FALLITO: nessun utente in auth.users. Creare prima l''account dal login del gestionale.';
  elsif v_utenti > 1 then
    raise exception 'BOOTSTRAP FALLITO: % utenti in auth.users, questo script pretende ESATTAMENTE uno. Scegliere l''owner a mano: insert into app_members (user_id, role) values (''<uuid scelto>'', ''owner'');', v_utenti;
  end if;

  select id into v_user_id from auth.users;

  insert into app_members (user_id, role)
  values (v_user_id, 'owner')
  on conflict (user_id) do update set role = 'owner';

  select count(*) into v_owner from app_members where role = 'owner';
  if v_owner <> 1 then
    raise exception 'BOOTSTRAP FALLITO: % owner in app_members, atteso esattamente 1.', v_owner;
  end if;

  raise notice 'Bootstrap riuscito: 1 owner configurato. Ora si può applicare 0021_protezione_family.sql.';
end $$;
