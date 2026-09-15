// I giorni cominciano a Roma (rilievo 7 del 15/09/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inizioGiornoRoma, scartoRoma, dentroIlPeriodoRoma } from './confiniRoma.ts'

test('d’estate Roma è due ore avanti, d’inverno una', () => {
  assert.equal(inizioGiornoRoma('2026-09-01'), '2026-09-01T00:00:00+02:00')
  assert.equal(inizioGiornoRoma('2026-01-15'), '2026-01-15T00:00:00+01:00')
  assert.equal(scartoRoma(new Date('2026-07-01T12:00:00Z')), 120)
  assert.equal(scartoRoma(new Date('2026-12-01T12:00:00Z')), 60)
})

test('la notte del cambio ora non sbanda', () => {
  // l'ora legale finisce domenica 25 ottobre 2026: il 25 comincia ancora a +02
  assert.equal(inizioGiornoRoma('2026-10-25'), '2026-10-25T00:00:00+02:00')
  assert.equal(inizioGiornoRoma('2026-10-26'), '2026-10-26T00:00:00+01:00')
  // e in primavera, quando l'ora legale comincia (29 marzo 2026)
  assert.equal(inizioGiornoRoma('2026-03-29'), '2026-03-29T00:00:00+01:00')
  assert.equal(inizioGiornoRoma('2026-03-30'), '2026-03-30T00:00:00+02:00')
})

test('un evento dopo mezzanotte finisce nel giorno giusto', () => {
  // caso vero dall'archivio: 29 agosto 22:32 UTC = 30 agosto 00:32 a Roma
  const evento = '2026-08-29T22:32:27.979082+00:00'
  assert.equal(dentroIlPeriodoRoma(evento, '2026-08-29', '2026-08-30'), false)
  assert.equal(dentroIlPeriodoRoma(evento, '2026-08-30', '2026-08-31'), true)
})

test('un evento del primo giorno del mese non si perde sul confine', () => {
  // 31 agosto 22:30 UTC = 1 settembre 00:30 a Roma: è di settembre
  const evento = '2026-08-31T22:30:00+00:00'
  assert.equal(dentroIlPeriodoRoma(evento, '2026-09-01', '2026-10-01'), true)
  assert.equal(dentroIlPeriodoRoma(evento, '2026-08-01', '2026-09-01'), false)
})

test('una data storta non entra da nessuna parte', () => {
  assert.equal(dentroIlPeriodoRoma('non è una data', '2026-09-01', '2026-10-01'), false)
})

test('le letture chiedono gli estremi con l’ora di Roma', async () => {
  const { readFileSync } = await import('node:fs')
  const dati = readFileSync(new URL('../statisticheDati.ts', import.meta.url), 'utf8')
  assert.match(dati, /\.gte\('created_at', inizioGiornoRoma\(da\)\)\.lt\('created_at', inizioGiornoRoma\(a\)\)/)
  assert.doesNotMatch(dati, /gte\('created_at', `\$\{da\}T00:00:00`\)/)
  // e l'imbuto del sito filtra con gli stessi confini
  const site = readFileSync(new URL('../siteStats.ts', import.meta.url), 'utf8')
  assert.match(site, /dentroIlPeriodoRoma\(event\.created_at, da, a\)/)
})
