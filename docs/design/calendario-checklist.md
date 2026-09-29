# Calendario «Maison» — checklist del riferimento

Fonte: `docs/design/calendario-riferimento.html` (approvato da Ania il
29/09/2026) più l'incarico dello stesso giorno (punti 1–12). Qui c'è **solo
quello che il riferimento mostra** nei nove telefoni della striscia (2
settimane · Mese · Ricerca · Elenco risultati · Richieste dal sito ·
Foglietto al tocco · Catena in evidenza · Camera tenuta · Legenda), più le
regole dell'incarico che lo precisano. Ogni voce ha un codice: il riscontro
finale (`calendario-riscontro.md`) la riprende con «fatta» o «non fatta:
motivo».

Il file definisce anche altri disegni (C1–C10, C10A–C10D: griglia a
barre, verticale, agenda, mese a caselle, tessere, 5 giorni…) che NON entrano
nella striscia: non fanno parte del disegno. Le frasi grigie sotto ogni
telefono spiegano il disegno a chi guarda e non sono testi della pagina. La
riga «CALENDARIO» in cima a ogni telefono è la barra dell'app (sul telefono il
titolo lo dice lei, punto 6).

Dove riferimento e incarico si scostano vale l'incarico, che è più preciso
(scritto nella voce, «incarico»); i dati dei telefoni (Fam. Russo, G. Serra…)
sono esempi.

## 0. Regole comuni (tutti i telefoni)

- G1 Caratteri: Cormorant Garamond per i nomi delle camere, i nomi sulle schede, l'etichetta del periodo, i nomi nel foglietto; Figtree sul telefono e Jost dal Mac per il resto (variabili `--home-*` esistenti).
- G2 Dal telefono sfondo bianco puro e fili #E8E3DA (prova C); dal Mac crema #F6F2EA.
- G3 Inchiostro #241F1A, testi secondari #6E6558, ottone #A8894F.
- G4 Niente bottoni pieni tranne: la pastiglia ink del risultato corrente, la voce accesa di «Mese | 2 settimane», il mese acceso nella riga dei mesi.
- G5 Le azioni sono maiuscoletto sottolineato («Apri», «Apri la scheda», «Chiudi», «Libera la camera», …), come nelle altre pagine Maison.
- G6 I colori delle schede definiti in un punto solo (costanti in `lib/calendarioMobile`), così si cambiano in un colpo.

## 1. Testa (telefoni 1–9)

- T1 Sul telefono niente titolo nella pagina: lo dice la barra dell'app (TestaPagina come oggi).
- T2 Campo di ricerca a tutta larghezza, margini 16 px: solo filo sotto #C9BFA8, lente a sinistra in grigio, segnaposto «Cerca nome o telefono…», testo 15 px.
- T3 Con del testo scritto: il testo in inchiostro e «✕» a destra (svuota).
- T4 Stessa logica di oggi (nome, scheda cliente, telefono tollerante: lib/ricerca).

## 2. Ricerca (telefoni 3 e 4)

- R1 Nessun risultato: «Nessuna prenotazione trovata» in mattone chiaro #8c6a52 (testo di oggi).
- R2 Un risultato: una riga «🔎 Fam. Russo · 28–30 set · Ambra».
- R3 Più risultati, stesso cliente: riga «🔎 **3 prenotazioni trovate** · Fam. Russo ▾» (13 px, il conteggio in grassetto, «▾» grigio 11 px); con clienti diversi «· 2 clienti diversi».
- R4 Tocco sulla riga = elenco a comparsa; aperto il segno diventa «▴».
- R5 Navigatore: cerchio a filo 40 px «‹» (bordo #C9BFA8), pastiglia ink a tutta larghezza con «2 DI 3» maiuscoletto 9,5 px sopra e «28 – 30 set · Ambra» in Cormorant 15 px sotto, cerchio a filo «›».
- R6 Con clienti diversi, nella pastiglia una terza riga col nome e «…1234».
- R7 Tocco sulla pastiglia: il calendario torna sulla data del risultato.
- R8 Elenco a comparsa SOPRA il calendario (non lo spinge in basso), margini 16 px, riquadro bianco con filo, angoli 8 px, ombra leggera; una voce per risultato «28 – 30 set · Ambra» 13 px; la voce corrente su fondo crema #F6F2EA.
- R9 Con clienti diversi ogni voce dell'elenco ha anche nome e «…1234».
- R10 Scheda trovata col contorno verde 2 px; le altre schede attenuate (opacità 0,35); i buchi liberi restano normali.
- R11 Il calendario salta al primo risultato; svuotando il campo torna tutto com'era.
- R12 Dal Mac i risultati in fila (come oggi), rivestiti.

## 3. Richieste dal sito (telefono 5)

- W1 Riquadro a filo sopra il calendario (margini 16 px, filo #E8E3DA, angoli 8 px), una riga per richiesta separata da un filo.
- W2 Riga: «🌐 **A. Moretti** · 04/10 → 06/10 · Amelia» 13 px, il nome in grassetto.
- W3 A destra «APRI» maiuscoletto sottolineato 10,5 px.
- W4 Tocco sulla riga = il calendario va lì; «Apri» = la prenotazione.
- W5 L'avviso «⚠️ Numero già usato · in archivio: …» resta in rosso, su riga propria.
- W6 Con più richieste durante una ricerca: riga compatta «🌐 N richieste dal sito · tocca per vedere».

## 4. Riga di navigazione (tutti i telefoni)

- N1 «‹» a sinistra, segno semplice 18 px, area di tocco 44 px.
- N2 Al centro l'etichetta del periodo in Cormorant 16 px: «28 set – 11 ott 2026» a 2 settimane, «Settembre 2026» a mese (testi di oggi).
- N3 A destra l'interruttore «MESE | 2 SETTIMANE»: pillola col filo #C9BFA8, 10 px maiuscoletto, voce accesa su fondo ink col testo crema; poi «›».
- N4 La scelta resta ricordata nel browser (come oggi).
- N5 Filo sotto la riga; 8 px sopra (dopo il campo o i risultati).
- N6 Novità 12a: a «2 settimane» le frecce spostano di UNA settimana (7 giorni); a «Mese» vanno al 1° del mese prima/dopo. aria-label «Una settimana prima/dopo».

## 5. Il nastro (telefoni 1–9)

- S1 Righello dei giorni: una riga «lun 28», 9 px grigio, filo a sinistra di ogni giorno; domeniche #B08968; oggi in verde #2D6A4F e grassetto; resta fermo in alto scorrendo in giù.
- S2 Colonna delle camere 66 px (fissa a sinistra scorrendo di lato), nome in Cormorant 14 px in alto a sinistra.
- S3 Una corsia per camera alta 92 px (incarico punto 3; il punto 10 dice 80, il riferimento finale 92), filo sotto e filo a sinistra.
- S4 Schede alte 72 px (9 px dall'alto), angoli 6 px, filo pieno 4 px a sinistra, larghe notti × giorno meno 6 px (3 px d'aria per lato).
- S5 Riga (a): maiuscoletto 9 px «26 set → 1 ott · 3 notti»; «· dal sito 🌐» sulle richieste; «· in opzione» sulle camere tenute.
- S6 Riga (b): le icone PRIMA del nome, nell'ordine 🔒 ⭐ 🧾 🛏 ⇄ (e 🌐 dei clienti arrivati dal sito), poi il nome in Cormorant 14 px (nomeConAltri).
- S7 Riga (c): 9,5 px «N ospiti · stato» (pagato / bonifico in attesa / da incassare / da confermare / scade alle HH:MM) più «· 1 letto extra» / «· 2 letti extra».
- S8 Riga (d): 9,5 px ottone scuro #7a5f2c «arriva 15:10 · autonomo», «arriva 14:30 · Linate, Massimo», «orario da chiedere»; manca su richieste dal sito e camere tenute.
- S9 Il testo che non ci sta si taglia, una riga per riga, niente a capo.
- S10 Colori (fondo / filo): prenotazione #C5D6E2 / #7D9DB0 · bonifico in attesa #D3CCE8 / #9B8EC4 · pagato #BFDCC8 / #6C9A7C · dal sito #EAF3EE col bordo tratteggiato #2D6A4F e testo verde · tenuta #E8D6AE / #A8894F · esclusiva #F9CFA6 / #f97316 · gli altri colori di «Nota e colore» come filo, col fondo schiarito allo stesso grado.
- S11 Testo delle schede nel colore scuro della loro tinta (prenotazione #2B4A5E, pagato #1F3D2F, bonifico #4A3F78, tenuta #6E5116, esclusiva #7A3E10).
- S12 Letto extra (uno o due): filo 3 px rosso acceso #D0261B in fondo, dentro la scheda; il colore della scheda resta quello del pagamento. Via le righe diagonali e il colore-letto.
- S13 Buchi liberi fra due schede (e prima della prima / dopo l'ultima): riquadro tratteggiato #D5CCBB, maiuscoletto «3 → 4 OTT» grigio #A89E8C, «+» grande #C9BFA8 sotto.
- S14 Tocco su un buco = /nuova-prenotazione?room_id=…&check_in=… (camera e arrivo già scritti); lo stesso su un giorno libero fuori dai buchi.
- S15 Filo verde #2D6A4F verticale a tutta altezza sulla colonna di oggi.
- S16 Filo ottone 2 px al 1° di ogni mese su tutte le righe.
- S17 Riga «🛏 EXTRA» sotto le camere: 30 px, fili #D6CFBD da 2 px sopra e sotto, etichetta maiuscoletto 9,5 px #8A1E15 su #F8D9D6; per giorno «1/2» in #8A1E15; cella piena #D0261B col testo bianco a 2/2; riquadro tratteggiato ottone col numero dei letti tenuti; colonna di oggi crema.
- S18 Cambio camera: la scheda che parte tagliata in obliquo in basso a destra, quella che arriva in basso a sinistra (14 px, angoli arrotondati anche lì).
- S19 Lungo il taglio, a filo del bordo tagliato, il filo 4 px dello STESSO colore del filo sinistro (#7D9DB0, #9B8EC4, #6C9A7C, #A8894F o la tinta scelta); sulla scheda che arriva il filo obliquo sostituisce quello dritto.
- S20 Sulle catene «⇄» davanti al nome su tutti i tratti; riga (c) «· poi Lena» sul tratto che parte e «· da Ambra» su quello che arriva; riga (d) «cambio camera» sul tratto che arriva.
- S21 Larghezza del giorno sul telefono 60 px a «2 settimane», 40 px a «Mese»; telefono girato e Mac con le larghezze di oggi; a «Mese» le stesse schede, tagliate.
- S22 Scorrimento continuo di lato su tutto l'anno ed estensione automatica, come oggi.
- S23 Area di tocco delle schede ≥ 44 px.

## 6. Sotto il nastro (tutti i telefoni)

- M1 «OGGI»: cerchio a filo (bordo ink, maiuscoletto 11 px), centrato sotto la colonna delle camere (66 px), trattino #D6CFBD 2 px in fondo alla colonna.
- M2 I 12 mesi cliccabili a destra che scorrono di lato, 12,5 px; il mese in vista acceso (fondo ink, testo crema); l'anno nuovo in Cormorant 11 px ottone.
- M3 «LEGENDA» maiuscoletto sottolineato 10,5 px, centrata nella stessa colonna sotto «Oggi» (niente più «?»).

## 7. Foglietto al tocco (telefono 6)

- F1 Foglio dal basso, fondo crema #F6F2EA, filo #DDD3C2 in alto, maniglia 36 × 3 px, altezza FISSA 430 px uguale per ogni prenotazione, velo sopra il calendario.
- F2 Maiuscoletto ottone 9,5 px «Ambra · 1 → 5 ott · 4 notti · Confermata» (camera del tratto toccato, date e notti del soggiorno intero, lo stato in inchiostro attenuato).
- F3 Nome in Cormorant 22 px con 🧾 ⭐ davanti; a destra i due cerchi a filo 30 px, cornetta (tel:) e WhatsApp.
- F4 Solo se chi dorme è diverso: «dorme Teresa Bianchi · mamma» in mattone 13 px.
- F5 Righe etichetta/valore col filo #DDD3C2: etichetta maiuscoletto 9,5 px grigio in colonna da 70 px, valore 12,5 px.
- F6 CAMERE «Ambra 2 notti, poi Lena 2» («Ambra» se una sola).
- F7 OSPITI «3 · letto in più dal 3 ott» (o «2», o «3 · letto in più»).
- F8 PREZZO «~~420 €~~ 380 € · sconto 40» (barrato solo se c'è sconto).
- F9 PAGAMENTO «ricevuti 190 € · **restano 190 €** · bonifico, caparra entro mer 30» (restano in mattone, «saldato» in verde).
- F10 ARRIVO «gio 1 ott alle 16:00 · atterra a Malpensa 14:15 · navetta Aldo, prelievo 14:30» (testi di lib/arrivo come la scheda; «orario da chiedere» se manca; con più arrivi il primo futuro).
- F11 NOTE in mattone «nota del cliente · Questa volta: nota della prenotazione» (vuota se non ce ne sono).
- F12 CLIENTE «già ospite 4 volte · da Nida · vuole ricevuta · **1.020 €** con questa» (in mattone lo speso compresa questa prenotazione).
- F13 In fondo «APRI LA SCHEDA» (principale, filo ottone) e «CHIUDI» (tenue).
- F14 «Apri la scheda» o secondo tocco sulla stessa scheda = /scheda/[id] (ricordaPosizione); «Chiudi», tocco fuori o sul velo = chiuso.
- F15 Dati letti con le funzioni della scheda; quel che manca si legge al tocco (una query), «…» nel frattempo.
- F16 Dal Mac lo stesso foglietto, centrato a 620 px.
- F17 Niente documenti.

## 8. Catena in evidenza (telefono 7)

- K1 Primo tocco su una scheda di una catena: i tratti della catena a colore pieno con l'ombra 0 2px 8px rgba(0,0,0,.25), tutte le altre schede attenuate (0,3), i buchi normali; insieme si apre il foglietto.
- K2 Chiudendo il foglietto tutto torna normale.
- K3 Con la ricerca attiva: foglietto al primo tocco (come per le altre).

## 9. Camera tenuta (telefono 8)

- H1 Tocco su una scheda in ottone: foglio dal basso ad altezza fissa.
- H2 Maiuscoletto ottone «Allegra · 3 → 5 ott · camera tenuta».
- H3 Nome in Cormorant 22 px.
- H4 «Paga con bonifico · tenuta fino alle 18:00» (il testo di oggi; la tenuta in ottone scuro, scaduta in mattone).
- H5 «Prezzo proposto **180 €**» con la frase di oggi.
- H6 In colonna, azioni sottolineate: «Libera e fai una prenotazione nuova» (principale), «Libera la camera», «Apri la richiesta di L. Greco», «Chiudi» (tenue).
- H7 Conferme e avvisi di oggi (confermaLibera, avvisoTenuta) nella veste nuova.

## 10. Legenda (telefono 9)

- L1 Foglio dal basso ad altezza fissa, maiuscoletto ottone «LEGENDA».
- L2 Otto righe col quadretto 14 px e il filo #DDD3C2: Prenotazione · Bonifico in attesa · Pagato · Dal sito, da confermare (tratteggiato) · Camera tenuta in opzione (3 ore) · Letto extra in questa prenotazione (filo rosso sotto la scheda) · Letti extra finiti quella notte (riga «🛏 extra» rossa, 2/2) · 🔒 Esclusiva e altri colori scelti in «Nota e colore».
- L3 Riga delle icone: «Icone, prima del nome: ⭐ ottimo · 🧾 ricevuta · 🛏 letto in più · ⇄ cambio camera · 🌐 dal sito · 🔒 esclusiva».
- L4 «CHIUDI» tenue.
- L5 VOCI_LEGENDA aggiornate di conseguenza. Dal 29/09/2026 anche dal Mac niente legenda in riga: «LEGENDA» sotto «Oggi» apre lo stesso foglio, centrato a 620 px; la versione sta solo in fondo al menu del Mac.

## X. Non sono testi della pagina

Le frasi grigie sotto i telefoni («2 settimane: giorni da 60 px…», «La
ricerca di oggi, rivestita…», ecc.), i titoli della striscia e dei telefoni,
la riga «CALENDARIO» della barra dell'app.
