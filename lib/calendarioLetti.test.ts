import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  COLORE_LETTO_PARZIALE,
  COLORE_LETTI_ESAURITI,
  coloreLettiAggiuntivi,
  coloreLettiPerGiorno,
  statoLettiAggiuntivi,
} from './calendarioLetti.ts'

const paginaCalendario = readFileSync(new URL('../app/calendario/page.tsx', import.meta.url), 'utf8')

test('un letto occupato resta terracotta, due letti su due diventano neri', () => {
  assert.equal(statoLettiAggiuntivi(0), 'liberi')
  assert.equal(statoLettiAggiuntivi(1), 'parziali')
  assert.equal(statoLettiAggiuntivi(2), 'esauriti')
  assert.equal(statoLettiAggiuntivi(3), 'esauriti')
  assert.equal(coloreLettiAggiuntivi(1), COLORE_LETTO_PARZIALE)
  assert.equal(coloreLettiAggiuntivi(2), COLORE_LETTI_ESAURITI)
})

test('il calendario guarda il totale della notte: una quadrupla da sola è nera', () => {
  const occupazione = new Map([
    ['2026-09-01', 1],
    ['2026-09-02', 2],
  ])

  assert.equal(coloreLettiPerGiorno(occupazione, '2026-09-01'), COLORE_LETTO_PARZIALE)
  assert.equal(coloreLettiPerGiorno(occupazione, '2026-09-02'), COLORE_LETTI_ESAURITI)
})

test('la pagina usa il totale del pool senza sottrarre la prenotazione corrente', () => {
  assert.match(paginaCalendario, /coloreLettiPerGiorno\(extraBedsMap, dateStr\)/)
  assert.doesNotMatch(paginaCalendario, /const others =/)
  assert.match(paginaCalendario, /background: isFull \? COLORE_LETTI_ESAURITI/)
})
