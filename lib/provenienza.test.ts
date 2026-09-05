import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  campiProvenienza, normalizzaProvenienza, manca0036, suggerimentiStrutture, strutturaNota, strutturePerOspiti,
  campiDaCopiareAllaPrenotazione, conProvenienzaDalSito, testoProvenienza, STRUTTURE_NOTE, PROVENIENZA_DEFAULT, colonne0036Presenti,
} from './provenienza.ts'

test('default non_so; la struttura vale solo con altra_struttura', () => {
  assert.equal(PROVENIENZA_DEFAULT, 'non_so')
  assert.deepEqual(campiProvenienza(undefined, 'Umana'), { provenienza: 'non_so', struttura_nome: null })
  assert.deepEqual(campiProvenienza('boh', null), { provenienza: 'non_so', struttura_nome: null })
  assert.deepEqual(campiProvenienza('google', 'Umana'), { provenienza: 'google', struttura_nome: null })
  assert.deepEqual(campiProvenienza('altra_struttura', '  Rosa   Bianca '), { provenienza: 'altra_struttura', struttura_nome: 'Rosa Bianca' })
  assert.deepEqual(campiProvenienza('altra_struttura', '   '), { provenienza: 'altra_struttura', struttura_nome: null })
  assert.equal(normalizzaProvenienza('passaparola'), 'passaparola')
})

test('richiesta → prenotazione: alla conferma si copiano provenienza e struttura', () => {
  assert.deepEqual(campiDaCopiareAllaPrenotazione({ provenienza: 'altra_struttura', struttura_nome: 'Nida' }), { provenienza: 'altra_struttura', struttura_nome: 'Nida' })
  assert.deepEqual(campiDaCopiareAllaPrenotazione({ provenienza: 'google', struttura_nome: 'Nida' }), { provenienza: 'google', struttura_nome: null })
  assert.deepEqual(campiDaCopiareAllaPrenotazione({}), { provenienza: 'non_so', struttura_nome: null })
})

test('dal modulo del sito la provenienza è google in automatico', () => {
  const riga = conProvenienzaDalSito({ nome: 'Anna', canale: 'web' })
  assert.deepEqual(riga, { nome: 'Anna', canale: 'web', provenienza: 'google', struttura_nome: null })
})

test('suggerimenti: contengono il testo, ordinati per ospiti già portati poi per nome; nome nuovo accettato', () => {
  const note = strutturePerOspiti(STRUTTURE_NOTE, [
    { id: 'a', provenienza: 'altra_struttura', struttura_nome: 'Nida', status: 'confermata' },
    { id: 'b', group_id: 'g', provenienza: 'altra_struttura', struttura_nome: 'nida', status: 'confermata' },
    { id: 'c', group_id: 'g', provenienza: 'altra_struttura', struttura_nome: 'Nida', status: 'confermata' },   // stesso soggiorno di b
    { id: 'd', provenienza: 'altra_struttura', struttura_nome: 'Umana', status: 'completata' },
    { id: 'e', provenienza: 'altra_struttura', struttura_nome: 'Umana', status: 'annullata' },                // mai
    { id: 'f', provenienza: 'google', struttura_nome: 'Elyse', status: 'confermata' },                        // non è altra_struttura
    { id: 'n', provenienza: 'altra_struttura', struttura_nome: 'Villa Nuova', status: 'confermata' },         // nome nuovo, entra nell'elenco
  ])
  assert.deepEqual(note.map(s => `${s.nome}:${s.ospiti}`), ['Umana:1', 'Nida:2', 'RB (Rosa Bianca):0', 'Elyse:0', 'BM (Borgo Manzoni):0', 'Villa Nuova:1'])
  assert.deepEqual(suggerimentiStrutture('', note).map(s => s.nome), ['Nida', 'Umana', 'Villa Nuova', 'BM (Borgo Manzoni)', 'Elyse', 'RB (Rosa Bianca)'])
  assert.deepEqual(suggerimentiStrutture('nid', note).map(s => s.nome), ['Nida'])
  assert.deepEqual(suggerimentiStrutture('ni', note).map(s => s.nome), ['Nida', 'BM (Borgo Manzoni)'])   // «ni» sta anche in «Manzoni»
  assert.deepEqual(suggerimentiStrutture('rosa', note).map(s => s.nome), ['RB (Rosa Bianca)'])
  assert.deepEqual(suggerimentiStrutture('xyz', note), [])
  assert.equal(strutturaNota('nida', note), 'Nida')
  assert.equal(strutturaNota('Casa Mia', note), null)
})

test('colonne/tabella della 0036 assenti riconosciute; testi delle schede', () => {
  assert.equal(manca0036({ code: '42703', message: 'column richieste.provenienza does not exist' }), true)
  assert.equal(manca0036({ code: 'PGRST204', message: "Could not find the 'struttura_nome' column" }), true)
  assert.equal(manca0036({ code: 'PGRST205', message: "Could not find the table 'public.strutture'" }), true)
  assert.equal(manca0036({ code: '42703', message: 'column bookings.chi_e does not exist' }), false)
  assert.equal(manca0036(null), false)
  assert.equal(colonne0036Presenti({ provenienza: 'non_so' }), true)
  assert.equal(colonne0036Presenti({ nome: 'x' }), false)
  assert.equal(testoProvenienza({ provenienza: 'altra_struttura', struttura_nome: 'Umana' }), 'Altra struttura · Umana')
  assert.equal(testoProvenienza({ provenienza: 'google' }), 'Google')
  assert.equal(testoProvenienza({}), 'Non so')
})

test('«Quale struttura» attivo: con un nome già completo si vedono TUTTE le strutture con quella attuale evidenziata (difetto di Ania, 08/09/2026)', async () => {
  const { suggerimentiDaMostrare } = await import('./provenienza.ts')
  const note = [{ nome: 'Umana', ospiti: 1 }, { nome: 'Nida', ospiti: 2 }, { nome: 'RB (Rosa Bianca)', ospiti: 0 }, { nome: 'Elyse', ospiti: 0 }, { nome: 'BM (Borgo Manzoni)', ospiti: 0 }]
  const conNida = suggerimentiDaMostrare('Nida', note)
  assert.deepEqual(conNida.lista.map(s => s.nome), ['Nida', 'Umana', 'BM (Borgo Manzoni)', 'Elyse', 'RB (Rosa Bianca)'])
  assert.equal(conNida.attuale, 'Nida')
  assert.equal(suggerimentiDaMostrare('nida', note).attuale, 'Nida')
  assert.equal(suggerimentiDaMostrare('', note).lista.length, 5)
  assert.deepEqual(suggerimentiDaMostrare('ros', note).lista.map(s => s.nome), ['RB (Rosa Bianca)'])
  assert.equal(suggerimentiDaMostrare('ros', note).attuale, null)
  assert.equal(suggerimentiDaMostrare('Villa Nuova', note).lista.length, 5)   // nome nuovo: si vedono comunque tutte
})
