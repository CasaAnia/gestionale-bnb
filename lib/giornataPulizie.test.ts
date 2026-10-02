import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rigaGiornata, rigaSpaziComuni, posizione, durata, giornoLungo, contoGiorno, oraSegnata, romaDi, PARTENZA_INDICATIVA, ARRIVO_INDICATIVO } from './giornataPulizie.ts'

const OGGI = '2026-10-01'
const room = (id: string) => ({ id, name: id })
let n = 0
const b = (room_id: string, check_in: string, check_out: string, nome: string, extra: Record<string, unknown> = {}) => ({ id: `b${++n}`, room_id, check_in, check_out, status: 'confermata', guest_name: nome, num_guests: 2, ...extra })

test('cambio ospite: parte Esposito alle 10, bagagli Serra alle 11, arriva alle 16 → 6 ore per pulire', () => {
  const pren = [b('lena', '2026-09-28', OGGI, 'Elena Esposito', { check_out_time: '10:00:00' }), b('lena', OGGI, '2026-10-04', 'Giovanni Serra', { check_in_time: '16:00', bagagli_alle: '11:00:00' })]
  const r = rigaGiornata(room('lena'), 'Lena', pren, [], OGGI, true)
  assert.deepEqual(r.segmenti, [{ tipo: 'parte', da: 480, a: 600, indicativo: false, testo: 'Esposito' }, { tipo: 'finestra', da: 600, a: 960, libera: false, testo: '6 ore' }])
  assert.deepEqual(r.segni, [{ tipo: 'arrivo', ora: 960, indicativo: false, testo: 'Serra 16:00' }, { tipo: 'bagagli', ora: 660, testo: 'bagagli 11:00' }])
})

test('senza orari: 10:00 col «?» e filo tratteggiato alle 15:00 col «?» — riferimenti grafici, non dati', () => {
  const pren = [b('lena', '2026-09-28', OGGI, 'Elena Esposito'), b('lena', OGGI, '2026-10-04', 'Giovanni Serra')]
  const r = rigaGiornata(room('lena'), 'Lena', pren, [], OGGI, true)
  assert.deepEqual(r.segmenti[0], { tipo: 'parte', da: 480, a: PARTENZA_INDICATIVA, indicativo: true, testo: 'Esposito ?' })
  assert.deepEqual(r.segni[0], { tipo: 'arrivo', ora: ARRIVO_INDICATIVO, indicativo: true, testo: 'Serra ?' })
})

test('senza la proposta 0064 niente bagagli né ore di partenza, anche se nei dati ci fossero', () => {
  const pren = [b('lena', '2026-09-28', OGGI, 'Elena Esposito', { check_out_time: '11:30:00' }), b('lena', OGGI, '2026-10-04', 'Giovanni Serra', { bagagli_alle: '11:00:00' })]
  const r = rigaGiornata(room('lena'), 'Lena', pren, [], OGGI, false)
  assert.equal(r.segni.some(s => s.tipo === 'bagagli'), false)
  assert.equal((r.segmenti[0] as { indicativo: boolean }).indicativo, true)
})

test('prossimo arrivo fra giorni: blocco ottone fino alle 20 con «libera fino al …» e la priorità vera', () => {
  const pren = [b('amelia', '2026-09-29', OGGI, 'Mario Bellini'), b('amelia', '2026-10-05', '2026-10-07', 'Anna Rossi')]
  const r = rigaGiornata(room('amelia'), 'Amelia', pren, [], OGGI, true)
  assert.deepEqual(r.segmenti[1], { tipo: 'finestra', da: 600, a: 1200, libera: true, testo: 'libera fino al 5 ott · nessuna fretta' })
  const domani = rigaGiornata(room('amelia'), 'Amelia', [b('amelia', '2026-09-29', OGGI, 'Mario Bellini'), b('amelia', '2026-10-02', '2026-10-04', 'Anna Rossi')], [], OGGI, true)
  assert.match((domani.segmenti[1] as { testo: string }).testo, /libera fino al 2 ott · priorità alta/)
})

test('arrivo prima della partenza: niente blocco negativo, una nota, i due orari restano', () => {
  const pren = [b('lena', '2026-09-28', OGGI, 'Elena Esposito', { check_out_time: '14:00:00' }), b('lena', OGGI, '2026-10-04', 'Giovanni Serra', { check_in_time: '12:00' })]
  const r = rigaGiornata(room('lena'), 'Lena', pren, [], OGGI, true)
  assert.equal(r.segmenti.some(s => s.tipo === 'finestra'), false)
  assert.equal(r.nota, 'arriva prima che parta')
  assert.equal(r.segni[0].ora, 720)
})

test('orari fuori dalle 8–20: disegnati sul bordo, con l\'ora vera scritta', () => {
  const pren = [b('lena', '2026-09-28', OGGI, 'Elena Esposito', { check_out_time: '06:30:00' }), b('lena', OGGI, '2026-10-04', 'Giovanni Serra', { check_in_time: '22:15' })]
  const r = rigaGiornata(room('lena'), 'Lena', pren, [], OGGI, true)
  assert.equal(posizione(390), 0); assert.equal(posizione(1335), 100)
  assert.equal((r.segmenti[0] as { testo: string }).testo, 'Esposito 6:30')
  assert.equal(r.segni[0].testo, 'Serra 22:15')
  assert.deepEqual(r.segmenti[1], { tipo: 'finestra', da: 480, a: 1200, libera: false, testo: '15 ore 45' })
})

test('chi resta (4 notti): blocco su tutta la riga col nome intero', () => {
  const r = rigaGiornata(room('ambra'), 'Ambra', [b('ambra', '2026-09-27', '2026-10-04', 'Lucia Ferri')], [], OGGI, true)
  assert.deepEqual(r.segmenti, [{ tipo: 'resta', testo: 'Lucia Ferri resta · biancheria della 4ª notte' }])
})

test('pulizia fatta oggi: un segno all\'ora in cui è stata segnata, con i minuti; mai un intervallo ricostruito', () => {
  const p = b('allegra', '2026-09-29', OGGI, 'Paola Neri')
  const fatta = { id: 'c1', room_id: 'allegra', booking_id: p.id, tipo: 'fine_soggiorno' as const, stato: 'fatta' as const, data_prevista: OGGI, data_effettiva: OGGI, created_at: '2026-10-01T07:02:00Z', minuti: 38 }
  const r = rigaGiornata(room('allegra'), 'Allegra', [p], [fatta], OGGI, true)
  assert.deepEqual(r.segmenti, [{ tipo: 'fatta', ora: 9 * 60 + 2, testo: '✓ pulita 9:02 · 38 min' }])
  // segnata il giorno dopo: l'ora non si sa
  assert.equal(oraSegnata({ ...fatta, created_at: '2026-10-02T07:02:00Z' }, romaDi), null)
  // l'ora corretta a mano vince
  assert.equal(oraSegnata({ ...fatta, ora_effettiva: '08:15:00' }, romaDi), 495)
})

test('camera senza niente oggi: la riga resta vuota', () => {
  const r = rigaGiornata(room('amelia'), 'Amelia', [], [], OGGI, true)
  assert.equal(r.vuota, true)
})

test('spazi comuni: un segno per tempo salvato oggi, all\'ora del salvataggio', () => {
  assert.deepEqual(rigaSpaziComuni([{ attivita: 'corridoio', minuti: 12, aggiornato_at: '2026-10-01T06:10:00Z' }, { attivita: 'piegatura', minuti: 0 }], OGGI), [{ attivita: 'corridoio', ora: 490, testo: '✓' }])
})

test('parole: giorno, conteggio, durate', () => {
  assert.equal(giornoLungo(OGGI), 'giovedì 1 ottobre')
  assert.deepEqual(contoGiorno(3, 1), { daFare: '3 da fare', fatte: '1 fatta' })
  assert.deepEqual(contoGiorno(0, 2), { daFare: '0 da fare', fatte: '2 fatte' })
  assert.equal(durata(45), '45 min'); assert.equal(durata(60), '1 ora'); assert.equal(durata(330), '5 ore 30')
})
