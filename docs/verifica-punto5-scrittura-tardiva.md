# Punto 5 — verifica indipendente: «Verifica pagamento», nota, risposta persa con scrittura ancora in corso (21/09/2026)

Candidato locale: commit sopra `78beb40` (niente push, niente deploy, niente 0057
applicata, nessuna scrittura su Supabase). Tutto quello che segue gira sul Mac:
test automatici, anteprima sintetica (finto Supabase) e PostgreSQL 16 locale.
**Nessuna prova qui vale come verifica di Supabase o del gestionale online.**

## Che cosa fa davvero «Verifica pagamento» (percorso ricostruito)

`lib/pagamentiDati.verificaPagamento`:

1. **Ricerca** del movimento del tentativo custodito (`ca_acconto_pendente_<soggiorno>`
   in localStorage): rilegge i movimenti della prenotazione (`GET payments`) e li
   confronta col tentativo tramite `ritrovaPendente` (`lib/statistiche/pagato`):
   - **per chiave** (`chiave_operazione` = la chiave del tentativo) quando le righe
     portano quella colonna: identificazione **certa**;
   - **per stima** (una riga uguale per importo/metodo/data in più di quante ce
     n'erano prima di scrivere) solo senza la colonna o dopo l'INSERT di ripiego
     (`senzaChiave`, quando la funzione server non esiste).
2. **Nota** (solo se ritrovato **per chiave** e se il tentativo ne aveva una):
   `UPDATE payments SET note … WHERE id = <movimento> AND note IS NULL`
   (`scriviNota`). Zero righe toccate → rilegge la nota: se è già la nostra va
   bene; se è **diversa** non la sovrascrive e avvisa («…la nota non è stata
   scritta perché il movimento ne ha già una diversa»). Ritrovato per stima →
   incasso confermato, nota NON scritta, avviso a parte.
3. **Bollino «pagato»** se il conto risulta coperto: `segna_pagato(_prenotazione)`
   con `p_mancante_atteso = 0` (con la 0057 non può inventare un incasso; senza,
   vale la regola della 0049 esattamente come dopo un salvataggio normale).
4. **Nessuna registrazione di nuovi incassi**: la verifica non chiama mai
   `registra_acconto*` né fa INSERT (guardia in `lib/fogliScheda.test.ts`).

## Risposta persa e scrittura ancora in corso

- «Non trovato» **non** cancella la chiave: il tentativo (chiave, importo, modo,
  giorno, nota) resta custodito; il foglio mostra i suoi dati in sola lettura
  (importo, nota, tasti Saldo/Altro spenti, data e modo fermi) e il tasto diventa
  «Riprova lo stesso pagamento», acceso solo dopo una verifica «non trovato».
- «Riprova» manda **lo stesso** pagamento con la **stessa chiave**: se la richiesta
  di prima intanto è arrivata, la funzione risponde `gia_presente` (nessun
  doppione) e la conferma dice «Ritrovati e confermati …»; se non era arrivata
  scrive adesso e dice «Registrati …».
- Chiudere e riaprire il foglio ritrova il tentativo (tasto di nuovo spento
  finché non si verifica). Un importo/modo/data cambiati nel frattempo non
  passano: `salva()` usa sempre i dati del tentativo finché non è risolto.
- Ripiego senza funzione server (INSERT, nessuna chiave): l'esito incerto si
  ferma con «…Senza la funzione del server non posso rimandarlo in sicurezza:
  controlla i movimenti nella scheda e chiedi assistenza.» e «Riprova» resta
  spento. (Online questo percorso non esiste: la 0049 è applicata.)

## Prove riproducibili

### A. Test automatici (Mac)

```bash
npm test                                  # suite intera: 1623 verdi il 21/09/2026
node --test lib/fogliScheda.test.ts lib/statistiche/pagatoContratto.test.ts lib/contoAttesoSql.test.ts
npx tsc --noEmit -p . && npx eslint lib/pagamentiDati.ts lib/statistiche/pagato.ts components/scheda/FoglioPagamento.tsx
```

### B. Concorrenza su PostgreSQL 16 locale, due connessioni (scrittura tardiva)

Cluster usa-e-getta (mai il database vero):

```bash
B=/opt/homebrew/opt/postgresql@16/bin; D=/tmp/pg0057
LC_ALL=C $B/initdb -D $D -U postgres --auth=trust -E UTF8 --locale=C
LC_ALL=C $B/pg_ctl -D $D -o "-p 54390 -k /tmp -c listen_addresses=127.0.0.1" -l $D/log.txt start
$B/createdb -h 127.0.0.1 -p 54390 -U postgres collaudo0057
DATABASE_URL=postgres://postgres@127.0.0.1:54390/collaudo0057 node scripts/revisioni/collaudo-0057-concorrenza.mjs
```

Atteso: `22 casi, 22 OK`. I casi 11a–11f e 12 sono quelli di questo rilievo:

| Caso | Sequenza | Atteso |
|---|---|---|
| 11a | A: `begin` + `registra_acconto_prenotazione` (scritto, NON confermato) · B: legge (0 righe) · B: stessa chiave → aspetta sul lock · A: `commit` | B torna `gia_presente`, stesso `movimento_id`, 1 movimento |
| 11b | la riprova arriva PRIMA dell'originale | l'originale trova la chiave, 1 movimento |
| 11c | importo cambiato = chiave nuova mentre A è in corso | con le cifre attese `CONTO_CAMBIATO`; SENZA cifre attese (pagine vecchie) 2 movimenti = il difetto che il foglio evita bloccando i dati |
| 11d / 11e | come 11a via wrapper `registra_acconto`: gruppo (group_id, riprova dall'altra camera) e singola | `gia_presente`, 1 movimento |
| 11f | saldo tardivo + bollino con mancante atteso 0 | `pagato` senza movimenti inventati |
| 12 | nota condizionata `note is null` | la seconda scrittura tocca 0 righe, la nota resta |

Lo script rifiuta host non locali senza `--consento-remoto` (autorizzazione
separata, non compresa in questo incarico).

### C. Anteprima sintetica (finto Supabase, nessuna rete)

Avvio: voce `gestionale-bnb-anteprima-prenotazioni-finta` del pannello (porta
3213, finto su 54329) o `node scripts/revisioni/anteprima-prenotazioni-finta.mjs --porta 3216`
(finto su 54332). Login con un'email qualsiasi. Interruttori (GET sul finto):

- `/finto/errore-pagamento?modo=tardiva&dopo=12000` — la PROSSIMA registrazione
  risponde 503 subito ma la scrittura arriva dopo 12 s; intanto le letture non
  la vedono e le chiamate sullo stesso soggiorno aspettano (come sul lock);
- `?modo=persa` (scrive, poi 503) · `?modo=caduta` (503 prima di scrivere) ·
  `?modo=errore` (P0001, errore certo) · `?modo=0` spegne;
- `/finto/senza-rpc-pagamenti?on=1` — le funzioni non esistono (PGRST202): la
  prenotazione SENZA prenotazione_id ripiega sull'INSERT (tentativo `senzaChiave`).

Sequenza da rifare a mano su **Due Camere Sconto** (`/scheda/bbbbbbbb-0039-4000-8000-0000000000039`,
prenotazione_id), su **Carmela** (`…-0029-…0029`, group_id) e su **Centesimi Sconto**
(`…-2601-…2601`, singola, wrapper):

1. accendere `modo=tardiva&dopo=12000`; Aggiungi pagamento → Altro importo → 25,
   nota → Salva: subito il messaggio «Non riesco a confermare…», tasto «Riprova lo
   stesso pagamento» spento, campi in sola lettura, nessun movimento nel finto;
2. Verifica pagamento → «Il pagamento non risulta ancora registrato. Puoi
   rimandarlo…», tasto acceso; provare a scrivere 150 o a cambiare modo: non cambia;
3. Annulla → riaprire: tentativo ancora lì, tasto spento → Verifica → acceso;
4. Riprova (anche con doppio clic): il foglio aspetta la scrittura tardiva, poi
   «Ritrovati e confermati 25 € …»; nel finto UN solo movimento con quella chiave e
   la nota; localStorage senza `ca_acconto_pendente_*`.
5. Con `modo=caduta`: Verifica → «non risulta ancora registrato» → Riprova →
   «Registrati …» (scritto adesso, un movimento).
6. Nota già presente: `modo=persa`, Salva, poi (da un «altro telefono»)
   `PATCH /rest/v1/payments?id=eq.<id>` con `{"note":"…"}`, poi Verifica →
   incasso confermato, nota lasciata com'è, avviso «…ne ha già una diversa».
7. Ripiego: `senza-rpc-pagamenti?on=1` + `modo=caduta` su Centesimi Sconto →
   Verifica → «…chiedi assistenza», Riprova spento; con `modo=persa` → Verifica →
   confermato per stima, nota NON scritta, avviso a parte.

Esiti ottenuti il 21/09/2026: tutti come sopra (registro del finto: «risposta 503
SUBITO, scrittura ancora in corso» → «in fila dietro la scrittura tardiva» →
«scrittura TARDIVA confermata» → «chiave già applicata, nessuna riga nuova» →
«PATCH payments 1 righe ← nota»).

## Percorsi che restano SENZA la nuova protezione

- Le pagine vecchie `/prenotazioni/[id]` (acconto e «segna pagato» di
  `app/prenotazioni/[id]/page.tsx`): chiamano le funzioni senza cifre attese e
  senza mancante atteso, e la risposta persa lì dice ancora «non salvato»; il
  ritentativo con la stessa chiave resta idempotente (0049) ma i dati non sono
  bloccati (caso 11c′: importo cambiato = secondo movimento).
- «Togli pagamento»: DELETE diretto (piano 0057, §7).
- La nota di un movimento scritto dalle pagine vecchie non passa da `scriviNota`.

## Limiti

- Provato su PostgreSQL 16 locale e sul finto: **Supabase (17.x) e il gestionale
  online NON sono verificati**; la 0057 resta NON applicata.
- Nel ripiego senza funzione server un tentativo incerto mai ritrovato lascia il
  foglio fermo finché la custodia non viene tolta a mano (assistenza): scelta
  voluta, il percorso online non esiste.
