# PROPOSTA 0023 — chiave idempotente per le righe di bozza

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

### Unicità e immutabilità
- Indice unico parziale:
  `create unique index family_draft_items_client_key_uq
   on public.family_draft_items (client_key) where client_key is not null;`
- Trigger BEFORE UPDATE (funzione in `private`, stile
  `proteggi_manifesto_caricamento` della 0022): `client_key` è
  IMMUTABILE una volta scritta — blocco anche per service_role. La riga
  resta correggibile in tutti gli altri campi.

### Comportamento
- **INSERT normale**: `insert` semplice col payload attuale +
  `client_key`. **MAI upsert**: un conflitto non deve mai aggiornare
  implicitamente la riga esistente.
- **Riuso della chiave** (retry dopo risposta persa, doppio invio da
  due schede): l'indice unico produce `unique_violation`; il client la
  interpreta come «operazione già registrata», recupera l'id con
  `select id from family_draft_items where client_key = $1` e chiude la
  pendenza come 'salvata'. Nessuna scrittura al secondo giro.
- **Riuso con contenuto diverso**: impossibile per costruzione lato
  nostro (una chiave = una operazione, custodita col suo payload); se
  accadesse comunque, l'esito è lo stesso — conflitto, NESSUN update,
  la riga esistente resta intatta e il client segnala l'anomalia
  («chiave già usata da un'altra operazione») senza toccare nulla.
- **Righe successivamente corrette**: l'identità sta nella chiave, non
  nel contenuto — il recupero NON confronta più i campi (il confronto
  «tutti i campi identici» dell'attuale gemella muore qui): una riga
  già corretta resta riconoscibile.
- **Recupero dopo risposta persa**: alla riapertura (o su «Riprova»),
  per ogni pendenza `in_invio`/`incerta` con chiave: `select id where
  client_key = …`. Trovata → 'salvata' (id adottato); non trovata → la
  richiesta non è arrivata *fin qui*; il reinvio con la STESSA chiave è
  sicuro: se la vecchia richiesta si completasse dopo, una delle due
  prende `unique_violation` e si risolve da sola. L'ambiguità residua
  di oggi sparisce.
- **Concorrenza**: arbitrata dall'indice unico; niente advisory lock.

### Privilegi minimi (SQL nuovo richiesto)
1. `alter table public.family_draft_items add column client_key uuid;`
2. l'indice unico parziale di cui sopra;
3. la funzione `private.proteggi_client_key()` + trigger BEFORE UPDATE;
4. ESTENSIONE del grant di INSERT per `authenticated` alla sola colonna
   `client_key` (nuovo statement nella 0023 — la 0021 non si modifica):
   `grant insert (client_key) on public.family_draft_items to authenticated;`
   Nessun grant di UPDATE su `client_key` (immutabile comunque per trigger).
   Nessun altro privilegio cambia.

### Modifiche client (solo dopo la migrazione)
- `payloadRigaNuova` aggiunge `client_key = idLocale`;
- `revisioneClient.aggiungiRiga` gestisce `unique_violation` →
  `{ id }` recuperato per chiave (esito «già registrata»);
- `salvaModifiche`: il recupero per chiave sostituisce lo stato
  'incerta' per le righe con chiave; gemella/riconosciuta restano solo
  per le pendenze storiche senza chiave;
- `blocchiConferma`: il blocco «senza esito verificabile» decade per le
  pendenze con chiave (sempre verificabili).

## Piano di collaudo ISOLATO (progetto di prova, autorizzazione separata)

1. **SQL** (stile passo3 della 0022, in transazioni con savepoint):
   colonna presente e nullable; indice unico parziale (nome e predicato
   esatti); trigger che blocca l'UPDATE di client_key anche come
   service_role; grant effettivi per colonna (matrice
   `has_column_privilege` come in verificaAudit: authenticated può
   INSERT ma non UPDATE della colonna; anon nulla).
2. **Comportamento**: insert con chiave → ok; stesso insert ripetuto →
   `unique_violation` + recupero per chiave dello STESSO id; riuso con
   contenuto diverso → conflitto, riga esistente INTATTA (byte per
   byte); riga corretta dopo l'insert → ancora recuperabile per chiave;
   due insert CONCORRENTI con la stessa chiave (batch paralleli, stile
   passo3b) → esattamente una riga.
3. **Client**: i test attuali di revisione rigirati sul nuovo flusso
   (risposta persa → recupero per chiave, mai gemelle), con servizio
   finto che riproduce `unique_violation`.
4. **Audit**: matrici di verificaAudit aggiornate (colonna, indice,
   trigger, grant) e ricontrollate due volte, come per la 0022.

## Cosa NON cambia
- Le righe del flusso di elaborazione (service role) e quelle storiche:
  `client_key` resta NULL, nessun obbligo retroattivo.
- La RPC `conferma_documento`, la 0020, la 0021, la 0022.
