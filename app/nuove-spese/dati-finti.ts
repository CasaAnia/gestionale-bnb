// Dati SINTETICI per la preview del nuovo guscio (Fase 3.1). Nessuna query
// a Supabase, nessun dato reale. Coprono anche i casi particolari da
// verificare: scontrino misto, documento senza foto, campi dubbi, fatture
// pagate e scartate, camera del B&B.
import type { DatiSpese } from '@/lib/spese/vista'

export const DATI_FINTI: DatiSpese = {
  mia: {
    mese: 'Agosto',
    speso: 1247.6,
    confrontoPct: -8,
    daControllare: { n: 3, tot: 86.4 },
    budget: [
      { nome: 'Mangiare fuori', speso: 182, tetto: 220 },
      { nome: 'Spesa alimentare', speso: 421, tetto: 450 },
      { nome: 'Abbigliamento', speso: 96, tetto: 150 },
    ],
    ripetute: { frase: '23 piccole spese sotto i 5 €', tot: 61.2, esempio: 'caffè, snack, sacchetti' },
    categorie: [
      { nome: 'Spesa alimentare', tot: 421 },
      { nome: 'Mangiare fuori', tot: 182 },
      { nome: 'Casa e consumabili', tot: 148 },
      { nome: 'Abbigliamento', tot: 96 },
      { nome: 'Auto e trasporti', tot: 60 },
    ],
    teo: { tot: 84.5, voci: [['Scuola e formazione', 35], ['Sport e hobby', 28], ['Mangiare fuori', 21.5]] },
  },
  ania: {
    mese: 'Agosto',
    speso: 642.3,
    impegnato: { tot: 480, n: 2 },
    scadenze: [
      { fornitore: 'Lavanderia Girasole', importo: 180, scade: '5 set', giorni: 8 },
      { fornitore: 'Elettricista Fumagalli', importo: 300, scade: '12 set', giorni: 15 },
    ],
    fattureDaControllare: 1,
    metodi: [
      { nome: 'Carta attività', quota: 62 },
      { nome: 'Bonifico', quota: 30 },
      { nome: 'Contanti', quota: 8 },
    ],
    costiCamere: [
      { nome: 'Generale', tot: 418.5 },
      { nome: 'Ambra', tot: 98 },
      { nome: 'Amelia', tot: 62 },
      { nome: 'Lena', tot: 41.8 },
      { nome: 'Allegra', tot: 22 },
    ],
    andamento: [512, 448, 605, 530, 587, 642.3],
  },
  movimenti: [
    {
      id: 'm1', titolo: 'Supermercato', negozio: 'Esselunga', giorno: 'Oggi', mese: 'Agosto',
      importo: 15.47, categoria: 'Spesa alimentare', contesto: 'misto', persona: 'Casa',
      metodo: 'Carta', stato: 'da_controllare', dubbio: '1 importo poco leggibile',
      sorelle: [{ contesto: 'mia', importo: 11.33 }, { contesto: 'ania', importo: 4.14 }],
      righe: [
        { nome: 'Pane fresco', importo: 3.2, contesto: 'mia' },
        { nome: 'Latte intero ×2', importo: 3.1, contesto: 'mia' },
        { nome: 'Mele Golden 1 kg', importo: 2.63, contesto: 'mia', dubbio: 'poco leggibile' },
        { nome: 'Yogurt bianco ×4', importo: 2.4, contesto: 'mia' },
        { nome: 'Aceto di alcol ×2', importo: 4.14, contesto: 'ania' },
      ],
    },
    {
      id: 'm2', titolo: 'Colazione al bar', negozio: 'Bar Centrale', giorno: 'Oggi', mese: 'Agosto',
      importo: 4.4, categoria: 'Mangiare fuori', contesto: 'mia', persona: 'Ania',
      metodo: 'Contanti', stato: 'senza_documento', senzaFoto: true,
    },
    {
      id: 'm3', titolo: 'Lenzuola matrimoniali ×2', negozio: 'Tessil Casa', giorno: 'Ieri', mese: 'Agosto',
      importo: 74, categoria: 'Biancheria', contesto: 'ania', persona: 'Ania',
      metodo: 'Carta attività', stato: 'confermato', camera: 'Ambra',
      righe: [{ nome: 'Lenzuola matrimoniali', importo: 74, contesto: 'ania' }],
    },
    {
      id: 'm4', titolo: 'Fattura Lavanderia Girasole', giorno: 'Ieri', mese: 'Agosto',
      importo: 180, categoria: 'Casa e consumabili', contesto: 'ania', persona: 'Ania',
      stato: 'da_pagare',
    },
    {
      id: 'm5', titolo: 'Benzina', giorno: 'Mer 27', mese: 'Agosto',
      importo: 60, categoria: 'Auto e trasporti', contesto: 'mia', persona: 'M e A',
      metodo: 'Contanti', stato: 'senza_documento',
    },
    {
      id: 'm6', titolo: 'Quaderni e penne per Teo', negozio: 'Cartoleria Punto', giorno: 'Mar 26', mese: 'Agosto',
      importo: 18.9, categoria: 'Scuola e formazione', contesto: 'mia', persona: 'Teo',
      metodo: 'Carta', stato: 'confermato',
    },
    {
      id: 'm7', titolo: 'Detersivi camere', negozio: 'Esselunga', giorno: 'Mar 26', mese: 'Agosto',
      importo: 23.8, categoria: 'Pulizia e detergenti', contesto: 'ania', persona: 'Ania',
      metodo: 'Carta attività', stato: 'confermato',
    },
    {
      id: 'm8', titolo: 'Fattura idraulico Bianchi', giorno: 'Lun 25', mese: 'Agosto',
      importo: 220, categoria: 'Casa e consumabili', contesto: 'ania', persona: 'Ania',
      metodo: 'Bonifico', stato: 'pagata',
    },
    {
      id: 'm9', titolo: 'Pranzo insieme', negozio: 'Trattoria del Ponte', giorno: 'Dom 24', mese: 'Agosto',
      importo: 47, categoria: 'Mangiare fuori', contesto: 'mia', persona: 'M e A',
      metodo: 'Carta', stato: 'confermato',
    },
    {
      id: 'm10', titolo: 'Sandali estivi', negozio: 'Scarpe & Co', giorno: '12 lug', mese: 'Luglio',
      importo: 39.9, categoria: 'Abbigliamento', contesto: 'mia', persona: 'Ania',
      metodo: 'Carta', stato: 'confermato',
    },
  ],
  documenti: [
    { id: 'd1', titolo: 'Foto di oggi, 9:12', tipo: 'scontrino', contesto: 'mia', stato: 'da_elaborare' },
    { id: 'd2', titolo: 'Scontrino Esselunga', tipo: 'scontrino', contesto: 'misto', stato: 'da_controllare', importo: 15.47, dubbi: 1, pagine: 1 },
    { id: 'd3', titolo: 'Nota spese mercato', tipo: 'scontrino', contesto: 'mia', stato: 'da_controllare', importo: 12.5, senzaFoto: true },
    { id: 'd4', titolo: 'Fattura Lavanderia Girasole', tipo: 'fattura', contesto: 'ania', stato: 'da_pagare', importo: 180, scade: '5 set' },
    { id: 'd5', titolo: 'Fattura Elettricista Fumagalli', tipo: 'fattura', contesto: 'ania', stato: 'da_pagare', importo: 300, scade: '12 set', pagine: 3 },
    { id: 'd6', titolo: 'Fattura idraulico Bianchi', tipo: 'fattura', contesto: 'ania', stato: 'pagata', importo: 220, giorno: 'lun 25' },
    { id: 'd7', titolo: 'Scontrino Tessil Casa', tipo: 'scontrino', contesto: 'ania', stato: 'confermato', importo: 74, giorno: 'ieri' },
    { id: 'd8', titolo: 'Scontrino Esselunga del 21 ago', tipo: 'scontrino', contesto: 'mia', stato: 'scartato', motivo: 'doppione: stessa foto caricata due volte' },
    { id: 'd9', titolo: 'Foto sfocata del 21 ago', tipo: 'scontrino', contesto: 'mia', stato: 'errore', motivo: 'non leggibile: rifare la foto' },
  ],
  opzioni: {
    mia: {
      periodi: ['Agosto', 'Luglio', 'Anno'],
      persone: ['Casa', 'Ania', 'Teo', 'M e A'],
      categorie: ['Spesa alimentare', 'Mangiare fuori', 'Scuola e formazione', 'Casa e consumabili', 'Auto e trasporti', 'Abbigliamento'],
      metodi: ['Contanti', 'Carta'],
    },
    ania: {
      periodi: ['Agosto', 'Luglio', 'Anno'],
      camere: ['Generale', 'Amelia', 'Allegra', 'Ambra', 'Lena'],
      categorie: ['Spesa alimentare', 'Biancheria', 'Pulizia e detergenti', 'Casa e consumabili', 'Colazioni e bevande'],
      metodi: ['Carta attività', 'Bonifico', 'Contanti', 'Carta'],
    },
  },
}
