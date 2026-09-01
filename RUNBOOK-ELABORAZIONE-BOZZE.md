# RUNBOOK — elaborazione «solo bozze» degli scontrini

**Stato: PREPARATO, ATTIVAZIONE DA AUTORIZZARE.** Finché l'utente non dà
il via libera, il flusso operativo resta quello di sempre e lo strumento
qui sotto si RIFIUTA di scrivere (cancello nel comando). Questo runbook
sostituirà il passo «inserire le spese» del flusso attuale: da attivo,
l'elaborazione scrive SOLO BOZZE e la conferma resta sempre ad Ania
nella schermata di revisione.

## Il flusso (per l'assistente che elabora)

1. **Leggere le foto** come oggi: documenti in stato `da_elaborare` (o
   `errore` da rifare), foto in `family_receipts` (chiavi in
   `.env.local`), note di Ania sul documento SEMPRE lette prima
   (regole della casa in memoria: sottocategoria mai vuota, sconti
   incorporati, voce unica Acqua/Ciliegie, sacchetti a parte,
   Esselunga→Casa…). ATTENZIONE, in QUESTO flusso i possibili doppioni
   NON si scartano mai da soli: diventano un dubbio annotato sulla
   bozza e decide Ania in revisione (caso E05 della scheda).
2. **Scrivere la LETTURA** in un file JSON locale (forma
   `LetturaDocumento` di `lib/spese/elaborazioneBozze.ts`): totale,
   sorelle per ambito con destinatario/data/negozio/metodo, voci con
   raw_name/nome pulito/qty/importi/sottocategoria, e i DUBBI dichiarati
   campo per campo (`confidence` + motivo — il motivo mai vuoto e la
   confidence sotto la soglia, altrimenti il costruttore RIFIUTA: un
   dubbio invisibile non autorizza nulla). Un totale che non quadra o
   una nota non attribuibile con certezza NON si aggiustano a mano: si
   dichiarano come dubbio — deciderà Ania in revisione. Se il documento
   ha una nota di Ania, la lettura DEVE dichiarare `notaApplicata`
   (con il COME) oppure `notaNonAttribuita`: senza una delle due il
   pacchetto viene rifiutato — la nota non si ignora.
3. **Eseguire lo strumento** — solo a flusso ATTIVATO dall'utente
   (il cancello vale anche per `--prova`, che legge il database vero
   col service role); prima in prova, senza scritture:

   ```bash
   ELABORAZIONE_BOZZE_ATTIVA=1 node scripts/elabora/elabora-bozze.mjs <documentId> lettura.json --prova
   ```

   poi la scrittura vera:

   ```bash
   ELABORAZIONE_BOZZE_ATTIVA=1 node scripts/elabora/elabora-bozze.mjs <documentId> lettura.json
   ```

   Lo strumento: verifica lo stato (solo `da_elaborare`/`errore`, mai
   bozze doppie), segnala i possibili duplicati dallo sha256 delle foto
   (annotati come dubbio, MAI scartati da solo; un ERRORE nella verifica
   dei duplicati è uno STOP, mai «nessun duplicato»), e scrive bozze +
   righe + `doc_total` con UNA SOLA chiamata atomica: la RPC
   `elabora_sostituisci_bozze` della migrazione 0023 (tutto o niente,
   arbitraggio concorrente nel database). Finché la 0023 non è applicata
   e collaudata (autorizzazione separata) lo strumento NON PUÒ scrivere
   nulla: non esiste altra via di scrittura al suo interno. Non tocca
   MAI `family_expenses`/`family_expense_items`.
4. **Ania rivede e conferma** dalla schermata di revisione (flusso già
   consegnato): solo la conferma crea le spese definitive.
5. Il file `lettura.json` è temporaneo: si elimina a elaborazione
   conclusa (non contiene segreti, solo i dati dello scontrino).

## Attivazione (passo esplicito, non compreso in questo blocco)

- Richiede il via libera dell'utente nella conversazione E il contratto
  database: migrazione `0023_elaborazione_bozze_atomica.sql` applicata a
  mano nell'editor SQL e collaudata in un ambiente isolato (autorizzazione
  SUA, separata). La sola variabile d'ambiente non basta: senza la RPC lo
  strumento si ferma senza scrivere.
- Da quel momento: il vecchio inserimento diretto delle spese NON si usa
  più per gli scontrini; la memoria dell'assistente
  (`reference_elabora_scontrini`) va aggiornata a questo runbook.
- La rimozione dell'esenzione del service role sulle spese definitive
  (piano §8-②, protezione definitiva) resta un passo del runbook di
  produzione con la SUA autorizzazione: non farla da qui.
