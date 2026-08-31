# Consegna attiva — elaborazione «solo bozze»

Il blocco precedente (revisione recuperabile B1–B5) è CHIUSO IN LOCALE:
verbale e storico completo in `CONSEGNE-ARCHIVIO-B1-B5.md` ed esito nel
piano. Questa scheda definisce il blocco successivo previsto dal metodo
(COLLABORAZIONE.md §6.2) e dal piano funzionale (§8-②).

## Identità e perimetro

- Base: `fb46660` più il verbale di chiusura.
- Stato: PRONTO PER REVISIONE — implementazione autorizzata dall'utente
  il 02/09/2026 ed eseguita; esiti nella tabella e in fondo.
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
