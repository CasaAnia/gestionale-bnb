# Pulizie nuove + Bagagli e partenza — riscontro (01/10/2026, Claude)

Branch `pulizie-oggi` (worktree separato), partito da **origin/main 3d83dd2**.
Il commit locale di Codex 84759a3 e le sue modifiche non committate nel
checkout principale NON sono toccati né inclusi. Tredici commit, uno per pezzo
(60ee3dd … 2e50cbf), più quello di questo riscontro.

## Da applicare (Ania) — proposta 0064

`supabase/proposte/0064_bagagli_e_partenza.BOZZA.sql` — **NON applicata**.
In cima al file ci sono le istruzioni: SQL Editor, incolla tutto, «Run».
Dopo, incolla le righe sotto «VERIFICA» e controlla:
- 2 colonne nuove su `bookings` (`bagagli_alle`, `check_out_time`, tipo time),
  1 su `cleanings` (`ora_effettiva`), 1 su `pulizie_fuori_camera` (`cosa`);
- la tabella `prezzi_lavanderia` con RLS attiva e 1 policy;
- le funzioni `ritocca_pulizia` e `gestisci_tempo_pulizie`;
- `orari_gia_scritti = 0` (le colonne nascono vuote, nessun dato toccato).
Prima: il backup di sempre.

Cosa porta la 0064 (e cosa resta nascosto finché non c'è):
| Parte | Senza 0064 |
|---|---|
| Bagagli e partenza (scheda, grafico, schede) | righe e foglio non ci sono; il grafico usa le 10:00 col «?»; nessuna valigetta |
| «Altro» + «Cosa» negli spazi comuni | «Altro» non compare (il database lo rifiuterebbe) |
| Ora corretta a mano e «Segnata per sbaglio · togli» | l'ora segnata si legge ma non si cambia; il link non c'è |
| Prezzi della lavanderia | i campi funzionano, con «prezzi non salvati» |
Come: `lib/schema0064` chiede al server una riga con le colonne nuove;
colonna o tabella assente (42703, PGRST204, 42P01, PGRST205) = nascosto;
qualunque altro errore (rete, permessi) = «Non riesco a controllare il
database» con Riprova, mai fatto passare per «funzione non disponibile».

## Righe di `bookings` usate per gli orari (P2, integrazione 3)
`lib/bagagliPartenza.ts`: i tratti vivi (annullati esclusi) si dividono nelle
linee del soggiorno (camere contemporanee = linee diverse, `lineeDelSoggiorno`)
e ogni linea in «catene» senza buchi. Per ogni catena:
- `bagagli_alle` → la **prima** riga (il giorno dell'arrivo);
- `check_out_time` → l'**ultima** riga (il giorno della partenza).
Provato (anteprima con dati finti, rilettura dal database finto):
- cambio camera Amelia → Allegra con un terzo tratto annullato: bagagli su
  Amelia, partenza su Allegra (11 ott), il tratto annullato intatto;
- due camere nelle stesse notti con partenze diverse: due coppie di righe,
  l'ora salvata su Ambra non tocca Lena;
- test: `lib/bagagliPartenza.test.ts`.
Le Pulizie leggono le stesse colonne dall'altra parte (riga che parte = ora di
partenza, riga che arriva = bagagli). Nel **cambio camera** la colonna
«Parte» c'è solo se l'ora è scritta (l'ospite non lascia Casa Ania: niente
«da chiedere» e niente messaggio).

## Altezze dei fogli (P7), misurate a 390 × 844 nell'anteprima
| Foglio | Altezza | Bordo dei tasti dal fondo | Tasti |
|---|---|---|---|
| Pulita e recuperato (Lena, 5 + 5 riquadri) | 690 | 96 | 44, 1fr 1.6fr |
| Correzione dal Registro (col link «togli») | 690 | 96 | 44 |
| Rimanda o salta | 690 | 96 | 44 |
| Spazi comuni · minuti a mano | 690 | 96 | 44 |
| Bagagli e partenza | 690 | 96 | 44 |
A 390 × 560 (come con la tastiera aperta): il foglio prende il 92% dello
schermo, il contenuto scorre dentro, i tasti restano fermi
(`pulizie-schermate/390x560-foglio-recupero-schermo-basso.png`). Dal Mac i
fogli restano al centro (padding sotto 22 px, non 96).

## Scelte da segnalare (decidi tu se vanno bene)
1. **Pulita oggi nel grafico**: un segno all'ora in cui è stata segnata, con i
   minuti scritti dentro; NON un blocco lungo quanto i minuti (integrazione 4:
   i minuti possono avere pause, l'inizio vero non si sa). Il riferimento lo
   disegnava lungo.
2. **«Pulita e recuperato» parte coi riquadri a zero**: confermare senza
   toccarne nessuno vuol dire «niente recuperato». Prima, finché non si
   premeva «Niente recuperato», restava «non annotato». Le correzioni di
   pulizie vecchie senza recuperi restano «non annotati».
3. **I minuti del timer si riportano da soli** nel foglio quando il timer è in
   pausa (prima serviva «Ferma e riporta i minuti»). «Azzera timer» non c'è
   più nel foglio: per scartare il tempo si correggono i minuti.
4. **Tolto dalle schede di Oggi «perché questa data?»** (la cronologia della
   camera): non è nel riferimento. Si può rimettere.
5. **La striscia «Timer in corso»** resta solo in Registro e Statistiche, nella
   veste nuova; in Oggi il timer si vede già grande nella sua scheda.
6. **L'avviso «Un altro timer è in corso»** nelle schede di Oggi compare solo
   toccando «Avvia» su un'altra camera (prima era sempre scritto sotto ogni
   camera). In Home è com'era.
7. **Home**: il timer degli spazi comuni ora è «Corridoio e angolo caffè»
   (prima «Area comune, corridoio e biancheria», chiave area_comune).
8. **Il messaggio della partenza** ha le parole di Ania, con i ritorni a capo
   come «Richiesta orario» («Grazie mille,» e sotto «Ania»).
9. **Lena nella «Come si usano le camere»**: oltre a «in 2 / in 3 / in 4»
   compare «in 1» solo se è successo (per non perdere quei casi).
10. **Chi resta (4 notti)**: nel grafico e nella scheda il nome intero
    («Lucia Ferri resta…»), come nel riferimento.

## P6 · Home: l'ora di partenza compare già?
No. In Home «Pulizie di oggi» dice «è partito Elena Esposito» e il prossimo
arrivo con l'ora d'arrivo; l'ora di partenza (`check_out_time`) non è letta da
nessuna parte della Home, nemmeno a colonne applicate. Stessa cosa per i bagagli.

## Voce per voce
La checklist `docs/design/pulizie-checklist.md` ha ogni voce segnata «fatta»
o «non fatta» col motivo.

## Prove
**Test automatici** (tutti locali, nessuna rete): `npm test` 2048/2048 verdi
dopo l'ultimo pezzo; TypeScript pulito. Nuovi: bagagliPartenza (5),
bagagliPartenzaDati (6, risposta persa / zero righe / seconda riga rifiutata /
rilettura diversa), giornataPulizie (11), pulizieSchede (4), tempoPulizieVoci
(3), periodoPulizie (4), registroPulizie (3), statistichePulizieNuove (8),
ritoccaPuliziaCore (2), prezziLavanderiaCore (3), schema0064 (3), messaggio
della partenza (2). La bozza 0064 provata su PGlite sopra la 0059:
`node --test scripts/revisioni/pulizie-0064.test.mjs` 5/5 (altro e cosa,
richiesta di prima che non cancella «cosa», ora con versione, togli che
cancella pulizia + recupero + timer chiuso e lascia rifare la pulizia, prezzi).
Build di produzione (`next build --webpack`) riuscita. Lint: i file di questo incarico sono puliti; `eslint .` segnala 47 errori in 28 file vecchi non toccati (any, ecc.), gli stessi di prima.

**Anteprima con dati finti** (`FINTO_PULIZIE_SQL=3`, con e senza `FINTO_0064=1`,
database in memoria con la 0059 e la 0064 vere), percorsi fatti:
- scheda → Bagagli e partenza → Alle 10:00 → Salva → riga riletta → ricarica:
  10:00; cambio camera e due camere (sopra);
- Oggi: timer di Lena avviato (scheda sfumata, «Pulita» pieno, numero nero),
  Pulita e recuperato → 2 federe + 1 telo → Pausa (6 min dal timer) →
  Conferma → Lena in fondo «✓ Pulita 20:06 · 6 min», conteggio 2 fatte, nel
  database 6 minuti, letti, 2 federe e 1 telo;
- Rimanda o salta su Ambra → Domani → Conferma → sparisce da Oggi, compare
  in «Rinvii e salti» e nel Registro «rimandata al 2 ottobre»; lo stesso
  foglio dalla Home;
- Altro → 20 min, «vetri dell'ingresso» → Salva → riletto; nel Registro;
- Registro → Allegra → ora 8:45 → Salva correzione → riga 8:45; riapri →
  togli → conferma → sparisce dal Registro, Oggi ripropone Allegra, conteggi
  aggiornati;
- Statistiche settembre e dal–al; prezzi 1,90 / 0,50 / 0 → ricarica → ancora
  lì; gli altri «da inserire», totale parziale;
- timer dopo cambio pagina (Home) e nuova apertura: continua (06:13 → 06:37);
- schema di prima: niente bagagli/partenza/Altro/togli, «prezzi non salvati»,
  nessun errore.
Schermate: `docs/design/pulizie-schermate/` (390 px e Mac 1280).

**Verifiche online**: nessuna. Niente è pubblicato, nessuna migrazione applicata.

## Non verificato
- Tastiera vera di iPhone sui fogli (provato solo lo schermo basso emulato).
- La 0064 su PostgreSQL vero (solo PGlite); i nomi dei vincoli della 0059 in
  produzione si cercano per contenuto, ma non li ho visti.
- WhatsApp «Chiedi orario» della partenza: link costruito e testato, non
  aperto (nessun invio).
- Risposta persa dal vero server per bagagli/ora/togli: provata solo con i
  finti nei test.
- Esportazione CSV: stesso codice di prima, non riaperta in un foglio di calcolo.
