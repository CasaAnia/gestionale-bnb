// ============================================================================
// LO SCONTO DALLA SCHEDA NUOVA (17/09/2026): le regole pure. Con una camera e
// con più camere il conto deve tornare al centesimo anche dopo la rilettura,
// cioè leggendo i campi salvati con la stessa `contoSoggiorno` della scheda.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { contoSoggiorno } from './conto.ts'
import { contoPrenotazione } from './prenotazioneUnica.ts'
import {
  scontoSalvato, valoreIniziale, valoreDaCampo, erroreSconto, anteprimaSconto, righeAnteprima, nienteDaSalvare, prezzoPienoRiga,
  ERRORE_PERCENTUALE, ERRORE_FINALE, ERRORE_NIENTE_RIGHE, TIPI_SCONTO,
} from './scontoScheda.ts'

const lena = { id: 'a', status: 'confermata', check_in: '2026-10-05', check_out: '2026-10-08', price_per_night: 80, extra_bed_total: 0, discount_type: null, discount_value: null, total_amount: 240 }
const allegra = { id: 'b', status: 'confermata', check_in: '2026-10-05', check_out: '2026-10-08', price_per_night: 70, extra_bed_total: 30, discount_type: null, discount_value: null, total_amount: 240 }
const annullata = { ...lena, id: 'z', status: 'annullata', total_amount: 999 }

// Rilegge le righe come farà la scheda: i campi salvati passano da contoSoggiorno
const rilette = (righe: typeof lena[], a: ReturnType<typeof anteprimaSconto>) =>
  righe.map(r => {
    const n = a.righe.find(x => x.id === r.id)
    return n ? { ...r, ...n.campi } : r
  })

test('le tre forme del foglio, nell’ordine dell’inserimento', () => {
  assert.deepEqual(TIPI_SCONTO.map(t => t.chiave), ['nessuno', 'percentuale', 'finale'])
})

test('il prezzo pieno ignora sconto e totale salvato: tariffa × notti + letto', () => {
  assert.equal(prezzoPienoRiga({ ...lena, discount_type: 'percentage', discount_value: 10, total_amount: 216 }), 240)
  assert.equal(prezzoPienoRiga(allegra), 240)
})

test('lo sconto salvato si rilegge: percentuale uguale su tutte, prezzo finale come somma, altrimenti nessuno', () => {
  assert.deepEqual(scontoSalvato([lena, allegra, annullata]), { tipo: 'nessuno', valore: null })
  assert.deepEqual(scontoSalvato([{ ...lena, discount_type: 'percentage', discount_value: 10 }, { ...allegra, discount_type: 'percentage', discount_value: '10' }]), { tipo: 'percentuale', valore: 10 })
  assert.deepEqual(scontoSalvato([{ ...lena, discount_type: 'target_total', discount_value: 200 }, { ...allegra, discount_type: 'target_total', discount_value: 200.5 }]), { tipo: 'finale', valore: 400.5 })
  // percentuali diverse fra le righe: non è una forma del foglio
  assert.deepEqual(scontoSalvato([{ ...lena, discount_type: 'percentage', discount_value: 10 }, { ...allegra, discount_type: 'percentage', discount_value: 20 }]), { tipo: 'nessuno', valore: null })
  // le annullate non contano
  assert.deepEqual(scontoSalvato([{ ...lena, discount_type: 'percentage', discount_value: 10 }, { ...annullata, discount_type: 'target_total', discount_value: 1 }]), { tipo: 'percentuale', valore: 10 })
  assert.equal(valoreIniziale({ tipo: 'percentuale', valore: 10 }), '10')
  assert.equal(valoreIniziale({ tipo: 'nessuno', valore: null }), '')
})

test('il campo accetta la virgola e rifiuta il resto', () => {
  assert.equal(valoreDaCampo('12,5'), 12.5)
  assert.equal(valoreDaCampo(' 200 '), 200)
  assert.equal(valoreDaCampo(''), null)
  assert.equal(valoreDaCampo('abc'), null)
})

test('gli errori: percentuale fuori da 0–100, prezzo finale non sotto il pieno, nessuna camera attiva', () => {
  assert.equal(erroreSconto([lena], { tipo: 'nessuno', valore: null }), null)
  assert.equal(erroreSconto([lena], { tipo: 'percentuale', valore: 0 }), ERRORE_PERCENTUALE)
  assert.equal(erroreSconto([lena], { tipo: 'percentuale', valore: 100 }), ERRORE_PERCENTUALE)
  assert.equal(erroreSconto([lena], { tipo: 'percentuale', valore: null }), ERRORE_PERCENTUALE)
  assert.equal(erroreSconto([lena], { tipo: 'percentuale', valore: 15 }), null)
  assert.equal(erroreSconto([lena], { tipo: 'finale', valore: 240 }), ERRORE_FINALE(24000))
  assert.equal(erroreSconto([lena], { tipo: 'finale', valore: 0 }), ERRORE_FINALE(24000))
  assert.equal(erroreSconto([lena, allegra], { tipo: 'finale', valore: 400 }), null)
  assert.equal(erroreSconto([annullata], { tipo: 'nessuno', valore: null }), ERRORE_NIENTE_RIGHE)
})

test('una camera, percentuale: totale attuale, nuovo totale e resta coi pagamenti', () => {
  const a = anteprimaSconto([lena], 10000, { tipo: 'percentuale', valore: 10 })
  assert.equal(a.attualeCent, 24000)
  assert.equal(a.nuovoCent, 21600)
  assert.equal(a.restaCent, 11600)
  assert.equal(a.oltre, false)
  assert.deepEqual(a.righe, [{ id: 'a', campi: { discount_type: 'percentage', discount_value: 10, total_amount: 216 } }])
  assert.deepEqual(righeAnteprima(a).map(r => `${r.testo} ${r.importo}`), ['Totale attuale 240 €', 'Nuovo totale 216 €', 'Resta da incassare 116 €'])
})

test('una camera, prezzo finale: target_total con quel numero', () => {
  const a = anteprimaSconto([lena], 0, { tipo: 'finale', valore: 199.9 })
  assert.equal(a.nuovoCent, 19990)
  assert.deepEqual(a.righe[0].campi, { discount_type: 'target_total', discount_value: 199.9, total_amount: 199.9 })
  assert.equal(contoSoggiorno({ ...lena, ...a.righe[0].campi }).totale, 199.9)
})

test('togliere lo sconto: discount null e totale = prezzo pieno; «Sconto tolto» vale anche col totale storico', () => {
  const scontata = { ...lena, discount_type: 'percentage', discount_value: 10, total_amount: 216 }
  const a = anteprimaSconto([scontata], 0, { tipo: 'nessuno', valore: null })
  assert.equal(a.attualeCent, 21600)
  assert.equal(a.nuovoCent, 24000)
  assert.deepEqual(a.righe[0].campi, { discount_type: null, discount_value: null, total_amount: 240 })
})

test('più camere, prezzo finale: la somma torna al centesimo anche riletta con contoSoggiorno', () => {
  // 240 + 240 = 480 pieno; prezzo finale 1000/3 di cui non si può far tornare la metà esatta
  const righe = [lena, { ...allegra, price_per_night: 55, extra_bed_total: 25, total_amount: 190 }]
  const a = anteprimaSconto(righe, 0, { tipo: 'finale', valore: 333.33 })
  assert.equal(a.nuovoCent, 33333)
  const dopo = rilette(righe, a)
  const somma = dopo.reduce((s, r) => s + Math.round(contoSoggiorno(r).totale * 100), 0)
  assert.equal(somma, 33333)
  assert.equal(contoPrenotazione(dopo as never, []).totaleCent, 33333)
  // ogni riga porta la SUA quota, non una percentuale spalmata
  assert.ok(a.righe.every(r => r.campi.discount_type === 'target_total'))
})

test('più camere, percentuale: il nuovo totale è la somma delle righe rilette, uguale a quello scritto', () => {
  const righe = [{ ...lena, price_per_night: 33.33, total_amount: 99.99 }, { ...allegra, price_per_night: 66.67, extra_bed_total: 0, total_amount: 200.01 }]
  const a = anteprimaSconto(righe, 5000, { tipo: 'percentuale', valore: 33 })
  const dopo = rilette(righe, a)
  const somma = dopo.reduce((s, r) => s + Math.round(contoSoggiorno(r).totale * 100), 0)
  assert.equal(a.nuovoCent, somma)
  assert.equal(contoPrenotazione(dopo as never, []).totaleCent, a.nuovoCent)
  assert.equal(a.restaCent, a.nuovoCent - 5000)
})

test('le camere annullate non si toccano e non entrano nel conto', () => {
  const a = anteprimaSconto([lena, annullata], 0, { tipo: 'percentuale', valore: 50 })
  assert.deepEqual(a.righe.map(r => r.id), ['a'])
  assert.equal(a.attualeCent, 24000)
  assert.equal(a.nuovoCent, 12000)
})

test('i pagamenti oltre il nuovo totale: resta 0 e si avvisa', () => {
  const a = anteprimaSconto([lena], 23000, { tipo: 'percentuale', valore: 10 })
  assert.equal(a.restaCent, 0)
  assert.equal(a.oltre, true)
})

test('con uno sconto non valido l’anteprima mostra il prezzo pieno (niente sconto)', () => {
  const a = anteprimaSconto([lena], 0, { tipo: 'percentuale', valore: 150 })
  assert.equal(a.nuovoCent, 24000)
})

test('niente da salvare: gli stessi campi di adesso (Annulla o «Salva» senza cambiare nulla non scrivono)', () => {
  const scontata = { ...lena, discount_type: 'percentage', discount_value: '10', total_amount: '216' }
  assert.equal(nienteDaSalvare([scontata], anteprimaSconto([scontata], 0, { tipo: 'percentuale', valore: 10 })), true)
  assert.equal(nienteDaSalvare([scontata], anteprimaSconto([scontata], 0, { tipo: 'percentuale', valore: 12 })), false)
  assert.equal(nienteDaSalvare([lena], anteprimaSconto([lena], 0, { tipo: 'nessuno', valore: null })), true)
  // un totale storico diverso dal pieno, senza sconto: «Nessuno» lo riporterebbe al pieno, quindi c'è da salvare
  assert.equal(nienteDaSalvare([{ ...lena, total_amount: 230 }], anteprimaSconto([{ ...lena, total_amount: 230 }], 0, { tipo: 'nessuno', valore: null })), false)
})
