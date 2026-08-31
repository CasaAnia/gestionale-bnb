// ============================================================================
// Test dei CAMPI IMPORTO della revisione — si provano i VERI gestori usati
// dal componente (gestoreImporto applica allo stato solo se valido), non
// soltanto le funzioni numeriche. Casi della revisione indipendente:
// −0,01 mostrato col segno; digitare −0,01 valido sugli arrotondamenti;
// digitare 0 azzera davvero; campo obbligatorio svuotato che BLOCCA senza
// confermare il vecchio valore invisibile.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gestoreImporto, gestoreNumero, interpretaImporto, testoCampo, testoNumero } from './campiImporto.ts'
import { apriRevisione, blocchiConferma, modificaTotale, quadratura } from './revisione.ts'
import type { BozzaGrezza, RigaGrezza } from './revisione.ts'

test('visualizzazione: il segno si vede (−1 cent → "-0,01"), zero e assente restano campo vuoto', () => {
  assert.equal(testoCampo('arrotondamento', -1), '-0,01')
  assert.equal(testoCampo('arrotondamento', 1), '0,01')
  assert.equal(testoCampo('arrotondamento', 0), '')
  assert.equal(testoCampo('totale', null), '')
  assert.equal(testoCampo('totale', 1250), '12,50')
  assert.equal(testoCampo('riga', 250), '2,50')
  assert.equal(testoCampo('facoltativo', null), '')
})

test('ARROTONDAMENTO: digitare -0,01 è VALIDO e applica −1 cent; 0 e campo vuoto azzerano davvero', () => {
  const applicati: (number | null)[] = []
  const gestore = gestoreImporto('arrotondamento', c => applicati.push(c))
  assert.equal(gestore('-0,01').tipo, 'valido')
  assert.equal(gestore('0').tipo, 'valido')            // azzera il precedente
  assert.equal(gestore('').tipo, 'valido')             // anche svuotare azzera
  assert.equal(gestore('0,03').tipo, 'valido')
  assert.equal(gestore('+0,02').tipo, 'valido')
  assert.deepEqual(applicati, [-1, 0, 0, 3, 2])
  // il solo segno o testo spurio: invalido, NON applicato
  assert.equal(gestore('-').tipo, 'invalido')
  assert.equal(gestore('abc').tipo, 'invalido')
  assert.deepEqual(applicati, [-1, 0, 0, 3, 2])
})

test('TOTALE: svuotare il campo NON conserva il vecchio valore invisibile — diventa null e la conferma si blocca', () => {
  const applicati: (number | null)[] = []
  const gestore = gestoreImporto('totale', c => applicati.push(c))
  assert.equal(gestore('12,50').tipo, 'valido')
  assert.equal(gestore('').tipo, 'valido')             // applicato: null
  assert.deepEqual(applicati, [1250, null])
  assert.equal(gestore('abc').tipo, 'invalido')        // non applicato
  assert.equal(gestore('-5').tipo, 'invalido')         // il totale non è mai negativo
  assert.deepEqual(applicati, [1250, null])
  // sulla revisione intera: totale svuotato → blocco esplicito
  const bozze = [{
    id: 'b1', document_id: 'd', status: 'da_controllare', expense_date: '2026-08-29',
    group_id: 'g-casa', category_id: null, subcategory: null,
    canonical_category_id: null, canonical_subcategory_id: null,
    store: null, description: null, payment_method: 'contanti',
    room_id: null, expense_nature: null, arrotondamento_cent: 0, confidence: null,
  }] as BozzaGrezza[]
  const righe = [{
    id: 'r1', draft_id: 'b1', raw_name: null, name: 'Voce', qty: 1,
    unit_price: null, discount: 0, amount: 5, group_id: null,
    category_id: null, subcategory: null, canonical_category_id: null,
    canonical_subcategory_id: null, necessity: null, planning: null,
    excluded: false, user_added: false, confidence: null,
  }] as RigaGrezza[]
  let s = apriRevisione('d', 5, bozze, righe)
  s = modificaTotale(s, null)
  assert.equal(quadratura(s).ok, false)
  assert.ok(blocchiConferma(s, () => 'personale').some(b => b.includes('totale del documento mancante')))
})

test('RIGA: mai vuota, mai zero, mai negativa — invalida BLOCCA e non applica nulla', () => {
  const applicati: (number | null)[] = []
  const gestore = gestoreImporto('riga', c => applicati.push(c))
  assert.equal(gestore('2,50').tipo, 'valido')
  assert.equal(gestore('').tipo, 'invalido')
  assert.equal(gestore('0').tipo, 'invalido')
  assert.equal(gestore('-1').tipo, 'invalido')
  assert.deepEqual(applicati, [250])
})

test('CAMPI NUMERICI fedeli alla 0020: quantità 3 decimali MAI null (vuota→1), prezzo 3 decimali nullable, sconto 2 decimali MAI null (vuoto→0)', () => {
  const quantita: (number | null)[] = []
  const gq = gestoreNumero('quantita', v => quantita.push(v))
  assert.equal(gq('0,472').tipo, 'valido')             // kg con tre decimali
  assert.equal(gq('3').tipo, 'valido')
  assert.equal(gq('').tipo, 'valido')                  // svuotata → DEFAULT 1, mai null
  assert.deepEqual(quantita, [0.472, 3, 1])
  assert.equal(gq('0').tipo, 'invalido')               // check qty > 0
  assert.equal(gq('1,2345').tipo, 'invalido')          // oltre i 3 decimali
  assert.deepEqual(quantita, [0.472, 3, 1])
  const prezzi: (number | null)[] = []
  const gp = gestoreNumero('prezzo_unitario', v => prezzi.push(v))
  assert.equal(gp('7,945').tipo, 'valido')             // tre decimali conservati
  assert.equal(gp('').tipo, 'valido')                  // può mancare (nullable vero)
  assert.deepEqual(prezzi, [7.945, null])
  const sconti: (number | null)[] = []
  const gs = gestoreNumero('sconto', v => sconti.push(v))
  assert.equal(gs('1,50').tipo, 'valido')
  assert.equal(gs('0').tipo, 'valido')                 // zero esplicito vale
  assert.equal(gs('').tipo, 'valido')                  // svuotato → DEFAULT 0, mai null
  assert.deepEqual(sconti, [1.5, 0, 0])
  assert.equal(gs('1,505').tipo, 'invalido')           // lo sconto ha 2 decimali
  // visualizzazione senza il punto anglosassone
  assert.equal(testoNumero(0.472), '0,472')
  assert.equal(testoNumero(1), '1')
  assert.equal(testoNumero(null), '')
})

test('FACOLTATIVO (prezzo unitario, sconto): vuoto vale assente, positivo vale, zero e negativo no', () => {
  const applicati: (number | null)[] = []
  const gestore = gestoreImporto('facoltativo', c => applicati.push(c))
  assert.equal(gestore('1,20').tipo, 'valido')
  assert.equal(gestore('').tipo, 'valido')
  assert.deepEqual(applicati, [120, null])
  assert.equal(gestore('0').tipo, 'invalido')
  assert.equal(interpretaImporto('facoltativo', '-2').tipo, 'invalido')
  assert.deepEqual(applicati, [120, null])
})
