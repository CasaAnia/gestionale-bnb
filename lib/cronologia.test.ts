// Cronologia delle modifiche (07/09/2026): testi in italiano semplice e ordine.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { descriviEvento, quandoEvento, righeCronologia, type EventoCronologia } from './cronologia.ts'

const adesso = new Date(2026, 8, 7, 10, 0)
const ev = (x: Partial<EventoCronologia>): EventoCronologia => ({ id: 'e', booking_id: 'b1', created_at: new Date(2026, 8, 5, 14, 20).toISOString(), tipo: 'camera', ...x })

test('quando: «5 set 14:20», con l’anno solo se diverso', () => {
  assert.equal(quandoEvento(new Date(2026, 8, 5, 14, 20).toISOString(), adesso), '5 set 14:20')
  assert.equal(quandoEvento(new Date(2025, 11, 31, 9, 5).toISOString(), adesso), '31 dic 2025 09:05')
  assert.equal(quandoEvento('boh', adesso), '')
})

test('descrizioni: camera, date, totale, sconto, pagamenti, annullamento, cliente', () => {
  assert.equal(descriviEvento({ tipo: 'camera', prima: { camera: 'Ambra' }, dopo: { camera: 'Lena' } }), 'camera Ambra → Lena')
  assert.equal(descriviEvento({ tipo: 'date', prima: { check_in: '2026-09-05', check_out: '2026-09-07' }, dopo: { check_in: '2026-09-05', check_out: '2026-09-08' } }), 'date 5–7 set → 5–8 set')
  assert.equal(descriviEvento({ tipo: 'totale', prima: { totale: 160 }, dopo: { totale: '200.5' } }), 'totale €160 → €200,5')
  assert.equal(descriviEvento({ tipo: 'sconto', prima: { tipo: null, valore: null }, dopo: { tipo: 'percentage', valore: 10 } }), 'sconto nessuno → 10 %')
  assert.equal(descriviEvento({ tipo: 'sconto', prima: { tipo: 'target_total', valore: 150 }, dopo: { tipo: null, valore: null } }), 'sconto totale a €150 → nessuno')
  assert.equal(descriviEvento({ tipo: 'pagamento_aggiunto', prima: null, dopo: { importo: 100, metodo: 'contanti', data: '2026-09-05' } }), 'pagamento aggiunto €100 contanti (5 set)')
  assert.equal(descriviEvento({ tipo: 'pagamento_eliminato', prima: { importo: 100, metodo: 'bonifico', data: '2026-09-05' }, dopo: null }), 'pagamento eliminato €100 bonifico (5 set)')
  assert.equal(descriviEvento({ tipo: 'annullamento', prima: { stato: 'confermata' }, dopo: { stato: 'annullata', motivo: 'Non viene più' } }), 'annullata: Non viene più')
  assert.equal(descriviEvento({ tipo: 'annullamento', prima: { stato: 'confermata' }, dopo: { stato: 'annullata', motivo: null } }), 'annullata')
  assert.equal(descriviEvento({ tipo: 'cliente', prima: { cliente: 'Anna Rossi' }, dopo: { cliente: 'Marco Bianchi' } }), 'cliente Anna Rossi → Marco Bianchi')
  // valori mancanti e tipo sconosciuto restano leggibili, mai un'eccezione
  assert.equal(descriviEvento({ tipo: 'camera', prima: null, dopo: null }), 'camera — → —')
  assert.equal(descriviEvento({ tipo: 'boh', prima: null, dopo: null }), 'boh')
})

test('righe dalla più recente, con il nome del segmento se noto', () => {
  const eventi = [
    ev({ id: '1', created_at: new Date(2026, 8, 5, 14, 20).toISOString(), tipo: 'camera', prima: { camera: 'Ambra' }, dopo: { camera: 'Lena' } }),
    ev({ id: '2', booking_id: 'b2', created_at: new Date(2026, 8, 6, 9, 0).toISOString(), tipo: 'pagamento_aggiunto', dopo: { importo: 50, metodo: 'contanti', data: '2026-09-06' } }),
  ]
  const righe = righeCronologia(eventi, adesso, id => (id === 'b2' ? 'Lena' : null))
  assert.deepEqual(righe, [
    { id: '2', quando: '6 set 09:00', cosa: 'pagamento aggiunto €50 contanti (6 set)', segmento: 'Lena' },
    { id: '1', quando: '5 set 14:20', cosa: 'camera Ambra → Lena', segmento: null },
  ])
})
