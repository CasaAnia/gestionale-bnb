# Consegna attiva — elaborazione «solo bozze»

Il blocco precedente (revisione recuperabile B1–B5) è CHIUSO IN LOCALE:
verbale e storico completo in `CONSEGNE-ARCHIVIO-B1-B5.md` ed esito nel
piano. Questa scheda definisce il blocco successivo previsto dal metodo
(COLLABORAZIONE.md §6.2) e dal piano funzionale (§8-②).

## Identità e perimetro

- Base: `fb46660` più il verbale di chiusura.
- Stato: CORRETTO, PRONTO PER LA VERIFICA DEL REVISORE — i tre gruppi
  bloccanti della revisione (verbale in fondo) sono chiusi in un unico
  giro locale: esiti nella sezione «Chiusura dei rilievi R1–R3».
  Data effettiva dell'autorizzazione locale all'implementazione:
  31/08/2026 (il 02/09 scritto in precedenza era un refuso).
- Implementatore: Claude. Revisore: Codex. Stessi ruoli, stessa scheda.
- Obiettivo utente: la foto di uno scontrino diventa una PROPOSTA
  CONTROLLABILE (bozze con dubbi dichiarati) che Ania rivede e conferma
  dalla schermata già consegnata; NESSUNA spesa definitiva nasce più
  dall'estrazione. È il pezzo che oggi manca fra «carico la foto» e
  «rivedo e confermo».
- Perimetro TECNICO del blocco (tutto LOCALE):
  · lib pura `elaborazioneBozze` — dal risultato di lettura di un
    documento (testo/JSON dell'estrazione) al PACCHETTO DI BOZZE:
    una draft per ambito (misto → sorelle), righe con raw_name, qty,
    unit_price, discount, amount, group_id, canoniche per id,
    confidence PER CAMPO con doubt_reason, arrotondamento; doc_total
    sul documento; stati SOLO da_elaborare → in_revisione | errore.
  · scrittore delle bozze con la disciplina di sempre (esiti
    controllati, mai successi simulati) e PERIMETRO RIGIDO: whitelist
    delle sole tabelle bozze/documento — family_expenses e
    family_expense_items strutturalmente irraggiungibili dal modulo.
  · regole della casa incorporate dalla memoria approvata
    (sottocategoria mai vuota, sconti incorporati nel prezzo, voce
    unica Acqua/Ciliegie, sacchetti a parte, Esselunga→Casa, note di
    Ania rispettate; nota ambigua su foto multipla = dubbio dichiarato,
    mai indovinato).
  · idempotenza e duplicati: documento rielaborabile SOLO da
    'da_elaborare'/'errore' (mai bozze doppie); sha256 dei file →
    «possibile duplicato di …» annotato, MAI scarto automatico.
  · aggiornamento del runbook di elaborazione (il flusso con cui
    l'assistente elabora gli scontrini veri) per usare il nuovo
    modulo: documentato nel blocco, ATTIVATO sull'ambiente vero solo
    con un via libera esplicito successivo.
- FUORI perimetro: fatture (blocco dedicato), OCR/API AI a pagamento
  (l'elaboratore resta l'assistente, senza costi per chiamata),
  qualunque migrazione o modifica a RPC/permessi (le tabelle bozze e i
  grant 0021 esistono già), transizione del contratto, push, deploy.
  Nessuna rimozione dell'esenzione del service role in questo blocco
  (passo del runbook di produzione, autorizzazione separata).

## Casi di accettazione — provare il giro completo

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| E01 | Estrazione di uno scontrino MISTO → pacchetto: 2 bozze sorelle con destinatari, righe complete (raw_name, qty/unit_price/discount/amount, canoniche per id, group_id per riga dove serve), confidence con doubt_reason sui campi incerti, arrotondamento per sorella, doc_total sul documento, stato in_revisione. NESSUNA scrittura su spese definitive. | test locale su archivio finto | Test `E01` (elaborazioneBozze.test.ts): misto → 2 sorelle, righe complete con raw_name/canoniche/confidence e motivi, esclusa conservata, doc_total 12,50, in_revisione; archivio finto senza tabelle spese. VERDE. |
| E02 | Vincoli e controlli: quadratura esatta o dubbio dichiarato sul totale; qty>0, discount≥0, amount≥0, sottocategoria MAI vuota; campo fuori whitelist → pacchetto rifiutato dal costruttore con motivo. | test locale | Test `E02`: quadratura che non torna senza dubbio → RIFIUTO col conteggio esatto; con dubbio dichiarato passa; sottocategoria vuota, canonica incoerente, qty 0, metodo azienda mancante, totale null senza dubbio → rifiuti espliciti. VERDE. |
| E03 | Idempotenza: documento già in_revisione/confermato → l'elaborazione RIFIUTA (mai bozze duplicate); documento in errore → rielaborazione che sostituisce le bozze precedenti dello stesso documento, con esito annotato. | test locale | Test `E03`: in_revisione/confermato → rifiutata senza scritture; errore → rielaborazione che SOSTITUISCE (2 bozze, 5 righe, mai accumuli). VERDE. |
| E04 | Lettura fallita o incompleta → documento 'errore' con error_message utile; nessuna bozza parziale lasciata in giro. | test locale | Test `E04`: lettura fallita → errore col motivo e zero bozze; guasto a metà delle righe → bozze ritirate, documento in errore «elaborazione interrotta». VERDE. |
| E05 | Duplicato per sha256 di un file già elaborato → «possibile duplicato di …» annotato sul documento; l'elaborazione continua e la decisione resta ad Ania in revisione (scarto sempre manuale). | test locale | Test `E05`: duplicato dal contesto → dubbio «possibile duplicato di …» sulla prima sorella, elaborazione CONCLUSA in_revisione (scarto mai automatico). VERDE. |
| E06 | La nota di Ania sul documento guida l'esito (ambito/gruppo forzato); nota che può riferirsi a UN solo scontrino della foto → dubbio dichiarato sugli altri, mai indovinato. | test locale | Test `E06`: notaNonAttribuita → dubbio «nota di Ania non attribuibile con certezza», mai ipotesi silenziosa. VERDE. |
| E07 | PERIMETRO: qualunque tentativo del pacchetto di toccare family_expenses/family_expense_items è strutturalmente impossibile (whitelist dello scrittore provata con controprova). | test locale | Test `E07` (controprova): scrittore-esca con metodi delle spese definitive → il modulo chiama SOLO i 5 metodi whitelisted. VERDE. In più: whitelist delle tabelle anche nello strumento reale (scripts/elabora). |
| E08 | Giro UI in demo (390 px, entrambi gli ambiti): documento «da elaborare» finto → elaborazione simulata → compare in «Da controllare» coi dubbi → revisione → conferma con la schermata consegnata; errore di elaborazione visibile con motivo. | schermata simulata | UI sul dev server sintetico: ?elabora=1 → la card «Da controllare · 2 campi dubbi» e TUTTA la revisione derivano dall output del costruttore VERO (dubbi 55%/60%, esclusa, ×2, arrotondamento, ✓ quadra) → Conferma riuscita; ?elabora=errore → card in ERRORI con il motivo esatto del modulo («quadratura non esatta … nessun dubbio dichiarato») e niente in Da controllare. Banner esplicativo in pagina. VERDE (limite: la demo passa dal costruttore puro, sincrono; l orchestratore è coperto dai test E01–E07). |
| E09 | Runbook dell'elaborazione reale aggiornato al nuovo modulo (bozze, mai spese), con il passo di attivazione segnato DA AUTORIZZARE. | documento | RUNBOOK-ELABORAZIONE-BOZZE.md + scripts/elabora/elabora-bozze.mjs: strumento con CANCELLO di attivazione (senza ELABORAZIONE_BOZZE_ATTIVA=1 si rifiuta PRIMA di toccare qualunque cosa — provato), modalità --prova senza scritture, whitelist delle tabelle, duplicati da sha256 delle ricevute. NON eseguito contro il database (attivazione DA AUTORIZZARE). FATTO. |

## Prove di consegna

- Comando tecnico condiviso: `node scripts/verifica-consegna.mjs
  --base fb46660` su albero fermo; build una volta sul candidato finale.
- UI: giro E08 con azioni vere sulla pagina sintetica; nessuna rete.
- Il legacy e il cablaggio B1–B5 restano coperti dalle regressioni
  esistenti: nessuna prova precedente va riscritta.

## Prossimo passo e criteri di chiusura

L'utente autorizza (o rimanda) l'implementazione di questo perimetro.
Poi: Claude implementa e consegna un candidato fermo con un unico
resoconto; Codex revisiona in un giro consolidato. Il blocco si chiude
IN LOCALE con E01–E09 verdi e nessun rilievo bloccante; l'attivazione
del flusso reale e ogni passaggio remoto restano autorizzazioni separate.

## Revisione indipendente di Codex — candidato 108c130

### Identità e prove positive

- Verificato HEAD `108c1308fc6ba2d7e6e4391fc3949f70f5cb6c05`, branch
  `rifacimento-spese`, albero pulito all'avvio. Il comando condiviso, PRIMA
  delle prove aggiuntive del revisore, conferma la consegna:
  VERIFICHE_TECNICHE_OK e impronta
  `9d149375d52f3e45873fd0a2323a62cd0ddf046be4e657c3b28b07915ff7dbf4`.
- Il costruttore mantiene il perimetro «solo bozze», la quadratura in
  centesimi, i controlli di destinatario/canoniche/valori e i dubbi della
  fixture E01. Le regressioni precedenti passano. Nessun accesso remoto.
- E08 e build non sono state ripetute indipendentemente in questo giro:
  restano evidenze dell'implementatore, non nuove verifiche di Codex.

### R1 — BLOCCANTE: lo scrittore reale non è atomico né idempotente

Punti: `lib/spese/elaborazioneBozze.ts:215-220` e `:263-295`; adattatore
REST in `scripts/elabora/elabora-bozze.mjs:72-107`.

Il contratto promette «mai parziali» e «mai doppioni», ma realizza una
sequenza di DELETE, più INSERT e PATCH indipendenti. La compensazione
`fallisci` ignora perfino gli errori della pulizia e dell'aggiornamento.
Due riproduzioni sul vero `elaboraDocumento`:

1. inserimento riga negato + seconda pulizia negata → esito di errore ma
   UNA bozza resta visibile; l'errore della pulizia non viene riportato;
2. due elaborazioni contemporanee leggono entrambe `da_elaborare` → ENTRAMBE
   ritornano `{ok:true}` e restano due bozze/due righe dello stesso documento.

Un errore lanciato da `fetch` può interrompere la stessa sequenza senza
passare dalla compensazione. Il controllo iniziale dello stato non è un
lock e non rende idempotenti le chiamate concorrenti.

Atteso: UN solo primitivo atomico lato scrittore per sostituzione + righe +
stato, con arbitraggio concorrente sul documento. Il finto deve provarne
rollback e concorrenza. Le chiamate REST separate non possono dimostrare
questa garanzia: lo strumento operativo deve restare non attivabile finché
non esiste un contratto database collaudato e autorizzato separatamente.
Non tentare di chiudere il punto aggiungendo altre compensazioni client.

### R2 — BLOCCANTE: nota e «dubbio dichiarato» non sono un contratto

Punti: `elaborazioneBozze.ts:118-123`, `:149-167`, `:201-208` e
`scripts/elabora/elabora-bozze.mjs:117-132`.

- `contesto.nota` viene letto dallo strumento ma il costruttore non lo usa.
  Una nota «Tutto per Casa Ania» produce lo stesso pacchetto personale che
  si otterrebbe senza nota. E06 prova soltanto un `notaNonAttribuita` già
  preparato dal chiamante: non prova «la nota guida l'esito».
- Qualunque oggetto truthy in `dubbioTotale` sblocca una quadratura errata.
  `{campo:'doc_total', confidence:1, motivo:''}` passa, ma la revisione
  mostra dubbi soltanto sotto 0,8: quindi non appare alcun dubbio visibile.

Atteso: se sul documento esiste una nota, la lettura deve dichiarare in
forma strutturata come è stata applicata oppure perché non è attribuibile;
nessuna delle due = rifiuto. Ogni dubbio deve avere campo pertinente,
confidence finita e sotto soglia, motivo non vuoto. Aggiungere controprove
per note applicate/ambigue e falsi dubbi invisibili.

### R3 — BLOCCANTE OPERATIVO: duplicati e runbook si contraddicono

- `RUNBOOK-ELABORAZIONE-BOZZE.md:17` dice ancora «doppioni scartati», mentre
  `:37-40` e il requisito E05 dicono giustamente «annotati, mai scartati».
  Una nuova chat di Claude potrebbe seguire la prima istruzione e scartare
  automaticamente un documento.
- In `elabora-bozze.mjs:117-125` gli errori della lettura SHA e della query
  dei duplicati vengono ignorati: il flusso prosegue come se non esistesse
  un duplicato. Errore di verifica deve significare STOP/dubbio, mai assenza.
- `--prova` non scrive ma usa service role e legge il database vero: non è
  una prova puramente locale e richiede il passaggio remoto autorizzato.
  L'attivazione non può ridursi alla sola variabile ambiente, soprattutto
  finché R1 è aperto.

### Prove consegnate e passaggio alla nuova chat di Claude

- Aggiunto `scripts/revisioni/elaborazione-solo-bozze-108c130.test.mjs`:
  5 riproduzioni, tutte ROSSE su `108c130` (pulizia parziale, concorrenza,
  nota ignorata, falso dubbio invisibile, contraddizione del runbook).
  Il glob già presente nel verificatore comune le esegue automaticamente.
- Gli assert descrivono E02/E03/E04/E06/E09 e non vanno invertiti per far
  diventare verde il candidato. Il nuovo giro del comando comune deve
  fermarsi su queste regressioni finché non sono chiuse.
- Codex ha modificato SOLO questa scheda e il file di prove; nessun codice
  applicativo, commit, SQL, remoto, push o deploy.
- La precedente chat di Claude è stata chiusa. La nuova chat deve partire
  leggendo, nell'ordine, `AGENTS.md`, `COLLABORAZIONE.md` e QUESTA scheda;
  poi correggere R1-R3 in un unico giro locale e consegnare un candidato
  fermo. Non affidarsi al contesto della chat precedente e non riaprire
  B1-B5 o il collaudo del contratto già chiusi.

## Chiusura dei rilievi R1–R3 (implementatore, un unico giro locale)

Le 5 riproduzioni del revisore (`scripts/revisioni/elaborazione-solo-
bozze-108c130.test.mjs`) sono integrate SENZA modifiche — né harness né
assert — e sono VERDI sul nuovo candidato insieme a E01–E07 e alle
controprove nuove. Nessuna compensazione REST spacciata per atomicità.

- **R1 — scrittore atomico.** Il contratto `ScrittoreBozze` ora ha due
  forme: ATOMICA (`sostituisciBozze`: stato+sostituzione+righe+documento
  in UN primitivo, arbitraggio concorrente dentro di esso — l'unica
  ammessa per un archivio vero) e GRANULARE (solo per gli archivi finti
  dei test). L'orchestratore serializza il percorso granulare per
  documento nello stesso processo con RICONTROLLO dello stato in coda,
  passa ogni chiamata da un involucro che trasforma gli errori LANCIATI
  in esiti dichiarati, ritenta la pulizia e DICHIARA nell'esito ogni
  fallimento della compensazione (comprese le pulizie mai riuscite:
  «possibili bozze parziali rimaste»). Controprove nuove sul finto
  atomico: rollback totale e concorrenza (una sola riesce). Il contratto
  database che realizza il primitivo è preparato in LOCALE:
  `supabase/migrations/0023_elaborazione_bozze_atomica.sql` (PROPOSTA,
  NON applicata — lock `for update`, tutto o niente, revoke a
  anon/authenticated). Applicazione e collaudo restano DA AUTORIZZARE.
- **R2 — nota e dubbi come contratto.** Se il documento ha una nota, la
  lettura DEVE dichiarare `notaApplicata` (nota identica + COME non
  vuoto) oppure `notaNonAttribuita` (stessa nota): nessuna delle due,
  entrambe, o una nota diversa/inesistente → pacchetto RIFIUTATO. Ogni
  dubbio (sorelle, voci, `dubbioTotale`) deve avere campo pertinente
  (`doc_total` per il totale), confidence finita sotto la soglia
  mostrata in revisione (0,8) e motivo non vuoto: un dubbio invisibile
  non autorizza nulla. Controprove: nota applicata/ignorata/incoerente/
  senza come/inventata; falsi dubbi (confidence 1, NaN, motivo o campo
  vuoti). La demo E08 ora dichiara la nota applicata: output del
  costruttore INVARIATO (stessa card, stessi 2 dubbi).
- **R3 — runbook e duplicati coerenti.** Il runbook non dice più
  «doppioni scartati»: in questo flusso i possibili doppioni sono SOLO
  annotati come dubbio (E05), lo dice anche il passo 1. Nello strumento
  un errore nella verifica dei duplicati è uno STOP (mai «nessun
  duplicato») e le ricevute senza impronta diventano un dubbio
  dichiarato. Il cancello ora copre anche `--prova` (legge il database
  vero col service role) e l'attivazione richiede DUE passi: la
  variabile d'ambiente E la migrazione 0023 applicata/collaudata con
  autorizzazione separata — lo strumento non contiene più alcuna
  scrittura REST diretta (letture whitelisted senza metodo configurabile,
  unica scrittura possibile = RPC atomica; senza RPC, si ferma).

Prove del giro: 18 test del modulo verdi (E01–E07, R1/R2, 5 riproduzioni
del revisore); cancello dello strumento provato (rifiuta con e senza
`--prova`, uscita 1, prima di toccare `.env.local`); giro E08 ripetuto
sul dev sintetico a 390 px (?elabora=1 → card «2 campi dubbi» identica;
?elabora=errore → motivo esatto del modulo, niente in Da controllare;
console pulita). Comando comune `node scripts/verifica-consegna.mjs
--base fb46660`: VERIFICHE_TECNICHE_OK (suite applicazione, regressioni
delle revisioni COMPRESE le 5 riproduzioni, strumenti locali, TypeScript,
lint del delta). Build eseguita una volta sul candidato: conclusa senza
errori. L'impronta del candidato FERMO è nel resoconto di consegna (la
scheda non può contenere la propria impronta). Restano NON eseguiti,
come da perimetro: SQL, accessi remoti, attivazione dello strumento,
push e deploy.
