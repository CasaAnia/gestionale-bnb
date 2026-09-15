-- =====================================================================
-- «COME PAGA» IN UN COLPO SOLO (15/09/2026) — proposta 0052
--
-- IL PROBLEMA. Salvare «come paga» sono due scritture: il modo su tutte
-- le camere della prenotazione, e la caparra sulla sola riga che arriva
-- per prima. La prima scrittura azzera la caparra vecchia (il database
-- vuole che caparra e modo restino coerenti). Se la seconda non arriva
-- — rete caduta, sessione scaduta — l'interfaccia dice «non salvato» ma
-- la caparra di prima è già sparita: 160 € diventati niente, e nessuno
-- se ne accorge finché non si riapre la scheda.
--
-- LA SOLUZIONE. Una funzione che fa tutto dentro UNA transazione: o
-- passa tutta, o non cambia niente. Torna anche quante righe ha toccato,
-- così chi chiama può accorgersi se la prenotazione non c'è più o se il
-- permesso non basta.
--
-- Il vincolo della 0041 su accordo_pagamento resta valido: qui non si
-- scrive niente che quello non accetti.
-- =====================================================================

create or replace function public.salva_come_paga(
  p_righe uuid[],                 -- tutte le camere della prenotazione
  p_prima uuid,                   -- la riga che arriva per prima: porta la caparra
  p_accordo text,
  p_bonifico boolean,
  p_caparra_centesimi integer,
  p_caparra_entro timestamptz
) returns integer                 -- quante righe sono state aggiornate
language plpgsql
security invoker                  -- i permessi restano quelli di chi chiama (RLS)
as $$
declare
  toccate integer;
  prima_toccata integer;
begin
  if p_righe is null or array_length(p_righe, 1) is null then
    raise exception 'nessuna riga da aggiornare';
  end if;
  if not (p_prima = any(p_righe)) then
    raise exception 'la riga della caparra non è fra le camere della prenotazione';
  end if;

  -- 1. il modo su tutte le camere; la caparra si azzera qui e si rimette
  --    subito dopo sulla prima riga: dentro la transazione non si vede mai
  --    lo stato intermedio
  update public.bookings
     set accordo_pagamento = p_accordo,
         bonifico = p_bonifico,
         caparra_centesimi = null,
         caparra_entro = null
   where id = any(p_righe);
  get diagnostics toccate = row_count;

  if toccate <> array_length(p_righe, 1) then
    raise exception 'aggiornate % righe su %: la prenotazione è cambiata, riprova',
      toccate, array_length(p_righe, 1);
  end if;

  -- 2. la caparra, una volta sola, sulla riga che arriva per prima
  if p_caparra_centesimi is not null or p_caparra_entro is not null then
    update public.bookings
       set caparra_centesimi = p_caparra_centesimi,
           caparra_entro = p_caparra_entro
     where id = p_prima;
    get diagnostics prima_toccata = row_count;
    if prima_toccata <> 1 then
      raise exception 'la riga della caparra non è stata aggiornata';
    end if;
  end if;

  return toccate;
end;
$$;

comment on function public.salva_come_paga is
  'Salva «come paga» su tutte le camere di una prenotazione in una sola transazione: o tutto, o niente. Torna quante righe ha aggiornato.';

revoke all on function public.salva_come_paga(uuid[], uuid, text, boolean, integer, timestamptz) from public;
grant execute on function public.salva_come_paga(uuid[], uuid, text, boolean, integer, timestamptz) to authenticated;

-- PROVA DI CONCORRENZA, da fare su un progetto di prova (non in produzione):
-- due sessioni psql aperte insieme.
--
--   sessione A            sessione B
--   ----------            ----------
--   begin;
--   select public.salva_come_paga(...);      -- prende i lock sulle righe
--                          select public.salva_come_paga(...);  -- resta in attesa
--   rollback;                                -- A annulla tutto
--                          -- B va avanti e scrive: nessuno stato a metà
--
-- E la prova del guasto: dentro la funzione, fra i due update, si può
-- lanciare a mano `raise exception` per verificare che la caparra vecchia
-- resti al suo posto.
--
-- PER TORNARE INDIETRO:
--   drop function if exists public.salva_come_paga(uuid[], uuid, text, boolean, integer, timestamptz);
