# Piano di applicazione — proposta 0059 «Pulizie: dotazione, recuperi, tempi»

Preparata il 25/09/2026. **NON APPLICATA.** Serve l'autorizzazione di Ania
per: applicare la SQL sul progetto vero, pubblicare l'app, unire il branch.

File: `supabase/proposte/0059_pulizie_dotazione_tempi.BOZZA.sql`
Ripristino: `supabase/proposte/0059_RIPRISTINO.BOZZA.sql`
Prove: `scripts/revisioni/pulizie-0059.test.mjs` (8 casi, database isolato
PGlite con 0018 + 0039 + 0045 + 0059).

## Cosa fa
- `cleanings`: 4 colonne nuove (assetto, dotazione, minuti, aggiornata_at), tutte NULL sulle righe esistenti.
- `biancheria_recuperata`: 4 colonne per misura, 0 sulle righe esistenti;
  `lenzuolo_sotto/sopra` di prima restano come «senza misura». Il vincolo
  delle federe passa da 0..4 a 0..8 (Lena con due singoli).
- Tabelle nuove `pulizie_timer` e `pulizie_fuori_camera`, RLS solo membri.
- `gestisci_pulizia` sostituita: le richieste dell'app di oggi funzionano
  identiche (provato); in più «dettagli» e dotazione/minuti.
- Funzione nuova `gestisci_tempo_pulizie`.
- Nessun `update` o `delete` sui dati esistenti, nessuna ridistribuzione.

## Ordine
1. Copia di sicurezza di `cleanings`, `biancheria_recuperata`, `pulizie_operazioni`
   (piano gratuito: niente backup automatico) — es. `scripts/backup-locale.mjs`
   o esportazione CSV dal pannello. Annotare i conteggi:
   `select stato, count(*) from cleanings group by 1; select count(*) from biancheria_recuperata;`
2. Applicare la 0059 (SQL Editor → Run). L'app pubblicata continua a
   funzionare: richieste di prima accettate.
3. Controllare la select finale (2 tabelle, RLS attiva, 1 policy ciascuna)
   e che i conteggi del punto 1 siano invariati.
4. Solo dopo: pubblicare l'app (merge del branch `pulizie-integrazione`).
5. Prova reale guidata: una pulizia con recuperi e minuti, riapertura,
   statistiche; un timer avviato e messo in pausa da due dispositivi.

## Se qualcosa va storto
- Prima del punto 4: eseguire il ripristino (toglie solo le aggiunte) e
  rieseguire la 0045. L'app pubblicata non se ne accorge.
- Dopo il punto 4: rimettere prima l'app precedente, poi il ripristino.
- Limite dichiarato: senza backup del piano gratuito, un guasto imprevisto
  si recupera solo dalla copia fatta al punto 1.
