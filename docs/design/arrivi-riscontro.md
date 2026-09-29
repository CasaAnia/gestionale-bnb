# Arrivi «Maison» — riscontro

Riferimento: `docs/design/arrivi-riferimento.html` (approvato da Ania il
29/09/2026). Contratto: `docs/design/arrivi-checklist.md`. Qui ogni voce
della checklist è «fatta» o «non fatta: motivo». Nessuna voce aggiunta.

Commit: e29b92d (riferimento, con gli undici segni dei commenti CSS persi nel
copia-incolla: senza, gli stili del telefono restavano commentati) · 87c4f9f
(1 checklist) · 8630c1b (2 pezzi del nastro condivisi col Calendario) ·
2f76d88 (3 parte pura: colori, orario, riga dell'arrivo) · a66076f (4 legenda,
mesi, WhatsApp, FoglioArrivo con le opzioni, Mac) · 42e7296 (5 la pagina) ·
eba953e (6 anteprima finta e schermate) · 3f9040c (prove sul sorgente) ·
questo riscontro. Pubblicato: Vercel «success» su 3f9040c.

Schermate a 390 px (anteprima finta, dati sintetici): `arrivi-390-pagina.png`
(la pagina coi tre colori, gli arrivi passati, il cambio camera e il box),
`arrivi-390-foglio.png` (il foglio «Arrivo e navetta» con lo storico).

Suite 1858/1858 verde (9 test nuovi in `lib/arriviMaison.test.ts`; le guardie
del Calendario e dell'arrivo seguono i pezzi spostati nei componenti
condivisi), TypeScript, lint dei file toccati e build puliti.

## Scelte dove riferimento e incarico non coincidono (o dove ho dovuto scegliere)

- **Richieste dal sito da confermare**: oggi gli Arrivi leggevano solo le prenotazioni confermate e concluse. L'incarico descrive la scheda tratteggiata e «· dal sito 🌐» (punti 4a e 5) e la legenda la elenca: per farla vedere gli Arrivi disegnano anche le richieste dal sito in attesa. È l'unico comportamento in più oltre al punto 10: **confermato da Ania il 29/09/2026** («sì, va bene»).
- **I buchi liberi** guardano tutte le prenotazioni non annullate della camera (anche quelle in attesa che negli Arrivi non si disegnano), così un «+» non cade mai su una camera occupata. Le camere tenute da una proposta negli Arrivi non si leggono (come oggi): lì un buco può comparire sopra una camera tenuta.
- **Riga (c), il verbo del luogo**: il riferimento alterna («in treno a Rogoredo» ma «a Centrale», «atterra a Malpensa» ma «a Linate»). Regola unica: aeroporto «atterra a», stazione «in treno a», altro luogo «a». Quindi «in treno a Centrale 11:30».
- **Variabili `--cal-*`**: il Calendario non ne ha, i suoi colori stanno in `TINTE_SCHEDA` (`lib/calendarioMobile`). Quelli degli Arrivi sono `TINTE_ARRIVO` lì accanto, costruiti dagli stessi fondi e fili.
- **Box cambi camera**: «(oggi)» / «(domani)» come oggi (incarico), non «(mer 30)» del disegno.
- **Scheda toccata**: contorno verde 2 px (quello della ricerca del Calendario), non ottone come nel disegno.
- **Il modulo nel foglio** è quello Maison della Home (chip più grandi del disegno, che li schizzava a 11 px): il foglio resta a 752 px e il corpo scorre dentro.

## 0. Regole comuni

- G1 fatta. Cormorant per camere, periodo, nomi e orario; Figtree/Jost come il Calendario.
- G2 fatta. Righello, fili, corsie, buchi e schede sono ora componenti condivisi (`components/calendario/Nastro.tsx`) usati da Calendario e Arrivi; legenda, riga dei mesi, pillola, FoglioMaison, FoglioArrivo riusati con opzioni.
- G3 fatta (vedi sopra: `TINTE_ARRIVO` accanto a `TINTE_SCHEDA`).
- G4 fatta. Pieni solo: voce accesa della pillola, mese acceso, chip accesi, «Salva».
- G5 fatta. Azioni in maiuscoletto sottolineato (`mz-lnk`), anche «Chiedi orario» e «Apri chat» (BottoniOrario con l'opzione `maison`).
- G6 fatta, con l'eccezione delle richieste dal sito (da confermare).

## 1. Testa

- T1 fatta. T2 fatta (CampoRicerca `maison`). T3 fatta (stessa logica, scorre al primo trovato). T4 fatta. T5 fatta. T6 fatta (contorno verde, 0,35).

## 2. Riga di navigazione

- N1 fatta. N2 fatta. N3 fatta (`ca_calendario_modo`). N4 fatta (provato: «28 set – 11 ott» → «5 – 18 ott»; a Mese «Ottobre» → «Novembre»). N5 fatta.

## 3. Il nastro

- S1 fatta. S2 fatta. S3 fatta. S4 fatta. S5 fatta (niente riga extra).

## 4. Le schede

- K1 fatta. K2 fatta. K3 fatta (Cormorant 700 vero, più pesante: richiesta di Ania del 29/09/2026 dopo la prima pubblicazione; caricati i pesi 600 e 700, prima non c'erano; il «?» in mattone ha lo stesso peso). K4 fatta. K5 fatta (verbo con la regola unica, vedi sopra). K6 fatta. K7 fatta. K8 fatta.

## 5. Il colore

- C1 fatta. C2 fatta. C3 fatta (anche con l'orario al luogo ma senza stima in struttura: «?» e blu, come dice «orario in struttura»). C4 fatta (con la scelta sopra). C5 fatta. C6 fatta (la catena resta piena mentre il foglio è aperto). C7 fatta. C8 fatta.

## 6. Sotto il nastro

- B1 fatta. B2 fatta. B3 fatta. B4 fatta.

## 7. Legenda

- L1 fatta. L2 fatta. L3 fatta. L4 fatta.

## 8. Il foglio «Arrivo e navetta»

- F1 fatta (FoglioArrivo con le opzioni, 752 px). F2 fatta. F3 fatta. F4 fatta (segue la bozza: provato Aldo → Massimo). F5 fatta. F6 fatta. F7 fatta. F8 fatta. F9 fatta (stesso salvataggio della scheda: scrive, rilegge, chiude solo con «ok», conferma «Salvato»). F10 fatta. F11 fatta.

## 9. Dal Mac

- M1 fatta (legenda in riga). M2 fatta: i fogli Maison dal Mac finivano con l'angolo al centro invece che centrati (l'animazione d'entrata annullava la centratura, anche nel Calendario): corretto per tutti.

## 10. Novità

- 10a–10f fatte.

## Prova in produzione (29/09/2026, dati veri)

- Arrivi di oggi a 90 giorni: 31 schede — 1 verde, 5 ottone, 25 blu; nessuna richiesta dal sito in attesa in questo momento; nessun cambio camera oggi o domani (niente box).
- Tre stati confrontati con quello che dice la scheda: **Gabriella Porpiglia** verde («15:00 · atterra a Linate 14:20 · navetta Alberto», già arrivata, attenuata); **Laurino Silvana** ottone («21:00 · arrivo autonomo»); **Stefania Di Giuli** blu («12:00 · navetta da definire»). Catena di Dario Barone: tratto che arriva «cambio camera · da Allegra», ottone come il primo tratto.
- Foglio di Stefania Di Giuli: «ARRIVO E NAVETTA · ALLEGRA · MAR 6 OTT», riassunto «In struttura alle 12:00 · Navetta: Da definire», azioni Chiedi orario · Apri chat · Apri prenotazione. «Salva» senza cambiare nulla (riscrive gli stessi valori): conferma «Salvato · Arrivo di Stefania Di Giuli», foglio chiuso, scheda uguale a prima.
