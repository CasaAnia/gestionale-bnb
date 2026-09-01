# RUNBOOK — elaborazione «solo bozze» degli scontrini

**Stato: ATTIVO dal 01/09/2026** (via libera esplicito dell'utente;
contratto database 0023 applicato e collaudato, memoria dell'assistente
aggiornata). Questo runbook È il flusso degli scontrini: l'elaborazione
scrive SOLO BOZZE e la conferma resta sempre ad Ania nella schermata di
revisione. Il primo documento va elaborato in modo CONTROLLATO (sezione
«Accensione controllata»). La variabile d'ambiente vale per il singolo
comando: niente resta acceso da solo.

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
   `elabora_sostituisci_bozze` della proposta
   `supabase/proposte/0023_elaborazione_bozze_atomica.BOZZA.sql` (tutto
   o niente, arbitraggio concorrente e stati elaborabili FISSATI nel
   database, mai dal chiamante). Finché la 0023 non è applicata e
   collaudata (autorizzazione separata) lo strumento NON PUÒ scrivere
   nulla: non esiste altra via di scrittura al suo interno. Non tocca
   MAI `family_expenses`/`family_expense_items`.
4. **Ania rivede e conferma** dalla schermata di revisione (flusso già
   consegnato): solo la conferma crea le spese definitive.
5. Il file `lettura.json` è temporaneo: si elimina a elaborazione
   conclusa (non contiene segreti, solo i dati dello scontrino).

## Accensione controllata, spegnimento immediato e controlli

- L'accensione NON è uno stato persistente: `ELABORAZIONE_BOZZE_ATTIVA=1`
  vale SOLO per il singolo comando in cui viene passata. Non esistono
  demoni, servizi o interruttori che restano accesi da soli.
  **SPEGNIMENTO IMMEDIATO = smettere di passare la variabile**: il
  comando successivo senza variabile è già spento (provato: si rifiuta
  prima di toccare qualunque cosa). Il vecchio flusso non viene rimosso:
  in caso di problemi si torna semplicemente a quello, senza rollback.
- **Primo documento CONTROLLATO** (dopo il via libera): uno scontrino
  nuovo caricato da Ania, MAI un documento già confermato.
  1. lettura della foto → `lettura.json` (dubbi dichiarati, nota
     dichiarata);
  2. `--prova`: si mostra il pacchetto proposto e lo si controlla;
  3. scrittura vera (stessa variabile) → UNA chiamata atomica.
- **Controlli POST-ATTIVAZIONE** (sola lettura, subito dopo):
  1. documento `in_revisione` con `doc_total`; bozze e righe nei numeri
     attesi, `error_message` nullo;
  2. `family_expenses` e `family_expense_items` INVARIATE (conteggio
     prima/dopo identico: l'elaborazione non crea MAI spese);
  3. la card compare in «Da controllare» nel gestionale (390 px);
  4. Ania rivede e conferma DALLA SCHERMATA: solo la sua conferma crea
     le spese definitive.
  Se un controllo non torna: STOP, niente riparazioni a mano — il
  documento si marca in errore col motivo attraverso lo stesso
  primitivo, e si riferisce all'utente.

## Attivazione (passo esplicito, non compreso in questo blocco)

- Richiede il via libera dell'utente nella conversazione E il contratto
  database: la proposta
  `supabase/proposte/0023_elaborazione_bozze_atomica.BOZZA.sql`
  applicata a mano nell'editor SQL e collaudata in un ambiente isolato
  (autorizzazione SUA, separata; finché è una bozza NON va spostata fra
  le migrazioni operative). La sola variabile d'ambiente non basta:
  senza la RPC lo strumento si ferma senza scrivere.
- Da quel momento: il vecchio inserimento diretto delle spese NON si usa
  più per gli scontrini; la memoria dell'assistente
  (`reference_elabora_scontrini`) va aggiornata a questo runbook.
- La rimozione dell'esenzione del service role sulle spese definitive
  (piano §8-②, protezione definitiva) resta un passo del runbook di
  produzione con la SUA autorizzazione: non farla da qui.
