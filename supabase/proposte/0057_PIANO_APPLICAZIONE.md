# Proposta 0057 — piano di backup, applicazione, verifica e ripristino

Stato al 20/09/2026 sera: **NON applicata**. Il codice dell'app (commit
locale `29e5898`) la usa se c'è e, se non c'è, richiama la funzione com'è
oggi: si può applicare in qualsiasi momento, senza un rilascio dell'app
insieme. Ogni passo qui sotto va fatto da chi ha l'autorizzazione di Ania;
nessuno è automatico.

## 0. Cosa cambia, in una riga

`registra_acconto_prenotazione` prende due parametri in più, facoltativi
(`p_totale_atteso`, `p_ricevuti_attesi`): se ci sono, dentro il blocco del
soggiorno ricontrolla totale e ricevuto e, se sono diversi, si ferma con
`CONTO_CAMBIATO` senza scrivere. Nessuna tabella cambia, nessun dato viene
toccato: cambia solo una funzione (tolta la firma a 5 parametri, creata
quella a 7). I permessi restano quelli della 0049 (niente anon).

## 1. Prove già fatte (senza toccare il database vero)

| Prova | Dove | Esito |
|---|---|---|
| SQL sequenziale, 7 casi | `lib/contoAttesoSql.test.ts` (PGlite) | verdi |
| Concorrenza vera, 2 connessioni, 8 casi | `scripts/revisioni/collaudo-0057-concorrenza.mjs` su PostgreSQL 16.15 **locale** (cluster usa-e-getta, schema isolato) | 8/8 OK il 20/09/2026 |
| Anteprima senza rete (finto con la stessa regola) | scheda «Ventiquattro Notti», «Cambio camera», «Centesimi Sconto» | conto cambiato → niente scritto, foglio e scheda aggiornati |

Quello che manca, e che decide se si applica: **lo stesso collaudo
concorrente sul PostgreSQL di Supabase** (17.x, non 16): il progetto di
prova `exylddaptetwcjxyqids` usato per la 0049, in uno schema separato.

## 2. Collaudo sul PostgreSQL di Supabase (progetto di PROVA, non quello vero)

Serve l'autorizzazione esplicita di Ania (scrive uno schema nuovo su quel
database, poi lo cancella).

```bash
DATABASE_URL='postgres://…progetto-di-prova…' node scripts/revisioni/collaudo-0057-concorrenza.mjs --consento-remoto
```

Atteso: `8 casi, 8 OK`. Con anche un solo KO la proposta non si applica e
si torna a rivederla. Lo script crea `collaudo_0057_<sigla>` e lo cancella
alla fine (`--tieni` per conservarlo e guardare i dati).

## 3. Backup, prima di applicare (progetto VERO)

1. Backup completo come per la 0049 (Supabase → Database → Backups, oppure
   `pg_dump`): verificarne integrità e conteggi (bookings, payments) e
   tenere una seconda copia.
2. Salvare la definizione attuale della funzione, a parte:
   ```sql
   select pg_get_functiondef('public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date)'::regprocedure);
   ```
   e i permessi:
   ```sql
   select proname, proacl from pg_proc where proname = 'registra_acconto_prenotazione';
   ```
3. Conteggi di controllo da rifare dopo: `select count(*), sum(amount) from payments;`
   e `select count(*) from bookings;`.

## 4. Applicazione (progetto VERO)

Nell'editor SQL di Supabase, in un colpo solo, il contenuto di
`supabase/proposte/0057_conto_atteso_pagamento.BOZZA.sql` (è già in una
transazione: o passa tutto o niente). Poi:

```sql
notify pgrst, 'reload schema';
```

(PostgREST deve rileggere la firma nuova, altrimenti le chiamate con i
sette parametri rispondono PGRST202 e l'app continua a usare il ripiego a
cinque, che però non esiste più dopo il DROP → «Non salvato, riprova»
finché la cache non si aggiorna: di solito pochi secondi.)

Momento: fuori dagli orari in cui Ania registra pagamenti (sera tardi),
con l'app chiusa sul telefono.

## 5. Verifica subito dopo

1. Una firma sola, a sette parametri:
   ```sql
   select pg_get_function_identity_arguments(oid) from pg_proc where proname = 'registra_acconto_prenotazione';
   ```
2. Permessi: `has_function_privilege('anon', 'public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric)', 'execute')` → false; `authenticated` → true.
3. Conteggi identici a prima (`payments`, `bookings`): la 0057 non tocca dati.
4. Dall'app, su una prenotazione **di prova** (non di una cliente vera):
   aprire «Aggiungi pagamento», cambiare il totale da un'altra scheda o
   telefono, salvare → «Il conto è cambiato mentre il foglio era aperto…»,
   nessun movimento nuovo; poi salvare di nuovo → un movimento solo. Nei
   log di PostgREST la chiamata deve avere i sette parametri (niente PGRST202).
5. Togliere il pagamento di prova (o annullare la prenotazione di prova).

## 6. Ripristino, se serve

`supabase/proposte/0057_RIPRISTINO.BOZZA.sql`: rimette la funzione a
cinque parametri identica alla 0049 (corpo copiato dalla migrazione
applicata), stessi permessi, poi `notify pgrst, 'reload schema'`. Nessun
dato da ripristinare: la 0057 non ne scrive. L'app funziona con entrambe le
versioni senza rilascio.

## 7. Cosa NON copre la 0057 (da dire a chi decide)

- «Togli pagamento» è un DELETE diretto senza il blocco consultivo: la 0057
  lo tiene fuori con il blocco sulle righe dei movimenti (collaudato: caso
  5a), ma nel caso limite Postgres annulla una delle due transazioni con
  «stallo» (40P01, caso 5b): niente scritto a metà, l'app dice «riprova».
  Chiuderlo del tutto vuol dire portare «togli» in una funzione col blocco
  (proposta a parte, non urgente).
- Un cambio di totale o un incasso arrivati **dopo** che il pagamento è
  stato registrato sono modifiche successive, legittime: non è compito
  della 0057 impedirle.
- Il wrapper `registra_acconto` (pagine vecchie, prenotazioni senza
  prenotazione_id) non passa le cifre attese: per quelle vale solo la
  rilettura lato app.
