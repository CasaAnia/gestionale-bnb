# Menu del Mac «Maison» — riscontro

Riferimento: `menu-mac-riferimento.html` (colonna M2). Checklist: `menu-mac-checklist.md`, 38 voci tutte fatte.
Schermata a 1280 px (anteprima finta, pagina Richieste): `menu-mac-1280.png`.

## Misure lette nella pagina vera (1280×800)
| Cosa | Riferimento | Pagina |
|---|---|---|
| Larghezza colonna | 200 px | 200 px, contenuto con `padding-left: 200px` |
| Marchio | Cormorant 26 px 400 | Cormorant Garamond 26 px 400 |
| Voci | Jost 13,5 px #6E6558 | Jost 13,5 px #6E6558 |
| Ordine | Home · OGNI GIORNO 4 voci · ARCHIVIO 6 voci | uguale, senza «Nuova» |
| Icone | 15 px, tratto 1.3, opacità .7 | 15 px, 1.3, .7 (piena sull'attiva) |
| Bollini Richieste | ottone + blu, 16 px, 6 px fra i due | rgb(168,137,79) e rgb(125,157,176), 16 px, 6 px |
| Versione | 10 px #8A8072, 18 px dal fondo | «v. dev» in anteprima (sul sito la sigla di 7 caratteri), 18 px dal fondo |

## Note
- Nella schermata la versione in basso a sinistra è coperta dal bottone «N» di Next, che esiste solo in anteprima: sul sito pubblicato non c'è.
- Il testo della versione è la sigla del commit (`NEXT_PUBLIC_BUILD_TAG`), non la data d'esempio del riferimento, come chiesto.
- Tolta la versione dalla legenda del Calendario dal Mac: ora sta in un posto solo.
- «Nuova prenotazione» resta raggiungibile da: striscia della Home, tocco su un giorno libero di Calendario/Arrivi, «+ Nuova» in Prenotazioni.
- Barra bassa del telefono, foglio «Menu» e MobileTopBar non toccati.

## Prove
- `lib/menuMac.test.ts`: ordine delle voci e gruppi, «Nuova» assente dal Mac e presente altrove, bollini, versione in fondo, colonna da 200 px, barra del telefono invariata.
- `lib/indirizziNuovi.test.ts`: il controllo sulla voce «Nuova» del Mac ora guarda il link della striscia della Home.
- Suite intera verde (1867 prove), `tsc` pulito.
