# Pulizie · timer sulla scheda, spazi comuni, fondo pagina — checklist (2 ottobre 2026)

Riferimenti approvati da Ania: `pulizie-timer-riferimento.html` (schermate 1–5)
e `pulizie-fondo-riferimento.html`. Lo stile resta quello della pagina Pulizie
già pubblicata (Cormorant e Jost, colori, grandezze, link sottolineati in
maiuscoletto). Nessun tasto pieno nero nella pagina.

Esito di ogni voce in fondo alla riga: «fatta» / «non fatta» col motivo.

## T1 · I comandi del timer sulla scheda della camera
- [x] T1.1 In corso: numero nero, «IN CORSO», «PAUSA» (come oggi). → **fatta — pulizie-timer-schermate/t1-1-ambra-in-corso-390.jpg**
- [x] T1.2 Fermo da poco o in pausa (secondi > 0): numero avorio scuro #C9BFA8, «IN PAUSA», sotto la riga «RIPRENDI · FERMA E RIPORTA I MINUTI · AZZERA · MINUTI A MANO» (gli ultimi due in grigio, bordo #D8D1C4). → **fatta — pulizie-timer-schermate/t1-2-ambra-in-pausa-390.jpg**
- [x] T1.3 Fermo e a zero: «00:00» avorio, «AVVIA» (e «MINUTI A MANO»). → **fatta — pulizie-timer-schermate/t1-4-ambra-a-zero-390.jpg**
- [x] T1.4 «Minuti a mano» apre sotto, sulla scheda, un campo piccolo a filo (Cormorant 26, 70 px) con «minuti» e i link «SALVA» · «ANNULLA»; se ci sono già minuti il campo parte da quelli. → **fatta — pulizie-timer-schermate/t1-3-ambra-minuti-a-mano-390.jpg (in pausa a 0:33 il campo partiva da 1, i minuti del timer per eccesso)**
- [x] T1.5 Dopo «Ferma e riporta» o «Salva»: al posto del timer la riga verde «✓ 35 minuti segnati · correggi»; «correggi» riapre il campo. → **fatta — pulizie-timer-schermate/t1-5-ambra-minuti-segnati-390.jpg**
- [x] T1.6 «Pulita» salva la pulizia con quei minuti senza aprire il foglio. → **fatta — anteprima finta: «Pulita» con 35 minuti segnati → «Ambra ✓ Pulita 12:28 · 35 min», nessun foglio aperto**
- [x] T1.7 «Pulita e recuperato» apre il foglio come oggi, con quei minuti già scritti. → **fatta — anteprima finta: il foglio si apre con «35 min» già scritti**
- [x] T1.8 Stessa logica di TimerPulizia (un solo timer alla volta, avviso «Un altro timer è in corso», minuti per eccesso, rilettura dal server); le stesse cose restano anche dentro il foglio. → **fatta — stesso TimerPulizia (un timer alla volta, avviso «Un altro timer è in corso» visto su Amelia, minuti per eccesso, valori riletti dal server); il foglio tiene i suoi comandi**
- [x] T1.9 Nessun tasto pieno nero: anche «Pulita» col timer in corso è un link sottolineato. → **fatta — nessuna classe di tasto pieno nella pagina (prova in lib/pulizieTimerScheda.test.ts)**

## T2 · Spazi comuni uguali alle camere
- [x] T2.1 Titolo di sezione maiuscoletto ottone «SPAZI COMUNI» col filo. → **fatta — pulizie-timer-schermate/t2-spazi-comuni-in-pausa-390.jpg**
- [x] T2.2 Una scheda per voce («Corridoio e angolo caffè», «Piegatura asciugamani», «Altro»): nome in Cormorant 27 px su una riga, sotto in grigio «oggi 12 minuti segnati» / «oggi niente segnato». → **fatta — stessa schermata**
- [x] T2.3 Timer grande con gli stessi colori e comandi di T1; scheda col timer in corso con lo sfondo sfumato avorio. → **fatta — stessa schermata (sfondo avorio col timer in pausa)**
- [x] T2.4 «Ferma e riporta i minuti» e «Salva» AGGIUNGONO i minuti a quelli di oggi (12 + 23 = 35), la riga diventa «oggi 35 minuti segnati». → **fatta — anteprima finta: Corridoio 12 + 2 dal timer = «oggi 14 minuti segnati» e timer a zero; Piegatura a mano 23 poi 5 = «oggi 28 minuti segnati»**
- [x] T2.5 Un tocco su «oggi 35 minuti segnati» apre il foglio «Spazi comuni · minuti a mano» per correggere il totale. → **fatta — il tocco su «oggi 28 minuti segnati» apre il foglio di Piegatura col campo a 28**
- [x] T2.6 Per «Altro» la riga «Cosa · facoltativo» resta nel foglio. → **fatta — il foglio di «Altro» ha ancora «Cosa · facoltativo»**

## T3 · Sotto gli spazi comuni
- [x] T3.1 Tolta la sezione «Fuori dalle camere» (TempiFuoriCamera) dalla pagina Oggi. → **fatta — TempiFuoriCamera tolto dalla pagina e cancellato (non lo usava nessun altro)**
- [x] T3.2 Niente si perde: giorni passati dal Registro (riga spazi comuni → foglio dei minuti); il timer «area_comune» di prima, se in corso, si legge sotto «Corridoio e angolo caffè». → **fatta — anteprima finta con un timer «Area comune» del 01/10 in pausa: compare sotto «Corridoio e angolo caffè», «Recupera minuti» porta lì, «Ferma e riporta» scrive 1 min nella riga area_comune del 01/10 e il timer torna quello di oggi**
- [x] T3.3 Il link «Tempi fuori dalle camere ↗» in Home porta alla sezione Spazi comuni. → **fatta — dalla Home il link apre /pulizie#spazi-comuni e la pagina scende alla sezione (anche i vecchi link #fuori-camera)**
- [x] T3.4 «PROSSIME PULIZIE» e «RINVII E SALTI»: titolo maiuscoletto ottone col filo. → **fatta — pulizie-timer-schermate/t3-fondo-pagina-390.jpg**
- [x] T3.5 Righe: camera in Cormorant 21, tipo in maiuscoletto grigio («FINE SOGGIORNO», «BIANCHERIA 4 NOTTI», «CAMBIO CAMERA»), data a destra Cormorant 19 peso 600 («sab 4 ott»), sotto in grigio chi parte o chi resta e «da fare». → **fatta — stessa schermata («Lena FINE SOGGIORNO … lun 5 ott», «parte Giovanni Serra · da fare»)**
- [x] T3.6 «ANTICIPA» link sottolineato sulla stessa riga quando oggi si può anticipare. → **fatta nel codice e nelle prove; NON vista a schermo: nei dati finti non c'è un cambio biancheria anticipabile**
- [x] T3.7 Rinvii e salti attenuati (opacità .65): «Ambra · RIMANDATA · 1 → 2 ott · non conta fra le pulizie fatte» / «cambio saltato». → **fatta — stessa schermata («Amelia RIMANDATA 2 → 3 ott · non conta fra le pulizie fatte»; rinvio fatto nell'anteprima)**
- [x] T3.8 In fondo la nota grigia «I tempi dei giorni passati si correggono dal Registro, toccando la riga degli spazi comuni.» → **fatta — stessa schermata**

## T4 · Frase
- [x] T4.1 «cambio biancheria quando esce» → «cambio biancheria della 4ª notte» ovunque (pagina Pulizie, scheda di chi resta). → **fatta — scheda di chi resta e anche la riga del grafico della giornata («Lucia Ferri resta · biancheria della 4ª notte»)**

## T5 · Statistiche, medie con pochi dati
- [x] T5.1 «Completi usati»: se il periodo scelto è più corto di 28 giorni, oppure le pulizie coi letti segnati coprono meno di 28 giorni, niente righe «a settimana / al mese / all'anno»: una riga sola «nel periodo» coi totali veri (es. 1 · 0 · 2) e sotto in grigio «Le medie compaiono con almeno 4 settimane di pulizie segnate.» → **fatta — pulizie-timer-schermate/t5-statistiche-2-giorni-390.jpg («nel periodo 1 · 0 · 2») e pulizie-timer-schermate/t5-statistiche-3-mesi-390.jpg (medie presenti)**
- [x] T5.2 Stessa regola per «Mandati a lavare · al mese»: colonna «Nel periodo» invece di «Al mese». → **fatta — stessa schermata dei 2 giorni**
- [x] T5.3 Stessa regola per la «Prova lavanderia»: «Costo del periodo» invece di «Al mese, circa». → **fatta — pulizie-timer-schermate/t5-lavanderia-2-giorni-390.jpg**

## Prove
- [x] Suite verde prima di ogni push. → **fatta — npm test 2086/2086, TypeScript e lint puliti, build riuscita (con ambiente finto)**
- [x] Schermate a 390 px: una camera nei quattro stati del timer, minuti a mano aperti, spazi comuni con un timer in pausa, fondo pagina; Statistiche con un periodo di 2 giorni e con 3 mesi; pagina intera dal Mac. → **fatta — cartella pulizie-timer-schermate/ (pagina-intera-390.png, pagina-intera-mac-1280.png)**
