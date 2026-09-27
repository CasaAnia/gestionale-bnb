import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moduloDaRicerca, campiNuovoCliente } from './datiCliente.ts'

for (const numero of ['3331234567', '+39 333 123 4567', '0044 (20) 7946-0958', '02 1234567', '33']) {
  test(`ricerca telefono ${numero}: resta nel campo telefono, modificabile senza perdere cifre`, () => {
    const modulo = moduloDaRicerca(`  ${numero}  `)
    assert.equal(modulo.telefono, numero)
    assert.equal(modulo.nome, '')
    assert.equal(modulo.cognome, '')
    assert.equal(campiNuovoCliente({ ...modulo, nome: 'Anna', cognome: 'Rossi' }, false).phone, numero.replace(/\s/g, ''))
  })
}
for (const [ricerca, nome, cognome] of [
  ['Anna', 'Anna', ''], ['Anna Rossi', 'Anna', 'Rossi'],
  ['Anna Maria De Luca', 'Anna Maria', 'De Luca'],
  ["José D'Amico", 'José', "D'Amico"], ['  Anna   Rossi  ', 'Anna', 'Rossi'],
]) {
  test(`ricerca nominativo ${ricerca}: tutti i dati passano al modulo e al salvataggio`, () => {
    const modulo = moduloDaRicerca(ricerca)
    assert.equal(modulo.nome, nome)
    assert.equal(modulo.cognome, cognome)
    assert.equal(modulo.telefono, '')
    assert.equal(campiNuovoCliente(modulo, false).full_name, ricerca.trim().replace(/\s+/g, ' '))
  })
}
test('nome e telefono incollati insieme: conserva entrambi anche con prefisso internazionale', () => {
  for (const ricerca of ['Anna Rossi +39 333 1234567', '+39 333 1234567 Anna Rossi']) {
    const m = moduloDaRicerca(ricerca)
    assert.deepEqual([m.nome, m.cognome, m.telefono], ['Anna', 'Rossi', '+39 333 1234567'])
  }
})
test('ricerca vuota e moduli successivi non ereditano dati di un altro cliente', () => {
  const primo = moduloDaRicerca('Anna Rossi')
  primo.email = 'prova@example.com'
  const secondo = moduloDaRicerca('   ')
  assert.deepEqual([secondo.nome, secondo.cognome, secondo.telefono, secondo.email], ['', '', '', ''])
  assert.equal(secondo.provenienza, null)
})
