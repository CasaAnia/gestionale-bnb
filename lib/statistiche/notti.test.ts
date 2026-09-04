import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nottiDisponibili, nottiVendute, ricavoCompetenzaCent, indiciMese } from './notti.ts'
import { nottiNellIntervallo, giorniDelMese, primoGiornoDopo } from './periodo.ts'

const CAMERE = [{ id: 'amelia', name: 'Amelia', active: true }, { id: 'allegra', name: 'Allegra', active: true }, { id: 'ambra', name: 'Ambra', active: true }, { id: 'lena', name: 'Lena', active: true }, { id: 'vecchia', name: 'Camera 1', active: false }]
const b = (id: string, room_id: string, check_in: string, check_out: string, total: number, status = 'confermata') => ({ id, room_id, check_in, check_out, total_amount: total, status })

test('periodo: giorni del mese, mese dopo, notti in un intervallo', () => {
  assert.equal(giorniDelMese('2026-09'), 30); assert.equal(giorniDelMese('2026-02'), 28); assert.equal(giorniDelMese('2028-02'), 29)
  assert.equal(primoGiornoDopo('2026-12'), '2027-01-01')
  assert.equal(nottiNellIntervallo('2026-08-30', '2026-09-03', '2026-09-01', '2026-10-01'), 2)
  assert.equal(nottiNellIntervallo('2026-09-10', '2026-09-12', '2026-10-01', '2026-11-01'), 0)
})

test('notti disponibili: camere attive × giorni, meno le notti fuori servizio (mai 4 × giorni fisso)', () => {
  const tutte = nottiDisponibili('2026-09', CAMERE)
  assert.equal(tutte.totali, 120); assert.equal(tutte.chiuse, 0); assert.equal(tutte.perCamera['vecchia'], undefined)
  // Lena chiusa dal 10 al 20 settembre (10 notti) e un tratto che sconfina nel mese dopo
  const fs = [{ room_id: 'lena', da: '2026-09-10', a: '2026-09-20' }, { room_id: 'ambra', da: '2026-09-29', a: '2026-10-03', motivo: 'imbianchino' }]
  const conChiusure = nottiDisponibili('2026-09', CAMERE, fs)
  assert.equal(conChiusure.perCamera['lena'], 20); assert.equal(conChiusure.perCamera['ambra'], 28)
  assert.equal(conChiusure.totali, 108); assert.equal(conChiusure.chiuse, 12)
  // chiusura per tutto il mese e oltre: mai sotto zero
  assert.equal(nottiDisponibili('2026-09', CAMERE, [{ room_id: 'amelia', da: '2026-08-01', a: '2026-11-01' }]).perCamera['amelia'], 0)
  // senza camere attive: zero
  assert.equal(nottiDisponibili('2026-09', []).totali, 0)
})

test('notti vendute: solo confermate/completate, notti nel mese (a cavallo di mese spezzate)', () => {
  const pren = [
    b('1', 'amelia', '2026-09-01', '2026-09-04', 210),           // 3 notti
    b('2', 'ambra', '2026-08-30', '2026-09-02', 240),            // notti 30, 31 ago e 1 set → 1 in settembre
    b('3', 'lena', '2026-09-28', '2026-10-02', 360),             // 3 in settembre
    b('4', 'allegra', '2026-09-10', '2026-09-12', 160, 'in_attesa'),   // MAI contata
    b('5', 'allegra', '2026-09-12', '2026-09-14', 160, 'annullata'),   // mai
    b('6', 'allegra', '2026-09-20', '2026-09-21', 80, 'completata'),
  ]
  const v = nottiVendute('2026-09', pren)
  assert.deepEqual(v.perCamera, { amelia: 3, ambra: 1, lena: 3, allegra: 1 }); assert.equal(v.totali, 8)
  assert.equal(nottiVendute('2026-11', pren).totali, 0)
})

test('ricavo di competenza: totale diviso sulle notti in centesimi interi, resto sulle prime notti', () => {
  assert.equal(ricavoCompetenzaCent(b('1', 'amelia', '2026-09-01', '2026-09-04', 210), '2026-09'), 21000)
  // 240 € su 3 notti (30 e 31 ago, 1 set): 8000 per notte → settembre 8000, agosto 16000
  assert.equal(ricavoCompetenzaCent(b('2', 'ambra', '2026-08-30', '2026-09-02', 240), '2026-09'), 8000)
  assert.equal(ricavoCompetenzaCent(b('2', 'ambra', '2026-08-30', '2026-09-02', 240), '2026-08'), 16000)
  // 100 € su 3 notti = 3333 + 3333 + 3334? no: base 3333, resto 1 sulla prima → 3334, 3333, 3333
  assert.equal(ricavoCompetenzaCent(b('7', 'amelia', '2026-09-29', '2026-10-02', 100), '2026-09'), 6667)
  assert.equal(ricavoCompetenzaCent(b('7', 'amelia', '2026-09-29', '2026-10-02', 100), '2026-10'), 3333)
  assert.equal(ricavoCompetenzaCent(b('8', 'amelia', '2026-09-01', '2026-09-03', 100, 'in_attesa'), '2026-09'), 0)
})

test('indici del mese: occupazione, ADR e RevPAR in centesimi; camera fuori servizio; mese senza dati', () => {
  const pren = [b('1', 'amelia', '2026-09-01', '2026-09-04', 210), b('2', 'ambra', '2026-08-30', '2026-09-02', 240), b('3', 'lena', '2026-09-28', '2026-10-02', 360), b('6', 'allegra', '2026-09-20', '2026-09-21', 80, 'completata'), b('4', 'allegra', '2026-09-10', '2026-09-12', 160, 'in_attesa')]
  const i = indiciMese('2026-09', CAMERE, pren)
  assert.equal(i.nottiDisponibili, 120); assert.equal(i.nottiVendute, 8); assert.equal(i.occupazionePerMille, 67)
  assert.equal(i.ricaviCompetenzaCent, 21000 + 8000 + 27000 + 8000)   // 640 €
  assert.equal(i.adrCent, 8000); assert.equal(i.revparCent, 533)
  // Lena fuori servizio 10–20 e Ambra 29–30: 108 notti disponibili → occupazione 74 ‰, RevPAR 593
  const fs = indiciMese('2026-09', CAMERE, pren, [{ room_id: 'lena', da: '2026-09-10', a: '2026-09-20' }, { room_id: 'ambra', da: '2026-09-29', a: '2026-10-03' }])
  assert.equal(fs.nottiDisponibili, 108); assert.equal(fs.nottiChiuse, 12); assert.equal(fs.occupazionePerMille, 74); assert.equal(fs.revparCent, 593); assert.equal(fs.adrCent, 8000)
  // mese senza dati: tutto a zero, nessun NaN
  const vuoto = indiciMese('2027-03', CAMERE, pren)
  assert.deepEqual(vuoto, { mese: '2027-03', nottiDisponibili: 124, nottiVendute: 0, nottiChiuse: 0, occupazionePerMille: 0, ricaviCompetenzaCent: 0, adrCent: 0, revparCent: 0 })
  assert.equal(indiciMese('2026-09', [], pren).revparCent, 0)
})
