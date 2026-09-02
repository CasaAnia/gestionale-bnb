# Verifica del contratto sito → gestionale (pezzo 7, 02/09/2026)

Verifica documentale e con prove locali del passaggio 5B/5B-bis: il modulo
/prenota di casaaniarozzano.it (repo `sito-casaania`, HEAD `da91e37`) manda
le richieste a `POST /api/richieste/web` del gestionale (repo `gestionale-bnb`).
Nessun comportamento è stato modificato: tutte le voci risultano conformi.
Nessun invio reale: l'endpoint è stato provato sull'anteprima finta senza
rete (`scripts/revisioni/anteprima-richieste-finta.mjs`, porta 3214) con
segreto locale «prova-locale» e chiavi Pushover non valide.

## Esito per voce

| Voce | Esito | Evidenza |
| --- | --- | --- |
| Segreto solo lato server nel sito, mai al browser | CONFORME | `RICHIESTE_WEB_SECRET` compare solo in `app/api/prenota/route.ts:422` (route server) e in `lib/richiesteGestionale.ts:102` (messaggio di ripiego «segreto mancante»); nessuna variabile `NEXT_PUBLIC_RICHIESTE*` (le uniche `NEXT_PUBLIC_` del sito sono `SUPABASE_URL` e `SUPABASE_ANON_KEY`); `lib/richiesteGestionale` è importato solo dalla route; nessun file con `'use client'` cita il segreto; `PrenotaClient.tsx` chiama solo `fetch('/api/prenota')` |
| Il modulo pubblico non crea più prenotazioni «in attesa» | CONFORME | Nel sito le uniche scritture su Supabase sono due `insert` su `site_events` (statistiche visite, `app/api/eventi/route.ts`); nessun `insert/update/upsert/delete/rpc` su `bookings` o `guests`; `bookings` viene solo LETTA (3 select: disponibilità, doppione, richiesta recente) |
| Una richiesta riuscita compare solo in `richieste`; il calendario principale cambia solo alla conferma | CONFORME | Prova locale: 11 richieste accettate (201) → nel finto Supabase `richieste` con canale `web`, stato `in_attesa`; `bookings` 12 → 12 (invariato). `app/calendario/page.tsx` non legge la tabella `richieste`. Le prenotazioni nascono SOLO dalla RPC `conferma_richiesta` (test `lib/richiesteConfermaRpc.test.ts`, caso b) |
| Pushover e web push non duplicati dal sito su 201/200 | CONFORME | `app/api/prenota/route.ts:449-451`: sul successo il sito risponde al cliente senza avvisi («lo manda già il gestionale»); `sendPushoverAlert` è chiamato solo nel ramo di ripiego; nel sito non esiste codice web push (nessun `VAPID`/`webpush` in `app`, `lib`, `public`; resta solo la dipendenza `web-push` in `package.json`, inutilizzata). Il gestionale invia push + Pushover una volta sola per richiesta creata (`app/api/richieste/web/route.ts`) |
| Ripiego quando il gestionale non risponde | CONFORME | `classificaRisposta`: 401/429/5xx/timeout/rete → `ripiego`; la route risponde `{ ok: true, solution }` (cliente rassicurato) e NON crea nulla; `avvisaRipiego` manda Pushover con titolo «⚠️ Richiesta dal sito NON entrata nel gestionale» e testo completo (nome, cognome, periodo, persone, camera, telefono, note, motivo, link a Richieste → Nuova richiesta); log solo con motivo tecnico ed esito dei canali. Test del sito (9/9): «classificazione: successo, doppione, 400 tradotto, ripiego», «inviaAlGestionale: … 5xx, timeout, rete, segreto mancante», «testo unico con tutti i dati e il motivo», «partono entrambi…», «se l'email fallisce… il Pushover parte comunque» |
| Email di ripiego spenta finché non configurata | CONFORME | `lib/emailRipiego.ts`: senza `RESEND_API_KEY`, `EMAIL_RIPIEGO_A`, `EMAIL_RIPIEGO_DA` → `{ inviata: false, motivo: 'email non configurata (…)' }`, nessuna chiamata; test «email: senza configurazione non parte e lo dice». Scelta di Ania: nessuna email, le variabili NON vanno impostate |
| Nessun dato personale nei log | CONFORME | Sito: 3 sole righe di log (`route.ts:375` errore Supabase con chiave oscurata, `:426` «rifiutata dal gestionale (400)», `:446` «ripiego… (motivo) · pushover ok/KO · email ok/KO»). Gestionale: `log(esito, motivo)` con soli codici e motivi (vedi log sotto) |
| Anti-doppione a 10 minuti, validazione, limite per IP | CONFORME | Prova locale: 7) stessa richiesta (telefono uguale, nome con maiuscole diverse) → `200 {"doppione":true}` con lo stesso id; 4) e 5) → 400 con messaggio; 8) 12 invii da `X-Forwarded-For: 9.9.9.9` → 10 × 201 poi 2 × 429. Test puri `lib/richiesteWeb.test.ts` (validazione, camera, doppione, limite per IP) |
| Endpoint: 401 senza segreto, 400 dati invalidi, 429 oltre il limite | CONFORME | Log qui sotto |

## Prova locale dell'endpoint (02/09/2026, anteprima finta, porta 3214)

```
bookings prima: 12
1) senza segreto:      401
2) segreto sbagliato:  401
3) JSON rotto:         {"error":"JSON non valido"} 400
4) persone 5:          {"error":"Persone: da 1 a 4"} 400
5) arrivo passato:     {"error":"La data di arrivo è nel passato"} 400
6) valida:             {"id":"5b18e6bc-…","push":{"inviate":0,"errori":0},"pushover":false} 201
7) doppione:           {"id":"5b18e6bc-…","doppione":true} 200
8) limite IP 9.9.9.9 (12 invii): 201 201 201 201 201 201 201 201 201 201 429 429
bookings dopo: 12
richieste web nel finto: {cognome: Web, canale: web, stato: in_attesa, camera_id: <Lena>, telefono: +393331234567, note: "ciao\nEmail: a@b.it", origine: google}
```

Log del server (nessun nome, telefono o nota):

```
[richieste/web] … 401 segreto mancante o errato
[richieste/web] … 400 JSON non valido
[richieste/web] … 400 Persone: da 1 a 4
[richieste/web] … 400 La data di arrivo è nel passato
[richieste/web] … avviso pushover non inviato: Pushover HTTP 400   ← chiavi finte: nessun avviso reale
[richieste/web] … 200 doppione entro 10 minuti, nessuna nuova richiesta
[richieste/web] … 429 troppe richieste dallo stesso indirizzo
```

Come ripetere: `node scripts/revisioni/anteprima-richieste-finta.mjs` (o la
voce `gestionale-bnb-anteprima-richieste-finta` del pannello), poi i `curl`
con `Authorization: Bearer prova-locale` su `http://localhost:3214/api/richieste/web`.

## Limiti

- Il repo del sito è stato letto e i suoi 9 test eseguiti in locale; il
  comportamento in produzione (Vercel) non è stato provato con invii reali.
- Il limite per IP vive nella memoria dell'istanza serverless: è un freno,
  non un muro (già dichiarato nel pezzo 5A).
- La dipendenza `web-push` del sito è residua e inutilizzata: rimuoverla è
  una pulizia futura, non un difetto.
