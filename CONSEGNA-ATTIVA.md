# Consegna attiva — elaborazione «solo bozze»

Il blocco precedente (revisione recuperabile B1–B5) è CHIUSO IN LOCALE:
verbale e storico completo in `CONSEGNE-ARCHIVIO-B1-B5.md` ed esito nel
piano. Questa scheda definisce il blocco successivo previsto dal metodo
(COLLABORAZIONE.md §6.2) e dal piano funzionale (§8-②).

## Identità e perimetro

- Base: `fb46660` più il verbale di chiusura.
- Stato: DEFINIZIONE — implementazione DA AUTORIZZARE dall'utente.
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
| E01 | Estrazione di uno scontrino MISTO → pacchetto: 2 bozze sorelle con destinatari, righe complete (raw_name, qty/unit_price/discount/amount, canoniche per id, group_id per riga dove serve), confidence con doubt_reason sui campi incerti, arrotondamento per sorella, doc_total sul documento, stato in_revisione. NESSUNA scrittura su spese definitive. | test locale su archivio finto | DA FARE |
| E02 | Vincoli e controlli: quadratura esatta o dubbio dichiarato sul totale; qty>0, discount≥0, amount≥0, sottocategoria MAI vuota; campo fuori whitelist → pacchetto rifiutato dal costruttore con motivo. | test locale | DA FARE |
| E03 | Idempotenza: documento già in_revisione/confermato → l'elaborazione RIFIUTA (mai bozze duplicate); documento in errore → rielaborazione che sostituisce le bozze precedenti dello stesso documento, con esito annotato. | test locale | DA FARE |
| E04 | Lettura fallita o incompleta → documento 'errore' con error_message utile; nessuna bozza parziale lasciata in giro. | test locale | DA FARE |
| E05 | Duplicato per sha256 di un file già elaborato → «possibile duplicato di …» annotato sul documento; l'elaborazione continua e la decisione resta ad Ania in revisione (scarto sempre manuale). | test locale | DA FARE |
| E06 | La nota di Ania sul documento guida l'esito (ambito/gruppo forzato); nota che può riferirsi a UN solo scontrino della foto → dubbio dichiarato sugli altri, mai indovinato. | test locale | DA FARE |
| E07 | PERIMETRO: qualunque tentativo del pacchetto di toccare family_expenses/family_expense_items è strutturalmente impossibile (whitelist dello scrittore provata con controprova). | test locale | DA FARE |
| E08 | Giro UI in demo (390 px, entrambi gli ambiti): documento «da elaborare» finto → elaborazione simulata → compare in «Da controllare» coi dubbi → revisione → conferma con la schermata consegnata; errore di elaborazione visibile con motivo. | schermata simulata | DA FARE |
| E09 | Runbook dell'elaborazione reale aggiornato al nuovo modulo (bozze, mai spese), con il passo di attivazione segnato DA AUTORIZZARE. | documento | DA FARE |

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
