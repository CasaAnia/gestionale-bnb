# Avvisi sito — Codex — 24 ottobre 2026
Richiesta Ania: solo notifica telefono e avviso nuove richieste, email esclusa. Base origin/main verificata 2f7ac42. Copia isolata work/richieste-avvisi, Codex unico autore. Vecchia main locale e modifiche altrui preservate.

Web push già prevista dalla route richieste/web: telefono registrato, nome/date/persone/link richiesta. Nessuna modifica a invio, rinnovo, service worker, Pushover, pulizie o arrivi. Ricezione su telefono fisico NON verificata: resta prova dal dispositivo con test esistente Impostazioni.

Aggiunto avviso globale delle richieste web in attesa non ancora viste. Lettura soli UUID, paginazione 500, ordine stabile, navigazione/focus/visibilità/30 secondi. Errore visibile con Riprova e conservazione lista. Vista solo dopo caricamento proposta senza errori. Memoria UUID nel browser/dispositivo, non nel database; memoria negata conserva avviso. Aprire non conferma, non invia messaggi, non modifica richiesta. Vecchi avvisi bookings invariati. Fixture due richieste web solo con FINTO_AVVISI_SITO=1.

Prove UI sintetiche: 2→apertura prima→1, ricarica conserva vista, seconda→0, entrambe restano in_attesa; terza nuova→avviso ritorna. Guasto lettura→errore→Riprova recupera. Screenshot mobile circa420px controllato; spazio corretto rispetto a margine negativo Home. Nessun iPhone fisico.
2244/2244 suite applicazione PASS; tipi PASS; lint nuovi file/layout PASS; lint proposta ha errore preesistente set-state-in-effect riprodotto su sorgente base. Build finale con Supabase/VAPID sintetici PASS. Preflight app PASS, strumenti99/100 (pulizie0059 concorrenza già falliva prima), completo NON verde. Nessuna modifica ai test estranei.

NON committato, NON pubblicato: revisione automatica ha rifiutato operazione con commit/push perché autorizzazione alla mutazione del repository condiviso considerata non esplicita. Richiesto sì specifico Ania per pubblicare questi soli file. Nessuna migrazione, scrittura su dati reali, nuova spesa, email o messaggio ospiti. Prossima azione: dopo autorizzazione, commit/push e verifica deploy/UI online. Schermata prova in outputs/avviso-richieste-prova.png della chat.

## Autorizzazione esplicita alla pubblicazione
Ania: «Sì pubblica solo queste modifiche, mi raccomando non toccare altro. Poi proviamo la notifica sul telefono.» Verificato remoto ancora 2f7ac42 e delta limitato ai sei file applicazione/prova descritti più questo diario. Pubblicazione autorizzata; prova sul telefono successiva al rilascio.
