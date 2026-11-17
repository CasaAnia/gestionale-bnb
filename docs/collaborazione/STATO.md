# Cifra rossa del Calendario — 17 novembre 2026 — Claude

Pubblicata e verificata in produzione solo a livello di deploy: origin/main 5395ab1, Vercel 7854501901 success. La cifra del totale speso dal cliente ora somma anche le schede cliente con lo stesso telefono, con una sola funzione per Calendario, foglietto e scheda prenotazione. Online a schermo non verificata (serve l'accesso di Ania).

Prove: suite 2272 test verdi (2266 prima), build e TypeScript puliti. Sui dati veri letti in sola lettura: 351 prenotazioni, 258 attive; un cliente reale con due schede aveva 1.840 € e 158 € invece di 1.998 €; nessuna cifra mancante, nessuna differenza fra `total_amount` e conto. Nessuna migrazione, nessuna scrittura.

Aperto: tre domande per Ania (prenotazioni in corso e future, schede cliente unite, stesso nome con telefoni diversi) e l'analisi «perché si guastano le cose» con tre rimedi proposti, tutti da decidere. Precedente: pulizie di Codex (13/11) in produzione, d680e8b, deploy 7759929016 success. Dettagli e prove nel diario 2026-11-17-claude-cifra-rossa.md.
