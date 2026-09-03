# STATO IN 10 RIGHE (aggiornato il 03/09/2026, Richieste pezzo 9) — da incollare a un altro assistente

1. Gestionale Casa Ania (Next.js su Vercel, Supabase tnsaa…vwv, usato SOLO da Ania): su `main` la sezione Richieste ha i pezzi 1–7 e 9 (modifica, persone notte per notte, caso A a più camere con link e elisione); il modulo Spese nuovo è in produzione con la scrittura su `legacy` (non toccare).
2. Migrazioni applicate a mano: 0001–0022, 0024, 0025, 0027, 0028, 0029. 🔴 0031 (persone_per_notte, proposte_precedenti, proposta_alternative + conferma_richiesta notte per notte) DA APPLICARE. In `supabase/proposte` NON applicate: 0023, 0026 (RLS), 0030 (vincoli server fatture).
3. Branch `fatture-fase5` (Fase 5 fatture ricostruita + 4 correzioni avversarie): in attesa della decisione di Ania (unione a main); main non lo contiene.
4. Richieste: modulo unico components/richieste/ModuloRichiesta (nuova e modifica) con la striscia delle notti (components/StrisciaNotti, estratta dalle caselle del letto extra della scheda prenotazione); la modifica di una richiesta con proposta inviata (date/persone/camera) la riporta in_attesa con avviso e storico in proposte_precedenti.
5. Proposte: generatore unico lib/richiesteTesti (apertura a capo, caso A «soltanto la camera» o «ho N camere libere», link casaaniarozzano.it/camere/[slug], elisione «dal 4 all'8», riga «Nel dettaglio» con persone variabili); B, C, E e caparra/completo invariati. Nel caso A a più camere il messaggio le elenca tutte (proposta_alternative) e alla conferma Ania sceglie la camera accettata.
6. Ricerca e prezzo per notte (lib/richiesteProposta): capienza e pool delle 2 brande con le persone di ogni notte, tariffe vere in centesimi, letto solo dove serve; conferma_richiesta 0031 fa lo stesso lato server (provata in PGlite).
7. Prove: suite 455/455, tsc, lint del delta, build, UI a 320/390 sull'anteprima finta (porta 3214: Marta Ricovero [2,1,1,1] = caso reale). Nessun invio reale, nessuna scrittura remota.
8. Strumenti: `gestionale-bnb-anteprima-richieste-finta` (3214, login con qualsiasi email, inviare il modulo via JS nel pannello), `gestionale-bnb-anteprima-prenotazioni-finta` (3213), `npm test`, `node scripts/verifica-consegna.mjs --base <sha>`.
9. Regole: nessun invio reale; migrazioni solo a mano da Ania; il calendario principale non si tocca; un commit per blocco; mai modificare gli assert dei test esistenti; il contratto di revisione resta `legacy`.
10. 🔴 Azioni aperte per Ania: applicare la 0031, poi la prova dal telefono (modifica della richiesta 17–21 con 2 poi 1, proposta Amelia+Ambra col dettaglio, link e «dal 4 all'8»); decidere su fatture-fase5 e sulla 0030; prossimi pezzi: pulizia del flusso vecchio, riepilogo pre-bonifico.

---

# Consegna attiva — Richieste, pezzo 9: modifica, persone notte per notte, link della camera, elisione

Base `94d4acc` (main con l'avviso di connessione, dopo il pezzo 7). Caso
reale: ospite dal 17 al 21, in 2 la prima notte poi da sola (Amelia con il
secondo letto la prima notte, oppure Ambra).

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| N01 | «Modifica» in lista, pannello e proposta per in_attesa/proposta_inviata; modulo precompilato (nome, cognome, date, persone con striscia, camera, telefono, note, canale); confermate/rifiutate non si modificano. | `richieste.test` pianoModifica; UI 390: modifica di «Ricovero Marta» precompilata con la striscia [2,1,1,1] | VERDE |
| N02 | Proposta inviata + cambio di date/persone/camera → in_attesa, avviso «La proposta inviata si riferiva ai dati precedenti: rigenera e reinvia la proposta», storico in proposte_precedenti; telefono/note/canale non toccano lo stato. | `pianoModifica` (5 casi); UI 390: modifica di «Bianchi» (proposta inviata, persone 1→2) → avviso con «Rigenera la proposta», nel finto stato in_attesa e storico con testo e soluzione | VERDE |
| N03 | Striscia delle notti sotto «Persone»: caselle con data e numero, tocco cicla 1→max (capienza massima con brande = 4), frecce da tastiera, riga «17: 2 · 18–20: 1», a capo oltre le 7 notti, nessuno scorrimento a 320/390. | `riassuntoPersone` (6 casi); UI 390 e 320 (scrollWidth = viewport) | VERDE |
| N04 | persone_per_notte salvato solo se non uniforme; richieste web con persone uniche → null; senza la 0031 avviso e nessun salvataggio. | `creaRichiesta`/`aggiornaRichiesta` (manca0031); endpoint web invariato | VERDE (avviso non riprodotto a schermo) |
| N05 | Ricerca: capienza e pool per notte con le persone di quella notte; prezzo per notte con le tariffe vere in centesimi, letto solo dove serve; ogni camera del caso A col suo totale. Test 17–21 [2,1,1,1]: Amelia 285 € (75 + 3×70, letto solo il 17), Ambra 320 €, matrimoniale a 3 la prima notte = branda solo quella notte. | `richiesteProposta.test` (3 test nuovi) | VERDE |
| N06 | RPC conferma_richiesta 0031: letto aggiuntivo solo nelle notti che lo richiedono, num_guests = massimo, pool per notte, array incoerente rifiutato. | `richiesteConfermaRpc.test` in PGlite (SQL vera della 0031) | VERDE |
| N07 | Testo: «Nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 3 notti in una a 70 € a notte» (singolare/plurale); immagine con la striscia «Persone notte per notte» quando cambiano. | `richiesteTesti.test`; UI: testo e anteprima immagine di Marta | VERDE |
| N08 | Link «Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/[slug]» dopo il prezzo (slug verificati nel repo del sito: singola, allegra, ambra, lena; senza pagina niente riga). | test; UI: un link per camera nel testo di Marta | VERDE |
| N09 | Elisione: «dal 4 all'8», «dal 10 all'11», «dall'8 al 10», «all'1», «all'18», «all'28», «al 31», «al 3», «al 15», «l'8». | test per 1, 8, 11, 18, 28, 31 | VERDE |
| N10 | Caso A esatto: una camera («è disponibile soltanto la camera…, Il prezzo per le n notti è di…») e più camere («ho due camere libere che posso proporle: – Nome, descrizione: prezzo per le n notti»), apertura a capo, condizione all'arrivo e 3 ore nuove («una delle camere»); B, C, E, caparra e completo invariati. | test esatti su stringa intera | VERDE |
| N11 | Caso A a più camere: «Sì, inviata» salva proposta_alternative; in «Creare la prenotazione?» la scelta della camera accettata (mai preselezionata) diventa proposta_soluzione prima della RPC. | `scegliSoluzioneInviata`, FinestraConferma | VERDE (scelta non provata a schermo) |

## Decisioni prese in autonomia (comportamento prudente)

- L'elisione vale anche per «dal» («dall'8 al 10»), non solo per «al».
- L'apertura a capo vale per A, B e C; il caso E resta identico (bloccato).
- Il link della camera compare solo nel caso A (testo esatto dato); in B e C
  le righe restano invariate, salvo la riga «nel dettaglio» quando le persone
  del segmento cambiano (altrimenti «al prezzo di X € a notte» sarebbe falso).
- Con più camere nel caso A il blocco «alternativa Amelia» non compare (le
  alternative sono già elencate) e la caparra si calcola sulla camera scelta.
- Alternativa Amelia con persone variabili solo se la differenza a notte è
  costante (il testo promette «X € in più a notte»).
- `persone` resta il valore base del modulo; la RPC usa il massimo per
  num_guests. Un array persone_per_notte di lunghezza diversa dalle notti è un
  errore a schermo, mai un ripiego.
- La scheda prenotazione conserva la sua fila di caselle: StrisciaNotti è
  l'estrazione di quel markup, ricollegarla lì è una pulizia futura.

## Prove di consegna

- `npm test` 455/455; tsc; lint del delta; `verifica-consegna --base 94d4acc`
  e `next build`: esito nel resoconto.
- UI sull'anteprima finta (porta 3214) con click via JavaScript.

## Limiti aperti

- Migrazione 0031 non applicata: finché manca, persone variabili, modifiche
  con proposta inviata e proposte a più camere non si salvano (avviso).
- Le richieste web arrivano con persone uniche (per notte solo dal gestionale).
- La scelta della camera alla conferma non è stata provata a schermo.
- Il calendario principale e la scheda prenotazione non cambiano.

---

# Consegna — Avviso di connessione (03/09/2026)

Origine: il 3 settembre, a Casa Ania, il telefono ha perso la linea mentre
Ania inseriva un cliente dalla ricerca per nome. L'app si è bloccata su
«Ricerca...», riaperta mostrava la home con TUTTI gli importi a zero (come
se fossero veri) e poi il messaggio del login «Non riesco a raggiungere il
server». Cinque minuti di spavento. Richiesta di Ania: controllare tutto e,
quando manca la linea, dirlo chiaramente.

## Cosa c'era

- Le pagine ignoravano `error` delle letture Supabase: senza rete `data` è
  `null`, `[]` dopo il ripiego, quindi zeri e liste vuote presentati come dati.
- Nella nuova prenotazione un errore di rete nella ricerca valeva «nessun
  risultato» → «➕ Nuovo cliente» (rischio doppioni) e, con una richiesta
  appesa, il tasto restava su «Ricerca...» senza fine.
- Nessun tempo massimo alle richieste: una rete «mezza morta» tiene l'app
  ferma finché il sistema non taglia la connessione.

## Cosa c'è ora

| ID | Caso | Prova | Esito |
| --- | --- | --- | --- |
| A01 | Ogni richiesta a Supabase passa dal fetch sorvegliato: 30 s massimo (120 s per i file degli scontrini), poi `TimeoutError`. | lib/connessione.test.ts | VERDE |
| A02 | Errore di rete (Chrome «Failed to fetch», iPhone «Load failed», Firefox, Node) o tempo scaduto → stato «server irraggiungibile»; una risposta qualsiasi lo riporta a «raggiunto»; ascoltatori avvisati solo ai cambi. | lib/connessione.test.ts | VERDE |
| A03 | Un annullamento voluto dall'app (signal esterno) non accende l'avviso. | lib/connessione.test.ts | VERDE |
| A04 | Avviso in alto in tutta l'app (tranne /login), sticky sotto la barra del titolo, nel flusso della pagina (non copre nulla): «Il server non risponde» oppure «Nessuna connessione a internet» quando il telefono è offline (`navigator.onLine`). «Riprova» fa una lettura leggera: se risponde ricarica, altrimenti «Ancora niente». | anteprima finta 3213 con fetch spento dal browser | VERDE |
| A05 | Home: se una delle tre letture fallisce → scheda «Dati non disponibili» con il motivo e «Riprova» (ricarica solo i dati), MAI zeri. | anteprima finta | VERDE |
| A06 | Nuova prenotazione: ricerca per nome e per telefono con errore di rete → messaggio «Non riesco a cercare il cliente: nessuna connessione al server…», si resta sulla ricerca, tasto di nuovo attivo; nessun «nuovo cliente» finto. `single()` → `maybeSingle()` sui contatti extra (nessuna riga non è un errore). | anteprima finta | VERDE |
| A07 | Con la rete: ricerca per nome che non trova nessuno → «Nuovo cliente» con il nome già scritto e il telefono da aggiungere nel campo (correzione del 01/09, commit 6d44d69), comportamento invariato. | lettura del codice | VERDE |

Prove: `npm test` 448/448 (7 nuovi), `tsc --noEmit` pulito, lint del delta
senza nuovi rilievi (i 37 di app/page.tsx sono preesistenti, tipi `any`).

Limiti: il ritardo prima del messaggio può arrivare a ~10 s quando il client
Supabase sta anche rinnovando il token (riprova da solo con attese
crescenti); le altre pagine (prenotazioni, calendario, clienti) mostrano
l'avviso in alto ma le loro liste restano vuote finché non torna la linea.
Il ricaricamento dell'app senza alcuna rete resta nelle mani di Safari
(pagina non caricabile): il gestionale non è ancora un'app offline.

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

# Blocco precedente (Codex, in attesa di autorizzazione) — prenotazioni: quadrupla nera e date stabili

Il banner «Da controllare» fra mesi diversi è online e archiviato in
`CONSEGNE-ARCHIVIO-BANNER-DA-CONTROLLARE.md`. Questo blocco corregge due
regressioni segnalate da Ania nella gestione delle prenotazioni.

## Identità e perimetro

- Base tecnica: `6d44d69` (modifica del telefono della nuova prenotazione già
  presente e mantenuta intatta).
- Candidato implementato: `a8b4495`. Candidato fermo dopo revisione: HEAD di
  `correzioni-prenotazioni-quadrupla-date`, figlio di `a8b4495` (solo scheda,
  strumento di anteprima e voce di avvio: codice applicativo identico).
- Stato: VERIFICATO IN LOCALE — revisione consolidata di Claude verde del
  02/09/2026, nessun bloccante; PRONTO PER PASSAGGIO AUTORIZZATO. Nessun push
  e nessun deploy senza autorizzazione esplicita di Ania.
- Implementatore: Codex. Revisore: Claude (giro unico, 02/09/2026).
- Requisito colore: il terracotta significa che è occupato un solo letto del
  pool comune; il nero significa che entrambi i letti sono occupati e non se
  ne può aggiungere un altro. Una quadrupla in Lena occupa da sola entrambi.
- Requisito date: check-in e check-out non devono sovrapporsi su iPhone né
  nella nuova prenotazione né in modifica/prolungamento.
- Perimetro tecnico: calcolo puro e condiviso del pool letti, colori del
  calendario, lettura disponibilità in nuova/modifica prenotazione e classi
  protettive dei campi data. Nessuna query di scrittura nuova, nessuna
  modifica a dati, schema o permessi.

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| P01 | 0 letti = colore normale; 1/2 = terracotta; 2/2 o più = nero. Anche la riga riepilogativa dei letti mostra 2/2 in nero con testo bianco. | funzioni pure + integrazione pagina | VERDE: `calendarioLetti.test.ts` controlla stati, colori e collegamento effettivo della pagina. |
| P02 | Lena con 3 ospiti occupa 1 letto; Lena quadrupla occupa 2 letti e quindi la sua barra è nera. Due prenotazioni da un letto sovrapposte danno lo stesso nero. | funzioni pure | VERDE: `tariffe.test.ts` confronta la regola del calendario con la tariffa da 1 a 4 ospiti. |
| P03 | Le prenotazioni storiche con `extra_bed=true` e senza giorni espliciti restano conteggiate correttamente. | funzione pura + query | VERDE: test dedicato e campo `extra_bed` incluso nelle letture di nuova/modifica. |
| P04 | A 320–390 px le due date restano dentro le rispettive colonne nella nuova prenotazione; modifica e prolungamento conservano la stessa protezione già introdotta. | regressione sul sorgente | VERDE: wrapper `min-w-0` e input `min-w-0 appearance-none` verificati su entrambi i percorsi. |
| P05 | Nessun cambiamento ai conti, alle prenotazioni esistenti o al database; niente pubblicazione. | ispezione + suite | VERDE: solo letture già esistenti ampliate col campo necessario; nessun accesso remoto o scrittura. |

## Prove di consegna

- Test mirati del blocco.
- Suite applicazione completa, TypeScript e build di produzione.
- `node scripts/verifica-consegna.mjs --base 6d44d69` sul candidato pulito.

## Revisione consolidata di Claude (02/09/2026, candidato `a8b4495`)

Esito: NESSUN BLOCCANTE. Assert dei test esistenti non toccati.

Controlli tecnici sull'albero fermo `a8b4495`:

- Diff `6d44d69..a8b4495` letto per intero (9 file). Il telefono modificabile
  del cliente nuovo (base `6d44d69`) è intatto: il diff non tocca quella parte.
- `node scripts/verifica-consegna.mjs --base 6d44d69`: VERIFICHE_TECNICHE_OK
  (suite, regressioni delle revisioni, strumenti locali, TypeScript, lint).
- `next build`: exit 0, 27 pagine generate.
- Pulizia dei tipi del calendario: solo tipizzazione di `any` preesistenti,
  copia dell'array camere prima dell'ordinamento e aggiornamento del ref
  `vaiA` spostato in un effetto dichiarato PRIMA dell'effetto che lo usa (gli
  effetti corrono in ordine di dichiarazione): nessun cambio di comportamento.
- Regola del pool: `lettiPoolPrenotazione` conta 0/1/2, con `extra_bed=true`
  senza date o con sole date esplicite; il calendario colora sul TOTALE della
  notte (niente più sottrazione della prenotazione corrente); la nuova
  prenotazione legge anche `extra_bed` e usa la stessa funzione. La pagina di
  modifica non è nel diff e mantiene la sua regola locale identica.

Prove UI reali senza rete, con lo strumento aggiunto in questa revisione
(`scripts/revisioni/anteprima-prenotazioni-finta.mjs`: finto Supabase locale
con login e PostgREST minimale su 5 prenotazioni sintetiche; le scritture
sono rifiutate; voce `gestionale-bnb-anteprima-prenotazioni-finta` in
`.claude/launch.json`). Nessuna richiesta al progetto Supabase vero.

| Caso | Prova a 390 px | Esito |
| --- | --- | --- |
| Quadrupla Lena 3–5 set (2 letti da sola) | barra `rgb(31,41,55)` su entrambe le notti; riga letti `2/2` sfondo nero, testo `white` | VERDE |
| Allegra 3 ospiti + Ambra 3 ospiti il 7 set; solo Ambra l'8 | 7 set: entrambe le barre nere e `2/2` nero; 8 set: barra terracotta e `1/2` bianco/marrone | VERDE |
| Storica Amelia `extra_bed=true` senza date, PAGATA, 10–12 set | strisce terracotta/verde il 10; strisce nere/verde l'11 (pool esaurito da Lena bonifico) | VERDE |
| Lena 3 ospiti con BONIFICO l'11 set | strisce nere/viola; `2/2` nero | VERDE |
| Legenda | «1 letto extra occupato» terracotta e «2/2 letti occupati» nero | VERDE |
| Nuova prenotazione, caselle data | 390 px: check-in 33–191, check-out 199–357; 320 px: 33–156 e 164–287; nessuna sovrapposizione, ciascuna dentro la propria colonna, nessuno scorrimento orizzontale | VERDE |
| Nuova, Lena 4 ospiti 7–9 set | 7 e 8 set neri (2+2 e 1+2 > 2), Salva disabilitato | VERDE |
| Nuova, Lena 3 ospiti 7–9 set | 7 set nero, 8 set selezionabile (1+1 = 2), Salva disabilitato finché resta il 7 | VERDE |
| Nuova, Allegra 3 ospiti 3–5 set | 3 e 4 set neri per la sola quadrupla; Salva disabilitato | VERDE |

Limiti dichiarati:

- La sovrapposizione delle caselle data è un comportamento del Safari di
  iPhone: nel pannello Chromium si verifica solo il layout (colonne, larghezze,
  classi `min-w-0 appearance-none`); la conferma finale resta sull'iPhone di
  Ania dopo la pubblicazione. Modifica e prolungamento sono coperti dal test
  sul sorgente (protezione già presente nella base).
- Nella prima scheda del pannello i click restavano bloccati: il login è stato
  inviato con l'handler del modulo; il percorso della nuova prenotazione è
  stato ripetuto in una seconda scheda con click reali; camera, date e ospiti
  impostati con `form_input` (stessi eventi della digitazione).
- Nessuna prova su dati reali: vietato l'accesso remoto in questa revisione.

MIGLIORIE registrate (non condizionano l'approvazione):

- M1 (preesistente): in nuova prenotazione i giorni bloccati ma auto-selezionati
  appaiono come chip neri senza avviso testuale; l'unico segnale è Salva
  disabilitato. Un avviso esplicito aiuterebbe su telefono.
- M2 (documentazione): P03 cita «letture di nuova/modifica», ma solo la nuova
  è nel diff; la modifica conserva la regola locale identica. Unificarla su
  `lettiPoolPrenotazione` è una pulizia futura, non un difetto.

## Prossimo passo

🔴 Ania autorizza la pubblicazione (push su `main` + deploy Vercel) del
candidato fermo. Dopo la pubblicazione: controllo su iPhone delle due caselle
data e di una quadrupla in Lena sul calendario vero.
