# Consegna attiva — banner «Da controllare» fra mesi diversi

Il blocco «elaborazione solo bozze» è CHIUSO (verbale e storico in
`CONSEGNE-ARCHIVIO-ELABORAZIONE-BOZZE.md`); il rilascio del modulo è
online dal 01/09/2026 (RUNBOOK-RILASCIO-SPESE.md). Questo blocco
corregge il primo difetto trovato in produzione.

## Identità e perimetro

- Base: `d0bb327` (il candidato pubblicato).
- Stato: PRONTO PER REVISIONE — implementato il 01/09/2026 su richiesta
  esplicita dell'utente; esiti nella tabella.
- Implementatore: Claude. Revisore: Codex.
- DIFETTO REALE (01/09/2026): oggi è settembre, il documento Caleffi del
  30/08 era in revisione; il banner della Panoramica indicava «1
  movimento da controllare», ma il tocco portava in Movimenti col
  filtro sul mese corrente e la voce spariva («Nessun movimento con
  questi filtri»).
- REQUISITO: toccando il banner si arriva in DOCUMENTI e si vedono
  TUTTE le bozze attive promesse dal banner, di qualunque mese; numero
  e card coincidono; i filtri temporali di Panoramica, Movimenti e
  Analisi NON cambiano comportamento; i documenti chiusi possono
  continuare a rispettare la vista attuale; NESSUNA modifica a dati o
  database.
- Perimetro tecnico: solo `components/spese/SpeseShell.tsx`
  (destinazione del banner) + regressione in
  `lib/spese/adattatore.test.ts`. Niente altro.

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| F01 | Regressione ESATTA agosto→settembre: bozze in revisione datate agosto viste il 01/09 → il conteggio del banner e le card «Da controllare» di Documenti COINCIDONO; il vecchio arrivo (Movimenti, filtro mese corrente + Da controllare) le nasconderebbe tutte (filtri temporali INVARIATI per requisito). | test locale | Test «REGRESSIONE agosto→settembre» in adattatore.test.ts: banner n>0, card = n, applicaFiltri(mese corrente) = 0. VERDE (52/52 nella suite del file). |
| F02 | Giro UI a 390 px: tocco sul banner della Panoramica → si atterra nella scheda DOCUMENTI, blocco «Da controllare» con conteggio e card visibili; nessun filtro di Movimenti toccato. | schermata simulata | Dev server, demo ?elabora=1 a 390 px: tocco sul banner «1 movimento da controllare» → scheda Documenti, «DA CONTROLLARE · 1» con la card «Mercato di Rozzano · 12,50 € · 2 campi dubbi»; console pulita. VERDE. |
| F03 | Nessuna modifica a dati/database; nessun altro comportamento cambiato (Panoramica/Movimenti/Analisi identici). | ispezione + suite | Delta = 1 funzione di navigazione + 1 test; niente scritture, niente query nuove. Suite completa e cancello comune verdi. VERDE. |

## Prove di consegna

- `node scripts/verifica-consegna.mjs --base origin/main` su albero
  fermo; build una volta sul candidato finale. Esiti nel resoconto.

## Prossimo passo

Codex revisiona in un giro consolidato; nessun push o deploy senza
nuova autorizzazione esplicita. A seguire: Fase 5 — fatture Casa Ania.
