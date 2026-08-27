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

## 3. Modello dati definitivo

*(Consolidato il 27/08/2026 dopo la revisione di Ania: questo è l'UNICO
schema valido — le versioni precedenti di §3/§4 sono superate e rimosse.)*

Principio: **non si rinomina e non si cancella nulla dello storico**; si
aggiungono tabelle e colonne. Gli id e i collegamenti esistenti restano
identici. I tre concetti nuovi: il **documento logico** separato dai file,
le **bozze in tabelle separate** (mai dentro le spese vere), la **conferma
atomica**.

```
family_documents (NUOVO: il documento LOGICO — scontrino, fattura…)
  kind, doc_total (QUI, unico), supplier, invoice_number, document_date,
  status, error_message, note
   │
   ├── family_receipts        ← SOLO file/pagine (foto, PDF…): più file per
   │                             documento via document_id; gli 81 storici
   │                             si agganciano 1:1 ai documenti creati per loro
   ├── family_draft_expenses  ← le BOZZE (mai in family_expenses)
   │      └── family_draft_items
   └── family_expense_documents  ← spesa CONFERMATA ↔ documento

family_expenses / family_expense_items  ← SOLO spese confermate: Home e
  Statistiche sommano tutto ciò che trovano qui, e così deve restare.
family_corrections  ← log correzioni: riferibile a documento, bozza, spesa
  o riga; valori strutturati (jsonb).
family_canonical_categories / family_canonical_subcategories  ← tassonomia
  canonica per ID (§4-bis).
app_members  ← lista degli utenti autorizzati del gestionale (§4.8).
```

**Comportamenti definiti, caso per caso:**

- **Spesa manuale senza foto**: nasce direttamente in `family_expenses`
  (confermata, come oggi), senza documento né bozza. Un documento può
  esserle collegato in seguito via `family_expense_documents`.
- **Fattura inserita senza allegato**: si crea il `family_documents`
  (fornitore, numero, data, doc_total, kind='fattura') SENZA file collegati
  + la spesa con scadenza/pagamento. I file possono arrivare dopo.
- **Documento con più foto/pagine**: un solo `family_documents`, N
  `family_receipts` con lo stesso `document_id` (ordine pagina in
  `page_order`).
- **Scontrino misto (spese sorelle)**: un documento, più spese confermate
  (una per ambito/gruppo madre) tutte collegate allo stesso documento via
  `family_expense_documents`. Nei Movimenti appare come UN acquisto col
  totale del documento; nelle statistiche ogni ambito riceve solo le sue.
- **Conferma atomica e IDEMPOTENTE (bozza → definitiva)**: un'unica RPC
  Postgres in transazione che: blocca il documento (`for update`), accetta
  solo stati validi, verifica la quadratura esatta su tutte le righe di
  tutte le sorelle, crea spese + righe + collegamenti + correzioni, marca
  bozze e documento. Un passo fallito ⇒ rollback totale. Doppio tocco,
  timeout o richiesta ripetuta non creano doppioni: vincoli univoci
  (`family_draft_expenses.expense_id` unique = collegamento certo
  bozza → spesa; una bozza non è confermabile due volte) e la ripetizione
  restituisce le spese già create.
- **Pagamento fattura**: RPC SEPARATA e idempotente per un documento
  `approvata_da_pagare`: crea le spese sorelle con `expense_date = data di
  pagamento`, documento → `confermato`; un secondo tentativo non duplica.
- **Scarto di una bozza**: `family_draft_expenses.status='scartata'` (con
  motivo, registrato anche in `family_corrections`); il documento può
  essere riscartato o rielaborato; nulla tocca `family_expenses`.
- **Nuovo tentativo dopo errore**: solo da `status='errore'` il documento
  torna `da_elaborare` (bozze precedenti scartate); il file non si ricarica.
- **Quadratura sulle sorelle**: `family_documents.doc_total` = Σ righe di
  TUTTE le bozze del documento (poi di tutte le spese sorelle), esatta al
  centesimo (§9); mai duplicare doc_total sulle spese.
- **INVARIANTE ECONOMICA (Ania, 28/08/2026): tutto ciò che sta in
  `family_expenses` è denaro realmente uscito** e conta nello "Speso".
  Una fattura confermata ma NON pagata non entra mai in `family_expenses`:
  resta `family_documents` (stato **`approvata_da_pagare`**: non più
  dubbia, non ancora spesa) con le righe classificate nelle bozze; compare
  in scadenzario e "Impegnato/Da pagare". Al pagamento, una **RPC atomica
  separata** crea le spese sorelle definitive con `expense_date = data
  reale di pagamento (= paid_at)`; `document_date` resta la data della
  fattura e `due_date` la scadenza sul documento; `payment_method` può
  restare vuoto finché non si paga. Così Home, Statistiche e ogni calcolo
  storico conservano la regola semplice: ciò che è in family_expenses è
  già pagato.

## 4. Tabelle e colonne definitive (migrazione `0020`, DA NON CREARE né APPLICARE ORA)

### 4.1 `family_documents` (nuova)

| Colonna | Tipo | Uso |
|---|---|---|
| `id` | uuid pk | |
| `kind` | text check in (`scontrino`,`fattura`,`altro`) | |
| `doc_total` | numeric(10,2) | totale del documento, QUI e solo qui |
| `supplier` | text | fornitore (fatture) |
| `invoice_number` | text | numero fattura |
| `document_date` | date | data del documento |
| `due_date` | date | scadenza (fatture) — vive sul documento |
| `status` | text check in (`da_elaborare`,`in_revisione`,`approvata_da_pagare`,`confermato`,`errore`,`scartato`) | ciclo di vita; `approvata_da_pagare` = fattura revisionata ma non pagata (scadenzario/Impegnato) |
| `error_message` | text | dettaglio per `errore` |
| `note` | text | la nota di Ania per l'elaborazione |
| `created_at` | timestamptz | |

### 4.2 `family_receipts` (esistente → diventa SOLO file/pagine)

Nuove colonne: `document_id uuid references family_documents` ·
`page_order int default 1` · `mime_type text` · `file_sha256 text` (per i
duplicati da file identico). **Niente kind/doc_total qui**: appartengono al
documento. Le colonne storiche (`storage_path`, `note`, `status`,
`uploaded_at`, `processed_at`, `ambito`) restano intatte; `status` e `note`
del file diventano ridondanti per i documenti nuovi (fanno fede quelli del
documento) ma NON si toccano per gli 81 storici.

### 4.3 `family_draft_expenses` + `family_draft_items` (nuove: le bozze)

`family_draft_expenses`: `id` · `document_id` (nullable: bozza senza
documento non prevista ora ma non vietata) · `expense_date` · `amount` ·
`group_id` · `canonical_category_id` · `canonical_subcategory_id` ·
`category_id`/`subcategory` (compatibilità) · `store` · `description` ·
`payment_method` · `due_date` · `payment_status` · `paid_at` · `room_id` ·
`expense_nature` · `status` check in (`da_controllare`,`pronta`,
`confermata`,`scartata`,`errore`) · `confidence jsonb` · `expense_id`
(valorizzato alla conferma, per l'audit) · `created_at`.

`family_draft_items`: `id` · `draft_id` · `raw_name` (descrizione originale
stampata) · `name` (normalizzata) · `qty` · `unit_price` · `discount` ·
`amount` · `group_id` (destinatario per riga) · `canonical_category_id` ·
`canonical_subcategory_id` · `necessity`/`planning` (facoltativi, MAI
proposti da Claude) · `confidence jsonb` · `created_at`.

**Affidabilità per campo, non per riga**: `confidence` è jsonb strutturato
`{ campo: { proposto, confidence 0–1, doubt_reason } }`, sia sulla bozza
che sulle singole righe.

### 4.4 `family_expenses` (esistente) — nuove colonne per le CONFERMATE

Regola: qui entra SOLO denaro realmente uscito (invariante §3): niente
`payment_status` né `due_date` (vivono sul documento; "scaduta" è derivata
lì: `approvata_da_pagare` + `due_date < oggi`).

| Colonna | Tipo | Uso |
|---|---|---|
| `payment_method` | text check in (`contanti`,`carta_personale`,`carta_attivita`,`bonifico`,`altro`) | |
| `paid_at` | date | data di pagamento (per le fatture = `expense_date`) |
| `room_id` | uuid references rooms(id) | camera (Amelia, Allegra, Ambra, Lena); NULLO = "Generale", mai obbligatorio |
| `expense_nature` | text check in (`ordinaria`,`ricorrente`,`straordinaria`) | UN solo campo; `recurring` resta in sola lettura per lo storico |
| `canonical_category_id` / `canonical_subcategory_id` | uuid | tassonomia canonica; `category_id`/`subcategory` restano per compatibilità |
| `notes` | text | |

NIENTE `review_status` qui: una riga in `family_expenses` È confermata per
definizione (le bozze vivono altrove). Niente doc_total, supplier,
invoice_number, document_date, error_message: vivono sul documento.

### 4.5 `family_expense_items` (esistente) — nuove colonne

`raw_name` · `unit_price` · `discount default 0` · `group_id` (destinatario
riga) · `canonical_category_id` · `canonical_subcategory_id` · `necessity` /
`planning` (facoltativi). L'affidabilità NON si copia sulle righe
confermate: vive sulle bozze; ciò che sopravvive alla conferma sono i
valori scelti.

### 4.6 `family_expense_documents` (nuova, ponte)

`expense_id` + `document_id`, unique sulla coppia. Backfill storico: una
riga per ogni spesa con `receipt_id` valorizzato — **215 secondo il backup
del 27/08** (221 − 6, su 81 documenti distinti; il conteggio è verificato
via script e va ricontato a runtime dalla migrazione, mai fidarsi di un
numero scritto a mano). `family_expenses.receipt_id` resta per
compatibilità col codice vecchio.

### 4.7 `family_corrections` (nuova, log correzioni)

`id` · riferimenti FACOLTATIVI: `document_id`, `draft_id`, `draft_item_id`,
`expense_id`, `item_id` · `field` · `proposed jsonb` · `corrected jsonb`
(valori strutturati, non solo testo) · `rule_applied` · `source`
(`revisione`/`duplicato`/`avviso`) · `created_at`.

### 4.8 Sicurezza: `app_members` + RLS (sostituisce `using (true)`)

Contesto verificato il 27/08/2026 (audit in sola lettura): **1 solo utente**
in Supabase Authentication (l'account di Ania). È un gestionale privato,
non una piattaforma multi-cliente: il modello è una **lista di autorizzati**.

```sql
create table app_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now()
);
-- NIENTE sottoquery dirette su app_members nelle policy (rischio
-- ricorsione con la RLS di app_members stessa): funzioni dedicate
--   is_app_member() / is_app_owner()
--   security definer · stable · set search_path esplicito e sicuro ·
--   confronto con auth.uid() · execute revocata ad anon
-- policy tipo su OGNI tabella family_* (nuove E storiche) e su app_members:
--   using ( is_app_member() )      [owner-only per gestire i membri]
-- e sul bucket privato 'scontrini' in storage.objects: select/insert/
-- update/delete solo per is_app_member().
```

Un account autenticato ma NON in `app_members` non può leggere, caricare,
modificare o eliminare né dati né foto.

- Un account autenticato NON in lista non legge e non scrive nulla.
- Un futuro accesso per un familiare = una riga in `app_members`, zero
  cambi di schema.
- **Nel repository niente email o UUID reali**: il primo owner si inserisce
  con un passaggio separato e documentato nell'SQL Editor (Ania loggata,
  `insert into app_members select id, 'owner' from auth.users where email =
  auth.jwt()->>'email'` o equivalente con il proprio uid).
- **Rollout in due tempi anti-lockout**: (1) creare tabella + inserire
  l'owner + verificare `select count(*) from app_members` ≥ 1; (2) SOLO
  DOPO sostituire le policy `authenticated using (true)` su tutte le
  tabelle family_*. Mai nello stesso script. La modalità dimostrazione
  (PIN) resta solo interfaccia, non è una protezione del database.

### 4.9 Vincoli del modello dati (nella 0020)

- FK con `on delete` scelto consapevolmente: eliminare un documento o un
  file NON cancella MAI una spesa definitiva (nessuna FK da family_expenses
  ai documenti; il ponte si limita a perdere il collegamento); le bozze non
  confermate cadono col documento; le confermate restano come audit
  (`document_id` set null); `family_draft_expenses.expense_id` on delete
  set null (eliminare una spesa non cancella l'audit della bozza).
- Importi `>= 0` dove appropriato; quantità `> 0`; `page_order > 0` e
  UNICO dentro lo stesso documento; `file_sha256` unico quando presente
  (indice parziale).
- `family_corrections`: vincolo "almeno un riferimento valorizzato".
- Canoniche coerenti: la sottocategoria scelta deve appartenere alla
  categoria scelta (FK composita su `(canonical_subcategory_id,
  canonical_category_id)`).
- Stati e transizioni documentati in `lib/spese/stati.ts` e ripresi nei
  CHECK.
- `necessity`/`planning` facoltativi e VUOTI per default: Claude non li
  compila mai.

### 4.10 Tassonomia canonica (tabelle)

`family_canonical_categories` (id, name, ambito
`personale`/`azienda`/`condivisa`, sort, `monitorata` boolean per
Altro/Varie) e `family_canonical_subcategories` (canonical_category_id —
FK per ID, mai per nome — name, sort). Mappatura dallo storico:
`canonical_category_id` su `family_categories` + `family_subcategory_map`
per le sottocategorie; si mappa SOLO a corrispondenza sicura.

## 4-bis. Tassonomia canonica approvata (Ania, 27/08/2026)

Basata sull'inventario del 27/08 (`~/Desktop/Inventario categorie spese
2026-08-27/`): 115 categorie storiche di cui 82 mai usate (repliche per
gruppo), 52 sottocategorie mai usate, doppione corrotto "Caff√®",
5 sottocategorie orfane di "Detersivi e pulizia".

**Ania ha approvato:** ① accorpamento di Colazione/Bar, Merenda e Mangiare
fuori in **"Mangiare fuori"**; ② accorpamento di Sport e Hobby in **"Sport
e hobby"**; ③ tassonomia canonica non duplicata per persona; ④ conservazione
completa degli ID e dello storico.

**Dimensioni SEPARATE, mai confuse**: persona/destinatario (`group_id`) ·
categoria · sottocategoria · metodo di pagamento · necessario/discrezionale ·
previsto/impulsivo (le ultime due facoltative, mai proposte da Claude).

### Categorie canoniche di Casa Mia (ambito personale)

| Categoria | Sottocategorie |
|---|---|
| Spesa alimentare | Frutta e verdura · Pane e prodotti da forno · Carne e pesce · Latte, uova e latticini · Dispensa · Surgelati · Bevande · Dolci e snack · Altro |
| Casa e consumabili | Bucato · Superfici e pavimenti · Piatti · Panni e spugne · Carta casa · Sacchetti · Utensili da cucina · Cancelleria per la casa · Altro |
| Utenze e abitazione | Affitto · Condominio · Luce · Gas · Acqua · Internet · Telefono · Rifiuti · Ricariche · Altro |
| Arredo ed elettrodomestici | Mobili · Tessili · Decorazioni · Grandi elettrodomestici · Piccoli elettrodomestici · Altro |
| Riparazioni e manutenzione | Riparazioni · Ferramenta · Piante e giardino · Interventi tecnici · Altro |
| Abbigliamento | Vestiti · Scarpe · Intimo · Accessori e borse · Abbigliamento sportivo · Altro |
| Salute e cura personale | Farmacia · Visite e analisi · Occhiali · Igiene personale · Trucchi · Profumeria · Parrucchiere ed estetica · Altro |
| Mangiare fuori *(accorpa Colazione/Bar + Merenda + Mangiare fuori)* | Bar e colazione · Pranzo · Cena · Aperitivo · Gelato e merenda · Bevande · Snack fuori casa · Altro |
| Auto e trasporti | Benzina · Assicurazione e bollo · Officina · Parcheggi · Mezzi pubblici · Taxi e noleggio · Altro |
| Scuola e formazione | Retta · Mensa · Libri · Cancelleria · Materiale scolastico · Gite · Corsi e ripetizioni · Trasporto scolastico · Altro |
| Sport e hobby *(accorpa Sport + Hobby)* | Iscrizioni · Abbonamenti · Corsi · Attrezzatura · Abbigliamento sportivo · Eventi e gare · Giochi e attività · Bricolage e creatività · Altro |
| Tecnologia e abbonamenti | Telefoni e accessori · Computer e accessori · App e software · Streaming e abbonamenti · Altro |
| Divertimento e tempo libero | Cinema e spettacoli · Uscite · Eventi · Giochi · Altro |
| Viaggi | Trasporti · Alloggio · Mangiare in viaggio · Attività · Extra · Altro |
| Regali | Compleanni · Ricorrenze · Festività · Altro |
| Paghetta | Paghetta ordinaria · Premio · Anticipo · Altro |
| Assicurazioni e tasse | Assicurazioni · Imposte e tasse · Commissioni · Altro |
| Servizi | Lavanderia e sartoria · Poste e spedizioni · Commissioni bancarie · Altri servizi |
| Altro | *(ultima scelta; utilizzo monitorato e segnalato nelle analisi)* |

### Categorie canoniche di Casa Ania (ambito azienda)

| Categoria | Sottocategorie |
|---|---|
| Pulizia e detergenti | Bucato · Superfici e pavimenti · Piatti · Panni e spugne · Carta · Sacchetti · Altro |
| Forniture per gli ospiti | Cortesia bagno · Materiale monouso · Materiale informativo · Benvenuto ospiti · Altri consumabili |
| Colazioni e bevande | Caffè · Tè e tisane · Latte · Biscotti e prodotti confezionati · Bevande · Alimenti per gli ospiti · Altro |
| Biancheria e lavanderia | Lenzuola · Asciugamani · Copriletti e tessili · Lavanderia · Sostituzioni · Altro |
| Utenze | Luce · Gas · Acqua · Internet · Telefono · Rifiuti · Altro |
| Manutenzione e riparazioni | Riparazioni · Ferramenta · Interventi tecnici · Manutenzione ordinaria · Altro |
| Lavori e ristrutturazioni | Lavori edili · Impianti · Bagni · Tinteggiatura · Altro |
| Arredi e attrezzature | Mobili · Tessili · Elettrodomestici · Tecnologia · Attrezzature · Altro |
| Commissioni e servizi digitali | Commissioni portali · Commissioni bancarie · Gestionale · Sito e hosting · Software e abbonamenti · Altro |
| Servizi professionali | Commercialista · Tecnici · Fotografia · Consulenze · Altri professionisti |
| Assicurazioni e imposte | Assicurazioni · Imposte · Tributi · Licenze e autorizzazioni · Altro |
| Trasporti e acquisti operativi | Trasporto materiali · Consegne · Parcheggi · Acquisti urgenti · Altro |
| Altro | *(ultima scelta; utilizzo monitorato e segnalato nelle analisi)* |

### Migrazione dello storico (regole vincolanti)

- Non cancellare categorie o sottocategorie storiche; non cambiare gli ID.
- Non riclassificare automaticamente dati incerti: si mappa vecchia →
  canonica SOLO quando la corrispondenza è sicura; il resto resta con la
  categoria storica finché non lo decide Ania.
- Le **66 voci senza sottocategoria** (144,49 €) ricevono la sottocategoria
  solo quando deducibile con certezza; altrimenti l'interfaccia mostra
  "**Non specificata**" — mai inventare, mai usare "Altro"/"Varie" come
  soluzione automatica dei dubbi (sono monitorate nelle analisi).
- La sottocategoria corrotta "**Caff√®**" si elimina **logicamente** solo
  dopo aver ri-verificato che non sia usata (dall'inventario: 0 usi).
- Le **5 sottocategorie orfane** di "Detersivi e pulizia" si gestiscono con
  una migrazione controllata (mappate o dismesse), mai cancellate a mano.

## 5. Strategia di migrazione senza perdita dati

1. Backup del 27/08 ✓ (hash SHA-256 in manifest.json). Prima della 2C:
   backup AGGIORNATO + seconda copia fuori dal Mac (destinazione da
   scegliere prima della 2C, § 12).
2. La 0020 è **solo additiva**: `add column if not exists`, `create table
   if not exists`, default validi per le righe esistenti. Nessun `update`
   distruttivo, `rename` o `drop`.
3. Backfill (idempotenti, dentro la 0020, con conteggi VERIFICATI a
   runtime): ① un `family_documents` per ognuno degli 81 `family_receipts`
   storici (1:1, `kind` dal contesto, `doc_total` = somma delle spese
   sorelle collegate — derivazione esatta perché lo storico quadra al
   centesimo, marcata come derivata); ② `document_id` sui receipts;
   ③ 215 righe `family_expense_documents` (ricontate a runtime).
4. Le 221 spese esistenti restano intatte e confermate per definizione
   (nessun campo di stato da riempire). `recurring` non si tocca.
5. **Rollout anti-lockout in FILE DISTINTI, mai un unico script** (Ania,
   28/08/2026): ① `0020_rifacimento_spese_schema.sql` — tabelle, colonne,
   indici, vincoli, RPC economiche; nuove tabelle con RLS ATTIVA e nessuna
   policy permissiva (chiuse finché non c'è la 0021), vecchie policy NON
   toccate; ② `supabase/bootstrap_owner.sql` — script manuale generico
   (zero email/UUID nel repo) che pretende ESATTAMENTE un utente in
   auth.users (fallisce chiaro con 0 o >1), lo inserisce come owner e
   verifica che l'owner sia esattamente uno; ③ `0021_protezione_family.sql`
   — funzioni di sicurezza e SOSTITUZIONE delle vecchie policy su tabelle
   e bucket, con precondizione che blocca se manca l'owner. Tutti
   idempotenti dove possibile, con controlli che interrompono se le
   precondizioni mancano.
6. Come sempre la migrazione si incolla a mano nell'SQL Editor; il codice
   nuovo tollera l'assenza della 0020 (modalità compatibilità).
7. **Verifica dopo ogni passo**: `verifica-spese.mjs` esteso (§13/§14) al
   confronto **ID per ID e campo per campo** contro l'export.

## 6. Suddivisione di `SpeseTracker.tsx` — FATTA (Fase 1 ✅)

Completata il 27/08/2026: da 1.272 a 402 righe, parità verificata (54 test,
build, lint). Moduli esistenti: `lib/spese/{types,costanti,periodo,voci,
domanda,ambito,dati,caratterizzazione}.ts` e `components/spese/{ListaVoci,
ScontriniBlock,FormSpesa,FiltriSchede,HomeTab,BudgetCard,SpeseFisseCard,
UltimeSpese,CalendarioTab,RaccontoTab,DomandaTab}.tsx` (dettagli nel
resoconto Fase 1 in fondo). Da creare nelle prossime fasi: `controlli.ts`
(quadratura/duplicati/avvisi), `correzioni.ts`, `bozze.ts` (accesso alle
tabelle draft), `documenti.ts`.

## 7. Struttura delle nuove pagine e componenti

Le rotte restano `/spese-famiglia` (Casa Mia) e `/spese` (Casa Ania): link,
segnalibri e DemoGate esistenti continuano a valere. **NIENTE seconda barra
inferiore sopra la BottomNav** (deciso da Ania il 27/08/2026): la
navigazione principale del gestionale resta l'unica in basso; dentro il
modulo una **navigazione compatta in alto** fra le QUATTRO sezioni, più un
**pulsante ＋ flottante** per l'acquisizione:

```
[ Panoramica │ Movimenti │ Documenti │ Analisi ]   (in alto, compatta)
                                            (＋)   (flottante)
```

- **Panoramica** — ① spese da controllare (bozze), ② fatture da
  pagare/scadute e "Impegnato/Da pagare" (solo Casa Ania), ③ speso nel
  periodo (ritmo/previsione attuali), ④ budget disponibile, ⑤ ultimi
  movimenti.
- **Movimenti** — l'elenco; le spese sorelle di uno stesso documento
  appaiono come un movimento unico (totale del documento, badge dei
  gruppi); tocco → dettaglio con righe, documento, pagamento. Filtri in
  pannello a comparsa (periodo, persona/gruppo, categoria, stato pagamento,
  metodo, camera): chiusi mostrano solo pastiglie dei filtri attivi con ✕.
- **＋ flottante** — foglio con le 4 azioni: 📷 Scatta, 🖼️ Libreria,
  📁 Carica documento, ✏️ Manuale (riusa il flusso staged attuale).
- **Documenti** — i documenti per stato (da elaborare / in revisione /
  errore / confermati), file/pagine, note, ingresso alla revisione. Dalla
  spesa si arriva sempre al documento originale e viceversa.
- **Analisi** — le 4 viste attuali (tessere, Calendario, Racconto, Domanda)
  + budget + spese fisse; Casa Mia: analisi abitudini (frequenza, piccoli
  importi ripetuti, crescita, prodotti nuovi, cumulato); Casa Ania: costi
  per camera, natura ordinaria/ricorrente/straordinaria, metodi di
  pagamento; contatore d'uso di "Altro"/"Varie".

## 8. Flusso completo: foto → elaborazione → revisione → conferma

```
 ① Acquisizione (telefono, ＋ flottante)
    scatta / libreria / file → upload dei file nel bucket +
    family_receipts (file) + family_documents { status: 'da_elaborare',
    kind, note } — più foto della stessa fattura = un documento, N file.
    ✏️ Manuale: family_expenses diretta (confermata), nessuna bozza.

 ② Elaborazione (fase attuale: Claude via /scontrini — deciso il 27/08)
    Claude legge il documento e scrive SOLO bozze: family_draft_expenses
    (una per ambito/gruppo madre se misto) + family_draft_items con
    raw_name, unit_price, discount, group_id per riga, canoniche per ID,
    confidence PER CAMPO (jsonb con doubt_reason); esegue i controlli §9;
    segnala duplicati; scrive doc_total sul DOCUMENTO; documento →
    'in_revisione'. Se non riesce: documento 'errore' + error_message.
    ATTENDE la conferma dal gestionale: mai spese definitive.
    L'elaboratore è intercambiabile per contratto ("scrive bozze valide,
    non conferma mai"): un domani un processo lato server potrà sostituire
    /scontrini senza toccare modello dati né revisione. In questa fase
    NIENTE API AI nell'app e nessun costo per chiamata.

 ③ Revisione (schermata RevisioneSpesa)
    foto/pagine zoomabili ── dati estratti ── campi dubbi con motivo ──
    controlli §9 (verdi/rossi; avvisi gialli non bloccanti) ── doc_total,
    somma righe di TUTTE le bozze sorelle, differenza ── "possibile
    duplicato di …" con confronto. Ogni modifica → family_corrections
    (valori strutturati). Quadratura ko ⇒ Conferma disattivata.
    Scarto ⇒ bozze 'scartata' + motivo. Errore ⇒ rielaborazione possibile.

 ④ Conferma ATOMICA (RPC in transazione)
    valida quadratura ⇒ crea spese sorelle + righe + family_expense_documents
    + correzioni ⇒ bozze e documento 'confermata/o'. Un fallimento
    qualsiasi = rollback: nessuna spesa definitiva parziale. Solo da qui
    le spese entrano in totali, budget, statistiche, profitto.
```

All'inizio TUTTE le bozze passano dalla revisione manuale ('da_controllare');
'pronta' (controlli verdi, non ancora vista) si userà più avanti, guidati
dal tasso di correzioni (§10).

## 9. Controlli, avvisi e duplicati (`lib/spese/controlli.ts`, da creare)

**Quadratura — ESATTA e BLOCCANTE (corretta da Ania il 27/08/2026):**
- `Σ(righe di TUTTE le bozze sorelle) + arrotondamento esplicito =
  family_documents.doc_total`, differenza esattamente ZERO;
- l'arrotondamento è valido SOLO se letto dal documento oppure inserito e
  confermato dall'utente, registrato separatamente (`arrotondamentoCent`);
  1 centesimo non dichiarato ⇒ resta `da_controllare`;
- se `unit_price` presente: `|unit_price × qty − (amount + discount)| ≤
  0,01` (qui la tolleranza resta: copre solo l'arrotondamento del prezzo
  unitario stampato);
- `doc_total` assente ⇒ campo dubbio ⇒ conferma bloccata finché l'utente
  non lo inserisce.

**Avvisi — visibili e registrati ma NON bloccanti (deciso il 27/08/2026):**
- data precedente a novembre 2024 o futura;
- sottocategoria non determinabile ⇒ si mostra "Non specificata";
- gruppo mancante; confidence sotto soglia (parte da 0,8) col suo motivo.

**Duplicati (avviso, mai blocco automatico):**
1. stesso `file_sha256` di un file già caricato ⇒ duplicato certo (la
   regola "doppioni scartati senza chiedere" si applica qui);
2. stesso fornitore/negozio + stessa data + stesso doc_total ⇒ probabile;
3. stessi data e totale con negozio simile ⇒ possibile.
   L'esito della scelta finisce in family_corrections.

## 10. Registrazione e analisi delle correzioni

- Scrittura: ogni modifica in revisione (e ogni scarto/conferma di
  duplicato) genera una riga `family_corrections` con riferimento a
  documento/bozza/riga, campo, valore proposto e corretto (jsonb), regola
  applicata.
- Lettura: pannello "Qualità dell'estrazione" (fase 6): tasso di correzione
  per campo, regola e negozio; le 10 correzioni più frequenti. Serve a
  misurare gli errori, aggiornare scontrini.md e family_product_rules, e
  decidere quando una tipologia è matura per lo stato 'pronta' col
  controllo a campione.

## 11. Distinzione Casa Mia / Casa Ania

- **Dato**: l'ambito resta sui gruppi (personale/azienda), nessuna modifica
  ai 5 gruppi. Le righe hanno il loro `group_id` ma i totali per ambito si
  calcolano sempre dalle spese sorelle (mai multi-ambito su una spesa).
- **UI**: stesso guscio, contenuti diversi: Panoramica Casa Ania apre con
  scadenzario e Impegnato/Da pagare; Casa Mia con da-controllare + budget;
  Analisi diverge (abitudini vs costi per camera). I campi fattura appaiono
  solo nell'ambito azienda.
- **Split alla revisione**: ogni riga di bozza ha la pastiglia del
  destinatario (Casa, Ania, Teo, M e A, Casa Ania); la conferma atomica
  raggruppa le righe in spese per ambito/gruppo madre, tutte sullo stesso
  documento.

## 11-bis. Requisito Casa Mia: le spese di Teo (aggiunto il 27/08/2026)

Teo è il figlio di Ania. **Corrispondenza verificata sul backup**: è il
gruppo già esistente **"Matteo"** (id `b8cc9faa-1afc-44e3-ade8-f6af3e1b62b0`,
ambito personale, emoji 👦, categorie con Scuola/Sport/Paghetta, 20 spese per
189,76 €). **Non si crea nessun gruppo nuovo**: l'id storico resta quello;
in interfaccia si mostra "Teo" come nome preferito (etichetta di sola
presentazione, come già oggi "Matteo e Ania" → "M e A"; il campo
`family_groups.name` non si tocca).

**Tre concetti sempre distinti, mai confusi:**

| Concetto | Dove vive | Esempio |
|---|---|---|
| **Persona/gruppo** a cui si riferisce la spesa | `group_id` (spesa e, dal rifacimento, singola riga) | vestito di Teo → gruppo Teo/Matteo |
| **Categoria** (cosa è) | `category_id` + sottocategoria | → Abbigliamento |
| **Chi/come ha pagato** | `payment_method` (nuovo, §4) | → contanti, carta personale… |

Esempi normativi: vestito di Ania → persona Ania, Abbigliamento · vestito di
Teo → persona Teo/Matteo, Abbigliamento · libri scolastici → persona
Teo/Matteo, Scuola e formazione → Libri · corso sportivo → persona
Teo/Matteo, Sport e hobby → Iscrizioni/Corsi · spesa comune → gruppo Casa
oppure Matteo e Ania, secondo la regola esistente.

**Vietato** creare categorie per persona ("Vestiti Ania", "Vestiti Teo"):
una sola "Abbigliamento", la persona la dice il gruppo. (Il modello attuale
replica le categorie per gruppo — §1 — ma sono la STESSA tassonomia: le
analisi restano per nome e il rifacimento non aggiunge doppioni.)

**Sottocategorie da prevedere** (seed nelle tabelle canoniche, fase 2A/6, insieme alle
altre; oggi "Scuola" e "Sport" esistono ma senza sottocategorie dedicate):
- **Scuola e formazione**: Retta · Mensa · Libri · Cancelleria · Materiale
  scolastico · Gite · Corsi e ripetizioni · Trasporto scolastico · Altro
- **Sport e hobby**: Iscrizioni · Abbonamenti · Corsi · Attrezzatura ·
  Abbigliamento sportivo · Eventi e gare · Giochi e attività · Altro

I nomi richiesti ("Scuola e formazione", "Sport e hobby") sono ora parte
della tassonomia canonica approvata (§4-bis): niente rinomini distruttivi
delle categorie storiche, ma mappatura storica → canonica. Deciso il
27/08/2026: "Hobby" (bricolage di Teo) confluisce in "Sport e hobby",
sottocategoria "Bricolage e creatività".

**Analisi richieste (fase 6, dentro Analisi di Casa Mia):**
- totale speso per Teo (filtro gruppo, già possibile oggi);
- totale per categoria di Teo;
- confronto Abbigliamento Ania ↔ Abbigliamento Teo (stessa categoria,
  gruppi diversi — è il motivo del divieto di categorie per persona);
- Scuola per mese e per **anno scolastico** (set–ago, periodo nuovo da
  aggiungere in `periodo.ts`);
- Sport e hobby per attività (sottocategoria);
- natura ordinaria/ricorrente/straordinaria delle spese di Teo (`expense_nature`; `recurring` storico in sola lettura).

Nessuna modifica a categorie o dati Supabase durante la Fase 0: questo
capitolo è solo requisito per le fasi 3–6.

## 12. Piano di sviluppo in fasi verificabili

Ogni fase si chiude con: tsc pulito, test verdi, `verifica-spese.mjs`,
prova visiva a 390px (da loggati), voce in PROGETTO.md. Una fase non parte
se la precedente non è verificata E approvata.

- **Fase 0 — Rete di sicurezza** ✅ *(27/08/2026: backup, verificatore,
  test di caratterizzazione — resoconto in fondo)*.
- **Fase 1 — Scomposizione a parità di funzioni** ✅ *(27/08/2026,
  approvata da Ania: 1.272 → 402 righe — resoconto in fondo)*.
- **Fase 2A — Progettazione migrazione** *(in corso, 28/08/2026)*:
  scrittura di 0020-schema + bootstrap owner + 0021-protezione (SENZA
  applicarli, §5.5), tipi TypeScript, funzioni pure e test per stati/
  transizioni/quadratura sorelle/fatture impegnate e pagate/scaduta
  derivata/duplicati/canoniche/idempotenza logica/esclusioni dallo Speso;
  estensione di `verifica-spese.mjs` al confronto backup ↔ export candidato
  **ID per ID e campo per campo** (mancanti, aggiunti, campi modificati,
  relazioni spezzate, duplicati, differenze economiche) con autotest sul
  backup contro sé stesso e fixture sintetiche alterate. Nessun contatto
  con Supabase, nessun export nuovo.
- **Fase 2B — Prova generale** *(solo dopo approvazione esplicita)*: su un
  progetto Supabase SEPARATO, con **dati anonimizzati e nessuna foto** (il
  backup reale NON si carica automaticamente): 0020 applicata lì, verifiche
  prima/dopo, prova del rollout RLS in due tempi e della conferma atomica.
- **Fase 2C — Applicazione al database vero** *(molto più avanti)*: solo
  dopo backup aggiornato + **seconda copia fuori dal Mac** (destinazione da
  scegliere allora, non ora: niente copie su dischi/cloud adesso) + prova
  2B riuscita + approvazione esplicita di Ania. Include il passaggio
  separato e documentato per il primo owner in `app_members` PRIMA di
  sostituire le policy.
- **Fase 3 — Nuovo guscio**: nav compatta in alto (Panoramica · Movimenti ·
  Documenti · Analisi) + ＋ flottante, Movimenti raggruppati per documento,
  FiltriPanel. Calendario/Racconto/Domanda traslocano in Analisi.
  SpeseTracker.tsx va in pensione.
- **Fase 4 — Ciclo di revisione**: bozze, RevisioneSpesa, controlli.ts,
  duplicati, correzioni, conferma atomica; scontrini.md riscritto per il
  contratto "solo bozze".
- **Fase 5 — Casa Ania fatture**: FatturaForm, scadenzario,
  pagata/non pagata/scaduta, metodi di pagamento, camera, expense_nature.
- **Fase 6 — Analisi e tassonomia**: analisi abitudini (frequenza, piccoli
  importi ripetuti, crescita, prodotti nuovi, cumulato — necessity/planning
  solo se inseriti dall'utente), popolamento mappatura canonica, pulizia
  Caff√®/orfane, pannello qualità estrazione.
- **Fase 7 — Pulizia finale**: rimozione codice compatibilità, memoria e
  scontrini.md aggiornati, eventuale ricollegamento dei 5 scontrini orfani
  (verifica certa su foto/data/negozio/totale/righe/ambiti, con conferma).

## 13. Rischi e misure di sicurezza

| Rischio | Misura |
|---|---|
| Perdita/alterazione dei 221+728+81 record | migrazione solo additiva; backup con hash; verificatore esteso ID-per-ID e campo-per-campo dopo ogni fase |
| Chiudersi fuori dal gestionale con le nuove policy | rollout RLS in due tempi: prima owner verificato in app_members, poi sostituzione policy; prova completa in 2B |
| Bozze contate nei totali | impossibili per costruzione: vivono in tabelle separate |
| Conferma a metà (spese parziali) | conferma atomica in transazione RPC |
| Doppio conteggio nei movimenti raggruppati | raggruppamento solo di presentazione; totali sempre dalle spese |
| Migrazione applicata in ritardo o a metà | 0020 idempotente; modalità compatibilità nel codice |
| Regressione profitto/Statistiche/Home | test di caratterizzazione già attivi; bozze fuori dai totali |
| Demo mode scoperta sulle nuove viste | DemoGate sul guscio; prova col PIN a ogni fase (resta solo UI, non protezione dati) |
| Peso su telefono | dati.ts incapsula le query: si potrà paginare senza toccare la UI |
| Bozze duplicate da doppia elaborazione | documento non in 'errore' non rielaborabile; sha256 sui file |
| Push accidentale | branch `rifacimento-spese`, niente push su main senza verifica di fase (deroga concordata all'auto-push) |

## 14. Test necessari

- **Caratterizzazione** ✅ (attivi, delegano al codice di produzione).
- **Unit nuovi (2A+)**: controlli.ts (quadratura esatta con arrotondamento
  dichiarato, sulle sorelle; avvisi non bloccanti; duplicati nei 3 livelli);
  conferma atomica (successo, fallimento a metà ⇒ nessuna spesa); scarto e
  rielaborazione; bozze mai nei totali; mappatura canonica. **Fatture
  (espliciti)**: ricevuta e non pagata ⇒ ZERO righe in family_expenses;
  non pagata ⇒ presente in "Impegnato"; pagamento ⇒ creazione atomica con
  `expense_date = paid_at`; fattura di agosto pagata a settembre ⇒ Speso
  di settembre; secondo tentativo di pagamento ⇒ nessun duplicato.
- **Verificatore esteso (2A)**: confronto ID-per-ID e campo-per-campo
  export ↔ backup; da usare in 2B prima/dopo la prova.
- **Sicurezza (2B)**: con un utente di prova NON in app_members ogni
  select/insert sulle family_* deve fallire; con l'owner tutto funziona.
- **Visivi (390px, mobile-first, da loggati)**: le 4 sezioni + ＋
  flottante, revisione con foto, pannello filtri, scadenzario, demo mode.
- **Flusso**: foto → documento → bozze → correzione → conferma atomica su
  ambiente di prova (2B), mai sul database vero.

## 15. File del progetto

**Già creati (Fasi 0–1)** ✅: `scripts/verifica-spese.mjs` ·
`lib/spese/{types,costanti,periodo,voci,domanda,ambito,dati,caratterizzazione}.ts`
+ test (`caratterizzazione`, `domanda`, `ambito`) ·
`components/spese/{ListaVoci,ScontriniBlock,FormSpesa,FiltriSchede,HomeTab,BudgetCard,SpeseFisseCard,UltimeSpese,CalendarioTab,RaccontoTab,DomandaTab}.tsx`.

**Da creare (2A+)**: `supabase/migrations/0020_rifacimento_spese.sql` (2A,
non applicata) · `lib/spese/{controlli,correzioni,bozze,documenti}.ts` +
test · estensione `verifica-spese.mjs` · `components/spese/{SpeseShell,
PanoramicaTab,MovimentiTab,AggiungiSheet,DocumentiTab,RevisioneSpesa,
AnalisiTab,FiltriPanel,FatturaForm}.tsx` (fasi 3–5).

**Da modificare**: `app/spese/page.tsx`, `app/spese-famiglia/page.tsx`
(fase 3) · `components/SpeseTracker.tsx` (pensione in fase 3) ·
`~/.claude/commands/scontrini.md` (fase 4) · `lib/demoMode.ts` (se serve) ·
`PROGETTO.md` (a ogni fase).

**Intoccati**: tutto il resto del gestionale.

## Decisioni prese e punti aperti

**Decise da Ania (27/08/2026)** — camere via `room_id`; /scontrini
elaboratore di sole bozze; spese sorelle; fatture nello Speso alla data di
pagamento; storico confermato senza revisione retroattiva; orfani solo a
fine lavori con verifica certa; branch senza push; tassonomia canonica con
i due accorpamenti; quadratura esatta; revisione schema §3–§4 (bozze
separate, family_documents, conferma atomica, confidence per campo,
expense_nature, niente seconda barra, avvisi non bloccanti, RLS con
app_members).

**Audit utenti (27/08/2026, sola lettura)**: 1 solo account in Supabase
Authentication (Ania) — il modello app_members parte da un solo owner.

**Aperti (non bloccanti per la 2A):**
- approvazione esplicita per far partire la 2B (progetto di prova);
- destinazione della seconda copia del backup — si decide prima della 2C;
- prova visiva a 390px della Fase 1 da loggati (il login non lo fa Claude);
- soglia confidence (parte a 0,8, si tara sui primi scontrini veri).

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

---

## Resoconto Fase 1 — 27 agosto 2026 (branch `rifacimento-spese`)

Scomposizione di `components/SpeseTracker.tsx` a parità completa di funzioni:
**da 1.272 a 402 righe (−68%)**. Nessun cambiamento a interfaccia, testi,
filtri, calcoli, rotte o database; SpeseTracker resta l'orchestratore usato
da `/spese` e `/spese-famiglia`. Cinque commit, uno per passaggio.

### Moduli estratti e responsabilità

**Logica (lib/spese/, tutta pura e testabile):**
- `types.ts` — i tipi delle tabelle family_* e delle viste (Voce, Tab…).
- `costanti.ts` — colori gruppi, icone, mesi, formattatori (eur, strip, corto).
- `periodo.ts` — mese/settimana/anno/Dal–al, etichette, ritmo e previsione.
- `voci.ts` — vociDi (scomposizione in righe), tessere, sparkline, spese
  fisse, racconto, conto del caffè, spese per giorno.
- `domanda.ts` — il motore della scheda 💬 Domanda (nessuna capacità nuova).
- `ambito.ts` — filtro personale/azienda (la semantica di load()).
- `dati.ts` — UNICO punto che parla con Supabase: stesse query, stessa
  tolleranza alle migrazioni non applicate (0012–0015).
- `caratterizzazione.ts` — ora DELEGA ai moduli veri: i test verificano il
  codice di produzione, non una copia.

**Componenti (components/spese/, classi e testi identici):**
`ListaVoci`, `ScontriniBlock`, `FormSpesa`, `FiltriSchede` (4 schede + Di chi
+ periodo), `HomeTab` (con `BudgetCard`, `SpeseFisseCard`, `UltimeSpese`),
`CalendarioTab`, `RaccontoTab`, `DomandaTab`.

### Test aggiunti in Fase 1
- `domanda.test.ts` — 12 test del motore Domanda (mese, persona, categoria,
  sottocategoria, negozio, prodotto, "da sempre", combinazioni, casi vuoti).
- `ambito.test.ts` — 2 test di parità del filtro ambito (spese senza gruppo:
  personale sì, azienda no).
- Correzione approvata da Ania inclusa: `quadratura` ESATTA al centesimo
  (niente tolleranza automatica; arrotondamento valido solo se dichiarato),
  test ed esempi aggiornati.

### Risultati delle verifiche (27/08/2026, sera)
- `npm test`: **54/54** (23 preesistenti + 17 caratterizzazione + 12 domanda
  + 2 ambito). `npx tsc --noEmit`: pulito. `npm run build`: ok (24/24 pagine).
- `npm run lint`: **250 problemi totali contro i 254 di partenza** — zero
  nuovi, 4 risolti dall'estrazione (i due errori "component created during
  render" di ListaVoci spariscono per costruzione). Gli avvisi `<img>` in
  ScontriniBlock sono i preesistenti, solo spostati.
- `scripts/verifica-spese.mjs`: 28/28 sul backup, dati intatti.
- Git: 5 commit su `rifacimento-spese` (c9703c3, 5fe5728, 4d72935, 95d7b87,
  25a45bb), niente push, `main` intatto. Supabase e Vercel non toccati.

### Parti NON estratte (con motivo)
- Stato, orchestrazione e handler (load, saveStaged, applyRules, chiedi…)
  restano in SpeseTracker: è il suo ruolo di orchestratore fino alla Fase 3.
- La schermata `needsSetup` (migrazione 0007 mancante): banale e legata al
  guscio della pagina.

### Note e differenze consapevoli (nessuna visibile a occhio)
- ListaVoci era definita DENTRO il render: React la smontava a ogni
  aggiornamento del genitore azzerando le pastiglie-filtro. Estratta, le
  pastiglie sopravvivono agli aggiornamenti del genitore (era anche uno dei
  due errori lint). Stesso identico aspetto e interazioni.
- L'apostrofo in "tocca per l'elenco" e "L'acquisto" ora è `&apos;` (stesso
  carattere reso a schermo).
- Verifica visiva dal vivo a 390px NON completata: il dev server chiede il
  login e le credenziali non le inserisco io (regola di sicurezza). Da fare
  con Ania/Matteo loggati al prossimo giro; la parità è coperta da JSX
  copiato invariato + test + build.

### Problemi preesistenti incontrati (non toccati)
- I 250 problemi lint restanti (quasi tutti `any` espliciti fuori dal modulo).
- `set-state-in-effect` e `any` nel catch di saveStaged in SpeseTracker
  (pattern preesistenti, spariranno con le fasi 3+).

---

## Resoconto Fase 2A — 28 agosto 2026 (branch `rifacimento-spese`)

Progettazione della migrazione COMPLETATA. Vincoli rispettati: nessuna
migrazione applicata, nessuna scrittura su Supabase (solo l'audit utenti in
lettura), nessun progetto di prova, nessun upload, push o deploy;
interfaccia e produzione intoccate.

### File creati (SQL: scritti, MAI eseguiti)
- `supabase/migrations/0020_rifacimento_spese_schema.sql` — tabelle nuove
  (documenti, bozze+righe, ponte, correzioni, canoniche, app_members),
  colonne nuove sulle storiche, vincoli §4.9, backfill con conteggi
  verificati a runtime, RPC `conferma_documento` e `paga_fattura` (lock
  `for update`, stati validi, quadratura esatta sulle sorelle, rollback,
  idempotenza; `revoke` ad anon). Nuove tabelle con RLS attiva e zero
  policy (chiuse fino alla 0021).
- `supabase/bootstrap_owner.sql` — bootstrap manuale dell'owner: pretende
  ESATTAMENTE 1 utente in auth.users, zero email/UUID nel repo, verifica
  finale.
- `supabase/migrations/0021_protezione_family.sql` — `is_app_member()` /
  `is_app_owner()` (security definer, stable, search_path fisso, niente
  anon), policy solo-membri su TUTTE le family_* (storiche+nuove), su
  app_members (gestione solo owner) e sul bucket `scontrini` in
  storage.objects (drop dinamico delle vecchie policy del bucket);
  precondizione anti-lockout: si ferma senza owner.
- `lib/spese/stati.ts` — macchina a stati documento/bozza (= CHECK 0020).
- `lib/spese/controlli.ts` — quadratura esatta sulle sorelle, avvisi non
  bloccanti (pre-nov 2024, data futura, "Non specificata", confidence<0,8),
  duplicati, coerenza canonica.
- `lib/spese/fatture.ts` — modello PURO delle RPC: invariante economica,
  atomicità e idempotenza testabili senza database.
- `lib/spese/fatture.test.ts` (17 test) e
  `lib/spese/verificatore.test.ts` (6 test negativi).

### File modificati
- `lib/spese/types.ts` — tipi 0020 (Documento, Bozza, RigaBozza, Confidence
  per campo).
- `lib/spese/caratterizzazione.ts` + test — allineati all'invariante: via
  payment_status/review_status dalla Spesa; quadratura/duplicati delegano a
  controlli.ts; i test fatture vivono in fatture.test.ts.
- `scripts/verifica-spese.mjs` — nuova modalità `--confronta rif cand`
  (`--consenti-aggiunte`): ID per ID e campo per campo su 8 tabelle,
  duplicati, relazioni, totali per ambito, file+hash; riepilogo con id e
  NOMI di campo, mai contenuti.
- Questo piano (invariante, RPC, sicurezza, rollout, vincoli, fasi).

### Audit utenti (sola lettura, Admin API)
1 solo account in Supabase Authentication (sa***@gmail.com, creato
02/08/2026, ultimo accesso 24/08/2026): bootstrap_owner.sql è applicabile
così com'è.

### Risultati (28/08/2026)
- `npm test`: **76/76** (23 storici + 16 caratterizzazione + 12 domanda +
  2 ambito + 17 fatture/stati/controlli + 6 verificatore).
- `tsc --noEmit` pulito · build ok (24/24) · lint nuovi file: 0 problemi;
  totale progetto **250 = identico a fine Fase 1** (tutti preesistenti).
- Verificatore: backup base 28/28 ✓; autotest `--confronta` backup ↔ sé
  stesso: nessuna differenza (8 tabelle, 81 file hash identici); fixture
  alterate: tutte rilevate con uscita 1.

### Limiti: verificabile solo in Fase 2B (progetto di prova)
- Esecuzione REALE di 0020/bootstrap/0021 su Postgres (sintassi validata a
  occhio e per costruzione, non eseguita): backfill, vincoli, CHECK.
- Comportamento REALE delle RPC sotto concorrenza (lock `for update`) e
  dentro transazioni vere — qui provata solo la logica pura equivalente.
- RLS: che un utente autenticato NON membro sia davvero bloccato su tabelle
  e storage; che il rollout in due tempi non chiuda fuori l'owner.
- Interazione policy storage con upload firmati dell'app.
