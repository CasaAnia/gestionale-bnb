# Vista «Sett.» del nastro sul telefono — checklist

Riferimento: `docs/design/calendario-settimana-riferimento.html` (approvato da
Ania il 30/09/2026). Prima schermata = vista nuova «Sett.», seconda = «2 SETT.»
di oggi per confronto. Ogni voce alla fine è «fatta» oppure «non fatta» col
motivo.

## Punti della richiesta

- [ ] S1 · Pillola del telefono a tre parti «MESE | 2 SETT. | SETT.»: maiuscoletto 9,5 px, padding 4 × 7 per parte, parte accesa piena d'inchiostro con testo avorio
- [ ] S1 · Frecce ‹ › attaccate alla pillola (gap 8 px, ‹ a sinistra e › a destra, come oggi)
- [ ] S1 · Periodo a sinistra in Cormorant su UNA riga: grandezza ricalcolata (dal valore di oggi, giù di 1 px finché sta a 390 px con la pillola più lunga); valore scritto nel riscontro
- [ ] S2 · «Sett.» è lo stesso nastro di «2 SETT.»: corsie 92 px, schede 72 px con le 4 righe, colori, acconti, letto extra, cambio camera, catena, riga «🛏 extra», linea di oggi, divisori dei mesi, domeniche
- [ ] S2 · Giorni da 145 px invece di 60; sul telefono se ne vedono due alla volta e si scorre col dito
- [ ] S2 · Righello dei giorni e celle della riga «🛏 extra» a 145 px
- [ ] S3 · Il periodo dice la settimana dal primo giorno visibile («28 set – 4 ott», mese abbreviato come in «2 SETT.»)
- [ ] S3 · Frecce: una settimana, come in «2 SETT.»
- [ ] S3 · «Oggi» porta il giorno di oggi come prima colonna visibile
- [ ] S4 · Tocco su una scheda: foglietto; primo tocco sul cambio camera: catena in evidenza (identico a oggi)
- [ ] S4 · Tocco su un giorno libero: nuova prenotazione con camera e giorno toccato esatto sotto il dito
- [ ] S5 · Vista scelta ricordata con lo stesso meccanismo di oggi (Mese / 2 sett. / Sett.)
- [ ] S6 · Calendario
- [ ] S6 · Arrivi (card dell'arrivo: ora grande, icone, riga dell'arrivo, leggibile tutta a 145 px)
- [ ] S6 · Richieste, vista Reale e Presunta
- [ ] S6 · Dal Mac nulla cambia: pillola a due parti e giorni come oggi; «Sett.» solo sotto la larghezza del telefono
- [ ] S7 · Telefono in orizzontale: resta com'è; in «Sett.» giorni da 145 px con le schede compatte
- [ ] S8 · Costante unica in lib/calendarioMobile (`GIORNO_SETT_PX = 145`) accanto a quella dei 60 px

## Elementi della prima schermata del riferimento

- [ ] Testa «CALENDARIO» in alto (invariata)
- [ ] Campo «Cerca nome o telefono…» (invariato)
- [ ] Riga del periodo: «28 set – 4 ott» a sinistra, ‹ · pillola con «SETT.» accesa · › a destra
- [ ] Righello «lun 28 · mar 29 · mer 30…» a 145 px, oggi in verde, domeniche in terra
- [ ] Colonna delle camere 66 px (Amelia, Ambra, Allegra, Lena), corsie da 92 px
- [ ] Filo verde di oggi e filo ottone al 1° del mese
- [ ] Scheda che comincia prima (Marta Bellini): testo nella parte in vista
- [ ] Scheda di una notte (Chiara Neri 28 → 29 set · 1 notte): date, icona + nome, «1 ospite · pagato», «arriva 19:30 · autonomo» tutti leggibili
- [ ] Cambio camera (Fam. Russo): taglio obliquo col filo del suo colore
- [ ] Esclusiva 🔒 arancio, bonifico in attesa viola, pagato verde, prenotazione blu
- [ ] Riga dell'arrivo in ottone scuro
- [ ] Buchi liberi senza riquadro (come la prova in corso)
- [ ] Riga «🛏 extra» sotto le camere con celle da 145 px
- [ ] «OGGI» sotto la colonna delle camere e la striscia dei mesi accanto
- [ ] «LEGENDA» sotto «Oggi»
