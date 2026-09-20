# Proposta 0057 — piano di backup, applicazione, verifica e ripristino

Stato al 20/09/2026 sera: **NON applicata**. Il codice dell'app (commit
locale `29e5898`) la usa se c'è e, se non c'è, richiama la funzione com'è
oggi: si può applicare in qualsiasi momento, senza un rilascio dell'app
insieme. Ogni passo qui sotto va fatto da chi ha l'autorizzazione di Ania;
nessuno è automatico.

## 0. Cosa cambia (rivisto il 20/09/2026 notte)

Quattro funzioni e un trigger, nessuna tabella e nessun dato toccato:

- `registra_acconto_prenotazione` e il wrapper `registra_acconto` (prenotazioni
  senza prenotazione_id: singole o legate da group_id) prendono due parametri
  in più, facoltativi (`p_totale_atteso`, `p_ricevuti_attesi`): se ci sono,
  dentro il blocco del soggiorno (e bloccando anche le righe dei movimenti)
  ricontrollano totale e ricevuto e, se diversi, si fermano con
  `CONTO_CAMBIATO` senza scrivere;
- `segna_pagato_prenotazione` e il wrapper `segna_pagato` prendono
  `p_mancante_atteso` (l'app passa 0: chiama il bollino solo a conto coperto):
  con un mancante diverso — una camera aggiunta nel frattempo — si fermano
  con `CONTO_CAMBIATO` invece di SCRIVERE il mancante come incasso (difetto
  reale della 0049, riprodotto nel collaudo: 160 € inventati);
- tutte e quattro rileggono l'identità del soggiorno sotto lock (Aggiungi
  camera su una prenotazione vecchia la cambia da group_id a
  prenotazione_id) e riconoscono una chiave già usata anche se il movimento
  porta l'identità vecchia;
- un trigger BEFORE INSERT su `bookings` prende il lock consultivo del
  soggiorno della riga nuova: una camera in arrivo aspetta il pagamento in
  corso e viceversa.

Le firme vecchie vengono tolte e ricreate coi parametri in più (default
null): le chiamate di oggi (5/4 argomenti, anche con nome come fa PostgREST)
funzionano uguali. Permessi come nella 0049 (niente anon).

## 1. Prove già fatte (senza toccare il database vero)

| Prova | Dove | Esito |
|---|---|---|
| SQL sequenziale, 11 casi | `lib/contoAttesoSql.test.ts` (PGlite): cifre attese, wrapper, mancante atteso, identità che cambia, trigger, ripristino | verdi |
| Concorrenza vera, 2 connessioni, 14 casi | `scripts/revisioni/collaudo-0057-concorrenza.mjs` su PostgreSQL 16.15 **locale** (cluster usa-e-getta, schema isolato) | 14/14 OK il 20/09/2026 notte |
| Anteprima senza rete (finto con le stesse regole) | «Ventiquattro Notti», «Cambio camera», «270 concordati», Carmela (senza prenotazione_id) | conto cambiato → niente scritto; risposta persa → «Verifica pagamento»; camera aggiunta fra acconto e bollino → nessun saldo inventato |

Quello che manca, e che decide se si applica: **lo stesso collaudo
concorrente sul PostgreSQL di Supabase** (17.x, non 16): il progetto di
prova `exylddaptetwcjxyqids` usato per la 0049, in uno schema separato.

## 2. Collaudo sul PostgreSQL di Supabase (progetto di PROVA, non quello vero)

Serve l'autorizzazione esplicita di Ania (scrive uno schema nuovo su quel
database, poi lo cancella).

```bash
DATABASE_URL='postgres://…progetto-di-prova…' node scripts/revisioni/collaudo-0057-concorrenza.mjs --consento-remoto
```

Atteso: `14 casi, 14 OK`. Con anche un solo KO la proposta non si applica e
si torna a rivederla. Lo script crea `collaudo_0057_<sigla>` e lo cancella
alla fine (`--tieni` per conservarlo e guardare i dati).

## 3. Backup, prima di applicare (progetto VERO)

1. Backup completo come per la 0049 (Supabase → Database → Backups, oppure
   `pg_dump`): verificarne integrità e conteggi (bookings, payments) e
   tenere una seconda copia.
2. Salvare le definizioni attuali delle quattro funzioni, a parte:
   ```sql
   select proname, pg_get_function_identity_arguments(oid), pg_get_functiondef(oid), proacl
     from pg_proc where proname in ('registra_acconto_prenotazione','registra_acconto','segna_pagato_prenotazione','segna_pagato');
   ```
   e verificare che NON esista già un trigger `bookings_blocca_soggiorno`.
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

1. Quattro funzioni, una firma ciascuna, coi parametri nuovi, e il trigger:
   ```sql
   select proname, pg_get_function_identity_arguments(oid) from pg_proc
     where proname in ('registra_acconto_prenotazione','registra_acconto','segna_pagato_prenotazione','segna_pagato') order by proname;
   select tgname from pg_trigger where tgname = 'bookings_blocca_soggiorno';
   ```
2. Permessi: `has_function_privilege('anon', 'public.registra_acconto_prenotazione(uuid,uuid,numeric,text,date,numeric,numeric)', 'execute')` → false; `authenticated` → true (e lo stesso per le altre tre).
3. Conteggi identici a prima (`payments`, `bookings`): la 0057 non tocca dati.
4. Dall'app, su una prenotazione **di prova** (non di una cliente vera):
   aprire «Aggiungi pagamento», cambiare il totale da un'altra scheda o
   telefono, salvare → «Il conto è cambiato mentre il foglio era aperto…»,
   nessun movimento nuovo; poi salvare di nuovo → un movimento solo. Nei
   log di PostgREST la chiamata deve avere i sette parametri (niente PGRST202).
5. Togliere il pagamento di prova (o annullare la prenotazione di prova).

## 6. Ripristino, se serve

`supabase/proposte/0057_RIPRISTINO.BOZZA.sql`: toglie il trigger e rimette
le quattro funzioni con le firme e i corpi della 0049 (copiati dalla
migrazione applicata, provati identici in PGlite), stessi permessi, poi
`notify pgrst, 'reload schema'`. Nessun dato da ripristinare: la 0057 non ne
scrive. L'app funziona con entrambe le versioni senza rilascio.

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
- Le pagine VECCHIE (`/prenotazioni/[id]`) chiamano le funzioni senza le
  cifre attese e senza il mancante atteso: lì restano le regole della 0049
  (idempotenza per chiave, saldo ricalcolato sul server). La scheda nuova
  le passa sempre.
- Una risposta persa lascia l'esito incerto anche con la 0057: l'app lo dice
  («Non riesco a confermare…») e «Verifica pagamento» controlla senza
  scrivere; la 0057 garantisce che un tentativo ripetuto con la stessa
  chiave non raddoppi mai.
