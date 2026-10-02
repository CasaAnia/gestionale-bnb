# Pulizie nuova («Oggi», Registro, Statistiche) + Bagagli e partenza — checklist

Riferimenti approvati da Ania il 01/10/2026, copiati tali e quali:
- `docs/design/pulizie-riferimento.html` (1 la pagina in alto, 2 scorrendo, 3 il foglio «Bagagli e partenza»)
- `docs/design/pulizie-fogli-riferimento.html` (recupero prima/dopo, Rimanda o salta, minuti degli spazi comuni)
- `docs/design/pulizie-registro-statistiche-riferimento.html` (Registro, correzione, Statistiche in sette schermate)

Nella bozza il carattere è un sostituto: valgono Cormorant e il sans del gestionale.
Integrazioni di Ania dello stesso giorno: Registro e Statistiche SI fanno (P8, P9);
per i fogli prevale P7; Home invariata salvo fogli condivisi ed etichette degli spazi
comuni; nessuna falsa certezza nel grafico; conteggi verificabili; schema vecchio e
nuovo entrambi provati; migrazione solo proposta.

Ogni voce alla fine è **fatta** oppure **non fatta** col motivo.

## P1 · Due colonne nuove (migrazione NON applicata)
- [x] P1.1 Bozza `supabase/proposte/0064_bagagli_e_partenza.BOZZA.sql` (primo numero libero dopo 0063) con `bookings.bagagli_alle time null` e `bookings.check_out_time time null`, nessun default, nessun dato toccato → **fatta** — 0064 (0063 è la proposta di Codex in attesa)
- [x] P1.2 Grant e RLS come le altre colonne di bookings (nessuna policy nuova: valgono quelle della tabella) → **fatta**
- [x] P1.3 In cima le istruzioni per Ania (SQL Editor, select di controllo dopo) → **fatta**
- [x] P1.4 Senza la migrazione tutto ciò che usa le due colonne resta nascosto, senza errori; colonna assente ≠ errore di rete/permessi (questi si dicono) → **fatta** — lib/schema0064 + useParte0064; provato in anteprima senza 0064
- [x] P1.5 Provato con lo schema di prima e con quello aggiornato → **fatta** — anteprima FINTO_PULIZIE_SQL=3 con e senza FINTO_0064; PGlite 5/5

## P2 · Foglio «Bagagli e partenza» (scheda prenotazione, Soggiorno)
- [x] P2.1 Sotto la riga dell'arrivo due righe nello stesso stile: «Bagagli» → «alle 11:00 ›» / «no ›» → **fatta**
- [x] P2.2 «Partenza» → «dom 4 ott · 10:00 ›» / «dom 4 ott · da chiedere ›» (da chiedere in mattone) → **fatta**
- [x] P2.3 Un tocco su una delle due apre lo stesso foglio → **fatta**
- [x] P2.4 FoglioMaison ad altezza fissa (regola P7) → **fatta**
- [x] P2.5 Eyebrow «BAGAGLI E PARTENZA · [CAMERA]» maiuscoletto ottone → **fatta**
- [x] P2.6 Nome dell'ospite in Cormorant 28 → **fatta**
- [x] P2.7 Sotto in grigio «arriva gio 1 ott alle 16:00 · parte dom 4 ott» (ora solo se c'è) → **fatta**
- [x] P2.8 «BAGAGLI PRIMA DELL'ARRIVO»: linguette «No» · «Sì, alle…» (stile FoglioArrivo) → **fatta**
- [x] P2.9 Con «Sì, alle…» il campo ora a filo, Cormorant 24, 160 px → **fatta**
- [x] P2.10 Salva → `bagagli_alle` (No → null) → **fatta**
- [x] P2.11 «PARTENZA · DOM 4 OTT»: linguette «Da chiedere» · «Alle…», col campo ora → **fatta**
- [x] P2.12 Nota grigia 12,5 px «Se la sai, scrivila: le Pulizie sapranno da che ora la camera è libera.» → **fatta**
- [x] P2.13 Link sottolineato «CHIEDI ORARIO» col messaggio P3 → **fatta**
- [x] P2.14 Salva → `check_out_time` (Da chiedere → null) → **fatta**
- [x] P2.15 «Annulla» (contorno) e «Salva» (pieno ink), 1fr 1.6fr, alti 44, a 96 px dal fondo → **fatta**
- [x] P2.16 Salvataggio controllato: righe restituite + rilettura completa; mai «salvato» se non lo è; risposta persa = esito incerto con i dati tenuti → **fatta** — lib/bagagliPartenzaDati, 6 test
- [x] P2.17 Più camere / cambio camera: bagagli sul primo tratto, partenza sull'ultimo tratto, per ogni linea di camere contemporanee; tratti annullati esclusi; nessun orario sulla camera sbagliata (provati: due camere con partenze diverse, cambio camera, tratto annullato) → **fatta** — lib/bagagliPartenza; provati in anteprima cambio camera con tratto annullato e due camere

## P3 · Messaggio «Richiesta orario di partenza»
- [x] P3.1 In lib/messaggiWhatsApp.ts accanto a messaggioRichiestaOrario, stesso saluto (salutoOspite) → **fatta**
- [x] P3.2 Testo parola per parola, col giorno «domenica 4 ottobre» → **fatta** — parole identiche; a capo come «Richiesta orario» («Grazie mille,» / «Ania»)
- [x] P3.3 Test che blocca il testo → **fatta**
- [x] P3.4 Apertura con openWhatsApp (mai whatsapp:// a mano) → **fatta**

## P4 · Linguetta «Oggi»: il grafico della giornata (schermata 1)
- [x] P4.1 Linguette Oggi · Registro · Statistiche restano → **fatta**
- [x] P4.2 Giorno in Cormorant 34 centrato («giovedì 1 ottobre») → **fatta**
- [x] P4.3 Sotto in maiuscoletto «N DA FARE · N FATTA/FATTE» (fatte in ottone scuro) → **fatta**
- [x] P4.4 Righello 8–20 (8, 10, 12, 14, 16, 18, 20 in 10 px grigio), fili tratteggiati leggerissimi alle 10, 14, 18 → **fatta**
- [x] P4.5 Una riga per OGNI camera attiva, ordine ROOM_ORDER, alta 56, nome Cormorant 19 in colonna da 62 → **fatta** — ordine ROOM_ORDER (Amelia, Allegra, Ambra, Lena); il riferimento metteva Lena prima a titolo d'esempio
- [x] P4.6 Ospite che parte: blocco a righe oblique dalle 8 all'ora di partenza col cognome; senza ora fino alle 10:00 con «?» (riferimento grafico, mai dato salvato) → **fatta**
- [x] P4.7 Tempo per pulire: blocco verde chiaro (#E3EFE7, bordo 3 px #2D6A4F) dalla partenza all'arrivo con la durata («6 ore») → **fatta**
- [x] P4.8 Prossimo arrivo non oggi: blocco ottone chiaro (#F4EBDA, bordo #A8894F) fino alle 20 con «libera fino al 3 ott · nessuna fretta» (o la priorità vera) → **fatta**
- [x] P4.9 Valigetta dei bagagli a filo ottone (CSS come nel riferimento) all'ora `bagagli_alle` dell'ospite che arriva oggi, con «bagagli 11:00» → **fatta**
- [x] P4.10 Arrivo: filo verticale ottone 2 px all'ora d'arrivo con «Cognome 16:00»; senza ora filo tratteggiato alle 15:00 con «Cognome ?» → **fatta**
- [x] P4.11 Chi resta (4 notti): blocco lilla (#F3F0FA, bordo #9B8EC4) su tutta la riga «Nome Cognome resta · biancheria quando esce» → **fatta**
- [x] P4.12 Pulizia già fatta oggi: blocco bianco bordo verde chiaro «✓ pulita 9:02 · 38 min» all'ora in cui è stata segnata; nessun intervallo reale ricostruito dai minuti (integrazione 4) → **fatta con una differenza**: un segno all'ora segnata col testo «✓ pulita 9:02 · 38 min», non un blocco lungo quanto i minuti (integrazione 4: niente intervalli ricostruiti)
- [x] P4.13 Camera senza niente oggi: riga vuota con «niente oggi» grigio chiaro → **fatta**
- [x] P4.14 Riga «Spazi comuni» (Cormorant 15 su due righe) con i tempi fuori camera di oggi alla loro ora, bianchi bordo verde con «✓» → **fatta**
- [x] P4.15 Linea di ADESSO rossa mattone 1,5 px con «ORA 9:15», solo fra 8 e 20, aggiornata ogni minuto → **fatta** — la linea attraversa tutte le righe (nel riferimento solo la prima)
- [x] P4.16 Date e ore dalle funzioni di sempre (pulizieAperte, prossimoArrivo…), nessuna regola nuova → **fatta**
- [x] P4.17 Orari fuori 8–20 e arrivo prima della partenza: niente blocchi negativi né informazioni perse → **fatta**

## P5 · Linguetta «Oggi»: le camere sotto il grafico (schermate 1 e 2)
- [x] P5.1 Una scheda per camera da fare, ordine RANK (urgente, alta, flessibile, nessuna fretta) → **fatta**
- [x] P5.2 Camere pulite oggi in fondo, opacità .55, una riga: nome + «✓ PULITA 9:02 · 38 MIN» verde → **fatta**
- [x] P5.3 Nome Cormorant 28; a destra maiuscoletto 10,5 priorità + tipo, colori mattone / ottone scuro / grigio → **fatta**
- [x] P5.4 Riga ORARI (fine soggiorno e cambio camera): «PARTE COGNOME» nero · «BAGAGLI COGNOME» ottone scuro · «ARRIVA COGNOME» ottone scuro, Cormorant 22/600, etichetta 10 px grigia; colonna solo se il dato c'è → **fatta** — nel cambio camera la colonna «Parte» solo se l'ora è scritta
- [x] P5.5 Partenza senza ora → «da chiedere» mattone 500 e sotto «CHIEDI ORARIO» (P3) → **fatta**
- [x] P5.6 Per chi resta: «Nome Cognome resta · N ospiti · cambio biancheria quando esce» in grigio → **fatta**
- [x] P5.7 Pillole (bordo filo, raggio pieno, 12 px): «🛏 letti», «N federe», «N completi asciugamani»; senza letti «letti da confermare» → **fatta**
- [x] P5.8 TIMER grande Cormorant 48/600: in corso nero con «IN CORSO» e «PAUSA»; fermo avorio scuro #C9BFA8 con «AVVIA»/«RIPRENDI» → **fatta**
- [x] P5.9 Logica TimerPulizia invariata (un solo timer, «Un altro timer è in corso», «Ferma e riporta i minuti») → **fatta** — avviso dell'altro timer al tocco su «Avvia» (non più sempre visibile)
- [x] P5.10 Tasti di ControlliPulizia riusati (Pulita · Pulita e recuperato · Rimanda o salta) → **fatta**
- [x] P5.11 Nella scheda col timer in corso «Pulita» pieno ink testo avorio; altrove sottolineati → **fatta**
- [x] P5.12 Scheda in corso con sfondo sfumato avorio a tutta larghezza → **fatta**
- [x] P5.13 Scheda SPAZI COMUNI dopo le camere da fare: «Spazi comuni» Cormorant 28, «OGNI GIORNO» grigio → **fatta**
- [x] P5.14 Tre righe col filo: nome Cormorant 20; minuti e ora («12 min · 8:10» o «—»); comando timer sottolineato → **fatta**
- [x] P5.15 Timer di una riga in corso: sotto il numero grande nero con «IN CORSO» e «PAUSA» → **fatta**
- [x] P5.16 Link «TEMPI FUORI DALLE CAMERE ↗» a #fuori-camera → **fatta**
- [x] P5.17 Attività: «Corridoio e angolo caffè» (corridoio), «Piegatura asciugamani» (piegatura), «Altro» (nuova, `altro`); `area_comune` non proposta per i tempi nuovi, i suoi minuti si leggono sotto «Corridoio e angolo caffè» (sommati una volta, dati originali intatti) → **fatta** — lib/tempoPulizie VOCI_SPAZI, voceSpazi, minutiPerVoce; commento nel codice
- [x] P5.18 Vincolo del database su `attivita`/chiave del timer aggiornato nella bozza; senza migrazione «Altro» nascosto → **fatta** — vincoli tolti per contenuto e rifatti nella 0064; senza 0064 «Altro» nascosto
- [x] P5.19 Stesse etichette ovunque: Home (timer area comune), TempiFuoriCamera, Registro, Statistiche → **fatta**
- [x] P5.20 Sotto restano: tempi fuori camera, «Prossime pulizie», «Rinvii e salti» → **fatta**

## P6 · Home
- [x] P6.1 Home invariata (Pulizie di oggi com'è), salvo i fogli condivisi e le etichette degli spazi comuni → **fatta** — cambiano solo la scritta del timer («Corridoio e angolo caffè», chiave corridoio) e «Rimanda o salta» che ora è il foglio
- [x] P6.2 Nel riscontro: se, a colonne applicate, l'ora di partenza compare già in Home → **fatta** — no: la Home non legge check_out_time (vedi riscontro)

## P7 · I fogli delle pulizie
- [x] P7.1 Tutti alla stessa altezza (quella del recupero, 690 a 390×844); tasti con il bordo inferiore a 96 px dal fondo; due tasti a tutta larghezza 1fr 1.6fr alti 44; su schermi bassi scorre il contenuto e i tasti restano fermi → **fatta**
- [x] P7.2 Misure scritte nel riscontro per ogni foglio (altezza e distanza dei tasti dal fondo) → **fatta** — tabella nel riscontro: tutti 690 px, tasti a 96 px, alti 44
- [x] P7.3 Recupero: eyebrow «[TIPO] · PULITA E RECUPERATO» (o «· CORREZIONE»), camera Cormorant 30, «fatta oggi» con «oggi» sottolineato che apre il calendario (fino a oggi) → **fatta**
- [x] P7.4 «LETTI PREPARATI» con «CAMBIA»: riga «1 matrimoniale + 1 singolo · 3 ospiti»; Cambia apre i tre campi; «da confermare» in ottone per la proposta → **fatta**
- [x] P7.5 Con un matrimoniale la scelta «2 federe · 4 federe sul matrimoniale» sempre visibile e obbligatoria → **fatta**
- [x] P7.6 «RECUPERATO · LENZUOLA» e «· ASCIUGAMANI»: griglia 3 colonne gap 7, bordo #D8D1C4, raggio 10, alti 48; nome 12 px e «2 / 6» → **fatta**
- [x] P7.7 Un tocco aggiunge, dopo il massimo torna a zero; con pezzi pieno ink testo avorio; voci e misure di oggi; senza dotazione non compaiono → **fatta**
- [x] P7.8 Riga fra due fili: «18 DA LAVARE» / «21 preparati − 3 recuperati»; «38 min DAL TIMER» / «tocca per correggere» (senza timer «— min» «scrivi i minuti») → **fatta** — i minuti del timer in pausa si riportano da soli
- [x] P7.9 Timer in corso: numero nero che corre con «PAUSA»; «Conferma» avvisa come oggi → **fatta**
- [x] P7.10 «Annulla» e «Conferma pulizia» 1fr 1.6fr alti 44; avvisi di oggi sopra i tasti (mz-note/mz-errore); niente «3 pezzi recuperati» sul piede → **fatta** — avvisi sopra i tasti; il totale «N pezzi recuperati» tolto dal piede
- [x] P7.11 Rimanda o salta: foglio piccolo anche in Home; eyebrow «RIMANDA O SALTA · [TIPO]»; camera e «Nome · Nª notte» → **fatta**
- [x] P7.12 Linguette «Rimanda» · «Salta questo cambio» (Salta solo 4 notti); pillole «Domani», «Tra 2 giorni», «Altra data…» (calendario) → **fatta**
- [x] P7.13 Riga a filo «Rimanda al / Prossima il» con la data Cormorant 22; frase «Nessun altro cambio prima della partenza del …»; «Annulla» e «Conferma»; date minime e salvataggi di ControlliPulizia → **fatta**
- [x] P7.14 Spazi comuni · minuti a mano: eyebrow «SPAZI COMUNI · OGGI», voce Cormorant 30, giorno a destra; timer della voce; riga a filo «Minuti»; solo per «Altro» «Cosa · facoltativo» (max 60); «Annulla» e «Salva» con salvaFuoriCamera → **fatta**
- [x] P7.15 Colonna «cosa» nella bozza; senza migrazione la riga «Cosa» nascosta → **fatta**

## P8 · Registro
- [x] P8.1 Riga del periodo: periodo Cormorant 26, «‹ SETT. | MESE | DAL–AL ›»; con DAL–AL due campi «Dal» «Al»; predefinito mese corrente → **fatta**
- [x] P8.2 Pillole «Tutte», una per camera attiva, «Spazi comuni» → **fatta**
- [x] P8.3 «Un tocco su una riga per correggerla.» grigio 12,5 → **fatta**
- [x] P8.4 Gruppi per giorno, il più recente in alto; testata «GIO 1 OTTOBRE» ottone e «2 pulizie · 50 min» grigio (spazi comuni compresi nel tempo), filo ottone chiaro → **fatta**
- [x] P8.5 Riga 48 px | testo | numero: ora segnata Cormorant 18/600 («—» se non si sa); camera Cormorant 20 + tipo maiuscoletto 10,5; letti in grigio; minuti Cormorant 20/600 («38′», «—»), sotto in verde «3 recuperati» o «minuti non annotati» → **fatta**
- [x] P8.6 Spazi comuni come righe del giorno col nome della voce e «spazi comuni» → **fatta**
- [x] P8.7 Rinvii e salti nel loro giorno, opacità .6, «rimandata al 2 ottobre» / «cambio saltato», a destra «rinvio» / «salto» → **fatta**
- [x] P8.8 Automatiche con «Cambia data» e «Non fatta» in una riga con bordo tratteggiato → **fatta** — riga tratteggiata con «Cambia data» e «Non fatta»
- [x] P8.9 Interventi di camere oggi disattivate restano nel Registro → **fatta**
- [x] P8.10 Tocco su una riga di camera → SchedaPulizia in correzione (veste P7): «pulita il 1 ott alle 9:02» modificabili; «38 min SALVATI · tocca per correggere»; «Salva correzione» → **fatta**
- [x] P8.11 Link mattone «SEGNATA PER SBAGLIO · TOGLI» con conferma («Togli la pulizia di Allegra del 1 ottobre? …» · «Annulla» · «Togli»); poi non conta più da nessuna parte → **fatta**
- [x] P8.12 gestisci_pulizia (0059) verificata: annullare non è previsto → operazione nella bozza; senza migrazione il link nascosto → **fatta** — gestisci_pulizia non annulla (azioni registra/recupero/dettagli): ritocca_pulizia «togli» nella 0064; senza 0064 il link non c'è
- [x] P8.13 Ora della pulizia: verificato dove è salvata; colonna per correggerla nella bozza; senza «—»/nessuna domanda sull'ora → **fatta** — l'ora in cui è segnata c'è già (created_at, mostrata se segnata lo stesso giorno); per correggerla ora_effettiva + ritocca_pulizia «ora» nella 0064
- [x] P8.14 Tocco su una riga degli spazi comuni → foglio P7 su quel giorno → **fatta**

## P9 · Statistiche
- [x] P9.1 Periodo come nel Registro, frecce di una settimana / un mese; DAL–AL con i due campi; niente «Anno» → **fatta**
- [x] P9.2 Filtri per camera (Tutte + una per camera); con una camera i minuti degli spazi comuni non le sono attribuiti (detto chiaramente) → **fatta**
- [x] P9.3 Tre numeri Cormorant 34/600 fra due fili: pulizie · ore di lavoro con gli spazi comuni · media a camera → **fatta**
- [x] P9.4 Confronto col periodo uguale precedente in verde («↓ 4 minuti a camera rispetto ad agosto»), se peggiora in grigio, mai rosso; regole di periodo e mese in corso scritte → **fatta** — regole in lib/periodoPulizie (giorni inclusi, periodo in corso fino a oggi, stessi giorni del mese prima)
- [x] P9.5 «QUANTO DURA, PER TIPO»: due righe («Camera da rifare» = fine soggiorno + cambio camera; «Biancheria ogni 4 notti»), media Cormorant 19/600 «· N volte», barretta ottone 5 px; medie solo sui minuti noti → **fatta**
- [x] P9.6 «PER CAMERA»: pulizie e ore («7 · 6 h 40») con barretta → **fatta**
- [x] P9.7 «SPAZI COMUNI»: una riga per voce col tempo e la barretta (area_comune dentro «Corridoio e angolo caffè») → **fatta**
- [x] P9.8 «COME SI USANO LE CAMERE»: per camera nome Cormorant 20, «matrimoniale · 19 volte», pillole coi conteggi (matrimoniali: in 2, uso singolo, + letto in più; Amelia: in 1, + letto in più; Lena: in 2, in 3, in 4) → **fatta**
- [x] P9.9 «COMPLETI USATI»: tabella 3×3 (a settimana, al mese, all'anno), Cormorant 24/600, regole del conteggio e riga grigia di spiegazione → **fatta**
- [x] P9.10 «MANDATI A LAVARE»: tabella per pezzo con Totale, Recuperati, Al mese → **fatta**
- [x] P9.11 «BIANCHERIA» in tre riquadri: preparati · recuperati (%) · a lavare → **fatta**
- [x] P9.12 «RINVII E SALTI» in una riga grigia; «ESPORTA IL PERIODO» (CSV di oggi) → **fatta**
- [x] P9.13 «PROVA LAVANDERIA · AL MESE»: Al mese, Prezzo (campo Cormorant), Costo; «AL MESE, CIRCA» Cormorant 34 sotto un filo nero; «Sul periodo scelto: N €» → **fatta**
- [x] P9.14 Prezzi salvati in `prezzi_lavanderia` (bozza); senza tabella «prezzi non salvati»; prezzo vuoto = da inserire (non zero), totale parziale con le voci mancanti; nessun prezzo d'esempio precaricato → **fatta** — prezzo vuoto = da inserire, totale parziale coi pezzi mancanti, nessun prezzo precaricato
- [x] P9.15 Stime storiche, recuperi oltre la dotazione, lenzuola senza misura restano in fondo, nello stile nuovo, distinguibili dalle confermate → **fatta**
- [x] P9.16 Costi e totali calcolati prima degli arrotondamenti → **fatta**

## Prove e consegna
- [ ] C1 Commit piccoli nell'ordine dell'incarico, suite verde prima di ogni push → **fatta in parte** — 13 commit + riscontro; suite verde a ogni commit. **Push non fatto**: vedi riscontro/diario (main locale ha 84759a3 di Codex in attesa)
- [x] C2 Percorso apri → modifica → salva → chiudi → riapri → conteggi, su anteprima con dati finti, con lo schema di prima e con quello nuovo → **fatta**
- [x] C3 Timer dopo cambio pagina e ricarica; fogli con tastiera aperta e schermo basso → **fatta** — timer continua dopo cambio pagina e nuova apertura; schermo basso 390×560 provato; tastiera vera iPhone non provata
- [x] C4 Schermate a 390 px e dal Mac di tutte le pagine e fogli richiesti → **fatta**
- [x] C5 Riscontro con: numero della migrazione e cosa controllare dopo; righe di bookings usate per gli orari; cosa resta non verificato → **fatta**
