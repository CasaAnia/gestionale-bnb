# Consegna corrente — due pagine prenotazioni, 10 settembre 2026

## Pubblicazione autorizzata — in preparazione

Ania ha autorizzato la pubblicazione con «pubblica». Backup fresco del database principale: 35 tabelle, 3.241 righe; integrità, completezza e confronto dei contenuti passati. Seconda copia identica e privata conservata nella cartella `outputs/pubblicazione-20260910` del lavoro Codex. Verificati 240 periodi e 214 gruppi: nessun gruppo contiene clienti diversi o più caparre.

Il remoto `main` è `623c864`, già antenato della nostra base `91827b0`: le modifiche di Code sono conservate. Sul database principale è presente la 0041; mancano i campi delle 0046/0047/0048 e le nuove funzioni 0049. Bundle atomico preparato, non applicato. Nessun push o deploy ancora eseguito.

Per la prova concorrente: il progetto Supabase di collaudo esistente è sospeso. La sua riattivazione è stata rifiutata dal controllo automatico perché richiede autorizzazione specifica al cambiamento di stato del servizio. Richiesta esplicita inviata ad Ania; non riattivare senza risposta e non aggirare il rifiuto. La produzione non viene aggiornata prima di chiudere questa verifica.

Questa è la fonte corrente per il coordinamento. I vecchi rapporti «sei rilievi» e i primi collaudi non sono un elenco di lavori ancora aperti. Codex ha raccolto direttamente i riscontri di Claude; Ania non deve copiarli fra le conversazioni.

## Lavoro locale completato

- Inserimento e scheda distinguono la prenotazione intera (`prenotazione_id`) dai periodi di un cambio camera (`group_id`). Non si uniscono prenotazioni in base a cliente o date uguali.
- Totale, incassi, residuo, accordo di pagamento, caparra, storico e annullamento usano la prenotazione intera. Le modifiche a un singolo periodo conservano le altre camere. I crediti già incassati restano nel conto anche se una camera viene annullata.
- Aggiungere una camera eredita l'accordo esistente senza duplicare la caparra. Annullamento con motivo e cambio cliente comprendono le camere della stessa prenotazione, lasciando intatte le prenotazioni indipendenti.
- Un errore di lettura non mostra un conto parziale come completo. Le nuove operazioni economiche richiedono la funzione server corretta; non ripiegano su scritture semplici che potrebbero duplicare gli incassi.
- Le vecchie API economiche sono mantenute per prenotazioni singole e cambi camera sequenziali; la proposta server rifiuta le richieste delle vecchie pagine quando una prenotazione ha camere parallele.
- Chiusi anche i precedenti lavori: nota cliente distinta dal motivo interno, accordo del letto conservato alla riapertura, totale storico rispettato, stesso pannello messaggi mobile/desktop. Non riassegnarli.

## Verifiche e limiti

- Suite applicativa, regressioni, strumenti locali, TypeScript e build finale passati sul candidato. Il controllo complessivo non è tutto verde: il lint conserva 26 errori e 5 avvisi preesistenti; nessuna nuova diagnostica rispetto alla base.
- Ultima verifica SQL e funzioni effettive della pagina: **17/17 passate**, includendo incasso nuovo, saldo, retry dopo risposta persa, accordo unico, annullamento, API mancanti, vecchie API e ricostruzione. SQL eseguito in PGlite con dati sintetici. Altri 6 test verificano identità/conto/date, 22 lo storico del cliente; le regressioni precedenti del letto e delle note restano chiuse.
- Claude ha verificato le pagine reali con servizio simulato a 390 e 1280 px: 640 totali, 50 ricevuti, 590 residui da tutte le camere; incasso nuovo di 75 e saldo di 515; caparra unica; aggiunta camera; modifica letto; annullamento; navigazione fra prenotazioni e recupero dopo errore. Nessuno scorrimento laterale. Le anteprime di collaudo sono chiuse.
- Collaudo UI V2 sulla pagina SHA256 `d1aa89cbca9a8c179ff71a4078c2d3caec49a8d3241785b69e93ebb72d0b8907`. Dopo quel collaudo: tre correzioni circoscritte a conteggio soggiorni conclusi, rilettura del conto dopo saldo e aggiornamento cronologia; inoltre partenza massima nella causale. Verificate con test mirati e build, senza dichiarare un nuovo collaudo visivo completo.
- Pagina finale: SHA256 `733f9ba5fe4c77442aefba1d1ff0dc7751b694ae1d929fd0d7dd3dbaba4d1560`. Trasferimento nel repository subordinato al confronto delle impronte con la base; il verbale di trasferimento elenca i file effettivamente copiati.
- **Non verificata la concorrenza della nuova SQL su un server PostgreSQL reale.** L'avvio locale è impedito dall'ambiente (`shmget: Operation not permitted`). PGlite e le prove simulate non sostituiscono questa verifica. Non è stata aggirata la restrizione.

## Database e pubblicazione: passaggio ancora separato

Pronta, **NON applicata**, `supabase/proposte/0049_conto_prenotazione.BOZZA.sql`. Introduce le operazioni atomiche del conto unico, controlli di appartenenza e idempotenza. Richiede lo schema accordo pagamento 0041 e prenotazione unica 0047; controlla le incoerenze e non indovina i raggruppamenti passati.

La disponibilità effettiva su Supabase delle 0041/0046/0047/0048 non è stata verificata in questo blocco. Prima della pubblicazione occorrono verifica dello schema reale, backup verificato, controllo della concorrenza e applicazione autorizzata delle proposte necessarie, poi deploy e verifica online. Nessun commit, push, dato reale, aggiornamento remoto o deploy è stato eseguito in questo blocco. Questa consegna locale **non è l'ok alla pubblicazione**.

## Coordinamento e punti successivi

- **Claude / Code: incarichi conclusi.** Storico multicamera e collaudo del conto ricevuti e integrati. Nessuna attività ulteriore da dedurre dai rapporti vecchi.
- Due osservazioni minori registrate: rendere più chiaro il motivo obbligatorio prima di confermare l'annullamento; correggere nello storico cliente la dicitura «cambio camera» quando sono camere parallele. Non risultano errori nei conteggi di quei due casi.
- Testi commerciali di pagamento/conferma rinviati da Ania: la formulazione di bonifico all'arrivo, caparra e scadenza richiede ancora la revisione concordata. La raccolta delle camere è adeguata, la riscrittura dei testi no.
- Promemoria caparra/scadenza e situazione economica degli arrivi nella Home non implementati in questo blocco: restano un requisito da verificare e completare separatamente.
- Protezioni contro modifiche involontarie e recupero dell'ultimo salvataggio autorizzate per **dopo la chiusura delle due pagine**: consultazione iniziale, modifica esplicita, scarto bozze, riepilogo e ripristino con controllo disponibilità. Non realizzate in questo blocco; non promettere un ripristino da cronologia incompleta.

## Prove e archivio

Cartella di lavoro: `/Users/amerigogranata/Documents/Codex/2026-09-09/d`.

- Collaudo Claude e 29 schermate: `work/collaudo-conto-unico/work-collaudo/CONSEGNA.md`.
- Consegna storico Claude: `work/storico-multicamera/work-storico/CONSEGNA.md`.
- Verifiche finali: `outputs/conto-unico-preflight-consegnato.log`, `outputs/conto-unico-build-consegnato.log`, `outputs/conto-unico-sql-compatibilita.log`, `outputs/conto-unico-pagina-finale.log`.
- Base e trasferimento: `outputs/conto-unico-base-20260910.json`, `outputs/conto-unico-transfer-manifest.json`, `outputs/conto-unico-transfer-result.json`.
- Consegna precedente conservata integralmente: `outputs/CONSEGNA-ATTIVA-pre-conto-unico.md`. I suoi punti aperti e numeri di test sono storici, superati dove indicato qui.
