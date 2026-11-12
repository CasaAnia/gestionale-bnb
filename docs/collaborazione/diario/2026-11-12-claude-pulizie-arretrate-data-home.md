# 12/11/2026 — Claude — pulizie arretrate «superate» e data in testata della Home

## Richiesta di Ania (incarico scritto, due pezzi, un commit per pezzo)
1. Le pulizie arretrate mai segnate ma «superate» da un ospite arrivato dopo
   nella stessa camera non devono più comparire (Home 41 da fare, /pulizie
   «4 DA FARE», decine di schede della stessa camera in ritardo di settimane).
2. La data in cima alla Home era ferma al giorno dell'ultima pubblicazione
   («Lunedì 2 novembre 2026» il 12/11).

## Base e versione finale
- Base: origin/main **721f6d2**, copia pulita in worktree
  `/Users/amerigogranata/gestionale-pulizie-arretrate` (branch `pulizie-arretrate`).
- La cartella `/Users/amerigogranata/gestionale-bnb` NON è stata usata: ferma a
  84759a3 (30/09) con modifiche pendenti e un commit mai spinto.
- Commit: **c2bbf7d** (pezzo 1) e **7482839** (pezzo 2), spinti su origin/main
  (fast-forward); CONSEGNA-ATTIVA.md e registro in un terzo commit.

## Pezzo 1 — regola in un punto solo
- `lib/pulizie.ts`: nuova `puliziaSuperata(bookings, roomId, scadenza, oggi, escludiId)`;
  la applicano `partenzeAperte` (filtro finale) e `pulizieAperte` (ramo 4 notti).
  Da lì passano Home (`pulizieDiOggi`), pagina Pulizie (`pulizieAperte`,
  `conteggioGiorno` → `esameCameraGiorno` → `partenzeAperte`), striscia
  (`conteggioGiorno`), cronologia (`cronologiaCamera`), push (`calcolaNotifica`).
- «Da controllare» non elenca pulizie dall'11/09/2026 (commento in
  lib/pulizieOggi.ts che cita `eccezioniPulizie` è superato: la funzione non esiste).
- Scadenza = `due` (data dopo i rimandi), come scritto nell'incarico. Un rimando
  oltre un arrivo in mezzo non rende la pulizia superata: caso non osservato.
- Nessuna scrittura: le superate non entrano in cleanings, Registro
  (`registroPulizie` legge solo eventi e automatiche), Statistiche
  (`resocontoPulizie`: fatte dagli eventi, stime solo prima del CUTOFF o automatiche).
- Test: `lib/pulizieSuperate.test.ts` (a–h). Aggiornato
  `lib/pulizieManuali.test.ts` «due partenze successive…» (regola dell'8/09
  sostituita da quella del 12/11: la prima conferma è superata).
- Dati veri del 12/11/2026, sola lettura con lo script fuori repo
  (`conta-pulizie.mjs` nello scratchpad, service role da .env.local):
  prima Home 41 (Allegra 10, Ambra 9, Lena 13, Amelia 9) e /pulizie «4 DA FARE»;
  dopo Home 3 e /pulizie «3 DA FARE», le partenze di oggi di Allegra, Ambra, Lena.
  Amelia resta senza pulizie: l'arretrato del 10/11 è superato dall'ospite entrato dopo.

## Pezzo 2 — data nel browser
- Causa confermata: `components/maison/StrisciaFoto.tsx` chiamava `dataStriscia()`
  nel JSX; la Home è prerenderizzata alla build e `suppressHydrationWarning`
  faceva tenere il testo del server.
- Ora: `useState`/`useEffect`, `new Date()` solo nel browser, fuso Europe/Rome,
  ricontrollo su `visibilitychange` (quando torna visibile), `pageshow` e ogni
  30 s (`RICONTROLLO_DATA_MS`, stesso ritmo della pagina Pulizie); riga vuota
  con spazio unificatore finché non c'è la data.
- Funzione pura spostata in `lib/dataStriscia.ts` (riesportata dal componente,
  nessun altro la importava). Test `lib/dataStriscia.test.ts`: formato, mezzanotte
  di Roma (23:30 UTC = giorno dopo; 22:30 UTC d'estate), guardia sul sorgente.
- Altri `new Date()` nel rendering: solo segnalati in CONSEGNA-ATTIVA (nessuno
  con `suppressHydrationWarning`, quindi React li ricalcola nel browser).

## Verifiche
- Suite: 2247/2247 prima, **2258/2258** dopo; `tsc --noEmit` pulito;
  eslint pulito sui file toccati; `npm run lint` sulla base 721f6d2 ha già
  47 errori (no-explicit-any ecc.) in file non toccati, stesso numero dopo.
- Anteprima finta della Home (scripts/revisioni/anteprima-home-finta.mjs,
  porta 3215, dal worktree): data «Giovedì 12 novembre 2026» (uppercase, 9.5 px),
  riga vuota alta 14,25 px come quella piena, al `pageshow` con orologio finto a
  domani il testo passa a «Venerdì 13 novembre 2026» e torna; «Pulizie di oggi ·
  2 da fare» e pagina Pulizie con lo stesso numero sui dati finti.
- Sito pubblicato: deploy Vercel verificato via GitHub API (vedi STATO);
  la Home online richiede il login, che fa solo Ania: la prova dal telefono è sua.

## Limiti
- Nessuna prova con login sul sito vero. Nessuna scrittura su Supabase.
- Il conteggio «prima/dopo» viene dal calcolo locale sui dati veri, non dalla
  schermata del telefono.

## Esito deploy (aggiunto alle 17:55)
Deployment GitHub/Vercel 7743563511 per 7e9c8e3 (Production, 16:45 UTC): **success**.
Home online non guardata con login (lo fa solo Ania): la prova dal telefono è sua.
