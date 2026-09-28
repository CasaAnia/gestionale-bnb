# Nuova prenotazione «Maison» — checklist del riferimento

Fonte: `docs/design/nuova-prenotazione-riferimento.html` (approvato da Ania il
28/09/2026) più l'incarico dello stesso giorno (punti 1–12). Qui c'è **solo
quello che il riferimento mostra** sullo schermo, sezione per sezione, campo
per campo. Ogni voce ha un codice: il riscontro finale
(`nuova-prenotazione-riscontro.md`) la riprende con «fatta» o «non fatta:
motivo». Le frasi grigie del riferimento che spiegano una regola a chi guarda
(«Se nessun risultato va bene…», «Nome e cognome con la maiuscola…», «già
scritto dalla ricerca», «il campo compare solo con «altra…»», «Il letto in più
si decide notte per notte qui…», «Di norma dorme chi ha prenotato…», «Si
possono aggiungere tante persone…», «Con «Caparra» in Come paga compare…»,
«Quando la pagina si apre da una scheda…») sono didascalie del disegno, non
testi della pagina: sono elencate in fondo (X) solo per dire che non si
mostrano.

## 0. Regole comuni

- G1 Titolo, nomi, numeri, date e importi in Cormorant Garamond.
- G2 Testo con le variabili `--home-*` della Home: dal telefono Figtree 400, secondario 13 px grigio #6E6558, margini 16 px; dal Mac Jost e i valori del Mac.
- G3 Etichette dei campi: maiuscoletto 9,5 px, spaziatura 0,2 em, grigio.
- G4 Etichette di sezione: maiuscoletto ottone #A8894F 9,5 px con il filo #E1D9CB che continua a destra.
- G5 Colori: fondo #F6F2EA, testo #241F1A, fili #E1D9CB, ottone #A8894F per le righe informative, mattone #8C3B2E solo per avvisi che fermano, «!», speso del cliente, «Di persone in più…», «+letto»; nessun altro colore tranne le tinte delle camere nella striscia.
- G6 Campi di testo: solo filo sotto #C9BFA8, valore in Cormorant 16 px, niente riquadri; vuoti/segnaposto in Figtree 13 px chiaro.
- G7 Pastiglie: pillola bordo #C9BFA8 fondo bianco 12,5 px; accesa = fondo #241F1A testo avorio; occupata = bordo tratteggiato e testo chiaro #B8AE9C, non toccabile.
- G8 Azioni secondarie: parole maiuscolette 11 px, spaziatura 0,18 em, filo ottone sotto («+ Nuovo cliente»); variante tenue grigia con filo #E1D9CB («cambia», «+ Aggiungi camera», «+ Aggiungi una persona», «non dorme qui», «Annulla»).
- G9 Azione principale: unico elemento pieno, maiuscoletto 10,5 px avorio su #241F1A, angoli vivi (Avanti · date e camera, Aggiungi, Salva la prenotazione, Apri la prenotazione).
- G10 Contatori − / +: cerchi 34 px a filo #C9BFA8 fondo bianco, numero in Cormorant 22 px; spento = opacità 0,4.
- G11 Barra in basso come nella Home (già Maison sul telefono).

## 1. Testata (tutte le schermate)

- T1 «Nuova prenotazione» in Cormorant 26/500.
- T2 Sotto, maiuscoletto ottone 9,5 px: data di oggi «Lunedì 28 settembre 2026».
- T3 Dopo la data, « · » e il nome del cliente scelto (o «nuovo cliente» mentre si compila il modulo).
- T4 A destra «‹ Indietro» in maiuscoletto 10 px grigio (la BackBar di oggi nella veste nuova).
- T5 Sul telefono niente barra alta con il titolo ripetuto: la testata è la pagina.

## 2. Cerca (schermata 1)

- C1 Campo con la lente «⌕» e il segnaposto «Cerca per nome o telefono…», filo sotto, testo Cormorant 15 px.
- C2 Dal 2º carattere, attesa di 250 ms, filtraClienti (come oggi).
- C3 Sotto il campo «+ Nuovo cliente» (azione a filo ottone).
- C4 «+ Nuovo cliente» apre il modulo con il testo cercato nel telefono o nel nome (moduloDaRicerca).
- C5 Etichetta di sezione «Trovati» con il filo.
- C6 Riga risultato: 🧾 se vuole la ricevuta e ★ se ottimo (in ottone), nome in Cormorant 19/500.
- C7 Sotto: telefono · soggiorni · speso in mattone (somma dei soggiorni del cliente); senza soggiorni niente speso.
- C8 A destra «›» grigio; filo sopra ogni riga.
- C9 Cliente senza nome = «senza nome».
- C10 In fondo ai risultati di nuovo «+ Nuovo cliente».
- C11 Errore di lettura in mattone sotto il campo («Non riesco a leggere i clienti. Riprova.», il testo di oggi).

## 3. Nuovo cliente (schermata 2)

- N1 Etichetta di sezione «Nuovo cliente».
- N2 «Chi»: nome e cognome affiancati (CampiNomeCognome, maiuscola mentre si scrive, prima nome poi cognome).
- N3 «Telefono» (con il testo della ricerca, se era un numero).
- N4 «Email · può restare vuota».
- N5 «Ricevuta» (No | Sì 🧾) e «Valutazione» (★ | Normale | !) affiancate su due colonne, etichetta centrata, pastiglie centrate.
- N6 «!» acceso in mattone pieno (fondo #8C3B2E, testo bianco).
- N7 «Perché» con segnaposto «resta solo per noi», solo con «!».
- N8 «Come ci ha trovato»: Google, Passaparola, Struttura, Non so.
- N9 Con Struttura: riga rientrata con filo ottone a sinistra, strutture note + «altra…».
- N10 Con «altra…»: campo «Quale struttura».
- N11 «Note del cliente · restano anche le prossime volte» e sotto il campo «Nota».
- N12 Tasto pieno «Avanti · date e camera».
- N13 Avvisi in mattone: «Del cliente nuovo serve il nome.» · «Il numero di telefono è obbligatorio: senza non si può né chiamare né scrivere.» · «Cliente non salvato, riprova» (identici a oggi).

## 4. Cliente scelto (in cima alle schermate 3–6)

- K1 Riga senza filo sopra: 🧾 ★ nome in Cormorant 19.
- K2 Sotto: telefono · soggiorni · speso in mattone.
- K3 A destra «cambia» (azione tenue); assente aggiungendo una camera a una prenotazione esistente.

## 5. Soggiorno / Camera 2 (schermate 3 e 4)

- S1 Etichetta di sezione «Soggiorno» per la prima, «Camera 2» (3, …) per le successive.
- S2 «Arrivo» e «Partenza» affiancati, data «lun 28 set» in Cormorant, calendario nativo, partenza non prima dell'arrivo.
- S3 Sotto, in ottone, «6 notti».
- S4 «Camera»: pastiglie di tutte le camere; occupate tratteggiate e spente; scelta piena.
- S5 Riga ottone «libere: Ambra · Lena» / «tutte le camere libere» / «nessuna camera libera in queste date».
- S6 «Ospiti» con − N + (limite ospitiMassimi).
- S7 Accanto «Tariffa a notte»: «80 €» in Cormorant e «di listino · in 2» piccolo grigio; nessun campo, nessun filo sotto.
- S8 «Le notti»: la striscia.
- S9 Striscia: griglia a 7 colonne di larghezza fissa (una notte = una colonna), va a capo oltre le 7.
- S10 Riga dei giorni sopra («lun 28», grigio 10 px).
- S11 Segmenti colorati per camera: uno continuo per le notti di fila nella stessa camera, con il nome della camera.
- S12 «⇄» ottone sopra il punto in cui la camera cambia.
- S13 Sotto ogni notte il numero degli ospiti in Cormorant 14; «+letto» in mattone sotto il numero dove c'è il letto in più.
- S14 «fuori» tratteggiato = notte in cui non dorme qui (nessun numero sotto).
- S15 «?» su fondo #EDEAE1 tratteggiato = notte senza camera.
- S16 La notte toccata ha il contorno ottone (sul numero degli ospiti) e apre sotto NotteScelta.
- S17 Gli avvisi della striscia di oggi (riassunto in ottone, «… senza camera» in mattone) restano sotto la striscia.

## 6. NotteScelta (schermata 3)

- V1 Filo sopra, tutto centrato.
- V2 Titolo maiuscoletto «Notte di martedì 29 · camere libere».
- V3 Pastiglie di tutte le camere, occupate spente, quella della notte accesa.
- V4 Riga con «ospiti − N +» (cerchi) e «letto in più No | Sì · 10 €».
- V5 Il prezzo del letto è quello fisso (punto 12b); Lena in 3 «Sì · compreso».
- V6 Pastiglie «solo questa notte | da qui in poi» (quando si cambiano gli ospiti).
- V7 «oppure non dorme qui» (azione tenue); fuori: «per rimetterla nel soggiorno scegli una camera».
- V8 Messaggi identici a oggi: «nessuna camera libera questa notte», «non disponibile: i due letti di casa sono già impegnati in queste notti», «servono 3 posti in …».

## 7. Dopo le camere (schermata 4)

- A1 «+ Aggiungi camera» centrato (azione tenue), dopo l'ultima camera.
- A2 «Sconto» (etichetta centrata): Nessuno | Percentuale | Prezzo finale, centrate.
- A3 Campo «Quanto per cento» / «Quanto paga in tutto» a sinistra, frase ottone di scontoInParole a destra.
- A4 Lo sconto sta SUBITO PRIMA del conto.
- A5 La sezione «Quanto costa il letto» non c'è più.

## 8. Il conto (schermata 4)

- P1 Etichetta di sezione «Il conto».
- P2 Con più camere: etichetta maiuscoletta «Camera 1 · 28 set – 4 ott».
- P3 Righe della camera: titolo «Ambra · 3 notti», sotto piccolo «28 set – 1 ott · 80 € a notte», importo in Cormorant 17 a destra.
- P4 Riga del letto dentro la sua camera: «Letto aggiuntivo · 1 notte», sotto «30 set · Ambra», importo; Lena in 3 «Letto aggiuntivo · N notti · compreso» a 0 €.
- P5 Riga di subtotale senza filo: «Camera 1» grigio, importo Cormorant 400.
- P6 Idem per «Camera 2».
- P7 Con una sola camera niente etichette né subtotali.
- P8 «Totale» con filo ottone sopra, importo Cormorant 22.
- P9 «Sconto 10 %» in ottone con «− 47 €».
- P10 «Da pagare» con importo Cormorant 30/300.
- P11 «manca la camera» / «la partenza deve venire dopo l’arrivo» in ottone a destra quando il conto è da completare.
- P12 Sotto «Da pagare» niente «notti · a notte» (regola fissa n. 7).

## 9. Come paga (schermata 4)

- M1 Etichetta di sezione «Come paga».
- M2 «Quando arriva»: Contanti | Bonifico | Da vedere.
- M3 «Prima di arrivare»: Tutto | Caparra del 50% | Caparra.
- M4 Frase per esteso con il 50% calcolato (testo di lib/comePaga).
- M5 «Quanto» (€) solo con Caparra.
- M6 «Entro il» (data) e «alle» (segnaposto «es. 18:00») affiancati.
- M7 Errori identici: «La caparra deve essere un importo positivo.» · «Della caparra servono data e ora, oppure nessuna delle due.»
- M8 Aggiungendo una camera (aggiungoA): al posto di Come paga la frase AVVISO_AGGIUNTA in ottone.

## 10. Chi dorme in camera (schermata 5)

- D1 Etichetta di sezione «Chi dorme in camera» (era «Con lei»).
- D2 Di default la riga dell'intestataria: nome in Cormorant 17, sotto «Intestataria · dati della prenotazione» in maiuscoletto grigio, telefono a destra; niente ✕.
- D3 Sotto, la pastiglia-spunta «☐ Non è lei a dormire qui».
- D4 Spunta attiva: la riga dell'intestataria sparisce e compare il foglietto vuoto da compilare.
- D5 Righe delle persone aggiunte (RigaPersona): nome Cormorant, chi è in maiuscoletto, telefono, ✕.
- D6 «+ Aggiungi una persona» (azione tenue).
- D7 Foglietto sulla pagina (fondo #EFE9DD, bordo #DDD3C2): titolo «Chi dorme in camera» Cormorant 19.
- D8 «Chi» (nome, cognome — CampiNomeCognome), «Telefono · può restare vuoto».
- D9 «Chi è»: Sorella, Mamma, Papà, Figlia, Marito, Amica, altro… (con il campo libero).
- D10 In fondo a destra «Annulla» (tenue) e «Aggiungi» (pieno).
- D11 Massimo persone = ospiti prenotati nella camera; oltre il limite delle due colonne l'avviso mattone «Di persone in più se ne possono salvare due: la terza scrivila nella nota.».
- D12 La spunta si salva nella prenotazione (colonna nuova, proposta SQL); senza la colonna la spunta non compare.

## 11. Nota (schermata 5)

- O1 Etichetta di sezione «Nota di questo soggiorno», campo «Nota» (Figtree 13,5).

## 12. Arrivo e navetta (schermata 6)

- R1 Etichetta di sezione «Arrivo e navetta».
- R2 «Tipo di arrivo»: In struttura | Arrivo a… | Da definire (pastiglie).
- R3 «Luogo»: Linate, Rogoredo, Centrale, Malpensa, Orio al Serio, San Donato, Altro luogo….
- R4 «Qual è il luogo» con segnaposto «es. casa di un’amica in centro».
- R5 «Orario»: Ora precisa | Fascia oraria.
- R6 Con la fascia: «Inizio della fascia» e «Fine della fascia» affiancati.
- R7 «In struttura · stima facoltativa» con «dalle» / «alle» e «Una tua stima, modificabile».
- R8 «Navetta»: Non richiesta | Da definire | Da assegnare.
- R9 «Autista»: Massimo, Aldo, Alberto, Matteo.
- R10 «Ora del prelievo» (campo stretto 90 px).
- R11 Stesse regole del foglio della Home (pianoModuloArrivo).

## 13. Salva (schermata 6)

- F1 Filo sopra, tutto centrato.
- F2 «Sto guardando quali camere sono libere…» / NON_LETTE in ottone, sopra il tasto.
- F3 Tasto pieno «Salva la prenotazione».
- F4 Sotto, gli avvisi in mattone (guai, avvisoSalva, sovrapposizioni).
- F5 Conferma B: cerchio a filo ottone con ✓, «Salvato», «Prenotazione di [nome] · ora», si chiude da sola e apre la scheda.
- F6 «Apri la prenotazione» (pieno) quando la prenotazione è salvata con qualcosa di meno.

## 14. Novità di comportamento (punto 12)

- Z1 Tariffa a notte non modificabile: sempre il listino (lib/tariffe), niente stato `tariffa` nella linea della pagina.
- Z2 Letto a prezzo fisso in una costante: Amelia 5, Ambra 10, Allegra 10, Lena in 3 compreso, Lena in 4 10 €; usata in NotteScelta, nel conto e nel salvataggio.
- Z3 Tolti CRITERI_LETTO, LETTO_COMPRESO_LISTINO, listinoLetto, lo stato `letto`, la sezione «Quanto costa il letto».
- Z4 Conto raggruppato per camera con subtotali.
- Z5 Chi dorme in camera con intestataria, spunta, limite = ospiti.
- Z6 Speso del cliente in mattone nella ricerca e nel cliente scelto.

## 15. Prove

- Q1 Test: tariffa non modificabile.
- Q2 Test: prezzi del letto nei quattro casi.
- Q3 Test: conto per camera con subtotali.
- Q4 Test: limite persone = ospiti prenotati.
- Q5 Test: spunta «Non è lei a dormire qui» salvata e riletta.
- Q6 Test: striscia a colonne fisse che va a capo oltre 7 notti.
- Q7 Due schermate a 390 px (Soggiorno con la notte aperta; conto con due camere).
- Q8 Scheda «prove dal telefono in 10 minuti» in CONSEGNA-ATTIVA.md con il caso «figlio che prenota per la mamma».

## X. Didascalie del riferimento (non si mostrano)

Le frasi grigie e mattone che nel riferimento spiegano la regola a chi guarda
il disegno (elencate in cima) non sono testi della pagina e non si scrivono.
