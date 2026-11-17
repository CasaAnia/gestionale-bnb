-- BOZZA LOCALE: applicare soltanto dopo revisione e backup, prima di pubblicare
-- il gestionale aggiornato e poi il sito. Nessun dato passato viene convertito.
-- Una richiesta può comprendere soltanto determinate notti: NULL = intero
-- intervallo; array ISO ordinato = esattamente quelle notti (max 30 dal sito).
begin;
alter table public.richieste add column if not exists notti_richieste jsonb;

create or replace function public.controlla_notti_richieste() returns trigger
language plpgsql set search_path = '' as $$
declare
  v text;
  precedente text := '';
  g date;
  sol jsonb;
  seg jsonb;
  viste jsonb;
begin
  if new.notti_richieste is null then return new; end if;
  if pg_catalog.jsonb_typeof(new.notti_richieste) <> 'array' then raise exception 'Notti richieste non valide'; end if;
  if pg_catalog.jsonb_array_length(new.notti_richieste) < 1 or pg_catalog.jsonb_array_length(new.notti_richieste) > 30 then raise exception 'Selezionare da 1 a 30 notti'; end if;
  for sol in select * from pg_catalog.jsonb_array_elements(new.notti_richieste) loop
    if pg_catalog.jsonb_typeof(sol) <> 'string' then raise exception 'Notti richieste non valide'; end if;
    v := sol #>> '{}';
    if v !~ '^\d{4}-\d{2}-\d{2}$' or v <= precedente then raise exception 'Notti non ordinate o duplicate'; end if;
    g := v::date;
    if g < new.arrivo or g >= new.partenza then raise exception 'Notte fuori dalle date della richiesta'; end if;
    precedente := v;
  end loop;
  -- Qualsiasi proposta salvata, incluse le alternative, può contenere solo
  -- notti richieste. Anche la RPC esistente, che prenota i segmenti salvati,
  -- rimane protetta: non può essere salvato un segmento che attraversa un buco.
  for sol in select value from pg_catalog.jsonb_array_elements(
    case when new.proposta_soluzione is null then '[]'::jsonb else pg_catalog.jsonb_build_array(new.proposta_soluzione) end
    || coalesce(new.proposta_alternative, '[]'::jsonb)
  ) loop
    viste := '[]'::jsonb;
    for seg in select * from pg_catalog.jsonb_array_elements(coalesce(sol->'segmenti', '[]'::jsonb)) loop
      if (seg->>'arrivo') is null or (seg->>'partenza') is null or (seg->>'partenza')::date <= (seg->>'arrivo')::date then raise exception 'Date del segmento non valide'; end if;
      g := (seg->>'arrivo')::date;
      while g < (seg->>'partenza')::date loop
        v := pg_catalog.to_char(g, 'YYYY-MM-DD');
        if not (new.notti_richieste ? v) then raise exception 'La proposta include una notte non richiesta: %', v; end if;
        if viste ? v then raise exception 'La proposta include due volte la stessa notte: %', v; end if;
        viste := viste || pg_catalog.to_jsonb(v);
        g := g + 1;
      end loop;
    end loop;
  end loop;
  return new;
end;
$$;
drop trigger if exists richieste_controlla_notti on public.richieste;
create trigger richieste_controlla_notti before insert or update on public.richieste
for each row execute function public.controlla_notti_richieste();
revoke all on function public.controlla_notti_richieste() from public;
notify pgrst, 'reload schema';
commit;

-- VERIFICA: colonna jsonb e trigger abilitato. Non crea righe di prova.
select column_name, data_type from information_schema.columns where table_schema = 'public' and table_name = 'richieste' and column_name = 'notti_richieste';
select tgname, tgenabled from pg_catalog.pg_trigger where tgrelid = 'public.richieste'::regclass and tgname = 'richieste_controlla_notti';
