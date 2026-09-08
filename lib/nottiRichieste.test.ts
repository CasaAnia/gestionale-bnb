import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nottiDellaRichiesta, nottiDelPeriodo, selezioneNottiValida, periodiDelleNotti, elencoNotti } from './nottiRichieste.ts'
import { nottiRichiesta, formatDateRichiesta, pianoModifica } from './richieste.ts'
import { validaRichiestaWeb, stessaRichiesta } from './richiesteWeb.ts'
import { proponiSoluzioni, personePerNotte, motiviEsclusione } from './richiesteProposta.ts'
import { soluzioneDaComposizione, composizioneDaSoluzione } from './richiesteComposizione.ts'
import { generaProposta, nottiScoperte } from './richiesteTesti.ts'
import { condividonoGiorni, sovrapposizioni } from './richiesteCalendario.ts'

const notti = ['2027-09-23', '2027-09-25', '2027-09-26']
const r = { nome: 'Ospite', cognome: 'Prova', arrivo: '2027-09-23', partenza: '2027-09-27', persone: 1, camera_id: 'amelia', notti_richieste: notti }
const camera = { id: 'amelia', name: 'Amelia', base_price: 70, has_extra_bed: true, extra_bed_price: 5, active: true }

test('23, 25, 26: tre notti, due periodi; checkout escluso, buchi non riempiti', () => {
  assert.deepEqual(nottiDellaRichiesta(r), notti)
  assert.equal(nottiRichiesta(r), 3)
  assert.deepEqual(periodiDelleNotti(notti), [{ arrivo: '2027-09-23', partenza: '2027-09-24' }, { arrivo: '2027-09-25', partenza: '2027-09-27' }])
  assert.match(formatDateRichiesta(r), /23, 25 e 26 settembre 2027/)
  assert.equal(elencoNotti(['2027-12-31','2028-01-01']), '31 dicembre 2027; 1 gennaio 2028')
  assert.deepEqual(nottiDelPeriodo('2027-03-27','2027-03-30'), ['2027-03-27','2027-03-28','2027-03-29'])
  assert.equal(nottiRichiesta({ ...r, notti_richieste: null }), 4)
})

test('ingresso web: insieme esatto; vuoto, doppioni, disordine, giorno occupato nel checkout e date impossibili rifiutati', () => {
  const body = { ...r, camera: 'Amelia', telefono: '3330000000', note: 'Nota libera' }
  const validata = validaRichiestaWeb(body, '2027-09-01', [camera])
  assert.ok(validata.ok)
  assert.deepEqual(validata.dati.notti_richieste, notti)
  assert.equal(validata.dati.note, 'Nota libera')
  for (const invalido of [[], [notti[0], notti[0]], [...notti].reverse(), ['2027-09-27'], ['2027-09-22'], ['2027-09-99'], [5], '23']) {
    assert.equal(selezioneNottiValida(invalido, r.arrivo, r.partenza), false)
    assert.equal(validaRichiestaWeb({ ...body, notti_richieste: invalido }, '2027-09-01', [camera]).ok, false)
  }
  assert.equal(stessaRichiesta(validata.dati, { ...r, telefono: '+393330000000' }), true)
  assert.equal(stessaRichiesta(validata.dati, { ...r, notti_richieste: ['2027-09-23','2027-09-26'], telefono: '+393330000000' }), false)
  assert.equal(stessaRichiesta(validata.dati, { ...r, notti_richieste: null, telefono: '+393330000000' }), false)
})

test('proposta automatica, manuale, prezzi e messaggio escludono la notte del 24', () => {
  const occupata = [{ room_id: camera.id, check_in: '2027-09-24', check_out: '2027-09-25', status: 'confermata' }]
  const s = proponiSoluzioni(r, [camera], occupata)[0]
  assert.equal(s.nottiCoperte, 3); assert.equal(s.nottiTotali, 3); assert.equal(s.prezzoTotale, 210)
  assert.deepEqual(s.nottiMancanti, [])
  assert.deepEqual(s.segmenti.flatMap(s => nottiDelPeriodo(s.arrivo,s.partenza)), notti)
  assert.equal(motiviEsclusione(r,[camera],occupata)[0].motivo.stato, 'libera')
  assert.deepEqual(composizioneDaSoluzione(r,s), ['amelia','amelia','amelia'])
  const manuale = soluzioneDaComposizione(r,[camera], ['amelia','amelia','amelia'])
  assert.equal(manuale.segmenti.length,2); assert.equal(manuale.prezzoTotale,210)
  assert.deepEqual(nottiScoperte(r,s), [])
  const testo = generaProposta({richiesta:r,soluzione:s,condizione:{tipo:'arrivo'}})
  assert.match(testo,/23, 25 e 26 settembre 2027/);
  assert.match(testo,/23 al 24/); assert.match(testo,/25 al 27/); assert.match(testo,/210/)
  assert.doesNotMatch(testo,/dal 23 al 27|cambio di camera|mancano 1|manca 1/)
  assert.match(testo,/notti tra un periodo e l’altro non sono incluse/)
})

test('scelta singola e disponibilità persa: niente notti aggiunte o nascoste', () => {
  const singola = { ...r, notti_richieste: ['2027-09-25'] }
  const s = proponiSoluzioni(singola,[camera],[])[0]
  assert.equal(s.nottiTotali,1); assert.equal(s.prezzoTotale,70)
  assert.deepEqual(s.segmenti.map(s=>[s.arrivo,s.partenza]),[['2027-09-25','2027-09-26']])
  const persa = proponiSoluzioni(r,[camera],[{room_id:camera.id,check_in:'2027-09-25',check_out:'2027-09-26',status:'confermata'}])[0]
  assert.deepEqual(persa.nottiMancanti,['2027-09-25']); assert.equal(persa.prezzoTotale,140)
})

test('persone variabili mantengono gli indici reali; conflitti e calendario ignorano i buchi', () => {
  assert.deepEqual(personePerNotte({...r,persone_per_notte:[1,4,2,1]}),[1,2,1])
  assert.equal(condividonoGiorni(r,{arrivo:'2027-09-24',partenza:'2027-09-25'}),false)
  assert.equal(condividonoGiorni(r,{arrivo:'2027-09-25',partenza:'2027-09-26'}),true)
  const c = sovrapposizioni({...r,id:'r',stato:'in_attesa'},[{id:'b',room_id:'amelia',check_in:'2027-09-24',check_out:'2027-09-25',status:'confermata'}],[])
  assert.deepEqual(c.prenotazioni,[])
})

test('cambiare le notti invalida la proposta inviata anche a parità di estremi', () => {
  const piano = pianoModifica({...r,stato:'proposta_inviata'}, {...r,notti_richieste:[notti[0],notti[2]],persone_per_notte:null,telefono:'3330000000',note:null,canale:'web'})
  assert.equal(piano.propostaSuperata,true); assert.equal(piano.campi.proposta_soluzione,null)
})
