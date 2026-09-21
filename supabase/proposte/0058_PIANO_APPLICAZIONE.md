# Piano di applicazione — proposta 0058 «Arrivo e navetta»

Scritto il 21/09/2026 sera, dopo la verifica indipendente di Codex.
**Non ancora applicata.** La decide Ania.

File: `supabase/proposte/0058_arrivo_e_navetta.BOZZA.sql`
Ripristino: `supabase/proposte/0058_RIPRISTINO.BOZZA.sql`

## Cosa fa, in una riga

Aggiunge **undici colonne** a `bookings` per tenere i dettagli dell'arrivo
(dove, a che ora lì, la stima in struttura, la navetta e il prelievo).
Non tocca nessuna riga esistente e non cambia nessuna colonna di prima.

## Perché è a rischio basso

- Solo `add column` e `add constraint`: nessun `update`, nessun `delete`,
  nessun `drop`, nessuna funzione e nessun trigger toccati.
- Le colonne nascono **NULL** su tutte le righe; i vincoli ammettono NULL,
  quindi nessuna riga esistente può diventare invalida.
- Tutto dentro una transazione (`begin` … `commit`): o entra tutto o niente.
- `check_in_time` e `shuttle` **non si toccano**: se qualcosa andasse storto
  il gestionale continua a funzionare come oggi.
- Il gestionale funziona già adesso **senza** questa proposta, quindi non
  c'è nessuna fretta e nessuna finestra da rispettare.

## Prima di applicare

1. Annotare i numeri di adesso, per confrontarli dopo:
   ```sql
   select count(*) as prenotazioni,
          count(check_in_time) as con_orario,
          count(shuttle) as con_navetta
     from public.bookings;
   ```
2. Controllare che le colonne non ci siano già (deve dare 0):
   ```sql
   select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'bookings'
      and (column_name like 'arrivo\_%' or column_name like 'navetta%');
   ```
3. Backup del progetto come per la 0057 (Supabase → Database → Backups).

## Applicazione

Incollare **tutto** il contenuto di `0058_arrivo_e_navetta.BOZZA.sql`
nell'editor SQL di Supabase ed eseguirlo una volta sola. Il file è
idempotente (`if not exists` ovunque): rieseguirlo non fa danni.

## Dopo, i controlli (sono già in fondo al file SQL)

| controllo | atteso |
| --- | --- |
| colonne `arrivo_*` e `navetta*` | **11** |
| vincoli `bookings_arrivo*` / `bookings_navetta*` | **15** |
| `count(*)` e `count(check_in_time)` | **identici** ai numeri del punto 1 |
| `count(*) where arrivo_tipo is not null` | **0** |

## Subito dopo: la cache dello schema

PostgREST tiene una sua copia dello schema. Finché non si aggiorna, il
gestionale continua a vedere le colonne come assenti — e in quel caso **non
salva niente** e lo dice, non salva a metà. Per accorciare l'attesa:

```sql
notify pgrst, 'reload schema';
```

Poi, dal gestionale: aprire una prenotazione, «Modifica arrivo», scrivere
un luogo e un autista, salvare, **chiudere e riaprire** la scheda. Se i
dettagli si rileggono, la cache è a posto.

## Se qualcosa va storto

Eseguire `0058_RIPRISTINO.BOZZA.sql` (toglie vincoli e colonne, lascia
intatte `check_in_time` e `shuttle`). Leggere prima la copia di sicurezza
indicata in cima a quel file: i dettagli scritti dopo l'applicazione non si
possono ricostruire dalle due colonne di sempre.

## Cosa NON è stato fatto in questo giro

- La proposta **non è stata eseguita** da nessuna parte: né sul progetto
  vero né su un progetto di prova. Le prove fatte sono sul comportamento
  dell'app quando le colonne mancano (anteprima sintetica, interruttore
  `senza-0058`), non sull'SQL eseguito da PostgreSQL.
- Un collaudo dell'SQL su PostgreSQL vero, come si è fatto per la 0057,
  resta da concordare: serve un progetto di prova e l'autorizzazione.
