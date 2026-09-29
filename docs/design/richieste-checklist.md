# Richieste «Maison» — checklist del riferimento

Fonte: `docs/design/richieste-riferimento.html` (approvato da Ania il
29/09/2026, dodici telefoni) più l'incarico dello stesso giorno (punti 1–14).
Qui c'è **solo quello che i dodici telefoni mostrano**, riga per riga, più le
regole dell'incarico che lo precisano. Ogni voce ha un codice: il riscontro
finale (`richieste-riscontro.md`) la riprende con «fatta» o «non fatta:
motivo», senza voci aggiunte.

Il file contiene anche i disegni del Calendario (C1–C10…), le varianti
scartate (RQ1–RQ4, elenco B «tessere», U1 pagina unica) e le frasi grigie
sotto i telefoni: non fanno parte del disegno. I dati dei telefoni (Anna
Rinaldi, Marco Colombo, Luca Greco…) sono esempi. Dove riferimento e incarico
si scostano vale l'incarico, più preciso (scritto nella voce, «incarico»).

La base è il Calendario «Maison» (`calendario-checklist.md`) e gli Arrivi
(`arrivi-checklist.md`): stessi componenti, stesse misure.

## 0. Regole comuni (tutti i telefoni)

- G1 Cormorant Garamond per nomi, titoli, periodo, camere, numeri di telefono, prezzi; Figtree sul telefono (Jost dal Mac) per il resto.
- G2 Fondo bianco, fili #E8E3DA, ottone #A8894F per maiuscoletti ed etichette, mattone #8C3B2E per note del cliente, «speso» e «Rifiuta la richiesta»; colori come token/variabili `--cal-*` / `--home-*` (incarico).
- G3 Stessi componenti del Calendario e degli Arrivi, riusati con le opzioni e mai copiati: RighelloNastro, FiliNastro, CorsiaNastro, BucoNastro, SchedaNastro, RigaMesi, Legenda, RigaPeriodo, FoglioMaison, FogliettoPrenotazione, CampoRicerca, InterruttorePillola.
- G4 Azioni in maiuscoletto sottolineato (`.mz-lnk`); UN SOLO tasto pieno per schermata (dove il riferimento lo mostra: «Avanti · Pagamento», «Avanti · Il messaggio», «Apri WhatsApp e invia», «Crea prenotazione», «Rifiuta la richiesta» mattone, «Salva la richiesta»).
- G5 Fogli ad altezza fissa (FoglioMaison): foglietto 380 px, «Creare la prenotazione?» 520 px, «Perché la rifiuti?» 400 px, «L'hai inviata?» basso.
- G6 Conferma di salvataggio B (SalvatoMaison) dove si salva.
- G7 Tutte le funzioni delle Richieste di oggi restano con lo stesso comportamento; cambiano la veste, l'impostazione della pagina della richiesta (a linguette) e le novità 14a–14f.
- G8 I testi dei messaggi (lib/richiesteTesti) non si toccano; i testi già mostrati dal gestionale restano, salvo quelli che l'incarico riscrive.

## 1. Telefono 1 · Calendario · vista Reale

- R1 Barra in alto Maison con «RICHIESTE» (TestaPagina/MobileTopBar).
- R2 Campo «Cerca nome o telefono…» a filo (lente grigia, solo filo sotto), sotto la barra.
- R3 Riga del periodo (RigaPeriodo telefono, novità 14a): periodo a sinistra in Cormorant 20 px su una riga, «28 set – 11 ott 2026» (mese abbreviato); a destra «‹ · MESE | 2 SETTIMANE · ›» con 8 px fra le tre cose, frecce senza cerchi; filo sotto.
- R4 Riga «VISTA · REALE | PRESUNTA» allineata a destra: maiuscoletto grigio «VISTA» + InterruttorePillola Maison; filo sotto; scelta ricordata nel browser.
- R5 Il nastro: righello «lun 28» fermo, giorni 60 px (2 settimane) / 40 px (mese), colonna camere 66 px con i nomi in Cormorant, corsie 92 px.
- R6 Filo verde di oggi e filo ottone del 1° del mese, SOTTO le schede.
- R7 Schede delle prenotazioni confermate: quattro righe (date · icone e nome · ospiti e stato · arrivo) e colori del Calendario.
- R8 Cambi camera col taglio obliquo e il filo del colore della scheda («⇄ Fam. Russo» · «poi Lena» / «da Ambra»).
- R9 Buchi liberi tratteggiati con le date e il «+»: il tocco apre la nuova prenotazione con camera e giorno.
- R10 Camere tenute (proposte inviate) in ottone, come nel Calendario.
- R11 In vista Reale le richieste non si vedono.
- R12 Niente riga «🛏 extra» (incarico; il nastro del riferimento la disegna perché è copiato dal Calendario).
- R13 Sotto il nastro: «OGGI» cerchio sotto la colonna delle camere, i mesi cliccabili (acceso quello in vista, anno nuovo in Cormorant ottone).
- R14 «LEGENDA» sottolineata sotto «Oggi».

## 2. Telefono 2 · Calendario · vista Presunta

- P1 Pillola su «PRESUNTA».
- P2 Ogni richiesta aperta è una scheda della misura delle altre: fondo bianco, bordo tratteggiato 1,5 px #A8894F, testi #6E5116.
- P3 Riga (a) maiuscoletto ottone «30 SET → 3 OTT · DAL SITO» (canale: dal sito / WhatsApp / telefono).
- P4 Riga (b) il nome in Cormorant (nomeConAltri).
- P5 Riga (c) «in attesa · 2 persone» (o «3 → 2 persone»); con la proposta inviata «proposta inviata · scade 18:00» e fondo #FBF6EA.
- P6 Riga (d) vuota.
- P7 Richiesta per «qualsiasi camera»: la scheda compare su ogni camera libera in quelle notti (Anna Rinaldi su Amelia, Marco Colombo su Allegra, nel riferimento).
- P8 Due richieste sovrapposte nella stessa camera: una scheda sola col bordo punteggiato, riga (b) «2 richieste», riga (c) i cognomi «Rinaldi · Colombo».
- P9 Riga «Qualsiasi camera» come oggi, se ci sono richieste per qualsiasi camera (incarico).
- P10 La richiesta scelta dalla ricerca o dall'elenco resta piena, il resto si attenua (0,35).
- P11 La legenda ha in più la voce «Richiesta in attesa / proposta inviata (tratteggio ottone)» (incarico).

## 3. Telefono 3 · Tocco su una richiesta (foglietto, novità 14b)

- F1 FoglioMaison ad altezza fissa 380 px, sale dal basso sul nastro (al posto di PannelloRichieste).
- F2 Maiuscoletto ottone «RICHIESTA · DAL SITO · OGGI 08:41».
- F3 Nome in Cormorant 22 px con 🧾 ★ davanti; a destra i cerchi cornetta (tel:) e WhatsApp.
- F4 Righe etichetta/valore divise da filo, etichetta maiuscoletto 9,5 px in colonna da 70 px.
- F5 TELEFONO «+39 347 812 6690» per esteso in Cormorant 16 px (novità 14c).
- F6 DATE «30 set → 3 ott · 3 notti».
- F7 PERSONE «2» (o «3 → 2 persone»).
- F8 CAMERA «qualsiasi · libere: Ambra, Allegra, Lena» (o la camera chiesta).
- F9 STATO «in attesa · arrivata oggi» / «proposta inviata · scade tra 2 h 15 min» / «ferma da 3 giorni».
- F10 NOTA in mattone fra virgolette basse (riga vuota se non c'è).
- F11 CLIENTE «già ospite 3 volte · 640 € spesi».
- F12 In fondo: «Invia proposta» (o «Conferma» con la proposta inviata) · «Modifica» · «Rifiuta» (mattone) · «Chiudi».
- F13 Richieste sovrapposte: una sotto l'altra nello stesso foglio (stessa altezza, si scorre dentro) (incarico).
- F14 La scheda toccata resta piena, le altre attenuate (riferimento: nastro con «Anna Rinaldi» evidenziata).
- F15 Tocco sulle schede delle prenotazioni confermate: il foglietto del Calendario (FogliettoPrenotazione), come lì.

## 4. Telefono 4 · Pagina intera

- E1 Sopra: testa, periodo, vista, nastro, Oggi/mesi, Legenda (telefoni 1–2).
- E2 Filo sopra l'elenco; riga maiuscoletta ottone «RICHIESTE APERTE · 3» con a destra «+ NUOVA RICHIESTA» sottolineato.
- E3 Chip a pillola dell'ordine: «Durata» (accesa di default) · «Arrivo» · «Persone» · «Da guardare · N» (solo se ci sono ferme; premuta, il titolo diventa «DA GUARDARE»).
- E4 Filtro «stesse date» con la barra «Richieste per {periodo} · N richieste, la più vecchia per prima · Vedi tutte», rivestito (incarico).
- E5 Ogni richiesta è una riga separata da un filo (elenco A).
- E6 Riga (1): etichetta maiuscoletta ottone «OGGI · DAL SITO · GIÀ OSPITE 3 VOLTE»; se c'è, «⧉ 1 altra per le stesse date» in blu ardesia #41637A (tocco = filtra il gruppo).
- E7 Riga (2): titolo Cormorant 19 px «🧾 ★ Anna Rinaldi · 30 set → 3 ott».
- E8 Riga (3): il telefono per esteso in Cormorant 17 px «+39 347 812 6690» con accanto i cerchi cornetta e WhatsApp da 26 px (novità 14c).
- E9 Riga (4): 12,5 px grigio «3 notti · 2 persone · qualsiasi camera · 640 € spesi» (speso in mattone, «3 → 2 persone» se cambiano).
- E10 Riga (5): con la proposta «Proposta inviata · scade tra 2 h 15 min · ferma da 3 giorni» (scadenza in grassetto, #6E5116); «si sovrappone con {ospite} (date)» come oggi (incarico).
- E11 Riga (6): la nota del cliente in mattone 13 px fra virgolette basse.
- E12 Riga (7): azioni sottolineate «Invia proposta» (o «Conferma») principale, «Modifica», «Rifiuta».
- E13 Elenco vuoto: «Nessuna richiesta in attesa» / «Nessuna richiesta ferma» come oggi.
- E14 In fondo, col filo sopra, «CHIUSE · N» con «MOSTRA» a destra.

## 5. Telefono 5 · Chiuse

- C1 Riga maiuscoletta ottone «CHIUSE · ULTIMI 3 GIORNI» con «NASCONDI».
- C2 Scaduta: etichetta «SCADUTA · CHIUSA DA SOLA IERI ALLE 16:40» in mattone.
- C3 Rifiutata: «RIFIUTATA DA TE · HA DETTO DI NO · 27 SET» in grigio.
- C4 Confermata: «CONFERMATA · 27 SET» in verde (incarico).
- C5 Nome e date in Cormorant («Sara Galli · 6 → 11 ott»), sotto i dati «5 notti · 2 persone · Ambra».
- C6 Azione «Riapri» (scaduta, rifiutata) oppure «Apri la scheda» (confermata).
- C7 In fondo «Dopo 3 giorni spariscono da sole.»; senza chiuse «Nessuna richiesta chiusa negli ultimi 3 giorni.» come oggi.

## 6. Telefoni 6–9 · La richiesta a linguette (novità 14d)

Testata (uguale nei quattro telefoni):
- L1 Barra «‹ Richieste» a sinistra e lo stato in maiuscoletto ottone a destra («In attesa», «Proposta inviata», «Confermata», «Chiusa»).
- L2 Nome in Cormorant 26 px con 🧾 ★ davanti; a destra i cerchi cornetta e WhatsApp.
- L3 Sotto, il telefono per esteso in Cormorant (novità 14c).
- L4 Riga maiuscoletta grigia «GIÀ OSPITE 3 VOLTE · DAL SITO · OGGI 08:41».
- L5 Riga Cormorant 16 px «3 → 6 ott · 3 notti · 2 persone · qualsiasi camera» (persone per notte se variano).
- L6 La nota del cliente in mattone fra virgolette basse.
- L7 RigaScadenza nella veste nuova sotto la testata, quando c'è una proposta inviata (incarico).
- L8 Quattro linguette CONTROLLARE · CAMERE · PAGAMENTO · MESSAGGIO, fili ottone sopra e sotto, attiva col filo sotto (come la scheda prenotazione).
- L9 Una parte alla volta; linguetta nell'indirizzo (#controllare, #camere, #pagamento, #messaggio); all'apertura Controllare, Messaggio se la proposta è già inviata (incarico).

Telefono 6 · Controllare:
- K1 Maiuscoletto ottone «DA CONTROLLARE».
- K2 Righe con titolo Cormorant 16 px e testo 13 px: «Amelia è in opzione fino alle 18:00 per L. Greco. Libere per tutto il periodo: …» (o «…era in opzione…, scaduta alle… Puoi proporla.»).
- K3 «Stesse date · N» con la riga dell'altra richiesta e «VEDI».
- K4 «Cliente che torna» con soggiorni precedenti e speso.
- K5 Con niente da segnalare «✓ Tutto a posto».
- K6 In fondo «AVANTI · CAMERE» sottolineato, centrato; e «Modifica» per aprire il modulo (incarico: il link di modifica diventa l'azione «Modifica»).

Telefono 7 · Camere:
- M1 Maiuscoletto ottone «CAMERE DA PROPORRE · N».
- M2 Righe camera: casella a filo 20 px (piena d'inchiostro con ✓ se scelta), nome in Cormorant 17 px, sotto in 11 px «3 notti · 90 €/notte · + letto» / «in opzione fino alle 18:00 per L. Greco» / «va tolto il tavolo»; a destra il totale in Cormorant 17 px.
- M3 Badge «tripla» / «+ letto» come oggi, nel testo piccolo (incarico).
- M4 Azioni tenui: «UN'ALTRA SOLUZIONE» (con «Proposta con cambio camera» / «Proposta per una parte delle notti»), «COMPONGO IO, NOTTE PER NOTTE» (striscia e foglio del prezzo a mano: Applica, Applica a tutte le notti di questa camera, Ripristina tariffa, Chiudi), «NON HO POSTO» (e «Torna alle disponibilità»), «Torna alla proposta automatica».
- M5 Riga con casella «Aggiungi l'alternativa Ambra/Allegra», sotto le camere, solo se Amelia è scelta (novità 14e).
- M6 Tasto pieno «AVANTI · PAGAMENTO».
- M7 Messaggi «Scegli almeno una camera» ecc. come oggi.

Telefono 8 · Pagamento:
- N1 Maiuscoletto ottone «COME PAGA».
- N2 Quattro chip «All'arrivo · Caparra · Pagamento completo · Personalizzata» (accesa piena d'inchiostro).
- N3 Con Caparra il campo a filo col 50 % proposto; «Scrivi l'importo della caparra», «La caparra supera il totale» (incarico).
- N4 Con Personalizzata il campo di testo; «Scrivi le condizioni di pagamento» (incarico).
- N5 In grigio «La camera resta in opzione 3 ore dall'invio · con caparra o pagamento completo 24 ore».
- N6 Tasto pieno «AVANTI · IL MESSAGGIO».

Telefono 9 · Messaggio:
- S1 Maiuscoletto ottone «IL MESSAGGIO · DISPONIBILITÀ COMPLETA» (ETICHETTA_CASO: «Cambio camera», «Manca una parte», «Completo», «Notti selezionate»…).
- S2 Chip «Solo testo | Testo + immagine».
- S3 Riquadro del testo col bordo, 12,5 px, alto al massimo 230 px, con «MOSTRA TUTTO» / «Richiudi».
- S4 Modificabile finché non è inviata: «MODIFICA IL TESTO», «Ripristina la bozza», «Torna a quella inviata», «Sostituire il testo modificato?» (incarico).
- S5 Con l'immagine i passi «1 · Salva immagine / Copia immagine» e «2 · Apri WhatsApp e invia» come oggi (incarico).
- S6 Tasto pieno «APRI WHATSAPP E INVIA» (poi «Invia di nuovo»).
- S7 Al ritorno «L'hai inviata?» con «Sì, inviata» / «No» in un FoglioMaison basso; «Invio da confermare» e «Scarta attesa e ricomponi» come oggi (incarico).
- S8 Sotto, centrate, «CONFERMA → CREA LA PRENOTAZIONE» e «RIFIUTA LA RICHIESTA» (mattone).

## 7. Telefono 10 · Creare la prenotazione?

- X1 FoglioMaison 520 px sopra la linguetta Messaggio.
- X2 Maiuscoletto ottone «ANNA RINALDI · 30 SET → 3 OTT · CONFERMA».
- X3 Titolo Cormorant 22 px «Creare la prenotazione?».
- X4 Con più camere proposte: «Il messaggio proponeva 2 camere: quale ha scelto la cliente?» e le chip «Ambra · 270 €» · «Allegra · 240 €».
- X5 Riga SOLUZIONE «Disponibilità completa · 3 notti · 270 € · pagamento all'arrivo».
- X6 Maiuscoletto «ALTRE RICHIESTE PER LE STESSE DATE · RIFIUTA ANCHE QUESTE» con le caselle a filo («✓ Marco Colombo · 30 set → 3 ott · Allegra»).
- X7 Tasto pieno «CREA PRENOTAZIONE» («Creo…»).
- X8 «ANNULLA» centrato.
- X9 Chiama `conferma_richiesta` e apre /scheda/{id} come oggi.

## 8. Telefono 11 · Perché la rifiuti?

- Y1 FoglioMaison 400 px.
- Y2 Maiuscoletto ottone «ANNA RINALDI · 30 SET → 3 OTT · RIFIUTA».
- Y3 Titolo Cormorant «Perché la rifiuti?».
- Y4 I quattro motivi come righe con casella a filo (Non ha risposto · Ha detto di no · L'ho data a un altro · Altro motivo).
- Y5 «La richiesta resta in archivio fra le chiuse per 3 giorni, con «Riapri».»
- Y6 Tasto pieno MATTONE «RIFIUTA LA RICHIESTA».
- Y7 «ANNULLA» centrato.
- Y8 Scrive stato chiusa / chiusura_motivo rifiutata come oggi.

## 9. Telefono 12 · Nuova richiesta (e Modifica)

- W1 Pagina Maison: «‹ Richieste» in alto a sinistra.
- W2 Titolo Cormorant 26 px «Nuova richiesta» (o «Modifica richiesta»).
- W3 CANALE: chip Telefono · WhatsApp («Dal sito» solo se la richiesta è dal sito).
- W4 CLIENTE: campi a filo Nome, Cognome, Telefono (etichetta maiuscoletta piccola sopra, valore in Cormorant 17).
- W5 Sotto il telefono la riga verde/ottone «Già ospite 3 volte · Anna Rinaldi» o «Cliente già in archivio: …» quando il numero è in archivio.
- W6 «Da dove arriva» = CampoProvenienza.
- W7 SOGGIORNO: Arrivo e Partenza a filo affiancati; cambiando l'arrivo la partenza segue con le stesse notti (incarico).
- W8 Persone con − / + nei cerchi; Camera a tendina con «Qualsiasi».
- W9 Azioni «SOLO ALCUNE NOTTI» (striscia delle notti selezionate) e «PERSONE NOTTE PER NOTTE» (striscia con «tocca una notte per cambiarla (1–N)»).
- W10 NOTE: campo a filo col segnaposto «Es. arriva tardi, chiede il letto aggiuntivo…».
- W11 Tasto pieno «SALVA LA RICHIESTA» («Salvataggio…»), conferma B.

## 10. Novità di comportamento (le sole)

- Z1 14a RigaPeriodo sul telefono in Calendario, Arrivi e Richieste (vedi R3); dal Mac invariata.
- Z2 14b Tocco su una richiesta nel calendario = foglietto Maison (sezione 3).
- Z3 14c Telefono per esteso accanto alle icone: elenco, foglietto, testata della richiesta, modulo.
- Z4 14d Richiesta a linguette sul telefono; dal Mac le quattro parti una sotto l'altra, pagina unica a 620 px, la fascia delle linguette porta alla sezione.
- Z5 14e «Aggiungi l'alternativa Ambra/Allegra» sotto le camere, solo con Amelia scelta.
- Z6 14f `scadenzaProposta` usa la durata vera dell'opzione (3 ore all'arrivo, 24 con caparra / completo / personalizzata): timer in elenco e nel foglietto, «Da guardare», bollino blu, «Proposta inviata · scade …»; chiusura automatica con la stessa durata (notifica alla scadenza vera, chiusura 24 ore dopo); test per 3 e 24 ore; testo del messaggio invariato.

## 11. Mac (incarico punto 1 e 7)

- D1 Dal Mac in cima la scrittina «RICHIESTE» a 64 px come le altre pagine, ricerca a destra.
- D2 Dal Mac la riga del periodo resta quella di oggi (RigaPeriodo Cormorant 30).
- D3 Dal Mac la richiesta è una pagina unica a 620 px con le quattro parti una sotto l'altra e la fascia delle linguette che porta alla sezione.
