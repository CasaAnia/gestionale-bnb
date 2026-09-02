# Consegna archiviata — prenotazioni: quadrupla nera e date stabili

ARCHIVIATA il 02/09/2026: il blocco è stato pubblicato su `main` come
`671a677` (integrazione del rilascio prenotazioni). La scheda attiva è
passata alla Fase 5 (fatture Casa Ania). Il banner «Da controllare» fra
mesi diversi resta archiviato in `CONSEGNE-ARCHIVIO-BANNER-DA-CONTROLLARE.md`.
Questo blocco correggeva due regressioni segnalate da Ania nella gestione
delle prenotazioni.

## Identità e perimetro

- Base tecnica: `6d44d69` (modifica del telefono della nuova prenotazione già
  presente e mantenuta intatta).
- Candidato implementato: `a8b4495`. Candidato fermo dopo revisione: HEAD di
  `correzioni-prenotazioni-quadrupla-date`, figlio di `a8b4495` (solo scheda,
  strumento di anteprima e voce di avvio: codice applicativo identico).
- Stato: VERIFICATO IN LOCALE — revisione consolidata di Claude verde del
  02/09/2026, nessun bloccante; PRONTO PER PASSAGGIO AUTORIZZATO. Nessun push
  e nessun deploy senza autorizzazione esplicita di Ania.
- Implementatore: Codex. Revisore: Claude (giro unico, 02/09/2026).
- Requisito colore: il terracotta significa che è occupato un solo letto del
  pool comune; il nero significa che entrambi i letti sono occupati e non se
  ne può aggiungere un altro. Una quadrupla in Lena occupa da sola entrambi.
- Requisito date: check-in e check-out non devono sovrapporsi su iPhone né
  nella nuova prenotazione né in modifica/prolungamento.
- Perimetro tecnico: calcolo puro e condiviso del pool letti, colori del
  calendario, lettura disponibilità in nuova/modifica prenotazione e classi
  protettive dei campi data. Nessuna query di scrittura nuova, nessuna
  modifica a dati, schema o permessi.

## Casi di accettazione

| ID | Sequenza e atteso | Livello di prova | Esito |
| --- | --- | --- | --- |
| P01 | 0 letti = colore normale; 1/2 = terracotta; 2/2 o più = nero. Anche la riga riepilogativa dei letti mostra 2/2 in nero con testo bianco. | funzioni pure + integrazione pagina | VERDE: `calendarioLetti.test.ts` controlla stati, colori e collegamento effettivo della pagina. |
| P02 | Lena con 3 ospiti occupa 1 letto; Lena quadrupla occupa 2 letti e quindi la sua barra è nera. Due prenotazioni da un letto sovrapposte danno lo stesso nero. | funzioni pure | VERDE: `tariffe.test.ts` confronta la regola del calendario con la tariffa da 1 a 4 ospiti. |
| P03 | Le prenotazioni storiche con `extra_bed=true` e senza giorni espliciti restano conteggiate correttamente. | funzione pura + query | VERDE: test dedicato e campo `extra_bed` incluso nelle letture di nuova/modifica. |
| P04 | A 320–390 px le due date restano dentro le rispettive colonne nella nuova prenotazione; modifica e prolungamento conservano la stessa protezione già introdotta. | regressione sul sorgente | VERDE: wrapper `min-w-0` e input `min-w-0 appearance-none` verificati su entrambi i percorsi. |
| P05 | Nessun cambiamento ai conti, alle prenotazioni esistenti o al database; niente pubblicazione. | ispezione + suite | VERDE: solo letture già esistenti ampliate col campo necessario; nessun accesso remoto o scrittura. |

## Prove di consegna

- Test mirati del blocco.
- Suite applicazione completa, TypeScript e build di produzione.
- `node scripts/verifica-consegna.mjs --base 6d44d69` sul candidato pulito.

## Revisione consolidata di Claude (02/09/2026, candidato `a8b4495`)

Esito: NESSUN BLOCCANTE. Assert dei test esistenti non toccati.

Controlli tecnici sull'albero fermo `a8b4495`:

- Diff `6d44d69..a8b4495` letto per intero (9 file). Il telefono modificabile
  del cliente nuovo (base `6d44d69`) è intatto: il diff non tocca quella parte.
- `node scripts/verifica-consegna.mjs --base 6d44d69`: VERIFICHE_TECNICHE_OK
  (suite, regressioni delle revisioni, strumenti locali, TypeScript, lint).
- `next build`: exit 0, 27 pagine generate.
- Pulizia dei tipi del calendario: solo tipizzazione di `any` preesistenti,
  copia dell'array camere prima dell'ordinamento e aggiornamento del ref
  `vaiA` spostato in un effetto dichiarato PRIMA dell'effetto che lo usa (gli
  effetti corrono in ordine di dichiarazione): nessun cambio di comportamento.
- Regola del pool: `lettiPoolPrenotazione` conta 0/1/2, con `extra_bed=true`
  senza date o con sole date esplicite; il calendario colora sul TOTALE della
  notte (niente più sottrazione della prenotazione corrente); la nuova
  prenotazione legge anche `extra_bed` e usa la stessa funzione. La pagina di
  modifica non è nel diff e mantiene la sua regola locale identica.

Prove UI reali senza rete, con lo strumento aggiunto in questa revisione
(`scripts/revisioni/anteprima-prenotazioni-finta.mjs`: finto Supabase locale
con login e PostgREST minimale su 5 prenotazioni sintetiche; le scritture
sono rifiutate; voce `gestionale-bnb-anteprima-prenotazioni-finta` in
`.claude/launch.json`). Nessuna richiesta al progetto Supabase vero.

| Caso | Prova a 390 px | Esito |
| --- | --- | --- |
| Quadrupla Lena 3–5 set (2 letti da sola) | barra `rgb(31,41,55)` su entrambe le notti; riga letti `2/2` sfondo nero, testo `white` | VERDE |
| Allegra 3 ospiti + Ambra 3 ospiti il 7 set; solo Ambra l'8 | 7 set: entrambe le barre nere e `2/2` nero; 8 set: barra terracotta e `1/2` bianco/marrone | VERDE |
| Storica Amelia `extra_bed=true` senza date, PAGATA, 10–12 set | strisce terracotta/verde il 10; strisce nere/verde l'11 (pool esaurito da Lena bonifico) | VERDE |
| Lena 3 ospiti con BONIFICO l'11 set | strisce nere/viola; `2/2` nero | VERDE |
| Legenda | «1 letto extra occupato» terracotta e «2/2 letti occupati» nero | VERDE |
| Nuova prenotazione, caselle data | 390 px: check-in 33–191, check-out 199–357; 320 px: 33–156 e 164–287; nessuna sovrapposizione, ciascuna dentro la propria colonna, nessuno scorrimento orizzontale | VERDE |
| Nuova, Lena 4 ospiti 7–9 set | 7 e 8 set neri (2+2 e 1+2 > 2), Salva disabilitato | VERDE |
| Nuova, Lena 3 ospiti 7–9 set | 7 set nero, 8 set selezionabile (1+1 = 2), Salva disabilitato finché resta il 7 | VERDE |
| Nuova, Allegra 3 ospiti 3–5 set | 3 e 4 set neri per la sola quadrupla; Salva disabilitato | VERDE |

Limiti dichiarati:

- La sovrapposizione delle caselle data è un comportamento del Safari di
  iPhone: nel pannello Chromium si verifica solo il layout (colonne, larghezze,
  classi `min-w-0 appearance-none`); la conferma finale resta sull'iPhone di
  Ania dopo la pubblicazione. Modifica e prolungamento sono coperti dal test
  sul sorgente (protezione già presente nella base).
- Nella prima scheda del pannello i click restavano bloccati: il login è stato
  inviato con l'handler del modulo; il percorso della nuova prenotazione è
  stato ripetuto in una seconda scheda con click reali; camera, date e ospiti
  impostati con `form_input` (stessi eventi della digitazione).
- Nessuna prova su dati reali: vietato l'accesso remoto in questa revisione.

MIGLIORIE registrate (non condizionano l'approvazione):

- M1 (preesistente): in nuova prenotazione i giorni bloccati ma auto-selezionati
  appaiono come chip neri senza avviso testuale; l'unico segnale è Salva
  disabilitato. Un avviso esplicito aiuterebbe su telefono.
- M2 (documentazione): P03 cita «letture di nuova/modifica», ma solo la nuova
  è nel diff; la modifica conserva la regola locale identica. Unificarla su
  `lettiPoolPrenotazione` è una pulizia futura, non un difetto.

## Prossimo passo

🔴 Ania autorizza la pubblicazione (push su `main` + deploy Vercel) del
candidato fermo. Dopo la pubblicazione: controllo su iPhone delle due caselle
data e di una quadrupla in Lena sul calendario vero.
