# RAPPORTO — applicazione della 0023 in PRODUZIONE (01/09/2026)

**ESITO: APPLICATA E VERIFICATA.** Produzione tnsa**** («Gestionale
Casa Ania Rozzano»), due autorizzazioni esplicite e separate dell'utente
nella conversazione del 01/09/2026 (Fase A: audit+backup; Fase B:
applicazione). Nessun segreto in chat, log o repository.

## Fase A — audit e backup (sola lettura)

- Audit GENERALE (strumento collaudato della 0022): protezioni 0021
  INVARIATE — RLS 18/18, policy 22/22, 5 RPC legacy a contratto.
  Unica differenza: la sezione 7 attende ancora «0022 assente», ma la
  firma osservata (2 colonne, 1 RPC, 1 trigger, 1 indice) è esattamente
  quella della 0022 applicata e autorizzata il 30/08; privilegi della
  RPC 0022 ricontrollati a parte: a contratto. Nessuna anomalia reale.
  NOTA per il prossimo giro: aggiungere allo strumento la modalità
  post-0022 (attesa invertita della sezione 7).
- Audit PRE-0023: bozza identica a quella collaudata (sha `298b5d84…`),
  vincoli R6 rispettati, funzione ASSENTE; fotografia: 81 documenti
  (tutti confermati), 0 bozze, 221 spese, 728 righe.
- BACKUP fresco (stesso raccoglitore 0022, SOLO GET/HEAD): 18 tabelle,
  81 foto con impronte SHA-256, stabilità su 5 riscaricamenti; conteggi
  identici all'audit. CIFRATO (AES-256-GCM) in un archivio da 227 MB /
  120 file e VERIFICATO decifrando e confrontando byte per byte.
  Chiave in file 600 (da conservare nel gestore di password); seconda
  copia su altro supporto raccomandata all'utente.

## Fase B — applicazione e verifica

- `applica-0023-produzione.mjs`: identità del file vincolata allo sha
  collaudato, bersaglio esplicito verificato via Management API, UNA
  transazione (statement_timeout 60s, lock_timeout 10s) con VERIFICHE
  STRUTTURALI PRE-COMMIT; risposta del commit: APPLICATA
  (2026-09-01 10:57:46 UTC).
- `verifica-post-0023.mjs` (sola lettura): struttura conforme (firma,
  security definer, search_path, EXECUTE al solo service_role) e DATI
  INTATTI: conteggi e documenti per stato identici all'audit preventivo.

## Credenziali e residui

- Token Management API temporaneo: file 600, CANCELLATO a fine giro
  (entrambe le copie: audit e 0023). **REVOCA dal dashboard da fare.**
- Rapporti degli audit fuori repo (`~/.gestionale-0023/rapporti/`).
- Il file SQL resta per ora in `supabase/proposte/` col suffisso BOZZA:
  la promozione fra le migrazioni operative va concordata col revisore
  (una sua riproduzione vincola l'attuale posizione) — solo rinomina
  documentale, nessun effetto sul database.

## Cosa resta NON attivato

Lo strumento `scripts/elabora/elabora-bozze.mjs` resta chiuso dal suo
cancello: l'ATTIVAZIONE del flusso «solo bozze» (runbook
RUNBOOK-ELABORAZIONE-BOZZE.md, aggiornamento della memoria
dell'assistente compreso) è un passaggio separato con la sua
autorizzazione esplicita.
