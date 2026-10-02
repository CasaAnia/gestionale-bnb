# Pulizie · ritocchi del 2 ottobre 2026 — riscontro

Riferimenti: `pulizie-timer-riferimento.html`, `pulizie-fondo-riferimento.html`.
Checklist voce per voce: `pulizie-timer-checklist.md`. Schermate (anteprima
finta, dati sintetici, 390 × 844 e Mac 1280): `pulizie-timer-schermate/`.

## Fatto
- **T1** comandi del timer sulla scheda (in corso, in pausa, a zero, minuti a
  mano, «✓ 35 minuti segnati · correggi»; «Pulita» salva coi minuti senza
  foglio; «Pulita e recuperato» apre il foglio coi minuti già scritti).
- **T2** spazi comuni come le camere; i minuti si aggiungono (12 + 2 = 14 dal
  timer, 23 + 5 = 28 a mano), il tocco sul totale apre il foglio.
- **T3** «Fuori dalle camere» tolta; prossime pulizie e rinvii nella veste
  della pagina; nota sul Registro; link della Home agli spazi comuni.
- **T4** «cambio biancheria della 4ª notte».
- **T5** Statistiche: con meno di 4 settimane di pulizie coi letti segnati
  niente medie, totali «nel periodo».

## Scelte da sapere
- Lo sfondo avorio della scheda c'è anche in pausa e coi minuti a mano
  aperti, come nelle schermate 2, 3 e 5 del riferimento (prima solo in corso).
- La frase è cambiata anche nella striscia del grafico della giornata
  («biancheria quando esce» → «biancheria della 4ª notte»).
- Le camere già pulite oggi restano fra gli spazi comuni e «Prossime
  pulizie», dove stavano nel riferimento del 01/10.
- Con pochi dati il titolo della prova lavanderia diventa «Prova lavanderia ·
  nel periodo», perché i numeri sotto non sono più al mese.
- Il vecchio timer «Area comune» di un altro giorno, fermato sotto il
  corridoio, scrive i minuti nel suo giorno e lo dice in una riga grigia.
- Nel cambio camera la riga sotto dice «parte …», come la fine soggiorno.

## Non fatto / limiti
- «Anticipa» non è visto a schermo: nei dati finti non c'è un cambio
  biancheria anticipabile. È provato nel codice e nei test.
- Nessuna prova sui dati veri; nessuna migrazione (non serve).
- Fuori incarico: su main 62f0f5f due prove di `regolaFogli` fallivano dopo
  l'unione Fogli + Pulizie; le ho riallineate (commit «Suite: …»), senza
  cambiare le regole.
