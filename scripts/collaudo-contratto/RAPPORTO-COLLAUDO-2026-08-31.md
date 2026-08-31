# RAPPORTO DEL COLLAUDO ISOLATO — contratto di revisione + transizione A/B

**Data:** 31/08/2026 · **Esito: SUPERATO** · **Commit di riferimento:** fde3921
(preparazione approvata: d72c3ad/0db399e). Nessun segreto in questo rapporto.

## Ambiente
- Progetto bersaglio: la prova della 2B (ref `exyl****`, ACTIVE_HEALTHY),
  riagganciato per nome dal passo 0; guardia anti-produzione attiva in ogni
  passo. La produzione NON è mai stata toccata.
- Credenziali: token Management API temporaneo e password db SOLO via
  appunti → file 600 fuori repo; cancellati a fine collaudo (revoca dei token
  chiesta all'utente; la password non è conservata da nessuna parte).
- Prerequisiti verificati prima di partire: base 0020–0022 PULITA (verifica
  read-only: giornale assente, 5 legacy, private senza estranei, nessun
  backup di transizione); strumenti locali 43/43; REGISTRO_DIR fuori repo.
- Node 26.3 (strip dei tipi nativo per i moduli TS del client nel passo 6).

## Esito dei due giri (identico): 108 verifiche verdi per giro
| Passo | Verifiche | Contenuto provato |
|---|---|---|
| 1 · struttura | 10/10 | giornale presente e APPEND-ONLY anche come postgres (update e delete respinti con GIORNALE_IMMUTABILE); revisione_rev; execute solo ad authenticated sulle 4 RPC; anon/service_role negati; giornale senza accesso diretto; private.canonico/impronta negate |
| 2 · vettori | 18/18 | canonicalizzazione del SERVER identica al client su tutti i 9 vettori condivisi (impronte SHA-256 comprese), anche la conferma con correzioni DA RIORDINARE |
| 3 · comportamento | 23/23 | APPLICATA con mappa; replay RIPETUTA senza doppioni e stessa mappa; CHIAVE_RIUSATA (contenuto/documento/kind); SUPERATA tardive con documento intatto; lista positiva degli stati; BOZZA_NON_MODIFICABILE atomica (fotografia identica); perimetro (estraneo, mancante, client_ref duplicato, campo non consentito, malformato); CHECK 0020; conferma con quadratura (RAISE P0001, giornale vuoto); scarto; esito_revisione |
| 4 · concorrenza | 3/3 | MISURATA (pid + finestre al microsecondo, sovrapposizione reale obbligatoria): identici → APPLICATA+RIPETUTA con UNA voce; stessa chiave su documenti diversi → perdente byte-per-byte identico e UNA registrazione; Salva⇄Conferma coerente col vincitore; i due ordini forzati con esiti esatti |
| 5 · transizione | 32/32 | guardie negative in transazione DEL COLLAUDO (overload → FASE_A_STOP; tipi sbagliati → FASE_A_STOP; zero residui, originale intatto); fase A verbatim + respingenti P0001 + private negate; ROLLBACK dal runbook byte per byte; quiescenza: INSERT pregresso → timeout, chiusura → ok; chiamata sospesa su app_members PROVATA per PID (attesa di lock reale, mai una pausa) e CONTATA dalla condizione della fase B; conclusione col corpo vecchio al rilascio; fase B in UN'UNICA transazione (barriera, revoche da pg_proc, involucri ripuntati dalla bozza); doppia porta sui 5 nomi |
| 6 · client vero | 12/12 | contrattoRpc+contrattoScrittura su PostgREST col jwt del membro: giro completo con mappa; replay; esito_revisione; RECUPERO COMPLETO della risposta persa DOPO l'effetto reale (custodia serializzata e ricreata, chiusura dal giornale vero, effetto verificato); quadratura come rifiuto P0001 dimostrato dal trasporto; SUPERATA reale; reinvio dal deposito |
| 7 · pulizia | 10/10 | smontaggio transizione nell'ordine sicuro (originali dal backup → ri-grant 0021 ed execute → verifica → private → backup ULTIMO); piano per id esatti (16 istruzioni, FK 0020 + trigger 0021 rispettati); FOTOGRAFIA FINALE IDENTICA ALLA BASE (impronte dei dati per tabella, definizioni legacy, privilegi per colonna con identità esatta, EXECUTE per ruolo) |

Una pulizia intermedia aggiuntiva (dopo il difetto n.1) è anch'essa uscita
verde con fotografia identica alla base.

## Difetti trovati dal collaudo e corretti (giro rifatto da capo dopo l'1)
1. **Bozza SQL, logica a tre valori** — `jsonb_typeof(p_modifiche->'nuove')`
   su chiave ASSENTE dà NULL: con `<>` la guardia non scattava e un batch
   senza `nuove` veniva APPLICATO invece di `MODIFICHE_MALFORMATE` (il server
   finto lo respingeva già: la SQL divergeva dal contratto). Correzione:
   `is distinct from` (proposte/contratto-revisione.BOZZA.sql).
2. **Harness passo 4, commit-alias** — `batchRamo` termina con
   `select … f()` senza punto e virgola: il `commit` appeso veniva letto come
   ALIAS della funzione, la transazione non si chiudeva mai, il lock restava
   e il ramo concorrente moriva a 120 s di statement_timeout. Diagnosi con
   sonda su pg_stat_activity (backend «idle in transaction» a batch concluso).
   Correzione: `; commit;` + rollback nel catch del ramo.
3. **DNS dell'host diretto** — `db.<ref>.supabase.co` non esiste sui progetti
   nuovi: `connessionePg` (ambiente.mjs) prova i candidati del pooler in SOLA
   session mode 5432 (mai il transaction pooler 6543: pid e lock devono
   restare sullo stesso backend).
4. **Parser dei vettori** — `vettoriComuni` partiva dalla prima `[` del file,
   che è nell'annotazione di tipo TypeScript: ora cerca `= [` e pretende
   almeno 8 vettori.

## Tracciabilità
- Registri durevoli (fuori repo, in REGISTRO_DIR): `collaudo-contratto-
  1788197890190.json` (giro interrotto dal difetto 1 + pulizia verde),
  `collaudo-contratto-1788198089649.json` (giro 1 completo),
  successivo (giro 2) — tutti chiusi con `pulito: true`.
- Stato finale del progetto di prova: identico alla base 0020–2022 per
  fotografia (conteggi, impronte md5 dei dati, definizioni legacy, privilegi).
- Verifiche locali dopo le correzioni: suite 317/317, strumenti+registro
  43/43, node --check su tutti gli script, eslint della cartella pulito.

## Cosa questo collaudo NON autorizza
Nessuna applicazione in produzione: contratto e transizione reali
richiederanno autorizzazione separata con pausa, audit read-only, backup
fresco verificato e runbook dedicato (il presente documento e
PIANO-COLLAUDO-CONTRATTO.md restano come base del runbook).
