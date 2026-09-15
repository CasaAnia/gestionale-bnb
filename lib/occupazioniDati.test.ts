// La lettura di chi occupa camere e letti (rilievi 7 e 8 del 15/09/2026).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { leggiOccupazioni, daQuandoLeggere, PAGINA, NON_LETTE } from './occupazioniDati.ts'

const riga = (i: number) => ({ room_id: 'lena', check_in: '2026-10-01', check_out: '2026-10-02', status: 'confermata', num_guests: 2, id: `r${i}` })

test('legge TUTTE le pagine, non solo le prime mille righe', async () => {
  const tutte = Array.from({ length: PAGINA * 2 + 7 }, (_, i) => riga(i))
  const chiamate: [number, number][] = []
  const esito = await leggiOccupazioni(async (da, a) => {
    chiamate.push([da, a])
    return { data: tutte.slice(da, a + 1), error: null }
  }, '2026-10-01')
  assert.equal(esito.stato, 'pronte')
  assert.equal(esito.stato === 'pronte' && esito.righe.length, tutte.length)
  assert.equal(chiamate.length, 3)
  assert.deepEqual(chiamate[0], [0, PAGINA - 1])
})

test('una pagina esatta non ferma la lettura', async () => {
  const tutte = Array.from({ length: PAGINA }, (_, i) => riga(i))
  let giri = 0
  const esito = await leggiOccupazioni(async (da, a) => {
    giri += 1
    return { data: tutte.slice(da, a + 1), error: null }
  }, '2026-10-01')
  assert.equal(giri, 2, 'con mille righe esatte serve una seconda pagina per sapere che è finita')
  assert.equal(esito.stato === 'pronte' && esito.righe.length, PAGINA)
})

test('un errore NON diventa «nessuno occupa»', async () => {
  const esito = await leggiOccupazioni(async () => ({ data: null, error: { message: 'rete' } }), '2026-10-01')
  assert.equal(esito.stato, 'errore')
  assert.equal(esito.stato === 'errore' && esito.messaggio, NON_LETTE)
})

test('anche un’eccezione è un errore, non un elenco vuoto', async () => {
  const esito = await leggiOccupazioni(async () => { throw new Error('caduta') }, '2026-10-01')
  assert.equal(esito.stato, 'errore')
})

test('si legge da oggi, o da più indietro se la prenotazione comincia prima', () => {
  assert.equal(daQuandoLeggere('2026-09-15', []), '2026-09-15')
  assert.equal(daQuandoLeggere('2026-09-15', ['2026-10-01']), '2026-09-15')
  assert.equal(daQuandoLeggere('2026-09-15', ['2026-08-30', '2026-10-01']), '2026-08-30')
  assert.equal(daQuandoLeggere('2026-09-15', ['']), '2026-09-15')
})

test('la pagina non salva se non sa chi occupa', () => {
  const pagina = readFileSync(new URL('../app/nuova-prenotazione/page.tsx', import.meta.url), 'utf8')
  // rilettura prima di scrivere, e stop se non riesce
  assert.match(pagina, /const lettura = await caricaOccupazioni\(daQuandoLeggere\(oggi, periodi\.map\(p => p\.checkIn\)\)\)/)
  assert.match(pagina, /if \(lettura\.stato === 'errore'\) \{ setGuai\(\[NON_LETTE\]\); setAvvisoSalva\(NON_LETTE\); return \}/)
  // i conflitti si controllano sulle righe appena lette, non su quelle vecchie
  assert.match(pagina, /conflittiConAltre\(periodiColLetto, trova, adesso\)/)
  // e a schermo si dice quando la lettura non è pronta
  assert.match(pagina, /data-occupazioni-stato/)
  // niente «data ?? []» che nasconde l'errore
  assert.doesNotMatch(pagina, /from\('bookings'\)[\s\S]{0,200}then\(\(\{ data \}\) => \{ if \(vivo\) setAltre/)
})
