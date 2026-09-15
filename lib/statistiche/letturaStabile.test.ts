// La lettura a pagine dev'essere completa e stabile (rilievo 8 del 15/09/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const dati = readFileSync(new URL('../statisticheDati.ts', import.meta.url), 'utf8')

test('ogni lettura a pagine ha un secondo criterio d’ordine', () => {
  // senza, due righe con la stessa data possono comparire due volte o mai
  const ordini = [...dati.matchAll(/\.order\([^)]*\)(\s*\.order\([^)]*\))?[\s\S]{0,80}?\.range\(/g)].map(m => m[0])
  assert.ok(ordini.length >= 6, `trovate solo ${ordini.length} letture a pagine`)
  for (const o of ordini) {
    const quanti = (o.match(/\.order\(/g) ?? []).length
    assert.ok(quanti >= 2, `una lettura a pagine ha un ordine solo: ${o.slice(0, 80)}`)
  }
})

test('anche la lettura per blocchi è ordinata', () => {
  assert.match(dati, /\.in\('status', STATI_LETTI\)\.in\(colonna, blocco\)\s*\n\s*\.order\('check_in', \{ ascending: true \}\)\.order\('id', \{ ascending: true \}\)/)
})

test('la ricostruzione legge anche prenotazione_id e le altre camere', () => {
  assert.match(dati, /const colonne = 'id, prenotazione_id, group_id/)
  assert.match(dati, /\['group_id', gruppi\], \['prenotazione_id', prenotazioni_id\]/)
})

test('le richieste portano il collegamento alla prenotazione', () => {
  assert.match(dati, /COLONNE_RICHIESTE = '[^']*prenotazione_id[^']*'/)
  assert.match(dati, /COLONNE_RICHIESTE = '[^']*chiusa_at[^']*'/)
})
