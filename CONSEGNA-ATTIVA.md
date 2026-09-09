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
9. Provato sul finto senza rete: ricerca, cliente problematico bloccato, salvataggio (apre la scheda), due camere, cambio camera. 857 test, TypeScript e lint puliti.
10. Se qualcosa non va: `git revert` del commit e la pagina di prima torna com'era.

## Da fare con Ania
- Applicare la 0041 nell'editor SQL di Supabase (senza, niente caparra salvata).
- Decidere se servono anche «Chiamata diretta» e «WhatsApp» fra le provenienze: oggi il gestionale ne ha quattro (Google, Passaparola, Altra struttura, Non so) e aggiungerne due tocca il vincolo del database.
- Il letto aggiuntivo resta a regole di camera (Amelia +5, Ambra/Allegra +10, Lena terzo posto compreso): l'importo libero coi tre criteri dell'anteprima NON è stato portato in produzione, cambierebbe i prezzi veri.
