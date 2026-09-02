// Dati SINTETICI per la preview del nuovo guscio (3.1 → 3.2A). Nessuna query
// a Supabase, nessun dato reale. Da 3.2A i dati finti sono TABELLE GREZZE
// nello schema reale, trasformate dallo STESSO adattatore usato per i dati
// veri: la preview sintetica esercita il codice vero. Coprono i casi da
// verificare: misto multi-categoria/persona/camera, senza foto, fatture da
// pagare e pagate, scartati, errori, agosto di un altro anno.
import { costruisciDatiSpese, type TabelleGrezze } from '@/lib/spese/adattatore'
import type { DatiSpese } from '@/lib/spese/vista'

export const OGGI_FINTO = '2026-08-29'

const doc = (x: Partial<TabelleGrezze['documenti'][0]> & { id: string }): TabelleGrezze['documenti'][0] => ({
  kind: 'scontrino', status: 'confermato', doc_total: null, supplier: null,
  document_date: null, due_date: null, upload_ambito: 'personale',
  error_message: null, note: null, created_at: '2026-08-29T09:12:00Z', ...x,
})
const spesa = (x: Partial<TabelleGrezze['spese'][0]> & { id: string; amount: number }): TabelleGrezze['spese'][0] => ({
  expense_date: '2026-08-29', group_id: 'g-casa', category_id: null,
  subcategory: null, description: null, store: null, product: null,
  receipt_id: null, payment_method: null, room_id: null, ...x,
})

export const TABELLE_FINTE: TabelleGrezze = {
  gruppi: [
    { id: 'g-casa', name: 'Casa', ambito: 'personale' },
    { id: 'g-ania', name: 'Ania', ambito: 'personale' },
    { id: 'g-teo', name: 'Matteo', ambito: 'personale' },
    { id: 'g-ma', name: 'Matteo e Ania', ambito: 'personale' },
    { id: 'g-bnb', name: 'Casa Ania', ambito: 'azienda' },
  ],
  categorie: [
    { id: 'c-spesa', name: 'Spesa alimentare' },
    { id: 'c-fuori', name: 'Mangiare fuori' },
    { id: 'c-scuola', name: 'Scuola e formazione' },
    { id: 'c-auto', name: 'Auto e trasporti' },
    { id: 'c-abbigl', name: 'Abbigliamento' },
    { id: 'c-bianco', name: 'Biancheria' },
    { id: 'c-pulizia', name: 'Detersivi e pulizia' },
    { id: 'c-lavori', name: 'Lavori e manutenzione' },
  ],
  camere: [
    { id: 'r-amelia', name: 'Amelia' }, { id: 'r-allegra', name: 'Allegra' },
    { id: 'r-ambra', name: 'Ambra' }, { id: 'r-lena', name: 'Lena' },
  ],
  budget: [
    { ambito: 'personale', category_name: 'Mangiare fuori', monthly_amount: 220 },
    { ambito: 'personale', category_name: 'Spesa alimentare', monthly_amount: 450 },
    { ambito: 'personale', category_name: 'Abbigliamento', monthly_amount: 150 },
  ],
  documenti: [
    doc({ id: 'd-coda' }),                                             // foto in coda
    doc({ id: 'd-rev', status: 'in_revisione', doc_total: 12.5, upload_ambito: 'personale' }),  // senza foto, in revisione (bozze sotto)
    doc({ id: 'd-misto', doc_total: 15.47 }),                          // scontrino misto confermato
    doc({ id: 'd-lenzuola', doc_total: 74 }),
    // Fase 5: scadenzario completo — in scadenza (5/9), non scaduta (12/9), SCADUTA (20/8) —
    // ognuna con la sua bozza attiva (è ciò che il pagamento trasforma in spesa)
    doc({ id: 'd-fatt-lav', kind: 'fattura', status: 'approvata_da_pagare', doc_total: 180, supplier: 'Lavanderia Girasole', invoice_number: '2026/18', document_date: '2026-08-20', due_date: '2026-09-05', upload_ambito: 'azienda' }),
    doc({ id: 'd-fatt-ele', kind: 'fattura', status: 'approvata_da_pagare', doc_total: 300, supplier: 'Elettricista Fumagalli', invoice_number: '44/2026', document_date: '2026-08-12', due_date: '2026-09-12', upload_ambito: 'azienda' }),
    doc({ id: 'd-fatt-scad', kind: 'fattura', status: 'approvata_da_pagare', doc_total: 95.5, supplier: 'Vetraio Colombo', invoice_number: '7', document_date: '2026-07-30', due_date: '2026-08-20', upload_ambito: 'azienda' }),
    doc({ id: 'd-fatt-idr', kind: 'fattura', status: 'confermato', doc_total: 220, supplier: 'Idraulico Bianchi', invoice_number: '113', upload_ambito: 'azienda', document_date: '2026-08-25', due_date: '2026-09-10' }),
    // fattura appena letta, IN REVISIONE (due pagine): fornitore, numero e date da controllare
    doc({ id: 'd-fatt-rev', kind: 'fattura', status: 'in_revisione', doc_total: 250, supplier: 'Impianti Rossi', invoice_number: '2026-091', document_date: '2026-08-27', due_date: '2026-09-26', upload_ambito: 'azienda', note: 'caldaia della Lena' }),
    doc({ id: 'd-scarto', status: 'scartato', note: 'doppione: stessa foto caricata due volte' }),
    doc({ id: 'd-errore', status: 'errore', error_message: 'non leggibile: rifare la foto' }),
  ],
  ponte: [
    { expense_id: 's-mia1', document_id: 'd-misto' },
    { expense_id: 's-teo1', document_id: 'd-misto' },
    { expense_id: 's-bnb1', document_id: 'd-misto' },
    { expense_id: 's-lenz', document_id: 'd-lenzuola' },
    { expense_id: 's-idr', document_id: 'd-fatt-idr' },
  ],
  spese: [
    // scontrino MISTO Esselunga: Casa + Teo + B&B (camera Ambra)
    spesa({ id: 's-mia1', amount: 8.7, category_id: 'c-spesa', store: 'Esselunga', payment_method: 'Carta' }),
    spesa({ id: 's-teo1', amount: 2.63, group_id: 'g-teo', category_id: 'c-scuola', store: 'Esselunga', payment_method: 'Carta' }),
    spesa({ id: 's-bnb1', amount: 4.14, group_id: 'g-bnb', category_id: 'c-pulizia', store: 'Esselunga', room_id: 'r-ambra', payment_method: 'Carta' }),
    // aziendale con camera
    spesa({ id: 's-lenz', amount: 74, group_id: 'g-bnb', category_id: 'c-bianco', store: 'Tessil Casa', room_id: 'r-ambra', payment_method: 'Carta attività', expense_date: '2026-08-28', description: 'Lenzuola matrimoniali ×2' }),
    // fattura pagata
    spesa({ id: 's-idr', amount: 220, group_id: 'g-bnb', category_id: 'c-lavori', payment_method: 'Bonifico', paid_at: '2026-08-25', expense_date: '2026-08-25' }),
    // manuali senza documento
    spesa({ id: 's-bar', amount: 4.4, group_id: 'g-ania', category_id: 'c-fuori', store: 'Bar Centrale', payment_method: 'Contanti', description: 'Colazione al bar' }),
    spesa({ id: 's-benz', amount: 60, group_id: 'g-ma', category_id: 'c-auto', payment_method: 'Contanti', description: 'Benzina', expense_date: '2026-08-27' }),
    spesa({ id: 's-cart', amount: 18.9, group_id: 'g-teo', category_id: 'c-scuola', store: 'Cartoleria Punto', payment_method: 'Carta', description: 'Quaderni e penne per Teo', expense_date: '2026-08-26' }),
    spesa({ id: 's-det', amount: 23.8, group_id: 'g-bnb', category_id: 'c-pulizia', store: 'Esselunga', payment_method: 'Carta attività', description: 'Detersivi camere', expense_date: '2026-08-26' }),
    spesa({ id: 's-pranzo', amount: 47, group_id: 'g-ma', category_id: 'c-fuori', store: 'Trattoria del Ponte', payment_method: 'Carta', description: 'Pranzo insieme', expense_date: '2026-08-24' }),
    spesa({ id: 's-caffe1', amount: 1.3, group_id: 'g-ania', category_id: 'c-fuori', product: 'caffè', description: 'Caffè al bar', expense_date: '2026-08-22' }),
    spesa({ id: 's-caffe2', amount: 2.6, group_id: 'g-ania', category_id: 'c-fuori', product: 'caffè', description: 'Caffè e brioche', expense_date: '2026-08-19' }),
    spesa({ id: 's-sacch', amount: 0.9, group_id: 'g-casa', category_id: 'c-spesa', product: 'sacchetti', description: 'Sacchetti', expense_date: '2026-08-12' }),
    // mesi precedenti aziendali (per il grafico dell'andamento)
    spesa({ id: 's-mar', amount: 212, group_id: 'g-bnb', category_id: 'c-lavori', description: 'Manutenzioni di marzo', expense_date: '2026-03-15' }),
    spesa({ id: 's-apr', amount: 148, group_id: 'g-bnb', category_id: 'c-pulizia', description: 'Scorte di aprile', expense_date: '2026-04-12' }),
    spesa({ id: 's-mag', amount: 265, group_id: 'g-bnb', category_id: 'c-bianco', description: 'Biancheria di maggio', expense_date: '2026-05-20' }),
    spesa({ id: 's-giu', amount: 190, group_id: 'g-bnb', category_id: 'c-pulizia', description: 'Scorte di giugno', expense_date: '2026-06-18' }),
    spesa({ id: 's-lug-bnb', amount: 240, group_id: 'g-bnb', category_id: 'c-lavori', description: 'Elettricista di luglio', expense_date: '2026-07-09' }),
    // agosto di un ALTRO anno (2025): non deve confondersi
    spesa({ id: 's-sandali', amount: 39.9, group_id: 'g-ania', category_id: 'c-abbigl', store: 'Scarpe & Co', description: 'Sandali estivi', expense_date: '2025-08-12' }),
    // luglio 2026
    spesa({ id: 's-luglio', amount: 35, group_id: 'g-casa', category_id: 'c-spesa', store: 'Esselunga', description: 'Spesa di luglio', expense_date: '2026-07-12' }),
  ],
  righe: [
    { id: 'r1', expense_id: 's-mia1', name: 'Pane fresco', amount: 3.2, category_id: 'c-spesa', subcategory: 'Pane' },
    { id: 'r2', expense_id: 's-mia1', name: 'Latte intero ×2', amount: 3.1, category_id: 'c-spesa', subcategory: 'Latte' },
    { id: 'r3', expense_id: 's-mia1', name: 'Yogurt bianco ×4', amount: 2.4, category_id: 'c-spesa', subcategory: 'Yogurt' },
    { id: 'r4', expense_id: 's-teo1', name: 'Quaderno a righe', amount: 2.63, category_id: 'c-scuola', subcategory: 'Cartoleria' },
    { id: 'r5', expense_id: 's-bnb1', name: 'Aceto di alcol ×2', amount: 4.14, category_id: 'c-pulizia', subcategory: 'Detersivi' },
  ],
  bozze: [
    // le bozze delle fatture (Fase 5): una parte Casa Ania ciascuna
    { id: 'b-fatt-lav', document_id: 'd-fatt-lav', status: 'da_controllare', expense_date: '2026-08-20', group_id: 'g-bnb', category_id: 'c-bianco', subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: null, description: null, payment_method: null, room_id: null, expense_nature: 'ricorrente', confidence: {}, arrotondamento_cent: 0, expense_id: null },
    { id: 'b-fatt-ele', document_id: 'd-fatt-ele', status: 'da_controllare', expense_date: '2026-08-12', group_id: 'g-bnb', category_id: 'c-lavori', subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: null, description: null, payment_method: null, room_id: 'r-ambra', expense_nature: 'straordinaria', confidence: {}, arrotondamento_cent: 0, expense_id: null },
    { id: 'b-fatt-scad', document_id: 'd-fatt-scad', status: 'da_controllare', expense_date: '2026-07-30', group_id: 'g-bnb', category_id: 'c-lavori', subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: null, description: null, payment_method: null, room_id: 'r-amelia', expense_nature: 'straordinaria', confidence: {}, arrotondamento_cent: 0, expense_id: null },
    { id: 'b-fatt-rev', document_id: 'd-fatt-rev', status: 'da_controllare', expense_date: '2026-08-27', group_id: 'g-bnb', category_id: 'c-lavori', subcategory: null, canonical_category_id: null, canonical_subcategory_id: null, store: null, description: null, payment_method: null, room_id: 'r-lena', expense_nature: 'straordinaria', confidence: { due_date: { confidence: 0.6, doubt_reason: 'scadenza poco leggibile sulla seconda pagina' } }, arrotondamento_cent: 0, expense_id: null },
    {
      id: 'b-rev-mia', document_id: 'd-rev', status: 'da_controllare', expense_date: '2026-08-29',
      group_id: 'g-casa', category_id: 'c-spesa', subcategory: null,
      canonical_category_id: null, canonical_subcategory_id: null,
      store: 'Mercato di Rozzano', description: null, payment_method: 'contanti',
      room_id: null, expense_nature: null,
      confidence: { store: { confidence: 0.55, doubt_reason: 'nome del negozio poco leggibile' } },
      arrotondamento_cent: 1, expense_id: null,   // +1 cent alla sorella personale
    },
    {
      id: 'b-rev-bnb', document_id: 'd-rev', status: 'da_controllare', expense_date: '2026-08-29',
      group_id: 'g-bnb', category_id: 'c-pulizia', subcategory: null,
      canonical_category_id: null, canonical_subcategory_id: null,
      store: 'Mercato di Rozzano', description: null, payment_method: 'contanti',
      room_id: 'r-lena', expense_nature: null,
      confidence: {}, arrotondamento_cent: -1, expense_id: null,  // −1 cent alla sorella B&B
    },
  ],
  righeBozza: [
    { id: 'rbf-lav', draft_id: 'b-fatt-lav', raw_name: null, name: 'Lavaggio biancheria di agosto', qty: 1, unit_price: null, discount: 0, amount: 180, group_id: null, category_id: 'c-bianco', subcategory: 'Lavanderia', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    { id: 'rbf-ele1', draft_id: 'b-fatt-ele', raw_name: null, name: 'Sostituzione quadro elettrico', qty: 1, unit_price: null, discount: 0, amount: 240, group_id: null, category_id: 'c-lavori', subcategory: 'Elettricista', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    { id: 'rbf-ele2', draft_id: 'b-fatt-ele', raw_name: null, name: 'Manodopera', qty: 1, unit_price: null, discount: 0, amount: 60, group_id: null, category_id: 'c-lavori', subcategory: 'Elettricista', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    { id: 'rbf-scad', draft_id: 'b-fatt-scad', raw_name: null, name: 'Vetro finestra Amelia', qty: 1, unit_price: null, discount: 0, amount: 95.5, group_id: null, category_id: 'c-lavori', subcategory: 'Vetraio', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    { id: 'rbf-rev1', draft_id: 'b-fatt-rev', raw_name: 'INTERV. CALDAIA', name: 'Intervento caldaia', qty: 1, unit_price: null, discount: 0, amount: 190, group_id: null, category_id: 'c-lavori', subcategory: 'Idraulico', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    { id: 'rbf-rev2', draft_id: 'b-fatt-rev', raw_name: 'RICAMBI', name: 'Ricambi', qty: 1, unit_price: null, discount: 0, amount: 60, group_id: null, category_id: 'c-lavori', subcategory: 'Idraulico', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    // rb1 con la CANONICA già assegnata (Alimentari): serve a provare che
    // la UI corregge davvero le canoniche, che hanno la precedenza
    { id: 'rb1', draft_id: 'b-rev-mia', raw_name: 'FRUTTA MISTA KG1', name: 'Frutta mista 1 kg', qty: 1, unit_price: 4.5, discount: 0, amount: 4.5, group_id: null, category_id: 'c-spesa', subcategory: 'Frutta', canonical_category_id: 'can-alim', canonical_subcategory_id: 'can-frutta', necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
    { id: 'rb2', draft_id: 'b-rev-mia', raw_name: 'PANE COMUNE', name: 'Pane comune', qty: 1, unit_price: 2.5, discount: 0, amount: 2.5, group_id: null, category_id: 'c-spesa', subcategory: 'Pane', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: { amount: { confidence: 0.6, doubt_reason: 'importo poco leggibile' } }, excluded: false, user_added: false },
    { id: 'rb3', draft_id: 'b-rev-mia', raw_name: 'PANE COMUNE', name: 'Pane (letto due volte)', qty: 1, unit_price: 2.5, discount: 0, amount: 2.5, group_id: null, category_id: 'c-spesa', subcategory: 'Pane', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: true, user_added: false },
    { id: 'rb4', draft_id: 'b-rev-mia', raw_name: null, name: 'Sacchetto', qty: 1, unit_price: 0.5, discount: 0, amount: 0.5, group_id: null, category_id: 'c-spesa', subcategory: 'Sacchetti', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: true },
    { id: 'rb5', draft_id: 'b-rev-bnb', raw_name: 'ACETO ALCOL X2', name: 'Aceto di alcol ×2', qty: 2, unit_price: 2.5, discount: 0, amount: 5, group_id: null, category_id: 'c-pulizia', subcategory: 'Detersivi', canonical_category_id: null, canonical_subcategory_id: null, necessity: null, planning: null, confidence: {}, excluded: false, user_added: false },
  ],
  categorieCanoniche: [
    { id: 'can-alim', name: 'Alimentari' },
    { id: 'can-scuola', name: 'Scuola' },
    { id: 'can-pulizia', name: 'Pulizia casa' },
  ],
  sottocategorieCanoniche: [
    { id: 'can-frutta', name: 'Frutta e verdura', canonical_category_id: 'can-alim' },
    { id: 'can-pane', name: 'Pane', canonical_category_id: 'can-alim' },
    { id: 'can-cartoleria', name: 'Cartoleria', canonical_category_id: 'can-scuola' },
    { id: 'can-detersivi', name: 'Detersivi', canonical_category_id: 'can-pulizia' },
  ],
  ricevute: [
    { id: 'f-coda', document_id: 'd-coda' },
    { id: 'f-misto', document_id: 'd-misto' },
    { id: 'f-lenz', document_id: 'd-lenzuola' },
    { id: 'f-ele1', document_id: 'd-fatt-ele' }, { id: 'f-ele2', document_id: 'd-fatt-ele' }, { id: 'f-ele3', document_id: 'd-fatt-ele' },
    { id: 'f-idr', document_id: 'd-fatt-idr' },
    { id: 'f-scad', document_id: 'd-fatt-scad' },
    { id: 'f-rev1', document_id: 'd-fatt-rev', storage_path: 'finta/fatt-p1.svg', page_order: 1, mime_type: 'image/svg+xml' },
    { id: 'f-rev2', document_id: 'd-fatt-rev', storage_path: 'finta/fatt-p2.svg', page_order: 2, mime_type: 'image/svg+xml' },
    { id: 'f-scarto', document_id: 'd-scarto' },
    { id: 'f-err', document_id: 'd-errore' },
    // d-rev SENZA fotografia
  ],
}

export const DATI_FINTI: DatiSpese = costruisciDatiSpese(TABELLE_FINTE, OGGI_FINTO)

// mese "vuoto": stesse tabelle di contorno, nessuna spesa né documento
export const DATI_QUASI_VUOTI: DatiSpese = costruisciDatiSpese({
  ...TABELLE_FINTE, documenti: [], ponte: [], spese: [], righe: [], ricevute: [],
  bozze: [], righeBozza: [], budget: [],
}, '2026-09-02')
