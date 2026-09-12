import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dataItaliana, dataLunga, giornoConSettimana, giornoMese, giornoMeseAnno, periodoCompatto, periodoConGiorni } from './dateItaliane.ts'

// Prima il giorno, poi il mese, poi l'anno: mai 2026-09-10 sotto gli occhi
test('data completa in cifre e a parole', () => {
  assert.equal(dataItaliana('2026-09-10'), '10/09/2026')
  assert.equal(dataLunga('2026-09-10'), '10 settembre 2026')
  assert.equal(dataItaliana('2027-01-03'), '03/01/2027')
  assert.equal(dataLunga('2027-01-03'), '3 gennaio 2027')
})

test('accetta anche gli istanti salvati con l\'ora', () => {
  assert.equal(dataItaliana('2026-09-10T18:30:00'), '10/09/2026')
  assert.equal(giornoMese('2026-09-10T18:30:00+02:00'), '10 set')
})

test('niente da mostrare: stringa vuota, mai «Invalid Date»', () => {
  for (const brutto of ['', '   ', 'domani', '10/09/2026', null, undefined, '2026-13-01']) {
    assert.equal(dataItaliana(brutto), '')
    assert.equal(dataLunga(brutto), '')
    assert.equal(giornoMese(brutto), '')
    assert.equal(periodoCompatto(brutto, '2026-09-12'), '')
  }
})

test('periodo dentro lo stesso anno: l\'anno non si ripete', () => {
  assert.equal(periodoCompatto('2026-09-10', '2026-09-12'), '10 set → 12 set')
  assert.equal(periodoCompatto('2026-08-30', '2026-09-02'), '30 ago → 2 set')
})

test('l\'anno si conserva quando serve: storico e Capodanno', () => {
  assert.equal(periodoCompatto('2026-09-10', '2026-09-12', { anno: true }), '10 set → 12 set 2026')
  assert.equal(periodoCompatto('2026-12-30', '2027-01-02'), '30 dic 2026 → 2 gen 2027')
  // a cavallo d'anno l'anno c'è sempre, anche senza chiederlo
  assert.equal(periodoCompatto('2026-12-30', '2027-01-02', { anno: true }), '30 dic 2026 → 2 gen 2027')
})

test('giorno e mese corti', () => {
  assert.equal(giornoMese('2026-09-10'), '10 set')
  assert.equal(giornoMeseAnno('2026-09-10'), '10 set 2026')
})

// Testa cliente: «gio 29 ott», con il giorno e il mese scritti con due misure
test('giorno con il giorno della settimana, diviso dal mese', () => {
  assert.deepEqual(giornoConSettimana('2026-10-29'), { giorno: 'gio 29', mese: 'ott' })
  assert.deepEqual(giornoConSettimana('2026-10-31'), { giorno: 'sab 31', mese: 'ott' })
  assert.deepEqual(giornoConSettimana('2027-01-01'), { giorno: 'ven 1', mese: 'gen' })
  assert.deepEqual(giornoConSettimana(null), { giorno: '', mese: '' })
  assert.deepEqual(giornoConSettimana('niente'), { giorno: '', mese: '' })
})

test('periodo con i giorni della settimana', () => {
  assert.equal(periodoConGiorni('2026-10-29', '2026-10-31'), 'gio 29 → sab 31 ott')
  assert.equal(periodoConGiorni('2026-10-31', '2026-11-02'), 'sab 31 ott → lun 2 nov')
  assert.equal(periodoConGiorni('2026-12-30', '2027-01-02'), 'mer 30 dic 2026 → sab 2 gen 2027')
  assert.equal(periodoConGiorni(null, '2026-10-31'), '')
})
