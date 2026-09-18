# REGOLE FISSE del gestionale Casa Ania

Questi comportamenti li ha decisi Ania e **non si toccano senza una sua
richiesta esplicita**. Prima di ogni incarico: `git pull` su `main` e lettura
di questo file. Prima di ogni push la suite deve essere verde (`npm test`).

Ogni regola indica il test che la protegge: se un cambiamento la rompe, la
suite fallisce e il push non parte. Una regola nuova entra qui solo con il
suo test.

## 1. Maiuscola automatica su nome e cognome, ovunque

Nome e cognome del cliente (e di chi dorme con lei, e delle richieste)
partono con la maiuscola **mentre si scrive**, in ogni modulo del gestionale:
«mario rossi» → «Mario Rossi», «d'angelo» → «D'Angelo», «de luca» → «De
Luca», «anna-maria» → «Anna-Maria». Il resto della parola non si tocca.

Come è fatta, così non si perde più (18/09/2026, dopo tre regressioni):
- **una sola funzione**: `conIniziali` in `lib/maiuscole.ts` (e
  `maiuscoleNelCampo` per il campo mentre si scrive);
- **un solo componente** per i campi Nome e Cognome:
  `components/CampiNomeCognome.ts` (con `autoCapitalize="words"` per la
  tastiera dell'iPhone). Nessun modulo ha campi del nome suoi;
- **seconda rete al salvataggio**: `nomeDaSalvare` in `lib/guestName.ts`
  per `guests.full_name`, `conInizialiNomeCognome` per le richieste
  (`lib/richiesteDati.ts` e la route delle richieste dal sito).

Test: `lib/nomiOvunque.test.ts` (tutto il file: la funzione, il componente
fatto girare, ogni modulo, le due guardie sui sorgenti) e
`lib/maiuscole.test.ts`.

## 2. Il cliente si scrive sempre nome e poi cognome, ovunque

«Anna Rossi», mai «Rossi Anna»: in ogni testo, elenco, calendario, messaggio,
push e nei moduli (il campo Nome viene prima del campo Cognome). Nome e
cognome li mette insieme **solo** `nomeCompleto` / `nomeBreve` di
`lib/guestName.ts`; nessun altro punto del codice li concatena da sé.

Test: `lib/ordineNomi.test.ts` (tutto il file: «mai cognome + nome»,
«nome e cognome li mette insieme SOLO nomeCompleto/nomeBreve», «nel
componente condiviso il campo Nome viene prima del campo Cognome») e
`lib/guestName.test.ts`.

## 3. Elisione nelle date solo davanti a 1, 8 e 11

«dall'1», «all'8», «dell'11» — perché in italiano uno, otto e undici
cominciano per vocale. Mai davanti agli altri giorni: «al 18», «dal 28»,
«del 21», «al 31».

Test: `lib/richiesteTesti.test.ts` → «elisione SOLO per 1, 8, 11 (uno, otto,
undici) in tutte le forme: al/dal/del; mai per 18, 21, 28, 31» e «date con
l'elisione, mesi diversi, «la notte del», righe brevi».

## 4. Nell'ordinamento delle Richieste la voce si chiama «Durata»

Nella fascia dei comandi delle Richieste le tre voci dell'ordine sono, in
quest'ordine, **Arrivo · Durata · Persone** (scritte in maiuscolo dalla
veste). La voce di mezzo si chiama «Durata», non «Notti» né altro (Ania,
12/09/2026), e ordina per notti decrescenti.

Test: `lib/richieste.test.ts` → «le tre parole dell'ordinamento, nell'ordine
chiesto» e «la fascia ha le quattro voci, e «da guardare» porta il numero».

## 5. Allungando le date, la notte nuova prende la camera della notte accanto

Nell'inserimento di una prenotazione non si sistema ogni notte a mano: se il
soggiorno si allunga (partenza più avanti, o arrivo più indietro), la notte
nuova prende da sola la camera, gli ospiti e la tariffa della notte accanto
già sistemata, purché quella camera sia libera. Il «?» resta solo quando la
camera è davvero occupata. Il cambio camera si fa toccando la notte, come
prima; le notti lasciate vuote apposta restano vuote (Ania, 18/09/2026:
«non voglio ogni casella di ogni prenotazione impostarla»).

Test: `lib/nuovaPrenotazione.test.ts` → «il caso di Ania: Ambra in 2 dal 28
al 29, poi la partenza va al 30 → anche il 29 è Ambra in 2, un tratto solo»,
«la notte nuova resta col «?» solo se la camera accanto è occupata» e
«toccando le date le camere già messe restano, e la notte nuova prende la
camera della notte accanto».

## 6. Il prezzo della camera non si cambia mai: niente «Tariffe» nella scheda

Il prezzo a notte di una camera è il listino di casa e resta quello. Nella
scheda della prenotazione non c'è nessun comando «Tariffe» per riscrivere la
tariffa dei tratti: quello che cambia è solo lo sconto, dal comando «Sconto»
del conto (Ania, 18/09/2026: «togli tariffe dalla prenotazione, il prezzo
della camera non deve cambiare mai»).

Test: `lib/fogliScheda.test.ts` → «nella scheda non c'è il comando «Tariffe»:
il prezzo della camera non si cambia mai».

## 7. Sotto «Da pagare» niente «2 notti · 80 € a notte»

Nel conto della scheda e in quello dell'inserimento, sotto la cifra grande
«Da pagare» non c'è la riga con le notti e il prezzo medio a notte (Ania,
18/09/2026: «togli questo»). Resta solo nel foglio «Il soggiorno si
allunga», dove serve a confrontare prezzo pieno e sconto.

Test: `lib/scheda.test.ts` → «il conto» (le due asserzioni «la scheda /
l'inserimento rimette la riga «notti · a notte» sotto «Da pagare»»).
