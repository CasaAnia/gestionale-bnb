import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registroPulizie, testataGiorno, tempoBreve, titoloGiorno, nomeInDue, lettiRegistro } from './registroPulizie.ts'

const nome = (id: string) => ({ a: 'Allegra', b: 'Ambra', l: 'Lena', v: 'Vecchia' } as Record<string, string>)[id] ?? id
const ev = (id: string, room: string, extra: Record<string, unknown>) => ({ id, room_id: room, booking_id: 'x', tipo: 'fine_soggiorno', stato: 'fatta', data_prevista: '2026-10-01', data_effettiva: '2026-10-01', ...extra }) as never
const assetto = { matrimoniali: 1, singoli: 0, ospiti: 2, federe_matrimoniale: 4 }

test('il giorno del riferimento: corridoio 8:10, Allegra 9:02 con 3 recuperati, Ambra rimandata; «2 pulizie · 50 min»', () => {
  const giorni = registroPulizie({
    events: [ev('c1', 'a', { created_at: '2026-10-01T07:02:00Z', minuti: 38, assetto }), ev('c2', 'b', { tipo: 'soggiorno', stato: 'rimandata', data_effettiva: null, prossima_data: '2026-10-02' }),
      ev('c3', 'l', { data_prevista: '2026-09-30', data_effettiva: '2026-09-30', created_at: '2026-09-30T07:40:00Z', minuti: 62, assetto: { ...assetto, singoli: 1, ospiti: 3 } }),
      ev('c4', 'v', { data_prevista: '2026-09-29', data_effettiva: '2026-09-29', created_at: '2026-09-30T08:00:00Z', minuti: null })],
    recuperi: [{ cleaning_id: 'c1', federe: 2, telo_doccia: 1 }],
    tempi: [{ data: '2026-10-01', attivita: 'corridoio', minuti: 12, aggiornato_at: '2026-10-01T06:10:00Z' }],
    automatiche: [], dal: '2026-09-01', al: '2026-10-31', filtro: 'tutte', nomeCamera: nome,
  })
  assert.deepEqual(giorni.map(g => g.giorno), ['2026-10-01', '2026-09-30', '2026-09-29'])
  const [primo] = giorni
  assert.equal(primo.titolo, 'gio 1 ottobre')
  assert.equal(testataGiorno(primo), '1 pulizia · 50 min')
  assert.deepEqual(primo.righe.map(r => r.tipo), ['spazi', 'pulizia', 'rinvio'])
  const p = primo.righe[1] as Extract<typeof primo.righe[number], { tipo: 'pulizia' }>
  assert.equal(p.ora, '9:02'); assert.equal(p.etichetta, 'Cambio ospite'); assert.equal(p.letti, '1 matrimoniale · 2 completi'); assert.equal(p.recuperati, 3)
  const r = primo.righe[2] as Extract<typeof primo.righe[number], { tipo: 'rinvio' }>
  assert.deepEqual([r.etichetta, r.testo, r.destra], ['4 notti', 'rimandata al 2 ottobre', 'rinvio'])
  // segnata il giorno dopo: l'ora non si sa; camera disattivata: resta
  const vecchia = giorni[2].righe[0] as Extract<typeof primo.righe[number], { tipo: 'pulizia' }>
  assert.equal(vecchia.ora, null); assert.equal(vecchia.camera, 'Vecchia'); assert.equal(vecchia.minuti, null)
})

test('spazi comuni: area_comune dentro il corridoio, una riga sola; filtri per camera e per spazi', () => {
  const args = { events: [ev('c1', 'a', { created_at: '2026-10-01T07:02:00Z', minuti: 38 })], recuperi: [], automatiche: [], dal: '2026-10-01', al: '2026-10-31', nomeCamera: nome,
    tempi: [{ data: '2026-10-01', attivita: 'area_comune', minuti: 20 }, { data: '2026-10-01', attivita: 'corridoio', minuti: 12, aggiornato_at: '2026-10-01T06:10:00Z' }, { data: '2026-10-01', attivita: 'altro', minuti: 5, cosa: 'vetri' }] }
  const tutte = registroPulizie({ ...args, filtro: 'tutte' })[0]
  const spazi = tutte.righe.filter(r => r.tipo === 'spazi') as Extract<typeof tutte.righe[number], { tipo: 'spazi' }>[]
  assert.deepEqual(spazi.map(s => [s.nome, s.minuti, s.cosa]), [['Corridoio e angolo caffè', 32, null], ['Altro', 5, 'vetri']])
  assert.equal(tutte.minuti, 38 + 32 + 5)
  assert.deepEqual(registroPulizie({ ...args, filtro: { roomId: 'a' } })[0].righe.map(r => r.tipo), ['pulizia'])
  assert.deepEqual(registroPulizie({ ...args, filtro: 'spazi' })[0].righe.map(r => r.tipo), ['spazi', 'spazi'])
})

test('parole', () => {
  assert.equal(tempoBreve(50), '50 min'); assert.equal(tempoBreve(125), '2 h 05')
  assert.equal(titoloGiorno('2026-09-30'), 'mer 30 settembre')
  assert.deepEqual(nomeInDue('Corridoio e angolo caffè'), ['Corridoio', 'e angolo caffè'])
  assert.equal(lettiRegistro(null), 'letti non documentati')
  assert.equal(testataGiorno({ pulizie: 0, minuti: 12 }), '0 pulizie · 12 min')
})
