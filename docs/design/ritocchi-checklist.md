# Ritocchi «Maison» e pagina Clienti — checklist

Fonti: l'incarico del 29/09/2026 (punti A1–D4) e i due riferimenti approvati
da Ania lo stesso giorno: `scheda-ritocchi-riferimento.html` (riferimento 1:
«Modifica dati», «Senza note», «Prima», «Dopo») e `clienti-riferimento.html`
(riferimento 2: 1 elenco, 2 scheda cliente pagina unica; le schermate 3–5 a
linguette sono l'alternativa NON scelta: l'incarico dice «pagina unica»).
Dove il riferimento e l'incarico si scostano vale l'incarico (scritto nella
voce). I dati dei telefoni (Maria Rossi, Teresa Bianchi…) sono esempi.

Risposte di Ania alle domande del 29/09/2026 (bottoni):
- A2: frecce «‹ pillola ›» come oggi, tutte e tre attaccate a destra;
  cambiano solo la misura della pillola e la data più grande.
- A4: anche nel foglietto della richiesta il numero va sotto il nome coi
  cerchi a destra, e la riga TELEFONO sparisce.
- A4: «Chiudi a filo» = contorno sottile, 44 px, metà larghezza, fondo
  trasparente, filo scuro.

Il riscontro (`ritocchi-riscontro.md`) riprende ogni codice con «fatta» o
«non fatta: motivo».

## 0. Regole comuni

- G1 Testi bloccati: quello che il gestionale mostra oggi resta uguale, salvo i cambi scritti qui.
- G2 Veste Maison di sempre: Cormorant per nomi, numeri di telefono, importi, titoli; maiuscoletto ottone per etichette; mattone #8C3B2E per note, «speso», azioni distruttive; fili #E8E3DA.
- G3 Componenti condivisi, mai copiati: FoglioMaison / PiedeMaison / PiedeFoglio, IconeContatto, telefonoPerEsteso, RigaPeriodo, SalvatoMaison, lib/datiCliente, rigaCliente, righeStorico, storicoCliente, DocumentiCliente (logica), VisoreDocumento.
- G4 Dal Mac invariato dove l'incarico lo dice (A1, A2) e veste Mac della pagina Clienti come D2/D3.
- G5 Un commit per pezzo (1–12), suite verde prima di ogni push.

## A · Calendario e Arrivi (telefono)

- A1a 18 px fra la riga «🛏 extra» (Calendario) o l'ultima corsia (Arrivi) e la riga «Oggi · mesi».
- A1b «Legenda» 14 px sotto «Oggi».
- A1c L'area di tocco di «Oggi» almeno 44 × 44 px.
- A1d Dal Mac invariato.
- A2a RigaPeriodo telefono, in tutte le pagine che la usano (Calendario, Arrivi, Richieste): pillola «Mese | 2 sett.» più piccola, testo 9,5 px, padding 4 × 8.
- A2b «2 SETT.» al posto di «2 SETTIMANE» (solo sul telefono).
- A2c Frecce: ‹ prima della pillola, › dopo, tutte e tre attaccate a destra, gap 8 px, frecce come oggi (risposta di Ania).
- A2d Periodo a sinistra in Cormorant, il più grande possibile su UNA riga a 390 px (da 24 px in giù di 1 px finché sta), valore misurato scritto nel riscontro.
- A2e Mese abbreviato: «28 set – 11 ott 2026».
- A2f Dal Mac invariato (30 px, mese per esteso).
- A3a Costante `BUCHI_LIBERI_VISIBILI` in lib/calendarioMobile (prova reversibile), oggi `false`.
- A3b Niente riquadri tratteggiati dei buchi («2 → 5 ott · +») nel Calendario e negli Arrivi: la corsia vuota resta vuota.
- A3c Il tocco su un giorno libero apre la nuova prenotazione con camera e giorno toccato già scritti (il giorno esatto).
- A3d Nel riscontro uno screenshot con e uno senza.
- A4a Foglietto della prenotazione (Calendario): sotto il nome, il numero per esteso in Cormorant 16 px («+39 342 700 4354»); cornetta e WhatsApp a destra sulla stessa riga del numero (via dalla riga del nome).
- A4b In fondo «Apri la scheda» e «Chiudi» affiancati, metà larghezza ciascuno, gap 12 px, alti 44 px, centrati.
- A4c «Apri la scheda» pieno inchiostro con testo avorio; «Chiudi» a filo (contorno sottile, fondo trasparente).
- A4d I due tasti 28 px sotto l'ultima riga, non incollati al bordo inferiore.
- A4e Foglietto della richiesta (Richieste): numero sotto il nome coi cerchi a destra, via la riga TELEFONO (risposta di Ania).
- A4f Foglietto della richiesta: «Invia proposta» / «Conferma» pieno e «Chiudi» a filo, affiancati come A4b; «Modifica · Rifiuta» sottolineati sopra (Rifiuta in mattone come oggi).
- A4g Con più richieste sovrapposte: stesse regole in ogni blocco, «Chiudi» a filo in fondo.

## B · Fogli (FoglioMaison)

- B1a «Annulla» e «Salva» (o l'azione principale) sempre nello stesso punto: riga fissa 24 px sotto il contenuto più lungo del foglio.
- B1b L'altezza fissa di ogni foglio = il suo contenuto più lungo + 24 px + la riga dei tasti (niente più 752 / 700 px a vuoto).
- B1c FoglioArrivo misurato nel caso più lungo: luogo esterno, fascia oraria, stima in struttura, navetta con autista e prelievo, storico.
- B1d FoglioPagamento misurato con «Altro importo» e la nota.
- B1e Vale per tutti i fogli della scheda, della Home, degli Arrivi e delle Richieste.
- B1f Nel riscontro l'altezza nuova di ogni foglio.
- B2a FoglioCliente rifatto come riferimento 1 «Modifica dati»: titolo = nome in Cormorant 24, sottotitolo «DATI DELLA CLIENTE» maiuscoletto ottone.
- B2b Avviso «Questi dati sono della cliente: valgono per tutti i suoi soggiorni, non solo per questo.»
- B2c Campi a filo con etichetta maiuscoletta ottone sopra: Nome e Cognome affiancati, Telefono, «Email · può restare vuota».
- B2d «PAGA DI SOLITO CON» chip Contanti | Bonifico (D1).
- B2e «RICEVUTA» chip No | Sì 🧾 e «VALUTAZIONE» chip ★ | Normale | ! (mattone), affiancate.
- B2f «Perché» (segnaposto «resta solo per noi») quando la valutazione è «!».
- B2g «COME CI HA TROVATO» chip Google | Passaparola | Altra struttura | Non so; sotto le strutture note + «Altra…».
- B2h «NOTE DEL CLIENTE · RESTANO ANCHE LE PROSSIME VOLTE» a filo.
- B2i Tasto pieno «Salva» (pastiglia piena a tutta larghezza come nel riferimento) e «Annulla» sottolineato sotto, nella riga fissa (B1).
- B2j Conferma B (SalvatoMaison) dopo il salvataggio.
- B2k Regole, errori e salvataggio di oggi (lib/datiCliente, errore della 0046).
- B2l Si apre da «Modifica dati» nella scheda prenotazione e da «Modifica dati» nella scheda cliente.

## C · Scheda prenotazione (riferimento 1)

- C1a Sotto il nome il numero per esteso in Cormorant 19 px, cerchi cornetta e WhatsApp da 32 px a destra sulla stessa riga; via i cerchi accanto al nome.
- C1b 10 px fra nome e telefono.
- C1c 14 px prima di «dorme …», che tiene i suoi cerchi da 28.
- C1d 12 px prima della riga «Già ospite …».
- C1e 14 px prima delle note (filo tratteggiato; 12 px di aria sopra il testo, «QUESTA VOLTA» 8 px sopra).
- C1f 22 px fra la testata e la fascia delle linguette.
- C1g Senza note e senza «dorme»: nome, telefono, «Già ospite …» (schermata «Senza note»).
- C2a Linguette: padding 13 px sopra e 11 sotto (etichetta 9,5 px).
- C2b Sotto «Soggiorno» e «Conto» le righe «28 set → 4 ott» e «resta 470 €» (mattone) / «saldato» in Cormorant 14 px, peso 500, su una riga (nowrap).
- C2c Con più periodi resta «primo arrivo → ultima partenza».
- C3a Soggiorno: via la riga «un tocco su una notte: camera, ospiti, letto in più di quella notte».
- C3b Sotto la striscia, a 22 px, fascia con filo sopra e sotto e 14 px di padding.
- C3c Prima riga: «Cambia date» a sinistra, «Cambio camera» a destra; sotto (12 px) «Aggiungi camera» centrata; tutte e tre sottolineate.
- C3d «Togli camera» in mattone dove compare oggi.
- C3e «Camere» 26 px sotto la fascia; righe con 12 px di padding, la seconda riga a 3 px dal nome.
- C3f Sezione «Arrivo e navetta» con 18 px sopra (riferimento «Dopo»).
- C4a «‹» in alto col nome della pagina di provenienza: «‹ Oggi» (Home), «‹ Calendario», «‹ Arrivi», «‹ Richieste», «‹ Cliente», «‹ Prenotazioni» (elenco).
- C4b Anche dopo un salvataggio nella scheda (pagamento, arrivo…).
- C4c Senza provenienza (notifica, link diretto): «‹ Prenotazioni».
- C4d Parametro `da` con un valore per ogni pagina su tutti i link che aprono la scheda; `?da=cliente&cliente=` esteso, non sostituito.
- C4e La freccia torna davvero alla pagina di provenienza.

## D · Clienti

- D1a Colonna `guests.pagamento_abituale` («contanti» | «bonifico» | null), migrazione a parte (proposta da applicare a mano; codice tollerante alla colonna mancante).
- D1b Alla PRIMA prenotazione (cliente senza valore) il modo scelto in «Come paga» della Nuova prenotazione si salva sul cliente.
- D1c Non si aggiorna da solo dopo; si cambia solo dal foglio «Dati della cliente».
- D1d Chip già accesa col valore del cliente (modificabile ogni volta) in: Aggiungi pagamento, «Come paga» della Nuova prenotazione, «Come paga» della scheda, «Come paga» della proposta nelle Richieste.
- D1e Cliente nuovo o senza valore: come oggi.
- D1f Testata della scheda cliente: «paga in contanti» / «paga con bonifico».
- D2a /clienti: barra Maison A «CLIENTI».
- D2b Campo «Cerca nome o telefono…» a filo (stessa ricerca: nome o telefono).
- D2c Riga maiuscoletta ottone «CLIENTI · N» con a destra «+ NUOVO CLIENTE» sottolineato (stesso link con ?ricerca=).
- D2d Righe separate da filo: icone davanti al nome (🧾 ricevuta, ★ ottimo, «!» mattone problematico), nome in Cormorant 19 («Senza nome» se manca).
- D2e Sotto: telefono per esteso Cormorant 16 coi cerchi cornetta e WhatsApp da 26 px.
- D2f Sotto: 12,5 px grigio «da Nida · 4 soggiorni · 640 €» (rigaCliente: provenienza, soggiorni conclusi, speso in mattone; «prima volta» se zero; «· motivo interno» se c'è il motivo).
- D2g Il tocco apre la scheda cliente.
- D2h Ordine e stati come oggi («Caricamento…», «Nessun cliente trovato»).
- D2i Dal Mac: scrittina a 64 px con ricerca e «+ Nuovo cliente» a destra, elenco a 620 px.
- D3a /clienti/[id]: barra «‹ Clienti».
- D3b Testata centrata: nome Cormorant 28 con le icone davanti.
- D3c Telefono per esteso 19 px coi cerchi da 32.
- D3d Email in maiuscoletto grigio (se c'è).
- D3e Riga maiuscoletta «da Nida · 4 soggiorni · 640 € · ricevuta · ottimo · paga in contanti» (solo i pezzi presenti, speso in mattone).
- D3f La nota del cliente in mattone sotto un filo tratteggiato; «Motivo interno: …» in mattone se c'è.
- D3g Azioni centrate «Modifica dati» (FoglioCliente B2; sostituisce «Modifica» e la modifica in pagina, anche ?edit=1) e «Nuova prenotazione» (/nuova-prenotazione col cliente già scelto).
- D3h Tre numeri «SOGGIORNI · TOTALE SPESO · ANNULLATE» in Cormorant 22 (storicoCliente; annullate in mattone).
- D3i «ULTIMI ARRIVI» con gli orari e 🚌 come oggi.
- D3j «DOCUMENTI · N»: griglia a due colonne, anteprima 4:3 (URL firmato; 📄 per i PDF), etichetta «Carta d'identità · fronte», «data · dimensione · elimina» (elimina sottolineato piccolo).
- D3k Elimina documento: pop-up nel FoglioMaison «Eliminare questo documento?» / «{etichetta} · non si può recuperare.» / Elimina (mattone) · Annulla.
- D3l Il tocco sull'anteprima apre il VisoreDocumento di oggi.
- D3m Sotto la griglia chip del tipo (Carta d'identità · Passaporto · Patente · Altro; «Documento» resta nel database) e del lato (fronte · retro), a destra «Aggiungi documento» sottolineato (stesso input, riduzione e archivio; «Carico…»).
- D3n Nota «Le foto vengono ridotte…» in grigio 11 px; «Nessun documento allegato.» e gli errori come oggi.
- D3o «SOGGIORNI · N»: una riga per soggiorno (righeStorico, anche le future): camere Cormorant 17 («Ambra → Lena», «Ambra + Amelia»).
- D3p Sotto in 12 px grigio «date con l'anno · arrivo HH:MM / orario non registrato · 🚌 / no navetta · 🛏 letto in più».
- D3q A destra importo Cormorant 16 e stato in maiuscoletto (annullata in mattone, riga a opacità .6 con «Motivo: …» sotto).
- D3r Il tocco apre /scheda/{id}?da=cliente&cliente={id}; «Nessuna prenotazione» se vuoto.
- D3s In fondo, centrato, «Elimina cliente» in mattone; pop-up di oggi nel FoglioMaison («Elimina cliente» / «Sei sicuro? …» / «Sì, elimina» · «Annulla»).
- D3t Errori e «Cliente non trovato» come oggi.
- D3u Dal Mac: pagina a 620 px, scrittina «CLIENTE» a 64 px.
- D4a /clienti/nuovo nella veste Maison del modulo (come «Nuova richiesta»): campi a filo Nome e Cognome, Telefono (segnaposto «+39 333 1234567», prefisso 39 come oggi), «Email · può restare vuota».
- D4b Chip ricevuta e valutazione.
- D4c Tasto pieno «Salva cliente»; errore «Inserisci almeno nome o numero di telefono.»; dopo il salvataggio apre la scheda cliente.

## Mac, test, riscontro

- M1 Dal Mac: A1/A2 invariati; Clienti come D2i/D3u; foglietti e fogli al centro come oggi.
- T1 Test: riga fissa dei tasti (altezza per foglio), telefono per esteso nei foglietti, provenienza della freccia per ogni pagina, pagamento_abituale (prima prenotazione, niente aggiornamento da solo, chip preaccesa), righe dell'elenco clienti, scheda cliente (testata, numeri, documenti, soggiorni), riga del periodo sul telefono; test toccati aggiornati.
- R1 Riscontro in `ritocchi-riscontro.md`, screenshot a 390 px: Calendario senza buchi (e con), foglietto, FoglioArrivo coi tasti, scheda Soggiorno, scheda cliente.
- R2 «Prove dal telefono in 10 minuti» in CONSEGNA-ATTIVA.md.
- R3 Prova coi dati veri: cliente con documenti, scheda dalla Home e ritorno con la freccia, pagamento di prova registrato e tolto su una prenotazione di test (poi cancellata).
- R4 Commit e push su main, verifica sul sito pubblicato.
