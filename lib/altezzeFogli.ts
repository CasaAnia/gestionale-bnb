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
  // misurate il 28-29/09/2026 a 390 px nel caso più lungo, più lo spazio di un avviso
  date: 330,            // 276 con l'effetto sul conto
  cambioCamera: 360,    // 309
  togliCamera: 320,     // la domanda e i due comandi
  sconto: 420,          // 372 con la percentuale e i tre numeri
  comePaga: 470,        // 430 con «Caparra»: importo, entro il, alle
  togliPagamento: 330,  // 293
  nota: 420,            // 385 con i colori e «La prenotazione è arrivata»
  annulla: 360,         // 306 con la spiegazione e il motivo
  mancatoArrivo: 480,
  prezzoSoggiorno: 720, // le due colonne prima/dopo e le scelte del prezzo
  cliente: 790,         // 769 con la valutazione «!» e il motivo
  cambiaCliente: 720,   // la ricerca con i risultati: oltre, scorre dentro
  provenienza: 380,     // 319 con «Struttura» e l'elenco delle strutture
  chiDorme: 420,        // due persone e l'avviso delle colonne
  notte: 540,           // 492 con gli ospiti e l'effetto sul conto
} as const
export type FoglioConAltezza = keyof typeof ALTEZZE_FOGLI
