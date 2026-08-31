# PIANO — CABLAGGIO DEL CONTRATTO ALLE SCHERMATE (blocco proposto, DA AUTORIZZARE)

**Stato: PROPOSTA.** Solo lavoro LOCALE: niente migrazioni, esecuzioni
remote, produzione, push o deploy. Il collaudo isolato del contratto è
SUPERATO (scripts/collaudo-contratto/RAPPORTO-COLLAUDO-2026-08-31.md);
questo blocco prepara il CLIENT, perché — vincolo di sequenza — **il
client nuovo deve essere pronto e attivo PRIMA di dismettere il percorso
attuale** (fase A/B chiude il legacy per sempre).

## Punto di partenza (com'è oggi)
- La schermata `components/spese/RevisioneSheet.tsx` orchestra tramite
  `lib/spese/revisioneScrittura.ts` (salvaModifiche / confermaRevisione /
  scartaRevisione, esiti con stato aggiornato, fermaOperazione su custodia
  e generazioni) sopra `ClienteRevisione` = scritture dirette alle tabelle
  + RPC 0020 (`lib/spese/revisioneClient.ts`, legame browser in
  `revisioneSupabase.ts`). Questo è il PERCORSO LEGACY e resta INTATTO.
- Il percorso a contratto esiste ed è collaudato ma non è collegato:
  `contrattoRevisione` (batch canonico + impronte), `contrattoScrittura`
  (custodia registrata PRIMA dell'invio, letture/scritture controllate,
  recupero), `contrattoRpc` (SQLSTATE come unica prova di rifiuto),
  `contrattoServerFinto` (server locale rigoroso).

## Architettura del blocco
**Interruttore di percorso** (`lib/spese/percorso.ts`): costante
`PERCORSO_REVISIONE: 'legacy' | 'contratto'`, default **'legacy'**. La
pagina sceglie l'orchestrazione dall'interruttore; con 'legacy' il
comportamento è BIT-PER-BIT quello attuale (nessun rischio anche se il
codice venisse deployato). 'contratto' si attiva in produzione solo nel
runbook coordinato (sotto).

**Fasi locali del blocco:**
- **B1 · Deposito operazioni DUREVOLE** — implementazione browser
  (localStorage) dell'interfaccia del deposito di `contrattoScrittura`,
  con lo stesso contratto delle letture/scritture CONTROLLATE (guasto ≠
  zero pendenze, contatore prudente, identità immutabile della richiesta
  custodita); serializzazione identica a quella già provata nel passo 6
  del collaudo. Test: la stessa batteria del deposito in memoria
  (condivisa) + guasti simulati di localStorage (quota piena, accessor
  che lancia) con pendenze conservate e dichiarate.
- **B2 · Orchestrazione a contratto** — `revisioneScritturaContratto.ts`
  con le STESSE firme ed esiti (`EsitoRevisione`) di revisioneScrittura:
  salva = `batchSalvaDa(stato)` → `eseguiSalva` (op_key, custodia,
  mappaNuove riconciliata negli id delle righe nuove → 'salvata');
  conferma/scarto versionati (`conferma_revisione`/`scarta_revisione`
  con base_rev); SUPERATA → esito che impone la ricarica; RIPETUTA →
  stessa mappa. I controlli del blocco 3 restano identici e DAVANTI:
  fermaOperazione (custodia/generazioni), vincoli, pendenze non
  dimostrate, quadratura locale.
- **B3 · Recupero all'apertura** — le pendenze del deposito operazioni
  trovate all'apertura passano da `recuperaOperazione` (giornale) e, per
  le richieste mai partite, `reinviaOperazione`; esiti integrati nel
  cancello di presa in carico già esistente (riconciliaPresa): nessuna
  scrittura finché le pendenze non sono risolte o dichiarate.
- **B4 · Collegamento della pagina** — RevisioneSheet riceve
  l'orchestrazione scelta dall'interruttore; la pagina di prova
  (`app/nuove-spese/Prova.tsx`, `?demo=…`) monta il percorso 'contratto'
  sul `contrattoServerFinto`: la schermata VERA gira in browser sul
  contratto SENZA rete, per la verifica visiva locale (mobile-first,
  390px).
- **B5 · Test e controprove** — unit sull'orchestrazione col server
  finto (giro completo, replay, SUPERATA, risposta persa → recupero
  dalla custodia ricreata, quadratura del server, scarto); regressione:
  con interruttore 'legacy' la suite attuale resta INVARIATA (317+
  verdi); tsc, lint, build.

Un resoconto per commit, come sempre; differenze RIPORTATE, mai
aggiustate in silenzio.

## Coordinamento col passaggio in produzione (sequenza vincolante, ogni
passo con AUTORIZZAZIONE SEPARATA — qui solo dichiarata)
1. **Contratto SQL in produzione** (additivo: involucri che chiamano le
   legacy; il client legacy continua identico; runbook con pausa, audit
   read-only, backup verificato — come da rapporto del collaudo).
2. **Deploy del client con questo blocco** — interruttore ancora
   'legacy': zero cambiamenti operativi; poi attivazione 'contratto'
   (prima in demo, poi per le pagine operative). Rollback SEMPRE
   possibile: interruttore a 'legacy' — finché la fase A non parte.
3. **Osservazione**: giornale delle operazioni popolato dal percorso
   nuovo, nessun accesso residuo al percorso legacy dai client attivi.
4. **Solo allora** fase A (respingenti) e fase B (quiescenza provata,
   revoche, ripuntamento in un'unica transazione): da qui il legacy è
   chiuso e il rollback è solo dal runbook della transizione.

## Perimetro di questo blocco
Locale: nuovi moduli + collegamento pagina dietro interruttore
(default 'legacy'), pagina di prova, test. NON si toccano: le RPC e i
vincoli legacy, la bozza SQL collaudata (fa fede il collaudo), le pagine
/spese e /spese-famiglia fuori dalla schermata di revisione. Niente
migrazioni, remoto, produzione, push o deploy.
