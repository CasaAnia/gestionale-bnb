import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ricaviPerCamera } from './camere.ts'
import type { PrenotazioneStat } from './tipi.ts'

const CAMERE = [{ id: 'r1', name: 'Amelia', active: true }, { id: 'r4', name: 'Lena', active: true }, { id: 'r5', name: 'Vecchia', active: false }]
const pren = (id: string, room_id: string, check_in: string, check_out: string, total: number, status = 'confermata'): PrenotazioneStat => ({ id, room_id, check_in, check_out, total_amount: total, status })

test('ricavi per camera: competenza notte per notte fino a stanotte, solo confermate, camere disattivate ignorate', () => {
  const lista = [
    pren('a', 'r1', '2026-08-30', '2026-09-02', 100),           // 3 notti, 2 in agosto e 1 in settembre
    pren('b', 'r4', '2026-09-04', '2026-09-08', 400),           // 4 notti: al 5/09 (stanotte compresa) contano 4, 5 → 2 notti
    pren('c', 'r4', '2026-09-10', '2026-09-12', 999, 'in_attesa'),
    pren('d', 'r5', '2026-09-01', '2026-09-03', 999),           // camera disattivata
  ]
  const r = ricaviPerCamera(2026, '2026-09-05', CAMERE, lista)!
  assert.equal(r.lista.length, 2)
  const amelia = r.lista.find(x => x.name === 'Amelia')!, lena = r.lista.find(x => x.name === 'Lena')!
  assert.deepEqual([amelia.notti, amelia.ricaviCent, amelia.mensiliCent[7], amelia.mensiliCent[8]], [3, 10000, 6667, 3333])
  assert.deepEqual([lena.notti, lena.ricaviCent, lena.mensiliCent[8]], [2, 20000, 20000])
  assert.equal(r.lista[0].name, 'Lena')
  assert.equal(r.giorniTrascorsi, 7)                  // 30/08 → 6/09 escluso
  assert.deepEqual([r.primoMese, r.meseCorrente, r.numMesi, r.annoPassato], [7, 8, 2, false])
  assert.equal(lena.adrCent, 10000)
})

test('anno passato: tutti i 12 mesi; anno futuro: null; nessuna notte: null', () => {
  const lista = [pren('a', 'r1', '2025-12-30', '2026-01-02', 300)]
  const p = ricaviPerCamera(2025, '2026-09-05', CAMERE, lista)!
  assert.deepEqual([p.lista[0].notti, p.lista[0].ricaviCent, p.annoPassato, p.meseCorrente], [2, 20000, true, 11])
  assert.equal(ricaviPerCamera(2027, '2026-09-05', CAMERE, lista), null)
  assert.equal(ricaviPerCamera(2024, '2026-09-05', CAMERE, lista), null)
})
