# Ripristino pulizie automatiche — 12 novembre 2026

Richiesta corrente di Ania: giorni passati senza registrazione = puliti con zero recupero; recuperi aggiungibili dopo. Conservare azioni esplicite. Correggere storico, statistiche e riproposizioni.

Base locale: 7e9c8e3, corrispondente alla versione vista online. Copia isolata in gestionale-pulizie-fix nella task Codex del 12 novembre. Nessun file delle altre copie modificato. Nessun dato remoto scritto.

Causa verificata nel codice e nella storia git: cambioOspiteAutomatico disattiva l'automatismo da CONFERMA_MANUALE_DAL (8 settembre); 6d3ac7c modifica Home/Pulizie alla conferma manuale. Statistiche nuove di ottobre leggono soltanto cleanings, mentre le ricostruzioni sono separate ed escluse dai numeri. c2bbf7d toglie gli arretrati superati ma non li registra né li conta. statistichePulizieNuove sottraeva recuperi di righe senza dotazione da totali parziali.

Implementazione locale candidata, NON PUBBLICATA:
- storicoPulizieCompleto ricostruisce scadenze passate dal 24 agosto: partenze, cambi camera e ogni 4 notti; oggi rimane operativo, nessuna scrittura massiva. Rispetta rinvii/salti/fatte e prolungamenti, ID virtuale stabile.
- La stessa proiezione chiude gli arretrati in Home/Pulizie/striscia, entra in Registro e statistiche. Aprire una riga virtuale usa il salvataggio esistente senza ID virtuale e con data storica, così la conferma sostituisce la proiezione.
- Dotazione mancante proposta da camera e prenotazione, fotografia salvata prevalente. Recuperi assenti dopo lettura riuscita = zero; errore di lettura resta indisponibilità.
- Bucato e percentuale su righe confrontabili; recuperi oltre dotazione e lenzuola senza misura restano da controllare, esclusi dal bucato.

Prove: 163 test pertinenti verdi (prima dell'ultimo caso aggiunto); 4/4 regressioni nuove verdi; TypeScript pulito; lint file modificati senza errori. Suite completa iniziale bloccata da test backup che aprono server; eseguita nuovamente con limite 10 secondi per test, log scratch /tmp/pulizie-suite-final.log. Build fallita per impossibilità di scaricare Google Fonts. Anteprima sintetica fallita EPERM listen 127.0.0.1. git fetch fallito DNS github.com. Non richieste deroghe ai permessi dell'ambiente.

DA COMPLETARE prima di pubblicare:
- Lettura completa dati reali e riscontro dei 6 interventi del 10 ottobre (possibili registrazioni tardive di eventi diversi): non cancellare né accorpare solo per camera/giorno.
- Revisione gestione linen_next_date legacy e possibili duplicati reali per stesso evento, proposte di letti storiche e date manuali tardive. Nessuna ricostruzione è una misura fisica della biancheria.
- Percorso UI reale su anteprima senza rete: aprire storico, salvare recupero, due riletture; verificare vecchie correzioni e cambi persona/letto.
- Suite completa, build e fetch di main aggiornato in ambiente con rete e server locali consentiti; poi commit/push/deploy secondo autorizzazione già esistente. Non dichiarare risolto online.

## Secondo giro, richiesta «puoi implementare tutto?»
- Recupero zero anche come valore iniziale nel foglio nuovo e nella correzione dopo lettura riuscita; la nota nelle statistiche esplicita ricostruzioni e dotazioni ricavate dalle prenotazioni.
- Allineati conteggi confermati/grafico/Oggi/prossime alla stessa proiezione.
- Registrazioni finali tardive con data successiva a un altro arrivo nella stessa camera: la vista torna alla partenza della prenotazione associata. Nessuna modifica al dato remoto, stesso ID e recuperi conservati. Nuovo test del caso con due partenze erroneamente concentrate nel giorno della registrazione.
- 165/165 test pertinenti passati. Suite estesa con concorrenza 4: **2259/2259** passati, escluso soltanto lib/backupPostgrest.test.ts che richiede un server locale (apertura negata EPERM). Il test SQL PGlite passa da solo in 1,03 s: il timeout di 10 s della precedente suite concorrente non era prova di errore SQL.
- TypeScript e lint dei sorgenti modificati puliti, git diff --check pulito.
- Accesso GitHub ritentato: errore DNS invariato. UI online letta, versione ancora 7e9c8e3, sei registrazioni del 10 ottobre ancora presenti. Aperto e chiuso senza salvare un dettaglio: il foglio non espone cliente o data prevista, quindi impossibile attestare dal solo dettaglio se siano duplicati o registrazioni tardive. Non dichiarare i sei dati reali risolti.
- Nessun commit/push/deploy o SQL remoto. Build e percorso UI completo restano da eseguire in ambiente con rete e server locale consentiti. Le prove tecniche non sostituiscono il collaudo online.

## Ripresa e revisione — 13 novembre 2026, Codex

Responsabile Codex, stessa copia isolata; perimetro invariato e pubblicazione già autorizzata. Base remota ricontrollata: 65c09c2 aggiunge solo documentazione del deploy precedente (7743563511, 7e9c8e3, success).

Correzioni della revisione: le scadenze di soggiorno si ordinano per evento, così un recupero tardivo non riporta indietro il ciclo; le proiezioni successive fanno avanzare la cadenza; linen_next_date resta rispettata senza decisioni nuove; zero anche nel Registro dopo lettura riuscita; persone_servite prevale nella dotazione proposta. In caso di errore di lettura recuperi, bucato e simulazione lavanderia non mostrano risultati come certi.

Sei interventi reali del 10 ottobre letti via API, senza scritture: sei booking_id e sei guest_id distinti, una sola conferma finale per ciascuno. Allegra e Amelia con partenza 8 ottobre erano registrate il 10 dopo un nuovo arrivo: nella proiezione tornano all'8; gli altri quattro restano il 10. Un recupero esistente sulla partenza Amelia del 10 resta associato al medesimo ID. Nessun accorpamento, cancellazione o migrazione. Tutti i 76 eventi letti sono conservati; 44 proiezioni aggiunte in vista al 13 novembre. Home e calendario danno entrambi zero da fare oggi sui dati letti.

Collaudo UI locale con SQL vera in PGlite e soli dati sintetici: pulizia automatica Amelia del 6 novembre aperta con zero e data storica; salvata 1 federa, riaperta, corretta a 2, riaperta due volte: sempre una pulizia, data 6 novembre, 16 preparati, 2 recuperati, 14 da lavare. Registro e statistiche riportano tre interventi complessivi nello scenario. Verifica visiva desktop e 390×844 di statistiche e foglio. Nessuna scrittura di prova in produzione.

Prove: 2266/2266 test applicazione inclusi backupPostgrest; 100 test revisioni eseguibili verdi; 82 strumenti locali verdi; TypeScript e lint del delta puliti. Build con configurazione esistente riuscita (cache ricreata dopo interferenza della prima preview). Il preflight completo segnala un limite ambientale: initdb PostgreSQL nativo fallisce con shmget Operation not permitted; il test di concorrenza nativo è escluso dal giro eseguibile, non dichiarato passato. SQL non modificata; prove SQL PGlite di conferma, recuperi, rilettura e risposta persa passano. Il caso Home vecchio è aggiornato nello scenario perché la pulizia da confermare deve scadere oggi, mentre il passato ora si ricostruisce automaticamente.

Stato: verificato in locale, pubblicazione e verifica online da registrare qui sotto.
