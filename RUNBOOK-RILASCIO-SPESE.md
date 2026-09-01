# RUNBOOK — rilascio del nuovo modulo Spese (guscio direzione B)

**Stato: PREPARATO, PUSH/DEPLOY DA AUTORIZZARE.** Il candidato di
rilascio è la PUNTA FERMA di `rifacimento-spese` indicata nell'ultimo
resoconto di consegna (fusione di `origin/main` inclusa, conflitti
zero, lint del delta sistemato — SpeseTracker compreso — senza cambi
di comportamento; verificatore comune eseguito su `--base origin/main`).

## Cosa pubblica

- `/spese-famiglia` (Casa Mia) e `/spese` (Casa Ania) aprono il NUOVO
  guscio: Panoramica, Movimenti, Documenti (con «Da controllare» e la
  revisione coi dubbi), Analisi. Verificato sul dev server coi DATI
  VERI: la card Caleffi 9,60 € «da controllare · 1 campo dubbio» c'è.
- RITORNO IMMEDIATO: `?vecchia=1` apre il vecchio SpeseTracker,
  identico a oggi (verificato). Il vecchio codice NON viene rimosso.
- Scritture della revisione: interruttore su **legacy**
  (`lib/spese/percorso.ts`) → conferma e scarto passano dalle RPC
  `conferma_documento`/`scarta_documento` della 0020, GIÀ in produzione
  e coperte dall'audit (eseguibili solo dall'utente loggato). Il
  contratto di revisione collaudato NON viene attivato da questo
  rilascio (transizione separata, §6.5 del metodo).
- Le pagine di prova (`/nuove-spese`) restano solo-sviluppo (notFound
  in produzione).

## Prerequisiti (fatti, 01/09/2026)

- Backup fresco cifrato e verificato + seconda copia su Drive
  confrontata byte per byte; chiave nel gestore di password.
- 0023 applicata e verificata; flusso «solo bozze» attivo.
- Verificatore comune VERDE sul candidato; build pulita; tsc pulito.

## Sequenza del rilascio (dopo l'autorizzazione)

1. Albero fermo sul CANDIDATO AUTORIZZATO (l'unico sha indicato nella
   domanda di autorizzazione), verifica comune appena rieseguita.
2. `git checkout main && git merge --ff-only rifacimento-spese`
   (fast-forward: main è già contenuto nel branch).
3. `git push origin main` → Vercel costruisce e pubblica da solo.
4. Attendere il deploy (dashboard Vercel, account GitHub CasaAnia,
   progetto su team «casa-ania»): stato READY.

## Controlli post-rilascio (subito)

1. `/spese-famiglia` dal telefono (390 px): schede nuove visibili,
   card Caleffi in «Da controllare».
2. `/spese-famiglia?vecchia=1`: il vecchio tracker risponde.
3. `/spese` (Casa Ania): guscio nuovo sull'ambito azienda.
4. Ania apre la card Caleffi → rivede il dubbio → CONFERMA dalla
   schermata: nasce la spesa definitiva (222ª). Controllo in sola
   lettura: documento confermato, spese 221→222, righe 728→729,
   bozza confermata con expense_id valorizzato.
5. Una pagina fuori dal modulo spese (es. /statistiche, /prenotazioni)
   per escludere regressioni di build.

## ROLLBACK

- IMMEDIATO senza deploy: usare `?vecchia=1` (il vecchio flusso è
  ancora lì) mentre si decide.
- COMPLETO: dashboard Vercel → deployment precedente → «Promote to
  production» (istantaneo); oppure `git revert` del merge e push.
- I dati non c'entrano col rollback: questo rilascio non cambia
  schema né scritture automatiche.

## Cosa questo rilascio NON fa

Non attiva il contratto di revisione (resta legacy), non rimuove
l'esenzione del service role, non elimina il vecchio tracker, non
tocca la 0023 né i dati. Il documento Caleffi resta in revisione
finché Ania non conferma DALLA SCHERMATA (mai via service role).
