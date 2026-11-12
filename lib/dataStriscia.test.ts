// La data in cima alla Home si calcola nel browser e si aggiorna da sola
// (12/11/2026: la Home diceva «Lunedì 2 novembre 2026», il giorno dell'ultimo deploy).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dataStriscia, RICONTROLLO_DATA_MS } from './dataStriscia.ts'

const leggi = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')

test('il testo viene dalla data passata alla funzione, non da un valore fissato al caricamento del modulo', () => {
  assert.equal(dataStriscia(new Date('2026-11-12T10:00:00Z')), 'Giovedì 12 novembre 2026')
  assert.equal(dataStriscia(new Date('2026-11-02T10:00:00Z')), 'Lunedì 2 novembre 2026')
  assert.equal(dataStriscia(new Date('2026-09-28T10:00:00Z')), 'Lunedì 28 settembre 2026')
  // chiamate successive con date diverse danno testi diversi: nessuna memoria
  assert.notEqual(dataStriscia(new Date('2026-11-12T10:00:00Z')), dataStriscia(new Date('2026-11-13T10:00:00Z')))
})

test('fuso di Roma a cavallo della mezzanotte: le 23:30 UTC sono già il giorno dopo', () => {
  assert.equal(dataStriscia(new Date('2026-11-11T23:30:00Z')), 'Giovedì 12 novembre 2026')
  // d'estate (UTC+2) basta anche le 22:30 UTC
  assert.equal(dataStriscia(new Date('2026-07-31T22:30:00Z')), 'Sabato 1 agosto 2026')
  assert.equal(dataStriscia(new Date('2026-07-31T21:30:00Z')), 'Venerdì 31 luglio 2026')
})

test('la striscia della Home calcola la data nel browser e la ricontrolla da sola', () => {
  const s = leggi('components/maison/StrisciaFoto.tsx')
  assert.doesNotMatch(s, /suppressHydrationWarning/)
  assert.doesNotMatch(s, /dataStriscia\(\s*\)/, 'mai dataStriscia() senza data: la data va passata dal browser')
  assert.doesNotMatch(s, /\{dataStriscia\(new Date\(\)\)\}/, 'mai calcolata nel JSX')
  assert.match(s, /useEffect/)
  assert.match(s, /visibilitychange/)
  assert.match(s, /pageshow/)
  assert.match(s, /RICONTROLLO_DATA_MS/)
  // finché la data non c'è la riga resta, vuota ma alta uguale (spazio unificatore)
  assert.match(s, /\{data \?\? '\\u00a0'\}/)
  assert.ok(RICONTROLLO_DATA_MS > 0 && RICONTROLLO_DATA_MS <= 60000)
})
