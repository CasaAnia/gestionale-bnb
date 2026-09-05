# Statistiche — fondamenta (branch `statistiche`, 04/09/2026)

Solo funzioni PURE in `lib/statistiche/` con test: nessuna interfaccia, nessuna
query nuova al database. Denaro sempre in centesimi interi. Regola già decisa
da Ania (24/07/2026) e mantenuta: **incassi per cassa** (quando i soldi
arrivano) separati dai **ricavi per competenza** (notti dormite nel mese): i
due totali non coincidono ed è voluto. Una richiesta o una prenotazione «in
attesa» non conta MAI come confermata.

## Funzioni

| Modulo | Funzione | Cosa fa |
| --- | --- | --- |
| `notti.ts` | `nottiDisponibili(mese, camere, fuoriServizio)` | camere ATTIVE × giorni del mese, meno le notti fuori servizio (`FuoriServizio { room_id, da, a }`, struttura definita e vuota: TODO tabella `room_closures`) |
| | `nottiVendute(mese, prenotazioni)` | notti nel mese delle sole confermate/completate, per camera |
| | `ricavoCompetenzaCent(prenotazione, mese)` | totale diviso sulle notti in centesimi interi (resto sulle prime notti), solo le notti nel mese |
| | `indiciMese(mese, camere, prenotazioni, fuoriServizio)` | occupazione ‰, ricavi di competenza, ADR (ricavo / notte venduta), RevPAR (ricavo / notte disponibile) |
| `cassa.ts` | `incassiMese(mese, prenotazioni, pagamenti, oggi)` | righe di `payments` nel loro giorno (**registrati**) + saldo presunto alla consegna delle chiavi per i soggiorni senza righe (**presunti**), tenuti distinti; `incoerenze` fra `bookings.pagato` e le righe reali |
| | `speseMeseCent`, `saldoCassa` | spese del mese (già filtrate Casa Ania dal chiamante) e saldo incassi − spese |
| `imbuto.ts` | `imbutoRichieste(richieste)` | richieste → proposte inviate → confermate → rifiutate, per canale e per origine (web), motivi del rifiuto, tempo mediano created_at → proposta_inviata_at, quota di composizioni manuali e prezzi a mano |
| `daControllare.ts` | `daControllare({ oggi, richieste, prenotazioni, pagamenti, documenti })` | richieste ferme (stessa regola di `avvisoFerma`), arrivi e partenze nei prossimi 3 giorni, pagamenti incoerenti o mancanti, sovrapposizioni fra confermate, fatture scadute |

## Esempi numerici (dai test)

Camere attive: Amelia, Allegra, Ambra, Lena (una quinta camera disattivata non
conta). Settembre 2026 (30 giorni).

Prenotazioni: Amelia 1–4 set 210 € · Ambra 30 ago–2 set 240 € · Lena 28 set–2
ott 360 € · Allegra 20–21 set 80 € (completata) · Allegra 10–12 set in attesa
(MAI contata) · Allegra 12–14 annullata (mai).

| Indicatore | Settembre 2026 | Con Lena chiusa 10–20 e Ambra 29–30 | Marzo 2027 (senza dati) |
| --- | --- | --- | --- |
| notti disponibili | 120 | 108 (12 chiuse) | 124 |
| notti vendute | 8 | 8 | 0 |
| occupazione | 67 ‰ (6,7 %) | 74 ‰ | 0 |
| ricavi di competenza | 640,00 € | 640,00 € | 0 |
| ADR | 80,00 € | 80,00 € | 0 |
| RevPAR | 5,33 € | 5,93 € | 0 |

Competenza a cavallo di mese: 240 € su 3 notti (30, 31 ago, 1 set) → agosto
160,00 €, settembre 80,00 €; 100 € su 3 notti → 33,34 + 33,33 + 33,33 (resto
sulla prima notte, mai un float).

Cassa (settembre, oggi 15/09): Rossi 3–6 set 240 € con acconti 100 € (20 ago)
e 140 € (3 set) → settembre registra 140,00 €; una prenotazione «pagato» senza
righe da 160 € → presunta 160,00 € alla consegna delle chiavi; arrivo futuro e
bonifico in attesa senza righe → 0; cambio camera (stesso group_id) pagato
240 € il 5 set → 240,00 €. Totale settembre 540,00 € (380 registrati + 160
presunti). Incoerenze segnalate, mai corrette: `saldato_ma_non_segnato`
(righe = totale ma «pagato» spento), `pagato_senza_righe`,
`pagato_ma_incompleto`, `pagamenti_oltre_il_totale`,
`pagamento_senza_prenotazione`. Spese settembre 135,50 € → saldo 24000 −
13550 = 104,50 € nell'esempio con un solo incasso da 240 €.

Imbuto (7 richieste): 4 proposte inviate, 2 confermate, 3 rifiutate, 1 in
attesa; web 4 (google 2, diretto 2); motivi «Prezzo» 1, «date assegnate a
altro cliente» 1, «non indicato» 1; tempo mediano di risposta 75 minuti;
4 proposte con soluzione di cui 2 manuali (500 ‰) e 1 con prezzo a mano
(250 ‰). Lista vuota → tutti zero, mediana `null`.

Da controllare (oggi 15/09): «ferma da 2 giorni» e «arrivo passato»; arrivi
15, 16, 17 set; partenza il 17; pagamenti: `saldato_ma_non_segnato`,
`pagato_senza_righe`, un soggiorno concluso senza pagamento; Amelia
sovrapposta la notte del 16; una fattura scaduta il 10/09 (quella in
scadenza il 20 e quella già pagata non compaiono).

## TODO dichiarati (dati che oggi non ci sono)

- Camere fuori servizio: nessuna tabella; `FUORI_SERVIZIO_VUOTO` finché Ania
  non decide dove registrarle.
- Origine (utm) solo per le richieste dal sito (`richieste.origine`).
- Tempo di risposta: solo dalla prima proposta (le proposte rigenerate dopo
  una modifica vivono in `proposte_precedenti`, non ancora lette qui).
- Nessuna metrica inventata su cancellazioni o no-show: le prenotazioni
  annullate hanno `cancelled_reason` ma non un flag di mancato arrivo.
