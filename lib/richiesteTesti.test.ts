import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generaProposta, dalAl, elencoDate, formattaEuro, percentuale, prezzo, centesimi, centesimiNotte, descrizioneCamera, nottiScoperte, condizioneDaColonne, FIRMA,
} from './richiesteTesti.ts'
import { proponiSoluzioni, segmento, alternativaAmelia, type Soluzione } from './richiesteProposta.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const LENA = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]
const R = { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', persone: 1, camera_id: null }
const APERTURA = 'Gentile Anna, grazie per aver pensato a Casa Ania per il suo soggiorno. Ho appena verificato la disponibilità per le date che mi ha indicato e posso proporle questa soluzione:'
const AMELIA_DESC = "singola con bagno privato, all'interno della camera"
const ALLEGRA_DESC = "matrimoniale con balconcino e bagno privato, all'interno della camera"
const sol = (caso: Soluzione['caso'], segmenti: Soluzione['segmenti'], nottiMancanti: string[] = []): Soluzione => ({
  caso, segmenti, nottiTotali: segmenti.reduce((s, x) => s + x.notti, 0) + nottiMancanti.length, nottiCoperte: segmenti.reduce((s, x) => s + x.notti, 0), nottiMancanti,
  prezzoTotale: segmenti.reduce((s, x) => s + x.totale, 0),
})
const ARRIVO = { tipo: 'arrivo' } as const

const COND_ARRIVO = `Il pagamento potrà essere effettuato all'arrivo, in contanti oppure tramite bonifico istantaneo.

Se questa soluzione può andare bene per Lei, mi faccia sapere entro 3 ore dalla ricezione di questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.

La camera sarà riservata soltanto dopo la conferma definitiva della prenotazione.

Resto a disposizione per qualsiasi informazione.

Grazie mille,
Ania – Casa Ania`

test('date in italiano', () => {
  assert.equal(dalAl('2026-09-13', '2026-09-15'), 'dal 13 al 15 settembre')
  assert.equal(dalAl('2026-09-30', '2026-10-02'), 'dal 30 settembre al 2 ottobre')
  assert.equal(dalAl('2026-12-30', '2027-01-02'), 'dal 30 dicembre 2026 al 2 gennaio 2027')
  assert.equal(elencoDate(['2026-09-14']), '14 settembre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15']), '14 e 15 settembre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15', '2026-09-16']), '14, 15 e 16 settembre')
  assert.equal(elencoDate(['2026-09-30', '2026-10-01']), '30 settembre e 1 ottobre')
})

test('importi: centesimi interi, formato italiano, niente decimali quando sono zero', () => {
  assert.equal(formattaEuro(14000), '140 €')
  assert.equal(formattaEuro(123450), '1.234,50 €')
  assert.equal(formattaEuro(5), '0,05 €')
  assert.equal(formattaEuro(100000000), '1.000.000 €')
  assert.equal(formattaEuro(7250), '72,50 €')
  assert.equal(formattaEuro(-1050), '-10,50 €')
  assert.equal(centesimi(140), 14000)
  assert.equal(centesimi('72.5'), 7250)
  assert.equal(centesimi(0.1 + 0.2), 30)
  assert.equal(centesimi(null), 0)
  assert.equal(prezzo(140), '140')
  assert.equal(prezzo(140.5), '140,50')
  assert.equal(percentuale(7000, 14000), '50')
  assert.equal(percentuale(6000, 15000), '40')
  assert.equal(percentuale(5000, 14500), '34,5')
  assert.equal(percentuale(1, 0), '0')
  // prezzo a notte del segmento con letto aggiuntivo: Amelia 2 persone = 70 + 5
  assert.equal(centesimiNotte(segmento(AMELIA, '2026-09-13', '2026-09-15', 2)), 7500)
  assert.equal(centesimiNotte(segmento(LENA, '2026-09-13', '2026-09-15', 3)), 9000)
})

test('descrizione della camera dai dati: balconcino solo per Allegra, letto solo se addebitato', () => {
  assert.equal(descrizioneCamera(AMELIA, 1), AMELIA_DESC)
  assert.equal(descrizioneCamera(AMELIA, 2), "singola con aggiunta del secondo letto e bagno privato, all'interno della camera")
  assert.equal(descrizioneCamera(ALLEGRA, 2), ALLEGRA_DESC)
  assert.equal(descrizioneCamera(ALLEGRA, 3), "matrimoniale con balconcino, aggiunta del terzo letto e bagno privato, all'interno della camera")
  assert.equal(descrizioneCamera(AMBRA, 2), "matrimoniale con bagno privato, all'interno della camera")
  assert.equal(descrizioneCamera(LENA, 3), 'tripla con bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera')
  assert.equal(descrizioneCamera(LENA, 4), 'tripla con aggiunta del quarto letto e bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera')
})

test('caso A: stessa camera, plurale, condizione 1', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: ARRIVO }), `${APERTURA}

Dal 13 al 15 settembre è disponibile la camera Amelia, ${AMELIA_DESC}. Il prezzo complessivo per 2 notti è di 140 €.

${COND_ARRIVO}`)
})

test('caso A: una notte al singolare; senza condizione il testo si ferma prima della chiusura', () => {
  const s = sol('completa', [segmento(LENA, '2026-09-13', '2026-09-14', 3)])
  assert.equal(generaProposta({ richiesta: { ...R, partenza: '2026-09-14', persone: 3 }, soluzione: s, condizione: null }), `${APERTURA}

Dal 13 al 14 settembre è disponibile la camera Lena, tripla con bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera. Il prezzo complessivo per 1 notte è di 90 €.`)
})

test('caso B: cambio camera, nessun totale unico', () => {
  const s = sol('cambio', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(ALLEGRA, '2026-09-14', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: ARRIVO }), `${APERTURA}

Per tutto il periodo, dal 13 al 15 settembre, posso ospitarla prevedendo un cambio di camera durante il soggiorno:

– dal 13 al 14 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte;

– dal 14 al 15 settembre, nella camera Allegra, ${ALLEGRA_DESC}, al prezzo di 80 € a notte.

${COND_ARRIVO}`)
})

test('caso B con letto aggiuntivo: prezzo a notte letto compreso', () => {
  const s = sol('cambio', [segmento(AMELIA, '2026-09-13', '2026-09-14', 2), segmento(ALLEGRA, '2026-09-14', '2026-09-15', 2)])
  const t = generaProposta({ richiesta: { ...R, persone: 2 }, soluzione: s, condizione: ARRIVO })
  assert.match(t, /– dal 13 al 14 settembre, nella camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera, al prezzo di 75 € a notte;/)
  assert.match(t, /– dal 14 al 15 settembre, nella camera Allegra, matrimoniale con balconcino e bagno privato, all'interno della camera, al prezzo di 80 € a notte\./)
})

const INTESTAZIONE_C = `Per l'intero periodo non ho purtroppo una soluzione continuativa, ma posso ospitarla per la maggior parte del soggiorno.`

test('caso C: notte scoperta in mezzo, stessa camera (senza frase del cambio)', () => {
  const s = sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(AMELIA, '2026-09-15', '2026-09-16', 1)], ['2026-09-14'])
  assert.equal(generaProposta({ richiesta: { ...R, partenza: '2026-09-16' }, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTESTAZIONE_C}

– dal 13 al 14 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte;

– dal 15 al 16 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per la notte non disponibile, cioè il 14 settembre.

${COND_ARRIVO}`)
})

test('caso C con cambio camera e due notti scoperte in mezzo (plurale)', () => {
  const s = sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(ALLEGRA, '2026-09-16', '2026-09-17', 1)], ['2026-09-14', '2026-09-15'])
  assert.equal(generaProposta({ richiesta: { ...R, partenza: '2026-09-17' }, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTESTAZIONE_C}

Per coprire il maggior numero possibile di notti, la soluzione prevede anche un cambio di camera:

– dal 13 al 14 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte;

– dal 16 al 17 settembre, nella camera Allegra, ${ALLEGRA_DESC}, al prezzo di 80 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per le notti non disponibili, cioè il 14 e 15 settembre.

${COND_ARRIVO}`)
})

test('caso C: notte scoperta all\'inizio (un solo segmento)', () => {
  const rich = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16' }
  const s = sol('manca_estremo', [segmento(AMELIA, '2026-09-14', '2026-09-16', 1)], ['2026-09-13'])
  assert.equal(generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTESTAZIONE_C}

– dal 14 al 16 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per la notte non disponibile, cioè il 13 settembre.

${COND_ARRIVO}`)
  assert.deepEqual(nottiScoperte(rich, s), ['2026-09-13'])
})

test('caso C: notte scoperta alla fine', () => {
  const rich = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16' }
  const s = sol('manca_estremo', [segmento(ALLEGRA, '2026-09-13', '2026-09-15', 1)], ['2026-09-15'])
  assert.equal(generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTESTAZIONE_C}

– dal 13 al 15 settembre, nella camera Allegra, ${ALLEGRA_DESC}, al prezzo di 80 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per la notte non disponibile, cioè il 15 settembre.

${COND_ARRIVO}`)
  assert.deepEqual(nottiScoperte(rich, s), ['2026-09-15'])
})

test('caso E: testo completo, nessuna condizione e nessun limite di ore', () => {
  const s = sol('completo', [], ['2026-09-13', '2026-09-14'])
  const atteso = `Gentile Anna, grazie per aver pensato a Casa Ania per il suo soggiorno.

Mi dispiace, ma per le date che mi ha indicato siamo al completo e non ho una soluzione alternativa da poterle proporre.

Spero di poterla accogliere in futuro.

Grazie mille,
Ania – Casa Ania`
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: null }), atteso)
  // Una condizione passata per sbaglio non cambia nulla
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 1 } }), atteso)
  assert.doesNotMatch(atteso, /3 ore/)
})

test('condizione 2: caparra 50% e importo personalizzato con percentuale ricalcolata', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])   // 140 €
  const base = `${APERTURA}

Dal 13 al 15 settembre è disponibile la camera Amelia, ${AMELIA_DESC}. Il prezzo complessivo per 2 notti è di 140 €.

Se desidera accettare questa proposta, le chiedo di farmelo sapere entro 3 ore dalla ricezione del messaggio.

Dopo la sua risposta le invierò il riepilogo della prenotazione con i dati per effettuare il versamento della caparra confirmatoria di [CAPARRA], e terrò la camera a sua disposizione per 24 ore, in attesa del bonifico. Il restante importo potrà essere saldato all'arrivo, in contanti oppure tramite bonifico istantaneo.

In caso di cancellazione o richiesta di modifica delle date, le chiedo di avvisarmi almeno 7 giorni prima dell'orario previsto di arrivo. Con un preavviso inferiore, oppure in caso di mancato arrivo, la caparra confirmatoria verrà trattenuta e non potrà essere trasferita a un soggiorno successivo.

La prenotazione sarà confermata definitivamente al ricevimento della caparra.

Grazie mille,
Ania – Casa Ania`
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 7000 } }),
    base.replace('[CAPARRA]', "70 €, pari al 50% dell'importo complessivo"))
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 5000 } }),
    base.replace('[CAPARRA]', "50 €, pari al 35,7% dell'importo complessivo"))
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 3550 } }),
    base.replace('[CAPARRA]', "35,50 €, pari al 25,4% dell'importo complessivo"))
})

test('condizione 3: pagamento completo anticipato', () => {
  const s = sol('completa', [segmento(ALLEGRA, '2026-09-13', '2026-09-15', 2)])   // 160 €
  assert.equal(generaProposta({ richiesta: { ...R, persone: 2 }, soluzione: s, condizione: { tipo: 'completo' } }), `${APERTURA}

Dal 13 al 15 settembre è disponibile la camera Allegra, ${ALLEGRA_DESC}. Il prezzo complessivo per 2 notti è di 160 €.

Se desidera accettare questa proposta, le chiedo di farmelo sapere entro 3 ore dalla ricezione del messaggio.

Dopo la sua risposta le invierò i dati per effettuare il pagamento anticipato dell'intero soggiorno, pari a 160 €, e terrò la camera a sua disposizione per 24 ore, in attesa del bonifico.

La prenotazione sarà confermata definitivamente al ricevimento del pagamento.

Grazie mille,
Ania – Casa Ania`)
})

test('condizione 4: personalizzata, solo la chiusura viene aggiunta', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'personalizzata', testo: '  Il pagamento lo concordiamo a voce, come d\'accordo al telefono.  ' } }), `${APERTURA}

Dal 13 al 15 settembre è disponibile la camera Amelia, ${AMELIA_DESC}. Il prezzo complessivo per 2 notti è di 140 €.

Il pagamento lo concordiamo a voce, come d'accordo al telefono.

${FIRMA}`)
})

test('alternativa Amelia: attiva e non attiva, con la differenza reale dalle tariffe', () => {
  const rich = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16', persone: 1 }
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-16', 1)])   // 210 €
  const amelia = alternativaAmelia(rich, s, CAMERE, [])
  assert.ok(amelia)
  assert.equal(amelia.camera.name, 'Allegra')
  assert.equal(amelia.differenzaNotteCentesimi, 1000)
  assert.equal(amelia.prezzoTotaleCentesimi, 24000)
  const senza = generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO, amelia: null })
  const con = generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO, amelia })
  assert.equal(senza, `${APERTURA}

Dal 13 al 16 settembre è disponibile la camera Amelia, ${AMELIA_DESC}. Il prezzo complessivo per 3 notti è di 210 €.

${COND_ARRIVO}`)
  assert.equal(con, `${APERTURA}

Dal 13 al 16 settembre è disponibile la camera Amelia, ${AMELIA_DESC}. Il prezzo complessivo per 3 notti è di 210 €.

Visto che si tratta di un soggiorno di 3 notti, ci tengo però a indicarle anche un'alternativa. Amelia è la nostra camera più piccola e, per una permanenza più lunga, potrebbe risultare meno comoda. Con 10 € in più a notte posso invece proporle la camera Allegra, una camera matrimoniale più spaziosa. Il prezzo complessivo sarebbe di 240 €.

${COND_ARRIVO}`)
})

test('alternativa Amelia: condizioni non soddisfatte → nessun blocco', () => {
  const occ = (room_id: string, check_in: string, check_out: string) => ({ room_id, check_in, check_out, status: 'confermata' })
  const rich3 = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16', persone: 1 }
  const s3 = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-16', 1)])
  // meno di 3 notti
  assert.equal(alternativaAmelia(R, sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)]), CAMERE, []), null)
  // non è Amelia
  assert.equal(alternativaAmelia(rich3, sol('completa', [segmento(AMBRA, '2026-09-13', '2026-09-16', 1)]), CAMERE, []), null)
  // Allegra occupata una notte → si passa ad Ambra
  assert.equal(alternativaAmelia(rich3, s3, CAMERE, [occ('allegra', '2026-09-14', '2026-09-15')])?.camera.name, 'Ambra')
  // Allegra e Ambra occupate → niente
  assert.equal(alternativaAmelia(rich3, s3, CAMERE, [occ('allegra', '2026-09-10', '2026-09-20'), occ('ambra', '2026-09-15', '2026-09-16')]), null)
  // in attesa / annullata non occupano
  assert.equal(alternativaAmelia(rich3, s3, CAMERE, [{ ...occ('allegra', '2026-09-10', '2026-09-20'), status: 'in_attesa' }])?.camera.name, 'Allegra')
  // due segmenti (cambio o parziale): scelta prudente, nessuna alternativa
  assert.equal(alternativaAmelia(rich3, sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(AMELIA, '2026-09-15', '2026-09-16', 1)], ['2026-09-14']), CAMERE, []), null)
  // 2 persone: Amelia 75 a notte con il secondo letto, Allegra 80 → 5 € in più
  const rich2 = { ...rich3, persone: 2 }
  const a2 = alternativaAmelia(rich2, sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-16', 2)]), CAMERE, [])
  assert.equal(a2?.differenzaNotteCentesimi, 500)
  assert.equal(a2?.prezzoTotaleCentesimi, 24000)
})

test('condizione dalle colonne salvate', () => {
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'caparra', caparra_centesimi: 7000 }), { tipo: 'caparra', caparraCentesimi: 7000 })
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'personalizzata', condizione_testo: 'x' }), { tipo: 'personalizzata', testo: 'x' })
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'arrivo' }), { tipo: 'arrivo' })
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'completo' }), { tipo: 'completo' })
  assert.equal(condizioneDaColonne({ condizione_pagamento: null }), null)
  assert.equal(condizioneDaColonne({}), null)
})

test('dalla ricerca alla proposta: caso reale di Sawicka 2–5 settembre', () => {
  const occ = [
    { room_id: 'lena', check_in: '2026-09-02', check_out: '2026-09-04', status: 'confermata' },
    { room_id: 'ambra', check_in: '2026-09-01', check_out: '2026-09-07', status: 'confermata' },
    { room_id: 'allegra', check_in: '2026-09-01', check_out: '2026-09-03', status: 'confermata' },
    { room_id: 'allegra', check_in: '2026-09-03', check_out: '2026-09-04', status: 'confermata' },
    { room_id: 'amelia', check_in: '2026-09-01', check_out: '2026-09-03', status: 'confermata' },
  ]
  const r = { nome: 'Anna', arrivo: '2026-09-02', partenza: '2026-09-05', persone: 1, camera_id: null }
  const [best] = proponiSoluzioni(r, CAMERE, occ)
  assert.equal(best.caso, 'manca_estremo')
  const t = generaProposta({ richiesta: r, soluzione: best, condizione: ARRIVO })
  assert.match(t, /– dal 3 al 5 settembre, nella camera Amelia, singola con bagno privato, all'interno della camera, al prezzo di 70 € a notte\./)
  assert.match(t, /soltanto per la notte non disponibile, cioè il 2 settembre\./)
  assert.doesNotMatch(t, /\bti\b|\btuo\b|proporti|ospitarti/)
})
