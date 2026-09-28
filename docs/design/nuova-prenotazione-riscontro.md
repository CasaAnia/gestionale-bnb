# Nuova prenotazione «Maison» — riscontro

Voci di `nuova-prenotazione-checklist.md`, una per una. Commit: 29a5df9
(riferimento), checklist, 0bef7d8 (1), 4c8114a (2), 6d0acdc (3), 329ecd8 (4),
65f158f (5). Schermate a 390 px (anteprima finta, porta 3213):
`nuova-prenotazione-390-soggiorno-notte.png` e
`nuova-prenotazione-390-conto-due-camere.png`.

Due scelte chieste ad Ania prima di cominciare (28/09/2026, con i bottoni):
**tinte delle camere quelle di oggi** (l'incarico le dava scambiate rispetto
al codice) e **«già ospite N volte»** al posto di «N soggiorni».

## 0. Regole comuni
- G1 fatta · G2 fatta (pagina `.maison np`: dal telefono Figtree e margini 16, dal Mac Jost) · G3 fatta · G4 fatta · G5 fatta · G6 fatta · G7 fatta · G8 fatta · G9 fatta · G10 fatta · G11 fatta (barra Maison già in uso).

## 1. Testata
- T1 fatta · T2 fatta · T3 fatta · T4 fatta (TestaNuova: stesso indietro di BackLink, riserva /prenotazioni) · T5 fatta (MobileTopBar nascosta su questa pagina).

## 2. Cerca
- C1 fatta · C2 fatta (stessa regola) · C3 fatta · C4 fatta · C5 fatta · C6 fatta · C8 fatta · C9 fatta · C10 fatta · C11 fatta (testo di oggi: «Non riesco a cercare il cliente, riprova»).
- C7 fatta con una differenza scelta da Ania: «telefono · già ospite 4 volte · **640 €**» (non «4 soggiorni»). Lo speso è la somma dei soggiorni conclusi, come la scheda del cliente.

## 3. Nuovo cliente
- N1–N13 fatte. Nome e cognome restano in CampiNomeCognome (regola fissa n. 1); i fogli della scheda che usano lo stesso modulo non cambiano.

## 4. Cliente scelto
- K1 fatta · K2 fatta (stessa riga di C7) · K3 fatta (niente «cambia» aggiungendo una camera).

## 5. Soggiorno / Camera 2
- S1–S10 fatte · S12–S17 fatte.
- S7 fatta: «80 € di listino · in 2», nessun campo.
- S11 fatta con le **tinte di oggi** (Lena verde, Ambra lilla, Allegra giallina, Amelia rosata), scelta di Ania.
- S13: sotto la notte senza camera («?») il numero compare solo se la notte ha ospiti.

## 6. NotteScelta
- V1–V8 fatte, testi identici. «servono 3 posti in …» e «non disponibile: …» vanno su una riga loro sotto «letto in più» (prima stavano accanto): stesso testo.

## 7. Dopo le camere
- A1 fatta · A2 fatta · A4 fatta · A5 fatta.
- A3 fatta con il testo di oggi di scontoInParole («510 € → 459 €»): il riferimento scrive «tolgo 47 € · da 470 € a 423 €», ma quel testo è bloccato dall'incarico.

## 8. Il conto
- P1 fatta · P4 fatta · P5 fatta · P6 fatta · P7 fatta · P8 fatta · P10 fatta · P11 fatta · P12 fatta (regola fissa n. 7).
- P2, P3 fatte con le date nella forma del gestionale («28 set → 1 ott», lib/dateItaliane e periodoConMese), non col trattino «28 set – 1 ott» del riferimento.
- P9 fatta con il testo di lib/contoInRighe: «Sconto 10 %» e «−47 €».

## 9. Come paga
- M1–M8 fatte, testi di lib/comePaga.

## 10. Chi dorme in camera
- D1–D11 fatte. «Papà» aggiunto alle voci (vale anche nel foglio «Con lei» della scheda).
- D12 **fatta a metà**: la spunta si salva nella colonna `intestataria_non_dorme`, proposta in `supabase/proposte/0061_chi_dorme_in_camera.BOZZA.sql`. **Non applicata**: finché Ania non la applica a mano, la pagina non mostra la spunta (se ne accorge da sola). La scheda non la mostra ancora: sarà un lavoro a parte.
- Appena accesa la spunta, «Annulla» nel foglietto la rispegne e torna l’intestataria.

## 11. Nota
- O1 fatta.

## 12. Arrivo e navetta
- R1–R9, R11 fatte (lo stesso modulo ArrivoNavetta e le stesse regole di pianoModuloArrivo, nella veste del riferimento: pastiglie e orari a filo due per riga). Con «Ora precisa» il campo si chiama «Ora di arrivo» (etichetta già esistente).
- R10 fatta con l'etichetta di oggi «Prelievo · facoltativo» (lib/arrivo, bloccata), non «Ora del prelievo»; campo largo 90 px.

## 13. Salva
- F1–F4 fatte · F6 fatta.
- F5 fatta, provata solo dai test: nell'anteprima finta il database rifiuta le scritture, quindi un salvataggio riuscito non si è potuto vedere a schermo.

## 14. Novità
- Z1 fatta: niente campo, niente `onTariffa`, niente tariffa nella linea (periodi con tariffa null = listino).
- Z2 fatta: `LETTO_AGGIUNTIVO_A_NOTTE` in lib/tariffe. Lena con il letto chiesto in 2 conta come «compreso» (come in 3). Il prezzo del letto in **Impostazioni** (`extra_bed_price`) resta leggibile e lo usano ancora scheda e fogli; qui non più.
- Z3 fatta · Z4 fatta · Z5 fatta (tranne la colonna, vedi D12) · Z6 fatta.

## 15. Prove
- Q1–Q6 fatte in `lib/nuovaPrenotazione.test.ts` (suite: 1831 prove, tutte verdi).
- Q7 fatta (le due schermate sopra).
- Q8 fatta: scheda in CONSEGNA-ATTIVA.md.

## X. Didascalie
- Non mostrate, come previsto.
