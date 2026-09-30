# Fascia della data e barra in basso — checklist (Ania, 30/09/2026)

Riferimento approvato: `docs/design/fascia-data-riferimento.html`, versione E.
Il carattere della bozza è un sostituto: vale il Cormorant vero del gestionale.
Ogni voce alla fine: **fatta** o **non fatta** con il motivo.

## F1 · Fascia del periodo sul telefono (RigaPeriodo)
- [x] F1.1 A destra una colonna di due righe centrate fra loro: sopra il bottone singolo «MESE» (contorno, maiuscoletto 9,5 px, padding 5 × 9; pieno inchiostro col testo avorio quando Mese è accesa).
- [x] F1.2 Sotto «‹ 2 SETT. | SETT. ›»: la pillola a due parti con le frecce attaccate ai lati (gap 6 px).
- [x] F1.3 Fra le due righe 8 px; «MESE» centrato sopra la pillola, non allineato a destra.
- [x] F1.4 A sinistra il periodo CON l'anno («27 set – 10 ott 2026»; in Mese il mese e l'anno) in Cormorant, centrato nello spazio a sinistra della colonna (orizzontale e verticale), su una riga.
- [x] F1.5 Grandezza: da 36 px in giù di 1 px finché il periodo più lungo sta su una riga a 390 px; stessa grandezza per tutti i periodi. Valore scelto scritto nel riscontro.
- [x] F1.6 La fascia si alza quanto serve (padding 10 sopra, 12 sotto); il resto scende, niente altro cambia.
- [x] F1.7 Tocco su «MESE» → vista Mese (MESE pieno, nella pillola sotto nessuna parte accesa).
- [x] F1.8 Tocco su «2 SETT.» o «SETT.» → quella vista, MESE torna a contorno.
- [x] F1.9 Le frecce fanno quello che fanno oggi in ogni vista; la scelta si ricorda come oggi.

## F2 · Dove: Calendario, Arrivi, Richieste, telefono E Mac
- [x] F2.1 Stessa fascia sul telefono in Calendario, Arrivi e Richieste.
- [x] F2.2 Dal Mac la stessa fascia: colonna «MESE» sopra «‹ 2 SETT. | SETT. ›» a destra, periodo con l'anno a sinistra centrato.
- [x] F2.3 Dal Mac la grandezza del periodo con la stessa regola partendo da 40 px. Valore scritto nel riscontro.
- [x] F2.4 Dal Mac la vista «Sett.» coi giorni da 145 px.
- [x] F2.5 Il resto del Mac resta com'è.

## F3 · Riga dei letti in più
- [x] F3.1 «🛏 EXTRA», «1/2», «2/2» rosso pieno, tratteggio per quelli tenuti: identica a oggi (carattere, grandezza, colori).

## F4 · «Legenda» sotto «Oggi» a 28 px
- [x] F4.1 Fatta ora, oppure «già fatta».

## F5 · Barra in basso del telefono
- [x] F5.1 «Oggi · Calendario · Richieste · Arrivi · Pulizie»: via «Menu», al suo posto «Pulizie» con la sua icona a filo nello stesso stile, che apre le Pulizie di oggi.
- [x] F5.2 Se «Pulizie» c'era ed è stata tolta, il commit che l'ha tolta.

## Riscontro
- [x] Schermate a 390 px: Calendario in «2 SETT.», «SETT.» e «MESE»; Arrivi; Richieste; la barra in basso.
- [x] Le stesse tre pagine dal Mac.
- [x] Valore in px del periodo sul telefono e sul Mac.
