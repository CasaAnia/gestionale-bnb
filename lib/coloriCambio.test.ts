// Colore del pezzetto tagliato dei cambi camera (Ania, 06/09/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coloriCatene, COLORI_CAMBIO, percorsoBarraArrotondata } from './roomChanges.ts'

const b = (id: string, room_id: string, check_in: string, check_out: string, extra: Record<string, unknown> = {}) => ({ id, room_id, check_in, check_out, ...extra })

test('le due metà dello stesso soggiorno hanno lo stesso colore; catene diverse colori diversi, in ordine di data', () => {
  const colori = coloriCatene([
    b('a1', 'ambra', '2026-09-11', '2026-09-13', { group_id: 'g1' }),
    b('a2', 'lena', '2026-09-13', '2026-09-15', { group_id: 'g1' }),
    b('b1', 'amelia', '2026-09-03', '2026-09-06', { guest_id: 'x' }),      // stessa persona, camere diverse, date contigue → catena
    b('b2', 'lena', '2026-09-06', '2026-09-07', { guest_id: 'x' }),
    b('solo', 'allegra', '2026-09-06', '2026-09-08', { guest_id: 'y' }),   // nessun cambio → nessun colore
  ])
  assert.equal(colori.b1, COLORI_CAMBIO[0]); assert.equal(colori.b2, COLORI_CAMBIO[0])   // prima catena (dal 3) = ottone
  assert.equal(colori.a1, COLORI_CAMBIO[1]); assert.equal(colori.a2, COLORI_CAMBIO[1])   // seconda (dall'11) = oro scuro
  assert.equal(colori.solo, undefined)
})

test('oltre quattro catene si ricomincia dal primo colore', () => {
  const pren: ReturnType<typeof b>[] = []
  for (let i = 0; i < 5; i++) {
    pren.push(b(`c${i}a`, 'ambra', `2026-10-0${i + 1}`, `2026-10-0${i + 2}`, { group_id: `g${i}` }), b(`c${i}b`, 'lena', `2026-10-0${i + 2}`, `2026-10-0${i + 3}`, { group_id: `g${i}` }))
  }
  const colori = coloriCatene(pren)
  assert.equal(colori.c0a, COLORI_CAMBIO[0]); assert.equal(colori.c3a, COLORI_CAMBIO[3]); assert.equal(colori.c4a, COLORI_CAMBIO[0])
  assert.equal(COLORI_CAMBIO.length, 4)
})

test('barra tagliata con angoli arrotondati: path() in pixel, quattro curve, taglio di 12 px sul lato giusto', () => {
  const p = percorsoBarraArrotondata(100, 32, false, true)
  assert.ok(p.startsWith("path('M ") && p.endsWith(" Z')"))
  assert.equal((p.match(/ Q /g) || []).length, 4)
  assert.ok(p.includes('Q 100 0'))      // angolo in alto a destra intero
  assert.ok(p.includes('Q 88 32'))      // in basso a destra rientrato di 12 px
  const s = percorsoBarraArrotondata(100, 32, true, false)
  assert.ok(s.includes('Q 12 32') && s.includes('Q 0 0'))
})
