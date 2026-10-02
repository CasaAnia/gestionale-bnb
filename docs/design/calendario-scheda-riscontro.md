# Calendario: tocco diretto alla scheda e speso del cliente — riscontro (2 ottobre 2026)

Schermate (anteprima finta, dati sintetici): `calendario-scheda-schermate/`
— `cal-quindici-390.png` («2 sett.»), `cal-settimana-390.png` («Sett.»),
`cal-quindici-mac.png`, `cal-settimana-mac.png`.

## 1 · Via il foglietto della prenotazione (commit a parte)
- Un tocco su una scheda del nastro apre direttamente la scheda della
  prenotazione con «‹ Calendario» (`/scheda/<id>?da=calendario`), anche sul
  cambio camera: provato su «⇄ Carla Conti» nell'anteprima, un solo tocco.
- Tolti dal Calendario il foglietto, il secondo tocco e la catena accesa al
  primo tocco. Il foglietto resta nelle Richieste; il foglio della camera
  tenuta resta (non è una prenotazione). Gli Arrivi non usavano questo foglietto.

## 2 · Quanto ha speso il cliente sulla riga del nome
- Stessa cifra della riga «Cliente … · 1.020 € con questa» del foglietto:
  stessa funzione (`lib/spesoCliente`, usata ora anche dal foglietto),
  questa prenotazione compresa, anche un mancato arrivo.
- A destra, senza parole, Cormorant 13 px peso 600, colore del nome. Il nome
  non si stringe: se manca spazio la cifra si accorcia («1.380 €» → «1.380»;
  con i centesimi prima «1.381 €»), se non ci sta per niente non si vede
  (Rita Fontana, una notte in «2 sett.»; Mario Bellini, due notti a 390 px).
- Mese, 2 sett., Sett., telefono e Mac. Non negli Arrivi: lì la riga del nome
  comincia con l'orario d'arrivo, non è la stessa riga. Non nelle Richieste.
- Il rosso del letto in più (filo e casella «2/2», #D0261B) non è toccato.

## Limiti
- Nessuna prova sui dati veri; nessuna migrazione. Nei dati finti tutti i
  soggiorni costano 160 €, per questo le cifre si somigliano.
- Se la scheda continua fuori dallo schermo, la cifra sta in fondo alla riga
  e si vede scorrendo (come il resto del testo).
