# Metodo condiviso — chiudere il gestionale, non moltiplicare le revisioni

Richiesto dall'utente il 31 agosto 2026. Obiettivo: consegna completa entro
il 5 settembre, senza nuovi abbonamenti. È un obiettivo operativo, non una
garanzia di durata. Il codice e le prove restano patrimonio del progetto
anche dopo la scadenza; non rischiare i dati per inseguirla.

## 1. Un solo punto di passaggio

- `CONSEGNA-ATTIVA.md` è la scheda breve del blocco corrente: perimetro,
  autore, revisore, base, candidato, casi richiesti, prove ed esito.
- `PIANO-RIFACIMENTO-SPESE.md` resta il progetto funzionale e lo storico;
  `PIANO-CABLAGGIO-CONTRATTO.md` resta il contratto del blocco B1–B5.
  Non ricopiare tutta la cronologia nella scheda o nei messaggi.
- All'inizio controllare branch, HEAD e modifiche locali. Il candidato
  da revisionare deve essere identificato; una verifica su una versione
  diversa o mentre i file cambiano è INCOMPLETA, non un'approvazione.
- Ruoli correnti: Claude implementa le correzioni del cablaggio, Codex
  verifica e prepara criteri/strumenti. Cambiare ruolo solo esplicitamente.
  Nessuna scrittura concorrente sullo stesso file. Non includere modifiche
  altrui in un commit senza verificarne provenienza e accordo.
- Nessun nuovo agente, servizio o abbonamento necessario per questo metodo.
  Una sessione già aperta deve leggere esplicitamente i nuovi documenti;
  non presumere che abbia ricevuto un messaggio perché un file è cambiato.

## 2. Prima del codice: definire cosa significa finito

L'implementatore completa la scheda con 5–10 percorsi osservabili. Per ogni
percorso: stato iniziale, azioni, guasto eventuale, esito atteso e livello
di prova (test locale / schermata simulata / servizio isolato / produzione).
Usare i requisiti già approvati: non occorre un nuovo consenso per ogni
caso di test o correzione locale nello stesso perimetro.

Seguire l'intero giro fonte → stato della schermata → azione → servizio →
custodia → rilettura → azione successiva. Controllare anche la costruzione
e ricreazione delle dipendenze, non soltanto le funzioni centrali.

## 3. Prima della consegna: prove dal punto di vista dell'utente

- Ogni difetto riprodotto diventa un test di regressione sul percorso
  effettivo. Non cambiare un'attesa solo per ottenere verde: spiegare il
  requisito che rende corretta la nuova attesa.
- Per la revisione: salvare DUE volte, chiudere/riaprire, confermare e
  scartare; perdita di risposta, effetto tardivo, deposito guasto, conflitto
  e doppio tocco devono arrivare a un esito recuperabile e onesto.
- Riutilizzare custodie e adattatori reali con servizi finti rigorosi.
  Alla riapertura ricreare pagina/controller ma mantenere lo stato remoto
  simulato e quello persistente: un nuovo stato vuoto nasconde i problemi.
- Prova di schermata a 390 px in entrambi gli ambiti, poi controllo desktop.
  Azioni dalla UI vera, non unicamente chiamate interne dal browser.
  Verificare anche la SECONDA riapertura dopo un recupero dichiarato riuscito.
- Usare solo la preview sintetica senza rete per scritture di prova locali.
  Nessun test di scrittura in produzione. Gli accessi remoti restano separati.
- Eseguire `node scripts/verifica-consegna.mjs --base <commit-base>` su un
  albero fermo: suite applicazione, test locali degli strumenti, TypeScript
  senza file incrementale e lint del delta. Il riepilogo distingue i controlli
  tecnici dalle prove UI: un verde tecnico NON chiude il blocco.
- Eseguire la build una volta sul candidato finale e annotarne l'esito;
  non ripeterla a ogni modifica di testo. Ambiente mancante = limite dichiarato,
  mai successo presunto. Dopo modifiche di route verificare i tipi generati.

## 4. Una revisione consolidata, non richieste a puntate

Il revisore legge il candidato e tutti i passaggi critici PRIMA di inviare
i rilievi. Ogni rilievo contiene caso riproducibile, risultato osservato,
atteso, punto del codice e gravità. Separare:

- BLOCCANTE: conti/identità sbagliati, perdita di dati o responsabilità,
  permessi, impossibilità di completare un percorso richiesto, regressioni.
- MIGLIORIA: rifiniture senza impatto sui requisiti. Non trasformarle in
  nuove condizioni di approvazione; registrarle senza bloccare la consegna.

Una scoperta nuova grave va segnalata anche dopo il giro: consolidare non
significa nasconderla. Non riaprire rilievi chiusi sulla stessa versione
senza una regressione o un'altra prova concreta. Se la stessa causa torna
per due revisioni, fermare le patch sparse: ricostruire una sequenza completa
e correggere il punto comune. Non cambiare SQL già collaudata per un bug UI.

## 5. Chiusura e comunicazione

Stati distinti: IN LAVORO → PRONTO PER REVISIONE → VERIFICATO IN LOCALE →
PRONTO PER PASSAGGIO AUTORIZZATO → PUBBLICATO E VERIFICATO.
Un blocco locale può essere chiuso senza promettere il comportamento remoto.
Una consegna completa richiede tutti i casi pertinenti e nessun blocco aperto;
un caso non eseguibile resta NON VERIFICATO con motivo e prossimo passo.

Resoconto breve: candidato; cosa funziona per l'utente; casi/prove eseguiti;
limiti; prossima azione e chi la svolge. Evitare «tutto verde» come sinonimo
di «finito». Per le durate usare tempo misurato o intervalli esplicitamente
stimati, mai garanzie; non promettere avanzamento in background non attivato.

L'utente decide prodotto, nuovi rischi e autorizzazioni esterne; non deve
fare da traduttore di ogni scelta tecnica. Miglioramenti locali di metodo
e test sono autorizzati; ciò non autorizza nuove fasi funzionali, remoto,
token, migrazioni, permessi, cancellazioni, push o deploy. Non salvare segreti
in schede, report o memoria. Non rinnovare né acquistare servizi.

## 6. Percorso verso il 5 settembre

Ordine di chiusura, ricavato dal piano; NON riduce le funzioni concordate:

1. Revisione recuperabile e cablaggio B1–B5, con regressione del legacy.
2. Elaborazione «solo bozze»: foto → proposta controllabile → conferma;
   nessuna spesa definitiva prodotta automaticamente dall'estrazione.
3. Fatture complete: da pagare/pagate, scadenze, metodo, camere e importi
   nello Speso solo al pagamento; percorsi protetti dal contratto previsto.
4. Analisi e tassonomia previste dalla Fase 6, funzioni esistenti conservate,
   anno scolastico/qualità estrazione verificati contro i requisiti approvati.
5. Passaggio coordinato autorizzato: client pronto, audit, backup fresco e
   seconda copia verificata, contratto/transizione verificati, attivazione,
   collaudo finale e documentazione di ripresa. Nessuna convivenza operativa
   delle scritture vecchie e nuove; interruttore legacy fino alla transizione.

Caricamento massivo degli scontrini e sistemazione dello storico non sono
prioritari per l'utente: non usarli per rallentare la chiusura del sito.
Pulizia del codice compatibile solo dopo parità verificata; nessuna rimozione
anticipata del ripristino. Se un requisito o un passaggio esterno minaccia
la scadenza, segnalarlo appena emerge con lavoro residuo e opzioni, senza
tagli silenziosi. Preparare insieme le richieste esterne compatibili evita
continui avanti/indietro, ma non ne sostituisce le autorizzazioni.

## Fonti del metodo

Richiesta esplicita dell'utente e revisione locale di `7df3c86`.
Per il caricamento delle istruzioni Codex è stata consultata OpenAI Docs:
[AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
`CLAUDE.md` nel repository contiene già `@AGENTS.md`; non è stata aggiunta
alcuna connessione automatica fra le applicazioni.
