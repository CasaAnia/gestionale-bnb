// ============================================================================
// L'ALTEZZA FISSA DEI FOGLI DELLA SCHEDA «MAISON» (incarico del 28/09/2026,
// punto 11): ogni foglio è alto quanto il suo contenuto più lungo, misurato a
// 390 px nell'anteprima finta, così scegliendo opzioni diverse il foglio non
// cambia misura (lo spazio in più resta vuoto, il piede resta in fondo). Sul
// telefono il foglio non supera mai il 92% dello schermo: oltre, il
// contenuto scorre dentro (FoglioMaison). FoglioArrivo e FoglioPagamento
// hanno la loro, dentro i loro file.
// ============================================================================
export const ALTEZZA_FOGLIO_PREDEFINITA = 560

export const ALTEZZE_FOGLI = {
  // RITOCCHI DEL 29/09/2026 (B1): ogni altezza è il contenuto più lungo del
  // foglio + 24 px + la riga «Annulla · Salva», misurata a 390 px
  // nell'anteprima finta (FoglioMaison con l'altezza libera, poi rimessa):
  // così i tasti stanno sempre nello stesso punto, subito sotto, e niente
  // spazio vuoto in più. Fra parentesi il caso misurato.
  date: 293,            // la linea di una camera fra due (sottotitolo «Lena · 20 → 22 nov»)
  cambioCamera: 417,    // 24 notti da scegliere (Ventiquattro Notti); oltre, scorre dentro
  togliCamera: 226,     // la domanda, la spiegazione e i due comandi
  sconto: 382,          // «Percentuale» o «Prezzo finale» coi tre numeri
  comePaga: 434,        // «Caparra»: importo, entro il, alle
  togliPagamento: 297,  // l'importo, la data e «restano da incassare»
  nota: 389,            // la nota, i colori e «La prenotazione è arrivata»
  annulla: 343,         // «Errore mio» con la spiegazione e il motivo
  mancatoArrivo: 500,   // 458 «Mancato arrivo»; «Pagamento · mancato arrivo» coi tre campi non si riproduce nell'anteprima: stima
  prezzoSoggiorno: 655, // due camere, «Concordo un prezzo nuovo» col campo
  cliente: 771,         // «Dati della cliente» rifatto (B2): «!» col perché, «Altra struttura» con «Altra…» e il campo, «Paga di solito con»
  cambiaCliente: 720,   // la ricerca coi risultati (fino a 30): oltre, scorre dentro
  provenienza: 323,     // «Altra struttura» col campo della struttura
  chiDorme: 412,        // tre persone e l'avviso sulla camera; oltre, scorre dentro
  persona: 391,         // «Aggiungi una persona»: nome, cognome, telefono, chi è
  notte: 552,           // la notte di una camera fra due, ospiti ed effetto sul conto
} as const
export type FoglioConAltezza = keyof typeof ALTEZZE_FOGLI
