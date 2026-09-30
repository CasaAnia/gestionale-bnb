# Biglietti Casa Ania approvati — 27 settembre 2026

Ania ha approvato entrambe le versioni: solo fronte e fronte-retro. Conservare i testi, l'avorio delicato, i colori pieni, l'assenza di cornice e le linee dorate corte. Le future consegne di materiale approvato devono includere un PDF per la tipografia, oltre all'anteprima.

## File da inviare

In `public/materiale-stampa/biglietti-2026-09-27/`:

- `Casa-Ania-biglietto-solo-fronte-STAMPA.pdf`: una pagina.
- `Casa-Ania-biglietto-fronte-retro-STAMPA.pdf`: pagina 1 fronte, pagina 2 retro, entrambi orizzontali.
- `solo-fronte.png`, `fronte.png`, `retro.png`: anteprime e master raster approvati, incorporati senza compressione con perdita nei PDF.

## Specifiche

- Formato finito: 85 × 55 mm.
- Pagina PDF: 91 × 61 mm, con 3 mm di abbondanza su ogni lato.
- TrimBox: 85 × 55 mm, centrato. BleedBox: intera pagina. Nessun crocino.
- Fondo esteso fino al bordo dell'abbondanza: RGB `#FFFBF2`.
- Stampa al 100%, senza adattamento alla pagina.
- Immagini 1560 × 1010 px sul formato finito: circa 466 ppi, senza dipendenze dai font sul computer della tipografia.
- Colori RGB. PDF standard, non certificato PDF/X. Nessuna lamina metallica: l'oro è un colore stampato. La finitura lucida si sceglie nell'ordine di stampa.
- Se la tipografia richiede un profilo CMYK, un PDF/X, crocini o un'abbondanza diversa, adattare una copia al suo template: non inventare il profilo né sostituire gli originali approvati.

Gli SVG di questa cartella sono sorgenti editabili con riferimenti a Georgia e Nunito Sans: non inviarli direttamente alla tipografia senza incorporare o convertire i font. I PDF conservano esattamente le anteprime approvate.

## Verifiche eseguite

Rilettura PDF: conteggio pagine, MediaBox, TrimBox, presenza delle immagini. Tutte e tre le pagine renderizzate con Poppler e controllate visivamente: nessun taglio, sovrapposizione o texture. Nessuna prova fisica di stampa eseguita.
