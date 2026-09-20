# Una pulizia al giorno: analisi sui dati veri

Analisi in sola lettura del 14/09/2026 sulla tabella `bookings` di produzione (stati «confermata» e «completata»).

**Attenzione alla finestra dei dati.** Il gestionale parte dal 26/03/2026: fra settembre 2025 e marzo 2026 non c'è nessuna prenotazione registrata. I numeri qui sotto coprono quindi **159 giorni, dal 26 marzo al 31 agosto 2026**, non 12 mesi. Le medie «al giorno» sono calcolate su quei 159 giorni.

In sintesi:

| | |
|---|---|
| Soggiorni | 120 |
| Righe in tabella (con cambi camera) | 132 |
| Cambi camera | 12 (in 7 soggiorni) |
| Notti vendute | 420 |
| Incasso (total_amount) | 31.128 € |
| Durata media | 3,5 notti |

---

## Parte 1 — Giorni della settimana

Media al giorno (in parentesi il totale nei 159 giorni).

| Giorno | Arrivi | Cambi camera | Partenze | Camere da preparare |
|---|---|---|---|---|
| **Lun** | 1,17 (27) | 0,04 (1) | 0,61 (14) | **1,22 (28)** ⬆ |
| **Mar** | 1,09 (24) | 0,09 (2) | 0,59 (13) | **1,18 (26)** ⬆ |
| Mer | 0,82 (18) | 0,14 (3) | 0,64 (14) | 0,95 (21) |
| Gio | 0,91 (21) | 0,09 (2) | 1,35 (31) | 1,00 (23) |
| Ven | 0,39 (9) | 0 (0) | 1,26 (29) | 0,39 (9) ⬇ |
| Sab | 0,13 (3) | 0 (0) | 0,61 (14) | 0,13 (3) ⬇ |
| Dom | 0,78 (18) | 0,17 (4) | 0,17 (4) | 0,96 (22) |
| **Totale** | **120** | **12** | **119** | **132** |

- **Più carichi:** lunedì e martedì (più di una camera da preparare al giorno, in media).
- **Più leggeri:** sabato e venerdì (quasi niente arrivi; il venerdì è però giorno di partenze).
- Le partenze si concentrano giovedì e venerdì: gli ospiti arrivano a inizio settimana e ripartono prima del weekend. È una casa da «settimana lavorativa», non da weekend.

(Una partenza cade a settembre, fuori finestra: per questo le partenze sono 119.)

---

## Parte 2 — Durata dei soggiorni

| Notti | Soggiorni | % |
|---|---|---|
| 1 | 51 | 42,5 % |
| 2 | 24 | 20,0 % |
| 3 | 16 | 13,3 % |
| 4 | 8 | 6,7 % |
| 5 | 3 | 2,5 % |
| 6 | 2 | 1,7 % |
| 7 | 4 | 3,3 % |
| 8-14 | 8 | 6,7 % |
| 15+ | 4 | 3,3 % |

Quasi **due soggiorni su tre durano 1 o 2 notti**. Però pesano poco sull'incasso: i 51 soggiorni da una notte valgono 4.080 € (13 %), mentre i 21 soggiorni da 5 notti in su valgono 17.275 € (55 %).

---

## Parte 3 — Simulazione «una sola pulizia al giorno»

Camere da preparare in un giorno = arrivi + cambi camera di quel giorno.

### 3a — Com'è andata davvero

Nei 159 giorni, **36 giorni hanno avuto 2 o più camere da preparare** (circa uno su quattro; e 36 degli 86 giorni con almeno una camera da preparare, cioè quasi la metà).

| Camere da preparare nello stesso giorno | Giorni |
|---|---|
| 2 | 28 |
| 3 | 6 |
| 4 | 2 |

I giorni da 4 sono stati il 4 maggio (lunedì) e il 23 luglio (giovedì).

### 3b — Le regole, una per volta

Per ogni regola: quanti soggiorni dei 120 sarebbero stati incompatibili (persi), quanto incasso, e quanti giorni resterebbero comunque con 2+ camere da preparare.

| Regola | Soggiorni persi | Incasso perso | Giorni con 2+ che restano |
|---|---|---|---|
| Minimo 3 notti | 75 (63 %) | 7.858 € | 11 |
| Minimo 4 notti | 91 (76 %) | 11.518 € | 7 |
| Minimo 5 notti | 99 (83 %) | 13.853 € | 5 |
| Arrivi solo dom/lun/mar/gio + minimo 4 notti | 97 (81 %) | 15.548 € | 4 |
| **Un arrivo al giorno, nessun minimo** | **36 (30 %)** | **6.180 €** | 8 (solo per i cambi camera) |
| Un arrivo al giorno + niente cambi camera | 42 (35 %) | 11.650 € | **0** |

Note:

- I quattro giorni di arrivo «migliori» li ho cercati fra tutte le 35 combinazioni possibili: la migliore è proprio **dom/lun/mar/gio**, quella proposta.
- Il minimo di notti da solo **non basta**: taglia la maggior parte dei soggiorni e lascia comunque giorni con 2-3 camere, perché anche i soggiorni lunghi arrivano spesso lo stesso giorno.
- «Un arrivo al giorno» è l'unica regola che colpisce esattamente il problema. Ho tenuto la prima richiesta arrivata e rifiutato le altre dello stesso giorno. L'ordine di richiesta è però approssimato: 79 soggiorni su 120 sono stati caricati nel gestionale dopo l'arrivo, quindi l'ordine vero delle richieste non lo conosciamo. Scegliendo invece di tenere il soggiorno più ricco, l'incasso perso scende a 4.455 €.
- Dei 36 soggiorni «persi» con un arrivo al giorno, **18 avrebbero potuto arrivare il giorno prima o dopo** su un giorno libero. Nella realtà una parte di questi non si perde: si propone un'altra data.
- L'ultima riga (niente cambi camera) rifiuta anche i 7 soggiorni con cambio camera. In pratica non si rifiutano: si tengono nella stessa camera o si sposta il cambio su un giorno senza arrivi. Il costo vero sta fra le due ultime righe.

Combinazioni provate, per completezza:

| Regola | Soggiorni persi | Incasso perso | Giorni con 2+ |
|---|---|---|---|
| Min 2 notti + un arrivo al giorno | 70 (58 %) | 12.870 € | 0 |
| Min 3 notti + un arrivo al giorno | 85 (71 %) | 14.778 € | 0 |
| dom/lun/mar/gio + min 4 + un arrivo al giorno | 101 (84 %) | 18.288 € | 0 |

Aggiungere un minimo di notti alla regola «un arrivo al giorno» non toglie nessun giorno in più (sono già zero): costa solo soggiorni.

### 3c — Conclusione

1. **La regola giusta è «al massimo un arrivo al giorno», senza minimo di notti.** È l'unica che porta davvero a una pulizia al giorno con il costo più basso: circa 36 soggiorni su 120 (30 %) e 6.180 € su 31.128 € (20 %) nei 5 mesi osservati, e la metà di quei soggiorni si può recuperare spostando l'arrivo di un giorno.
2. **Il minimo di notti va scartato**: minimo 3 notti perde 75 soggiorni (63 %) e lascia comunque 11 giorni con 2+ camere; minimo 4 o 5 perde ancora di più.
3. **Come prendere le prenotazioni:** al primo arrivo confermato il giorno si chiude; alla seconda richiesta si propone il giorno prima o dopo. I cambi camera si fanno solo in giorni senza arrivi (o non si fanno).
4. **Giorni di arrivo consigliati:** nessun vincolo fisso. Se proprio si vuole limitare, dom/lun/mar/gio è la quaterna migliore, ma con minimo 4 notti costa 97 soggiorni (81 %) e 15.548 €: troppo.
5. **Attenzione:** i numeri coprono solo 26 marzo–31 agosto 2026 (159 giorni), e nei mesi pieni (aprile–luglio) i giorni con 2+ camere sono stati 34 su 36. Vale la pena rifare il conto a fine anno con 12 mesi veri.
