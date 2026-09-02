# STATO IN 10 RIGHE (aggiornato il 02/09/2026, revisione Fase 5 fatture) — da incollare a un altro assistente

1. Gestionale Casa Ania (Next.js su Vercel, Supabase tnsaa…vwv, usato SOLO da Ania): su `main` la sezione Richieste è completa (pezzi 1–7, in produzione); il modulo Spese nuovo (Panoramica/Movimenti/Documenti/Analisi, flusso «solo bozze», revisione) è in produzione con il percorso di scrittura su `legacy` (`lib/spese/percorso.ts`, non toccare).
2. Migrazioni applicate a mano: 0001–0022, 0024, 0025, 0027, 0028, 0029. In `supabase/proposte` NON applicate: 0023 (chiave idempotente), 0026 (RLS richieste), 0030 (vincoli server fatture: parte negativa, data futura).
3. Branch `fatture-fase5` (da `main` b3746f4): la Fase 5 fatture di Casa Ania ricostruita dal candidato 1219138 (analisi in docs/fatture-fase5-analisi.md) + 4 correzioni della revisione avversaria (D1 parte negativa, D2 rollback del finto, D3/D4 prova di rifiuto = codice SQLSTATE, D5 proposta SQL). Push SOLO di questo branch: Vercel ne fa una preview, main non cambia.
4. Fatture: testata in revisione (tipo, fornitore, numero, data, scadenza) custodita, correzioni SOLO via RPC 0020 (`approva_fattura_da_pagare` = zero spese/Impegnato/scadenzario; `conferma_fattura_pagata` e `paga_fattura` = una spesa per parte alla data reale del pagamento); dettaglio leggibile dopo il pagamento; PDF/foto multipagina.
5. Robustezza: replay e doppio tocco = una sola spesa (presidio + RPC idempotente); errore con codice = rifiuto certo; errore senza codice, rete, risposta persa, zero spese = INCERTO con «Chiudi e ricontrolla» e responsabilità custodita.
6. Prove: suite 485/485 (44 nuovi + 5 avversari + 3 riproduzioni Codex), `verifica-consegna --base b3746f4`, build, UI a 320/390/1280 sull'anteprima finta `/nuove-spese` (porta 3213). Nessuna migrazione applicata, nessun accesso remoto, nessuna scrittura reale.
7. Richieste (pezzi 1–7): generatore unico lib/richiesteTesti, condizioni scelte da Ania, conferma via RPC conferma_richiesta (provata in PGlite), contratto sito→gestionale verificato (docs/verifica-5B.md).
8. Strumenti: `gestionale-bnb-anteprima-prenotazioni-finta` (3213, spese e prenotazioni finte), `gestionale-bnb-anteprima-richieste-finta` (3214, richieste + endpoint web con segreto locale), `npm test`, `node scripts/verifica-consegna.mjs --base <sha>`.
9. Regole: nessun invio reale; migrazioni solo a mano da Ania; il calendario principale non si tocca; un commit per correzione; mai modificare gli assert dei test esistenti; il contratto di revisione resta `legacy` fino alla transizione autorizzata.
10. 🔴 Azioni aperte per Ania: provare la preview Vercel di `fatture-fase5` (solo lettura/dati di prova), decidere se unire il branch a main, valutare la proposta 0030; prova manuale della cascata Richieste dal telefono.

---

# Consegna attiva — Fase 5: fatture di Casa Ania (revisione avversaria, branch `fatture-fase5`)

## Identità e perimetro

- Base: `main` = `b3746f4` (Richieste pezzo 7). Candidato precedente
  `1219138` (branch `fase5-fatture-casa-ania`, base `671a677`): analizzato in
  `docs/fatture-fase5-analisi.md`, NON unito alla cieca, ricostruito con
  cherry-pick pulito (unico conflitto: questa scheda).
- Branch: `fatture-fase5`. Stato: VERIFICATO IN LOCALE, PUSH DEL SOLO BRANCH
  (preview Vercel), NESSUN DEPLOY IN PRODUZIONE. Unione a main = decisione di Ania.
- Revisore avversario: Claude (02/09/2026), con le tre riproduzioni
  indipendenti di Codex (`scripts/revisioni/fase5-fatture-1219138.test.mjs`,
  0/3 verdi sul candidato, 3/3 dopo le correzioni).
- Perimetro invariato rispetto al candidato: fatture SOLO Casa Ania, RPC 0020,
  percorso del contratto di revisione su `legacy` (non toccato), nessuna
  migrazione applicata, nessun accesso remoto, nessun secondo utente.

## Casi di accettazione (ogni voce con il test che la dimostra)

| ID | Voce richiesta | Prova | Esito |
| --- | --- | --- | --- |
| V01 | Fatture solo Casa Ania: una parte con gruppo Casa Mia blocca; «È una fattura» solo in ambito azienda. | `fattureFlusso` F07, `fattureRevisione` «camera e ambito coerenti» | VERDE |
| V02 | Documento foto o PDF, anche multipagina, anteprima leggibile. | `caricamentoPagine` (7 test: token unico, `-pN`, riselezione per impronta, doppione); `FotoSheet` PDF in iframe; UI: «pagina 1 / pagina 2» nella revisione di Impianti Rossi | VERDE (foglio di caricamento con file veri non provato: serve un selettore di file) |
| V03 | Testata custodita, correzioni solo via RPC: originali intatti, correzioni senza `draft_id`, Salva = un solo UPDATE sulle colonne concesse dalla 0021, zero righe ≠ successo. | `fattureRevisione` (testata, riapertura, vincoli, Salva), `fattureVista` «creaClienteRevisione» | VERDE |
| V04 | «Da pagare»: zero spese, Impegnato e scadenzario. | F01, F02, `fattureVista` adattatore | VERDE |
| V05 | «Già pagata»: data non futura e metodo obbligatori (a schermo e nel finto). | F05, `fattureRevisione` «già pagata»; UI: 31/12/2026 bloccata con messaggio, «Conferma» disabilitato | VERDE (lato SQL solo con la proposta 0030) |
| V06 | Pagamento successivo: UNA spesa alla data reale. | F03, F04 | VERDE |
| V07 | Fattura di agosto pagata a settembre → Speso di settembre, agosto invariato. | F03 (esplicito) | VERDE |
| V08 | Replay, doppio tocco, risposta persa, errore dalla RPC, zero righe: mai doppioni, stati parziali o falsi successi. | F04, F04-bis, «doppio clic», D2 (rollback del finto), D3/D4 (errore senza codice = incerto), Codex R1-bis/R2 | VERDE dopo le correzioni |
| V09 | Quadratura al centesimo, arrotondamento esplicito. | F06, D1 (parte negativa), Codex R1 | VERDE dopo la correzione |
| V10 | Dettaglio leggibile dopo il pagamento (importo, data, metodo, documento). | F03, `fattureVista` «dettaglioFattura»; UI: «pagata Oggi · Bonifico», «Fatture pagate» | VERDE |
| V11 | Nessuna scrittura alle spese che aggiri le RPC. | ispezione: nel branch nessun insert nuovo su `family_expenses` (restano le scritture preesistenti delle spese MANUALI senza documento, fuori perimetro); `fattureRevisione` «orchestrazione: … il contratto le RIFIUTA» | VERDE |
| V12 | Query storiche complete e paginate; errori a schermo; nessun catch silenzioso. | `fonte.leggiTutto` a pagine di 1.000 con ordine esplicito (preesistente); esiti incerti sempre dichiarati; nessun catch muto nei file nuovi | VERDE |
| V13 | UI a 320, 390 e 1280 px sull'anteprima finta. | Documenti, dettaglio/pagamento (Vetraio Colombo scaduta → pagata con Bonifico), revisione fattura (Impianti Rossi, «Già pagata», data futura bloccata): nessuno scorrimento orizzontale (scrollWidth = viewport) | VERDE |

## Correzioni (un commit ciascuna, riproduzione PRIMA)

- D1 parte negativa dopo l'arrotondamento: blocco a schermo + nel finto; SQL nella proposta 0030.
- D2 il servizio finto fa rollback totale quando il corpo della RPC fallisce.
- D3/D4 la prova di rifiuto è il codice applicativo; `revisioneClient` riporta `error.code`; senza codice = incerto (fatture); legacy invariato.
- D5 proposta 0030 (non applicata): parte negativa in `valida_fattura`, data futura in `paga_fattura`/`conferma_fattura_pagata`.

## Prove di consegna

- `npm test` 485/485 (441 di main + 39 del candidato + 5 avversari); Codex 3/3.
- `node scripts/verifica-consegna.mjs --base b3746f4` e `next build`: esito nel resoconto.
- UI sull'anteprima finta con click simulati via JavaScript sui bottoni veri.

## Limiti aperti

- Prove locali e simulate: RPC vere, RLS, lock e concorrenza restano da provare
  nel passaggio autorizzato (la RPC 0020 non gira in PGlite qui: dipende da
  `private.is_app_member`, `app_members` e dallo schema 0020/0021 completo).
- Il percorso a contratto non copre le tre RPC fattura (rifiuto esplicito).
- L'elaboratore non propone la testata (proposta in `proposte/`).
- Regole D1 e D5 lato server solo con la 0030, da autorizzare.
- Foglio di caricamento con file veri non provato in UI.

---

# Blocco precedente — Richieste, pezzo 7: prova della cascata e verifica del contratto sito → gestionale

Pezzo di verifica: nessuna funzione nuova, nessuna correzione necessaria
(tutte le prove sono passate al primo giro). Base: `b4fbe6d` (pezzo 6).

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| C01 | Lena libera 10–13 ott; R1 (2 persone, 10–13) e R2 (2 persone, 11–13) per Lena: entrambe ricevono il caso A per Lena, anche con l'altra richiesta aperta nel database. | test locale, ricerca pura | VERDE |
| C02 | Conferma di R1 con R2 spuntata: booking Lena 10–13 confermata 240 €, ospite creato dal telefono, R1 confermata con prenotazione_id, R2 rifiutata con «date assegnate a altro cliente». | RPC VERA (SQL 0027) in PGlite | VERDE |
| C03 | R2 NON spuntata, confermata dopo R1: errore «Camera Lena non più disponibile la notte del 11 novembre», bookings e guests invariati, R2 resta proposta_inviata. | RPC vera in PGlite | VERDE |
| C04 | Secondo tocco su «Crea prenotazione» per R1 (con e senza lista): stessa prenotazione, nessun doppione di bookings o guests. | RPC vera in PGlite | VERDE |
| C05 | Pool brande: quadrupla confermata in Lena (2 brande) → Allegra per 3 persone «Letti aggiuntivi esauriti la notte del 20 dicembre (camera Allegra)», nulla scritto; extra_bed senza date conteggiato; Allegra a 3 persone con 1 branda libera passa con extra_bed_dates. La ricerca del gestionale, coerente, non propone la matrimoniale a 3 con il pool esaurito. | RPC vera in PGlite + ricerca pura | VERDE |
| C06 | Senza proposta inviata → «Nessuna proposta inviata»; caso completo → «non contiene camere». | RPC vera in PGlite | VERDE |
| C07 | Contratto sito → gestionale: 9 voci, tutte conformi con evidenze. | docs/verifica-5B.md | VERDE |
| C08 | Endpoint locale: 401 senza/con segreto errato, 400 su JSON e dati invalidi, 201, 200 doppione, 429 dopo 10 dallo stesso IP; bookings invariate. | anteprima finta + curl | VERDE |

## Prove di consegna

- `npm test` 441/441 (6 nuovi sulla RPC), TypeScript e lint del delta verdi.
- La RPC gira in PGlite (Postgres 17 in WebAssembly, dipendenza di solo
  sviluppo `@electric-sql/pglite`): il SQL della funzione è letto dal file
  della migrazione 0027, le tabelle sono una replica minima con le colonne
  toccate, `auth.uid()` è un finto utente loggato. Non è il server Supabase:
  RLS, grant e concorrenza fra connessioni non sono coperti qui (lo script
  `supabase/test/0027_conferma_richiesta.test.sql` resta per l'editor SQL).

## Commit

a `9cea837` test della cascata e delle brande · b nessuna correzione necessaria ·
c `f5c598c` verifica del contratto con evidenze · d (questo) stato in 10 righe e scheda.

## 🔴 Guida per la prova manuale di Ania (dal telefono)

1. Richieste → «+ Nuova richiesta»: «Prova Uno», 2 persone, una camera libera
   (es. Lena) su due notti future, telefono tuo. Salva. Ripeti con «Prova Due»,
   stesse date e stessa camera.
2. Apri Prova Uno → «Invia proposta»: scegli una condizione (es. All'arrivo),
   «Apri WhatsApp e invia» (puoi non inviare davvero), poi «Sì, inviata».
   Fai lo stesso per Prova Due.
3. Su Prova Uno tocca «Conferma → crea la prenotazione»: nella finestra deve
   comparire «Prova Due» già spuntata sotto «Altre richieste per le stesse date».
   Tocca «Crea prenotazione».
4. Verifica: si apre la scheda della prenotazione con il toast «Prenotazione
   creata da richiesta» e la riga «Nata dalla richiesta del … via …»;
   in Richieste → archivio, Prova Due è «rifiutata» col motivo «date assegnate
   a altro cliente»; nel calendario principale la camera risulta occupata.
5. Prova del blocco: su Prova Due (se la riapri) o su una terza richiesta
   con le stesse date, «Conferma» deve fermarsi con «Camera … non più
   disponibile la notte del …» e il link «Prepara una nuova proposta».
6. Alla fine: apri la prenotazione di prova e annullala (Annulla), così il
   calendario torna libero. Le richieste di prova restano in archivio.

---

# Blocco precedente — Richieste, pezzo 6: testi definitivi, condizioni di pagamento, alternativa Amelia, immagine con la notte scoperta

Pezzi 1–5A della sezione Richieste in produzione (autorità). Questo blocco
chiude i testi delle proposte e le condizioni di pagamento scelte da Ania.
Il blocco «quadrupla nera e date stabili» (Codex, altro ramo) resta più
sotto, intatto e ancora in attesa della sua autorizzazione.

## Identità e perimetro

- Base: `6d1f754` (main, pezzi 1–5A online). Candidato: HEAD di `main`
  dopo i cinque commit di questo blocco (a → e), vedi «Commit».
- Stato: PUBBLICATO SU MAIN (push autorizzato dalla consegna) — in attesa
  della migrazione 0029 e della verifica dal telefono di Ania.
- Implementatore: Claude (02/09/2026). Nessun invio reale durante lo sviluppo:
  prove solo sull'anteprima finta senza rete (porta 3214).
- Perimetro: `lib/richiesteTesti` (unico generatore `generaProposta`),
  `lib/condizioniPrenotazione` (costanti + regola di cancellazione),
  `lib/richiesteProposta` (alternativaAmelia, cameraDisponibile),
  `lib/richiesteImmagine` (linea del soggiorno), `components/ImmagineSoggiorno`
  (esteso, non duplicato), `lib/richiesteDati` (salvataggio 0029),
  `app/richieste/[id]/proposta`, migrazione `0029`, anteprima finta.
  La conferma di prenotazione (variante `conferma` dell'immagine) è invariata.

## Regole fisse dei testi (non modificare senza Ania)

Sempre del Lei, apertura «Gentile», righe vuote fra periodi. La proposta non
è una prenotazione: 3 ore per rispondere nei casi A–C, nessun limite nel
caso E. Le condizioni le sceglie Ania a ogni richiesta, nessuna preselezione.
Amelia è la camera più piccola; solo Allegra ha il balconcino. Prezzi e
differenze sempre dalle tariffe reali, in centesimi.

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| R01 | Testi esatti (stringa intera) dei casi A, B, C con notte all'inizio / in mezzo / alla fine, C con cambio camera, E; singolare/plurale notti. | test locali `richiesteTesti.test.ts` | VERDE |
| R02 | Condizioni 1 (arrivo), 2 (caparra 50% e importo personalizzato con percentuale ricalcolata: 70 € = 50%, 50 € = 35,7%), 3 (completo), 4 (personalizzata + sola chiusura). | test locali | VERDE |
| R03 | Importi: centesimi interi, «1.234,50 €», «140 €» senza decimali; prezzo a notte letto compreso (Amelia 2 persone = 75 €). | test locali | VERDE |
| R04 | Alternativa Amelia attiva/non attiva: solo segmento unico in Amelia, ≥ 3 notti, Allegra/Ambra libera sulle confermate con le stesse persone; differenza reale (10 € con 1 persona, 5 € con 2). | test locali | VERDE |
| R05 | Confine dei 7 giorni: 7 giorni esatti = restituzione integrale; un minuto in meno = caparra trattenuta; completo tardivo = nessuna promessa. | test `condizioniPrenotazione.test.ts` | VERDE |
| R06 | Schermata a 390 px: quattro chip nessuno preselezionato; «Apri WhatsApp e invia» disabilitato con «Scegli le condizioni di pagamento»; Caparra → campo precompilato 105 € (50% di 210), modificabile (70 → 33,3%); 0 o oltre il totale → pulsante bloccato con motivo; Personalizzata vuota → bloccato, con testo → attivo; interruttore Amelia spento di default, acceso aggiunge il blocco. | anteprima finta, richiesta «Lis» | VERDE |
| R07 | «Sì, inviata» (ripresa dal browser dopo il ricaricamento) salva stato, testo, soluzione, condizione_pagamento, amelia_alternativa; la pagina mostra «Condizioni inviate: All'arrivo · con alternativa ad Amelia». | anteprima finta, PATCH letto dal finto Supabase | VERDE |
| R08 | Caso E («Persone», tutto occupato): nessun gruppo condizioni, pulsante attivo, testo completo senza «3 ore». | anteprima finta | VERDE |
| R09 | Caso C («Buco», notte +51 tutta occupata): testo con le due righe e «cioè il 23 ottobre»; immagine con SOGGIORNO NON CONTINUO, due blocchi e lo spazio vuoto «NOTTE NON DISPONIBILE · 23 ottobre», contatori 2 notti da noi / 1 notte scoperta. | anteprima finta, screenshot 390 px | VERDE |
| R10 | Layout 320 / 390 / 1280 px senza scorrimento orizzontale (a 1280 in modalità immagine corretto con `min-w-0`). | anteprima finta | VERDE |
| R11 | Colonne 0029 assenti → avviso e nessun salvataggio (stessa via della 0025). | ispezione codice (`colonne0029Presenti`, `manca0029`) | VERDE (non riprodotto a schermo) |

## Prove di consegna

- `npm test`: 435/435. `node scripts/verifica-consegna.mjs --base 6d1f754`:
  VERIFICHE_TECNICHE_OK (suite, regressioni, strumenti, TypeScript, lint delta).
- `next build`: exit 0 sul candidato finale.
- Prove UI sull'anteprima finta con click simulati via JavaScript (nel
  pannello i click reali restavano bloccati anche nella seconda scheda).

## Limiti dichiarati

- Migrazione 0029 NON applicata: fino ad allora la schermata avvisa e non
  registra la proposta (il pulsante è disabilitato).
- Nessuna prova su dati reali né invio reale su WhatsApp.
- Nel riepilogo costi dell'immagine due periodi nella stessa camera compaiono
  come due righe identiche («Camera Amelia – Singola 70,00 €»): il modulo è
  condiviso con la conferma e non è stato toccato; la linea del soggiorno
  sopra rende le date evidenti.
- L'alternativa ad Amelia non viene offerta con due segmenti (cambio o
  parziale): scelta prudente, non richiesta esplicita.
- La percentuale della caparra si arrotonda al decimo («35,7%»).
- Testo modificato a mano + cambio di condizione: la schermata chiede
  conferma prima di rigenerare la bozza (le modifiche andrebbero perse).

## Commit

a `34e3216` generatore + costanti + test · b `46822e7` migrazione 0029 ·
c `ebe154e` schermata con condizioni e Amelia · d `4d93763` immagine con la
notte scoperta · e (questo) CONSEGNA-ATTIVA.md e PROGETTO.md.

## Prossimo passo

🔴 Ania: applicare la 0029 nell'editor SQL del progetto di produzione
(tnsaa…vwv), poi dal telefono con una richiesta di prova: chip non
preselezionati, pulsante disabilitato senza condizione, testo del Lei, caso
C con la notte scoperta anche nell'immagine, interruttore Amelia.

---

# Blocco precedente — prenotazioni: quadrupla nera e date stabili

Pubblicato su main in `671a677` (`a8b4495`) e archiviato in
`CONSEGNE-ARCHIVIO-PRENOTAZIONI-QUADRUPLA-DATE.md`.
