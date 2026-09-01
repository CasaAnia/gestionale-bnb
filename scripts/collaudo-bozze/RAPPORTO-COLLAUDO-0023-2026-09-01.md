# RAPPORTO — collaudo isolato della bozza 0023 (01/09/2026)

**ESITO: SUPERATO.** Due giri completi 1→4 sul SOLO progetto di prova
della 2B (ref exyl****, riagganciato con guardia anti-produzione), 28
verifiche verdi per giro (56 totali), zero fallite. Autorizzazione
esplicita dell'utente nella conversazione del 01/09/2026; cancello
`COLLAUDO_0023_AUTORIZZATO=1` su ogni comando.

## Esiti per passo (identici nei due giri)

- **Passo 1 — struttura (4/4).** Bozza conforme ai vincoli R6 anche in
  locale; fotografia di base completa nel registro durevole PRIMA di
  ogni effetto; base pulita (funzione assente); dopo l'applicazione:
  firma `(uuid, jsonb, text)`, security definer, search_path vuoto,
  EXECUTE al solo service_role (anon/authenticated/PUBLIC negati).
- **Passo 2 — comportamento (13/13),** via PostgREST con l'identità
  service (la via dello strumento reale), pacchetto costruito dal
  costruttore VERO: anon respinto; giro buono (2 bozze, 3 righe,
  doc_total, in_revisione); ripetizione respinta con `stato_attuale` e
  archivio INVARIATO; marcatura d'errore con pulizia totale e motivo;
  rielaborazione da errore che SOSTITUISCE; richieste malformate e
  pacchetti vuoti respinti senza effetti; ROLLBACK TOTALE su vincolo
  violato (fotografia byte per byte, bozza pregressa e DELETE compresi);
  documento inesistente dichiarato.
- **Passo 3 — concorrenza (6/6).** Caso deterministico senza password
  del db: sessione A in un solo batch (lock del documento + advisory
  osservabile + pausa + elaborazione + commit); B partita ad advisory
  visibile, ATTESA sul lock misurata su pg_stat_activity, rifiutata al
  commit con lo stato già cambiato; una sola serie di bozze. Caso
  parallelo: due chiamate simultanee, esattamente una riuscita.
- **Passo 4 — pulizia (5/5).** Per identificativi esatti dal registro;
  funzione rimossa; nessun documento residuo; fotografia finale
  IDENTICA alla base (conteggi, impronte, permessi, legacy, EXECUTE).
  Registri marcati «puliti» (2 registri, uno per giro).

## Credenziali e sicurezza

- Token Management API temporaneo: mai in chat/log/repo, file 600,
  CANCELLATO a fine collaudo. **REVOCA dal dashboard da fare** (unico
  residuo a carico dell'utente).
- Password del db di prova: NON usata (il piano è stato adeguato: il
  caso deterministico usa un batch su una sola connessione).
- Produzione mai toccata: guardia `verificaNonProduzione` su ogni passo.

## Cosa questo collaudo NON autorizza

L'applicazione della 0023 in produzione e l'attivazione dello strumento
`scripts/elabora/elabora-bozze.mjs` restano passaggi separati, ciascuno
con la propria autorizzazione esplicita (runbook bozze).
