# PROPOSTA 0023 — chiave idempotente per le righe di bozza

**SUPERATA (01/09/2026): assorbita dalla proposta coordinata
PROPOSTA-RECUPERO-REVISIONE.md**, che copre in un unico contratto anche
gli UPDATE della revisione e le pendenze esistenti (giornale delle
operazioni + versione del documento; la colonna client_key non serve
più). Questo file resta come storia della progettazione.

**Stato: PROPOSTA, non implementata.** Nessuna migrazione scritta né
applicata; le migrazioni storiche (0020–0022) non si toccano. Il collaudo
avverrebbe SOLO nel progetto di prova isolato, con autorizzazione
separata; la produzione con un'altra autorizzazione ancora.

## Problema che chiude

Oggi l'INSERT di una voce aggiunta a mano nella revisione non ha
un'identità riconoscibile dal database: se la risposta si perde, nessuna
lettura successiva può DIMOSTRARE se la richiesta sia arrivata, né
escludere che si completi più tardi. Le difese attuali (custodia
«in_invio» prima dell'invio, stato «incerta», gemella solo proposta,
blocco esplicito della conferma) eliminano i reinvii automatici ma NON
l'ambiguità: la chiudono rimandando all'utente o bloccando.

## Progetto

### Identità stabile dell'operazione
- Nuova colonna `client_key uuid` su `public.family_draft_items`,
  NULL per le righe esistenti e per quelle create dal flusso di
  elaborazione (service role): la chiave riguarda SOLO gli inserimenti
  dal browser.
- La chiave nasce NEL BROWSER, una per operazione (è l'attuale
  `idLocale`, già un `crypto.randomUUID()`), e viene CUSTODITA nella
  traccia durevole PRIMA dell'invio — esattamente come oggi: il flusso
  client cambia solo nel payload (aggiunge `client_key`).

### Evidenza immutabile: chiave + IMPRONTA del payload originale
La sola chiave non basterebbe a tenere insieme tre promesse (recupero
senza confronto di contenuto; riconoscere il riuso con contenuto
diverso; recupero corretto dopo modifiche legittime alla riga): il
contenuto della riga CAMBIA legittimamente con le correzioni, quindi
qualunque confronto coi campi correnti non distingue «riga mia,
corretta» da «chiave riusata da un'altra operazione». Per questo accanto
alla chiave viaggia una SECONDA evidenza, anch'essa immutabile:
- `client_fingerprint text` = SHA-256 del payload ORIGINALE dell'INSERT
  (JSON canonico: chiavi ordinate, i soli campi del payload 0021),
  calcolata dal browser e CUSTODITA nella traccia insieme alla chiave,
  PRIMA dell'invio.
Il recupero confronta l'impronta registrata sul database con quella
custodita: coincidono → è la MIA operazione (anche se la riga è stata
poi corretta: l'impronta non cambia mai); non coincidono → VERO riuso
della chiave da parte di un'altra operazione, anomalia dichiarabile.
Senza l'impronta questa distinzione NON sarebbe rilevabile: la garanzia
«segnalo il riuso» esiste solo grazie a questa colonna.

### Unicità e immutabilità
- Indice unico parziale:
  `create unique index family_draft_items_client_key_uq
   on public.family_draft_items (client_key) where client_key is not null;`
- Trigger BEFORE UPDATE (funzione in `private`, stile
  `proteggi_manifesto_caricamento` della 0022): `client_key` E
  `client_fingerprint` sono IMMUTABILI una volta scritte — blocco anche
  per service_role. La riga resta correggibile in tutti gli altri campi.

### Comportamento
- **INSERT normale**: `insert` semplice col payload attuale +
  `client_key` + `client_fingerprint`. **MAI upsert**: un conflitto non
  deve mai aggiornare implicitamente la riga esistente.
- **Riuso della chiave** (retry dopo risposta persa, doppio invio da
  due schede): l'indice unico produce `unique_violation`; il client
  legge `select id, draft_id, client_fingerprint from family_draft_items
  where client_key = $1` e confronta:
  · impronta uguale E `draft_id` uguale a quello atteso (custodito) →
    «operazione già registrata»: id adottato, pendenza chiusa 'salvata';
  · impronta o bozza DIVERSE → anomalia «chiave riusata da un'altra
    operazione»: NESSUNA scrittura, riga esistente intatta, pendenza
    conservata e segnalazione esplicita all'utente.
- **Righe successivamente corrette**: l'identità sta in chiave+impronta
  (immutabili), non nel contenuto corrente — una riga già corretta resta
  riconoscibile; il confronto «tutti i campi identici» dell'attuale
  gemella muore qui.
- **Recupero dopo risposta persa**: alla riapertura, per ogni pendenza
  `in_invio`/`incerta` con chiave: la stessa SELECT per chiave con
  verifica di impronta e bozza. Trovata e coerente → 'salvata'; trovata
  ma incoerente → anomalia dichiarata (pendenza conservata); NON trovata
  → non arrivata *fin qui*: il reinvio con la STESSA chiave e la STESSA
  impronta è sicuro (se la vecchia richiesta si completasse dopo, una
  delle due prende `unique_violation` e si riconduce al caso sopra).
- **LETTURA FALLITA ≠ recupero riuscito**: se la SELECT di verifica
  fallisce (rete, permessi), la pendenza RESTA incerta e continua a
  bloccare — avere la chiave non è avere la risposta.
- **Pendenze STORICHE senza chiave**: le righe inviate prima della 0023
  non diventano identificabili retroattivamente — restano nel regime
  attuale (annotazione «riconosciuta» o blocco esplicito): la 0023 non
  promette nulla sul passato.
- **Concorrenza**: arbitrata dall'indice unico; niente advisory lock.

### Privilegi minimi (SQL nuovo richiesto)
1. `alter table public.family_draft_items add column client_key uuid,
   add column client_fingerprint text;`
2. l'indice unico parziale di cui sopra;
3. la funzione `private.proteggi_client_key()` + trigger BEFORE UPDATE
   (immutabilità di entrambe le colonne);
4. ESTENSIONE del grant di INSERT per `authenticated` alle sole colonne
   `client_key, client_fingerprint` (nuovo statement nella 0023 — la
   0021 non si modifica):
   `grant insert (client_key, client_fingerprint) on public.family_draft_items to authenticated;`
   Nessun grant di UPDATE sulle due colonne (immutabili comunque per
   trigger); la SELECT per i membri esiste già. Nessun altro privilegio
   cambia.

### Modifiche client (solo dopo la migrazione)
- `payloadRigaNuova` aggiunge `client_key = idLocale`;
- `revisioneClient.aggiungiRiga` gestisce `unique_violation` →
  `{ id }` recuperato per chiave (esito «già registrata»);
- `salvaModifiche`: il recupero per chiave sostituisce lo stato
  'incerta' per le righe con chiave; gemella/riconosciuta restano solo
  per le pendenze storiche senza chiave;
- `blocchiConferma`: per una pendenza CON chiave il blocco decade SOLO
  dopo un recupero RIUSCITO e coerente (id trovato, impronta e bozza
  corrispondenti — oppure «non trovata» seguita da un reinvio andato a
  buon fine con la stessa chiave). La semplice PRESENZA della chiave non
  sblocca nulla: finché la lettura di verifica fallisce o dà un esito
  incoerente, la pendenza resta e blocca.

## Piano di collaudo ISOLATO (progetto di prova, autorizzazione separata)

1. **SQL** (stile passo3 della 0022, in transazioni con savepoint):
   colonne presenti e nullable; indice unico parziale (nome e predicato
   esatti); trigger che blocca l'UPDATE di client_key E
   client_fingerprint anche come service_role; grant effettivi per
   colonna (matrice `has_column_privilege` come in verificaAudit:
   authenticated può INSERT ma non UPDATE delle due colonne; anon nulla).
2. **Comportamento**: insert con chiave+impronta → ok; stesso insert
   ripetuto → `unique_violation` + recupero per chiave dello STESSO id
   con impronta e bozza coerenti; chiave riusata con impronta DIVERSA →
   conflitto, riga esistente INTATTA (byte per byte), anomalia
   rilevata; riga corretta dopo l'insert → ancora riconosciuta come
   propria (impronta immutata); riga della bozza SBAGLIATA → anomalia;
   due insert CONCORRENTI con la stessa chiave (batch paralleli, stile
   passo3b) → esattamente una riga.
3. **Client**: i test attuali di revisione rigirati sul nuovo flusso
   (risposta persa → recupero per chiave+impronta, mai gemelle per le
   pendenze nuove; lettura di verifica FALLITA → pendenza conservata;
   pendenze storiche senza chiave → regime attuale invariato), con
   servizio finto che riproduce `unique_violation` e i guasti di rete.
4. **Audit**: matrici di verificaAudit aggiornate (colonna, indice,
   trigger, grant) e ricontrollate due volte, come per la 0022.

## Cosa NON copre (esplicito)
- **Gli UPDATE della revisione** (totale, campi delle bozze e delle
  righe esistenti): questa proposta riguarda SOLO gli INSERT delle voci
  nuove. L'esito di un UPDATE rimasto per aria resta non riferibile
  all'operazione anche con la 0023: il regime locale dei CAMPI
  VINCOLATI alla presa in carico resta in vigore. Se si vorrà chiudere
  anche quello, servirà un'ULTERIORE proposta separata (per esempio una
  colonna di versione per riga o un registro delle operazioni lato
  database) — non è disegnata qui e non va data per prevista.

## Cosa NON cambia
- Le righe del flusso di elaborazione (service role) e quelle storiche:
  `client_key` resta NULL, nessun obbligo retroattivo.
- La RPC `conferma_documento`, la 0020, la 0021, la 0022.
