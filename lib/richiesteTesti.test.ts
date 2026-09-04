// Testi DEFINITIVI delle proposte (pezzo 11, bloccati da Ania il 04/09/2026):
// confronto su stringa intera per ogni caso, condizione e variante.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generaProposta, dalAl, dalAlBreve, elencoDate, notteDel, conPreposizione, formattaEuro, percentuale, prezzo, centesimi,
  descrizioneBreve, tipoCamera, rigaLinkCamera, dettaglioParlato, fraseLettoInPiu, fraseTreOre, camereDelCasoA, condizioneDaColonne, nottiScoperte, FIRMA, CHIUSURA,
} from './richiesteTesti.ts'
import { proponiSoluzioni, segmento, alternativaAmelia, conPrezziNotti, type Soluzione } from './richiesteProposta.ts'
import { soluzioneDaComposizione } from './richiesteComposizione.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const LENA = { id: LENA_ID, name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]
const sol = (caso: Soluzione['caso'], segmenti: Soluzione['segmenti'], nottiMancanti: string[] = []): Soluzione => ({
  caso, segmenti, nottiTotali: segmenti.reduce((s, x) => s + x.notti, 0) + nottiMancanti.length, nottiCoperte: segmenti.reduce((s, x) => s + x.notti, 0), nottiMancanti,
  prezzoTotale: segmenti.reduce((s, x) => s + x.totale, 0),
})
const ARRIVO = { tipo: 'arrivo' } as const
const apertura = (nome: string) => `Gentile ${nome},\ngrazie per aver pensato a Casa Ania per il suo soggiorno.`
const LINK = (slug: string) => `Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/${slug}`
const LINK_CAMERE = 'Qui può vedere le foto e i dettagli delle camere: casaaniarozzano.it/camere'
const COND_ARRIVO = "Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo."
const ORE = (cosa: string) => `Se desidera ${cosa}, la prego di farmelo sapere entro 3 ore da questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.`
const CODA = (cosa: string) => `${COND_ARRIVO}\n\n${ORE(cosa)}\n\n${CHIUSURA}`
const R = { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', persone: 1, camera_id: null }
const R17 = { nome: 'Candida', arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: [2, 3, 3, 3] }

test('costanti: chiusura, descrizioni brevi e tipi, link, frase delle 3 ore', () => {
  assert.equal(CHIUSURA, 'Resto a disposizione per qualsiasi informazione.\n\nGrazie mille,\nAnia – Casa Ania')
  assert.equal(FIRMA, 'Grazie mille,\nAnia – Casa Ania')
  assert.equal(descrizioneBreve(AMELIA), 'una camera singola con il bagno in camera')
  assert.equal(descrizioneBreve(AMBRA), 'una camera matrimoniale con il bagno in camera')
  assert.equal(descrizioneBreve(ALLEGRA), 'una camera matrimoniale con il balconcino e il bagno in camera')
  assert.equal(descrizioneBreve(LENA), 'una camera tripla con il bagno privato appena fuori dalla porta, chiuso a chiave')
  assert.equal(tipoCamera(AMELIA), 'una singola'); assert.equal(tipoCamera(AMBRA), 'una matrimoniale'); assert.equal(tipoCamera(ALLEGRA), 'una matrimoniale')
  assert.equal(tipoCamera(LENA), 'una tripla con il bagno privato appena fuori dalla porta, chiuso a chiave')
  assert.equal(rigaLinkCamera(AMELIA), LINK('singola')); assert.equal(rigaLinkCamera(LENA), LINK('lena')); assert.equal(rigaLinkCamera({ name: 'Camera 1' }), null)
  assert.equal(fraseTreOre('camera'), ORE('confermare la camera'))
  assert.equal(fraseTreOre('camere'), ORE('confermare una delle camere'))
  assert.equal(fraseTreOre('nessuna'), ORE('confermare'))
})

test('date con l\'elisione (1, 8, 11, 18, 28, 31), mesi diversi, «la notte del», righe brevi', () => {
  assert.equal(dalAl('2026-09-17', '2026-09-21'), 'dal 17 al 21 settembre')
  assert.equal(dalAl('2026-09-04', '2026-09-08'), "dal 4 all'8 settembre")
  assert.equal(dalAl('2026-10-10', '2026-10-11'), "dal 10 all'11 ottobre")
  assert.equal(dalAl('2026-09-08', '2026-09-10'), "dall'8 al 10 settembre")
  assert.equal(dalAl('2026-09-30', '2026-10-02'), 'dal 30 settembre al 2 ottobre')
  assert.equal(dalAl('2026-12-30', '2027-01-02'), 'dal 30 dicembre 2026 al 2 gennaio 2027')
  for (const [g, atteso] of [[1, "all'1"], [8, "all'8"], [11, "all'11"], [18, "all'18"], [28, "all'28"], [31, 'al 31'], [3, 'al 3'], [15, 'al 15']] as [number, string][]) {
    assert.equal(conPreposizione('al', g), atteso)
  }
  assert.equal(conPreposizione('del', 8), "dell'8"); assert.equal(conPreposizione('il', 14), 'il 14')
  assert.equal(notteDel(['2026-09-18']), "la notte dell'18 settembre")
  assert.equal(notteDel(['2026-09-19', '2026-09-20']), 'le notti del 19 e 20 settembre')
  assert.equal(notteDel(['2026-09-30', '2026-10-01']), 'le notti del 30 settembre e 1 ottobre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15', '2026-09-16']), '14, 15 e 16 settembre')
  const periodo = { arrivo: '2026-09-17', partenza: '2026-09-21' }
  assert.equal(dalAlBreve('2026-09-17', '2026-09-18', periodo), "dal 17 all'18")
  assert.equal(dalAlBreve('2026-09-30', '2026-10-01', { arrivo: '2026-09-29', partenza: '2026-10-02' }), "dal 30 settembre all'1 ottobre")
})

test('importi: centesimi interi, «350 €», «72,50 €», «1.234,50 €»; percentuale al decimo', () => {
  assert.equal(formattaEuro(35000), '350 €'); assert.equal(formattaEuro(7250), '72,50 €'); assert.equal(formattaEuro(123450), '1.234,50 €')
  assert.equal(formattaEuro(5), '0,05 €'); assert.equal(formattaEuro(-1050), '-10,50 €')
  assert.equal(centesimi('72.5'), 7250); assert.equal(centesimi(0.1 + 0.2), 30); assert.equal(centesimi(null), 0)
  assert.equal(prezzo(140.5), '140,50')
  assert.equal(percentuale(7000, 14000), '50'); assert.equal(percentuale(5000, 14000), '35,7'); assert.equal(percentuale(1, 0), '0')
})

test('ESEMPIO ESATTO di Ania: caso A una camera, persone 2,3,3,3 in Ambra, all\'arrivo', () => {
  const s = proponiSoluzioni(R17, [AMBRA], [])[0]
  assert.equal(generaProposta({ richiesta: R17, soluzione: s, condizione: ARRIVO }), `Gentile Candida,
grazie per aver pensato a Casa Ania per il suo soggiorno.

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre è disponibile soltanto Ambra, una camera matrimoniale con il bagno in camera. Per le notti in cui sarete in tre posso aggiungere un letto in più.

Il prezzo per le 4 notti è di 350 €. La prima notte in due a 80 €, le altre tre notti in tre a 90 € a notte.

Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/ambra

Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.

Se desidera confermare la camera, la prego di farmelo sapere entro 3 ore da questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.

Resto a disposizione per qualsiasi informazione.

Grazie mille,
Ania – Casa Ania`)
})

test('caso A una camera, persone fisse: «, a 70 € a notte» attaccato; senza condizione il testo si ferma dopo il link', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: ARRIVO }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Dal 13 al 15 settembre è disponibile soltanto Amelia, una camera singola con il bagno in camera.

Il prezzo per le 2 notti è di 140 €, a 70 € a notte.

${LINK('singola')}

${CODA('confermare la camera')}`)
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: null }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Dal 13 al 15 settembre è disponibile soltanto Amelia, una camera singola con il bagno in camera.

Il prezzo per le 2 notti è di 140 €, a 70 € a notte.

${LINK('singola')}`)
})

test('caso A: letto in più una notte sola (la prima / l\'ultima / in mezzo), tutte le notti tranne la prima, dettaglio parlato', () => {
  const prima = proponiSoluzioni({ ...R17, persone_per_notte: [2, 1, 1, 1] }, [AMELIA], [])[0]
  assert.equal(fraseLettoInPiu(prima.segmenti[0]), 'Per la prima notte, in cui sarete in due, posso aggiungere un letto in più.')
  assert.equal(generaProposta({ richiesta: { ...R17, persone_per_notte: [2, 1, 1, 1] }, soluzione: prima, condizione: null }), `${apertura('Candida')}

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre è disponibile soltanto Amelia, una camera singola con il bagno in camera. Per la prima notte, in cui sarete in due, posso aggiungere un letto in più.

Il prezzo per le 4 notti è di 285 €. La prima notte in due a 75 €, le altre tre notti in una a 70 € a notte.

${LINK('singola')}`)
  const ultima = proponiSoluzioni({ ...R17, persone_per_notte: [1, 1, 1, 2] }, [AMELIA], [])[0]
  assert.equal(fraseLettoInPiu(ultima.segmenti[0]), "Per l'ultima notte, in cui sarete in due, posso aggiungere un letto in più.")
  assert.equal(dettaglioParlato(ultima.segmenti[0], R17), "Le prime tre notti in una a 70 €, l'ultima notte in due a 75 € a notte.")
  const mezzo = proponiSoluzioni({ ...R17, persone_per_notte: [1, 2, 1, 1] }, [AMELIA], [])[0]
  assert.equal(fraseLettoInPiu(mezzo.segmenti[0]), "Per la notte dell'18 settembre, in cui sarete in due, posso aggiungere un letto in più.")
  assert.equal(dettaglioParlato(mezzo.segmenti[0], R17), 'La prima notte in una a 70 €, la notte seguente in due a 75 €, le ultime due notti in una a 70 € a notte.')
  const quattro = proponiSoluzioni({ ...R17, persone_per_notte: [2, 1, 2, 1] }, [AMELIA], [])[0]
  assert.equal(dettaglioParlato(quattro.segmenti[0], R17), "Dal 17 all'18 in due a 75 €, dall'18 al 19 in una a 70 €, dal 19 al 20 in due a 75 €, dal 20 al 21 in una a 70 € a notte.")
  // letto in più tutte le notti tranne la prima (2,3,3,3 in Ambra)
  assert.equal(fraseLettoInPiu(proponiSoluzioni(R17, [AMBRA], [])[0].segmenti[0]), 'Per le notti in cui sarete in tre posso aggiungere un letto in più.')
  assert.equal(fraseLettoInPiu(segmento(AMELIA, '2026-09-17', '2026-09-21', 1)), null)
  assert.equal(dettaglioParlato(segmento(AMELIA, '2026-09-17', '2026-09-21', 1), R17), null)
})

test('caso A due camere e tre camere: elenco con trattino, riga vuota fra le camere, «una delle camere»', () => {
  const r = { ...R, arrivo: '2026-09-17', partenza: '2026-09-21' }
  const due = proponiSoluzioni(r, [AMELIA, AMBRA], [])
  assert.deepEqual(camereDelCasoA(due[0], due).map(s => s.segmenti[0].camera.name), ['Amelia', 'Ambra'])
  assert.equal(generaProposta({ richiesta: r, soluzione: due[0], condizione: ARRIVO, alternative: due }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre ho due camere libere che posso proporle:

– Amelia, una camera singola con il bagno in camera. Il prezzo per le 4 notti è di 280 €, a 70 € a notte.
${LINK('singola')}

– Ambra, una camera matrimoniale con il bagno in camera. Il prezzo per le 4 notti è di 320 €, a 80 € a notte.
${LINK('ambra')}

${CODA('confermare una delle camere')}`)
  const tre = proponiSoluzioni(r, [AMELIA, ALLEGRA, AMBRA], [])
  assert.equal(generaProposta({ richiesta: r, soluzione: tre[0], condizione: null, alternative: tre }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre ho tre camere libere che posso proporle:

– Amelia, una camera singola con il bagno in camera. Il prezzo per le 4 notti è di 280 €, a 70 € a notte.
${LINK('singola')}

– Allegra, una camera matrimoniale con il balconcino e il bagno in camera. Il prezzo per le 4 notti è di 320 €, a 80 € a notte.
${LINK('allegra')}

– Ambra, una camera matrimoniale con il bagno in camera. Il prezzo per le 4 notti è di 320 €, a 80 € a notte.
${LINK('ambra')}`)
  const var2 = proponiSoluzioni(R17, [AMBRA, ALLEGRA], [])
  assert.match(generaProposta({ richiesta: R17, soluzione: var2[0], condizione: null, alternative: var2 }),
    /– Ambra, una camera matrimoniale con il bagno in camera\. Per le notti in cui sarete in tre posso aggiungere un letto in più\. Il prezzo per le 4 notti è di 350 €\. La prima notte in due a 80 €, le altre tre notti in tre a 90 € a notte\.\n/)
})

test('caso B un cambio: Amelia la prima notte, Ambra le altre (persone 2,3,3,3)', () => {
  const s = soluzioneDaComposizione(R17, CAMERE, ['amelia', 'ambra', 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: R17, soluzione: s, condizione: ARRIVO }), `${apertura('Candida')}

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre non ho una camera libera per tutto il periodo, ma posso ospitarla comunque con un cambio di camera durante il soggiorno:

– dal 17 all'18 in Amelia, una singola, con un letto in più: 75 € a notte

– dall'18 al 21 in Ambra, una matrimoniale, con un letto in più: 90 € a notte

Il cambio di camera lo faccio io al mattino, non deve pensare a nulla. Il prezzo per le 4 notti è di 345 €.

${LINK_CAMERE}

${CODA('confermare')}`)
})

test('caso B due cambi con Lena (eccezione del bagno) e «qualche cambio di camera»', () => {
  const s = soluzioneDaComposizione(R17, CAMERE, ['amelia', 'ambra', 'ambra', LENA_ID])
  assert.equal(generaProposta({ richiesta: R17, soluzione: s, condizione: null }), `${apertura('Candida')}

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre non ho una camera libera per tutto il periodo, ma posso ospitarla comunque con qualche cambio di camera durante il soggiorno:

– dal 17 all'18 in Amelia, una singola, con un letto in più: 75 € a notte

– dall'18 al 20 in Ambra, una matrimoniale, con un letto in più: 90 € a notte

– dal 20 al 21 in Lena, una tripla con il bagno privato appena fuori dalla porta, chiuso a chiave: 90 € a notte

Il cambio di camera lo faccio io al mattino, non deve pensare a nulla. Il prezzo per le 4 notti è di 345 €.

${LINK_CAMERE}`)
})

test('caso B con persone variabili in un segmento: «in tre a 90 € a notte, poi in due a 80 € a notte»', () => {
  const r = { ...R17, persone_per_notte: [2, 3, 3, 2] }
  const s = soluzioneDaComposizione(r, CAMERE, ['amelia', 'ambra', 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: r, soluzione: s, condizione: null }), `${apertura('Candida')}

Ho verificato le date che mi ha indicato. Dal 17 al 21 settembre non ho una camera libera per tutto il periodo, ma posso ospitarla comunque con un cambio di camera durante il soggiorno:

– dal 17 all'18 in Amelia, una singola, con un letto in più: 75 € a notte

– dall'18 al 21 in Ambra, una matrimoniale, con un letto in più: in tre a 90 € a notte, poi in due a 80 € a notte

Il cambio di camera lo faccio io al mattino, non deve pensare a nulla. Il prezzo per le 4 notti è di 335 €.

${LINK_CAMERE}`)
})

test('caso C notte in mezzo, stessa camera: una riga sola con «e»', () => {
  const r = { ...R, arrivo: '2026-09-17', partenza: '2026-09-21' }
  const s = soluzioneDaComposizione(r, CAMERE, ['ambra', null, 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: r, soluzione: s, condizione: ARRIVO }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Purtroppo per la notte dell'18 settembre siamo al completo, ma posso ospitarla per il resto del soggiorno:

– dal 17 all'18 e dal 19 al 21 in Ambra, una matrimoniale: 80 € a notte

Mi dispiace per la notte dell'18 settembre, per la quale dovrebbe trovare un'altra soluzione nelle vicinanze. Sarei comunque felice di ospitarla per le altre 3 notti, al prezzo di 240 €.

${LINK('ambra')}

${CODA('confermare')}`)
  assert.deepEqual(nottiScoperte(r, s), ['2026-09-18'])
})

test('caso C notte all\'inizio e due notti alla fine (plurale, «per le quali»); ricerca automatica (caso D interno) con lo stesso modello', () => {
  const r = { ...R, arrivo: '2026-09-17', partenza: '2026-09-21' }
  const inizio = soluzioneDaComposizione(r, CAMERE, [null, 'ambra', 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: r, soluzione: inizio, condizione: null }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Purtroppo per la notte del 17 settembre siamo al completo, ma posso ospitarla per il resto del soggiorno:

– dall'18 al 21 in Ambra, una matrimoniale: 80 € a notte

Mi dispiace per la notte del 17 settembre, per la quale dovrebbe trovare un'altra soluzione nelle vicinanze. Sarei comunque felice di ospitarla per le altre 3 notti, al prezzo di 240 €.

${LINK('ambra')}`)
  const fine = soluzioneDaComposizione(r, CAMERE, ['ambra', 'ambra', null, null])
  assert.equal(generaProposta({ richiesta: r, soluzione: fine, condizione: null }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Purtroppo per le notti del 19 e 20 settembre siamo al completo, ma posso ospitarla per il resto del soggiorno:

– dal 17 al 19 in Ambra, una matrimoniale: 80 € a notte

Mi dispiace per le notti del 19 e 20 settembre, per le quali dovrebbe trovare un'altra soluzione nelle vicinanze. Sarei comunque felice di ospitarla per le altre 2 notti, al prezzo di 160 €.

${LINK('ambra')}`)
  const occ = [
    { room_id: 'lena', check_in: '2026-09-02', check_out: '2026-09-04', status: 'confermata' },
    { room_id: 'ambra', check_in: '2026-09-01', check_out: '2026-09-07', status: 'confermata' },
    { room_id: 'allegra', check_in: '2026-09-01', check_out: '2026-09-04', status: 'confermata' },
    { room_id: 'amelia', check_in: '2026-09-01', check_out: '2026-09-03', status: 'confermata' },
  ]
  const r2 = { nome: 'Anna', arrivo: '2026-09-02', partenza: '2026-09-05', persone: 1, camera_id: null }
  const [best] = proponiSoluzioni(r2, [AMELIA, ALLEGRA, AMBRA, { ...LENA, id: 'lena' }], occ)
  assert.equal(best.caso, 'manca_estremo')
  assert.match(generaProposta({ richiesta: r2, soluzione: best, condizione: null }), /Purtroppo per la notte del 2 settembre siamo al completo[\s\S]*– dal 3 al 5 in Amelia, una singola: 70 € a notte[\s\S]*per le altre 2 notti, al prezzo di 140 €\./)
})

test('caso C con cambio camera: righe separate, «Il cambio di camera lo faccio io», link delle camere', () => {
  const r = { ...R, arrivo: '2026-09-17', partenza: '2026-09-21' }
  const s = soluzioneDaComposizione(r, CAMERE, ['amelia', null, 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: r, soluzione: s, condizione: null }), `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Purtroppo per la notte dell'18 settembre siamo al completo, ma posso ospitarla per il resto del soggiorno:

– dal 17 all'18 in Amelia, una singola: 70 € a notte

– dal 19 al 21 in Ambra, una matrimoniale: 80 € a notte

Il cambio di camera lo faccio io al mattino, non deve pensare a nulla.

Mi dispiace per la notte dell'18 settembre, per la quale dovrebbe trovare un'altra soluzione nelle vicinanze. Sarei comunque felice di ospitarla per le altre 3 notti, al prezzo di 230 €.

${LINK_CAMERE}`)
})

test('caso E: messaggio intero, senza condizione né 3 ore', () => {
  const s = sol('completo', [], ['2026-09-13', '2026-09-14'])
  const atteso = `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Purtroppo dal 13 al 15 settembre siamo al completo e non ho una soluzione da poterle proporre.

Mi dispiace davvero. Spero di poterla accogliere in un'altra occasione.

Grazie mille,
Ania – Casa Ania`
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: null }), atteso)
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: ARRIVO }), atteso)
})

test('condizione 2 (caparra 50% e importo di Ania), 3 (pagamento completo), 4 (personalizzata), con 3 ore e chiusura', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])   // 140 €
  const testa = `${apertura('Anna')}

Ho verificato le date che mi ha indicato. Dal 13 al 15 settembre è disponibile soltanto Amelia, una camera singola con il bagno in camera.

Il prezzo per le 2 notti è di 140 €, a 70 € a notte.

${LINK('singola')}`
  const caparra = (importo: string, perc: string) => `Per confermare la prenotazione le chiedo una caparra di ${importo}, pari al ${perc}% del totale, da versare con bonifico. Dopo la sua risposta le invierò i dati per il bonifico e terrò la camera a sua disposizione per 24 ore. Il saldo si paga all'arrivo, alla consegna delle chiavi, in contanti oppure con bonifico istantaneo.

In caso di cancellazione o cambio di date, la prego di avvisarmi almeno 7 giorni prima dell'arrivo. Con un preavviso inferiore, o in caso di mancato arrivo, la caparra verrà trattenuta.

La prenotazione sarà confermata definitivamente al ricevimento della caparra.`
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 7000 } }), `${testa}

${caparra('70 €', '50')}

${ORE('confermare la camera')}

${CHIUSURA}`)
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 5000 } }), `${testa}

${caparra('50 €', '35,7')}

${ORE('confermare la camera')}

${CHIUSURA}`)
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'completo' } }), `${testa}

Per confermare la prenotazione le chiedo il pagamento anticipato dell'intero soggiorno, 140 €, con bonifico. Dopo la sua risposta le invierò i dati per il bonifico e terrò la camera a sua disposizione per 24 ore.

In caso di cancellazione con almeno 7 giorni di preavviso le restituisco l'intero importo. Con un preavviso inferiore, o in caso di mancato arrivo, l'importo non viene restituito. Se invece ha bisogno di spostare le date, la prenotazione si può trasferire a un altro periodo, in base alla disponibilità.

La prenotazione sarà confermata definitivamente al ricevimento del pagamento.

${ORE('confermare la camera')}

${CHIUSURA}`)
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'personalizzata', testo: '  Ci accordiamo a voce.  ' } }), `${testa}

Ci accordiamo a voce.

${ORE('confermare la camera')}

${CHIUSURA}`)
})

test('mesi diversi, notte singola, importi con decimali (prezzo a mano)', () => {
  const mesi = sol('completa', [segmento(AMBRA, '2026-09-30', '2026-10-02', 2)])
  assert.match(generaProposta({ richiesta: { ...R, arrivo: '2026-09-30', partenza: '2026-10-02', persone: 2 }, soluzione: mesi, condizione: null }),
    /Dal 30 settembre al 2 ottobre è disponibile soltanto Ambra, una camera matrimoniale con il bagno in camera\.\n\nIl prezzo per le 2 notti è di 160 €, a 80 € a notte\./)
  const una = sol('completa', [segmento(LENA, '2026-09-13', '2026-09-14', 3)])
  assert.match(generaProposta({ richiesta: { ...R, partenza: '2026-09-14', persone: 3 }, soluzione: una, condizione: null }),
    /Dal 13 al 14 settembre è disponibile soltanto Lena, una camera tripla con il bagno privato appena fuori dalla porta, chiuso a chiave\.\n\nIl prezzo per la notte è di 90 €\.\n\n/)
  const decimali = sol('completa', [conPrezziNotti(segmento(AMBRA, '2026-09-13', '2026-09-15', 2), [7250, 7250], true)])
  assert.match(generaProposta({ richiesta: { ...R, persone: 2 }, soluzione: decimali, condizione: null }), /Il prezzo per le 2 notti è di 145 €, a 72,50 € a notte\./)
  const misto = sol('completa', [conPrezziNotti(segmento(AMBRA, '2026-09-13', '2026-09-15', 2), [7250, 8000], true)])
  assert.match(generaProposta({ richiesta: { ...R, persone: 2 }, soluzione: misto, condizione: null }), /Il prezzo per le 2 notti è di 152,50 €\. La prima notte in due a 72,50 €, l'ultima notte in due a 80 € a notte\./)
})

test('condizione dalle colonne salvate', () => {
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'caparra', caparra_centesimi: 7000 }), { tipo: 'caparra', caparraCentesimi: 7000 })
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'personalizzata', condizione_testo: 'x' }), { tipo: 'personalizzata', testo: 'x' })
  assert.deepEqual(condizioneDaColonne({ condizione_pagamento: 'arrivo' }), { tipo: 'arrivo' })
  assert.equal(condizioneDaColonne({}), null)
})

test('regole di stile: mai il tu, mai «terzo/secondo letto» o «branda», mai «la camera Ambra»', () => {
  const testi = [
    generaProposta({ richiesta: R17, soluzione: proponiSoluzioni(R17, [AMBRA], [])[0], condizione: { tipo: 'caparra', caparraCentesimi: 17500 } }),
    generaProposta({ richiesta: R17, soluzione: soluzioneDaComposizione(R17, CAMERE, ['amelia', 'ambra', 'ambra', LENA_ID]), condizione: { tipo: 'completo' } }),
    generaProposta({ richiesta: R17, soluzione: soluzioneDaComposizione(R17, CAMERE, ['amelia', null, 'ambra', 'ambra']), condizione: ARRIVO }),
  ]
  for (const t of testi) assert.doesNotMatch(t, /\bti\b|\btuo\b|proporti|ospitarti|terzo letto|secondo letto|branda|la camera (Ambra|Amelia|Lena|Allegra)/)
  assert.ok(alternativaAmelia)
})
