# Calendario «Maison» — riscontro

Riferimento: `docs/design/calendario-riferimento.html` (approvato da Ania il
29/09/2026). Contratto: `docs/design/calendario-checklist.md`. Qui ogni voce
della checklist è «fatta» o «non fatta: motivo». Nessuna voce aggiunta.

Commit: 68de3dd (riferimento tale e quale) · 8a2c166 (ripristinati i nove
segni dei commenti CSS persi nel copia-incolla: senza, gli stili del
calendario nel riferimento restavano commentati) · 7551f1c (checklist) ·
12587fb (2 testa) · 5402bef (3 navigazione) · 013825e (4 nastro) · 3c28796
(5 foglietto) · a869519 (6 Oggi, Legenda, camera tenuta) · 9c02c96 (7 Mac e
ritocchi) · 5e462bc (nomi delle camere sopra le schede evidenziate,
schermate) · questo riscontro. Pubblicato: Vercel «success» su 5e462bc.

Schermate a 390 px (anteprima finta, dati sintetici): `calendario-390-2settimane.png`,
`calendario-390-mese.png`, `calendario-390-ricerca.png` (3 di 5),
`calendario-390-foglietto.png` (catena con cambio camera e letto in più).

Suite 1847/1847 verde (16 test nuovi in `lib/calendarioMaison.test.ts`, più
quelli aggiornati: frecce, legenda, letti, indirizzi), TypeScript, lint e
build puliti.

## Scelte dove riferimento e incarico non coincidono

- **Corsie 92 px** (punto 3 e CSS finale del riferimento) e non 80 (punto 10).
- **Dal sito**: bordo tratteggiato e testo verde #2D6A4F (incarico), non ottone (CSS del riferimento).
- **Riga (c) delle catene**: «2 ospiti · poi Lena · da incassare» — lo stato resta anche sulle catene (regola del punto 3); il riferimento lo omette in un esempio.
- **Prezzo nel foglietto**: «sconto 40 €» con l'euro, come gli altri importi.
- **Il «+» dei buchi** centrato (incarico); le date in alto a sinistra come nel riferimento.

## 0. Regole comuni
- G1 fatta (Cormorant per camere, nomi, periodo; Figtree dal telefono, Jost dal Mac; i fogli restano in Jost come tutti i fogli Maison).
- G2 fatta (`:root:has(.cal)`: bianco sotto lg, crema dal Mac).
- G3 fatta.
- G4 fatta (nessun `mz-cta` né `ed-pillola` nel calendario; anche la conferma «Libera la camera» è una parola sottolineata — test).
- G5 fatta.
- G6 fatta (`TINTE_SCHEDA`, `ROSSO_LETTO`… in `lib/calendarioMobile.ts`).

## 1. Testa
- T1 fatta (TestaPagina di sempre; lo spazio del titolo nascosto resta, come in Arrivi e Richieste).
- T2 fatta · T3 fatta · T4 fatta (stessa `matchPrenotazione`).

## 2. Ricerca
- R1–R9 fatte.
- R10 fatta (contorno verde 2 px sul risultato corrente, gli altri risultati pieni come oggi, il resto a 0,35, buchi normali).
- R11 fatta. Prima il calendario tornava a oggi solo se la ricerca aveva allargato l'intervallo (in produzione, cercando «macauda» e svuotando, restava su giugno). Ania ha scelto: con ✕ torna SEMPRE a oggi (29/09/2026, dopo il riscontro).
- R12 fatta.

## 3. Richieste dal sito
- W1–W6 fatte («Apri» è `mz-lnk`, filo ottone sotto: sulla pagina il sottolineato del testo è spento, come nelle altre pagine Maison).

## 4. Navigazione
- N1–N5 fatte · N6 fatta (7 giorni; «Una settimana prima/dopo»; test).

## 5. Il nastro
- S1 fatta · S2 fatta · S3 fatta (92) · S4 fatta · S5–S9 fatte.
- S10 fatta · S11 fatta · S12 fatta (filo 3 px `inset`, uno per 1 o 2 letti; via righe diagonali e colore-letto).
  **Conseguenza da sapere**: prima una barra si colorava di verde notte per notte fin dove arrivavano gli acconti; una scheda ha un colore solo, quindi resta blu finché i soldi non coprono tutte le notti, poi diventa verde. Quanto resta si legge nel foglietto.
- S13 fatta. I buchi dicono le date vere anche quando cominciano fuori vista; oltre sei mesi portano l'anno. Il testo di schede e buchi lunghi resta in vista scorrendo.
- S14 fatta (tocco sul buco: arrivo = inizio del buco, o il primo giorno in vista se l'inizio è fuori a sinistra; giorno libero fuori dai buchi: quel giorno).
- S15–S17 fatte · S18–S20 fatte · S21 fatta (60/40, girato e Mac come oggi) · S22 fatta · S23 fatta (schede 72 px).
- COLORI_CAMBIO non si usa più nel calendario; resta in uso negli Arrivi e nel calendario delle Richieste.

## 6. Sotto il nastro
- M1–M3 fatte.

## 7. Foglietto
- F1 fatta (velo chiaro, così la catena evidenziata si vede) · F2–F13 fatte · F14 fatta (secondo tocco anche attraverso il velo) · F15 fatta (una lettura `leggiPrenotazioneUnica`; se non riesce, prezzo e pagamento dicono «Conto non leggibile») · F16 fatta · F17 fatta.

## 8. Catena
- K1–K3 fatte.

## 9. Camera tenuta
- H1–H7 fatte. Scheda in ottone: «in opzione», «N ospiti · scade alle 18:00» (o «scaduta», smorzata). Tolta la distinzione bianca/a righine della barra di prima: nel riferimento le tenute hanno una tinta sola; come doveva pagare lo dice il foglietto. Resta la riga «Camera proposta come alternativa» quando serve.

## 10. Legenda
- L1–L5 fatte (foglio 470 px).

## Prova in produzione (29/09/2026, sola lettura, dati veri)

- Calendario di oggi a 430 px: 191 schede disegnate, 90 buchi, nessuna camera tenuta in questo momento. In vista: «21 → 30 SET · 9 NOTTI | ⭐ 🛏 ⇄ Dario Barone | 2 ospiti · da Allegra · pagato · 1 letto extra | cambio camera»; «29 SET → 1 OTT | Giacomo Coroforte | 2 ospiti · da incassare | arriva 09:55 · Linate, Massimo»; «1 → 3 OTT | Manuela Dominici | 1 ospite · bonifico in attesa | arriva 15:15 · Milano Centrale, navetta»; riga «🛏 extra» con 2/2 in rosso.
- Ricerca «macauda»: «13 prenotazioni trovate · Rosa Macauda», navigatore «1 DI 13 · 23 – 25 giu · Lena», una scheda col contorno verde, 178 attenuate.
- Catena di Dario Barone: il foglietto dice «AMELIA · 20 → 30 SET · 10 NOTTI · CONFERMATA», Camere «Allegra 1 notte, poi Amelia 9», Ospiti «2 · letto in più dal 26 set», Prezzo «730 €», Pagamento «ricevuti 730 € · saldato», Arrivo «dom 20 set alle 18:40 · arrivo autonomo», Note vuota, Cliente «già ospite 1 volta · da Nida · 890 € con questa»; i due tratti della catena pieni con l'ombra.
- Buco «30 SET → 4 OTT» toccato: si apre la Nuova prenotazione con la camera e l'arrivo al 30 settembre (non salvata).
