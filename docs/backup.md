# Backup del gestionale — cosa esiste, cosa no, come si fa (07/09/2026)

Verifica documentata del pezzo 3 dell'incarico del 07/09/2026. Progetto
Supabase di produzione: `tnsaaoxlcldeltowhvwv` (host in `.env.local`).

## 1. Cosa prevede Supabase (letto dalla documentazione ufficiale, 07/09/2026)

Fonte: https://supabase.com/docs/guides/platform/backups

| Piano | Backup automatici | Conservazione | Ripristino a un istante (PITR) |
|---|---|---|---|
| Free | **NESSUNO** | — | no |
| Pro | uno al giorno | ultimi 7 giorni | a pagamento (richiede compute «Small») |
| Team | uno al giorno | ultimi 14 giorni | a pagamento |
| Enterprise | uno al giorno | fino a 30 giorni | a pagamento |

Frasi chiave della documentazione: «Pro Plan projects can access the last
7 days of daily backups»; i progetti Free «devono esportare i dati a mano
con `supabase db dump`» e tenere copie fuori da Supabase.

**Il piano di QUESTO progetto non l'ho potuto leggere**: il pannello Supabase
richiede il login di Ania (il Chrome collegato non era raggiungibile e
nessun token di gestione è salvato sul Mac, giustamente). Per saperlo in
10 secondi: Dashboard → progetto → **Settings → Billing** (voce «Plan»),
oppure **Database → Backups**: se la pagina mostra un elenco di backup
giornalieri il piano è almeno Pro; se dice che i backup non sono inclusi,
il progetto è Free e **non esiste nessun backup automatico**.

Dalla memoria di progetto (nessun nuovo abbonamento, obiettivo del
gestionale) il progetto è con ogni probabilità **Free**: in quel caso il
solo backup è quello locale descritto sotto. Ania lo conferma con un'occhiata
alla pagina Billing.

## 2. Come si chiede un ripristino (se il piano ha i backup)

- Dashboard → **Database → Backups → Scheduled backups**: si sceglie il
  giorno e si preme «Restore». Il pannello chiede conferma; durante il
  ripristino il progetto resta irraggiungibile (il gestionale non risponde).
- Con PITR attivo: **Database → Backups → Point in Time**, si sceglie
  data e ora al secondo.
- Se il progetto usa slot di replica o «subscriptions» vanno rimossi prima
  (non è il nostro caso: non ne usiamo).
- Non c'è un ripristino «di una sola tabella»: si ripristina tutto il
  database a quell'istante. Per rimettere a posto una sola prenotazione si
  legge il backup locale (file JSON) e si corregge a mano.

## 3. Cosa NON è coperto (in nessun piano)

- Gli **oggetti dello Storage** (bucket `scontrini` e `documenti`: foto degli
  scontrini e documenti dei clienti): nel backup del database c'è solo il
  loro elenco (metadati), **non i file**. Vanno copiati a parte (vedi §5).
- I **segreti** del progetto (chiavi, `CRON_SECRET`, variabili di Vercel):
  stanno su Vercel e nel job pg_cron della 0040; non sono nel backup.
- Le **password dei ruoli personalizzati** e le estensioni (pg_cron, pg_net):
  dopo un ripristino i job vanno ricontrollati (la 0040 si riapplica).
- Le **modifiche fatte dopo** l'ultimo backup (fino a 24 ore con il backup
  giornaliero; secondi con PITR).
- I **dati cancellati prima** del backup più vecchio conservato.
- Il **codice** del gestionale e del sito: sta su GitHub (repo `CasaAnia/
  gestionale-bnb` e `sito-casaania`), non su Supabase.

## 4. Backup locale: gli script del repository

Due script, senza librerie in più, provati sul PostgreSQL 16 locale di
collaudo (**mai eseguiti sulla produzione**, per scelta dell'incarico).

### `scripts/backup-locale.mjs` — esporta

Scrive `backup/gestionale-backup-AAAA-MM-GG-HHMM.json` (cartella `backup/`
ignorata da git) con TUTTE le tabelle dello schema `public`: per ogni
tabella il numero di righe e le righe intere; in testa data, origine e host;
in fondo un'impronta SHA-256 del contenuto.

- Da Supabase (default): legge `SUPABASE_URL` (o `NEXT_PUBLIC_SUPABASE_URL`)
  e `SUPABASE_SERVICE_ROLE_KEY` **solo dall'ambiente del processo**; la chiave
  non viene stampata, scritta su file né passata ad altri programmi, e prima
  di scrivere lo script controlla che il testo non la contenga. L'elenco
  delle tabelle arriva dall'OpenAPI di PostgREST; le righe a pagine da 1000.
- Da PostgreSQL diretto (`--postgres`): legge `DATABASE_URL`; è la modalità
  usata per il collaudo locale.

```bash
# dalla cartella del gestionale, chiave passata SOLO per quel comando
SUPABASE_SERVICE_ROLE_KEY='…' node scripts/backup-locale.mjs
```

La chiave si copia da Supabase → Settings → API → `service_role` e si
incolla nel comando: **non** va messa in `.env.local` per questo scopo e
**non** va salvata nella cronologia (in zsh, un comando che inizia con uno
spazio non finisce nella cronologia se `HIST_IGNORE_SPACE` è attivo).

Attenzione: il file contiene tutto il database, compresi telefoni e
documenti dei clienti (metadati). Va tenuto in un posto sicuro (disco
cifrato, iCloud del Mac) e non condiviso.

### `scripts/backup-verifica.mjs` — rilegge e controlla

```bash
node scripts/backup-verifica.mjs backup/gestionale-backup-2026-09-07-0915.json
# subito dopo l'esportazione, confrontando i conteggi con la sorgente:
SUPABASE_SERVICE_ROLE_KEY='…' node scripts/backup-verifica.mjs <file> --confronta
```

Controlla struttura, versione, data, conteggio per tabella, che ogni riga sia
un oggetto e che l'**impronta** coincida (un solo importo cambiato nel file
viene scoperto). Con `--confronta` ricalcola i conteggi dalla sorgente e
segnala le tabelle con un numero di righe diverso. Esce con 0 se tutto torna,
altrimenti con 1 e le righe `PROBLEMA —` / `DIFFERENZA —`.

### Esito del collaudo locale (07/09/2026)

PostgreSQL 16 sulla porta 5433, database `collaudo_backup` creato con
`scripts/collaudo-0033/applica-migrazioni.mjs` (0001–0039 + drift + proposte
0033/0034; la 0040 non si applica in locale perché manca pg_cron), una
prenotazione e un acconto inseriti a mano:

- esportazione: 30 tabelle, 217 righe, 39 KB, nessun segreto nel file
  (`sorgente` = solo host);
- verifica: «OK — esportazione integra», conteggi identici alla sorgente;
- file con un importo alterato → «impronta diversa», NON OK;
- file con una riga tolta → «payments: dichiarate 1 righe, trovate 0» +
  impronta diversa, NON OK;
- una riga aggiunta nel database dopo l'export → `--confronta` dice
  «payments: file 1 righe, database 2», NON OK;
- senza variabili d'ambiente lo script si ferma subito senza toccare la rete.
- `lib/backup.test.ts`: 5 test sulla parte pura (nome file, documento,
  impronta indipendente dall'ordine delle chiavi, verifica, confronto,
  guardia sui segreti), nella suite `npm test`.

## 5. Cosa manca ancora (limiti dichiarati)

- Gli script **non** copiano i file dello Storage (foto scontrini, documenti):
  un secondo script che scarichi i bucket con la service key è un pezzo a
  parte, da autorizzare.
- Non c'è un'esecuzione automatica: si lancia a mano (una volta a settimana,
  e sempre prima di applicare una migrazione).
- Non c'è uno script di **ripristino** dal JSON: serve una decisione su cosa
  ripristinare (tutto, una tabella, una riga) e va provato in locale prima.
- La lettura da PostgREST non è una fotografia atomica: le tabelle si leggono
  una dopo l'altra; se qualcuno scrive nel frattempo, due tabelle possono
  essere di istanti diversi. Con `--postgres` sulla stringa diretta di Supabase
  la lettura avverrebbe in un'unica connessione ma comunque non in una sola
  transazione (limite accettato per un B&B a un solo utente).
