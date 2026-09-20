// REGOLA FISSA n. 9 (Ania, 20/09/2026): con cambio camera o camera aggiunta il
// pagamento si divide in ordine di tempo, saldando del tutto la prima parte
// prima di passare alla successiva. Vedi REGOLE-FISSE.md.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dividiPagamentoCent, trattiInOrdine, notaParte, NOTA_PARTE, pianoValido, pianoDaUsare } from './pagamentoDiviso.ts'

// I tre tratti di Rosa Macauda (settembre 2026): Ambra 1→7 (420), Amelia 7→11 (320), Ambra+Lena 11→25 (1120)
const A = { id: 'a', status: 'confermata', check_in: '2026-09-01', total_amount: 420 }
const B = { id: 'b', status: 'confermata', check_in: '2026-09-07', total_amount: 320 }
const C = { id: 'c', status: 'confermata', check_in: '2026-09-11', total_amount: 1120 }
const ROSA = [C, A, B]   // in disordine apposta: comanda la data

test('il caso di Ania: il primo 400 € va tutto sulla prima parte, il secondo si divide in 20 + 320 + 60', () => {
  assert.deepEqual(dividiPagamentoCent(ROSA, [], 40000), [{ booking_id: 'a', amountCent: 40000 }])
  const dopo = [{ booking_id: 'a', amount: 400 }]
  assert.deepEqual(dividiPagamentoCent(ROSA, dopo, 40000), [
    { booking_id: 'a', amountCent: 2000 },
    { booking_id: 'b', amountCent: 32000 },
    { booking_id: 'c', amountCent: 6000 },
  ])
})

test('la prima parte si salda DEL TUTTO prima di passare alla seconda; la somma delle parti è sempre l’importo', () => {
  for (const importo of [100, 41999, 42000, 42001, 74000, 186000, 200000]) {
    const parti = dividiPagamentoCent(ROSA, [], importo)
    assert.equal(parti.reduce((s, p) => s + p.amountCent, 0), importo, `somma per ${importo}`)
    if (importo <= 42000) assert.deepEqual(parti.map(p => p.booking_id), ['a'])
    else assert.equal(parti[0].amountCent, 42000, `la prima parte piena per ${importo}`)
    // le parti seguono l’ordine di tempo, mai un tratto dopo prima di uno prima
    assert.deepEqual(parti.map(p => p.booking_id), ['a', 'b', 'c'].filter(id => parti.some(p => p.booking_id === id)))
  }
})

test('oltre il dovuto di tutto il soggiorno l’eccedenza resta sull’ultima parte', () => {
  assert.deepEqual(dividiPagamentoCent(ROSA, [], 200000), [
    { booking_id: 'a', amountCent: 42000 }, { booking_id: 'b', amountCent: 32000 }, { booking_id: 'c', amountCent: 126000 },
  ])
  // già tutto saldato: il pagamento in più va sull’ultimo tratto e basta
  const saldato = [{ booking_id: 'a', amount: 420 }, { booking_id: 'b', amount: 320 }, { booking_id: 'c', amount: 1120 }]
  assert.deepEqual(dividiPagamentoCent(ROSA, saldato, 5000), [{ booking_id: 'c', amountCent: 5000 }])
})

test('quello che avanza su una parte, o sta su un tratto annullato, scorre in avanti prima del pagamento nuovo', () => {
  // 800 tutti sulla prima parte (il vecchio modo): coprono 420 + 320 + 60, il nuovo pagamento parte da lì
  const vecchio = [{ booking_id: 'a', amount: 800 }]
  assert.deepEqual(dividiPagamentoCent(ROSA, vecchio, 10000), [{ booking_id: 'c', amountCent: 10000 }])
  // un incasso finito su un tratto poi annullato resta nel conto del soggiorno
  const X = { id: 'x', status: 'annullata', check_in: '2026-09-25', total_amount: 240 }
  const conAnnullato = [{ booking_id: 'x', amount: 420 }]
  assert.deepEqual(dividiPagamentoCent([...ROSA, X], conAnnullato, 10000), [{ booking_id: 'b', amountCent: 10000 }])
  // pagamenti di un’altra prenotazione non contano
  assert.deepEqual(dividiPagamentoCent(ROSA, [{ booking_id: 'altra', amount: 9999 }], 10000), [{ booking_id: 'a', amountCent: 10000 }])
})

test('una camera sola: tutto sull’unica parte; niente parti senza importo o senza tratti', () => {
  assert.deepEqual(dividiPagamentoCent([A], [], 25000), [{ booking_id: 'a', amountCent: 25000 }])
  assert.deepEqual(dividiPagamentoCent(ROSA, [], 0), [])
  assert.deepEqual(dividiPagamentoCent(ROSA, [], NaN), [])
  assert.deepEqual(dividiPagamentoCent([{ ...A, status: 'annullata' }], [], 25000), [])
  assert.deepEqual(trattiInOrdine([C, { ...B, status: 'annullata' }, A]).map(t => t.id), ['a', 'c'])
})

test('i centesimi: 62,50 € su due tratti da 40 e 30 → 40 + 22,50', () => {
  const T1 = { id: 't1', status: 'confermata', check_in: '2026-10-01', total_amount: '40.00' }
  const T2 = { id: 't2', status: 'confermata', check_in: '2026-10-02', total_amount: 30 }
  assert.deepEqual(dividiPagamentoCent([T1, T2], [], 6250), [{ booking_id: 't1', amountCent: 4000 }, { booking_id: 't2', amountCent: 2250 }])
})

test('la nota di ogni parte dice di che pagamento è; con una parte sola resta la nota di Ania', () => {
  assert.equal(NOTA_PARTE(40000), 'Parte di un pagamento di 400 €')
  assert.equal(notaParte('', 40000, 3), 'Parte di un pagamento di 400 €')
  assert.equal(notaParte(' saldo di settembre ', 40000, 3), 'saldo di settembre · Parte di un pagamento di 400 €')
  assert.equal(notaParte(' saldo ', 40000, 1), 'saldo')
  assert.equal(notaParte('', 40000, 1), '')
})

test('il piano custodito si riusa solo per lo stesso pagamento e sugli stessi tratti; altrimenti si divide di nuovo', () => {
  const dati = { amountCent: 40000, method: 'contanti', paid_on: '2026-09-16' }
  const piano = pianoDaUsare(null, ROSA, [{ booking_id: 'a', amount: 400 }], dati)
  assert.deepEqual(piano.parti, [{ booking_id: 'a', amountCent: 2000 }, { booking_id: 'b', amountCent: 32000 }, { booking_id: 'c', amountCent: 6000 }])
  assert.ok(pianoValido(piano))
  // la prima parte è stata scritta, poi la PWA si è ricaricata: stesse parti, non 320 + 80
  const scrittaUnaParte = [{ booking_id: 'a', amount: 400 }, { booking_id: 'a', amount: 20 }]
  assert.deepEqual(pianoDaUsare(piano, ROSA, scrittaUnaParte, dati), piano)
  // pagamento diverso → piano nuovo
  assert.notDeepEqual(pianoDaUsare(piano, ROSA, scrittaUnaParte, { ...dati, amountCent: 30000 }).parti, piano.parti)
  assert.notDeepEqual(pianoDaUsare(piano, ROSA, scrittaUnaParte, { ...dati, paid_on: '2026-09-17' }), piano)
  // piano rotto o di un’altra prenotazione → si ignora
  assert.equal(pianoValido({ ...piano, parti: [{ booking_id: 'a', amountCent: 100 }] }), false)
  assert.equal(pianoValido('{}'), false)
  assert.notDeepEqual(pianoDaUsare({ ...piano, parti: [{ booking_id: 'z', amountCent: 40000 }] }, ROSA, [], dati).parti, [{ booking_id: 'z', amountCent: 40000 }])
})

// ── La guardia sul sorgente: il salvataggio passa dalla divisione ───────────
const RADICE = join(dirname(fileURLToPath(import.meta.url)), '..')
test('lib/pagamentiDati registra il pagamento passando dal piano diviso, una riga per parte', () => {
  const s = readFileSync(join(RADICE, 'lib/pagamentiDati.ts'), 'utf8')
  assert.match(s, /pianoDaUsare\(/, 'il salvataggio deve chiedere il piano delle parti')
  assert.match(s, /for \(const parte of piano\.parti\)/, 'una scrittura per ogni parte, in ordine')
  assert.match(s, /notaParte\(/, 'ogni parte porta la nota «Parte di un pagamento di …»')
  assert.doesNotMatch(s, /eseguiRegistraAcconto\(booking\.id,/, 'niente più tutto il pagamento sulla camera da cui si apre la scheda')
})
