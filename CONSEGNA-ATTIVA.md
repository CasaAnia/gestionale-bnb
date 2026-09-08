# Home pulizie: azioni dirette e scomparsa dopo la conferma (08/09/2026)

**VERIFICATO IN LOCALE — ANTEPRIMA DA RIVEDERE CON ANIA, NON PUBBLICATO.**
Base `e0ff1154d13ad2fb84fb839e2ed0cc3ead4f809f`, copia isolata `work/gestionale-pulizie-home`.
Ania vuole vedere insieme l'anteprima prima di pubblicare. La Home mostra solo
il lavoro da fare: **Pulita** conferma senza recuperi; **Pulita e recuperato**
apre subito la selezione e salva entrambi insieme. Dopo il salvataggio la camera
scompare anche ricaricando; rettifiche nella sezione Pulizie. Tolto il link
«Tutte le pulizie e il resoconto». Comandi editoriali in testo, sottolineatura
sottile, stessi colori; Rimanda/Salta secondari. Nessuna modifica SQL o ai dati reali.

Regressione sul render React vero con custodia/SQL PGlite: due riaperture,
conferma con e senza recupero, permanenza nel registro, lista vuota, stime
storiche escluse e successivo ciclo a quattro notti. UI vera 390/1280: chiusura
senza salvare, nove asciugamani per tre ospiti, salvataggio, ricarica, sparizione
di Amelia e Ambra, recuperi nuovamente aperti dal registro. Suite completa,
TypeScript, lint e build riusciti. Dettagli e confine della prova in
`docs/pulizie-2026-09-08.md`. La consegna pubblicata precedente resta qui sotto.

# Pulizie manuali e recuperi per ospite (08/09/2026)

**PUBBLICATO E VERIFICATO ONLINE l’8 settembre 2026.** Vercel ha completato il deploy del commit `61d65e2` (codice pulizie `fb49707`); Home e resoconto verificati dalla sessione reale. **0045 APPLICATA E VERIFICATA**. Candidato `d9632e4`, integrato su main come `fb49707` con albero identico; base `38cb368`. L’utente ha confermato esplicitamente modifica di main, database, push GitHub e Vercel con «si» l’8 settembre: supera il precedente blocco automatico. Requisiti, prove e limiti in `docs/pulizie-2026-09-08.md`. Home editoriale: Pulita = zero recuperi, Recuperato facoltativo/modificabile, asciugamani per ospite del soggiorno pulito, ciclo dalla data effettiva + 4 notti e resoconto verificabile. Suite, TypeScript, lint e build riusciti. UI vera 390/1280: annulla, tre set, due rettifiche/riaperture, Pulita diretta, due rinvii, data effettiva + 4, salto, recupero tardivo e lettura guasta verificati. Concorrenza PostgreSQL reale non verificata (shmget impedito). CSV scaricato sia dalla preview sia dalla produzione e riconciliato con i totali a schermo.

Backup delle 22:40: 34 tabelle, 3.212 righe, confronto contenuti OK e seconda copia locale identica. 0045 dal SQL Editor del progetto `tnsaaoxlcldeltowhvwv`: corpo funzione identico al file vero, colonna/RPC esposte, SECURITY INVOKER e RLS verificate; dodici pulizie e zero recuperi identici al backup, zero operazioni nuove. Nessuna prova di scrittura in produzione. Home online: la partenza odierna resta da confermare, con Pulita/Recuperato e gli ospiti del soggiorno pulito; finestra aperta e chiusa senza salvare. Resoconto reale del mese: sei confermate, zero pezzi, due stime separate e un salto; CSV identico. Nessuna pulizia di prova registrata. Controllo Vercel riuscito: https://vercel.com/casa-ania/gestionale-bnb/FBoC2RSiPgphMNfz8GkeAfigFjjW. Questo aggiornamento successivo riguarda soltanto la documentazione.

# Notti disponibili: tutte insieme oppure selezione libera (08/09/2026)

**PUBBLICATO E VERIFICATO ONLINE l'08/09/2026.** Codice gestionale `c9fc523` (Vercel Production riuscito alle 16:29 UTC), sito `cb8e812` (16:30 UTC). GET autenticata del gestionale → 200 e `nottiRichieste: true`; senza autenticazione → 401. Su `www.casaaniarozzano.it/prenota` sono serviti i nuovi file e il titolo approvato. API pubblica, soltanto `checkOnly: true`: periodo parzialmente disponibile → due periodi, 15 notti; scelta di tutte le 15 e scelta separata 18/09, 20/09, 04/10 → stessi elenchi esatti nelle soluzioni; zero notti → 400. Nessun invio WhatsApp, richiesta o prenotazione di prova in produzione. Le prove UI complete a 390/1280 restano quelle locali documentate sotto.

PUBBLICAZIONE AUTORIZZATA l'08/09/2026 con «pubblica tutto pls», dopo l'approvazione dell'anteprima. Sito: tasto «Seleziona tutte le notti disponibili», caselle per scegliere anche notti separate, riepilogo di notti e periodi con arrivo/partenza. Zero notti → proseguimento disabilitato; disponibilità riletta prima dell'invio; camera cambiata nel frattempo → nuova conferma. Si crea UNA richiesta con le notti esatte. Il risultato della pubblicazione va verificato nei controlli Vercel dei commit e nel resoconto del task.

Gestionale: `notti_richieste` facoltativo mantiene le notti scelte; assente/null = comportamento precedente. Conteggi, date in lista e scheda, calendario e conflitti, proposta automatica, composizione manuale, prezzi e messaggio rispettano la selezione. La modifica conserva le notti e invalida una proposta precedente quando cambiano. `persone_per_notte` mantiene gli indici dell'intero intervallo, compatibili con la RPC esistente.

La proposta SQL `supabase/proposte/0044_notti_richieste.BOZZA.sql` aggiunge la colonna e un trigger: date ordinate, uniche, valide e nei limiti; nessuna proposta/alternativa può includere una notte non richiesta o due volte la stessa notte. Collaudata in PGlite dal file vero insieme alla RPC 0031: ingresso web, salvataggio, rilettura, proposta e conferma ripetuta → una richiesta, due prenotazioni (23–24 e 25–27), tre notti, 210 €. Nessuna ricostruzione né modifica dei dati passati.

Compatibilità fra versioni: il sito verifica con GET autenticata che il gestionale supporti la selezione e disponga della colonna, prima di mandare la POST. Una versione precedente non riceve un intervallo che perderebbe i buchi; il ripiego mantiene l'elenco esatto delle notti. Ordine di attivazione: backup aggiornato → revisione/applicazione 0044 → pubblicazione gestionale → verifica capacità in sola lettura → pubblicazione sito.

Passaggio autorizzato dell'08/09: backup `backup/gestionale-backup-2026-09-08-1819.json`, 34 tabelle e 3.199 righe, integrità/completezza/contenuti identici alla produzione; file locale ignorato da git, permessi 600. **0044 APPLICATA** dal SQL Editor del progetto `tnsaaoxlcldeltowhvwv`: trigger `richieste_controlla_notti` abilitato (`O`), colonna disponibile anche in PostgREST; le sei richieste precedenti, esclusa la nuova colonna null, sono identiche al backup. Nessuna riga di prova inserita. Il tentativo aggiuntivo su PostgreSQL 16 locale è stato impedito dall'ambiente (memoria condivisa non consentita durante initdb): non è un collaudo PostgreSQL riuscito. Restano valide le prove complete PGlite; la struttura è verificata anche su Supabase PostgreSQL 17.6.

Prove: suite gestionale 829/829, sito 17/17; TypeScript, lint del delta e build dei due progetti riusciti. `verifica-consegna --base HEAD` comprende anche regressioni e strumenti locali. API vera del sito con backend finto: tutte, singola, periodo, vuoto, duplicate, fuori intervallo, occupate, disponibilità/camera cambiate e lettura guasta. UI vera del sito: 390/1280, azzera/seleziona, sottoperiodo, torna indietro e tutte le notti fino al riepilogo/WhatsApp; servizio finto conserva un'unica riga 23,25,26. UI gestionale finta: intestazione 3 notti, proposta 23–24 + 25–27 a 210 €, messaggio con buchi espliciti. I controlli successivi in produzione e il limite del collaudo PostgreSQL locale sono distinti nei paragrafi sopra.

Anteprima e rapporto: `/Users/amerigogranata/Documents/Codex/2026-09-07/ch/anteprima-disponibilita/VERIFICA.md`. I blocchi precedenti qui sotto sono cronologici; gli esiti di suite/build più recenti sono quelli sopra.

# Richieste: disponibilità parziale, messaggio completo e contatti rapidi (08/09/2026)

Richiesta di Ania: nella scheda della richiesta il testo della nota resta nel colore normale per «Nota del cliente:», mentre il contenuto è rosso più intenso (`#C00000`); nelle azioni di ogni richiesta con numero compaiono anche cornetta (chiamata diretta) e WhatsApp vuoto (Ania scrive liberamente). I due contatti sono nel componente condiviso dalla lista e dal pannello del calendario; senza numero non compaiono.

Il pulsante «Nessuna disponibilità» consente di scegliere manualmente il messaggio completo anche quando il calcolo trova camere libere; «Torna alle disponibilità» ripristina la ricerca. Se non esiste una soluzione per tutto il periodo, la ricerca propone ora comunque la copertura migliore, anche sotto la metà delle notti: il testo indica le notti da sistemare altrove. Test aggiunti per una notte residua e per 4 notti richieste con 3 disponibili. I bollini rosso e blu della barra mobile mantengono posizioni verticali fisse: il blu resta sotto anche quando il rosso è assente.

Verifiche locali: 29 test mirati (richieste, contatore, WhatsApp, ordine dei nomi) OK, TypeScript senza emissione OK, lint dei sei file toccati OK, `git diff --check` OK. La suite completa avviata sul repository ha prodotto 817 passaggi positivi ma si è fermata sul test di backup già noto per timeout del processo PGlite; nessun errore è riconducibile a questi file. Build e prova visiva non ancora ripetute per questo blocco. Nessun dato reale, SQL o produzione modificati.

# Nota del cliente: rosso solo sul contenuto (08/09/2026)

Richiesta dell'utente dopo la prova riuscita delle proposte: lasciare in rosso solo la nota, non tutta la riga. Base `9df4bc7`, modifica limitata a `components/richieste/NotaCliente.tsx`: etichetta «Nota del cliente:» nel colore `stone`, solo il contenuto tra virgolette mantiene `#C0392B`. Componente condiviso da lista Richieste, proposta e Da controllare in Home; testo, dati, dimensioni e logica invariati.

Verifiche: render React del componente con nota sintetica e senza nota, controllo degli stili; suite completa, regressioni, strumenti locali, TypeScript e lint OK (`verifica-consegna --base 9df4bc7`); build della copia con ambiente sintetico OK, rigenerata dopo problemi della cache dell'anteprima. Prova visiva nel browser locale non completata: anteprima prima 404, poi errori di connessione; non dichiarata verificata a 390/1280. Nessun dato o messaggio reale. Pubblicazione del ritocco richiesta dall'utente; esito Vercel nel controllo del commit e nel resoconto finale.

Pubblicazione **AUTORIZZATA** dall'utente l'08/09/2026 con «certo», in risposta alla richiesta esplicita di mettere online il ritocco. Esito del push e del deploy nel controllo del commit e nel resoconto finale.

# Richieste: conservare la proposta scelta al ritorno da WhatsApp (08/09/2026)

**VERIFICATO IN LOCALE; pubblicazione autorizzata l'08/09/2026 con «vai avanti».** Base `8b029fc5650410ada42c9f129d5e6e139ff0feff`; blocco = cinque file applicativi indicati sotto, più questa scheda. Claude aveva iniziato il blocco; l'utente ha autorizzato Codex a subentrare perché Claude ha esaurito i crediti. Alla ripresa dopo il blocco del Mac: file identici alla copia collaudata, remoto riletto e ancora sulla stessa base, nessun lavoro concorrente. Prove senza SQL, modifiche ai dati di produzione o messaggi reali.

- Causa: prima del ritorno da WhatsApp restavano nel browser solo testo e condizioni. Al ricaricamento, «Sì, inviata» poteva archiviare Amelia e tutte le alternative pur mostrando un messaggio per la sola Ambra.
- Correzione: `lib/richiestePendente.ts` conserva testo, condizioni, soluzione completa e alternative. La pagina propone e registra la stessa copia, con controlli di modifica sospesi fino alla risposta. «No» restituisce la composizione e i prezzi all'editor; la custodia si elimina solo con risposta conservata o salvataggio riuscito.
- `lib/richiesteScelta.ts`: scelta per identità di camere/date, non per posizione nella lista; se scompare si richiede una nuova scelta. Una vecchia custodia incompleta resta leggibile ma non si conferma usando camere ricalcolate.
- `lib/richiesteDati.ts`: una proposta singola cancella espressamente le alternative precedenti; il retry usa la stessa ora della prima conferma. Un reinvio mantiene le condizioni già archiviate. Compatibilità precedente alla 0031: colonna omessa solo se assente.
- Doppi tocchi: custodia non sovrascrivibile e blocco sincrono del salvataggio. Memoria guasta: WhatsApp non viene aperto. Errore di risposta: offerta conservata; una rilettura riconosce il salvataggio già riuscito senza prolungare l'opzione.

## Accettazione e prove

| Percorso | Esito e prova |
| --- | --- |
| Tutte libere → Cambia → Ambra → All'arrivo → apertura WhatsApp simulata → ricarica → Sì | UI vera a 390 px: testo e riepilogo solo Ambra, 160 €, alternative nulle anche nella riga del servizio finto. |
| Seconda riapertura → finestra Crea prenotazione | UI a 390 px: nessuna attesa residua, la finestra propone solo Ambra e 160 €. Nessuna prenotazione reale creata. |
| Scelgo io → Amelia 75 € + Ambra 99 € → caparra 72,50 € → ricarica → No → reinvia → Sì | UI a 1280 px: composizione e prezzi recuperati nell'editor; riga del servizio finto identica, totale 174 €, caparra 7250 centesimi. |
| Proposta già inviata → Invio di nuovo → Sì | UI a 1280 px: condizioni e prezzi manuali restano identici. |
| 503 prima del salvataggio → ricarica → riprova Sì → seconda riapertura | UI a 390 px: errore visibile, recupero della sola Ambra, nessuna attesa residua. |
| 503 dopo il salvataggio → due riaperture | UI a 390 px: esito incerto visibile, poi riconciliazione automatica e seconda riapertura pulita. |
| Vecchia bozza senza soluzione; memoria piena; No e riapertura | UI a 390 px: Sì disabilitato con avviso; WhatsApp non aperto quando la custodia fallisce; scarto conservato. |
| Nessuna scelta → offerta multipla; vecchie alternative → nuova offerta singola | UI a 390 px: quattro alternative conservate nel primo caso; nel secondo, nuova proposta e finestra di conferma solo Ambra. |
| Lista riordinata, camera scelta scomparsa, doppia scrittura, deposito che ignora scrittura/cancellazione | Test locali in `lib/richiestePendente.test.ts`: scelta stabile oppure invio bloccato, errori espliciti, nessuna sostituzione della custodia. |

Tecnica: 9 nuovi test della custodia + 6 di scelta superati; suite completa, regressioni delle revisioni, strumenti locali, TypeScript senza emissione e lint di tutti i file modificati **OK**, con `scripts/verifica-consegna.mjs --base 8b029fc` su albero fermo (impronta `a2b31ab1e085694f2a3a383dd859ebff2feadb0e637333b917e4142ddc5f3eb8`). Dopo questo controllo sono cambiati solo un commento esplicativo e questa scheda. `git diff --check` OK. Build **OK**, eseguita una volta sulla copia del candidato con ambiente sintetico e funzione WhatsApp originale ripristinata.

Confine della prova: preview locale derivata da `scripts/revisioni/anteprima-richieste-finta.mjs`, dati esclusivamente sintetici. Nell'anteprima soltanto l'apertura esterna di WhatsApp è sostituita con una registrazione nel DOM; azioni, custodia e salvataggi della pagina sono reali contro il servizio finto. Non è una prova della PWA su iPhone né di Supabase/Vercel in produzione. Testi definitivi, ricerca delle disponibilità e RPC invariati. Server finto fermato.

File del candidato: `app/richieste/[id]/proposta/page.tsx`, `lib/richiesteDati.ts`, `lib/richiesteScelta.ts`, `lib/richiestePendente.ts`, `lib/richiestePendente.test.ts`. Nessun intervento nel backup o nei dati dei clienti.

Passaggio autorizzato: commit di questo blocco, push su main e controllo del deploy Vercel associato al commit. Questa scheda documenta le prove precedenti alla pubblicazione; l'esito del deploy è nel controllo Vercel su GitHub e nel resoconto finale del task. Nessuna migrazione necessaria.

# STATO IN 10 RIGHE (aggiornato il 07/09/2026, notte) — da incollare a un altro assistente

1. Gestionale Casa Ania (Next.js su Vercel, Supabase tnsaa…vwv, usato SOLO da Ania; dal 06/09/2026 STILE EDITORIALE «B» scelto da Ania — classi ed-* in globals.css, Georgia per titoli/numeri/nomi, niente riquadri bianchi salvo griglie e finestre, Spese comprese dalla sera): su `main` la sezione Richieste ha i pezzi 1–7 e 9–11 con i TESTI DEFINITIVI del 04/09 (lib/richiesteTesti + lib/descrizioniCamere: non toccarli senza Ania); il modulo Spese nuovo è in produzione con la scrittura su `legacy`.
2. Migrazioni applicate a mano: 0001–0022, 0024, 0025, 0027, 0028, 0029, 0031, 0032 (documenti dei clienti, applicata da Ania il 05/09/2026, bucket «documenti» privato creato). In `supabase/proposte` NON applicate: 0023, 0026 (RLS), 0030 (vincoli server fatture).
3. CAMBIA CLIENTE (06/09/2026 sera, main, scheda in cima): dalla scheda prenotazione «Cambia cliente» sposta QUELLA prenotazione (tutti i segmenti del soggiorno) su un cliente esistente o nuovo scrivendo solo guest_id (+ guest_name azzerato), cliente vecchio intatto, documenti spostabili con spunta (lib/cambiaCliente, 15 test); la «Nida» di oggi in Amelia si sistema da lì. OPZIONE DI 3 ORE (06/09/2026, main, scheda in cima): una proposta inviata tiene in opzione camere e notti per 3 ore (lib/opzioni), la bozza per un'altra richiesta le evita con nota ottone; scaduta → Pushover dal database (0040, pg_cron ogni 5 minuti → /api/richieste/scadenze) e chiusura automatica dopo 24 h; Rifiuta → «chiusa/rifiutata»; linguetta «Chiuse» (3 giorni, Riapri) al posto dell'Archivio. PROVENIENZA DEL CLIENTE (08/09/2026, sera, main, scheda in cima): la provenienza appartiene al CLIENTE (guests, proposte 0036 e 0037 APPLICATE in produzione, verificate il 06/09/2026), retroattiva su tutti i suoi soggiorni; chip in richieste/prenotazioni/scheda cliente che modificano il cliente; Statistiche con riga per fonte e ritorni. Storia: «Come ci ha trovato» (google/passaparola/altra_struttura/non_so + struttura) su richieste e prenotazioni, tabella strutture, dal sito = google, copia alla conferma; «Già stato da noi · N soggiorni» accanto al nome; Statistiche «Da dove arrivano gli ospiti». Da controllare: arrivo senza orario con «Chiedi orario» · «Apri chat» · «Apri arrivo» (stessi bottoni nella finestra Arrivi). HOME (07/09/2026): in cima TRE NUMERI (arrivi oggi, partenze oggi, occupate stanotte su quelle attive; lib/numeriOggi, giorno di Roma, trattini + Riprova su errore, cifre come Incassi/Spese), poi la STRISCIA DELLA SETTIMANA (28 giorni da oggi; dall'08/09 SOLO le pulizie ancora da fare con la stessa regola/fonte della pagina Pulizie — lib/pulizie.conteggioGiorno —, «✓» se tutte fatte, «—» se niente; tocco → Pulizie ?giorno=), poi «DA CONTROLLARE» col NUOVO ORDINE (tutte le richieste aperte per durata e scadenza, arrivi senza orario, pagamenti, fatture, sovrapposizioni in fondo senza urgenza). «DA CONTROLLARE» in Home (versione B, 07/09/2026, main, scheda in cima; RITOCCHI dello stesso giorno: sezione IN CIMA sopra i numeri del giorno, «WhatsApp» sugli arrivi senza orario col testo «Richiesta orario» di lib/messaggiWhatsApp condiviso con la scheda, «WhatsApp» senza testo sulle proposte scadute): elenco di ECCEZIONI (calendario, richieste, pagamenti, arrivi, fatture) da lib/daControllare (pure, 24 test) + lib/daControllareDati (stato condiviso, periodo oggi−31/+62 a pagine); ogni voce ha UN bottone al punto esatto (calendario ?giorno, arrivi ?apri, scheda ?azione=pagato, spese ?documento); «Rimanda» sulle richieste scrive nella tabella della proposta 0035 (NON applicata: senza tabella l'avviso dice che va applicata); nelle Statistiche «N pagamenti da controllare» accanto a Incassi. Anteprima finta: `gestionale-bnb-anteprima-home-finta` (3215).
   Branch `fatture-fase5` (Fase 5 fatture + 4 correzioni avversarie) in attesa della decisione di Ania; il branch `statistiche` è stato UNITO a main il 05/09/2026 (merge 5a4a5ee); le revisioni Codex (R1–R13) sono corrette, collaudate su PostgreSQL 16 locale (sessioni concorrenti, ruoli) con 4 difetti trovati e corretti, e PUBBLICATE il 06/09/2026 (scheda in cima); le proposte 0033/0034 restano da applicare a mano da Ania (guida in 5 righe nella scheda); il codice pubblicato funziona anche prima delle proposte e da lì Statistiche e Home calcolano tutto in lib/statistiche (scheda «Statistiche, numeri corretti» qui sotto: quattro voci Ricavi per soggiorno / Incassi / Spese / Saldo di cassa, occupazione sulle camere attive con anomalia oltre il 100 %, Segna come pagato con movimento).
4. Blocco 1 (04/09): elisione solo per 1, 8, 11 («all'8», «al 18»). Blocco 2: /richieste da desktop con calendario «Mese / 2 settimane», lista ariosa, intestazione su una riga; telefono invariato. Blocco 4 (04/09 sera, scelta di Ania sul mockup A): da desktop calendario a TUTTA larghezza sopra e lista sotto in schede su due colonne (≥1100 px), riga di sezione «RICHIESTE APERTE · N — Ordina per», vuoto = riga sottile tratteggiata con «+ Nuova richiesta»; niente più due colonne affiancate. Calendario desktop +20% (righe 54, intestazione 48, camere 15 px, barre 13–14 px, colonna camere 116, colonne 2 settimane ≥ 80 px); telefono invariato. Blocco 3: web-push tolto dal sito, docs senza secondo utente, scheda «prove in 10 minuti».
5. Proposte: ricerca automatica invariata (caso A poi B/C/E, per notte), «Altre camere» con i motivi, «Scelgo io» notte per notte con prezzo a mano; conferma solo via RPC 0031 (per notte).
   Documenti dei clienti (05/09, scelta di Ania, «fallo direttamente, mai cancellare dopo la partenza»): components/DocumentiCliente (scheda cliente: foto dal telefono ridotte a 1600 px JPEG, PDF, etichetta e fronte/retro, anteprime con URL firmati 1 h, elimina con conferma; RigaDocumentiPrenotazione «Documenti · N» nella scheda prenotazione → /clienti/<id>#documenti), lib/documentiCliente (funzioni pure, 4 test), migrazione 0032; senza migrazione la sezione avvisa e non salva.
   Griglia del Mac anche sul telefono in Calendario e Arrivi (05/09): riquadro bianco con ombra, riga «‹ periodo · Mese | 2 settimane ›», righe 44, intestazione 40, colonna camere 80 fissa col solo nome, colonne ≥ 60 (40 a mese) che scorrono di lato, barre su una riga con icone/navetta in linea, legenda del Calendario anche dritto; via l'altezza a schermo pieno della pagina e le vecchie misure gs() del telefono (restano le costanti mobile non usate).
   Tre pagine uguali anche sul telefono (05/09, richiesta di Ania): titolo + «Cerca nome o telefono…» (components/CampoRicerca) su Richieste, Calendario e Arrivi — Mac e telefono girato sulla stessa riga, dritto uno sotto l'altro; riga «Oggi · mesi» (components/RigaMesi + lib/mesiCliccabili, 2 test) sotto il calendario su tutte e tre le pagine, telefono e Mac, anche girato (Arrivi solo i mesi dentro i 90 giorni); Richieste ha la ricerca (lib/ricerca: nome, cognome, telefono) che filtra la lista e, con un solo risultato, lo evidenzia nel calendario; «← Indietro» a 16 px dal bordo su Calendario e Arrivi anche sul telefono (come BackBar in tutto il resto); in orizzontale niente legenda.
   Telefono in orizzontale (05/09, scelta di Ania): su Richieste, Calendario e Arrivi resta solo il calendario a tutto schermo — body[data-schermo-intero] (useSchermoIntero) + media (orientation: landscape) and (max-height: 520px) in globals.css nasconde barra alta (.barra-alta), barra bassa (.barra-bassa), margini del main (.contenuto) e il limite max-w-lg; la pagina nasconde titolo, chip, lista, righe sotto il riquadro e legenda (useOrizzontaleTelefono); Calendario/Arrivi contano come «desktop» in orizzontale (griglia compatta del Mac); Richieste passa compatto al calendario (colonne 52 px, 14 giorni senza scorrere). In verticale nulla cambia.
   Telefono, colonna camere (05/09): solo il nome, senza numero (Richieste 66 px, Calendario e Arrivi 80 px, senza descrizione); corretto il cambio camera nella griglia Richieste del telefono (taglio a incastro e angoli seguono la griglia orizzontale, prima usavano quelli verticali).
   Telefono come il Mac (05/09/2026, prova chiesta da Ania): /richieste sul telefono ha la stessa struttura del desktop — titolo, griglia camere-in-righe/giorni-in-colonne che scorre di lato dentro il riquadro (colonna camere 72, colonne ≥60 a 2 settimane, ≥40 a mese, selettore Mese | 2 settimane anche sul telefono), poi Reale/Presunta + «+ Nuova richiesta», contatori, «RICHIESTE APERTE · N», lista; via le schede Calendario/Lista; la vecchia griglia verticale resta nel componente (orizzontale=false la riporta).
   Sotto il riquadro (04/09 notte): campo di ricerca del Calendario col bordo #C9BFA8 e segnaposto stone come i selettori; riga «Oggi · mesi» (Calendario) e «Oggi · prossimi 83 giorni» (Arrivi) staccata di 24 px dal riquadro, testi 13 px, chip più grandi; legenda con più aria.
   Distanze uguali (04/09 notte): dal Mac su Richieste, Calendario e Arrivi «← Indietro» a 16 px dal bordo, riga del titolo alta 44 px (min-h) e 16 px prima del riquadro, che parte a 116 px su tutte e tre.
   Allineamento finale (04/09 notte): dal Mac Calendario e Arrivi hanno il titolo di pagina («Calendario» con la ricerca a destra, «Arrivi») sotto «← Indietro» come le Richieste, così il riquadro parte alla stessa altezza; la riga «Oggi · mesi» sta SOTTO il riquadro, sopra la legenda.
   Ripensamento (04/09 notte): Richieste tornate alle misure di prima (via il +20%); Calendario e Arrivi copiati IDENTICI dalle Richieste: righe 44, giorni 40, camere 96, testi 11–13, riga di navigazione «‹ · 1 – 14 set 2026 · Mese | 2 settimane · ›» (il selettore cambia la larghezza delle colonne, 14 o 30 nel riquadro, scelta in localStorage ca_calendario_modo; scorrimento continuo invariato), niente striscia dei mesi sopra i giorni; sotto una riga sottile con «Oggi» e i 12 mesi cliccabili (Calendario) / «Oggi» (Arrivi).
   Stessa grafica delle Richieste su Calendario e Arrivi (04/09 sera): griglia dentro il riquadro bianco arrotondato con la barra «‹ 2 settimane › · mese · Oggi» come prima riga, legenda fuori senza sfondo; Arrivi con le stesse misure leggere (righe 54, camere 116, testi 13/15, navetta in linea); telefono invariato.
   Calendario principale dal Mac (blocco 5, 04/09 sera, mockup approvato): griglia leggera come le Richieste (righe 54, colonna camere 116 senza descrizione → tooltip, barre col solo nome e icone piccole in linea, intestazione 26+48); barra sopra la griglia «‹ 2 settimane › · Mese anno · Oggi · 12 mesi cliccabili con l'anno» (vaiAData estende l'intervallo e scorre); scorrimento continuo su tutto l'anno, riga letti extra e legenda invariate; telefono invariato.
   Statistiche pulizie (04/09 sera): dato principale = INTERVENTI (pulizie a mano + automatiche + cambi biancheria, ogni cambio vale uno) con la media al giorno sul totale e sotto «di cui N pulizie, N cambi biancheria»; stessa regola sul passato ricostruito (lib/pulizieStatistiche, 4 test); sezione Pulizie invariata.
   Pulizie automatiche (04/09 sera): partenza + nuovo arrivo lo stesso giorno o il giorno dopo nella stessa camera (solo confermate) = pulizia FATTA da sola con la data della partenza, calcolata dalle prenotazioni (lib/pulizie: pulizieAutomatiche, nessuna migrazione, sparisce se la prenotazione cambia); in «Oggi» resta come lavoro con etichetta «automatica» e senza pulsanti, mai «in ritardo»; nuovo registro «Ultime pulizie» (manuali + automatiche) con «Cambia data» / «Non fatta» (righe cleanings con note automatica:*); statistiche contano manuali + automatiche dal 24/08, mai doppioni lo stesso giorno; 4 notti e partenze senza arrivo vicino invariate; 7 test.
   Nomi (04/09 sera): ovunque «Nome Cognome», mai «Cognome Nome» (lib/guestName: nomeCompleto e nomeBreve «Anna R.» per le barre; riesportate da lib/richieste); dati e testi bloccati intatti.
   Timer della proposta (04/09 sera): sulle richieste in «proposta inviata» una riga con l'orologio, «Proposta inviata · scade tra 2 h 15 min» (verde) poi «… scaduta 20 min fa / 3 h fa / ieri» (ottone), in lista, dettaglio, pannello e tooltip del calendario; conta da proposta_inviata_at (solo «Sì, inviata», colonna già in 0024, nessuna migrazione), si aggiorna ogni minuto (useAdesso), le scadute entrano in «N da guardare»; alla scadenza nessuna chiusura né notifica (lib/richieste: scadenzaProposta, 5 test).
   Errori di salvataggio visibili, parte 3 = CHIUSURA (05/09/2026, notte): scheda COMPLETATA salvo lib/spese (parte spese in corso). Bollino Richieste «!» con stato unico e Riprova (lib/richiesteContatore), push con delete controllato e route che rispondono 500 su lettura fallita (lib/cronLettura), lista prenotazioni e anteprime documenti con avviso + Riprova, memoria del browser con ripiego esplicito (lib/memoriaBrowser), sendWhatsapp/markComplete rimosse (codice morto).
   Errori di salvataggio visibili, parte 2 (05/09/2026, sera): scheda cliente (elimina/modifica/caricamento), scheda prenotazione (rilettura con esito → mai «Prenotazione non trovata» dopo un salvataggio riuscito, date del soggiorno in sequenza, cambio camera, motivo, annullamento senza alert), tariffe in Impostazioni, /nuova (cliente esistente e storico), Arrivi (orario/navetta senza alert); lib/prenotazioneScritture e lib/arrivoOrario; restano spese, richiesteDati, push e WebRequestAlert.
   Errori di salvataggio visibili (05/09/2026, pomeriggio): Conferma prenotazione e Segna come pagato cambiano lo schermo solo a scrittura riuscita (lib/scritturaSicura + components/AvvisoAzione «Non salvato, riprova»); richieste dal sito con tre stati in home (caricamento / nessuna / errore con Riprova) e bollino «!» sulla barra (lib/richiesteDalSito, lib/webRequests con stato unico); ricognizione del pezzo 4 (13 punti, NON corretti) nella scheda qui sotto.
6. Sito casaaniarozzano.it (repo sito-casaania): il modulo /prenota manda le richieste a POST /api/richieste/web; nessuna prenotazione nasce dal sito; ripiego Pushover.
7. Prove: suite `npm test` (467 test), `tsc`, lint del delta, `next build`, `node scripts/verifica-consegna.mjs --base <sha>`; UI sull'anteprima finta `gestionale-bnb-anteprima-richieste-finta` (3214, login con qualsiasi email) e `gestionale-bnb-anteprima-prenotazioni-finta` (3213).
8. Regole: nessun invio reale; migrazioni solo a mano da Ania; il calendario principale, la ricerca delle soluzioni e la RPC non si toccano senza un pezzo dedicato; un commit per blocco; mai modificare gli assert dei test esistenti.
9. Memoria del browser: `ca_richieste_calendario_modo` (mese/quindici), `ca_richieste_ultima_visita`, `ca_proposta_pendente_<id>`, `ca_calendario_posizione` (sessionStorage, 07/09/2026: giorno da cui ripartire tornando dalla scheda).
10. Migrazione 0040 APPLICATA da Ania il 06/09/2026 (ore 17): job pg_cron «richieste-scadenze» attivo con un CRON_SECRET NUOVO (il vecchio su Vercel era «sensibile», non rileggibile), Vercel aggiornato e ripubblicato (deploy 0b81f82). Il workflow GitHub del pezzo F è ATTIVO (segreto del repo aggiornato da Ania alle 20:41, lancio a mano → HTTP 200, 1 aperta, 0 notificate, 0 chiuse): due controlli ogni 5 minuti, database e GitHub, sulla stessa route idempotente. Azioni aperte per Ania sull'opzione di 3 ore: nessuna. 0035, 0037, 0038 e 0039 APPLICATE (verifiche del 06/09/2026); prove dal telefono (scheda «in 10 minuti» qui sotto); scelte «da confermare» del blocco 2; decisioni su fatture-fase5, statistiche, 0030, 0033/0034. INCARICO DEL 07/09/2026 (main): KPI in Statistiche con l'anno prima (pezzo 1), «Rifiuta con motivo» (finestra «Perché la rifiuti?», codici in motivo_rifiuto, Chiuse col motivo; proposta 0041 NON applicata, facoltativa) e riquadro «Richieste» in Statistiche (arrivate, esiti, per camera chiesta, camera diversa accettata); schermate con Chrome headless via scripts/revisioni/schermata.mjs. CRONOLOGIA (pezzo 2): proposta 0042 (tabella booking_events + trigger, sola lettura dal client) NON applicata, sezione in fondo alla scheda prenotazione. BACKUP (pezzo 3): docs/backup.md + scripts/backup-locale.mjs e backup-verifica.mjs collaudati in locale; piano Supabase VERIFICATO il 07/09/2026 sera dal pannello = Free, nessun backup né PITR dal pannello; PRIMO BACKUP REALE fatto (backup/gestionale-backup-2026-09-07-1954.json, 34 tabelle, 3.137 righe, verifica contenuti OK) e RIPRISTINO PROVATO in un PostgreSQL 16 isolato con lo stesso file (identico; scheda «Backup reale» in cima; difetto del confronto fra sorgenti corretto in backup-lettura con test); ESCLUSI i file dello Storage (8 documenti + 83 scontrini) e 5 oggetti di produzione senza migrazione (push_subscriptions, site_events, bookings.pushover_notified_at, rooms.double_price/matrimoniale_price). CALENDARIO TELEFONO (pezzo 4): legenda dal «?», tocco 44 px sulle barre, ritorno alla stessa posizione dalla scheda. DRIFT (pezzo 5): proposta 0043 con le 10 colonne di bookings già in produzione, usata dal collaudo locale. lib/spese (pezzo 6): le 7 scritture void e la lettura a null del tracker vecchio hanno l'esito visibile (scritturaSicura + AvvisoAzione). INCARICO DEL 07/09/2026 COMPLETO: 6 pezzi + parti 2 e 3, tutti su main. REVISIONE del 07/09 (Codex, sei rilievi R1–R6): corretti in 1b87fc4 e finiti in produzione col push di 5386800 (non era il passaggio autorizzato: vedi PROGETTO.md, si toglie con `git revert 1b87fc4`). INTEGRAZIONE CODEX (07/09/2026, sera, scheda in cima): patch R1/R6 su sei file (pendente mai sovrascritto, 23505 valido solo con rilettura dell'ID, modulo e Chiudi bloccati finché non si riconcilia, comandi backup in zsh), riverificata su 5386800 (790 test, verifica-consegna OK), poi PUBBLICATA col via libera di Ania: commit 154fbce, deploy Vercel Production riuscito (17:33 UTC).


# Iniziali maiuscole ANCHE NEL CAMPO mentre si scrive (07/09/2026, sera, main)

Segnalazione di Ania: «stamattina funzionava, adesso scrivo il nome in
minuscolo e resta in minuscolo». Causa trovata: nessun commit di oggi ha
tolto la funzione (tutte le chiamate a conIniziali di f9dbe73 sono intatte,
verificato con git diff f9dbe73..HEAD); la maiuscola scattava SOLO al
salvataggio, e nel campo dipendeva dalla tastiera dell'iPhone
(autocapitalize="words"), presente in Nuova/Modifica richiesta e Cambia
cliente ma NON nei campi unici «Nome e cognome» di Nuovo cliente, Nuova
prenotazione, scheda cliente e scheda prenotazione: lì il campo restava in
minuscolo finché non si salvava (e il salvato era maiuscolo → campo e
Supabase diversi).

- lib/maiuscole: conInizialiDigitando (stessa regola, senza togliere spazi) e
  maiuscoleNelCampo(input) da usare nell'onChange: corregge il valore nel
  campo tenendo il cursore dov'era e torna il valore per lo stato; così campo
  e valore salvato coincidono (conIniziali resta al salvataggio).
- Applicata in: Nuovo cliente, scheda cliente (Modifica), Nuova prenotazione
  (Dati cliente / Aggiorna dati), scheda prenotazione (Modifica → Nome
  cliente), Cambia cliente (Nome, Cognome), Nuova/Modifica richiesta (Nome,
  Cognome); autocapitalize="words" + autocomplete="off" anche sui campi unici.
- Regola: prima lettera di ogni parola maiuscola, il resto invariato;
  «D'Angelo» e «Rossi-Bianchi» restano così, «d'angelo» → «D'Angelo».
- Test: lib/maiuscole (7, con cursore e coincidenza campo/salvato); suite
  807 verde, tsc ok, lint senza differenze; provato sull'anteprima finta
  delle Richieste (3214): «maria rosa d'angelo» → «Maria Rosa D'Angelo» nel
  campo con cursore fermo dopo una correzione in mezzo, salvata e mostrata
  in lista «Maria Rosa D'Angelo Rossi-Bianchi». Nessuna migrazione.


# «Nome Cognome» ovunque, funzione unica e test sui sorgenti (07/09/2026, sera, main)

Ania: «in diversi punti compare ancora cognome e poi nome». Ricerca completa
su app, components, lib, supabase, scripts (concatenazioni, template, [a, b],
select/order, SQL con ||, ordinamenti): il codice componeva già «Nome
Cognome» quasi ovunque (lib/guestName.nomeCompleto dal 04/09, riesportata da
lib/richieste; RPC 0027/0031 «nome || ' ' || cognome»). Le schede cliente
(guests) hanno un campo unico full_name: se una scheda mostra «Cognome Nome»
è il testo salvato in quella scheda (da correggere lì), non un difetto di
composizione. Corretti i punti rimasti fuori dalla funzione unica:

- lib/guestName.nomeCompleto accetta anche { full_name } (scheda cliente):
  nome/cognome vincono, altrimenti full_name ripulito; mai spazi doppi.
- lib/clienteCheTorna.chiaveNome: concatenazione a mano → nomeCompleto.
- scripts/revisioni/anteprima-richieste-finta.mjs: due `${nome} ${cognome}`
  (full_name e guest_name della prenotazione finta) → nomeCompleto.
- Già giusti (verificati): calendario Richieste (nomeBreve «Anna R.» e
  tooltip), lista/chiuse/pannello/proposta/rifiuto/conferma delle Richieste,
  Home «Da controllare» (lib/daControllare), opzioni (lib/opzioni), push e
  Pushover dal sito (route web) e scadenze (lib/richiesteScadenze), cambio
  cliente (lib/cambiaCliente), RPC conferma_richiesta; Calendario, Home,
  Arrivi, Partenze, Pulizie, scheda prenotazione, lista/scheda clienti,
  Statistiche, WhatsApp/immagine, push orario/ringraziamento, causale e
  ricerca usano il campo unico (nomeOspite / full_name) senza ricomporlo.
  Ordinamenti: nessuna lista di clienti in ordine alfabetico (clienti per
  data di creazione, cambio cliente per full_name); moduli con Nome prima di
  Cognome (Richieste, Cambia cliente), campi unici «Nome e cognome».
- Test: lib/guestName (+ full_name) e NUOVO lib/ordineNomi.test.ts che legge
  i sorgenti e fallisce se torna «cognome + nome» (TS, script, SQL) o una
  concatenazione nome+cognome fuori da lib/guestName, o un modulo con
  Cognome prima di Nome (ha scovato subito la seconda riga del finto).
  Suite 807 verde, tsc ok, lint senza differenze. Nessuna migrazione.


# Nuova prenotazione: «duplicate key … guests_phone_key» (07/09/2026, notte, main)

Ania: cliente nuova, prima camera salvata bene, poi «Aggiungi cambio camera»
per un giorno in più in un'altra camera → «Errore creazione cliente: duplicate
key value violates unique constraint guests_phone_key». Non era la prima volta.

Cause (due, stessa radice: guests.phone è UNIQUE e la pagina creava una
seconda scheda con lo stesso numero):
1. Dopo il PRIMO salvataggio di un cliente nuovo la pagina non «ricordava» la
   scheda appena creata (guestId era una variabile locale di save(), lo stato
   `guest` restava null): il cambio camera aggiunto subito dopo ripeteva
   l'insert in guests → 23505. Per questo la prima camera passava e la
   seconda no.
2. Da «Cerca per nome» senza risultato (nome scritto diverso da come è
   salvato: «Rossi Mario»/«Mario Rossi», accento, refuso) si arriva a «Nuovo
   cliente» e si scrive il numero: se il numero è già di una scheda, insert →
   23505. La ricerca per telefono invece la trovava.

Correzione (scelta di Ania coi bottoni: «Usa la scheda esistente»):
- lib/clienteTelefono (puro, 5 test): stessoNumero (cifre, con o senza 39, in
  qualunque forma salvata: «+39 333 000 0001» = «393330000001»),
  schemaRicercaTelefono (ilike sulle ultime 9 cifre separate da %),
  schedaConNumero, nomeSuPrenotazione (il nome scritto, se diverso da quello
  della scheda, resta su QUESTA prenotazione in bookings.guest_name: la scheda
  non si rinomina), testoClienteRiconosciuto. lib/clienteTelefonoDati:
  cercaSchedaPerTelefono (ilike + riverifica con stessoNumero).
- app/nuova: riconosciNumero() all'uscita dal campo «Numero di telefono» di
  «Nuovo cliente» e, per sicurezza, al salvataggio; con 23505 sull'insert si
  ricerca ancora e si usa la scheda trovata; dopo un insert riuscito la scheda
  nuova resta agganciata (setGuest) così il cambio camera la riusa. Sotto
  «Cliente trovato» la riga rossa: «Numero già in archivio: uso la scheda di
  Anna Kowalska. «Giulia Bianchi» resta come nome di questa prenotazione, la
  scheda non cambia.»
- Finto Supabase delle prenotazioni: filtro `or=(…)` (prima ignorato: ogni
  ricerca «trovava» qualcuno nei contatti extra), POST bookings e PATCH guests
  in memoria, per provare il flusso intero.
- Prove headless (schermata.mjs, 390 px) sul finto: A) numero nuovo → prima
  camera Lena salvata → «Aggiungi cambio camera» → Amelia salvata, entrambe
  sul cliente 0017 (una scheda sola, log del finto); B) in «Nuovo cliente»
  nome «giulia bianchi» + numero di Anna Kowalska → all'uscita dal campo
  «Cliente trovato» con la riga rossa → salvata su Anna con guest_name
  «Giulia Bianchi». Suite 812 verde, tsc ok, lint senza differenze. Nessuna
  migrazione.

---

# Backup reale e ripristino provato (07/09/2026, sera) — piano Free verificato, PUBBLICATO (1032674)

Stato: FATTO in locale, nessuna scrittura in produzione, nessun SQL applicato,
nessun servizio nuovo. Lavoro concorrente: cfb4801 (Home, pulizie di oggi)
arrivato prima dell'inizio, albero pulito; i file toccati qui sono solo
scripts/backup-lettura.mjs, lib/backup.test.ts, docs/backup.md, questa scheda.

## Esiti effettivi

1. **Piano Supabase** (letto dal pannello con la sessione Chrome già
   autenticata, sola lettura): organizzazione «Free Plan · 2 projects»;
   Database → Backups: «Free Plan does not include project backups»; Point in
   time: aggiunta del piano Pro da 100 $/mese. Nessun backup dal pannello.
2. **Primo backup reale**: `backup/gestionale-backup-2026-09-07-1954.json`
   (34 tabelle, 3.137 righe, 1,1 MB, impronta f9c0faa2…), in `backup/`
   ignorato da git (check-ignore confermato), Mac con FileVault attivo, nessuna
   chiave dentro il file. Chiave passata all'ambiente dal `.env.local` con
   `sed` (mai stampata, mai in chat/log/cronologia) invece del `read -s`,
   perché lo strumento non ha una tastiera: variante annotata in docs §5.
   `backup-verifica --confronta contenuti` contro la produzione: tre livelli OK.
3. **Ripristino con il file vero** in un PostgreSQL 16.15 NUOVO (initdb in una
   cartella temporanea, porta 5433, solo TCP, LC_ALL=C — i primi due avvii
   erano caduti per il percorso del socket troppo lungo e per il locale di
   macOS), database `collaudo_ripristino` con lo schema da
   applica-migrazioni.mjs + 0040 parte 1 a mano (pg_cron assente in locale)
   + proposte 0035–0038 (in produzione ci sono) + 5 oggetti di drift creati a
   mano coi tipi dell'OpenAPI: 34 tabelle, 3.137 righe ripristinate; verifica
   `--confronta contenuti --postgres` contro il RIPRISTINATO: **identico**.
   Prove avversarie (ripetute dopo la correzione per tipo): prezzo +0,01,
   un microsecondo su un timestamptz, uno zero davanti a un nome, riga tolta →
   tutte rilevate; poi ripristinato di nuovo → identico. Cluster fermato.
4. **Difetto dimostrato e corretto** (unico ritocco al codice, in
   scripts/backup-lettura + una riga in backup-verifica che passa i tipi): il
   confronto riga per riga dava «contenuto diverso» su 25 tabelle per numeri
   come stringhe e timestamptz in fusi diversi fra PostgREST e node-pg. La
   prima versione normalizzava «a vista» e Codex ha riprodotto tre falsi uguali
   (telefono «0123»/«123», «9007199254740992»/«…993» via Number, testo con la
   T/spazio): rifatta PER TIPO REALE di colonna (format dell'OpenAPI /
   data_type di information_schema): numeri canonicalizzati come testo senza
   Number, timestamptz in UTC coi microsecondi, timestamp solo separatore,
   testo/date/JSON esatti; senza tipi confronto esatto. Test con le tre
   regressioni + i casi validi (80 = «80.00», 1e21, −0,5, fusi diversi con
   microsecondi, mezzanotte a cavallo del fuso). Suite 797/797,
   verifica-consegna --base cfb4801 OK, diff --check OK.
5. **Distinzione** dal collaudo sintetico del §6 di docs/backup.md: quello
   usava 218 righe inventate e lo stesso lettore da entrambi i lati; questo usa
   il file di produzione e scopre sia il drift sia il difetto del confronto.

## Recuperabile / escluso (sul file vero)

- Recuperabile: tutte le righe delle 34 tabelle di `public`, in un database
  che abbia già lo schema (migrazioni + proposte applicate + drift).
- ESCLUSO: i file dello Storage (8 documenti dei clienti, 83 foto di
  scontrini, 83 family_documents: nel file solo le righe con i percorsi);
  schema, RPC, trigger, policy, `auth.users`, job pg_cron, segreti, sequenze;
  tutto ciò che cambia dopo le 19:54 del 07/09/2026.

## Punti ancora aperti

- Drift senza migrazione: `push_subscriptions`, `site_events`,
  `bookings.pushover_notified_at`, `rooms.double_price`,
  `rooms.matrimoniale_price` → proposta di drift come la 0043 (da scrivere).
- Copia dei file dello Storage: nessuna; da decidere se farla (script con la
  service key sui bucket `documenti` e `scontrini`) o accettare la perdita.
- Il backup resta manuale (docs §7): ripeterlo prima di ogni migrazione e
  almeno una volta a settimana; seconda copia su un altro disco.
- Pubblicazione: commit 1032674 spinto col via libera di Ania dopo la correzione per tipo, deploy Vercel Production riuscito (19:36 UTC); il file di backup resta solo sul Mac.

---

# Integrazione Codex — recupero spese e comandi backup (07/09/2026)

Base iniziale `00dba9b`; integrazione su `1b87fc4`, dopo avere verificato che
le modifiche concorrenti non toccavano i cinque file della patch. Su richiesta
dell’utente («aiutalo a lavorare più che puoi, cambia metodo») Codex ha preparato
e provato le correzioni in una copia isolata, poi le ha riportate qui con accesso
ai file autorizzato. Nessun commit, push, deploy o intervento su Supabase.

- R1: un payload diverso NON sostituisce più la spesa ancora incerta nella
  singola chiave di memoria. Guardia per ambito anche se cambia l’importo
  durante una risposta tardiva. Modulo e Chiudi disabilitati fino alla
  riconciliazione; Riprova disponibile. Un 23505 vale come successo soltanto
  se la rilettura ritrova proprio l’ID della spesa.
- Il vecchio test accettava due righe perché presumeva che il pendente
  precedente restasse «custodito a parte»: veniva invece sovrascritto.
  L’attesa è stata corretta per rispettare R1. Aggiunte due regressioni:
  vincolo duplicato senza riga e importo diverso durante risposta tardiva.
- R6: comandi zsh provati con valore finto; URL presente; unset della chiave
  DOPO il confronto dei contenuti. Nessuna chiave reale usata.
- Sulla copia iniziale: 27 test mirati (compresi i 4 del server PostgREST),
  altri test della suite eseguiti senza server: 773/773. Totale suite 777
  (773 + 4). TypeScript OK, lint senza nuovi rilievi (4 avvisi nel tracker,
  2 avvisi img già presenti in ScontriniBlock).
- UI vera, solo dati sintetici: 390 px, 12 € con risposta 503 e campi/Chiudi
  bloccati; riapertura riconciliata, seconda riapertura pulita. 1280 px,
  seconda spesa 13 €, totale 25 € e 2 righe. Famiglia a 390 px: 7 €, una riga.
- Integrazione su `1b87fc4` + modifiche locali: `verifica-consegna.mjs
  --base 1b87fc4` OK per suite applicazione, regressioni revisioni, strumenti
  locali, TypeScript e lint dei file modificati. Build OK sulla copia con
  gli stessi sorgenti e sole variabili sintetiche; `git diff --check` OK.
  Le prove non sono attribuibili al solo commit `1b87fc4`. Dopo i controlli
  è stata completata soltanto questa scheda, senza ritoccare il codice.
- Durante la consegna è arrivato `5386800` (Richieste), già su origin/main:
  modifica tre file estranei alla patch Codex. I cinque file della patch
  restano identici a quelli collaudati. I controlli sopra non attestano le
  nuove modifiche alle Richieste; nessun commit o push eseguito da Codex.
- Il ripristino su PostgreSQL 16 resta una prova riferita dall’autore:
  non ripetuta da Codex perché il server locale era spento e la sandbox
  impedisce l’avvio di un nuovo cluster (memoria condivisa). Percorso
  PostgREST verificato con server sintetico; Supabase reale non verificato.
  Restano primo backup reale con confronto contenuti e lettura del piano.

File Codex: lib/spese/spesaPendente.ts e test, components/SpeseTracker.tsx,
components/spese/ScontriniBlock.tsx, docs/backup.md, questa scheda.

## Integrazione riletta e riverificata (07/09/2026, sera, Claude)

- Diff dei sei file riletto: nessun conflitto con 5386800 (tre file estranei);
  la patch è rimasta com'era, nessun ritocco al codice. Logica confermata:
  `inCorso` per ambito; un payload diverso col pendente ancora custodito
  torna «incerto» con MESSAGGIO_PENDENTE (Riprova riconcilia il precedente);
  23505 → «salvata» solo se `esiste(id)` ritrova la riga, altrimenti «incerto»
  con la custodia che resta; nel tracker `spesaIncerta` blocca «Aggiungi»/
  «Chiudi» e il modulo (fieldset disabled) finché un tentativo non torna
  salvato o rifiutato; la riconciliazione alla riapertura passa dallo stesso
  `inviaSpesa(null)`. `read -rs 'VAR?prompt'` è la forma giusta in zsh
  (in zsh `read -p` legge dal coprocesso, non dalla tastiera).
- Prove ripetute sull'albero VERO (5386800 + patch), non sulla copia:
  `node --test lib/spese/spesaPendente.test.ts` 9/9;
  `node scripts/verifica-consegna.mjs --base 5386800` OK (suite applicazione,
  regressioni, strumenti locali, TypeScript, lint dei file modificati);
  `npm test` 790/790; `git diff --check` OK.
- NON ripetute (nessuna modifica dopo le prove di Codex): UI a 390/1280,
  build, ripristino PostgreSQL. Restano come documentate sopra.
- Stato: commit 154fbce su main, PUBBLICATO col via libera di Ania (passaggio
  distinto dalla verifica); deploy Vercel Production riuscito alle 17:33 UTC.

---

# Consegna — Correzioni ai sei rilievi della revisione del 07/09/2026 (candidato revisionato 095cf85; SOLO locale, nessun push)

Rapporto: ~/Documents/Codex/2026-09-07/ch/outputs/revisione-7-settembre.md (prove nel
JSON accanto). Stato: VERIFICATO IN LOCALE, in attesa del passaggio autorizzato
(push). Nessun SQL applicato, nessuna scrittura in produzione, nessun servizio.
Lavoro concorrente: nessuno (albero pulito su 095cf85 all'inizio).

## Rilievi risolti

R1 (P1, spese duplicate con «Riprova») — lib/spese/spesaPendente (puro, 7 test
  con un servizio finto che CONSERVA le righe): identità stabile del tentativo =
  ID della riga generato dal client e custodito in localStorage
  (ca_spesa_pendente_<ambito>) PRIMA dell'invio; rilettura dell'ID prima di ogni
  invio; INSERT con l'ID (ripetuto → 23505 = già salvata); rete persa, 5xx o
  errore senza codice SQL = esito INCERTO detto come tale («Non so se la spesa è
  stata salvata…»), mai «Non salvato»; solo un codice SQL/PostgREST è un rifiuto
  certo; doppio tocco bloccato (saving + guardia sull'ID in corso); alla
  riapertura il pendente si riconcilia da solo. lib/spese/dati: inserisciSpesaConId
  + esisteSpesa. Nessuna migrazione (family_expenses.id è già la chiave).
  Riprodotto e chiuso il caso della revisione: 12 € → una sola riga.
R2 (P1, verifica con select=id) — scripts/backup-lettura (nuovo, comune ai tre
  script): conteggi con HEAD `select=*` + `Prefer: count=exact`, chiave primaria
  vera dall'OpenAPI di PostgREST (`<pk/>`) o da pg_index; app_members (user_id)
  esportata e confrontata; percorso PostgREST provato in lib/backupPostgrest.test
  contro un server sintetico che risponde 400 a select=id come PostgREST vero.
R3 (P1, backup incompleto «integro») — pagine con ORDINE STABILE sulla chiave
  primaria e avanzamento sulle righe davvero restituite (taglio del server a
  1.000); il file registra per tabella righe attese, chiave, righe lette;
  l'esportazione si FERMA (file non scritto) se righe ≠ attese o chiavi doppie/
  nulle; la verifica stampa TRE livelli distinti — INTEGRITÀ DEL FILE
  (impronta, struttura), COMPLETEZZA DELL'ESPORTAZIONE (attese, chiavi),
  CONFRONTO COL DATABASE (--confronta: conteggi; «contenuti»: riga per riga
  sulla chiave: mancanti / in più / diverse). La riproduzione della revisione
  (pagine sovrapposte, id 1001 assente) ora fa fermare l'esportazione. Limite
  delle letture durante scritture concorrenti dichiarato in docs/backup.md §7.
R4 (P2, cronologia dopo «Cambia cliente») — la cronologia si rilegge in
  rileggiScheda() (chiamata da ogni salvataggio riuscito: modifica, sconto,
  date, cambio cliente) e nei due successi senza rilettura (group_id,
  annullamento); il finto 3213 aggiunge DAVVERO l'evento «cliente» al PATCH di
  guest_id (trigger sintetico della 0042).
R5 (P2, significato) — «Proposta un'alternativa, non hanno risposto o hanno
  detto no» conta SOLO scadute + «non ha risposto» + «ha detto di no» («data a
  un altro» e «altro motivo» esclusi; il testo lo dice); «Non era libera» =
  camera chiesta assente dalle proposte, SENZA più «perché occupata». Test nuovo.
R6 (P2, comando incompleto) — docs/backup.md §5: export dell'URL (non segreto)
  + chiave letta con `read -s` (non compare, non va nella cronologia né nei
  file) + unset finale; lo script dice esplicitamente che Node non legge
  .env.local. Stesse variabili per --confronta.

## Prove eseguite (tutte locali, dati sintetici)

- Suite: 775/775 (era 761): +7 spesaPendente, +4 backupPostgrest, +1 R5,
  backup.test riscritto sui tre livelli (7). Regressioni delle revisioni e
  strumenti locali OK, TypeScript OK (scripts/verifica-consegna.mjs --base
  095cf85). Lint del delta: 24 errori + 8 avvisi = gli stessi PREESISTENTI
  (scheda prenotazione 24+4, tracker 4); nessun rilievo nuovo sui file
  toccati (controllati uno a uno).
- UI sull'anteprima finta 3213 con Chrome headless (schermata.mjs, ora con
  --ricarica), a 390 px e 1280 px:
  · R1: il finto salva e risponde 503 → «Non so se la spesa è stata salvata…»
    + Riprova, modulo aperto, custodia presente, 1 riga; «Riprova» → «La spesa
    era già stata salvata: nessun doppione», custodia tolta, 1 riga; risposta
    persa (socket chiuso: Chrome ripete il POST, 23505) → «già salvata», 1
    riga; riapertura con pendente → riconciliata da sola, 1 riga; SECONDA
    riapertura → nessun avviso, nessun pendente; doppio tocco su Salva →
    1 riga; rifiuto certo 403 → «Non salvato, riprova» col modulo aperto.
  · R4: scheda con 5 righe di cronologia → Cambia cliente dalla UI (ricerca,
    scelta, «Passa la prenotazione a …») → 6 righe SENZA riaprire, ultima
    «cliente Famiglia Quadrupla → Coppia Allegra»; idem a 1280 (6 → 7).
- Backup, collaudo reale su PostgreSQL 16 locale (porta 5433): export
  --postgres (30 tabelle, 218 righe, app_members compresa) → verifica
  --confronta contenuti OK sui tre livelli → RIPRISTINO in un database
  isolato migrato e vuoto (backup-ripristino.mjs --conferma --svuota, 218
  righe) → verifica --confronta contenuti contro il database RIPRISTINATO:
  identico. Il primo giro del ripristino ha scoperto due difetti veri della
  lettura Postgres (date scalate di un giorno, microsecondi persi): corretti
  tenendo date/timestamp come testo, poi riprovato: identico. File alterato →
  INTEGRITÀ NON OK; file con una riga tolta → COMPLETEZZA NON OK.
- Controllo condiviso sul candidato finale (albero fermo, commit 264bf78 poi
  ammesso con questa sola riga di documentazione, codice identico):
  «OK — Suite applicazione», «OK — Regressioni delle revisioni», «OK —
  Strumenti locali», «OK — TypeScript senza emissione»; «Lint dei file
  modificati»: 32 problemi = 24 errori + 8 avvisi, TUTTI preesistenti (i 24
  errori e 4 avvisi della scheda prenotazione esistono dalla base 274688a, i
  4 avvisi del tracker pure); nessun rilievo nuovo nei file toccati. Per
  questo il comando esce con VERIFICHE_FALLITE_O_INCOMPLETE: è il lint
  storico, non una regressione.
- Build (`next build`) eseguita UNA volta sul candidato finale: «Compiled
  successfully», 30 pagine statiche generate (rete presente: i font di Google
  sono stati scaricati; la revisione non era riuscita per rete limitata).

## Cosa il JSON permette di recuperare (dichiarato in docs/backup.md §4)

Le righe di tutte le tabelle di public, in un database che ha già lo schema.
NON: schema SQL, funzioni/trigger/RPC, policy RLS, auth.users, file dello
Storage, job pg_cron, sequenze. Non è un backup completo del progetto.

## Documentazione corretta

- docs/backup.md: piano Supabase NON verificato (Settings → Billing); «Free»
  non equivale a «nessun backup» in assoluto (Supabase dice di conservarne
  fino a 7 anche per Free, accessibili solo dopo un upgrade e senza garanzia);
  comandi completi con URL; tre livelli di verifica; ripristino; limiti.
- Le schede precedenti del 07/09 su backup e riquadro Richieste restano come
  storia; valgono le correzioni di questa scheda.

## Limiti residui

- Percorso PostgREST provato contro un server sintetico fedele, NON contro
  Supabase vero (nessuna lettura in produzione in questo giro): il primo
  backup reale e la sua verifica «contenuti» li fa Ania (docs §5).
- Letture non atomiche fra tabelle: dichiarato; «--confronta contenuti»
  subito dopo l'export lo rivela.
- Chrome ripete da solo un POST su connessione chiusa: il caso «rete persa»
  dalla UI arriva come 23505 (riconciliato); il caso incerto puro è stato
  provato con la risposta 503 dopo il salvataggio e nei test del modulo.
- Il tracker vecchio resta codice in via di ritiro (?vecchia=1).

🔴 AZIONE PER ANIA: dopo il push (che qui NON è stato fatto), primo backup reale
coi comandi di docs/backup.md §5 e verifica con `--confronta contenuti`;
leggere il piano in Settings → Billing e dirmelo.

---

# Consegna — Residui di lib/spese: esito visibile anche nel tracker vecchio (07/09/2026, main)

Incarico del 07/09/2026, pezzo 6. Un commit, nessuna migrazione. Ricognizione
prima di toccare: nessun lavoro in corso su lib/spese (ultimi commit solo
grafici, branch rifacimento-spese fermo al 01/09 senza commit esclusivi);
lib/spese/dati.ts è usato SOLO da components/SpeseTracker (il tracker
vecchio, raggiungibile con ?vecchia=1), il modulo nuovo passa da
lib/spese/scrittura + scritturaSupabase e non è stato toccato.

- lib/spese/dati.ts: le 7 scritture che erano `void` (eliminaScontrino,
  aggiornaNotaScontrino, inserisciSpesa, eliminaSpesa, salvaBudget,
  aggiornaBudget, eliminaBudget) tornano `Promise<string | null>` tramite
  lib/scritturaSicura.scriviPoiAggiorna (null = salvato, altrimenti «Non
  salvato, riprova[: nessuna connessione]»); stesse query di prima, nessuna
  logica cambiata. eliminaScontrino cancella PRIMA la riga e poi il file
  (un file orfano è tollerato, una riga senza file no).
- Il `return null` di caricaScontriniDaLeggere diventa un esito
  {righe, assente, errore} (lib/spese/esito, puro, 2 test): tabella o bucket
  non ancora creati = sezione nascosta com'era; rete o permessi = avviso con
  Riprova, non più silenzio.
- components/SpeseTracker: un solo AvvisoAzione in cima (sotto il titolo) con
  «Riprova» che ripete l'ultima azione fallita (senza richiedere conferma o
  prompt); lo stato locale cambia solo a scrittura riuscita (prima la riga
  spariva o il modulo si chiudeva anche se il server non aveva salvato); il
  modulo della spesa resta aperto coi valori scritti se il salvataggio
  fallisce. Gli alert del caricamento foto (salvaFotoScontrino, già con
  esito boolean) restano come sono: fuori dal perimetro dei «7 void».
- Prove: 761 test, tsc, lint dei file toccati ai 4 avvisi già presenti,
  next build ok; anteprima finta 3213 (le scritture rispondono 403):
  /spese?vecchia=1 → «＋ Aggiungi» → importo 12 → Salva → «Non salvato,
  riprova» + Riprova sotto il titolo, modulo ancora aperto con 12.
- Limite: il tracker vecchio resta codice in via di ritiro (?vecchia=1);
  qui è cambiato solo l'esito, non il flusso.

---

# Consegna — Drift di bookings registrato nella proposta 0043 (07/09/2026, main) — 🔴 da applicare quando vuole Ania (in produzione non cambia nulla)

Incarico del 07/09/2026, pezzo 5. Un commit, nessuna migrazione applicata.

- supabase/proposte/0043_drift_bookings.BOZZA.sql: le 10 colonne di bookings
  che in produzione esistono senza un file di migrazione (pagato, bonifico,
  guest_name, extra_bed_dates, extra_phone_1/_name, extra_phone_2/_name,
  color, check_in_time), tutte con «add column if not exists», tipi dedotti
  dal codice, verifica in fondo (10 righe). In produzione ogni riga trova la
  colonna già presente e passa oltre: applicarla serve solo a far coincidere
  i file con il database.
- scripts/collaudo-0033/applica-migrazioni.mjs applica la 0043 dal file
  (prima delle proposte 0033 e 0034) al posto dell'elenco scritto a mano:
  il collaudo locale non deve più aggiungere le colonne da solo.
- lib/driftBookings.test (PGlite, 3 test): la bozza elenca le 10 colonne
  con «if not exists»; su una bookings «solo migrazioni» le crea coi tipi
  giusti; applicata di nuovo non cambia nulla e i dati restano.
- Prova sul PostgreSQL 16 locale: database nuovo → migrazioni 0001–0039 (la
  0040 non passa in locale per pg_cron, come sempre) → 0043 OK → 0033 e 0034
  OK; information_schema conta 10 colonne.

🔴 AZIONE PER ANIA (quando vuole, non urgente): incollare
supabase/proposte/0043_drift_bookings.BOZZA.sql nel SQL Editor e controllare
che la select in fondo restituisca 10 righe.

---

# Consegna — Calendario sul telefono: legenda «?», tocco 44 px, ritorno alla stessa posizione (07/09/2026, main)

Incarico del 07/09/2026, pezzo 4. Un commit, nessuna migrazione.

- Legenda: bottone «?» (44×44, aria-label «Legenda») in alto a destra sulla
  riga di «← Indietro», che apre components/LegendaCalendario.PannelloLegenda
  (velo + foglio dal basso sul telefono, scheda centrata sul Mac, Escape e
  «Chiudi» a 44 px) con le sei voci; sul telefono la legenda in riga in fondo
  alla pagina NON c'è più (la griglia non perde spazio), dal Mac resta com'era
  (stesse voci da lib/calendarioMobile.VOCI_LEGENDA, unica fonte dei colori
  blu/viola/verde usati anche dalle barre). Niente voce «Cambio camera»
  (Ania, 04/09/2026): il pannello lo spiega in una riga.
- Tocco: sul telefono ogni barra (alta 32 px) ha sopra un'area invisibile
  alta 44 px (lib/calendarioMobile.areaTocco: 6 px sopra e 6 sotto), stessa
  larghezza e stesso tocco della barra (evidenzia la catena / apre la
  scheda); la barra non cambia aspetto. Dal Mac niente area in più.
- Ritorno: prima di aprire una scheda prenotazione il Calendario salva in
  sessionStorage (ca_calendario_posizione, via lib/memoriaBrowser) il primo
  giorno in vista; al rientro (Indietro = cronologia del browser, componente
  rimontato) la griglia riparte da quel giorno — stesso mese e stessa
  posizione —, la memoria si consuma subito (vale una volta sola); con
  ?giorno= dalla Home vince il parametro; memoria negata = si riparte da
  oggi come prima.
- lib/calendarioMobile (puro): VOCI_LEGENDA, areaTocco, codifica/indice
  della posizione; lib/calendarioMobile.test (4 test) con le prove di layout
  sul sorgente (bottone, legenda solo dal Mac, data-tocco, ricordaPosizione
  prima di ogni apertura, «Chiudi» a 44 px).
- Prove: 756 test, tsc, lint dei file toccati senza rilievi, next build ok;
  anteprima finta 3213 con Chrome headless a 320, 390 e 1280 px: «?»
  presente, legenda in riga assente sul telefono e presente dal Mac, 20 aree
  di tocco alte 44 px (larghezza minima 56 px a 2 settimane), pannello con le
  sei voci; andata e ritorno reale (scroll a 720 px → tocco su una barra →
  scheda → history.back → scroll di nuovo a 720 px, memoria consumata).
- Limite: l'area di tocco copre anche i 6 px di cella libera sopra e sotto
  la barra (lì il tocco apre la prenotazione, non «nuova»); a mese sul
  telefono le colonne sono 40 px, quindi la barra da una notte resta larga
  40 px (l'altezza è garantita, la larghezza no).

---

# Consegna — Backup: verifica documentata e scripts locali (07/09/2026, main) — 🔴 piano Supabase da confermare

Incarico del 07/09/2026, pezzo 3. Un commit, nessuna migrazione, niente
eseguito sulla produzione.

- docs/backup.md: cosa prevede Supabase per piano (Free: backup non
  accessibili dal pannello — rivisto dopo la revisione —; Pro 7 giorni; Team 14; Enterprise 30; PITR a pagamento), come
  si chiede un ripristino (Database → Backups → Restore, progetto fermo
  durante il ripristino, niente ripristino di una sola tabella), cosa NON è
  coperto (file dello Storage — scontrini e documenti —, segreti su Vercel,
  job pg_cron da ricontrollare, modifiche dopo l'ultimo backup, codice su
  GitHub), limiti degli script.
- LIMITE DICHIARATO: il piano di QUESTO progetto non l'ho potuto leggere
  (il pannello Supabase vuole il login di Ania; il Chrome collegato non era
  raggiungibile; nessun token salvato sul Mac). Il documento spiega dove
  guardarlo in 10 secondi (Settings → Billing, o Database → Backups).
  [Corretto dopo la revisione: il piano resta NON verificato; «Free = nessun
  backup» non è una certezza, vedi docs/backup.md §1.]
- scripts/backup-locale.mjs: esporta tutte le tabelle di public in
  backup/gestionale-backup-AAAA-MM-GG-HHMM.json (cartella in .gitignore);
  da Supabase con SUPABASE_SERVICE_ROLE_KEY letta SOLO dall'ambiente (mai
  stampata né scritta; guardia che rifiuta di scrivere un file che la
  contenga; nel file resta solo l'host), oppure --postgres con DATABASE_URL
  (collaudo). scripts/backup-verifica.mjs: rilegge il file e controlla
  struttura, conteggi, impronta SHA-256; --confronta ricalcola i conteggi
  dalla sorgente. scripts/backup-comune.mjs: parte pura condivisa.
- Prove: lib/backup.test (5 test) nella suite; collaudo REALE sul PostgreSQL
  16 locale (porta 5433, database migrato con applica-migrazioni.mjs, una
  prenotazione e un acconto): 30 tabelle / 217 righe esportate, verifica OK
  con conteggi identici; importo alterato nel file → impronta diversa; riga
  tolta → conteggio e impronta; riga aggiunta nel database → --confronta la
  segnala; senza variabili lo script si ferma senza rete. Dettagli in
  docs/backup.md §4.
- Non fatto (da autorizzare): copia dei file dello Storage, esecuzione
  automatica, script di ripristino dal JSON.

🔴 AZIONE PER ANIA: aprire Supabase → Settings → Billing e dirmi il piano
(Free o Pro): se è Free, fare il primo backup locale con
`SUPABASE_SERVICE_ROLE_KEY='…' node scripts/backup-locale.mjs` seguito da
`node scripts/backup-verifica.mjs <file> --confronta` (istruzioni in
docs/backup.md §4) e ripeterlo prima di ogni migrazione.

---

# Consegna — Cronologia delle modifiche alle prenotazioni (07/09/2026, main) — 🔴 proposta 0042 da applicare

Incarico del 07/09/2026, pezzo 2: registro delle modifiche importanti alle
prenotazioni (camera, date, totale, sconto, pagamenti aggiunti o eliminati,
annullamento, cambio cliente) con quando, cosa, valore prima e dopo; sezione
«Cronologia» in fondo alla scheda prenotazione, solo lettura, nessun
ripristino. Un commit, nessuna migrazione applicata.

- supabase/proposte/0042_cronologia_prenotazioni.BOZZA.sql: tabella
  public.booking_events (booking_id, soggiorno = group_id o id, created_at,
  tipo, prima e dopo in jsonb LEGGIBILE con nomi di camera e cliente, autore
  = auth.uid()); due trigger — bookings after update di room_id, check_in,
  check_out, total_amount, discount_type, discount_value, status, guest_id
  (una riga per campo cambiato; l'annullamento solo quando lo stato DIVENTA
  annullata) e payments after insert/delete (compresi i movimenti scritti
  dalle RPC della 0033). RLS: solo i membri dell'app leggono
  (private.is_app_member); ad authenticated è concesso il SOLO select, quindi
  il client NON può inserire, modificare o cancellare nel registro: scrive
  solo il database. SCELTA DICHIARATA: la traccia nasce dal database e non
  dal client, così ogni scrittura che passa dalle funzioni sicure dell'app
  (lib/scritturaSicura, lib/prenotazioneScritture, lib/cambiaCliente) o dalle
  RPC lascia la riga senza che l'app debba ricordarsene, e nessuna riga può
  essere fabbricata «in chiaro» dal browser.
- lib/cronologiaTrigger.test (PGlite, 5 test): la 0042 VERA letta dal file
  applicata su uno schema minimo — un update di sole note non scrive nulla;
  camera+date+totale+sconto nello stesso update = quattro righe con prima e
  dopo; pagamento aggiunto ed eliminato, annullamento col motivo, cambio
  cliente coi nomi; annullare un'annullata non aggiunge righe; il soggiorno
  segue group_id; grant del solo SELECT e RLS attiva.
- lib/cronologia (puro, 3 test): «5 set 14:20» (anno solo se diverso),
  descrizioni «camera Ambra → Lena», «date 5–7 set → 5–8 set», «totale €160
  → €200», «sconto nessuno → 10 %», «pagamento aggiunto €100 contanti (5 set)»,
  «pagamento eliminato …», «annullata: motivo», «cliente Anna Rossi → Marco
  Bianchi»; righe dalla più recente, col nome della camera del segmento nei
  cambi camera. lib/cronologiaDati.leggiCronologia: tabella assente =
  «registro non acceso» (avviso, mai un errore), altri errori visibili.
- Scheda prenotazione: sezione «CRONOLOGIA» in fondo alla colonna principale
  (dopo i blocchi WhatsApp del telefono), «Nessuna modifica registrata» se
  vuota, AvvisoAzione + Riprova su errore di lettura; si rilegge dopo ogni
  salvataggio riuscito (rilettura della prenotazione) e dopo un acconto.
- Prove: 747 test, tsc, lint dei file toccati (la scheda prenotazione resta ai 28 rilievi già presenti), next build ok; anteprima
  finta 3213 (cinque righe finte sulla prima prenotazione, interruttore
  /finto/senza-cronologia?on=1 per la tabella assente) a 390 e 1280 px.
- Limiti: prima della 0042 non c'è NESSUNA riga (il registro parte da
  quando viene applicata, il passato non si ricostruisce); i pagamenti
  eliminati dalle RPC di ricostruzione non esistono (le RPC solo inseriscono);
  gli update che passano da colonne diverse da quelle elencate (note, orario,
  navetta, telefoni) non entrano nel registro, per scelta.

🔴 AZIONE PER ANIA: incollare supabase/proposte/0042_cronologia_prenotazioni.BOZZA.sql
nel SQL Editor del progetto di produzione e controllare le due select in
fondo (rls_attiva = true, policy = 1, due trigger).

---

# Consegna — Riquadro «Richieste» in Statistiche (07/09/2026, main)

Incarico di Ania (parte 3 di tre; la parte 1, il segnale ⇄ nella striscia
della settimana, era già su main dal 06/09/2026, commit 97825f7). Nuovo
riquadro nella pagina Statistiche per il periodo scelto (stessi selettori e
frecce degli altri riquadri), dopo «Sito e richieste». Un commit, nessuna
migrazione.

- Titolo «Richieste · settembre» (a mese; «2026» ad anno; l'etichetta del
  periodo negli altri casi), sottotitolo «dal sito, da telefono e WhatsApp»
  seguito, se ci sono, da «N ancora in corso, non contate».
- Righe: Arrivate (riga separata da un filo ottone), Diventate prenotazioni
  con la percentuale in ottone, Scadute senza risposta (chiuse per scadenza +
  rifiutate «non ha risposto»), Ha detto di no, Date a un altro, Altro
  motivo (compresi i rifiuti vecchi «Completo/Prezzo/Altro» e senza codice).
- Tabella «Per camera chiesta»: Allegra, Ambra, Amelia, Lena, «Qualsiasi»
  con chiesta / non era libera / prenotata. DEFINIZIONE dichiarata sotto la
  tabella: «non era libera» = è stata inviata una proposta e la camera
  chiesta non compariva fra quelle proposte (soluzione + alternative);
  per «Qualsiasi» vale «—». [R5: il testo a schermo non dice più «perché
  occupata».]
- Due righe finali: «Hanno accettato una camera diversa da quella chiesta:
  N su M» (confermate con camera chiesta precisa la cui soluzione non è tutta
  in quella camera, su tutte le confermate con camera precisa) e «Proposta
  un'alternativa, non hanno risposto o hanno detto no: N» (camera chiesta
  non libera, proposta inviata, esito diverso da confermata).
- Le richieste IN CORSO (in attesa, proposta inviata) non contano in nessun
  numero: la scelta è scritta nel sottotitolo.
- lib/statistiche/richiesteRiquadro (puro, 6 test): giorno locale della
  created_at, conteggi, per camera, camera diversa, alternative; i motivi
  passano da lib/motivoRifiuto (codici nuovi e testi vecchi).
- lib/statisticheDati.leggiRichiesteStat: richieste arrivate nell'intervallo
  letto (un giorno in più per lato), colonne minime; senza proposta_alternative
  (prima della 0031) si ripiega senza la colonna. Campo richieste di
  DatiStatistiche.
- Prove: 739 test, tsc, lint dei file toccati, next build ok; anteprima
  finta 3215 (quattro richieste chiuse aggiunte allo scenario: Olga Ambra→Lena
  confermata, Pia Ambra con proposta Amelia «ha detto di no», Rita Lena «data
  a un altro», Sandro Allegra «non ha risposto») a 390 e 1280 px: 7 arrivate,
  2 prenotazioni 29 %, 2 scadute senza risposta, 1/1/1, Ambra 2 chieste ·
  2 non libere · 1 prenotata, «1 su 1», alternativa non accettata 1.

## Prove dal telefono in 10 minuti — rifiuto con motivo e riquadro Richieste (07/09/2026)
1. Home → striscia della settimana: nei giorni con un cambio camera c'è il
   ⇄ ottone sotto il numero (parte 1, già in produzione).
2. Richieste → crea «Prova Motivo» (2 persone, notti libere, camera Ambra).
3. Sulla riga premi «Rifiuta»: si apre «Perché la rifiuti?» col nome, le
   date e «Ambra»; «Rifiuta» in basso è spento. Tocca «Ha detto di no»: il
   bottone diventa verde pieno e «Rifiuta» si accende. Premi «Rifiuta».
4. Apri «Chiuse» in fondo: la riga dice «Rifiutata da te · ha detto di no ·
   oggi». «Riapri» la riporta in attesa (il motivo resta salvato ma non si
   vede: al prossimo rifiuto lo scegli di nuovo).
5. Rifiutala di nuovo con «Non ha risposto».
6. Statistiche → mese: sotto «Sito e richieste» c'è «Richieste · settembre»
   con Arrivate, «Scadute senza risposta» che conta anche la prova, la
   tabella per camera con Ambra chiesta 1. Le richieste ancora aperte sono
   solo nel sottotitolo («N ancora in corso, non contate»).
7. Alla fine la prova resta in «Chiuse» tre giorni e poi sparisce da sola.

---

# Consegna — Rifiuta con motivo (07/09/2026, main) — 🔴 proposta 0041 da valutare

Incarico di Ania (parte 2 di tre): prima di chiudere una richiesta, una
finestra «Perché la rifiuti?» con quattro bottoni larghi uno sotto l'altro;
il motivo si salva sulla richiesta e la linguetta Chiuse lo dice in parole.
Un commit.

- components/richieste/RifiutaConMotivo: titolo, sottotitolo «Nome Cognome ·
  13–15 set · Ambra» (o «qualsiasi camera»), bottoni «Non ha risposto» / «Ha
  detto di no» / «L'ho data a un altro» / «Altro motivo» (48 px, verde pieno
  quando scelto), sotto «Annulla» e «Rifiuta» verde pieno ATTIVO solo dopo la
  scelta; Escape e velo chiudono. Usata da /richieste (lista) e dalla pagina
  della proposta; il vecchio ConfermaDialog con i chip resta per «Sostituire il
  testo modificato?».
- lib/motivoRifiuto (puro, 4 test): codici non_risposto · detto_no ·
  data_ad_altro · altro, testi dei bottoni, parole per la riga Chiuse,
  normalizzaMotivoRifiuto per i valori vecchi («Non ha più risposto» →
  non_risposto, «date assegnate a altro cliente» del rifiuto in cascata →
  data_ad_altro, Completo/Prezzo/Altro → altro).
- Salvataggio: lib/richiesteDati.rifiutaRichiesta(id, motivo) — il motivo è
  obbligatorio e finisce in richieste.motivo_rifiuto, colonna che ESISTE dalla
  0027 (prima teneva testi liberi). SCELTA DICHIARATA: nessuna colonna nuova,
  perché avrebbe raddoppiato la stessa informazione; la proposta 0041 rende
  stabile la cosa sul database (valori vecchi → codici, trigger che normalizza
  ogni scrittura futura compresa quella della RPC conferma_richiesta, vincolo
  sui quattro codici). Prima della 0041 tutto funziona già.
- Linguetta Chiuse: «Rifiutata da te · ha detto di no · 4 set» (lib/richieste.
  rigaChiusa legge motivo_rifiuto; senza motivo la riga resta com'era). La
  chiusura automatica per scadenza resta «Scaduta, chiusa da sola…».
- Prove: 733 test, tsc, lint dei file toccati, next build ok; anteprima finta
  3214 a 390 e 1280 px con Chrome headless via CDP (scripts/revisioni/
  schermata.mjs, nuovo: il pannello del browser dell'app resta nascosto e i
  confini Suspense non si aprono): finestra con «Rifiuta» spento → scelta →
  attivo → rifiuto salvato (PATCH in memoria) → riga «Rifiutata da te · non
  ha risposto · oggi» nelle Chiuse, e «… · ha detto di no · ieri» sulla
  richiesta finta di Giulia Gallo.
- Statistiche: il conteggio dei motivi dell'imbuto (lib/statistiche/imbuto)
  continua a leggere il valore grezzo; il riquadro «Richieste» della parte 3
  usa i codici normalizzati.

🔴 AZIONE PER ANIA (facoltativa, quando vuoi): incollare
supabase/proposte/0041_motivo_rifiuto.BOZZA.sql nel SQL Editor del progetto
di produzione e controllare le due select in fondo (nessuna riga «fuori dai
codici»).

---

# Consegna — Statistiche, KPI del periodo con l'anno prima (07/09/2026, main)

Incarico del 07/09/2026, pezzo 1: sotto i quattro riquadri una riga di tre
riquadri più piccoli coi valori GIÀ calcolati da lib/statistiche.indiciIntervallo
(stesse definizioni ovunque, nessuna formula nella pagina). Un commit, nessuna
migrazione.

- «Occupazione» (notti vendute ÷ vendibili, in %, con l'anomalia oltre il
  100 % come nel resto), «Tariffa media» (ADR = ricavi camere ÷ notti
  vendute) e «Notti libere» (vendibili − vendute) del periodo scelto (oggi,
  settimana, mese, anno). Cifre con lo stesso carattere di Incassi/Spese/Saldo.
- Sotto ogni numero, in grigio, il confronto con lo STESSO periodo dell'anno
  prima: «+4 punti» / «−1 punto» / «−12 €» / «era 31»; «come l'anno prima»
  se identico; VUOTO (spazio riservato) se l'anno prima non ha nessuna
  prenotazione confermata/completata in quell'intervallo.
- lib/statistiche/confronto (puro, 4 test): spostaAnni (29 febbraio → 28),
  intervalloAnnoPrima, indiciAnnoPrima (null senza dati), confrontoKpi.
- lib/statisticheDati.leggiDatiStatistiche legge in più le prenotazioni
  dell'intervallo un anno prima (colonne minime, a pagine): campo
  prenotazioniAnnoPrima di DatiStatistiche.
- Prove: 729 test, tsc, lint dei file toccati, next build ok; anteprima
  finta 3215 (con due soggiorni dell'anno prima aggiunti allo scenario) a
  390 e 1280 px: «23 % · +17 punti», «€87 · +8 €», «93 · era 113».
- Limite: il confronto usa le camere e i periodi di fuori servizio di oggi
  anche per l'anno prima (in_servizio_dal/fuori_servizio_dal della 0034 li
  rispettano quando ci saranno).

---

# Consegna — Statistiche, periodo «Oggi» (06/09/2026, notte, main)

Richiesta di Ania: nelle Statistiche, soprattutto in «Sito e richieste»,
vedere la situazione aggiornata. Scelta col bottone: periodo «Oggi» accanto a
settimana/mese/anno. Un commit, nessuna migrazione.

- Quarta linguetta «Oggi»: tutto il resoconto (ricavi per soggiorno, incassi,
  spese, saldo, Sito e richieste, provenienze, biancheria recuperata, tabella
  incassi/spese) sul solo giorno scelto; frecce ‹ › di un giorno alla volta,
  etichetta «Oggi · domenica 6 set 2026» (o «sabato 5 set 2026» + «tocca per
  tornare a oggi»); il grafico a barre non compare (una barra sola non dice
  niente), la riga della tabella si chiama «Oggi» (o «5 set»); «Sconti
  concessi» resta solo per mese e anno, come prima.
- lib/siteStats: StatsPeriod con «oggi» (mezzanotte → mezzanotte), 1 test
  nuovo (3 in tutto nel file).
- Prove: 725 test, tsc, lint dei file toccati senza rilievi, next build ok;
  anteprima finta 3215 a 390 px: linguetta, etichetta, freccia indietro,
  sottotitolo di «Sito e richieste», tabella senza grafico.
- Limite: la finta non ha eventi del sito di oggi, quindi i numeri visti in
  anteprima sono zeri; la logica è coperta dal test.

---

# Consegna — Iniziali maiuscole nei dati del cliente (06/09/2026, sera, main)

Richiesta di Ania: «quando inserisco dati cliente da qualsiasi parte nel
gestionale voglio che inizino sempre con la maiuscola anche se non lo faccio
io». Un commit, nessuna migrazione.

- lib/maiuscole (pure, 3 test): conIniziali / conInizialiONull — la prima
  lettera di ogni parola (anche dopo trattino e apostrofo) diventa maiuscola,
  il resto resta come scritto («liliana micali» → «Liliana Micali», «arturo
  d'iorio» → «Arturo D'Iorio», «McDonald» e «LILIANA» intatti, accenti e
  lettere polacche ok), spazi in più tolti.
- Applicata AL SALVATAGGIO in tutti i punti dove entra un nome: nuova
  prenotazione (cliente nuovo, cliente esistente, nome del contatto 2),
  scheda prenotazione in modifica (nome sulla prenotazione, nome della scheda
  cliente quando è vuota, contatti 2 e 3), scheda cliente, nuovo cliente,
  «Cambia cliente» (nome e cognome), nuova/modifica richiesta (nome e
  cognome), richieste dal sito (nome e cognome scritti dall'ospite).
- I dati già salvati NON vengono toccati: vale da ora in poi.
- Prove: `npm test` 724/724, tsc pulito, lint del delta pulito, `next build` ok.

---

# Consegna — «Cambia cliente» nella scheda prenotazione (06/09/2026, sera, main)

Incarico di Ania. Il caso: prenotazione inserita a nome della struttura che
manda l'ospite («Nida») perché al telefono mancano i dati della persona;
all'arrivo QUELLA SOLA prenotazione passa a un cliente vero. Base `ded6fff`,
due commit, NESSUNA migrazione (solo colonne già in produzione).

## FATTO E DIMOSTRATO

- A `35d86b3` — lib/cambiaCliente (pure, 15 test) + lib/cambiaClienteDati.
  Si scrive SOLO bookings.guest_id (+ guest_name azzerato, così vale il nome
  del cliente nuovo e non scatta l'avviso rosso «numero già usato»); il
  cliente di partenza non entra in nessuna scrittura; date, prezzo, note,
  letti, persone per notte, pagamenti restano identici (test «il resto è
  identico»). Con un cambio camera passano tutti i segmenti del soggiorno
  (group_id), altrimenti resterebbe diviso fra due clienti. Salvataggio via
  scritturaSicura + controllo «almeno una riga toccata». Cliente nuovo:
  «Nome Cognome» (prima il nome), telefono a cifre col 39 come nel resto del
  gestionale, telefono già in archivio → «Questo telefono è già di un cliente
  in archivio: cercalo fra i clienti esistenti» (guests.phone è UNIQUE).
  Provenienza proposta: se il cliente di partenza è una struttura
  («Altra struttura → Nida», o un nome noto) → «Altra struttura → Nida».
- B `2b5691e` — scheda prenotazione: «Cambia cliente» sotto «✏️ Modifica»
  accanto al nome (non sulle annullate). Finestra: «Cliente esistente»
  (ricerca nome o telefono, il cliente attuale mai in lista) | «Nuovo cliente»
  (nome, cognome, telefono, «Come ci ha trovato» coi chip soliti). Avvisi
  non bloccanti: conferma già inviata (proposta_inviata_at della richiesta
  d'origine), N movimenti di pagamento, cambio camera. A scrittura riuscita:
  nome, telefono, provenienza e altre prenotazioni si aggiornano, toast
  «Prenotazione passata a …». Errore → «Non salvato, riprova» con la scheda
  ferma su Nida; se il cliente nuovo era già stato creato resta selezionato e
  il secondo tentativo NON lo crea due volte (visto: un solo POST guests).
- DOCUMENTI (CONFERMATO da Ania il 06/09/2026: «i documenti appartengono
  alla persona, non alla struttura»): i documenti (0032) stanno sul
  CLIENTE, non sulla prenotazione. Stamattina Ania ha caricato 2 carte
  d'identità sulla scheda «Nida»: senza spostarle resterebbero su Nida. La
  finestra propone, già spuntato, «Sposta anche i 2 documenti caricati su
  Nida al cliente nuovo» (cambia solo documenti_cliente.guest_id, il file
  resta dov'è; le anteprime leggono `percorso`). Se lo spostamento fallisce
  dopo il cambio riuscito: «Prenotazione passata al cliente nuovo, ma i
  documenti non sono stati spostati» con «Riprova» o «Lascia i documenti dove sono».
- Prove: `npm test` 721/721, tsc pulito, lint del delta pulito, `next build`
  ok. UI sull'anteprima finta `gestionale-bnb-anteprima-prenotazioni-finta`
  (3213): scenario Nida in Amelia 6–7 set con 2 documenti; cambio su cliente
  esistente (PATCH bookings con soli guest_id/guest_name sul group_id, PATCH
  documenti), cliente nuovo con provenienza già su Nida, errore simulato
  (`/finto/errore-cambio-cliente?on=1`) → «Non salvato, riprova», telefono
  390 px con la finestra sopra la barra bassa.

## LA PRENOTAZIONE «NIDA» DI OGGI IN AMELIA (6–7 set, letta in produzione)

Sì, si sistema dal tasto nuovo: cliente «Nida» (tel. 393803826118, «Altra
struttura → Nida»), nome «Nida» anche sulla riga (guest_name), nessun
pagamento, nessuna nota, nessuna richiesta d'origine, 2 documenti caricati
oggi alle 10:48 sulla scheda Nida. Percorso: scheda → «Cambia cliente» →
«Nuovo cliente» (nome, cognome, telefono; provenienza già «Altra struttura →
Nida») → lasciare spuntato lo spostamento dei 2 documenti → «Crea e passa la
prenotazione». Nida resta con le sue altre prenotazioni (8–9 set in
Allegra, luglio, maggio). Lo stesso vale per l'8–9 set in Allegra quando arriva l'ospite.

---

# Come provare la sezione Richieste dal telefono in 10 minuti (04/09/2026)

Tutto sul gestionale vero, con richieste di prova che alla fine si rifiutano.
Nessun messaggio parte se non tocchi «Apri WhatsApp e invia».

1. Richieste → «+ Nuova richiesta»: nome Candida, cognome Prova, arrivo 17
   settembre, partenza 21, Persone 2. Nella striscia tocca 18, 19 e 20 finché
   mostrano 3 (sotto: «17: 2 · 18–20: 3»). Camera: Ambra. Salva.
2. Su Candida Prova tocca «Invia proposta», poi il chip «All'arrivo». Il testo
   deve essere IDENTICO a questo (confronta parola per parola):
   «Gentile Candida,» a capo «grazie per aver pensato a Casa Ania per il suo
   soggiorno.» — riga vuota — «Ho verificato le date che mi ha indicato. Dal 17
   al 21 settembre è disponibile soltanto Ambra, una camera matrimoniale con il
   bagno in camera. Per le notti in cui sarete in tre posso aggiungere un letto
   in più.» — riga vuota — «Il prezzo per le 4 notti è di 350 €. La prima notte
   in due a 80 €, le altre tre notti in tre a 90 € a notte.» — riga vuota —
   «Qui può vedere le foto e i dettagli della camera:
   casaaniarozzano.it/camere/ambra» — riga vuota — «Il pagamento avviene
   all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti
   oppure con bonifico istantaneo.» — riga vuota — «Se desidera confermare la
   camera, la prego di farmelo sapere entro 3 ore da questo messaggio.
   Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.» —
   riga vuota — «Resto a disposizione per qualsiasi informazione.» — riga vuota
   — «Grazie mille,» a capo «Ania – Casa Ania».
3. Tocca «Modifica la richiesta», Camera «Qualsiasi», Salva → «Invia
   proposta»: il testo dice «ho due camere libere che posso proporle:» con le
   righe «– Allegra, …» e «– Ambra, …» e «Se desidera confermare una delle
   camere». Sotto il caso c'è il riquadro «Altre camere» con i motivi (es.
   «Amelia senza posto per 3 (18–20 set)»).
4. Tocca «Scelgo io»: 4 caselle. Tocca il 17 finché mostra «Amelia»; tocca il
   20 finché mostra «Lena» (se Lena è libera). Sotto: «17: Amelia · 18–19:
   Ambra · 20: Lena» e il totale. Il testo diventa il cambio di camera con
   «qualche cambio di camera», la riga di Lena dice «una tripla con il bagno
   privato appena fuori dalla porta, chiuso a chiave» e poi «Il cambio di
   camera lo faccio io al mattino, non deve pensare a nulla.»
5. Tieni premuta la casella del 17: «Prezzo della notte», scrivi 60, «Applica».
   La casella prende il bordo ottone, compare «prezzo modificato», il totale
   scende di 15 € e la riga di Amelia dice «60 € a notte». «Ripristina
   tariffa» rimette 75 €.
6. «Testo + immagine»: nell'immagine gli importi sono scritti come nel testo
   («80 €», non «80,00 €»).
7. Chiudi senza inviare. Nella lista tocca «Rifiuta» su Candida Prova, motivo
   «Altro». Fine.

---

# Consegna — «Opzione di 3 ore» nelle Richieste (06/09/2026, main) — 🔴 migrazione 0040 da applicare

Incarico di Ania. Prima: il timer «scade tra / scaduta» era solo un'indicazione
e la disponibilità per una nuova proposta si calcolava solo sulle prenotazioni
confermate (rischio di due proposte sulla stessa camera nelle stesse notti).
Due scelte prese con Ania: la notifica di scadenza parte DAL DATABASE (pg_cron
+ pg_net ogni 5 minuti, perché i cron di Vercel gratuiti girano una volta al
giorno) e l'«Archivio» diventa la linguetta «Chiuse».

- A `9617ca0` — supabase/migrations/0040_opzione_tre_ore.sql: stato «chiusa»
  nel vincolo, colonne chiusura_motivo ('scaduta' | 'rifiutata') e
  scadenza_notificata_at, indice, estensioni pg_cron e pg_net, job
  «richieste-scadenze» ogni 5 minuti che chiama POST
  /api/richieste/scadenze con «Authorization: Bearer CRON_SECRET».
  lib/opzioni (pure, 4 test): opzioniAttive/opzioniScadute dalle richieste
  con proposta inviata (tutte le camere della soluzione + alternative, senza
  doppioni), occupantiDaOpzioni (le opzioni viste come confermate),
  notaOpzioni (blocco con le camere libere / «Nessuna camera è proponibile» /
  opzione scaduta), nottiInOpzione, oraRoma.
- B `8622efa` — pagina della proposta: legge le altre richieste con proposta
  inviata; bozza, «Altre camere», alternativa Amelia e «Scelgo io» si calcolano
  su confermate + opzioni attive (la camera in opzione non compare mai nelle
  soluzioni e nelle notti di «Scelgo io»); nota ottone (bordo sinistro
  #A9884E, sfondo #F3ECD8) «Ambra è in opzione fino alle 16:40 per Mario
  Rossi. Libere per tutto il periodo: Allegra.» oppure «Ambra era in opzione
  per Mario Rossi, scaduta alle 16:40. Puoi proporla.»; nelle «Altre camere»
  il motivo «in opzione fino alle … per …» in ottone. Le richieste solo «in
  attesa» non bloccano nulla.
- C `2629e7c` — app/api/richieste/scadenze (GET/POST, segreto dei cron):
  proposte scadute da più di 3 ore e mai notificate → Pushover con suono
  «siren» e priorità 2 (ripete ogni 60 s per un'ora finché Ania conferma),
  testo «Proposta scaduta — Mario Rossi / Ambra 17–20 set. Controlla se ha
  risposto.», poi scadenza_notificata_at (una sola volta); scadute da più di
  24 ore → stato «chiusa», motivo «scaduta». lib/richiesteScadenze (pure, 3
  test), lib/pushover con opzioni. Rifiuta → «chiusa» con motivo «rifiutata»
  (prima della 0040 ripiega su «rifiutata»); statistiche (imbuto) contano le
  rifiutate in entrambe le forme. Conferma resta sull'RPC atomica 0027.
- D `006ed37` — linguetta «Chiuse» al posto dell'Archivio: ultimi 3 giorni,
  riga di stato ottone «Scaduta, chiusa da sola ieri alle 16:40» / grigia
  «Rifiutata da te · 4 set» / verde «Confermata · …», «Riapri» (torna in
  attesa: via chiusura, proposta inviata, notifica), riga «Dopo 3 giorni
  spariscono da sole»; attesa del test dei 90 giorni aggiornata a 3.
- E (questo) — schede; anteprima finta con Marta (proposta inviata da 1 h su
  Allegra) e Nora (stesse notti → blocco), Dario scaduto ed Elisa (nota
  «era in opzione»), Ugo (chiusa da sola) e Vera (rifiutata) nelle Chiuse,
  PATCH sulle richieste in memoria per Riapri.
- F `31b3fd7` (seconda chat, 06/09 ore 16) — .github/workflows/richieste-scadenze.yml:
  lo STESSO controllo ogni 5 minuti anche da GitHub Actions (repo pubblico,
  gratis, minuti 2-7-12… per non coincidere col job pg_cron), POST alla route
  con «Authorization: Bearer» dal segreto CRON_SECRET del repo; la route è
  idempotente, i due controlli convivono. Così la notifica funziona anche se
  Ania applica della 0040 solo la parte 1 (colonne), senza pg_cron/pg_net.
  Primo lancio a mano: HTTP 401 → il CRON_SECRET di .env.local NON è quello
  di Vercel: il segreto del repo va aggiornato (azione qui sotto).
Prove: lib 706 test, TypeScript OK, lint del delta 0→0, `next build` OK;
anteprima a 390 px: nota di blocco e «Altre camere» in ottone su Nora, nota
«era in opzione» su Elisa, route 401 senza segreto.
Limiti: la notifica e la chiusura automatica partono solo dopo la 0040 (senza
il job non c'è nessun controllo); la route non è stata provata con Pushover
vero (avrebbe mandato una notifica sul telefono di Ania); il testo della
proposta non cambia (testi bloccati intatti).

🔴 AZIONE PER ANIA — migrazione 0040, in due passi:
1. Vercel → progetto gestionale-bnb → Settings → Environment Variables →
   copia il valore di CRON_SECRET.
2. Copia il file, incollalo nel SQL Editor di Supabase (produzione),
   sostituisci INCOLLA_QUI_IL_CRON_SECRET con il valore copiato, Run;
   in fondo devono comparire le due colonne e il job «richieste-scadenze»
   con active = true:
   cat ~/gestionale-bnb/supabase/migrations/0040_opzione_tre_ore.sql | pbcopy
3. (pezzo F) GitHub → repo CasaAnia/gestionale-bnb → Settings → Secrets and
   variables → Actions → CRON_SECRET → Update: incolla lo stesso valore di
   Vercel. Poi Actions → «Richieste – scadenze delle proposte» → Run workflow:
   deve finire verde con «HTTP 200». Finché resta 401 il controllo da GitHub
   non fa nulla (e non fa danni).
   ESITO 06/09 ore 17: 0040 applicata, job rifatto con un segreto NUOVO (quello
   vecchio su Vercel non era rileggibile), Vercel aggiornato e ripubblicato;
   workflow GitHub disattivato finché il segreto del repo non era aggiornato;
   ore 20:41 Ania ha aggiornato il segreto (pagina aperta da Claude in Chrome,
   valore scritto da lei), workflow riattivato e provato: HTTP 200.

## Prove dal telefono in 10 minuti — opzione di 3 ore
1. Crea due richieste di prova con le stesse notti (es. 17–20 del mese prossimo).
2. Sulla prima: «Invia proposta» → WhatsApp → «Sì, inviata». In Lista compare
   il timer «scade tra 3 h».
3. Sulla seconda: «Invia proposta». Deve comparire la nota ottone «X è in
   opzione fino alle … per <nome della prima>. Libere per tutto il periodo:
   …»; la camera proposta alla prima non è mai nella bozza; in «Altre
   camere» ha il motivo «in opzione fino alle …»; con «Scelgo io» quella
   camera non si può assegnare su quelle notti.
4. Scadenza simulata: sulla prima richiesta, con «Modifica» non serve; basta
   aspettare le 3 ore oppure (solo per la prova) cambiare a mano
   proposta_inviata_at nel database a 4 ore fa. Poi sulla seconda la nota
   diventa «X era in opzione per …, scaduta alle …. Puoi proporla.» e la camera
   torna proponibile; entro 5 minuti arriva la notifica Pushover «Proposta
   scaduta — …» (suono diverso, ripete finché non la confermi).
5. Rifiuta la prima: sparisce dalle aperte e compare in «Chiuse» con
   «Rifiutata da te · oggi»; «Riapri» la riporta in attesa.
6. Dopo 24 ore dalla scadenza la richiesta scaduta passa da sola in «Chiuse»
   con «Scaduta, chiusa da sola … alle …»; dopo 3 giorni sparisce dalla
   linguetta (resta nel database).
7. Alla fine rifiuta o cancella le richieste di prova.

---

# Consegna — Ritocchi del pomeriggio del 06/09/2026 (main), scelte di Ania

- Caratteri: numeri della Home, titoli di pagina (30 px), «N cose da
  controllare» e titoli in riga (22 px), data in cima ai calendari e nomi
  nelle liste tornano in GEORGIA (`--font-serif` = Georgia; `.ed-titolo`
  e `.ed-titolo-medio` in Georgia; `.numero-classico`, `.titolo-classico`).
  Il Fraunces leggero «dava fastidio»; resta solo dove esplicito (finestra
  di conferma, scheda del recupero biancheria). Commit 4bc0cbc, ff70b86,
  d183cd4.
- Cambio camera in Arrivi, Calendario e calendario delle Richieste
  (lib/roomChanges): via il simbolo ⇄ dalle barre; il pezzetto tagliato ha
  una striscia colorata di 5 px, stessa tinta per le due metà dello stesso
  soggiorno (`coloriCatene`: ottone, verde scuro, ruggine, blu ardesia, in
  ordine di data del primo segmento, poi si ricomincia; nessuna legenda,
  per volere di Ania); in Arrivi e Calendario il lato tagliato ha gli
  angoli arrotondati (`percorsoBarraArrotondata`, clip-path path() in
  pixel; nelle Richieste le colonne sono in percentuale: taglio dritto);
  sul lato sinistro tagliato SOLO i simboli (⭐ 🧾 🛏 🌐) si spostano a
  destra di 14 px, il nome resta. Test in lib/coloriCambio.test.ts.
  Commit 90d5ffd, 69b4295, a490f57, bd573bf, 6c6a4be, 60bfc03.
- Striscia della settimana in Home: segnale ⇄ dei cambi camera (incarico
  del 06/09/2026): lib/numeriOggi.cambiCameraPerGiorno (catene di
  lib/roomChanges, conteggio per giorno di arrivo nella nuova camera) e
  simboliCambi (1 → sotto il numero, 2 → sotto e sopra, 3+ → anche al
  centro); GiornoStriscia ha `cambi`; ottone #A9884E, grassetto, 13 px;
  spazio sopra e sotto sempre riservato (caselle uguali, numeri allineati);
  i numeri non cambiano. Test con 0/1/2/3 cambi, arrivo di un altro ospite
  lo stesso giorno e annullate. Un commit.
- Prova WhatsApp (dalle 13:37 alle 22:00): lettura di WhatsApp Desktop con
  computer-use ogni 30 minuti, solo lettura; stile e osservazioni in
  memoria (feedback_whatsapp_stile_ania).

---

# Consegna — Stile editoriale «B» (06/09/2026, main)

Ania ha chiesto di «lucidare» il gestionale (esclusivo, all'avanguardia,
expensive). Metodo della skill «ricerca ispirazione»: ricerca su PMS di
fascia alta e app «quiet luxury» (restrizione: uno-due caratteri, spazio,
righe sottili, numeri grandi in serif, un solo accento), quattro mockup
(A lucidatura fine, B editoriale, C verde profondo, D = A + titoli di B) e
un confronto A/B sulla pagina Pulizie; Ania ha scelto **B · Editoriale**.

Vocabolario grafico (app/globals.css, sezione «STILE EDITORIALE»): tutti i
serif sono Fraunces (`--font-serif`, pesi 300–600); classi `ed-titolo`
(32/36 px, peso 300), `ed-titolo-medio`, `ed-sotto` (maiuscoletto
ottone), `ed-sezione` (etichetta con il filo che continua), `ed-riga` /
`ed-riga-ottone` / `ed-lista` (righe separate da fili crema, la prima
ottone), `ed-numero` / `ed-numero-medio` (Fraunces 300, cifre allineate),
`ed-pillola` / `-contorno` / `-tenue`, `ed-badge` (solo contorno),
`ed-campo` (trasparente col filo), `ed-riquadro` (solo griglie e finestre).
Nessun colore nuovo. Commit, uno per pezzo:
1. `02ffbf0` fondamenta (globals, layout, barra alta senza filo);
2. `00800b8` Home (titolo su due righe, data in ottone, tre numeri fra fili
   ottone, striscia senza riquadro con oggi sottolineato, Da controllare a
   righe con pillole, «Il mese» e «Vai a» a righe senza emoji);
3. `306b6ae` Pulizie (+ statistiche pulizie);
4. `e26dc5d` Richieste, Calendario, Arrivi (griglie in `ed-riquadro`,
   ricerca trasparente con icona lucide, chip col solo contorno);
5. `9bd0737` Clienti, scheda cliente, nuovo cliente, Prenotazioni, scheda
   prenotazione, Nuova;
6. `cee0082` Statistiche, Impostazioni, richieste (scheda, proposta,
   modifica, nuova), componenti condivisi; lista Prenotazioni a righe;
   attesa del test di layout aggiornata (campi `ed-campo` al posto di
   bg-white: la protezione min-w-0 + appearance-none resta);
7. (questo) il modulo Spese resta com'era (grafica propria).
Prove: anteprima finta a 390 px (Home intera, Pulizie, Richieste, Arrivi,
Calendario, Clienti, Prenotazioni, scheda prenotazione, Nuova, Statistiche,
Impostazioni) e a 1280 px (Home, Pulizie, Richieste); suite 694/694,
TypeScript OK, lint del delta invariato file per file, `next build` OK.
Nota tecnica: dopo aver toccato globals.css il `next dev` dell'anteprima
serviva il CSS vecchio (cache di Turbopack): risolto con `rm -rf .next` e
riavvio.
Completamento (06/09/2026, sera, be5d61b e 46716a4): anche Spese (B&B e
Famiglia) — la Card dei mattoni è una riga col filo crema, tema su crema/verde
scuro/pietra/ottone, pillole, terracotta solo per i soldi — e la pagina di
accesso (senza riquadro); pannello richieste dal Mac e finestra di conferma a
filo crema. Restano bianchi i fogli sovrapposti (arrivi, documenti, conferma
WhatsApp) per stacco; l'orizzontale del telefono non riprovato.

---

# Consegna — Recupero biancheria (06/09/2026, main) — migrazione 0039 APPLICATA da Ania il 06/09/2026 (tabella con 15 colonne, anon bloccato: verificato)

Incarico di Ania: quando segna una camera pulita può annotare, solo se
serve, i pezzi di biancheria che l'ospite NON ha usato e ha recuperato
puliti (mai il set completo). Quattro commit, suite verde a ogni passo.

1. `3d356c8` — supabase/migrations/0039_biancheria_recuperata.sql (tabella
   biancheria_recuperata: cleaning_id UNICO → cleanings, room_id, booking_id,
   data, otto contatori con default 0 e check sui massimi — federe 4,
   lenzuolo sotto/sopra 1, telo doccia 2, asciugamano viso/mani 2, tappetino
   doccia 1, tappeto bagno 1 —, RLS coi membri dell'app come la 0021);
   lib/biancheria pura (VOCI in due gruppi, tocca = +1 fino al massimo poi 0,
   normalizza, riassunto «Recuperato: 2 federe, telo doccia» con i plurali,
   testoTotale, sommaPerVoce/nelPeriodo, tabellaBiancheriaAssente) — 7 test.
2. `9ba8fae` — components/SchedaRecupero («Camera · non usato e recuperato»,
   sottotitolo, gruppi LENZUOLA / ASCIUGAMANI in ottone, chip a pillola alti
   40 px: verde pieno + pallino ottone col numero quando > 0, totale a
   sinistra, «Salva» a destra, avviso «Non salvato, riprova» + Riprova nella
   scheda); lib/biancheriaDati (leggiRecuperi per periodo,
   leggiRecuperiDellePulizie, salvaRecupero = UN upsert su cleaning_id via
   lib/scritturaSicura; tabella assente in lettura = nessuna riga).
3. `64c9510` — «Pulita» (pieno #2D6A4F) e «Pulita + recuperato» (contorno)
   in Home «Da controllare» (voce pulizia: la voce porta con sé la pulizia da
   segnare — campo `pulizia` di lib/daControllare, test —; scrive in
   cleanings via lib/pulizieScritture con esito controllato, poi Home e
   striscia si rileggono — lib/numeriOggiDati.ricaricaNumeriOggiOvunque —;
   «Apri pulizie» resta come ghost) e nella pagina Pulizie al posto di
   «✓ Fatta» (data «Fatta il», Rimanda e Salta invariati); nel registro
   «Ultime pulizie» la riga mostra «Recuperato: …» in piccolo, tocco =
   riapre la scheda per correggere. La pulizia resta segnata anche se il
   recupero non si salva. Finto Supabase: cleanings POST e biancheria
   in memoria, GET /finto/senza-biancheria?on=1 → PGRST205.
4. (questo) — Statistiche: riquadro «Biancheria recuperata» sotto Strutture,
   totali per voce nel periodo scelto (stessa finestra di lettura), «Niente
   recuperato in questo periodo», avviso 0039 se la tabella manca.

Provato sull'anteprima finta a 390 px (DOM + schermate): Home → «Pulita +
recuperato» → la voce sparisce, la striscia di oggi passa a «✓», la scheda
si apre; Pulizie → «Pulita + recuperato» su Amelia → scheda, Federa ×2 e
Telo doccia → «3 pezzi recuperati» → Salva → nel registro «Recuperato: 2
federe, telo doccia», tocco → scheda con i valori; tabella spenta → «Non
salvato, riprova» + Riprova, riassunto invariato; tabella riaccesa →
Riprova salva. Statistiche: federe 2, teli doccia 1, asciugamani viso 1.
Suite 694/694, TypeScript OK, lint del delta 0→0 (Pulizie 13→13),
`next build` OK.

Limiti: la striscia della settimana in Home resta a numeri (niente tasti
per camera: non ha righe per camera); i tasti stanno nella voce «pulizia
non registrata» di Da controllare. Il recupero si aggiunge solo dalla
scheda aperta con «Pulita + recuperato» o riaprendo un riassunto esistente.

🔴 AZIONE PER ANIA — applicare la 0039 (SQL Editor di Supabase, progetto di
produzione), poi controllare la select in fondo (rls_attiva = true, policy = 1).
Le 0035, 0037 e 0038 sono già applicate (verificato il 06/09/2026):
  cat supabase/migrations/0039_biancheria_recuperata.sql | pbcopy

---

# Consegna — Home «Da controllare»: pulizie mai con un giorno di anticipo (06/09/2026, main)

- Regola di Ania (bottoni): «non li voglio vedere con anticipo di un giorno:
  nella stessa giornata, oppure la giornata dopo se non sono state
  registrate» + «anche partenza senza arrivo». Sui dati veri vedeva DUE
  pulizie «urgenti» per gli arrivi di domani (Amelia e Ambra).
- lib/daControllare.eccezioniPulizie, due casi, tutti e due di OGGI e alta:
  1. arrivo di oggi in una camera con pulizia prevista non segnata (come
     prima, ma SOLO oggi: via «arrivo domani» e l'urgenza «normale»);
  2. partenza (o cambio camera: la camera lasciata va pulita) di IERI con
     pulizia non registrata e nessun arrivo oggi in quella camera —
     «Camera · partenza di ieri di Nome», motivo «La pulizia dopo la
     partenza di ieri non risulta registrata», «Apri pulizie» su oggi.
     Non compare se segnata fatta/saltata, rimandata a una data futura
     (scelta di Ania) o automatica (arrivo entro il giorno dopo).
- Attese aggiornate (regola cambiata, commentate nel test): la voce
  «arrivo domani» sparisce dai due test del 08/09; la partenza del 14 con
  arrivo il 16 ora compare come «partenza di ieri». Test nuovo con 9
  prenotazioni (ieri non segnata / segnata / rimandata / automatica /
  l'altro ieri / parte oggi / cambio camera ieri).
- Anteprima finta: «Partita Ieri» (Amelia, partita ieri, mai registrata;
  Anna ora arriva domani così Amelia è vuota oggi) → una sola voce
  «Amelia · partenza di ieri di Partita Ieri»; nessuna voce per domani;
  striscia di oggi «1». Provato a 390 px.
- Suite 686/686, TypeScript OK, lint del delta 0→0, `next build` OK.

---

# Consegna — Home «Da controllare»: i cambi camera non sono arrivi (06/09/2026, main)

- Richiesta di Ania: «quando c'è cambio stanza non mi compare negli arrivi
  in Home, non è urgente». Sui dati veri: Rosa Macauda, Ambra 1–7 set poi
  Amelia 7–11 con DUE prenotazioni non collegate (group_id diversi): la
  regola vecchia (stesso group_id) la mostrava come «arrivo di domani senza
  orario».
- lib/daControllare.eCambioCamera: è cambio camera anche una prenotazione
  separata della STESSA PERSONA (stesso cliente, telefono o nome —
  lib/clienteCheTorna.stessaPersona) che finisce il giorno dell'arrivo;
  eccezioniArrivi la esclude. Chi è partito ieri e torna domani resta un
  arrivo vero. Test nuovo (Rosa per cliente, Nida per telefono, omonimo per
  nome, arrivo vero, ritorno dopo un giorno); i telefoni finti del test ora
  sono unici per prenotazione (prima erano tutti uguali), nessun assert
  toccato.
- Anteprima finta: «Parte Oggi» ha una seconda prenotazione in Lena da oggi
  senza orario → NON compare tra gli arrivi senza orario (restano 3);
  in Pulizie non registrate compare ancora, perché la camera nuova va
  comunque preparata. Provato a 390 px.
- Suite 685/685, TypeScript OK, lint del delta 0→0, `next build` OK.

---

# Consegna — Home «Da controllare»: navetta confermata senza orario (06/09/2026, main)

- Richiesta di Ania: «vuole la navetta ma non ho ancora il suo orario»,
  da capire col colore senza aggiungere altro. Scelta (bottoni): la parola
  «navetta» in ottone e grassetto in coda al motivo.
- lib/daControllare.eccezioniArrivi: campo `navetta: true` quando
  bookings.shuttle = 'si' (mai per «no» o «da definire»); il motivo resta
  «Arrivo di oggi senza orario». components/DaControllare: «… · navetta»
  con la parola in ottone (text-brass, stesso colore dell'ombra in Arrivi).
  PrenotazioneDC ha `shuttle` (le prenotazioni si leggono con `*`).
- Test nuovo (4 prenotazioni: sì / no / da definire / con orario): solo la
  prima ha navetta=true; quella con orario non compare. Anteprima finta a
  390 px: «Arriva Oggi · Allegra · oggi — Arrivo di oggi senza orario ·
  navetta», le altre voci senza.
- Suite 684/684, TypeScript OK, lint del delta 0→0, `next build` OK.

---

# Consegna — Arrivi: navetta come ombra ottone sotto l'orario (06/09/2026, main)

- Segnalazione di Ania: nella griglia Arrivi il 🚌 stava DOPO il nome e nella
  casella da una notte (una sola colonna) restava nascosto dal taglio della
  barra. Provate quattro varianti sull'anteprima finta (🚌 dentro l'orario,
  seconda riga, cornice ottone, orario pieno ottone, ombra ottone): scelta
  l'OMBRA OTTONE sotto il riquadro dell'orario, proposta da lei.
- app/arrivi/page.tsx: navetta «sì» = `boxShadow` ottone (#A9884E, 3 px,
  lib/navetta.ombraNavetta / OMBRA_NAVETTA) sul riquadro dell'orario, anche
  quando l'orario manca («?»); niente sul riquadro «⇄» del cambio camera;
  «no» e «da definire» non mostrano nulla, come prima. Tolto il 🚌 dopo il
  nome (unico segno = ombra). Pannello con «🚌 Navetta», scheda cliente e
  promemoria invariati. Test nuovo in lib/navetta.test.ts (5 casi).
- Anteprima finta: «Arriva Oggi» (una notte, Allegra) e Paola con navetta.
  Verificato nel DOM a 390 px: ombra rgb(169,136,78) 0 3px sulla barra da
  56 px e su quella da 116 px, nessuna ombra sulle altre né sul «⇄».
- Suite 683/683, TypeScript OK, lint del delta invariato, `next build` OK.

---

# Consegna — «Da controllare», arrivo senza orario anche OGGI (06/09/2026, main)

- Segnalazione di Ania: la voce di Arturo (arrivo senza orario) è sparita
  dalla Home. CAUSA: la regola copriva solo gli arrivi di DOMANI; il giorno
  dell'arrivo la voce usciva. Sui dati veri: Arturo D'Iorio, Allegra, arrivo
  06/09, orario vuoto, confermato.
- lib/daControllare.eccezioniArrivi: ora copre OGGI e DOMANI; quelli di oggi
  vengono prima; titolo «… · oggi», motivo «Arrivo di oggi senza orario»,
  stessi bottoni (Chiedi orario · Apri chat · Apri arrivo), urgenza alta;
  riga «tutto a posto» con «Arrivi di oggi e domani». Test nuovo (caso
  Arturo) e attese aggiornate dove la regola è cambiata. Anteprima a 390 px:
  «Arriva Oggi · Allegra · oggi» prima di quelli di domani.
- Suite 682/682, TypeScript OK, lint 0 rilievi, `next build` OK.

---

# Consegna — Scheda cliente: ricevuta separata dalla valutazione, storico apribile (08/09/2026, sera, main)

Base `d836d16`. Un commit per pezzo. Bozza SQL 0038 da applicare a mano; prima
della migrazione tutto funziona come oggi (il gestionale legge e scrive anche la
forma vecchia, «vuole_ricevuta» come voce della valutazione).

## FATTO

- Pezzo 1 `2fae31f` — dati. Bozza `supabase/proposte/0038_ricevuta_separata.BOZZA.sql`:
  guests.vuole_ricevuta (default false); migrazione: chi aveva la voce
  «Vuole ricevuta» passa a ricevuta = sì e valutazione «normale» (le tre voci
  restano Ottimo / Normale / Problematico); voce tolta dai valori ammessi.
  lib/valutazione (3 test): valutazioneDi (tre voci; la voce vecchia vale
  normale), vuoleRicevuta (colonna nuova O voce vecchia), migraValutazione
  (stessa regola della SQL), payloadValutazione (dopo la 0038 le due colonne;
  prima la forma vecchia: rating = 'vuole_ricevuta' con la ricevuta sì).
- Pezzo 2 `5666003` + ``028cb47`` — dove si vede, tutto derivato dal cliente:
  components/CampoValutazione (interruttore «Vuole ricevuta» SOPRA la
  valutazione a tre voci: non si escludono più) nella scheda cliente in
  modifica, nel nuovo cliente e nella nuova prenotazione (inserimento con la
  colonna nuova, ripiego sulla forma vecchia se manca); etichetta «Ricevuta»
  accanto al nome (stile di «Già stato da noi») nella nuova richiesta e nella
  nuova prenotazione appena il cliente è riconosciuto dal telefono, nella
  scheda prenotazione accanto al nome, nell'elenco clienti e nella finestra
  dell'orario degli Arrivi; badge «R» sulle barre di Calendario e Arrivi come
  il ⇄ del cambio camera (il 🧾 sotto il nome resta: nulla smette di
  mostrarla); Calendario e Arrivi leggono il cliente intero (guests(*)).
- Pezzo 3 `58e4c76` — storico della scheda cliente: una riga per soggiorno
  (lib/storicoCliente.righeStorico, 2 test: cambio camera = riga sola con
  «Ambra → Lena», totale e camere dai segmenti validi, dal più recente),
  ogni riga apre la scheda della prenotazione (?da=cliente&cliente=<id>) e
  «← Indietro» torna al cliente (indietro vero, o il cliente come riserva
  con un link diretto).
- Anteprima a 390 e 1280 px (clienti con ricevuta e valutazione nel finto):
  scheda di Lucia con «⭐ Ottimo» e «🧾 Vuole ricevuta» in vista, in modifica
  l'interruttore sopra la valutazione; storico «Ambra → Lena · cambio
  camera» → scheda prenotazione con «Ricevuta» accanto al nome → «← Indietro»
  → cliente; elenco clienti con «Ricevuta» su Giulio, Lucia, Anna; Calendario
  e Arrivi con «R» sulle barre (Anna, Giulio, Lucia) e «Ricevuta» nella
  finestra dell'orario.
- Suite 681/681, TypeScript OK, lint dei file toccati senza rilievi nuovi (14
  file confrontati con la base, tutti uguali; nuovi 0), `next build` OK.

## 🔴 AZIONE PER ANIA

Applicare la bozza 0038 nell'editor SQL di Supabase (produzione):

    cat ~/gestionale-bnb/supabase/proposte/0038_ricevuta_separata.BOZZA.sql | pbcopy

poi incollare ed eseguire; la verifica in fondo deve dare 0 «ancora_vecchi».

---

# Consegna — «Da controllare», pulizia non registrata prima di un arrivo (08/09/2026, sera, main)

- Nuovo tipo «Pulizia» in lib/daControllare (eccezioniPulizie): per ogni
  arrivo confermato di OGGI o DOMANI (non i prolungamenti) la voce compare se
  lib/pulizie.statoCameraGiorno — la regola dietro conteggioGiorno, nessun
  calcolo duplicato — dice «da fare» per quella camera in quel giorno:
  partenza precedente non segnata, cambio camera, cambio biancheria, con le
  rettifiche di Ania e la pulizia automatica alla partenza (nuovo ospite
  entro il giorno dopo) già considerate. Alta con linea ottone se l'arrivo è
  oggi, normale se domani. Titolo «Allegra · arrivo domani di Paola Neri,
  ore 16:30», riga «La pulizia dopo la partenza precedente non risulta
  registrata», un solo bottone «Apri pulizie» → /pulizie?giorno=<giorno>.
  Posizione: dopo «arrivo senza orario», prima dei pagamenti; conteggio «N
  pulizie non registrate» nella striscia; «Pulizie» nella riga «tutto a
  posto». Sparisce da sola quando la pulizia viene segnata fatta. La Home
  legge anche `cleanings` (tabella assente = nessuna decisione, come la
  pagina Pulizie).
- Test (2): pulizia segnata → non compare; automatica alla partenza (arrivo
  lo stesso giorno o il giorno dopo) → non compare; cambio biancheria
  saltato → non compare; partenza di tre giorni fa mai segnata + arrivo oggi
  → alta; partenza domani non segnata + arrivo domani → normale; partenza
  di ieri col cambio biancheria non fatto + arrivo domani → compare;
  prolungamento e in attesa mai; segnata dopo → sparisce; ordine e conteggi.
- Anteprima a 390 px: «Allegra · arrivo domani di Paola Neri, ore 16:30»
  (normale) fra gli arrivi senza orario e i pagamenti, striscia «… · 1
  pulizia non registrata · …».
- Suite 676/676, TypeScript OK, lint 0 rilievi sui file toccati, `next build`
  OK. Nessuna migrazione.

---

# Consegna — «Da controllare», tre bottoni su una riga (08/09/2026, sera, main)

- Bottoni della sezione compatti e uguali per tutte le voci (12 px, meno
  padding, icona WhatsApp 13 px, nessun a capo interno): «Chiedi orario» ·
  «Apri chat» · «Apri arrivo» stanno su UNA riga a 390 px; sotto i 360 px
  «Apri chat» → «Chat» e «Apri arrivo» → «Arrivo» (solo lì, testi invariati
  altrove). Rimanda con la stessa misura. components/BottoniWhatsApp
  (EtichettaBreve) e components/DaControllare.
- Prova nell'anteprima a 320, 360 e 390 px: i tre bottoni sullo stesso rigo
  (una sola riga per ogni voce della sezione, 11 voci); a 320 px «Chat» e
  «Arrivo», larghezze 106 + 59 + 50 su 258 px disponibili.
- Suite 674/674, TypeScript OK, lint 0 rilievi, `next build` OK.

---

# Consegna — Provenienza del cliente, retroattiva (08/09/2026, sera, main)

Base `396e8ad`. Un commit per pezzo. Migrazione SOLO come bozza
(`supabase/proposte/0037_provenienza_cliente.BOZZA.sql`) da applicare a mano DOPO
la 0036 (già in produzione). REGOLA: la provenienza appartiene al CLIENTE; un
cliente arrivato da Nida resta di Nida per sempre, ritorni compresi, e vale
anche per il passato. Prima della 0037 il campo resta nascosto con l'avviso
«Serve la migrazione 0037» e nessun salvataggio si blocca.

## FATTO E DIMOSTRATO

- Pezzo 1 `b27b819` — dati. Bozza 0037: guests.provenienza (default non_so)
  e guests.struttura_nome; migrazione dei dati della 0036 (per ogni cliente la
  provenienza della sua prenotazione più vecchia — check_in, poi created_at —
  che ne ha una); via le colonne da bookings; richieste.provenienza resta come
  valore provvisorio di chi non è ancora cliente. lib/provenienza:
  provenienzaDi (dal cliente; prima della 0037 ripiego sul valore 0036 della
  prenotazione), provenienzaClienteDaPrenotazioni (stessa regola della SQL,
  testata), provenienzaRichiestaDalSito (cliente nuovo → google, esistente →
  resta la sua), daApplicareAlCliente (alla conferma la provenienza
  provvisoria va sul cliente solo se lui non ne ha una), rigaCliente.
  lib/provenienzaDati: strutture con i CLIENTI portati, salvaProvenienzaCliente
  (avviso 0037 se mancano le colonne), cercaClientePerTelefono (cifre esatte,
  poi ripiego sulle ultime cifre), applicaProvenienzaAlCliente. Modulo del
  sito: cerca il cliente dal telefono; nuovo → google, esistente → la sua.
- Pezzo 2 `6d59b13` — i chip restano uguali ma modificano il CLIENTE: nuova
  richiesta (telefono di un cliente esistente → chip precompilati con la sua
  provenienza, «Già stato da noi · N soggiorni» accanto all'etichetta; al
  salvataggio si aggiorna il cliente, la richiesta tiene il provvisorio),
  nuova prenotazione (cliente esistente → precompilati e aggiornati; cliente
  nuovo → nasce con la provenienza; niente più sulla prenotazione), scheda
  prenotazione (chip dal cliente, salvati sul cliente con scritturaSicura, riga
  «Come ci ha trovato: … · del cliente, vale per tutti i suoi soggiorni»).
- Pezzo 3 `664a133` — Statistiche «Da dove arrivano gli ospiti» per il
  periodo: una riga per fonte (ogni struttura per nome, Google, Passaparola,
  Non so) con clienti, soggiorni, di cui ritorni (cliente con un soggiorno
  concluso prima di quell'arrivo), ricavi per soggiorno (lib/statistiche, solo
  confermate, cambio camera contato una volta), ordinate per ricavi; via la
  riga «Già stati da noi». Sotto «Strutture»: soggiorni e ricavi di ciascuna
  nell'anno letto. Letture con guests(*) (periodo e storico). 2 test (conteggi
  con ritorni, ereditarietà: la prenotazione con un valore vecchio segue il
  cliente; prima della 0037 vale il valore 0036).
- Pezzo 4 `a500fda` — scheda cliente: sotto il nome «da Nida · 1 soggiorno ·
  160 €» (fonte, soggiorni conclusi uno per gruppo, ricavi totali) e gli stessi
  chip in modifica salvati col cliente (nome nuovo → elenco strutture).
- Anteprima finta (clienti con provenienza, prenotazioni senza) a 390 e 1280
  px: scheda di Giulio «da Nida · 1 soggiorno · 160 €» e chip precompilati in
  modifica; scheda prenotazione «Altra struttura · Nida · del cliente…»;
  nuova richiesta col telefono di Giulio → «Altra struttura» + «Nida» + «Già
  stato da noi · 1 soggiorno»; Statistiche: righe Non so 8/8/0/€1400,
  Passaparola 1/1/0/€320, Nida 1/1/0/€160, Google 0, Totale 10/10/0/€1880 e
  «Strutture: Nida 2 · €320, Umana 1 · €160».
- Suite 674/674, TypeScript OK, lint dei file toccati senza rilievi nuovi
  (nuovi 0; modulo 0 = 0, nuova 1 = 1, scheda 28 = 28, cliente 4 = 4,
  statistiche 0 = 0), `next build` OK (Compiled successfully su `a500fda`).

## LIMITI APERTI

- Finché la 0037 non è applicata il campo è nascosto ovunque (anche dove
  prima si vedeva con la 0036): l'avviso lo dice.
- Un cliente tornato con una scheda a nome e telefono diversi non è
  riconosciuto come ritorno; l'omonimia conta solo nella scheda prenotazione.
- Sul sito pubblicato verifica senza accesso (login di Ania).

## 🔴 AZIONE PER ANIA

Applicare la bozza 0037 nell'editor SQL di Supabase (produzione), dopo la 0036.
Per copiarla negli appunti dal Mac:

    cat ~/gestionale-bnb/supabase/proposte/0037_provenienza_cliente.BOZZA.sql | pbcopy

poi incollare nell'editor SQL ed eseguire; la verifica in fondo deve dare 2
righe su guests e 0 su bookings, più il conteggio dei clienti per provenienza.

---

# Consegna — Provenienza: le strutture si vedono sempre al tocco (08/09/2026, sera, main)

- Segnalazione di Ania: toccando «Altra struttura» non comparivano più le
  strutture da scegliere. CAUSA: con un nome già completo nel campo (es.
  «Nida») i suggerimenti erano filtrati per quel testo e Nida stessa esclusa
  perché uguale → nessun bottone. In produzione la 0036 risulta GIÀ applicata
  (5 strutture, colonne presenti, 3 prenotazioni con struttura), sito a 2668f87.
- `9d0c064` — lib/provenienza.suggerimentiDaMostrare: se il campo è vuoto o
  contiene un nome noto si mostrano TUTTE le strutture (ordine per ospiti
  portati, poi alfabetico) con quella attuale evidenziata in verde; scrivendo
  un testo nuovo si filtrano, e se nessuna corrisponde tornano tutte. Il
  campo apre l'elenco anche al tocco (onClick), non solo al focus. Test.
- Anteprima a 390 px: con «Nida» nel campo → Nida (evidenziata), Umana, BM,
  Elyse, RB; tocco su «Elyse» → campo «Elyse» e, riaperto, Elyse evidenziata.
- Suite 669/669, TypeScript OK, lint 0 rilievi, `next build` OK (Compiled successfully su `9d0c064`).
  Nessuna migrazione. La tendina unica chiesta prima è stata annullata su
  richiesta di Ania (mai pubblicata).

---

# Consegna — Provenienza dell'ospite (08/09/2026, main)

Base `4ad06da`. Un commit per pezzo. Migrazione SOLO come bozza
(`supabase/proposte/0036_provenienza_ospite.BOZZA.sql`), da applicare a mano da
Ania: prima di allora tutto funziona con il campo nascosto e l'avviso «Serve la
migrazione 0036». Stile esistente: chip come quelli del canale, nessun colore nuovo.

## FATTO E DIMOSTRATO

- Pezzo 1 `496fcee` — dati. Bozza 0036: richieste.provenienza e bookings.provenienza
  (google | passaparola | altra_struttura | non_so, default non_so), struttura_nome
  (solo con altra_struttura), tabella `strutture` precaricata (Umana, Nida,
  RB (Rosa Bianca), Elyse, BM (Borgo Manzoni)) con RLS solo authenticated.
  lib/provenienza (pure, 5 test): valori e default, struttura solo con
  altra_struttura, suggerimenti per ospiti già portati, nome nuovo che entra
  nell'elenco, riconoscimento delle colonne/tabella assenti (42703/PGRST204/
  PGRST205), riga dal sito con provenienza = google, campi da copiare alla
  conferma. lib/provenienzaDati: strutture con i conteggi (soggiorni con
  struttura_nome, uno per gruppo), nome nuovo (upsert idempotente), copia sulla
  prenotazione (tutti i segmenti del gruppo) con avviso se le colonne mancano.
  Richieste: i campi entrano nel payload solo a colonne presenti (creazione:
  ritentativo senza campi + avviso; modifica: solo se la riga letta ha la
  colonna). Modulo del sito: `provenienza = google` in automatico, con ripiego
  senza colonna come per `origine` (0028). Conferma (FinestraConferma): dopo la
  RPC la provenienza passa alla prenotazione; se non riesce la scheda si apre
  con l'avviso (`?avviso=`), la prenotazione resta valida.
- Pezzo 2 `5733d89` — components/CampoProvenienza sotto il canale nella nuova
  richiesta (e modifica), nella nuova prenotazione e nella scheda prenotazione
  (in modifica; in vista la riga «Come ci ha trovato: Altra struttura · Nida»);
  con «Altra struttura» il campo «Quale struttura» con i suggerimenti mentre si
  scrive (ordinati per ospiti portati, poi per nome; «ni» trova Nida e BM (Borgo
  Manzoni)), nome nuovo accettato scrivendolo e aggiunto all'elenco al
  salvataggio (non blocca; avviso se non riesce). Non obbligatorio. Senza 0036:
  campo nascosto con l'avviso, nessun payload con le colonne nuove.
- Pezzo 3 `f2f37b9` + `423c358` — cliente che torna (NON una provenienza):
  lib/clienteCheTorna (2 test): stessa persona per telefono (cifre) o per nome e
  cognome (senza maiuscole, accenti, ordine delle parole), solo soggiorni
  CONCLUSI, uno per gruppo, escluso il soggiorno in esame. Etichetta «Già stato
  da noi · N soggiorni» nella lista Richieste e accanto al titolo della scheda
  prenotazione (stesso cliente + omonimi su altre schede, lettura tollerante).
- Pezzo 4 `4e93976` — Statistiche: riquadro «Da dove arrivano gli ospiti» per il
  periodo scelto (lib/statistiche/provenienza, 2 test): righe Altra struttura
  (con ogni struttura sotto), Google, Passaparola, Non so e, a parte, «Già stati
  da noi»; per riga soggiorni confermati (un soggiorno = gruppo) e ricavi per
  soggiorno (ricaviSoggiornoCent: notti dormite nel periodo). Letture con
  l'ospite (telefono e nome) e guest_id anche nello storico della ricostruzione.
- Anteprima finta a 390 px (strutture, provenienze e un cliente che torna nel
  finto): nuova richiesta con i 4 chip, «Quale struttura» con «Nida · 1» e
  «BM (Borgo Manzoni)» digitando «ni», «Nome nuovo» con «Villa Nuova»; con
  la tabella assente l'avviso «Serve la migrazione 0036»; nuova prenotazione
  con il campo sotto «Il cliente è arrivato da»; scheda di Giulio con «Come ci
  ha trovato: Altra struttura · Nida»; lista Richieste con «Già stato da noi ·
  1 soggiorno» su Giulio Gallo; Statistiche col riquadro (Passaparola 1 ·
  €320, Non so 9 · €1560, Già stati 0).
- Suite 668/668, TypeScript OK, lint dei file toccati senza rilievi nuovi
  (nuovi file 0; scheda 28 = 28, nuova 1 = 1, richieste 0, statistiche 0),
  `next build` OK (Compiled successfully su `a8ad89c` + `423c358`).

## LIMITI APERTI

- La copia alla conferma è un UPDATE dopo la RPC (la RPC conferma_richiesta
  non cambia): se la rete cade fra i due, la prenotazione nasce senza
  provenienza e la scheda lo dice (si corregge in modifica).
- L'etichetta «Già stato da noi» sta nella lista Richieste e nella scheda
  prenotazione; non ancora nel dettaglio richiesta, nella proposta e nella
  lista Prenotazioni.
- In Statistiche il cambio biancheria/«Già stati» usa lo storico letto per la
  ricostruzione (soggiorni conclusi): un cliente tornato con una scheda a nome
  diverso e telefono diverso non è riconosciuto.
- Sul sito pubblicato verifica senza accesso (login di Ania).

## 🔴 AZIONE PER ANIA

Applicare la bozza 0036 nell'editor SQL di Supabase (progetto di produzione).
Per copiarla negli appunti dal Mac:

    cat ~/gestionale-bnb/supabase/proposte/0036_provenienza_ospite.BOZZA.sql | pbcopy

poi incollare nell'editor SQL ed eseguire; la verifica in fondo deve dare 4
colonne e 5 strutture. Da quel momento il campo «Come ci ha trovato» compare.

---

# Consegna — «Da controllare», arrivo senza orario: tre bottoni WhatsApp (08/09/2026, main)

- `a8ad89c` — components/BottoniWhatsApp condiviso: «Chiedi orario» (pieno,
  icona WhatsApp, chat col messaggio «Richiesta orario» già scritto, come
  prima), «Apri chat» (ghost, icona, chat senza testo), poi «Apri arrivo»
  (ghost). Senza numero i due WhatsApp non compaiono. Stessi bottoni, nomi e
  icone nella finestra dell'orario del pannello Arrivi (che non aveva ancora
  link WhatsApp: aggiunti lì). Le proposte scadute usano «Apri chat» con la
  stessa icona. Test sui tre link (href di Chiedi orario = quello della scheda,
  Apri chat = wa.me/<numero>, Apri arrivo = /arrivi?apri=<id>; senza numero
  solo il terzo). Anteprima a 390 px: Home con i tre bottoni su Marco Bianchi e
  il solo «Apri arrivo» su «Senza Numero»; finestra Arrivi con i due WhatsApp.

---

# Consegna — Striscia della settimana: rispettare le pulizie saltate (08/09/2026, main)

## CAUSA

- Sui dati di produzione del 05/09 (sola lettura): il cambio biancheria di
  Ambra del 5 set è registrato «saltato → proposta 9 set» (Rosa cambia camera
  il 7). Il calcolo condiviso (lib/pulizie.statoCameraGiorno, pubblicato con
  `aa22913` alle 19:23) legge già lo stato registrato tramite cicloCambio:
  oggi «—», domani «✓», il 7 «2» (partenza/cambio camera, non biancheria); il
  cambio saltato non compare in nessun giorno. La versione vista da Ania era
  quella precedente (partenze ∪ arrivi, senza rettifiche) o la Home non ancora
  ricaricata dopo il salto.

## FATTO

- `39c3ddb` — nessuna modifica al calcolo; test aggiunti: cambio biancheria
  SALTATO non conta e non riappare (caso vero di Ambra), le 4 notti ripartono
  dalla data proposta (salto con partenza lontana → 9 set), RIMANDATO conta
  solo nel giorno di destinazione, AGGIUNTO A MANO = «✓» quel giorno e riparte
  da lì (10 set); stessi dati → striscia = funzione della pagina giorno per
  giorno.

---

# Consegna — Striscia della settimana: regola delle Pulizie, solo da fare, «✓»; tre riquadri allineati (08/09/2026, main)

Base `cab5533`. Tre incarichi arrivati in sequenza, un commit ciascuno. Nessuna migrazione.

## FATTO

- `bcf2926` — calcolo condiviso: la striscia usa la STESSA regola della pagina
  Pulizie (partenze e cambi camera con la scadenza del giorno, rimandi di Ania
  compresi; cambi biancheria ogni 4 notti con le rettifiche registrate; ogni
  camera una volta al giorno). Lettura della Home come la pagina: prenotazioni
  dal CUTOFF delle pulizie (24/08) in poi con tutte le colonne, camere e la
  tabella `cleanings` (assente = nessuna decisione, come la pagina).
- `aa22913` — segnalazione di Ania (domani «2» ma le due camere degli arrivi
  già pulite e segnate): ogni giorno conta SOLO le pulizie ancora da fare.
  lib/pulizie.statoCameraGiorno / conteggioGiorno: partenza/cambio camera con
  scadenza quel giorno → da fare finché non segnata fatta/saltata (per oggi
  anche in ritardo, come «Oggi»); pulizia automatica alla partenza (nuovo
  ospite nella stessa camera entro il giorno dopo, già avvenuta) = fatta;
  cambio biancheria in scadenza = da fare, segnato fatto quel giorno = fatta;
  arrivo in una camera già pulita e segnata (o senza partenze da chiudere) =
  fatta, in una camera non ancora pulita = da fare; «da fare» vince su
  «fatta» nella stessa camera. Casella: numero = camere da fare; «✓»
  attenuato = tutte fatte; «—» attenuato = niente. La pagina Pulizie usa la
  stessa funzione per «N camere da rifare oggi» e per «· N camere da fare» /
  «· tutte fatte ✓» nei giorni Prossimi. Test: striscia = funzione condivisa
  su tutti i 28 giorni + valori a mano di uno scenario (rimando, rettifica
  del cambio biancheria, cambio camera, in attesa/annullate); CASO DI ANIA:
  due arrivi domani in camere già pulite e segnate → «✓» (0 da fare, 2
  fatte); senza una segnatura ma con la partenza automatica → ancora «✓»;
  partenza mai segnata senza arrivo vicino → in ritardo oggi e domani «1».
- `5b1df78` — tre riquadri: numero in alto, etichetta in basso su UNA riga
  (9 px, «Arrivi oggi» / «Partenze oggi» / «Occupate»; sotto i 360 px «oggi»
  sparisce), altezza uguale (min 68 px) e i tre numeri sulla stessa linea.
  Prova a 320 e 390 px: etichette senza a capo né overflow, altezze 68/68/68,
  numeri allo stesso top in tutti e tre.
- Anteprima finta (pulizie segnate: Giulio da Allegra, «Parte Oggi» da Ambra)
  a 320 e 390 px: striscia «sab 5 ✓ · dom 6 1 · … · gio 10 ✓ · ven 11 —»; la
  pagina Pulizie dice «Nessuna camera da rifare oggi», «Domani · 1 camera da
  fare», «10 set · tutte fatte ✓»: stessi numeri della striscia.
- Suite 656/656, TypeScript OK, lint dei file toccati senza rilievi nuovi
  (pulizie.ts 44 = 44, pagina Pulizie 13 = 13, nuovi 0), `next build` OK (Compiled successfully su `5b1df78`).

## LIMITI APERTI

- Il cambio biancheria conta la PROSSIMA scadenza calcolata (come la pagina):
  in un soggiorno di 12 notti la striscia mostra il cambio del giorno 4 e,
  solo dopo che è segnato fatto, quello successivo.
- Un arrivo in una camera con la partenza precedente non ancora segnata conta
  «da fare» anche nel giorno dell'arrivo (oltre al giorno della partenza in
  ritardo): sono due giorni diversi, la camera è contata una volta per giorno.

---

# Consegna — Home: tre numeri, striscia della settimana, ordine di «Da controllare» (07/09/2026, sera, main)

Base `033685f`. Un commit per pezzo. Nessuna migrazione. Regola tipografica
rispettata: tutte le cifre nuove usano `font-serif text-2xl text-green-dark`,
ESATTAMENTE come Incassi/Spese/Saldo (Georgia 24 px, peso 400, #1F3D2F,
verificato con getComputedStyle nell'anteprima); niente Fraunces, nessun
colore nuovo.

## FATTO E DIMOSTRATO

- Pezzo 1 `c61fcfe` — i tre riquadri («Arrivi oggi», «Partenze oggi»,
  «Occupate stanotte» «N su 4») erano già in cima dalla consegna precedente
  (`b4b1cae`: solo confermate, cambio camera contato una volta, giorno di
  Roma, trattini + Riprova su errore, 5 test); qui le cifre passano da
  Fraunces al carattere delle altre cifre della Home e l'etichetta diventa
  «Occupate stanotte».
- Pezzo 2 ``df65bf9`` — striscia della settimana (components/StrisciaSettimana)
  sotto i tre numeri e sopra «Da controllare»: didascalia piccola in grigio
  «Camere da preparare nei prossimi 7 giorni» (un tocco riporta a oggi),
  28 caselle da oggi che scorrono di lato col dito (7 visibili sul telefono,
  14 sul Mac, scatto per casella), giorno in alto («sab 5»), sotto le camere
  da preparare = camere con una partenza ∪ camere con un arrivo quel giorno,
  ogni camera contata una volta (partenza e arrivo nella stessa camera = 1,
  cambio camera = camera lasciata + camera nuova); «—» in grigio attenuato
  senza lavoro; oggi su #F3ECD8 con bordo ottone; divisorio ottone sottile a
  ogni settimana (12, 19, 26 set); un tocco apre /pulizie?giorno=AAAA-MM-GG
  che scorre al blocco di quel giorno (Oggi o Prossimi; senza pulizie quel
  giorno resta in cima). Lettura unica a 28 giorni per numeri e striscia
  (lib/numeriOggiDati); con errore o in caricamento la striscia non compare.
  lib/numeriOggi: camereDaPreparare, strisciaSettimane, etichettaGiornoBreve
  (2 test: cambio camera, stessa camera, in attesa/annullate escluse, 28
  giorni, divisori, etichette).
- Pezzo 3 — nuovo ordine di «Da controllare»: GIÀ su main dalla consegna
  precedente (`5c642ab`), identico al requisito (tutte le aperte per durata
  decrescente e poi arrivo passato / scaduta / in scadenza più vicina / in
  attesa più vecchia; ottone solo su scadute e arrivi passati; arrivi senza
  orario; pagamenti; fatture; sovrapposizioni in fondo senza ottone; conteggi
  nello stesso ordine). Ricontrollato nell'anteprima: nessuna modifica
  necessaria, nessun commit nuovo.
- Anteprima finta a 390 e 1280 px: «1 · 1 · 2 su 4» con le cifre uguali a
  quelle di Incassi; striscia «sab 5: 2 · dom 6: 3 · lun 7: 1 · mar 8: 2 ·
  mer 9: 1 · gio 10: 1 · ven 11: —», 28 caselle, oggi evidenziato, divisori
  il 12/19/26, tocco sulla casella → /pulizie?giorno=2026-09-06 aperta sul
  blocco «Domani»; scorsa in fondo e tocco sulla didascalia → torna a oggi;
  sul Mac 14 caselle in vista.
- Suite 655/655, TypeScript OK, lint dei file toccati senza rilievi nuovi
  (nuovi file 0, pulizie 13 = 13, Home 20 = 20), `next build` OK (Compiled successfully su `df65bf9`).

## LIMITI APERTI

- Lo scorrimento della striscia e il salto in Pulizie sono diretti (non
  «smooth»): nel pannello di prova le animazioni di scorrimento non partono,
  e il salto diretto è comunque più sicuro con «riduci movimento».
- «Camere da preparare» segue la regola dell'incarico (partenze ∪ arrivi),
  non il calcolo delle pulizie automatiche/cambi biancheria della pagina
  Pulizie: i due numeri possono differire nei giorni con cambio biancheria.
- Sul sito pubblicato verifica senza accesso (login di Ania).

---

# Consegna — Home: tre numeri in cima e nuovo ordine di «Da controllare» (07/09/2026, main)

Base `d3fe7f0`. Un commit per pezzo. Nessuna migrazione.

## FATTO E DIMOSTRATO

- Pezzo 1 `b4b1cae` — tre riquadri affiancati SOPRA TUTTO nella Home
  (components/NumeriOggi, stile delle schede: bianco, bordo #C9BFA8, ombra;
  numero in Fraunces, etichetta in Nunito Sans): «Arrivi oggi», «Partenze
  oggi», «Camere occupate» «N su 4» (4 = camere attive). Toccabili: arrivi e
  partenze → /arrivi (che parte da oggi), camere → /calendario?giorno=oggi.
  lib/numeriOggi (pure, 5 test): solo confermate/completate; un cambio
  camera di oggi (stesso soggiorno per group_id o stesso cliente, con la
  stessa regola della riga «⇄ CAMBIO», lib/roomChanges) non è né arrivo né
  partenza; camera occupata contata una volta anche con dati sporchi; in
  attesa/annullate escluse; giorno di Roma (oggiARoma: 00:30 italiane del 5
  = 5, non 4). lib/numeriOggiDati: lettura a pagine delle prenotazioni che
  toccano oggi + camere; errore → trattino al posto di ogni numero + avviso
  «Non riesco a leggere arrivi, partenze e camere di oggi» con Riprova, mai
  uno zero; rilettura al ritorno in primo piano (a mezzanotte «oggi» cambia).
- Pezzo 2 `5c642ab` — nuovo ordine di «Da controllare» (lib/daControllare):
  1) TUTTE le richieste aperte (in attesa con «In attesa da 20 min / 3 ore /
  2 giorni senza proposta», proposta inviata con «scade tra …», proposta
  scaduta, arrivo passato), ordinate per durata del soggiorno decrescente e,
  a parità, la prima a scadere: arrivo passato, proposta scaduta (dalla più
  vecchia), in scadenza (la più vicina), in attesa (dalla più vecchia);
  linea ottone solo su scadute e arrivi passati; 2) arrivi di domani senza
  orario (ottone); 3) pagamenti; 4) fatture; in fondo, senza ottone, le
  sovrapposizioni di camera/letti solo se mai si verificano. Riga dei
  conteggi nello stesso ordine («3 richieste aperte · 2 arrivi senza orario ·
  2 pagamenti · 1 fattura scaduta · 2 sovrapposizioni»). Test riscritti sul
  nuovo requisito (con il motivo nel commento) + 2 test sull'ordine (sezioni;
  durata, scadenza, parità); tolta la soglia delle 48 ore.
- Anteprima finta (scenario esteso: «Arriva Oggi», «Parte Oggi», interruttore
  /finto/errore-oggi) a 390 e 1280 px: «1 · 1 · 2 su 4» con i link giusti,
  sopra «Da controllare»; con l'errore simulato tre trattini + avviso, e
  «Riprova» rimette i numeri; l'elenco nel nuovo ordine con la linea ottone
  solo su Dario (scaduta) e sugli arrivi senza orario.
- Suite 653/653, TypeScript OK, lint dei file toccati senza rilievi nuovi
  (nuovi file 0, Home 20 = 20), `next build` OK (Compiled successfully su `5c642ab`).

## LIMITI APERTI

- «Arrivi oggi» e «Partenze oggi» aprono /arrivi che parte già da oggi
  (nessun parametro nuovo): se un giorno la pagina Arrivi cambierà la prima
  casella, servirà ?giorno= anche lì.
- Il cambio camera riconosciuto dal solo cliente (guest_id) segue la stessa
  euristica della riga «⇄ CAMBIO»: due prenotazioni dello stesso cliente
  che si toccano in camere diverse contano come un unico soggiorno.
- Sul sito pubblicato verifica senza accesso (login di Ania).

---

# Consegna — «Da controllare», falso positivo nei Pagamenti (07/09/2026, main)

Segnalazione di Ania: Anna e Rosa comparivano come «Soggiorno concluso … e
non segnato pagato» pur essendo saldate; «Registra saldo» non aveva nulla da
registrare. Indagine in SOLA LETTURA sui dati di produzione (chiave di
servizio dal .env.local, nessuna scrittura), poi la regola di
lib/daControllare riprodotta su quei dati esatti.

## CAUSA

- Anna: soggiorno di 3 segmenti (group 53f4cc1d: 90 + 170 + 1120 = 1380 €),
  movimenti reali 500 + 500 + 380 = 1380 €, `pagato` = false su tutti i
  segmenti. Rosa: 1 segmento da 1700 €, movimenti 500 + 600 + 600 = 1700 €,
  `pagato` = false. I movimenti coprono il totale: il gestionale li mostra
  saldati e «Segna come pagato» non ha nulla da registrare.
- La regola «concluso da più di un giorno e non segnato pagato» guardava
  SOLO la colonna `pagato`, non i movimenti. Le altre ipotesi sono escluse
  sui dati: i movimenti «ricostruito» (123 su 138) sono letti e sommati come
  gli altri; il totale è quello del soggiorno intero (segmenti del gruppo a
  blocchi); centesimi coerenti; i movimenti si leggono TUTTI, non solo nel
  periodo; il campo è `payments.amount`, lo stesso di «Segna come pagato».

## CORRETTO

- lib/daControllare.eccezioniPagamenti: la terza regola si accende solo se
  i movimenti registrati (di qualunque origine) sono MENO del totale del
  soggiorno; il motivo dice quanto manca («registrati 1.100 € su 1.700 €»),
  o «non segnato pagato» se non c'è nessun movimento. Le regole «pagato ma
  incompleto» e «oltre il totale» restano com'erano.
- Test di regressione con i dati esatti di Anna e Rosa (0 eccezioni), con un
  movimento in meno (compare con gli importi) e con un movimento
  «ricostruito» (conta come gli altri). Suite 647/647.
- Verifica in sola lettura sugli ultimi 31 giorni in produzione: 12
  soggiorni conclusi, tutti coperti dai movimenti (10 con flag true, Anna e
  Rosa con flag false) → 0 eccezioni nei Pagamenti; la Home oggi mostra solo
  2 arrivi di domani senza orario (veri).
- TypeScript OK, lint dei file toccati 0 rilievi, `next build` OK.

## LIMITI APERTI

- Anna e Rosa restano con `pagato` = false nel database (dato, non codice):
  se Ania vuole il flag allineato basta «Segna come pagato» dalla scheda,
  che registra solo il flag. Nessuna scrittura fatta da qui.

---

# Consegna — «Da controllare», ritocchi dopo la prova (07/09/2026, main)

Base `6fa76a6`. Un commit per pezzo. Nessuna migrazione.

## FATTO E DIMOSTRATO

- Pezzo 1 `a6b3a80` — striscia e sezione spostate IN CIMA alla Home, sopra
  Oggi/Domani e i numeri del mese (fuori dal ramo di caricamento dei numeri);
  durante il controllo e con zero eccezioni il componente non rende nulla:
  la Home resta com'era, senza spazio vuoto. Test sulla posizione (ordine nel
  sorgente della Home + «caricamento → null»).
- Pezzo 2 `925b871` — arrivo di domani senza orario: «WhatsApp» (pieno) +
  «Apri arrivo» (ghost). Il testo «Richiesta orario» è stato SPOSTATO da
  app/prenotazioni/[id]/page.tsx a lib/messaggiWhatsApp (messaggioRichiestaOrario,
  numeroWhatsAppPrenotazione, waHrefTesto, whatsappRichiestaOrario): la
  scheda lo importa, non lo copia (test che legge il sorgente della scheda:
  usa la funzione, il testo letterale non c'è più); stesso numero (39 se
  manca) e stesso link wa.me; l'apertura passa da lib/whatsapp.openWhatsApp
  come nella scheda. Senza numero: niente WhatsApp e motivo «Arrivo di domani
  senza orario e senza numero di telefono». Fixture dei test con il telefono
  della scheda cliente (come in produzione); 4 test nuovi + 1 sugli arrivi.
- Pezzo 3 `bf9b646` — proposta scaduta: «WhatsApp» ghost (chat senza testo,
  wa.me/<numero> da lib/whatsapp.normalizzaTelefono) fra «Apri richiesta» e
  «Rimanda»; senza telefono non compare; le richieste ferme non lo hanno.
  La lettura seleziona anche `telefono`. 1 test.
- Anteprima finta (scenario con «Senza Numero» in arrivo domani) a 390 e
  1280 px: sezione sopra «Domani», Marco Bianchi con WhatsApp pieno + Apri
  arrivo ghost, Senza Numero con solo Apri arrivo e il motivo esplicito,
  Dario Deluca con Apri richiesta · WhatsApp · Rimanda; il link del bottone
  WhatsApp della Home è IDENTICO (confronto di stringa) a «Richiesta orario»
  nella scheda della stessa prenotazione.
- Suite 646/646, TypeScript OK, lint del delta senza rilievi nuovi (nuovi file
  e componente 0; Home 20 = 20, scheda 28 = 28), `next build` OK (Compiled successfully su `bf9b646`).

## LIMITI APERTI

- L'apertura vera di WhatsApp (schema app + ripiego wa.me) non si prova nel
  pannello: verificato il link; il meccanismo è lo stesso della scheda.
- Sul sito pubblicato verifica senza accesso (login di Ania).

---

# Consegna — «Da controllare» in Home, versione B (07/09/2026, main)

Incarico del 06/09/2026: elenco di ECCEZIONI, non di attività. Base
`b3ea260`. Ogni voce: etichetta del tipo in ottone, titolo (chi, cosa,
quando), una riga col perché, UN bottone che porta al punto esatto da
sistemare; le voci spariscono da sole quando il problema si risolve nella
sua sezione (nessuna spunta «fatto», nessuna notifica nuova, nessuna pagina
separata). Un commit per pezzo.

## FATTO E DIMOSTRATO

- Pezzo 1 `5cea06b` — lib/daControllare (pure): eccezioniRichieste (in
  attesa > 48 h senza proposta; proposta scaduta oltre le 3 ore, con
  lib/richieste.scadenzaProposta; arrivo passato e ancora aperta),
  eccezioniPagamenti (concluso e pagato ma movimenti < totale, via
  incongruenzePagamenti; movimenti > totale; concluso da > 1 giorno e non
  pagato — un soggiorno = group_id, totale dei segmenti), eccezioniCalendario
  (due confermate stessa camera stessa notte; letti oltre i 2 del pool con
  lib/lettiAggiuntivi, notti consecutive in una voce), eccezioniArrivi
  (domani senza orario, cambio camera escluso), eccezioniFatture
  (approvata_da_pagare con scadenza passata, sola lettura). Urgenza alta:
  sovrapposizioni (camere e letti), proposta scaduta, arrivo domani senza
  orario; ordine alta → data più vicina a oggi → titolo. Rinvii, conteggi
  («1 sovrapposizione · 2 richieste ferme · …»), riga «tutto a posto», href
  dei bottoni. Casi di bordo nei test: cambio camera ≠ sovrapposizione,
  partenza = arrivo nella stessa camera, richiesta chiusa, pagato coperto,
  proposta senza ora di invio, arrivo con orario vuoto, fattura in scadenza
  oggi, in attesa/annullata mai contate. 24 test.
- Pezzo 2 `3f4ab7f` — Home: sotto i numeri del giorno la striscia su
  #F3ECD8 «N cose da controllare» (Fraunces) + conteggi per tipo, poi la
  sezione «Da controllare» (voci ordinate per urgenza, linea ottone a
  sinistra per l'urgenza alta, bottone verde, «Rimanda» ghost solo sulle
  richieste, riga tratteggiata «… tutto a posto» in fondo); zero eccezioni
  = né striscia né sezione; lettura fallita = «Non riesco a controllare,
  riprova» + Riprova (mai un «tutto a posto» finto). lib/daControllareDati:
  stato UNICO condiviso (useSyncExternalStore, come le richieste dal sito),
  letture del solo periodo oggi−31/+62 a pagine (paginazione di
  lib/statistiche) + segmenti dei gruppi a blocchi, movimenti, fatture
  scadute, rinvii; «Rimanda» = upsert su `da_controllare_rinvii` con
  lib/scritturaSicura (lo schermo cambia solo a scrittura riuscita), memoria
  lato server fino a domani; tabella assente (PGRST205/42P01) → avviso
  «Rimanda non disponibile: va applicata la proposta 0035», tutto il resto
  funziona. Punti d'ingresso: /richieste/<id>; /prenotazioni/<id>?azione=pagato
  apre «Segna come pagato» (anche se già pagato o non bonifico, con scroll);
  /calendario?giorno=AAAA-MM-GG parte dal giorno prima (estende l'intervallo
  se serve); /arrivi?apri=<id> apre la finestra dell'orario su quella
  prenotazione; /spese?documento=<id> atterra in Documenti con la fattura in
  vista (sfondo terracotta tenue, nessun bordo). Proposta
  `supabase/proposte/0035_rinvii_da_controllare.BOZZA.sql` (tabella, RLS
  solo authenticated). Anteprima finta `scripts/revisioni/anteprima-home-finta.mjs`
  (porta 3215, date relative a oggi, rinvii in memoria, interruttori
  /finto/senza-rinvii e /finto/errore-richieste).
- Pezzo 3 `85372ae` — Statistiche: sotto la voce Incassi il link «N
  pagamenti da controllare» (solo con incongruenze, stesso stato condiviso
  della Home) verso `/#da-controllare`; la Home scorre alla sezione.
- Prove UI sull'anteprima finta (scenario: sovrapposizione Amelia, letti 3
  su 2, arrivo domani senza orario, pagato 100 su 160, concluso non pagato,
  richiesta ferma da 3 giorni, proposta scaduta, fattura Enel scaduta;
  controesempi: cambio camera, arrivo con orario, pagato coperto, richiesta
  fresca, confermata, fattura in scadenza) a 390 e 1280 px: striscia «8 cose
  da controllare · 2 sovrapposizioni · 2 richieste ferme · 2 pagamenti
  incompleti · 1 arrivo senza orario · 1 fattura scaduta», ordine alta →
  vicina; «Rimanda» su una richiesta → 7 voci, rinvio arrivato al server con
  fino_a = domani, dopo la ricarica resta nascosta; tabella dei rinvii
  assente → avviso sotto la voce, elenco intatto; errore sulle richieste →
  «Non riesco a controllare, riprova», nessuna sezione, Riprova ripristina;
  i quattro punti d'ingresso verificati (calendario scorre al 14 set per il
  15, Arrivi con la finestra di Marco Bianchi aperta, scheda con «Registro
  un pagamento di €60,00», Spese in Documenti con la fattura Enel
  evidenziata); Statistiche con «2 pagamenti da controllare» → /#da-controllare.
- Suite completa 639/639, TypeScript OK, lint dei file toccati senza
  rilievi nuovi (nuovi file 0; calendario 0 vs 3 sulla base, arrivi 17 vs 21,
  gli altri uguali), `next build` OK (Compiled successfully, `85372ae` + documenti).

## LIMITI APERTI

- «Rimanda» richiede la proposta 0035 applicata a mano (🔴 Ania); fino ad
  allora il bottone risponde con l'avviso e non scrive nulla.
- I soggiorni segnati pagati SENZA alcun movimento (storico prima del
  05/09) NON compaiono: li tratta la ricostruzione una tantum delle
  Statistiche («storico da ricostruire»), altrimenti la Home si riempirebbe
  di decine di voci storiche. Scelta dichiarata, da confermare con Ania.
- «Movimenti oltre il totale» porta alla scheda prenotazione con «Apri
  prenotazione» (non a «Segna come pagato», che non può togliere soldi).
- La lettura guarda solo oggi−31/+62 giorni: un soggiorno concluso da più
  di un mese e mai pagato o una sovrapposizione fra tre mesi non compaiono
  finché non entrano nel periodo.
- Lo scorrimento morbido (Home → sezione, scheda → «Segna come pagato»,
  Spese → fattura) non si può esercitare nel pannello nascosto di questo
  Mac: verificato con lo scorrimento diretto (posizione giusta) e sul
  calendario con la posizione diretta.
- Sul sito pubblicato la verifica è senza accesso (login di Ania): vedi il
  resoconto.

---

# Consegna — Statistiche: collaudo su PostgreSQL 16, autorevisione e RILASCIO (06/09/2026, main)

Codex non disponibile: revisione finale fatta qui con lo stesso rigore. Base
d18ede8 (codice 983d4ed), origin/main f4d5474. Esito reale in
`scripts/collaudo-0033/ESITO-2026-09-06.txt`.

## VERIFICATO SU POSTGRESQL 16 (Homebrew, locale, porta 5433, database `collaudo_0033`)

- `scripts/collaudo-0033/applica-migrazioni.mjs`: stub dichiarati di Supabase
  (ruoli anon/authenticated/service_role, auth.uid() dal JWT, storage, utente
  finto) → 0001–0020 OK → `supabase/bootstrap_owner.sql` → 0021–0032 OK →
  DRIFT documentato (bookings.pagato, bonifico, guest_name, extra_bed_dates,
  contatti extra, color, check_in_time: in produzione senza migrazione) →
  proposte 0033 e 0034 OK; la 0033 è riapplicabile senza errori.
- `scripts/collaudo-0033/concorrenza.mjs` (output reale):
  1. due segna_pagato concorrenti (segmenti diversi, chiavi diverse) → un
     solo movimento da 340, flag su entrambi — movimenti=1 totale=340.00
     importi=0,340 flag=true;
  2. due ricostruzioni concorrenti (chiavi diverse) → una scrive 100, l'altra
     «nulla_da_scrivere» — scritti=1 nulla=1 movimenti=1 totale=100.00;
  3. stessa chiave su altro soggiorno → CHIAVE_RIUSATA, movimenti=2 invariati;
  4. anon (SET ROLE da un login non superuser): «permission denied for
     function segna_pagato» e «permission denied for table room_closures»;
  5. authenticated senza JWT → NON_AUTENTICATO; con JWT → RPC ok (stessa
     chiave → stesso movimento, importo 340), room_closures scrivibile e
     leggibile (chiusure=1).
- Prove avversarie in SQL sul database migrato (T1–T10): annullata e in
  attesa → PRENOTAZIONE_NON_MODIFICABILE e pagato resta false; gruppo con un
  segmento annullato da 999 → saldo 340; stessa chiave dall'altro segmento →
  stesso movimento; registra_acconto con chiave del gruppo → CHIAVE_RIUSATA;
  acconto 50 fra piano (200) e conferma → ricostruzione scrive 150, totale
  200; batch con soggiorno futuro → SOGGIORNO_NON_CONCLUSO e 0 righe per il
  primo; in attesa/annullato → SOGGIORNO_NON_VALIDO; 0034: vincoli sugli
  intervalli e archivio con data (active resta true).

## AUTOREVISIONE AVVERSARIA (tentativi → esito)

- chiave riusata fra soggiorni (segna_pagato, registra_acconto, ricostruzione) → rifiutata, zero effetti;
- segmenti dello stesso soggiorno (stessa chiave, chiavi diverse, concorrenti) → un solo movimento;
- acconto arrivato fra piano e conferma → il server ricalcola (150, non 200);
- in_attesa / annullata pagate → impossibile (errore) e non contate nei totali;
- risposta persa a ogni passo (INSERT, RPC, flag, acconto) → rilettura + chiave → nessun doppione (12 test del contratto);
- doppia scheda e doppio tocco → una sola scrittura;
- localStorage negato → nessuna richiesta;
- RPC assente (PGRST202 con il nome) → ripiego o messaggio «serve la 0033»; risposta nulla/malformata → non è successo; 42703/42P01 → errore visibile;
- UPDATE a zero righe nel ripiego → errore;
- paginazione troncata → ErroreLetturaIncompleta;
- archivio camera → data, il passato resta (catena PGlite);
- DIFETTI TROVATI E CORRETTI (riproduzione prima, poi correzione, un commit ciascuno):
  1. `9466570` anon conservava EXECUTE sulle RPC 0033 per i privilegi predefiniti di Supabase (revoke esplicito);
  2. `650adba` acconto pendente riconosciuto con l'orologio del telefono (telefono avanti → doppione): ora per conteggio delle righe uguali;
  3. `b3d087d` riga doppia a schermo dopo un ritentativo con la stessa chiave (solo a schermo);
  4. `4c80e78` un client poteva dichiarare il metodo «all'arrivo (ricostruito)» (ora solo contanti/bonifico/carta/altro).

## PROVE TECNICHE DEL RILASCIO

- `verifica-consegna --base f4d5474` su `4c80e78`: suite 615/615, regressioni
  e strumenti OK, TypeScript OK; lint dei file toccati 48 = 48 sulla base
  (nessun rilievo nuovo); `next build` OK; albero pulito.
- Anteprima finta a 390 e 1280 px con la produzione simulata SENZA 0033/0034
  (room_closures → PGRST205, colonne rooms → 42703): Home e Statistiche
  senza avvisi, limite «periodi di fuori servizio non registrati (proposta
  0034)» visibile, tasto di ricostruzione presente; con RPC assente
  (PGRST202) il tasto dice «Serve la migrazione 0033…».

## LIMITI APERTI

- Il collaudo usa stub di Supabase (auth/storage/ruoli) e il drift delle
  colonne di bookings aggiunto a mano: lo schema di produzione andrebbe
  registrato in una migrazione vera (fuori da questo incarico).
- PostgREST in produzione deve rispondere PGRST202 per una RPC assente (è
  il comportamento documentato): il messaggio «serve la 0033» dipende da questo.
- Nessuna schermata per i periodi di fuori servizio (incarico separato).
- Nessuna schermata catturata: prove dal DOM e dalla rete.

## 🔴 GUIDA PER ANIA (SQL Editor di Supabase, 5 righe)

1. Apri SQL Editor → incolla TUTTO `supabase/proposte/0033_pagamenti_idempotenti.BOZZA.sql` → Run (si può rilanciare senza danni).
2. Poi incolla TUTTO `supabase/proposte/0034_room_closures.BOZZA.sql` → Run (dopo la 0033, mai prima).
3. Apri Statistiche sul telefono: la voce «Incassi registrati · storico da ricostruire» mostra l'elenco dei soggiorni conclusi da ricostruire con il totale.
4. Tocca «Conferma la ricostruzione» UNA volta: compare «Ricostruzione eseguita: N movimenti scritti — rileggo per conferma» e la voce torna «Incassi» senza avviso.
5. Da lì «Segna come pagato» e gli acconti passano dalle RPC (nessun doppione anche con la rete che cade); i periodi di fuori servizio si registreranno con la schermata dell'incarico successivo.

---

# Consegna — Statistiche, revisione Codex di 3248064 (R8–R13): candidato LOCALE, NON pubblicato

Stato: PRONTO PER REVISIONE (Codex). Nessun push, nessun deploy, nessun SQL
applicato, nessun accesso remoto, nessuna modifica a dati o permessi. Le
proposte 0033 e 0034 restano in `supabase/proposte/` fuori dalle migrazioni
operative. Decisione di Ania (definitiva, non rimessa in discussione): ogni
vecchio soggiorno svolto è stato pagato all'arrivo → la ricostruzione storica
è voluta e ora è riferibile, atomica e verificabile.

## VERIFICATO LOCALMENTE (un commit per rilievo sopra 3248064)

- R13 `dc51d7d` — `raccogliPagine`: tetto di pagine con l'ultima pagina
  piena → `ErroreLetturaIncompleta`, mai lista «completa» (test 50 × 1.000).
- R11 `68e7232` — `ricaviPerCamera`: media al mese da gennaio (o dal mese
  documentato di entrata in servizio); test: prima prenotazione in agosto,
  oggi agosto → 8 mesi, oggi settembre → 9.
- R8/R9/R10 server `6c9e621` — proposta 0033 riscritta: `payments.soggiorno`
  (identità canonica) accanto alla chiave; stessa chiave su altro soggiorno →
  `CHIAVE_RIUSATA` a zero effetti; chiave nulla / metodo sconosciuto /
  prenotazione non confermata → errore (mai «pagato» su in_attesa);
  `blocca_soggiorno` = advisory lock + FOR UPDATE ordinato; `segna_pagato` e
  `registra_acconto` ricalcolano nel database e verificano le righe;
  `ricostruisci_incassi` riceve SOLO `{ soggiorno, chiave }`, blocca, rilegge,
  ricalcola, scrive il saldo effettivo, rifiuta non conclusi/non validi,
  tutto-o-niente, esiti strutturati; EXECUTE revocato a PUBLIC. PGlite in
  sequenza (8 test) con le riproduzioni R8 (chiave riusata → D resta non
  pagata) e R9 (piano 200, acconto 50 prima → scrive 150, totale 200).
- R10/R8 client `8a65ca4` — un solo contratto (`eseguiSegnaPagato`,
  `eseguiRegistraAcconto`): chiave custodita PRIMA dell'invio (memoria
  negata → nessuna richiesta), rilettura prima di ogni tentativo, RPC che
  scrive anche il flag (nessun secondo PATCH, anche a saldo zero) o ripiego
  INSERT + flag su TUTTI i segmenti con righe verificate; `rpcMancante(e,
  nome)` solo per la funzione esatta; risposta nulla/malformata ≠ successo.
  10 controprove: risposta persa (INSERT e RPC), richiesta in volo alla
  riapertura, localStorage negato, rilettura fallita, RPC nulla/malformata,
  42703/42P01, flag a zero righe, doppio tocco e due schede, acconto con
  risposta persa e con memoria negata.
- R9 client `6bd0f8f` — piano con TUTTI i soggiorni conclusi non coperti
  (motivo: segnato pagato senza movimenti / concluso non segnato), in corso e
  futuri fuori ed elencati; alla RPC solo identità e chiavi; esito convalidato
  (`validaEsitoRicostruzione`); rete persa → «Non so se la ricostruzione è
  stata scritta: rileggo e ricontrollo il piano» (mai «nulla è stato scritto»).
- R12 `983d4ed` — proposta 0034 completa (date di servizio sulle camere,
  room_closures con RLS attiva e politiche per authenticated, revoke ad
  anon/PUBLIC), `leggiCamere` con ripiego senza colonne, `leggiFuoriServizio`
  a pagine (tabella assente = «non registrati», altri errori visibili),
  periodi passati a Home, intervalli, mesi e ricavi per camera; archivio di
  una camera = data (il passato resta). Catena database → lettura → KPI in
  PGlite (4 test). NESSUNA schermata per i periodi. R7 NON è operativa.

Prove UI (anteprima finta, 390 e 1280 px): quattro schede, «Incassi
registrati · storico da ricostruire», sezione di ricostruzione con motivi,
Segna come pagato con INSERT applicato e risposta persa → un solo movimento.

Prove tecniche sul candidato: suite 613/613 (17 test nuovi oltre a 3248064),
`tsc` OK, `next build` OK, lint dei file toccati 48 = 48 sulla base
(nessun rilievo nuovo), assert esistenti invariati.

## DA COLLAUDARE SU POSTGRESQL VERO (non fatto qui: nessun Postgres locale)

- `scripts/collaudo-0033/concorrenza.mjs` con `DATABASE_URL` di un database
  ISOLATO: due `segna_pagato` concorrenti da segmenti diversi → un movimento;
  due ricostruzioni concorrenti con chiavi diverse → una scrive; chiave
  riusata → `CHIAVE_RIUSATA`. Senza DATABASE_URL lo script esce con
  «DA COLLAUDARE» (codice 2). PGlite prova solo la sequenza.
- Politiche RLS della 0034 con un utente `authenticated` vero e con `anon`.

## DA AUTORIZZARE (Ania, dopo la revisione di Codex)

- Applicazione delle proposte 0033 e 0034 dopo il collaudo isolato.
- Push e deploy del candidato.
- Esecuzione della ricostruzione (tasto in Statistiche, dopo la 0033).

## Limiti aperti

- Senza la 0033 il ripiego INSERT protegge solo con la rilettura prima di
  ogni tentativo (non è atomico lato database).
- Nel finto server la tabella room_closures «esiste» vuota: il limite «periodi
  non registrati» si vede solo in produzione (PGRST205).
- Nessuna schermata (pannello nascosto): prove dal DOM e dalla rete.

---

# Consegna — Statistiche, revisione Codex di f4d5474 (R1–R7): candidato LOCALE `574824c`, NON pubblicato

Stato: PRONTO PER REVISIONE (Codex). Nessun push, nessun deploy, nessun SQL
applicato, nessun accesso remoto. Un commit per rilievo sopra `f4d5474`.

- R1 `932ff33` — «Segna come pagato» con recupero dell'esito
  (`lib/statistiche/pagato.eseguiSegnaPagato`): prima di ogni tentativo
  rilegge i pagamenti del soggiorno (rilettura fallita → si ferma, mai
  «pagamento assente»), calcola il saldo sui dati riletti, scrive il
  movimento con chiave stabile (RPC `segna_pagato` della 0033 se c'è,
  altrimenti INSERT), poi il flag. Chiave per prenotazione in localStorage
  finché l'operazione non riesce. Proposta `supabase/proposte/0033_pagamenti_
  idempotenti.BOZZA.sql` (chiave_operazione unique, origine, RPC atomica).
- R2 `42f90b1` — via il selettore `editForm.pagato` e il campo dall'update
  di Modifica: riga di sola lettura. Unico percorso = Segna come pagato.
- R3 `8ba85ca` — `oggiARoma` per movimento e acconti; niente toISOString.
- R4 `6952ff4` — occupazione per camera = notti ÷ giorni vendibili della
  camera (inizio anno o `in_servizio_dal`, fino a stanotte, meno chiusure);
  limite mostrato accanto al dato finché i fuori servizio non esistono.
- R5 `f2daf70` — ID a blocchi da 100 (`aBlocchi`, `raccogliBlocchi`):
  tutti raccolti, deduplicati, stop al primo errore senza parziali.
- R6 `05c083f` — ricostruzione una tantum (`pianoRicostruzione`): movimento
  «all'arrivo (ricostruito)», origine 'ricostruito', chiave stabile per
  soggiorno; schermata in Statistiche con elenco, totale e tasto di
  conferma; RPC `ricostruisci_incassi` (0033) in un'unica transazione,
  on conflict → nessun doppione; voce «Incassi registrati · storico da
  ricostruire» in Home e Statistiche finché il piano non è vuoto.
- R7 `574824c` — modello FuoriServizio, `tratteChiuse`/`nottiChiuse`
  (sovrapposti contati una volta) usati da intervallo, mese e camere;
  proposta `supabase/proposte/0034_room_closures.BOZZA.sql` (via da docs/).

## Riproduzioni sul percorso effettivo (anteprima finta, 390 px)

| ID | Prova | Esito |
| --- | --- | --- |
| R1a | Finto server che APPLICA l'INSERT del saldo ma perde la risposta: primo tocco → avviso «Non salvato, riprova: il pagamento non è stato registrato», 1 movimento sul server; secondo tocco → GET payments (recupero), NESSUN nuovo POST, PATCH pagato, finestra chiusa, bonifico non più «in attesa»; movimenti sul server: 1 (160 €) | VERDE (DOM e rete) |
| R1b | Stesso caso nel test puro (pagatoContratto.test): un solo movimento, flag pagato; rilettura fallita → nessuna scrittura | VERDE (4 test) |
| R1c | RPC segna_pagato in PGlite: stessa chiave due volte → un movimento; chiave diversa dopo il saldo → nulla; in_attesa → saldo 0 | VERDE (3 test) |
| R2 | Modifica: riga «Non ancora pagato / si segna dalla scheda…» senza interruttore; controprova sul codice: `pagato: true` solo nel segnaFlag di Segna come pagato, niente `editForm.pagato` | VERDE (DOM + test) |
| R3 | 5/9 22:30 UTC = 6/9 00:30 a Roma → paid_on 2026-09-06 (ora legale e solare) | VERDE (test) |
| R4 | Anno da gennaio, prima prenotazione in agosto → 30 notti su 243 giorni = 12 % (non 100 %); a schermo «5 notti · 2% occupazione su 248 giorni» + limite nel sottotitolo (prima: 63 % e 88 %) | VERDE (test + DOM) |
| R5 | 501 ID → 6 blocchi tutti letti e deduplicati; errore nel secondo blocco → nessun parziale | VERDE (test) |
| R6a | Piano: senza acconti, acconto parziale, coperto, annullato, in attesa, cambio camera, doppia esecuzione | VERDE (3 test) |
| R6b | Statistiche: «Incassi registrati · storico da ricostruire», sezione con «Storico Amelia · 2026-09-10 → 2026-09-12 · €160,00», totale, tasto «Conferma la ricostruzione (1 movimento, €160)»; RPC assente (PGRST202 simulata) → «Serve la migrazione 0033… nulla è stato scritto»; Home «INCASSI REGISTRATI · storico da ricostruire» | VERDE (DOM 390 e 1280) |
| R6c | RPC ricostruisci_incassi in PGlite: prima esecuzione 1 scritto, seconda 0 scritti / 1 saltato, riga unica con origine 'ricostruito'; movimento non ricostruito rifiutato | VERDE (test) |
| R7 | Intervalli sovrapposti/contigui/sconfinanti → 15 notti chiuse (non 18); notti vendibili e del mese sottraggono la stessa notte una volta | VERDE (2 test) |

## Prove tecniche

- `node scripts/verifica-consegna.mjs --base f4d5474` su `574824c`: Suite
  applicazione (596 test, 19 nuovi) OK, Regressioni OK, Strumenti locali OK,
  TypeScript OK; «Lint dei file modificati» STOP con 48 rilievi = gli stessi
  48 dei file toccati sulla base f4d5474 (nessun rilievo nuovo). Assert dei
  test esistenti invariati.
- `next build`: compilato. UI a 390 e 1280 px sull'anteprima finta.

## Ciò che richiede migrazione e autorizzazione (NON applicato)

- `supabase/proposte/0033_pagamenti_idempotenti.BOZZA.sql`: colonne
  `payments.chiave_operazione` (unique) e `payments.origine`; RPC
  `segna_pagato` (atomica, idempotente) e `ricostruisci_incassi` (una
  transazione, nessun doppione). Senza di essa: Segna come pagato usa il
  contratto di recupero (rilettura + INSERT) e la ricostruzione dello storico
  NON può partire (il tasto lo dice).
- `supabase/proposte/0034_room_closures.BOZZA.sql`: periodi di fuori
  servizio per camera; senza, il denominatore usa solo `rooms.active`.
- Push e deploy: dopo la revisione di Codex.

## Limiti aperti

- La riproduzione R1a nel pannello è con fetch sostituito da javascript_tool
  (il finto server rifiuta le scritture); la RPC è provata solo in PGlite.
- `aggiungiAcconto` (acconti a mano) ha ancora INSERT diretto senza chiave:
  stesso rischio di doppione dopo risposta persa, fuori dai rilievi.
- `in_servizio_dal` non esiste in `rooms`: vale l'inizio dell'anno.
- Nessuna schermata (pannello nascosto): prove dal DOM e dalla rete.

---

# Consegna — Statistiche, numeri corretti (05/09/2026, notte, main)

Obiettivo: ogni numero di Statistiche e Home è corretto e ha un significato
esplicito; nessun grafico o KPI nuovo. Il branch `statistiche` (df316f4) è
stato unito a main con un merge pulito (`5a4a5ee`); da lì tutti i calcoli
passano da `lib/statistiche` (funzioni pure, 32 test) e le letture da
`lib/statisticheDati` (solo il periodo, a pagine, errori come testo).

- Pezzo 0 — merge `5a4a5ee` + `a42ad8d` (intervallo, camere, sconti,
  cliente, pagato, paginazione; 20 test con i casi di bordo: cambio camera a
  metà, in_attesa mescolate, acconto + saldo, pagamento in un mese diverso
  dal soggiorno, camera fuori servizio, periodo vuoto, sovrapposizione).
- Pezzo 1 — `09221f5`: solo confermate/completate ovunque (query con
  `status in (confermata, completata)`; in_attesa e annullate mai); storico
  cliente: «Soggiorni» per group_id, totale speso solo confermate.
- Pezzo 2 — `e7c6895`: quattro voci identiche in Home e Statistiche, con
  la riga di spiegazione: «Ricavi per soggiorno» (valore delle prenotazioni
  diviso sulle notti dormite), «Incassi» (movimenti di payments per data di
  pagamento), «Spese» (per data di pagamento: paid_at, altrimenti
  expense_date), «Saldo di cassa» (incassi meno spese; era «Profitto»);
  «Rendimento camere» → «Ricavi per camera»; grafico e tabella = Incassi /
  Spese / Saldo di cassa; Tariffa media = ADR del mese.
- Pezzo 3 — `eb0e7e4`: occupazione = notti vendute ÷ notti vendibili delle
  camere ATTIVE per giorno (`rooms.active`), mai «4 × giorni»; oltre il
  100 % non si blocca: cella «104!» e riga «Settembre: sovrapposizione da
  controllare (125 notti su 120)», in Home la spiegazione diventa l'anomalia;
  `docs/bozza-migrazione-room_closures.sql` NON applicata (periodi di fuori
  servizio per camera).
- Pezzo 4 — `3e00098`: «Segna come pagato» mostra il saldo mancante e i
  metodi (contanti, bonifico, carta, altro), registra PRIMA il movimento in
  payments (data di oggi) e POI il flag; movimento rifiutato → flag invariato
  e «Non salvato, riprova: il pagamento non è stato registrato»;
  `incongruenzePagamenti` solo funzione e test (niente pannello).
- Pezzo 5 — `00b52e2` + `134afae`: letture solo del periodo (anno letto
  per Statistiche, mese allungato a domani per Home), `raccogliPagine` oltre
  le 1.000 righe (mai liste parziali), ogni errore → AvvisoAzione + Riprova
  in entrambe le pagine, mai uno zero credibile.
- Pezzo 6 — dentro `a42ad8d`: `indiciIntervallo` (occupazione = vendute ÷
  vendibili, ADR = ricavi camere ÷ notti vendute, RevPAR = ricavi camere ÷
  notti vendibili, notti libere), testato, non mostrato.

## Numeri che sono cambiati (dati finti di settembre 2026, oggi 05/09)

| Voce | Prima | Dopo | Motivo |
| --- | --- | --- | --- |
| Home «Entrate mese» → «Ricavi per soggiorno» | 1.950 € | 1.843 € | prima: totale delle prenotazioni con check-in nel mese, compresa una richiesta in attesa (160 €) e i soggiorni a cavallo per intero; ora: solo confermate, ripartite sulle notti dormite nel mese |
| Home «Profitto» → «Saldo di cassa» | entrate − spese | incassi − spese (0 €) | il profitto mescolava competenza e cassa; il saldo è cassa contro cassa |
| Home/Statistiche «Occupazione» | 23 % (27 notti su 4 × 30) | 21 % (25 su 120 delle camere attive) | 2 notti in attesa non contano; denominatore = camere attive |
| Home «Tariffa media» | 81 € (media di price_per_night) | 74 € (ADR: ricavi ÷ notti vendute) | la media dei listini non pesava le notti né gli sconti/letti |
| Statistiche «Entrate» → «Incassi» | saldo PRESUNTO alla consegna delle chiavi per i soggiorni senza righe (regola 24/07) | solo movimenti registrati in payments (0 € nei dati finti) | il brief definisce Incassi = movimenti per data di pagamento; da oggi «Segna come pagato» registra il movimento, quindi i nuovi incassi saranno completi; lo storico senza righe NON compare più negli incassi (vedi azione per Ania) |
| Statistiche «Rendimento camere» → «Ricavi per camera» | «incassi» pro-quota, con le in attesa | ricavi per soggiorno, solo confermate, camere attive | stesso significato dei ricavi |
| Occupazione (tabella anni × mesi) | tutti gli anni, bloccata a 100 | solo l'anno letto, anomalia esplicita oltre il 100 | letture del solo periodo; mai un valore falsato |
| Storico cliente «Soggiorni» | righe (segmenti) non annullate | soggiorni per group_id, solo confermate | un cambio camera è un soggiorno |

## Casi di accettazione

| ID | Prova | Esito |
| --- | --- | --- |
| H01 | Home e Statistiche mostrano gli STESSI numeri di settembre (1.843 / 0 / 0 / 0, occupazione 21 % = 25 su 120, ADR 74) | VERDE (DOM 390 e 1280 px) |
| H02 | Statistiche: quattro schede con spiegazione, tabella Incassi/Spese/Saldo di cassa, «Ricavi per camera», nessuno scorrimento orizzontale a 390 | VERDE (DOM 390 e 1280) |
| H03 | Occupazione oltre il 100 % (prenotazioni quintuplicate via fetch): cella «104!» e «Settembre: sovrapposizione da controllare (125 notti su 120)» | VERDE (DOM 390) |
| H04 | Segna come pagato: finestra con «Registro un pagamento di €160,00…», metodi, Conferma → POST payments rifiutato (403) → avviso, flag invariato, nessun PATCH | VERDE (DOM e rete 390) |
| H05 | Home con lettura incassi senza rete: nessuna scheda con zeri, AvvisoAzione «Non riesco a caricare gli incassi: nessuna connessione» + Riprova → schede | VERDE (DOM 390) |
| H06 | Statistiche con errore di lettura → AvvisoAzione + Riprova | VERDE per costruzione (stessa funzione della Home); non riprodotto a schermo |
| H07 | Casi di bordo delle funzioni pure (elenco sopra) | VERDE (32 test) |

## Prove tecniche

- `node scripts/verifica-consegna.mjs --base 55576fd` su `3e00098`: Suite
  applicazione (577 test, 32 nuovi) OK, Regressioni OK, Strumenti locali OK,
  TypeScript OK; «Lint dei file modificati» STOP con 52 rilievi contro i 70
  degli stessi file sulla base (18 in meno: le formule con `any` delle pagine
  sono sparite); nessun rilievo nuovo; librerie nuove pulite.
- `next build` sul candidato: compilato.
- UI a 390 e 1280 px sull'anteprima finta (settembre 2026, nessun pagamento
  e nessuna spesa nei dati finti).
- Nessuna migrazione applicata; lib/spese solo letta (family_expenses:
  expense_date, amount, paid_at).

## Limiti aperti

- «Incassi» ora conta SOLO i movimenti registrati: i soggiorni passati
  pagati alla consegna delle chiavi senza riga in payments (regola 24/07)
  non compaiono più negli incassi né nel saldo di cassa. Le incongruenze
  «pagato senza movimenti» sono già elencabili (`incongruenzePagamenti`) ma
  senza pannello: decisione di Ania se registrare a mano lo storico o
  accettare che gli incassi partano da oggi.
- Fuori servizio per camera: solo il flag `rooms.active` senza date; la
  bozza SQL in docs/ resta da decidere.
- «Spese» legge family_expenses con `paid_at`/`expense_date` ma non la
  parte spese nuova (in corso): da riallineare quando quella chiude.
- La tabella dell'occupazione mostra solo l'anno letto (prima tutti gli
  anni): scelta del brief «mai tutto lo storico»; le frecce cambiano anno.
- Nessuna schermata (come sempre in questo pannello): prove dal DOM.

---

# Consegna — Errori di salvataggio visibili, parte 3: CHIUSURA (05/09/2026, sera, main)

Scheda «errori di salvataggio visibili» COMPLETATA (parti 1, 2 e 3), con la
sola eccezione di `lib/spese` (parte spese in corso: `lib/spese/dati.ts:79-114`
sette scritture void e `:51` return null restano per l'incarico che chiude le
spese). Stessa regola e stessi mattoni: `lib/scritturaSicura`,
`lib/prenotazioneScritture.leggiConEsito`, `components/AvvisoAzione`.

- Pezzo 1 — `lib/richiesteContatore` (pura, 4 test) + `lib/richiesteDati`:
  contaRichiesteAperte torna l'esito (mai 0 su errore); stato UNICO per
  tutta l'app con `useRichiesteAperte` e `ricaricaRichiesteAperte`; barra:
  bollino «!» sulle Richieste; pagina Richieste: avviso in AvvisoAzione con
  «Riprova» (ricarica pagina e contatore) e niente «Nessuna richiesta in
  attesa» quando le richieste non sono lette. Commit `6e29de8`.
- Pezzo 2 — `lib/inviaPush` (4 test con finto client e finto invio): lettura
  delle sottoscrizioni controllata (errore esplicito, non «zero telefoni»),
  delete delle scadute controllato (se fallisce conta negli errori, non tra
  le rimosse), VAPID configurato alla prima chiamata; `lib/pushLog`: error
  letto e scritto nel log del server, catch voluto e spiegato. Commit `f3ca1c9`.
- Pezzo 3 — `app/prenotazioni` lista con leggiConEsito (avviso + Riprova,
  mai «Nessuna prenotazione» su errore); `components/DocumentiCliente`
  anteprime con error controllato → «Non riesco a mostrare le anteprime dei
  documenti, riprova» + Riprova (`raccogliAnteprime`, 1 test);
  `lib/cronLettura` (4 test) per `/api/push/send|orario|ringraziamento|
  pulizie|test` e `lib/puliziePush`: lettura fallita → 500 col motivo,
  invio a zero telefoni con errori → 500, mai 200 su un fallimento.
  Commit `677dd68`.
- Pezzo 4 — `lib/memoriaBrowser` (4 test) + `components/WebRequestAlert`:
  via i catch vuoti su sessionStorage; ripiego esplicito e commentato
  (senza memoria la finestra si ripropone a ogni apertura, «Dopo» chiude
  comunque, nessun avviso perché è il browser). Commit `72f81b6`.
- Pezzo 5 — `app/prenotazioni/[id]`: sendWhatsapp e markComplete RIMOSSE.
  Verifica: sendWhatsapp non chiamata dal commit 5a3cf49 (bottoni WhatsApp
  diventati link diretti waHref/waClick per Safari) e il suo insert nel log
  non attendeva l'esito; markComplete scollegata dal commit 5574a59
  («Completata» tolto su richiesta di Ania), nessun altro codice assegna lo
  stato completata. Nessun cambiamento di comportamento, due avvisi lint in
  meno. Commit `095b05f`.

## Casi di accettazione

| ID | Prova | Esito |
| --- | --- | --- |
| G01 | Home: bollino Richieste «!» quando il conteggio fallisce (nel finto il HEAD risponde 403); Calendario «1» | VERDE (DOM 390 px) |
| G02 | Pagina Richieste con lettura richieste senza rete (fetch sostituito): avviso «Non riesco a leggere alcuni dati: richieste…» + Riprova, bollino «!», nessun «Nessuna richiesta in attesa»; Riprova con rete → avviso via, bollino «2» (conteggio finto) anche sulla barra | VERDE (DOM 390 px) |
| G03 | inviaATutti: scaduta + delete rifiutato → errori, rimosse 0; lettura sottoscrizioni fallita → errore esplicito, nessun invio; 500 dal servizio → errori | VERDE (test) |
| G04 | Lista prenotazioni senza rete → «Non riesco a caricare le prenotazioni: nessuna connessione» + Riprova, nessun «Nessuna prenotazione»; Riprova → 14 schede | VERDE (DOM 390 px) |
| G05 | Documenti: un documento (finto) con URL firmato negato → riga presente, casella «…», avviso «Non riesco a mostrare le anteprime…» + Riprova; Riprova con firma ok → immagine, avviso via | VERDE (DOM 390 px) |
| G06 | Route push: lettura fallita → ErroreLetturaCron → 500 col motivo; data null → fallita; invio a zero con errori → 500, parziale → 200 | VERDE (test `cronLettura`; route non chiamabili in locale senza CRON_SECRET) |
| G07 | Finestra richieste con sessionStorage negato: «Dopo» la chiude senza eccezioni; alla riapertura si ripropone (firma non ricordata) | VERDE (DOM 390 px) |
| G08 | Scheda prenotazione dopo la rimozione: nome, 36 link WhatsApp, «Annulla prenotazione» presenti | VERDE (DOM 390 px) |

## Prove tecniche

- `node scripts/verifica-consegna.mjs --base 2886305` su `095b05f`: Suite
  applicazione (545 test, 17 nuovi) OK, Regressioni OK, Strumenti locali OK,
  TypeScript OK; «Lint dei file modificati» STOP con 45 rilievi contro i 47
  degli stessi file sulla base (tutti preesistenti, due in meno): nessun
  rilievo nuovo; librerie nuove pulite.
- `next build` sul candidato: compilato.
- UI a 390 px sull'anteprima finta (rete assente simulata da javascript_tool).
- Nessuna migrazione, nessun cambiamento di schema, nessuna scrittura reale.

## Limiti aperti

- Nessuna schermata (come nelle parti 1 e 2): prove dal DOM e dalla rete.
- Le route `/api/push/*` sono provate solo con i test delle funzioni pure:
  in locale non hanno CRON_SECRET e in produzione una chiamata invierebbe
  notifiche vere.
- Il bollino Richieste nell'anteprima finta è «!» di suo (il finto rifiuta
  le HEAD): il «2» del caso G02 viene da una risposta finta di conteggio.
- ECCEZIONE annotata: `lib/spese` non toccata (parte spese in corso).

---

# Consegna — Errori di salvataggio visibili, parte 2 (05/09/2026, sera, main)

Seconda tornata sulla stessa regola della scheda qui sotto: ogni scrittura o
lettura su Supabase controlla `error`; con errore lo stato locale NON cambia,
il bottone torna attivo, l'avviso compare vicino all'azione
(`components/AvvisoAzione`, testi «Non salvato, riprova» / «Non riesco a …»);
niente alert del browser, niente catch vuoti, niente liste vuote o null al
posto di un errore. Librerie riusate: `lib/scritturaSicura`; nuove funzioni
pure senza import di Supabase: `lib/prenotazioneScritture` (salvaInSequenza,
leggiConEsito) e `lib/arrivoOrario` (salvaOrarioENavetta).

- Pezzo 1 — `app/clienti/[id]`: «Sì, elimina» e «Salva» con esito; anche il
  caricamento («Non riesco a caricare il cliente…» + Riprova invece di
  «Cliente non trovato» per un errore di rete). Commit `0d464eb`.
- Pezzo 2 — `app/prenotazioni/[id]`: `rileggiScheda` (dopo un salvataggio
  riuscito la rilettura aggiorna solo se riesce, altrimenti mostra quello che
  si è appena salvato con «Salvato, ma non riesco a ricaricare la scheda:
  riaprila…», mai «Prenotazione non trovata»), usata da Modifica, Rimuovi
  sconto e date del soggiorno; update del cliente in Modifica controllato;
  date del soggiorno con `salvaInSequenza` («Non salvato, riprova» o «Salvato
  solo in parte, riprova e controlla le date di ogni camera»); cambio camera,
  completata, motivo dell'annullamento con `scriviPoiAggiorna`; annullamento
  senza alert (avviso nella finestra, «Annullo...»), log WhatsApp non scritto
  segnalato nella schermata di conferma. Commit `d13eb33`.
- Pezzo 3 — `app/impostazioni` saveRoom: tariffe a schermo solo se salvate,
  modifiche in bozza con l'avviso. Commit `16abb14`.
- Pezzo 4 — `app/nuova`: update del cliente esistente controllato prima
  dell'insert (con errore niente prenotazione); 5 letture dello storico in
  `caricaStorico` con «Non riesco a caricare lo storico del cliente…» +
  Riprova. Commit `cc47291`.
- Pezzo 5 — `app/arrivi` saveTime: secondo tentativo (solo orario) con
  esito; niente alert; con errore il pannello resta aperto. Commit `0c99645`.

## Casi di accettazione

| ID | Prova | Esito |
| --- | --- | --- |
| F01 | Cliente: Salva rifiutato (403) → «Non salvato, riprova», modulo aperto, nome invariato; Sì, elimina rifiutato → avviso nella finestra, URL invariato | VERDE (DOM 390 px) |
| F02 | Cliente: caricamento senza rete (fetch sostituito) → «Non riesco a caricare il cliente: nessuna connessione» + Riprova; Riprova con rete → scheda | VERDE (DOM 390 px) |
| F03 | Prenotazione: annullamento rifiutato → avviso nella finestra, prenotazione ancora confermata, bottone attivo; cambio camera rifiutato → avviso, nessuna navigazione; motivo annullamento rifiutato → avviso | VERDE (DOM 390 px) |
| F04 | Prenotazione: Modifica con update finto riuscito (fetch sostituito, PATCH 204) e rilettura senza rete → scheda visibile coi dati salvati + «Salvato, ma non riesco a ricaricare la scheda…», mai «Prenotazione non trovata» | VERDE (DOM 390 px) |
| F05 | Date del soggiorno: primo segmento rifiutato → nessun update, «Non salvato, riprova»; secondo rifiutato → «Salvato solo in parte…»; rilettura fallita → dati locali dal piano | VERDE (test; a schermo non riproducibile: i dati finti non hanno cambi camera) |
| F06 | Impostazioni: Salva rifiutato → avviso, tariffa mostrata invariata (50), bozza 55 conservata, bottone attivo | VERDE (DOM 390 px) |
| F07 | Nuova: cliente esistente, Salva prenotazione con update cliente rifiutato → «Non salvato, riprova: i dati del cliente non sono stati salvati», nessun POST su bookings, bottone attivo | VERDE (DOM e rete 390 px) |
| F08 | Nuova: storico del cliente senza rete → avviso + Riprova | VERDE (test `leggiConEsito`; a schermo non riprodotto, vedi limiti) |
| F09 | Arrivi: Salva orario+navetta con entrambi i tentativi rifiutati → avviso nel pannello, pannello aperto, bottone attivo; colonna shuttle assente e orario salvato → avviso 0019 nel pannello | VERDE (DOM 390 px il primo; test il secondo) |

## Prove tecniche

- `node scripts/verifica-consegna.mjs --base e2a5316` su `0c99645`: Suite
  applicazione (528 test, 17 nuovi: prenotazioneScritture 7, arrivoOrario 3,
  scritturaSicura.parte2 7) OK, Regressioni delle revisioni OK, Strumenti
  locali OK, TypeScript senza emissione OK; «Lint dei file modificati» STOP
  con 63 rilievi = gli stessi 63 dei 5 file sulla base e2a5316 (confronto
  fatto sugli stessi file: nessun rilievo nuovo); le librerie nuove sono pulite.
- `next build` sul candidato: compilato, 30 pagine generate.
- UI a 390 px sull'anteprima finta (3213, scritture rifiutate con 403; rete
  assente simulata sostituendo fetch da javascript_tool; interruttore
  `/finto/errore-richieste-web` invariato): casi F01–F04, F06, F07, F09.
- Nessuna migrazione, nessun cambiamento di schema, nessuna scrittura reale.

## Limiti aperti

- Nessuna schermata (stessi motivi della parte 1): prove dal DOM e dalla rete.
- F08 non riprodotto a schermo: nel pannello nascosto /nuova aperta
  direttamente resta sul segnaposto di Suspense (anche sul codice di base,
  non dipende dalle modifiche); con la navigazione interna funziona ma la
  ricerca finta non ha permesso di osservare l'avviso in tempo. Coperto dal
  test e dallo stesso schema del cliente (F02).
- F05 e il ramo «solo orario» di F09 solo con i test (dati finti senza cambi
  camera; il finto rifiuta ogni scrittura, non una sola colonna).
- Lint: i file toccati conservano ESATTAMENTE i rilievi di prima (clienti 6,
  prenotazioni 30, impostazioni 7, nuova 2, arrivi 22, tutti `any` e simili
  preesistenti); il passo lint del verificatore resta rosso per quelli.

## Punti residui (da un incarico successivo, per scelta del brief)

- `lib/spese/dati.ts:79-114` (7 funzioni di scrittura void, `:51` return null) — parte spese in corso.
- `lib/richiesteDati.ts:27` contaRichiesteAperte → 0 su errore (bollino Richieste).
- `lib/pushLog.ts:19` catch {} (voluto) e `lib/inviaPush.ts:47` delete senza controllo.
- `components/WebRequestAlert.tsx:47,58` catch {} su sessionStorage (browser).
- Letture senza `error` restanti: `app/prenotazioni/page.tsx:36`, `app/api/push/*`,
  `components/DocumentiCliente` e `lib/spese` (URL firmati).
- `app/prenotazioni/[id]` sendWhatsapp (funzione non usata) inserisce nel log
  senza attendere l'esito; `markComplete` non è collegato a nessun bottone.

---

# Consegna — Errori di salvataggio visibili (05/09/2026, pomeriggio, main)

Difetto: alcune azioni aggiornavano lo schermo senza guardare `error` nella
risposta di Supabase. Ania poteva credere di aver confermato una camera o
segnato un bonifico come pagato quando sul server non era cambiato nulla; un
errore di lettura delle richieste dal sito appariva come «nessuna richiesta».

Regola applicata: ogni chiamata controlla `error`; con un errore lo stato
locale NON cambia, il bottone torna attivo e compare un messaggio in italiano
vicino all'azione (verde scuro #1F3D2F su crema #F6F2EA, bordo #C9BFA8,
`components/AvvisoAzione`), niente alert del browser, nessun catch vuoto.

- Pezzo 1 — Conferma prenotazione (`app/prenotazioni/[id]`): passa da
  `scriviPoiAggiorna` (`lib/scritturaSicura`, 7 test): «confermata» sullo
  schermo solo a update riuscito; altrimenti «Non salvato, riprova» sotto il
  bottone, che torna attivo. Commit `6441a36`.
- Pezzo 2 — Segna come pagato: stessa regola, bottone disattivato durante il
  salvataggio («Salvo...»); logica pagato/movimenti invariata. Commit `2e05cb8`.
- Pezzo 3 — Richieste dal sito (`lib/richiesteDalSito` pura con 5 test,
  `lib/webRequests` con stato unico per tutta l'app): la lettura torna sempre
  `{ richieste, errore }`, mai `[]` su errore. Home: riga sotto la data con
  TRE stati («Controllo le richieste dal sito…», «Nessuna richiesta dal sito
  da confermare.», «🌐 N richieste dal sito da confermare · Nome» → Calendario)
  e con l'errore il riquadro «Non riesco a caricare le richieste dal sito,
  riprova» + «Riprova» (senza rete: «…: nessuna connessione»). Barra: bollino
  «!» sul Calendario quando la lettura fallisce. La finestra all'apertura non
  si apre con un errore. Commit `a3d393c`.
- Pezzo 4 — Ricognizione (NON corretta, elenco nel resoconto della sessione e
  qui sotto).

## Casi di accettazione

| ID | Prova | Esito |
| --- | --- | --- |
| E01 | Conferma con update rifiutato (anteprima finta, PATCH 403): avviso «Non salvato, riprova», bottone attivo, scheda ancora in attesa; test `scritturaSicura` | VERDE (DOM e rete a 390 px) |
| E02 | Conferma riuscita: stato confermata, nessun avviso | VERDE (test; a schermo non riproducibile nella finta, che rifiuta ogni scrittura) |
| E03 | Segna come pagato con update rifiutato: avviso, bottone attivo, bonifico ancora in attesa | VERDE (DOM e rete a 390 px) |
| E04 | Home con lettura richieste fallita (interruttore `GET /finto/errore-richieste-web?on=1`): riquadro crema con «Riprova», bollino «!», finestra chiusa, dati della home comunque mostrati | VERDE (390 px) |
| E05 | «Riprova» dopo il ripristino: riga «1 richiesta dal sito…» e bollino «1» anche sulla barra (stato condiviso) | VERDE (390 px) |
| E06 | Zero richieste → «Nessuna richiesta dal sito da confermare.»; errore dopo lettura riuscita → le richieste già mostrate restano | VERDE (test `richiesteDalSito`) |
| E07 | Eccezione di rete (fetch) → messaggio con «nessuna connessione», nessun catch silenzioso | VERDE (test) |

## Prove tecniche

- `node scripts/verifica-consegna.mjs --base a2c6f67` su `a3d393c`: Suite
  applicazione (511 test, di cui 12 nuovi) OK, Regressioni delle revisioni OK,
  Strumenti locali OK, TypeScript senza emissione OK; «Lint dei file
  modificati» STOP con 67 rilievi = i 30 di `app/prenotazioni/[id]/page.tsx`
  + i 37 di `app/page.tsx` già presenti sulla base (conteggio identico file
  per file); i file nuovi (`lib/scritturaSicura`, `lib/richiesteDalSito`,
  `lib/webRequests`, `components/AvvisoAzione`, `BottomNav`,
  `WebRequestAlert`, anteprima finta) sono puliti.
- `next build` sul candidato: compilato, 30 pagine generate.
- UI a 390 px sull'anteprima finta `gestionale-bnb-anteprima-prenotazioni-finta`
  (3213, dati sintetici, scritture rifiutate con 403): casi E01, E03, E04, E05.
- Nessuna migrazione, nessun cambiamento di schema, nessuna scrittura reale.

## Limiti aperti

- Nessuna schermata: il pannello del browser era nascosto (immagini a metà) e
  Chrome headless in questo ambiente resta appeso su `captureScreenshot`; le
  prove a 390 px sono dal DOM (testi, colori calcolati, `disabled`) e dalla rete.
- Il caso «scrittura riuscita» non è riproducibile a schermo nell'anteprima
  finta (solo lettura): coperto dai test.
- Lo stato «Controllo le richieste dal sito…» dura pochi ms in locale: coperto
  dal test dello stato iniziale, non osservato a schermo.
- Lint: `app/prenotazioni/[id]/page.tsx` (30 rilievi) e `app/page.tsx` (37)
  avevano già gli stessi rilievi prima dell'incarico (`any`, import inutili):
  nessuno nuovo, ma il passo «Lint dei file modificati» del verificatore resta
  rosso finché quei file non vengono ripuliti.

## Pezzo 4 — stesso difetto altrove (da correggere in un incarico dedicato, per rischio)

1. `app/clienti/[id]/page.tsx:33` `deleteGuest` e `:39` `save`: delete/update
   dei clienti senza controllo, poi navigazione o stato locale aggiornato.
2. `app/prenotazioni/[id]/page.tsx:906-927` `saveStayEdit`: update dei segmenti
   (date, annullamenti) senza controllo, poi rilettura senza `error` (`:936`).
3. `app/prenotazioni/[id]/page.tsx:780` update del cliente dentro `saveEdit`
   e `:791` rilettura `const { data: updated }` senza `error` → `setBooking(null)`
   («Prenotazione non trovata») se la rilettura fallisce dopo un salvataggio riuscito.
4. `app/prenotazioni/[id]/page.tsx:950` `addRoomChange` (group_id), `:961`
   `markComplete`, `:972` insert nel log WhatsApp, `:1754` motivo annullamento.
5. `app/impostazioni/page.tsx:105` `saveRoom`: tariffe camere aggiornate a
   schermo anche se l'update fallisce.
6. `app/nuova/page.tsx:355` update del cliente esistente prima dell'insert
   della prenotazione.
7. `app/arrivi/page.tsx:251` secondo tentativo senza controllo (ripiego 0019)
   con `alert` del browser.
8. `lib/spese/dati.ts:79-114` (`eliminaScontrino`, `aggiornaNotaScontrino`,
   `inserisciSpesa`, `eliminaSpesa`, `salvaBudget`, `aggiornaBudget`,
   `eliminaBudget`): funzioni `void` senza esito, i chiamanti non possono
   sapere se hanno scritto; `:51` `return null` su errore (sezione nascosta).
9. `lib/richiesteDati.ts:27` `contaRichiesteAperte` → `return 0` su errore
   (bollino Richieste = «zero» anche con la lettura fallita).
10. `lib/pushLog.ts:19` `catch {}` sull'insert del log push (voluto: non
    blocca la notifica) e `lib/inviaPush.ts:47` delete senza controllo.
11. Letture senza `error` (`const { data } = await supabase…`): `app/nuova`
    (storico cliente ×5), `app/prenotazioni/page.tsx:36`, `app/api/push/*`,
    `components/DocumentiCliente` e `lib/spese` (URL firmati).
12. `components/WebRequestAlert.tsx:47,58` `catch {}` su sessionStorage
    (memoria del browser, non Supabase): da annotare con un commento.
13. Alert del browser ancora presenti: `cancelBooking` (`app/prenotazioni/[id]`),
    `app/arrivi/page.tsx:253`.

---

# Consegna — Prezzo notte per notte quando le persone cambiano (04/09/2026, sera, main)

Caso reale: Lena, 2 notti, prima notte in 2 e seconda in 3. Il letto in più
era segnato solo sulla seconda notte ma il prezzo applicava 90 € a entrambe
(180 €). Ora 80 + 90 = 170 €. Con persone uguali in tutte le notti il conto
è IDENTICO a prima (test dedicato).

- Fonte unica: `lib/prezzoNotti.ts`. Le persone di ogni notte di una
  prenotazione vengono da num_guests + extra_bed_dates (la stessa fonte dei
  letti aggiuntivi): nelle notti col letto num_guests persone, nelle altre la
  capienza base; senza notti col letto, num_guests ovunque (regola di sempre).
- Salvataggio SENZA migrazione, stessa convenzione della RPC 0031:
  price_per_night = tariffa della notte più economica, extra_bed_total =
  resto, total_amount = somma delle notti. `contoSoggiorno` resta esatto.
- Il campo «Tariffa/notte» del form segue il listino della notte più economica
  (si riallinea togliendo/aggiungendo notti col letto o cambiando date); se
  scritto a mano resta e sposta tutte le notti della stessa differenza.
- Ricalcolo: cambiare le notti col letto è già un campo economico (le date
  del letto erano nel confronto); all'apertura di «Modifica» una riga salvata
  col vecchio calcolo (tariffa a persone massime) viene riallineata, così il
  salvataggio ricalcola e l'anteprima dice «Da €180 a €170».
- Dove la tariffa non è uniforme si mostra il dettaglio («1 notte in 2 a
  80 €, 1 notte in 3 a 90 €») al posto di un prezzo a notte: scheda (lettura,
  modifica, cambio camera), storico cliente in /nuova, riepilogo di /nuova,
  conferma WhatsApp (testo e immagine, stessa funzione `righeCostiSegmenti`
  ora usata anche dal testo della scheda), immagine della proposta. Uniforme
  = come oggi. Il calendario conta le notti coperte dagli acconti con la
  tariffa di ogni notte.
- Proposte: `segmento()` usa la stessa funzione (numeri invariati, test di
  uguaglianza proposta ↔ prenotazione). Testi definitivi non toccati.

## Casi di accettazione (lib/prezzoNotti.test.ts, 12 test)
persone costanti invariato (Lena 2/3/4, Ambra 2/3, Amelia 1/2) · Lena 2 poi 3
= 170 · 3 poi 2 = 170 · 2-3-2 = 250 · Lena a 4 = 100 a notte (2 poi 4 = 180)
· Ambra letto una notte sola invariato · tariffa a mano · proposta =
prenotazione · righe del riepilogo (mista, uniforme, riga vecchia col bug →
totale salvato) · riallineamento del campo tariffa · persone dai letti · testo.

## Prove
`npm test` 473 verdi (461 + 12), `tsc` pulito, lint del delta senza nuovi
rilievi (31 pre-esistenti nelle due pagine). UI sull'anteprima finta 3213
(dati aggiunti: «Due Poi Tre» 14–16 set salvata nel modo nuovo, «Vecchio
Calcolo» 18–20 set col bug): scheda «Tariffa: 1 notte in 2 a €80, 1 notte in
3 a €90 · Totale €170»; modifica: aggiungendo la notte 14 → 90 e 180,
togliendola → 80 e 170, a mano 85 → 85/95; riga vecchia: lettura 90/180,
modifica → 80 e «Da €180 a €170 (ricalcolato dai nuovi dati)»; conferma
WhatsApp testo e immagine «Camera Lena – Tripla (1 notte in 2 a 80,00 €, 1
notte in 3 a 90,00 €): 170,00 €»; /nuova a 3 notti con letto solo il 24 →
«2 notti in 2 a €80, 1 notte in 3 a €90 · Totale €250»; calendario carica.
Nessun salvataggio reale (la preview rifiuta le scritture). Build non rieseguita.

## Limiti
- La riga già salvata col bug resta 180 € finché Ania non apre «Modifica» e
  salva (il totale salvato è autorevole): nessun dato viene riscritto da solo.
- Nel cambio date di un soggiorno con cambio camera il letto di Lena a 3 non
  viene più addebitato a parte (prima 10 €/notte in più: era un errore).

---

# Consegna attiva — incarico del 04/09/2026: elisione, /richieste da desktop, pulizia e documentazione (blocchi 1–3, main)

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| B1 | Apostrofo solo per 1, 8, 11 in tutte le forme (al/dal/del); 18, 21, 28, 31 senza; l'esempio di Candida identico. | `richiesteTesti.test` (casi espliciti) | VERDE |
| B2a | Calendario desktop: selettore «Mese / 2 settimane» (default 2 settimane su desktop, mese sul telefono, in localStorage); a 2 settimane colonne ≥ 72 px con «Nome C.» intero e scorrimento con la colonna di oggi in vista; nel mese tooltip con nome completo, date, persone, camera, stato. | UI 1280/1440 + test degli helper | VERDE |
| B2b | Lista da 768 px: righe ariose, nome in Fraunces 16 px, dettagli 13 px, pulsanti a destra su una riga, badge ⇄ e «si sovrappone con…» su riga propria in ottone; lista ≥ 380 px; fra 768 e 1100 px calendario sopra e lista sotto. | UI 1280/1440/900 | VERDE |
| B2c | Intestazione desktop su una riga: titolo, «N nuove dal sito», «N da guardare», Reale/Presunta, «+ Nuova richiesta». | UI 1280 | VERDE |
| B2d | Telefono (390 px) identico prima/dopo: calendario e lista confrontati con screenshot dell'anteprima finta. | screenshot prima/dopo | VERDE |
| B3a | Sito: dipendenza web-push (+ @types) rimossa; tsc e 9 test verdi; push su main del sito (4b4884b). | repo sito-casaania | VERDE |
| B3b | Nessun riferimento a un secondo utente o a «Ivan» nella documentazione dei due repo (in PROGETTO.md resta solo la nota storica «"Ivan" era un'imprecisione» sull'intestatario del bonifico, che non è un utente). | grep | VERDE |
| B3c | STATO IN 10 RIGHE aggiornato e scheda «in 10 minuti». | questo file | VERDE |

## Scelte da confermare con Ania (blocco 2)

- A 1280 px il calendario a 2 settimane mostra circa 7 giorni per volta e
  scorre in orizzontale (colonne larghe per le etichette intere); se preferisce
  vedere tutti i 14 giorni senza scorrere, basta abbassare COL_MIN_QUINDICI o
  scegliere «Mese».
- La finestra a 2 settimane parte 3 giorni prima di oggi.
- «+ Nuova richiesta» su desktop è nell'intestazione (non più sopra la lista).
- Fra 768 e 1100 px calendario sopra e lista sotto (prima erano affiancati).

## Limiti

- Le prove UI sono sull'anteprima finta con dati sintetici; il tooltip è un
  `title` nativo (compare dopo un attimo al passaggio del mouse).

---

# Blocco precedente — Richieste, pezzo 11: testi DEFINITIVI delle proposte (bloccati da Ania il 04/09/2026)

Base `870ef77` (pezzo 10). Sostituiscono per intero i testi del pezzo 6 e le
modifiche del pezzo 9. Nessuna modifica alla ricerca delle soluzioni né alla RPC.

## Casi di accettazione (tutti su stringa intera)

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| T01 | Esempio esatto di Ania: A una camera, 2,3,3,3 in Ambra, all'arrivo. | `richiesteTesti.test` | VERDE |
| T02 | A una camera con persone fisse («, a 70 € a notte»), letto in più una notte (prima / ultima / in mezzo), tutte le notti tranne la prima, dettaglio parlato fino a tre gruppi e con le date oltre. | test | VERDE |
| T03 | A due camere e tre camere (riga vuota fra le camere, «una delle camere»). | test | VERDE |
| T04 | B un cambio, B due cambi con Lena (frase del bagno anche nella riga, «qualche cambio»), B con persone variabili in un segmento («in tre a 90 € a notte, poi in due a 80 € a notte»). | test | VERDE |
| T05 | C notte in mezzo stessa camera (riga unica con «e»), C notte all'inizio, C due notti alla fine («per le quali»), C con cambio camera («Il cambio di camera lo faccio io…», link delle camere); la ricerca automatica (caso D interno) usa lo stesso modello. | test | VERDE |
| T06 | E intero, senza condizione né 3 ore. | test | VERDE |
| T07 | Condizioni 1–4, 3 ore nelle tre varianti, chiusura; elisione 1/8/11/18/28/31 e «dell'8»; mesi diversi; notte singola; importi con decimali. | test | VERDE |
| T08 | Blocco Amelia nello stile nuovo, fra il link e la condizione. | `richiesteTestiAmelia.test` | VERDE |
| T09 | Immagine: stesse date e stessi importi del testo («80 €»); conferma invariata. | UI 390 | VERDE |
| T10 | UI a 320, 390 e 1280 px senza scorrimento laterale. | anteprima finta | VERDE |

## Decisioni prese in autonomia

- Nelle righe con trattino e nel dettaglio le date sono solo i giorni («dal 17 all'18») se nello stesso mese del periodo; con mesi diversi compaiono i mesi.
- Dettaglio parlato: gruppi consecutivi (persone e prezzo uguali); 2 gruppi → «la prima notte / le prime N notti» + «l'ultima notte / le altre N notti»; 3 gruppi → in mezzo «la notte seguente / le N notti seguenti» e alla fine «le ultime N notti»; oltre 3 → le date.
- Letto in più una notte in mezzo: «Per la notte del 18 settembre, in cui sarete in due, …».
- Caso C con una sola notte coperta: «per l'altra notte».
- La firma resta «Grazie mille,⏎Ania – Casa Ania» (nel testo consegnato l'a capo era perso).
- «Niente due punti nel corpo»: restano quelli davanti agli elenchi e nella condizione 1 così com'è nel testo di Ania.

## Limiti aperti

- Nessuno funzionale; le proposte già inviate restano quelle salvate.

---

# Blocco precedente — Richieste, pezzo 10: «Altre camere» con i motivi e «Scelgo io» notte per notte

Base `4ef87dc` (pezzo 9). Caso reale: 17–21 in 2 poi in 3; l'automatico
proponeva solo Ambra senza dire perché non Amelia (senza posto per 3) né
Lena (occupata), e non c'era modo di comporre «17 in Amelia, 18–20 in Lena».

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| S01 | Riquadro «Altre camere» sempre visibile con una riga per camera non usata: «occupata 18–20 set», «senza posto per 3 (18–20 set)», «brande esaurite 19 set», «libera»; solo confermate e persone per notte. | `richiesteComposizione.test` motiviEsclusione (4 motivi, caso reale, priorità occupata > senza posto, in_attesa ignorate); UI 390: «Amelia senza posto per 3 (14–16 nov) · Ambra libera · Lena occupata 14–16 nov» | VERDE |
| S02 | «Cambia» sempre presente; con una sola soluzione «Nessun'altra soluzione automatica». | UI | VERDE |
| S03 | «Scelgo io»: striscia riusata (StrisciaNotti generica), casella = data, camera, persone, prezzo; tocco = camera ammessa successiva (libera, con posto per le persone di quella notte, brande), «nessuna» in coda; menu a tendina su desktop; parte dalla soluzione corrente; «Torna alla proposta automatica». | `camereAmmesseNotte`, `cameraSuccessiva`, `composizioneDaSoluzione`; UI 390: da Allegra×4 a «13: Amelia · 14–16: Ambra · totale 345 €», caso «Cambio camera» | VERDE |
| S04 | Riassunto compresso e totale in centesimi ricalcolato a ogni tocco con le tariffe vere, secondo letto solo dove serve. | `soluzioneDaComposizione` (A camera diversa 350 €, B 345 €, B due cambi, C buco, estremo, completo) | VERDE |
| S05 | Composizione = soluzione a tutti gli effetti (`manuale: true`, stessi segmenti), salvata con «Sì, inviata» e confermata dalla RPC senza modifiche. | struttura identica (segmento/conPrezziNotti); RPC 0031 ricontrolla camera e brande per segmento | VERDE (conferma di una composizione non provata a schermo) |
| S06 | Prezzo a mano: tocco lungo (matita su desktop) → campo in euro; Applica, Applica a tutte le notti di questa camera, Ripristina tariffa; bordo ottone e «prezzo modificato». | test (una notte, tutte, ripristino, flag e prezzi nel segmento); UI 390: 13 nov a 60 € → totale 330 € e riga «al prezzo di 60 € a notte» nel testo | VERDE |
| S07 | Testo della composizione: A (camera diversa), B con uno o più cambi (una riga per segmento), C con notti scoperte, «Nel dettaglio» per segmento con persone variabili e prezzi a mano, link una volta per camera. | 5 test esatti in `richiesteTesti.test` | VERDE |
| S08 | Immagine: linea del soggiorno con i segmenti, camera e persone per notte; notti scoperte come nel pezzo 6. | UI: «Testo + immagine» della composizione mostra SOGGIORNO NON CONTINUO con «Dal 13 al 14 novembre … 2 persone» e «Dal 14 al 17 novembre … 3 persone» | VERDE |
| S09 | 320/390 px senza scorrimento laterale; la striscia va a capo. | UI | VERDE |

## Decisioni prese in autonomia

- Un solo motivo per camera nel riquadro, il più forte (occupata > senza posto > brande), con le sue notti.
- Il link di ogni camera compare nei testi B/C solo per le composizioni manuali; i testi automatici B/C restano bloccati come dal pezzo 9.
- Con una composizione manuale non si elencano «alternative» del caso A e il blocco Amelia segue le regole di sempre.
- «Ripristina tariffa» agisce sulla notte in modifica; cambiando camera a una notte il suo prezzo a mano decade.
- Commit: la logica (a, b) e la schermata (c) sono divisi per file, non per funzione, perché riquadro, striscia e prezzo vivono nella stessa pagina.

## Limiti aperti

- La conferma di una composizione manuale non è stata provata a schermo (la RPC ricontrolla comunque camera e brande).
- Il tocco lungo è simulato nel pannello con eventi pointer; la prova vera è sull'iPhone.
- Nessuna migrazione: le colonne del pezzo 9 bastano.

---

# Blocco precedente — Richieste, pezzo 9: modifica, persone notte per notte, link della camera, elisione

Base `94d4acc` (main con l'avviso di connessione, dopo il pezzo 7). Caso
reale: ospite dal 17 al 21, in 2 la prima notte poi da sola (Amelia con il
secondo letto la prima notte, oppure Ambra).

## Casi di accettazione

| ID | Voce | Prova | Esito |
| --- | --- | --- | --- |
| N01 | «Modifica» in lista, pannello e proposta per in_attesa/proposta_inviata; modulo precompilato (nome, cognome, date, persone con striscia, camera, telefono, note, canale); confermate/rifiutate non si modificano. | `richieste.test` pianoModifica; UI 390: modifica di «Marta Ricovero» precompilata con la striscia [2,1,1,1] | VERDE |
| N02 | Proposta inviata + cambio di date/persone/camera → in_attesa, avviso «La proposta inviata si riferiva ai dati precedenti: rigenera e reinvia la proposta», storico in proposte_precedenti; telefono/note/canale non toccano lo stato. | `pianoModifica` (5 casi); UI 390: modifica di «Bianchi» (proposta inviata, persone 1→2) → avviso con «Rigenera la proposta», nel finto stato in_attesa e storico con testo e soluzione | VERDE |
| N03 | Striscia delle notti sotto «Persone»: caselle con data e numero, tocco cicla 1→max (capienza massima con brande = 4), frecce da tastiera, riga «17: 2 · 18–20: 1», a capo oltre le 7 notti, nessuno scorrimento a 320/390. | `riassuntoPersone` (6 casi); UI 390 e 320 (scrollWidth = viewport) | VERDE |
| N04 | persone_per_notte salvato solo se non uniforme; richieste web con persone uniche → null; senza la 0031 avviso e nessun salvataggio. | `creaRichiesta`/`aggiornaRichiesta` (manca0031); endpoint web invariato | VERDE (avviso non riprodotto a schermo) |
| N05 | Ricerca: capienza e pool per notte con le persone di quella notte; prezzo per notte con le tariffe vere in centesimi, letto solo dove serve; ogni camera del caso A col suo totale. Test 17–21 [2,1,1,1]: Amelia 285 € (75 + 3×70, letto solo il 17), Ambra 320 €, matrimoniale a 3 la prima notte = branda solo quella notte. | `richiesteProposta.test` (3 test nuovi) | VERDE |
| N06 | RPC conferma_richiesta 0031: letto aggiuntivo solo nelle notti che lo richiedono, num_guests = massimo, pool per notte, array incoerente rifiutato. | `richiesteConfermaRpc.test` in PGlite (SQL vera della 0031) | VERDE |
| N07 | Testo: «Nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 3 notti in una a 70 € a notte» (singolare/plurale); immagine con la striscia «Persone notte per notte» quando cambiano. | `richiesteTesti.test`; UI: testo e anteprima immagine di Marta | VERDE |
| N08 | Link «Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/[slug]» dopo il prezzo (slug verificati nel repo del sito: singola, allegra, ambra, lena; senza pagina niente riga). | test; UI: un link per camera nel testo di Marta | VERDE |
| N09 | Elisione: «dal 4 all'8», «dal 10 all'11», «dall'8 al 10», «all'1», «all'18», «all'28», «al 31», «al 3», «al 15», «l'8». | test per 1, 8, 11, 18, 28, 31 | VERDE |
| N10 | Caso A esatto: una camera («è disponibile soltanto la camera…, Il prezzo per le n notti è di…») e più camere («ho due camere libere che posso proporle: – Nome, descrizione: prezzo per le n notti»), apertura a capo, condizione all'arrivo e 3 ore nuove («una delle camere»); B, C, E, caparra e completo invariati. | test esatti su stringa intera | VERDE |
| N11 | Caso A a più camere: «Sì, inviata» salva proposta_alternative; in «Creare la prenotazione?» la scelta della camera accettata (mai preselezionata) diventa proposta_soluzione prima della RPC. | `scegliSoluzioneInviata`, FinestraConferma | VERDE (scelta non provata a schermo) |

## Decisioni prese in autonomia (comportamento prudente)

- L'elisione vale anche per «dal» («dall'8 al 10»), non solo per «al».
- L'apertura a capo vale per A, B e C; il caso E resta identico (bloccato).
- Il link della camera compare solo nel caso A (testo esatto dato); in B e C
  le righe restano invariate, salvo la riga «nel dettaglio» quando le persone
  del segmento cambiano (altrimenti «al prezzo di X € a notte» sarebbe falso).
- Con più camere nel caso A il blocco «alternativa Amelia» non compare (le
  alternative sono già elencate) e la caparra si calcola sulla camera scelta.
- Alternativa Amelia con persone variabili solo se la differenza a notte è
  costante (il testo promette «X € in più a notte»).
- `persone` resta il valore base del modulo; la RPC usa il massimo per
  num_guests. Un array persone_per_notte di lunghezza diversa dalle notti è un
  errore a schermo, mai un ripiego.
- La scheda prenotazione conserva la sua fila di caselle: StrisciaNotti è
  l'estrazione di quel markup, ricollegarla lì è una pulizia futura.

## Prove di consegna

- `npm test` 455/455; tsc; lint del delta; `verifica-consegna --base 94d4acc`
  e `next build`: esito nel resoconto.
- UI sull'anteprima finta (porta 3214) con click via JavaScript.

## Limiti aperti

- Migrazione 0031 non applicata: finché manca, persone variabili, modifiche
  con proposta inviata e proposte a più camere non si salvano (avviso).
- Le richieste web arrivano con persone uniche (per notte solo dal gestionale).
- La scelta della camera alla conferma non è stata provata a schermo.
- Il calendario principale e la scheda prenotazione non cambiano.

---

# Consegna — Avviso di connessione (03/09/2026)

Origine: il 3 settembre, a Casa Ania, il telefono ha perso la linea mentre
Ania inseriva un cliente dalla ricerca per nome. L'app si è bloccata su
«Ricerca...», riaperta mostrava la home con TUTTI gli importi a zero (come
se fossero veri) e poi il messaggio del login «Non riesco a raggiungere il
server». Cinque minuti di spavento. Richiesta di Ania: controllare tutto e,
quando manca la linea, dirlo chiaramente.

## Cosa c'era

- Le pagine ignoravano `error` delle letture Supabase: senza rete `data` è
  `null`, `[]` dopo il ripiego, quindi zeri e liste vuote presentati come dati.
- Nella nuova prenotazione un errore di rete nella ricerca valeva «nessun
  risultato» → «➕ Nuovo cliente» (rischio doppioni) e, con una richiesta
  appesa, il tasto restava su «Ricerca...» senza fine.
- Nessun tempo massimo alle richieste: una rete «mezza morta» tiene l'app
  ferma finché il sistema non taglia la connessione.

## Cosa c'è ora

| ID | Caso | Prova | Esito |
| --- | --- | --- | --- |
| A01 | Ogni richiesta a Supabase passa dal fetch sorvegliato: 30 s massimo (120 s per i file degli scontrini), poi `TimeoutError`. | lib/connessione.test.ts | VERDE |
| A02 | Errore di rete (Chrome «Failed to fetch», iPhone «Load failed», Firefox, Node) o tempo scaduto → stato «server irraggiungibile»; una risposta qualsiasi lo riporta a «raggiunto»; ascoltatori avvisati solo ai cambi. | lib/connessione.test.ts | VERDE |
| A03 | Un annullamento voluto dall'app (signal esterno) non accende l'avviso. | lib/connessione.test.ts | VERDE |
| A04 | Avviso in alto in tutta l'app (tranne /login), sticky sotto la barra del titolo, nel flusso della pagina (non copre nulla): «Il server non risponde» oppure «Nessuna connessione a internet» quando il telefono è offline (`navigator.onLine`). «Riprova» fa una lettura leggera: se risponde ricarica, altrimenti «Ancora niente». | anteprima finta 3213 con fetch spento dal browser | VERDE |
| A05 | Home: se una delle tre letture fallisce → scheda «Dati non disponibili» con il motivo e «Riprova» (ricarica solo i dati), MAI zeri. | anteprima finta | VERDE |
| A06 | Nuova prenotazione: ricerca per nome e per telefono con errore di rete → messaggio «Non riesco a cercare il cliente: nessuna connessione al server…», si resta sulla ricerca, tasto di nuovo attivo; nessun «nuovo cliente» finto. `single()` → `maybeSingle()` sui contatti extra (nessuna riga non è un errore). | anteprima finta | VERDE |
| A07 | Con la rete: ricerca per nome che non trova nessuno → «Nuovo cliente» con il nome già scritto e il telefono da aggiungere nel campo (correzione del 01/09, commit 6d44d69), comportamento invariato. | lettura del codice | VERDE |

Prove: `npm test` 448/448 (7 nuovi), `tsc --noEmit` pulito, lint del delta
senza nuovi rilievi (i 37 di app/page.tsx sono preesistenti, tipi `any`).

Limiti: il ritardo prima del messaggio può arrivare a ~10 s quando il client
Supabase sta anche rinnovando il token (riprova da solo con attese
crescenti); le altre pagine (prenotazioni, calendario, clienti) mostrano
l'avviso in alto ma le loro liste restano vuote finché non torna la linea.
Il ricaricamento dell'app senza alcuna rete resta nelle mani di Safari
(pagina non caricabile): il gestionale non è ancora un'app offline.

---

# Blocco precedente — Richieste, pezzo 7: prova della cascata e verifica del contratto sito → gestionale

Pezzo di verifica: nessuna funzione nuova, nessuna correzione necessaria
(tutte le prove sono passate al primo giro). Base: `b4fbe6d` (pezzo 6).

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| C01 | Lena libera 10–13 ott; R1 (2 persone, 10–13) e R2 (2 persone, 11–13) per Lena: entrambe ricevono il caso A per Lena, anche con l'altra richiesta aperta nel database. | test locale, ricerca pura | VERDE |
| C02 | Conferma di R1 con R2 spuntata: booking Lena 10–13 confermata 240 €, ospite creato dal telefono, R1 confermata con prenotazione_id, R2 rifiutata con «date assegnate a altro cliente». | RPC VERA (SQL 0027) in PGlite | VERDE |
| C03 | R2 NON spuntata, confermata dopo R1: errore «Camera Lena non più disponibile la notte del 11 novembre», bookings e guests invariati, R2 resta proposta_inviata. | RPC vera in PGlite | VERDE |
| C04 | Secondo tocco su «Crea prenotazione» per R1 (con e senza lista): stessa prenotazione, nessun doppione di bookings o guests. | RPC vera in PGlite | VERDE |
| C05 | Pool brande: quadrupla confermata in Lena (2 brande) → Allegra per 3 persone «Letti aggiuntivi esauriti la notte del 20 dicembre (camera Allegra)», nulla scritto; extra_bed senza date conteggiato; Allegra a 3 persone con 1 branda libera passa con extra_bed_dates. La ricerca del gestionale, coerente, non propone la matrimoniale a 3 con il pool esaurito. | RPC vera in PGlite + ricerca pura | VERDE |
| C06 | Senza proposta inviata → «Nessuna proposta inviata»; caso completo → «non contiene camere». | RPC vera in PGlite | VERDE |
| C07 | Contratto sito → gestionale: 9 voci, tutte conformi con evidenze. | docs/verifica-5B.md | VERDE |
| C08 | Endpoint locale: 401 senza/con segreto errato, 400 su JSON e dati invalidi, 201, 200 doppione, 429 dopo 10 dallo stesso IP; bookings invariate. | anteprima finta + curl | VERDE |

## Prove di consegna

- `npm test` 441/441 (6 nuovi sulla RPC), TypeScript e lint del delta verdi.
- La RPC gira in PGlite (Postgres 17 in WebAssembly, dipendenza di solo
  sviluppo `@electric-sql/pglite`): il SQL della funzione è letto dal file
  della migrazione 0027, le tabelle sono una replica minima con le colonne
  toccate, `auth.uid()` è un finto utente loggato. Non è il server Supabase:
  RLS, grant e concorrenza fra connessioni non sono coperti qui (lo script
  `supabase/test/0027_conferma_richiesta.test.sql` resta per l'editor SQL).

## Commit

a `9cea837` test della cascata e delle brande · b nessuna correzione necessaria ·
c `f5c598c` verifica del contratto con evidenze · d (questo) stato in 10 righe e scheda.

## 🔴 Guida per la prova manuale di Ania (dal telefono)

1. Richieste → «+ Nuova richiesta»: «Prova Uno», 2 persone, una camera libera
   (es. Lena) su due notti future, telefono tuo. Salva. Ripeti con «Prova Due»,
   stesse date e stessa camera.
2. Apri Prova Uno → «Invia proposta»: scegli una condizione (es. All'arrivo),
   «Apri WhatsApp e invia» (puoi non inviare davvero), poi «Sì, inviata».
   Fai lo stesso per Prova Due.
3. Su Prova Uno tocca «Conferma → crea la prenotazione»: nella finestra deve
   comparire «Prova Due» già spuntata sotto «Altre richieste per le stesse date».
   Tocca «Crea prenotazione».
4. Verifica: si apre la scheda della prenotazione con il toast «Prenotazione
   creata da richiesta» e la riga «Nata dalla richiesta del … via …»;
   in Richieste → archivio, Prova Due è «rifiutata» col motivo «date assegnate
   a altro cliente»; nel calendario principale la camera risulta occupata.
5. Prova del blocco: su Prova Due (se la riapri) o su una terza richiesta
   con le stesse date, «Conferma» deve fermarsi con «Camera … non più
   disponibile la notte del …» e il link «Prepara una nuova proposta».
6. Alla fine: apri la prenotazione di prova e annullala (Annulla), così il
   calendario torna libero. Le richieste di prova restano in archivio.

---

# Blocco precedente — Richieste, pezzo 6: testi definitivi, condizioni di pagamento, alternativa Amelia, immagine con la notte scoperta

Pezzi 1–5A della sezione Richieste in produzione (autorità). Questo blocco
chiude i testi delle proposte e le condizioni di pagamento scelte da Ania.
Il blocco «quadrupla nera e date stabili» (Codex, altro ramo) resta più
sotto, intatto e ancora in attesa della sua autorizzazione.

## Identità e perimetro

- Base: `6d1f754` (main, pezzi 1–5A online). Candidato: HEAD di `main`
  dopo i cinque commit di questo blocco (a → e), vedi «Commit».
- Stato: PUBBLICATO SU MAIN (push autorizzato dalla consegna) — in attesa
  della migrazione 0029 e della verifica dal telefono di Ania.
- Implementatore: Claude (02/09/2026). Nessun invio reale durante lo sviluppo:
  prove solo sull'anteprima finta senza rete (porta 3214).
- Perimetro: `lib/richiesteTesti` (unico generatore `generaProposta`),
  `lib/condizioniPrenotazione` (costanti + regola di cancellazione),
  `lib/richiesteProposta` (alternativaAmelia, cameraDisponibile),
  `lib/richiesteImmagine` (linea del soggiorno), `components/ImmagineSoggiorno`
  (esteso, non duplicato), `lib/richiesteDati` (salvataggio 0029),
  `app/richieste/[id]/proposta`, migrazione `0029`, anteprima finta.
  La conferma di prenotazione (variante `conferma` dell'immagine) è invariata.

## Regole fisse dei testi (non modificare senza Ania)

Sempre del Lei, apertura «Gentile», righe vuote fra periodi. La proposta non
è una prenotazione: 3 ore per rispondere nei casi A–C, nessun limite nel
caso E. Le condizioni le sceglie Ania a ogni richiesta, nessuna preselezione.
Amelia è la camera più piccola; solo Allegra ha il balconcino. Prezzi e
differenze sempre dalle tariffe reali, in centesimi.

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| R01 | Testi esatti (stringa intera) dei casi A, B, C con notte all'inizio / in mezzo / alla fine, C con cambio camera, E; singolare/plurale notti. | test locali `richiesteTesti.test.ts` | VERDE |
| R02 | Condizioni 1 (arrivo), 2 (caparra 50% e importo personalizzato con percentuale ricalcolata: 70 € = 50%, 50 € = 35,7%), 3 (completo), 4 (personalizzata + sola chiusura). | test locali | VERDE |
| R03 | Importi: centesimi interi, «1.234,50 €», «140 €» senza decimali; prezzo a notte letto compreso (Amelia 2 persone = 75 €). | test locali | VERDE |
| R04 | Alternativa Amelia attiva/non attiva: solo segmento unico in Amelia, ≥ 3 notti, Allegra/Ambra libera sulle confermate con le stesse persone; differenza reale (10 € con 1 persona, 5 € con 2). | test locali | VERDE |
| R05 | Confine dei 7 giorni: 7 giorni esatti = restituzione integrale; un minuto in meno = caparra trattenuta; completo tardivo = nessuna promessa. | test `condizioniPrenotazione.test.ts` | VERDE |
| R06 | Schermata a 390 px: quattro chip nessuno preselezionato; «Apri WhatsApp e invia» disabilitato con «Scegli le condizioni di pagamento»; Caparra → campo precompilato 105 € (50% di 210), modificabile (70 → 33,3%); 0 o oltre il totale → pulsante bloccato con motivo; Personalizzata vuota → bloccato, con testo → attivo; interruttore Amelia spento di default, acceso aggiunge il blocco. | anteprima finta, richiesta «Lis» | VERDE |
| R07 | «Sì, inviata» (ripresa dal browser dopo il ricaricamento) salva stato, testo, soluzione, condizione_pagamento, amelia_alternativa; la pagina mostra «Condizioni inviate: All'arrivo · con alternativa ad Amelia». | anteprima finta, PATCH letto dal finto Supabase | VERDE |
| R08 | Caso E («Persone», tutto occupato): nessun gruppo condizioni, pulsante attivo, testo completo senza «3 ore». | anteprima finta | VERDE |
| R09 | Caso C («Buco», notte +51 tutta occupata): testo con le due righe e «cioè il 23 ottobre»; immagine con SOGGIORNO NON CONTINUO, due blocchi e lo spazio vuoto «NOTTE NON DISPONIBILE · 23 ottobre», contatori 2 notti da noi / 1 notte scoperta. | anteprima finta, screenshot 390 px | VERDE |
| R10 | Layout 320 / 390 / 1280 px senza scorrimento orizzontale (a 1280 in modalità immagine corretto con `min-w-0`). | anteprima finta | VERDE |
| R11 | Colonne 0029 assenti → avviso e nessun salvataggio (stessa via della 0025). | ispezione codice (`colonne0029Presenti`, `manca0029`) | VERDE (non riprodotto a schermo) |

## Prove di consegna

- `npm test`: 435/435. `node scripts/verifica-consegna.mjs --base 6d1f754`:
  VERIFICHE_TECNICHE_OK (suite, regressioni, strumenti, TypeScript, lint delta).
- `next build`: exit 0 sul candidato finale.
- Prove UI sull'anteprima finta con click simulati via JavaScript (nel
  pannello i click reali restavano bloccati anche nella seconda scheda).

## Limiti dichiarati

- Migrazione 0029 NON applicata: fino ad allora la schermata avvisa e non
  registra la proposta (il pulsante è disabilitato).
- Nessuna prova su dati reali né invio reale su WhatsApp.
- Nel riepilogo costi dell'immagine due periodi nella stessa camera compaiono
  come due righe identiche («Camera Amelia – Singola 70,00 €»): il modulo è
  condiviso con la conferma e non è stato toccato; la linea del soggiorno
  sopra rende le date evidenti.
- L'alternativa ad Amelia non viene offerta con due segmenti (cambio o
  parziale): scelta prudente, non richiesta esplicita.
- La percentuale della caparra si arrotonda al decimo («35,7%»).
- Testo modificato a mano + cambio di condizione: la schermata chiede
  conferma prima di rigenerare la bozza (le modifiche andrebbero perse).

## Commit

a `34e3216` generatore + costanti + test · b `46822e7` migrazione 0029 ·
c `ebe154e` schermata con condizioni e Amelia · d `4d93763` immagine con la
notte scoperta · e (questo) CONSEGNA-ATTIVA.md e PROGETTO.md.

## Prossimo passo

🔴 Ania: applicare la 0029 nell'editor SQL del progetto di produzione
(tnsaa…vwv), poi dal telefono con una richiesta di prova: chip non
preselezionati, pulsante disabilitato senza condizione, testo del Lei, caso
C con la notte scoperta anche nell'immagine, interruttore Amelia.

---

# Blocco precedente (Codex, in attesa di autorizzazione) — prenotazioni: quadrupla nera e date stabili

Il banner «Da controllare» fra mesi diversi è online e archiviato in
`CONSEGNE-ARCHIVIO-BANNER-DA-CONTROLLARE.md`. Questo blocco corregge due
regressioni segnalate da Ania nella gestione delle prenotazioni.

## Identità e perimetro

- Base tecnica: `6d44d69` (modifica del telefono della nuova prenotazione già
  presente e mantenuta intatta).
- Candidato implementato: `a8b4495`. Candidato fermo dopo revisione: HEAD di
  `correzioni-prenotazioni-quadrupla-date`, figlio di `a8b4495` (solo scheda,
  strumento di anteprima e voce di avvio: codice applicativo identico).
- Stato: VERIFICATO IN LOCALE — revisione consolidata di Claude verde del
  02/09/2026, nessun bloccante; PRONTO PER PASSAGGIO AUTORIZZATO. Nessun push
  e nessun deploy senza autorizzazione esplicita di Ania.
- Implementatore: Codex. Revisore: Claude (giro unico, 02/09/2026).
- Requisito colore: il terracotta significa che è occupato un solo letto del
  pool comune; il nero significa che entrambi i letti sono occupati e non se
  ne può aggiungere un altro. Una quadrupla in Lena occupa da sola entrambi.
- Requisito date: check-in e check-out non devono sovrapporsi su iPhone né
  nella nuova prenotazione né in modifica/prolungamento.
- Perimetro tecnico: calcolo puro e condiviso del pool letti, colori del
  calendario, lettura disponibilità in nuova/modifica prenotazione e classi
  protettive dei campi data. Nessuna query di scrittura nuova, nessuna
  modifica a dati, schema o permessi.

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| P01 | 0 letti = colore normale; 1/2 = terracotta; 2/2 o più = nero. Anche la riga riepilogativa dei letti mostra 2/2 in nero con testo bianco. | funzioni pure + integrazione pagina | VERDE: `calendarioLetti.test.ts` controlla stati, colori e collegamento effettivo della pagina. |
| P02 | Lena con 3 ospiti occupa 1 letto; Lena quadrupla occupa 2 letti e quindi la sua barra è nera. Due prenotazioni da un letto sovrapposte danno lo stesso nero. | funzioni pure | VERDE: `tariffe.test.ts` confronta la regola del calendario con la tariffa da 1 a 4 ospiti. |
| P03 | Le prenotazioni storiche con `extra_bed=true` e senza giorni espliciti restano conteggiate correttamente. | funzione pura + query | VERDE: test dedicato e campo `extra_bed` incluso nelle letture di nuova/modifica. |
| P04 | A 320–390 px le due date restano dentro le rispettive colonne nella nuova prenotazione; modifica e prolungamento conservano la stessa protezione già introdotta. | regressione sul sorgente | VERDE: wrapper `min-w-0` e input `min-w-0 appearance-none` verificati su entrambi i percorsi. |
| P05 | Nessun cambiamento ai conti, alle prenotazioni esistenti o al database; niente pubblicazione. | ispezione + suite | VERDE: solo letture già esistenti ampliate col campo necessario; nessun accesso remoto o scrittura. |

## Prove di consegna

- Test mirati del blocco.
- Suite applicazione completa, TypeScript e build di produzione.
- `node scripts/verifica-consegna.mjs --base 6d44d69` sul candidato pulito.

## Revisione consolidata di Claude (02/09/2026, candidato `a8b4495`)

Esito: NESSUN BLOCCANTE. Assert dei test esistenti non toccati.

Controlli tecnici sull'albero fermo `a8b4495`:

- Diff `6d44d69..a8b4495` letto per intero (9 file). Il telefono modificabile
  del cliente nuovo (base `6d44d69`) è intatto: il diff non tocca quella parte.
- `node scripts/verifica-consegna.mjs --base 6d44d69`: VERIFICHE_TECNICHE_OK
  (suite, regressioni delle revisioni, strumenti locali, TypeScript, lint).
- `next build`: exit 0, 27 pagine generate.
- Pulizia dei tipi del calendario: solo tipizzazione di `any` preesistenti,
  copia dell'array camere prima dell'ordinamento e aggiornamento del ref
  `vaiA` spostato in un effetto dichiarato PRIMA dell'effetto che lo usa (gli
  effetti corrono in ordine di dichiarazione): nessun cambio di comportamento.
- Regola del pool: `lettiPoolPrenotazione` conta 0/1/2, con `extra_bed=true`
  senza date o con sole date esplicite; il calendario colora sul TOTALE della
  notte (niente più sottrazione della prenotazione corrente); la nuova
  prenotazione legge anche `extra_bed` e usa la stessa funzione. La pagina di
  modifica non è nel diff e mantiene la sua regola locale identica.

Prove UI reali senza rete, con lo strumento aggiunto in questa revisione
(`scripts/revisioni/anteprima-prenotazioni-finta.mjs`: finto Supabase locale
con login e PostgREST minimale su 5 prenotazioni sintetiche; le scritture
sono rifiutate; voce `gestionale-bnb-anteprima-prenotazioni-finta` in
`.claude/launch.json`). Nessuna richiesta al progetto Supabase vero.

| Caso | Prova a 390 px | Esito |
| --- | --- | --- |
| Quadrupla Lena 3–5 set (2 letti da sola) | barra `rgb(31,41,55)` su entrambe le notti; riga letti `2/2` sfondo nero, testo `white` | VERDE |
| Allegra 3 ospiti + Ambra 3 ospiti il 7 set; solo Ambra l'8 | 7 set: entrambe le barre nere e `2/2` nero; 8 set: barra terracotta e `1/2` bianco/marrone | VERDE |
| Storica Amelia `extra_bed=true` senza date, PAGATA, 10–12 set | strisce terracotta/verde il 10; strisce nere/verde l'11 (pool esaurito da Lena bonifico) | VERDE |
| Lena 3 ospiti con BONIFICO l'11 set | strisce nere/viola; `2/2` nero | VERDE |
| Legenda | «1 letto extra occupato» terracotta e «2/2 letti occupati» nero | VERDE |
| Nuova prenotazione, caselle data | 390 px: check-in 33–191, check-out 199–357; 320 px: 33–156 e 164–287; nessuna sovrapposizione, ciascuna dentro la propria colonna, nessuno scorrimento orizzontale | VERDE |
| Nuova, Lena 4 ospiti 7–9 set | 7 e 8 set neri (2+2 e 1+2 > 2), Salva disabilitato | VERDE |
| Nuova, Lena 3 ospiti 7–9 set | 7 set nero, 8 set selezionabile (1+1 = 2), Salva disabilitato finché resta il 7 | VERDE |
| Nuova, Allegra 3 ospiti 3–5 set | 3 e 4 set neri per la sola quadrupla; Salva disabilitato | VERDE |

Limiti dichiarati:

- La sovrapposizione delle caselle data è un comportamento del Safari di
  iPhone: nel pannello Chromium si verifica solo il layout (colonne, larghezze,
  classi `min-w-0 appearance-none`); la conferma finale resta sull'iPhone di
  Ania dopo la pubblicazione. Modifica e prolungamento sono coperti dal test
  sul sorgente (protezione già presente nella base).
- Nella prima scheda del pannello i click restavano bloccati: il login è stato
  inviato con l'handler del modulo; il percorso della nuova prenotazione è
  stato ripetuto in una seconda scheda con click reali; camera, date e ospiti
  impostati con `form_input` (stessi eventi della digitazione).
- Nessuna prova su dati reali: vietato l'accesso remoto in questa revisione.

MIGLIORIE registrate (non condizionano l'approvazione):

- M1 (preesistente): in nuova prenotazione i giorni bloccati ma auto-selezionati
  appaiono come chip neri senza avviso testuale; l'unico segnale è Salva
  disabilitato. Un avviso esplicito aiuterebbe su telefono.
- M2 (documentazione): P03 cita «letture di nuova/modifica», ma solo la nuova
  è nel diff; la modifica conserva la regola locale identica. Unificarla su
  `lettiPoolPrenotazione` è una pulizia futura, non un difetto.

## Prossimo passo

🔴 Ania autorizza la pubblicazione (push su `main` + deploy Vercel) del
candidato fermo. Dopo la pubblicazione: controllo su iPhone delle due caselle
data e di una quadrupla in Lena sul calendario vero.
