-- 🔴 DA APPLICARE A MANO (serve l'autorizzazione di Ania), dopo il backup.
-- 0062 · «Paga di solito con»: come paga di solito la cliente
-- (ritocchi «Maison» del 29/09/2026, punto D1).
--
-- Ania lo sceglie alla PRIMA prenotazione della cliente, in «Come paga» della
-- Nuova prenotazione: se la cliente non ha ancora un valore, il modo scelto lì
-- si salva su di lei e da lì resta; si cambia solo dal foglio «Dati della
-- cliente». Dove serve un modo di pagamento, la pastiglia già accesa è quella
-- della cliente.
--
-- Solo una colonna nuova, vuota per tutte le clienti che ci sono già: nessun
-- dato cambia. Finché non è applicata il gestionale non la scrive e non la
-- mostra (se ne accorge da solo leggendo la riga: lib/pagamentoAbituale).
begin;
alter table public.guests
  add column if not exists pagamento_abituale text
  constraint guests_pagamento_abituale_valori check (pagamento_abituale is null or pagamento_abituale in ('contanti', 'bonifico'));
comment on column public.guests.pagamento_abituale is
  'Come paga di solito la cliente: contanti o bonifico. Si scrive alla prima prenotazione (Come paga della Nuova prenotazione) e si cambia solo da «Dati della cliente» (29/09/2026).';
commit;

-- Per tornare indietro (solo se serve davvero):
--   alter table public.guests drop column if exists pagamento_abituale;
