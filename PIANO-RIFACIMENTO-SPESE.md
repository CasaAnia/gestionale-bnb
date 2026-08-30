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
| `upload_ambito` | text (`personale`/`azienda`) | SOLO da quale sezione è stata caricata la foto (2A.1): l'ambito ECONOMICO deriva sempre dalle spese sorelle — uno scontrino misto è normale; MAI usato in totali o statistiche. Il backfill vi copia il vecchio `family_receipts.ambito` |
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

    CONTRATTO NEL DATABASE (2B.1): le 5 RPC (conferma, approvazione,
    pagamento, conferma-pagata, scarto) sono eseguibili SOLO da un utente
    autenticato in app_members — il service role ha revoke esplicito e la
    guardia is_app_member() dentro ogni RPC. COMPATIBILITÀ TEMPORANEA:
    fino alla Fase 4 il VECCHIO /scontrini continua a inserire spese
    direttamente in family_expenses (per questo il service role conserva
    l'accesso alle tabelle e l'esenzione dal trigger di immutabilità);
    nella Fase 4 /scontrini viene riscritto per produrre SOLO bozze, si
    aggiunge la protezione definitiva contro creazione/modifica di spese
    confermate da parte dell'elaboratore e si rimuove quell'esenzione.

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
- confidence sotto soglia (parte da 0,8) col suo motivo.
  Il **gruppo mancante NON è un avviso: è BLOCCANTE alla conferma** (2A.1) —
  senza gruppo non si distingue Casa/Ania/Teo/Casa Ania.

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
- **Fase 2C — Applicazione al database vero** — sbloccata sul fronte
  spazio (28/08/2026 sera): destinazione UFFICIALE della seconda copia =
  **Google Drive** dell'account amerigogranata (verificato: 1,63 GB usati
  su 15, ~13 GB liberi; l'archivio pesa ~0,22 GB). La copia salirà come
  archivio CIFRATO con password (dati economici personali) e verrà
  trascinata su drive.google.com dall'utente. REGOLA FERMA invariata:
  nessuna migrazione in produzione senza backup fresco del giorno E
  seconda copia esterna caricata e verificata; niente backup incompleti.
  Serve comunque l'approvazione esplicita di Ania per partire; bootstrap
  owner PRIMA di sostituire le policy.
  **2C-A COMPLETATA (notte 28→29/08/2026)**: backup fresco del 28/08
  identico alla produzione (solo GET/HEAD, produzione intatta); DMG
  cifrato AES-256 in `Desktop/Casa Ania/Backup spese/`. Incidente gestito:
  la prima password del DMG è comparsa per errore in chat (incollata nel
  campo sbagliato) → password RUOTATA subito (36 caratteri casuali, mai
  mostrata), portachiavi aggiornato, DMG rigenerato e riverificato
  (password vuota e sbagliata rifiutate). SHA-256 definitivo:
  `565c022fe5ac67d7b194071336b7bcd3f144ad9f4d2acbaa7b8cb78d6137d96a`.
  Prova di recupero completa: voce `backup-casa-ania.local` (utente
  "Backup spese pre-2C 2026-08-28") nell'app Password di Apple (iCloud →
  recuperabile anche senza questo Mac); password ricopiata DALLA voce
  salvata e usata per aprire il DMG in sola lettura: manifest identico,
  81 scontrini. Appunti puliti a fine prova.
  **PREFLIGHT 2C-B (29/08/2026, notte) — TUTTO VERDE, in attesa di ok**:
  produzione riletta e confrontata ID per ID e campo per campo col backup
  2C-A: identica (221/728/81/215/6; totali 462175+16910 cent; 81 file con
  hash identici; 1 solo utente auth; bucket `scontrini` unico e privato;
  0020 mai applicata neppure in parte — 8 tabelle nuove assenti e colonna
  `family_receipts.document_id` assente). Albero Git pulito; SHA-256 dei
  tre file identici a quelli approvati in 2B.1.
  **Canale di esecuzione scelto per la 2C-B**: token temporaneo della
  Management API di Supabase creato da Ania al momento, salvato in un file
  locale FUORI dal repo con permessi ristretti (stessa procedura della
  2B: mai in chat, mai nei log, mai nel repo), usato dall'orchestratore
  via endpoint SQL del progetto; revoca immediata dal dashboard a fine
  fase. Ripiego se l'endpoint non fosse disponibile: connessione Postgres
  diretta con la password del database inserita da Ania nello stesso file
  locale (mai mostrata), come nel ripiego già provato in 2B.1.
  **Sequenza esatta 2C-B** (stop automatico = qualunque verifica fallita
  interrompe TUTTO e non si prosegue): (0) preflight qui sopra ripetuto
  sul momento — stop se un solo dato differisce dal backup; (1) `0020` in
  una transazione — stop se errore SQL; (2) verifiche post-0020: 81
  documenti derivati, 215 righe ponte `origine='backfill_0020'`,
  `doc_total` derivato coerente, dati storici INTATTI (confronto
  `--campi-del-riferimento` col backup), conteggi e totali cent invariati
  — stop se una sola differenza; (3) `bootstrap_owner.sql` — deve trovare
  UN SOLO utente reale e nominarlo owner; stop se 0 o >1; (4) verifica:
  `app_members` = 1 owner; (5) `0021` — stop se errore (precondizione
  bucket già verificata: esiste ed è privato); (6) verifiche finali:
  policy nuove attive, RPC eseguibili solo dai membri (`service_role`
  revocato), doppio export fresco + confronto completo col backup 2C-A,
  app esistente ancora funzionante in lettura/scrittura sulle tabelle
  storiche; (7) rapporto e revoca del token. Niente push/deploy.
  **Seconda copia esterna COMPLETATA (29/08/2026, notte)**: revisione
  superata; DMG caricato da Ania su Google Drive in `Casa Ania/Backup
  gestionale`; copia riscaricata e verificata (SHA-256 identico a
  `565c022f…d96a`), copia temporanea eliminata. Restano il DMG locale e
  quello su Drive. **La 2C-A è chiusa.**
  **2C-B ESEGUITA E CHIUSA (29/08/2026)**: dopo revisione e ok esplicito,
  0020 → bootstrap_owner → 0021 applicate in produzione (una transazione
  ciascuna, script `scripts/fase2c/passo0-5`), cancelli verdi prima di
  ogni scrittura. Esiti: 81 documenti derivati, 215 ponte backfill,
  storici INTATTI campo per campo (file e hash compresi), quadratura al
  centesimo su tutti, owner unico = utente reale, 15/15 verifiche di
  sicurezza verdi, due export finali identici tra loro e allo storico.
  Prova dal telefono di Ania SUPERATA (Home, Spese Famiglia, Spese Casa
  Ania, foto). Pulizia: `~/.gestionale-2c` eliminata; token
  `gestionale-2c-produzione-temporaneo-4` REVOCATO dal dashboard (29/08).
  **LA FASE 2C È COMPLETA: il nuovo schema è in produzione.** Prossima:
  Fase 3 (guscio grafico, direzione B), sempre senza push/deploy fino a
  nuovo ok.
- **Fase 3A — Prototipo visivo locale** *(AUTORIZZATA in attesa della 2C)*:
  anteprima mobile isolata con dati SOLO sintetici, nessuna query a
  Supabase, protetta da controllo d'ambiente (`notFound()` fuori dallo
  sviluppo locale), impossibile da aprire in produzione anche con un
  deploy accidentale. Non pensiona SpeseTracker e non tocca /spese e
  /spese-famiglia. Due varianti grafiche sugli stessi dati; Ania sceglie
  la direzione prima della Fase 3 definitiva.
- **Fase 3 — Nuovo guscio**: nav compatta in alto (Panoramica · Movimenti ·
  Documenti · Analisi) + ＋ flottante, Movimenti raggruppati per documento,
  FiltriPanel. Calendario/Racconto/Domanda traslocano in Analisi.
  SpeseTracker.tsx va in pensione.
  **3.1 FATTA (29/08/2026)**: guscio reale in direzione B dietro
  `/nuove-spese` (solo sviluppo, doppia serratura come la 3A), dati
  sintetici. Componenti: SpeseShell, PanoramicaTab, MovimentiTab (un
  documento = una voce, dettaglio con spese sorelle), DocumentiTab (ciclo
  di vita completo, indicatore senza-foto), AnalisiTab, FiltriPanel (6
  filtri funzionanti), AggiungiSheet non operativo, StatiDati. Contratto
  dati `lib/spese/vista.ts` + filtri puri con test (110/110). Verifiche:
  tsc, lint, build, 390px, confronto visivo con la B approvata, pagine
  vecchie intatte. IN ATTESA di approvazione per sostituire le pagine
  vere (3.2); SpeseTracker ancora al suo posto.
  **3.1.1 FATTA (29/08/2026, correzioni della revisione)**: contesto =
  confine reale in tutte le sezioni (Mia = personale+misti, Ania =
  azienda+misti, mai contaminazioni); misto = una voce con importo
  principale = quota dell'ambito e "totale documento" visibile, dettaglio
  righe separato per ambito; `DocumentoVista.contesto`; Analisi
  contestuale (Ania: andamento, costi per camera, metodi, fatture);
  filtri per ambito con opzioni DAI DATI ("Di chi" solo Mia, "Camera"
  Generale/Amelia/Allegra/Ambra/Lena solo Ania, etichetta "M e A", due
  stati filtro separati, filtro ambito sostituito da "Solo documenti
  misti"); tocchi ≥44px misurati; "Speso ad agosto" corretto (nelMese);
  fogli dal basso con Escape+focus+blocco scorrimento. 114/114 test.
  **3.2A FATTA (29/08/2026)**: contratto vista con INSIEMI reali
  (categorie/sottocategorie/persone/camere/metodi; un filtro trova il
  documento se almeno una riga corrisponde), righe con ambito/categoria/
  persona/camera, più camere per documento + "Generale", periodi ISO con
  id stabile (mese/anno/settimana/dal–al; agosto 2025 ≠ 2026),
  controllaMisto. `lib/spese/adattatore.ts` puro (schema 0020 →
  DatiSpese, sola lettura) + 11 test dedicati; dati finti della preview
  generati dallo STESSO adattatore. Route `/nuove-spese-reali`: dev-only
  E login vero (bypass proxy ristretto alla sola pagina sintetica),
  client anon+sessione, SOLO SELECT. Prova reale: 87 movimenti (81 doc +
  6 manuali), 12 misti quadrati al centesimo, totali identici al
  gestionale (462175/16910 cent), camere = rooms attive. Correzioni
  visive: fondo lista libero dal +, terracotta in Casa Ania, piede fisso
  nel pannello filtri. 125/125 test. VINCOLO per la sostituzione (3.2B+):
  Calendario, Racconto, Domanda, caricamento foto e inserimento manuale
  vanno trasferiti davvero, mai ridotti a scritte "in arrivo".
  **3.2A.1 FATTA (29/08/2026)**: SELECT complete (bozze+righe bozza con
  confidence/arrotondamento/excluded/user_added, canoniche con ripiego
  esplicito, dettagli riga per la Fase 4) e paginazione ordinata; documenti
  in revisione e fatture da pagare costruiti dalle bozze (upload_ambito
  solo ultimo ripiego), escluse = audit fuori dai conti, dubbi con soglia
  0,8 e motivi; metrica <5 € SULLE RIGHE (reale: 27/48,61 € → 135/327,99 €),
  categorie/Teo per riga, somma categorie = Speso; 10 anomalie strutturali
  esplicite (errore di pagina sui definitivi, avviso interno sui documenti
  in revisione); stati/tipi esaustivi con kind 'altro'; oggiARoma +
  settimana stabile (id = lunedì); + in fascia riservata fuori dallo
  scorrimento (verificato 8 sezioni × 2 ambiti + 3 stati a 390px); guardia
  permanente sola-lettura nei test. 149/149; prova reale ripetuta e
  identica (87/81+6/12 misti; 462175/16910 cent).
  **3.2A.2 FATTA (29/08/2026)**: bozze attive = da_controllare|pronta
  (le altre restano audit, fuori da quote/dubbi/conti; escluse mai
  contate come dubbi); arrotondamento per SORELLA (righe attive +
  arrotondamento = quota; somma quote = totale; test ±1 cent); contesto/
  camera/categoria dalla bozza attiva anche senza righe; camere TUTTE
  con active ("Nome (archiviata)" per lo storico, opzioni = attive +
  archiviate presenti); invarianti extra (canoniche su spese/righe/bozze/
  righe bozza, ambito riga = ambito madre, somma righe = quota per ogni
  sorella confermata, categorie = Speso anche azienda); "da controllare"
  in Panoramica con la quota dell'ambito; "voci sotto i 5 €". 162/162;
  reale identico (87; 12 misti; 462175/16910; 135 voci/327,99 €).
  **3.2A.3 FATTA (30/08/2026)**: quote dei misti SEMPRE esplicite (anche
  zero); quota mancante = 0 + problema segnalato, mai il totale documento;
  quadratura righe=importo su TUTTE le definitive con righe (anche
  manuali); arrotondamento per sorella nel modello e nel dettaglio
  ("Arrotondamento di cassa", subtotali = quote, niente doppio conteggio
  nelle definitive); gruppiDettaglio puro e testato. 166/166; reale
  invariato e con due quote per ogni misto.
  **3.2B — CHECKLIST DI PARITÀ** (dal codice di SpeseTracker, da verificare
  prima di pensionare il vecchio percorso; ✅ = trasferita nel guscio):
  1. Calendario mensile con giorni colorati e voci del giorno
  2. Racconto del periodo con numeri toccabili e "chi ha speso cosa"
  3. Domanda libera (chat) con domande veloci per ambito
  4. Periodi Mese/Settimana/Anno/Dal–al coerenti
  5. Filtro "Di chi" (gruppi) nelle analisi
  6. Dettaglio delle voci (ListaVoci) con sottocategorie e foto collegate
  7. Apertura foto degli scontrini esistenti (link firmati)
  8. Caricamento foto: fotocamera, libreria, file; anteprima; errori gestiti
  9. Nota sugli scontrini caricati
  10. Inserimento manuale (data, importo, gruppo, categoria, sottocategoria,
      negozio con suggerimenti, prodotto, descrizione, regole-prodotto)
  11. Ricorrenti: natura della spesa (expense_nature; il vecchio flag
      recurring resta solo lettura storica, non seconda fonte di verità)
  12. Spese fisse del mese (pagate + attese)
  13. Ritmo e previsione del mese corrente
  14. Budget mensili per categoria: vedere, creare, modificare, togliere
  15. Eliminazione spese MANUALI (le documentate restano protette dal db)
  16. Modalità dimostrazione (DemoGate/PIN)
  17. Tessere per categoria con confronto mese precedente (→ Panoramica)
  18. NON trasferiti di proposito: /scontrini e revisione (Fase 4), flusso
      fatture completo (Fase 5), analisi nuove (Fase 6).
  **3.2B + 3.2B.1 ESEGUITE (30/08/2026)** — checklist a TRE stati
  (presente graficamente / funzionante / verificato):
  1 Calendario ✅✅✅ (reale) · 2 Racconto ✅✅✅ (reale) · 3 Domanda ✅✅✅
  (rispetta persona e periodo selezionati; capacità del motore INVARIATE
  dalla Fase 1) · 4 Periodi ✅✅✅ · 5 Di chi ✅✅✅ (ora PER RIGA: la riga
  di Teo dentro una spesa di Casa si trova) · 6 Dettaglio voci ✅✅✅ ·
  7 Foto esistenti ✅✅✅ (reale, PDF con visore dedicato, pagine non
  caricabili segnalate) · 8 Caricamento ✅✅ verificato con servizi
  SIMULATI (selezione multipla, anteprime, nota, conferma esplicita,
  RIPRESA senza duplicare documenti, doppioni sha, esiti incerti
  verificati) — NON provato end-to-end con file veri (niente scritture di
  prova in produzione) · 9 Nota ✅✅ al caricamento (simulato); la
  MODIFICA della nota di una ricevuta esistente NON è trasferita → Fase 4
  · 10 Inserimento manuale ✅✅✅ (simulato UI + unit; importi rigorosi) ·
  11 Natura/ricorrenti ✅✅✅ (expense_nature PREVALE, recurring solo
  ripiego storico) · 12 Spese fisse ✅✅ (funzione pura di Fase 1) ·
  13 Ritmo/previsione ✅✅ · 14 Budget ✅✅ (errori veri e righe contate,
  unit; foglio reale aperto senza salvare) · 15 Elimina manuali ✅✅
  (0 righe = errore, unit) · 16 DemoGate ✅ presente · 17 Tessere→
  Panoramica ✅✅✅ · 18 = fasi dedicate.
  3.2B.1: ambito operativo UNICO per pagina (il selettore NAVIGA tra
  /spese e /spese-famiglia, verificato in entrambe le direzioni);
  importoDaTesto con grammatica rigorosa ("12.50"=12,50; "12abc"/"0,001"
  rifiutati; budget decimale letto e risalvato invariato con
  testoDaImporto); scritture con ERRORI RESTITUITI e righe toccate
  (budget crud + elimina manuali), guardia anti doppio invio;
  caricamento RECUPERABILE (ripresa file+documento, mai duplicati,
  doppione sha = rifiuto pulito, esito incerto → verifica ricevutaEsiste
  prima di cancellare/ripetere, pulizia fallita dichiarata); tipo
  documento dal FILE (pdf → 'altro'); Domanda nel contesto visibile.
  Pagine sostituite, vecchio tracker in ?vecchia=1, preview reale in sola
  lettura (guardia nei test).
  **3.2B.2 (revisione della 3.2B.1, 30/08/2026)** — caricamento con
  RITENTATIVI DAVVERO SICURI: la verifica del tentativo precedente viene
  PRIMA di ogni passo ripetibile o distruttivo (mai più "doppione" deciso
  dalla sola regex: si accerta che il NOSTRO percorso non sia collegato
  prima di togliere un file; verifica fallita ≠ ricevuta assente); errori
  di rete RESTITUITI dalla libreria trattati come esiti incerti; doppione
  sha controllato PRIMA di creare documento e file; identificativi noti
  conservati in ogni ramo; documento dall'esito incerto = operazione
  SOSPESA (niente ritentativi alla cieca; proposta separata: colonna
  upload_token unica per renderlo recuperabile — NON applicata). Coda del
  foglio estratta in lib/spese/codaCaricamento.ts: ciclo per
  identificativi sullo stato VIVO (togliere/aggiungere durante l'attesa è
  sicuro), sospese e doppioni fuori dai ritentativi, nota fissata al
  primo tentativo, coda tenuta dalla PAGINA (chiudere il foglio non perde
  il recupero). Domanda: alias Teo/M e A riconosciuti nella domanda, nota
  "sto guardando solo…" con l'etichetta vera e solo se la persona non è
  esplicita (in entrambi i rami), risultato vuoto dopo i filtri = frase
  onesta invece del crash. testoDaImporto ORA usato dal campo budget;
  creaGuardiaInvio collegata anche a modulo manuale e budget. Test con
  cliente simulato CHE CONSERVA LO STATO tra i tentativi (si controllano
  documenti/ricevute/file finali). 207/207 test; tsc pulito; lint dei
  file toccati 0 segnalazioni (restano i 2 warning storici di
  ScontriniBlock, file non toccato); build verde.
  ATTENZIONE (residuo dichiarato, 30/08): il recupero dei caricamenti nel
  flusso a tre passi resta INCOMPLETO — la 3.2B NON è pronta alla
  pubblicazione finché non arriva la registrazione idempotente. Casi vivi:
  documento con risposta persa = voce sospesa senza via d'uscita (la coda
  vive solo nello stato della pagina: un ricaricamento + riselezione dello
  stesso file produce 2 documenti, 1 ricevuta e 1 orfano); controllo sha
  indisponibile + doppione vero = un documento VUOTO resta creato.
  **FASE 4 · BLOCCO 1 (30/08/2026) — acquisizione documentale affidabile**
  Proposta pronta e NON applicata: supabase/migrations/0022_caricamento_
  idempotente.sql — family_documents.upload_token uuid con indice unico
  parziale (storico a token nullo, NESSUN grant nuovo sulla colonna: i
  grant per colonna della 0021 restano invariati, il browser non la scrive
  mai) + RPC registra_documento_caricato (security definer, controllo
  private.is_app_member, stati solo ai default, niente spese/bozze):
  documento + tutte le ricevute in UNA transazione; stesso token →
  restituisce il risultato precedente (ripetuta=true); stesso token con
  contenuto diverso → TOKEN_RIUSATO; doppione sha → GIA_IN_ARCHIVIO con
  rollback totale (mai documenti vuoti); token concorrenti serializzati
  con pg_advisory_xact_lock. Il bucket resta fuori dalla transazione:
  contratto esplicito nel file (percorso nostro casuale + upsert; pulizia
  SOLO del proprio percorso e SOLO dopo un esito definito di
  non-registrazione; mai su esito incerto). Client locale pronto:
  lib/spese/registrazioneIdempotente.ts (caricaConToken, token generato
  una volta per foto e mai perso) + registrazioneSupabase.ts (adapter RPC,
  da collegare alle pagine SOLO dopo l'applicazione della 0022). Nove test
  con archivio simulato persistente (risposta persa e recupero,
  ricaricamento nei tre casi, controllo doppioni giù senza documenti
  vuoti, concorrenza stesso token e stesso file, token riusato respinto,
  errore intermedio con rollback, mai cancellare allegati collegati o su
  esito incerto). La semantica SQL vera della RPC andrà provata dopo
  l'applicazione (checklist di verifica manuale in coda alla 0022).
  Nell'attesa, nel flusso attuale: messaggio della voce sospesa SENZA
  inviti a ricaricare, voce sospesa NON rimovibile (il riferimento non si
  perde in silenzio), tre condizioni distinte a schermo (non inviato /
  esito sconosciuto / doppione accertato). Prossimo blocco: schermata di
  revisione + riscrittura operativa di /scontrini.
  **BLOCCO 1 RIVISTO (30/08/2026, sera)** — correzioni della revisione:
  1) BYTE immutabili: l'upload non usa più upsert (oggetto presente =
  "esiste già", mai sovrascritto); il blob viene riconfrontato con
  l'impronta FISSATA all'inizio prima di ogni invio (file riselezionato
  diverso → fermato PRIMA di ogni effetto); il token si verifica PRIMA di
  caricare (già registrato → niente upload, decide la RPC); la pulizia
  cancella SOLO dopo la verifica esplicita che il percorso non è
  collegato (esito incerto → si conserva e si dice). 2) Operazione
  stabile: preparaRipresa fissa token, impronta SHA-256 OBBLIGATORIA
  (senza impronta niente upload, errore recuperabile), percorso DERIVATO
  dal token (<giorno>/<token>.<ext> — proprietà verificabile, concorrenza
  stesso token = stesso percorso senza aiuti nei test), mime e kind;
  hash null dello storico non toccati. 3) RPC col MANIFESTO normalizzato
  e immutabile (kind, ambito, nota, pagine con percorso/ordine/mime/
  impronta) in family_documents.upload_manifest, protetto da trigger
  anche verso service_role; replay = confronto del manifesto, mai dei
  campi modificabili in revisione; validazioni (ordini unici, percorsi
  coerenti col token, impronte 64-hex, doppioni interni) con errori
  PROPRI, mai spacciati per "già in archivio" (constraint ispezionato:
  solo family_receipts_sha_uq = doppione). 4) search_path VUOTO e
  riferimenti qualificati, revoke execute esplicito anche a service_role,
  checklist SQL rifatta con contesto AUTENTICATO (set_config dei claims +
  set local role), privilegi e controllo interno provati separatamente,
  file sintetici nel bucket, stesso token tra i passi; prima esecuzione
  in ambiente isolato, mai senza autorizzazione. 5) 13 test su archivio
  che conserva i BYTE: contenuto cambiato, percorso già collegato,
  risposta persa/ricaricamento, impronta indisponibile, concorrenza da
  inizializzazione reale, metadati diversi, pagine malformate, verifica
  giù, rollback intermedio, pulizia incerta. 221/221; tsc, lint, build
  verdi.
  **BLOCCO 1, TERZA PASSATA (30/08/2026, notte)** — correzioni della
  seconda revisione: 1) SQL: COALESCE e NULLIF ricondotti alla sintassi
  di costrutto (erano qualificati per errore come funzioni pg_catalog;
  le funzioni ordinarie restano qualificate, search_path vuoto). 2)
  RIPRESA DUREVOLE (lib/spese/ripresaDurevole.ts): il manifesto COMPLETO
  (token, percorso, impronta, mime, kind, ambito, nota, nome file) si
  salva in un deposito persistente PRIMA del primo effetto esterno
  (salvataggio fallito = upload mai partito); dopo la chiusura della
  pagina il controllore ricreato recupera le operazioni pendenti: token
  registrato → completa come ripetuta; file già nel bucket (impronta del
  contenuto VERIFICATA) → registra senza upload; file assente → chiede
  la riselezione e la riconfronta con l'impronta. Il buco «upload ok,
  registrazione mai arrivata, ripresa persa → file orfano» è chiuso
  (test: 1 documento, 1 ricevuta, UN file). depositoInMemoria per i
  test + depositoLocale (localStorage) pronto, pagine NON collegate. 3)
  «Oggetto già presente» ≠ «stessa foto»: su esisteGia si scarica e si
  ricalcola l'impronta di ciò che è ARCHIVIATO (improntaFile); contenuto
  diverso o verifica indisponibile fermano la registrazione senza
  sovrascrivere né cancellare. Percorso con FORMATO PRECISO
  <AAAA-MM-GG>/<token>-p<pagina>.<ext>, validato nel client prima
  dell'upload e di nuovo nella RPC (legato anche alla pagina; «contiene
  il token» non basta più). 4) Finestra di concorrenza chiusa: se il
  controllo doppioni trova l'impronta, il client NON dichiara più il
  doppione da una lettura vecchia del token — salta l'upload e lascia
  decidere la RPC col manifesto (test con pausa controllata fra lettura
  del token e controllo sha: entrambe le chiamate ottengono lo STESSO
  documento, nessuna cancellazione). Checklist SQL rifatta: ruoli in
  transazioni esplicite chiuse da rollback, errori attesi isolati in
  savepoint, prova del trigger con un ruolo che PUÒ aggiornare le
  colonne (distinta dal rifiuto dei permessi del browser). Test con
  UUID e SHA-256 VERI su archivio che conserva i byte: 226/226; tsc,
  lint e build verdi. Restano da provare su PostgreSQL vero (checklist
  0022, dopo autorizzazione, ambiente isolato): rollback plpgsql e
  diagnostica del vincolo, confronto jsonb del manifesto, regex del
  percorso, lock advisory, trigger di immutabilità, privilegi reali.
  **BLOCCO 1, QUARTA PASSATA (30/08/2026, notte)** — due correzioni al
  deposito durevole: 1) STATI DI CHIUSURA espliciti negli esiti
  (conclusa / da_ritentare / da_verificare / in_attesa_del_file /
  pulizia_pendente) + esito della pulizia STRUTTURATO (rimossa /
  collegata / incerta / fallita, mai dedotto dal testo). Il controllore
  rimuove dal deposito SOLO le operazioni 'concluse': richiesta respinta
  col file rimasto nel bucket e doppione con pulizia non verificata ora
  CONSERVANO la traccia (manifesto, percorso e motivo persistiti) anche
  dopo la ricreazione del controllore; il recupero di una
  pulizia_pendente completa la pulizia quando la verifica torna su.
  Stessa regola su avvia e riprendi. 2) depositoLocale: lettura con TRE
  esiti distinti — chiave assente = vuoto vero; lettura fallita, JSON
  corrotto o struttura non valida = ERRORE segnalato, contenuto
  esistente CONSERVATO (mai azzerato/sovrascritto) e nuovi caricamenti
  bloccati prima di ogni effetto perché non salvabili in sicurezza;
  salvataggio e rimozione restituiscono l'errore. Test: i due casi della
  revisione conservano l'operazione dopo la ricreazione; depositoLocale
  provato con memoria finta (lettura fallita, JSON corrotto, struttura
  non valida, salvataggio e rimozione falliti, giro normale); gli esiti
  davvero conclusi continuano a chiudersi. 233/233; tsc, lint e build
  verdi. Prova PostgreSQL reale sempre separata (checklist 0022, dopo
  autorizzazione, ambiente isolato).
  **COLLAUDO REALE 0022 ESEGUITO (30/08/2026, notte) — sul progetto di
  prova exyl**** della 2B, autorizzato; PRODUZIONE INTOCCATA** (guardia
  anti-produzione verificata VIVA dandole apposta il ref vero → STOP).
  Accesso: token temporaneo Management API salvato dagli appunti in file
  locale fuori dal repo (mai in chat/log/repo/.env.local — controllato a
  fine collaudo col grep sul valore), eliminato a fine collaudo; DA
  REVOCARE dal dashboard. Scripts: scripts/fase4/passo0–5.
  RISULTATI: (a) PostgreSQL vero — 0022 applicata e RIeseguita
  (idempotente); checklist A–E **18/18**: privilegi (anon e service_role
  negati, authenticated sì), NON_MEMBRO (anche per postgres senza
  claims), registrazione singola e replay (stesso id, ripetuta=true),
  TOKEN_RIUSATO sul manifesto, PERCORSO_NON_COERENTE, GIA_IN_ARCHIVIO
  senza documenti vuoti, multipagina 2 ricevute e "tutte o nessuna" col
  rollback totale, PAGINE_MALFORMATE ≠ doppione, IMPRONTA_NON_VALIDA,
  trigger MANIFESTO_IMMUTABILE (postgres) DISTINTO dal permission denied
  di colonna (authenticated). (b) Storage e client REALI — adattatori
  effettivi (fabbrica registrazioneClient.ts, la STESSA logica delle
  pagine) con utente sintetico membro: **13/13** — avvia col controller
  e depositoLocale vero (byte e impronta remoti riscontrati), risposta
  persa + controller RICREATO → recupero senza file né orfani, oggetto
  estraneo al nostro percorso fermato coi byte intatti, riselezione
  diversa fermata prima di ogni effetto, doppione con pulizia giù →
  pulizia_pendente e recupero che completa la pulizia sul bucket vero,
  bilancio orfani pulito. REPERTO IMPORTANTE — CAUSA INTERNA
  IDENTIFICATA (correzione del 30/08, notte: la prima attribuzione a un
  "re-grant di piattaforma" era SBAGLIATA): il passo 9 della sequenza 2B
  (test-rpc) RIESEGUE la 0020 per la prova multipagina, e la 0020
  (righe 305–313) riconcede il CRUD di TABELLA ad authenticated su
  family_documents/draft/ponte/correzioni — riaprendo i permessi che la
  0021 aveva ristretto, senza che 0021 e verifiche venissero ripetute
  dopo. Questo spiega i grant osservati (i TRUNCATE/REFERENCES/TRIGGER
  in più vengono dal default di creazione, mai revocati ad
  authenticated dalla 0021). SEQUENZA CORRETTA: esegui-sequenza.mjs ora
  termina SEMPRE (anche su test falliti) ripristinando la 0021 e
  rieseguendo i test di sicurezza DOPO l'ultima migrazione rieseguita;
  migrazioni intoccate. Nel collaudo lo stato era già stato ripristinato
  riapplicando la 0021 (idempotente) e la 0022 rieseguita non lo
  disturba.
  → AZIONE APERTA: audit dei permessi in PRODUZIONE (dove la 0020 non
  risulta mai rieseguita dopo la 0021: atteso ristretto, da VERIFICARE
  invece che presumere) — query di sola lettura PRONTE in
  scripts/fase4/audit-permessi-produzione.sql, esecuzione SOLO con
  autorizzazione separata; niente riapplicazioni automatiche.
  Secondo reperto (solo verifica): la CDN dello storage può servire per
  qualche istante un oggetto appena cancellato → i controlli usano un
  cache-buster; il flusso era corretto. PULIZIA: eliminati SOLO gli
  artefatti del collaudo (13 documenti con upload_token, 15 ricevute, 13
  oggetti nei prefissi-data del collaudo, 5 utenti sintetici) →
  CONTEGGI FINALI identici al pre-collaudo (98/83/232/1/81) — in quel
  giro il confronto fu SOLO sui conteggi, non su ID/campi/impronte (ora
  automatizzato: fotografia con impronte md5 riga per riga nel passo 1 e
  confronto nel passo 5); 0021+0022 restano applicate sul progetto di
  prova. Codice locale: fabbrica iniettabile
  registrazioneClient.ts (registrazioneSupabase = binding del browser),
  chiudiOConserva con avvisoDeposito strutturato (un errore del deposito
  non falsifica l'esito remoto e non perde la traccia; testato). 234/234
  locali; tsc, lint, build verdi.
  **CORREZIONI POST-COLLAUDO (30/08/2026, notte — solo locali, nessun
  accesso remoto):** 1) causa dei permessi identificata e sequenza 2B
  corretta (vedi sopra). 2) Prova di CONCORRENZA vera della 0022 pronta
  (scripts/fase4/passo3b-concorrenza.mjs, NON eseguita): connessioni
  indipendenti (pid diversi) e sovrapposizione VERIFICATA sugli
  intervalli temporali (esecuzioni sequenziali = prova non valida, da
  ripetere); casi: stesso token+manifesto → stesso documento; manifesti
  diversi → uno solo accettato; token diversi stessa impronta → un
  documento, zero vuoti. Distinta dalle vecchie prove concorrenti della
  0020. 3) Rigore su orfani e pulizia: registro INCREMENTALE per giro
  (scripts/fase4/registro.mjs — token, id documento, percorsi, estranei,
  utenti, aggiornato a ogni artefatto anche nei giri interrotti); il
  passo 4 pretende che gli orfani siano ESATTAMENTE gli estranei
  registrati (niente più "qualsiasi -p1.jpg"); il passo 5 pulisce SOLO
  dai registri (mai per upload_token o prefisso) e dichiara lo stato
  invariato confrontando conteggi E impronte md5 riga per riga con la
  fotografia automatica del passo 1 (normalizzate sulle colonne aggiunte
  dalla 0022). 4) Audit permessi produzione: query di sola lettura
  pronte, NON eseguite.
  **SECONDA CORREZIONE POST-COLLAUDO (30/08/2026, notte — locale, dopo
  la revisione di 25040c7):** 1) concorrenza: le misure (pid, inizio,
  fine) ora arrivano ANCHE dai rami in errore atteso (funzione
  temporanea pg_temp che cattura l'eccezione — il savepoint implicito
  annulla i soli effetti della chiamata rifiutata — e restituisce
  comunque la riga di misura); provaValida severa: misure mancanti,
  stesso pid o finestre disgiunte = prova NON VALIDA (prima un errore
  senza pid passava per sovrapposto); caso B: la nota salvata deve
  essere quella del ramo VINCITORE, non una qualunque. 2) pulizia
  (motore estratto in pulizia.mjs, iniettabile): gli id documento
  mancanti si RECUPERANO dai soli token esatti registrati prima di
  cancellare; un file si elimina SOLO dopo aver verificato che nessuna
  ricevuta lo usa; utenti recuperabili dall'IDENTITÀ esatta annotata
  PRIMA della richiesta; nel passo 4 il deposito annota token+percorso
  al salvataggio della ripresa (prima di ogni effetto remoto); un
  registro si chiude SOLO a residui verificati zero, errori e
  incertezze lo lasciano recuperabile. 3) fotografia obbligatoria e
  valida PRIMA di qualsiasi cancellazione (elenco esplicito dei
  controlli; {} o voci monche BLOCCANO — prima davano un confronto
  verde a vuoto); il passo 1 rifiuta di sovrascriverla con registri
  ancora aperti; aggiunta l'impronta di auth.users (id+email in md5
  aggregato, nessuna credenziale) che scopre account sintetici senza
  appartenenza; le colonne 0022 si escludono dal confronto SOLO se
  assenti nella fotografia iniziale (flag _meta). 4) audit produzione
  completato: RLS abilitata, policy con ruoli e condizioni effettive
  (anche storage.objects), indice 0022 nella query, e nota esplicita:
  i TRUNCATE/REFERENCES/TRIGGER residui sono il default di creazione
  che la 0021 non revoca — da riportare, non da dichiarare rimossi.
  5) NUOVI TEST LOCALI con servizi simulati (scripts/fase4/
  collaudo.test.mjs, 9/9 — comando: node --test scripts/fase4/
  collaudo.test.mjs): tutti i casi riprodotti dalla revisione coperti.
  **TERZA CORREZIONE POST-COLLAUDO (30/08/2026, notte — locale, dopo la
  revisione di 7baeb2f):** 1) passo 3b: l'ORCHESTRATORE (eseguiCaso in
  concorrenza.mjs) ora ATTENDE rami e verifica di ogni caso e converte
  ogni errore in un esito esplicito; il riepilogo pretende TRE casi
  COMPLETATI e passati (il caso riprodotto — processo uscito verde con
  «0 passati, 0 falliti» e verifiche ancora in corso — è ora un test che
  deve dare rosso). Precisione temporale al MICROSECONDO (getTime()
  tronca ai ms: due finestre distinte nello stesso millisecondo
  sembravano sovrapposte — riprodotto e testato) e sovrapposizione
  EFFETTIVA con disuguaglianze strette (il contatto fra estremi non è
  concorrenza). batchRamo con CREATE OR REPLACE: rieseguibile su un
  backend del pool riutilizzato (la funzione pg_temp può già esistere).
  2) passo 4, caso 3: il percorso dell'oggetto ESTRANEO si annota nel
  registro PRIMA dell'upload diretto (che non passa dal deposito
  annotato): «oggetto creato, risposta persa» ora lascia la traccia per
  il recupero — testato: la pulizia rimuove SOLO quell'oggetto e chiude
  il registro; coperto anche l'upload mai avvenuto (registro chiuso
  senza errori né cancellazioni). Test locali con servizi simulati:
  14/14. Suite 234/234, tsc pulito, sintassi ok su tutti gli script.
  **SECONDO COLLAUDO REALE COMPLETO (30/08/2026, notte — autorizzato,
  progetto exyl****, produzione INTOCCATA):** sequenza intera senza
  azzeramenti né riesecuzioni della 0020: fotografia iniziale
  automatica (impronte md5 riga per riga di 11 dataset, incluse le
  colonne 0022 GIÀ presenti e quindi confrontate, e auth.users) →
  0022 rieseguita due volte (idempotente, privilegi giusti) → checklist
  SQL **18/18** → CONCORRENZA 3B **3/3 casi validi e passati** con pid
  diversi e finestre sovrapposte al MICROSECONDO (canale verificato: i
  timestamp arrivano con 6 cifre di frazione; primo giro onestamente
  «3 non validi» — finestre da ~5 ms contro jitter HTTP ~80 ms —
  risolto ALLINEANDO i rami a un istante ASSOLUTO comune dell'orologio
  del server, non con pause relative; riutilizzo del backend provato:
  doppia CREATE OR REPLACE della funzione pg_temp nella stessa sessione
  accettata) → client/storage reali **13/13** (orfani = ESATTAMENTE gli
  estranei registrati) → pulizia dai SOLI registri (7 registri chiusi a
  residui verificati zero; 12 documenti, 13 ricevute, 5 oggetti, 1
  utente sintetico) → STATO INVARIATO per conteggio e impronta riga per
  riga su tutti gli 11 dataset. Credenziali locali eliminate; token
  gestionale-0022-collaudo2-temporaneo DA REVOCARE dal dashboard.
  **AUDIT PERMESSI IN PRODUZIONE ESEGUITO (30/08/2026, notte —
  autorizzato, SOLA LETTURA):** strumento dedicato (audit-produzione.mjs,
  separato dagli attrezzi anti-produzione del collaudo), bersaglio
  esplicitamente verificato (tnsa****, «Gestionale Casa Ania Rozzano»),
  ogni query in transazione READ ONLY chiusa da rollback, solo metadati.
  ESITO: **NESSUNA DIFFERENZA, 6/6 sezioni conformi** — 1) grant di
  tabella: authenticated senza INSERT/UPDATE/DELETE sulle 5 tabelle
  ristrette, anon a zero, service_role ovunque (completezza verificata);
  riportati A PARTE i residui TRUNCATE/REFERENCES/TRIGGER (default di
  creazione mai revocato dalla 0021, su tutte e 5 — da discutere, nessuna
  azione); 2) grant di colonna: le 6 liste combaciano ESATTAMENTE con la
  0021; 3) RLS attiva su tutte e 18 le tabelle (query corretta con
  relkind='r': niente indici nei risultati); 4) policy: 16 _solo_membri
  con is_app_member in using E with check, 0 vecchie, 4 policy storage;
  5) 5 RPC a contratto (authenticated sì, anon/service no); 6) 0022
  ASSENTE (colonne/rpc/trigger/indice = 0). La deriva dei permessi vista
  sul progetto di prova NON tocca la produzione, come previsto dalla
  causa interna (0020 mai rieseguita dopo la 0021). Rapporto senza
  segreti sul Desktop (audit-permessi-produzione-2026-08-30.txt).
  Credenziali eliminate; token gestionale-audit-produzione-temporaneo DA
  REVOCARE.
  **CORREZIONE DEL VERIFICATORE D'AUDIT (30/08/2026, sera — locale,
  dopo la revisione dell'audit):** la conclusione «6/6 conformi»
  SUPERAVA il verificato: la sezione policy leggeva ruoli e condizioni
  senza confrontarli (sottostringa + conteggi; app_members non
  validata; storage contato per nome), la completezza era per numero e
  le RPC senza firma. Riprodotti 6 falsi verdi (storage anon/true,
  app_members assenti, «is_app_member() OR true», tabella sostituita a
  parità di conteggio, overload al posto di scarta_documento, policy
  aggiuntiva "innocua"). CORRETTO: verificatore puro
  (verificaAudit.mjs) con MATRICE esplicita della 0021 — 22 policy con
  schema/tabella/nome/ruoli/cmd/modalità/USING/WITH CHECK (canonizzate,
  uguaglianza esatta; bucket vincolato nello storage; app_members con
  lettura membri e gestione owner distinte), 18 tabelle per NOME
  QUALIFICATO, 5 RPC per nome e FIRMA esatta senza overload; policy e
  oggetti aggiuntivi = differenze da analizzare, mai innocui. Lo
  strumento d'audit ora conserva le EVIDENZE GREZZE di ogni query
  (query, data, attesi, righe lette — senza segreti), esegue anche le
  ACL con grantor e i privilegi EFFETTIVI (has_table_privilege, PUBLIC
  ed ereditarietà) distinti dagli espliciti. Le evidenze grezze del
  giro CONCLUSO non erano state conservate: dichiarate MANCANTI
  nell'addendum al rapporto sul Desktop (non ricostruite); i controlli
  di quel giro sono riclassificati (supportati: grant tabella/colonna e
  assenza 0022; deboli: policy, RLS per conteggio, RPC senza firma, ACL
  mai eseguite). Test: 7 nuovi collegati al verificatore reale, 21/21
  il file collaudo; suite 234/234. Un nuovo audit remoto richiede
  autorizzazione separata.
  **QUARTA CORREZIONE AGLI STRUMENTI D'AUDIT (30/08/2026, sera —
  locale):** 1) firme RPC: pg_get_function_identity_arguments CONSERVA i
  nomi degli argomenti («p_document_id uuid, …») e il confronto testuale
  avrebbe dato un FALSO ALLARME su tutte e 5 → normalizzaFirma estrae i
  soli tipi (via IN/OUT/INOUT/VARIADIC e nome dell'argomento), overload
  sempre rifiutati; test col formato REALE della query (nomi della
  0020), non copiato dagli attesi. 2) privilegi effettivi di COLONNA:
  nuova sezione 1-ter con has_column_privilege (PUBLIC ed ereditarietà
  comprese) su TUTTE le colonne delle 5 tabelle ristrette × INSERT/
  UPDATE × authenticated/anon, giudicata dal verificatore contro la
  matrice della 0021 (consentite presenti e vere, riservate negate,
  anon a zero; booleani ESPLICITI obbligatori e completezza per
  identità — 30 «effettivo=null» non sono più «tutti negati», vale
  anche per la sezione di tabella 1-bis ora sul verificatore); evidenze
  con le ACL di COLONNA grezze (1-quater). Riprodotto e coperto:
  UPDATE(status) riaperto via PUBLIC/ereditarietà → ROSSO. 3) canon
  limitata alle differenze sintattiche innocue: stringhe letterali e
  identificatori quotati INTATTI ('scontrini' ≠ 'SCONTRINI' ≠
  's c o n t r i n i', riprodotti e coperti), modalità permissive
  assente o sconosciuta = INCOMPLETA non conforme; il rendering
  conforme di pg_policies resta verde. Test collegati al codice usato
  dall'audit: 26/26 il file collaudo; suite 234/234.
  **QUINTA CORREZIONE AGLI STRUMENTI D'AUDIT (30/08/2026, sera —
  locale):** 1) completezza delle colonne effettive: la matrice dei
  casi attesi nasce ora da un INVENTARIO delle colonne (query
  information_schema DISTINTA da quella dei privilegi) — ogni colonna
  delle 5 tabelle × authenticated/anon × INSERT/UPDATE deve comparire
  ESATTAMENTE una volta con booleano esplicito e valore conforme alla
  0021; mancanti, duplicati, righe fuori inventario e null sono
  differenze, e un inventario monco (senza una consentita o riservata
  minima) è INCOMPLETO. Riprodotti e coperti i tre falsi verdi: tutte
  le righe anon eliminate, il caso document_id/UPDATE mancante, una
  riservata fuori lista minima (created_at) con effettivo=null. 2)
  identità dei ruoli: confronto ESATTO in verificaPolicy —
  {AUTHENTICATED} non passa più per {authenticated} (canon resta solo
  per le espressioni SQL, mai per i nomi). Test 28/28 il file collaudo;
  suite 234/234.
  **AUDIT IN PRODUZIONE RIPETUTO COL VERIFICATORE CORRETTO (30/08/2026,
  sera — autorizzato, SOLA LETTURA, transazioni read-only):** 10/10
  sezioni CONFORMI, stavolta col giudizio del verificatore TESTATO e le
  EVIDENZE GREZZE complete nel rapporto NUOVO (il precedente e il suo
  addendum restano intatti): grant di tabella espliciti + PUBLIC (12
  righe), effettivi di tabella 30/30 esplicitamente negati, effettivi
  di COLONNA 272/272 conformi alla matrice 0021 su inventario separato
  di 68 colonne, ACL di colonna (66 voci) e di tabella (25) con grantor
  come evidenza, colonne esatte 6/6, RLS su 18 tabelle per identità,
  22/22 policy con ruoli/cmd/modalità/USING/WITH CHECK combacianti
  (bucket compreso), 5/5 RPC per firma senza overload, 0022 ASSENTE.
  Residui TRUNCATE/REFERENCES/TRIGGER riportati a parte (invariati).
  Rapporto: audit-permessi-produzione-2026-08-30-secondo-giro.json sul
  Desktop. Credenziali eliminate; token
  gestionale-audit-produzione-temporaneo-2 DA REVOCARE.
  **BACKUP FRESCO PRE-0022 ESEGUITO (30/08/2026, sera — autorizzato,
  produzione in SOLA LETTURA con la guardia solo-GET/HEAD del 2C-A,
  nessuna credenziale nuova: chiave di servizio già in .env.local):**
  nuovo scripts/fase4/backup-pre-0022.mjs adeguato allo SCHEMA ATTUALE
  (il vecchio 2C-A copriva solo le 8 tabelle storiche): 16 family_* +
  app_members + rooms (copia di riferimento), doppio inventario stabile
  al 1º giro, COERENZA dei collegamenti verificata prima di scrivere
  (ricevute→documenti, ponte, spese→ricevute, righe→spese,
  bozze→documenti), 81 file del bucket con impronte SHA-256 e
  stabilità su 5 riscaricamenti a campione, inventario Auth solo
  mascherato, LEGGIMI con contenuti/LIMITI del ripristino e ordine FK.
  Numeri: 221/728/81/215/6 · 462.175+16.910 cent — IDENTICI agli
  invarianti noti (produzione immutata dal 2C); tabelle documentali
  0020 presenti (81 documenti, 215 ponte), canoniche/bozze vuote come
  atteso. Destinazione datata NUOVA (Backup spese/pre-0022-2026-08-30),
  precedenti intatti. DMG cifrato AES-256 (219 MB) verificato: manifest
  e impronta aggregata dei 120 file identici dentro/fuori, password
  sbagliata e vuota rifiutate; SHA-256
  0e5fc6eafd79e651506091b8ed5658c6fb0033dfef8c91abb7508de8825548f7.
  (Un primo DMG è stato scartato e ricreato due volte: percorso di
  verifica errato, poi password degli appunti sovrascritta prima del
  salvataggio — mai una password mostrata.) Password in voce
  «Backup spese pre-0022» (backup-pre-0022.local) nell'app Password;
  RECUPERO PROVATO: password ricopiata DALLA voce salvata (appunti
  prima sovrascritti con un segnaposto) → DMG aperto in sola lettura,
  manifest identico; appunti ripuliti. Nota MAINTAIN aggiunta ai
  privilegi residui (audit tool + SQL + addendum del rapporto).
  SECONDA COPIA SU DRIVE VERIFICATA (30/08/2026, sera): DMG caricato
  da Ania in Casa Ania/Backup gestionale, RISCARICATO e confrontato —
  impronta IDENTICA all'originale (0e5fc6ea…8de8825548f7); copia
  temporanea in Scaricati eliminata. TUTTI i prerequisiti della 0022
  in produzione sono ora soddisfatti TRANNE il consenso esplicito.
  **RESTA (autorizzazione separata):** applicazione della 0022 in
  produzione — prima: seconda copia su Drive verificata (caricamento +
  riscaricamento + confronto impronta) + backup ancora fresco +
  consenso esplicito; poi collegamento del flusso idempotente alle
  pagine.
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

**Da creare (2A+)** — i file SQL sono stati POI creati in 2A con questi
nomi definitivi: `supabase/migrations/0020_rifacimento_spese_schema.sql` +
`supabase/bootstrap_owner.sql` + `supabase/migrations/0021_protezione_family.sql`
(scritti e provati in 2B/2B.1, non applicati in produzione) ·
`lib/spese/{controlli,correzioni,bozze,documenti}.ts` +
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

---

## Resoconto Fase 2A.1 — 28 agosto 2026 (mini-fase correttiva, branch `rifacimento-spese`)

La revisione con Codex ha stabilito che la prima versione SQL della 2A
NON era pronta per la prova: permessi RPC incompleti, RPC di approvazione
fattura assente, arrotondamenti persi alla conferma, ambito del documento
fuorviante, vincoli deboli, backfill verificato solo a conteggio, funzioni
di sicurezza in schema esposto, 0021 non rieseguibile. La 2A.1 ha corretto
tutto SENZA riscrivere la cronologia (nuovi commit) e senza applicare nulla.

### Correzioni SQL (0020 e 0021 riscritte)
- **Permessi RPC**: helper `private.spese_crea_da_bozze` /
  `private.spese_gia_confermate` NON eseguibili da authenticated; 4 RPC
  pubbliche security definer con `set search_path = ''`, nomi
  schema-qualificati, controllo esplicito `private.is_app_member()`,
  `revoke` a public/anon e `grant execute` SOLO ad authenticated. Nessuna
  funzione generica di inserimento arbitrario.
- **Elenco definitivo delle RPC**: ① `conferma_documento` (rifiuta
  kind='fattura'); ② `approva_fattura_da_pagare` (solo fatture in
  in_revisione; pretende totale+data documento+scadenza+fornitore+bozze
  attive+quadratura esatta; NESSUNA spesa; → approvata_da_pagare,
  idempotente); ③ `paga_fattura` (solo fatture approvata_da_pagare;
  expense_date=paid_at); ④ `conferma_fattura_pagata` (fattura già pagata in
  revisione: data e metodo espliciti, document_date conservata). Tutte con
  lock `for update`, atomiche, idempotenti.
- **Arrotondamenti conservati**: importo sorella = somma righe + il SUO
  arrotondamento; riga definitiva esplicita "Arrotondamento"
  (`is_adjustment`, positiva o negativa, mai nascosta nei prezzi);
  somma righe = spesa madre e somma sorelle = doc_total SEMPRE.
- **Scontrino misto**: `family_documents.ambito` → **`upload_ambito`**
  (solo provenienza del caricamento; mai nei totali); backfill dal vecchio
  `family_receipts.ambito`.
- **Integrità**: bozze con `document_id NOT NULL` e `on delete restrict`
  (spesa manuale senza foto bypassa le bozze); scarto solo LOGICO;
  ponte e file con `restrict` sul documento (un documento confermato o con
  file/bozze non si elimina per sbaglio — lo impone il database, non
  l'interfaccia); gruppo mancante BLOCCANTE alla conferma (data vecchia e
  sottocategoria restano avvisi).
- **Backfill esatto**: verifica coppia per coppia
  `family_expenses.id ↔ family_receipts.document_id` (mancante, errata,
  eccedente, ricevute fuse, totale derivato ≠ somma sorelle), con
  `origine='backfill_0020'` sul ponte per distinguere i collegamenti
  storici dai nuovi. Niente count(*) globale.
- **Sicurezza**: `private.is_app_member()`/`is_app_owner()` in schema
  `private` (grant usage ad authenticated, execute solo sulle due),
  `security definer` + `set search_path = ''` + riferimenti completi;
  policy con `(select private.is_app_member())`; trigger
  `private.proteggi_ultimo_owner()`: impossibile eliminare o declassare
  l'ULTIMO owner. 0021 realmente idempotente (droppa anche le proprie
  quattro policy `scontrini_membri_*`), verifica finale: nessuna policy
  estranea su family_*/bucket, bucket `scontrini` PRIVATO, owner presente.
  Grant/revoke espliciti ovunque (mai fidarsi dei default del progetto).

### Modello puro e test allineati
`fatture.ts` (tipi per RPC, `confermaFatturaPagata`, gruppo bloccante,
righe con `isAdjustment`), `controlli.ts` (gruppo via dagli avvisi),
`sicurezza.ts` (ultimo owner, accessi) e `backfill.ts` (verifica esatta)
nuovi; test: 87/87 di cui 11 nuovi in 2A.1 (tipi sbagliati per ogni RPC,
approvazione senza spese, fattura già pagata, gruppo bloccante,
arrotondamento ±1 con somme quadrate su misto e su fattura, doppia
approvazione/pagamento, ultimo owner, backfill mancante/errato/eccedente/
fuso/totale).

### Verifiche (28/08/2026)
- `npm test` 87/87 · `tsc` pulito · build ok · lint file nuovi/modificati:
  0 problemi (totale progetto invariato) · verificatore base 28/28 ·
  `--confronta` backup ↔ sé stesso: nessuna differenza.

### Resta verificabile SOLO in Fase 2B (vero progetto Supabase di prova)
- Esecuzione reale dei tre SQL (sintassi/semantica Postgres, backfill sugli
  81 receipts, vincoli e FK composite, NOT VALID, trigger).
- RPC sotto concorrenza reale (lock, transazioni) e con RLS attiva.
- Grant/revoke effettivi per anon/authenticated/service role; che l'helper
  in `private` non sia invocabile da PostgREST.
- Blocco reale di un autenticato non-membro su tabelle e storage; rollout
  0020→bootstrap→0021 senza lockout; idempotenza della 0021 rieseguita.
- Il trigger dell'ultimo owner contro update/delete reali.

---

## Resoconto Fase 2A.2 — 28 agosto 2026 (mini-fase correttiva, branch `rifacimento-spese`)

Correzioni mirate dalla seconda revisione con Codex. Nuovi commit (59ecc86,
3ccb5ec), nessuna cronologia riscritta, nulla applicato o eseguito.

### Correzioni
1. **Backfill multipagina**: il controllo 1:1 ricevute↔documento vale SOLO
   per i documenti di backfill (`doc_total_derivato`): un documento nuovo
   con più foto/pagine è legittimo e rieseguire la 0020 non fallisce.
   Stesso comportamento nel verificatore puro (`backfill.ts`).
2. **Bucket come precondizione**: la 0021 fallisce chiaramente se
   `scontrini` è ASSENTE, duplicato in storage.buckets o PUBBLICO; non lo
   crea mai.
3. **Ultimo owner, concorrenza**: `pg_advisory_xact_lock` a chiave costante
   PRIMA del conteggio nel trigger (due transazioni simultanee non possono
   più rimuovere entrambe l'ultimo owner); `revoke execute` della funzione
   trigger a public/anon/authenticated. Test concorrente reale a due
   sessioni: pianificato in 2B.
4. **Spese documentate protette**: `family_expense_documents.expense_id` e
   `family_draft_expenses.expense_id` ora `on delete restrict` — la X non
   può far sparire una spesa lasciando un documento "confermato" orfano;
   le spese MANUALI senza documento restano eliminabili come oggi;
   l'annullamento futuro sarà un'operazione esplicita e tracciata.
5. **Vincoli reali per gli arrotondamenti**: CHECK `is_adjustment or
   amount >= 0` sulle righe definitive; nella RPC: sorella negativa dopo
   arrotondamento ⇒ eccezione; verifica EFFETTIVA post-inserimento
   somma righe = madre e somma madri = doc_total (raise, non commenti).
6. **Fatture**: validazione COMUNE `private.valida_fattura` (totale, data
   documento, fornitore, bozze, gruppi, quadratura) per approvazione e
   conferma-già-pagata; scadenza obbligatoria per una fattura DA PAGARE,
   per una già pagata se assente diventa = data di pagamento (scelta
   esplicita); gruppo bloccante anche all'approvazione; METODO DI
   PAGAMENTO obbligatorio e valido al pagamento e per le fatture già
   pagate (vuoto solo finché "da pagare"); per gli scontrini le righe
   Casa Ania esigono il metodo prima della conferma (personale:
   facoltativo); TIPO controllato PRIMA del ramo idempotente.
7. **Correzioni atomiche**: tutte le RPC di revisione accettano
   `p_correzioni jsonb` (array anche vuoto: field, proposed, corrected,
   draft_id/draft_item_id, rule_applied) con verifica di appartenenza al
   documento; inserite nella STESSA transazione (una correzione errata ⇒
   nessuna spesa); il doppio tocco non duplica (ramo idempotente prima
   della registrazione); firme vecchie eliminate con `drop function`.
8. **Stati riservati alle RPC**: permessi PER COLONNA nella 0021 — i membri
   aggiornano solo i campi economici della revisione; stati finali,
   `expense_id` e cancellazioni fisiche passano solo da RPC/service role;
   nuova RPC `scarta_documento` (scarto logico, tracciato in
   family_corrections con source='scarto').

### Elenco RPC definitivo (2A.2)
`conferma_documento(doc, correzioni)` · `approva_fattura_da_pagare(doc,
correzioni)` · `paga_fattura(doc, data, metodo, correzioni)` ·
`conferma_fattura_pagata(doc, data, metodo, correzioni)` ·
`scarta_documento(doc, motivo)` — più gli helper privati non esposti
(spese_crea_da_bozze, spese_gia_confermate, valida_fattura,
registra_correzioni).

### Test e verifiche (28/08/2026)
- `npm test`: **97/97** (10 nuovi: spesa documentata protetta, sorella
  negativa bloccata, metodo Casa Ania/personale, gruppo bloccante anche in
  approvazione, scadenza esplicita, tipo prima dell'idempotenza, correzioni
  zero/categoria+importo/estranea/campo vuoto/doppia conferma/approvazione
  e pagamento, multipagina nel backfill, metodo obbligatorio/invalido).
- `tsc` pulito · build ok (24/24) · lint file toccati 0 problemi ·
  verificatore base 28/28 · confronto backup↔sé stesso senza differenze.

### Da verificare SOLO in 2B (checklist per il progetto di prova)
- Esecuzione reale dei tre SQL; riesecuzione della 0020 DOPO aver creato
  un documento multipagina (non deve fallire); 0021 due volte di fila.
- Test concorrente ultimo owner con DUE sessioni reali (advisory lock).
- Permessi per colonna: un membro NON deve poter fare update di status/
  expense_id via PostgREST; delete di documenti/bozze negato; service role
  invariato per /scontrini.
- RPC: firme nuove uniche esposte (niente overload), correzioni nella
  stessa transazione sotto errore SQL reale, precondizione bucket.

---

## Resoconto Fase 2A.3 — 28 agosto 2026 (mini-fase correttiva, branch `rifacimento-spese`)

Ultime correzioni concrete prima della 2B. Commit a49f758 (SQL), 3dcb941
(modello puro + test); nessuna cronologia riscritta, nulla eseguito.

1. **CHECK 'scarto'**: `family_corrections_source_valida` ora è un vincolo
   NOMINATO e idempotente (drop+add) che ammette
   revisione/duplicato/avviso/**scarto**: `scarta_documento` si completa e
   lascia un audit valido. Nel TS la costante `SORGENTI_CORREZIONE`
   rispecchia ESATTAMENTE il CHECK, con test.
2. **INSERT protetti**: revoca dell'INSERT completo su documenti, bozze e
   righe di bozza; INSERT concesso SOLO sulle colonne iniziali consentite —
   `status` prende esclusivamente il default, `expense_id`,
   `doc_total_derivato`, `error_message`, `confidence`, `discard_reason` e
   gli stati finali non sono inseribili dal browser. Service role completo.
   Test PostgREST (insert normale ok / insert già confermato respinto) in
   checklist 2B.
3. **Spese documentate IMMUTABILI**: trigger
   `private.blocca_spese_documentate()` (security definer,
   `search_path=''`, nomi qualificati, execute revocato) su
   family_expenses E family_expense_items: UPDATE/DELETE respinti se la
   spesa è collegata a un documento CONFERMATO; manuali senza documento
   invariate; service role esente; la futura rettifica sarà una RPC
   tracciata o uno storno.
4. **Ponte e audit**: `family_expense_documents` e `family_corrections` in
   SOLA LETTURA per i membri (insert/update/delete revocati): il ponte si
   scrive solo via RPC/service role e il registro correzioni è APPEND-ONLY
   — nessuno scollega documenti o cancella la memoria degli errori dal
   browser.
5. **Esclusione righe OCR non distruttiva**: `family_draft_items.excluded`
   (default false) — la riga resta nell'audit, quadratura/creazione/righe
   definitive la ignorano, la correzione registra il motivo;
   `user_added` marca le righe aggiunte a mano (trigger
   `private.marca_riga_utente()` per gli insert non-service-role);
   il membro aggiorna SOLO i campi revisionabili + excluded (`draft_id`,
   `confidence`, `raw_name`, `user_added` immutabili dal browser).
6. **Scadenza non inventata**: se una fattura GIÀ PAGATA non riporta la
   scadenza, `due_date` resta NULL (document_date, due_date e paid_at sono
   informazioni diverse); obbligatoria solo per una fattura da pagare.
   (Sostituisce la scelta della 2A.2 che la poneva = data di pagamento.)
7. **Lock qualificato**: `pg_catalog.pg_advisory_xact_lock(pg_catalog.
   hashtext(...))` — coerente con `search_path=''`.

**Test: 101/101** (4 nuovi: scarto con source valido e mai fisico, riga OCR
esclusa con audit conservato, riga user_added inclusa con quadratura
aggiornata, immutabilità documentate). tsc pulito · build ok · lint file
toccati 0 · verificatore base 28/28 · confronto senza differenze.

**Checklist residua SOLO per la 2B**: esecuzione reale dei tre SQL (0020
anche DOPO un documento multipagina; 0021 due volte); test concorrente
ultimo owner a due sessioni; PostgREST: insert normale consentito vs insert
"già confermato"/campi riservati respinto, update di status/expense_id
respinto, delete documenti/bozze negato, ponte e correzioni read-only,
trigger immutabilità su spesa documentata reale (e service role esente);
precondizione bucket (assente/doppio/pubblico); RPC con correzioni sotto
errore SQL reale; firma unica esposta per ogni RPC.

---

## Resoconto Fase 2B — 28 agosto 2026 (prova generale su progetto separato)

**SEQUENZA COMPLETA VERDE dall'inizio alla fine** sul progetto Supabase di
prova (gratuito, riferimento mascherato `exyl****`, creato via Management
API nell'unica organizzazione; costo effettivo: ZERO — nessun acquisto,
nessun piano a pagamento). Produzione, Vercel e `.env.local` INTOCCATI
(guardia anti-produzione in ogni script). Nessun dato o documento reale ha
lasciato il Mac: sul progetto di prova sono saliti SOLO fixture
anonimizzata deterministica e 81 file finti di testo.

### Numeri della sequenza finale (orchestratore `esegui-sequenza.mjs`)
- migrazioni storiche 0001–0019: 19/19 applicate;
- fixture anonimizzata: 221 spese / 728 righe / 81 ricevute / 215
  collegamenti / 6 senza documento, verificatore 28/28 sul manifest
  sintetico e confronto fixture↔db senza differenze;
- 0020 applicata DAVVERO: 81 documenti derivati, 215 ponte (origine
  backfill), 6 manuali intatte, 0 ricevute orfane; storico invariato
  CAMPO PER CAMPO (confronto `--campi-del-riferimento`);
- bootstrap: 1 owner; 0021 senza bucket: fallita per precondizione senza
  modifiche parziali; bucket privato creato; 0021 applicata e RIapplicata
  (idempotente): 16 policy `_solo_membri`, 0 vecchie, 4 policy bucket;
- test sicurezza: **41/41** (anonimo/non-membro/owner/service; colonne
  riservate; ponte e audit read-only; helper private non esposti; storage
  per membro e negato agli altri; user_added: service⇒false, owner⇒true —
  chiave amministrativa riconosciuta dai trigger);
- test integrità/RPC: **50/50** (tutti gli scenari richiesti, più:
  conferme e pagamenti CONCORRENTI senza doppioni, ultimo owner protetto
  con due declassamenti concorrenti, una sola firma esposta per ognuna
  delle 5 RPC, documento multipagina e RIESECUZIONE della 0020 senza
  errori né duplicati);
- locale: 101/101 test, tsc pulito, build ok, lint file toccati 0 errori,
  verificatore su backup reale 28/28.

### Problemi trovati e corretti (commit f9a3826 + script)
1. le RPC respingevano il **service role** (auth.uid() nullo) →
   `private.chiamante_autorizzato()` (membro O service role);
2. quella funzione in `language sql` non si creava su un db pulito
   (riferimento a is_app_member della 0021) → plpgsql, risoluzione a
   runtime;
3. il trigger di immutabilità bloccava per errore le **spese manuali**
   (CASE che risolveva old.expense_id su family_expenses, 42703) → rami
   IF separati;
4. difetti dei TEST (non del SQL): DELETE storage con Content-Type json e
   corpo vuoto (si usa la forma batch), regex d'asserzione troppo strette;
   azzeramento storage via API (il DELETE SQL è vietato dalla piattaforma);
   fixture: giorno negativo da shift a 32 bit.
   Dopo OGNI correzione la sequenza è stata ripetuta dall'inizio.

### Note
- Il progetto di prova NON è stato eliminato (come richiesto); niente da
  pagare sul piano gratuito (si autosospende dopo ~1 settimana di
  inattività).
- Nel repo non sono entrati credenziali, fixture, dati personali o
  identificativi completi del progetto di prova (scansione eseguita);
  gli unici `mailto:` trovati sono i contatti VAPID preesistenti delle
  notifiche push (obbligatori per il protocollo, fuori perimetro).
- Il file del token e i JWT di prova locali sono stati eliminati a fine
  fase; il token `gestionale-2b-temporaneo` VA REVOCATO dal dashboard
  (era finito anche nella chat).

### Cosa resta prima della 2C (applicazione al database VERO)
1. approvazione esplicita di Ania per la 2C;
2. backup AGGIORNATO il giorno stesso + SECONDA COPIA fuori dal Mac
   (destinazione da scegliere allora);
3. rigenerare l'export di produzione e confrontarlo ID per ID col backup;
4. applicare 0020 → bootstrap (l'unico utente reale = Ania) → 0021
   nell'ordine provato qui, con verifiche identiche a questa sequenza;
5. su produzione il bucket `scontrini` ESISTE già: la precondizione 0021
   va verificata (privato ✓) ma non serve crearlo;
6. dopo la 2C: fasi 3+ (interfaccia) — il vecchio SpeseTracker continua a
   funzionare nel frattempo (modalità compatibilità).

---

## Resoconto Fase 2B.1 — 28 agosto 2026 (correzione contrattuale)

La revisione indipendente ha trovato una contraddizione introdotta in 2B
(commit f9a3826): `private.chiamante_autorizzato()` permetteva anche al
SERVICE ROLE di chiamare le 5 RPC di conferma/pagamento/scarto, mentre il
contratto del piano dice che `/scontrini` scrive SOLO documenti e bozze e
ATTENDE la conferma dal gestionale. Il rifiuto originario era giusto.

**Correzione (commit 00321d6, 4c907b9):**
- `chiamante_autorizzato()` RIMOSSA; guardia `is_app_member()` dentro
  ognuna delle 5 RPC: eseguibili SOLO da un autenticato in `app_members`;
- `REVOKE EXECUTE` esplicito a `service_role` sulle 5 RPC (i default
  privileges di piattaforma le concederebbero); grant solo `authenticated`;
- test reali aggiornati: il service role CREA documenti/bozze/righe OCR
  (`user_added=false`), ma conferma/pagamento/scarto via RPC sono NEGATI e
  non cambiano stato né creano spese; owner normale; non membro escluso;
- test PERMANENTE contro la riapertura accidentale:
  `has_function_privilege` su tutte e 5 (service/anon: NO, authenticated: SÌ).

**Compatibilità temporanea (documentata anche in §8):** fino alla Fase 4 il
VECCHIO `/scontrini` continua a inserire spese direttamente in
`family_expenses` (per questo il service role conserva l'accesso alle
tabelle e l'esenzione dal trigger di immutabilità). Nella Fase 4
`/scontrini` sarà riscritto per produrre soltanto bozze; allora si
aggiungerà la protezione definitiva contro creazione/modifica di spese
confermate da parte dell'elaboratore e si rimuoverà quell'esenzione.

**Nota tecnica:** col token di gestione ormai revocato, il SQL di prova
passa dalla connessione Postgres DIRETTA al solo progetto di prova
(devDependency `pg`, password del db di prova fuori dal repo, guardia
anti-produzione invariata; parser per bigint/numeric/date).

**Sequenza 2B rieseguita PER INTERO dopo la correzione:** sicurezza
**44/44** (3 test contrattuali nuovi + permessi permanenti), integrità/RPC
**50/50**, storico invariato campo per campo, 0021 idempotente. Locale:
101/101, tsc/build/lint puliti.

---

## Resoconto Fase 3A — 28 agosto 2026 (prototipo visivo locale)

Commit 2aaa69c. Anteprima in `app/anteprima-spese` (`/anteprima-spese` SOLO
in sviluppo: `notFound()` fuori dal dev + bypass del proxy limitato a
NODE_ENV=development — in produzione restano login E 404). Dati soltanto
sintetici, zero query; SpeseTracker e pagine reali intoccati; nessuna
dipendenza nuova (icone lucide già presenti, Fraunces via next/font).
Stato pilotabile da URL (?v=&c=&t=&filtri=&rev=) per prove e screenshot.

Struttura richiesta realizzata: selettore Casa Mia/Casa Ania, nav compatta
in alto (Panoramica · Movimenti · Documenti · Analisi), niente seconda
barra in basso, ＋ flottante sopra la barra globale, filtri in pannello a
scomparsa con sole pastiglie attive in vista, target ≥44px, niente emoji.
Contenuti: tutti quelli elencati per le due Panoramiche, Movimenti (misto
con badge sorelle, ricerca, niente X esposta), Documenti per stato con
indicatori (foto, multipagina, dubbio, scadenza), Revisione completa
(foto, controlli con esito e spiegazione, righe con destinatario, dubbio
evidenziato, esclusa con ripristino, aggiungi riga, conferma con
quadratura). Analisi = assaggio (fase 6).

Ispirazioni (principi, non grafica): Monarch (da controllare in testa),
YNAB (budget come progresso leggibile), Ramp (controlli con esito+motivo),
Expensify (acquisizione immediata e revisione guidata).

Screenshot reali (CDP, viewport 390×844 + desktop 1280): 4 schermate ×2
varianti + 1 desktop, consegnati nel resoconto in chat. Verifiche: 101/101
test, tsc pulito, build ok (la rotta compare come ○ statica ma serve
notFound in produzione), lint pulito sui file nuovi, pagine reali senza
regressioni (nessun file toccato oltre proxy.ts, bypass solo-dev).

Due varianti sugli stessi identici dati:
- **A · Calda editoriale** — l'identità Casa Ania portata avanti: crema,
  verde profondo, terracotta, oro raro, numeri in Fraunces, angoli
  morbidi, ombre calde.
- **B · Contemporanea essenziale** — linguaggio più finanziario: neutri
  freddi, tutto sans con cifre tabellari, bordi sottili al posto delle
  ombre, angoli asciutti, pill squadrate.

PROSSIMO PASSO: Ania sceglie la direzione (o un misto); solo dopo parte la
Fase 3 vera sul modulo reale.

### Direzione grafica SCELTA (28/08/2026, sera)
Dopo il confronto affiancato A/B/C: **variante B · Contemporanea
essenziale** (fondi neutri, tutto sans con cifre tabellari, bordi sottili,
geometria asciutta). La Fase 3 definitiva userà i token della B
(`ESSENZIALE` in app/anteprima-spese/tema.ts come riferimento). Le varianti
A e C restano nell'anteprima come archivio della decisione.
NB: la Fase 3 vera sulle pagine reali resta comunque DOPO la 2C (il nuovo
guscio poggia su documenti/bozze della 0020, non ancora in produzione).
