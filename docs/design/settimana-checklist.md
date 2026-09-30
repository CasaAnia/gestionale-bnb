# Vista «Sett.» del nastro sul telefono — checklist

Riferimento: `docs/design/calendario-settimana-riferimento.html` (approvato da
Ania il 30/09/2026). Prima schermata = vista nuova «Sett.», seconda = «2 SETT.»
di oggi per confronto. Ogni voce alla fine è «fatta» oppure «non fatta» col
motivo.

## Punti della richiesta

- [x] S1 · Pillola del telefono a tre parti «MESE | 2 SETT. | SETT.»: maiuscoletto 9,5 px, padding 4 × 7 per parte, parte accesa piena d'inchiostro con testo avorio → **fatta** — `.riga-periodo-tel .cal-pill button span { font-size: 9.5px; padding: 4px 7px; }`, voci da `VOCI_GRIGLIA_TELEFONO`
- [x] S1 · Frecce ‹ › attaccate alla pillola (gap 8 px, ‹ a sinistra e › a destra, come oggi) → **fatta** — RigaPeriodo invariata (gap 8 px)
- [x] S1 · Periodo a sinistra in Cormorant su UNA riga: grandezza ricalcolata (dal valore di oggi, giù di 1 px finché sta a 390 px con la pillola più lunga); valore scritto nel riscontro → **fatta** — 20 px (a 21 non sta «28 apr – 10 mag 2026», a 22 non sta «28 mag – 10 giu 2026», a 23-24 non sta «28 set – 11 ott 2026»); a cavallo d'anno 16 px (a 17 non sta)
- [x] S2 · «Sett.» è lo stesso nastro di «2 SETT.»: corsie 92 px, schede 72 px con le 4 righe, colori, acconti, letto extra, cambio camera, catena, riga «🛏 extra», linea di oggi, divisori dei mesi, domeniche → **fatta** — stesso codice del nastro, cambia solo la larghezza del giorno
- [x] S2 · Giorni da 145 px invece di 60; sul telefono se ne vedono due alla volta e si scorre col dito → **fatta** — due giorni interi in vista a 390 px, scorrimento col dito invariato
- [x] S2 · Righello dei giorni e celle della riga «🛏 extra» a 145 px → **fatta** — righello e riga «🛏 extra» usano la stessa larghezza del giorno
- [x] S3 · Il periodo dice la settimana dal primo giorno visibile («28 set – 4 ott», mese abbreviato come in «2 SETT.») → **fatta, con una differenza dal riferimento** — dice «19 – 25 nov 2026» con l'anno, come oggi fa «2 SETT.»; il riferimento lo scrive senza anno sia in «Sett.» sia in «2 SETT.», ho tenuto il formato vero di «2 SETT.»
- [x] S3 · Frecce: una settimana, come in «2 SETT.» → **fatta**
- [x] S3 · «Oggi» porta il giorno di oggi come prima colonna visibile → **fatta** — anche all'apertura della pagina in «Sett.» oggi è la prima colonna
- [x] S4 · Tocco su una scheda: foglietto; primo tocco sul cambio camera: catena in evidenza (identico a oggi) → **fatta** — codice del tocco non toccato; provato: il foglietto si apre (schermata settimana-390-foglietto.png)
- [x] S4 · Tocco su un giorno libero: nuova prenotazione con camera e giorno toccato esatto sotto il dito → **fatta** — provato ai bordi: tocco a 4 px dal bordo destro del 19 → check_in=2026-11-19, a 4 px dal bordo sinistro del 21 → 2026-11-21
- [x] S5 · Vista scelta ricordata con lo stesso meccanismo di oggi (Mese / 2 sett. / Sett.) → **fatta** — stessa chiave nel browser di prima (Calendario e Arrivi insieme, Richieste la sua)
- [x] S6 · Calendario → **fatta**
- [x] S6 · Arrivi (card dell'arrivo: ora grande, icone, riga dell'arrivo, leggibile tutta a 145 px) → **fatta, con un limite** — ora grande, icone e nome stanno; la riga dell'arrivo sta intera nei casi brevi («autonomo», «Rogoredo 11:40 · Alberto») ma nel caso più lungo («Malpensa 14:15 · Aldo, prelievo 14:30») su una notte si taglia ancora (155 px di testo in 119). Nei dati finti non ci sono orari: provato scrivendo gli orari a mano nella pagina (settimana-390-arrivi-orari-simulati.png)
- [x] S6 · Richieste, vista Reale e Presunta → **fatta** — Reale e Presunta
- [x] S6 · Dal Mac nulla cambia: pillola a due parti e giorni come oggi; «Sett.» solo sotto la larghezza del telefono → **fatta** — a 1024 px e oltre pillola a due parti, «Sett.» ricordata vale «2 settimane» (provato a 1280: giorni come prima)
- [ ] S7 · Telefono in orizzontale: resta com'è; in «Sett.» giorni da 145 px con le schede compatte → **non fatta come scritta** — in orizzontale «Sett.» usa i giorni da 145 px (provato a 844×390), ma la «versione compatta» (corsie 56, schede 44 su due righe) nel codice non esiste: in orizzontale oggi le schede sono le stesse da 72 px. Non l'ho inventata
- [x] S8 · Costante unica in lib/calendarioMobile (`GIORNO_SETT_PX = 145`) accanto a quella dei 60 px → **fatta** — `GIORNO_SETT_PX = 145` in lib/calendarioMobile, accanto a `GIORNO_TELEFONO`

## Elementi della prima schermata del riferimento

- [x] Testa «CALENDARIO» in alto (invariata) → **fatta**
- [x] Campo «Cerca nome o telefono…» (invariato) → **fatta**
- [x] Riga del periodo: «28 set – 4 ott» a sinistra (con l'anno, vedi S3), ‹ · pillola con «SETT.» accesa · › a destra → **fatta**
- [x] Righello «lun 28 · mar 29 · mer 30…» a 145 px, oggi in verde, domeniche in terra → **fatta**
- [x] Colonna delle camere 66 px (Amelia, Ambra, Allegra, Lena), corsie da 92 px → **fatta**
- [x] Filo verde di oggi e filo ottone al 1° del mese → **fatta**
- [x] Scheda che comincia prima (Marta Bellini): testo nella parte in vista → **fatta**
- [x] Scheda di una notte (Chiara Neri 28 → 29 set · 1 notte): date, icona + nome, «1 ospite · pagato», «arriva 19:30 · autonomo» tutti leggibili → **fatta** (nei dati finti sul 20 novembre: «Buco Amelia» e le altre tre)
- [x] Cambio camera (Fam. Russo): taglio obliquo col filo del suo colore → **fatta**
- [x] Esclusiva 🔒 arancio, bonifico in attesa viola, pagato verde, prenotazione blu → **fatta**
- [x] Riga dell'arrivo in ottone scuro → **fatta**
- [x] Buchi liberi senza riquadro (come la prova in corso) → **fatta** nel Calendario e negli Arrivi; nelle Richieste i riquadri tratteggiati c'erano già prima e restano (la prova dei buchi non le riguarda, non l'ho cambiata)
- [x] Riga «🛏 extra» sotto le camere con celle da 145 px → **fatta**
- [x] «OGGI» sotto la colonna delle camere e la striscia dei mesi accanto → **fatta**
- [x] «LEGENDA» sotto «Oggi» → **fatta**

## Schermate (390 px, anteprima finta, stessi dati per tutte)

- `settimana-390-confronto.png` — Calendario sul 20 novembre, «Sett.» e «2 SETT.» affiancati (regola fissa n. 10)
- `settimana-390-calendario.png` — Calendario in «Sett.»
- `settimana-390-arrivi.png`, `settimana-390-arrivi-orari-simulati.png` — Arrivi in «Sett.»
- `settimana-390-richieste-presunta.png`, `settimana-390-richieste-reale.png` — Richieste in «Sett.»
- `settimana-390-pillola.png` — la pillola in primo piano
- `settimana-390-foglietto.png` — tocco su una scheda in «Sett.»
- `settimana-mac-1280-invariato.png`, `settimana-844x390-orizzontale.png`
