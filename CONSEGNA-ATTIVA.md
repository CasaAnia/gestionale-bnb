# Nuova prenotazione rifatta (09/09/2026)

## STATO IN 10 RIGHE
1. La pagina `/nuova` è stata **riscritta** col disegno scelto da Ania (impianto «C», corto).
2. Ordine: ricerca in cima → cliente e suoi soggiorni → camere e periodi → sconto → totale → quattro righe «già a posto» → salva.
3. Novità vere: **più camere in una sola compilazione** e **cambio camera prima di salvare** (prima si poteva solo dopo).
4. I conti stanno in `lib/prenotazioneComposta.ts` (funzioni pure, 9 test) e usano le regole di sempre di `lib/tariffe` e `lib/prezzoNotti`.
5. Ogni periodo diventa una riga di `bookings`; i periodi legati da un cambio camera condividono il `group_id`, come fa già la scheda.
6. Sconto V4 invariato: percentuale su ogni riga; «porta il totale a» con più camere diventa la percentuale equivalente (detto in pagina).
7. **Serve la proposta 0041** (`supabase/migrations/0041_accordo_pagamento.sql`) per registrare caparra e scadenza: senza, la prenotazione si salva lo stesso e la pagina lo dice invece di andarsene.
8. L'anteprima `/anteprima-nuova` è stata tolta: la pagina vera la sostituisce.
9. Provato sul finto senza rete: ricerca, salvataggio, due camere, cambio camera. **871 test**, TypeScript, lint e build a posto.
9-bis. Dopo due revisioni di Codex: corretti nota nella colonna sbagliata, letto a mano perso al cambio date, letto duplicato o azzerato dal cambio camera (ora si decide prima di salvare), caparra scritta una volta sola, lettura disponibilità fallita che valeva «libero», doppio salvataggio, caparra negativa. Cliente problematico: **non più bloccato** (scelta di Ania), ma sempre riconosciuto dal numero con avviso e conferma.
9-ter. **Tre proposte SQL pronte e NON applicate**: `0046_motivo_problematico`, `0047_prenotazione_unica`, `0048_letto_accordo` (numerate 0046-0048 perché 0043-0045 sono già usate dalle bozze in `supabase/proposte`). Le pagine le usano se ci sono e, se manca una colonna, salvano il resto dicendo cosa non è stato registrato.
10. Se qualcosa non va: `git revert` del commit e la pagina di prima torna com'era.

## Da fare con Ania
- Applicare la 0041 nell'editor SQL di Supabase (senza, niente caparra salvata).
- Decidere se servono anche «Chiamata diretta» e «WhatsApp» fra le provenienze: oggi il gestionale ne ha quattro (Google, Passaparola, Altra struttura, Non so) e aggiungerne due tocca il vincolo del database.
- Il letto aggiuntivo resta a regole di camera (Amelia +5, Ambra/Allegra +10, Lena terzo posto compreso): l'importo libero coi tre criteri dell'anteprima NON è stato portato in produzione, cambierebbe i prezzi veri.
