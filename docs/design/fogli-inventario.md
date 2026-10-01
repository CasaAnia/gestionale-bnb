# Fogli e pop-up del gestionale — inventario e regola comune (01/10/2026, Claude)

Branch `foglio-sconto` (worktree `/Users/amerigogranata/gestionale-sconto`),
partito da origin/main **3d83dd2**. Non pubblicato. Il main locale (lavoro di
Codex in attesa) e il branch `pulizie-oggi` non sono toccati.

## La regola (Ania, 01/10/2026)
1. eyebrow maiuscoletto ottone **14 px visibili** sotto il titolo;
2. niente resti della veste vecchia; azioni secondarie = link maiuscoletti sottolineati ottone;
3. due tasti a tutta larghezza: «Annulla» a contorno e l'azione piena (colonne 1fr 1.6fr, alti 44), col bordo di sotto a **96 px** dal fondo sul telefono;
4. i fogli della stessa sezione alti uguali (il più lungo), contenuto in alto;
5. dal Mac stesso foglio centrato, **480 px**, alto quanto serve, tasti subito sotto il contenuto.
Contenuti e logica non cambiano. Come: tutto nella veste comune
(`components/maison/FoglioMaison.tsx`, `PiedeMaison`, `PiedeFoglio`,
`app/fogli.css`) e l'altezza per sezione (`lib/altezzeFogli.ts`
ALTEZZE_SEZIONI, data dalla pagina con `SezioneFogli`).

Altezze delle sezioni sul telefono (misurate a 390 × 844, capped al 92% dello schermo):
scheda 860 (→ 92%) · home 795 · calendario 580 · arrivi 810 · richieste 520 · clienti 300 · nuova prenotazione 640.

## Inventario — prima e dopo
Immagini: `docs/design/fogli-schermate/confronti/<foglio>.png` (prima e dopo
affiancati in un'immagine sola) e `confronti/00-tutti-i-fogli-prima-dopo.png`
(tutte le coppie del telefono in una tavola). Le schermate «prima» sono della
versione 3d83dd2, nella stessa anteprima con dati finti.

| Sezione | Foglio | Esito |
|---|---|---|
| Scheda | Sconto | fatto (regola comune) |
| Scheda | Aggiungi pagamento | fatto |
| Scheda | Come paga | fatto |
| Scheda | Modifica arrivo | fatto |
| Scheda | Cambia date | fatto |
| Scheda | Cambio camera | fatto |
| Scheda | Dati della cliente | fatto — via il tasto tondo «Salva» e «Annulla» sotto, ora il piede comune |
| Scheda | Cambia cliente | fatto — solo «Annulla» a tutta larghezza mentre si cerca; «+ Nuovo cliente» ora link |
| Scheda | Nota e colore | fatto |
| Scheda | Chi dorme in camera | fatto |
| Scheda | Aggiungi una persona (anche in Nuova prenotazione) | fatto — via le pastiglie «Aggiungi»/«Annulla» nel contenuto |
| Scheda | Annulla la prenotazione | fatto («Torna indietro» e «Annulla la prenotazione» in mattone) |
| Scheda | Mancato arrivo | fatto («Chiudi» e azione) |
| Scheda | Da dove arriva la cliente? | fatto |
| Scheda | La notte (striscia) | fatto |
| Scheda | Togli pagamento | fatto (mattone) |
| Scheda | Togli camera, Il soggiorno si allunga | stessa veste comune; **non fotografati**: nell'anteprima finta non c'è una prenotazione con due camere insieme né un allungamento con sconto |
| Home | Modifica arrivo, Registra saldo, Segna pagata | fatti |
| Home | Pulita e recuperato | tasti nella regola; **altezza propria**: il foglio lo rifà il branch pulizie-oggi (690 px, stessa regola) |
| Home | Rimanda o salta | **non è un foglio** su questa versione (pannello nella voce); diventa foglio nel branch pulizie-oggi |
| Calendario | Foglietto prenotazione, Legenda, Camera tenuta, Libera la camera? | fatti — «Chiudi» a contorno a sinistra e azione piena a destra, nel piede |
| Arrivi | Modifica arrivo, Legenda | fatti — «Chiedi orario · Storico › · Apri prenotazione» link sopra «Annulla»/«Salva» |
| Richieste | Foglietto richiesta (e più richieste), Foglietto prenotazione, Rifiuta, Creare la prenotazione?, L'hai inviata?, Soluzioni trovate, Sostituire il testo | fatti |
| Clienti | Elimina cliente, Eliminare questo documento | fatti |
| Tutto il gestionale | Richiesta dal sito (pop-up all'apertura) | fatto — era verde con emoji; ora foglio comune, «Chiama» link, «Dopo»/«Apri». **Non fotografato**: l'anteprima finta non ha richieste dal sito in attesa |

## Fuori dalla regola, da decidere con Ania
- **Spese (B&B e Famiglia)**: 7 fogli propri (Aggiungi, Budget, Carica foto, Filtri, Foto, Modulo spesa, Revisione) su un'altra veste (`components/spese/mattoni.tsx`). Il 06/09 Ania aveva escluso le Spese dallo stile editoriale: non li ho toccati.
- **Conferma WhatsApp** (scheda, con l'immagine): pop-up a tutto schermo con quattro comandi («Messaggio CG», «Messaggio Ania», scarica, condividi) approvato il 18/09: non entra nei «due tasti» senza cambiarne il disegno.
- Pagine vecchie non più collegate (`/prenotazioni/[id]`, `/nuova`) e il visore dei documenti a tutto schermo: lasciati com'erano.
- Nei foglietti di Calendario e Richieste l'eyebrow sta SOPRA il nome (disegno approvato il 29/09): non spostato.
- I tasti che tolgono o annullano restano in mattone (non inchiostro).
- Il primo messaggio chiedeva per «Sconto» un foglio «alto il minimo necessario»; la regola del secondo messaggio (stessa altezza per sezione) lo supera: tutti i fogli della scheda sono al 92% dello schermo.

## Nome nel titolo (regola fissa n. 2)
I titoli dei fogli della scheda prendono il nome dalla scheda
(`nomeOspite` / `nomeConAltri`: il nome salvato, non ricomposto);
«Dati della cliente» ora usa `nomeCompleto`. Nessun punto concatena
cognome e nome.

**Francesco Ingra' (sola lettura)**: nel database il cliente è salvato
come «Ingra’ Francesco» (cognome e poi nome, con un carattere invisibile
all'inizio). Il titolo dice «Ingra' Francesco» perché è il dato così; non
corretto.

## Prove
`npm test` verde a ogni commit (1997/1997); nuova guardia `lib/regolaFogli.test.ts`;
guardie dei ritocchi del 28-29/09 aggiornate alla regola nuova. Misure in
anteprima a 390 × 844: tasti a 96 px dal fondo, alti 44, 1fr 1.6fr; eyebrow 13,6 px
visibili dal nome. Dal Mac: 480 px, alto quanto il contenuto. Online: niente.
