# Due pagine prenotazioni — pubblicazione del 10 settembre 2026

## Stato corrente

Ania ha autorizzato la pubblicazione e, successivamente, la riattivazione del progetto di prova esistente. Le modifiche locali sono nel commit `8c6ccd0`, discendente del `main` remoto `623c864`. I precedenti incarichi di Claude sono conclusi e integrati.

**Database principale aggiornato e verificato.** Applicate in un’unica transazione le 0046/0047/0048/0049; la 0041 era già presente. Le nuove colonne e le tre funzioni del conto unico sono visibili anche tramite PostgREST. Confronto prima/dopo: 240 periodi, 142 clienti e 143 incassi; nessuna modifica ai campi precedenti. Collegamenti di prenotazione corretti; nessun accordo del letto o motivo interno inventato sulle righe vecchie.

**Pubblicazione completata e verificata.** Commit remoto `f13f5b517a6cb95d3a4776092952eae5b73591c7`, Vercel `success`. Aperte online, con sessione autenticata, sia `/nuova` sia la scheda di una prenotazione esistente. Inserimento: ricerca cliente, camere, contanti all’arrivo, arrivo/navetta, persone e note visibili. Scheda esistente: due periodi, totale 320, ricevuti 0, residuo 320 coerenti col backup; comandi di cliente, camera, conto, annullamento e messaggi presenti. Nessuna prenotazione o pagamento di prova creati in produzione. La nuova RPC rifiuta l’accesso anonimo con 401/42501. Questo aggiornamento documentale locale non modifica il codice già pubblicato.

## Prove concluse

- Backup principale: 35 tabelle, 3.241 righe. Integrità, completezza e contenuti identici alla sorgente; confronto ripetuto subito prima dell’aggiornamento. Seconda copia privata identica. Conservate anche le sette funzioni precedenti con i permessi e preparato lo script di ripristino delle sei cambiate.
- Concorrenza reale su PostgreSQL 17.6 nel progetto di prova `exylddaptetwcjxyqids`, schema separato `codex_conto0049_20260910`. Stesso corpo SQL, riferimenti spostati nello schema di prova e controllo membro sostituito da stub; nessuna tabella applicativa coinvolta. Due backend distinti con richieste temporalmente sovrapposte: primo saldo 590, secondo zero, un solo nuovo movimento. Area fittizia rimossa dopo aver conservato gli esiti. Nessuna deroga al precedente blocco locale della memoria condivisa.
- Suite applicativa, regressioni, TypeScript e build finali passati. Ultimi 17 casi su SQL/funzioni effettive della pagina passati; 6 casi di conto/date, 22 di storico. Lint con 26 errori e 5 avvisi preesistenti, nessuna nuova diagnostica: non dichiarare tutto verde.
- Collaudo UI Claude V1/V2 a 390/1280 px: conto unico 640/50/590, incasso 75, saldo 515, caparra unica, aggiunta camera, letto, annullamento, cambio pagina e recupero dopo errore. La UI V2 verificava l’impronta `d1aa89cbca9a8c179ff71a4078c2d3caec49a8d3241785b69e93ebb72d0b8907`; le successive correzioni circoscritte di conto/storico/date sono coperte da test mirati e build. Pagina finale `733f9ba5fe4c77442aefba1d1ff0dc7751b694ae1d929fd0d7dd3dbaba4d1560`.

## Funzioni consegnate

Prenotazione intera distinta dal cambio camera; conto, pagamenti, caparra, storico, cliente e annullamento riferiti a tutte le camere della prenotazione. Modifiche di un singolo periodo conservano gli altri. Camera aggiunta eredita l’accordo senza seconda caparra. Errori di lettura o funzioni server mancanti fermano l’operazione. Note cliente e motivo interno separati; accordo e totale del letto conservati. Pannello messaggi unico su telefono e desktop.

## Punti successivi, separati da questo rilascio

- Testi commerciali di bonifico all’arrivo, caparra e scadenza da rivedere con Ania, come già concordato.
- Promemoria caparra/scadenza e situazione economica arrivi nella Home non implementati in questo blocco.
- Protezioni contro modifiche involontarie e recupero dell’ultimo salvataggio autorizzati per dopo la chiusura delle due pagine, non implementati qui.
- Due osservazioni minori UI registrate: motivo obbligatorio nell’annullamento da rendere più esplicito; etichetta «cambio camera» nello storico da correggere per camere parallele.

## Evidenze

Cartella `/Users/amerigogranata/Documents/Codex/2026-09-09/d`:

- `outputs/pubblicazione-20260910`: backup e seconda copia, `concorrenza-reale.json`, `concorrenza-reale.csv`, `verifica-dopo-sql.json`, SQL atomico applicato e ripristino funzioni.
- `work/collaudo-conto-unico/work-collaudo/CONSEGNA.md`: riscontro UI Claude e 29 schermate.
- `work/storico-multicamera/work-storico/CONSEGNA.md`: storico Claude.
- `outputs/conto-unico-*-consegnato.log`, `outputs/conto-unico-sql-compatibilita.log`: preflight/build e prove finali.
- `outputs/conto-unico-transfer-result.json`: trasferimento verificato senza conflitti; consegne precedenti archiviate nella stessa cartella di lavoro, non liste di lavori aperti.

## Nota per chi chiude il ramo `scheda-vestito` (11/09/2026, Claude)

Il ramo porta una copia locale del commit `d5bff5a` — «Richieste: per tre
persone la proposta elenca le camere una per una» — che è già su `main` come
`cf19c4f` (pubblicato e verificato, deploy Vercel `success`). La copia è stata
lasciata lì di proposito, per decisione di Ania: nessun reset e nessuno
spostamento del ramo, così il lavoro in corso non viene disturbato.

Non serve fare nulla. Aggiornando il ramo da `main` con un **rebase**, git
riconosce il commit già presente e lo scarta da solo; con un **merge** il
contenuto è identico e non produce conflitti. In entrambi i casi su `main` non
arriva un doppione.

Il commit tocca soltanto `lib/richiesteTesti.ts` e `lib/richiesteTesti.test.ts`.
Le modifiche non salvate presenti sul ramo (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`, e poi `lib/clienteCheTorna.ts` con i nuovi
`lib/richiesteCamere*`) non sono state toccate né incluse in nessun commit.

## Nota per chi rifà la pagina della proposta (11/09/2026, Claude)

Il messaggio della variante «tre persone, più camere» adesso contiene il
grassetto di WhatsApp, cioè gli asterischi (`*Lena*`, `*180 €*`, `*entro 3
ore*`, `*Dal 29 al 31 ottobre, per tre persone*`). Gli asterischi devono
restare nel testo che parte su WhatsApp e in quello che si copia: non toglierli.

Nell'**anteprima** Ania non deve però vedere gli asterischi ma il grassetto.
Per questo c'è `components/TestoWhatsApp.tsx`: dove oggi l'anteprima mostra il
testo così com'è, va usato quel componente (`<TestoWhatsApp testo={testo} />`).
Regole e prove stanno in `lib/testoWhatsApp.ts` e `lib/testoWhatsApp.test.ts`.

Il componente non è stato inserito in `app/richieste/[id]/proposta/page.tsx`
perché quel file è in carico a un'altra attività: lo integra chi lo rifà.

## Veste nuova della pagina della proposta (11/09/2026, Claude)

Fatta e provata in locale: testa col cliente, fascia delle sezioni ferma in
cima, quattro parti (Da controllare · Camere da proporre · Come paga ·
Il messaggio), camere scelte con la spunta. Commit `6342822`, `c84ecb0`,
`34ee511`, `0a86f3e`, `9aecbfa`, `58ebeaf`. Nuovi file puri con le loro prove:
`lib/richiesteCamere.ts`, `lib/richiesteDaControllare.ts`,
`soggiorniDellaPersona` in `lib/clienteCheTorna.ts`, `provenienzaInParole` in
`lib/provenienza.ts`. Componenti riusabili anche dalla scheda prenotazione:
`components/TestaCliente.tsx`, `FasciaSezioni.tsx`, `SchedinaControllo.tsx`.
Testi delle proposte, invio, «Sì, inviata», passaggio a «Proposta inviata»,
«Modifica la richiesta» e database: non toccati.

**Il grassetto di WhatsApp è uscito con questo rilascio** (Ania, 11/09/2026):
il messaggio della variante «tre persone, più camere» contiene gli asterischi
e il gestionale li mostra come grassetto. Prima del push verificato nella
pagina vera: l'anteprima della proposta non fa vedere nessun asterisco
(«Dal 20 al 22 dicembre, per tre persone», «Lena», «180 €» in grassetto) e il
testo che parte su WhatsApp li conserva tutti e sedici.

Integrato `components/TestoWhatsApp.tsx` come chiesto nella nota qui sopra:
il messaggio già inviato e quello in attesa di conferma si leggono col
grassetto. Mentre si compone resta la casella di scrittura, dove gli
asterischi si vedono: lì il grassetto non si può mostrare senza togliere la
possibilità di correggere il testo a mano.

### Miglioria da fare (Ania, 11/09/2026)

Dopo l'invio l'elenco delle camere mostra quelle proponibili OGGI, non quelle
che erano state effettivamente proposte: la proposta partita si legge solo nel
messaggio archiviato. Va cambiato in modo che, a proposta inviata, l'elenco
mostri le camere davvero proposte (stanno già in `proposta_alternative` e
`proposta_soluzione`). Non blocca il rilascio.

### Da fare in `app/prenotazioni/[id]/page.tsx` (Ania, 11/09/2026)

La nota del cliente deve essere del rosso **#C00000**, quello scelto da Ania
l'8 settembre: lo stesso ovunque compaia la nota. In Home e nella pagina della
proposta è già così (rilascio `c0c316b`); nella scheda prenotazione è rimasto
il rosso vecchio `#C0392B` sulle due righe delle note (nota del cliente e nota
della prenotazione). Il file è in carico a chi sta lavorando sulla scheda:
**lo cambia quella attività prima di chiudere**. Non toccare gli altri usi di
`#C0392B` in quel file: gli avvisi «numero già usato» restano come sono.

## Da fare in `app/prenotazioni/[id]/page.tsx` — come si chiama la cliente (Ania, 12/09/2026)

Regola nuova, decisa da Ania: nella **conferma SENZA immagine** (quella di solo
testo) si scrive **nome e cognome**, in quest'ordine; in **tutti gli altri
messaggi** si scrive **solo il nome** — sono messaggi di tutti i giorni e devono
suonare meno ufficiali. Senza cognome la conferma usa il solo nome, senza spazi
doppi né virgole vuote. Le maiuscole restano quelle salvate sulla cliente e il
resto dei testi non si tocca: sono approvati parola per parola.

La regola sta già scritta in un posto solo, `lib/guestName` (commit `e5f932b`):

- `nomeECognomeMessaggio(n)` → nome e cognome, ripuliti: per la conferma senza immagine;
- `soloNomeMessaggio(n)` → la prima parola del nominativo: per tutti gli altri.

Già applicata fuori da questo file: arrivo/«Richiesta orario»
(`lib/messaggiWhatsApp`, vale sia per il tasto della scheda sia per quello della
Home), conferma CON immagine (`components/ConfermaWhatsApp`), ringraziamento
della notifica di partenza (`app/api/push/ringraziamento`). Le proposte alle
richieste usavano già il solo nome.

**Qui manca ancora**, dentro `buildWhatsappMsg`. Oggi la riga in cima è

```ts
const name = nomePerMessaggio(nomeOspite(b))
```

e `${name}` finisce in tutti i messaggi. Va diventata:

```ts
const name = nomeECognomeMessaggio(nomeOspite(b))   // solo per 'conferma'
const nome = soloNomeMessaggio(name)                // per tutti gli altri
```

e poi, nei sei messaggi qui sotto, `Gentile ${name},` diventa `Gentile ${nome},`:

| messaggio | `type` | riga del saluto |
|---|---|---|
| Modifica prenotazione | `modifica` | `Gentile ${name},` |
| Annullamento | (ultimo `return`) | `Gentile ${name},` |
| Dati bonifico (richiesta di pagamento) | `dati_bonifico` | `Gentile ${name},` |
| Promemoria bonifico | `promemoria_bonifico` | `Gentile ${name},` |
| Pagamento ricevuto | `pagamento_ricevuto` | `Gentile ${name},` |
| Ringraziamento | `ringraziamento` | `Gentile ${name},` |

**Non cambiare** la conferma (`type === 'conferma'`): lì `${name}` resta nome e
cognome. E `richiesta_orario` è già a posto: il taglio al solo nome si fa dentro
`messaggioRichiestaOrario`, non qui.

Nota: finché il ringraziamento di questo file non cambia, il suo saluto è
diverso da quello della notifica di partenza (che dice già il solo nome). È lo
stesso testo in due punti: allineandolo qui tornano identici.

Il file non è stato toccato perché è in carico a un'altra attività; le
modifiche non salvate che porta (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state incluse in nessun commit.

## Veste della pagina delle Richieste (12/09/2026, Claude)

Pubblicata e verificata: commit `9accb26` e `bcc6615` su `main`, deploy Vercel
`success` (Production). Bozza approvata da Ania: sopra e sotto il calendario
adesso sono la stessa pagina, con le regole della Home.

**Punto 1 — i comandi tutti della stessa famiglia** (`9accb26`).
Nuovo `components/richieste/ComandiPagina.tsx`: l'interruttore squadrato (fondo
`#EFEADF`, angoli 6, 2 px di bordo interno, parole alte 22 px in 11,5 bold, la
scelta su bianco con angoli 4), «+ Nuova richiesta» (alto 24, sage, green-mid
11,5 bold, angoli 4, 9 ai lati) e le etichettine degli avvisi (angoli 4, 11
bold, 2 e 7 px). `InterruttoreVista` e «Ordina» sono lo STESSO interruttore:
niente più bottoni tondi sparsi. Sul telefono i comandi stanno in tre righe
sotto il calendario — interruttore e «+ Nuova richiesta», gli avvisi, «Ordina».
In cima `components/richieste/TestataRichieste.tsx`: «Richieste» in Georgia 26
e sotto `lib/testataRichieste.ts` → «28 aperte · 9 nuove dal sito».

**Punto 2 — la riga della richiesta** (`bcc6615`).
Riga separata dal filo `card-border`, 11 px sopra e sotto, senza riquadri.
Etichettina blu `⧉ N altre` (`#DCE7ED` / `#3F6377`) DAVANTI al nome; nome 14,5
semibold; «oggi / ieri / N giorni fa» in fondo a destra, 11 px `#B9B6AD`.
Seconda riga 13 px `#6b736a` con date, notti, persone e camera: forti solo le
PERSONE e la CAMERA chiesta (`pezziRigaRichiesta({ forte: 'persone-camera' })`).
Ultima riga: la pastiglia `BOTTONE_PIENO` dei tasti WhatsApp (5 px sopra e
sotto, 12 ai lati), «Modifica» e «Rifiuta» come parole 13 px stone a 14 px di
distanza, e in fondo a destra le due icone nude 17 px green-mid. Tolti il tasto
verde largo quanto la riga e i tondi col contorno.

**Due scelte segnalate ad Ania.** La nota del cliente resta `#C00000`, non
`#C0392B` come diceva il testo dell'incarico: «come nella Home» e la regola
dell'8 settembre valgono di più di un codice colore vecchio. E l'etichettina
blu con una sola richiesta dice «1 altra», non «1 altre».

**Prove.** 1035 test verdi (`npm test`), TypeScript e build puliti; lint senza
nuove diagnostiche sui file toccati. Nuovi casi in `lib/testataRichieste.test.ts`
(la riga del conto), `lib/rigaRichiesta.test.ts` (riga unica nei vari casi,
etichettina blu, ordine dei pezzi) e `lib/richieste.test.ts` (famiglia dei
comandi, tre righe sotto il calendario, i quattro comandi dell'ultima riga con
le loro misure, la nota rossa, il testo della pastiglia nei due stati).
Anteprima senza rete a 390×844 (porta 3214): una richiesta piana è alta 97 px,
una con nota o sovrapposizione 118–123 px; fra la barra in alto e il menu in
basso se ne vedono 5 intere. Aree da toccare misurate a schermo: pastiglia 46,
«Modifica» 50, icone 44, etichettina blu 48. La seconda riga sta in una riga
sola nei casi normali; va a capo solo quando le persone cambiano più volte
(«2 → 3 → 2»), invece di nascondere la camera.

## Comandi delle Richieste, seconda passata (12/09/2026, Claude)

Pubblicata e verificata: commit `744ca93`, `e246aab`, `cd8c59f` e `8e49cf7`
su `main`, deploy Vercel `success` (Production, `8e49cf7`). Ania aveva visto
la pagina dal telefono: le righe delle richieste andavano bene, i comandi
sotto il calendario no.

**1 — un solo interruttore a pillola** (`744ca93`, `8e49cf7`).
Nuovo `components/InterruttorePillola.tsx`: pillola col contorno #C9BFA8 di
1 px e 2 px di bordo interno, fondo trasparente, parole 11 px semibold
green-dark con 8 px ai lati e 4 sopra e sotto, la scelta su green-mid col
testo crema; `grande` per le misure del Mac. Lo usano TUTTI E TRE i posti che
prima lo ridisegnavano: `app/calendario/page.tsx`, il calendarietto
`components/richieste/CalendarioRichieste.tsx` e «Reale | Presunta»
(`InterruttoreVista`). Area da toccare 44 px, fuori dal disegno.

**2 — avvisi e ordinamento a parole** (`e246aab`).
Via `InterruttoreSquadrato`, `EtichettaAvviso`, `TastoAvviso` e i due colori
delle pastiglie. Al loro posto, in `ComandiPagina`, due righe da 12,5 px:
`RigaDaGuardare` (pallino ottone 7 px, «3 da guardare» bold #7A5C1E, coda
grigia « · ferme da più di un giorno»; accesa «· mostra tutte»; senza ferme
non compare) e `RigaOrdina` («Ordina per arrivo notti persone», la scelta in
green-mid bold con sottolineatura `rgba(169,136,78,0.45)` a 4 px). Testi e
scelte stanno in `lib/comandiRichieste.ts`. «durata» si legge «notti»: stessa
scelta di prima, parola della riga della richiesta. Le «nuove dal sito»
restano solo nel sottotitolo in cima.

**3 — il grassetto della riga** (`cd8c59f`).
`pezziRigaRichiesta({ forte: 'elenco' })` al posto di `'persone-camera'`:
semibold green-dark le date con la freccia tutte intere, il NUMERO delle
notti, il NUMERO delle persone (e la sequenza «3 → 1», freccia compresa) e la
camera — «Ambra» oppure «qualsiasi», con la parola «camera» grigia. Il testo
che si legge non cambia. L'ultima riga non è stata toccata.

**Prove.** 1038 test verdi (`npm test`), TypeScript e build puliti, lint senza
nuove diagnostiche sui file toccati. Nuovi casi in `lib/richieste.test.ts` (il
selettore unico usato dalle tre pagine; «da guardare» nei due stati e assente;
le tre parole dell'ordinamento; le due righe sotto il calendario) e in
`lib/rigaRichiesta.test.ts` (forti solo i pezzi indicati, «qualsiasi» forte e
«camera» no, la sequenza «3 → 1», le icone di contatto sempre presenti).
Anteprima senza rete a 390×844 (porta 3214): misurate a schermo la pillola
(alta 30,5 px, area 44,5) identica in Richieste e Calendario — 11 px, peso
600, riempimento 4/8, #C9BFA8, green-mid/crema — e le due righe di parole,
alte 44 px. Filtro «da guardare» acceso e spento dalla UI vera, ordinamento
cambiato in «persone» e lista riordinata.

**Rifinitura dopo il rilascio** (`fbcef16`, deploy Vercel `success`).
Nella riga dell'elenco la parola «camera» non si scrive più: si legge
«· Ambra» oppure «· qualsiasi» (`pezziCamera(..., { soloValore: true })`).
Nella testa della proposta, dove la riga è grande, l'etichetta resta: il modo
`'numeri'` continua a dire «camera qualsiasi». La seconda riga passa da 13 a
13,5 px; misurata a schermo sta ancora in una riga sola (18 px) nei casi
normali e va a capo solo col soggiorno lungo di 10 notti e «2 → 3 → 2».

**Da decidere (Ania).** Le due icone di contatto non compaiono quando la
richiesta non ha il numero di telefono (nell'anteprima: «Sara Verdi»). Non è
una regressione — è così da sempre e non l'ho toccato — ma se le vuoi sempre
a schermo va deciso cosa devono fare senza numero.

## Comandi delle Richieste, terza passata (12/09/2026, Claude)

Pubblicata e verificata: commit `c24929e` su `main`, deploy Vercel `success`
(Production, `c24929e`). Chiude il punto 2 della seconda passata, che Ania dal
telefono trovava ancora troppo piccolo.

**Le due righe di parole a 14 px.** In `ComandiPagina` `TESTO_RIGHE` passa da
12,5 a 14: 14 px è la misura MINIMA chiesta da Ania, non una preferenza. La
riga cresce a 20 px e il riempimento scende a 12 sopra e 12 sotto, così l'area
da toccare resta esattamente 44 px. Il resto del disegno non cambia: pallino
d'ottone 7 px, «3 da guardare» bold `#7A5C1E`, coda grigia, la scelta
dell'ordinamento in green-mid bold con la sottolineatura d'ottone chiaro.

**Via il titolo «Richieste».** `TestataRichieste` non ha più l'`<h1>` in
Georgia 26: la barra in alto della pagina dice già dov'è e leggerlo due volte
rubava una riga di schermo. La prima cosa della pagina è adesso
«N aperte · N nuove dal sito», che sale da 12,5 a 13,5 px. Tolto anche
`TITOLO_RICHIESTE` da `lib/testataRichieste.ts`: non lo usa più nessuno.

**Punti 1 e 3 dell'incarico erano già in produzione** con la seconda passata
(`744ca93`/`8e49cf7` il selettore unico, `cd8c59f`/`fbcef16` il grassetto e la
parola «camera» tolta, con la seconda riga già a 13,5 px). Riverificati a
schermo, non riscritti.

**Prove.** 1038 test verdi, TypeScript e build puliti, lint senza diagnostiche
sui file toccati — eseguiti su una COPIA FERMA del candidato (`git worktree`
su `c24929e`), perché l'albero principale aveva lavoro in corso di un'altra
attività. Casi nuovi in `lib/testataRichieste.test.ts` (niente `<h1>` e niente
`fontFamily`, il conto a 13,5, `TITOLO_RICHIESTE` sparito dalla libreria, il
conto è la prima cosa della pagina) e in `lib/richieste.test.ts` (le righe di
parole a 14 px, con il controllo che non riscendano sotto; riga 20 px e
riempimento 12). Anteprima senza rete a 390×844 (porta 3214), misurato a
schermo: conto 13,5 px stone; «3 da guardare» 14 px, bold `rgb(122,92,30)`,
riga alta 44; «Ordina per» 14 px stone, scelta green-mid 700 con
`underline 1px rgba(169,136,78,0.45)`, riga alta 44; nessun `<h1>`. Filtro
acceso («3 da guardare · mostra tutte», 28 → 3 richieste) e spento dalla UI
vera. Pillola identica nelle due pagine, misurata su tutt'e due: alta 30,5,
`1px solid rgb(201,191,168)`, riempimento 2, fondo trasparente, parole 11 px
peso 600, area da toccare 44,5.

**Le icone di contatto: caso chiuso.** Ania: «il cliente non può mandare la
richiesta senza aver inserito il numero». È vero nel codice: `lib/richiesteWeb`
rifiuta la richiesta dal sito con «Numero di telefono mancante o troppo corto»
(meno di 8 cifre). Quindi sulle richieste vere le due icone ci sono sempre e
non c'è niente da cambiare. Resta un solo modo per creare una richiesta senza
numero: scriverla a mano in `/richieste/nuova`, dove il campo Telefono non è
obbligatorio. Se dà fastidio si rende obbligatorio anche lì — è
`components/richieste/ModuloRichiesta.tsx`, oggi in carico a un'altra attività.

**Un commit di un'altra chat era finito insieme al mio.** Mentre lavoravo,
un'altra attività ha creato `5609e2d` («Nell'ordinamento torna la parola
"durata"») che aveva raccolto anche i miei file, già pronti nell'indice. L'ho
diviso in due commit senza perdere niente: `b92184e` con il solo lavoro loro
(`lib/comandiRichieste.ts` e la riga di prova sulle tre parole, messaggio
originale conservato) e `c24929e` col mio. L'albero dei due commit è identico
a quello di `5609e2d` (`git diff` vuoto). Le loro modifiche non salvate
(`app/prenotazioni/[id]/page.tsx`, `lib/condizioniPrenotazione.ts`,
`components/richieste/ModuloRichiesta.tsx`, `lib/richiesteWeb.ts`,
`lib/whatsapp.ts`, `lib/whatsapp.test.ts`) non sono state toccate né spinte.

**«durata» e non «notti».** L'incarico diceva «Ordina per arrivo notti
persone», ma la scelta più recente salvata è «durata». Chiesto ad Ania, che ha
confermato «durata»: la riga si legge «Ordina per arrivo durata persone».

## Il numero di telefono è obbligatorio (12/09/2026, Claude)

Pubblicato e verificato: commit `248de2c` su `main`, deploy Vercel `success`
(Production). Decisione di Ania: «la richiesta deve per forza avere il numero,
se no il cliente non può mandare proprio la richiesta».

Dal sito era già così (`validaRichiestaWeb`); il **modulo a mano** lo lasciava
passare vuoto, e quelle richieste restavano senza le due icone per chiamare e
scrivere — era il caso aperto della nota precedente, adesso chiuso. La regola
sta in un posto solo: `numeroUsabile` in `lib/whatsapp.ts` (almeno 8 cifre
dopo la normalizzazione), usata sia da `ModuloRichiesta` sia da
`lib/richiesteWeb`. Messaggio nel modulo: «Il numero di telefono è
obbligatorio: senza non si può né chiamare né scrivere.»

Prove: 1040 test verdi, TypeScript e build puliti. Nuovi casi in
`lib/whatsapp.test.ts` (numeri italiani, stranieri, vuoti e troppo corti; il
modulo che controlla prima di salvare; la stessa regola nel percorso del
sito). Nell'anteprima senza rete, dalla UI vera: salvataggio senza numero
fermato col messaggio, poi con il numero la richiesta viene salvata e si torna
all'elenco.

**Attenzione al lavoro parallelo.** Mentre lavoravo, un'altra attività ha
lavorato sugli stessi file nella stessa copia: ha fatto `git reset` su
`2ee101e` e ha ricommittato («durata» come `b92184e`, poi `c24929e` con le due
righe a 14 px e il titolo tolto). Il contenuto è coerente e i test passano,
ma è successo quello che il metodo vieta: due autori sullo stesso file.
Prima di continuare su questa pagina serve accordarsi su chi la tiene.

Le richieste GIÀ salvate senza numero (dati vecchi) restano senza icone: la
regola vale da adesso in avanti e non modifica le righe esistenti.

## La prima riga della richiesta, come la Home (12/09/2026, Claude)

Pubblicata e verificata: commit `afe7ba4` su `main`, deploy Vercel `success`
(Production). Ania, dal telefono: la riga della richiesta deve avere la forma
delle righe «Da controllare» della Home.

**Prima riga**: nome e date insieme, 15 px semibold green-dark col puntino in
mezzo — «Anna Sawicka · gio 29 → sab 31 ott» — la stessa misura del titolo di
`components/DaControllare.tsx` (`text-[15px] font-semibold text-green-dark`).
Davanti resta l'etichettina blu «⧉ 2 altre»; «oggi / ieri» resta in alto a
destra, 11 px `#B9B6AD`, allineato alla prima riga anche quando il titolo va a
capo. Come nella Home il **nome non si taglia**: se non ci sta, le date vanno
a capo intere e il puntino resta attaccato al nome (niente «·» appeso in testa
alla riga sotto, che sembrava un elenco puntato).

**Seconda riga**: solo «2 notti · 3 persone · qualsiasi», 13,5 px `#6b736a`,
forti il numero delle notti, quello delle persone (e la sequenza «3 → 1») e la
camera. Le date non stanno più qui.

Nuova funzione pura `pezziRigaElenco` in `lib/rigaRichiesta.ts`, più
`titoloRigaRichiesta(nome, periodo)`; `pezziRigaRichiesta` torna a essere solo
la riga intera della **testa della proposta** (numeri forti, «camera
qualsiasi» per esteso) e il modo `forte` sparisce: ogni riga ha la sua
funzione.

**Prove.** 1042 test verdi, TypeScript e build puliti, lint senza nuove
diagnostiche. Nuovi casi in `lib/rigaRichiesta.test.ts`: il titolo «chi ·
quando» (anche coi mesi diversi e coi pezzi mancanti), la seconda riga nei
vari casi con i soli pezzi forti, la testa della proposta invariata, e sui
sorgenti la misura 15 px presa dalla Home, il nome che non si taglia, il
puntino col nome, «oggi» in alto a destra. Misurato a schermo a 390×844:
titolo 15 px, seconda riga 13,5 px, righe alte 102–123 px, due icone di
contatto su tutte le richieste col numero. A 1280 px i titoli stanno in una
riga sola.

## Nota per chi torna sulla pagina delle Richieste (12/09/2026, Claude)

Pubblicato e verificato: `efc834b`, deploy Vercel `success`.

Due ritocchi chiesti da Ania dal telefono, un commit ciascuno:

- `e64e643` — sotto il calendario non si spiega più il tratteggio. Lo STACCO
  però resta (`data-stacco-calendario`, 24 px): è il distacco fra calendario e
  comandi, non un avanzo. Non toglierlo credendolo codice morto.
- `efc834b` — in cima alla pagina non resta niente: via il titolo e via la riga
  «N aperte · N nuove dal sito». Con essa se ne sono andati
  `components/richieste/TestataRichieste.tsx`, `lib/testataRichieste.ts` e il
  suo test, più lo stato `nuoveWeb` e la chiave `ca_richieste_ultima_visita`:
  non li leggeva più nessuno. La funzione `nuoveDalSito` resta in
  `lib/richieste.ts` con le sue prove, ma ORA NON HA PIÙ CONSUMATORI: se serve
  un pallino «nuove dal sito» da qualche altra parte, il pezzo è già lì.

Prove: 610 test dei moduli verdi, TypeScript e build puliti; a 390×844 sulla
pagina vera le due pillole «Reale / Presunta» e «Mese / 2 settimane» hanno
contorno, fondo e riempimento identici (stesso componente), la riga
«3 da guardare» e le tre parole dell'ordinamento misurano 44 px con testo
14 px, e il filtro si accende e si spegne.

**Da decidere con Ania.** L'incarico chiedeva «Ordina per arrivo **notti**
persone», ma poche ore prima Ania aveva scelto «**durata**» (commit `b92184e`,
dopo aver provato «notti»). È rimasta «durata», decisione più recente e già
online; cambiarla è una parola in `ORDINI_RICHIESTE` (`lib/comandiRichieste.ts`).

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

## La riga della richiesta = le righe «Da controllare» della Home (12/09/2026, Claude)

Pubblicata e verificata: commit `a8ed29d` su `main`, deploy Vercel `success`
(Production). Richiesta di Ania dal telefono: «esattamente come la Home, senza
invenzioni».

    OGGI · DAL SITO      ⧉ 1 altra
    Anna Sawicka · gio 29 → sab 31 ott
    2 notti · 3 persone · qualsiasi

Stesse classi di `components/DaControllare.tsx`, controllate da un test che
legge TUTT'E DUE i file: `text-[10px] uppercase tracking-[1.5px] text-brass`
per l'etichetta, `text-[15px] font-semibold text-green-dark leading-snug
mt-0.5` per il titolo, `text-[12.5px] leading-snug mt-0.5` + color stone per
la riga sotto, `<NotaCliente ... piccola className="mt-1" />` per la nota,
12 px sopra e sotto come `py-3`. Se la Home cambia misura, il test lo dice.

Nuova funzione pura `etichettaRigaRichiesta(created_at, canale, adesso)` in
`lib/rigaRichiesta.ts`: «ieri · dal sito», «oggi · telefono» (le maiuscole le
fa il disegno). L'etichettina blu «⧉ 2 altre» è salita in quella riga; «ieri»
non sta più staccato a destra. Nella riga sotto restano forti solo il numero
delle notti, quello delle persone (o «3 → 1») e la camera, senza la parola
«camera». La riga dei comandi non è stata toccata.

Il conto si legge solo nella riga della sezione: «RICHIESTE APERTE · 28», col
puntino chiesto da Ania (in cima alla pagina non c'è più niente, `efc834b`
dell'altra attività).

**Prove.** 1043 test verdi, TypeScript e build puliti, lint senza nuove
diagnostiche. Nuovi casi in `lib/rigaRichiesta.test.ts` (l'etichetta nei vari
canali, coi giorni e senza data; le classi prese dalla Home; l'ordine dei
pezzi; «ieri» non più a destra) e aggiornato quello della nota in
`lib/richieste.test.ts` (adesso `piccola`, come la Home). Misurato a schermo a
390×844: etichetta 10 px/1,5 px/#A9884E, titolo 15 px peso 600, riga sotto
12,5 px color stone, righe alte 125–146 px, etichettina blu 48 px da toccare,
due icone di contatto su tutte le richieste col numero. Le due pillole
«Reale | Presunta» e «Mese | 2 settimane» confrontate a 390: identiche.

Nota: la veste `home` di `NotaCliente` (tutta rossa, 13 px) non è più usata da
questa riga; resta nel componente per la Home.

## La fascia dei comandi (12/09/2026, Claude)

Pubblicata e verificata: commit `3ddf1ba` su `main`, deploy Vercel `success`
(Production). Le due righe di parole sono diventate una fascia sola, con la
veste della fascia della scheda prenotazione (`components/FasciaSezioni`):

    ARRIVO      DURATA      PERSONE      DA GUARDARE · 3

Nuovo `components/richieste/FasciaComandi.tsx`: filo `rgba(169,136,78,0.55)`
sopra e sotto, fondo `var(--color-cream)`, voci in maiuscolo 10 px con
spaziatura 0,6 px color stone, 11 px sopra e sotto, `justify-between` su tutta
la larghezza; l'accesa in `#A9884E` grassetto. Ogni voce si tocca su 44 px
(`py-[15px] -my-[15px]`) senza alzare la fascia. `SPAZIATURA_STRETTA` pronta se
un giorno le voci non ci stessero: si stringe la spaziatura, mai le lettere.

Cosa c'è scritto e cosa è acceso lo decide `vociFascia` in
`lib/comandiRichieste.ts`: le tre dell'ordine (una sola accesa) più «da
guardare · N», che è un interruttore a sé — accendendolo l'ordine scelto resta
acceso — e che non compare quando non ci sono richieste ferme. `ComandiPagina`
adesso contiene solo «+ Nuova richiesta»; `RigaDaGuardare`, `RigaOrdina` e
`rigaDaGuardare` non esistono più.

La parola di mezzo resta **DURATA**: il foglio dell'incarico diceva «notti»,
ma Ania aveva scelto «durata» un'ora prima — richiesto e confermato coi
bottoni prima di pubblicare.

**Prove.** 1043 test verdi, TypeScript e build puliti. Nuovi casi in
`lib/richieste.test.ts`: la veste presa dalla fascia della scheda (filo, fondo,
misure, 44 px), le quattro voci col numero dentro, una sola accesa fra le tre
dell'ordine, il filtro che si accende senza spegnere l'ordine, la voce assente
con zero ferme (anche col filtro rimasto acceso), e la fascia sotto la riga
dell'interruttore. Misurato a schermo a 390×844: fascia alta 39 px su 358 di
larghezza, una riga sola, voci 10 px/0,6 px, ogni voce alta 45 px da toccare.
Provato dalla UI vera: filtro acceso → 3 richieste e titoletto «DA GUARDARE»,
cambio ordine col filtro acceso → resta filtrato, filtro spento → tutte e 28.

## Le tre pagine cominciano dallo stesso punto (12/09/2026, Claude)

Pubblicato e verificato: commit `07bbbcf` su `main`, deploy Vercel `success`
(Production). Tolto il titolo, la pagina delle Richieste era salita e cominciava
più in alto di Calendario e Arrivi.

**Misure nel browser a 390×844**, dal bordo alto al campo «Cerca nome o
telefono»: Calendario 112 px, Arrivi 112 px, **Richieste 71 px**. Dopo:
**112 px tutte e tre**. Sul Mac a 1280 px: 67 px tutte e tre (prima le
Richieste non avevano affatto quella fascia).

Nuovo `components/TestaPagina.tsx`, usato da `app/calendario/page.tsx`,
`app/arrivi/page.tsx` e `app/richieste/page.tsx`: fascia ferma in cima
(`sticky top-12 lg:top-0`, `px-4 pt-4 pb-2`, fondo crema velato), riga
«← Indietro» nascosta sul telefono (`.indietro-barra`), riga del titolo
(`mt-0 lg:mt-4 mb-2`). Il titolo tiene il suo spazio anche quando non si legge:
sul telefono `max-lg:invisible` come già facevano le altre due; nelle Richieste
`titoloNascosto` lo tiene invisibile anche sul Mac, perché lì Ania non lo vuole
più. È quello spazio a tenere allineate le tre pagine: nessun numero scritto a
mano, e se cambia cambia per tutt'e tre.

Le Richieste non hanno più il contenitore `p-4` né `BackBar`: il corpo sta in
`px-4 pb-4` e la freccia è il `BackLink` dentro la testa (stessa destinazione
di prima: Home, oppure la scheda da cui si è arrivati con `?apri=`).

**Prove.** 1044 test verdi, TypeScript e build puliti, lint senza nuove
diagnostiche (in `app/arrivi/page.tsx` restano le 17 preesistenti, contate
prima e dopo). Nuovo caso in `lib/richieste.test.ts`: le tre pagine usano la
testa condivisa e nessuna si riscrive la fascia o il titolo a mano; aggiornati
i due casi che cercavano `BackBar` e il titolo nella testa delle Richieste.

## I dati della riga grandi come il nome (12/09/2026, Claude)

Pubblicato e verificato: commit `ac11371` su `main`, deploy Vercel `success`
(Production). Ultimo ritocco chiesto da Ania sulla riga della richiesta.

Nella riga sotto il titolo le parole di mezzo restano 12,5 px color stone —
la misura del «motivo» della Home — mentre i DATI passano a **15 px semibold
verde scuro**, come il titolo: il numero delle notti, quello delle persone (o
la sequenza «3 → 1», freccia compresa) e la camera. Misurato a schermo:
`10@15px · 2→3→2@15px · qualsiasi@15px`, parole a 12,5.

La nota della cliente usa lo stesso `NotaCliente` della Home nella misura
**grande**: 15 px semibold, tutta `#C00000`. La vecchia veste `home` (13 px),
che non usava più nessuno, è diventata `grande`; in «Da controllare» la nota
resta `piccola`, quella misura non è stata toccata.

**Prove.** 1044 test verdi, TypeScript e build puliti, lint senza nuove
diagnostiche. Aggiornati i casi sulla nota (`lib/richieste.test.ts`) e sulla
riga (`lib/rigaRichiesta.test.ts`: i pezzi forti devono essere
`text-[15px] font-semibold text-green-dark` e le parole di mezzo restare a
12,5). Misurato a 390×844 su quattro richieste: titolo 15, base 12,5, forti
tutti a 15, nota 15 px `rgb(192,0,0)` peso 600, due icone di contatto su tutte
le richieste col numero.

## La cliente che torna: elenco e parte CLIENTE (12/09/2026, Claude)

Pubblicato e verificato: commit `08033b2` e `58d6be9` su `main`, deploy Vercel
`success` (Production). Il riconoscimento resta quello di sempre
(`lib/clienteCheTorna`: telefono a cifre, oppure nome e cognome), raccolto in
`clienteDellaRichiesta` e usato SIA dall'elenco SIA dalla proposta: prima la
proposta se lo riscriveva a mano.

**1 — nell'elenco** (`08033b2`). L'etichetta in alto diventa
«OGGI · DAL SITO · GIÀ STATA QUI 2 VOLTE», oppure «· GIÀ IN ARCHIVIO» per chi
c'è ma non ha soggiorni conclusi (`pezzoCliente` in `lib/rigaRichiesta`);
stella ★ d'ottone davanti al nome per la cliente ottima; «RICEVUTA» in 11 px
maiuscola ottone dopo il nome; in fondo alla seconda riga il totale speso in
rosso `#C00000`, grande come la camera. Chi è alla prima volta non ha niente
di tutto questo. Via la pastiglia verde «Già stato da noi». La pagina legge
anche `guests` (`select('*')`, regge senza la colonna `vuole_ricevuta`).

**2 — dentro la richiesta** (`58d6be9`). Nuovo `components/ParteCliente.tsx`,
di sola presentazione, in fondo alla proposta prima di «Rifiuta la richiesta»:
titoletto col filo d'ottone, griglia SOGGIORNI · TOTALE SPESO · RICEVUTA ·
PROVENIENZA (etichette 9 px ottone, valori 14,5 semibold), i soggiorni uno per
riga (camera in Georgia 20 px, date e notti in grigio, anno in ottone per gli
altri anni, importo a destra, la riga apre la prenotazione), la nota in rosso e
«Apri il cliente ›». La stessa parte servirà alla nuova scheda prenotazione.
Nuova `elencoSoggiorniPersona`; `soggiorniDellaPersona` adesso la riusa.
Nuovo `lib/euroTondi.ts`: «1.360 €» in un posto solo.

**Prove.** 1051 test verdi, TypeScript e build puliti, lint senza nuove
diagnostiche. Nuovi casi: l'etichetta nei tre casi, stella/«ricevuta»/totale
nella riga, `elencoSoggiorniPersona` (camere unite, notti, soldi, ordine),
`clienteDellaRichiesta` (telefono, nome, telefono che vince), la veste della
parte CLIENTE e la sua posizione nella proposta, `euroTondi`. Anteprima senza
rete a 390×844 su tre clienti: Carmela Sabia (2 soggiorni, stella, ricevuta,
1.360 €, parte CLIENTE con l'anno 2025 in ottone), Rosa Archivio («GIÀ IN
ARCHIVIO», parte CLIENTE con «Nessun soggiorno concluso» e il link), Marek
Kowalski (nuova: nessun segno, nessuna parte CLIENTE).

## La scheda prenotazione nuova, parte 1 di 2 (13/09/2026, Claude)

Pubblicata e verificata: commit `4110b7e`, `43af189`, `77261ea` e `a9a7d28`
su `main`, deploy Vercel `success` (Production, `a9a7d28`). La scheda rifatta
nasce a **`/scheda/<id>`** (`app/scheda/[id]/page.tsx`); `/prenotazioni/<id>`
NON è stata toccata e resta quella in uso finché la nuova non è completa.

**Cosa c'è.** Testa (TestaCliente), fascia ferma in cima (FasciaSezioni),
DA CONTROLLARE (SchedinaControllo) e SOGGIORNO; la parte CLIENTE è già quella
della proposta (ParteCliente). CONTO e MESSAGGI hanno solo il titoletto e un
rimando alla scheda attuale: arrivano con la parte 2, ma la fascia ha già le
cinque voci e ognuna porta da qualche parte.

**Logica pura in un posto solo**: `lib/schedaPrenotazione.ts` — stato in alto
a destra, prima riga («Già stata qui N volte · provenienza» / «Prima volta»,
con `chiediProvenienza` quando manca), etichetta dell'arrivo, riga grande
OSPITI · CAMERA coi cambi, stato del conto nei tre casi, note, striscia delle
notti, riga «Arrivo», tratti di camera e «Da controllare» della scheda.
Le cifre NON si ricalcolano: `contoPrenotazione` di `lib/prenotazioneUnica`,
la stessa lettura della scheda attuale. «Da controllare» riusa
`eccezioniPagamenti/Arrivi/Calendario` di `lib/daControllare` filtrate su
questa prenotazione, più due voci che si vedono solo da qui (cambio camera di
oggi o domani, documento mancante a chi è in casa).

**Pezzi condivisi estesi, mai duplicati.** `TestaCliente` accetta prima riga
già scritta, «da dove? ›», nome in peso normale, etichette delle date, riga
grande, riga sotto la riga grande, riga dei documenti e note nella veste della
scheda: senza i nuovi valori la proposta resta identica. `FasciaSezioni` ha
`top` e `spaziatura` (la scheda: `top-12 lg:top-0`, 0,6 px) e adesso conta
l'altezza della barra quando scende a una parte. `SchedinaControllo` ha
`grande` (titolo 15, dettaglio 13). `RigaDocumentiPrenotazione` ha la veste
`scheda` e accetta il conteggio già letto.

**Nuovi componenti**: `components/scheda/StrisciaNottiScheda.tsx`,
`SoggiornoScheda.tsx` (riga Arrivo, tratti, i tre link), `ArriviPrecedenti.tsx`,
`Foglio.tsx`, `FoglioArrivo.tsx` (salva con `lib/arrivoOrario`),
`FoglioProvenienza.tsx` (salva sul CLIENTE con `lib/provenienzaDati`).

**Prove.** 1083 test verdi, TypeScript e build puliti, lint senza diagnostiche
sui file nuovi. Nuovi casi in `lib/schedaPrenotazione.test.ts` (logica: stato,
prima riga, etichetta arrivo, riga grande con una camera/coi cambi/con due
camere, conto nei tre casi, note, striscia con cambio camera e ospiti diversi
per notte, tratti col numero di notti sempre scritto, «Da controllare» con due
cose e con niente) e in `lib/scheda.test.ts` (il disegno letto dai sorgenti:
misure e colori decisi da Ania, i pezzi riusati invece di riscritti, le cinque
parti nell'ordine della fascia). Anteprima senza rete a 390×844 (porta 3213):
Carmela Sabia (10–17 set nello scenario, Lena → Amelia → Lena, due cambi,
470 € pagati), una prenotazione futura non pagata (bonifico atteso, «Tutto a
posto») e una prima volta senza note e senza orario; misurato a schermo che
niente esce dai margini (scrollWidth 390) e provato anche a 1280 px.

**La parte 2 è uscita**: vedi la sezione qui sotto.

**I rimandi alla scheda vecchia restano (Ania, 13/09/2026).** Il tocco su una
notte della striscia e «Modifica soggiorno» continuano a portare ai fogli di
`/prenotazioni/<id>`: è voluto, non una cosa lasciata a metà. Si rifaranno
dentro la scheda nuova, insieme alla striscia, con un incarico a parte — non
vanno quindi inclusi nella parte 2 se non viene chiesto.

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

## La scheda prenotazione nuova, parte 2 di 2 (13/09/2026, Claude)

Pubblicata e verificata: commit `e811c48`, `cd0e48a`, `f5b978c` e `6d75818`
su `main`, deploy Vercel `success` (Production, `6d75818`). Con questa,
**`/scheda/<id>` è completa**: CONTO, MESSAGGI, CLIENTE e CRONOLOGIA si
aggiungono a testa, fascia, DA CONTROLLARE e SOGGIORNO della parte 1.
`/prenotazioni/<id>` non è stata toccata.

**CONTO.** `lib/schedaConto.ts` (funzioni pure) e
`components/scheda/ContoScheda.tsx`: «Saldato» in verde o quanto manca in
rosso `#D40000` (Georgia 32), il dettaglio a destra su due righe, la barretta
della quota pagata, il conto riga per riga («Lena, 12 → 14 · 2 notti × 80 €»,
il letto in più a parte, lo sconto in ottone col meno), il totale in Georgia
24 sopra un filo d'ottone, l'accordo in parole e i pagamenti registrati.
**Il totale e il residuo vengono da `contoPrenotazione`**: qui si spezza solo
il conto in righe, e se un dato vecchio non torna il tratto si mostra in una
riga sola col totale autorevole.

**MESSAGGI.** `lib/messaggiPrenotazione.ts` + `components/scheda/MessaggiScheda.tsx`.
Interruttore «WhatsApp Ania / Business» con `components/InterruttorePillola`
(lo stesso del calendario), tasto pieno «Conferma · immagine e testo» largo
quanto la scritta che apre `components/ConfermaWhatsApp`, otto pastiglie sage
in due colonne, «Annullamento» col solo contorno in fondo.

> ⚠️ **I testi sono una COPIA ESATTA** di quelli in
> `app/prenotazioni/[id]/page.tsx`, che è in carico a un'altra attività e non
> si poteva toccare per esportarli. `lib/messaggiPrenotazione.test.ts`
> confronta i due sorgenti carattere per carattere e fallisce appena uno dei
> due cambia. **Quando quel file torna libero**: cancellare `buildWhatsappMsg`
> (e `bagnoDesc`, `roomPageLink`, `formatDateIT`) da lì, importarli da
> `lib/messaggiPrenotazione`, e togliere il confronto dal test. Vale anche per
> la regola dei nomi del 12/09 (nome e cognome solo nella conferma senza
> immagine): quando si applica, va applicata alla libreria, non alla copia.

**CLIENTE.** `components/scheda/ClienteScheda.tsx`: griglia a due colonne
(telefono, arrivata da, valutazione, ricevuta, nota), «da dove? ›» che apre il
foglio della testa, «Modifica dati · Cambia cliente», i soggiorni precedenti
col totale speso accanto al titolo (ogni riga apre quella prenotazione in
`/scheda/<id>`) e «CON LEI» con i contatti in più della prenotazione. Nella
scheda **prende il posto di `ParteCliente`**, che resta alla proposta.

**CRONOLOGIA.** `components/scheda/CronologiaScheda.tsx` e `righeStoria` in
`lib/schedaConto`: modifiche (`booking_events`, proposta 0042) e messaggi
partiti (`booking_whatsapp_log`) messi insieme dalla più vecchia, i messaggi
col fumetto in verde, e la riga che dice che le risposte restano su WhatsApp.
Senza la 0042 la parte lo dichiara invece di fingere un registro vuoto.

**Prove.** 1113 test verdi, TypeScript e build puliti, lint senza diagnostiche
sui file nuovi. Nuovi casi in `lib/schedaConto.test.ts` (conto saldato, con
acconto e col bonifico atteso; righe dei tratti, del letto, dello sconto e il
ripiego sul totale salvato; accordo; pagamenti; voci del cliente con e senza
provenienza; «con lei» con i pezzi mancanti; cronologia con e senza messaggi),
in `lib/messaggiPrenotazione.test.ts` (il confronto dei sorgenti, i nove tasti,
il residuo col bonifico, il cambio camera) e in `lib/scheda.test.ts` (il
disegno delle quattro parti letto dai sorgenti). Anteprima senza rete a
390×844 su tre prenotazioni: Carmela Sabia (saldata, due cambi camera, due
persone con lei, due messaggi inviati), una futura non pagata (300 € da
incassare, barretta vuota) e una prima volta. Aperti la finestra della
conferma con l'immagine e i link WhatsApp col testo giusto.

**Restano fuori, per decisione di Ania**: il tocco su una notte, «Modifica
soggiorno», «Aggiungi pagamento», «Cambia accordo», «Modifica dati»,
«Cambia cliente», «Vedi tutto», «Altre modifiche» e «Annulla prenotazione»
portano ai fogli di `/prenotazioni/<id>`. Si rifaranno con incarichi a parte.
Da decidere con Ania: quando spegnere la scheda vecchia.

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

## La striscia delle notti: un pezzo solo, e si cambia di lì (13/09/2026, Claude)

Bozza approvata da Ania. La striscia mostra e fa cambiare, in un colpo solo,
la camera di ogni notte e il letto in più: **sostituisce il foglio «Modifica
soggiorno» a tre passi**, che dalla scheda nuova è sparito. Restano «Modifica
arrivo» e «Arrivi precedenti».

**Tre pezzi, un commit per punto.**

- `lib/strisciaNotti.ts` (`767977b`) — le regole, in un posto solo. Le notti
  lette dai tratti salvati, il riassunto «2 cambi camera · letto in più 4
  notti», gli avvisi delle notti senza camera, le camere libere di quella
  notte, il letto disponibile, le tre modifiche del foglietto e il piano di
  salvataggio. **Niente regole riscritte**: chi è libero viene da
  `lib/disponibilita`, i due letti di casa da `lib/lettiAggiuntivi`, capienze
  e prezzi da `lib/tariffe` e `lib/prezzoNotti`, lo sconto da `lib/conto`.
- `components/StrisciaNottiCamere.tsx` (`0085bab`) — il disegno. **Il nome
  non è `StrisciaNotti.tsx` perché quel nome è già preso** dalla striscia
  delle richieste (persone/camera per notte), usata da `/richieste/[id]/proposta`
  e da `ModuloRichiesta`: non è stata toccata.
- `components/FoglioNotte.tsx` (`62997cc`) — il foglietto della notte, e
  `components/scheda/Foglio.tsx` accetta il titolo `grande` (Georgia 18).
- `app/scheda/[id]/page.tsx` (`1028544`) — la striscia al posto di quella di
  prima, il foglietto che si apre nella scheda e il salvataggio; più la
  rifinitura delle aree da toccare (`ed4272a`).
  `components/scheda/StrisciaNottiScheda.tsx` è stato cancellato: non lo usava
  più nessuno. `caselleSoggiorno` resta in `lib/schedaPrenotazione` perché la
  usa ancora «Da controllare» (cambio camera di oggi o domani).

**Due decisioni di Ania, chieste prima di scrivere.** La notte spostata in
un'altra camera prende il **listino della camera nuova**; con più di sette
notti il giorno va **«gio» sopra e il numero sotto**.

**Come salva.** Le notti attaccate con la stessa camera tornano a essere un
tratto solo: i tratti si aggiornano, quelli nuovi si creano, quelli rimasti
senza notti si **annullano** (mai cancellati: l'incasso registrato deve
restare nel conto). **Un tratto rimasto identico non si tocca**, così la
tariffa concordata non viene riscritta col listino — trovato provando dalla
UI vera, dove Amelia a 65 € era diventata 50 €. Se manca il gruppo del
soggiorno se ne fa uno, come fa la scheda attuale; orario e navetta seguono
la riga che arriva per prima; se la riga aperta viene annullata la scheda
passa da sola alla prima rimasta. Ogni scrittura passa da `salvaInSequenza`.

**Cosa NON fa, e va detto ad Ania.**
- **Due camere nelle stesse notti**: la striscia resta ferma e lo scrive
  («si spostano dalla scheda completa»). Con due linee parallele una notte non
  ha una camera sola e il foglietto non saprebbe quale cambiare.
- **Allungare il soggiorno** (aggiungere una notte prima o dopo) dalla
  striscia non si può: si fa da «Vedi tutto». Dalla striscia si tolgono notti
  («Non dorme qui»), non se ne aggiungono.
- **Totale concordato** (`target_total`): se la modifica lo fa decadere il
  salvataggio si ferma e lo dice, invece di far sparire lo sconto in silenzio.
- Quando una modifica **abbassa il totale sotto quanto già incassato** resta
  un credito che la scheda non evidenzia: il conto dice «Saldato». Non è una
  cosa nuova di questo blocco, ma adesso capita più facilmente.
- La notte con il «?» rosso (camera da scegliere) non nasce dai dati di una
  prenotazione esistente: è pronta per l'inserimento di una nuova
  prenotazione, dove la stessa striscia servirà.

**Prove.** 1150 test verdi (`npm test`), TypeScript e build puliti, lint senza
diagnostiche sui file toccati. Nuovi casi in `lib/strisciaNotti.test.ts` (34:
la striscia senza cambi, con uno e con due; la notte senza camera e il suo
avviso; la notte «non dorme qui» esclusa dal conto e il soggiorno che si
spezza; l'ultima notte che non si può togliere; le camere libere e quelle
occupate; la capienza che avvisa senza bloccare; i letti di casa finiti;
Annulla che non tocca la striscia di partenza; il conto che segue il listino;
il tratto identico che non si riscrive; lo sconto in percentuale e quello
concordato che decade; il disegno e il foglietto letti dai sorgenti) e in
`lib/scheda.test.ts` (la striscia nuova nella scheda, «Modifica soggiorno»
sparito, il salvataggio che annulla e non cancella, le due camere parallele).

Anteprima senza rete a 390×844 (porta 3213), dalla UI vera: Carmela Sabia
(sei notti, due cambi) — Annulla che non cambia niente (striscia e conto
identici), la notte del 16 spostata in Ambra (quattro tratti, conto 470 →
460 €, Amelia resta a 65 €), la notte del 15 tolta dal soggiorno (conto 380 €,
«5 notti» in testa); un soggiorno di **10 notti** (colonnine da 44 px, giorno
su due righe, la striscia scorre dentro i margini, `scrollWidth` del corpo
390); un soggiorno **con una pausa** (la notte «libera» tratteggiata, quattro
notti contate). Letto non disponibile provato occupando davvero i due letti
di casa in una notte: «Sì» spento con «non disponibile», e le camere occupate
sparite dall'elenco. A 1280 px colonnine da 111 px e foglietto al centro.
Nell'anteprima `room_id` è ora scrivibile e ci sono i due soggiorni di prova.

**Attenzione, non è roba nostra.** `scripts/revisioni/letto-riapertura.test.mjs`
e `conto-prenotazione.test.mjs` falliscono (16 casi) **già sul commit base
`5468e29`**, con `salvaLetto is not defined`: leggono le funzioni dentro
`app/prenotazioni/[id]/page.tsx`, che è in carico a un'altra attività. Non è
una regressione di questo blocco — verificato eseguendo gli stessi test su una
copia ferma del base e del candidato: 36 verdi e 16 rossi in tutti e due.

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

## «Come paga»: un solo modo di dirlo e di sceglierlo (13/09/2026, Claude)

Prima la stessa cosa si chiamava «Come paga» nella proposta, «Pagamento»
nell'inserimento e «Accordo» nel conto della scheda, con quattro scelte di là
e cinque di qua e tre nomi per la stessa cosa. Adesso i modi sono **sei**,
scritti in un posto solo.

**1 — i nomi** (`d75cd91`). `lib/comePaga.ts`: QUANDO ARRIVA (Contanti ·
Bonifico · Da vedere) e PRIMA DI ARRIVARE (Tutto · Caparra del 50% · Caparra),
con la frase per esteso di ognuno. Nessun altro file se li riscrive.

> **Come è risolto «Da vedere»** (chiesto nell'incarico). La colonna
> `accordo_pagamento` ha un vincolo (proposta 0041): o è vuota, o è uno dei
> cinque valori. Non si poteva quindi inventare un sesto valore senza toccare
> la banca dati. «Da vedere» è il caso in cui **il mezzo non è stato detto**,
> cioè quello che il gestionale salva già oggi quando non si specifica niente:
> `accordo_pagamento` **vuoto** e la spunta `bonifico` **spenta**. Con la
> colonna vuota ma la spunta accesa si legge «Bonifico», che è ciò che quella
> spunta ha sempre significato. Effetto sui dati vecchi: le prenotazioni senza
> accordo salvato (tutte quelle prima della 0041) prima si leggevano «contanti
> all'arrivo» — un'informazione che nessuno aveva mai dato — e adesso si
> leggono «Da vedere». È più onesto, e non cambia nessun dato.

**2 — come si sceglie** (`fe0b52b`). `components/ComePaga.tsx`: le due
etichette di gruppo (9,5 px maiuscole spaziate 1,4 stone), le sei pastiglie
(30 px, 12,5 semibold, contorno #C9BFA8 da spente, green-mid e crema quando
scelte, area da toccare 44 px senza crescere), una sola accesa alla volta fra
tutte e sei, la frase per esteso sotto; con «Caparra del 50%» l'importo
accanto alla frase, con «Caparra» il campo, con tutte e due «Entro il» e «alle».

**3 — dove è usato.**
- **Inserimento** (`22bed21`): la riga si chiama «Come paga» e sotto il nome
  mostra la frase; aprendola ci sono le sei pastiglie al posto dei cinque
  tondini. I valori da salvare li decide `lib/comePaga`, quindi la pagina non
  se li scrive più da sé; una camera aggiunta eredita l'accordo come prima.
- **Scheda** (`2afdca8`): nel CONTO la riga «Accordo» è diventata «Come paga»
  col nome e la frase; «Cambia accordo» è «Cambia come paga» e apre un foglio
  con lo STESSO componente, invece di mandare alla scheda vecchia. La linguetta
  della fascia resta «CONTO». Il salvataggio (`lib/comePagaDati`) scrive modo e
  spunta su tutte le camere e la caparra una volta sola sulla riga che arriva
  per prima, azzerando quella vecchia sulle altre; senza la proposta 0041
  salva la spunta e lo dice.

**Cosa è rimasto fuori, e perché.** La **pagina della proposta delle
richieste** non è stata toccata: i suoi quattro bottoni sono
`CONDIZIONI_PAGAMENTO`/`ETICHETTA_CONDIZIONE` di **`lib/condizioniPrenotazione.ts`**,
che è il lavoro non salvato di un'altra attività e non si poteva toccare. Non è
solo un elenco di nomi: quei quattro tipi (`arrivo`, `caparra`, `completo`,
`personalizzata`) decidono anche i testi WhatsApp approvati parola per parola e
le regole di cancellazione. Mapparli sui sei modi dalla sola pagina avrebbe
perso «Personalizzata» e cambiato il senso dei bottoni senza cambiare i
messaggi. **Quindi «Pagamento completo» resta lì**, e lì resta anche la voce
«Pagamento» nella fascia della proposta. Quando quel file torna libero: portare
i sei modi anche là, decidendo con Ania come si dice «Personalizzata».
Nella scheda **vecchia** (`app/prenotazioni/[id]/page.tsx`, stesso divieto)
restano «Bonifico · intero importo» e gli altri nomi vecchi.

**Prove.** 1180 test verdi, TypeScript pulito, lint senza diagnostiche sui file
toccati; build eseguita sull'albero principale. Nuovi casi in
`lib/comePaga.test.ts` (i sei nomi e le sei frasi, i due gruppi, la
corrispondenza coi valori salvati e il ritorno, «Da vedere» nei suoi casi,
l'importo del 50% arrotondato, la caparra libera, i campi che restano vuoti
senza caparra, i nomi vecchi spariti, il disegno del componente, l'uso
nell'inserimento e nella scheda) e in `lib/comePagaDati.test.ts` (modo su tutte
le camere e caparra una volta sola, colonne della 0041 mancanti, un errore vero
che non si scambia per colonna mancante).

Anteprima senza rete a 390×844, dalla UI vera: nell'inserimento le sei
pastiglie stanno in **due righe dentro i margini** (`scrollWidth` 390, il bordo
destro dell'ultima a 281 px), «Caparra del 50%» accende solo sé stessa e mostra
«· 70,00 €» su un totale di 140, «Caparra» apre il campo, e la prenotazione
salvata porta `caparra_meta`, caparra 7000 centesimi e `bonifico` vero. Nella
scheda il foglio «Cambia come paga» scrive il modo su tutte e tre le camere di
Carmela e la caparra (23500) solo sulla prima; passando a «Da vedere» la
colonna torna vuota, la caparra si azzera e lo stato del conto passa da
«bonifico atteso» a «140 € da incassare».

Nell'anteprima senza rete anche `bonifico` è fra i campi scrivibili: prima il
finto Supabase rifiutava il salvataggio con 403 (ed è stato il finto ad
accorgersene per primo).

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

## La nuova pagina di inserimento (14/09/2026, Claude)

Nasce a **`/nuova-prenotazione`** (`app/nuova-prenotazione/page.tsx`); **`/nuova`
non è stata toccata** e resta quella in uso finché la nuova non è approvata.

**Sei punti, sei commit.** Ricerca e testa (`13067a2`), cliente nuovo
(`53235ee`), soggiorno con la striscia (`dfd3dc7`), arrivo/come paga/con
lei/nota (`11c57de`), il conto e il salvataggio (`a881e0e`), la scheda dopo il
salvataggio (`f58a6b4`).

**Niente di nuovo sotto**: camere libere e capienze da `lib/disponibilita` e
`lib/tariffe`, prezzi da `lib/prezzoNotti`, periodi, controlli e righe da
salvare da `lib/prenotazioneComposta` (`rigaDaSalvare`, `problemi`), le notti
dalla striscia di ieri (`lib/strisciaNotti` + `components/StrisciaNottiCamere`
+ `components/FoglioNotte`), il pagamento da `lib/comePaga` e
`components/ComePaga`, la ricerca clienti da `filtraClienti`, il cliente nuovo
da `creaClienteNuovo`. La logica nuova, tutta pura, sta in
`lib/nuovaPrenotazione.ts`; la veste ripetuta in `components/nuova/PezziNuova.tsx`.

**Gli ospiti notte per notte.** La striscia mostra gli ospiti sotto ogni notte
(Georgia 15, mattone `#8a4f2f` quando sono diversi da quelli del soggiorno) e
il foglietto li cambia col − e col +, con «solo questa notte» o «da qui in
poi». I numeri offerti sono **solo quelli che il gestionale sa davvero
salvare**: in una notte ci sono gli ospiti del soggiorno se c'è il letto in
più, altrimenti quelli che la camera tiene da sola (regola di sempre di
`lib/prezzoNotti`). Così non si può scegliere un numero che poi si perde
salvando — per esempio in Lena non si possono avere 3 in una notte e 4 in
un'altra, perché `num_guests` è uno solo per camera.

**Un difetto trovato provando, e corretto qui.** Con uno sconto, `/nuova`
salva `total_amount` **pieno** e lascia lo sconto ai soli `discount_type`/
`discount_value`: la scheda, che somma i totali salvati, mostrava 280 € dove
la cliente ne paga 252. La pagina nuova scrive il totale **già scontato**
(`totaliScontati`), e la lettura riga per riga non cambia (con uno sconto
valido `lib/conto` ricalcola dal prezzo a notte e il totale salvato non viene
nemmeno guardato). **`/nuova` ha ancora quel difetto**: da decidere con Ania se
correggerlo lì o aspettare che la pagina nuova prenda il suo posto.

**Nella scheda** (`app/scheda/[id]`, non vietata): la pastiglia verde
«✓ PRENOTAZIONE SALVATA» arrivando con `?salvata=1`, che sparisce dopo cinque
secondi o al primo tocco, e la parte **ADESSO** sotto la fascia con «Conferma ·
immagine e testo» e, quando si aspetta un bonifico, «Dati bonifico». ADESSO non
dipende dall'essere arrivati dalla pagina nuova: si vede finché la conferma non
è partita davvero e la cliente non è ancora andata via.

**Prove.** 1215 test verdi, TypeScript e build puliti, lint senza errori (resta
un avviso di dipendenza su un `useMemo`). Nuovi casi in
`lib/nuovaPrenotazione.test.ts` (35: la data della testa, le righe dei clienti
trovati, le camere del periodo e la riga dei liberi, gli ospiti salvabili di
una notte, il conto nei suoi casi — sconto nei due modi, letto, due camere,
camera mancante —, come si salva lo sconto, le persone «con lei» e le due
colonne, i totali scontati, e il disegno di tutte e sei le parti letto dai
sorgenti).

Anteprima senza rete a 390×844, dalla UI vera: cliente che torna (Carmela
trovata per nome, 🧾 ★ e «già stata qui 2 volte»), cliente nuovo (Rosa Verdi:
«!» col campo «perché», strutture rientrate col filetto d'ottone), soggiorno in
Lena 20→25 nov con la striscia a cinque notti, **ospiti portati a 3 dalla notte
del 22 «da qui in poi»** (letto acceso da solo, le due notti a 2 in mattone),
**cambio camera dalla striscia**, sconto del 10% (280 → 252 con la riga che
cambia sotto il campo), caparra del 50% calcolata sul netto (126 €), una persona
«con lei» (Marco Riva, SORELLA) e **salvataggio**: riga creata con sconto,
caparra sulla prima riga e `?salvata=1`, scheda aperta con la pastiglia verde e
la parte ADESSO. Provate anche due camere insieme (Lena + Ambra, conto 300 €,
notti contate una volta sola).

**Da guardare con Ania.** Il titolo «Nuova prenotazione» si legge due volte: in
Georgia 26 come chiesto e nella barra in alto dell'app, che dice già dove si è.
Nelle Richieste, a suo tempo, Ania ha fatto togliere il doppione: qui è rimasto
perché il foglio lo chiedeva esplicitamente.

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

### Ritocchi chiesti da Ania (14/09/2026)

**Il titolo non si legge due volte** (`1c6d1f8`). Via l'«Nuova prenotazione» in
Georgia 26 dal corpo di `/nuova-prenotazione`: lo dice già la barra in alto,
come nelle Richieste. La prima cosa che si legge è la data di oggi in ottone.

**L'errore sui soldi corretto anche in `/nuova`** (`49f8765`). Ania: «non può
restare in giro finché la vecchia è ancora accesa». Adesso tutte e due le
pagine scrivono `total_amount` **già scontato** con lo stesso pezzo
(`totaliScontati`). La lettura riga per riga non cambia — con uno sconto valido
`lib/conto` rifà il conto dal prezzo a notte e il totale salvato non viene
nemmeno guardato — quindi nessun doppio sconto. Provato dalla UI vera: da
`/nuova`, Ambra 20→24 dic col 10% salva 252 (prima 280) e la scheda legge
«252 € da incassare» con la riga 280 e lo sconto −28.

**🔴 Le prenotazioni scontate GIÀ salvate restano col totale pieno.** Il codice
non le tocca. C'è la proposta **`supabase/proposte/0050_totale_scontato.BOZZA.sql`**
da applicare a mano nell'editor SQL: cambia SOLO `total_amount`, lasciando
intatti `price_per_night`, `extra_bed_total` e lo sconto; salta le annullate,
quelle già a posto e i «totale concordato» più alti del pieno (che non sono
sconti); applicarla due volte non cambia niente. In cima al file c'è la SELECT
per vedere prima quante e quali sono. Provata su un database vero con PGlite
(`lib/totaleScontatoSql.test.ts`, 5 casi).

## Revisione del 15 settembre 2026: i dodici rilievi (Claude)

Corretti tutti e dodici, **in locale**: cinque commit da `9a5af81` a `81012ce`,
**nessun push e nessuna migrazione applicata**. Ogni caso è stato riprodotto
prima della correzione eseguendo le funzioni vere del repository, e le prove
nuove rifanno gli stessi casi.

**Quello che era rotto nei conti** (rilievi 3, 4, 5, 6, 9 — commit `9a5af81`).
Lo sconto della prenotazione non arrivava ai tratti nuovi (288 € diventavano
296); la tariffa concordata tornava al listino appena si separava una notte
(60 → 80); l'accordo del letto non veniva né letto né riscritto, e il costo si
ripeteva per ogni tratto («30 € in tutto» → 60, «ogni 4 notti» che ricominciava
da capo); gli ospiti per notte collassavano sul numero più alto. Adesso lo
sconto è della prenotazione (il totale concordato diventa la percentuale
equivalente quando i tratti sono più d'uno), la tariffa salvata si conserva
finché non cambiano camera o persone, l'accordo del letto si calcola sul
soggiorno intero e si riparte fra i tratti (`costoLettoIntero`,
`lettoRipartito`), e a imporre il numero di ospiti sono solo le notti col
letto. Le combinazioni non rappresentabili non si aggiustano di nascosto: le
elenca `nottiNonSalvabili`.

**Quello che prometteva senza sapere** (rilievi 7, 8, 10, 11, 12 — commit
`a885c8f`). La lettura delle occupazioni ignorava l'errore e si fermava a mille
righe: adesso `lib/occupazioniDati` legge tutte le pagine, dice sempre com'è
andata, la pagina mostra che sta guardando, e «Salva» rilegge prima di scrivere
e si ferma se non riesce. Le visite si contano per soggiorno e non per riga. La
compatibilità con le colonne mancanti non perde più niente in silenzio:
`prenotazione_id` non è rinunciabile e lì ci si ferma, il resto si perde solo
dicendolo per nome. Il controllo statico sui file toccati non segnala più
niente, senza spegnere regole.

**Quello che poteva lasciare i dati a metà** (rilievi 1 e 2 — commit `73e1ecf`
e `81012ce`). Salvare «come paga» azzerava la caparra con la prima scrittura e
la rimetteva con la seconda: un guasto in mezzo la cancellava. Spostare le
notti erano tre richieste separate: un guasto in mezzo lasciava il soggiorno
accorciato e la camera nuova mai creata. Per tutte e due la soluzione vera è
lato server e sta nelle proposte qui sotto; nel frattempo «come paga» scrive
nell'ordine che non può perdere la caparra (prima la riga che la porta, poi le
altre) e lo spostamento delle notti **non ripiega** sulle tre richieste
separate: dice che serve la proposta applicata.

### Tre proposte SQL da valutare, NON applicate

| File | Cosa fa | Perché serve |
|---|---|---|
| `supabase/proposte/0051_camera_non_due_volte.BOZZA.sql` | vincolo di esclusione: una camera non può avere due prenotazioni attive sulle stesse notti | è l'unica cosa che chiude la finestra fra il controllo e la scrittura; il browser non può farlo |
| `supabase/proposte/0052_come_paga_atomico.BOZZA.sql` | `salva_come_paga`: modo e caparra in una transazione, con verifica delle righe toccate | senza, la caparra dipende dall'ordine delle scritture invece che da una garanzia |
| `supabase/proposte/0053_notti_in_un_colpo.BOZZA.sql` | `sposta_notti`: aggiorna, crea e annulla in una transazione, ricontrollando la disponibilità | senza, lo spostamento delle notti resta bloccato (per scelta) |

La 0051 va guardata prima delle altre due, e **prima di applicarla va lanciata
la query che elenca le sovrapposizioni già presenti**: se ce ne sono, il vincolo
non si crea. Ogni file porta dentro la query di controllo, le prove di
concorrenza da fare su un progetto di prova e le istruzioni per tornare
indietro.

### Cosa è stato verificato e cosa no

Verificato: TypeScript pulito, 1331 prove verdi, build pulita, ESLint senza
segnalazioni sui file toccati. Nell'anteprima con il database finto:
inserimento di una prenotazione con letto «30 € in tutto» (il conto dice 30, non
60), salvataggio e riapertura della scheda con gli stessi numeri, e cambio di
«come paga» riuscito senza la funzione 0052, cioè per la strada di riserva.
Confermato che il finto database risponde `PGRST202` alle funzioni mancanti,
cioè il codice che il gestionale riconosce.

Non verificato: produzione, e il comportamento reale delle tre proposte SQL —
non sono state applicate da nessuna parte. Le prove di concorrenza sono scritte
nei file ma non eseguite.

Le modifiche non salvate di un'altra attività (`app/prenotazioni/[id]/page.tsx`,
`lib/condizioniPrenotazione.ts`) non sono state toccate né incluse nei commit.

## Nota per chi lavora sulla scheda nuova (16/09/2026, Claude)

I sei fogli di modifica stanno dentro `/scheda/<id>` (main fino a `fbf0fe6`,
deploy Vercel `success`): «Aggiungi pagamento», «Come paga», «Dati della
cliente», «Cambia cliente», «Annulla la prenotazione», «Arrivo». Veste comune
in `components/scheda/Foglio.tsx` (PiedeFoglio: azione in pastiglia, «Annulla»
sotto). I salvataggi sono quelli già in casa: `lib/pagamentiDati` (contratto
unico dei movimenti di `lib/statistiche/pagato`, prima dentro la scheda
vecchia), `lib/comePagaDati`, `lib/cambiaClienteDati`, `lib/arrivoOrario`. La
scheda vecchia (`app/prenotazioni/[id]`) e `lib/condizioniPrenotazione` non
sono state toccate; «Vedi tutto» porta ancora lì.

- **Proposta 0055 (`payments.note`), NON applicata:** la nota facoltativa del
  pagamento ha bisogno di quella colonna; senza, il pagamento si registra e la
  scheda avvisa che la nota non è stata salvata.
- **Chi ha annullato** sta in `cancelled_reason` («Errore mio», «La cliente ·
  motivo», «Non si è presentata · motivo»: `lib/annullamento`). Con «Errore
  mio» `lib/storicoCliente` salta la prenotazione (la riga resta sul database).
  I motivi vecchi, scritti liberi, restano com'erano.
- Prove: 1433 verdi, TypeScript e build puliti, ESLint senza diagnostiche nuove.
  Giro fatto sull'anteprima finta (porta 3213) a 390×844: tutti e sei i fogli
  aperti, chiusi con «Annulla» e salvati. **Non fatto in produzione:** il
  pannello del browser non aveva la sessione di Ania (pagina di login), e le
  credenziali non si scrivono; il giro con il pagamento finto resta da fare.
