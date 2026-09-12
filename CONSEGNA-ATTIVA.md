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
