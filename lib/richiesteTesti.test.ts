import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  generaProposta, dalAl, elencoDate, elencoDateConArticolo, conPreposizione, formattaEuro, percentuale, prezzo, centesimi, centesimiNotte,
  descrizioneCamera, nottiScoperte, condizioneDaColonne, dettaglioPersone, rigaLinkCamera, camereDelCasoA, FIRMA, INTRO_SOLUZIONE,
} from './richiesteTesti.ts'
import { proponiSoluzioni, segmento, alternativaAmelia, type Soluzione } from './richiesteProposta.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const AMBRA = { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const LENA = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno', active: true }
const CAMERE = [AMELIA, ALLEGRA, AMBRA, LENA]
const R = { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', persone: 1, camera_id: null }
const APERTURA = 'Gentile Anna,\ngrazie per aver pensato a Casa Ania per il suo soggiorno.'
const AMELIA_DESC = "singola con bagno privato, all'interno della camera"
const ALLEGRA_DESC = "matrimoniale con balconcino e bagno privato, all'interno della camera"
const AMBRA_DESC = "matrimoniale con bagno privato, all'interno della camera"
const LINK = (slug: string) => `Qui può vedere le foto e i dettagli della camera: casaaniarozzano.it/camere/${slug}`
const sol = (caso: Soluzione['caso'], segmenti: Soluzione['segmenti'], nottiMancanti: string[] = []): Soluzione => ({
  caso, segmenti, nottiTotali: segmenti.reduce((s, x) => s + x.notti, 0) + nottiMancanti.length, nottiCoperte: segmenti.reduce((s, x) => s + x.notti, 0), nottiMancanti,
  prezzoTotale: segmenti.reduce((s, x) => s + x.totale, 0),
})
const ARRIVO = { tipo: 'arrivo' } as const

const COND_ARRIVO = `Il pagamento avviene all'arrivo, alla consegna delle chiavi, per l'intero soggiorno: in contanti oppure con bonifico istantaneo.

Se desidera confermare la camera, la prego di farmelo sapere entro 3 ore da questo messaggio. Trascorso questo tempo, dovrò verificare nuovamente la disponibilità.

Resto a disposizione per qualsiasi informazione.

Grazie mille,
Ania – Casa Ania`
const COND_ARRIVO_PIU = COND_ARRIVO.replace('confermare la camera', 'confermare una delle camere')

test('date in italiano con l\'elisione: 1, 8, 11, 18, 28 con l\'apostrofo; 3, 15, 31 no', () => {
  assert.equal(dalAl('2026-09-13', '2026-09-15'), 'dal 13 al 15 settembre')
  assert.equal(dalAl('2026-09-04', '2026-09-08'), "dal 4 all'8 settembre")
  assert.equal(dalAl('2026-10-10', '2026-10-11'), "dal 10 all'11 ottobre")
  assert.equal(dalAl('2026-09-08', '2026-09-10'), "dall'8 al 10 settembre")
  assert.equal(dalAl('2026-09-15', '2026-09-18'), "dal 15 all'18 settembre")
  assert.equal(dalAl('2026-09-26', '2026-09-28'), "dal 26 al 28 settembre".replace('al 28', "all'28"))
  assert.equal(dalAl('2026-09-29', '2026-10-01'), "dal 29 settembre all'1 ottobre")
  assert.equal(dalAl('2026-10-28', '2026-10-31'), "dall'28 al 31 ottobre")
  assert.equal(dalAl('2026-09-30', '2026-10-03'), 'dal 30 settembre al 3 ottobre')
  assert.equal(dalAl('2026-12-30', '2027-01-02'), 'dal 30 dicembre 2026 al 2 gennaio 2027')
  assert.equal(dalAl('2026-12-31', '2027-01-08'), "dal 31 dicembre 2026 all'8 gennaio 2027")
  for (const [g, atteso] of [[1, "all'1"], [8, "all'8"], [11, "all'11"], [18, "all'18"], [28, "all'28"], [31, 'al 31'], [3, 'al 3'], [15, 'al 15']] as [number, string][]) {
    assert.equal(conPreposizione('al', g), atteso)
  }
  assert.equal(conPreposizione('il', 8), "l'8"); assert.equal(conPreposizione('il', 14), 'il 14')
  assert.equal(elencoDate(['2026-09-14']), '14 settembre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15']), '14 e 15 settembre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15', '2026-09-16']), '14, 15 e 16 settembre')
  assert.equal(elencoDate(['2026-09-30', '2026-10-01']), '30 settembre e 1 ottobre')
  assert.equal(elencoDateConArticolo(['2026-09-08']), "l'8 settembre")
  assert.equal(elencoDateConArticolo(['2026-09-14', '2026-09-15']), 'il 14 e 15 settembre')
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
  assert.equal(centesimiNotte(segmento(AMELIA, '2026-09-13', '2026-09-15', 2)), 7500)
  assert.equal(centesimiNotte(segmento(LENA, '2026-09-13', '2026-09-15', 3)), 9000)
})

test('descrizione della camera dai dati: balconcino solo per Allegra, letto solo se addebitato; link solo per le camere con pagina', () => {
  assert.equal(descrizioneCamera(AMELIA, 1), AMELIA_DESC)
  assert.equal(descrizioneCamera(AMELIA, 2), "singola con aggiunta del secondo letto e bagno privato, all'interno della camera")
  assert.equal(descrizioneCamera(ALLEGRA, 2), ALLEGRA_DESC)
  assert.equal(descrizioneCamera(ALLEGRA, 3), "matrimoniale con balconcino, aggiunta del terzo letto e bagno privato, all'interno della camera")
  assert.equal(descrizioneCamera(AMBRA, 2), AMBRA_DESC)
  assert.equal(descrizioneCamera(LENA, 3), 'tripla con bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera')
  assert.equal(descrizioneCamera(LENA, 4), 'tripla con aggiunta del quarto letto e bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera')
  assert.equal(rigaLinkCamera(AMELIA), LINK('singola'))
  assert.equal(rigaLinkCamera(ALLEGRA), LINK('allegra'))
  assert.equal(rigaLinkCamera(AMBRA), LINK('ambra'))
  assert.equal(rigaLinkCamera(LENA), LINK('lena'))
  assert.equal(rigaLinkCamera({ name: 'Camera 1' }), null)
})

test('caso A, una sola camera libera: «soltanto», prezzo, link, condizione 1 nuova', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: ARRIVO }), `${APERTURA}

Ho verificato le date che mi ha indicato: dal 13 al 15 settembre è disponibile soltanto la camera Amelia, ${AMELIA_DESC}. Il prezzo per le 2 notti è di 140 €.
${LINK('singola')}

${COND_ARRIVO}`)
})

test('caso A, una notte al singolare, camera senza pagina: nessuna riga del link; senza condizione il testo si ferma prima della chiusura', () => {
  const s = sol('completa', [segmento(LENA, '2026-09-13', '2026-09-14', 3)])
  assert.equal(generaProposta({ richiesta: { ...R, partenza: '2026-09-14', persone: 3 }, soluzione: s, condizione: null }), `${APERTURA}

Ho verificato le date che mi ha indicato: dal 13 al 14 settembre è disponibile soltanto la camera Lena, tripla con bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera. Il prezzo per la notte è di 90 €.
${LINK('lena')}`)
  const senzaPagina = sol('completa', [segmento({ ...AMELIA, name: 'Camera 1' }, '2026-09-13', '2026-09-14', 1)])
  assert.doesNotMatch(generaProposta({ richiesta: R, soluzione: senzaPagina, condizione: null }), /casaaniarozzano/)
})

test('caso A con più camere libere: elenco con «due/tre camere libere», un link per camera, «una delle camere» nelle 3 ore', () => {
  const r = { ...R, arrivo: '2026-09-17', partenza: '2026-09-21', persone: 1 }
  const tutte = proponiSoluzioni(r, [AMELIA, AMBRA], [])
  assert.equal(tutte.length, 2)
  assert.deepEqual(camereDelCasoA(tutte[0], tutte).map(s => s.segmenti[0].camera.name), ['Amelia', 'Ambra'])
  assert.equal(generaProposta({ richiesta: r, soluzione: tutte[0], condizione: ARRIVO, alternative: tutte }), `${APERTURA}

Ho verificato le date che mi ha indicato: dal 17 al 21 settembre ho due camere libere che posso proporle:
– Amelia, ${AMELIA_DESC}: 280 € per le 4 notti.
${LINK('singola')}
– Ambra, ${AMBRA_DESC}: 320 € per le 4 notti.
${LINK('ambra')}

${COND_ARRIVO_PIU}`)
  const tre = proponiSoluzioni(r, CAMERE, [])
  assert.match(generaProposta({ richiesta: r, soluzione: tre[0], condizione: null, alternative: tre }), /ho quattro camere libere che posso proporle:\n– Amelia/)
  // con più camere il blocco Amelia non compare (le alternative sono già elencate)
  const amelia = alternativaAmelia(r, tutte[0], [AMELIA, AMBRA], [])
  assert.ok(amelia)
  assert.doesNotMatch(generaProposta({ richiesta: r, soluzione: tutte[0], condizione: ARRIVO, alternative: tutte, amelia }), /camera più piccola/)
})

test('caso reale 17–21 in [2,1,1,1]: Amelia con secondo letto solo la prima notte, Ambra matrimoniale, riga «Nel dettaglio»', () => {
  const r = { nome: 'Marta', arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: [2, 1, 1, 1] }
  const tutte = proponiSoluzioni(r, [AMELIA, AMBRA], [])
  const amelia = tutte.find(s => s.segmenti[0].camera.name === 'Amelia')!
  const ambra = tutte.find(s => s.segmenti[0].camera.name === 'Ambra')!
  assert.equal(dettaglioPersone(amelia.segmenti[0]), 'Nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 3 notti in una a 70 € a notte.')
  assert.equal(dettaglioPersone(ambra.segmenti[0]), 'Nel dettaglio: 1 notte in due a 80 € a notte, 3 notti in una a 80 € a notte.')
  assert.equal(dettaglioPersone(segmento(AMELIA, '2026-09-17', '2026-09-21', 1)), null)
  assert.equal(generaProposta({ richiesta: r, soluzione: amelia, condizione: ARRIVO, alternative: tutte }), `Gentile Marta,
grazie per aver pensato a Casa Ania per il suo soggiorno.

Ho verificato le date che mi ha indicato: dal 17 al 21 settembre ho due camere libere che posso proporle:
– Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera: 285 € per le 4 notti. Nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 3 notti in una a 70 € a notte.
${LINK('singola')}
– Ambra, ${AMBRA_DESC}: 320 € per le 4 notti. Nel dettaglio: 1 notte in due a 80 € a notte, 3 notti in una a 80 € a notte.
${LINK('ambra')}

${COND_ARRIVO_PIU}`)
  // una sola camera libera con persone variabili
  assert.equal(generaProposta({ richiesta: r, soluzione: amelia, condizione: null }), `Gentile Marta,
grazie per aver pensato a Casa Ania per il suo soggiorno.

Ho verificato le date che mi ha indicato: dal 17 al 21 settembre è disponibile soltanto la camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera. Il prezzo per le 4 notti è di 285 €. Nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 3 notti in una a 70 € a notte.
${LINK('singola')}`)
  // matrimoniale a 3 la prima notte: terzo letto solo quella notte
  const tre = proponiSoluzioni({ ...r, persone: 3, persone_per_notte: [3, 2, 2, 2] }, [AMBRA], [])[0]
  assert.equal(dettaglioPersone(tre.segmenti[0]), 'Nel dettaglio: 1 notte in tre con terzo letto a 90 € a notte, 3 notti in due a 80 € a notte.')
})

test('caso B: cambio camera, con l\'introduzione della soluzione, nessun totale unico', () => {
  const s = sol('cambio', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(ALLEGRA, '2026-09-14', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTRO_SOLUZIONE}

Per tutto il periodo, dal 13 al 15 settembre, posso ospitarla prevedendo un cambio di camera durante il soggiorno:

– dal 13 al 14 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte;

– dal 14 al 15 settembre, nella camera Allegra, ${ALLEGRA_DESC}, al prezzo di 80 € a notte.

${COND_ARRIVO}`)
})

test('caso B con letto aggiuntivo e con persone variabili nel segmento', () => {
  const s = sol('cambio', [segmento(AMELIA, '2026-09-13', '2026-09-14', 2), segmento(ALLEGRA, '2026-09-14', '2026-09-15', 2)])
  const t = generaProposta({ richiesta: { ...R, persone: 2 }, soluzione: s, condizione: ARRIVO })
  assert.match(t, /– dal 13 al 14 settembre, nella camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera, al prezzo di 75 € a notte;/)
  assert.match(t, /– dal 14 al 15 settembre, nella camera Allegra, matrimoniale con balconcino e bagno privato, all'interno della camera, al prezzo di 80 € a notte\./)
  const variabile = sol('cambio', [segmento(AMELIA, '2026-09-13', '2026-09-15', [2, 1]), segmento(ALLEGRA, '2026-09-15', '2026-09-16', 1)])
  assert.match(generaProposta({ richiesta: { ...R, partenza: '2026-09-16', persone: 2 }, soluzione: variabile, condizione: null }),
    /– dal 13 al 15 settembre, nella camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera, al prezzo complessivo di 145 € per 2 notti \(nel dettaglio: 1 notte in due con secondo letto a 75 € a notte, 1 notte in una a 70 € a notte\);/)
})

const INTESTAZIONE_C = `Per l'intero periodo non ho purtroppo una soluzione continuativa, ma posso ospitarla per la maggior parte del soggiorno.`

test('caso C: notte scoperta in mezzo, stessa camera (senza frase del cambio)', () => {
  const s = sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(AMELIA, '2026-09-15', '2026-09-16', 1)], ['2026-09-14'])
  assert.equal(generaProposta({ richiesta: { ...R, partenza: '2026-09-16' }, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTRO_SOLUZIONE}

${INTESTAZIONE_C}

– dal 13 al 14 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte;

– dal 15 al 16 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per la notte non disponibile, cioè il 14 settembre.

${COND_ARRIVO}`)
})

test('caso C con cambio camera e due notti scoperte in mezzo (plurale)', () => {
  const s = sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(ALLEGRA, '2026-09-16', '2026-09-17', 1)], ['2026-09-14', '2026-09-15'])
  assert.equal(generaProposta({ richiesta: { ...R, partenza: '2026-09-17' }, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTRO_SOLUZIONE}

${INTESTAZIONE_C}

Per coprire il maggior numero possibile di notti, la soluzione prevede anche un cambio di camera:

– dal 13 al 14 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte;

– dal 16 al 17 settembre, nella camera Allegra, ${ALLEGRA_DESC}, al prezzo di 80 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per le notti non disponibili, cioè il 14 e 15 settembre.

${COND_ARRIVO}`)
})

test('caso C: notte scoperta all\'inizio (un solo segmento) e alla fine, con l\'elisione («l\'8»)', () => {
  const rich = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16' }
  const s = sol('manca_estremo', [segmento(AMELIA, '2026-09-14', '2026-09-16', 1)], ['2026-09-13'])
  assert.equal(generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO }), `${APERTURA}

${INTRO_SOLUZIONE}

${INTESTAZIONE_C}

– dal 14 al 16 settembre, nella camera Amelia, ${AMELIA_DESC}, al prezzo di 70 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per la notte non disponibile, cioè il 13 settembre.

${COND_ARRIVO}`)
  assert.deepEqual(nottiScoperte(rich, s), ['2026-09-13'])
  const fine = { ...R, arrivo: '2026-09-06', partenza: '2026-09-09' }
  const sf = sol('manca_estremo', [segmento(ALLEGRA, '2026-09-06', '2026-09-08', 1)], ['2026-09-08'])
  const t = generaProposta({ richiesta: fine, soluzione: sf, condizione: ARRIVO })
  assert.match(t, /– dal 6 all'8 settembre, nella camera Allegra/)
  assert.match(t, /soltanto per la notte non disponibile, cioè l'8 settembre\./)
  assert.deepEqual(nottiScoperte(fine, sf), ['2026-09-08'])
})

test('caso E: testo completo invariato, nessuna condizione e nessun limite di ore', () => {
  const s = sol('completo', [], ['2026-09-13', '2026-09-14'])
  const atteso = `Gentile Anna, grazie per aver pensato a Casa Ania per il suo soggiorno.

Mi dispiace, ma per le date che mi ha indicato siamo al completo e non ho una soluzione alternativa da poterle proporre.

Spero di poterla accogliere in futuro.

Grazie mille,
Ania – Casa Ania`
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: null }), atteso)
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'caparra', caparraCentesimi: 1 } }), atteso)
  assert.doesNotMatch(atteso, /3 ore/)
})

test('condizione 2: caparra 50% e importo personalizzato con percentuale ricalcolata (invariata)', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])   // 140 €
  const base = `${APERTURA}

Ho verificato le date che mi ha indicato: dal 13 al 15 settembre è disponibile soltanto la camera Amelia, ${AMELIA_DESC}. Il prezzo per le 2 notti è di 140 €.
${LINK('singola')}

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

test('condizione 3: pagamento completo anticipato (invariata)', () => {
  const s = sol('completa', [segmento(ALLEGRA, '2026-09-13', '2026-09-15', 2)])   // 160 €
  assert.equal(generaProposta({ richiesta: { ...R, persone: 2 }, soluzione: s, condizione: { tipo: 'completo' } }), `${APERTURA}

Ho verificato le date che mi ha indicato: dal 13 al 15 settembre è disponibile soltanto la camera Allegra, ${ALLEGRA_DESC}. Il prezzo per le 2 notti è di 160 €.
${LINK('allegra')}

Se desidera accettare questa proposta, le chiedo di farmelo sapere entro 3 ore dalla ricezione del messaggio.

Dopo la sua risposta le invierò i dati per effettuare il pagamento anticipato dell'intero soggiorno, pari a 160 €, e terrò la camera a sua disposizione per 24 ore, in attesa del bonifico.

La prenotazione sarà confermata definitivamente al ricevimento del pagamento.

Grazie mille,
Ania – Casa Ania`)
})

test('condizione 4: personalizzata, solo la chiusura viene aggiunta', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])
  assert.equal(generaProposta({ richiesta: R, soluzione: s, condizione: { tipo: 'personalizzata', testo: '  Il pagamento lo concordiamo a voce, come d\'accordo al telefono.  ' } }), `${APERTURA}

Ho verificato le date che mi ha indicato: dal 13 al 15 settembre è disponibile soltanto la camera Amelia, ${AMELIA_DESC}. Il prezzo per le 2 notti è di 140 €.
${LINK('singola')}

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
  const testa = `${APERTURA}

Ho verificato le date che mi ha indicato: dal 13 al 16 settembre è disponibile soltanto la camera Amelia, ${AMELIA_DESC}. Il prezzo per le 3 notti è di 210 €.
${LINK('singola')}`
  assert.equal(generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO, amelia: null }), `${testa}

${COND_ARRIVO}`)
  assert.equal(generaProposta({ richiesta: rich, soluzione: s, condizione: ARRIVO, amelia }), `${testa}

Visto che si tratta di un soggiorno di 3 notti, ci tengo però a indicarle anche un'alternativa. Amelia è la nostra camera più piccola e, per una permanenza più lunga, potrebbe risultare meno comoda. Con 10 € in più a notte posso invece proporle la camera Allegra, una camera matrimoniale più spaziosa. Il prezzo complessivo sarebbe di 240 €.

${COND_ARRIVO}`)
})

test('alternativa Amelia: condizioni non soddisfatte → nessun blocco', () => {
  const occ = (room_id: string, check_in: string, check_out: string) => ({ room_id, check_in, check_out, status: 'confermata' })
  const rich3 = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16', persone: 1 }
  const s3 = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-16', 1)])
  assert.equal(alternativaAmelia(R, sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)]), CAMERE, []), null)
  assert.equal(alternativaAmelia(rich3, sol('completa', [segmento(AMBRA, '2026-09-13', '2026-09-16', 1)]), CAMERE, []), null)
  assert.equal(alternativaAmelia(rich3, s3, CAMERE, [occ('allegra', '2026-09-14', '2026-09-15')])?.camera.name, 'Ambra')
  assert.equal(alternativaAmelia(rich3, s3, CAMERE, [occ('allegra', '2026-09-10', '2026-09-20'), occ('ambra', '2026-09-15', '2026-09-16')]), null)
  assert.equal(alternativaAmelia(rich3, s3, CAMERE, [{ ...occ('allegra', '2026-09-10', '2026-09-20'), status: 'in_attesa' }])?.camera.name, 'Allegra')
  assert.equal(alternativaAmelia(rich3, sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(AMELIA, '2026-09-15', '2026-09-16', 1)], ['2026-09-14']), CAMERE, []), null)
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

test('dalla ricerca alla proposta: caso reale di Sawicka 2–5 settembre (caso C con la prima notte scoperta)', () => {
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

// ── pezzo 10: composizione manuale («Scelgo io») ────────────────────────────
import { soluzioneDaComposizione } from './richiesteComposizione.ts'
import { LENA_ID } from './lettiAggiuntivi.ts'

const LENA_VERA = { ...LENA, id: LENA_ID }
const CAMERE_10 = [AMELIA, ALLEGRA, AMBRA, LENA_VERA]
const R10 = { nome: 'Marta', arrivo: '2026-09-17', partenza: '2026-09-21', persone: 2, camera_id: null, persone_per_notte: [2, 3, 3, 3] }
const AP10 = 'Gentile Marta,\ngrazie per aver pensato a Casa Ania per il suo soggiorno.'

test('composizione A: una camera «libera» diversa da quella automatica → caso A con una camera, persone variabili', () => {
  const s = soluzioneDaComposizione(R10, CAMERE_10, ['ambra', 'ambra', 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: R10, soluzione: s, condizione: null }), `${AP10}

Ho verificato le date che mi ha indicato: dal 17 al 21 settembre è disponibile soltanto la camera Ambra, matrimoniale con aggiunta del terzo letto e bagno privato, all'interno della camera. Il prezzo per le 4 notti è di 350 €. Nel dettaglio: 1 notte in due a 80 € a notte, 3 notti in tre con terzo letto a 90 € a notte.
${LINK('ambra')}`)
})

test('composizione B con un cambio: Amelia la prima notte, Ambra le altre; dettaglio per segmento e due link', () => {
  const s = soluzioneDaComposizione(R10, CAMERE_10, ['amelia', 'ambra', 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: R10, soluzione: s, condizione: ARRIVO }), `${AP10}

${INTRO_SOLUZIONE}

Per tutto il periodo, dal 17 al 21 settembre, posso ospitarla prevedendo un cambio di camera durante il soggiorno:

– dal 17 all'18 settembre, nella camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera, al prezzo di 75 € a notte;

– dall'18 al 21 settembre, nella camera Ambra, matrimoniale con aggiunta del terzo letto e bagno privato, all'interno della camera, al prezzo di 90 € a notte.

${LINK('singola')}
${LINK('ambra')}

${COND_ARRIVO}`)
})

test('composizione B con due cambi: tre segmenti, tre righe, link una volta per camera', () => {
  const s = soluzioneDaComposizione(R10, CAMERE_10, ['amelia', 'ambra', 'ambra', LENA_ID])
  assert.equal(generaProposta({ richiesta: R10, soluzione: s, condizione: null }), `${AP10}

${INTRO_SOLUZIONE}

Per tutto il periodo, dal 17 al 21 settembre, posso ospitarla prevedendo un cambio di camera durante il soggiorno:

– dal 17 all'18 settembre, nella camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera, al prezzo di 75 € a notte;

– dall'18 al 20 settembre, nella camera Ambra, matrimoniale con aggiunta del terzo letto e bagno privato, all'interno della camera, al prezzo di 90 € a notte;

– dal 20 al 21 settembre, nella camera Lena, tripla con bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera, al prezzo di 90 € a notte.

${LINK('singola')}
${LINK('ambra')}
${LINK('lena')}`)
  // Ambra torna dopo Lena: il link resta uno per camera
  const ritorno = soluzioneDaComposizione(R10, CAMERE_10, ['ambra', LENA_ID, 'ambra', 'ambra'])
  const t = generaProposta({ richiesta: R10, soluzione: ritorno, condizione: null })
  assert.equal((t.match(/casaaniarozzano\.it\/camere\/ambra/g) || []).length, 1)
  assert.equal(ritorno.segmenti.length, 3)
})

test('composizione C: notte scoperta in mezzo, segmenti con persone variabili nel dettaglio', () => {
  const s = soluzioneDaComposizione(R10, CAMERE_10, ['amelia', null, 'ambra', 'ambra'])
  assert.equal(generaProposta({ richiesta: R10, soluzione: s, condizione: null }), `${AP10}

${INTRO_SOLUZIONE}

Per l'intero periodo non ho purtroppo una soluzione continuativa, ma posso ospitarla per la maggior parte del soggiorno.

Per coprire il maggior numero possibile di notti, la soluzione prevede anche un cambio di camera:

– dal 17 all'18 settembre, nella camera Amelia, singola con aggiunta del secondo letto e bagno privato, all'interno della camera, al prezzo di 75 € a notte;

– dal 19 al 21 settembre, nella camera Ambra, matrimoniale con aggiunta del terzo letto e bagno privato, all'interno della camera, al prezzo di 90 € a notte.

Resterebbe da trovare un'altra sistemazione soltanto per la notte non disponibile, cioè l'18 settembre.

${LINK('singola')}
${LINK('ambra')}`)
  // un segmento con persone che cambiano al suo interno: riga «nel dettaglio»
  const misto = soluzioneDaComposizione({ ...R10, persone_per_notte: [2, 3, 3, 2] }, CAMERE_10, ['ambra', 'ambra', 'ambra', null])
  assert.match(generaProposta({ richiesta: { ...R10, persone_per_notte: [2, 3, 3, 2] }, soluzione: misto, condizione: null }),
    /– dal 17 al 20 settembre, nella camera Ambra, matrimoniale con aggiunta del terzo letto e bagno privato, all'interno della camera, al prezzo complessivo di 260 € per 3 notti \(nel dettaglio: 1 notte in due a 80 € a notte, 2 notti in tre con terzo letto a 90 € a notte\)\./)
})

test('prezzo a mano nel testo: «Nel dettaglio» e il totale riportano i prezzi scritti da Ania', () => {
  const s = soluzioneDaComposizione(R10, CAMERE_10, ['ambra', 'ambra', 'ambra', 'ambra'], [6000, null, null, 8500])
  assert.equal(s.prezzoTotale, 60 + 90 + 90 + 85)
  assert.equal(dettaglioPersone(s.segmenti[0]), 'Nel dettaglio: 1 notte in due a 60 € a notte, 2 notti in tre con terzo letto a 90 € a notte, 1 notte in tre con terzo letto a 85 € a notte.')
  assert.match(generaProposta({ richiesta: R10, soluzione: s, condizione: null }), /Il prezzo per le 4 notti è di 325 €\. Nel dettaglio: 1 notte in due a 60 € a notte/)
  // prezzo a mano su tutte le notti di una camera, persone uniformi → il prezzo a notte della riga B usa quello
  const r2 = { ...R10, persone: 2, persone_per_notte: null }
  const b = soluzioneDaComposizione(r2, CAMERE_10, ['amelia', 'ambra', 'ambra', 'ambra'], [null, 7000, 7000, 7000])
  assert.match(generaProposta({ richiesta: r2, soluzione: b, condizione: null }), /– dall'18 al 21 settembre, nella camera Ambra, matrimoniale con bagno privato, all'interno della camera, al prezzo di 70 € a notte\./)
})
