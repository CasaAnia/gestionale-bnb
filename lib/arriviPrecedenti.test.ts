// ============================================================================
// «ARRIVI PRECEDENTI» (22/10/2026): con un luogo esterno lo storico dice
// dove e a che ora, anche senza l'ora in struttura; struttura, luogo,
// autista e prelievo restano distinti. Casi interamente inventati.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { arriviPrecedenti, ORARIO_NON_REGISTRATO } from './arriviPrecedenti.ts'
import type { SegmentoStorico } from './storicoCliente.ts'

const OGGI = '2026-10-22'
let n = 0
/** Un soggiorno inventato di una camera sola */
function soggiorno(check_in: string, check_out: string, arrivo: Record<string, unknown>, extra: Record<string, unknown> = {}): SegmentoStorico {
  n += 1
  return {
    id: `s-${n}`, prenotazione_id: `p-${n}`, check_in, check_out, status: 'completata',
    rooms: { name: 'Camera Prova' }, check_in_time: null, shuttle: null,
    ...arrivo, ...extra,
  } as unknown as SegmentoStorico
}
const vuoto = { arrivo_luogo_altro: null, arrivo_luogo_ora_a: null, arrivo_struttura_ora_da: null, arrivo_struttura_ora_a: null, arrivo_stima_da: null, arrivo_stima_a: null, navetta_prelievo: null }

test('Prova Storico: Rogoredo alle 09:20, struttura vuota → il luogo e la sua ora si vedono', () => {
  const [r] = arriviPrecedenti([soggiorno('2026-09-01', '2026-09-03', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'rogoredo', arrivo_luogo_ora_da: '09:20', navetta: 'non_richiesta', shuttle: 'no' })], OGGI)
  assert.equal(r.luogo, 'Arriva a Rogoredo alle 09:20')
  assert.equal(r.orario, null, 'niente «orario non registrato» quando il luogo ha la sua ora')
  assert.equal(r.navetta, 'navetta no')
  assert.equal(r.prelievo, null)
})

test('Linate 08:40, struttura 12:10, Aldo con prelievo 09:15: tutto distinto', () => {
  const [r] = arriviPrecedenti([soggiorno('2026-08-10', '2026-08-12', {
    ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_ora_da: '08:40',
    arrivo_struttura_ora_da: '12:10', check_in_time: '12:10', navetta: 'aldo', navetta_prelievo: '09:15', shuttle: 'si',
  })], OGGI)
  assert.equal(r.luogo, 'Arriva a Linate alle 08:40')
  assert.equal(r.orario, 'in struttura 12:10')
  assert.equal(r.navetta, 'navetta aldo')
  assert.equal(r.prelievo, 'Prelievo a Linate · 09:15')
})

test('struttura precisa, fascia e stima: come prima', () => {
  const righe = arriviPrecedenti([
    soggiorno('2026-07-01', '2026-07-02', { ...vuoto, arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '16:00', check_in_time: '16:00', navetta: 'non_richiesta' }),
    soggiorno('2026-06-01', '2026-06-02', { ...vuoto, arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '15:00', arrivo_struttura_ora_a: '17:00', check_in_time: '15:00', navetta: 'da_definire' }),
    soggiorno('2026-05-01', '2026-05-02', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'malpensa', arrivo_luogo_ora_da: '13:00', arrivo_luogo_ora_a: '14:00', arrivo_stima_da: '15:30', arrivo_stima_a: '16:30', check_in_time: '15:30', navetta: 'massimo', navetta_prelievo: '14:15' }),
  ], OGGI)
  assert.deepEqual(righe.map(r => r.orario), ['arrivo 16:00', 'arrivo 15:00–17:00', 'in struttura circa 15:30–16:30'])
  assert.deepEqual(righe.map(r => r.luogo), [null, null, 'Arriva a Malpensa fra le 13:00 e le 14:00'])
  // «da definire» salvato è una scelta, non un dato mancante (audit 22/10/2026)
  assert.deepEqual(righe.map(r => r.navetta), ['navetta no', 'navetta da definire', 'navetta massimo'])
  assert.equal(righe[2].prelievo, 'Prelievo a Malpensa · 14:15')
})

test('righe di prima della 0058: solo check_in_time e shuttle, lette come prima', () => {
  const righe = arriviPrecedenti([
    soggiorno('2026-04-01', '2026-04-02', {}, { check_in_time: '18:00', shuttle: 'si' }),
    soggiorno('2026-03-01', '2026-03-02', {}, { check_in_time: null, shuttle: null }),
  ], OGGI)
  assert.deepEqual(righe.map(r => [r.orario, r.luogo, r.navetta, r.prelievo]), [
    ['arrivo 18:00', null, 'navetta da assegnare', null],
    [ORARIO_NON_REGISTRATO, null, 'navetta non registrata', null],
  ])
})

test('restano fuori annullati e soggiorni non conclusi; i dati non si toccano', () => {
  const annullato = soggiorno('2026-09-05', '2026-09-06', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_ora_da: '10:00' }, { status: 'annullata' })
  const futuro = soggiorno('2026-11-01', '2026-11-03', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_ora_da: '10:00' }, { status: 'confermata' })
  const inCorso = soggiorno('2026-10-21', '2026-10-24', { ...vuoto, arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '15:00' }, { status: 'confermata' })
  const concluso = soggiorno('2026-09-10', '2026-09-12', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'centrale', arrivo_luogo_ora_da: '11:30' })
  const tutti = [annullato, futuro, inCorso, concluso]
  const prima = JSON.stringify(tutti)
  const righe = arriviPrecedenti(tutti, OGGI)
  assert.equal(righe.length, 1)
  assert.equal(righe[0].luogo, 'Arriva a Milano Centrale alle 11:30')
  assert.equal(JSON.stringify(tutti), prima, 'lo storico ha cambiato i dati')
})

test('isolamento: la scheda passa allo storico SOLO i soggiorni dello stesso cliente', async () => {
  const { readFileSync } = await import('node:fs')
  const pagina = readFileSync(new URL('../app/scheda/[id]/page.tsx', import.meta.url), 'utf8')
  assert.match(pagina, /supabase\.from\('bookings'\)\.select\('\*, rooms\(name\), guests\(full_name, phone\)'\)\.eq\('guest_id', scheda\.guest_id\)/)
  assert.match(pagina, /<ArriviPrecedenti altre=\{altreCliente as unknown as SegmentoStorico\[\]\} oggi=\{oggi\}/)
})

test('rilievo Codex: il primo arrivo si sceglie fra i tratti non annullati', () => {
  const annullato = soggiorno('2026-01-01', '2026-01-02', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'rogoredo', arrivo_luogo_ora_da: '09:20' }, { group_id: 'g', prenotazione_id: null, status: 'annullata' })
  const vivo = soggiorno('2026-01-02', '2026-01-03', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_ora_da: '08:40' }, { group_id: 'g', prenotazione_id: null, status: 'confermata' })
  const righe = arriviPrecedenti([annullato, vivo], OGGI)
  assert.equal(righe.length, 1)
  assert.match(righe[0].periodo, /2/)
  assert.equal(righe[0].luogo, 'Arriva a Linate alle 08:40')
})

// ── Più arrivi nello stesso soggiorno (audit, 22/10/2026) ─────────────────────
const DOPO = '2031-01-01'
const tratto = (id: string, check_in: string, check_out: string, camera: string, arrivo: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ id, group_id: 'g-2030', prenotazione_id: null, check_in, check_out, status: 'completata', rooms: { name: camera }, check_in_time: null, shuttle: null, ...arrivo, ...extra }) as unknown as SegmentoStorico

test('caso dell’audit: due periodi separati da notti vuote, due arrivi datati e distinti', () => {
  const primo = tratto('a1', '2030-11-01', '2030-11-03', 'Lena', { ...vuoto, arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '14:20', check_in_time: '14:20', navetta: 'non_richiesta', shuttle: 'no' })
  const secondo = tratto('a2', '2030-11-08', '2030-11-10', 'Lena', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'malpensa', arrivo_luogo_ora_da: '11:35', navetta: 'alberto', navetta_prelievo: '12:05', shuttle: 'si' })
  const [r, ...altre] = arriviPrecedenti([secondo, primo], DOPO)
  assert.equal(altre.length, 0, 'il gruppo resta UNA riga')
  assert.equal(r.conData, true)
  assert.deepEqual(r.arrivi.map(a => [a.giorno, a.orario, a.luogo, a.navetta, a.prelievo]), [
    ['1 nov', 'arrivo 14:20', null, 'navetta no', null],
    ['8 nov', null, 'Arriva a Malpensa alle 11:35', 'navetta alberto', 'Prelievo a Malpensa · 12:05'],
  ])
  // il secondo arrivo NON finisce sul primo
  assert.equal(r.orario, 'arrivo 14:20')
  assert.equal(r.luogo, null)
})

test('cambio camera contiguo, camere parallele e intervalli sovrapposti: un arrivo solo', () => {
  const arr = { ...vuoto, arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '15:00', check_in_time: '15:00', navetta: 'non_richiesta' }
  const contiguo = arriviPrecedenti([tratto('c1', '2030-11-01', '2030-11-03', 'Ambra', arr), tratto('c2', '2030-11-03', '2030-11-05', 'Lena', arr)], DOPO)
  const parallele = arriviPrecedenti([tratto('p1', '2030-11-01', '2030-11-03', 'Ambra', arr), tratto('p2', '2030-11-01', '2030-11-03', 'Lena', arr)], DOPO)
  const sovrapposti = arriviPrecedenti([tratto('s1', '2030-11-01', '2030-11-05', 'Ambra', arr), tratto('s2', '2030-11-03', '2030-11-06', 'Lena', arr)], DOPO)
  for (const [nome, righe] of [['contiguo', contiguo], ['parallele', parallele], ['sovrapposti', sovrapposti]] as const) {
    assert.equal(righe.length, 1, nome)
    assert.equal(righe[0].arrivi.length, 1, `${nome}: un cambio camera non è un nuovo arrivo`)
    assert.equal(righe[0].conData, false, nome)
  }
  // le camere del gruppo restano quelle di righeStorico
  assert.equal(contiguo[0].camere, 'Ambra → Lena')
})

test('camere parallele: si legge il tratto che ha i dati, non il primo per id', () => {
  const [r] = arriviPrecedenti([
    tratto('p1', '2030-11-01', '2030-11-03', 'Ambra'),
    tratto('p2', '2030-11-01', '2030-11-03', 'Lena', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_ora_da: '10:00', navetta: 'massimo' }),
  ], DOPO)
  assert.equal(r.arrivi.length, 1)
  assert.equal(r.luogo, 'Arriva a Linate alle 10:00')
  assert.equal(r.conData, false, 'stesso giorno d’arrivo: la data non serve')
})

test('dati solo su un tratto successivo contiguo: si mostrano alla SUA data, senza provenienza inventata', () => {
  const [r] = arriviPrecedenti([
    tratto('v1', '2030-11-01', '2030-11-03', 'Ambra'),
    tratto('v2', '2030-11-03', '2030-11-05', 'Lena', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'rogoredo', arrivo_luogo_ora_da: '09:20', navetta: 'da_definire' }),
  ], DOPO)
  assert.equal(r.arrivi.length, 1)
  assert.equal(r.arrivi[0].data, '2030-11-03')
  assert.equal(r.arrivi[0].giorno, '3 nov')
  assert.equal(r.conData, true, 'la data dice che non è il giorno d’arrivo del soggiorno')
  assert.equal(r.arrivi[0].navetta, 'navetta da definire')
})

test('navetta: da definire salvato ≠ non registrata', () => {
  const [salvato] = arriviPrecedenti([tratto('n1', '2030-10-01', '2030-10-02', 'Ambra', { ...vuoto, arrivo_tipo: 'da_definire', navetta: 'da_definire' }, { group_id: 'n1' })], DOPO)
  const [niente] = arriviPrecedenti([tratto('n2', '2030-09-01', '2030-09-02', 'Ambra', {}, { group_id: 'n2' })], DOPO)
  assert.equal(salvato.navetta, 'navetta da definire')
  assert.equal(niente.navetta, 'navetta non registrata')
})

test('raggruppamenti, filtri e dati invariati con più arrivi', () => {
  const tutti = [
    tratto('a1', '2030-11-01', '2030-11-03', 'Lena', { ...vuoto, arrivo_tipo: 'struttura', arrivo_struttura_ora_da: '14:20' }),
    tratto('a2', '2030-11-08', '2030-11-10', 'Lena', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'malpensa', arrivo_luogo_ora_da: '11:35' }),
    tratto('a3', '2030-11-05', '2030-11-06', 'Ambra', { ...vuoto, arrivo_tipo: 'luogo', arrivo_luogo: 'linate', arrivo_luogo_ora_da: '07:00' }, { status: 'annullata' }),
  ]
  const prima = JSON.stringify(tutti)
  const [r] = arriviPrecedenti(tutti, DOPO)
  assert.equal(r.arrivi.length, 2, 'il tratto annullato non è un arrivo')
  assert.equal(r.arrivi.some(a => a.luogo?.includes('Linate')), false)
  assert.equal(JSON.stringify(tutti), prima)
  // con la seconda parte non ancora conclusa il soggiorno non è nello storico
  assert.equal(arriviPrecedenti(tutti, '2030-11-09').length, 0)
})
