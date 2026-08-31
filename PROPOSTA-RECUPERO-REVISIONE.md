# PROPOSTA COORDINATA — recupero completo della revisione dopo un'interruzione

**Stato: il CONTRATTO (§2) è approvato come base di SVILUPPO LOCALE
(client + server finto + bozza SQL non applicabile); la TRANSIZIONE
(§5) resta NON APPROVATA e i suoi casi PostgreSQL sono DA DIMOSTRARE
in ambiente isolato, con autorizzazione separata.** Nessuna migrazione
viene applicata a Supabase; le migrazioni storiche (0020–0022) non si
toccano; i vincoli legacy nel client NON vengono allentati. Questo
documento COORDINA e SOSTITUISCE la proposta «client_key» di
PROPOSTA-0023-CHIAVE-IDEMPOTENTE.md (v. §3).

## 1. Obiettivo e criterio

Dopo un'interruzione (rete caduta, pagina morta, risposta persa) si deve
poter RIPRENDERE una revisione valida:
- senza DOPPIONI (insert delle voci nuove);
- senza SOVRASCRITTURE (update tardivi che rimettono valori vecchi);
- senza SCARTO OBBLIGATORIO (oggi i «campi vincolati» condannano il
  documento: protezione corretta, ma temporanea).

Criterio di fondo, emerso dalle sei tornate di revisione: **l'esito di
una richiesta deve essere riferibile all'OPERAZIONE, non dedotto dai
valori**; e una richiesta già partita non si ferma da locale — la può
fermare solo il server. Quindi il contratto vive lato database.

## 2. Il contratto

### 2.1 Giornale delle operazioni + versione di revisione
- Nuova tabella `public.family_revision_ops` (append-only):
  `op_key uuid primary key` · `document_id uuid not null references
  family_documents` · `kind text not null check (kind in
  ('salva','conferma','scarto'))` · `base_rev bigint not null` ·
  `manifesto_sha256 text not null` (impronta del payload canonico) ·
  `esito jsonb not null` (contiene `rev_dopo` e, per i Salva, la mappa
  `righe_nuove: [{client_ref, id}]`) · `created_at` · `created_by`.
  Trigger di IMMUTABILITÀ (niente update/delete, nemmeno service_role —
  pattern del registro correzioni e del manifesto 0022).
- Nuova colonna `public.family_documents.revisione_rev bigint not null
  default 0`: la versione del documento ai fini della revisione.

### 2.2 RPC `public.salva_revisione(p_op_key uuid, p_document_id uuid, p_base_rev bigint, p_modifiche jsonb)`
Security definer, `search_path=''`, guardia `is_app_member`.
**Coordinamento COMUNE con le chiusure**: il lock è la RIGA del
documento (`select … from family_documents where id = p_document_id
for update`) — lo STESSO primitivo già usato dalle RPC 0020 di
conferma/scarto, così salvataggio e chiusura si escludono a vicenda per
costruzione (niente advisory lock separato: due meccanismi diversi non
sarebbero automaticamente lo stesso coordinamento).
UN SOLO batch atomico per l'intero Salva (totale + campi bozze + campi
righe + voci nuove):
1. **Replay**: `op_key` già a giornale → si confrontano documento,
   base_rev e `manifesto_sha256`: TUTTI coincidenti → ESITO ORIGINALE
   («RIPETUTA», stessa mappa di id, senza scrivere nulla); qualunque
   differenza (stessa chiave con documento o revisione o modifiche
   diversi) → sentinella `CHIAVE_RIUSATA`, niente scritto e MAI l'esito
   estraneo.
2. **Stato modificabile — lista POSITIVA**: il documento deve essere
   in uno stato ESPLICITAMENTE modificabile: `in_revisione`. Tutti gli
   altri (`confermato`, `scartato`, ma anche `approvata_da_pagare` —
   le cui bozze alimentano il pagamento e non vanno più toccate —,
   `da_elaborare`, `errore`) → sentinella `DOCUMENTO_NON_MODIFICABILE`,
   niente scritto. Idem per le BOZZE: modificabili solo quelle in
   `da_controllare` o `pronta`; una bozza `confermata`/`scartata`/
   `errore` indicata nel batch → `BOZZA_NON_MODIFICABILE`, TUTTO
   respinto — l'appartenenza al documento non basta.
3. **Versione**: `p_base_rev <> revisione_rev` → sentinella `SUPERATA`,
   niente scritto. Ferma sia la schermata rimasta indietro sia il
   duplicato tardivo (che comunque, se identico, cade nel replay).
4. **Perimetro** (v. §2.6): ogni riferimento verificato, qualunque
   anomalia respinge TUTTO il batch.
5. **Applicazione atomica**: whitelist ESPLICITA dei campi (gli stessi
   insiemi della 0021: bozze, righe, doc_total; voci nuove col payload
   delle colonne concesse — ogni voce porta un `client_ref` locale nel
   manifesto e l'esito restituisce `client_ref → id`). Campo estraneo →
   sentinella `CAMPO_NON_CONSENTITO`, niente scritto. I vincoli 0020
   (NOT NULL, check) restano la rete di sicurezza. Tutto o niente:
   spariscono i salvataggi parziali.
6. **Chiusura**: scrive il giornale, incrementa `revisione_rev`,
   restituisce `{esito:'APPLICATA', rev_dopo, righe_nuove}`.

### 2.3 RPC `public.esito_revisione(p_op_key uuid)`
Sola lettura del giornale (membri): `{stato:'applicata', document_id,
kind, base_rev, manifesto_sha256, esito}` oppure `{stato:'assente'}`.
È l'ESITO RIFERIBILE all'operazione: la presenza a giornale, non un
confronto di valori. La risposta porta ABBASTANZA informazioni perché
il client verifichi la CORRISPONDENZA con la propria custodia
(documento, base_rev, impronta del manifesto): se non coincidono, la
pendenza NON si chiude — un esito estraneo non recupera nulla.
**Lettura fallita ≠ assente**: un errore mantiene la pendenza.

### 2.4 Chiusure COORDINATE: conferma e scarto versionati
Le RPC 0020 sono idempotenti ma non ricevono una revisione attesa: la
Conferma di A rimasta per aria, arrivando dopo un Salva di B,
approverebbe inconsapevolmente i valori nuovi di B. Quindi:
- nuovi involucri `public.conferma_revisione(p_op_key, p_document_id,
  p_base_rev, p_correzioni)` e `public.scarta_revisione(p_op_key,
  p_document_id, p_base_rev, p_motivo)` — security definer: lock della
  RIGA documento (lo stesso di §2.2) → replay a giornale per `op_key`
  (kind 'conferma'/'scarto', stesse regole di corrispondenza) →
  `p_base_rev <> revisione_rev` → `SUPERATA`, niente eseguito (né
  confermato né scartato: A viene fermato e B decide di nuovo) →
  altrimenti eseguono la logica 0020 spostata in `private` (v. §5 fase
  A: MAI duplicata, spostata verbatim) → giornale + `revisione_rev`
  incrementata. Anche le chiusure diventano così RIFERIBILI per chiave
  (la presa in carico di una chiusura pendente userà `esito_revisione`,
  non più solo l'osservazione dello stato).
- **Identità COMPLETA delle tre operazioni**: `kind` è OBBLIGATORIO
  nel manifesto e nel confronto di replay (stessa `op_key` con `kind`
  diverso → `CHIAVE_RIUSATA`); il manifesto della conferma include le
  CORREZIONI complete (`p_correzioni`, ordinate per draft_id,
  draft_item_id, field), quello dello scarto il MOTIVO (v. §2.6).
- **Niente percorsi che aggirano il contratto**: i corpi pubblici di
  `conferma_documento`/`scarta_documento` diventano RESPINGENTI
  (sentinella `PERCORSO_DISMESSO`, v. §5 fase A) e in più l'EXECUTE
  viene revocato ad `authenticated` (doppia porta; il FILE 0020 non si
  tocca: la ridefinizione vive nella migrazione nuova). Lo scarto
  tardivo è coperto dalla stessa versione attesa: dopo un Salva di B,
  lo scarto di A prende `SUPERATA` e non butta via il lavoro nuovo.
- **Percorsi FATTURE**: la 0020 concede ad `authenticated` anche
  `approva_fattura_da_pagare`, `paga_fattura`,
  `conferma_fattura_pagata` — senza `base_rev` né giornale. «Ferme
  nella UI» non equivale a negate dal database: la migrazione REVOCA
  il loro EXECUTE ad `authenticated` (corpi intatti). La Fase 5 le
  reintrodurrà come involucri versionati e giornalati sullo stesso
  lock di riga — quel disegno è demandato alla Fase 5, qui si chiude
  solo la porta.

### 2.5 Chiusura della porta alle scritture dirette
Statement NUOVI nella migrazione (la 0021 non si modifica):
- `revoke update, insert on public.family_draft_expenses from authenticated;`
- `revoke update, insert on public.family_draft_items from authenticated;`
- su `family_documents`: revoke COMPLETO dell'UPDATE diretto per
  `authenticated` — nessun re-grant, nemmeno delle colonne «da
  fatture» (`kind` in testa: cambiare il tipo sposterebbe il documento
  da un regime all'altro aggirando la revisione). Oggi nessuna
  schermata pubblicata scrive quelle colonne; la Fase 5 le
  reintrodurrà dentro il proprio contratto versionato, non come
  scritture dirette. L'INSERT dei documenti e tutto il flusso di
  caricamento 0022 restano invariati.
Conseguenza decisiva: una richiesta diretta che deve ancora superare il
controllo dei permessi viene rifiutata; per le scritture GIÀ in
esecuzione al momento della migrazione serve la BARRIERA di transizione
del §5 — insieme, revoca e barriera rendono definitivo lo stato
osservato dopo il commit (v. §4).

### 2.6 Manifesto canonico e PERIMETRO del batch
**Identità dell'operazione = op_key + manifesto**, e il manifesto è
definito in modo canonico e verificato DAL SERVER:
- serializzazione canonica: JSON con chiavi in ordine lessicografico,
  senza spazi, UTF-8; numeri in forma decimale col punto e senza zeri
  superflui; `null` espliciti; le voci nuove ordinate per `client_ref`;
- contenuto per OGNI operazione, col `kind` sempre incluso:
  · salva: `{kind:'salva', document_id, base_rev, doc_total?,
    bozze{id→campi}, righe{id→campi}, nuove[{client_ref, …payload}]}`;
  · conferma: `{kind:'conferma', document_id, base_rev, correzioni:[…]}`
    con le correzioni COMPLETE ordinate per (draft_id, draft_item_id,
    field);
  · scarto: `{kind:'scarto', document_id, base_rev, motivo}`;
- `manifesto_sha256` = SHA-256 di quel testo. Il client lo calcola e lo
  CUSTODISCE prima dell'invio; il server lo RICALCOLA dai parametri
  ricevuti e registra la PROPRIA impronta — il replay confronta
  documento, base_rev e impronta: stessa chiave con documento o
  revisione o contenuto diversi → `CHIAVE_RIUSATA`, mai un esito
  estraneo (v. §2.2 e §2.3).
**Perimetro verificato riga per riga** (qualunque violazione respinge
TUTTO il batch, niente scritto):
- ogni bozza indicata deve esistere e appartenere a `p_document_id`
  (`family_draft_expenses.document_id`), ogni riga alla sua bozza e
  quindi al documento, ogni voce nuova a una bozza del documento →
  sentinelle `IDENTIFICATIVO_MANCANTE` / `RIFERIMENTO_ESTRANEO`;
- `client_ref` duplicati nel batch → `CLIENT_REF_DUPLICATO`;
- batch vuoto o `p_modifiche` malformato → `MODIFICHE_MALFORMATE`.
**Vettori di prova COMUNI client/server**: un file condiviso di vettori
(input → forma canonica → SHA-256 atteso, casi normali e insidiosi:
numeri con zeri, unicode, null, ordinamenti) verificato SIA dai test
del client SIA dal collaudo SQL — le due canonicalizzazioni devono
produrre la STESSA impronta, altrimenti il replay fallirebbe tra
client e server.

### 2.7 Perché sostituisce la «client_key» della 0023 originaria
Con TUTTE le scritture nel batch giornalato, anche gli INSERT delle voci
nuove sono coperti: identità = `op_key` dell'operazione, mappa
`client_ref → id` nell'esito a giornale. La colonna `client_key` sulla
tabella non serve più (un solo arbitro, un solo percorso di recupero,
meno superficie di permessi). L'evidenza immutabile che nella 0023
faceva da impronta (`client_fingerprint`) qui è il `manifesto_sha256`
dell'intero batch, a giornale.

## 3. Recupero — cosa diventa automatico

Flusso client (`salvaModifiche` diventa UNA chiamata):
- PRIMA dell'invio la custodia locale registra `op_key` (uuid nuovo),
  `base_rev` e il manifesto (come oggi con «in_invio»);
- risposta persa → alla riapertura `esito_revisione(op_key)`:
  · **applicata** → pendenza chiusa, id delle voci nuove dalla mappa,
    `rev` aggiornato; niente gemelle, niente vincoli;
  · **assente** → non applicata FIN QUI: il REINVIO con la STESSA
    op_key e lo STESSO base_rev è sicuro — se l'originale arrivasse
    dopo, uno dei due cade nel replay (stesso esito) o in `SUPERATA`
    (niente scritto). Mai doppioni, mai sovrascritture;
  · **lettura fallita** → pendenza conservata, si riprova (mai
    scambiata per «assente»).
- `SUPERATA` a una schermata → conflitto ESPLICITO: si ricarica (rev
  nuovo) e le modifiche non applicate restano proposte — mai silenzioso.
- Generazioni e custodia locale RESTANO come coordinamento di cortesia
  fra schermate; l'arbitro vero diventa il server.
- Conferma e scarto passano dagli involucri versionati del §2.4: anche
  le loro pendenze si recuperano per `op_key` via `esito_revisione`
  (lo stato del documento resta una verifica in più, non l'unica).

## 4. Pendenze ESISTENTI (pre-contratto) — niente promesse retroattive

Ciò che è partito prima del contratto NON diventa riferibile: nessun
recupero retroattivo automatico, e questa proposta non lo promette.
Però le DUE FASI del §5 CONGELANO il mondo: i respingenti della fase A
chiudono gli ingressi legacy (RPC comprese), la barriera della fase B
DIMOSTRA che le scritture e le chiamate entrate prima sono concluse, e
revoche+sentinelle respingono tutto il resto. Quindi una lettura fresca
DOPO il commit della fase B è definitiva, e le pendenze si chiudono
così — MAI prima che l'intera garanzia sia dimostrata:
- **campi VINCOLATI**: alla prima apertura post-migrazione i valori
  letti sono finali → i vincoli si SCIOLGONO (una tantum, automatico,
  dichiarato nel changelog della schermata);
- **voci incerte/riconosciute** senza chiave: schermata di RISOLUZIONE
  MANUALE una tantum — l'evidenza è congelata: «la voce c'è» → collega
  e CHIUDI la pendenza; «non c'è» → non arriverà più: reinseriscila
  come operazione nuova (giornalata) oppure lasciala perdere. Decide
  l'utente; la pendenza si chiude davvero, la conferma si sblocca.

**Distinzione dichiarata**: recuperabile AUTOMATICAMENTE = ogni
operazione post-contratto (replay/esito per op_key). Richiede
INTERVENTO = le pendenze pre-contratto (risoluzione manuale guidata,
una tantum, su evidenza congelata).

## 5. BARRIERA di transizione e ordine di attivazione

La revoca ferma le richieste che devono ancora superare il controllo
dei permessi, ma NON dimostra che le scritture già in esecuzione siano
terminate — e NON cancella retroattivamente una funzione definer già
ENTRATA: una vecchia conferma_documento che ha superato l'EXECUTE prima
del commit e sta aspettando il lock del documento, dopo il commit
proseguirebbe come proprietario, senza base_rev né giornale. La
transizione è quindi in DUE FASI, entrambe nella pausa applicativa:

**FASE A — si chiudono TUTTI gli INGRESSI legacy (transazione 1):**
`create or replace` sposta VERBATIM in funzioni `private.*` i corpi di
TUTTI i percorsi legacy interessati — `conferma_documento`,
`scarta_documento` E le tre RPC fattura (`approva_fattura_da_pagare`,
`paga_fattura`, `conferma_fattura_pagata`) — e ridefinisce i CINQUE
corpi pubblici come PURI RESPINGENTI (sentinella `PERCORSO_DISMESSO`,
nessun accesso alle tabelle): nessuna finestra in cui una fattura possa
ancora entrare tra fase A e fase B. Le funzioni `private.*` hanno
PERMESSI ESPLICITI: `revoke all … from public, anon, authenticated`
(oltre allo schema `private` non esposto) — nessun percorso alternativo
introdotto: le chiama solo il codice definer del contratto (e, per le
fatture, i futuri involucri della Fase 5). Collaudo di equivalenza dei
corpi spostati nel piano. Le invocazioni già entrate PRIMA continuano
il corpo vecchio (già caricato): le conclude la fase B. Rollback
documentato: un `create or replace` inverso ripristina i cinque corpi
originali (statement pronto nel runbook).

**FASE B — si dimostra la CONCLUSIONE di ciò che era entrato
(transazione 2):**
1. **Pausa applicativa**: come per la 0022 in produzione, a uso fermo
   (conferma esplicita). La pausa è prudenza, non la prova.
2. **Timeout con STOP**: `set local lock_timeout` (pochi secondi) e
   `statement_timeout`: se la barriera non si acquisisce, la
   transazione ABORTISCE senza aver cambiato NULLA (la fase A resta:
   ingressi legacy comunque chiusi) e si riprova — mai attese
   indefinite, mai stati a metà.
3. **CONDIZIONE DI COMPLETAMENTO delle chiamate pregresse — per ETÀ
   delle transazioni, non per attese sulle tabelle**: l'assenza di
   codanti sulle tre tabelle NON dimostra la conclusione (una chiamata
   pre-fase-A può essere sospesa dentro `is_app_member()`, che legge
   `app_members`, PRIMA di toccare le tre tabelle — o addirittura
   prima del suo primo accesso a qualunque tabella; e non basta
   aggiungere `app_members` all'elenco). Il criterio è un altro: al
   commit della fase A si registrano l'istante `t_A` e l'xid corrente;
   la fase B, PRIMA della barriera, attende in poll (con timeout e
   STOP) finché:
   · nessun'altra sessione ha una transazione con `xact_start < t_A`
     (`pg_stat_activity`) — ogni invocazione legacy vive in una
     transazione aperta prima di entrare nella funzione, quindi anche
     una chiamata sospesa nel guard o prima del primo accesso è
     CONTATA finché non conclude;
   · e l'orizzonte `pg_snapshot_xmin(pg_current_snapshot())` ha
     superato l'xid registrato (cintura e bretelle: nessuna
     transazione visibile iniziata prima della fase A è ancora viva).
   Solo a condizione soddisfatta si prosegue; allo scadere del timeout
   → STOP (nulla è cambiato, la fase A resta) e si riprova.
4. **La barriera**: `lock table public.family_documents,
   public.family_draft_expenses, public.family_draft_items in access
   exclusive mode;` — difesa in profondità contro le scritture dirette
   residue: si acquisisce solo a lock altrui rilasciati. (Con la
   condizione del punto 3 già soddisfatta dovrebbe acquisirsi subito.)
5. **Cambio dei permessi coordinato**: revoke/re-grant (§2.4–2.5), DDL
   (giornale, revisione_rev) e RPC nuove in QUESTA transazione, dopo
   condizione e barriera. Al commit niente può più infilarsi tra la
   conclusione dimostrata e la porta chiusa: chi arriva dopo trova
   respingenti (fase A) o permessi revocati (fase B).
6. **Altri detentori di capacità di scrittura**, enumerati:
   · RPC 0020/0022 (definer): restano eseguibili solo nei percorsi
     previsti (involucri §2.4; caricamento 0022 invariato) — la
     conferma/scarto DIRETTI vengono revocati ad authenticated;
   · service_role (elaborazione): BYPASSA i grant per natura — la
     garanzia di congelamento riguarda i percorsi del browser.
     L'elaborazione è FERMA (in attesa della riscrittura «solo bozze»)
     e il suo redesign dovrà mantenere l'invariante «mai scrivere su
     documenti in_revisione»; fino ad allora non gira: dichiarato,
     non dimostrato dal contratto;
   · trigger esistenti: non aprono percorsi nuovi (verifica nel
     collaudo con l'inventario di verificaAudit).
7. **Scioglimento dei vincoli legacy SOLO dopo**: fase A + fase B
   COMMITTATE (la garanzia sulle chiamate legacy entrate è dimostrata
   dalla coppia respingente+barriera, non dalla sola revoca) + una
   RILETTURA FRESCA post-commit (il client riconosce il contratto
   attivo dalla presenza di `revisione_rev`, che nasce nella fase B:
   niente rilevazioni euristiche). Prima di quel momento i vincoli e
   le pendenze restano esattamente come oggi.

**Ordine di attivazione** (il client attuale smetterebbe di salvare
dopo la revoca — è previsto, e la finestra va tenuta corta):
1. pausa dell'uso (Ania conferma);
2. fase A (respingenti) e fase B (barriera+DDL+revoke) — tra le due
   fasi le chiusure legacy sono già respinte: finestra da tenere
   minima, tutta dentro la pausa. Da qui il client VECCHIO non può più
   né salvare né confermare: è il comportamento voluto;
3. deploy IMMEDIATO del client nuovo nella stessa pausa;
4. riapertura dell'uso; prima apertura → scioglimento vincoli (punto 7).
Il client nuovo NON ha ripieghi: se le RPC nuove mancano (migrazione
non ancora applicata) mostra un errore chiaro e non tenta mai le
scritture dirette — nessun percorso che aggiri il contratto, in
nessuna direzione.

## 6. Permessi minimi
- `grant execute` su `salva_revisione` ed `esito_revisione` SOLO ad
  `authenticated` (revoke a `public`/`anon`/`service_role`, pattern 0022);
- `grant execute` su `conferma_revisione`/`scarta_revisione` ad
  `authenticated`; revoke dell'execute DIRETTO di
  `conferma_documento`/`scarta_documento` (corpi pubblici comunque
  ridotti a respingenti, §5 fase A) e delle tre RPC fatture
  (`approva_fattura_da_pagare`, `paga_fattura`,
  `conferma_fattura_pagata`) per `authenticated` (§2.4);
- i revoke/re-grant delle scritture dirette del §2.5; SELECT invariati;
- giornale: nessun accesso diretto dal browser (si passa da
  `esito_revisione`); append-only via trigger anche per service_role.

## 7. Impatto sul codice (dopo il collaudo, autorizzazione separata)
- `revisioneScrittura.salvaModifiche`: batch unico → una RPC; esiti
  `APPLICATA`/`RIPETUTA`/`SUPERATA`/`CHIAVE_RIUSATA` espliciti; il
  recupero per `op_key` sostituisce in_invio→incerta per le operazioni
  nuove; `EsitoRevisione` guadagna il caso «superata: ricarica».
- `revisioneClient/Supabase`: le RPC nuove (salva/esito/conferma/
  scarta versionati, tutte con op_key e base_rev); spariscono
  `aggiorna*`/`aggiungiRiga` diretti e le chiamate dirette alle RPC
  0020; il manifesto canonico e la sua impronta si calcolano col
  medesimo sha256 già usato dal flusso 0022.
- `fonte`: legge `revisione_rev`.
- `revisione.ts`: vincoli e gemelle restano SOLO nel modulo «pendenze
  pre-contratto» per la risoluzione manuale; la custodia locale resta
  (originali/correzioni + op_key/base_rev prima dell'invio).
- `RevisioneSheet`: gate di presa semplificato per i salvataggi (decide
  il giornale), schermata una tantum per le pendenze pre-contratto.

## 8. Piano di collaudo ISOLATO (progetto di prova; autorizzazione separata)
1. **SQL** (stile passo3, transazioni con savepoint): tabella, colonna,
   RPC, trigger append-only (anche service_role), grant e revoke
   EFFETTIVI (matrici verificaAudit; un UPDATE diretto come
   authenticated deve fallire).
2. **RPC**: applicazione; replay con manifesto identico → stesso esito
   e stessa mappa id; manifesto diverso → `CHIAVE_RIUSATA` senza
   scritture (byte per byte); STESSA op_key su DOCUMENTO o revisione
   diversi → `CHIAVE_RIUSATA`, mai l'esito estraneo (e `esito_revisione`
   restituisce documento/base_rev/impronta per il controllo di
   corrispondenza lato client); `base_rev` sbagliato → `SUPERATA` senza
   scritture; documento chiuso → `DOCUMENTO_CHIUSO` senza toccare le
   bozze; batch parzialmente invalido → NIENTE scritto (atomicità);
   campo estraneo → `CAMPO_NON_CONSENTITO`; PERIMETRO: bozza o riga di
   un ALTRO documento → `RIFERIMENTO_ESTRANEO`, id inesistente →
   `IDENTIFICATIVO_MANCANTE`, `client_ref` duplicati →
   `CLIENT_REF_DUPLICATO` — sempre a batch interamente respinto.
3. **Chiusure versionate**: Conferma di A col `base_rev` vecchio dopo
   un Salva di B → `SUPERATA`, nulla approvato; scarto tardivo idem;
   replay della conferma per `op_key` → stesso esito (manifesto con
   kind+correzioni; scarto con kind+motivo); conferma/scarto DIRETTI
   come authenticated → sentinella `PERCORSO_DISMESSO` E execute
   negato (doppia porta, entrambe verificate); EQUIVALENZA dei corpi
   spostati in private (fase A): stessi esiti della 0020 sui casi già
   collaudati; RPC fatture (`approva_fattura_da_pagare`, `paga_fattura`,
   `conferma_fattura_pagata`) come authenticated → execute negato;
   IMPRONTE: i VETTORI COMUNI client/server (§2.6) producono la stessa
   canonicalizzazione e lo stesso SHA-256 da entrambe le parti.
4. **Concorrenza** (allineamento a istante assoluto, stile passo3b):
   due batch identici in parallelo → UNA applicazione; due operazioni
   diverse sullo stesso `base_rev` → una `APPLICATA` e una `SUPERATA`;
   RIUSO CONCORRENTE della stessa op_key su documenti DIVERSI → una
   sola registrazione, l'altra `CHIAVE_RIUSATA`; Salva e Conferma
   concorrenti sullo stesso documento → serializzati dal lock di riga.
5. **Transizione (le due fasi) — TUTTO ANCORA DA DIMOSTRARE in
   ambiente isolato: nulla di questa sezione si può dichiarare
   collaudato prima dell'esecuzione reale.** Casi:
   · una transazione con UPDATE (e una con INSERT) sulle bozze APERTA
     PRIMA e ancora pendente → la fase B attende e, allo scadere del
     timeout, ABORTISCE senza aver cambiato nulla (STOP verificato);
     chiusa la transazione, la fase B passa;
   · RIPRODUZIONE DETERMINISTICA della chiamata sospesa PRIMA delle
     tre tabelle: sessione X apre una transazione e prende un lock
     esclusivo su `app_members`; sessione Y invoca la vecchia
     `conferma_documento` (corpo pre-fase-A) → resta sospesa DENTRO
     `is_app_member()`, senza alcun lock sulle tre tabelle; si esegue
     la fase A; la CONDIZIONE del §5.B.3 (età delle transazioni +
     orizzonte xmin) deve CONTARE la transazione di Y e portare la
     fase B a STOP al timeout; X rilascia → Y conclude col corpo
     vecchio → la fase B ripetuta passa. Da eseguire due volte, come
     gli altri collaudi;
   · una `conferma_documento` (o una RPC fattura) invocata DOPO la
     fase A → sentinella `PERCORSO_DISMESSO` immediata, nessuna attesa
     e nessun effetto — per TUTTI e cinque i nomi pubblici;
   · chiamata diretta a una funzione `private.*` come authenticated →
     permesso negato (nessun percorso alternativo);
   · rollback della fase A (runbook) → i cinque corpi originali
     tornano operativi;
   · una scrittura diretta inviata DOPO il commit della fase B →
     permission denied.
   Verifica infine che il flusso 0022 resti funzionante e che l'UPDATE
   diretto di QUALSIASI colonna di family_documents (kind compreso)
   sia negato.
6. **Cliente**: la suite attuale rigirata sul nuovo flusso con servizio
   finto rigoroso (risposta persa → esito per op_key con controllo di
   corrispondenza; `SUPERATA` → ricarica; lettura dell'esito fallita →
   pendenza conservata; RPC nuove assenti → errore chiaro, MAI ripiego
   sulle scritture dirette; pendenze pre-contratto → risoluzione
   manuale; scioglimento vincoli solo alla lettura con revisione_rev).
7. Solo dopo, con autorizzazioni separate: audit read-only di
   produzione, backup fresco, applicazione con pausa, BARRIERA e
   verifiche pre-commit come per la 0022, e deploy del client nuovo
   nella stessa pausa (ordine del §5).

## 9. Fuori portata / note
- Elaborazione (service role) e fatture restano ferme; il FILE 0020 è
  intatto — la logica di conferma/scarto viene SPOSTATA verbatim in
  private dalla migrazione nuova (§5 fase A) e i percorsi fattura
  vengono negati ad authenticated finché la Fase 5 non li reintroduce
  dentro il contratto versionato.
- Il giornale cresce di una riga per Salva: irrilevante a questi
  volumi; un'eventuale retention è una nota per il futuro, non serve ora.
- Limite residuo dichiarato: la custodia locale (originali e
  correzioni non ancora inviate) resta nel browser del dispositivo —
  invariato rispetto a oggi.
