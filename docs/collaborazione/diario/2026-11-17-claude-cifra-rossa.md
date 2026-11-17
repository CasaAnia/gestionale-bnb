# 17/11/2026 — Claude — cifra rossa del Calendario e analisi «perché si guastano le cose»

## Incarico
Parte A: trovare e correggere la cifra rossa del Calendario (quanto ha speso in tutto il cliente, questa prenotazione compresa; regola di Ania del 02/10/2026, ec3f15e e d69b8b8). Parte B: solo analisi e proposta, nulla modificato.

## Base e vincoli rispettati
- Base origin/main **d680e8b**; copia pulita `gestionale-cifra-rossa` (branch `cifra-rossa`), perché la cartella `gestionale-bnb` è ferma al 30/09/2026 con modifiche non registrate e 99 commit indietro (vedi B7).
- Suite di partenza: 2266 test, 0 falliti. Nessuna migrazione, nessuno schema toccato, nessuna scrittura su Supabase: solo richieste di lettura (GET e conteggi), sulle tabelle bookings, payments, guests, rooms e sulla descrizione dello schema.
- Nessun dato personale degli ospiti in questo file: i clienti sono sigle.

## Parte A — cosa era sbagliato
La cifra si calcolava prendendo i soggiorni **della stessa scheda cliente** (`guest_id`). Un cliente con due schede e lo stesso telefono vedeva il totale diviso. Caso vero (cliente A, anonimizzato): sei soggiorni sulla prima scheda (1.840 €), uno sulla seconda (158 €); il Calendario scriveva 1.840 € sui sei e 158 € sul settimo; il totale vero è **1.998 €**. Succedeva dal 02/10/2026, giorno in cui la cifra è nata: lo stesso codice di allora e quello di prima della correzione danno cifre identiche su tutte le 258 prenotazioni attive di oggi (ipotesi 7).

### Correzione (due commit, pubblicati su main)
- `2ed35f6` — una sola funzione, `soggiorniDelCliente` in `lib/spesoCliente.ts`, usata da cifra rossa, foglietto, riquadro del dito premuto e testata della scheda prenotazione. Stesso cliente = stessa scheda **oppure** stesso telefono a cifre (`+39 335…` = `335…`); **mai il solo nome** (due «Antonio» con telefoni diversi restano due persone). La scheda prenotazione legge anche le righe delle altre schede con lo stesso telefono (`lib/spesoClienteDati.ts`: letture a pagine, complete; se non riescono la cifra non si mostra). Un test guardia impedisce che calendario, foglietto e scheda richiamino `elencoSoggiorniPersona` da sé.
- `5395ab1` — la forma accorciata della cifra non arrotonda più i centesimi (un soggiorno da 250,44 € su una scheda stretta poteva leggersi «250 €»; 4 soggiorni veri hanno i centesimi).
- Test: 2266 → 2272, tutti verdi; i nuovi falliscono col codice vecchio. `tsc` e eslint puliti sui file toccati; `npm run build` riuscita. Deploy Vercel 7854501901 su 5395ab1: **success**.

### Le sette ipotesi
1. Righe tagliate — **scartata oggi**: bookings ha 351 righe (258 attive, 93 annullate) contro il limite di 1.000. Crescita circa 45 righe al mese: il limite si raggiunge fra circa 14 mesi. Dal 24/10/2026 (2f7ac42) il Calendario legge anche le annullate. Resta un rischio latente, vedi B4.
2. Cliente doppio — **confermata**: 3 coppie di schede doppie sulle 173 schede con prenotazioni; una vera e utile (cliente A: stesso telefono, stesso nome, 7 soggiorni), una di prova (tutte annullate), una con lo stesso nome ma telefoni diversi (non unita: domanda ad Ania). Non ho potuto verificare i «Cambia cliente» passati: la cronologia (`booking_events`) non esiste in produzione.
3. Solo soggiorni conclusi — **confermata come comportamento, non toccata**: 28 prenotazioni di 11 clienti hanno altri soggiorni dello stesso cliente in corso o futuri che la cifra non conta; e 59 prenotazioni mostrano una cifra che comprende anche soggiorni più recenti di loro. Esempio: cliente F, tre prenotazioni; la prima (conclusa) 150 €; quella in corso 990 € (150 + la sua); quella futura 710 € (150 + la sua), senza contare quella in corso. Regola da decidere, domanda ad Ania.
4. Importi diversi — **scartata**: su 233 prenotazioni uniche `total_amount` e `contoPrenotazione` coincidono sempre (0 differenze). Unico caso diverso nel codice: un mancato arrivo da 40 € di una prenotazione tutta annullata non entra nello «speso» né della cifra né della scheda (coerente fra le tre; non toccato).
5. Cifra che sparisce — **scartata**: 0 prenotazioni attive senza cifra su 258 (nessun `total_amount` vuoto).
6. Cifra accorciata — **confermata e corretta** (`5395ab1`): con i centesimi la forma corta cambiava il numero; con importi tondi nessun cambio.
7. Regressione — **scartata**: nessun commit successivo al 02/10 ha cambiato `spesoCliente`, `clienteCheTorna`, `prenotazioneUnica`; il Calendario passa ora anche le annullate (2f7ac42, e2f4804) ma il risultato sugli stessi dati è identico.

### Tabella dei clienti (centesimi arrotondati all'euro), prima e dopo
Colonne: a = cifra rossa del Calendario; b = foglietto «con questa»; c = testata della scheda prenotazione (soggiorni conclusi) più il conto di questa; d = scheda cliente (soggiorni conclusi, quella scheda sola); e = somma a mano dal database, soggiorno per soggiorno, delle schede con lo stesso telefono.

| Cliente | Caso | a prima | a dopo | b | c dopo | d | e |
|---|---|---|---|---|---|---|---|
| A (6 soggiorni) | scheda doppia | 1.840 | 1.998 | 1.998 | 1.998 | 1.840 | 1.998 |
| A2 (7° soggiorno) | scheda doppia | 158 | 1.998 | 1.998 | 1.998 | 158 | 1.998 |
| C | cambi camera, tratti annullati | 5.910 | 5.910 | 5.910 | 5.910 | 5.910 | 5.910 |
| D | due camere insieme | 890 | 890 | 890 | 890 | 890 | 890 |
| E | tre camere, soggiorni di marzo | 1.910 | 1.910 | 1.910 | 1.910 | 1.910 | 1.910 |
| F | in corso e futura | 990 / 710 | 990 / 710 | 990 / 710 | 990 / 710 | 150 | 990 / 710 |
| G | in corso e due future | 1.010–1.250 | 1.010–1.250 | uguale | uguale | 1.010 | 1.010–1.250 |
| H | soggiorni di aprile e futura 2027 | 1.470 / 1.630 | 1.470 / 1.630 | uguale | uguale | 1.470 | 1.470 / 1.630 |

Verifica a mano del cliente A: 320 + 320 + 300 + 300 + 375 + 225 = 1.840 sulla prima scheda, più 158 sulla seconda = 1.998. La colonna d della scheda cliente resta «scheda per scheda» (1.840 e 158): non toccata, domanda ad Ania.
**Limite dichiarato:** la tabella «dopo» è calcolata con le stesse funzioni e le stesse righe vere del Calendario, non letta a schermo dalla versione online: l'app chiede l'accesso e la password la mette solo Ania. La versione online è 5395ab1 (Vercel success).

### Domande aperte per Ania (non decise da me)
1. Le prenotazioni in corso e future dello stesso cliente vanno contate nella cifra? E su un soggiorno vecchio la cifra deve comprendere solo ciò che è successo prima, o anche i soggiorni più recenti?
2. La scheda cliente deve unire anche le schede con lo stesso telefono, o resta scheda per scheda?
3. Due schede con lo stesso nome ma telefoni diversi sono la stessa persona?

## Parte B — perché le cose che funzionavano si guastano
(Nessuna modifica: solo analisi. Dati e conteggi sono del 17/11/2026.)

**B1. Test non bloccanti.** Confermato: `package.json` ha `build` = `next build --webpack` e `test` separato; Vercel non lancia i test e l'unico workflow GitHub è `richieste-scadenze.yml`. Verifica fatta: tutte le 181 versioni andate in produzione dal 17/09/2026 collaudate con la suite di quel giorno. Delle 181 versioni, **14 (8%) sono uscite con almeno un test rosso**, tutte fra il 17/09 e il 02/10/2026; dal 02/10 in poi le restanti sono tutte verdi. Esempi: sei pubblicazioni consecutive del 26–27/09 (da fb3f653 a 0478433) con lo stesso test sulla Home rotto («gli arrivi stanno IN CIMA»); tre del 17/09 con il test sul rifiuto del database per camera doppia; l'ultima, 62f0f5f del 02/10, con due test rossi. Limite: le prove sono state rifatte oggi, 17/11, su una macchina diversa da quella delle pubblicazioni; un test che dipende dalla data potrebbe essere rosso solo oggi, ma gli stessi test rossi per più pubblicazioni di fila e poi spariti fanno pensare a rotture vere.

**B2. Test che non coprono.** 235 file di test su 236 non montano mai un componente; 84 file leggono i sorgenti come testo (espressioni regolari sul codice): proteggono la forma del codice, non il comportamento a schermo, e si rompono per un cambio innocuo (è successo anche a me: spostare una riga nella scheda ha fatto cadere una guardia sul testo). La cifra rossa aveva test, ma sulle funzioni e sulla grafica; nessuno diceva «un cliente con due schede ha un solo totale»: il dato vero non è mai entrato in un test. Le maiuscole hanno un test per ogni modulo dal 18/09 (regola fissa n. 1), ma la regola «cifra rossa» non è in `REGOLE-FISSE.md`. Tutti i 17 file di test citati dalle regole fisse esistono.

**B3. Stessa regola in più posti.** Solo per gli importi, almeno 15 punti sommano `total_amount` da sé (`clienteCheTorna` ×2, `storicoCliente`, `statistiche/cliente`, `statistiche/cassa`, `statistiche/ricostruzione`, `daControllare`, `lineeSoggiorno`, `scontoScheda`, `calendarioNastro`, `calendarioBarre`, `barreSoggiorno`, `schedaConto`, `conto`, la pagina `prenotazioni/[id]`). Per il «totale speso del cliente» ci sono tre funzioni: `soggiorniConclusi`, `elencoSoggiorniPersona` e `statistiche/cliente`; sulle 173 schede cliente reali **19 hanno totali diversi fra le tre** (le future, per esempio: 1.550 € contro 150 €). I soggiorni «già stato» si contano in almeno sei punti. Anche «stessa persona» ha due regole: le Richieste (`stessaPersona`) riconoscono il cliente per telefono **o** per nome, la cifra rossa dopo questa correzione solo per telefono o stessa scheda (scelta prudente, vedi domanda 3). Dopo questa correzione cifra rossa, foglietto, riquadro e testata della scheda hanno una sola fonte; il resto no.

**B4. Letture tagliate.** Supabase risponde al massimo 1.000 righe senza dare errore. Letture dell'intera tabella senza pagine: Calendario (bookings, payments), Richieste (bookings, payments, guests), proposta della richiesta (bookings, guests), push delle pulizie (bookings), Spese (`family_expenses` intera e `family_expense_items` per id). Righe oggi: bookings 351, payments 238, guests 198, `family_expense_items` **731** (cresciuta di 731 righe in due mesi, ferma dal 30/09: quando riprendono gli scontrini il limite si raggiunge in poche settimane), `site_events` 2.449 (già letta a pagine, giusto), cleanings 76, richieste 25. Esiste già l'aiuto giusto, `raccogliPagine` (usato in 14 file), ma non è usato nelle letture più pesanti. Nessuna di queste letture oggi è tagliata.

**B5. Lavoro sovrapposto.** Dal 17/09: 332 commit su main in due mesi, tutti con lo stesso autore git, firmati da quattro versioni di Claude (Opus 5.5 183, Fable 5.1 69, Opus 5 30, Sonnet 5.5 2) più il lavoro di Codex nelle sue copie. Ci sono 17 copie di lavoro e 25 rami: la cartella `gestionale-bnb`, che le istruzioni globali indicano come punto di lettura, è ferma al 30/09/2026, 99 commit indietro, con 10 file modificati e un commit mai spinto: chi parte da lì lavora su una versione vecchia. Esempi concreti di correzioni perse o riscritte:
- Maiuscole su nome e cognome: fatte il 06/09 (f9dbe73), sparite il 07/09 (4ad7d08, la regola scattava solo al salvataggio e dipendeva dalla tastiera), rifatte il 18/09 con un solo componente (e801e51) e test (5b5a3cc). Da allora nessun ritorno.
- Documenti degli ospiti: il rifacimento «Maison» del 29/09 (7474fdc) ha ridotto il comando a solo testo; ripristinato il 21/10 (c7e2275), 22 giorni dopo.
- Pulizie: il rifacimento del 01/10 ha perso comportamenti di prima (recuperi, timer, «perché questa data»), ripristinati nello stesso giorno (414d3ce, c978c61) dopo un rilievo di Codex.
- Ripristini singoli: globo e nome ospite nell'avviso richieste della Home (fb3f653, 26/09), letto automatico alla riapertura della notte (d945bf6, 22/10).
- Copia-incolla: gli stili CSS dei riferimenti grafici persero i segni di chiusura dei commenti e restavano disattivati (4cb9674, 8a2c166, e29b92d, 28–29/09).
- Rami non uniti: `in-forse` (7 commit del 13/11), `fatture-fase5` (7 commit del 02/09), con 12 file toccati da tre rami diversi.

**B6. Differenze col database vero.** Confronto fra la descrizione dello schema vero (in sola lettura) e i file SQL del repo: 39 tabelle vere. In produzione ma in nessun file SQL: la tabella `push_subscriptions`, la tabella `site_events` (del sito), le colonne `bookings.pushover_notified_at`, `rooms.matrimoniale_price`, `rooms.double_price`. Nel repo ma non in produzione: `bookings.provenienza` e `struttura_nome` (0036, sostituita dalla 0037), la tabella `booking_events` (0042, cronologia: il codice la tollera mancante), la 0065 (non applicata, già nota). Almeno otto migrazioni vive in produzione (dalle funzioni presenti e dalle note del registro: 0033, 0045, 0052, 0053, 0059, 0060, 0061, 0062) esistono nel repo solo come `.BOZZA.sql`: la cartella `migrations` ha 38 file con buchi di numerazione (0023, 0026, 0030, 0033–0038, 0042–0045, 0050–0056, 0059–0065), quindi il repo non basta a dire cosa c'è nel database; l'applicazione è a mano e il codice «regge senza la colonna», cosa che nasconde lo scarto invece di segnalarlo.

**B7. Altre cause.**
- Il «rilevamento» passa per Ania: nessun ambiente di prova con dati veri e nessun controllo automatico dopo il deploy; la prova online richiede una password che ha solo lei.
- Il lint ha 47 errori già presenti (dichiarati il 12/11) e non blocca nulla.
- Test come testo del sorgente (B2): ogni rifacimento grafico grande (Maison, 28–29/09) riscrive pagine intere e lascia cadere comportamenti non coperti.
- Nel mio stesso giro: una guardia sul testo si è rotta per una riga spostata, segno di quanto sono fragili.

## Rimedi proposti (da decidere, nessuno applicato)
1. **Nessun deploy con la suite rossa.** Far lanciare `npm test` prima della build di Vercel (una riga in `package.json`, oppure un controllo GitHub che blocca la pubblicazione). Per Ania: non può più uscire online una versione con un test rotto. Costo: circa un'ora di lavoro più il rischio di qualche test che oggi richiede un server locale (`backupPostgrest`); nessuna spesa. È il rimedio più utile perché chiude il buco di B1 senza che Ania faccia nulla.
2. **Una regola decisa = un caso vero in un test.** Ogni decisione di Ania entra in `REGOLE-FISSE.md` con un test costruito su un caso reale anonimizzato (come i 1.998 € del cliente A) e, per le quattro più toccate (cifra rossa, conto, nome e cognome, pulizie), un test che monta davvero il componente invece di leggere il sorgente come testo. In più un'unica funzione per il «totale speso» e una per il «conto», al posto delle tre e dei quindici punti di B3. Per Ania: le correzioni restano. Costo: da uno a due giorni di lavoro, da fare per gradi, partendo dalle regole che si sono già rotte.
3. **Ordine nei dati e nelle copie.** Una funzione unica «leggi tutto» (a pagine, o errore) per Calendario, Richieste, Spese e push; la cartella `gestionale-bnb` riportata a origin/main con i lavori in sospeso del 30/09 salvati su un ramo, e i rami già uniti archiviati; i file SQL di tutte le migrazioni vive messi in `migrations`, con un controllo in sola lettura dello schema contro il repo. Per Ania: serve il suo sì per la cartella (ci sono modifiche non registrate) e per ogni migrazione; il resto non cambia ciò che vede. Costo: circa un giorno e mezzo, diviso in tre pezzi indipendenti.

## Registro
Scheda attiva e `STATO.md` aggiornati. Nessun dato di Ania o degli ospiti in chiaro in questo file.
