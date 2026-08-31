# PIANO DI COLLAUDO — contratto di revisione + transizione A/B

**Stato: PREPARATO, NON ESEGUITO.** Nessuno di questi passi va lanciato
senza l'autorizzazione esplicita al collaudo isolato. La produzione non
c'entra: NESSUNA autorizzazione implicita, e la guardia anti-produzione
è attiva in ogni script (`verificaNonProduzione`).

## Progetto BERSAGLIO
Esclusivamente il progetto di prova della 2B (nome «gestionale-2b-prova»,
ref exyl**** — lo stesso dei collaudi 0022): il passo 0 lo RIAGGANCIA e
si ferma se non esiste o non è l'unico con quel nome; mai creazioni
automatiche, mai altri progetti. Credenziali: token Management API
TEMPORANEO fornito al momento con la solita procedura (appunti → file
locale fuori repo, permessi 600, cancellato a fine collaudo, revoca
ricordata esplicitamente); nessun segreto in chat, log o repository.

## Prerequisiti tecnici
- Node ≥ 22.6 (i passi 6 importano i moduli TypeScript del client:
  eseguire con `node --experimental-strip-types` se la versione lo
  richiede).
- jwt del membro di prova già presente (`~/.gestionale-2b/jwt-owner.txt`,
  creato da scripts/fase2b/utenti-e-export.mjs; rigenerabile).
- **Password del database del progetto di prova** (passi 4 e 5, sessioni
  pg dirette): canale dichiarato in `passo0b-password.mjs` — reset dal
  dashboard del progetto di prova → appunti → file locale
  `~/.gestionale-2b/db-pass.txt` con permessi 600, MAI in chat o in un
  comando visibile; lo script la sposta in progetto.json (fuori repo) e
  cancella il file; a fine collaudo nuovo reset dal dashboard.
- **`REGISTRO_DIR`** esportata (cartella fuori repo per i registri
  durevoli del collaudo): ogni artefatto viene registrato lì PRIMA di
  essere creato; senza registro i passi 3–7 si fermano.
- **Strumenti già verdi in locale** prima di toccare il progetto:
  `node --test scripts/collaudo-contratto/strumenti.test.mjs`
  (STOP del contatore, quiescenza, falsa presenza di Y, concorrenza non
  valida, fase B in un'unica transazione, fixture con squadratura,
  ripresa della pulizia interrotta).

## SEQUENZA ESATTA (ogni passo: STOP alla prima verifica fallita)

0. `node scripts/fase4/passo0-riaggancia.mjs`
   — riaggancio + guardia; poi `node scripts/fase2b/esegui-sequenza.mjs`
   se la base 0020–0022 non è già pulita sul progetto di prova
   (la sequenza termina SEMPRE ripristinando i grant 0021 e il test di
   sicurezza finale — è la versione corretta dopo il caso del 30/08).
0b. `node scripts/collaudo-contratto/passo0b-password.mjs`
   — incorpora la db_pass dal file 600 e lo cancella (vedi prerequisiti).
1. `node scripts/collaudo-contratto/passo1-contratto.mjs`
   — apre il REGISTRO durevole e vi salva la FOTOGRAFIA DI BASE
   (conteggi, definizioni legacy, permessi) PRIMA di ogni effetto; poi
   applica proposte/contratto-revisione.BOZZA.sql e verifica la
   STRUTTURA: giornale presente e append-only (update E delete respinti
   col messaggio GIORNALE_IMMUTABILE, anche come postgres),
   revisione_rev, matrice dei permessi EFFETTIVI (execute solo ad
   authenticated su 4 funzioni; anon e service_role negati; giornale
   senza accesso diretto; private.canonico/impronta negati).
2. `node scripts/collaudo-contratto/passo2-vettori.mjs`
   — i VETTORI COMUNI: private.canonico/impronta_canonica devono dare
   ESATTAMENTE le forme e le impronte di lib/spese/contrattoVettori.ts,
   compreso il vettore con le correzioni della conferma DA RIORDINARE.
   È il punto più delicato (numeric vs forma minima): qualunque
   scostamento è STOP e torna in revisione della bozza SQL.
3. `node scripts/collaudo-contratto/passo3-comportamento.mjs`
   — comportamento delle RPC nel contesto authenticated (claims+role):
   APPLICATA con mappa · replay RIPETUTA senza doppioni ·
   CHIAVE_RIUSATA per contenuto/documento/kind · SUPERATA anche per
   conferma e scarto tardivi (documento intatto) · lista positiva degli
   stati (approvata_da_pagare respinto) · BOZZA_NON_MODIFICABILE con
   ATOMICITÀ (fotografia identica) · perimetro (estraneo, mancante,
   client_ref duplicato, campo estraneo, malformato) · CHECK 0020 sui
   valori · conferma con quadratura del server (RAISE) e replay con le
   stesse spese · scarto · esito_revisione (applicata/assente).
4. `node scripts/collaudo-contratto/passo4-concorrenza.mjs`
   — sessioni pg dedicate allineate a un ISTANTE ASSOLUTO: identici
   stessa chiave → APPLICATA+RIPETUTA (mai SUPERATA: è il ricontrollo
   post-lock) con UNA sola voce inserita; stessa chiave su documenti
   DIVERSI → APPLICATA+CHIAVE_RIUSATA col ramo PERDENTE byte-per-byte
   IDENTICO allo stato iniziale (documento, bozze, righe, spese,
   giornale) e UNA sola registrazione; Salva⇄Conferma con le SOLE
   coppie coerenti col vincitore (salva vince → SUPERATA per la
   conferma; conferma vince → DOCUMENTO_NON_MODIFICABILE per il salva)
   e i due ordini provati anche FORZATI in sequenza. Ogni caso è
   MISURATO con la validazione della 0022 (pid e finestre al
   microsecondo anche sugli errori): senza sovrapposizione effettiva
   l'esito è NON_VALIDO e il passo fallisce.
5. `node scripts/collaudo-contratto/passo5-transizione.mjs`
   — SOLO progetto di prova: 5.1 fase A applicata e verificata
   (spostamento VERBATIM, respingenti P0001 sui cinque nomi, private
   negate) e ROLLBACK dal runbook provato (originali byte per byte);
   5.2 riproduzione DETERMINISTICA della chiamata sospesa dentro
   is_app_member (lock su app_members): la condizione della fase B per
   ETÀ delle transazioni la CONTA → STOP; il post-fase-A riceve il
   respingente SENZA attese; al rilascio la pregressa conclude col
   corpo vecchio e la condizione passa; 5.3 fase B (timeout, barriera,
   revoche con le firme lette da pg_proc, ripuntamento degli involucri
   alle copie private generato dalla bozza del contratto — unica fonte)
   e verifiche post-commit (scritture dirette negate, doppia porta,
   conferma_revisione verde via private).
6. `node scripts/collaudo-contratto/passo6-cliente.mjs`
   — il CLIENT VERO (contrattoRpc + contrattoScrittura, lo stesso
   codice dei test locali) su PostgREST col jwt del membro: giro
   completo con mappa, replay, esito_revisione vero, quadratura del
   server come rifiuto DIMOSTRATO (SQLSTATE P0001 dal trasporto),
   SUPERATA reale, reinvio dalla richiesta custodita, e il RECUPERO
   COMPLETO: risposta PERSA nel trasporto DOPO l'effetto reale →
   pendenza custodita → custodia serializzata e ricreata →
   recuperaOperazione chiude sul giornale vero con la mappa.
7. `node scripts/collaudo-contratto/passo7-pulizia.mjs`
   — pulizia per IDENTIFICATIVI ESATTI dal registro (mai per nome):
   smonta la transizione nell'ORDINE sicuro (originali dal backup →
   ri-grant 0021 ed execute legacy → verifica → via le copie private →
   backup per ULTIMO), esegue il piano (DROP del giornale, mai DELETE
   contro il trigger; spese/ponte/bozze/righe/documenti dei SOLI docIds
   registrati) annotando il progresso nel registro; alla fine rifà la
   fotografia e la CONFRONTA con quella di base: se non coincidono la
   pulizia NON è verde.

Come per la 0022: passi 1–6 eseguiti DUE volte (dopo la pulizia del
passo 7 e il ripristino della base) prima di dichiarare il collaudo
superato.

## CONDIZIONI DI STOP (oltre al fallimento di una verifica)
- passo 0: progetto assente/duplicato/non attivo; ref di produzione
  (guardia) → STOP immediato, nessuna scrittura.
- vettori (passo 2) non identici → STOP: la bozza SQL torna in
  revisione, non si prosegue coi comportamenti.
- passo 5.2: se la condizione NON conta la chiamata sospesa → STOP
  (il criterio della fase B è sbagliato: si torna alla proposta).
- timeout della fase B (lock_timeout/statement_timeout) → STOP
  intrinseco: la transazione abortisce senza aver cambiato nulla.
- qualunque errore inatteso di rete/API → STOP del passo; si rilegge lo
  stato prima di rilanciare (mai rilanci ciechi).

## RECUPERO E PULIZIA IN CASO DI INTERRUZIONE
- interruzione in QUALUNQUE passo (pulizia compresa): rilanciare il
  passo 7 — riparte dall'istruzione registrata (`puliziaArrivataA`) e
  lavora sui soli identificativi del registro; poi si riparte dal
  passo 1. L'azzeramento della 2B NON è un ripiego ordinario: solo su
  autorizzazione esplicita, se il registro risultasse perso o corrotto.
- interruzione nel passo 5 con fase A applicata e fase B no: gli
  ingressi legacy restano respinti SUL PROGETTO DI PROVA (nessun
  effetto altrove); il rollback del runbook è nel passo 7 e in coda
  alla bozza fase A.
- token: cancellazione del file locale a fine collaudo e promemoria
  esplicito di REVOCA dal dashboard (come per i collaudi precedenti).
- il report del collaudo (esiti dei passi, due giri) viene salvato in
  locale e allegato al resoconto; nessun segreto nei log.

## COSA QUESTO COLLAUDO NON AUTORIZZA
Niente produzione: l'applicazione reale di contratto e transizione
richiederà, come per la 0022, un'autorizzazione separata con pausa,
audit read-only, backup fresco verificato e runbook dedicato.
