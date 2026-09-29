# Scheda prenotazione «Maison» — riscontro

Riferimento: `docs/design/scheda-riferimento.html` (approvato da Ania il
28/09/2026). Contratto: `docs/design/scheda-checklist.md`. Qui ogni voce
della checklist è «fatta» o «non fatta: motivo»; le note dicono dove il
risultato si scosta dal disegno e perché. Nessuna voce aggiunta.

Commit: 0b465dc (riferimento tale e quale) · 4cb9674 (ripristinati i cinque
`*/` dei commenti CSS persi nel copia-incolla: senza, gli stili delle
schermate restavano commentati) · 6a03d25 (checklist) · 7474fdc (pezzi 1–6:
barra, testata, linguette, Oggi, Soggiorno, Conto, Messaggi, Cliente) ·
5d4da40 (pezzo 7: fogli) · questo riscontro (pezzo 8). I pezzi 1–6 sono in
un commit solo perché la pagina che li monta è una sola: diviso, ogni commit
intermedio non si sarebbe compilato.

Schermate a 390 px (anteprima finta, dati sintetici):
`scheda-390-oggi-arrivo-complicato.png`, `scheda-390-soggiorno-due-cambi.png`,
`scheda-390-messaggi.png`.

Suite 1831/1831 verde (13 test nuovi in `lib/schedaMaison.test.ts`, più
quelli aggiornati), TypeScript e lint puliti sui file toccati.

## Scelte prese su due punti in cui disegno e incarico non coincidono

- **Arrivo in «In breve» su una o tre righe (O3/O4).** Il telefono 1 mostra
  «oggi alle 15:10 · navetta Massimo» su una riga per un treno a Milano
  Centrale; l'incarico dice tre righe con un luogo esterno. Nel gestionale,
  con un luogo esterno l'ora in struttura è SEMPRE la stima di Ania (col
  «circa», lib/arrivo): il caso «Centrale, in struttura alle 15:10 esatte»
  non si può salvare. Quindi vale l'incarico: tre righe con un luogo esterno,
  una riga quando arriva direttamente in struttura o non si sa ancora.
- **Puntini (L5).** Il riferimento li mette su Oggi e Conto; l'incarico dice
  pagamento → Conto, documento → Cliente, arrivo e cambio camera → Soggiorno,
  richiesta → Oggi. Vale l'incarico; tutto quello che non è in elenco
  (sovrapposizioni, letti oltre il pool) → Oggi.

Ho provato a chiedere queste due cose con i bottoni, ma la domanda è stata
chiusa senza risposta: se Ania preferisce l'altra strada, è una riga per
ciascuna in `lib/schedaMaison.ts`.

## 0. Regole comuni
- G1 fatta.
- G2 fatta (bianco e #E8E3DA sotto lg, crema sopra; `:root:has(.sch)`).
- G3 fatta.
- G4 fatta.
- G5 fatta.
- G6 fatta.

## 1. Barra
- B1 fatta. Nota: la scritta è «‹ Prenotazioni» anche arrivando dalla scheda
  del cliente (`?da=cliente`), come nel disegno; il tocco torna comunque alla
  pagina di prima (o a /clienti/[id]).
- B2 fatta («Confermata» si scrive sempre, come nel riferimento).
- B3 fatta.

## 2. Testata e note
- T1 fatta. Nota: con la riga «dorme …» il nome è solo quello di chi ha
  prenotato (come nel disegno); senza, resta `nomeConAltri` come oggi.
- T2 fatta.
- T3 fatta.
- T4 fatta (compare solo con la colonna 0061 e la spunta accesa).
- T5 fatta. Nota: il numero delle volte e il nome dopo «da» restano in
  grassetto, come deciso da Ania il 18/09/2026.
- T6 fatta.
- T7 fatta.

## 3. Linguette
- L1 fatta. L2 fatta. L3 fatta. L4 fatta. L5 fatta (vedi sopra). L6 fatta
  (provato: #arrivo → Soggiorno, #conto, #cliente, #messaggi, indirizzo
  sconosciuto → Oggi, anche dopo un ricaricamento).

## 4. Oggi
- O1 fatta. O2 fatta. O3 fatta (vedi sopra). O4 fatta. O5 fatta. O6 fatta.
- O7 fatta.
- O8 fatta.
- O9 fatta come si può: le due note una dopo l'altra, su una riga, tagliate
  con «…» se non ci stanno. Un «riassunto» come nel disegno («camera
  silenziosa · marito in Humanitas») richiederebbe di riscrivere le parole
  di Ania, e non l'ho inventato.
- O10 fatta (titoli e dettagli di sempre, da lib/schedaPrenotazione: per
  esempio «Nessun pagamento registrato / Da incassare 470 €», non «Registra
  la caparra» del disegno; la prima azione piena, le altre tenui). Il cambio
  camera di oggi/domani porta a «Calendario» sul giorno.
- O11 fatta. O12 fatta. O13 fatta.

## 5. Soggiorno
- S1 fatta. S2 fatta. S3 fatta. S4 fatta. S5 fatta. S6 fatta. Nota: la riga
  d'ottone riassuntiva della Nuova prenotazione («1 cambio camera · letto
  in più 1 notte») qui è spenta: il riferimento non la mostra.
- S7 fatta. S8 fatta. S9 fatta.
- S10 fatta. Nota: l'importo è quello salvato del tratto (con lo sconto già
  ripartito), come oggi: può avere i centesimi.

## 6. Conto
- C1 fatta (il nome del modo è quello di sempre: «Caparra del 50%»).
- C2 fatta. C3 fatta. C4 fatta. C5 fatta. C6 fatta («acconto» finché i
  pagamenti non arrivano al totale, poi «saldo completo»; la nota del
  pagamento sotto, se c'è). C7 fatta. C8 fatta. C9 fatta. C10 fatta.
- C11 fatta. C12 fatta.

## 7. Messaggi
- M1 fatta. M2 fatta. M3 fatta. Nota: cambia solo il numero; i testi restano
  quelli di sempre e cominciano con il nome di chi ha prenotato («Gentile
  Maria,» anche scrivendo a Teresa). Deciso da Ania il 29/09/2026: resta
  così, il saluto è sempre per chi ha prenotato.
- M4 fatta. M5 fatta. M6 fatta. M7 fatta (ordine provato da un test). M8
  fatta. M9 fatta (senza nessun numero, come oggi, solo la frase).
- M10 fatta in parte. **Non fatto: «· a [Nome]» dopo «Conferma inviata».**
  Motivo: il registro dei messaggi (`booking_whatsapp_log`) non ha una
  colonna per il destinatario, e oggi la scheda non vi scrive nulla quando
  si manda un messaggio. Servirebbe una migrazione: da autorizzare.
- M11 fatta.

## 8. Cliente
- K1 fatta. K2 fatta. K3 fatta. K4 fatta. K5 fatta. K6 fatta (il foglio fa
  quello che faceva «Con lei»: persone, chi è, telefono; la spunta «Non è
  lei a dormire qui» si mette dalla Nuova prenotazione, come chiesto).
- K7 fatta (camere con ⇄, anno davanti alle date quando è un altro anno).
- K8 fatta. K9 fatta.

## 9. Fogli
- F1 fatta.
- F2 fatta.
- F3 fatta (i moduli di sempre, coi colori e i campi Maison).
- F4 fatta: altezze misurate a 390 px nel caso più lungo (`lib/altezzeFogli.ts`);
  oltre il 92% dello schermo il contenuto scorre dentro. «Cambia cliente»
  con tanti risultati scorre dentro la sua altezza.
- F5 fatta per Nota e colore, Chi dorme in camera, Sconto, Come paga, Dati
  della cliente, Cambia cliente, Provenienza, Togli pagamento, Togli camera
  (provata con un salvataggio nel finto: spunta, poi il foglio si chiude da
  solo). Non aggiunta dove c'era già una conferma diversa, per non cambiare
  il comportamento: Annulla (dice «✓ Prenotazione annullata» e propone
  «problematica»), Mancato arrivo, e i fogli delle notti (Cambia date,
  Cambio camera, la notte, Prezzo del soggiorno), che chiudono e mostrano il
  riquadro col conto e «Ok, ho capito».
- F6 fatta.

## 10. Stati e Mac
- E1 fatta. E2 fatta (vista a 1280 px).

## Prova con prenotazioni vere di produzione (29/09/2026, sola lettura)

Lette con la chiave di servizio, nessuna scrittura; iniziali al posto dei nomi.

- **Con navetta** (G. C., Allegra, arriva oggi, 2 notti): linguette
  «29 set → 1 ott» e «resta 160 €»; In breve · Arrivo su tre righe: «oggi,
  orario in struttura da definire» / «atterra a Linate alle 09:55» /
  «navetta Massimo · prelievo a Linate»; Camera «Allegra»; Conto «160 €»;
  Prossimi giorni «gio 1 · parte — saldo 160 €». Soggiorno: «Oggi, orario da
  definire», «Arrivo a Linate — alle 09:55 · in aereo», «Navetta — Massimo ·
  prelievo a Linate». Conto: 160 € · 0 € · «Paga tutto quando arriva,
  contanti o bonifico».
- **Con cambio camera** (R. M., 1 → 24 set, già partita): nessuna
  prenotazione attiva ha oggi un cambio camera, quindi la più recente.
  Linguette «1 → 24 set» e «saldato»; In breve · Camera «Ambra 6 notti ·
  Amelia 4 · Ambra 11 · Lena 2», Conto «saldato» in verde; Soggiorno ·
  Camere · 3 cambi: «Ambra», «⇄ Amelia», «⇄ Ambra», «⇄ Lena», ognuna con
  «… va pronta prima del cambio». Conto 1.610 € · 1.610 € · 0 €.
- In produzione la colonna della spunta (0061) non c'è ancora: la riga
  «dorme …» non compare da nessuna parte e «A chi scrivi» ha una sola
  pastiglia. È il comportamento voluto finché la 0061 non viene applicata.
