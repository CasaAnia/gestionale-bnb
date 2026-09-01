# RUNBOOK — applicazione della 0023 in PRODUZIONE

**Stato: PREPARATO IN LOCALE, NESSUN PASSO ESEGUITO.** Stesse cautele
della 0022. DUE autorizzazioni SEPARATE:

- **Autorizzazione A — audit e backup preventivi (SOLA LETTURA).**
  Nessuna scrittura in produzione; serve il token dedicato.
- **Autorizzazione B — applicazione (UNA transazione).** Si chiede SOLO
  dopo che audit e backup sono verdi, con un riepilogo di ciò che è
  stato trovato. A non implica MAI B.

Identità vincolata: la 0023 applicabile è SOLO il file collaudato
(`supabase/proposte/0023_elaborazione_bozze_atomica.BOZZA.sql`, sha256
`298b5d84…` in `identita0023.mjs`, collaudo del 01/09/2026: 2 giri, 56
verifiche verdi). Un byte diverso = STOP: nuova versione, nuovo collaudo.

## Credenziali (mai in chat, log o repository)

- **Token Management API dedicato** in `~/.gestionale-0023/token.txt`
  (procedura solita: appunti → file 600; cancellazione e REVOCA a fine
  giro). Serve per audit, applicazione e verifica post.
- Il backup usa la service key già in `.env.local` (SOLO GET/HEAD,
  guardia nello strumento): nessuna credenziale nuova.
- La chiave dell'archivio cifrato nasce in locale (600, fuori repo) e va
  nel gestore di password.

## FASE A — audit e backup (SOLA LETTURA, autorizzazione A)

1. `CONFERMA_PRODUZIONE=sola-lettura RAPPORTO_AUDIT=<fuori-repo>/audit-generale.json node scripts/fase4/audit-produzione.mjs`
   — l'audit GENERALE già collaudato (policy, RLS, RPC, grant): le
   protezioni 0021/0022 devono risultare INVARIATE.
2. `CONFERMA_PRODUZIONE=sola-lettura RAPPORTO_AUDIT=<fuori-repo>/audit-pre-0023.json node scripts/produzione-0023/audit-pre-0023.mjs`
   — controlli SPECIFICI: bozza = quella collaudata (sha), funzione
   ASSENTE in produzione, fotografia dei conteggi (servirà al post).
3. `node scripts/fase4/backup-pre-0022.mjs "<cartella-backup>"`
   — il raccoglitore già usato per la 0022 (schema attuale, SOLO
   GET/HEAD): tabelle complete, file del bucket con impronte, manifest.
4. `node scripts/produzione-0023/cifra-e-verifica-backup.mjs "<cartella-backup>" "<archivio>.tar.enc"`
   — impacchetta, CIFRA (AES-256-GCM, chiave generata in locale, file
   600) e VERIFICA davvero (decifra e confronta byte per byte).
   Poi: chiave nel gestore di password, archivio+indice su un SECONDO
   supporto. Strumento testato in locale (cifra.test.mjs, controprove
   di corruzione comprese).

STOP della fase A: qualunque verifica fallita, funzione già presente,
sha diverso, backup non verificato → si riferisce e si decide insieme.
La fase A NON dà alcun via all'applicazione.

## FASE B — applicazione (autorizzazione B, esplicita e successiva)

5. Pausa operativa concordata (nessuna elaborazione/caricamento in corso).
6. `CONFERMA_APPLICAZIONE_0023=si node scripts/produzione-0023/applica-0023-produzione.mjs`
   — bersaglio esplicito verificato via Management API (mai il progetto
   di prova), file vincolato allo sha collaudato, UN'UNICA transazione
   con statement/lock timeout, VERIFICHE STRUTTURALI PRE-COMMIT (firma,
   security definer, search_path, EXECUTE al solo service_role: un
   fallimento = rollback totale). Risposta del commit valutata dalla
   logica testata (`rispostaCommit.mjs`): esito incerto → verifica di
   stato in sola lettura, MAI ritentativi alla cieca.
7. `CONFERMA_PRODUZIONE=sola-lettura RAPPORTO_AUDIT=<fuori-repo>/audit-pre-0023.json node scripts/produzione-0023/verifica-post-0023.mjs`
   — struttura giudicata con la STESSA logica testata del collaudo;
   conteggi e documenti per stato IDENTICI all'audit preventivo (la
   0023 non tocca alcun dato). NESSUN test di scrittura in produzione.
8. Chiusura del giro: cancellare `~/.gestionale-0023/token.txt`,
   REVOCARE il token dal dashboard, annotare l'esito nel rapporto.
   In LOCALE (commit separato): promuovere la bozza a
   `supabase/migrations/0023_elaborazione_bozze_atomica.sql` (stesso
   contenuto, via il suffisso BOZZA) e aggiornare i riferimenti.

## ROLLBACK

La 0023 aggiunge SOLO una funzione e non tocca dati:

```sql
drop function public.elabora_sostituisci_bozze(uuid, jsonb, text);
```

riporta la produzione esattamente com'era. Si esegue solo su decisione
esplicita, via canale dedicato, e si riverifica con l'audit. Il backup
cifrato resta la rete di sicurezza per scenari più gravi e INDIPENDENTI
dalla 0023 (i suoi limiti dichiarati sono nel LEGGIMI del backup).

## COSA QUESTO RUNBOOK NON AUTORIZZA

L'ATTIVAZIONE del flusso «solo bozze» (ELABORAZIONE_BOZZE_ATTIVA=1,
runbook RUNBOOK-ELABORAZIONE-BOZZE.md) resta un passaggio SEPARATO con
la sua autorizzazione: applicare la 0023 rende il contratto disponibile,
non accende nulla.
