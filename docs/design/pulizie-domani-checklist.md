# Pulizie di domani (e dei giorni dopo) e partenze della settimana in Home — checklist (2 ottobre 2026)

Riferimento approvato da Ania: `pulizie-domani-riferimento.html` (colonna 1 =
la pagina com'è oggi, solo confronto; colonna 2 = Pulizie su domani; colonna 3
= la Home). Lo stile resta quello già pubblicato (Cormorant Garamond e Jost,
colori, link sottolineati in maiuscoletto, nessun tasto pieno).

Esito di ogni voce in fondo alla riga: «fatta» / «non fatta» col motivo.

## D1 · Pulizie, linguetta «Oggi»: muoversi di giorno in giorno
- [x] D1.1 Ai lati della data (Cormorant, come oggi) le frecce «‹» e «›»: 26 px, peso leggero, area di tocco 44 × 44. → **fatta — pulizie-domani-schermate/d1-pulizie-domani-390.png**
- [x] D1.2 «›» va al giorno dopo, «‹» al giorno prima; su oggi «‹» non c'è (mai prima di oggi); fino a 13 giorni avanti. → **fatta — provata nell’anteprima: su oggi «‹» assente, «›» si ferma al 15/10 (13 giorni dopo il 02/10)**
- [x] D1.3 Sotto la data: per domani «DOMANI · 2 DA FARE», per gli altri giorni «SABATO · 1 DA FARE» (o «NIENTE DA FARE»), accanto il link sottolineato «OGGI» che riporta a oggi. Su oggi resta tutto com'è. → **fatta — «DOMANI · 2 DA FARE», «LUNEDÌ · 1 DA FARE», «DOMENICA · NIENTE DA FARE» col link «OGGI»; oggi invariata (pulizie-domani-schermate/d0-pulizie-oggi-390.png)**
- [x] D1.4 Il giorno scelto sta nell'indirizzo (`/pulizie?giorno=2026-10-02`): tasto indietro del telefono e link da fuori funzionano; senza parametro è oggi. → **fatta — «›» scrive ?giorno=… nell’indirizzo, il tasto indietro torna al giorno prima, «Oggi» torna a /pulizie; un giorno passato nell’indirizzo riporta a oggi**
- [x] D1.5 Su un giorno futuro lo STESSO grafico di quel giorno: righello 8–20, una riga per camera, ospite che parte a righe fino a check_out_time (o alle 10:00 col «?»), tempo per pulire in verde con le ore, valigetta all'ora bagagli_alle, filo ottone dell'arrivo con cognome e ora, chi resta in lilla, spazi comuni vuoti, «niente domani» / «niente quel giorno» in grigio chiaro. → **fatta — pulizie-domani-schermate/d1-pulizie-domani-390.png (Allegra: Fontana fino alle 10, 6 ore, valigetta 11:00, filo Serafini 16:00; Ambra in lilla), pulizie-domani-schermate/d2-pulizie-fra-3-giorni-390.png (Serra col «?»)**
- [x] D1.6 Su un giorno futuro NIENTE linea rossa dell'ora. → **fatta — nessuna linea dell’ora sui giorni futuri (verificato nell’anteprima)**
- [x] D1.7 Sotto il grafico le schede delle camere da fare quel giorno, nell'ordine di urgenza di sempre: nome, priorità e tipo, riga degli orari (Parte · Bagagli · Arriva), pillole di cosa preparare. → **fatta — pulizie-domani-schermate/d1-pulizie-domani-390.png**
- [x] D1.8 Schede SOLO DA GUARDARE: niente timer, «Pulita», «Pulita e recuperato», «Rimanda o salta», «Minuti a mano». → **fatta — nessun comando sulle schede dei giorni futuri**
- [x] D1.9 In fondo alla scheda la riga maiuscoletta ottone «DA FARE DOMANI» (o «DA FARE SABATO 3»). → **fatta — «DA FARE DOMANI», «DA FARE LUNEDÌ 5»**
- [x] D1.10 Resta solo «Chiedi orario» se la partenza è «da chiedere». → **fatta — pulizie-domani-schermate/d2-pulizie-fra-3-giorni-390.png (Lena, partenza «da chiedere»)**
- [x] D1.11 Su un giorno futuro non compaiono gli spazi comuni coi timer, «Prossime pulizie» e «Rinvii e salti». → **fatta — sui giorni futuri non ci sono spazi comuni coi timer, «Prossime pulizie», «Rinvii e salti», le pulite di oggi**
- [x] D1.12 Le camere del giorno futuro sono quelle delle regole di sempre (stesse funzioni, nessuna regola nuova); una pulizia di oggi rimasta da fare NON si sposta da sola nel grafico di domani. → **fatta — stessa regola della striscia della Home (pulizieDelGiorno); prova: la partenza di oggi di Amelia non compare domani (lib/pulizieDomani.test.ts)**

## D2 · Home, il riquadro della striscia della settimana
- [x] D2.1 Il tocco su un giorno fa quello di oggi (filo d'ottone sotto il giorno e riquadro sotto la striscia): cambia SOLO il contenuto del riquadro. → **fatta — tocco, filo d’ottone e riquadro come prima**
- [x] D2.2 In testa, maiuscoletto ottone: «VENERDÌ 2 OTTOBRE · 2 CAMERE» (per oggi «OGGI · 3 CAMERE»). → **fatta — pulizie-domani-schermate/h1-home-domani-390.png, pulizie-domani-schermate/h0-home-oggi-390.png**
- [x] D2.3 Una riga per camera da preparare: a sinistra il nome in Cormorant 21 (link a /pulizie?giorno=…); a destra, in Jost 13,5 px, cosa succede, con gli ORARI in Cormorant 17 peso 600. → **fatta — stessi due screenshot**
- [x] D2.4 «parte Elena Esposito 10:00» (ora nera); senza ora «parte Elena Esposito · orario da chiedere». → **fatta — «parte Elena Esposito 10:00», «parte Mario Bellini · orario da chiedere»**
- [x] D2.5 A capo «bagagli Serra 11:00 · arriva Giovanni Serra 16:00» (ore in ottone scuro; ogni pezzo solo se c'è). → **fatta — «bagagli Serafini 11:00 · arriva Bruno Serafini 16:00»**
- [x] D2.6 Per chi resta «Lucia Ferri resta · biancheria della 4ª notte»; per il cambio camera «[Nome] passa in [Camera] ⇄». → **fatta — «Lucia Ferri resta · biancheria della 4ª notte»; «… passa in … ⇄» provato nei test (nessun cambio camera nei 7 giorni dei dati finti)**
- [x] D2.7 Sotto le righe il link sottolineato «VEDI NELLE PULIZIE ›» che apre /pulizie?giorno=[quel giorno]. Il link «Chiudi» resta. → **fatta — «VEDI NELLE PULIZIE ›» e «CHIUDI»**
- [x] D2.8 Didascalia sotto la striscia: «Camere da preparare nei prossimi 7 giorni · tocca un giorno per vedere chi parte e chi arriva». → **fatta — testo nuovo (visibile col riquadro chiuso, nascosta col riquadro aperto: scelta B di Ania, 02/10/2026)**

## D3 · Mac
- [x] D3.1 Tutto uguale anche dal Mac. → **fatta — pulizie-domani-schermate/*-mac.png**

## Consegna
- [x] C.1 Commit piccoli: (1) riferimento e checklist; (2) D1 navigazione e parametro; (3) D1 grafico e schede del giorno futuro; (4) D2. Suite verde prima di ogni push. → **fatta — 4 commit + uno per schermate e riscontro; suite verde prima del push**
- [x] C.2 Riscontro voce per voce con schermate a 390 px: Pulizie oggi (invariata), domani, fra 3 giorni, un giorno senza niente; la Home col riquadro aperto su domani e su oggi; le stesse dal Mac. → **fatta — pulizie-domani-riscontro.md**
