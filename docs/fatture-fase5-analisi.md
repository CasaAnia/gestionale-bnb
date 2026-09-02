# Fase 5 fatture — analisi del candidato `1219138` (revisione avversaria, 02/09/2026)

## Dove stava il candidato

- Branch `fase5-fatture-casa-ania`, un solo commit `1219138`, base `671a677`
  («Integra main nel rilascio prenotazioni», che contiene il blocco quadrupla
  nera/date stabili `a8b4495`).
- `origin/main` è andato avanti di 30 commit (Richieste pezzi 4–7). Sul
  contenuto i due rami NON si toccano: l'unico file modificato da entrambi è
  `CONSEGNA-ATTIVA.md` (`git merge-tree` segnala solo quel conflitto). Il
  candidato tocca 32 file (+3008/−307), tutti dentro `lib/spese`,
  `components/spese`, `app/nuove-spese`, documenti e proposte.
- Branch `revisione-fase5-1219138` (Codex, `aa20cf4`): un solo file,
  `scripts/revisioni/fase5-fatture-1219138.test.mjs`, tre riproduzioni
  indipendenti R1, R1-bis, R2. Eseguite sul candidato in un worktree
  separato: **0 su 3 passano** (sotto). La suite del candidato: 410/410.

## Cosa contiene di utile (tutto conservato nella ricostruzione)

- `lib/spese/revisione.ts`: testata del documento (kind, fornitore, numero,
  data, scadenza) con originali custoditi e correzioni senza `draft_id`;
  `blocchiFattura` (specchio di `private.valida_fattura` + regole della casa:
  solo Casa Ania, scadenza per «da pagare», data non futura e metodo per «già
  pagata»); operazione in corso `approvazione`; presa in carico dopo
  un'approvazione.
- `lib/spese/revisioneScrittura.ts`: `chiusuraViaRpc` comune a conferma,
  approvazione (RPC `approva_fattura_da_pagare`, zero spese) e conferma «già
  pagata» (`conferma_fattura_pagata`, spese pretese).
- `lib/spese/fatturePagamento.ts`: `creaPagatore` con presidio per documento
  (doppio tocco), controlli PRIMA della RPC `paga_fattura`, esiti incerti.
- `lib/spese/fattureVista.ts`: scadenzario derivato da «oggi» e dettaglio
  della fattura leggibile prima e dopo il pagamento.
- `lib/spese/fattureServerFinto.ts`: servizio finto con le regole delle RPC
  0020 sulle tabelle grezze; guasti iniettabili; usato da test e preview.
- `lib/spese/revisioneClient.ts`: le tre RPC con nomi e argomenti esatti;
  nessuna scrittura REST al loro posto.
- Caricamento a più pagine (`registrazioneIdempotente`, `codaPagina`,
  `ripresaDurevole`, `CaricaFotoSheet`): un token, N percorsi `-pN`,
  riselezione per impronta, spunta «È una fattura».
- UI: `FatturaSheet` (dettaglio + pagamento), scadenzario in Panoramica,
  Documenti e Movimenti, `RevisioneSheet` con la testata e la scelta «da
  pagare / già pagata», `Prova.tsx` con il servizio finto e `?fattura=`,
  `?revisione=`, `?oggi=`, `?scrittura=`.
- 39 test nuovi (`fattureFlusso`, `fattureRevisione`, `fattureVista`,
  `caricamentoPagine`), la scheda F01–F10, l'archivio del blocco quadrupla
  (`CONSEGNE-ARCHIVIO-PRENOTAZIONI-QUADRUPLA-DATE.md`), la proposta
  `proposte/elaboratore-fatture.BOZZA.md`, il resoconto nel piano.

## Difetti trovati (riprodotti PRIMA di correggere, un commit ciascuno)

| # | Difetto | Riproduzione | Gravità |
| --- | --- | --- | --- |
| D1 | Una parte (sorella) con importo NEGATIVO dopo l'arrotondamento non blocca l'approvazione «da pagare»: né a schermo (`blocchiFattura`) né nel finto (`validaFattura`). La RPC SQL `private.valida_fattura` ha la stessa lacuna: la fattura verrebbe approvata e poi il pagamento fallirebbe per sempre («Importo sorella negativo» in `spese_crea_da_bozze`). | Codex R1 | BLOCCANTE (stato irrecuperabile dallo schermo) |
| D2 | Il servizio finto NON fa rollback quando il corpo di una RPC fallisce a metà: `creaSpese` lascia spese, righe, ponte e bozze già mutate. Il finto era dichiarato «rigoroso» e serve ai test: falsi verdi possibili. | Codex R1-bis | BLOCCANTE per la prova |
| D3 | Un errore RESTITUITO senza SQLSTATE (es. «Bad Gateway» di un proxy) viene trattato come rifiuto CERTO: annotazione tolta, «riprova» possibile, mentre la RPC può essere andata. La sola prova di rifiuto accettabile è il codice applicativo (regola già adottata da `contrattoRpc`). Vale per approvazione, conferma «già pagata» e pagamento. | Codex R2 | BLOCCANTE (falso rifiuto → doppio pagamento evitato solo dall'idempotenza, ma la responsabilità in custodia veniva tolta) |
| D4 | `revisioneClient` scarta `error.code`: senza codice il D3 non si può nemmeno correggere. | test nuovo | conseguenza di D3 |
| D5 | Lato SQL la data di pagamento futura non è vietata (`paga_fattura`, `conferma_fattura_pagata`): solo il client la blocca. Non correggibile in locale: proposta di migrazione. | — | MIGLIORIA (proposta) |

Verifiche fatte sul candidato che NON hanno trovato difetti: `fonte.leggiTutto`
pagina a 1.000 righe con ordinamento esplicito (query storiche complete);
`FotoSheet` mostra i PDF (iframe + apertura a tutto schermo) e le pagine in
ordine; `scegliFiles(…, false)` seleziona più file (riselezione di tutte le
pagine possibile); nel candidato non esistono `insert` nuovi su
`family_expenses` (le uniche scritture dirette sono quelle preesistenti delle
spese MANUALI senza documento in `scritturaSupabase.ts` e del vecchio tracker
`dati.ts`, fuori dal perimetro fatture); importi in centesimi con
`Math.round(x*100)` esplicito in adattatore, vista e finto; `catch` senza
esito solo sull'impronta (già così prima) e sempre seguiti da un esito
dichiarato.

## Decisione di ricostruzione

Nuovo branch `fatture-fase5` da `origin/main` (`b3746f4`): `git cherry-pick
-n 1219138` conservando TUTTO tranne `CONSEGNA-ATTIVA.md`, che viene
riscritto a mano (stato in 10 righe + scheda della Fase 5 + blocchi
precedenti); il blocco quadrupla, che è già su main, esce dalla scheda e
resta nell'archivio del candidato. Il percorso del contratto di revisione
resta su `legacy` (`lib/spese/percorso.ts` non toccato). Nessuna migrazione
applicata, nessun accesso remoto.
