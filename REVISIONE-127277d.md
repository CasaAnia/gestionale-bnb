# Revisione indipendente di 127277d — consegna unica a Claude

31 agosto 2026. Esito: **correzioni sostanziali confermate, blocco non ancora chiudibile**.
Solo locale; percorso operativo `legacy`; PostgreSQL già collaudato NON riaperto.

## Identità e collaborazione

Sorgenti applicativi revisionati: `127277dc3388fd6fd81fa73c228974e0534c0f1b`.
Preflight iniziale completato prima delle modifiche concorrenti: suite applicazione,
strumenti, TypeScript e lint del delta verdi; impronta dello snapshot
`50826e9d10b473513c52b0692fcaa68650eb51dfa151af713093ab891bcd9b44`.
Comprendeva i cinque file locali del metodo: non equivale al solo commit.

Durante il giro sono comparsi cambiamenti altrui in `orchestrazione.test.ts` e
`app/nuove-spese/Prova.tsx`: NON modificati né inclusi in questa revisione.
I due moduli del motore/ponte e RevisioneSheet sono rimasti quelli del candidato
durante le riproduzioni. Non attribuire il verde iniziale all'albero successivo.
Non ho aggiornato CONSEGNA-ATTIVA mentre era usata dall'implementatore: questo
file è il passaggio unico da recepire lì alla consegna del prossimo candidato.

## Confermato: non riaprire questi punti senza regressione

- `fonte.ts` seleziona la versione solo sul contratto: verificata la funzione
  effettiva con archivio iniettato nei due percorsi (versione 3 nel contratto,
  campo assente nel legacy). Memoizzazione presente nel collegamento di pagina;
  prova React del rerender ancora non eseguita.
- Risposta persa DOPO Salva di campo e voce nuova → ricreazione delle custodie e
  orchestrazione → acquisizione → seconda apertura con le righe davvero rilette
  dal server finto → Conferma riuscita. Una voce sola, id presente, originale
  «Iper» conservato nonostante il negozio corretto.
- Conferma e Scarta, ciascuna con perdita PRIMA e DOPO l'effetto: i quattro
  recuperi senza schermata chiudono correttamente documento, ponte e custodie.
- La riconciliazione precede ora il cancello della schermata; lo scarto passa
  dagli stessi controlli di pendenza. Il limite restante è il ciclo sottostante.

## 1. BLOCCANTE — due recuperi possono toccare l'operazione sbagliata

Punti: `orchestrazioneRevisione.ts:107`, `:116`, `:126`, `:132`;
pagina `SpesePagina.tsx:155` e guscio `RevisioneSheet.tsx:94` chiamano entrambi
la riconciliazione senza coordinamento comune.

Sequenza riprodotta con custodie locali REALI sullo stesso magazzino:
Salva A applicato, risposta persa → recuperi R1 e R2; risposta del giornale a R2
sospesa → R1 acquisisce A → nuova apertura e Salva B in corso, con ponte B e
generazione 2 → arriva R2. La scrittura del ponte A viene giustamente RIFIUTATA
perché esiste B, ma il motore tratta il rifiuto come semplice avviso, continua,
cancella `inCorso` di B e rimuove il ponte B. L'operazione B è ancora pendente.

Ulteriore controprova dello stesso requisito: una chiusura vecchia non può
rimuovere una traccia di generazione 2 attraverso `Math.max` passando proprio
la generazione nuova al deposito. Il deposito reale la protegge passando 1;
la riconciliazione scavalca la protezione e la cancella.

Atteso: coordinamento per documento condiviso da pagina, foglio e scritture;
riacquisizione/rimozione condizionate all'identità e alla generazione pertinenti.
Un rifiuto di identità NON è equivalente a un guasto di persistenza superabile
col giornale. Nessuna annotazione o vincolo di un'altra operazione va cancellato.
Dimostrare anche la risposta tardiva, non solo «Salva già superato prima di iniziare».

## 2. BLOCCANTE — ponte senza deposito non prova che il preparatore sia terminato

Punti: `orchestrazioneRevisione.ts:230`, `:341`, `:350`.

Il primo hash prepara il ponte; `eseguiSalva` attende poi un SECONDO hash prima
di registrare il tentativo. Sospendendo questo secondo passaggio, una riapertura
vede ponte presente, deposito vuoto e giornale assente: dichiara «nulla applicato»,
chiude il ponte e permette una generazione nuova. Sbloccato il preparatore vecchio,
parte COMUNQUE la sua chiamata: sul server arriva «Vecchio», nella nuova custodia
c'è «Nuovo». Il solo controllo iniziale di generazione non basta.

Atteso: rendere preparazione, registrazione e presa in carico coerenti; dopo ogni
attesa rilevante una sequenza superata non deve avviare la richiesta. Se non si può
dimostrarne la cessazione, la ripresa deve restare bloccante. Non dedurre «non
arriverà più» da una SELECT senza riga. Vale per tutte e tre le operazioni.
È un difetto del cablaggio locale, non una richiesta di cambiare il contratto SQL.

## 3. BLOCCANTE — l'esito del ponte salta la convalida già richiesta al giornale

Punti: `ponteContratto.ts:47`, `:86`; `orchestrazioneRevisione.ts:211`.

Riproduzione: Salva applicato, scrittura finale della traccia fallita → esito nel
ponte; JSON ancora leggibile ma mappa degli id svuotata → apertura dichiara
«acquisizione completata» e cancella il ponte, lasciando la voce `in_invio` senza id.
Il riferimento di recupero è perso. Il lettore non convalida l'esito, e il motore
lo usa direttamente. Inoltre `ponte.salva` permette alla STESSA opKey di cambiare
kind/impronta: l'identità completa non è davvero immutabile.

Atteso: verificare struttura e identità completa, revisione, mappa esatta e id
prima di toccare la traccia; corruzione/discordanza = blocco con dati conservati.
Riutilizzare le regole di risposta del contratto, senza una seconda convalida
più debole. Permettere aggiornamenti dell'esito solo a identità invariata.

## 4. BLOCCANTE UI — il bottone Riprova non riavvia l'effetto

Ispezione statica, NON prova browser: `RevisioneSheet.tsx:89-100` e `:126`.
Il bottone cambia il ref e mette `riconciliazione` a null, ma l'effetto dipende
solo da orchestrazione, documento.id e deposito: nessuna di quelle dipendenze
cambia. Con le prop stabili introdotte qui, resta su «Un attimo…» senza nuovo
tentativo. Collegare il ritentativo a un trigger effettivo o a una funzione
condivisa, con controllo delle risposte obsolete; aggiungere la prova del
componente: lettura fallita → Riprova → nuova chiamata → esito utilizzabile.

## Prove consegnate, già eseguibili

`node --test scripts/revisioni/cablaggio-127277d.test.mjs`

10 prove: 5 verdi (giro completo + quattro chiusure), 5 ROSSE sul candidato
(due sequenze concorrenti/preparazione, mappa incompleta, identità mutabile,
rimozione di generazione recente). Gli assert chiedono il comportamento corretto;
il rosso è l'evidenza del difetto, NON un test da invertire. Servizi simulati,
depositi reali, nessuna rete, file o database esterno coinvolto dalle prove.
Le prove sono del revisore; Claude può usarle/adattarle preservando questi
requisiti, senza sostituire le sequenze con casi più facili.

## Limiti e prossima consegna

- Browser: skill usata per tentare la verifica sintetica; URL bloccato dalla
  policy, non aggirato. Nessuna prova visuale dichiarata. Server temporaneo
  avviato e fermato; nessuna pagina reale o dato remoto utilizzato.
- Build non ripetuta sul candidato in movimento; resta l'esito dichiarato
  dall'implementatore, non una nuova verifica indipendente.
- Su 127277d la preview conservava mondo e giornale in useState, e le nuove
  righe della Map non tornavano nell'array usato dalla schermata. Claude sta già
  modificando quel file: completare C09 sul prossimo candidato, senza duplicare
  il lavoro in corso né dichiararlo già verificato.
- Correggere insieme questi quattro gruppi locali, completare C01–C10 pertinenti,
  fissare il candidato e consegnare una sola volta. Niente token, remoto, SQL,
  produzione, push o deploy. I risultati positivi sopra non vanno rifatti da zero
  se restano coperti dalle regressioni e i relativi percorsi non cambiano.
