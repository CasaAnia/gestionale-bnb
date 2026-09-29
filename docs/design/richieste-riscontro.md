# Richieste «Maison» — riscontro della checklist

Riferimento: `docs/design/richieste-riferimento.html` (approvato da Ania il
29/09/2026). Contratto: `docs/design/richieste-checklist.md`. Ogni voce è
«fatta» o «non fatta: motivo»; nessuna voce aggiunta. Schermate a 390 px
(anteprima senza rete, dati finti): `richieste-390-presunta.png`,
`richieste-390-pagina.png`, `richieste-390-camere.png`,
`richieste-390-messaggio.png`.

Commit: 397edf1 (riferimento) · 6e31b56 (checklist) · 9ce04df (RigaPeriodo
telefono) · efd7e1a (nastro) · c0bc52e (foglietto) · bc3df8b (elenco) ·
0d8f24b (scadenza 3/24 ore) · c6ba14f (linguette) · 75b4494 (conferma e
rifiuto) · 1dcff99 (nuova/modifica). Suite: 1913 test verdi. Vercel: success
sul commit 1dcff99.

## 0. Regole comuni

- G1 fatta: Cormorant per nomi, titoli, periodo, camere, telefoni e prezzi; Figtree dal telefono, Jost dal Mac (`.maison.cal`).
- G2 fatta: fondo bianco, fili #E8E3DA, ottone, mattone; i colori delle richieste in `--cal-richiesta-*`, `--cal-blu-ardesia`, `--cal-verde` (app/maison.css) e `TINTA_RICHIESTA` (lib/richiesteNastro).
- G3 fatta: stessi pezzi (Nastro, RigaPeriodo, RigaMesi, PannelloLegenda, FoglioMaison, FogliettoPrenotazione, CampoRicerca, InterruttorePillola); la scheda della prenotazione e della camera tenuta, i conti degli acconti e delle catene sono stati ESTRATTI dal Calendario (`components/calendario/SchedaPrenotazione`, `lib/calendarioNastro`) e ora li usano Calendario e Richieste.
- G4 fatta: azioni in maiuscoletto sottolineato; un solo tasto pieno per schermata.
- G5 fatta: foglietto 380, conferma 520, rifiuto 400, «L'hai inviata?» 300 px.
- G6 fatta: conferma «B» (SalvatoMaison) dopo «Salva la richiesta».
- G7 fatta: comportamento invariato salvo le novità 14a–14f (vedi sotto le poche differenze dette voce per voce).
- G8 fatta: lib/richiesteTesti non è stato toccato. Due testi già mostrati sono cambiati perché l'incarico li riscrive: «Scaduta · chiusa da sola …» (era «Scaduta, chiusa …») e «quale ha scelto la cliente?» (era «il cliente»).

## 1. Calendario · vista Reale

- R1 fatta. R2 fatta. R3 fatta (anche in Calendario e Arrivi). R4 fatta (la scelta resta in `ca_richieste_vista`).
- R5 fatta: lo stesso nastro, scorrevole da un mese prima di oggi a oltre un anno dopo (prima la finestra era a pagine di 14 giorni/1 mese). R6 fatta. R7 fatta. R8 fatta.
- R9 fatta. R10 fatta: le camere tenute in ottone; il tocco apre il foglietto della richiesta che la tiene (nel Calendario apre «Camera tenuta» con «Libera la camera»: qui siamo già nelle Richieste). R11 fatta. R12 fatta. R13 fatta. R14 fatta.

## 2. Calendario · vista Presunta

- P1–P6 fatte. P7 fatta (libera = niente prenotazioni confermate né camere tenute da un'altra proposta valida).
- P8 fatta. P9 fatta. P10 fatta (0,35). P11 fatta.
- P4: il nome è `nomeCompleto` e non `nomeConAltri`: una richiesta non ha «altri in camera» (nomeConAltri su una richiesta darebbe «Ospite»).
- In Presunta la proposta inviata sta sulle camere proposte e prende il posto della scheda ottone della tenuta (niente doppioni).

## 3. Tocco su una richiesta

- F1–F10 fatte. F11 fatta con il testo del riferimento, «già ospite 3 volte · 640 € spesi» (pezzoCliente: `etichettaGiaStato` scrive «Già stato da noi · N soggiorni», che è il testo che Ania ha scartato il 18/09).
- F12 fatta. F13 fatta. F14 fatta. F15 fatta (FogliettoPrenotazione, primo tocco foglietto, secondo la scheda).

## 4. Pagina intera

- E1 fatta. E2 fatta.
- E3 **non fatta come nel disegno**: le chip sono Arrivo · Durata · Persone · Da guardare, con Durata accesa. Il riferimento le mette Durata · Arrivo · Persone, ma la REGOLA FISSA n. 4 (REGOLE-FISSE.md, protetta da test) vuole «Arrivo · Durata · Persone»: serve una parola di Ania per cambiarla.
- E4 fatta. E5–E12 fatte. E13 fatta. E14 fatta.

## 5. Chiuse

- C1–C7 fatte. «Apri la scheda» c'è quando la richiesta confermata ha la prenotazione collegata.

## 6. La richiesta a linguette

- L1 fatta: sui sottoindirizzi delle Richieste (proposta, nuova, modifica) la barra generale del telefono lascia il posto a «‹ Richieste · stato», come fa già la scheda prenotazione.
- L2–L9 fatte.
- K1–K5 fatte. K6 fatta: «Modifica» (al posto del vecchio link) e «Avanti · Camere».
- M1–M3 fatte. M4 fatta, con una precisazione: «Un'altra soluzione» compare quando nessuna camera è libera per tutte le notti (solo lì cambia qualcosa: con le camere libere il messaggio lo decidono le caselle); «Torna alla proposta automatica» dentro «Compongo io». M5 fatta. M6 fatta. M7 fatta.
- N1–N6 fatte.
- S1–S8 fatte. «Modifica il testo» apre il riquadro e mette il cursore nel testo.
- La parte CLIENTE in fondo (soggiorni uno per uno) non c'è più: nel riferimento non compare; «Cliente che torna» in Controllare dice volte, ultimo soggiorno e speso, col link «Vedi i soggiorni».

## 7. Creare la prenotazione?

- X1–X9 fatte.

## 8. Perché la rifiuti?

- Y1–Y8 fatte.

## 9. Nuova richiesta (e Modifica)

- W1–W10 fatte. W11 fatta per «Nuova richiesta»; in «Modifica richiesta» il tasto resta «Salva le modifiche» (testo già del gestionale; il riferimento mostra solo la Nuova).

## 10. Novità

- Z1 fatta (14a). Z2 fatta (14b). Z3 fatta (14c: elenco, foglietto, testata, modulo). Z4 fatta (14d). Z5 fatta (14e).
- Z6 fatta (14f): una regola sola `oreOpzioneProposta` in lib/richieste, letta da lib/opzioni, dalla chiusura automatica, dal timer, da «Da guardare», dal bollino blu e da «Da controllare» in Home. Test in `lib/scadenzaVera.test.ts` (3 e 24 ore, notifica e chiusura).

## 11. Mac

- D1 fatta. D2 fatta. D3 fatta (da 768 px in su, la stessa soglia delle altre pagine Maison che usano `useDesktop`).

## Prova con i dati veri (29/09/2026, sera)

Il gestionale pubblicato chiede l'accesso di Ania: non ho aperto la pagina
vera. Ho fatto girare, in sola lettura sul database vero, le stesse funzioni
della pagina:
- richieste aperte: **1**, Emanuela Dell'Amico, dal sito, 24 → 25 set, qualsiasi camera, «in attesa · arrivo passato»; sul nastro in Presunta sta su **Lena** (l'unica camera libera quella notte) e sulla riga «Qualsiasi camera»: si vede tornando indietro di una settimana;
- nessuna proposta inviata aperta, quindi nessun timer vero da guardare adesso. L'ultima proposta vera con caparra (Anna, inviata l'8/09) col calcolo nuovo dice «scade tra 20 h» dopo 4 ore e «scaduta 1 h fa» dopo 25: prima diceva «scaduta» già dopo 3 ore.

Da provare dal telefono di Ania: aprire la richiesta vera fino alla linguetta
Messaggio senza inviare (scheda «prove dal telefono» in CONSEGNA-ATTIVA.md).
