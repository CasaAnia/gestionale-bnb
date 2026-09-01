# PIANO DI COLLAUDO — bozza 0023 (primitivo atomico «elabora_sostituisci_bozze»)

**Stato: PREPARATO, ESECUZIONE DA AUTORIZZARE.** Nessun passo va lanciato
senza l'autorizzazione esplicita al collaudo isolato; in più ogni passo
ha un CANCELLO (`COLLAUDO_0023_AUTORIZZATO=1` nell'ambiente del comando)
e la guardia anti-produzione (`verificaNonProduzione`) attiva.
La produzione non c'entra: NESSUNA autorizzazione implicita.

## Progetto BERSAGLIO

Esclusivamente il progetto di prova della 2B («gestionale-2b-prova», lo
stesso dei collaudi 0022 e del contratto): il passo 0 lo RIAGGANCIA e si
ferma se non esiste o non è l'unico con quel nome; mai creazioni
automatiche, mai altri progetti. Credenziali: token Management API
TEMPORANEO fornito al momento con la solita procedura (appunti → file
locale fuori repo, permessi 600, cancellato a fine collaudo, revoca
ricordata esplicitamente); per il passo 3 anche la password del db di
prova con la procedura di `collaudo-contratto/passo0b-password.mjs`.
Nessun segreto in chat, log o repository.

## Prerequisiti

- Node ≥ 22.6 (il passo 2 importa il costruttore TypeScript vero).
- `REGISTRO_DIR` esportata (stessa cartella fuori repo dei collaudi
  precedenti): un registro pendente non pulito BLOCCA un giro nuovo.
- Strumenti già VERDI in locale prima di toccare il progetto:
  `node --test scripts/collaudo-bozze/strumenti0023.test.mjs`
  (cancello, conformità statica della bozza ai vincoli R6, giudizio
  della struttura, corpo RPC identico allo strumento reale, ordine di
  pulizia, validazione della fotografia).
- Base 0020–0022 PULITA sul progetto di prova (verificata dal passo 1:
  la funzione 0023 NON deve già esistere). Se non lo è: STOP da capire,
  mai riapplicare la sequenza 2B senza autorizzazione separata.

## SEQUENZA ESATTA (ogni passo: STOP alla prima verifica fallita)

0. `node scripts/fase4/passo0-riaggancia.mjs` — riaggancio + guardia.
0b. `node scripts/collaudo-contratto/passo0b-password.mjs` — password
   del db di prova (serve solo al passo 3; stessa procedura 600).
1. `node scripts/collaudo-bozze/passo1-struttura.mjs`
   — conformità STATICA della bozza (vincoli R6); apre il REGISTRO
   durevole e salva la FOTOGRAFIA DI BASE prima di ogni effetto;
   applica `supabase/proposte/0023_elaborazione_bozze_atomica.BOZZA.sql`
   e verifica la struttura: firma `(uuid, jsonb, text)`, security
   definer, search_path vuoto, EXECUTE al solo service_role (anon,
   authenticated e PUBLIC negati).
2. `node scripts/collaudo-bozze/passo2-comportamento.mjs`
   — comportamento via PostgREST con l'identità service (la via dello
   strumento reale), pacchetto costruito dal COSTRUTTORE VERO:
   anon respinto · giro buono (bozze+righe+doc_total+in_revisione) ·
   ripetizione su in_revisione rifiutata con stato_attuale e archivio
   INVARIATO · marcatura errore con pulizia totale · rielaborazione da
   errore che SOSTITUISCE (mai accumuli) · richieste malformate e
   pacchetti vuoti respinti senza effetti · ROLLBACK TOTALE su vincolo
   violato (fotografia byte per byte, bozze pregresse comprese) ·
   documento inesistente dichiarato.
3. `node scripts/collaudo-bozze/passo3-concorrenza.mjs`
   — caso DETERMINISTICO con sessione pg dedicata: lock del documento
   tenuto da A, la chiamata B resta IN ATTESA (misurato su
   pg_stat_activity), A elabora e committa, B viene rifiutata con lo
   stato già cambiato e UNA sola serie di bozze; più il caso PARALLELO
   via PostgREST: due chiamate simultanee, esattamente una riesce.
4. `node scripts/collaudo-bozze/passo4-pulizia.mjs`
   — pulizia per IDENTIFICATIVI ESATTI dal registro (righe → bozze →
   documenti, funzione per ultima; in questo collaudo nessun documento
   viene mai confermato, quindi niente spese definitive né ponte);
   fotografia finale CONFRONTATA con la base; registro «pulito» SOLO a
   verifiche tutte positive. Idempotente (riparte da `puliziaArrivataA`).

Come per i collaudi precedenti: passi 1–3 eseguiti DUE volte (dopo la
pulizia del passo 4 e la verifica del ritorno alla base) prima di
dichiarare il collaudo superato.

## CONDIZIONI DI STOP (oltre al fallimento di una verifica)

- passo 0: progetto assente/duplicato/non attivo; ref di produzione → STOP.
- passo 1: bozza non conforme ai vincoli R6 in locale → STOP prima di
  toccare il progetto; funzione già presente → STOP (prima passo 4).
- passo 3: la chiamata concorrente NON risulta in attesa sul lock →
  STOP (l'arbitraggio non sta funzionando come promesso).
- qualunque errore inatteso di rete/API → STOP del passo; si rilegge lo
  stato prima di rilanciare (mai rilanci ciechi).

## RECUPERO E PULIZIA IN CASO DI INTERRUZIONE

- interruzione in QUALUNQUE passo: rilanciare il passo 4 (riparte
  dall'istruzione registrata e lavora sui soli id del registro), poi si
  riparte dal passo 1.
- token: cancellazione del file locale a fine collaudo e REVOCA dal
  dashboard; nuovo reset della password del db di prova.
- il report del collaudo (esiti dei passi, due giri) si salva in locale
  e si allega al resoconto; nessun segreto nei log.

## COSA QUESTO COLLAUDO NON AUTORIZZA

Niente produzione: l'applicazione reale della 0023 e l'attivazione dello
strumento `scripts/elabora/elabora-bozze.mjs` (runbook bozze) restano
passaggi separati, ciascuno con la propria autorizzazione esplicita.
