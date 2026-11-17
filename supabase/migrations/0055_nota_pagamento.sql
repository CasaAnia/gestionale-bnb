-- =====================================================================
-- LA NOTA DI UN PAGAMENTO (16/09/2026) — proposta 0055
--
-- Nel foglio «Aggiungi pagamento» della scheda nuova Ania può scrivere
-- una nota facoltativa («caparra via Nida», «resto in contanti»…).
-- La tabella payments non ha una colonna per tenerla: questa la aggiunge.
--
-- Senza questa proposta il gestionale registra comunque il pagamento e
-- dice che la nota non è stata salvata (lib/pagamentiDati): niente si
-- blocca e niente si perde di nascosto. Le funzioni della 0033
-- (registra_acconto, segna_pagato) non cambiano: la nota si scrive dopo,
-- sulla riga appena nata.
-- =====================================================================

alter table public.payments add column if not exists note text;
