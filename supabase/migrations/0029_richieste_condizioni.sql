-- ============================================================================
-- 0029 — RICHIESTE: CONDIZIONI DI PAGAMENTO DELLA PROPOSTA (pezzo 6, 02/09/2026)
-- ============================================================================
-- Da eseguire nell'editor SQL di Supabase sul progetto di PRODUZIONE
-- (tnsaa…vwv): controllare il progetto PRIMA del Run, poi la select in fondo.
--
-- Quando Ania conferma «Sì, inviata» in /richieste/<id>/proposta, insieme a
-- proposta_testo e proposta_soluzione (0025) si salvano:
-- · condizione_pagamento: arrivo | caparra | completo | personalizzata
--   (NULL nel caso «completo», dove non c'è scelta; NULL anche nelle proposte
--   inviate prima di questa migrazione);
-- · caparra_centesimi: importo della caparra in CENTESIMI, solo per «caparra»;
-- · condizione_testo: paragrafo scritto a mano da Ania, solo per «personalizzata»;
-- · amelia_alternativa: se nel messaggio c'era il blocco dell'alternativa ad Amelia.
-- Se le colonne mancano la schermata avvisa e NON salva (come per la 0025).

alter table public.richieste add column if not exists condizione_pagamento text;
alter table public.richieste add column if not exists caparra_centesimi integer;
alter table public.richieste add column if not exists condizione_testo text;
alter table public.richieste add column if not exists amelia_alternativa boolean not null default false;

alter table public.richieste drop constraint if exists richieste_condizione_pagamento_check;
alter table public.richieste add constraint richieste_condizione_pagamento_check
  check (condizione_pagamento is null or condizione_pagamento in ('arrivo', 'caparra', 'completo', 'personalizzata'));

alter table public.richieste drop constraint if exists richieste_caparra_centesimi_check;
alter table public.richieste add constraint richieste_caparra_centesimi_check
  check (caparra_centesimi is null or caparra_centesimi > 0);

notify pgrst, 'reload schema';

-- Verifica: devono comparire tutte e quattro le colonne.
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'richieste'
  and column_name in ('condizione_pagamento', 'caparra_centesimi', 'condizione_testo', 'amelia_alternativa')
order by column_name;
