# Piano di rifacimento del modulo spese — Casa Mia e Casa Ania

*Progettazione tecnica del 27 agosto 2026. Solo analisi: nessun file modificato,
nessuna migrazione applicata, nessun push. Backup completo di riferimento:
`~/Desktop/Backup completo spese prima del rifacimento 2026-08-27` (221 spese,
728 righe, 81 documenti, totali: personale 4.621,75 € · azienda 169,10 €).*

---

## 1. Problemi dell'architettura attuale

**Monolite.** `components/SpeseTracker.tsx` (1.272 righe) contiene tutto:
caricamento dati, upload foto, form manuale, budget, spese fisse, le 4 schede
(Home/Calendario/Racconto/Domanda), il motore della domanda libera e la lista
voci. Ogni modifica rischia di rompere qualcos'altro e il file è ormai
illeggibile.

**Nessun ciclo di vita.** Una spesa nasce già definitiva: non esistono bozze,
stati di revisione, né un posto dove l'utente controlla ciò che Claude ha
estratto. `family_receipts.status` conosce solo `da_leggere`/`letto`.

**Collegamento documento debole.** `family_expenses.receipt_id` è un uuid
libero **senza foreign key** verso `family_receipts` (per questo esistono 6
spese scollegate senza che nulla lo segnali). Una spesa può avere al massimo
un documento; una fattura con più pagine/allegati non è rappresentabile.

**Righe scontrino povere.** `family_expense_items` ha solo nome, importo,
quantità, categoria, sottocategoria. Mancano: descrizione originale dello
scontrino, prezzo unitario, sconto, destinatario per riga (il gruppo è solo
sulla spesa madre), affidabilità, motivo del dubbio, necessario/discrezionale,
previsto/impulsivo.

**Nessun controllo matematico.** Nessuna verifica che la somma delle righe
coincida con il totale; la quadratura oggi dipende solo dalla diligenza di
Claude durante l'elaborazione. Idem per i duplicati: scartati a mano, nessun
rilevamento automatico.

**Nessuna memoria degli errori.** Le correzioni di Ania (categorie sbagliate,
nomi da unificare…) vengono applicate ma non registrate: impossibile misurare
dove l'estrazione sbaglia e migliorare le regole in modo sistematico.

**Casa Ania trattata come la famiglia.** Le fatture del B&B non hanno
fornitore, numero, scadenza, stato di pagamento, metodo di pagamento, camera
di riferimento. Una fattura ricevuta ma non pagata oggi non esiste finché non
la si registra come spesa già avvenuta.

**Modello categorie fragile.**
- `family_categories` è replicata per gruppo (115 righe = ~25 categorie ×
  gruppi): la stessa categoria "Varie" esiste 5 volte con id diversi, e tutte
  le analisi aggregano **per nome**.
- `family_subcategories` e `family_budgets` agganciano la categoria per
  `category_name` (testo): rinominare una categoria scollega silenziosamente
  sottocategorie e budget.
- L'ambito di una spesa si deduce dal gruppo; le spese senza gruppo finiscono
  in "personale" per euristica (`SpeseTracker.tsx:162`).

**Tolleranza alle colonne mancanti.** Le migrazioni si applicano a mano, quindi
il codice è pieno di `select *` + controlli difensivi (0013/0014/0015). È una
scelta consapevole ma aumenta la complessità e nasconde errori.

**Filtri ingombranti.** Di chi + periodo + navigazione mese occupano stabilmente
3 righe sopra il contenuto, su ogni scheda.

## 2. Parti riutilizzabili (da NON riscrivere)

- **Tutte le tabelle esistenti** come base: il nuovo modello è solo additivo.
- **Bucket `scontrini`** e il flusso upload con anteprima/staged/nota
  (`stagePhotos`/`saveStaged`), già robusto su connessioni mobili scarse.
- **`DemoGate` + `lib/demoMode`** (PIN 080412) — va solo esteso alle nuove rotte.
- **`BackBar`, `MobileTopBar`, `BottomNav`**, palette e stile (crema/ottone,
  niente bordi neri, dimming+ombra per la selezione).
- **Logica di scomposizione in voci** (`vociDi`), **`ListaVoci`** (somma per
  prodotto ×N, pastiglie persona/negozio, sezioni per sottocategoria),
  `corto()` per i nomi negozio, `GROUP_COLORS`/`ICONE`.
- **Le 4 viste esistenti**: Home (tessere, ritmo, previsione, sparkline, conto
  del caffè), Calendario, Racconto, Domanda — diventano contenuti di
  Panoramica/Analisi, non si buttano.
- **Budget** e **Spese fisse** (card e logica).
- **Regole prodotto** (`family_product_rules` + `applyRules`).
- **Workflow `/scontrini`** (skill Claude + note in `family_receipts`), che
  diventa il "motore di elaborazione" del nuovo flusso a stati.
- `lib/supabase.ts`, `lib/inviaPush.ts` (per future notifiche di scadenza).

## 3. Proposta del nuovo modello dati

Principio: **non si rinomina e non si cancella nulla**; si aggiungono colonne
e tabelle. Gli id e i collegamenti esistenti restano identici. Il concetto
centrale nuovo è il **ciclo di vita della spesa** e il **documento** come
entità di prima classe.

```
family_receipts  (= "documenti": scontrini, fatture, allegati)
   │ 1..N        status: da_elaborare → da_controllare → pronta → confermata / errore
   ▼
family_expenses  (= movimento; per le fatture Casa Ania porta anche i campi fattura)
   │ 1..N
   ▼
family_expense_items  (righe, ognuna con destinatario, classificazioni, affidabilità)

family_expense_documents  (ponte N:N spesa↔documento, per allegati multipli)
family_corrections        (log delle correzioni dell'utente)
```

- **Lo stato vive sulla spesa** (`review_status`), non solo sul documento: così
  anche le spese manuali e le fatture senza foto hanno un ciclo di vita.
  `family_receipts.status` tiene lo stato di *elaborazione* del file.
- **Scontrino misto Casa Mia / Casa Ania**: si mantiene il pattern attuale
  (una spesa per ambito, stesso documento collegato), ma l'elenco Movimenti
  raggruppa le spese che condividono il documento in **un movimento unico**
  con il totale del documento. In più ogni riga ha il suo `group_id`, così
  una voce può essere attribuita a una persona diversa dalla spesa madre.
  (Alternativa scartata: una spesa unica multi-ambito — romperebbe i totali
  per ambito, il profitto in Home/Statistiche e la compatibilità con le 221
  spese esistenti.)
- Le **fatture non ancora pagate** di Casa Ania sono spese normali con
  `payment_status='non_pagata'` e `due_date`: stanno nell'elenco, nello
  scadenzario e in "Impegnato/Da pagare"; entrano nel totale "Speso" solo
  alla data di pagamento (`paid_at`) — deciso da Ania il 27/08/2026.

## 4. Nuove tabelle e colonne (migrazione `0020_rifacimento_spese.sql`, DA NON APPLICARE ORA)

**`family_expenses` — nuove colonne** (tutte nullable o con default, zero impatto
sulle 221 esistenti):

| Colonna | Tipo | Uso |
|---|---|---|
| `review_status` | text default `'confermata'` check in (`da_elaborare`,`da_controllare`,`pronta`,`confermata`,`errore`) | ciclo di vita; le esistenti nascono confermate |
| `payment_method` | text check in (`contanti`,`carta_personale`,`carta_attivita`,`bonifico`,`altro`) | Casa Mia e Casa Ania |
| `supplier` | text | fornitore (fatture; per gli scontrini resta `store`) |
| `invoice_number` | text | numero fattura |
| `document_date` | date | data documento se diversa dalla data spesa |
| `due_date` | date | scadenza |
| `payment_status` | text default `'pagata'` check in (`pagata`,`non_pagata`) — "scaduta" è derivato: `non_pagata` + `due_date < oggi` | fatture |
| `paid_at` | date | data pagamento |
| `room_id` | uuid references rooms(id) | camera di riferimento (Amelia, Allegra, Ambra, Lena — la tabella `rooms` esiste già dalla 0001, niente nomi duplicati come testo). **Nullo = "Generale"**, che è il caso normale: utenze, forniture comuni, pulizie e manutenzioni della struttura. Mai obbligatorio. *(Deciso da Ania il 27/08/2026.)* |
| `extraordinary` | boolean default false | ricorrente (`recurring`) / straordinario |
| `doc_total` | numeric(10,2) | totale letto sul documento (per la quadratura) |
| `notes` | text | note libere |
| `error_message` | text | dettaglio per stato `errore` |

**`family_expense_items` — nuove colonne:**

| Colonna | Tipo | Uso |
|---|---|---|
| `raw_name` | text | descrizione originale stampata sullo scontrino (`name` resta il nome normalizzato) |
| `unit_price` | numeric(10,3) | prezzo unitario quando disponibile |
| `discount` | numeric(10,2) default 0 | sconto della riga (l'importo resta il netto, come da regola attuale) |
| `group_id` | uuid references family_groups | destinatario della riga (persona, o Casa Ania per lo split); se nullo vale quello della spesa |
| `necessity` | text check in (`necessario`,`discrezionale`) | classificazione facoltativa |
| `planning` | text check in (`previsto`,`impulsivo`) | classificazione facoltativa |
| `confidence` | numeric(3,2) | affidabilità 0–1 dell'estrazione |
| `doubt_reason` | text | motivo del dubbio (foto illeggibile, nome ambiguo…) |

**`family_receipts` — nuove colonne:** `kind` (`scontrino`/`fattura`/`altro`),
`mime_type`, `doc_total` (totale letto), `parsed_at`, `error_message`,
`file_sha256` (per i duplicati da file identico). `status` accetta i nuovi
valori mantenendo validi `da_leggere`/`letto` (nessun UPDATE sui dati storici;
il codice tratta `da_leggere`≡`da_elaborare` e `letto`≡`confermata`).

**Nuove tabelle:**

```sql
create table family_expense_documents (   -- allegati multipli
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references family_expenses(id) on delete cascade,
  receipt_id uuid not null references family_receipts(id) on delete cascade,
  unique (expense_id, receipt_id)
);
-- Backfill: una riga per ognuna delle 75 spese con receipt_id valorizzato.
-- family_expenses.receipt_id resta e continua a funzionare (compatibilità).

create table family_corrections (         -- log correzioni (§10)
  id uuid primary key default gen_random_uuid(),
  expense_id uuid references family_expenses(id) on delete set null,
  item_id uuid references family_expense_items(id) on delete set null,
  field text not null,                    -- es. 'category', 'amount', 'store'
  proposed_value text,                    -- cosa aveva proposto l'estrazione
  corrected_value text,                   -- cosa ha scelto l'utente
  rule_applied text,                      -- regola/euristica che aveva deciso il valore
  source text not null default 'revisione',
  created_at timestamptz not null default now()
);
```

RLS identica alle tabelle esistenti (`accesso_utenti_autenticati`). Indici su
`review_status`, `due_date`, `payment_status`, `family_expense_documents(expense_id)`.

**Non si aggiunge la FK su `family_expenses.receipt_id`**: le 6 spese con
receipt nullo e la storia esistente restano valide; il collegamento "forte"
nuovo è `family_expense_documents`.

## 5. Strategia di migrazione senza perdita dati

1. **Backup già fatto** (cartella sulla scrivania, hash SHA-256 in
   `manifest.json`) — prerequisito soddisfatto.
2. La migrazione 0020 è **solo additiva**: `add column if not exists`,
   `create table if not exists`, default che rendono valide le righe esistenti
   senza toccarle. Nessun `update`, `rename`, `drop`.
3. Unico backfill (idempotente, dentro la 0020): popolare
   `family_expense_documents` dalle 75 spese con `receipt_id` valorizzato.
4. Come sempre la migrazione si **incolla a mano** nell'SQL Editor Supabase;
   il codice nuovo è tollerante alle colonne mancanti (pattern già in uso):
   con la 0020 non applicata il modulo funziona in "modalità compatibilità"
   (tutto confermato, niente revisione).
5. **Verifica automatica post-migrazione**: script read-only (riuso di quello
   dell'inventario) che riconfronta conteggi (221/728/81/5/115/93/5), totali
   per ambito e ogni id col backup. Da eseguire subito dopo la 0020 e alla
   fine di ogni fase.
6. Le 6 spese senza documento restano intatte; il ricollegamento dei 5
   scontrini Esselunga del 5–6/8 è un'operazione separata e facoltativa
   (§decisioni).

## 6. Suddivisione di `SpeseTracker.tsx`

Da 1 file × 1.272 righe a moduli piccoli. La logica pura va in `lib/spese/`
(testabile con `node --test`, come `navetta.test.ts`):

```
lib/spese/
  types.ts        tipi condivisi (Ambito, Spesa, Riga, Documento, Stati…)
  dati.ts         caricamento/salvataggio Supabase (unico punto di accesso)
  voci.ts         vociDi, aggregazioni, somma per prodotto (dall'attuale)
  periodo.ts      monthRange, weekRange, periodo scelto, etichette
  domanda.ts      il motore della Domanda libera (oggi righe 481–564)
  controlli.ts    quadratura, duplicati, campi dubbi (§9) — NUOVO
  correzioni.ts   registrazione e lettura family_corrections (§10) — NUOVO
```

```
components/spese/
  SpeseShell.tsx        involucro per ambito: navigazione a 5, DemoGate, testata
  PanoramicaTab.tsx     card riassuntive (§7)
  MovimentiTab.tsx      elenco movimenti + FiltriPanel
  AggiungiSheet.tsx     bottone centrale: scatta/libreria/file/manuale
  DocumentiTab.tsx      documenti per stato, coda di revisione
  RevisioneSpesa.tsx    schermata di controllo bozza (§8)
  AnalisiTab.tsx        contenitore di: TessereCategorie, CalendarioView,
                        RaccontoView, DomandaView, BudgetCard, SpeseFisseCard
  ListaVoci.tsx         estratta com'è (pastiglie, sezioni, ×N)
  FiltriPanel.tsx       pannello filtri a comparsa + riga "filtri attivi"
  FatturaForm.tsx       form fattura Casa Ania (fornitore, scadenza, camera…)
  SpesaForm.tsx         form manuale attuale, ripulito
```

`SpeseTracker.tsx` **non si cancella** finché la parità non è verificata: la
fase 1 lo scompone mantenendo l'interfaccia attuale identica, le fasi
successive cambiano l'interfaccia.

## 7. Struttura delle nuove pagine e componenti

Le rotte restano `/spese-famiglia` (Casa Mia) e `/spese` (Casa Ania): link,
segnalibri e DemoGate esistenti continuano a valere. Dentro, `SpeseShell`
con la navigazione a 5 richiesta (barra propria del modulo, sticky in basso
sopra la BottomNav del gestionale — da verificare dal vivo su iPhone 390px):

```
Panoramica │ Movimenti │ (＋) │ Documenti │ Analisi
```

- **Panoramica** — in ordine: ① spese da controllare (n + link alla coda),
  ② fatture da pagare/scadute (solo Casa Ania), ③ speso nel periodo (con
  ritmo/previsione attuali), ④ budget disponibile, ⑤ ultimi movimenti.
- **Movimenti** — l'elenco unico; uno scontrino con più spese collegate appare
  come un movimento solo (somma delle sue parti, badge dei gruppi); tocco →
  dettaglio con righe, documento, stato. Filtri in pannello a comparsa
  (periodo, persona/gruppo, categoria, stato, metodo di pagamento, camera):
  chiusi mostrano solo pastiglie dei filtri attivi con ✕.
- **＋ Aggiungi** — foglio a comparsa con le 4 azioni: 📷 Scatta, 🖼️ Libreria,
  📁 Carica documento, ✏️ Manuale. (Riusa il flusso staged attuale.)
- **Documenti** — tutti i documenti per stato (da elaborare / da controllare /
  errore / confermati), anteprime, note, e il punto d'ingresso alla revisione.
  Dalla spesa si arriva sempre al documento originale e viceversa.
- **Analisi** — le 4 viste attuali (tessere-categorie, Calendario, Racconto,
  Domanda) + budget + spese fisse + (Casa Mia) le analisi
  necessario/discrezionale e previsto/impulsivo; (Casa Ania) costi per camera,
  ricorrente vs straordinario, metodi di pagamento.

Differenze per contesto (stessa infrastruttura, interfaccia coerente con gli
obiettivi): Casa Mia = budget, abitudini, acquisti inconsapevoli; Casa Ania =
scadenzario fatture, stato pagamenti, costi per camera, profitto (il collegamento
con Home/Statistiche resta sulle spese confermate).

## 8. Flusso completo: foto → elaborazione → revisione → conferma

```
 ① Acquisizione (telefono)
    scatta / libreria / file / manuale → upload nel bucket +
    family_receipts { status: 'da_elaborare', kind, sha256, nota }
    (una spesa manuale nasce direttamente 'pronta', senza documento)

 ② Elaborazione (fase 1: Claude via /scontrini — deciso da Ania il 27/08/2026)
    Claude NON crea più spese definitive. Deve: leggere il documento; creare
    la bozza strutturata (family_expenses in review_status='da_controllare');
    inserire TUTTE le righe (raw_name, unit_price, sconto, categoria,
    sottocategoria, group_id); indicare l'affidabilità di ogni campo
    (confidence + doubt_reason); eseguire i controlli matematici di §9;
    segnalare duplicati e incongruenze; scrivere doc_total e collegare il
    documento (receipt_id + family_expense_documents, receipt →
    'da_controllare'); poi ATTENDERE la conferma dell'utente dal gestionale.
    Se non riesce: receipt status='errore' + error_message.

    L'elaboratore è intercambiabile per costruzione: il contratto è "scrive
    una bozza valida nel modello dati e non conferma mai". Un domani un
    processo lato server (OCR/AI in-app) potrà sostituire /scontrini
    rispettando lo stesso contratto, senza toccare né il modello dati né la
    schermata di revisione. In questa fase NIENTE API AI nell'app e nessun
    costo per chiamata: bozze e validazione sono l'infrastruttura definitiva,
    /scontrini è l'elaboratore della prima fase.

 ③ Revisione (schermata RevisioneSpesa)
    mostra: foto/fattura zoomabile ── dati estratti ── per ogni campo dubbio
    l'evidenza del motivo ── controlli §9 (verde/rosso) ── totale documento,
    somma righe, differenza ── avviso "possibile duplicato di …".
    Ogni modifica dell'utente → riga in family_corrections
    { field, proposed_value, corrected_value, rule_applied }.
    Quadratura ko ⇒ il bottone Conferma resta disattivato (controllo obbligatorio).

 ④ Conferma
    review_status='confermata' (receipt 'confermata') → la spesa entra in
    totali, budget, statistiche, profitto. Fino ad allora le bozze sono
    visibili solo in Documenti/Panoramica, NON nei totali.
    'pronta' = controlli tutti verdi ma non ancora vista dall'utente:
    all'inizio TUTTO passa comunque dalla revisione manuale.
```

## 9. Controlli matematici e rilevamento duplicati (`lib/spese/controlli.ts`)

**Quadratura (obbligatoria):**
- `Σ(righe.amount) + arrotondamenti = doc_total` con tolleranza 0,01 €
  (gli sconti sono già incorporati nel netto di riga, regola esistente);
- se `unit_price` presente: `|unit_price × qty − (amount + discount)| ≤ 0,01`;
- `doc_total` assente ⇒ campo dubbio ⇒ `da_controllare`;
- differenza ≠ 0 ⇒ **stato `da_controllare` forzato**, conferma bloccata
  finché l'utente non corregge o registra esplicitamente un arrotondamento.

**Altri controlli:** sottocategoria presente su ogni riga (regola di Ania);
gruppo presente; data non futura e non anteriore a nov 2024; `confidence`
sotto soglia (0,8) ⇒ riga evidenziata col suo `doubt_reason`.

**Duplicati (avviso, mai blocco automatico):**
1. stesso `file_sha256` di un documento già caricato ⇒ duplicato certo
   (la regola "doppioni scartati senza chiedere" si applica qui);
2. stesso negozio + stessa data + stesso totale (±0,01) ⇒ probabile;
3. stesso importo e data con negozio simile (prefisso comune) ⇒ possibile.
   In revisione compare "possibile duplicato di [movimento]" con confronto
   affiancato; l'utente decide (scarta / conferma comunque). L'esito finisce
   in `family_corrections` (field=`duplicate`).

## 10. Registrazione e analisi delle correzioni

- Scrittura: ogni modifica in RevisioneSpesa (e ogni scarto duplicato) genera
  una riga `family_corrections`, col valore proposto, il corretto, il campo e
  la regola che aveva prodotto la proposta (es. `regola: aceto→Detersivi`,
  `euristica: negozio da intestazione`).
- Lettura: sezione "Qualità dell'estrazione" dentro Analisi (o solo per noi,
  da decidere): tasso di correzione per campo, per regola, per negozio; le 10
  correzioni più frequenti. Serve a: misurare gli errori, aggiornare
  `scontrini.md` e `family_product_rules`, e stabilire quando una tipologia
  (es. scontrini Esselunga) è matura per lo stato `pronta` con controllo a
  campione invece che totale.

## 11. Distinzione Casa Mia / Casa Ania

- **Dato**: resta l'`ambito` sui gruppi (`personale`/`azienda`) — nessuna
  modifica ai 5 gruppi esistenti. Le righe possono avere un `group_id` di
  ambito diverso dalla spesa madre solo attraverso lo split in spese sorelle
  (stesso documento), come oggi: i totali per ambito restano semplici e
  compatibili con Home/Statistiche/profitto.
- **UI**: due sezioni con lo stesso guscio (`SpeseShell ambito=…`) ma
  contenuti diversi: Panoramica di Casa Ania apre con lo scadenzario fatture,
  quella di Casa Mia con da-controllare + budget; Analisi diverge (abitudini
  vs costi per camera). I campi fattura compaiono solo nei form/filtri
  dell'ambito azienda.
- **Split alla revisione**: nella schermata di revisione ogni riga ha la
  pastiglia del destinatario (Casa, Ania, Matteo, M e A, Casa Ania); al
  salvataggio le righe vengono raggruppate in spese per ambito/gruppo madre,
  tutte agganciate allo stesso documento (pattern attuale, ora esplicito).

## 12. Piano di sviluppo in fasi verificabili

Ogni fase si chiude con: `npx tsc --noEmit` pulito, test `node --test` verdi,
script di verifica totali contro il backup, prova visiva a 390px, voce in
PROGETTO.md. Una fase non parte se la precedente non è verificata.

- **Fase 0 — Rete di sicurezza** ✅ *(completata il 27/08/2026, vedi
  resoconto in fondo)*: backup ✓, script `scripts/verifica-spese.mjs` ✓,
  test di caratterizzazione `lib/spese/caratterizzazione{,.test}.ts` ✓.
- **Fase 1 — Scomposizione a parità di funzioni**: estrarre `lib/spese/*` e
  `ListaVoci` da SpeseTracker SENZA cambiare nulla di visibile. Verifica:
  stessa UI, stessi numeri.
- **Fase 2 — Migrazione 0020** (Ania la incolla) + tipi aggiornati + modalità
  compatibilità. Verifica: script totali, app invariata.
- **Fase 3 — Nuovo guscio**: navigazione a 5, Panoramica, Movimenti con
  raggruppamento per documento, FiltriPanel, Aggiungi. Calendario/Racconto/
  Domanda traslocano in Analisi. SpeseTracker.tsx va in pensione.
- **Fase 4 — Ciclo di revisione**: stati, RevisioneSpesa, controlli.ts,
  duplicati, family_corrections; `/scontrini` (scontrini.md) aggiornato per
  scrivere bozze `da_controllare` con i campi nuovi.
- **Fase 5 — Casa Ania fatture**: FatturaForm, scadenzario, pagata/non
  pagata/scaduta, metodi di pagamento, camera, ricorrente/straordinario.
- **Fase 6 — Classificazioni e analisi**: necessario/discrezionale,
  previsto/impulsivo, analisi abitudini (Casa Mia), costi per camera (Casa
  Ania), pannello qualità estrazione.
- **Fase 7 — Pulizia**: rimozione del codice compatibilità superfluo,
  aggiornamento scontrini.md e memoria, eventuale ricollegamento dei 5
  scontrini orfani (se approvato).

## 13. Rischi e misure di sicurezza

| Rischio | Misura |
|---|---|
| Perdita/alterazione dei 221+728+81 record | migrazione solo additiva; backup con hash; script di verifica id-per-id dopo ogni fase |
| Migrazione 0020 applicata in ritardo o a metà | modalità compatibilità già prevista; la 0020 è un file unico idempotente |
| Regressione di profitto/Statistiche/Home | le bozze NON entrano nei totali; test di caratterizzazione sui totali prima del refactoring |
| Doppio conteggio nei movimenti raggruppati | il raggruppamento per documento è solo di presentazione; i totali si calcolano sempre dalle spese |
| Modalità dimostrazione che non copre le nuove viste | DemoGate su SpeseShell (un punto solo); prova col PIN in ogni fase |
| RLS dimenticata sulle nuove tabelle | policy nella stessa 0020, come le esistenti |
| Peso/lentezza su telefono (load carica tutto) | `dati.ts` incapsula le query: si potrà paginare per periodo senza toccare la UI |
| Bozze duplicate se l'elaborazione riparte | vincolo: un documento non in `errore` non è rielaborabile; sha256 contro i doppi upload |
| Push accidentale in produzione a metà lavoro | lavoro su branch `rifacimento-spese`; niente push su `main` senza verifica di fase (deroga concordata alla regola auto-push) |

## 14. Test necessari

- **Caratterizzazione (prima di toccare)**: dai JSON del backup, i totali
  attesi per mese/gruppo/categoria; `voci.ts` e `periodo.ts` devono
  riprodurli esattamente (fissa anche i casi: settimana da data, voce senza
  gruppo, item senza categoria → categoria madre).
- **Unit (`node --test`, pattern di `pulizie.test.ts`)**: `controlli.ts`
  (quadratura con sconti/arrotondamenti/tolleranza; duplicati nei 3 livelli);
  `domanda.ts` (le domande già note: "bar", "da sempre", caffè del pranzo…);
  `correzioni.ts`; stato derivato "scaduta".
- **Flusso**: foto → bozza → correzione → conferma su progetto Supabase di
  prova o con mock di `dati.ts`; verifica che una bozza non tocchi i totali.
- **Visivi (390px, regola mobile-first)**: le 5 tab, revisione con foto,
  pannello filtri, scadenzario; modalità dimostrazione; dark non previsto.
- **Verifica dati**: `verifica-spese.mjs` dopo ogni fase e dopo la 0020.

## 15. File che verrebbero creati o modificati

**Nuovi:** `supabase/migrations/0020_rifacimento_spese.sql` ·
`lib/spese/{types,dati,voci,periodo,domanda,controlli,correzioni}.ts` ·
`lib/spese/{voci,periodo,domanda,controlli}.test.ts` ·
`components/spese/{SpeseShell,PanoramicaTab,MovimentiTab,AggiungiSheet,DocumentiTab,RevisioneSpesa,AnalisiTab,ListaVoci,FiltriPanel,FatturaForm,SpesaForm}.tsx` ·
`scripts/verifica-spese.mjs` (read-only).

**Modificati:** `app/spese/page.tsx` e `app/spese-famiglia/page.tsx` (montano
SpeseShell) · `components/SpeseTracker.tsx` (svuotato per gradi, poi rimosso
in fase 7) · `~/.claude/commands/scontrini.md` (bozze + campi nuovi, fase 4) ·
`lib/demoMode.ts` (se le rotte interne cambiano) · `PROGETTO.md` (a ogni fase).

**Intoccati:** tutto il resto del gestionale (prenotazioni, calendario, arrivi,
pulizie, clienti, statistiche, push, sito).

---

## Decisioni prese (nessuna ancora aperta)

**Già decise (27/08/2026):**
- ✅ **Camere**: collegamento vero `room_id → rooms` (Amelia, Allegra, Ambra,
  Lena), nullo = "Generale", mai obbligatorio.
- ✅ **Elaborazione**: resta Claude via `/scontrini`, ma solo come creatore di
  bozze "da controllare" con righe complete, affidabilità per campo, controlli
  matematici e segnalazione duplicati; conferma sempre dell'utente dal
  gestionale. Architettura pronta a sostituirlo con un elaboratore lato
  server senza cambiare modello dati né schermata di revisione. Niente API AI
  nell'app e nessun costo per chiamata in questa fase.

- ✅ **Scontrino misto**: spese sorelle — una spesa per ambito, collegate allo
  stesso documento. Nella vista documento appaiono come UN unico acquisto;
  nelle statistiche ogni ambito riceve esclusivamente le proprie righe e il
  proprio importo (mai il totale del documento).
- ✅ **Fatture non pagate**: entrano nel totale principale "Speso" solo alla
  data effettiva di pagamento (`paid_at`). Prima stanno nello scadenzario e
  nei valori **"Impegnato/Da pagare"** della Panoramica Casa Ania. Le tre
  date si conservano separate: `document_date`, `due_date`, `paid_at`.
- ✅ **Storico**: le 221 spese esistenti migrano come già `confermata`, senza
  revisione retroattiva e senza toccare categorie, importi, righe o
  collegamenti.
- ✅ **5 scontrini Esselunga orfani (5–6/8)**: NON si ricollegano nella prima
  migrazione. Solo a fine lavori (fase 7), e solo dopo verifica certa della
  corrispondenza su: fotografia, data, negozio, totale complessivo, righe e
  suddivisione tra ambiti. Corrispondenza non certa ⇒ si lasciano invariate e
  si segnalano. Mai collegare per semplice somiglianza.
- ✅ **Modalità di sviluppo**: branch `rifacimento-spese`; niente push su
  `main`, niente deploy su Vercel, nessuna migrazione applicata a Supabase
  finché la nuova versione non è verificata e approvata da Ania (deroga
  esplicita alla regola dell'auto-push per tutto il rifacimento).

*(Tutte confermate da Ania il 27/08/2026. Nessuna decisione bloccante residua:
l'implementazione può partire quando Ania dà il via.)*

---

## Resoconto Fase 0 — 27 agosto 2026 (branch `rifacimento-spese`)

### File creati
- `scripts/verifica-spese.mjs` — script di verifica riutilizzabile: legge il
  backup locale in SOLA lettura (niente Supabase, niente chiavi, niente rete),
  confronta conteggi e totali attesi, verifica relazioni/orfani/ambiti/
  quadrature, esce con codice 1 se qualcosa non torna. Il riepilogo mostra
  solo aggregati, mai dati personali.
- `lib/spese/caratterizzazione.ts` — funzioni pure che documentano (A) il
  comportamento economico attuale copiato da SpeseTracker.tsx SENZA
  modificarlo, e (B) le regole approvate per il nuovo modulo (quadratura,
  fatture non pagate, duplicati, spese sorelle). Denaro sempre in centesimi.
- `lib/spese/caratterizzazione.test.ts` — 17 test con dati sintetici e
  anonimi (nessun dato reale nel repository). Coprono tutti i casi richiesti:
  scontrino solo Casa Mia / solo Casa Ania / misto con spese sorelle,
  quantità multiple, sconto in riga, arrotondamento, spesa manuale senza
  documento, fattura non pagata (fuori dallo Speso) e pagata (conta alla
  data di pagamento), bozze escluse dai totali, duplicato certo/probabile/
  possibile, differenza totale-righe, periodi (mese/settimana/anno/Dal–al,
  bisestile compreso), aggregazioni per gruppo/categoria/sottocategoria/
  negozio, ricorrenti (pagata ✓ / attesa ~).
- Modificato: solo questo file (PIANO-RIFACIMENTO-SPESE.md). SpeseTracker.tsx
  e tutto il resto del gestionale: intoccati.

### Come ripetere le verifiche
```
npm test                          # 40 test (23 esistenti + 17 nuovi)
npx tsc --noEmit                  # typecheck
npm run lint                      # lint (vedi problemi preesistenti sotto)
npm run build                     # build di produzione
node scripts/verifica-spese.mjs   # verifica sul backup della scrivania
```

### Risultati del 27/08/2026
- Test: **40/40 verdi**. TypeScript: pulito. Build di produzione: ok.
- `verifica-spese.mjs`: **28/28 verifiche superate** sul backup
  (221 spese · 728 righe · 81 documenti · personale 4.621,75 € · azienda
  169,10 € · 6 senza documento per 132,70 € · 0 righe orfane · quadratura
  al centesimo ovunque · 81/81 file presenti).
- Fatti fotografati dal backup, utili per le fasi successive: 220 spese su
  221 hanno righe di dettaglio e quadrano TUTTE al centesimo; 49 documenti
  hanno spese sorelle, di cui 12 con ambiti misti; 0 spese ricorrenti nei
  dati attuali (la card "Spese fisse" oggi è sempre vuota).

### Problemi preesistenti scoperti (NON toccati, fuori dal perimetro Fase 0)
- `npm run lint`: **254 problemi (229 errori, 25 avvisi)** in tutto il
  progetto, quasi tutti `@typescript-eslint/no-explicit-any` in file NON del
  modulo spese (app/page.tsx, statistiche, pulizie, webRequests…). I tre
  file nuovi della Fase 0 sono puliti (`npx eslint` su di essi: zero errori).
- `node --test` avvisa che manca `"type": "module"` in package.json
  (avviso di prestazioni, non un errore; riguarda anche i test esistenti).
- Nessun altro problema emerso.

### Limite noto dello script di verifica
I valori attesi fotografano il 27/08/2026: se durante il rifacimento Ania
registra spese nuove, lo script va usato contro il BACKUP (invariato) o
contro un export rigenerato confrontando gli id originali, non i conteggi
totali. Le fasi successive aggiungeranno il confronto id-per-id.
