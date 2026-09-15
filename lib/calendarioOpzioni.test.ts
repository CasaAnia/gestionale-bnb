// Le camere tenute sul calendario (15/09/2026): barre, letti tenuti, parole.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  barreTenute, barrePerCamera, lettiTenutiPerNotte, testoTenuta, comeDovevaPagare, segniDellaBarra,
  type RichiestaTenuta,
} from './calendarioOpzioni.ts'
import { campiLibera, indirizzoPrenotazioneNuova, testoConferma, quandoInParole } from './opzioneLibera.ts'

const AMBRA = { id: 'ambra', name: 'Ambra' }
const ALLEGRA = { id: 'allegra', name: 'Allegra' }
const INVIATA = '2026-09-20T11:40:00Z'          // 13:40 a Roma
const ADESSO = new Date('2026-09-20T12:20:00Z') // 14:20 a Roma: 40 minuti dopo

const segmento = (camera: { id: string; name: string }, arrivo: string, partenza: string, extra: Record<string, unknown> = {}) =>
  ({ camera, arrivo, partenza, totale: 170, prezzoNotte: 80, personeNotti: [2, 2], lettoNotti: [], ...extra })

const richiesta = (extra: Partial<RichiestaTenuta> = {}): RichiestaTenuta => ({
  id: 'r1', nome: 'Marta', cognome: 'Bruni', stato: 'proposta_inviata',
  proposta_inviata_at: INVIATA, condizione_pagamento: 'arrivo', telefono: '+393331234567',
  proposta_soluzione: { segmenti: [segmento(AMBRA, '2026-09-20', '2026-09-22', { lettoNotti: ['2026-09-20', '2026-09-21'] })] },
  ...extra,
})

test('una proposta inviata tiene la camera: la barra sa chi, quando e con che letto', () => {
  const barre = barreTenute([richiesta()], ADESSO)
  assert.equal(barre.length, 1)
  const b = barre[0]
  assert.equal(b.ospite, 'Marta Bruni')
  assert.equal(b.cameraNome, 'Ambra')
  assert.deepEqual([b.arrivo, b.partenza], ['2026-09-20', '2026-09-22'])
  assert.deepEqual(b.notti, ['2026-09-20', '2026-09-21'])
  assert.deepEqual(b.lettoNotti, ['2026-09-20', '2026-09-21'])
  assert.equal(b.persone, 2)
  assert.equal(b.prezzo, 170)
  assert.equal(b.anticipato, false, 'paga all’arrivo: barra bianca')
  assert.equal(b.scaduta, false)
  assert.equal(b.alternativa, false)
})

test('chi paga in anticipo tiene la camera ventiquattro ore, non tre', () => {
  const dopoQuattroOre = new Date('2026-09-20T15:40:00Z')
  const allArrivo = barreTenute([richiesta()], dopoQuattroOre)
  const conCaparra = barreTenute([richiesta({ condizione_pagamento: 'caparra' })], dopoQuattroOre)
  assert.equal(allArrivo[0].scaduta, true, 'le tre ore sono passate')
  assert.equal(conCaparra[0].scaduta, false, 'con la caparra è ancora tenuta')
  assert.equal(conCaparra[0].anticipato, true, 'barra a righine')
})

test('una richiesta senza proposta inviata non tiene niente', () => {
  assert.deepEqual(barreTenute([richiesta({ stato: 'in_attesa' })], ADESSO), [])
  assert.deepEqual(barreTenute([richiesta({ stato: 'confermata' })], ADESSO), [])
  assert.deepEqual(barreTenute([richiesta({ proposta_inviata_at: null })], ADESSO), [])
})

test('anche le camere alternative sono tenute, ma si riconoscono; niente doppioni', () => {
  const r = richiesta({
    proposta_alternative: [
      { segmenti: [segmento(ALLEGRA, '2026-09-20', '2026-09-22')] },
      { segmenti: [segmento(AMBRA, '2026-09-20', '2026-09-22')] },   // già nella soluzione
    ],
  })
  const barre = barreTenute([r], ADESSO)
  assert.equal(barre.length, 2, 'Ambra una volta sola')
  assert.equal(barrePerCamera(barre, 'allegra')[0].alternativa, true)
  assert.equal(barrePerCamera(barre, 'ambra')[0].alternativa, false)
})

test('un segmento storto non fa nascere una barra', () => {
  const rotta = richiesta({ proposta_soluzione: { segmenti: [
    { camera: null, arrivo: '2026-09-20', partenza: '2026-09-22' },
    { camera: AMBRA, arrivo: '2026-09-22', partenza: '2026-09-22' },
    { camera: AMBRA, arrivo: null, partenza: '2026-09-22' },
  ] } })
  assert.deepEqual(barreTenute([rotta], ADESSO), [])
})

test('i letti tenuti si contano per notte, e un cliente con due camere ne tiene uno', () => {
  const r = richiesta({
    proposta_alternative: [{ segmenti: [segmento(ALLEGRA, '2026-09-20', '2026-09-22', { lettoNotti: ['2026-09-20', '2026-09-21'] })] }],
  })
  const conto = lettiTenutiPerNotte(barreTenute([r], ADESSO))
  assert.equal(conto.get('2026-09-20'), 1, 'due camere proposte allo stesso cliente = un letto solo')
  assert.equal(conto.get('2026-09-21'), 1)
  assert.equal(conto.get('2026-09-22'), undefined)
  // due clienti diversi fanno due letti
  const due = lettiTenutiPerNotte(barreTenute([r, { ...richiesta(), id: 'r2', nome: 'Luigi', cognome: 'Conti' }], ADESSO))
  assert.equal(due.get('2026-09-20'), 2)
})

test('una tenuta scaduta non occupa più i letti', () => {
  const tardi = new Date('2026-09-20T16:00:00Z')
  assert.equal(lettiTenutiPerNotte(barreTenute([richiesta()], tardi)).size, 0)
})

test('le parole del foglietto dicono l’ora di Roma e da quanto è scaduta', () => {
  const viva = barreTenute([richiesta()], ADESSO)[0]
  assert.equal(testoTenuta(viva, ADESSO), 'tenuta fino alle 16:40')
  assert.equal(segniDellaBarra(viva), '🛏 · fino alle 16:40')
  assert.equal(comeDovevaPagare(viva), "paga all'arrivo")

  const scaduta = barreTenute([richiesta()], new Date('2026-09-20T15:20:00Z'))[0]
  assert.equal(testoTenuta(scaduta, new Date('2026-09-20T15:20:00Z')), 'tenuta scaduta 40 minuti fa')
  assert.equal(segniDellaBarra(scaduta), '🛏 · scaduta')

  const conCaparra = barreTenute([richiesta({ condizione_pagamento: 'caparra' })], ADESSO)[0]
  assert.equal(comeDovevaPagare(conCaparra), 'caparra in anticipo')
  assert.equal(comeDovevaPagare(barreTenute([richiesta({ condizione_pagamento: 'completo' })], ADESSO)[0]), 'pagamento completo in anticipo')
})

test('senza letto la barra non mostra il segno del letto', () => {
  const senza = barreTenute([richiesta({ proposta_soluzione: { segmenti: [segmento(AMBRA, '2026-09-20', '2026-09-22')] } })], ADESSO)[0]
  assert.equal(segniDellaBarra(senza), 'fino alle 16:40')
})

// ── liberare la camera ────────────────────────────────────────────────────
test('liberare non cancella mai: cambia stato e dice il motivo vero', () => {
  const adesso = new Date('2026-09-20T12:20:00Z')
  assert.deepEqual(campiLibera('un_altro_cliente', adesso), {
    stato: 'chiusa', chiusura_motivo: 'rifiutata', motivo_rifiuto: 'data_ad_altro',
    chiusa_at: '2026-09-20T12:20:00.000Z',
  })
  assert.equal(campiLibera('liberata', adesso).motivo_rifiuto, 'altro')
})

test('alla prenotazione nuova passano SOLO le date', () => {
  const url = indirizzoPrenotazioneNuova('2026-09-20', '2026-09-22')
  assert.match(url, /^\/nuova\?/)
  const p = new URLSearchParams(url.split('?')[1])
  assert.deepEqual([...p.keys()].sort(), ['check_in', 'check_out', 'returnTo'])
  assert.equal(p.get('check_in'), '2026-09-20')
  assert.equal(p.get('check_out'), '2026-09-22')
  assert.equal(p.get('returnTo'), '/calendario')
  assert.equal(url.includes('guest'), false, 'nessun cliente')
  assert.equal(url.includes('room'), false, 'nemmeno la camera')
  assert.equal(url.includes('price') || url.includes('sconto'), false, 'nessun accordo vecchio')
})

test('il pop-up dice tutto quello che sta per succedere', () => {
  const con = testoConferma({ camera: 'Ambra', ospite: 'Marta Bruni', quando: 'il 20 e il 21 settembre', prenotaDopo: true })
  assert.equal(con.titolo, 'Sei sicura?')
  assert.equal(con.righe[0], 'Ambra torna libera il 20 e il 21 settembre.')
  assert.match(con.righe[1], /resta in archivio/)
  assert.match(con.righe[2], /solo le date/)
  assert.equal(con.conferma, 'Sì, libera e prosegui')

  const senza = testoConferma({ camera: 'Ambra', ospite: 'Marta Bruni', quando: 'il 20 settembre', prenotaDopo: false })
  assert.equal(senza.righe.length, 2, 'se non si prenota, non si promette una pagina nuova')
  assert.equal(senza.conferma, 'Sì, libera la camera')
})

test('le notti si dicono come le direbbe una persona', () => {
  assert.equal(quandoInParole(['2026-09-20']), 'il 20 settembre')
  assert.equal(quandoInParole(['2026-09-20', '2026-09-21']), 'il 20 e il 21 settembre')
  assert.equal(quandoInParole(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-23']), 'dal 20 al 23 settembre')
  assert.equal(quandoInParole(['2026-09-30', '2026-10-01']), 'il 30 settembre e il 1 ottobre')
  assert.equal(quandoInParole(['2026-09-29', '2026-09-30', '2026-10-01']), 'dal 29 settembre al 1 ottobre')
  assert.equal(quandoInParole([]), 'per quelle notti')
})
