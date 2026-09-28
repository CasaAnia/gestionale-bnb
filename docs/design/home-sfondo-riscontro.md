# Home dal telefono — sfondo bianco (prova «C»), riscontro (28/09/2026)

Scelta di Ania del 28/09/2026: dal telefono lo sfondo della Home è bianco
puro; dal Mac resta il crema e non cambia nulla.

| variabile     | a cosa serve                                         | Mac       | telefono (sotto lg) |
|---------------|------------------------------------------------------|-----------|---------------------|
| `--home-bg`   | fondo della pagina, dietro le sezioni, barra in basso | `#F6F2EA` | `#FFFFFF`           |
| `--home-line` | fili sottili: sezioni, righe, «Il mese», «Vai a», richieste, filo della barra in basso | `#E1D9CB` | `#E8E3DA` |

Dove stanno: in `app/maison.css`, `:root:has(.mz-home)` (valori del Mac) e,
per il telefono, nello stesso media query della prova «E». Sono sulla radice
perché li leggono anche il fondo della pagina (`body`) e la barra in basso
(`components/BottomNav.tsx`, che usa `var(--home-bg, #F6F2EA)`: fuori dalla
Home resta crema). Valgono solo con la Home aperta (`.mz-home`): la Nuova
prenotazione, che usa anch'essa `.maison`, non cambia.

**Per tornare al crema** basta rimettere `--home-bg: #F6F2EA` (e
`--home-line: #E1D9CB`) nel media query.

Cosa resta com'era:
- fili d'ottone (sopra e sotto i numeri, sotto la striscia della settimana): ottone;
- fogli dal basso (Arrivo, Pulizia, Pagamento, Rimanda) e loro chip: crema, bordo `#DDD3C2`;
- riquadro sotto la striscia della settimana: dal telefono fondo `#F6F2EA` con bordo `#DDD3C2` sul bianco (dal Mac resta `#EFE9DD` come prima);
- menu «WhatsApp ▾»: bianco col bordo.

Verifica a 390 px (anteprima finta, `docs/design/home-sfondo-390.png`):
- fili: `#E8E3DA` si vede bene fra le righe e sotto le sezioni; non è servito `#E2DCD1`;
- foto della striscia: a tutta larghezza, nessun bordo crema intorno;
- «Salvato» aperto nella pagina (Rimanda o salta): il velo ora prende il colore del fondo (bianco 85 %), niente alone crema; nei fogli resta crema;
- grigio `#6E6558`: leggibile sul bianco (contrasto più alto che sul crema);
- dal Mac (1280 px) letti: fondo `rgb(246,242,234)`, fili `rgb(225,217,203)`, come prima.
