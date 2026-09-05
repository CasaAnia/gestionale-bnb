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
  assert.deepEqual([r.primoMese, r.meseCorrente, r.numMesi, r.annoPassato], [7, 8, 2, false])
  assert.equal(lena.adrCent, 10000)
  // R4: denominatore = giorni vendibili dall'inizio dell'anno a stanotte (1/1 → 6/9 escluso = 248), non dalla prima notte venduta
  assert.equal(lena.giorniVendibili, 248)
  assert.equal(lena.occupazionePerMille, Math.round(2 * 1000 / 248))
  assert.equal(amelia.occupazionePerMille, Math.round(3 * 1000 / 248))
  assert.match(r.limite ?? '', /fuori servizio non sono ancora registrati/)
})

test('R4 obbligatorio: anno iniziato a gennaio, prima prenotazione in agosto → gennaio–luglio restano nel denominatore', () => {
  const lista = [pren('a', 'r1', '2026-08-01', '2026-08-31', 3000)]   // 30 notti in agosto
  const r = ricaviPerCamera(2026, '2026-08-31', CAMERE, lista)!
  const amelia = r.lista[0]
  assert.equal(amelia.notti, 30)
  assert.equal(amelia.giorniVendibili, 243)                 // 1/1 → 1/9 escluso
  assert.equal(amelia.occupazionePerMille, Math.round(30 * 1000 / 243))   // 123 ‰, non 1000 ‰
  assert.equal(r.primoMese, 7)
})

test('R4: entrata in servizio documentata e periodi di fuori servizio riducono i giorni vendibili (sovrapposti contati una volta)', () => {
  const camere = [{ id: 'r1', name: 'Amelia', active: true, in_servizio_dal: '2026-03-01' }]
  const lista = [pren('a', 'r1', '2026-03-10', '2026-03-12', 200)]
  const fs = [{ room_id: 'r1', da: '2026-03-15', a: '2026-03-20' }, { room_id: 'r1', da: '2026-03-18', a: '2026-03-25' }, { room_id: 'r9', da: '2026-03-01', a: '2026-03-31' }]
  const r = ricaviPerCamera(2026, '2026-03-31', camere, lista, fs)!
  // 1/3 → 1/4 escluso = 31 giorni, meno 10 notti chiuse (15→25, non 5 + 7)
  assert.equal(r.lista[0].giorniVendibili, 21)
  assert.equal(r.lista[0].occupazionePerMille, Math.round(2 * 1000 / 21))
  assert.equal(r.limite, null)
})

test('anno passato: tutti i 12 mesi; anno futuro: null; nessuna notte: null', () => {
  const lista = [pren('a', 'r1', '2025-12-30', '2026-01-02', 300)]
  const p = ricaviPerCamera(2025, '2026-09-05', CAMERE, lista)!
  assert.deepEqual([p.lista[0].notti, p.lista[0].ricaviCent, p.annoPassato, p.meseCorrente], [2, 20000, true, 11])
  assert.equal(ricaviPerCamera(2027, '2026-09-05', CAMERE, lista), null)
  assert.equal(ricaviPerCamera(2024, '2026-09-05', CAMERE, lista), null)
})
