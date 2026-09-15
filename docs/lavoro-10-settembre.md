# Il lavoro sul gestionale dal 10 al 15 settembre 2026

Documento per chi non c'era. Racconta cosa è cambiato nel gestionale di Casa Ania
in questi sei giorni, cosa si vede adesso nelle pagine, quali regole sono state
fissate da Ania e cosa è rimasto indietro.

Tutto quello che c'è scritto è ricavato dal repository `gestionale-bnb`: la
storia dei salvataggi su `main`, il documento di consegna `CONSEGNA-ATTIVA.md` e
le note scritte dentro il codice che riportano le decisioni di Ania con la data.

I codici fra parentesi tipo `a1b2c3d` sono i numeri dei salvataggi (commit): a
chi controlla servono per ritrovare la modifica esatta.

---

## 1. In breve

In sei giorni il gestionale ha cambiato faccia in tre punti.

**Le prenotazioni si contano come una cosa sola.** Prima una prenotazione con
due camere, o con un cambio camera, era spezzata in più righe e ognuna aveva il
suo conto. Adesso conto, pagamenti, caparra e annullamento valgono per l'intera
prenotazione, con tutte le sue camere.

**La pagina delle Richieste è stata rivestita da capo** e adesso si legge come
la Home: una riga per richiesta con nome, date, persone, camera e prezzo, gli
avvisi scritti a parole, e dentro la richiesta si vede subito se la cliente è già
stata da noi, quanto ha speso e i suoi soggiorni.

**Sono nate due pagine nuove, non ancora al posto delle vecchie:** la scheda di
una prenotazione all'indirizzo `/scheda/<numero>` e l'inserimento di una nuova
prenotazione all'indirizzo `/nuova-prenotazione`. Le vecchie ci sono ancora e
restano quelle in uso.

Il pezzo su cui si è lavorato di più è **la striscia delle notti**: una fila di
colonnine, una per notte, con la camera di quella notte, il letto in più e
quante persone ci dormono. Si tocca una notte e si sistema solo quella. È lo
stesso pezzo nella scheda e nell'inserimento.

Infine sono stati messi in ordine i **nomi dei modi di pagamento**, che prima
cambiavano da pagina a pagina, e sono stati corretti parecchi difetti trovati da
Ania provando le pagine dal telefono e dal Mac.

---

## 2. Giorno per giorno

### Mercoledì 10 settembre — la prenotazione diventa una cosa sola

**Prenotazioni e conto** (`8c6ccd0`, `f13f5b5`, `4162035`)
- La prenotazione intera è ora distinta dal singolo cambio camera: conto,
  pagamenti, caparra, storico, cliente e annullamento si riferiscono a tutte le
  camere insieme. In pagina: aprendo una prenotazione con due camere si vede un
  totale solo, non due.
- Applicate sul database le modifiche numerate 0046, 0047, 0048 e 0049, dopo un
  salvataggio completo di sicurezza (35 tabelle, 3.241 righe) e una prova di
  scrittura contemporanea su un database di prova.
- Una camera aggiunta a una prenotazione esistente eredita l'accordo di
  pagamento e non crea una seconda caparra.

**Scheda della prenotazione, quella vecchia** (dodici salvataggi fra `7830d00` e
`c814c1a`)
- Arrivo e partenza si cambiano dalla scheda; l'orario e la navetta stanno in un
  riquadro verdino, uno a sinistra e uno a destra.
- Il soggiorno si cambia tutto insieme: un solo «Modifica» e un solo «Salva»,
  date, camere e ospiti compresi.
- La pagina si è accorciata: meno righe orizzontali, niente doppioni, il totale
  dei soggiorni più grande, il pagamento su una riga sola.
- Un solo bottone per i pagamenti: «Registra pagamento» segna anche la
  prenotazione come pagata.
- «Persone in arrivo» compare solo quando dorme davvero un'altra persona.
- Il letto aggiuntivo, quando non c'è, non scrive «no»: lascia vuoto.

**Altro**
- Nella conferma WhatsApp la cancellazione gratuita si dice a 7 giorni
  (`6c05686`).
- Sul telefono resta una barra sola in cima, con la freccia di ritorno dentro il
  titolo (`4e2097f`).
- Pulizie: una camera si conta il giorno della sua pulizia e non anche nei
  giorni dopo (`73cab39`).

### Giovedì 11 settembre — Home, pagamenti e la veste nuova della proposta

**Home** (`d9398e1`, `0b831dc`)
- Le pulizie del giorno stanno in un posto solo, in cima alla pagina.
- La nota del cliente si legge anche dalla Home.

**Pagamenti** (`870be72`, `b2d5458`, `99bc3c6`, `5d39c8f`, `1f4b3f5`)
- Un soggiorno, un pagamento: le camere di fila fanno una voce sola invece di
  tante.
- Dei soggiorni lunghi si controlla solo la parte ancora da saldare.
- Dopo «Registra pagamento» compare una conferma verdina al centro dello
  schermo, su due righe.

**Titoli** (`211fff7`, `e6c2232`, `9291f48`)
- Sul telefono il titolo non si ripete: lo dice già la barra in alto. Lo spazio
  però resta, così passando da una pagina all'altra il contenuto non salta.

**Pagina della proposta a una richiesta** (`cf19c4f`, `0a86f3e`, `c84ecb0`,
`34ee511`, e una ventina di rifiniture fino a `b2813a9`)
- La pagina è stata rivestita: una testa col cliente, una fascia con le sezioni,
  le camere a spunta.
- Per tre persone la proposta elenca le camere una per una, invece di dire un
  numero solo.
- Nel messaggio WhatsApp il grassetto viene fuori davvero: nell'anteprima si
  legge in grassetto, negli asterischi solo nel testo che parte.
- «Come paga» ha sempre i suoi quattro bottoni, anche su una proposta già
  inviata.
- Il messaggio riscritto a mano non si butta via: si avvisa.
- Le persone per notte si leggono in parole, e la riga della camera dice il
  prezzo di ogni notte.

### Venerdì 12 settembre — la pagina delle Richieste, rifatta

Il grosso della giornata è una riscrittura della pagina, fatta in più passate
sulla base delle correzioni di Ania. Il risultato finale:

- **La riga di ogni richiesta è quella di «Da controllare» della Home**
  (`a8ed29d`, `ac11371`, `08033b2`): nome grande, sotto notti, persone, camera e
  prezzo; i numeri e la camera si leggono grandi come il nome, la nota della
  cliente in rosso.
- **Si vede subito chi è già stata da noi**: nell'etichetta in alto «già stata
  qui 2 volte» oppure «già in archivio», la stella d'ottone per le clienti
  ottime, «ricevuta» se la vuole, e quanto ha speso in tutto.
- **Dentro la richiesta c'è la parte CLIENTE** (`58d6be9`): quanti soggiorni,
  quanto ha speso, da dove arriva, e i suoi soggiorni uno per riga.
- **I comandi sono una fascia sola** (`3ddf1ba`): ARRIVO · DURATA · PERSONE ·
  DA GUARDARE, in maiuscoletto, con quella accesa in ottone.
- **Le richieste che si accavallano hanno un segno tutto loro** (`df5f49c`,
  `c556910`), e si legge da quanto tempo è arrivata ogni richiesta.
- **Il numero di telefono è obbligatorio** in ogni richiesta (`248de2c`).
- **Le tre pagine cominciano dallo stesso punto** (`07bbbcf`): Calendario,
  Arrivi e Richieste partono tutte a 112 px dal bordo alto del telefono.
- Nei messaggi di tutti i giorni si saluta col solo nome; nella conferma senza
  immagine si scrive nome e cognome (`a9f9996`).

### Sabato 13 settembre — la scheda nuova, la striscia, «Come paga», l'inserimento nuovo

Giornata lunga, quattro cose grosse.

**La scheda nuova della prenotazione, a `/scheda/<numero>`** (`4110b7e`,
`a9a7d28`, `e811c48`, `cd0e48a`, `f5b978c`, `6d75818`)
- In cima: chi è, le date con la freccia in mezzo, ospiti e camera, quanto c'è da
  incassare in rosso, telefono e documenti.
- Cinque linguette: Controllare · Soggiorno · **Conto** · Messaggi · Cliente.
- Il CONTO dice quanto manca in grande, con le righe delle camere, lo sconto e il
  totale.
- I MESSAGGI hanno i testi di sempre; la CRONOLOGIA dice cosa è stato mandato.
- Dall'elenco delle prenotazioni si apre con il link «nuova ›» (`5468e29`).

**La striscia delle notti** (`767977b`, `0085bab`, `62997cc`, `1028544`)
- Una colonnina per notte: sopra il giorno, in mezzo la camera di quella notte
  (una tinta per camera), sotto il quadratino del letto in più.
- Dove la camera cambia da una notte all'altra compare il segno ⇄ d'ottone.
- Nella scheda la striscia prende il posto del vecchio foglio «Modifica
  soggiorno» a tre passi.

**«Come paga», un nome solo in tutto il gestionale** (`d75cd91`, `fe0b52b`,
`22bed21`, `2afdca8`)
- Prima la stessa cosa si chiamava «Come paga» nella proposta, «Pagamento»
  nell'inserimento e «Accordo» nella scheda, con nomi diversi per la stessa
  scelta. Adesso i sei modi hanno un nome solo, scritto in un posto solo.

**La pagina nuova di inserimento, a `/nuova-prenotazione`** (`13067a2`,
`53235ee`, `dfd3dc7`, `11c57de`, `a881e0e`, `f58a6b4`)
- Si parte dalla ricerca del cliente, poi il soggiorno con la striscia delle
  notti, poi arrivo, come paga, con lei e la nota, con il conto in vista.
- Dopo il salvataggio si apre la scheda nuova.

**Una correzione sui soldi** (`49f8765`, `f0c23eb`)
- Con uno sconto, nel totale salvato finiva il prezzo pieno: il conto della
  prenotazione mostrava 280 € dove la cliente ne pagava 252. Da adesso tutte e
  due le pagine di inserimento scrivono il totale già scontato; per le righe
  vecchie è pronta la correzione numerata 0050 (vedi il capitolo 5).

### Lunedì 14 settembre — la pagina nuova di inserimento si sblocca

Ania ha provato a inserire una prenotazione vera e si è fermata al primo passo.
Sono venuti fuori, uno dopo l'altro, difetti che si tenevano in catena. Elenco
solo il risultato finale.

**Quello che bloccava tutto**
- **Le date non si cambiavano** (`1ce2253`, `23d4de2`): sul Mac toccare il testo
  di un campo data non apre niente, il calendario si apre solo dall'iconcina, che
  lì è nascosta. Adesso al tocco si apre il calendario del telefono o del
  computer, e la data si legge in italiano: «gio 10 set».
- **Gli ospiti si fermavano a 2** (`2f9feb0`, `d249777`): il massimo veniva
  chiesto a una camera che non era ancora stata scelta. Adesso è quello vero
  della camera (Lena 4, Allegra e Ambra 3, Amelia 2) e, prima di sceglierla,
  quello della camera più capiente della casa.
- **Il salvataggio veniva rifiutato dal database** col letto acceso
  (`8583310`): si scriveva l'importo del letto vuoto accanto al modo «a notte», e
  la regola vuole tutti e due o nessuno dei due.

**La striscia guarda notte per notte** (`fcd2726`, `29a1d9b`, `c3c63b5`,
`0dba89d`, `42f7cc2`)
- La disponibilità si chiedeva per l'intero periodo: bastava una notte piena
  perché la camera risultasse occupata per tutto il soggiorno. Adesso si chiede
  una notte alla volta, e la camera scelta va solo nelle notti in cui è libera.
- I cambi camera si contano solo fra due notti che hanno tutte e due una camera.
- Sotto la striscia c'è scritto solo quello che manca — «lun 14 e mar 15 senza
  camera» — e le notti senza camera non mostrano né letto né numero di persone.
- **La camera si tiene notte per notte**: toccando il «+» degli ospiti o le date
  non si perde più quello che era stato sistemato a mano su una notte.

**Il resto della pagina** (`9d89158`, `2a83232`, `b88b991`, `520c785`,
`65c163b`, `602d1d6`)
- La tariffa a notte si riempie da sola col listino della camera.
- Il blocco del letto in più compare appena la camera lo prevede.
- Il conto dice in ottone cosa manca davvero, invece di «da completare».
- «+ Aggiungi camera» si prende col dito (l'area del tocco è passata da 29 a
  44 px).
- «Salva la prenotazione» o salva, o scrive in mattone il campo che manca e
  porta la pagina su quel campo.
- Con 4 ospiti in Lena la notte va a 100 €, e il letto si accende da solo.

**La parte della notte scelta** (`1edda89`, `91703b4`, `15bd52e`, `f188d28`,
`4f3f508`, `da6e739`)
- Toccando una notte non si apre più un foglietto dal basso: la notte si
  seleziona (contorno d'ottone) e sotto la striscia compare la sua parte, con
  tutte le camere, gli ospiti e il letto di quella notte.
- Il letto non tocca più gli ospiti: prima i due comandi si annullavano a
  vicenda e non si riusciva a tenere tre persone col letto acceso.
- Accanto a «Sì» c'è il costo di quella notte: «Sì · 10 €» oppure «Sì ·
  compreso».
- «Solo questa notte» e «da qui in poi» sono una scelta e non due tasti: si passa
  dall'una all'altra quante volte si vuole, e tornando indietro le notti
  successive tornano esattamente com'erano.

**L'ordine della pagina** (`c19c7d7`)
- Il conto è salito subito sotto il soggiorno: scegliendo una camera i numeri si
  vedono senza scorrere fino in fondo. In fondo resta solo il tasto per salvare.

### Martedì 15 settembre

- Scritto questo documento. Nessuna modifica al programma.

---

## 3. Le pagine nuove e dove sono

| Indirizzo | Cos'è | Stato |
|---|---|---|
| `/scheda/<numero>` | La scheda di una prenotazione, veste nuova | **Completa ma non ancora al posto della vecchia.** Si apre solo dall'elenco delle prenotazioni, col link «nuova ›». |
| `/prenotazioni/<numero>` | La scheda di una prenotazione, veste vecchia | **È ancora quella in uso.** Ci arrivano Home, Calendario, Arrivi, Clienti, Richieste e la conferma di una richiesta. |
| `/nuova-prenotazione` | L'inserimento di una nuova prenotazione, veste nuova | **Funziona e salva davvero,** ma non è collegata a nessun tasto: ci si arriva scrivendo l'indirizzo. |
| `/nuova` | L'inserimento di adesso | **È ancora quello in uso**: è il tasto «Nuova» del menù. |

In parole povere: le due pagine nuove esistono, sono state provate e salvano nel
database vero, ma i tasti del gestionale continuano a portare alle due vecchie.
Il passaggio va deciso da Ania.

---

## 4. Le decisioni di Ania

Regole fissate in questi giorni. Valgono per tutto il gestionale: sono scritte in
un posto solo nel programma, così non possono cambiare da una pagina all'altra.

**I sei modi di pagamento, in due gruppi** (deciso il 13 settembre)

| Gruppo | Modi |
|---|---|
| **Quando arriva** | Contanti · Bonifico · Da vedere |
| **Prima di arrivare** | Tutto · Caparra del 50% · Caparra |

Sotto i bottoni si legge la frase per esteso: per esempio «paga tutto in contanti
quando arriva», oppure «caparra del 50%, il resto all'arrivo». Con «Caparra del
50%» e «Caparra» si chiede anche entro quando; solo con «Caparra» si scrive
l'importo a mano.
*Dove si applica:* la parte si chiama **«Come paga»** nell'inserimento di adesso,
nella pagina nuova di inserimento, nella scheda nuova e nella pagina della
proposta. Nella scheda nuova la linguetta in alto si chiama **CONTO**.

**La riga sotto ogni totale** — «5 notti · 77,40 € a notte». Dice quante notti
sono e quanto viene mediamente una notte, sconto compreso.
*Dove si applica:* il conto della scheda nuova e il conto della pagina nuova di
inserimento.

**Davanti al nome della cliente** (deciso il 13 settembre) — prima l'emoji della
ricevuta 🧾 se la cliente la vuole, poi la stella ★ d'ottone se è una cliente
ottima, poi il nome.
*Dove si applica:* elenco delle richieste, elenco delle prenotazioni, calendario,
ricerca del cliente nella pagina nuova di inserimento, testa della scheda.

**La striscia delle notti** — una colonnina per notte con, dall'alto: il giorno,
la camera di quella notte, il quadratino del letto in più e il numero di persone
che ci dormono. Il numero passa al mattone quando è diverso da quello del
soggiorno. Dove la camera cambia da una notte all'altra c'è il segno ⇄ d'ottone.
Una notte senza camera resta col «?» e non mostra né letto né numero.
*Dove si applica:* la scheda nuova e la pagina nuova di inserimento. È lo stesso
pezzo di programma, non due copie.

**Il prezzo del letto in più** — Amelia 5 €, le altre camere 10 €. Si sceglie in
tre modi: **a notte**, **ogni 4 notti**, **totale concordato**. In Lena il terzo
posto è compreso nel prezzo della tripla e il letto non si paga; a quattro
persone invece sì. In casa ci sono **due letti in tutto**: se sono già impegnati
in quella notte, il letto resta spento con «non disponibile».
*Dove si applica:* la pagina nuova di inserimento e la scheda nuova.

**I due sconti** — o una **percentuale**, o un **prezzo finale** («porta il
totale a»). Uno solo per prenotazione. La tariffa a notte non si tocca mai:
quello che cambia è lo sconto.
*Dove si applica:* le due pagine di inserimento.

**Il conto si legge sempre nello stesso ordine** — le righe delle camere, poi il
letto in più, poi **Totale**, poi **Sconto**, poi **Da pagare** in grande, e
sotto la riga «5 notti · 77,40 € a notte».
*Dove si applica:* la scheda nuova e la pagina nuova di inserimento.

**Come si chiama la cliente nei messaggi** (deciso il 12 settembre) — nella
conferma senza immagine si scrive nome e cognome; in tutti gli altri messaggi
solo il nome, perché sono messaggi di tutti i giorni.
*Dove si applica:* già fatto nei messaggi dell'arrivo, nella conferma con
immagine, nel ringraziamento della notifica di partenza e nelle proposte. **Manca
ancora nella scheda vecchia** (vedi il capitolo 5).

---

## 5. Cosa è rimasto fuori, e perché

**Due file non si potevano toccare.** `app/prenotazioni/[id]/page.tsx` (la scheda
vecchia) e `lib/condizioniPrenotazione.ts` sono in carico a un'altra attività, che
ci ha lasciato dentro modifiche non salvate. Non sono stati toccati né inclusi in
nessun salvataggio. Conseguenza diretta: **nella scheda vecchia sei messaggi
salutano ancora con nome e cognome** invece che col solo nome (modifica,
annullamento, dati bonifico, promemoria bonifico, pagamento ricevuto,
ringraziamento). Le istruzioni esatte per farlo sono già scritte in
`CONSEGNA-ATTIVA.md`, al capitolo «Da fare in app/prenotazioni/[id]/page.tsx».

**La pagina della proposta ha ancora i nomi vecchi dei pagamenti.** Dice
«All'arrivo · Caparra · Pagamento completo · Personalizzata» invece dei sei modi
nuovi. I nomi stanno in `lib/condizioniPrenotazione.ts`, che è uno dei due file
bloccati: finché quello non si libera, la proposta non si può allineare.

**Dalla scheda nuova alcuni comandi aprono ancora la vecchia.** «Vedi tutto»,
«Altre modifiche», «Annulla prenotazione», «Modifica dati» del cliente, «Cambia
cliente» e «Aggiungi pagamento» portano a `/prenotazioni/<numero>`. **È voluto,
deciso da Ania il 13 settembre**, non una cosa lasciata a metà: si rifaranno
dentro la scheda nuova con un incarico a parte.

**La correzione dei totali scontati non è stata lanciata.** È la proposta
numerata 0050, il file `supabase/proposte/0050_totale_scontato.BOZZA.sql`. Va
lanciata a mano nell'editor SQL di Supabase. Nota: controllando il database il
15 settembre, le sei prenotazioni con sconto risultano già corrette, quindi la
correzione dovrebbe trovare zero righe da sistemare — ma va lanciata lo stesso
per esserne certi.

**Le due pagine nuove non sono collegate.** Nessun tasto del gestionale porta a
`/nuova-prenotazione`; alla scheda nuova si arriva solo dal link «nuova ›»
nell'elenco delle prenotazioni. Il passaggio va deciso.

**Una prenotazione di prova in calendario.** Il 14 settembre, per provare il
salvataggio vero, è stata creata e poi **annullata** una prenotazione a nome
«Ania (prova)», Lena, 10–12 febbraio 2027, con il motivo «Prova del rilascio del
14/09/2026». È annullata, quindi non compare nel calendario né nei conti, ma la
riga esiste ancora nel database.

**Un avviso tecnico nella console del browser.** La striscia delle notti mescola
due modi di scrivere i bordi e il programma lo segnala. Non si vede niente di
rotto; è segnato come lavoretto da fare.

**Sul telefono, nella parte della notte scelta, «ospiti» e «letto in più» vanno a
capo** invece di stare sulla stessa riga: insieme servono circa 412 px e su un
telefono ce ne sono 346. Sul computer stanno su una riga sola. Per averla su una
riga anche sul telefono bisogna accorciare qualcosa, e va deciso cosa.

**Il controllo automatico del codice (lint) ha 26 errori e 5 avvisi
preesistenti**, già presenti prima di questi giorni. Nessuno nuovo è stato
aggiunto, ma non si può dire che sia tutto verde.

---

## 6. Cosa controllare

Prove da fare dal telefono, con il gestionale aperto su
`gestionale-bnb-tau.vercel.app`. Per ognuna: cosa fare e cosa si deve vedere.

**Le Richieste**
1. Apri **Richieste**. Ogni riga deve avere il nome grande e sotto notti,
   persone, camera e prezzo, con i numeri grandi come il nome.
2. Cerca una richiesta di una cliente già stata da noi: in alto nella riga deve
   esserci scritto «già stata qui *n* volte», e in fondo quanto ha speso in
   rosso.
3. Tocca **DA GUARDARE** nella fascia dei comandi: devono restare solo le
   richieste ferme, e l'ordine scelto non deve cambiare.
4. Apri una richiesta e scorri in fondo: deve esserci la parte **CLIENTE** con i
   suoi soggiorni, uno per riga.

**La proposta**
5. Dentro una richiesta apri la proposta, scegli come paga e guarda l'anteprima
   del messaggio: le parti importanti devono vedersi **in grassetto**, non con
   gli asterischi.
6. Se la richiesta è per tre persone, il messaggio deve elencare le camere una
   per una.

**La scheda nuova**
7. Apri **Prenotazioni** e tocca il link **«nuova ›»** di una prenotazione.
8. In cima devi vedere: chi è, le date con la freccia, ospiti e camera, e quanto
   c'è da incassare in rosso.
9. Tocca la linguetta **CONTO**: devono esserci le righe delle camere, poi
   Totale, poi Sconto (se c'è), poi «Da pagare» in grande e sotto la riga «*n*
   notti · *x* € a notte».
10. Nella parte SOGGIORNO deve esserci la striscia delle notti: una colonnina per
    notte con la camera e il quadratino del letto.

**La pagina nuova di inserimento** — scrivi a mano l'indirizzo
`gestionale-bnb-tau.vercel.app/nuova-prenotazione`.

11. Cerca una cliente già in archivio e toccala.
12. Tocca **ARRIVO**: si deve aprire il calendario del telefono, e chiuso la data
    si deve leggere così: «gio 10 set».
13. Metti delle date in cui ci sia posto. Tocca una camera in alto: **la tariffa
    a notte si scrive da sola** col prezzo di quella camera.
14. Premi il **«+»** degli ospiti fino a 3: in una camera che non li tiene senza
    letto, il letto si accende da solo e sotto la striscia compare «QUANTO COSTA
    IL LETTO».
15. Con 4 ospiti in Lena il conto deve dire **100 € a notte** (90 della tripla più
    10 del letto).
16. Tocca una colonnina della striscia: la notte si segna con un **contorno
    d'ottone** e sotto compare la sua parte, con tutte le camere. Le camere
    occupate quella notte devono essere spente e non toccabili.
17. Scegli una camera diversa **solo per quella notte**: la striscia deve dire «1
    cambio camera» e il conto deve avere **due righe**, una per camera.
18. Cambia gli ospiti di una notte: compare la domanda «solo questa notte / da qui
    in poi». Passa dall'una all'altra due o tre volte: con «solo questa notte» le
    notti dopo devono tornare **esattamente come erano**.
19. Guarda dove si trova il conto: deve stare **subito sotto il soggiorno**, senza
    dover scorrere fino in fondo.
20. Metti uno sconto del 10%: il conto deve mostrare Totale, poi Sconto, poi Da
    pagare.
21. Tocca **«Salva la prenotazione»** lasciando fuori qualcosa (per esempio senza
    scegliere la camera): sotto il tasto deve comparire in mattone il nome di
    quello che manca, e la pagina deve portarti su quel campo.
22. Completa tutto e salva davvero: si deve aprire la scheda nuova della
    prenotazione appena fatta, con gli stessi numeri del conto.

**I pagamenti**
23. Apri una prenotazione con due camere: il conto deve essere **uno solo** per
    tutte e due, non due conti separati.
24. Tocca «Registra pagamento»: deve comparire una **conferma verdina al centro**
    dello schermo.

---

*Documento scritto il 15 settembre 2026. Ultimo salvataggio del programma
considerato: `c19c7d7` del 14 settembre.*
