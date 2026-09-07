# Backup del gestionale — cosa esiste, cosa no, come si fa (07/09/2026, rivisto dopo la revisione; primo backup reale e ripristino la sera stessa, §6b)

Verifica documentata del pezzo 3 dell'incarico del 07/09/2026, corretta con
i rilievi R2, R3 e R6 della revisione dello stesso giorno. Progetto Supabase
di produzione: `tnsaaoxlcldeltowhvwv` (host in `.env.local`).

## 1. Cosa prevede Supabase (documentazione ufficiale, letta il 07/09/2026)

Fonte: https://supabase.com/docs/guides/platform/backups e
https://supabase.com/docs/guides/troubleshooting/will-backups-be-accessible-from-the-dashboard-immediately-after-upgrading-to-a-paid-plan-hXY4rs

| Piano | Backup automatici accessibili | Conservazione | Ripristino a un istante (PITR) |
|---|---|---|---|
| Free | **non accessibili dal pannello**: la guida consiglia esportazioni proprie; una pagina di assistenza dice che al momento fino a 7 backup giornalieri vengono comunque conservati e diventano visibili dopo un passaggio a un piano a pagamento, senza garanzia | — | no |
| Pro | uno al giorno | ultimi 7 giorni | a pagamento (richiede compute «Small») |
| Team | uno al giorno | ultimi 14 giorni | a pagamento |
| Enterprise | uno al giorno | fino a 30 giorni | a pagamento |

Frase chiave: «Pro Plan projects can access the last 7 days of daily
backups». Per i progetti Free la guida dice di esportare a mano (`supabase
db dump`) e tenere copie fuori da Supabase.

**Piano di QUESTO progetto: Free — VERIFICATO il 07/09/2026 dal pannello**
(sessione Chrome già autenticata, sola lettura, nessuna modifica):

- Organizzazioni: «amerigogranata@gmail.com's Org · Free Plan · 2 projects»;
- progetto «Gestionale Casa Ania Rozzano» → Database → Backups → Scheduled
  backups: «Free Plan does not include project backups. Upgrade to the Pro
  Plan for up to 7 days of scheduled backups.»;
- Point in time: «Point in Time Recovery is a Pro Plan add-on … Starts at
  $100/month».

Conclusione: **nessun backup accessibile o ripristinabile dal pannello**. Gli
eventuali 7 backup giornalieri che Supabase dice di conservare per i progetti
Free non sono visibili né garantiti, e comparirebbero solo dopo un passaggio a
Pro (25 $/mese). Il solo backup su cui contare è quello locale descritto
sotto, fatto il 07/09/2026 e provato col ripristino (§6b).

## 2. Come si chiede un ripristino (se il piano ha i backup)

- Dashboard → **Database → Backups → Scheduled backups**: si sceglie il
  giorno e si preme «Restore». Il pannello chiede conferma; durante il
  ripristino il progetto resta irraggiungibile (il gestionale non risponde).
- Con PITR attivo: **Database → Backups → Point in Time**, data e ora al secondo.
- Slot di replica o «subscriptions» vanno rimossi prima (non ne usiamo).
- Non c'è un ripristino «di una sola tabella»: si ripristina tutto il
  database a quell'istante. Per rimettere a posto una sola prenotazione si
  legge il backup locale (file JSON) e si corregge a mano.

## 3. Cosa NON è coperto (in nessun piano, e nemmeno dal JSON locale)

- Gli **oggetti dello Storage** (bucket `scontrini` e `documenti`): nel backup
  del database c'è solo il loro elenco (metadati), **non i file**. Vale sia
  per i backup gestiti di Supabase sia per il JSON locale.
- I **segreti** del progetto (chiavi, `CRON_SECRET`, variabili di Vercel).
- Le **password dei ruoli personalizzati** e le estensioni (pg_cron, pg_net):
  dopo un ripristino i job vanno ricontrollati (la 0040 si riapplica).
- Le **modifiche fatte dopo** l'ultimo backup.
- Il **codice** del gestionale e del sito: sta su GitHub, non su Supabase.

## 4. Cosa contiene il JSON locale — e cosa permette di recuperare

Il file scritto da `scripts/backup-locale.mjs` contiene **le righe delle
tabelle dello schema `public`** (tutte), con per ogni tabella: la chiave
primaria, il numero di righe atteso dalla sorgente al momento della lettura,
le righe lette. Registra data, origine e host, un'impronta SHA-256 del
contenuto e la riga `limiti`.

Permette di recuperare: **i dati** (prenotazioni, clienti, pagamenti,
richieste, spese, pulizie, cronologia…) dentro un database che ha già lo
schema — provato con `scripts/backup-ripristino.mjs` su un database isolato
(vedi §6).

NON contiene e NON permette di recuperare: lo **schema SQL** (tabelle,
vincoli, indici: si ricrea dalle migrazioni del repository), le **funzioni**
e i **trigger** (RPC 0027/0031, proposte 0033/0042: dalle migrazioni), le
**policy RLS**, gli utenti di **`auth.users`** (l'accesso di Ania), i
**file dello Storage**, i job pg_cron, le sequenze. Non è un backup
completo del progetto: è la copia dei dati.

## 5. Gli script del repository

Nessuna libreria in più. Tutti e tre leggono le tabelle con lo stesso
modulo `scripts/backup-lettura.mjs`: chiave primaria vera di ogni tabella
(dall'OpenAPI di PostgREST, `<pk/>`, oppure da `pg_index`), conteggi senza
presumere una colonna `id` (`app_members` ha `user_id`), pagine con **ordine
stabile sulla chiave** e avanzamento sulle righe davvero restituite (Supabase
può tagliare una pagina a 1.000 righe anche chiedendone di più).

### `scripts/backup-locale.mjs` — esporta

Scrive `backup/gestionale-backup-AAAA-MM-GG-HHMM.json` (cartella `backup/`
ignorata da git). Per ogni tabella controlla la **completezza** prima di
scrivere: righe lette = righe attese, chiave primaria presente e senza
doppioni; se qualcosa non torna **non scrive il file** e spiega perché.

Da Supabase servono DUE variabili, nell'ambiente del processo: Node **non**
legge `.env.local` da solo (lo fa Next.js, non `node`):

```bash
# 1) URL del progetto (non è un segreto: sta in .env.local, riga NEXT_PUBLIC_SUPABASE_URL)
export SUPABASE_URL="https://tnsaaoxlcldeltowhvwv.supabase.co"

# 2) chiave service_role SENZA lasciarla nei file né nella cronologia:
#    read -s la legge dalla tastiera senza mostrarla e senza registrarla
read -rs 'SUPABASE_SERVICE_ROLE_KEY?Incolla la chiave service_role: ' && export SUPABASE_SERVICE_ROLE_KEY

# 3) esportazione
node scripts/backup-locale.mjs

# 4) verifica subito il file appena creato, con le stesse variabili
node scripts/backup-verifica.mjs backup/NOME-DEL-FILE.json --confronta contenuti

# 5) solo DOPO la verifica, via la chiave dalla sessione
unset SUPABASE_SERVICE_ROLE_KEY
```

I comandi sono per **zsh**, il terminale del Mac: sostituire `NOME-DEL-FILE.json`
con il nome stampato dall'esportazione. La sintassi `read -s -p` è di Bash
e in zsh non legge la chiave. Se la lettura viene annullata, fermarsi.

Se la chiave è già in `.env.local` (riga `SUPABASE_SERVICE_ROLE_KEY=`, file
ignorato da git), si può passare all'ambiente senza scriverla né mostrarla,
al posto del passo 2:

```bash
export SUPABASE_SERVICE_ROLE_KEY="$(sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' .env.local | tr -d '"')"
```

(così è stato fatto il primo backup reale del 07/09/2026: la chiave non è
passata da chat, file nuovi, log né cronologia).

La chiave si copia da Supabase → Settings → API → `service_role`. Con
`read -s` non compare sullo schermo, non finisce nella cronologia di zsh e
non viene scritta in nessun file; lo script non la stampa mai e rifiuta di
scrivere un file che la contenga. Il terminale va chiuso (o `unset`) a fine
lavoro.

Da PostgreSQL diretto (collaudo locale): `DATABASE_URL=… node
scripts/backup-locale.mjs --postgres`. Date e timestamp restano il testo del
server (una `date` non scala di un giorno, i microsecondi restano: scoperto
e corretto col ripristino di collaudo).

Attenzione: il file contiene tutto il database, compresi telefoni e dati dei
clienti. Va tenuto su un disco cifrato e non condiviso.

### `scripts/backup-verifica.mjs` — rilegge e controlla, su TRE livelli

```bash
node scripts/backup-verifica.mjs backup/<file>.json
# con la sorgente (stesse variabili di sopra):
node scripts/backup-verifica.mjs backup/<file>.json --confronta            # conteggi letti adesso
node scripts/backup-verifica.mjs backup/<file>.json --confronta contenuti  # anche riga per riga
```

Stampa tre righe distinte, perché dicono cose diverse:

- **INTEGRITÀ DEL FILE** — struttura, versione, data, conteggi coerenti,
  impronta SHA-256: il file è quello scritto, non manomesso.
- **COMPLETEZZA DELL'ESPORTAZIONE** — per ogni tabella righe = attese dalla
  sorgente al momento dell'esportazione, chiave primaria presente e senza
  doppioni (registrate nel file e ricontrollate). Un file «integro» può
  essere incompleto: questa riga lo dice.
- **CONFRONTO COL DATABASE** — solo con `--confronta`: conteggi letti
  ADESSO dalla sorgente; con `contenuti` rilegge ogni tabella con lo stesso
  lettore e confronta riga per riga sulla chiave (mancanti, in più,
  diverse). Dice quanto il file è ancora attuale, non se era completo.

Esce con 0 solo se tutto ciò che è stato chiesto torna; altrimenti 1 con le
righe `PROBLEMA —` / `DIFFERENZA —`.

### `scripts/backup-ripristino.mjs` — rimette i dati in un database isolato

```bash
DATABASE_URL=postgres://postgres@127.0.0.1:5433/collaudo_ripristino node scripts/backup-ripristino.mjs backup/<file>.json --conferma --svuota
```

Scrive solo con `--conferma` e solo su un database il cui nome contiene
«collaudo» (altrimenti serve `--anche-fuori-collaudo`). Tutto in una
transazione, vincoli e trigger sospesi durante l'inserimento (serve un
superutente locale). Non è pensato per la produzione: è lo strumento con cui
si prova che il file si rilegge davvero.

## 6. Esito del collaudo locale (07/09/2026, dopo la revisione)

PostgreSQL 16 sulla porta 5433, database `collaudo_backup` migrato con
`applica-migrazioni.mjs` (una prenotazione e due acconti inseriti a mano) e
database `collaudo_ripristino` migrato e vuoto:

- esportazione `--postgres`: 30 tabelle, 218 righe, completezza OK,
  `app_members` (chiave `user_id`) compresa, nessun segreto nel file;
- verifica `--confronta contenuti --postgres` sulla sorgente: integrità OK,
  completezza OK, contenuti identici;
- **ripristino** in `collaudo_ripristino` (`--conferma --svuota`): 30 tabelle,
  218 righe; la verifica `--confronta contenuti` contro il database
  RIPRISTINATO: contenuti identici (date e microsecondi compresi: il primo
  giro aveva mostrato `paid_on` scalato di un giorno e microsecondi persi,
  corretto tenendo i valori come testo);
- file con un importo alterato → INTEGRITÀ NON OK; file con una riga tolta
  e conteggio ritoccato → COMPLETEZZA NON OK («lette 1 righe su 2 attese»);
- senza variabili d'ambiente gli script si fermano prima di toccare la rete
  e dicono che `.env.local` non basta.
- Percorso **PostgREST vero** (`lib/backupPostgrest.test.ts`, server
  sintetico locale che imita Supabase): `app_members` senza `id`; tabella
  da 1.001 righe col taglio del server a 1.000 per pagina, letta intera una
  volta sola in ordine di chiave; con un server che ignora l'ordine e
  restituisce pagine sovrapposte (la riproduzione della revisione)
  l'esportazione **si ferma** invece di scrivere un file «integro»
  incompleto; il confronto «contenuti» scopre una riga cambiata che i soli
  conteggi non vedono.

Il percorso PostgREST contro Supabase vero è stato eseguito il 07/09/2026
sera: vedi §6b.

## 6b. Primo backup REALE e ripristino provato (07/09/2026, sera) — distinto dal collaudo sintetico del §6

Il §6 usava un database locale con dati inventati (218 righe). Qui invece:

**Esportazione dalla produzione** (PostgREST con la service key, sola lettura,
nessuna scrittura né SQL in produzione): `backup/gestionale-backup-2026-09-07-1954.json`,
34 tabelle, 3.137 righe, 1,1 MB, completezza controllata tabella per tabella,
nessuna chiave nel file (controllato). Il file sta in `backup/` (ignorato da
git, `git check-ignore` confermato) su un Mac con FileVault attivo.
`backup-verifica.mjs --confronta contenuti` contro la produzione, subito
dopo: INTEGRITÀ OK, COMPLETEZZA OK, CONFRONTO OK (contenuti identici).

**Ripristino in un database isolato** (PostgreSQL 16.15 Homebrew, cluster
NUOVO creato con `initdb` in una cartella temporanea, porta 5433, solo TCP su
127.0.0.1, `LC_ALL=C`; database `collaudo_ripristino`; produzione mai toccata):

1. schema con `scripts/collaudo-0033/applica-migrazioni.mjs` (0001–0039,
   bootstrap owner, proposte 0043, 0033, 0034); la **0040 fallisce in locale**
   perché `pg_cron` non c'è: applicata a mano solo la parte 1 (righe 1–23:
   vincolo stato, `chiusura_motivo`, `scadenza_notificata_at`, indice);
2. proposte **0035, 0036, 0037, 0038** applicate con `psql` perché in
   produzione ci sono già (tabelle `da_controllare_rinvii`, `strutture`,
   colonne provenienza e `vuole_ricevuta`);
3. **drift senza migrazione** scoperto dal confronto colonne file ↔ database:
   tabelle `push_subscriptions` (id, endpoint, subscription, updated_at) e
   `site_events` (id, tipo, pagina, created_at, fonte, campagna), colonne
   `bookings.pushover_notified_at` (timestamptz) e `rooms.double_price`,
   `rooms.matrimoniale_price` (numeric): esistono in produzione, non in
   `supabase/migrations` né in una proposta. Tipi letti dall'OpenAPI di
   PostgREST e create a mano nel database di collaudo. Senza questo passo il
   ripristino SALTA le due tabelle (dichiarandolo) e scarta le tre colonne;
4. `backup-ripristino.mjs --conferma --svuota`: 34 tabelle, 3.137 righe;
5. `backup-verifica.mjs --confronta contenuti --postgres` contro il database
   RIPRISTINATO: **OK, contenuti identici** (con la correzione qui sotto);
6. prove avversarie sul database ripristinato (vedi sotto): tutte rilevate;
   poi ripristinato di nuovo → identico.

**Difetto dimostrato e corretto** (`scripts/backup-lettura.mjs`, `normalizzaValore`
per TIPO di colonna; `backup-verifica.mjs` passa i tipi della tabella viva;
test in `lib/backup.test`): il primo confronto dava «contenuto diverso» su 25
tabelle perché PostgREST scrive i numeri come numeri e i timestamptz in UTC
(`2026-08-29T07:57:37.71277+00:00`), mentre node-pg dà i `numeric` come stringhe
(`80.00`) e i timestamptz nel fuso della sessione (`2026-08-29 09:57:37.71277+02`).
La forma canonica dipende dal **tipo reale della colonna** (campo `format`
dell'OpenAPI di PostgREST, `data_type` di `information_schema` per PostgreSQL),
mai dall'aspetto del testo: una prima versione «a vista» accettava tre falsi
uguali riprodotti da Codex (telefono `0123` = `123`, `9007199254740992` =
`9007199254740993` passando da `Number`, testo `2026-09-07 10:00:00` =
`2026-09-07T10:00:00`) ed è stata sostituita prima della pubblicazione. Ora:
colonne numeriche canonicalizzate come **testo** (zeri iniziali/finali, segno,
forma esponenziale; mai `Number`, i bigint restano esatti); `timestamp with
time zone` in UTC coi decimali dei secondi come sono (microsecondi conservati);
`timestamp without time zone` solo col separatore; **testo, date e JSON esatti**
(i JSON in ordine stabile delle chiavi perché il file li scrive ordinati e
`jsonb` no; `1` e `"1"` dentro un JSON restano diversi). Senza tipi il
confronto è esatto come prima. Prove sul database ripristinato: prezzo +0,01,
un microsecondo su un timestamptz, uno zero davanti a un nome, una riga tolta →
tutte rilevate; poi ripristinato di nuovo → identico.

**Cosa questa prova dimostra**: dal file si recuperano TUTTE le righe delle 34
tabelle di `public` (prenotazioni, clienti, pagamenti, richieste, spese con
voci e documenti, pulizie, log, eventi del sito…) dentro un database che ha
lo schema giusto. **Cosa resta escluso** (confermato sul file vero):

- i **file dello Storage**: gli 8 documenti dei clienti (`documenti_cliente`),
  le 83 foto degli scontrini (`family_receipts`) e gli 83 `family_documents`
  sono nel file solo come righe (nome, bucket, percorso): i file veri stanno
  nei bucket `documenti` e `scontrini` e NON sono copiati da nessuna parte;
- schema, funzioni/RPC, trigger, policy RLS, `auth.users` (l'accesso di
  Ania), job pg_cron della 0040, segreti, sequenze;
- le modifiche fatte dopo le 19:54 del 07/09/2026.

## 7. Limiti dichiarati

- Le tabelle si leggono una dopo l'altra, non in un'unica transazione: se
  qualcuno scrive nel frattempo, due tabelle possono essere di istanti
  diversi. `--confronta contenuti` subito dopo l'esportazione lo rivela
  (righe «mancanti» o «diverse»). Per un B&B a un solo utente basta fare il
  backup quando non si sta lavorando nel gestionale.
- Niente file dello Storage, niente schema/funzioni/policy/auth (vedi §4).
- Nessuna esecuzione automatica: a mano, prima di ogni migrazione e almeno
  una volta a settimana; tenere una seconda copia in un posto diverso.
- Il ripristino è provato solo in locale (§6 sintetico, §6b col file vero):
  in produzione il pannello Supabase (§2) NON lo permette col piano Free.
- Cinque oggetti di produzione (§6b punto 3) non hanno migrazione nel
  repository: prima di un ripristino da zero vanno messi in una proposta di
  drift (come la 0043), altrimenti il ripristino li salta o li scarta.
- I file dello Storage non hanno nessuna copia: da decidere (copia locale dei
  bucket con la service key, oppure accettarne la perdita).
