# PROPOSTA COORDINATA — recupero completo della revisione dopo un'interruzione

**Stato: PROPOSTA, nessun SQL scritto né applicato.** Le migrazioni
storiche (0020–0022) non si toccano. Collaudo isolato e applicazione in
produzione richiederanno autorizzazioni separate, con le stesse cautele
della 0022. Questo documento COORDINA e SOSTITUISCE la proposta
«client_key» di PROPOSTA-0023-CHIAVE-IDEMPOTENTE.md (v. §3).

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
  family_documents` · `base_rev bigint not null` ·
  `manifesto_sha256 text not null` (impronta del payload canonico) ·
  `esito jsonb not null` (contiene `rev_dopo` e la mappa
  `righe_nuove: [{client_ref, id}]`) · `created_at` · `created_by`.
  Trigger di IMMUTABILITÀ (niente update/delete, nemmeno service_role —
  pattern del registro correzioni e del manifesto 0022).
- Nuova colonna `public.family_documents.revisione_rev bigint not null
  default 0`: la versione del documento ai fini della revisione.

### 2.2 RPC `public.salva_revisione(p_op_key uuid, p_document_id uuid, p_base_rev bigint, p_modifiche jsonb)`
Security definer, `search_path=''`, guardia `is_app_member`, advisory
lock per documento (pattern 0022). UN SOLO batch atomico per l'intero
Salva (totale + campi bozze + campi righe + voci nuove):
1. **Replay**: `op_key` già a giornale → se `manifesto_sha256` coincide
   restituisce l'ESITO ORIGINALE («RIPETUTA», stessa mappa di id, senza
   scrivere nulla); se differisce → sentinella `CHIAVE_RIUSATA`, niente
   scritto.
2. **Versione**: `p_base_rev <> revisione_rev` → sentinella `SUPERATA`,
   niente scritto. Ferma sia la schermata rimasta indietro sia il
   duplicato tardivo (che comunque, se identico, cade nel replay).
3. **Applicazione atomica**: whitelist ESPLICITA dei campi (gli stessi
   insiemi della 0021: bozze, righe, doc_total; voci nuove col payload
   delle colonne concesse — ogni voce porta un `client_ref` locale nel
   manifesto e l'esito restituisce `client_ref → id`). Campo estraneo →
   sentinella `CAMPO_NON_CONSENTITO`, niente scritto. I vincoli 0020
   (NOT NULL, check) restano la rete di sicurezza. Tutto o niente:
   spariscono i salvataggi parziali.
4. **Chiusura**: scrive il giornale, incrementa `revisione_rev`,
   restituisce `{esito:'APPLICATA', rev_dopo, righe_nuove}`.

### 2.3 RPC `public.esito_revisione(p_op_key uuid)`
Sola lettura del giornale (membri): `{stato:'applicata', esito}` oppure
`{stato:'assente'}`. È l'ESITO RIFERIBILE all'operazione: la presenza a
giornale, non un confronto di valori. **Lettura fallita ≠ assente**: un
errore mantiene la pendenza.

### 2.4 Chiusura della porta alle scritture dirette
Statement NUOVI nella migrazione (la 0021 non si modifica):
- `revoke update, insert on public.family_draft_expenses from authenticated;`
- `revoke update, insert on public.family_draft_items from authenticated;`
- su `family_documents`: revoke dell'UPDATE e re-grant delle sole
  colonne del flusso fatture futuro
  (`kind, supplier, invoice_number, document_date, due_date, note`) —
  **`doc_total` esce dal grant**: si scrive solo via RPC.
  L'INSERT dei documenti e tutto il flusso di caricamento 0022 restano
  invariati.
Conseguenza decisiva: una richiesta diretta rimasta per aria — anche di
una sessione precedente alla migrazione — quando arriva trova i permessi
verificati ALL'ESECUZIONE e viene rifiutata. È questo, non una lettura,
a rendere definitivo lo stato osservato (v. §4).

### 2.5 Perché sostituisce la «client_key» della 0023 originaria
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
- Conferma e scarto: già idempotenti e riferibili (RPC 0020 con stato
  del documento osservabile) — invariati; il gate di presa in carico
  per loro resta quello attuale (stato effettivo del documento).

## 4. Pendenze ESISTENTI (pre-contratto) — niente promesse retroattive

Ciò che è partito prima del contratto NON diventa riferibile: nessun
recupero retroattivo automatico, e questa proposta non lo promette.
Però il §2.4 CONGELA il mondo: dopo la migrazione nessuna scrittura
diretta pre-contratto può più arrivare. Quindi UNA lettura
post-migrazione è definitiva, e le pendenze si chiudono così:
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

## 5. Permessi minimi
- `grant execute` su `salva_revisione` ed `esito_revisione` SOLO ad
  `authenticated` (revoke a `public`/`anon`/`service_role`, pattern 0022);
- i revoke/re-grant del §2.4; SELECT sulle tabelle invariati;
- giornale: nessun accesso diretto dal browser (si passa da
  `esito_revisione`); append-only via trigger anche per service_role.

## 6. Impatto sul codice (dopo il collaudo, autorizzazione separata)
- `revisioneScrittura.salvaModifiche`: batch unico → una RPC; esiti
  `APPLICATA`/`RIPETUTA`/`SUPERATA`/`CHIAVE_RIUSATA` espliciti; il
  recupero per `op_key` sostituisce in_invio→incerta per le operazioni
  nuove; `EsitoRevisione` guadagna il caso «superata: ricarica».
- `revisioneClient/Supabase`: due nuove RPC; spariscono
  `aggiorna*`/`aggiungiRiga` diretti.
- `fonte`: legge `revisione_rev`.
- `revisione.ts`: vincoli e gemelle restano SOLO nel modulo «pendenze
  pre-contratto» per la risoluzione manuale; la custodia locale resta
  (originali/correzioni + op_key/base_rev prima dell'invio).
- `RevisioneSheet`: gate di presa semplificato per i salvataggi (decide
  il giornale), schermata una tantum per le pendenze pre-contratto.

## 7. Piano di collaudo ISOLATO (progetto di prova; autorizzazione separata)
1. **SQL** (stile passo3, transazioni con savepoint): tabella, colonna,
   RPC, trigger append-only (anche service_role), grant e revoke
   EFFETTIVI (matrici verificaAudit; un UPDATE diretto come
   authenticated deve fallire).
2. **RPC**: applicazione; replay con manifesto identico → stesso esito
   e stessa mappa id; manifesto diverso → `CHIAVE_RIUSATA` senza
   scritture (byte per byte); `base_rev` sbagliato → `SUPERATA` senza
   scritture; batch parzialmente invalido → NIENTE scritto
   (atomicità); campo estraneo → `CAMPO_NON_CONSENTITO`.
3. **Concorrenza** (allineamento a istante assoluto, stile passo3b):
   due batch identici in parallelo → UNA applicazione; due operazioni
   diverse sullo stesso `base_rev` → una `APPLICATA` e una `SUPERATA`.
4. **Richieste tardive**: scrittura diretta «pre-contratto» simulata
   dopo i revoke → permission denied; verifica che il flusso 0022 e le
   colonne fatture residue restino funzionanti.
5. **Cliente**: la suite attuale rigirata sul nuovo flusso con servizio
   finto rigoroso (risposta persa → esito per op_key; `SUPERATA` →
   ricarica; lettura dell'esito fallita → pendenza conservata; pendenze
   pre-contratto → risoluzione manuale).
6. Solo dopo, con autorizzazioni separate: audit read-only di
   produzione, backup fresco, applicazione con pausa e verifiche
   pre-commit come per la 0022.

## 8. Fuori portata / note
- Elaborazione (service role) e fatture restano ferme; le RPC 0020 di
  conferma/scarto non cambiano.
- Il giornale cresce di una riga per Salva: irrilevante a questi
  volumi; un'eventuale retention è una nota per il futuro, non serve ora.
- Limite residuo dichiarato: la custodia locale (originali e
  correzioni non ancora inviate) resta nel browser del dispositivo —
  invariato rispetto a oggi.
