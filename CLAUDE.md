**Regola d'inizio lavoro (17/11/2026), per Claude Code, Codex e qualunque altra sessione:** prima di toccare il codice, `git fetch`; la copia deve essere su `main` pulita e uguale a `origin/main`. Se è indietro o ha modifiche non registrate, fermati e non lavorare su quella copia. Una sessione alla volta su `main`; mai due chat in parallelo sugli stessi file.

Prima di ogni incarico fai git pull su main e leggi REGOLE-FISSE.md. Questi comportamenti sono decisi da Ania e non si toccano senza una sua richiesta esplicita. Prima di ogni push la suite deve essere verde.

Dal 17/11/2026 nessuna versione va online con test rossi: Vercel lancia i test prima della build. Non aggirarlo mai (niente --no-verify, niente test saltati con skip per far passare una pubblicazione).

@REGOLE-FISSE.md

@AGENTS.md
