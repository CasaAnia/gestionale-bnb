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
   Esselunga→Casa, doppioni scartati…).
2. **Scrivere la LETTURA** in un file JSON locale (forma
   `LetturaDocumento` di `lib/spese/elaborazioneBozze.ts`): totale,
   sorelle per ambito con destinatario/data/negozio/metodo, voci con
   raw_name/nome pulito/qty/importi/sottocategoria, e i DUBBI dichiarati
   campo per campo (`confidence` + motivo). Un totale che non quadra o
   una nota non attribuibile con certezza NON si aggiustano a mano: si
   dichiarano come dubbio — deciderà Ania in revisione.
3. **Eseguire lo strumento** (prima in prova, senza scritture):

   ```bash
   node scripts/elabora/elabora-bozze.mjs <documentId> lettura.json --prova
   ```

   e, SOLO a flusso attivato dall'utente:

   ```bash
   ELABORAZIONE_BOZZE_ATTIVA=1 node scripts/elabora/elabora-bozze.mjs <documentId> lettura.json
   ```

   Lo strumento: verifica lo stato (solo `da_elaborare`/`errore`, mai
   bozze doppie), segnala i possibili duplicati dallo sha256 delle foto
   (annotati come dubbio, MAI scartati da solo), scrive bozze + righe +
   `doc_total`, porta il documento `in_revisione` — oppure `errore` col
   motivo. Non tocca MAI `family_expenses`/`family_expense_items`
   (whitelist delle tabelle dentro lo script e nel modulo).
4. **Ania rivede e conferma** dalla schermata di revisione (flusso già
   consegnato): solo la conferma crea le spese definitive.
5. Il file `lettura.json` è temporaneo: si elimina a elaborazione
   conclusa (non contiene segreti, solo i dati dello scontrino).

## Attivazione (passo esplicito, non compreso in questo blocco)

- Richiede il via libera dell'utente nella conversazione.
- Da quel momento: il vecchio inserimento diretto delle spese NON si usa
  più per gli scontrini; la memoria dell'assistente
  (`reference_elabora_scontrini`) va aggiornata a questo runbook.
- La rimozione dell'esenzione del service role sulle spese definitive
  (piano §8-②, protezione definitiva) resta un passo del runbook di
  produzione con la SUA autorizzazione: non farla da qui.
