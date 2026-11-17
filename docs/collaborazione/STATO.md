# Rimedi 1 e 3 e risposte di Ania — 17 novembre 2026 — Claude

In produzione fino a b411dba (deploy Vercel riusciti, test GitHub verdi): ora nessuna versione va online con test rossi, le letture di tabelle intere sono sempre complete, le migrazioni del repo coincidono con il database vero per tabelle, colonne, tipi, NOT NULL e funzioni, la scheda cliente unisce le schede con lo stesso telefono. Nessuna migrazione applicata.

Prove: suite 2297 test verdi (2272 prima) e verdi anche con orologi e fusi diversi; build con i test dentro; prova del blocco su Vercel (test rosso: Preview in errore, produzione invariata). Non verificati: vincoli, indici, policy RLS, trigger e corpi delle funzioni del database (serve l'estrazione del catalogo); il sito online non è stato aperto.

Aperto: lista di copie e rami da togliere, in attesa del sì di Ania (tutto è salvato nel ramo locale archivio-2026-11-17, da non pubblicare); la migrazione 0066 del ramo in-forse va rinumerata 0067; bozze non applicate (0026, 0036 parte bookings, 0041, 0042, 0049, 0050, 0065) e 0063 solo in archivio. Dettagli nel diario 2026-11-17-claude-rimedi-1-e-3.md.
