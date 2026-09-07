# Backup del gestionale — cosa esiste, cosa no, come si fa (07/09/2026, rivisto dopo la revisione)

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

**Il piano di QUESTO progetto NON è stato verificato.** Il pannello Supabase
richiede il login di Ania; nessun token di gestione è salvato sul Mac
(giustamente). Quindi la conclusione onesta è: **backup accessibili e
ripristinabili del progetto ancora da accertare**. Non si può scrivere
«Free = nessun backup» come certezza: se il piano è Free, i backup
eventualmente conservati da Supabase non sono accessibili dal pannello e non
sono garantiti; se è Pro, ci sono 7 giorni di backup giornalieri.

Per saperlo in 10 secondi: Dashboard → progetto → **Settings → Billing**
(voce «Plan»), oppure **Database → Backups**: se compare un elenco di backup
giornalieri il piano è almeno Pro.

Finché non è accertato, il solo backup su cui contare è quello locale
descritto sotto.

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

Il percorso PostgREST **contro Supabase vero non è stato eseguito** (nessuna
lettura in produzione in questo giro, per scelta): il primo backup reale lo
fa Ania coi comandi del §5 e lo verifica con `--confronta contenuti`.

## 7. Limiti dichiarati

- Le tabelle si leggono una dopo l'altra, non in un'unica transazione: se
  qualcuno scrive nel frattempo, due tabelle possono essere di istanti
  diversi. `--confronta contenuti` subito dopo l'esportazione lo rivela
  (righe «mancanti» o «diverse»). Per un B&B a un solo utente basta fare il
  backup quando non si sta lavorando nel gestionale.
- Niente file dello Storage, niente schema/funzioni/policy/auth (vedi §4).
- Nessuna esecuzione automatica: a mano, prima di ogni migrazione e almeno
  una volta a settimana; tenere una seconda copia in un posto diverso.
- Il ripristino è provato solo in locale: in produzione il ripristino si
  fa dal pannello Supabase (§2) se il piano lo permette.
