# Pulizie nuove — correzioni dopo il controllo parziale di Codex (01/10/2026 sera, Claude)

Branch `pulizie-oggi`, dalla versione controllata **65f4dde** a quella corretta
indicata nel diario (commit cd77182, 496772e, 414d3ce + questo riscontro).
**Non pubblicato. 0064 non applicata.** Il lavoro separato sul main (84759a3 e
modifiche locali di Codex) non è toccato né incluso.

## 1. Bagagli e partenza — falso «salvato» (commit cd77182)
**Problema.** `salvaOrari` si fermava alla prima risposta persa: con un cambio
camera (bagagli sulla prima riga, partenza sull'ultima), se la prima scrittura
salvava ma perdeva la risposta, la rilettura confermava i bagagli e il foglio
diceva «salvato» senza aver mai inviato la partenza.
**Correzione.** `lib/bagagliPartenzaDati.ts`: si inviano TUTTE le scritture
(righe diverse, una risposta persa non ferma le altre), poi si rilegge tutto e
ogni modifica richiesta è confermata / certamente non scritta / incerta. Esito
su tutte: `salvato` (tutte confermate) · `parziale` (alcune sì, le altre
certamente no, dette per nome) · `incerto` (almeno una né confermata né
esclusa: si dice cosa è salvato, «Non risalvare») · `non_salvato`. Solo
`salvato` chiude il foglio; negli altri casi il foglio resta aperto con i
valori scritti e la scheda mostra le righe rilette.
**Prove.**
- `lib/bagagliPartenzaDati.test.ts` 8/8, fra cui la regressione del rilievo
  (risposta persa sulla prima riga, scritta: la seconda parte lo stesso,
  «salvato» solo con entrambe confermate), risposta persa sulla seconda (non
  arrivata → incerto coi bagagli detti salvati; arrivata → salvato
  verificato), prima persa + seconda rifiutata → parziale, rilettura
  impossibile → incerto. Lo stesso file di test lanciato sul codice di 65f4dde:
  la regressione FALLISCE (3 fallimenti), quindi riproduce il difetto.
- Interfaccia (anteprima con dati finti, interruttore nuovo
  `/finto/perdi-orari?n=…&modo=scritto|non`), prenotazione col cambio camera
  Amelia → Allegra:
  · prima scrittura persa ma avvenuta → partenza inviata lo stesso, entrambe
    nel database, foglio chiuso con «salvato»;
  · seconda scrittura persa e mai arrivata → foglio APERTO con 13:00 / 10:30
    ancora nei campi, avviso «L'orario dei bagagli: salvato. L'orario della
    partenza: non so se è stato salvato … Non risalvare», scheda con
    «alle 13:00» e «da chiedere»; chiudi → ricarica → riapri: bagagli 13:00,
    partenza da chiedere (come nel database); nuovo Salva → 10:30 salvato.
  · Nota: la prima volta la scrittura «persa senza arrivare» è stata RIPETUTA
    dal browser da sola ed è arrivata: la rilettura l'ha trovata e «salvato»
    era vero. Per provare l'incerto il finto ora perde anche le ripetizioni.

## 2. Prova lavanderia — risposta persa (commit 496772e)
**Problema.** `salvaPrezzo` diceva «Prezzo non salvato: riprova» a ogni
errore di rete, senza guardare se la scrittura era avvenuta.
**Correzione.** `lib/prezziLavanderiaCore.ts`: errore certo del server → non
salvato; in ogni altro caso si rilegge: prezzo riletto uguale → salvato;
altrimenti (o rilettura impossibile) → **incerto**, «Non so se il prezzo è
stato salvato … Non riscriverlo: ricarica la pagina per controllare». Stesso
criterio per la cancellazione. `ProvaLavanderia`: il valore resta nel campo ma
in corsivo tratteggiato con la sua nota sotto la riga («Salvo…» mentre parte,
il messaggio se incerto o non salvato), e sotto il totale «Nel conto ci sono
anche prezzi scritti ma non confermati: …». Senza la 0064 i campi restano
usabili con «prezzi non salvati» (invariato, come da prompt).
**Prove.** `lib/prezziLavanderiaCore.test.ts` 7/7 (persa e scritta → salvato;
persa e non scritta → incerto senza «riprova»; rilettura impossibile →
incerto; cancellazione persa tolta / ancora lì; errore certo). Interfaccia:
Federe 0,50 con risposta persa e mai arrivata → corsivo tratteggiato, nota
incerta, frase sotto il totale; ricarica → campo vuoto (davvero non salvato).
Anche qui una prima prova è stata ripetuta dal browser e salvata davvero
(confermata dalla rilettura).

## 3. Comportamenti di prima ripristinati (commit 414d3ce)
- **Recuperi**: un foglio nuovo parte di nuovo «non annotato» (`null`); lo zero
  è solo la scelta esplicita **«Niente recuperato»** (tasto e frase tornati).
  In basso «— da lavare · recuperi non ancora annotati» finché non si sceglie.
  Interfaccia: Lena confermata senza toccare niente → nessuna riga di recupero
  nel database (non annotato), come prima.
- **Timer nel foglio** (recupero e spazi comuni): tornano **«Ferma e riporta i
  minuti»**, **«Azzera timer»**, Avvia/Pausa/Riprendi, l'aiuto e l'avviso
  dell'altro timer con «Metti in pausa · …» e «Vai a …» (variante «foglio» di
  TimerPulizia, stessa logica del timer «maison»). Niente più riporto
  automatico. Messaggio di prima per i minuti non riportati. Interfaccia:
  Amelia avviata → foglio → «Ferma e riporta i minuti» → «1 min dal timer»,
  «Riprendi» e «Azzera timer» presenti.
- **Timer grande e spazi comuni**: «Avvia» di nuovo fermo con un altro timer in
  corso e avviso sempre visibile; la striscia «Timer in corso» di nuovo anche
  in Oggi (veste nuova).
- **«perché questa data?»** di nuovo sulle camere di Oggi, con la cronologia
  di prima (date reali, ricostruite, previste).
- Guardia: `lib/pulizieComportamenti.test.ts` (4 test).

## Controlli eseguiti
`npm test` **2058/2058**; `tsc` pulito; eslint sui file toccati pulito;
`next build --webpack` riuscita; PGlite 0064 5/5. Online: nessuna verifica.

## Non verificato
- La schermata automatica del caso incerto non è stata salvata come file (lo
  strumento headless perde la pagina quando il finto interrompe la
  richiesta): il caso è provato nel pannello del browser e coi test.
- Tastiera vera iPhone; 0064 su PostgreSQL vero; WhatsApp aperto davvero.

## Altre differenze dal prompt (aperte, da decidere con Codex/Ania)
- Con i comandi del timer tornati, il foglio «Pulita e recuperato» resta alto
  690 px coi tasti a 96 px dal fondo, ma il contenuto supera lo spazio e
  **scorre** dentro il foglio (Amelia di 10 px, Lena di più): P7 voleva che il
  recupero entrasse senza scorrere.
- Registro, rispetto a prima: niente filtro «Giorno» né «Mostra altri» (c'è il
  periodo), «Riapri» è il tocco sulla riga, e **non si possono aggiungere
  minuti degli spazi comuni a un giorno passato senza tempi** (prima sì, con
  TempiFuoriCamera del giorno scelto). Non ripristinato: non era fra i tre
  punti; da decidere.
- Restano le altre differenze già scritte nel riscontro principale (pulita
  oggi come segno e non come intervallo, «Cambio ospite» come tipo, Home sul
  corridoio, «Rimanda o salta» come foglio).
