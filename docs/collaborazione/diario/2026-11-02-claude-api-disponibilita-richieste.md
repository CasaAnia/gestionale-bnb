# 02/11/2026 — Claude — /api/disponibilita: richieste in attesa per camera

## Richiesta di Ania
Estendere l'endpoint di sola lettura aggiungendo, per ogni camera, le notti con
una richiesta in attesa (non confermata), senza nomi, telefoni o importi; le
richieste senza camera a parte con sole date e persone. Tutto il resto identico.
Vincolo: solo file dentro `app/api/disponibilita/`. Pubblicazione autorizzata
da Ania in chat («sei autorizzato a pubblicare»).

## Base e versione
- Base origin/main **6ce0329**, copia pulita `gestionale-disponibilita`.
- Commit **6b5e6f4**,
  spinto su origin/main. `git show --stat`: 3 file, tutti in `app/api/disponibilita/`.
- Nota: anche la variabile `DISPONIBILITA_TOKEN` è ora su Vercel Production
  (inserita da Claude con `vercel env add` dopo il login autorizzato da Ania,
  utente casaania) e il link online funziona dal pomeriggio del 02/11.

## File
- `app/api/disponibilita/route.ts` (modificato): terza lettura su `richieste`,
  campi nuovi `notti_con_richiesta_in_attesa` e `richieste_in_attesa_senza_camera`,
  righe nuove nel testo.
- `app/api/disponibilita/richiesteAttesa.ts` (nuovo): logica pura.
- `app/api/disponibilita/richiesteAttesa.test.ts` (nuovo): 6 prove con dati
  inventati, fuori dalla suite `npm test` (che legge solo lib/**):
  `node --test app/api/disponibilita/richiesteAttesa.test.ts`.

## Regole usate (dal codice, non inventate)
- Tabella `public.richieste`, campo `stato`. In attesa = `in_attesa`,
  `proposta_inviata` (`STATI_APERTI` in lib/richieste.ts). Escluse `confermata`,
  `rifiutata`, `chiusa` (con `chiusura_motivo` scaduta/rifiutata, 0040).
- Camere e notti come il nastro Richieste (lib/richiesteNastro.postiRichiesta):
  proposta inviata → segmenti di `proposta_soluzione` + `proposta_alternative`;
  altrimenti `camera_id` + `nottiDellaRichiesta`; altrimenti senza camera.
  La funzione `tratti` del nastro non è esportata: riscritta uguale nel file nuovo.
- Le richieste in attesa NON rendono occupata una camera.

## Verifiche
- tsc ok, suite 2247/2247, build ok, prova a mano 6/6.
- Locale (`next start` 3219): senza token 401; date invertite 400; 03→06/11
  JSON con `notti_con_richiesta_in_attesa: []` su tutte le camere e
  `richieste_in_attesa_senza_camera: []`; testo identico a prima.
- Nel database oggi **0 richieste aperte** (novembre: 3 confermate, 1
  chiusa/scaduta): il confronto con la pagina Richieste non può mostrare notti
  segnalate; la logica è provata solo sui dati inventati del test.
- Nessuna scrittura su Supabase, nessuna migrazione.

## Limiti e prossima azione
- Prima richiesta vera in attesa: confrontare l'endpoint con la pagina Richieste.
- STATO.md non aggiornato (vincolo sui file); questa voce è un commit a parte.
