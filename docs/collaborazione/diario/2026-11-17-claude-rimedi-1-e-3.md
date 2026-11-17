# 17/11/2026 — Claude — risposte di Ania, rimedio 1 (niente test rossi online) e rimedio 3 (ordine)

## Richiesta
Ania ha risposto alle tre domande della cifra rossa e ha deciso: rimedio 1 (nessuna pubblicazione con test rossi) e rimedio 3 (ordine nelle letture, nelle migrazioni e nelle copie di lavoro). Il rimedio 2 non si fa. Cinque pezzi, un commit per pezzo, base origin/main 8651bd8 in una copia pulita (`gestionale-cifra-rossa`). Partenza: 2272 test verdi, build riuscita.

## Pezzo 1 — le tre risposte
1. Prenotazioni in corso e future: **non** si contano nella cifra. Il calcolo non cambia; regola scritta in testa a `lib/spesoCliente.ts` e in REGOLE-FISSE n. 12, con test (concluso + in corso + futuro: sul futuro concluso + futuro, sull'in corso concluso + in corso).
2. La scheda cliente unisce le schede con lo stesso telefono con la **stessa funzione** (`soggiorniConclusiDelCliente`): il caso A dà 1.998 € da entrambe le schede, non 1.840 e 158. Letto in sola lettura; se la lettura non arriva intera, errore con Riprova. «Totale speso» della scheda cliente ora conta i conclusi, come la riga in testa. Commit `7de9bb8`.
3. Stesso nome e telefoni diversi: nessun cambio. Trovate due coppie (ultime tre cifre: una …706/…866 con 1 prenotazione per scheda, una …076/…356 senza prenotazioni); i nomi stanno solo nel resoconto a Ania.

## Pezzo 2 — niente pubblicazioni con test rossi
- Vercel usa il comando predefinito `npm run build` (nessun buildCommand nelle impostazioni né in `vercel.json`). Prima `next build --webpack`, ora `npm test && next build --webpack`.
- Test indipendenti da giorno, ora e fuso (`a692916`): con un orologio finto (`scripts/prove/orologio-finto.mjs`, `npm run test:orologi`) la suite gira a 9 istanti (cambi dell'ora legale, capodanno, fine mese, bisestile, un anno dopo) in TZ Europe/Rome e UTC: 18 prove, tutte verdi. Erano rossi in UTC (fuso di Vercel) `schedaConto.test.ts` («la storia parte dalla creazione») e `richiesteRiquadro.test.ts` («arrivate = chiuse nel periodo»), e fuori Roma `siteStats.test.ts` (due test): dati di prova senza fuso o con `+02:00` dove il codice usa l'ora del posto; nessun codice di produzione toccato.
- Blocco (`14bf280`) e guardia `lib/bloccoTest.test.ts`; workflow `.github/workflows/test.yml` (`858241d`, `richieste-scadenze.yml` intatto); regola 13 in REGOLE-FISSE e CLAUDE.md (`01f8127`).
- **Prova su Vercel:** ramo con le stesse modifiche e test verdi → Preview Ready (3 min, test passati in Node 24/UTC); ramo con un test rosso apposta → Preview **Error** (`npm test` fallito, «Command npm run build exited with 1»), link del deploy fallito https://gestionale-lyc7xzdyv-casa-ania.vercel.app; la produzione è rimasta quella di prima (8651bd8) e anche GitHub ha dato «failure» sul ramo rosso. I due rami di prova sono stati eliminati.

## Pezzo 3 — letture sempre complete
`lib/leggiTutto.ts` (`4f16a12`): pagine da 1.000 con ordine stabile per id, errore alla prima pagina che fallisce (mai righe parziali), tetto di pagine segnalato; `leggiTuttoPer` a blocchi da 100 id. Test con client finto: 0, 999, 1.000, 1.001, 2.500 righe, errore alla seconda pagina. Punti cambiati (prima → dopo, righe vere, anche a pagine da 100: stesse righe):

| Punto | Riga | Righe prima = dopo |
|---|---|---|
| Calendario, prenotazioni e pagamenti | `app/calendario/page.tsx:282-283` | 351 · 238 |
| Arrivi (con avviso e Riprova) | `app/arrivi/page.tsx:240` | 258 |
| Clienti, schede e soggiorni (con avviso e Riprova) | `app/clienti/page.tsx:44-46` | 198 · 258 |
| Prenotazioni, elenco | `app/prenotazioni/page.tsx:49` | 351 |
| Richieste: prenotazioni, pagamenti, clienti | `app/richieste/page.tsx:250-255` | 351 · 238 · 198 |
| Proposta: prenotazioni, clienti | `app/richieste/[id]/proposta/page.tsx:186 e 190` | 351 · 198 |
| Elenco richieste | `lib/richiesteDati.ts:17` | 25 |
| Push pulizie: prenotazioni, pulizie | `lib/puliziePush.ts:33-34` | 258 · 76 |
| Push ringraziamento | `app/api/push/ringraziamento/route.ts:63` | 258 |
| Spese: spese e dettaglio prodotti (a blocchi, con avviso) | `lib/spese/dati.ts:24 e 41` | 225 · 731 |

Guardia in `lib/leggiTutto.test.ts`. Commit `ceea213`, `7043743`, `493dc70`, `bf67c3e`, `01f4b52`. Restano come sono le tabelle piccole (camere 8, categorie 116, sottocategorie 93, regole 5, notifiche 3).

## Pezzo 4 — migrazioni allineate (nessuna applicata)
- Strumento `scripts/schema/confronta-schema.mjs`: database vuoto su PostgreSQL 16 locale (porta 5433, mai produzione) + stub Supabase + tutte le migrazioni, confrontato con la descrizione delle tabelle di produzione (PostgREST) e, con `--catalogo`, con l'estrazione di `supabase/strumenti/leggi-catalogo.sql` (una SELECT sola). Provato: catalogo uguale = 0 differenze, catalogo manomesso = 3 trovate.
- Prima: 48 tabelle/colonne e 7 funzioni di produzione senza file SQL. Venti bozze verificate colonna per colonna (e per funzioni) diventano migrazioni regolari con la riga di stato: 0023, 0033, 0034, 0035, 0037, 0038, 0043, 0044, 0045, 0051, 0052, 0053, 0054, 0055, 0056, 0059, 0060, 0061, 0062, 0064 (`git mv`, riferimenti in test, script e documenti aggiornati). 0043: `pagato` e `bonifico` sono nullabili in produzione (la bozza diceva NOT NULL), allineata.
- Nuova **0066** (tutto `if not exists`): `push_subscriptions`, `site_events`, `bookings.pushover_notified_at`, `rooms.matrimoniale_price` e `double_price`, `richieste.provenienza` e `struttura_nome`, `strutture`.
- Collaudo: database vuoto + 59 migrazioni, 0 errori; **0 differenze** su tabelle, colonne, tipi, NOT NULL e funzioni chiamabili. Script di revisione che usavano le bozze: 15 su 15 verdi dopo aver aggiornato un controllo ormai superato sulla 0023. Commit `25f8e4e`, `ca8ac2b`, `d2da3bb`; regola 14 in REGOLE-FISSE; guardia `lib/migrazioniAllineate.test.ts`.
- **Nel repo e non in produzione (NON applicate, restano proposte):** 0026 (accesso RLS a richieste e prenotazioni), 0036 solo per la parte su `bookings` (la parte su `richieste` e `strutture` c'è e sta nella 0066; il codice tollera la colonna mancante), 0041 motivo rifiuto, 0042 cronologia (`booking_events` e funzioni: il codice la usa ed è tollerante se manca), 0049 bozza duplicata (vale la migrazione 0049_conto_prenotazione), 0050 (correzione di dati sul totale scontato: stato non verificabile), 0065 (conferma richiesta per telefono). La 0063 (destinatario dei messaggi) esiste solo nella vecchia cartella e nell'archivio.
- **Limiti dichiarati:** la descrizione delle tabelle di PostgREST non dice vincoli CHECK, indici, policy RLS, trigger né il corpo delle funzioni: su questi la 0066 e le migrazioni promosse **non sono verificate** contro produzione. Per leggerli serve l'estrazione del catalogo (`leggi-catalogo.sql`), da incollare nell'editor SQL di Supabase; non avevo una connessione al database e un tentativo di cercare un accesso diverso è stato negato dal sistema (non ripetuto). Da fare appena disponibile: `node scripts/schema/confronta-schema.mjs openapi.json --catalogo catalogo-produzione.json`.

## Pezzo 5 — una sola copia di lavoro
- Elenco completo in `archivio/LEGGIMI.md` del ramo `archivio-2026-11-17` (18 copie oltre a questa, 31 rami locali, 3 remoti, 1 stash). Il ramo esiste **solo sul Mac** e non va pubblicato (repo pubblico; contiene documenti non controllati con numeri che sembrano telefoni).
- Dentro: i commit dei 6 rami non uniti (in-forse 7, fatture-fase5 7, fase5-fatture-casa-ania 1, revisione-fase5-1219138 2, scheda-vestito 1, main locale 1: merge «ours», raggiungibili anche togliendo i rami); un commit per ognuna delle 4 copie con modifiche non registrate (gestionale-bnb 10 file + 146 nuovi, verifica-finale 38 + 20, in-forse 3 + 15, foglio-sconto 74 nuovi); il patch dello stash. Verificato byte per byte contro le copie originali prima di toccare qualunque cosa.
- `gestionale-bnb` riallineata a origin/main: stato pulito, hash uguale (b411dba); i file ignorati (.env.local, node_modules, backup) restano. Il commit locale 84759a3 non è perso (nell'archivio). **Nessuna copia o ramo è stato cancellato.**
- Avvisi: (a) il ramo `in-forse`, di un'altra sessione ancora aperta, ha una sua `0066_stato_in_forse.sql`: stesso numero della 0066 di allineamento ora in main, da rinumerare 0067 prima di unirlo (e REGOLE-FISSE.md in conflitto con le regole 12–14); nessuna sessione aperta a cui scrivere (l'unica altra è offline), quindi l'avviso sta solo in questo registro. (b) Dopo il riallineamento le istruzioni globali che citano `docs/collaborazione/audit/` non trovano più quei file: sono nell'archivio; in main è stato portato solo `LEGGIMI.md` (solo istruzioni).
- Regola d'inizio lavoro in cima a CLAUDE.md e AGENTS.md (`b411dba`), con guardia `lib/regolaInizioLavoro.test.ts`.

## Verifiche finali
Test 2272 → 2297, tutti verdi; `npm run build` (con i test dentro) riuscita; deploy di produzione riusciti per 01f8127, 01f4b52 e d2da3bb; test su GitHub verdi su ogni push. Non ho aperto il sito online (nessuna richiesta HTTP: il controllo del sito scatta il Security Checkpoint): lo stato «Ready» viene da Vercel.
