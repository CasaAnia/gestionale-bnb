import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { VOCI_SPAZI, nomeAttivita, minutiPerVoce, vociSpaziAttive, voceSpazi } from './tempoPulizie.ts'

test('spazi comuni: i nomi di Ania, in quest\'ordine', () => {
  assert.deepEqual(VOCI_SPAZI.map(v => v[1]), ['Corridoio e angolo caffè', 'Piegatura asciugamani', 'Altro'])
  assert.deepEqual(vociSpaziAttive(false).map(v => v[0]), ['corridoio', 'piegatura'])
  assert.equal(nomeAttivita('area_comune'), 'Corridoio e angolo caffè')
  assert.equal(nomeAttivita('piegatura'), 'Piegatura asciugamani')
  assert.equal(voceSpazi('sconosciuta'), null)
})

test('area_comune si legge sotto il corridoio, sommata una volta sola; i dati restano quelli', () => {
  const righe = [{ attivita: 'area_comune', minuti: 20, aggiornato_at: '2026-10-01T06:00:00Z' }, { attivita: 'corridoio', minuti: 12, aggiornato_at: '2026-10-01T06:10:00Z' }, { attivita: 'piegatura', minuti: 0 }]
  const copia = JSON.parse(JSON.stringify(righe))
  const v = minutiPerVoce(righe)
  assert.equal(v.corridoio.minuti, 32)
  assert.equal(v.corridoio.ultimo, '2026-10-01T06:10:00Z')
  assert.equal(v.piegatura.minuti, 0)
  assert.equal(v.altro.minuti, 0)
  assert.deepEqual(righe, copia)
})

test('Home: il timer degli spazi comuni ha il nome nuovo e non propone più area_comune', () => {
  const home = readFileSync(new URL('../components/PulizieOggi.tsx', import.meta.url), 'utf8')
  assert.ok(!home.includes("'area_comune'"), 'la Home non avvia più tempi nuovi su area_comune')
  assert.ok(home.includes("chiaveTimerFuori(oggi, 'corridoio')"))
})
