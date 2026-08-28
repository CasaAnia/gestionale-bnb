// Dati SINTETICI per l'anteprima della Fase 3A. Nessuna query a Supabase,
// nessun dato reale: nomi, importi e date sono inventati ma verosimili.

export type Movimento = {
  id: string
  titolo: string
  negozio?: string
  giorno: string          // etichetta breve
  importo: number
  categoria: string
  contesto: 'mia' | 'ania'
  sorelle?: { nome: string; importo: number }[]   // scontrino misto
  camera?: string
  daControllare?: boolean
  metodo?: string
}

export const MIA = {
  mese: 'Agosto',
  speso: 1247.6,
  confronto: -8,                       // % vs luglio
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
  teo: { tot: 84.5, voci: [['Scuola e formazione', 35], ['Sport e hobby', 28], ['Mangiare fuori', 21.5]] as [string, number][] },
}

export const ANIA = {
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
}

export const MOVIMENTI: Movimento[] = [
  { id: 'm1', titolo: 'Supermercato', negozio: 'Esselunga', giorno: 'Oggi', importo: 15.47, categoria: 'Spesa alimentare', contesto: 'mia', daControllare: true, sorelle: [{ nome: 'Casa Mia', importo: 11.33 }, { nome: 'Casa Ania', importo: 4.14 }] },
  { id: 'm2', titolo: 'Colazione al bar', negozio: 'Bar Centrale', giorno: 'Oggi', importo: 4.4, categoria: 'Mangiare fuori', contesto: 'mia' },
  { id: 'm3', titolo: 'Lenzuola matrimoniali ×2', negozio: 'Tessil Casa', giorno: 'Ieri', importo: 74, categoria: 'Biancheria', contesto: 'ania', camera: 'Ambra', metodo: 'Carta attività' },
  { id: 'm4', titolo: 'Benzina', giorno: 'Ieri', importo: 60, categoria: 'Auto e trasporti', contesto: 'mia', metodo: 'Contanti' },
  { id: 'm5', titolo: 'Quaderni e penne per Teo', negozio: 'Cartoleria Punto', giorno: 'Mar 26', importo: 18.9, categoria: 'Scuola e formazione', contesto: 'mia' },
  { id: 'm6', titolo: 'Detersivi camere', negozio: 'Esselunga', giorno: 'Mar 26', importo: 23.8, categoria: 'Pulizia e detergenti', contesto: 'ania', metodo: 'Carta attività' },
  { id: 'm7', titolo: 'Pranzo insieme', negozio: 'Trattoria del Ponte', giorno: 'Dom 24', importo: 47, categoria: 'Mangiare fuori', contesto: 'mia' },
  { id: 'm8', titolo: 'Capsule caffè ospiti', negozio: 'Esselunga', giorno: 'Sab 23', importo: 9.9, categoria: 'Colazioni e bevande', contesto: 'ania', metodo: 'Contanti' },
]

export const DOCUMENTI = {
  daElaborare: [
    { id: 'd1', titolo: 'Foto di oggi, 9:12', pagine: 1 },
    { id: 'd2', titolo: 'Foto di oggi, 9:12', pagine: 1 },
  ],
  daControllare: [
    { id: 'd3', titolo: 'Scontrino Esselunga', importo: 15.47, dubbi: 1, duplicato: false },
  ],
  daPagare: [
    { id: 'd4', titolo: 'Fattura Lavanderia Girasole', importo: 180, scade: '5 set' },
    { id: 'd5', titolo: 'Fattura Elettricista Fumagalli', importo: 300, scade: '12 set', pagine: 3 },
  ],
  confermati: 12,
  errori: [
    { id: 'd6', titolo: 'Foto sfocata del 21 ago', motivo: 'non leggibile: rifare la foto' },
  ],
}

export const REVISIONE = {
  negozio: 'Esselunga',
  data: 'oggi, 9:12',
  totale: 15.47,
  pagine: 1,
  possibileDuplicato: null as string | null,
  righe: [
    { id: 'r1', nome: 'Pane fresco', importo: 3.2, dest: 'Casa Mia', dubbio: null as string | null, esclusa: false },
    { id: 'r2', nome: 'Latte intero ×2', importo: 3.1, dest: 'Casa Mia', dubbio: null, esclusa: false },
    { id: 'r3', nome: 'Mele Golden 1 kg', importo: 2.63, dest: 'Casa Mia', dubbio: 'importo poco leggibile', esclusa: false },
    { id: 'r4', nome: 'Kiwi (letto due volte)', importo: 2.4, dest: 'Casa Mia', dubbio: null, esclusa: true },
    { id: 'r5', nome: 'Yogurt bianco ×4', importo: 2.4, dest: 'Casa Mia', dubbio: null, esclusa: false },
    { id: 'r6', nome: 'Aceto di alcol ×2', importo: 4.14, dest: 'Casa Ania', dubbio: null, esclusa: false },
  ],
  controlli: [
    { esito: 'ok' as const, testo: 'Somma righe = totale documento', dettaglio: '15,47 € = 15,47 € — al centesimo' },
    { esito: 'ok' as const, testo: 'Nessun duplicato tra i documenti', dettaglio: 'foto, data e totale confrontati' },
    { esito: 'attenzione' as const, testo: 'Un importo poco leggibile', dettaglio: 'Mele Golden: controlla 2,63 € — non blocca' },
    { esito: 'attenzione' as const, testo: 'Righe Casa Ania: metodo indicato', dettaglio: 'Carta attività — richiesto per il B&B' },
  ],
}

export const eur = (n: number) =>
  n.toLocaleString('it-IT', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 }) + ' €'
