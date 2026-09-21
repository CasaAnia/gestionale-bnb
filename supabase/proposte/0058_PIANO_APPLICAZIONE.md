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
3. Backup: **non c'è, e non ci sarà** (21/09/2026). Il progetto sta sul
   piano **gratuito** di Supabase, che non include i backup programmati né
   il point-in-time — lo dice la pagina Database → Backups. Non si prende
   un abbonamento per questo (obiettivo di Ania: niente nuove spese).
   Si procede lo stesso perché il rischio è di un'altra natura:
   - la 0058 fa **solo `add column` e `add constraint`**: nessun `update`,
     nessun `delete`, nessun `drop`. Le 261 prenotazioni non si toccano;
   - è già stata **eseguita per intero sul progetto di prova**, e due volte
     di fila (è idempotente);
   - se servisse tornare indietro c'è `0058_RIPRISTINO.BOZZA.sql`, che
     toglie colonne e vincoli e lascia intatte `check_in_time` e `shuttle`.
   **Il limite resta dichiarato**: se qualcosa andasse storto in modo
   imprevisto non c'è un punto di ripristino del database a cui tornare.
   Per una migrazione che tocca i dati (un `update`, un backfill) questo
   non basterebbe: lì servirebbe un'altra strada prima di eseguire.

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

## Collaudo sul progetto di prova — FATTO (21/09/2026 sera)

Eseguita da Ania sul progetto Supabase **test**, guidata passo passo. Il
`bookings` di test è più vecchio (non ha nemmeno `check_in_time`): va bene
lo stesso, perché la 0058 non tocca quelle due colonne — le nomina solo
dentro un commento.

| controllo | atteso | risultato |
| --- | --- | --- |
| colonne `arrivo_*` e `navetta*` prima | 0 | **0** |
| dopo l'esecuzione | «Success. No rows returned» | **sì** |
| colonne nuove | 11 | **11** |
| vincoli | 15 | **15** |
| righe con `arrivo_tipo` valorizzato | 0 | **0** |
| seconda esecuzione (idempotenza) | «Success», senza lamentele | **sì** |

Quindi l'SQL gira davvero su PostgreSQL, i vincoli si creano tutti, non
tocca nessuna riga e rieseguirlo non fa danni.

## Fotografia PRIMA, sul progetto vero (21/09/2026 sera)

Presa nel SQL Editor del gestionale, dopo aver verificato di essere sul
progetto giusto (il primo tentativo era finito sul progetto di test: il
selettore in alto diceva `gestionale-bnb-spese-test-…`, e `check_in_time`
non esisteva — è stato quello a farcene accorgere).

| | valore |
| --- | --- |
| prenotazioni | **261** |
| clienti | **151** |
| con orario di arrivo | **61** |
| colonne `arrivo_*` / `navetta*` | **0** |

I primi tre devono restare identici dopo l'applicazione.

## Cosa NON è ancora stato fatto

- L'applicazione sul **progetto vero** (`gestionale`).
- Nessuna prova del comportamento dell'app contro un database con la 0058
  applicata: il branch non è pubblicato, quindi in produzione le colonne
  nuove resterebbero semplicemente vuote e inutilizzate finché non si
  pubblica.
