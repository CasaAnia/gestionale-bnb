# Calendario: dito premuto su una scheda → riquadro (versione D) — riscontro

02/10/2026 sera, Claude. Base `fe049d4`, branch `calendario-premuto`, due commit.
Prove su anteprima finta (`ANTEPRIMA_RIQUADRO_PREMUTO=1` in
`scripts/revisioni/anteprima-prenotazioni-finta.mjs`), dati solo sintetici.
Gesti provati con pointer events sintetici (dito e mouse): nessuna prova su
un iPhone vero.

## Checklist

- ✅ 1. Tocco breve → `/scheda/<id>?da=calendario`, come prima.
- ✅ 2. 500 ms premuti aprono il riquadro (a 300 ms non c'è, a 600 ms sì); al rilascio sparisce.
- ✅ 3. Spostamento di 12 px a 200 ms → niente riquadro; con 5 px resta.
- ✅ 4. Dopo un dito premuto il clic che segue non apre la scheda (si azzera al pointerdown successivo).
- ✅ 5. Sulla scheda: `-webkit-touch-callout: none`, `user-select: none`, `touch-action: pan-x pan-y`, `contextmenu` annullato. Lente/menu verificati solo come stile, non su iOS vero.
- ✅ 6. Mouse: tasto sinistro tenuto 500 ms apre, rilascio chiude; tasto destro niente; clic normale apre la scheda.
- ✅ 7. Mese, 2 sett., Sett. a 390×844, 844×390 e 1280×800. In orizzontale (390 di altezza) il riquadro va al centro con `max-height`, ma il contenuto lungo è tagliato in fondo (vedi Limiti).
- ✅ 8. Richieste dal sito da confermare: nessun gesto (51 schede premibili su 55: 1 dal sito + 3 camere tenute escluse).
- ✅ 9. Nessuna scritta in fondo, nessun tasto.
- ✅ 10. Righe e ordine della tabella. Due scelte di Ania del 02/10: bagagli nella riga Arrivo («bagagli alle 11:00», solo se c'è), Partenza senza bagagli; Cliente con «già ospite N volte» / «prima volta», mai «già stata/o».
- ✅ 11. Voci del Da fare nell'ordine dato, letto in più `#D0261B` peso 600.
- ✅ 12. «da chiedere» e «restano X €» in `#6E6558` (letto dal browser: rgb(110, 101, 88)).
- ✅ 13. Filo rosso del letto e riga EXTRA non toccati (nessuna modifica a `.cal-letto` né alla riga EXTRA).
- ✅ 14. `FogliettoPrenotazione` resta, usato solo da `NastroRichieste`; il calendario non lo apre.

## File

- `components/calendario/SchedaPrenotazione.tsx` — il gesto (`useDitoPremuto`), `onPremi`/`onRilascia`
- `components/calendario/Nastro.tsx` — `gesti` sul contenitore, classe `premibile`
- `components/calendario/RiquadroPremuto.tsx` — velo, riquadro, contenuto
- `app/calendario/page.tsx` — stato `premuta`, pagamenti col metodo, `contenutoPremuto`
- `app/maison.css` — `.cal-scheda.premibile`, `.cal-pk*`
- `lib/daFarePrenotazione.ts` (+ test, 13 prove) e `lib/riquadroPremuto.ts` (+ test, 9 prove)
- `lib/calendarioMaison.test.ts`, `lib/settimanaCompleta.test.ts` — guardie aggiornate al nuovo `onClick`
- `scripts/revisioni/anteprima-prenotazioni-finta.mjs` — scenario `ANTEPRIMA_RIQUADRO_PREMUTO`

## Dati che non esistono

- **«fare la ricevuta»**: nel database non c'è nessun modo di segnare la
  ricevuta come fatta (solo `guests.vuole_ricevuta`). La voce resta finché
  la prenotazione non è passata (partenza ≥ oggi). Nessuna colonna creata.
- **«controllare il bonifico»**: sparisce con un pagamento registrato con
  metodo bonifico; non compare nemmeno quando il conto è già saldato
  (con un altro metodo non c'è più nessun bonifico da aspettare).
- Telefono e Note: compaiono solo se ci sono.
- Ospiti: formato dei periodi quello attuale della scheda
  (`periodoOspitiTesto`, notti incluse: «3 ott.», «4–6 ott.»), non «28 → 29 set»
  del disegno: è la regola delle notti effettive del 01/10.
- Cambio camera: dalla stessa catena dell'icona ⇄, ma solo i passaggi veri
  (una camera lasciata il giorno in cui comincia l'altra): due camere nelle
  stesse notti non sono un cambio.

## Limiti

- Telefono in orizzontale: il riquadro alto più di 358 px è tagliato in
  fondo e non si può scorrere (il dito è premuto, il riquadro non riceve
  tocchi). Schermata `orizzontale-844x390-tagliato.jpg`. Da decidere con Ania.
- Nessuna prova su iPhone vero né sui dati veri (schermate dalla sola anteprima finta).

## Schermate

- `390-con-da-fare.jpg` — sei voci del Da fare (Susanna Esempio, dati finti)
- `390-senza-da-fare.jpg` — nessuna voce (Marco Esempio)
- `mac-con-da-fare.jpg` — dal Mac, 1280×800
- `orizzontale-844x390-tagliato.jpg` — il limite in orizzontale
