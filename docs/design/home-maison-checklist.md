# Home «Maison» — checklist del riferimento

Fonte: `docs/design/home-maison-riferimento.html` (approvato da Ania il 28/09/2026).
Qui c'è **solo quello che il riferimento mostra davvero** sullo schermo: le
colonne «Quello che vedi aprendo», «La pagina intera», la foto scelta (B), i
tre fogli «Arrivo e navetta», i quattro fogli delle pulizie, la conferma di
salvataggio scelta (B) e i tre pannelli dei pagamenti. Le varianti non scelte
(foto A, C, D, E; conferme A, C, D, E) e le bozze definite nel file ma mai
disegnate (M, R, C, J, S, M2, P2, P5) sono elencate in fondo solo per dire
che non si fanno.

Ogni voce ha un codice: il riscontro finale (`home-maison-riscontro.md`) la
riprende con «fatta» o «non fatta: motivo».

## 0. Regole comuni

- G1 Titoli, nomi, numeri e orari in Cormorant Garamond (300/400/500); testo in Jost (300/400/500).
- G2 Etichette di sezione in maiuscoletto Jost 9,5 px, spaziatura 0,24 em, ottone #A8894F, peso 500, con filo #E1D9CB che continua a destra.
- G3 Fondo #F6F2EA, testo #241F1A, secondario #8A8072, fili #E1D9CB, ottone #A8894F, mattone #8C3B2E (solo note cliente, letto aggiuntivo, ritardi, importi da incassare).
- G4 Nessun riquadro, nessuna ombra, nessuna pillola piena nella Home.
- G5 Azioni = parole maiuscolette 10 px, spaziatura 0,18 em, peso 500, filo ottone sotto (`lnk`); variante tenue grigia con filo #E1D9CB (`lnk q`); area di tocco 44 px.
- G6 Fogli dal basso: fondo #F6F2EA, filo #DDD3C2 in alto, maniglia 36×3 #DDD3C2, velo rgba(36,31,26,.45), altezza fissa sul contenuto più lungo.
- G7 Nei fogli: titolo Cormorant 24/500, sotto il sottotitolo in maiuscoletto ottone 10 px; frasi d'aiuto 11,5 px grigio 300; etichette 9,5 px maiuscolette grigie; campi a filo (#C9BFA8) in Cormorant; scelte «a filo» (parola con filo ottone sotto la scelta); chip tondi bianchi col filo #C9BFA8, scelto pieno #241F1A con contatore ottone.
- G8 Azione principale dei fogli: unico elemento pieno, maiuscoletto 10,5 px chiaro su #241F1A, angoli vivi; accanto «Annulla» come `lnk q`.

## 1. Striscia in alto

- S1 Foto `public/home/striscia.jpg` (Lena, asciugamani), alta 118 px, a tutta larghezza.
- S2 Velatura scura in basso (gradiente fino a rgba(36,31,26,.66)).
- S3 Data in maiuscoletto avorio #E7D6AE: «Lunedì 28 settembre 2026».
- S4 «Buongiorno, Ania» Cormorant 300 30 px, «Ania» corsivo 400.
- S5 In alto a destra cerchio sottile ⌕ (ricerca), 28 px, filo bianco al 60 %.
- S6 Accanto cerchio sottile «+» → /nuova-prenotazione.

## 2. Richieste

- R1 Riga «🌐 N richieste da gestire» (N in 500), segno «−» aperta / «+» chiusa a destra, filo #E1D9CB sotto.
- R2 Si apre e si chiude come il `details` di oggi.
- R3 Voce: etichetta «Dal sito · da confermare» (ottone 8,5 px).
- R4 Nome in Cormorant 19/500.
- R5 Date «7 ottobre 2026 – 10 ottobre 2026».
- R6 «Qualsiasi camera · 2 ospiti» (camera · ospiti).
- R7 Nota del cliente in mattone.
- R8 Azione «Apri richiesta».
- R9 Sotto, le eccezioni di tipo richiesta di «Da controllare», con «Rimanda».

## 3. Numeri

- N1 Quattro numeri Cormorant 300 28 px con etichetta maiuscoletta 8,5 px grigia.
- N2 «Arrivi oggi» → /arrivi.
- N3 «Partenze oggi» → /arrivi.
- N4 «Occupate» «4 su 4» con «su 4» piccolo grigio → Calendario.
- N5 «Da incassare €» = somma dei residui di Da incassare → scorre alla sezione.
- N6 Filo sottile verticale fra un numero e l'altro.
- N7 Fra due fili ottone (testo dell'incarico).

## 4. Striscia della settimana

- W1 Sette caselle visibili al telefono (14 sul Mac), stessa logica di oggi.
- W2 In ogni casella: giorno 9,5 px («Oggi» in inchiostro 500, gli altri «mar 29»), numero Cormorant 22/400.
- W3 «✓» e «—» attenuati (#C9C0B0).
- W4 Frecce ⇄ ottone: la prima SOTTO il numero, la seconda SOPRA solo con due cambi.
- W5 Filo ottone sotto la striscia; divisorio ottone fra le settimane.
- W6 Didascalia «Camere da preparare nei prossimi 7 giorni».
- W7 Tocco su un giorno: filo ottone sotto il giorno (nessuno sfondo), niente navigazione.
- W8 Riquadro sotto la striscia su #EFE9DD con bordo #DDD3C2.
- W9 Prima riga «N camere da preparare · N cambio camera ⇄» e «Chiudi».
- W10 Per ogni camera: nome in Cormorant, accanto piccolo il motivo (partenza in giornata / pulizia rimasta da completare / cambio biancheria / ⇄ cambio camera in ottone con chi va dove).
- W11 Sotto «Prossimo arrivo: HH:MM» con l'orario in grassetto, SOLO se l'orario esiste.
- W12 Tocco sul nome della camera → /pulizie?giorno=….
- W13 La data non si ripete nel riquadro.

## 5. La giornata

- D1 Etichetta «La giornata» con «· N arrivi · N partenze» piccolo grigio.
- D2 Arrivo: nome (nomeConAltri) Cormorant 18/500 sottolineato ottone, link a /scheda/[id].
- D3 Camera in maiuscoletto ottone 10 px accanto.
- D4 «+ Letto aggiuntivo» in mattone.
- D5 Ora in struttura Cormorant 300 26 px, «circa» piccolo solo se stima; «Da definire» se manca.
- D6 Matita ✎ che apre il foglio «Arrivo e navetta».
- D7 A destra «WhatsApp ▾» (icona a filo) con menu «Apri chat» e «Chiedi orario»; senza telefono la frase «Telefono mancante…».
- D8 Riga grigia sotto (arrivoInHome.sotto).
- D9 Righe trasporto con icona a filo ottone (aereo/treno/luogo/auto), testo e sotto-testo di arrivoInHome.
- D10 «Arrivo autonomo / Navetta non richiesta» senza icona.
- D11 Nota del cliente in mattone in fondo.
- D12 Partenze di oggi SOLO con residuo: «CHECK-OUT» mattone · nome Cormorant · «— Camera» · importo mattone a destra.
- D13 Sotto «Bonifico atteso · Segna pagato».
- D14 Partenze già saldate non compaiono.
- D15 Cambi camera di oggi: «⇄ CAMBIO» ottone · nome · «— da → a».
- D16 Il blocco «Oggi / Domani» separato sparisce.

## 6. Arrivi di domani

- T1 Etichetta grigia «Arrivi di domani · N arrivi».
- T2 Stessi riquadri di D2–D11.

## 7. Pulizie di oggi

- P1 Etichetta «Pulizie di oggi · N da fare · in ordine di arrivo».
- P2 Nome camera Cormorant 20/500 + «· N ospiti».
- P3 Fine soggiorno / cambio camera: «PROSSIMO ARRIVO» maiuscoletto + «Nome · oggi/domani/data · orario» (orario solo se c'è).
- P4 Cambio biancheria: «CAMBIO BIANCHERIA» + «Nome, Nª notte · resta fino al [data]», senza prossimo arrivo.
- P5 Descrizione grigia (lib/pulizieOggi).
- P6 «in ritardo di N giorni» in mattone.
- P7 Timer compatto: cifre Cormorant 18, «Avvia» / «Pausa» / «Riprendi».
- P8 Avviso «Un altro timer è in corso: … Metti in pausa», con «Avvia» attenuato.
- P9 Azioni «Pulita» (ottone), «Pulita e recuperato», «Rimanda o salta» (grigie).
- P10 Pulizie con arrivo lo stesso giorno non più automatiche.
- P11 Riga «Area comune, corridoio e biancheria» con cifre 00:00 e «Avvia».
- P12 Link «Tempi fuori dalle camere ↗».

## 8. Da controllare

- C1 Etichetta «Da controllare · N cose · conteggi per tipo».
- C2 Voce: tipo in ottone 8,5 px, titolo Cormorant 17/500, motivo grigio, UNA azione sottolineata.
- C3 Arrivi esclusi; richieste in cima (sezione 2).

## 9. Da incassare e Incassati oggi

- I1 Etichetta «Da incassare · N · totale €».
- I2 Voce: etichetta ottone con stato e come paga («Partita oggi · bonifico», «In casa · paga all’arrivo»).
- I3 Nome (link alla scheda, sottolineato ottone) · camere · date.
- I4 «Totale X € · ricevuti Y € (acconto del …) · resta Z €» con Z in mattone.
- I5 «Registra pagamento» e, con il telefono, «Apri chat» (icona WhatsApp).
- I6 «Incassati oggi · N · totale €»: nome — metodo · saldo completo/acconto, importo.

## 10. Il mese e Vai a

- M1 «Il mese · settembre»: griglia a due colonne, sei voci (Ricavi per soggiorno, Incassi, Spese, Saldo di cassa, Occupazione, Tariffa media), cifre Cormorant 16/500.
- M2 Sotto, le descrizioni in una riga grigia.
- M3 «Vai a» come oggi (Prenotazioni, Statistiche, Spese B&B, Spese Famiglia, Impostazioni e notifiche) con freccia ottone.

## 11. Barra in basso

- B1 Cinque voci: Oggi, Calendario, Richieste, Arrivi, Menu; icone a filo 20 px (tratto 1,1), etichette maiuscolette 8,5 px.
- B2 Voce attiva in inchiostro, le altre grigie.
- B3 Bollino di Richieste: puntino ottone.
- B4 Menu apre un foglio con Prenotazioni, Clienti, Pulizie, Spese B&B, Spese Famiglia, Statistiche, Impostazioni e notifiche.
- B5 Su Mac la barra laterale resta com'è.

## 12. Foglio «Arrivo e navetta» (tre telefoni)

- A1 Foglio dal basso, UNA altezza fissa (660 px nel riferimento) per i tre tipi; Annulla/Salva sempre in fondo.
- A2 Titolo = nome; sottotitolo «Camera · Arrivo e navetta».
- A3 Frase «Inserisci i dettagli dell’arrivo dell’ospite».
- A4 «Tipo di arrivo» a filo: In struttura | Arrivo a… | Da definire.
- A5 In struttura: «Orario» a filo (Ora precisa | Fascia oraria) con una casella, o due («Dalle»/«Alle»); navetta; frase «Arriva da solo: nessun autista e nessun prelievo da chiedere.» (con navetta non richiesta).
- A6 Arrivo a…: «Luogo» a chip (Linate, Rogoredo, Centrale, Malpensa, Orio al Serio, San Donato, Altro luogo…), «Qual è il luogo» con Altro; orario nel luogo («A Linate»); «In struttura · stima facoltativa» con «Una tua stima, modificabile».
- A7 «Navetta» a filo: Non richiesta | Da definire | Da assegnare.
- A8 «Autista» a chip: Massimo, Aldo, Alberto, Matteo.
- A9 «Prelievo · facoltativo».
- A10 Da definire: frase «Nessun orario da inserire: in Home resta «Da definire» finché non lo saprai.», navetta, frase «Navetta da chiedere all’ospite: in Home compare «Navetta da definire · Da chiedere all’ospite».».
- A11 «Annulla» (tenue) e «Salva» (pieno).

## 13. Fogli delle pulizie

- F1 «Pulita e recuperato»: titolo camera Cormorant, sottotitolo «Tipo intervento · Pulita e recuperato».
- F2 Frase «Dotazione del soggiorno che stai pulendo. Questi numeri resteranno nel registro.»
- F3 «Fatta il» a filo.
- F4 Matrimoniali / Singoli / Ospiti a filo, cifre Cormorant 20.
- F5 «Federe sul matrimoniale» 2 federe | 4 federe a filo.
- F6 «Recuperato · Lenzuola»: chip Federa, Sotto, Sopra.
- F7 «Recuperato · Asciugamani»: chip Telo doccia, Viso, Mani, Tappetino doccia, Tappeto bagno; contatore ottone sul chip scelto.
- F8 «Minuti effettivi · facoltativi».
- F9 In fondo «N pezzi recuperati», «Annulla», «Conferma pulizia» pieno.
- F10 «Rimanda o salta» si apre sotto la voce; il comando diventa «Rimanda o salta ⌃» in inchiostro.
- F11 Selettore «Rimanda | Salta» a filo.
- F12 «Rimanda al» / «Salta questa · prossima il» con data a filo a destra.
- F13 «Nessun altro cambio prima della partenza del gg/mm/aaaa.» quando vale.
- F14 «Annulla» e «Conferma» pieno.
- F15 Timer: «Pausa» col timer in corso, «Riprendi» in pausa, «Avvia» attenuato se un altro timer gira, con l'avviso e «Metti in pausa».
- F16 Riquadro della striscia (vedi W7–W13).

## 14. Conferma di salvataggio (B)

- K1 Il foglio si sbianca (velo #F6F2EA all’85 %).
- K2 Al centro cerchio a filo ottone 54 px con la spunta.
- K3 «Salvato» in Cormorant 26.
- K4 In piccolo cosa e l'ora («Arrivo di Paolo Conti · 11:42») e «il foglio si chiude da solo fra un istante».
- K5 Chiusura da sola dopo 1,2 s; un solo componente per Arrivo, Pulizia, Pagamento, Rimanda/Salta, Segna pagato.

## 15. Pagamenti

- Y1 Home «Da incassare» come sezione 9.
- Y2 Home «Incassati oggi» come I6.
- Y3 Home «Il mese» con la riga delle descrizioni.
- Y4 Foglio pagamento: titolo nome; sottotitolo «camera · date · Aggiungi pagamento».
- Y5 «Resta da incassare» e cifra Cormorant 300 34 px.
- Y6 «Tipo di pagamento»: Saldo completo | Altro importo a filo, frase sotto.
- Y7 «Quanto · €» e «Quando» a filo, affiancati.
- Y8 «Come»: chip Contanti, Bonifico (solo due).
- Y9 «Nota · può restare vuota».
- Y10 «Dopo il pagamento resta … · Il conto sarà saldato.» / «Il pagamento coprirà una parte del saldo.»
- Y11 «Annulla» e «Salva il pagamento» pieno.
- Y12 Conto: Totale soggiorno · Già ricevuto · Come paga a filo.
- Y13 «Resta da incassare» Cormorant 300 34 px in mattone.
- Y14 «Aggiungi pagamento» e «Cambia come paga».
- Y15 «Pagamenti registrati»: «20 settembre · acconto · bonifico» con importo.
- Y16 Metodi ridotti a due ovunque si sceglie (i pagamenti storici con altri metodi restano leggibili).

## 16. Stati

- Z1 «Caricamento…» nel carattere nuovo.
- Z2 AvvisoAzione («Non salvato, riprova», Riprova) nel carattere nuovo.
- Z3 Desktop: niente zoom 1,2 solo sulla Home, contenuto a 768 px centrato.

## Non si fanno (varianti non scelte o bozze non disegnate)

- X1 Foto A, C, D, E della striscia (scelta B).
- X2 Conferme A, C, D, E (scelta B).
- X3 Bozze M, R, C, J, S, M2, P2, P5 definite nel file ma non mostrate.
