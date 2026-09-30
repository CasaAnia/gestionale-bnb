// ============================================================================
// REGOLA FISSA n. 9, i conti fuori dalla scheda (Ania, 30/09/2026: «correggi
// la Home così conta per prenotazione», «evita ripetizioni future»).
//
// Il caso vero: Dario Barone, Allegra 20 → 21 set (80 €) e Amelia 21 → 30 set
// (650 €), la stessa prenotazione ma due group_id diversi perché Allegra è
// stata AGGIUNTA e non nata da un cambio camera. Bonifico di 710 € registrato
// su Allegra, 20 € in contanti su Amelia: 730 su 730, saldato. La Home
// raggruppava per group_id e diceva «resta 630 €» su Amelia (e 630 € in più
// su Allegra, che non mostrava).
//
// Ogni conto di soldi (Home, calendario, controlli delle statistiche) mette
// insieme le camere per PRENOTAZIONE: identitaSoggiorno, cioè prenotazione_id,
// poi group_id, poi la riga. La guardia in fondo impedisce di tornare al solo
// group_id nei file che fanno questi conti.
// ============================================================================
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { daIncassare } from './statistiche/intervallo.ts'
import { incassiMese } from './statistiche/cassa.ts'
import { vociDaIncassare, partenzeConResiduo, incassatiOggi } from './incassiHome.ts'
import { nottiPagate as nottiPagateBarre } from './calendarioBarre.ts'
import { nottiPagate as nottiPagateNastro } from './calendarioNastro.ts'
import { eccezioniPagamenti } from './daControllare.ts'

const allegra = { id: 'allegra', room_id: 'r-allegra', guest_id: 'g', group_id: 'gruppo-allegra', prenotazione_id: 'P', check_in: '2026-09-20', check_out: '2026-09-21', num_guests: 2, price_per_night: 80, total_amount: 80, status: 'confermata', guest_name: 'Dario Barone', rooms: { name: 'Allegra' }, accordo_pagamento: 'contanti' }
const amelia = { id: 'amelia', room_id: 'r-amelia', guest_id: 'g', group_id: 'gruppo-amelia', prenotazione_id: 'P', check_in: '2026-09-21', check_out: '2026-09-30', num_guests: 2, price_per_night: 70, total_amount: 650, status: 'confermata', guest_name: 'Dario Barone', rooms: { name: 'Amelia' }, accordo_pagamento: 'contanti' }
const DARIO = [allegra, amelia]
const PAGAMENTI = [
  { booking_id: 'allegra', amount: 710, paid_on: '2026-09-18', method: 'bonifico' },
  { booking_id: 'amelia', amount: 20, paid_on: '2026-09-26', method: 'contanti' },
]

test('Dario Barone: la Home non vede niente da incassare su una prenotazione saldata con due group_id', () => {
  assert.deepEqual(daIncassare(DARIO as never, PAGAMENTI), [])
  assert.deepEqual(vociDaIncassare(DARIO as never, PAGAMENTI as never, '2026-09-30'), [])
  assert.deepEqual(partenzeConResiduo([amelia] as never, DARIO as never, PAGAMENTI as never), [])
  assert.equal(incassatiOggi(DARIO as never, PAGAMENTI as never, '2026-09-26')[0].testo, 'contanti · saldo completo')
})

test('Dario Barone con 100 € in meno: una voce sola per la prenotazione, 730 − 630 = 100 €', () => {
  const pag = [{ ...PAGAMENTI[0], amount: 610 }, PAGAMENTI[1]]
  const d = daIncassare(DARIO as never, pag)
  assert.equal(d.length, 1)
  assert.deepEqual([d[0].dovutoCent, d[0].ricevutoCent, d[0].residuoCent], [73000, 63000, 10000])
  const v = vociDaIncassare(DARIO as never, pag as never, '2026-09-30')
  assert.equal(v[0].camere, 'Allegra → Amelia')
  assert.equal(v[0].residuoCent, 10000)
  assert.equal(partenzeConResiduo([amelia] as never, DARIO as never, pag as never)[0].residuoCent, 10000)
})

test('i controlli delle statistiche non vedono «pagamenti oltre il totale» su Allegra', () => {
  const inc = incassiMese('2026-09', DARIO as never, PAGAMENTI, '2026-09-30').incoerenze
  assert.deepEqual(inc.filter(i => i.tipo === 'pagamenti_oltre_il_totale'), [])
})

test('calendario: i 730 € coprono tutte le notti di Allegra e di Amelia', () => {
  const acconti = { allegra: 710, amelia: 20 }
  assert.deepEqual(nottiPagateBarre(DARIO as never, acconti), { allegra: -1, amelia: -1 })
  assert.deepEqual(nottiPagateNastro(DARIO as never, acconti, []), { allegra: -1, amelia: -1 })
})

test('«Da controllare»: niente voce su Dario anche senza il segno «pagato», una voce sola (Amelia) se mancano 100 €', () => {
  const senzaSegno = DARIO.map(b => ({ ...b, pagato: false }))
  assert.deepEqual(eccezioniPagamenti(senzaSegno as never, PAGAMENTI, '2026-09-30'), [])
  const out = eccezioniPagamenti(senzaSegno as never, [{ ...PAGAMENTI[0], amount: 610 }, PAGAMENTI[1]], '2026-09-30')
  assert.equal(out.length, 1)
  // Allegra è coperta dai 630 €: resta solo Amelia, con l'avanzo di 550 €
  assert.equal(out[0].chiave, 'pagamento:P')
  assert.match(out[0].titolo, /Amelia/)
  assert.doesNotMatch(out[0].titolo, /Allegra/)
  assert.match(out[0].motivo, /registrati 550 € su 650 €/)
  assert.deepEqual(out[0].destinazione, { tipo: 'saldo', prenotazioneId: 'amelia' })
})

test('«Da controllare»: i soldi scorrono in ordine di arrivo, la camera già coperta esce dalla voce', () => {
  const senzaSegno = DARIO.map(b => ({ ...b, pagato: false }))
  // 100 € registrati su Amelia coprono prima Allegra (80 €): resta Amelia con 20 € su 650 €
  const out = eccezioniPagamenti(senzaSegno as never, [{ booking_id: 'amelia', amount: 100, paid_on: '2026-09-21' }], '2026-09-30')
  assert.equal(out.length, 1)
  assert.match(out[0].titolo, /Amelia/)
  assert.doesNotMatch(out[0].titolo, /Allegra/)
  assert.match(out[0].motivo, /registrati 20 € su 650 €/)
})

test('camere di prenotazioni diverse restano separate: nessun legame dedotto da cliente o date', () => {
  const altra = { ...amelia, prenotazione_id: 'Q' }
  const d = daIncassare([allegra, altra] as never, PAGAMENTI)
  assert.equal(d.length, 1)
  assert.equal(d[0].residuoCent, 63000)
})

// ── La guardia ──────────────────────────────────────────────────────────────
// Nei file che fanno i conti dei soldi le camere si raggruppano con
// identitaSoggiorno (o chiavePrenotazione), mai col solo group_id.
const FILE_DEI_SOLDI = [
  'lib/statistiche/intervallo.ts',
  'lib/statistiche/cassa.ts',
  'lib/incassiHome.ts',
  'lib/calendarioBarre.ts',
  'lib/calendarioNastro.ts',
  'lib/daControllare.ts',
]
test('REGOLA FISSA n. 9: i conti dei soldi raggruppano per prenotazione, mai per il solo group_id', () => {
  for (const f of FILE_DEI_SOLDI) {
    const src = readFileSync(new URL(`../${f}`, import.meta.url), 'utf8')
    assert.doesNotMatch(src, /(?<!prenotazione_id \|\| )\b\w+\.group_id \|\| \w+\.id\b/, `${f}: raggruppa i soldi per prenotazione (identitaSoggiorno), non per group_id`)
    assert.match(src, /identitaSoggiorno|chiavePrenotazione/, `${f}: deve usare identitaSoggiorno`)
  }
})
