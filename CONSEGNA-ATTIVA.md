# Consegna attiva — revisione recuperabile B1–B5

## Identità e perimetro

- Base della revisione indipendente: `7df3c86`.
- Candidato precedente: `127277d` (revisionato in REVISIONE-127277d.md:
  quattro gruppi bloccanti). Candidato NUOVO: vedi commit annotato in
  fondo dalla consegna — corregge i quattro gruppi; le 10 prove del
  revisore (scripts/revisioni/cablaggio-127277d.test.mjs) sono TUTTE
  VERDI sul candidato senza modificare gli assert.
- Stato: PRONTO PER REVISIONE. Non riaprire automaticamente il collaudo
  PostgreSQL già superato.
- Implementatore: Claude. Revisore: Codex.
- Perimetro: correzioni locali al cablaggio, prove e documentazione.
  Interruttore operativo `legacy`; nessun SQL/remoto/push/deploy.
- Questa scheda è aggiornata da chi consegna e poi da chi revisiona, non
  contemporaneamente. Per i blocchi successivi riusare la struttura,
  archiviando l'esito nel piano esistente, non creando altra burocrazia.

## Casi di accettazione — provare il giro completo

Tutti i casi partono NON VERIFICATI sul candidato. Per ciascuno compilare
«Prova» con comando/nome del test, esito UI se pertinente e versione usata.
Non copiare automaticamente i risultati del commit precedente.

| ID | Sequenza e atteso | Prova sul candidato |
| --- | --- | --- |
| C01 | Fonte effettiva → apertura → Salva → rilettura → secondo Salva → chiusura/riapertura → Conferma. Versione aggiornata, nessun SUPERATA spurio; versione assente nel contratto blocca, non vale zero. | Test `C01 · due Salva consecutivi…` e `versione del documento MANCANTE…` (orchestrazione.test.ts). UI sul candidato: primo Salva → ricarica pagina → secondo Salva «Modifiche salvate» (nessuna SUPERATA) → riapertura → «documento confermato». |
| C02 | Rerender della pagina e controller ricreato: versione coerente con la sessione. Conflitto autentico → stop esplicito, nessun inseguimento silenzioso o sovrascrittura. | Test `C02 · controller ricreato coerente…` (ricreazione con versione dalla fonte; conflitto → stop ripetuto, valore altrui intatto). Il collegamento di pagina è un useMemo su (documento, fonte): ispezione + C01 UI con ricarica completa. Prova React del rerender puro: NON ESEGUITA (nessun harness di componente nel repo). |
| C03 | Salva di campi e voce nuova; effetto avvenuto, risposta persa; pagina ricreata; recupero; SECONDA riapertura; Conferma riuscita. Una sola voce, id reale, originali conservati, nessun vincolo nuovo residuo. | Test del revisore `C03: risposta persa…` (VERDE sul candidato) + mio `SEQUENZA COMPLETA della risposta persa…` (pagina ricreata, seconda apertura risolte 0, una sola voce con l'id della traccia, originali presenti). UI: persa → riapertura «era ARRIVATA … acquisita» → «Chiudi e ricontrolla» → seconda riapertura con la voce come RIGA VERA dalla fonte, nessun banner vincoli → totale 13,50 → «documento confermato». |
| C04 | Risposta di successo, ma scrittura finale della custodia fallita o pagina interrotta prima del passaggio fra custodie. Ripristino → recupero per identità senza perdita di chiave/id; nessun falso zero pendente. | Test `successo ma TRACCIA FINALE non scrivibile…` (ponte con esito e chiave elencati = mai zero pendenze; recupero con pagina RICREATA per identità) + test del revisore `ponte: esito incompleto…` (VERDE: mappa svuotata → BLOCCANTE, riferimento conservato) e `C07 … varco ponte/deposito` (VERDE: apertura nel varco → bloccante, il vecchio invio non parte). |
| C05 | Conferma e Scarta, ciascuna mai arrivata e ciascuna applicata con risposta persa. Recupero raggiungibile prima del cancello legacy e anche per documento già chiuso; esito e pulizia coerenti. | 4 test del revisore (conferma/scarto × prima/dopo, VERDI sul candidato: traccia rimossa, depositi e ponte vuoti, stato del documento giusto) + miei 2 con riconciliaContratto di PAGINA senza schermata. Nel guscio la riconciliazione precede il cancello (fase esplicita «Un attimo…»). |
| C06 | Recupero del giornale sospeso o illeggibile: niente Salva/Conferma/Scarta nuovo, sia dalla UI sia dall'orchestrazione. Ripristinata la lettura, ripresa guidata senza responsabilità perse. | Test `recupero NON conclusivo: BLOCCANTE…ripresa guidata` (salva E scarto rifiutati con «da riconciliare»; ripristino → risolta → scritture di nuovo possibili). UI: ?scrittura=giornale → «Un attimo: non apro la revisione», nessun controllo di scrittura montato; ?scrittura=giornale1 → «Riprova la riconciliazione» fa PARTIRE una nuova chiamata e risolve («era ARRIVATA…»). Ciclo testato in riconciliazioneSchermata.test.ts (riprova = nuova chiamata; risposte obsolete scartate). |
| C07 | Due schermate, risposta tardiva, generazione superata e doppio tocco. Nessuna scrittura nuova della schermata superata né rimozione della custodia più recente; una sola operazione logica. | 2 test del revisore (VERDI sul candidato: recupero concorrente serializzato dal presidio; varco ponte/deposito → bloccante e il vecchio invio NON parte — guardia d'invio sul riferimento del ponte) + `chiusura recuperata: non scavalca la generazione` (VERDE: traccia recente intatta) + miei `C07 · schermata superata` (salva e scarto fermati, giornale vuoto) e `C07 · doppio tocco` (stato aggiornato dall'esito → batch vuoto, UNA operazione a giornale). |
| C08 | Misto Casa Mia/Casa Ania, arrotondamenti, quota zero, esclusioni, campi invalidi e mancata quadratura. UI e servizio rifiutano coerentemente; nessun conto definitivo parziale. | UI sul candidato: foglio misto con le due sorelle (quota 7,51 personale / 4,99 azienda, arrotondamento +0,01, voce «esclusa dal conto»), campo invalido «abc» → ⛔ nel piede e bottoni disabilitati, «non quadra: 1,00 € di troppo» → Conferma disabilitata; quadratura del SERVIZIO → «il servizio ha rifiutato l'operazione: Quadratura non esatta» (P0001), modifiche intatte. Test: `quadratura della conferma: rifiuto DIMOSTRATO…` + suite esistente (campiImporto, blocchiConferma, revisione). |
| C09 | Preview: pagina/controller ricreati ma archivio remoto finto e deposito conservati. Anche le righe appena inserite tornano dalla fonte della UI; un ricaricamento non finge che il server abbia perso il giornale. | Corretto sul candidato: archivio del finto (documento, bozze, righe E GIORNALE) persistente in localStorage, props della schermata derivate dal mondo. UI: ricarica completa → il negozio salvato ritorna; la voce recuperata compare come riga ordinaria della fonte; dopo la ricarica il recupero passa dal GIORNALE ritrovato («era ARRIVATA»), non da un reinvio. Test del revisore C03 (righe fresche dalla fonte) VERDE. |
| C10 | Regressione legacy e prova a 390 px in entrambi gli ambiti, poi desktop. Azioni vere e pulsanti raggiungibili; niente scritture remote, niente RPC contratto dalla pagina operativa su legacy. | Test `C10 · PERCORSO_REVISIONE è 'legacy'`; su legacy la pagina passa orchestrazione=undefined (useMemo, ispezione) e fonte.ts NON chiede revisione_rev. UI legacy: Casa Mia e Casa Ania (contesto ania col foglio misto), Salva → «Modifiche salvate», nessuna fase contratto; riquadro mobile ~330–390 px CSS per tutte le prove, controllo desktop a 1280 px. Nessuna scrittura remota: solo dev server locale e archivio finto. |

## Prove di consegna

- Comando tecnico: `node scripts/verifica-consegna.mjs --base 7df3c86`.
- Preflight eseguito da Codex: VERIFICHE_TECNICHE_OK su `127277d` più i
  cinque file locali del metodo (AGENTS, due schede, verificatore e test).
  Suite applicazione, strumenti locali, TypeScript e lint del delta verdi;
  sorgenti invariati durante il giro. Impronta dello snapshot usato:
  `019656e3e8d0d14e9a75c0489481fef2e953fb78cd225087b941f1104bd3e664`.
  Questo paragrafo è stato aggiunto DOPO il giro: documenta quell'esecuzione,
  non attribuisce l'impronta al file attuale né approva C01–C10.
- Test del verificatore aggiunto: 7/7 verdi, inclusi falso verde a zero
  controlli, verifica sospesa, cambi di codice e fotografia illeggibile.
- Build sul candidato finale: ESEGUITA UNA VOLTA dopo le correzioni,
  verde (Next production build completata; tipi generati rigenerati).
- UI C01–C10 dove pertinente: ESEGUITA sul candidato (colonna «Prova»
  della tabella); limite dichiarato: il riquadro mobile del browser di
  lavoro rende ~330–390 px CSS e i clic sono stati dati sui controlli
  veri (il badge dev di Next copre parte del bottone Salva: clic sulla
  metà destra); prova React del rerender puro non eseguita (nessun
  harness di componente nel repo) — coperta da test del ciclo +
  ricreazione completa della pagina.
- Test di regressione: indicare quelli che riproducono il difetto prima
  della correzione e passano dopo; una fixture nuova vuota non vale come
  riapertura della sessione precedente.
- Evidenze senza segreti: commit, impronta dei sorgenti verificati, test,
  stato dei due depositi e dell'archivio finto, schermate sintetiche.
- Rilievi ancora aperti: i quattro gruppi della revisione di `7df3c86`
  restano da ricontrollare sul candidato, non sono nuove richieste di prodotto.

## Prossimo passo e criteri di chiusura

Claude legge il metodo condiviso e completa le prove mancanti sul candidato
senza riscrivere parti già corrette. Consegna un unico resoconto breve.
Codex verifica commit esatto, prove C01–C10 e integrazione; restituisce una
revisione consolidata. Se manca una prova si scrive NON VERIFICATO e perché,
senza fingere un'approvazione o chiedere altre credenziali.

Il blocco si chiude IN LOCALE solo con percorsi completi, nessun rilievo
bloccante e legacy intatto. La successiva fase funzionale e ogni passaggio
remoto mantengono le autorizzazioni previste: questa scheda non le concede.

## Esito della consegna (compilato dall'implementatore, 01/09/2026)

- CANDIDATO (codice): `7a15fc1d11289745169d40200ec149d2cd9f3152` — albero
  PULITO al momento delle verifiche. Il commit precedente `654a3c2`
  integra, senza modifiche, i cinque file del metodo e la revisione
  consegnati da Codex (provenienza dichiarata nel messaggio di commit).
- `node scripts/verifica-consegna.mjs --base 7df3c86` sul candidato:
  VERIFICHE_TECNICHE_OK; impronta sorgenti
  `2f95d32fecfea8305d19b99fc1135c7ac905c26a789c4e61cfdf714b72298dd5`.
  Suite applicazione 348/348 (27 orchestrazione + 2 ciclo inclusi),
  strumenti locali, TypeScript senza incrementale, lint del delta.
- Prove del revisore `scripts/revisioni/cablaggio-127277d.test.mjs`:
  10/10 VERDI sul candidato, assert INVARIATI.
- Build di produzione: eseguita una volta sul candidato, verde.
- UI C01–C10: colonna «Prova» della tabella (azioni vere sul dev server
  sintetico, nessuna rete). Un rilievo del percorso è annotato lì
  (rerender React puro non provato: nessun harness di componente).
- Questo blocco di testo è un commit di SOLA documentazione successivo
  alle verifiche: il codice verificato è `7a15fc1`.
