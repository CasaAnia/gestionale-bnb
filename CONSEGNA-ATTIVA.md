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
