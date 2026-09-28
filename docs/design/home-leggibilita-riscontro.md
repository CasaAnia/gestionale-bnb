# Home «Maison» dal telefono — prova E (28/09/2026)

Scelta di Ania: la Home dal Mac resta com'è; sotto `lg` (fino a 1023 px) la
tipografia secondaria passa ai valori della prova «E». Tutto sta in
`app/maison.css`: le variabili `--home-*` sono definite su `.maison` (e
rimesse ai valori del Mac su `.mz`, così i fogli non cambiano), il media
query in fondo al file le cambia per il telefono. Per regolare basta
cambiare un numero lì.

| Variabile | Mac | Telefono (< 1024 px) | Dove |
|---|---|---|---|
| `--home-ui-font` | Jost | Figtree (400/500/600) | testo della Home, azioni, giorni della striscia |
| `--home-mut` | #8A8072 | #6E6558 | grigio dei testi secondari (diventa `--m-mut` della Home) |
| `--home-gutter` | 22px | 16px | margine delle sezioni, striscia foto, richieste, numeri, settimana e riquadro, avvisi d'errore |
| `--home-fs-sec` | 11,5px | 13px | riga sotto l'orario, righe trasporto, dettagli, pulizie, Da controllare, Domani/partenze/cambi |
| `--home-fs-info` | 12,5px | 13,5px | «Linate · 15:00», «Prossimo arrivo», nota del cliente |
| `--home-fw-sec` | 300 | 400 | peso dei testi secondari |
| `--home-fs-lnk` | 10px | **10,5px** (prova E: 11px, vedi sotto) | azioni maiuscolette sottolineate |
| `--home-fs-cap` | 9,5px | 10,5px | giorni della striscia (la didascalia usa 0,5 px in meno) |
| nome negli arrivi | 18px | 19px | `.mz-arr .id .nm` |

Le righe che sul Mac erano mezzo punto sopra o sotto (11px, 12px) usano
`calc(variabile ± .5px)`: sul Mac tutto identico, sul telefono crescono
insieme.

## Verifiche

- **Mac, 1280 px**: stili calcolati (carattere, corpo, peso, colore, margini,
  altezze) di ogni elemento della Home confrontati col CSS di prima:
  identici.
- **Telefono, 390 px** (anteprima finta), punti critici:
  - quattro numeri ed etichette: altezze 28/13 · 28/26 · 28/13 · 28/26, come
    prima («Partenze oggi» e «Da incassare €» erano già su due righe);
  - sette caselle della settimana: una riga, 60 px invece di 59 (solo il
    corpo più grande, niente a capo);
  - «orario + matita + WhatsApp ▾»: 30 px, una riga, come prima;
  - tre azioni delle pulizie: **con 11px andavano a capo** → `--home-fs-lnk`
    ridotta di 0,5 a 10,5px: una riga (345 px su 358 disponibili).
- Schermate: `home-leggibilita-390-prima.png`, `home-leggibilita-390-dopo.png`.
