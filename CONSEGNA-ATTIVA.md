# Due pagine prenotazioni — pubblicazione del 10 settembre 2026

## Stato corrente

Ania ha autorizzato la pubblicazione e, successivamente, la riattivazione del progetto di prova esistente. Le modifiche locali sono nel commit `8c6ccd0`, discendente del `main` remoto `623c864`. I precedenti incarichi di Claude sono conclusi e integrati.

**Database principale aggiornato e verificato.** Applicate in un’unica transazione le 0046/0047/0048/0049; la 0041 era già presente. Le nuove colonne e le tre funzioni del conto unico sono visibili anche tramite PostgREST. Confronto prima/dopo: 240 periodi, 142 clienti e 143 incassi; nessuna modifica ai campi precedenti. Collegamenti di prenotazione corretti; nessun accordo del letto o motivo interno inventato sulle righe vecchie.

**Pubblicazione del client in corso.** Non dichiarare online finché il deploy Vercel e le pagine non sono verificati.

## Prove concluse

- Backup principale: 35 tabelle, 3.241 righe. Integrità, completezza e contenuti identici alla sorgente; confronto ripetuto subito prima dell’aggiornamento. Seconda copia privata identica. Conservate anche le sette funzioni precedenti con i permessi e preparato lo script di ripristino delle sei cambiate.
- Concorrenza reale su PostgreSQL 17.6 nel progetto di prova `exylddaptetwcjxyqids`, schema separato `codex_conto0049_20260910`. Stesso corpo SQL, riferimenti spostati nello schema di prova e controllo membro sostituito da stub; nessuna tabella applicativa coinvolta. Due backend distinti con richieste temporalmente sovrapposte: primo saldo 590, secondo zero, un solo nuovo movimento. Nessuna deroga al precedente blocco locale della memoria condivisa.
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
