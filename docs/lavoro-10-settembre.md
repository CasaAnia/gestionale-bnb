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

1. Il conto riunisce le camere e i cambi camera della stessa prenotazione.

2. La Home mostra le note dei clienti e raccoglie le pulizie in un punto solo.

3. Le Richieste hanno una veste più leggibile e lo storico del cliente in vista.

4. Le proposte e le anteprime WhatsApp sono state riordinate.

5. È nata una scheda alternativa a `/scheda/<id>`; quella precedente resta collegata.

6. È nato un inserimento alternativo a `/nuova-prenotazione`.

7. Una striscia permette di vedere e modificare camera, letto e ospiti notte per notte.

8. Sono stati unificati sei modi di pagamento, con alcune pagine ancora da allineare.

9. Il 15 settembre sono stati corretti errori nei conti, nei salvataggi e nelle statistiche.

10. Alcune protezioni sono ancora proposte da applicare alla banca dati: il lavoro locale non equivale alla pubblicazione.

---

## 2. Giorno per giorno

### Giovedì 10 settembre — la prenotazione diventa una cosa sola

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

### Venerdì 11 settembre — Home, pagamenti e la veste nuova della proposta

**Home** (`d9398e1`)

- Le pulizie del giorno stanno in un posto solo, in cima alla pagina.

- La nota del cliente si legge anche dalla Home dal 10 settembre (`0b831dc`).

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

- Il messaggio riscritto a mano è protetto dagli aggiornamenti automatici e viene segnalato quando serve intervenire.

- Le persone per notte si leggono in parole, e la riga della camera dice il
  prezzo di ogni notte.

### Sabato 12 settembre — la pagina delle Richieste, rifatta

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

### Domenica 13 settembre — la scheda nuova, la striscia, «Come paga», l'inserimento nuovo

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

- Nella scheda nuova la striscia prende il posto del precedente foglio «Modifica
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

- Con uno sconto, nel totale salvato poteva finire il prezzo pieno: 280 € invece di 252 €, anche quando il conto ricalcolato mostrava lo sconto corretto. Da adesso tutte e
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

### Martedì 15 settembre — controlli dei conti, salvataggi e statistiche

**Soggiorno e prezzi** (`9a5af81`, `39df2f9`)

- Lo sconto segue tutti i tratti della prenotazione: separare una notte non deve trasformare quattro notti da 80 €, scontate del 10%, da 288 a 296 €.

- Una tariffa concordata resta tale finché non cambiano camera o persone. Separare una notte non deve riportare le altre al listino.

- Il letto «30 € in tutto» si calcola una sola volta sul soggiorno e si distribuisce fra i tratti. Anche «ogni 4 notti» non riparte da zero a ogni cambio camera.

- Il secondo controllo ha corretto anche i tratti apparentemente invariati: se cambia la quota del letto, vengono aggiornati anch'essi.

- Il prezzo finale concordato viene ripartito al centesimo. La prima soluzione lo trasformava in una percentuale arrotondata; quella soluzione è stata sostituita perché poteva alterare il totale.

- Le combinazioni di ospiti che il modello non riesce a conservare vengono elencate e il salvataggio si ferma: nessuna sostituzione silenziosa dei numeri.

- In pagina, dopo salvataggio e riapertura, devono restare gli importi e le persone concordate.

**Disponibilità e salvataggio** (`a885c8f`, `73e1ecf`, `81012ce`)

- La disponibilità legge tutte le pagine di risultati, mostra il caricamento e viene ricontrollata prima del salvataggio. Se la lettura fallisce, non considera le camere libere.

- Cambiare «Come paga» non azzera più prima la caparra per poi tentare di riscriverla: senza la nuova protezione della banca dati viene salvata prima la riga che la conserva. Un errore successivo viene dichiarato; questo percorso non garantisce ancora che tutte le righe cambino insieme.

- Spostare le notti richiede la nuova operazione unica nella banca dati. Se manca, la pagina avverte e si ferma, anziché rischiare uno spostamento a metà.

- Se manca un aggiornamento indispensabile della banca dati, la pagina lo dice. Gli altri limiti di compatibilità non vengono nascosti dietro un salvataggio apparentemente completo.

**Statistiche** (`5eb8f6d`, `8f9f2e5`, `4ff20d3`, `e2cac3d`)

- Due camere dello stesso conto valgono un soggiorno nelle statistiche del cliente e della provenienza.

- La ricostruzione degli incassi riunisce periodi e pagamenti del conto. Considera anche i pagamenti realmente ricevuti su tratti poi annullati, senza attribuire a quei tratti un nuovo costo del soggiorno.

- I confini del periodo usano l'ora di Roma; le letture hanno un ordine stabile anche quando più righe hanno la stessa data.

- In pagina sono distinti «Arrivate», «Ancora in corso» e «Già chiuse». La percentuale di conversione si riferisce alle richieste già chiuse.

- È dichiarato che il mese è quello di arrivo della richiesta, non quello della risposta o del soggiorno.

- Il conteggio del sito è indicato come orientativo; il riquadro Richieste è la fonte per le richieste registrate. Le eventuali incoerenze sono segnalate con «richieste da guardare», senza correggere automaticamente i dati.

**Protezioni della banca dati e prove** (`23cd533`, `11d1a34`)

- Le proposte 0051 e 0053 sono state riviste per consentire scambi e fusioni di camere validi alla fine dell'operazione, continuando a rifiutare sovrapposizioni reali.

- Aggiunta la proposta 0054 per impedire di impegnare più di due letti nella stessa notte anche con salvataggi contemporanei.

- Il messaggio del commit documenta prove su PostgreSQL 16.15, cioè un vero sistema di banca dati, con due sessioni contemporanee. Questo supera il precedente appunto «prove solo scritte» per quel collaudo, ma non dimostra l'applicazione in produzione.

- Corretto il server simulato delle prove di backup, che talvolta restava aperto facendo risultare interrotto il controllo. Nessun cambiamento visibile nella pagina.

**Documentazione** (`67adce5`, `bed4ad5`)

- Creato il primo resoconto e registrato l'esito della prima revisione. Questa versione del documento comprende anche i successivi controlli del 15 settembre.

File principali del giorno: `lib/strisciaNotti.ts`, `lib/lettiAggiuntivi.ts`, `lib/occupazioniDati.ts`, `lib/comePagaDati.ts`, `lib/nottiScrittura.ts`, `lib/statisticheDati.ts`, `lib/statistiche/`, `app/statistiche/page.tsx` e le proposte in `supabase/proposte/`.

---

## 3. Le pagine nuove e dove sono

| Indirizzo | Cos'è | Stato |
|---|---|---|
| `/scheda/<numero>` | La scheda di una prenotazione, veste nuova | **Alternativa, non ancora sostitutiva.** Si apre dal link «nuova ›» e dopo il nuovo inserimento; alcune operazioni rimandano ancora alla vecchia. |
| `/prenotazioni/<numero>` | La scheda di una prenotazione, veste vecchia | **È ancora quella in uso.** Ci arrivano Home, Calendario, Arrivi, Clienti, Richieste e la conferma di una richiesta. |
| `/nuova-prenotazione` | L'inserimento di una nuova prenotazione, veste nuova | **Inserimento alternativo**, non collegato al comando principale «Nuova»; l’accesso diretto è descritto nella consegna. |
| `/nuova` | L'inserimento di adesso | **È ancora quello in uso**: è il tasto «Nuova» del menù. |

I percorsi nuovi nascono il 13 settembre. La tabella descrive i collegamenti del codice esaminato: non certifica che l'ultima versione locale sia già online. La pubblicazione del conto unico del 10 settembre è invece registrata esplicitamente nella consegna. Le nuove correzioni del 15 richiedono una verifica separata del rilascio.

---

## 4. Le decisioni di Ania

Regole fissate in questi giorni come riferimento comune. L’applicazione non è ancora uniforme: sotto ogni regola sono indicati i punti interessati e le eccezioni.

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
nella pagina nuova di inserimento, e nella scheda nuova. La proposta conserva ancora le quattro scelte precedenti, come spiegato nel capitolo 5. Nella scheda nuova la linguetta in alto si chiama **CONTO**.

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
quello che cambia è lo sconto. Il 15 settembre è stata corretta la sua conservazione quando il soggiorno si divide in più tratti; il prezzo finale deve restare esatto al centesimo.
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
ci ha lasciato dentro modifiche non salvate. Sono stati esclusi dagli ultimi interventi assegnati ad altri autori. Questo non significa che siano rimasti intatti dal 10 settembre: la storia contiene anche modifiche precedenti alla scheda vecchia. Conseguenza diretta: **nella scheda vecchia sei messaggi
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

**La correzione dei vecchi totali scontati è una proposta da applicare separatamente.** Il file `supabase/proposte/0050_totale_scontato.BOZZA.sql` contiene prima il controllo delle righe interessate e poi la correzione. Non basta correggere l'inserimento per sistemare dati già salvati. Da questo esame del repository non certifico né l'esecuzione in produzione né il numero attuale di righe da correggere: prima va eseguita la lettura di controllo. Non serve modificare righe già corrette.

**Le nuove protezioni della banca dati restano proposte.** SQL significa il linguaggio usato per impartire operazioni alla banca dati. I file seguenti non sono semplici ritocchi grafici:

| Proposta | Effetto previsto | Limite ancora da chiudere |
|---|---|---|
| 0051 | Impedisce due prenotazioni attive nella stessa camera e notte | Controllare le sovrapposizioni già esistenti prima di applicarla. |
| 0052 | Salva modo di pagamento e caparra tutti insieme | Senza di essa resta il percorso in due scritture, con possibile risultato parziale dichiarato. |
| 0053 | Sposta, crea e annulla i tratti tutti insieme | Il nuovo codice blocca lo spostamento se la funzione non esiste. |
| 0054 | Protegge i due letti disponibili anche fra operazioni contemporanee | Deve essere applicata e verificata sul servizio effettivo. |

Sono in `supabase/proposte/`, con suffisso `BOZZA.sql`. Il commit `23cd533` documenta collaudi ulteriori, ma dichiara che restano proposte. Non confonderle con le modifiche 0046–0049 già applicate e documentate il 10 settembre.

**Il passaggio alle pagine nuove non è completato.** Nessun tasto del gestionale porta a
`/nuova-prenotazione`; alla scheda nuova si arriva dal link «nuova ›» nell’elenco e dopo il nuovo inserimento. Il passaggio generale va deciso.

**Rifiniture e verifiche non chiuse.** La consegna e il precedente resoconto segnalano un avviso sui bordi della striscia e i comandi ospiti/letto che vanno a capo sul telefono. Non ho riprovato l'interfaccia in questo incarico documentale: restano punti da verificare, non nuovi difetti accertati oggi.

**Controlli automatici e pubblicazione sono due cose diverse.** La consegna registra 1.331 prove superate per la prima revisione del 15, oltre a controlli di compilazione; i commit successivi aggiungono altre prove. Non ho rieseguito la suite per scrivere questo documento e non attribuisco quel numero all'ultima versione. I vecchi conteggi di errori generali del codice sono fotografie storiche, non un controllo aggiornato.

**Le modifiche locali altrui sono ancora presenti.** Al momento dell'esame risultano modificati i due file citati sopra e presenti due documenti non ancora inclusi nella storia, sulle alternative di una o due pulizie al giorno. Non sono decisioni già implementate e non vengono inclusi in questo resoconto di `main`.

**Le rettifiche dei singoli clienti non si deducono dai commit.** La correzione di una richiesta reale e i totali aggiornati in produzione richiedono prove della banca dati. Questo documento non trasforma i racconti della chat in operazioni certificate dal repository.

---

## 6. Cosa controllare

Prove da fare dal telefono sulla versione da collaudare. Prima verificare quale versione è pubblicata: le correzioni locali del 15 potrebbero non esserlo. Le prove che salvano, registrano pagamenti o simulano errori vanno eseguite su dati fittizi in un ambiente di prova, non su prenotazioni reali. Per ognuna: cosa fare e cosa si deve vedere.

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

**La pagina nuova di inserimento** — apri `/nuova-prenotazione` nell’ambiente di prova.

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

17. Su un soggiorno inizialmente nella stessa camera, scegli una camera diversa **solo per l’ultima notte**: la striscia deve dire «1
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

**Conti dopo modifica e riapertura — ambiente di prova**

25. Prepara quattro notti da 80 € con sconto del 10%; separane una mantenendo tariffa e condizioni: devi rileggere 288 €, non 296 €.

26. Prepara due tratti con letto «30 € in tutto»: salva e riapri. Il letto deve costare 30 € complessivi. Toglilo da un tratto e ricontrolla anche quello rimasto.

27. Imposta un prezzo finale di 1.000 € su più tratti: salva e riapri. Devi vedere esattamente 1.000 €, senza differenze di centesimi.

28. Cambia «Come paga» e la caparra, salva e riapri: devono restare scelta, importo e scadenza. Il tecnico deve provare anche un errore fra le scritture.

29. Sposta una notte e riapri la scheda: camere e giorni devono essere tutti aggiornati. Se manca l'aggiornamento della banca dati, devi vedere un avviso e nessuno spostamento parziale.

**Statistiche**

30. Apri Statistiche, scegli un mese e confronta Richieste: «Arrivate» deve essere la somma di «Ancora in corso» e «Già chiuse».

31. Controlla la percentuale: due conversioni su sei richieste chiuse devono dare circa 33%, anche se le arrivate complessive sono nove. È un esempio di calcolo, non una lettura aggiornata dei dati reali.

32. In prova, conferma una richiesta di settembre per un soggiorno di ottobre: la conversione deve appartenere al gruppo delle richieste arrivate a settembre.

33. Apri lo storico di un cliente con due camere nello stesso conto: quel soggiorno deve contare una volta sola.

34. Su dati di prova, controlla un conto con un pagamento su un tratto poi annullato: la ricostruzione non deve proporre di incassare di nuovo quella somma.

35. Controlla gli avvisi «richieste da guardare»: devono aiutare a verificare il collegamento, senza cambiare automaticamente lo stato della richiesta.

Le prove di due salvataggi contemporanei, indisponibilità della banca dati e limite dei due letti richiedono anche un controllo tecnico: un solo telefono non basta a dimostrarle.

---

**Fonti e confini del documento.** Ricostruzione della storia di `main` dal 10 al 15 settembre 2026, fino a `11d1a34`, con date, messaggi e file modificati; lettura di `CONSEGNA-ATTIVA.md`, `COLLABORAZIONE.md`, del precedente resoconto e delle note datate nel codice. Nei casi di contrasto è stata usata la modifica più recente: per esempio il prezzo finale non è più trasformato in percentuale arrotondata. Le date delle sezioni seguono Git: alcuni appunti descrivono il 14 modifiche già salvate il 13. Nessun nuovo collaudo del programma, accesso alla banca dati o pubblicazione è stato eseguito per questo documento.
