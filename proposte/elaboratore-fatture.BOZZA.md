# Proposta separata — testata delle fatture dall'elaboratore (NON applicata)

Stato: SOLO DOCUMENTO. Nessun SQL applicato, nessun permesso cambiato,
nessun codice dell'elaboratore modificato. Nasce dalla Fase 5 (fatture di
Casa Ania) e va autorizzata a parte.

## Cosa fa oggi la Fase 5 senza questa proposta

- La revisione permette ad Ania di segnare un documento come **fattura**
  (una foto arriva come `scontrino`, un PDF come `altro`) e di compilare
  fornitore, numero, data e scadenza; al caricamento la coda offre la
  spunta «È una fattura» (Casa Ania) e «pagine dello stesso documento».
- L'elaboratore «solo bozze» (`scripts/elabora/elabora-bozze.mjs` con la
  RPC `elabora_sostituisci_bozze` della 0023) scrive SOLO `doc_total`,
  `status` ed `error_message` sul documento: **non** può proporre la
  testata della fattura, che quindi resta a carico della revisione.

## Cosa propone

1. `LetturaDocumento` (lib/spese/elaborazioneBozze.ts) accetta un blocco
   facoltativo `fattura: { fornitore, numero, data_documento, scadenza }`
   con dubbi per campo (`supplier`, `invoice_number`, `document_date`,
   `due_date`) nella whitelist di documento.
2. Il pacchetto porta `documento.kind = 'fattura'` e la testata; il
   costruttore valida date reali e fornitore non vuoto.
3. La RPC `elabora_sostituisci_bozze` accetta un parametro `p_documento`
   jsonb con SOLO le colonne `kind, supplier, invoice_number,
   document_date, due_date` (le stesse concesse in UPDATE al membro dalla
   0021), scritte nella STESSA transazione delle bozze; ogni altra chiave
   → rifiuto `CAMPO_NON_CONSENTITO`. Serve una migrazione nuova (0024)
   con collaudo isolato prima della produzione.
4. La revisione continua a custodire gli ORIGINALI della testata e a
   registrare le differenze come correzioni: nulla cambia lato client.

## Perché separata

- Tocca SQL applicata e collaudata (0023): fuori dal perimetro locale
  della Fase 5, che non applica migrazioni.
- Il flusso funziona già senza: la testata la compila Ania in revisione.

## Cosa NON propone

Nessuna modifica alle tre RPC fattura della 0020, nessuna scrittura
diretta dall'elaboratore sulle spese definitive (resta «scrive bozze
valide, non conferma mai»).
