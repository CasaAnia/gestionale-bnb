// Descrizioni BREVI delle camere per le proposte (pezzo 11, bloccate da Ania
// il 04/09/2026). Chiave = slug della pagina della camera sul sito
// (lib/roomTypes.ROOM_SLUG_BY_NAME). Si usano SOLO nelle proposte: le
// descrizioni tecniche (bagno interno/esterno…) restano nella conferma.
//  · breve: nel caso A («è disponibile soltanto Ambra, una camera matrimoniale
//    con il bagno in camera») e nel blocco Amelia;
//  · tipo: nelle righe con trattino dei casi B e C («in Amelia, una singola»);
//    ECCEZIONE Lena: sempre la frase intera del bagno, anche nelle righe.
export type DescrizioneCamera = { breve: string; tipo: string }

export const DESCRIZIONI_CAMERE: Record<string, DescrizioneCamera> = {
  singola: { breve: 'una camera singola con il bagno in camera', tipo: 'una singola' },
  ambra: { breve: 'una camera matrimoniale con il bagno in camera', tipo: 'una matrimoniale' },
  allegra: { breve: 'una camera matrimoniale con il balconcino e il bagno in camera', tipo: 'una matrimoniale' },
  lena: {
    breve: 'una camera tripla con il bagno privato appena fuori dalla porta, chiuso a chiave',
    tipo: 'una tripla con il bagno privato appena fuori dalla porta, chiuso a chiave',
  },
}

// «un letto in più», mai «terzo letto» / «secondo letto» / «branda»
export const LETTO_IN_PIU = 'un letto in più'
export const SITO_CAMERE = 'casaaniarozzano.it/camere'
