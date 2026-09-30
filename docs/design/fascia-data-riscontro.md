# Fascia della data e barra in basso — riscontro (30/09/2026)

Riferimento: `docs/design/fascia-data-riferimento.html` (versione E). Checklist: `docs/design/fascia-data-checklist.md`.
Schermate fatte sulle anteprime finte (Chrome headless, 390 × 844 e 1280 × 800).

| Voce | Esito |
|---|---|
| F1.1 «MESE» da solo sopra, pieno d'inchiostro col testo avorio quando Mese è accesa | fatta |
| F1.2 «‹ 2 SETT. \| SETT. ›» sotto, frecce a 6 px | fatta |
| F1.3 8 px fra le righe, «MESE» centrato sopra la pillola | fatta |
| F1.4 periodo con l'anno, Cormorant, centrato a sinistra, una riga | fatta («27 set – 10 ott 2026», «27 set – 3 ott 2026», «Settembre 2026») |
| F1.5 grandezza del periodo | fatta: **25 px** sul telefono. Misurata col Cormorant vero su tutti i periodi del 2026 e del 2027: il più largo è «27 apr – 10 mag 2026», 200 px nei 201 disponibili a 390 px |
| F1.5 a cavallo d'anno | non fatta alla stessa grandezza: «28 dic 2027 – 10 gen 2028» a 25 px non ci sta su una riga; lì **20 px**, la più grande a cui ci sta |
| F1.6 fascia 10 sopra e 12 sotto (alta 78 px), il resto scende | fatta |
| F1.7 / F1.8 tocchi su «MESE», «2 SETT.», «SETT.» | fatta: una voce accesa alla volta; con Mese la pillola sotto non ha niente acceso |
| F1.9 frecce e scelta ricordata come prima | fatta: stessa funzione `freccia` e stessa chiave nel browser |
| F2.1 stessa fascia in Calendario, Arrivi, Richieste dal telefono | fatta |
| F2.2 dal Mac la stessa fascia | fatta: un componente solo per telefono e Mac |
| F2.3 grandezza del periodo dal Mac | fatta: **40 px** (partendo da 40 ci stanno già tutti, anche a cavallo d'anno) |
| F2.4 «Sett.» dal Mac coi giorni da 145 px | fatta: a 1280 px si vedono 6 giorni e mezzo |
| F2.5 il resto del Mac com'è | fatta. Statistiche e Spese hanno la loro riga del periodo, senza le viste: restano com'erano |
| F3 riga «🛏 EXTRA» identica | fatta: non toccata |
| F4 «Legenda» 28 px sotto «Oggi» | fatta ora (prima era 14): misurata 28 px, anche nelle Richieste; dal Mac invariata |
| F5 barra «Oggi · Calendario · Richieste · Arrivi · Pulizie» | fatta: «Menu» tolto, «Pulizie» con icona a filo (stelline), apre le pulizie di oggi |
| F5 chi aveva tolto «Pulizie» | commit **c5ac40a** «Home Maison (1): caratteri, colori, striscia con la foto e barra in basso» (28/09/2026) l'aveva sostituita con «Menu» |

Il mese resta scritto con la maiuscola («Settembre 2026»), come era già nel gestionale.

Schermate: `fascia-390-calendario-2sett.png`, `fascia-390-calendario-sett.png`, `fascia-390-calendario-mese.png`, `fascia-390-arrivi.png`, `fascia-390-richieste.png` (la barra in basso è in tutte); dal Mac `fascia-mac-calendario.png`, `fascia-mac-arrivi.png`, `fascia-mac-richieste.png`.
