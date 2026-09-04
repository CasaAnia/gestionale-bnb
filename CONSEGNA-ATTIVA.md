# STATO IN 10 RIGHE (aggiornato il 04/09/2026, pomeriggio) — da incollare a un altro assistente

1. Gestionale Casa Ania (Next.js su Vercel, Supabase tnsaa…vwv, usato SOLO da Ania): su `main` la sezione Richieste ha i pezzi 1–7 e 9–11 con i TESTI DEFINITIVI del 04/09 (lib/richiesteTesti + lib/descrizioniCamere: non toccarli senza Ania); il modulo Spese nuovo è in produzione con la scrittura su `legacy`.
2. Migrazioni applicate a mano: 0001–0022, 0024, 0025, 0027, 0028, 0029, 0031, 0032 (documenti dei clienti, applicata da Ania il 05/09/2026, bucket «documenti» privato creato). In `supabase/proposte` NON applicate: 0023, 0026 (RLS), 0030 (vincoli server fatture).
3. Branch `fatture-fase5` (Fase 5 fatture + 4 correzioni avversarie) e branch `statistiche` (solo fondamenta pure, senza interfaccia): entrambi in attesa della decisione di Ania; main non li contiene.
4. Blocco 1 (04/09): elisione solo per 1, 8, 11 («all'8», «al 18»). Blocco 2: /richieste da desktop con calendario «Mese / 2 settimane», lista ariosa, intestazione su una riga; telefono invariato. Blocco 4 (04/09 sera, scelta di Ania sul mockup A): da desktop calendario a TUTTA larghezza sopra e lista sotto in schede su due colonne (≥1100 px), riga di sezione «RICHIESTE APERTE · N — Ordina per», vuoto = riga sottile tratteggiata con «+ Nuova richiesta»; niente più due colonne affiancate. Calendario desktop +20% (righe 54, intestazione 48, camere 15 px, barre 13–14 px, colonna camere 116, colonne 2 settimane ≥ 80 px); telefono invariato. Blocco 3: web-push tolto dal sito, docs senza secondo utente, scheda «prove in 10 minuti».
5. Proposte: ricerca automatica invariata (caso A poi B/C/E, per notte), «Altre camere» con i motivi, «Scelgo io» notte per notte con prezzo a mano; conferma solo via RPC 0031 (per notte).
   Documenti dei clienti (05/09, scelta di Ania, «fallo direttamente, mai cancellare dopo la partenza»): components/DocumentiCliente (scheda cliente: foto dal telefono ridotte a 1600 px JPEG, PDF, etichetta e fronte/retro, anteprime con URL firmati 1 h, elimina con conferma; RigaDocumentiPrenotazione «Documenti · N» nella scheda prenotazione → /clienti/<id>#documenti), lib/documentiCliente (funzioni pure, 4 test), migrazione 0032; senza migrazione la sezione avvisa e non salva.
   Griglia del Mac anche sul telefono in Calendario e Arrivi (05/09): riquadro bianco con ombra, riga «‹ periodo · Mese | 2 settimane ›», righe 44, intestazione 40, colonna camere 80 fissa col solo nome, colonne ≥ 60 (40 a mese) che scorrono di lato, barre su una riga con icone/navetta in linea, legenda del Calendario anche dritto; via l'altezza a schermo pieno della pagina e le vecchie misure gs() del telefono (restano le costanti mobile non usate).
   Tre pagine uguali anche sul telefono (05/09, richiesta di Ania): titolo + «Cerca nome o telefono…» (components/CampoRicerca) su Richieste, Calendario e Arrivi — Mac e telefono girato sulla stessa riga, dritto uno sotto l'altro; riga «Oggi · mesi» (components/RigaMesi + lib/mesiCliccabili, 2 test) sotto il calendario su tutte e tre le pagine, telefono e Mac, anche girato (Arrivi solo i mesi dentro i 90 giorni); Richieste ha la ricerca (lib/ricerca: nome, cognome, telefono) che filtra la lista e, con un solo risultato, lo evidenzia nel calendario; «← Indietro» a 16 px dal bordo su Calendario e Arrivi anche sul telefono (come BackBar in tutto il resto); in orizzontale niente legenda.
   Telefono in orizzontale (05/09, scelta di Ania): su Richieste, Calendario e Arrivi resta solo il calendario a tutto schermo — body[data-schermo-intero] (useSchermoIntero) + media (orientation: landscape) and (max-height: 520px) in globals.css nasconde barra alta (.barra-alta), barra bassa (.barra-bassa), margini del main (.contenuto) e il limite max-w-lg; la pagina nasconde titolo, chip, lista, righe sotto il riquadro e legenda (useOrizzontaleTelefono); Calendario/Arrivi contano come «desktop» in orizzontale (griglia compatta del Mac); Richieste passa compatto al calendario (colonne 52 px, 14 giorni senza scorrere). In verticale nulla cambia.
   Telefono, colonna camere (05/09): solo il nome, senza numero (Richieste 66 px, Calendario e Arrivi 80 px, senza descrizione); corretto il cambio camera nella griglia Richieste del telefono (taglio a incastro e angoli seguono la griglia orizzontale, prima usavano quelli verticali).
   Telefono come il Mac (05/09/2026, prova chiesta da Ania): /richieste sul telefono ha la stessa struttura del desktop — titolo, griglia camere-in-righe/giorni-in-colonne che scorre di lato dentro il riquadro (colonna camere 72, colonne ≥60 a 2 settimane, ≥40 a mese, selettore Mese | 2 settimane anche sul telefono), poi Reale/Presunta + «+ Nuova richiesta», contatori, «RICHIESTE APERTE · N», lista; via le schede Calendario/Lista; la vecchia griglia verticale resta nel componente (orizzontale=false la riporta).
   Sotto il riquadro (04/09 notte): campo di ricerca del Calendario col bordo #C9BFA8 e segnaposto stone come i selettori; riga «Oggi · mesi» (Calendario) e «Oggi · prossimi 83 giorni» (Arrivi) staccata di 24 px dal riquadro, testi 13 px, chip più grandi; legenda con più aria.
   Distanze uguali (04/09 notte): dal Mac su Richieste, Calendario e Arrivi «← Indietro» a 16 px dal bordo, riga del titolo alta 44 px (min-h) e 16 px prima del riquadro, che parte a 116 px su tutte e tre.
   Allineamento finale (04/09 notte): dal Mac Calendario e Arrivi hanno il titolo di pagina («Calendario» con la ricerca a destra, «Arrivi») sotto «← Indietro» come le Richieste, così il riquadro parte alla stessa altezza; la riga «Oggi · mesi» sta SOTTO il riquadro, sopra la legenda.
   Ripensamento (04/09 notte): Richieste tornate alle misure di prima (via il +20%); Calendario e Arrivi copiati IDENTICI dalle Richieste: righe 44, giorni 40, camere 96, testi 11–13, riga di navigazione «‹ · 1 – 14 set 2026 · Mese | 2 settimane · ›» (il selettore cambia la larghezza delle colonne, 14 o 30 nel riquadro, scelta in localStorage ca_calendario_modo; scorrimento continuo invariato), niente striscia dei mesi sopra i giorni; sotto una riga sottile con «Oggi» e i 12 mesi cliccabili (Calendario) / «Oggi» (Arrivi).
   Stessa grafica delle Richieste su Calendario e Arrivi (04/09 sera): griglia dentro il riquadro bianco arrotondato con la barra «‹ 2 settimane › · mese · Oggi» come prima riga, legenda fuori senza sfondo; Arrivi con le stesse misure leggere (righe 54, camere 116, testi 13/15, navetta in linea); telefono invariato.
   Calendario principale dal Mac (blocco 5, 04/09 sera, mockup approvato): griglia leggera come le Richieste (righe 54, colonna camere 116 senza descrizione → tooltip, barre col solo nome e icone piccole in linea, intestazione 26+48); barra sopra la griglia «‹ 2 settimane › · Mese anno · Oggi · 12 mesi cliccabili con l'anno» (vaiAData estende l'intervallo e scorre); scorrimento continuo su tutto l'anno, riga letti extra e legenda invariate; telefono invariato.
   Statistiche pulizie (04/09 sera): dato principale = INTERVENTI (pulizie a mano + automatiche + cambi biancheria, ogni cambio vale uno) con la media al giorno sul totale e sotto «di cui N pulizie, N cambi biancheria»; stessa regola sul passato ricostruito (lib/pulizieStatistiche, 4 test); sezione Pulizie invariata.
   Pulizie automatiche (04/09 sera): partenza + nuovo arrivo lo stesso giorno o il giorno dopo nella stessa camera (solo confermate) = pulizia FATTA da sola con la data della partenza, calcolata dalle prenotazioni (lib/pulizie: pulizieAutomatiche, nessuna migrazione, sparisce se la prenotazione cambia); in «Oggi» resta come lavoro con etichetta «automatica» e senza pulsanti, mai «in ritardo»; nuovo registro «Ultime pulizie» (manuali + automatiche) con «Cambia data» / «Non fatta» (righe cleanings con note automatica:*); statistiche contano manuali + automatiche dal 24/08, mai doppioni lo stesso giorno; 4 notti e partenze senza arrivo vicino invariate; 7 test.
   Nomi (04/09 sera): ovunque «Nome Cognome», mai «Cognome Nome» (lib/guestName: nomeCompleto e nomeBreve «Anna R.» per le barre; riesportate da lib/richieste); dati e testi bloccati intatti.
   Timer della proposta (04/09 sera): sulle richieste in «proposta inviata» una riga con l'orologio, «Proposta inviata · scade tra 2 h 15 min» (verde) poi «… scaduta 20 min fa / 3 h fa / ieri» (ottone), in lista, dettaglio, pannello e tooltip del calendario; conta da proposta_inviata_at (solo «Sì, inviata», colonna già in 0024, nessuna migrazione), si aggiorna ogni minuto (useAdesso), le scadute entrano in «N da guardare»; alla scadenza nessuna chiusura né notifica (lib/richieste: scadenzaProposta, 5 test).
6. Sito casaaniarozzano.it (repo sito-casaania): il modulo /prenota manda le richieste a POST /api/richieste/web; nessuna prenotazione nasce dal sito; ripiego Pushover.
7. Prove: suite `npm test` (467 test), `tsc`, lint del delta, `next build`, `node scripts/verifica-consegna.mjs --base <sha>`; UI sull'anteprima finta `gestionale-bnb-anteprima-richieste-finta` (3214, login con qualsiasi email) e `gestionale-bnb-anteprima-prenotazioni-finta` (3213).
8. Regole: nessun invio reale; migrazioni solo a mano da Ania; il calendario principale, la ricerca delle soluzioni e la RPC non si toccano senza un pezzo dedicato; un commit per blocco; mai modificare gli assert dei test esistenti.
9. Memoria del browser: `ca_richieste_calendario_modo` (mese/quindici), `ca_richieste_ultima_visita`, `ca_proposta_pendente_<id>`.
10. 🔴 Azioni aperte per Ania: prove dal telefono (scheda «in 10 minuti» qui sotto); scelte «da confermare» del blocco 2; decisioni su fatture-fase5, statistiche e 0030.

---

# Come provare la sezione Richieste dal telefono in 10 minuti (04/09/2026)

Tutto sul gestionale vero, con richieste di prova che alla fine si rifiutano.
Nessun messaggio parte se non tocchi «Apri WhatsApp e invia».

1. Richieste → «+ Nuova richiesta»: nome Candida, cognome Prova, arrivo 17
   settembre, partenza 21, Persone 2. Nella striscia tocca 18, 19 e 20 finché
   mostrano 3 (sotto: «17: 2 · 18–20: 3»). Camera: Ambra. Salva.
2. Su Candida Prova tocca «Invia proposta», poi il chip «All'arrivo». Il testo
   deve essere IDENTICO a questo (confronta parola per parola):
   «Gentile Candida,» a capo «grazie per aver pensato a Casa Ania per il suo
   soggiorno.» — riga vuota — «Ho verificato le date che mi ha indicato. Dal 17
   al 21 settembre è disponibile soltanto Ambra, una camera matrimoniale con il
   bagno in camera. Per le notti in cui sarete in tre posso aggiungere un letto
   in più.» — riga vuota — «Il prezzo per le 4 notti è di 350 €. La prima notte
   in due a 80 €, le altre tre notti in tre a 90 € a notte.» — riga vuota —
   «Qui può vedere le foto e i dettagli della camera:
   casaaniarozzano.it/camere/ambra» — riga vuota — «Il pagamento avviene
   all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti
   oppure con bonifico istantaneo.» — riga vuota — «Se desidera confermare la
   camera, la prego di farmelo sapere entro 3 ore da questo messaggio.
   Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.» —
   riga vuota — «Resto a disposizione per qualsiasi informazione.» — riga vuota
   — «Grazie mille,» a capo «Ania – Casa Ania».
3. Tocca «Modifica la richiesta», Camera «Qualsiasi», Salva → «Invia
   proposta»: il testo dice «ho due camere libere che posso proporle:» con le
   righe «– Allegra, …» e «– Ambra, …» e «Se desidera confermare una delle
   camere». Sotto il caso c'è il riquadro «Altre camere» con i motivi (es.
   «Amelia senza posto per 3 (18–20 set)»).
4. Tocca «Scelgo io»: 4 caselle. Tocca il 17 finché mostra «Amelia»; tocca il
   20 finché mostra «Lena» (se Lena è libera). Sotto: «17: Amelia · 18–19:
   Ambra · 20: Lena» e il totale. Il testo diventa il cambio di camera con
   «qualche cambio di camera», la riga di Lena dice «una tripla con il bagno
   privato appena fuori dalla porta, chiuso a chiave» e poi «Il cambio di
   camera lo faccio io al mattino, non deve pensare a nulla.»
5. Tieni premuta la casella del 17: «Prezzo della notte», scrivi 60, «Applica».
   La casella prende il bordo ottone, compare «prezzo modificato», il totale
   scende di 15 € e la riga di Amelia dice «60 € a notte». «Ripristina
   tariffa» rimette 75 €.
6. «Testo + immagine»: nell'immagine gli importi sono scritti come nel testo
   («80 €», non «80,00 €»).
7. Chiudi senza inviare. Nella lista tocca «Rifiuta» su Candida Prova, motivo
   «Altro». Fine.

---

# Consegna — Prezzo notte per notte quando le persone cambiano (04/09/2026, sera, main)

Caso reale: Lena, 2 notti, prima notte in 2 e seconda in 3. Il letto in più
era segnato solo sulla seconda notte ma il prezzo applicava 90 € a entrambe
(180 €). Ora 80 + 90 = 170 €. Con persone uguali in tutte le notti il conto
è IDENTICO a prima (test dedicato).

- Fonte unica: `lib/prezzoNotti.ts`. Le persone di ogni notte di una
  prenotazione vengono da num_guests + extra_bed_dates (la stessa fonte dei
  letti aggiuntivi): nelle notti col letto num_guests persone, nelle altre la
  capienza base; senza notti col letto, num_guests ovunque (regola di sempre).
- Salvataggio SENZA migrazione, stessa convenzione della RPC 0031:
  price_per_night = tariffa della notte più economica, extra_bed_total =
  resto, total_amount = somma delle notti. `contoSoggiorno` resta esatto.
- Il campo «Tariffa/notte» del form segue il listino della notte più economica
  (si riallinea togliendo/aggiungendo notti col letto o cambiando date); se
  scritto a mano resta e sposta tutte le notti della stessa differenza.
- Ricalcolo: cambiare le notti col letto è già un campo economico (le date
  del letto erano nel confronto); all'apertura di «Modifica» una riga salvata
  col vecchio calcolo (tariffa a persone massime) viene riallineata, così il
  salvataggio ricalcola e l'anteprima dice «Da €180 a €170».
- Dove la tariffa non è uniforme si mostra il dettaglio («1 notte in 2 a
  80 €, 1 notte in 3 a 90 €») al posto di un prezzo a notte: scheda (lettura,
  modifica, cambio camera), storico cliente in /nuova, riepilogo di /nuova,
  conferma WhatsApp (testo e immagine, stessa funzione `righeCostiSegmenti`
  ora usata anche dal testo della scheda), immagine della proposta. Uniforme
  = come oggi. Il calendario conta le notti coperte dagli acconti con la
  tariffa di ogni notte.
- Proposte: `segmento()` usa la stessa funzione (numeri invariati, test di
  uguaglianza proposta ↔ prenotazione). Testi definitivi non toccati.

## Casi di accettazione (lib/prezzoNotti.test.ts, 12 test)
persone costanti invariato (Lena 2/3/4, Ambra 2/3, Amelia 1/2) · Lena 2 poi 3
= 170 · 3 poi 2 = 170 · 2-3-2 = 250 · Lena a 4 = 100 a notte (2 poi 4 = 180)
· Ambra letto una notte sola invariato · tariffa a mano · proposta =
prenotazione · righe del riepilogo (mista, uniforme, riga vecchia col bug →
totale salvato) · riallineamento del campo tariffa · persone dai letti · testo.

## Prove
`npm test` 473 verdi (461 + 12), `tsc` pulito, lint del delta senza nuovi
rilievi (31 pre-esistenti nelle due pagine). UI sull'anteprima finta 3213
(dati aggiunti: «Due Poi Tre» 14–16 set salvata nel modo nuovo, «Vecchio
Calcolo» 18–20 set col bug): scheda «Tariffa: 1 notte in 2 a €80, 1 notte in
3 a €90 · Totale €170»; modifica: aggiungendo la notte 14 → 90 e 180,
togliendola → 80 e 170, a mano 85 → 85/95; riga vecchia: lettura 90/180,
modifica → 80 e «Da €180 a €170 (ricalcolato dai nuovi dati)»; conferma
WhatsApp testo e immagine «Camera Lena – Tripla (1 notte in 2 a 80,00 €, 1
notte in 3 a 90,00 €): 170,00 €»; /nuova a 3 notti con letto solo il 24 →
«2 notti in 2 a €80, 1 notte in 3 a €90 · Totale €250»; calendario carica.
Nessun salvataggio reale (la preview rifiuta le scritture). Build non rieseguita.

## Limiti
- La riga già salvata col bug resta 180 € finché Ania non apre «Modifica» e
  salva (il totale salvato è autorevole): nessun dato viene riscritto da solo.
- Nel cambio date di un soggiorno con cambio camera il letto di Lena a 3 non
  viene più addebitato a parte (prima 10 €/notte in più: era un errore).

---

# Consegna attiva — incarico del 04/09/2026: elisione, /richieste da desktop, pulizia e documentazione (blocchi 1–3, main)

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| B1 | Apostrofo solo per 1, 8, 11 in tutte le forme (al/dal/del); 18, 21, 28, 31 senza; l'esempio di Candida identico. | `richiesteTesti.test` (casi espliciti) | VERDE |
| B2a | Calendario desktop: selettore «Mese / 2 settimane» (default 2 settimane su desktop, mese sul telefono, in localStorage); a 2 settimane colonne ≥ 72 px con «Nome C.» intero e scorrimento con la colonna di oggi in vista; nel mese tooltip con nome completo, date, persone, camera, stato. | UI 1280/1440 + test degli helper | VERDE |
| B2b | Lista da 768 px: righe ariose, nome in Fraunces 16 px, dettagli 13 px, pulsanti a destra su una riga, badge ⇄ e «si sovrappone con…» su riga propria in ottone; lista ≥ 380 px; fra 768 e 1100 px calendario sopra e lista sotto. | UI 1280/1440/900 | VERDE |
| B2c | Intestazione desktop su una riga: titolo, «N nuove dal sito», «N da guardare», Reale/Presunta, «+ Nuova richiesta». | UI 1280 | VERDE |
| B2d | Telefono (390 px) identico prima/dopo: calendario e lista confrontati con screenshot dell'anteprima finta. | screenshot prima/dopo | VERDE |
| B3a | Sito: dipendenza web-push (+ @types) rimossa; tsc e 9 test verdi; push su main del sito (4b4884b). | repo sito-casaania | VERDE |
| B3b | Nessun riferimento a un secondo utente o a «Ivan» nella documentazione dei due repo (in PROGETTO.md resta solo la nota storica «"Ivan" era un'imprecisione» sull'intestatario del bonifico, che non è un utente). | grep | VERDE |
| B3c | STATO IN 10 RIGHE aggiornato e scheda «in 10 minuti». | questo file | VERDE |

## Scelte da confermare con Ania (blocco 2)

- A 1280 px il calendario a 2 settimane mostra circa 7 giorni per volta e
  scorre in orizzontale (colonne larghe per le etichette intere); se preferisce
  vedere tutti i 14 giorni senza scorrere, basta abbassare COL_MIN_QUINDICI o
  scegliere «Mese».
- La finestra a 2 settimane parte 3 giorni prima di oggi.
- «+ Nuova richiesta» su desktop è nell'intestazione (non più sopra la lista).
- Fra 768 e 1100 px calendario sopra e lista sotto (prima erano affiancati).

## Limiti

- Le prove UI sono sull'anteprima finta con dati sintetici; il tooltip è un
  `title` nativo (compare dopo un attimo al passaggio del mouse).

---

# Blocco precedente — Richieste, pezzo 11: testi DEFINITIVI delle proposte (bloccati da Ania il 04/09/2026)

Base `870ef77` (pezzo 10). Sostituiscono per intero i testi del pezzo 6 e le
modifiche del pezzo 9. Nessuna modifica alla ricerca delle soluzioni né alla RPC.

## Casi di accettazione (tutti su stringa intera)

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| T01 | Esempio esatto di Ania: A una camera, 2,3,3,3 in Ambra, all'arrivo. | `richiesteTesti.test` | VERDE |
| T02 | A una camera con persone fisse («, a 70 € a notte»), letto in più una notte (prima / ultima / in mezzo), tutte le notti tranne la prima, dettaglio parlato fino a tre gruppi e con le date oltre. | test | VERDE |
| T03 | A due camere e tre camere (riga vuota fra le camere, «una delle camere»). | test | VERDE |
| T04 | B un cambio, B due cambi con Lena (frase del bagno anche nella riga, «qualche cambio»), B con persone variabili in un segmento («in tre a 90 € a notte, poi in due a 80 € a notte»). | test | VERDE |
| T05 | C notte in mezzo stessa camera (riga unica con «e»), C notte all'inizio, C due notti alla fine («per le quali»), C con cambio camera («Il cambio di camera lo faccio io…», link delle camere); la ricerca automatica (caso D interno) usa lo stesso modello. | test | VERDE |
| T06 | E intero, senza condizione né 3 ore. | test | VERDE |
| T07 | Condizioni 1–4, 3 ore nelle tre varianti, chiusura; elisione 1/8/11/18/28/31 e «dell'8»; mesi diversi; notte singola; importi con decimali. | test | VERDE |
| T08 | Blocco Amelia nello stile nuovo, fra il link e la condizione. | `richiesteTestiAmelia.test` | VERDE |
| T09 | Immagine: stesse date e stessi importi del testo («80 €»); conferma invariata. | UI 390 | VERDE |
| T10 | UI a 320, 390 e 1280 px senza scorrimento laterale. | anteprima finta | VERDE |

## Decisioni prese in autonomia

- Nelle righe con trattino e nel dettaglio le date sono solo i giorni («dal 17 all'18») se nello stesso mese del periodo; con mesi diversi compaiono i mesi.
- Dettaglio parlato: gruppi consecutivi (persone e prezzo uguali); 2 gruppi → «la prima notte / le prime N notti» + «l'ultima notte / le altre N notti»; 3 gruppi → in mezzo «la notte seguente / le N notti seguenti» e alla fine «le ultime N notti»; oltre 3 → le date.
- Letto in più una notte in mezzo: «Per la notte del 18 settembre, in cui sarete in due, …».
- Caso C con una sola notte coperta: «per l'altra notte».
- La firma resta «Grazie mille,⏎Ania – Casa Ania» (nel testo consegnato l'a capo era perso).
- «Niente due punti nel corpo»: restano quelli davanti agli elenchi e nella condizione 1 così com'è nel testo di Ania.

## Limiti aperti

- Nessuno funzionale; le proposte già inviate restano quelle salvate.

---

# Blocco precedente — Richieste, pezzo 10: «Altre camere» con i motivi e «Scelgo io» notte per notte

Base `4ef87dc` (pezzo 9). Caso reale: 17–21 in 2 poi in 3; l'automatico
proponeva solo Ambra senza dire perché non Amelia (senza posto per 3) né
Lena (occupata), e non c'era modo di comporre «17 in Amelia, 18–20 in Lena».

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| S01 | Riquadro «Altre camere» sempre visibile con una riga per camera non usata: «occupata 18–20 set», «senza posto per 3 (18–20 set)», «brande esaurite 19 set», «libera»; solo confermate e persone per notte. | `richiesteComposizione.test` motiviEsclusione (4 motivi, caso reale, priorità occupata > senza posto, in_attesa ignorate); UI 390: «Amelia senza posto per 3 (14–16 nov) · Ambra libera · Lena occupata 14–16 nov» | VERDE |
| S02 | «Cambia» sempre presente; con una sola soluzione «Nessun'altra soluzione automatica». | UI | VERDE |
| S03 | «Scelgo io»: striscia riusata (StrisciaNotti generica), casella = data, camera, persone, prezzo; tocco = camera ammessa successiva (libera, con posto per le persone di quella notte, brande), «nessuna» in coda; menu a tendina su desktop; parte dalla soluzione corrente; «Torna alla proposta automatica». | `camereAmmesseNotte`, `cameraSuccessiva`, `composizioneDaSoluzione`; UI 390: da Allegra×4 a «13: Amelia · 14–16: Ambra · totale 345 €», caso «Cambio camera» | VERDE |
| S04 | Riassunto compresso e totale in centesimi ricalcolato a ogni tocco con le tariffe vere, secondo letto solo dove serve. | `soluzioneDaComposizione` (A camera diversa 350 €, B 345 €, B due cambi, C buco, estremo, completo) | VERDE |
| S05 | Composizione = soluzione a tutti gli effetti (`manuale: true`, stessi segmenti), salvata con «Sì, inviata» e confermata dalla RPC senza modifiche. | struttura identica (segmento/conPrezziNotti); RPC 0031 ricontrolla camera e brande per segmento | VERDE (conferma di una composizione non provata a schermo) |
| S06 | Prezzo a mano: tocco lungo (matita su desktop) → campo in euro; Applica, Applica a tutte le notti di questa camera, Ripristina tariffa; bordo ottone e «prezzo modificato». | test (una notte, tutte, ripristino, flag e prezzi nel segmento); UI 390: 13 nov a 60 € → totale 330 € e riga «al prezzo di 60 € a notte» nel testo | VERDE |
| S07 | Testo della composizione: A (camera diversa), B con uno o più cambi (una riga per segmento), C con notti scoperte, «Nel dettaglio» per segmento con persone variabili e prezzi a mano, link una volta per camera. | 5 test esatti in `richiesteTesti.test` | VERDE |
| S08 | Immagine: linea del soggiorno con i segmenti, camera e persone per notte; notti scoperte come nel pezzo 6. | UI: «Testo + immagine» della composizione mostra SOGGIORNO NON CONTINUO con «Dal 13 al 14 novembre … 2 persone» e «Dal 14 al 17 novembre … 3 persone» | VERDE |
| S09 | 320/390 px senza scorrimento laterale; la striscia va a capo. | UI | VERDE |

## Decisioni prese in autonomia

- Un solo motivo per camera nel riquadro, il più forte (occupata > senza posto > brande), con le sue notti.
- Il link di ogni camera compare nei testi B/C solo per le composizioni manuali; i testi automatici B/C restano bloccati come dal pezzo 9.
- Con una composizione manuale non si elencano «alternative» del caso A e il blocco Amelia segue le regole di sempre.
- «Ripristina tariffa» agisce sulla notte in modifica; cambiando camera a una notte il suo prezzo a mano decade.
- Commit: la logica (a, b) e la schermata (c) sono divisi per file, non per funzione, perché riquadro, striscia e prezzo vivono nella stessa pagina.

## Limiti aperti

- La conferma di una composizione manuale non è stata provata a schermo (la RPC ricontrolla comunque camera e brande).
- Il tocco lungo è simulato nel pannello con eventi pointer; la prova vera è sull'iPhone.
- Nessuna migrazione: le colonne del pezzo 9 bastano.

---

# Blocco precedente — Richieste, pezzo 9: modifica, persone notte per notte, link della camera, elisione

Base `94d4acc` (main con l'avviso di connessione, dopo il pezzo 7). Caso
reale: ospite dal 17 al 21, in 2 la prima notte poi da sola (Amelia con il
secondo letto la prima notte, oppure Ambra).

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| N01 | «Modifica» in lista, pannello e proposta per in_attesa/proposta_inviata; modulo precompilato (nome, cognome, date, persone con striscia, camera, telefono, note, canale); confermate/rifiutate non si modificano. | `richieste.test` pianoModifica; UI 390: modifica di «Marta Ricovero» precompilata con la striscia [2,1,1,1] | VERDE |
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
