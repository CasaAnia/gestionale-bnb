# Ritocchi «Maison» e pagina Clienti — riscontro

Checklist: `ritocchi-checklist.md`. Riferimenti: `scheda-ritocchi-riferimento.html`
(1) e `clienti-riferimento.html` (2). Commit a160862 → ec3352f più questo
riscontro. Prove nell'anteprima senza rete (`gestionale-bnb-scheda-maison-finta`,
porta 3217, e le finte Home 3215 e Richieste 3214) a 390 × 844; suite 1928/1928.

Schermate a 390 px (accanto a questo file):
- `ritocchi-390-buchi-con-e-senza.png` — Calendario coi buchi (prova spenta) e senza, in un'immagine sola
- `ritocchi-390-foglietto.png` — foglietto della prenotazione
- `ritocchi-390-foglio-arrivo.png` — FoglioArrivo nel caso più lungo, coi tasti nella riga fissa
- `ritocchi-390-scheda-soggiorno.png` — scheda, linguetta Soggiorno
- `ritocchi-390-scheda-cliente.png` — scheda cliente
- `ritocchi-390-dati-cliente.png` — foglio «Dati della cliente»

## 0. Regole comuni
- G1 fatta: testi di prima invariati; cambiano solo quelli scritti nell'incarico («2 SETT.», «‹ Oggi»…, «Altra…», «Altra struttura»).
- G2 fatta.
- G3 fatta: pezzi nuovi condivisi (PezziFoglietto, lib/provenienzaScheda, lib/pagamentoAbituale, lib/clientiElenco, lib/schedaCliente).
- G4 fatta.
- G5 fatta: un commit per pezzo (il pezzo 11, «Mac», è solo verifica: nessuna correzione servita, quindi nessun commit).

## A · Calendario e Arrivi
- A1a fatta: 18 px misurati (Calendario e Arrivi).
- A1b fatta: 14 px misurati.
- A1c fatta: area 52 × 44.
- A1d fatta: regole solo sotto 1024 px. Le Richieste restano com'erano (l'incarico nomina Calendario e Arrivi).
- A2a fatta: 9,5 px, 4 × 8.
- A2b fatta.
- A2c fatta (‹ · pillola · ›, come chiesto da Ania).
- A2d fatta: **24 px** (sta già a 24 per ogni periodo dentro lo stesso anno, anche «30 nov – 13 dic 2026»). A cavallo d'anno («28 dic 2026 – 10 gen 2027») a 24 non sta: lì 20 px, il più grande che ci sta.
- A2e fatta. A2f fatta.
- A3a fatta: `BUCHI_LIBERI_VISIBILI = false` in lib/calendarioMobile.
- A3b fatta. A3c fatta: provato, tocco su «mer 30» di Amelia → nuova prenotazione con Amelia e arrivo 30/09. A3d fatta (immagine unica).
- A4a fatta. A4b fatta (173 × 44 ciascuno, 12 px fra i due). A4c fatta. A4d fatta: 28 px sotto l'ultima riga, aria sotto; foglietto 430 → 500 px.
- A4e fatta (riga TELEFONO tolta). A4f fatta; foglietto richiesta 380 → 440 px. A4g fatta.

## B · Fogli
- B1a fatta: tutti i piedi dei fogli Maison 24 px sotto il contenuto.
- B1b fatta in parte — le altezze nuove (misurate a 390 px, caso più lungo): Pagamento **611** (prima 700); Arrivo **756** nella scheda e nella Home, **830** negli Arrivi; Pulizia (Home) **866** (prima 780); scheda: date 293, cambio camera 417, togli camera 226, sconto 382, come paga 434, togli pagamento 297, nota 389, annulla 343, mancato arrivo 500, prezzo del soggiorno 655, Dati della cliente 771, cambia cliente 720, provenienza 323, chi dorme 412, persona 391, notte 552; Richieste: L'hai inviata 235 (prima 300/320), Sostituire 174 (prima 240), Rifiuta 400 (uguale); Calendario: camera tenuta 366 (prima 400), conferma 239 (prima 320); Elimina documento 190, Elimina cliente 230.
  **Non fatta del tutto, motivo:** il FoglioArrivo non si accorcia: il suo caso più lungo (luogo, fascia oraria, stima, navetta con autista e prelievo) misura già 756 px, quindi i 752 di prima non erano «a vuoto»; lo spazio vuoto si vede solo negli stati corti (In struttura), ed è quello che tiene i tasti fermi. Negli Arrivi (con testa, storico e i tre comandi) il caso più lungo è 830 px e la Pulizia della Home 866: più di quanto sta su un telefono da 844 (il foglio si ferma al 92% e scorre dentro), lì i tasti restano in fondo allo schermo. Non ho inventato alternative.
- B1c fatta (scheda 756, Arrivi 830; lo storico conta come riga chiusa: aperto è lungo quanto i soggiorni).
- B1d fatta: 611 con «Altro importo», la nota e le due righe d'avviso sul conto già saldato.
- B1e fatta, con tre limiti: «Creare la prenotazione?» resta 520 (nell'anteprima nessuna proposta completa, non misurabile); «Soluzioni trovate» resta 420 (elenco senza limite, solo «Chiudi»); il foglio di lettura «Aggiungi pagamento» della Home (260) è un passaggio di caricamento senza tasti. Il «Mancato arrivo» ha ora i tasti nella riga fissa; il suo stato «Pagamento · mancato arrivo» non si riproduce nell'anteprima: 500 è una stima.
- B1f fatta (sopra).
- B2a–B2l fatte. «Paga di solito con» compare solo quando la colonna della 0062 esiste (prima non si potrebbe salvare). Il numero resta scritto com'è salvato (regola di prima).

## C · Scheda prenotazione
- C1a–C1g fatte (misurate: 10 · 14 · 12 · 14, 22 prima delle linguette).
- C2a–C2c fatte.
- C3a–C3e fatte; C3f fatta.
- C4a–C4e fatte: `?da=` su ogni link (Home: arrivi, da incassare, richieste, da controllare; Calendario; Arrivi; Richieste; elenco Prenotazioni; scheda cliente), resta dopo i salvataggi (le linguette tengono l'indirizzo, e passando a un'altra camera `conDaDellaScheda` lo riporta). La freccia usa la cronologia quando c'è, altrimenti la pagina di provenienza.

## D · Clienti
- D1a fatta: `supabase/proposte/0062_pagamento_abituale.BOZZA.sql`, **da applicare a mano** (autorizzazione di Ania); il codice regge senza.
- D1b fatta. D1c fatta. D1e fatta. D1f fatta.
- D1d fatta per Nuova prenotazione, «Come paga» della scheda (quando la prenotazione non dice ancora niente: un come paga già scelto resta il suo) e Aggiungi pagamento (scheda e Home). **Non fatta per la proposta delle Richieste, motivo:** lì le chip sono All'arrivo · Caparra · Pagamento completo · Personalizzata, non Contanti | Bonifico, e c'è la decisione di Ania «nessuna preselezione, le sceglie Ania ogni volta».
- D2a–D2i fatte (dal Mac anche senza lo zoom del 20%, come le altre pagine Maison).
- D3a–D3u fatte. Un'annullata senza importo mostra «—» come nel riferimento; un mancato arrivo (annullato ma con il dovuto) mostra il suo importo.
- D4a–D4c fatte.

## Mac, test, riscontro
- M1 fatta: schermate a 1280 di elenco e scheda cliente (620 px, scrittina a 64); riga del periodo e «Oggi · mesi» del Mac invariati.
- T1 fatta: `lib/ritocchiMaison.test.ts` (A1, A3, A4, B1 altezze, B2, C4 per ogni pagina, D1, D2, D3, D4) più i test toccati aggiornati.
- R1 fatta. R2 fatta.
- R3 vedi CONSEGNA-ATTIVA: fatta solo la parte in lettura, se l'accesso al sito c'era.
- R4 vedi CONSEGNA-ATTIVA.
