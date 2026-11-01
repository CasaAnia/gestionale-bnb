# 02/11/2026 — Claude — endpoint di sola lettura /api/disponibilita

## Richiesta di Ania
Un solo nuovo endpoint GET che risponde con la disponibilità delle camere per un
intervallo di date, protetto da un token segreto, per far leggere la disponibilità
a un assistente esterno con un semplice link. Vincolo assoluto: nessun file
esistente modificato, solo file nuovi.

## Base e versione finale
- Base: origin/main **73ee702** (30/10/2026), copia pulita in worktree
  `/Users/amerigogranata/gestionale-disponibilita` (branch `disponibilita`).
- Finale: **b1dba6b** «Aggiunge endpoint di sola lettura /api/disponibilita con token»,
  spinto su origin/main (fast-forward 73ee702 → b1dba6b).
- `git show --stat`: 1 file, 118 righe aggiunte, **nessun file esistente modificato**.
- La cartella `/Users/amerigogranata/gestionale-bnb` NON è stata usata: è ferma a
  84759a3 (30/09) con 16 modifiche pendenti e un commit mai spinto; Ania ha chiesto
  di ricordarglielo più tardi.

## File
- `app/api/disponibilita/route.ts` (nuovo). `.env.example` non esiste nel repo.

## Cambiamento osservabile
`GET /api/disponibilita?dal=AAAA-MM-GG&al=AAAA-MM-GG&token=…[&testo=1]`
- 401 `{"errore":"non autorizzato"}` senza token o token diverso da `DISPONIBILITA_TOKEN`
  (confronto esatto, come richiesto: nessuna pulizia di spazi/a capo).
- 400 `{"errore":"date non valide"}` / `{"errore":"massimo 60 notti"}`.
- 200 JSON (camere nell'ordine fisso, tipo, persone_max, notti_occupate,
  letti_aggiuntivi_impegnati_per_notte) oppure testo semplice con `testo=1`.
- `dynamic = 'force-dynamic'`, `revalidate = 0`, `Cache-Control: no-store`.
- Sola lettura: due `select` con il client admin (lib/supabaseAdmin), nessuna scrittura.
- Riusa `STATI_CHE_OCCUPANO`, `siSovrappone`, `giorniTra`, `notti`, `ordinaCamere`
  (lib/disponibilita), `ROOM_TYPE_BY_NAME` (lib/roomTypes), `capienzaCamera`
  (lib/tariffe), `lettiOccupatiPerNotte` (lib/lettiAggiuntivi), `dataItaliana`.

## Verifiche (locale, `next start` porta 3219 sulla build di produzione)
- `tsc --noEmit` ok; `npm test` 2247/2247; `npm run build` ok (route elencata).
- Senza token → 401; token sbagliato → 401; date invertite → 400; 61 notti → 400.
- Intervallo reale 03/11 → 06/11/2026 (3 notti): JSON e testo coincidono con la
  lettura indipendente delle righe `bookings` confermate (script di sola lettura
  fuori repo): Amelia e Allegra occupate tutte e 3 le notti, Ambra e Lena solo il
  03/11, letti aggiuntivi 03/11: 1, 04/11: 0, 05/11: 0.
- Calendario online NON guardato (richiede login, che Claude non esegue).
- Nessun dato scritto su Supabase, nessuna migrazione.

## Pubblicazione
Push su main alle ~15:00 del 02/11/2026; deploy Vercel automatico (esito verificato
a parte via GitHub API, vedi STATO quando aggiornato). Perché funzioni online Ania
deve inserire `DISPONIBILITA_TOKEN` fra le Environment Variables di Vercel
(Production) e rifare il deploy: fino ad allora risponde 401.

## Limiti e prossima azione
- Il token è stato consegnato ad Ania in chat, non è in nessun file del repo.
- Questa voce di diario e STATO.md NON sono nel commit (vincolo «solo file
  nuovi in app/api/disponibilita/»): la voce è un file nuovo lasciato non
  committato nel worktree; chi aggiorna il registro la può includere.
- Rilievi altrove, solo descritti: `lib/disponibilita.ts` importa con suffisso
  `.ts` (serve a node --test, Next lo accetta); `camereLibere` non è usata qui
  perché lavora sull'intervallo intero, non notte per notte.

## Esito deploy (aggiunto alle 00:30)
Deployment GitHub/Vercel 7480773385 per b1dba6b: **success**. Online senza token la route risponde 401 JSON (una sola chiamata, niente polling).
