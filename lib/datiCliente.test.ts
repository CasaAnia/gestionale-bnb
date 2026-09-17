import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moduloDaCliente, campiDaModulo, campiNuovoCliente, SENZA_NOME, SENZA_TELEFONO } from './datiCliente.ts'

const CARMELA = {
  id: 'c1', full_name: 'Carmela Sabia', phone: '393427004354', rating: 'ottimo', vuole_ricevuta: true,
  notes: 'Dorme male con i rumori.', motivo_problematico: null, provenienza: 'altra_struttura', struttura_nome: 'Nida',
}

test('dal cliente salvato al modulo: i due campi del nome, e tutto il resto com’è', () => {
  assert.deepEqual(moduloDaCliente(CARMELA), {
    nome: 'Carmela', cognome: 'Sabia', telefono: '393427004354', email: '', ricevuta: true, valutazione: 'ottimo', motivo: '',
    provenienza: 'altra_struttura', struttura: 'Nida', note: 'Dorme male con i rumori.',
  })
  // prima della 0038 la ricevuta stava nella valutazione: si legge lo stesso
  const vecchio = moduloDaCliente({ full_name: 'Anna Rossi', rating: 'vuole_ricevuta' })
  assert.equal(vecchio.ricevuta, true)
  assert.equal(vecchio.valutazione, 'normale')
  assert.equal(moduloDaCliente(null).provenienza, null)
})

test('dal modulo ai campi: il nome si rimette insieme con nomeCompleto e le iniziali maiuscole', () => {
  const m = { ...moduloDaCliente(CARMELA), nome: 'carmela', cognome: 'sabia rossi' }
  const r = campiDaModulo(m, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.ok(r.ok)
  assert.equal(r.campi.full_name, 'Carmela Sabia Rossi')
  // il telefono non è stato toccato: resta scritto com'era
  assert.equal(r.campi.phone, '393427004354')
  assert.deepEqual([r.campi.rating, r.campi.vuole_ricevuta, r.campi.notes], ['ottimo', true, 'Dorme male con i rumori.'])
  assert.deepEqual([r.campi.provenienza, r.campi.struttura_nome], ['altra_struttura', 'Nida'])
  assert.equal('motivo_problematico' in r.campi, false, 'il motivo non è cambiato: non si scrive')
})

test('il telefono cambiato si normalizza; vuoto o troppo corto non si salva', () => {
  const m = moduloDaCliente(CARMELA)
  const cambiato = campiDaModulo({ ...m, telefono: '333 123 4567' }, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.ok(cambiato.ok && cambiato.campi.phone === '393331234567')
  const corto = campiDaModulo({ ...m, telefono: '12' }, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.deepEqual(corto, { ok: false, errore: SENZA_TELEFONO })
  const senzaNome = campiDaModulo({ ...m, nome: '', cognome: ' ' }, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.deepEqual(senzaNome, { ok: false, errore: SENZA_NOME })
})

test('la valutazione: prima della 0038 la forma vecchia; il motivo solo se cambia; via col «!» che se ne va', () => {
  const m = moduloDaCliente(CARMELA)
  const vecchia = campiDaModulo(m, CARMELA, { colonnaRicevuta: false, conProvenienza: false })
  assert.ok(vecchia.ok)
  assert.equal(vecchia.campi.rating, 'vuole_ricevuta')
  assert.equal('vuole_ricevuta' in vecchia.campi, false)
  assert.equal('provenienza' in vecchia.campi, false)
  const problematica = campiDaModulo({ ...m, valutazione: 'problematico', motivo: ' non paga ' }, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.ok(problematica.ok && problematica.campi.rating === 'problematico' && problematica.campi.motivo_problematico === 'non paga')
  const tornaNormale = campiDaModulo({ ...m, valutazione: 'normale', motivo: '' }, { ...CARMELA, rating: 'problematico', motivo_problematico: 'non paga' }, { colonnaRicevuta: true, conProvenienza: true })
  assert.ok(tornaNormale.ok && tornaNormale.campi.motivo_problematico === null)
})

test('il cliente nuovo dell’inserimento scrive gli stessi campi di sempre', () => {
  const m = { nome: 'Anna', cognome: 'Rossi', telefono: '333 000 0001', email: '', ricevuta: false, valutazione: 'problematico' as const, motivo: ' in ritardo ', provenienza: 'google' as const, struttura: '', note: '' }
  assert.deepEqual(campiNuovoCliente(m, true), {
    full_name: 'Anna Rossi', phone: '3330000001', rating: 'problematico', vuole_ricevuta: false, notes: null,
    motivo_problematico: 'in ritardo', provenienza: 'google', struttura_nome: null,
  })
  assert.equal('provenienza' in campiNuovoCliente(m, false), false)
  assert.equal(campiNuovoCliente({ ...m, provenienza: 'altra_struttura', struttura: ' Nida ' }, true).struttura_nome, 'Nida')
})

test('l’email (17/09/2026): si legge, si scrive se c’è, vuota diventa null sul cliente che esiste', () => {
  assert.equal(moduloDaCliente({ ...CARMELA, email: ' carmela@esempio.it ' }).email, 'carmela@esempio.it')
  assert.equal(moduloDaCliente(CARMELA).email, '')
  const m = { ...moduloDaCliente(CARMELA), email: 'carmela@esempio.it' }
  const r = campiDaModulo(m, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.ok(r.ok)
  assert.equal(r.campi.email, 'carmela@esempio.it')
  const vuota = campiDaModulo({ ...m, email: '  ' }, CARMELA, { colonnaRicevuta: true, conProvenienza: true })
  assert.ok(vuota.ok)
  assert.equal(vuota.campi.email, null)
  // il cliente nuovo: l'email entra solo se scritta
  assert.equal('email' in campiNuovoCliente({ ...m, email: '' }, true), false)
  assert.equal(campiNuovoCliente(m, true).email, 'carmela@esempio.it')
})
