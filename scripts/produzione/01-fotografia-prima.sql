-- ============================================================================
-- PASSO 1 — FOTOGRAFIA PRIMA DELLA 0057 (solo lettura, non scrive niente)
-- Da eseguire nell'editor SQL del progetto VERO (tnsaaoxlcldeltowhvwv).
-- Salva definizioni e permessi attuali delle quattro funzioni, dice se il
-- trigger esiste già e riporta i conteggi di controllo (piano 0057, §3).
-- ============================================================================
select jsonb_pretty(jsonb_build_object(
  'quando', now(),
  'progetto_atteso', 'tnsaaoxlcldeltowhvwv',
  'postgres', current_setting('server_version'),
  'database', current_database(),
  'utente', current_user,
  'conteggi', jsonb_build_object(
    'bookings', (select count(*) from public.bookings),
    'payments', (select count(*) from public.payments),
    'somma_payments', (select coalesce(sum(amount), 0) from public.payments),
    'guests', (select count(*) from public.guests)),
  'trigger_gia_presente', exists (select 1 from pg_trigger where tgname = 'bookings_blocca_soggiorno'),
  'funzioni', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'nome', p.proname,
      'argomenti', pg_get_function_identity_arguments(p.oid),
      'permessi', coalesce(array_to_string(p.proacl, ' | '), '(predefiniti)'),
      'definizione', pg_get_functiondef(p.oid)) order by p.proname, pg_get_function_identity_arguments(p.oid)), '[]'::jsonb)
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('registra_acconto_prenotazione','registra_acconto','segna_pagato_prenotazione','segna_pagato')),
  'permessi_execute', (
    select coalesce(jsonb_agg(jsonb_build_object(
      'funzione', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
      'ruolo', r.rolname,
      'puo_eseguire', has_function_privilege(r.rolname, p.oid, 'execute')) order by p.proname, r.rolname), '[]'::jsonb)
    from pg_proc p
    cross join (select unnest(array['anon','authenticated','service_role']) as rolname) r
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('registra_acconto_prenotazione','registra_acconto','segna_pagato_prenotazione','segna_pagato'))
)) as fotografia_prima_0057;
