# Scheda prenotazione «Maison» — checklist del riferimento

Fonte: `docs/design/scheda-riferimento.html` (approvato da Ania il 28/09/2026)
più l'incarico dello stesso giorno (punti 1–14). Qui c'è **solo quello che il
riferimento mostra**, linguetta per linguetta, riga per riga, comando per
comando, stato per stato. Ogni voce ha un codice: il riscontro finale
(`scheda-riscontro.md`) la riprende con «fatta» o «non fatta: motivo».

Il riferimento mostra otto telefoni (1 · 1b · 2 · 2b · 3 · 3b · 4 · 5), non
nove come dice l'incarico: le variabili B, C, D e il secondo telefono dei
Messaggi (A4X, con «Messaggio libero» e l'elenco a righe) sono definite nel
file ma non entrano nella striscia, quindi non fanno parte del disegno.

Le frasi grigie del riferimento che spiegano il disegno a chi guarda non sono
testi della pagina (elencate in X in fondo).

## 0. Regole comuni

- G1 Titoli, nomi, numeri, date e importi in Cormorant Garamond; testo con le variabili `--home-*` (dal telefono Figtree, grigio #6E6558, margini 16 px; dal Mac Jost).
- G2 Dal telefono fondo bianco e fili #E8E3DA (prova E + C, come la Home); dal Mac crema #F6F2EA, contenuto centrato a 620 px.
- G3 Etichette di sezione in maiuscoletto ottone col filo che continua a destra («In breve» è l'eccezione: maiuscoletto grigio senza filo).
- G4 Azioni: maiuscoletto sottolineato col filo ottone (principale) o col filo chiaro grigio (tenue).
- G5 Mattone #8C3B2E solo per: resta da incassare, riga «dorme …», note, «!», puntini delle linguette, «Annulla prenotazione», messaggio di annullamento, speso del cliente (più i valori «da chiedere»/«caparra entro» di In breve, che il riferimento mostra in mattone).
- G6 Nessun riquadro bianco, nessuna ombra; l'unico riquadro a bordo è la conferma con immagine (Messaggi).

## 1. Barra in cima (tutti i telefoni)

- B1 A sinistra «‹ Prenotazioni» in maiuscoletto grigio 10 px (BackBar; con `?da=cliente` torna a /clienti/[id]).
- B2 A destra lo stato in maiuscoletto ottone: «Confermata» (anche lo stato normale si scrive), «Annullata», «In attesa», «Conclusa», «Mancato arrivo».
- B3 Pastiglie «✓ Prenotazione salvata» / «✓ Prenotazione creata dalla richiesta» / «✓ Prenotazione annullata»: riga sottile sotto la barra, 5 secondi (incarico, punto 3; il riferimento non le disegna).

## 2. Testata T2 + note N1 (tutti i telefoni)

- T1 Nome in Cormorant 28 centrato, preceduto da 🧾 (ricevuta) e ★ ottone (ottima).
- T2 Accanto al nome due cerchi a filo 34 px: cornetta (tel:) in inchiostro, nuvoletta WhatsApp in ottone (senza testo); area di tocco 44 px.
- T3 Senza numero: al posto dei cerchi «Nessun numero di telefono» in mattone.
- T4 Solo se chi dorme non è l'intestataria (spunta 0061): riga mattone «dorme Teresa Bianchi · mamma» con i due cerchi da 28 px per quella persona.
- T5 Riga maiuscoletta grigia «Già ospite 4 volte · da Nida · 640 €» col totale in mattone; «Prima volta» se è la prima; «da dove? ›» se manca la provenienza (apre FoglioProvenienza).
- T6 Note: filo tratteggiato sopra; nota del cliente in mattone 13,5 px; etichetta maiuscoletta mattone «Questa volta»; nota della prenotazione in mattone. Niente blocco senza note.
- T7 In testata NON ci sono più date, orario, percorso, blocco Oggi, residuo, telefono, «Scrivi», documento.

## 3. Linguette (tutti i telefoni)

- L1 Cinque linguette sempre visibili, fili ottone sopra e sotto: Oggi · Soggiorno · Conto · Messaggi · Cliente.
- L2 Sotto «Soggiorno» in 8 px «28 set → 4 ott».
- L3 Sotto «Conto» in 8 px mattone «resta 470 €», oppure «saldato».
- L4 Linguetta attiva: inchiostro e grassetto, filo ottone da 2 px sotto (dal 20 % all'80 %).
- L5 Puntino mattone 6 px in alto a destra dove c'è qualcosa di «Da controllare».
- L6 Una parte alla volta; la linguetta scelta resta nell'indirizzo (#oggi, #soggiorno, #conto, #messaggi, #cliente); #arrivo porta a Soggiorno; all'apertura «Oggi».

## 4. Oggi (telefoni 1 e 1b)

- O1 Etichetta «In breve» (maiuscoletto grigio).
- O2 Righe etichetta grigia a sinistra / valore Cormorant 17 a destra, filo sotto.
- O3 Arrivo su una riga («oggi alle 15:10 · navetta Massimo»).
- O4 Arrivo su tre righe (1b): «oggi, in struttura 15:30–16:30 circa», sotto in grigio «atterra a Malpensa fra le 13:00 e le 14:00» e «navetta Aldo · prelievo a Malpensa 14:15»; l'etichetta sta sopra.
- O5 Camera: «Ambra, poi Lena da gio 1» / «Ambra 2 notti · Lena 2 · Allegra 2».
- O6 Ospiti solo se cambiano: «2, poi 3 dal 30 (letto in più)».
- O7 Conto in mattone «470 € · caparra entro mer 30» (verde «saldato» quando non resta niente).
- O8 Documento: «da chiedere all’arrivo» in mattone / «caricato».
- O9 Note (solo se ci sono): «camera silenziosa · marito in Humanitas».
- O10 «Da fare oggi · 2»: righe titolo Cormorant 19 + dettaglio 12 px grigio + UN'azione a destra (Pagamento piena, Documento tenue).
- O11 Con zero voci «✓ Tutto a posto».
- O12 «Prossimi giorni»: «mer 30 · ⇄ da Ambra a Lena» con a destra «Lena va pronta prima»; «dom 4 · parte» con a destra «saldo 235 €».
- O13 Con più arrivi (periodi separati) una riga Arrivo per ciascuno.

## 5. Soggiorno (telefoni 2 e 2b)

- S1 «Arrivo e navetta»: orario grande Cormorant 22 («Oggi alle 15:10», «Oggi, 15:30–16:30 circa» col «circa» piccolo grigio, «Arrivo da definire») con «Modifica arrivo» a destra.
- S2 Blocco «Arrivo a Milano Centrale» (maiuscoletto) con «alle 14:30 · in treno» / «fra le 13:00 e le 14:00 · in aereo».
- S3 Blocco «Navetta» (filo sopra): «Massimo · prelievo a Milano Centrale alle 14:30» (nome in grassetto 500); «Da assegnare · autista ancora da scegliere»; «Da definire · da chiedere all’ospite»; «Non richiesta».
- S4 «Arrivi precedenti» tenue; apre l'elenco al suo posto; «Chiudi arrivi precedenti» lo richiude.
- S5 Più arrivi: un blocco per arrivo con l'etichetta «Arrivo 10 settembre · Camera».
- S6 30 px d'aria, poi «Le notti»: striscia della Nuova prenotazione (7 colonne fisse, a capo oltre 7, segmenti per camera, ⇄ ottone, ospiti e «+letto» mattone sotto).
- S7 Un tocco su una notte apre FoglioNotte.
- S8 Sotto la striscia «un tocco su una notte: camera, ospiti, letto in più di quella notte».
- S9 Azioni «Cambia date · Cambio camera» (piene) e «Aggiungi camera» (tenue); «Togli camera» mattone solo con più linee; con più linee una striscia per linea col titolo.
- S10 «Camere · N cambi»: una riga per tratto, nome Cormorant 18 («⇄ » davanti dal secondo), sotto «date · N notti · N ospiti · letto in più …», la nota ottone «Lena va pronta prima del cambio» sui cambi, importo a destra.

## 6. Conto (telefoni 3 e 3b)

- C1 Tre colonne: «Totale concordato» (o «Totale soggiorno») · «Già ricevuto» · «Come paga», etichetta maiuscoletta, valore Cormorant 18.
- C2 Filo ottone, «Resta da incassare» a sinistra, cifra 32/300 mattone a destra.
- C3 Saldato: «Saldato» e «0 €» in verde.
- C4 Frase di come paga a destra, grigia («caparra del 50%, il resto all’arrivo · 235 € entro mer 30 set» / «Paga tutto in contanti quando arriva»).
- C5 Azioni «Aggiungi pagamento» (piena) · «Cambia come paga» · «Sconto» (tenui).
- C6 «Pagamenti registrati»: righe «28 set · contanti» con sotto «saldo completo/acconto», importo Cormorant, «togli».
- C7 Senza pagamenti: «Nessun pagamento registrato · …».
- C8 Riga di copertura «I pagamenti coprono fino alla notte del …» / «non coprono ancora la prima notte».
- C9 «Dettaglio del soggiorno»: righe camera (Cormorant 17) con «date · N notti × prezzo» sotto, importo a destra; «Letto in più».
- C10 «Prezzo pieno» grigio barrato, «Sconto − 20 €» ottone, «Totale concordato/soggiorno» con filo ottone sopra.
- C11 Mancato arrivo: i testi di oggi (prezzo originale, 50 %, ricevuto/da incassare, «Camera liberata…», «Registra pagamento ricevuto»).
- C12 Conto non leggibile: il messaggio di oggi.

## 7. Messaggi (telefono 4)

- M1 Interruttore «WhatsApp Ania | Business» centrato: voce scelta col filo ottone, l'altra grigia.
- M2 «A chi scrivi» (etichetta centrata) e due chip centrate: «Maria · ha prenotato» accesa, «Teresa · dorme» (solo quando dorme un'altra persona).
- M3 I link WhatsApp usano il numero della persona scelta.
- M4 Riquadro a bordo inchiostro «Conferma prenotazione» (Cormorant 22) con sotto «Immagine e testo» maiuscoletto ottone; apre ConfermaWhatsApp.
- M5 «Sempre disponibile, in ogni fase del soggiorno» centrato grigio.
- M6 «Utili adesso» a chip (messaggiFase, senza «Messaggio libero»).
- M7 «Tutti i messaggi» in griglia a due colonne: Conferma · solo testo | Dati bonifico / Modifica soggiorno | Promemoria bonifico / Richiesta orario | Pagamento ricevuto / Ringraziamento | Messaggio di annullamento (mattone).
- M8 «Messaggio libero» sparisce dalla scheda.
- M9 AvvisoSaluto resta; senza telefono la frase di oggi.
- M10 «Cronologia»: griglia quando (78 px, grigio) / cosa; filo sotto ogni riga; messaggi inviati in verde «Conferma inviata · a Teresa Bianchi».
- M11 I tre messaggi di registro vuoto / non attivo / nota fissa restano.

## 8. Cliente (telefono 5)

- K1 Griglia a due colonne: telefono, arrivata da, valutazione, ricevuta, già ospite («4 volte · 640 €»), documenti («nessuno · Aggiungi» / «N caricati ›»).
- K2 A tutta larghezza «nota del cliente» e «nota di questa prenotazione» in mattone.
- K3 Azioni «Modifica dati» (piena) · «Cambia cliente» · «Nota e colore» (tenui).
- K4 «Chi dorme in camera»: RigaPersona con nome Cormorant 18, sotto «chi è» maiuscoletto, telefono a destra.
- K5 Persona diversa dall'intestataria: etichetta mattone «Mamma · dorme lei, non chi ha prenotato».
- K6 Azione «Modifica chi dorme» (apre il foglio «Chi dorme in camera»).
- K7 «Soggiorni precedenti · 4 · 640 €»: camere Cormorant 17 con ⇄, anno se diverso, «date · notti · ospiti», importo ›; «È la prima volta che viene da noi.».
- K8 In fondo centrato «Annulla prenotazione» in mattone col filo mattone; assente se già annullata.
- K9 «Con lei» sparisce ovunque: «Chi dorme in camera».

## 9. Fogli (incarico, punto 11)

- F1 FoglioArrivo e FoglioPagamento restano quelli Maison.
- F2 Cambia date, Cambio camera, Togli camera, Sconto, Come paga, Togli pagamento, Nota e colore, Annulla, Mancato arrivo, Prezzo del soggiorno, Dati della cliente, Cambia cliente, Provenienza, Chi dorme in camera, FoglioNotte nel FoglioMaison: titolo = nome in Cormorant, sottotitolo maiuscoletto ottone = nome del foglio.
- F3 Campi a filo, chip, tasto pieno + «Annulla».
- F4 Altezza FISSA per ogni foglio, pari al suo contenuto più lungo.
- F5 Conferma di salvataggio B (spunta, «Salvato», chiusura da sola).
- F6 Testi, campi, regole e messaggi identici; sei modalità di Come paga e scelte di Nota e colore restano.

## 10. Stati e Mac

- E1 AvvisoAzione, «Caricamento…», «Non riesco a leggere il conto…» nella veste nuova.
- E2 Dal Mac stessa impostazione a linguette, 620 px centrati, crema.

## X. Didascalie del disegno (non si mostrano)

- X1 «Le altre quattro linguette mostrano UNA parte alla volta…» (telefono 1).
- X2 «Il cambio lo fai tu al mattino: le due righe in ottone finiscono anche nella striscia delle pulizie…» (telefono 2b).
- X3 L'etichetta «Dopo l’incasso» del telefono 3b: è la seconda metà dello stesso esempio (lo stato saldato), non una sezione della pagina.
