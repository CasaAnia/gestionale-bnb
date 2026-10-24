# Pop-up richieste sito — 24 ottobre 2026 — Codex
Autorizzazione Ania: pubblicare solo il pop-up dell'ultima anteprima, poi prova telefono. Base origin/main45d5107 verificata, copia isolata popup-anteprima. Codex unico autore del componente AvvisoRichiesteSito; file fixture locale da NON pubblicare.

Aspetto approvato: riquadro centrale grande, fondo oscurato, campanella e titolo; dettagli14px compatti, nome e telefono accanto, date/notti/camera richiesta, età evidenziata. Apri richiesta/Dopo. Si mantengono canali e chiamate esistenti: nessun nuovo invio telefonico/Pushover/email, nessuna modifica a dati richieste/prenotazioni/pulizie/pagamenti o database.

Componente legge metadati necessari oltre agli UUID, con join rooms(name), ordine e paginazione invariati. Dopo ricorda solo gli UUID rimandati nell'apertura corrente: una richiesta nuova non è soppressa; tornando visibile l'app li ripropone. Le viste restano gestite dalla proposta già pubblicata. Errori di aggiornamento visibili con Riprova, non interpretati come assenza richieste. Pop-up con focus/tastiera, contenuto scorrevole su schermi piccoli, blocco scorrimento sfondo e ripristino alla chiusura. Stile dev-only della preview non portato in produzione.

Prove e pubblicazione in corso. Nessuna scrittura reale di prova o messaggio ospite. La richiesta finta precedente resta in attesa per la prova sul telefono.

## Prove locali finali
Suite2244/2244PASS, tipiPASS, lint componentePASS,diffcheckPASS. Prove via UI reale su dati sintetici: Dopo chiude; ricarica riapre; Apri raggiunge la proposta corretta e la richiesta resta in_attesa; altra richiesta non vista proposta dopo apertura prima; Dopo sulla seconda non impedisce avviso di una terza nuova rilevata in sottofondo. Errore lettura a riapertura mostra Riprova; tolto guasto,Riprova riporta pop-up. Nessuna richiesta reale aperta o cambiata. Schermata mobile tramite iframe390 dell'anteprima approvata; comandi verificati anche su pagina diretta desktop. Focus entra nel pop-up, Escape chiude come Dopo; scorrimento sfondo ripristinato chiudendo. Non dichiarato collaudo iPhone fisico, che segue con Ania.

Build finale in corso con credenziali/VAPID sintetici. Il limite preesistente strumenti pulizie0059 (99/100 nella verifica precedente) non riguarda questo unico componente e non è stato modificato.
Build finale PASS, comprese pagine/tipi. Precisazione: focus entrante osservato; gestione Escape/Tab verificata nel codice, non tramite pressione tasti nella UI. Pubblicazione autorizzata esplicitamente dall'ultimo messaggio Ania; si pubblicano SOLO componente e questo registro. La fixture locale rimane esclusa dal commit e dal rilascio.
