# Registro condiviso Casa Ania — Codex e Claude

Richiesto da Ania il 30 settembre 2026. Questo è il punto comune di ripresa; non richiede che Ania copi messaggi fra gli assistenti.

## All'inizio di ogni sessione sul gestionale
1. Leggere `STATO.md`, l'ultima consegna in `diario/` e gli eventuali rilievi aperti in `audit/`.
2. Confrontare data, branch, HEAD, stato locale e origine remota. Non fare pull alla cieca su modifiche altrui: prima preservarle e accordarsi. Controllare i commit successivi all'ultimo esaminato.
3. Leggere `REGOLE-FISSE.md` e `COLLABORAZIONE.md`. `CONSEGNA-ATTIVA.md` conserva gli incarichi e lo storico; se contraddice una verifica più recente, segnalare la discrepanza e aggiornare lo stato, senza cancellare la storia.
4. Registrare chi prende in carico cosa, versione di partenza, file assegnati, prove e limiti. Un solo autore per file.

## Prima di terminare o passare il lavoro
- Aggiungere una voce in `diario/AAAA-MM-GG-HHMM-autore.md`: richiesta di Ania; base e versione finale; file; cambiamento osservabile; verifiche con esito e percorso delle prove; pubblicazione; migrazioni applicate o pendenti; problemi e prossima azione.
- Aggiornare `STATO.md` mantenendolo breve. Ogni affermazione importante deve avere data e prova. Distinguere dichiarato, verificato nel codice, test locale, anteprima sintetica, lettura remota, UI online e scrittura reale autorizzata.
- Un deploy riuscito non prova tutti i percorsi utente. Un test sul testo del sorgente non prova un salvataggio. Esito incerto non significa fallito né autorizza a risalvare alla cieca.
- Non inserire credenziali, dati personali degli ospiti, documenti privati o dump del database. Nei casi riproducibili usare dati sintetici.
- Aggiungere la conferma di ricezione in un file distinto `ricevute/`: autore, ora, documento e versione letti, impegno assunto. Non sovrascrivere la consegna dell'altro.

## Dialogo effettivo
I file sono la memoria comune, non una chat automatica. Se l'altro assistente è già aperto, inviare nella sua sessione verificata un messaggio breve con il percorso del registro; controllare il riscontro. Gli stati sono PREPARATO → INVIATO → RICEVUTO → IN CORSO → VERIFICATO, mai presunti. Il coordinamento tecnico Codex–Claude è autorizzato da Ania; invii agli ospiti e modifiche ai dati reali mantengono le proprie autorizzazioni.

Una nuova sessione nel progetto legge `AGENTS.md`; Claude lo importa da `CLAUDE.md`. Per Codex nelle chat senza progetto su questo Mac c'è anche il rinvio in `Documents/Codex/AGENTS.md`, limitato alle richieste su Casa Ania. Claude ha anche il rinvio globale in `~/.claude/CLAUDE.md`, per le nuove sessioni avviate fuori dal progetto. Nessun processo continua quando le sessioni sono ferme. In un altro computer occorre portare il repository e il registro; una chat senza accesso ai file deve dichiararlo.
