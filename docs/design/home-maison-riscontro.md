# Home «Maison» — riscontro (28/09/2026)

Riferimento: `home-maison-riferimento.html`. Contratto: `home-maison-checklist.md`.
Schermate a 390 px: `home-maison-390-intera.png` (Home intera) e
`home-maison-390-pulizie-rimanda.png` (Pulizie con «Rimanda o salta» aperto),
fatte sull'anteprima finta (dati di prova, senza la migrazione 0059: per questo
sotto i timer compare «Timer e tempi non ancora attivati»).

Commit: d7739cc (riferimento e foto), checklist, c5ac40a (1), 2b46ae8 (2),
e049348 (3), 6d3ac7c (4), 3661a32 (4bis), be3a1ef (5), 605ca5f (6).
Suite: 1825/1825. TypeScript e build di produzione riuscite.

## 0. Regole comuni
- G1 fatta (Cormorant Garamond 300/400/500 e Jost 300/400/500 con next/font).
- G2 fatta.
- G3 fatta.
- G4 fatta, con un'eccezione presa dal riferimento: il menu «WhatsApp ▾» aperto è bianco col filo e un'ombra leggerissima, come disegnato.
- G5 fatta (classe unica `mz-lnk`, area di tocco 44 px).
- G6 fatta.
- G7 fatta.
- G8 fatta.

## 1. Striscia in alto
- S1 fatta (`public/home/striscia.jpg`, dal sito: `lena-banner.jpg` ritagliata al centro 390:118, 780×236).
- S2 fatta. S3 fatta. S4 fatta. S6 fatta.
- S5 fatta con un limite: la Home non aveva una ricerca sua; il cerchio ⌕ apre Prenotazioni, dove si cerca per nome.

## 2. Richieste
- R1–R9 fatte (stesso `details`, stessa emoji, «Rimanda» come prima).

## 3. Numeri
- N1–N7 fatte. «Da incassare €» è la somma dei residui della sezione Da incassare e scorre a quella sezione.

## 4. Striscia della settimana
- W1–W9 fatte; W12 e W13 fatte.
- W10 fatta; per il cambio camera la seconda riga dice chi va dove («Fam. Russo va in Ambra»). Non fatto: «· nessun arrivo» del riferimento, perché l'incarico dice che senza orario la riga dell'arrivo non c'è.
- W11 fatta: «Prossimo arrivo» compare solo per l'arrivo di QUEL giorno con un orario (un arrivo di un altro giorno con la sola ora sarebbe fuorviante, visto che la data non si ripete).

## 5. La giornata
- D1–D12 fatte; D14–D16 fatte.
- D13 fatta: «Bonifico atteso · Segna pagato». Quando l'accordo NON è un bonifico la parola è «Pagamento atteso» (sarebbe falso scrivere bonifico). «Segna pagato» non esisteva in Home: apre lo stesso foglio del pagamento della scheda (saldo completo già proposto), con il contratto di sempre (`lib/pagamentiDati`).

## 6. Arrivi di domani
- T1–T2 fatte.

## 7. Pulizie di oggi
- P2–P12 fatte.
- P1 fatta nel testo; l'ordine resta quello di sempre (per urgenza, che viene dal prossimo arrivo, poi ritardo): non l'ho cambiato perché è logica, non aspetto.
- P10 fatta: `pulizieAperte` non segna più «automatica»; la regola del 04/09 resta solo per lo storico delle statistiche. Anche la notifica della sera ora ricorda queste pulizie come le altre.

## 8. Da controllare
- C1–C3 fatte. Resta la riga grigia «… tutto a posto» di sempre (funzione esistente).

## 9. Da incassare e Incassati oggi
- I1, I3–I6 fatte. Voci e cifre restano quelle di `daIncassare` (soggiorni con almeno un pagamento e un residuo).
- I2 fatta con le parole di «Come paga» del gestionale («bonifico», «contanti», «caparra del 50%»…), non «paga all'arrivo» del riferimento, che non esiste fra i modi salvati.
- Le date sono nel formato di casa «22 set → 24 set» (regola delle date del 10/09), non «22–24 set».

## 10. Il mese e Vai a
- M1–M3 fatte.

## 11. Barra in basso
- B1–B5 fatte. Il puntino d'ottone di Richieste compare con richieste nuove o dal sito (o con la lettura fallita); i numeri rosso/blu restano solo nella barra laterale del Mac.

## 12. Foglio «Arrivo e navetta»
- A2–A4, A6, A7, A9–A11 fatte. A5 fatta (etichette «Dalle/Alle»; con l'ora precisa «In struttura»).
- A1 fatta con altezza 752 px invece di 660: 660 non contiene il caso più lungo reale (Arrivo a… con fascia oraria, stima e prelievo). Solo «Altro luogo…» con la fascia supera di poco e scorre dentro il foglio, senza cambiare misura.
- A8 non fatta come nel riferimento: i chip «Autista» restano visibili anche con «In struttura» e «Da definire», perché in `pianoModuloArrivo` sono parte della stessa scelta della navetta; nasconderli avrebbe tolto una funzione.

## 13. Fogli delle pulizie
- F1–F16 fatte. Nel foglio «Pulita e recuperato» restano anche le cose che c'erano (riga della dotazione, pezzi da lavare, timer con «Ferma e riporta i minuti», «Niente recuperato» che registra zero recuperi, avvisi): regole e messaggi identici. I chip del recuperato sono sempre visibili (prima si aprivano con «Segna il recuperato»).

## 14. Conferma di salvataggio (B)
- K1–K5 fatte, provate nell'anteprima sul foglio Arrivo. Nel foglio del pagamento, se il pagamento era in sospeso la riga dice «ritrovato e confermato». Nella scheda la conferma volante del pagamento è stata sostituita dalla B. Il tocco rapido «Pulita» (senza foglio) non mostra la B.

## 15. Pagamenti
- Y1–Y11, Y13–Y16 fatte.
- Y12 fatta: «Totale soggiorno» (o «Totale concordato» quando c'è lo sconto) · «Già ricevuto» · «Come paga». Nel conto restano anche «Sconto» (regola fissa n. 6), «togli» per ogni pagamento, «I pagamenti coprono fino alla notte del …» (regola fissa n. 9), la frase di come paga e il dettaglio del soggiorno.

## 16. Stati
- Z1–Z3 fatte.

## Non si fanno
- X1–X3: varianti non scelte e bozze non disegnate.

## Prove
- Anteprima finta 390×844: striscia e riquadro del giorno (tocco su oggi e su gio 1), foglio Arrivo nei tre tipi con la stessa altezza, salvataggio con la conferma B e la Home aggiornata, Pulizie con «Rimanda o salta» aperto, foglio «Pulita e recuperato», foglio del pagamento dalla Home (il finto server non registra pagamenti: compare correttamente «Verifica pagamento»), Home intera, desktop 1280 (768 px centrati, 14 giorni).
- Non provati nell'anteprima: salvataggio reale di pulizie, Rimanda/Salta e pagamenti (il finto non li accetta); coperti dai test e dai percorsi di salvataggio invariati.
