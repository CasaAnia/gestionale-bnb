import { test } from 'node:test'
import assert from 'node:assert/strict'
import { componiBozza, dalAl, elencoDate, prezzo, notteMancanteEstremo } from './richiesteTesti.ts'
import { proponiSoluzioni, segmento, type Soluzione } from './richiesteProposta.ts'

const AMELIA = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, bathroom_type: 'privato_interno', active: true }
const ALLEGRA = { id: 'allegra', name: 'Allegra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }
const LENA = { id: 'lena', name: 'Lena', base_price: 80, double_price: 90, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_esterno', active: true }
const R = { nome: 'Anna', cognome: 'Rossi', arrivo: '2026-09-13', partenza: '2026-09-15', persone: 1, camera_id: null }
const SALUTO = 'Buongiorno Anna, grazie per aver scritto a Casa Ania. Ho verificato la disponibilità per le date richieste.'
const CHIUSURA = 'Fammi sapere se questa soluzione può andare bene per te, così possiamo procedere con la prenotazione.\nGrazie,\nAnia – Casa Ania'
const sol = (caso: Soluzione['caso'], segmenti: Soluzione['segmenti'], nottiMancanti: string[] = []): Soluzione => ({
  caso, segmenti, nottiTotali: 2, nottiCoperte: segmenti.reduce((s, x) => s + x.notti, 0), nottiMancanti,
  prezzoTotale: segmenti.reduce((s, x) => s + x.totale, 0),
})

test('date e prezzi in italiano', () => {
  assert.equal(dalAl('2026-09-13', '2026-09-15'), 'dal 13 al 15 settembre')
  assert.equal(dalAl('2026-09-30', '2026-10-02'), 'dal 30 settembre al 2 ottobre')
  assert.equal(dalAl('2026-12-30', '2027-01-02'), 'dal 30 dicembre 2026 al 2 gennaio 2027')
  assert.equal(elencoDate(['2026-09-14']), '14 settembre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15']), '14 e 15 settembre')
  assert.equal(elencoDate(['2026-09-14', '2026-09-15', '2026-09-16']), '14, 15 e 16 settembre')
  assert.equal(elencoDate(['2026-09-30', '2026-10-01']), '30 settembre e 1 ottobre')
  assert.equal(prezzo(140), '140')
  assert.equal(prezzo(140.5), '140,50')
})

test('caso A: due notti', () => {
  const s = sol('completa', [segmento(AMELIA, '2026-09-13', '2026-09-15', 1)])
  assert.equal(componiBozza(R, s), `${SALUTO}

Dal 13 al 15 settembre posso proporti la camera Amelia, singola, bagno privato, all'interno della camera, al prezzo complessivo di 140 € per 2 notti.

${CHIUSURA}`)
})

test('caso A: una notte al singolare', () => {
  const s = sol('completa', [segmento(LENA, '2026-09-13', '2026-09-14', 2)])
  assert.match(componiBozza({ ...R, partenza: '2026-09-14' }, s), /camera Lena, tripla, bagno privato esterno, chiuso a chiave, a circa 1 metro dalla camera, al prezzo complessivo di 80 € per 1 notte\./)
})

test('caso B: cambio camera', () => {
  const s = sol('cambio', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(ALLEGRA, '2026-09-14', '2026-09-15', 1)])
  assert.equal(componiBozza(R, s), `${SALUTO}

Per riuscire a ospitarti durante tutto il periodo, posso proporti una soluzione con un cambio di camera:
- dal 13 al 14 settembre: camera Amelia, singola, bagno privato, all'interno della camera
- dal 14 al 15 settembre: camera Allegra, matrimoniale, bagno privato, all'interno della camera
Il prezzo complessivo per l'intero soggiorno è di 150 €. Il cambio sarebbe quindi soltanto il giorno 14 settembre.

${CHIUSURA}`)
})

test('caso C: una notte in mezzo (singolare) e due notti (plurale)', () => {
  const una = sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(AMELIA, '2026-09-15', '2026-09-16', 1)], ['2026-09-14'])
  assert.equal(componiBozza({ ...R, partenza: '2026-09-16' }, una), `${SALUTO}

Per il periodo richiesto mi manca disponibilità soltanto per la notte del 14 settembre. Posso però ospitarti:
- dal 13 al 14 settembre: camera Amelia, singola, bagno privato, all'interno della camera
- dal 15 al 16 settembre: camera Amelia, singola, bagno privato, all'interno della camera
Se per quella notte riesci a trovare una sistemazione nelle vicinanze, puoi trascorrere da noi tutto il resto del soggiorno. Il prezzo complessivo per le 2 notti da Casa Ania è di 140 €.

${CHIUSURA}`)
  const due = sol('manca_mezzo', [segmento(AMELIA, '2026-09-13', '2026-09-14', 1), segmento(ALLEGRA, '2026-09-16', '2026-09-17', 1)], ['2026-09-14', '2026-09-15'])
  const t = componiBozza({ ...R, partenza: '2026-09-17' }, due)
  assert.match(t, /soltanto per le notti del 14 e 15 settembre\./)
  assert.match(t, /Se per quelle notti riesci/)
})

test('caso D: prima notte, prime due notti, ultima notte', () => {
  const rich = { ...R, arrivo: '2026-09-13', partenza: '2026-09-16' }
  const prima = sol('manca_estremo', [segmento(AMELIA, '2026-09-14', '2026-09-16', 1)], ['2026-09-13'])
  assert.equal(componiBozza(rich, prima), `${SALUTO}

Non ho disponibilità per la prima notte, ma posso ospitarti dal 14 al 16 settembre nella camera Amelia, singola, bagno privato, all'interno della camera, al prezzo complessivo di 140 € per 2 notti.

${CHIUSURA}`)
  const lunga = { ...R, arrivo: '2026-09-13', partenza: '2026-09-17' }
  assert.equal(notteMancanteEstremo(lunga, sol('manca_estremo', [segmento(AMELIA, '2026-09-15', '2026-09-17', 1)])), 'le prime due notti')
  assert.equal(notteMancanteEstremo(lunga, sol('manca_estremo', [segmento(AMELIA, '2026-09-13', '2026-09-16', 1)])), "l'ultima notte")
  assert.equal(notteMancanteEstremo(lunga, sol('manca_estremo', [segmento(AMELIA, '2026-09-14', '2026-09-16', 1)])), "la prima notte e l'ultima notte")
  assert.match(componiBozza(lunga, sol('manca_estremo', [segmento(AMELIA, '2026-09-16', '2026-09-17', 1)])), /per le prime tre notti, ma posso ospitarti dal 16 al 17 settembre .* per 1 notte\./)
})

test('caso E: completo, chiusura corta', () => {
  const s = sol('completo', [], ['2026-09-13', '2026-09-14'])
  assert.equal(componiBozza(R, s), `${SALUTO}

Per le date indicate purtroppo siamo al completo. Mi dispiace davvero non poterti aiutare questa volta.

Grazie,
Ania – Casa Ania`)
})

test('dalla ricerca alla bozza: caso reale di Sawicka 2–5 settembre', () => {
  const camere = [AMELIA, ALLEGRA, LENA, { id: 'ambra', name: 'Ambra', base_price: 80, has_extra_bed: true, extra_bed_price: 10, bathroom_type: 'privato_interno', active: true }]
  const occ = [
    { room_id: 'lena', check_in: '2026-09-02', check_out: '2026-09-04', status: 'confermata' },
    { room_id: 'ambra', check_in: '2026-09-01', check_out: '2026-09-07', status: 'confermata' },
    { room_id: 'allegra', check_in: '2026-09-01', check_out: '2026-09-03', status: 'confermata' },
    { room_id: 'allegra', check_in: '2026-09-03', check_out: '2026-09-04', status: 'confermata' },
    { room_id: 'amelia', check_in: '2026-09-01', check_out: '2026-09-03', status: 'confermata' },
  ]
  const r = { nome: 'Anna', arrivo: '2026-09-02', partenza: '2026-09-05', persone: 1, camera_id: null }
  const [best] = proponiSoluzioni(r, camere, occ)
  assert.equal(best.caso, 'manca_estremo')
  assert.match(componiBozza(r, best), /Non ho disponibilità per la prima notte, ma posso ospitarti dal 3 al 5 settembre nella camera Amelia, .* 140 € per 2 notti\./)
})
