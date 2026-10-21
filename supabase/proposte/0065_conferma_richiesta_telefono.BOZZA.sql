-- ============================================================================
-- 0065 — BOZZA, NON APPLICATA (21/10/2026, Claude). Serve il sì di Ania.
--
-- Problema: la RPC conferma_richiesta (0027, poi 0031) cerca la scheda cliente
-- confrontando le SOLE cifre esatte del telefono:
--     regexp_replace(g.phone, '\D', '', 'g') = regexp_replace(r.telefono, '\D', '', 'g')
-- Una richiesta «+39 333 123 4567» (cifre 393331234567) NON ritrova la scheda
-- salvata «3331234567» e ne crea una seconda. Dal 21/10/2026 (rilievo R2 di
-- Codex) il gestionale lo impedisce già dal lato dell'app, senza migrazione:
-- prima della RPC la finestra di conferma (components/richieste/
-- FinestraConferma, decisioneConferma in lib/clienteTelefono) allinea il
-- telefono della richiesta alla forma della scheda, fa scegliere fra più
-- schede e si ferma quando la RPC non saprebbe distinguerle o quando il
-- controllo non riesce. Questa migrazione serve a non dipendere solo
-- dall'app e a togliere il blocco «stesse cifre su più schede»: resta
-- FACOLTATIVA e da autorizzare. I numeri nuovi si salvano «+» e cifre.
--
-- Cosa fa: (1) la funzione public.chiave_telefono, gemella di chiaveTelefono
-- in lib/clienteTelefono.ts (stesse regole, stessi casi null); (2) nella RPC il
-- blocco «Ospite» usa la chiave, e se lo stesso numero è su PIÙ schede si
-- ferma con un errore chiaro invece di sceglierne una a caso.
--
-- PRIMA DI APPLICARE: la definizione in produzione può essere più recente dei
-- file 0027/0031. Leggerla con
--     select pg_get_functiondef('public.conferma_richiesta(uuid, uuid[])'::regprocedure);
-- e sostituire SOLO il blocco «Ospite» con quello qui sotto (passo 2), senza
-- toccare il resto. Backup prima e dopo, come per le altre migrazioni.
-- Nessun dato esistente viene modificato: nessun telefono riscritto.
-- ============================================================================

-- ── 1. La chiave del telefono (stesse regole di lib/clienteTelefono.ts) ─────
create or replace function public.chiave_telefono(p text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  s text;
  c text;
begin
  -- via segni invisibili (WhatsApp), spazi, punti, trattini, parentesi, barre
  s := pg_catalog.regexp_replace(coalesce(p, ''),
         '[­​-‏‪-‮⁠-⁤⁦-⁩﻿[:space:]  .()/-]', '', 'g');
  if s = '' or s ~ '[^0-9+]' or pg_catalog.strpos(pg_catalog.substr(s, 2), '+') > 0 then
    return null;
  end if;
  if s like '+%' then c := pg_catalog.substr(s, 2);
  elsif s like '00%' then c := pg_catalog.substr(s, 3);
  elsif s ~ '^3[0-9]{8,9}$' or s ~ '^0[1-9][0-9]{4,9}$' then c := '39' || s;
  elsif s ~ '^[1-9][0-9]{10,14}$' then c := s;
  else return null;
  end if;
  if c !~ '^[1-9][0-9]{7,14}$' then return null; end if;
  if c like '39%' and c !~ '^39(3[0-9]{8,9}|0[0-9]{5,10})$' then return null; end if;
  return c;
end;
$$;

-- prove rapide (devono dare tutte true):
--   select public.chiave_telefono('+39 333 123 4567') = '393331234567',
--          public.chiave_telefono('3331234567') = '393331234567',
--          public.chiave_telefono('0039 333-123-4567') = '393331234567',
--          public.chiave_telefono('+44 7700 900123') = '447700900123',
--          public.chiave_telefono('333 12') is null;

-- ── 2. Il blocco «Ospite» della RPC (da sostituire nella definizione letta) ─
-- Al posto di:
--   v_tel  := pg_catalog.regexp_replace(coalesce(v_r.telefono, ''), '\D', '', 'g');
--   if v_tel <> '' then
--     select g.id into v_guest from public.guests g
--     where pg_catalog.regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') = v_tel
--     order by g.created_at limit 1;
--   else ...
-- mettere:
--   v_tel  := pg_catalog.regexp_replace(coalesce(v_r.telefono, ''), '\D', '', 'g');
--   if v_tel <> '' then
--     if public.chiave_telefono(v_r.telefono) is not null then
--       if (select count(*) from public.guests g
--           where public.chiave_telefono(g.phone) = public.chiave_telefono(v_r.telefono)) > 1 then
--         raise exception 'Il numero % è su più schede cliente: scegli quella giusta prima di confermare', v_r.telefono;
--       end if;
--       select g.id into v_guest from public.guests g
--       where public.chiave_telefono(g.phone) = public.chiave_telefono(v_r.telefono)
--       limit 1;
--     end if;
--     if v_guest is null then   -- numero non riconoscibile: la regola di prima
--       select g.id into v_guest from public.guests g
--       where pg_catalog.regexp_replace(coalesce(g.phone, ''), '\D', '', 'g') = v_tel
--       order by g.created_at limit 1;
--     end if;
--   else ...
-- e nell'insert del cliente nuovo, col «+» come l'app (21/10/2026 sera, T1):
--   phone = coalesce('+' || public.chiave_telefono(v_r.telefono), v_tel)
-- (a sole cifre «+45 32 12 34 56» diventava «4532123456», non più riconoscibile).
--
-- PERCHÉ RESTA FACOLTATIVA (T1 di Codex): dal candidato del 21/10 sera la
-- finestra di conferma crea PRIMA la scheda del cliente nuovo col «+» e
-- allinea il telefono della richiesta, quindi la RPC trova sempre una scheda
-- per cifre e non arriva mai al proprio INSERT a sole cifre. La migrazione
-- serve solo se la RPC viene chiamata da altri punti (oggi nessuno nel codice:
-- lib/richiesteDati.confermaRichiesta è l'unico chiamante) o per togliere il
-- blocco «stesse cifre su più schede».
