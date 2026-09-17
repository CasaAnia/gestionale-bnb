// «Tariffe» (17/09/2026): la logica pura del foglio
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contoSoggiorno } from './conto.ts'
import { vociTariffa, tariffaDaCampo, campiTariffe, anteprimaTariffe, righeAnteprimaTariffe, ERRORE_TARIFFA, ERRORE_SCONTO_SOPRA } from './tariffaScheda.ts'

const lena = { id: 'a', status: 'confermata', check_in: '2026-09-12', check_out: '2026-09-14', price_per_night: 80, extra_bed_total: 0, discount_type: null, discount_value: null, total_amount: 160, rooms: { name: 'Lena' } }
const amelia = { id: 'b', status: 'confermata', check_in: '2026-09-14', check_out: '2026-09-16', price_per_night: 65, extra_bed_total: 0, discount_type: null, discount_value: null, total_amount: 130, rooms: { name: 'Amelia' } }
const annullata = { ...lena, id: 'z', status: 'annullata' }

test('una riga per tratto attivo, con la tariffa salvata già scritta', () => {
  assert.deepEqual(vociTariffa([lena, amelia, annullata]), [
    { id: 'a', camera: 'Lena', periodo: '12 → 14', tariffa: '80', aNotte: '80 € a notte' },
    { id: 'b', camera: 'Amelia', periodo: '14 → 16', tariffa: '65', aNotte: '65 € a notte' },
  ])
  assert.equal(vociTariffa([{ ...lena, price_per_night: 62.5 }])[0].tariffa, '62.50')
})

test('il campo accetta la virgola, rifiuta il resto', () => {
  assert.equal(tariffaDaCampo('62,5'), 62.5)
  assert.equal(tariffaDaCampo('80'), 80)
  assert.equal(tariffaDaCampo(''), null)
  assert.equal(tariffaDaCampo('abc'), null)
  assert.equal(tariffaDaCampo('-5'), null)
})

test('cambia solo chi ha una tariffa diversa; il totale si rilegge con contoSoggiorno, letto e sconto compresi', () => {
  const r = campiTariffe([lena, amelia, annullata], { a: '90', b: '65' })
  assert.ok(r.ok)
  assert.deepEqual(r.righe, [{ id: 'a', campi: { price_per_night: 90, total_amount: 180 } }])
  // col letto in più e la percentuale: 90×2 + 20 = 200, −10 % = 180
  const conLetto = { ...lena, extra_bed_total: 20, discount_type: 'percentage', discount_value: 10, total_amount: 162 }
  const r2 = campiTariffe([conLetto], { a: '90' })
  assert.ok(r2.ok)
  assert.deepEqual(r2.righe[0].campi, { price_per_night: 90, total_amount: 180 })
  assert.equal(contoSoggiorno({ ...conLetto, ...r2.righe[0].campi }).totale, 180)
  // un campo vuoto o storto blocca, con la camera nel messaggio
  assert.deepEqual(campiTariffe([lena], { a: '' }), { ok: false, errore: ERRORE_TARIFFA('Lena') })
})

test('il prezzo finale concordato che non sta più sotto il pieno: non si salva, prima lo sconto', () => {
  const concordata = { ...lena, discount_type: 'target_total', discount_value: 150, total_amount: 150 }
  assert.deepEqual(campiTariffe([concordata], { a: '70' }), { ok: false, errore: ERRORE_SCONTO_SOPRA('Lena') })
  const ok = campiTariffe([concordata], { a: '100' })
  assert.ok(ok.ok)
  assert.equal(ok.righe[0].campi.total_amount, 150)   // il concordato resta
})

test('totale attuale e nuovo totale', () => {
  const a = anteprimaTariffe([lena, amelia, annullata], { a: '90', b: '70' })
  assert.deepEqual(a, { attualeCent: 29000, nuovoCent: 32000 })
  assert.deepEqual(righeAnteprimaTariffe(a).map(r => `${r.testo} ${r.importo}`), ['Totale attuale 290 €', 'Nuovo totale 320 €'])
  // con un campo storto il nuovo totale resta quello attuale
  assert.equal(anteprimaTariffe([lena], { a: 'x' }).nuovoCent, 16000)
})
