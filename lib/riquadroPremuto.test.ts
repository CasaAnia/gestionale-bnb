// Il contenuto del riquadro del dito premuto (versione D, Ania 02/10/2026)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { contenutoRiquadro, DA_CHIEDERE, type DatiRiquadro, type RigaRiquadroDati } from './riquadroPremuto.ts'
import { LETTO_IN_PIU } from './daFarePrenotazione.ts'

const riga = (x: Partial<RigaRiquadroDati> = {}): RigaRiquadroDati => ({
  id: 'r1', room_id: 'ambra', group_id: 'g1', check_in: '2026-09-28', check_out: '2026-10-01', status: 'confermata',
  num_guests: 2, total_amount: 240, guest_name: 'Susanna Massarenti', rooms: { name: '03 Ambra' },
  guests: { full_name: 'Susanna Massarenti', phone: '3512224410', provenienza: 'google' },
  ...x,
})
const dati = (x: Partial<DatiRiquadro> = {}): DatiRiquadro => {
  const righe = x.righe ?? [riga()]
  return { premuta: righe[0], camera: '03 Ambra', coperte: undefined, righe, pagamenti: [], cambi: [], volte: 3, spesoCent: 76000, oggi: '2026-09-27', ...x }
}
const testo = (l: { testo: string }[]) => l.map(p => p.testo).join('')
const riga_ = (c: ReturnType<typeof contenutoRiquadro>, e: string) => c.righe.find(r => r.etichetta === e)

test('le righe nell’ordine del riferimento; Ospiti e Note solo quando servono', () => {
  const c = contenutoRiquadro(dati())
  assert.deepEqual(c.righe.map(r => r.etichetta), ['Arrivo', 'Partenza', 'Conto', 'Cliente'])
  const n = contenutoRiquadro(dati({ righe: [
    riga({ id: 'a', check_out: '2026-09-29', num_guests: 2, notes: 'vuole il cuscino basso' }),
    riga({ id: 'b', check_in: '2026-09-29', check_out: '2026-10-01', num_guests: 1 }),
  ] }))
  assert.deepEqual(n.righe.map(r => r.etichetta), ['Ospiti', 'Arrivo', 'Partenza', 'Conto', 'Cliente', 'Note'])
})

test('occhiello, titolo e telefono', () => {
  const c = contenutoRiquadro(dati())
  assert.equal(c.occhiello, 'Ambra · da incassare')
  assert.equal(c.titolo, 'Susanna Massarenti')
  assert.equal(c.telefono, '+39 351 222 4410')
  assert.equal(contenutoRiquadro(dati({ righe: [riga({ guests: { full_name: 'Susanna Massarenti' } })] })).telefono, '')
})

test('Ospiti: un periodo per riga, col testo dei periodi della scheda, solo se il numero cambia', () => {
  const c = contenutoRiquadro(dati({ righe: [
    riga({ id: 'a', check_out: '2026-09-29', num_guests: 2 }),
    riga({ id: 'b', check_in: '2026-09-29', check_out: '2026-10-01', num_guests: 1 }),
  ] }))
  const o = riga_(c, 'Ospiti')!
  assert.deepEqual(o.linee.map(testo), ['28 set. · 2 persone', '29–30 set. · 1 persona'])
  assert.equal(o.linee[0][0].tipo, 'b')
})

test('Arrivo: giorno in grassetto, senza orario «da chiedere» in grigio; i bagagli solo nell’arrivo', () => {
  const senza = riga_(contenutoRiquadro(dati()), 'Arrivo')!.linee[0]
  assert.equal(testo(senza), `lun 28 set · ${DA_CHIEDERE}`)
  assert.equal(senza[0].tipo, 'b')
  assert.equal(senza.at(-1)!.tipo, 'gr')
  const con = riga_(contenutoRiquadro(dati({ righe: [riga({ check_in_time: '15:00', bagagli_alle: '11:00', check_out_time: '10:30' })] })), 'Arrivo')!.linee[0]
  assert.match(testo(con), /^lun 28 set · 15:00.* · bagagli alle 11:00$/)
  const partenza = riga_(contenutoRiquadro(dati({ righe: [riga({ bagagli_alle: '11:00', check_out_time: '10:30' })] })), 'Partenza')!.linee[0]
  assert.equal(testo(partenza), 'gio 1 ott · 10:30')
  assert.ok(!/bagagli/.test(testo(partenza)))
})

test('Partenza senza check_out_time: «da chiedere» in grigio', () => {
  const p = riga_(contenutoRiquadro(dati()), 'Partenza')!.linee[0]
  assert.equal(testo(p), `gio 1 ott · ${DA_CHIEDERE}`)
  assert.equal(p.at(-1)!.tipo, 'gr')
})

test('Conto: totale in grassetto, acconti col metodo, «restano» in grigio; saldato «pagato con bonifico»', () => {
  const a = riga_(contenutoRiquadro(dati({ pagamenti: [{ booking_id: 'r1', amount: 120, method: 'bonifico' }] })), 'Conto')!.linee[0]
  assert.equal(testo(a), '240 € · acconto 120 € con bonifico · restano 120 €')
  assert.equal(a[0].tipo, 'b')
  assert.equal(a.at(-1)!.tipo, 'gr')
  const s = riga_(contenutoRiquadro(dati({ pagamenti: [{ booking_id: 'r1', amount: 240, method: 'bonifico' }] })), 'Conto')!.linee[0]
  assert.equal(testo(s), '240 € · pagato con bonifico')
  const c = riga_(contenutoRiquadro(dati({ pagamenti: [{ booking_id: 'r1', amount: 240, method: 'contanti' }] })), 'Conto')!.linee[0]
  assert.equal(testo(c), '240 € · pagato in contanti')
})

test('Conto: un pagamento intero copre tutta la prenotazione, anche col cambio camera (regola fissa n. 9)', () => {
  const righe = [riga({ id: 'a', check_out: '2026-09-30', total_amount: 160 }), riga({ id: 'b', room_id: 'allegra', rooms: { name: '02 Allegra' }, check_in: '2026-09-30', total_amount: 80 })]
  const c = contenutoRiquadro(dati({ righe, pagamenti: [{ booking_id: 'a', amount: 240, method: 'bonifico' }] }))
  assert.equal(testo(riga_(c, 'Conto')!.linee[0]), '240 € · pagato con bonifico')
})

test('Cliente: parole neutre della scheda, provenienza e speso in grassetto', () => {
  const c = riga_(contenutoRiquadro(dati()), 'Cliente')!.linee[0]
  assert.equal(testo(c), 'già ospite 3 volte · Google · 760 €')
  assert.equal(c.at(-1)!.tipo, 'b')
  assert.equal(testo(riga_(contenutoRiquadro(dati({ volte: 0, spesoCent: null })), 'Cliente')!.linee[0]), 'prima volta · Google')
  assert.ok(!/già stat/.test(readFileSync(new URL('./riquadroPremuto.ts', import.meta.url), 'utf8').replace(/\/\/.*$/gm, '')))
})

test('il Da fare arriva dalle regole di lib/daFarePrenotazione, col letto per primo', () => {
  const c = contenutoRiquadro(dati({
    righe: [riga({ extra_bed: true, accordo_pagamento: 'bonifico_intero', guests: { full_name: 'Susanna Massarenti', vuole_ricevuta: true } })],
    cambi: [{ giorno: '2026-09-30', camera: 'Allegra' }],
  }))
  assert.deepEqual(c.daFare.map(v => v.testo), [
    LETTO_IN_PIU, 'cambio camera: mer 30 passa in Allegra', 'chiedere l’ora d’arrivo', 'chiedere l’ora di partenza', 'controllare il bonifico', 'fare la ricevuta',
  ])
  assert.deepEqual(contenutoRiquadro(dati({ righe: [riga({ check_in_time: '15:00', check_out_time: '10:30', accordo_pagamento: 'contanti' })] })).daFare, [])
})
