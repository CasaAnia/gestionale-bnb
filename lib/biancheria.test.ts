// Recupero biancheria (06/09/2026): limiti, tocco dei chip, riassunto e plurali
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { vuoto, tocca, normalizza, totale, testoTotale, riassunto, elencoVoci, sommaPerVoce, nelPeriodo, tabellaBiancheriaAssente, LIMITE, VOCI, CHIAVI } from './biancheria.ts'

test('limiti: federe 4, lenzuola e tappeti 1, teli e asciugamani 2; otto voci in due gruppi', () => {
  assert.deepEqual(LIMITE, { federe: 4, lenzuolo_sotto: 1, lenzuolo_sopra: 1, telo_doccia: 2, asciugamano_viso: 2, asciugamano_mani: 2, tappetino_doccia: 1, tappeto_bagno: 1 })
  assert.equal(CHIAVI.length, 8)
  assert.deepEqual(VOCI.filter(v => v.gruppo === 'lenzuola').map(v => v.chip), ['Federa', 'Sotto', 'Sopra'])
  assert.deepEqual(VOCI.filter(v => v.gruppo === 'asciugamani').map(v => v.chip), ['Telo doccia', 'Viso', 'Mani', 'Tappetino doccia', 'Tappeto bagno'])
})

test('tocco: +1 fino al massimo, poi torna a 0', () => {
  let v = vuoto()
  assert.equal(totale(v), 0)
  v = tocca(v, 'lenzuolo_sotto'); assert.equal(v.lenzuolo_sotto, 1)
  v = tocca(v, 'lenzuolo_sotto'); assert.equal(v.lenzuolo_sotto, 0)      // max 1 → torna a 0
  for (let i = 1; i <= 4; i++) { v = tocca(v, 'federe'); assert.equal(v.federe, i) }
  v = tocca(v, 'federe'); assert.equal(v.federe, 0)                      // max 4 → torna a 0
  v = tocca(tocca(tocca(v, 'telo_doccia'), 'telo_doccia'), 'telo_doccia'); assert.equal(v.telo_doccia, 0)
})

test('normalizza: valori letti da fuori restano nei limiti, mai negativi, mancanti = 0', () => {
  const n = normalizza({ federe: 9, telo_doccia: -1, tappeto_bagno: '1', asciugamano_viso: 'x' })
  assert.equal(n.federe, 4); assert.equal(n.telo_doccia, 0); assert.equal(n.tappeto_bagno, 1); assert.equal(n.asciugamano_viso, 0); assert.equal(n.lenzuolo_sopra, 0)
  assert.deepEqual(normalizza(null), vuoto())
})

test('riassunto e plurali: «Recuperato: 2 federe, telo doccia»; l\'1 non si scrive; niente → null', () => {
  const v = { ...vuoto(), federe: 2, telo_doccia: 1 }
  assert.equal(riassunto(v), 'Recuperato: 2 federe, telo doccia')
  assert.equal(riassunto(vuoto()), null)
  assert.equal(elencoVoci({ ...vuoto(), federe: 1, lenzuolo_sotto: 1, asciugamano_mani: 2, tappeto_bagno: 1 }), 'federa, lenzuolo sotto, 2 asciugamani mani, tappeto bagno')
  assert.equal(elencoVoci({ ...vuoto(), telo_doccia: 2, asciugamano_viso: 2 }), '2 teli doccia, 2 asciugamani viso')
})

test('totale in parole: Niente recuperato / 1 pezzo recuperato / N pezzi recuperati', () => {
  assert.equal(testoTotale(vuoto()), 'Niente recuperato')
  assert.equal(testoTotale({ ...vuoto(), tappetino_doccia: 1 }), '1 pezzo recuperato')
  assert.equal(testoTotale({ ...vuoto(), federe: 3, telo_doccia: 2 }), '5 pezzi recuperati')
})

test('statistiche: somma per voce nel periodo scelto, nell\'ordine della scheda', () => {
  const righe = [
    { ...vuoto(), data: '2026-09-02', federe: 2, telo_doccia: 1 },
    { ...vuoto(), data: '2026-09-20', federe: 1 },
    { ...vuoto(), data: '2026-10-01', federe: 4 },       // fuori periodo
    { ...vuoto(), data: '2026-08-31', tappeto_bagno: 1 }, // fuori periodo
  ]
  const somme = sommaPerVoce(nelPeriodo(righe, '2026-09-01', '2026-10-01'))
  assert.deepEqual(somme.map(s => [s.etichetta, s.n]), [['federe', 3], ['lenzuola sotto', 0], ['lenzuola sopra', 0], ['teli doccia', 1], ['asciugamani viso', 0], ['asciugamani mani', 0], ['tappetini doccia', 0], ['tappeti bagno', 0]])
})

test('tabella assente = migrazione 0039 non applicata (PGRST205 / 42P01), altri errori no', () => {
  assert.equal(tabellaBiancheriaAssente({ code: 'PGRST205' }), true)
  assert.equal(tabellaBiancheriaAssente({ code: '42P01' }), true)
  assert.equal(tabellaBiancheriaAssente({ code: '42501' }), false)
  assert.equal(tabellaBiancheriaAssente(null), false)
})
