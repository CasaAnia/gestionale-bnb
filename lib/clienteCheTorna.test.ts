import { test } from 'node:test'
import assert from 'node:assert/strict'
import { soggiorniPrecedenti, etichettaGiaStato, eraGiaStato, stessaPersona } from './clienteCheTorna.ts'

const OGGI = '2026-09-05'
const b = (id: string, check_in: string, check_out: string, guests: { full_name?: string | null; phone?: string | null } | null, extra: Record<string, unknown> = {}) =>
  ({ id, check_in, check_out, status: 'confermata', guests, ...extra })

test('cliente che torna: stesso telefono o stesso nome e cognome, solo soggiorni conclusi, ogni soggiorno una volta', () => {
  const storico = [
    b('a', '2026-07-01', '2026-07-05', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),
    b('b1', '2026-08-01', '2026-08-03', { full_name: 'Rossi Anna', phone: null }, { group_id: 'g' }),      // stesso nome, ordine diverso
    b('b2', '2026-08-03', '2026-08-06', { full_name: 'Rossi Anna', phone: null }, { group_id: 'g' }),      // stesso soggiorno di b1
    b('c', '2026-09-10', '2026-09-12', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),            // futuro: non concluso
    b('d', '2026-06-01', '2026-06-03', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }, { status: 'annullata' }),
    b('e', '2026-05-01', '2026-05-03', { full_name: 'Marco Bianchi', phone: '333 999 0000' }),
  ]
  assert.equal(soggiorniPrecedenti({ telefono: '3331234567' }, storico, OGGI), 1)                      // per telefono: solo «a»
  assert.equal(soggiorniPrecedenti({ nome: 'anna', cognome: 'ROSSI' }, storico, OGGI), 2)             // per nome: «a» e il gruppo «g»
  assert.equal(soggiorniPrecedenti({ nome: 'Anna', cognome: 'Rossi', telefono: '+39 333 123 4567' }, storico, OGGI), 2)
  assert.equal(soggiorniPrecedenti({ nome: 'Anna', cognome: 'Rossi' }, storico, OGGI, 'g'), 1)         // escluso il soggiorno in esame
  assert.equal(soggiorniPrecedenti({ telefono: '+39 333 999 0000' }, storico, OGGI), 1)
  assert.equal(soggiorniPrecedenti({ nome: 'Luca', cognome: 'Verdi' }, storico, OGGI), 0)
  assert.equal(soggiorniPrecedenti({}, storico, OGGI), 0)
  assert.equal(etichettaGiaStato(0), null)
  assert.equal(etichettaGiaStato(1), 'Già stato da noi · 1 soggiorno')
  assert.equal(etichettaGiaStato(3), 'Già stato da noi · 3 soggiorni')
  assert.equal(stessaPersona({ guest_id: 'x' }, { guest_id: 'x' }), true)
  assert.equal(stessaPersona({ nome: 'Anna', cognome: 'Rossi' }, { guest_name: 'Anna Rossi', guests: { full_name: 'Scheda Diversa' } }), true)
})

test('statistiche: «già stato» = un soggiorno concluso PRIMA del check-in di questa prenotazione', () => {
  const storico = [
    b('vecchio', '2026-07-01', '2026-07-05', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),
    b('nuovo', '2026-09-10', '2026-09-12', { full_name: 'Anna Rossi', phone: '+39 333 123 4567' }),
    b('primo', '2026-09-01', '2026-09-03', { full_name: 'Marco Bianchi', phone: '333 999 0000' }),
    b('secondo', '2026-09-20', '2026-09-22', { full_name: 'Marco Bianchi', phone: '333 999 0000' }),
  ]
  assert.equal(eraGiaStato(storico[1], storico), true)     // Anna: torna
  assert.equal(eraGiaStato(storico[0], storico), false)    // la prima volta di Anna
  assert.equal(eraGiaStato(storico[3], storico), true)     // Marco: il secondo soggiorno
  assert.equal(eraGiaStato(storico[2], storico), false)
})
